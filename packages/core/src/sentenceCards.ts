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
 * 每张只考 1 个刚学的词：中译英要拼出整句，目标词多了句子就长，太难。
 */
export function planCards(batch: CardWord[], every: number): CardPlan[] {
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
    const picked = segment.slice(0, 1);
    if (!picked.length) continue;
    picked.forEach((w) => used.add(w.word.toLowerCase()));
    plans.push({ after, kind, words: picked });
  }
  return plans;
}

/**
 * 在整组中安排造句卡：只用英文词出题，after 换算成整组中的位置（组里混入日语词时也对得上）；
 * 最后一个词之后是组总结，不在那里插卡。
 */
export function planBatchCards(batch: (CardWord & { lang: string })[], every: number): CardPlan[] {
  const pos: number[] = [];
  const en: CardWord[] = [];
  batch.forEach((w, i) => {
    if (w.lang !== "en") return;
    pos.push(i);
    en.push({ word: w.word, meaning: w.meaning });
  });
  return planCards(en, every)
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

/**
 * 造句题按段拼写：要打的段（一个单词；目标短语合成一段）与只显示的部分。
 * 渲染时依次拼接 lead + text + trail，段与段之间不再另加空格。
 */
export interface SentenceChunk {
  text: string;
  /** 只显示、不用打（填空题里空位以外的句子） */
  given: boolean;
  /** 目标词所在的段 */
  target: boolean;
  /** 段前的标点（如引号），只显示 */
  lead: string;
  /** 段后的标点与空格，只显示 */
  trail: string;
  /** 多词目标（如 look forward to）拆成逐词的段时，这几段共同的整个短语 */
  phrase?: string;
}

/** 要打的一个词或短语拆成逐词的段：每个词单独检查，对了就往下走 */
function wordChunks(text: string, target: boolean): SentenceChunk[] {
  const words = text.trim().split(/\s+/);
  const phrase = words.length > 1 ? words.join(" ") : undefined;
  return words.map((w, i) => ({ text: w, given: false, target, lead: "", trail: i < words.length - 1 ? " " : "", ...(phrase ? { phrase } : {}) }));
}

/** 拆成单词：首尾的标点只显示，词中的撇号、短横线要打 */
function wordTokens(sentence: string): { lead: string; core: string; trail: string }[] {
  const parts = sentence.trim().split(/(\s+)/);
  const out: { lead: string; core: string; trail: string }[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const m = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u.exec(parts[i]!)!;
    const space = parts[i + 1] ? " " : "";
    if (!m[2]) {
      // 单独的标点（如破折号）并到前一段后面
      const last = out[out.length - 1];
      if (last) last.trail += m[0] + space;
      continue;
    }
    out.push({ lead: m[1]!, core: m[2]!, trail: m[3]! + space });
  }
  return out;
}

/** 中译英：参考译文逐词成段；目标短语（如 look forward to）也逐词成段，记下所属短语 */
export function translateChunks(reference: string, targets: string[]): SentenceChunk[] {
  const tokens = wordTokens(reference);
  const chunks: SentenceChunk[] = [];
  for (let i = 0; i < tokens.length; ) {
    let merged = 1;
    let target = false;
    for (const w of targets) {
      // 短语逐词比对，每个词都允许变形（looking forward to）
      const words = w.trim().split(/\s+/);
      const n = words.length;
      const window = tokens.slice(i, i + n);
      if (window.length === n && window.every((t, k) => usesWord(t.core, words[k]!)) && window.slice(0, -1).every((t) => t.trail === " ")) {
        merged = Math.max(merged, n);
        target = true;
      }
    }
    const group = tokens.slice(i, i + merged);
    const phrase = merged > 1 ? group.map((t) => t.core).join(" ") : undefined;
    for (const t of group) chunks.push({ text: t.core, given: false, target, lead: t.lead, trail: t.trail, ...(phrase ? { phrase } : {}) });
    i += merged;
  }
  return chunks;
}

/** 填空：空位是要打的段（多个词时逐词成段），其余句子只显示 */
export function clozeChunks(sentence: string, answer: string): SentenceChunk[] {
  const [before = "", after = ""] = sentence.split("___");
  const given = (text: string): SentenceChunk[] => (text ? [{ text, given: true, target: false, lead: "", trail: "" }] : []);
  return [...given(before), ...wordChunks(answer, true), ...given(after)];
}

/** text 是否就是目标词（或短语）的某种变形：逐词比对，每个词都允许变形（looked forward to） */
export function isTargetForm(text: string, target: string): boolean {
  const a = text.trim().split(/\s+/);
  const b = target.trim().split(/\s+/);
  return a.length === b.length && a.every((x, i) => usesWord(x, b[i]!));
}

/** “用起来”练习的一句：中文题目，英文里方括号括起来的是要用出来的词 */
export interface UseWordsItem {
  zh: string;
  /** 带方括号标记的英文 */
  en: string;
  /** 用到的目标词（原形） */
  words: string[];
}

/** 英文里方括号括起来的目标词是要打的段（多个词时逐词成段），其余只显示 */
export function bracketChunks(en: string): SentenceChunk[] {
  const chunks: SentenceChunk[] = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  for (let m = re.exec(en); m; m = re.exec(en)) {
    if (m.index > last) chunks.push({ text: en.slice(last, m.index), given: true, target: false, lead: "", trail: "" });
    chunks.push(...wordChunks(m[1]!, true));
    last = m.index + m[0].length;
  }
  if (last < en.length) chunks.push({ text: en.slice(last), given: true, target: false, lead: "", trail: "" });
  return chunks;
}

/** 解析“用起来”练习：每句至少有一个括起来的目标词，中文不夹英文；去掉不合格的句子 */
export function parseUseWords(content: string, targets: string[]): UseWordsItem[] {
  let root: unknown;
  try {
    root = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
  } catch {
    throw new Error("AI 返回内容无法解析");
  }
  const list = Array.isArray((root as { items?: unknown })?.items) ? (root as { items: Record<string, unknown>[] }).items : [];
  const out: UseWordsItem[] = [];
  for (const item of list) {
    const zh = typeof item.zh === "string" ? item.zh.trim() : "";
    const en = typeof item.en === "string" ? item.en.trim() : "";
    const marked = [...en.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]!.trim());
    if (!CJK.test(zh) || /[a-z]{3,}|\[/i.test(zh) || !marked.length) continue;
    // 括起来的必须是目标词（允许变形）
    const words = marked.map((m) => targets.find((w) => isTargetForm(m, w))).filter((w): w is string => Boolean(w));
    if (words.length !== marked.length) continue;
    out.push({ zh, en, words: [...new Set(words)] });
  }
  if (!out.length) throw new Error("AI 没有给出可用的句子");
  return out;
}

/** 一段打得对不对：忽略大小写，弯撇号与直撇号等同 */
export function chunkMatches(chunk: string, input: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  return norm(chunk) === norm(input);
}

const CJK = /[㐀-鿿]/;

/** 提示译文里的空位（___、＿＿、……） */
const HINT_BLANK = /_{2,}|＿+|…{1,2}|\.{3,}/;

/**
 * 填空的中文提示不能也是空的：译文里留了空位时，用目标词的释义补上
 * （释义去掉词性，只取第一个意思），否则学习者无从推断要填哪个词
 */
export function fillHintBlank(translation: string, meaning: string): string {
  if (!HINT_BLANK.test(translation)) return translation;
  const sense = meaning.replace(/^[a-z]+\.\s*/i, "").split(/[；;，,、]/)[0]!.trim();
  return sense ? translation.replace(HINT_BLANK, sense) : translation;
}

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
      return ok ? { kind: "cloze", words, sentence, answer, translation: fillHintBlank(str(c.translation), plan.words[0]?.meaning ?? "") } : null;
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
