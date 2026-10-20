import type { ReactNode } from "react";
import type { WordItem } from "@wreadt/core";
import type { TypingState } from "../../hooks/useTypingMachine";
import type { SkinDensity } from "../../context/settings";

export interface SkinStats {
  seconds: number;
  wpm: number;
  keystrokes: number;
  /** 一次拼对 / 已完成 */
  correct: number;
  done: number;
  accuracy: number;
  /** 本组进度（含造句题） */
  current: number;
  total: number;
}

/** 伪装皮肤渲染所需的全部数据；键盘捕获由 TypingSession 负责，皮肤只负责展示 */
export interface SkinView {
  word: WordItem;
  typed: string;
  state: TypingState;
  sub?: string;
  meaning: string;
  /** 当前词的反馈（正确 / 提示），显示在单词旁边 */
  feedback: string;
  /** 反馈是否为“正确” */
  ok: boolean;
  index: number;
  stats: SkinStats;
  /** 快捷键说明 */
  hotkeys: string;
  density: SkinDensity;
  /** 逐字母显示的单词（默写时为下划线） */
  lettersEl: ReactNode;
  /** 穿插的造句题：出现时替换当前单词区域 */
  card?: ReactNode;
  /** 一组结束的通知 */
  notice?: ReactNode;
  onMenu: () => void;
  onExit: () => void;
}
