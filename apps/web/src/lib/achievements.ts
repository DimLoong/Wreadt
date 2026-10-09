import { isMastered, type CardState } from "@wreadt/core";
import { splitWordId } from "./words";

export const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export interface KeyStat {
  learned: number;
  mastered: number;
  level: 0 | 1 | 2 | 3;
}

/** 键盘拼图：每个字母键由“以该字母开头”的已学单词点亮 —— 学 1 个初亮、10 个半亮、掌握 5 个全亮 */
export function keyboardStats(cards: CardState[]): Record<string, KeyStat> {
  const stats: Record<string, KeyStat> = {};
  for (const ch of KEY_ROWS.join("")) stats[ch] = { learned: 0, mastered: 0, level: 0 };
  for (const card of cards) {
    if (card.deleted || card.reps === 0) continue;
    const first = splitWordId(card.id).name.trim().charAt(0).toLowerCase();
    const s = stats[first];
    if (!s) continue;
    s.learned += 1;
    if (isMastered(card)) s.mastered += 1;
  }
  for (const s of Object.values(stats)) s.level = s.mastered >= 5 ? 3 : s.learned >= 10 ? 2 : s.learned >= 1 ? 1 : 0;
  return stats;
}

export interface AchievementInput {
  learned: number;
  mastered: number;
  streak: number;
  today: number;
  keysLit: number;
}

export interface Achievement {
  id: string;
  icon: string;
  zh: string;
  en: string;
  done: (s: AchievementInput) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first", icon: "🐣", zh: "第一个单词", en: "First word", done: (s) => s.learned >= 1 },
  { id: "w100", icon: "📗", zh: "学会 100 词", en: "100 words", done: (s) => s.learned >= 100 },
  { id: "w1000", icon: "📚", zh: "学会 1000 词", en: "1,000 words", done: (s) => s.learned >= 1000 },
  { id: "m1", icon: "⭐", zh: "第一次真正掌握", en: "First mastered", done: (s) => s.mastered >= 1 },
  { id: "m500", icon: "🏆", zh: "掌握 500 词", en: "500 mastered", done: (s) => s.mastered >= 500 },
  { id: "day50", icon: "🔥", zh: "单日练习 50 次", en: "50 in a day", done: (s) => s.today >= 50 },
  { id: "streak7", icon: "📅", zh: "连续 7 天", en: "7-day streak", done: (s) => s.streak >= 7 },
  { id: "streak30", icon: "🗓️", zh: "连续 30 天", en: "30-day streak", done: (s) => s.streak >= 30 },
  { id: "keys", icon: "⌨️", zh: "点亮整个键盘", en: "Light every key", done: (s) => s.keysLit >= 26 },
];
