import type { AiTask } from "@wreadt/core";

/**
 * 记录每种 AI 任务最近实际花了多久，让等待进度条的节奏贴近真实耗时。
 * 只存在本机（per-viewer 的便利数据），读写失败时退回默认值。
 */
const KEY = "wreadt.aiTiming";

/** 没有记录时的预估（毫秒）：生成整段内容的任务更久 */
const DEFAULTS: Partial<Record<AiTask, number>> = {
  "dict-outline": 12000,
  "dict-words": 20000,
  "expand-dict": 20000,
  "interest-feed": 15000,
  "micro-reading": 12000,
  "news-brief": 12000,
  "scenario-question": 10000,
  "scenario-review": 12000,
  "practice-cards": 10000,
  "use-words": 10000,
  "practice-review": 10000,
  "sentence-exercises": 12000,
  "dictation-sentences": 12000,
  "confusable-quiz": 10000,
  "analyze-words": 8000,
  "extract-words": 8000,
};
const FALLBACK = 6000;

function readAll(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

/** 这种任务预计要多久（毫秒） */
export function expectedMs(task: AiTask): number {
  return readAll()[task] ?? DEFAULTS[task] ?? FALLBACK;
}

/** 记下一次实际耗时：与之前的记录平滑（新的占 40%），偶尔一次特别慢不至于把预估拉得太长 */
export function recordMs(task: AiTask, ms: number): void {
  try {
    const all = readAll();
    const prev = all[task];
    all[task] = Math.round(prev ? prev * 0.6 + ms * 0.4 : ms);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // 存不下就算了，下次用默认预估
  }
}
