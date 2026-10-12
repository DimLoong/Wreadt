import type { ReactNode } from "react";
import type { WordItem } from "@wreadt/core";
import type { TypingState } from "../../hooks/useTypingMachine";

/** 伪装皮肤渲染所需的全部数据；键盘捕获由 TypingSession 负责，皮肤只负责展示 */
export interface SkinView {
  word: WordItem;
  typed: string;
  state: TypingState;
  sub?: string;
  meaning: string;
  feedback: string;
  index: number;
  total: number;
  accuracy: number;
  /** 逐字母显示的单词（默写时为下划线） */
  lettersEl: ReactNode;
  onMenu: () => void;
}
