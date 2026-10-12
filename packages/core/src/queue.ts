import { isDue, isMastered, type CardState } from "./scheduler.ts";
import type { WordItem } from "./types.ts";

export interface SessionOptions {
  size: number;
  now?: number;
  /** 本批最多引入的新词数，默认等于 size */
  newLimit?: number;
  /** 混入的额外词（“我的词库”），最多 mixCount 个，随机插入本组 */
  mix?: WordItem[];
  mixCount?: number;
  random?: () => number;
}

/** 先到期复习（最早到期优先），再按顺序补新词 */
function pick(words: WordItem[], cards: Map<string, CardState>, size: number, now: number, newLimit = size): WordItem[] {
  const due: { word: WordItem; due: number }[] = [];
  const fresh: WordItem[] = [];
  for (const word of words) {
    const card = cards.get(word.id);
    if (!card || card.deleted || card.reps === 0) fresh.push(word);
    else if (isDue(card, now)) due.push({ word, due: card.due });
  }
  due.sort((a, b) => a.due - b.due);
  const session = due.slice(0, size).map((d) => d.word);
  const newCount = Math.min(size - session.length, newLimit);
  return session.concat(fresh.slice(0, Math.max(0, newCount)));
}

/** 组织一批练习；可混入“我的词库”中到期或未学的词，随机分布在本组中 */
export function buildSession(words: WordItem[], cards: Map<string, CardState>, opts: SessionOptions): WordItem[] {
  const now = opts.now ?? Date.now();
  const random = opts.random ?? Math.random;
  const mainIds = new Set(words.map((w) => w.id));
  const mixed = opts.mix?.length && opts.mixCount ? pick(opts.mix.filter((w) => !mainIds.has(w.id)), cards, Math.min(opts.mixCount, opts.size), now) : [];
  const session = pick(words, cards, opts.size - mixed.length, now, opts.newLimit);
  for (const word of mixed) session.splice(Math.floor(random() * (session.length + 1)), 0, word);
  return session;
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
