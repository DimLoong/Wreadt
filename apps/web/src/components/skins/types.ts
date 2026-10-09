import type { ReactNode } from "react";
import type { WordItem } from "@wreadt/core";
import type { TypingState } from "../../hooks/useTypingMachine";

/** 伪装皮肤渲染所需的全部数据；输入框由 TypingSession 创建后传入，保证键盘逻辑一致 */
export interface SkinView {
  word: WordItem;
  input: string;
  state: TypingState;
  sub?: string;
  meaning: string;
  feedback: string;
  index: number;
  total: number;
  accuracy: number;
  inputEl: ReactNode;
  onMenu: () => void;
}
