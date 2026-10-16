import { localCloze, type CardPlan, type PracticeCard, type WordItem } from "@wreadt/core";
import { aiSource, generatePracticeCards } from "../services/ai";

/** 每组的造句卡在组开始时后台准备；同一组只准备一次（StrictMode 重复执行也不会重复请求） */
const prepared = new Map<string, Promise<(PracticeCard | null)[]>>();

/**
 * 有 AI 时一次请求为本组出全部题；AI 失败或没有 AI 时，用词库自带的例句出填空题（出不了就跳过这张卡）。
 */
export function prepareCards(key: string, plans: CardPlan[], batch: WordItem[], locale: string): Promise<(PracticeCard | null)[]> {
  let pending = prepared.get(key);
  if (pending) return pending;
  const fallback = (): (PracticeCard | null)[] =>
    plans.map((p) => {
      for (const w of p.words) {
        const item = batch.find((b) => b.answer.toLowerCase() === w.word.toLowerCase());
        const card = localCloze(w.word, item?.examples?.[0]);
        if (card) return card;
      }
      return null;
    });
  pending = (async () => {
    if (!plans.length) return [];
    if (!(await aiSource())) return fallback();
    try {
      const cards = await generatePracticeCards(plans, locale);
      const local = fallback();
      return cards.map((c, i) => c ?? local[i] ?? null);
    } catch {
      return fallback();
    }
  })();
  prepared.set(key, pending);
  if (prepared.size > 6) prepared.delete(prepared.keys().next().value!);
  return pending;
}

/** 一张卡的作答结果（组末用于 AI 点评） */
export interface CardAnswer {
  card: PracticeCard;
  input: string;
  /** 本地判题：填空是否答对；中译英是否用上了全部目标词 */
  ok: boolean;
}

/** 题目文本（点评时发给 AI） */
export function cardQuestion(card: PracticeCard): string {
  return card.kind === "cloze" ? `${card.sentence}${card.translation ? `（${card.translation}）` : ""}` : (card.zh ?? "");
}

export function cardReference(card: PracticeCard): string {
  return card.kind === "cloze" ? (card.sentence ?? "").replace("___", card.answer ?? "") : (card.reference ?? "");
}
