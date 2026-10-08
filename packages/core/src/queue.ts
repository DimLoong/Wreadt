import { isDue, isMastered, type CardState } from "./scheduler.ts";
import type { WordItem } from "./types.ts";

export interface SessionOptions {
  size: number;
  now?: number;
  /** 本批最多引入的新词数，默认等于 size */
  newLimit?: number;
}

/** 组织一批练习：先到期复习（最早到期优先），再按词库顺序补新词 */
export function buildSession(words: WordItem[], cards: Map<string, CardState>, opts: SessionOptions): WordItem[] {
  const now = opts.now ?? Date.now();
  const due: { word: WordItem; due: number }[] = [];
  const fresh: WordItem[] = [];
  for (const word of words) {
    const card = cards.get(word.id);
    if (!card || card.deleted || card.reps === 0) fresh.push(word);
    else if (isDue(card, now)) due.push({ word, due: card.due });
  }
  due.sort((a, b) => a.due - b.due);
  const session = due.slice(0, opts.size).map((d) => d.word);
  const newCount = Math.min(opts.size - session.length, opts.newLimit ?? opts.size);
  return session.concat(fresh.slice(0, Math.max(0, newCount)));
}

export interface DictStats {
  total: number;
  learned: number;
  mastered: number;
  due: number;
}

export function dictStats(words: WordItem[], cards: Map<string, CardState>, now = Date.now()): DictStats {
  const stats: DictStats = { total: words.length, learned: 0, mastered: 0, due: 0 };
  for (const word of words) {
    const card = cards.get(word.id);
    if (!card || card.deleted || card.reps === 0) continue;
    stats.learned += 1;
    if (isMastered(card)) stats.mastered += 1;
    if (isDue(card, now)) stats.due += 1;
  }
  return stats;
}
