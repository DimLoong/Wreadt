import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../store/db";
import { setSetting } from "../store/repo";
import { setVolume } from "../services/sound";
import { t as translate, type Locale, type MessageKey } from "../i18n/messages";
import type { AdvanceMode, WrongHelp } from "../hooks/useTypingMachine";
import type { GoalType, Persona, ScenarioLevel } from "@wreadt/core";

export type SkinId = "none" | "word" | "excel" | "vscode";
/** dictation：默写（字母显示为下划线）；copy：照着打 */
export type TypingMode = "dictation" | "copy";

export interface Settings {
  locale: Locale;
  dark: boolean;
  /** 正在学习的词库，可多选 */
  dictIds: string[];
  /** 每组混入“我的词库”的词数，0 为不混入 */
  mixCount: number;
  batchSize: number;
  autoPlay: boolean;
  showMeaning: boolean;
  skin: SkinId;
  typingMode: TypingMode;
  advance: AdvanceMode;
  wrongHelp: WrongHelp;
  /** 正确 / 错误 / 完成音效 */
  sound: boolean;
  /** 每次按键的“嗒”声 */
  keySound: boolean;
  /** 0~100 */
  volume: number;
  /** 每组结束后推荐场景问答（并在组开始时后台预生成题目） */
  batchScenario: boolean;
  /** 每组混入 mark 的词数，0 为不混入 */
  markMixCount: number;
  /** 掌握后自动取消 mark */
  autoUnmarkMastered: boolean;
  /** 新手引导选择的身份 */
  persona: Persona | null;
  onboarded: boolean;
  /** 词汇摸底：未做时首页与打字页会建议先做 */
  placementStatus: "pending" | "done" | "skipped";
  /** 每日目标：按新词数（+ 当天到期复习）或按练习分钟数 */
  goalType: GoalType;
  dailyNew: number;
  dailyMinutes: number;
  /** 考试日期 YYYY-MM-DD，用于倒推每日新词量 */
  examDate: string | null;
  examName: string | null;
  /** 英文发音：美音 / 英音 */
  accent: "us" | "uk";
  scenarioLevel: ScenarioLevel;
}

export const DEFAULT_SETTINGS: Settings = {
  locale: navigator.language.startsWith("zh") ? "zh-CN" : "en-US",
  dark: window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
  dictIds: ["cet4"],
  mixCount: 3,
  batchSize: 15,
  autoPlay: true,
  showMeaning: true,
  skin: "none",
  typingMode: "dictation",
  advance: "key",
  wrongHelp: "reveal",
  sound: true,
  keySound: false,
  volume: 60,
  batchScenario: true,
  accent: "us",
  persona: null,
  onboarded: false,
  placementStatus: "pending",
  goalType: "words",
  dailyNew: 15,
  dailyMinutes: 10,
  examDate: null,
  examName: null,
  markMixCount: 3,
  autoUnmarkMastered: false,
  scenarioLevel: "simple",
};

interface SettingsContextValue {
  settings: Settings;
  ready: boolean;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const rows = useLiveQuery(() => db.settings.toArray(), []);

  const settings = useMemo<Settings>(() => {
    const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const row of rows ?? []) if (row.key in DEFAULT_SETTINGS) merged[row.key] = row.value;
    // 旧版只能单选词库（dictId）
    const legacy = rows?.find((r) => r.key === "dictId");
    if (legacy && !rows?.some((r) => r.key === "dictIds")) merged.dictIds = [legacy.value as string];
    if (!Array.isArray(merged.dictIds) || !(merged.dictIds as string[]).length) merged.dictIds = DEFAULT_SETTINGS.dictIds;
    // 旧版难度只有中级 / 高级
    merged.scenarioLevel = ({ intermediate: "medium", advanced: "professional" } as Record<string, string>)[merged.scenarioLevel as string] ?? merged.scenarioLevel;
    return merged as unknown as Settings;
  }, [rows]);

  useEffect(() => {
    // TDesign 通过 theme-mode 切换暗色
    const root = document.documentElement;
    if (settings.dark) root.setAttribute("theme-mode", "dark");
    else root.removeAttribute("theme-mode");
    root.lang = settings.locale;
  }, [settings.dark, settings.locale]);

  useEffect(() => setVolume(settings.volume / 100), [settings.volume]);

  const update = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => setSetting(key, value), []);
  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => translate(settings.locale, key, vars),
    [settings.locale],
  );

  const value = useMemo(() => ({ settings, ready: rows !== undefined, update, t }), [settings, rows, update, t]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings 必须在 SettingsProvider 内使用");
  return ctx;
}
