import type { WordItem } from "@wreadt/core";

/** 从其它页面（如 mark 列表）进入打字页时携带的专项练习 */
export interface FocusPractice {
  key: string;
  title: string;
  words: WordItem[];
  /** listen：听写（只给发音与释义，不显示音标）；spell：强制默写 */
  mode?: "normal" | "listen" | "spell";
}

export function readFocusPractice(state: unknown): FocusPractice | null {
  const p = (state as { practice?: FocusPractice } | null)?.practice;
  return p && Array.isArray(p.words) && p.words.length ? p : null;
}
