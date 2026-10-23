// 穿插造句：打字过程中每隔几个词插一张造句卡（填空 / 中译英），本地即时判题，AI 点评在一组结束时批量进行。

import { diffSentence, type SentenceDiff } from "./dictation.ts";
import { usesWord } from "./ai.ts";

export type CardKind = "cloze" | "translate";

export interface CardWord {
  word: string;
  meaning: string;
}

/** 一张卡的安排：打完第 after 个词后出现，用哪些词、什么题型 */
export interface CardPlan {
  after: number;
  kind: CardKind;
  words: CardWord[];
}

export interface PracticeCard {
  kind: CardKind;
  words: string[];
  /** 填空：挖了一个 ___ 的英文句子 */
  sentence?: string;
  /** 填空：被挖掉的原文（可能是变形） */
  answer?: string;
  /** 中译英：要翻译的中文句子 */
  zh?: string;
  /** 中译英：参考译文 */
  reference?: string;
  /** 填空句的中文翻译（作提示） */
  translation?: string;
}

/** 每组最多几张卡 */
export const MAX_CARDS = 3;

/**
 * 安排本组的造句卡：每打完 every 个词插一张（每组最多 3 张），题型轮流为填空、中译英。
 * 填空只考 1 个刚学的词；中译英用 1～2 个刚学的词，再混入 1 个历史易错 / mark 的词。
 */
export function planCards(batch: CardWord[], extras: CardWord[], every: number): CardPlan[] {
  const plans: CardPlan[] = [];
  const used = new Set<string>();
  for (let i = 0; plans.length < MAX_CARDS; i += 1) {
    const after = every * (i + 1);
    if (after > batch.length) break;
    const kind: CardKind = i % 2 === 0 ? "cloze" : "translate";
    // 优先用较长的词（短词如 run 造句价值低）
    const segment = batch
      .slice(after - every, after)
      .filter((w) => !used.has(w.word.toLowerCase()))
      .sort((a, b) => b.word.length - a.word.length);
    const picked = segment.slice(0, kind === "cloze" ? 1 : 2);
    if (!picked.length) continue;
    if (kind === "translate") {
      const extra = extras.find((w) => !used.has(w.word.toLowerCase()) && !batch.some((b) => b.word.toLowerCase() === w.word.toLowerCase()));
      if (extra) picked.push(extra);
    }
    picked.forEach((w) => used.add(w.word.toLowerCase()));
    plans.push({ after, kind, words: picked });
  }
  return plans;
}

/**
 * 在整组中安排造句卡：只用英文词出题，after 换算成整组中的位置（组里混入日语词时也对得上）；
 * 最后一个词之后是组总结，不在那里插卡。
 */
export function planBatchCards(batch: (CardWord & { lang: string })[], extras: CardWord[], every: number): CardPlan[] {
  const pos: number[] = [];
  const en: CardWord[] = [];
  batch.forEach((w, i) => {
    if (w.lang !== "en") return;
    pos.push(i);
    en.push({ word: w.word, meaning: w.meaning });
  });
  return planCards(en, extras, every)
    .map((p) => ({ ...p, after: pos[p.after - 1]! + 1 }))
    .filter((p) => p.after < batch.length);
}

/** 每组题数包含造句题：total 道题里放多少个单词（其余是造句卡） */
export function wordsPerBatch(total: number, every: number): number {
  for (let w = total; w > 0; w -= 1) {
    if (w + Math.min(MAX_CARDS, Math.floor((w - 1) / every)) <= total) return w;
  }
  return total;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 没有 AI 时：用词库自带的例句出填空题（挖掉目标词，允许常见词形变化） */
export function localCloze(word: string, example: { sentence: string; translation: string } | undefined): PracticeCard | null {
  if (!example?.sentence) return null;
  const w = word.toLowerCase();
  const stem = w.length > 4 ? w.replace(/(e|y)$/, "") : w;
  const re = new RegExp(`\\b(${escape(stem)}[a-z]{0,4})\\b`, "i");
  const m = re.exec(example.sentence);
  if (!m || !m[1]!.toLowerCase().startsWith(stem)) return null;
  return { kind: "cloze", words: [word], sentence: example.sentence.replace(m[1]!, "___"), answer: m[1]!, translation: example.translation };
}

/** 填空判题：忽略大小写与首尾空格；填了原形（未变形）也算对，但会提示正确形式 */
export function gradeCloze(card: PracticeCard, input: string): { correct: boolean; exact: boolean } {
  const v = input.trim().toLowerCase();
  const answer = (card.answer ?? "").toLowerCase();
  if (v === answer) return { correct: true, exact: true };
  return { correct: card.words.some((w) => w.toLowerCase() === v), exact: false };
}

/** 中译英判题：与参考译文逐词比对，并检查每个目标词是否用上（允许变形） */
export function gradeTranslate(card: PracticeCard, input: string): { diff: SentenceDiff; used: Record<string, boolean>; ok: boolean } {
  const diff = diffSentence(card.reference ?? "", input);
  const used = Object.fromEntries(card.words.map((w) => [w, usesWord(input, w)]));
  return { diff, used, ok: Object.values(used).every(Boolean) && input.trim().split(/\s+/).length >= 4 };
}

const CJK = /[㐀-鿿]/;

/** 解析出题结果：与安排一一对应，不合格的题为 null（跳过，不打扰学习） */
export function parsePracticeCards(content: string, plans: CardPlan[]): (PracticeCard | null)[] {
  let root: unknown;
  try {
    root = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
  } catch {
    throw new Error("AI 返回内容无法解析");
  }
  const list = Array.isArray((root as { cards?: unknown })?.cards) ? ((root as { cards: Record<string, unknown>[] }).cards) : [];
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return plans.map((plan, i) => {
    const c = list[i] ?? {};
    const words = plan.words.map((w) => w.word);
    if (plan.kind === "cloze") {
      const sentence = str(c.sentence);
      const answer = str(c.answer);
      const ok = sentence.split("___").length === 2 && answer && usesWord(sentence.replace("___", answer), words[0]!);
      return ok ? { kind: "cloze", words, sentence, answer, translation: str(c.translation) } : null;
    }
    const zh = str(c.zh);
    const reference = str(c.reference);
    const ok = CJK.test(zh) && reference && words.every((w) => usesWord(reference, w));
    return ok ? { kind: "translate", words, zh, reference } : null;
  });
}

export type Verdict = "great" | "good" | "fix";

export interface CardReview {
  verdict: Verdict;
  /** 0～100，跑题或无法识别时为 null（显示时换算为 5～10，见 displayScore） */
  score: number | null;
  comment: string;
  better: string;
  misused: string[];
}

/** words：每项的目标词；misused 只保留真正属于目标词的（允许变形） */
export function parsePracticeReview(content: string, words: string[][]): (CardReview | null)[] {
  let root: unknown;
  try {
    root = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
  } catch {
    throw new Error("AI 返回内容无法解析");
  }
  const list = Array.isArray((root as { reviews?: unknown })?.reviews) ? (root as { reviews: Record<string, unknown>[] }).reviews : [];
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const out = words.map((targets, i) => {
    const r = list[i];
    if (!r) return null;
    const verdict = (["great", "good", "fix"] as const).find((v) => v === r.verdict) ?? "good";
    const raw = Array.isArray(r.misused) ? r.misused.map(str).filter(Boolean) : [];
    const misused = targets.filter((t) => raw.some((m) => usesWord(m, t) || usesWord(t, m)));
    const score = r.offTopic === true || typeof r.score !== "number" ? null : Math.min(100, Math.max(0, r.score));
    return { verdict, score, comment: str(r.comment).replace(/^(中文|Chinese)[:：]\s*/i, ""), better: str(r.better), misused };
  });
  if (!out.some(Boolean)) throw new Error("AI 未返回有效的点评");
  return out;
}
