import { isMastered, keyLang, type CardState } from "@wreadt/core";
import type { TargetWord } from "../services/ai";
import { startOfDay } from "./date";

interface Lookup {
  get(text: string): { meanings: string[] } | undefined;
}

/** 卡片 id 为 wordKey（en:pull request），取出单词本身 */
function keyWord(id: string): string | null {
  return keyLang(id) === "en" ? id.slice(3) : null;
}

/**
 * 为场景题挑选目标词（仅英文）：
 * - today：今天复习过的词
 * - weak：遗忘过（lapses）或难度高、且还没掌握的词，最难的优先
 * - review：已学过的其他词，随机抽取
 */
export function pickTargetWords(cards: CardState[], lookup: Lookup, now = Date.now(), perGroup = 4, random = Math.random): TargetWord[] {
  const today = startOfDay(now);
  const learned = cards.filter((c) => !c.deleted && c.reps > 0 && keyWord(c.id));
  const used = new Set<string>();
  const out: TargetWord[] = [];
  const take = (list: CardState[], tag: TargetWord["tag"]) => {
    let n = 0;
    for (const c of list) {
      if (n >= perGroup) break;
      const word = keyWord(c.id)!;
      if (used.has(word)) continue;
      used.add(word);
      out.push({ word, meaning: lookup.get(word)?.meanings.join("；") ?? "", tag });
      n += 1;
    }
  };
  take(
    learned.filter((c) => (c.lastReview ?? 0) >= today).sort((a, b) => (b.lastReview ?? 0) - (a.lastReview ?? 0)),
    "today",
  );
  take(
    learned.filter((c) => !isMastered(c) && (c.lapses > 0 || c.difficulty >= 7)).sort((a, b) => b.lapses - a.lapses || b.difficulty - a.difficulty),
    "weak",
  );
  take(
    learned
      .map((c) => ({ c, r: random() }))
      .sort((a, b) => a.r - b.r)
      .map((x) => x.c),
    "review",
  );
  return out;
}
