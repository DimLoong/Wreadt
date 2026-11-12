import { localCloze, localDictation, type CardPlan, type PracticeCard, type WordItem } from "@wreadt/core";
import { aiSource, generatePracticeCards } from "../services/ai";

/** 每组的造句卡在组开始时后台准备；同一组只准备一次（StrictMode 重复执行也不会重复请求） */
const prepared = new Map<string, Promise<(PracticeCard | null)[]>>();

/**
 * 有 AI 时一次请求为本组出全部题；AI 失败、没有 AI 或某道题不合格时，用词库自带的例句出填空 / 整句听写（出不了就跳过这张卡）。
 */
export function prepareCards(key: string, plans: CardPlan[], batch: WordItem[], locale: string): Promise<(PracticeCard | null)[]> {
  let pending = prepared.get(key);
  if (pending) return pending;
  const local = (p: CardPlan): PracticeCard | null => {
    for (const w of p.words) {
      const item = batch.find((b) => b.answer.toLowerCase() === w.word.toLowerCase());
      if (p.kind === "dictation") {
        for (const ex of item?.examples ?? []) {
          const card = localDictation(w.word, ex);
          if (card) return card;
        }
        continue;
      }
      const card = localCloze(w.word, item?.examples?.[0]);
      if (card) return card;
    }
    return null;
  };
  pending = (async () => {
    if (!plans.length) return [];
    const ai = (await aiSource()) ? await generatePracticeCards(plans, locale).catch(() => [] as (PracticeCard | null)[]) : [];
    return plans.map((p, i) => ai[i] ?? local(p));
  })();
  prepared.set(key, pending);
  if (prepared.size > 6) prepared.delete(prepared.keys().next().value!);
  return pending;
}

/** 一张卡的作答结果（组末总结里列出） */
export interface CardAnswer {
  card: PracticeCard;
  input: string;
  /** 每一段都一次拼对 */
  ok: boolean;
  /** 拼错过的段 */
  misses?: string[];
}

/** 题目文本（点评时发给 AI） */
export function cardQuestion(card: PracticeCard): string {
  if (card.kind === "cloze") return `${card.sentence}${card.translation ? `（${card.translation}）` : ""}`;
  return card.kind === "dictation" ? (card.translation ?? "") : (card.zh ?? "");
}

export function cardReference(card: PracticeCard): string {
  return card.kind === "cloze" ? (card.sentence ?? "").replace("___", card.answer ?? "") : (card.reference ?? "");
}

/** 题型标签 */
export const CARD_LABEL = { cloze: "cards.cloze", translate: "cards.translate", dictation: "cards.dictation" } as const;
