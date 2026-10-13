// 习惯养成：可请假的连续打卡与周报。日期均为本地时间当天零点的时间戳。

import { analyzeSpelling, type MistakeRecord, type SpellingPattern } from "./spelling.ts";

const DAY = 86_400_000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 前一天（用半天回退再取零点，避免夏令时的 23 / 25 小时） */
function prevDay(day: number): number {
  return startOfDay(day - DAY / 2);
}

/** 所在周的周一零点 */
export function weekStart(ts: number): number {
  const d = new Date(startOfDay(ts));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export interface Streak {
  /** 连续天数（含请假的天） */
  days: number;
  /** 其中请假的天数 */
  leaveDays: number;
  /** 今天是否已经练过 */
  todayDone: boolean;
}

/**
 * 可请假的连续天数：每周（周一到周日）最多有 leavePerWeek 天没练也不打断。
 * 今天还没练不算中断（从昨天往前数）；请假日只有在更早还有练习时才计入，避免把开头的空白算进去。
 */
export function computeStreakWithLeave(days: Set<number>, today: number, leavePerWeek = 0): Streak {
  const todayDone = days.has(today);
  let day = todayDone ? today : prevDay(today);
  const used = new Map<number, number>();
  let count = 0;
  let leaves = 0;
  let pending = 0;
  for (let guard = 0; guard < 3660; guard += 1) {
    if (days.has(day)) {
      count += 1 + pending;
      leaves += pending;
      pending = 0;
    } else {
      const w = weekStart(day);
      const n = used.get(w) ?? 0;
      if (n >= leavePerWeek) break;
      used.set(w, n + 1);
      pending += 1;
    }
    day = prevDay(day);
  }
  return { days: count, leaveDays: leaves, todayDone };
}

export interface ReportLog {
  wordId: string;
  reviewedAt: number;
  errors: number;
}

export interface WeekStats {
  start: number;
  /** 练过的天数 */
  activeDays: number;
  /** 本周第一次学的词 */
  newWords: number;
  /** 复习次数（不含新词的第一次） */
  reviews: number;
  /** 一次打对（没有按错）的比例 0～1；没有记录时为 null */
  firstTry: number | null;
  minutes: number;
  aiPractices: number;
  /** AI 点评平均分；没有时为 null */
  aiScore: number | null;
  /** 本周最容易错的拼写难点（最多 3 个） */
  weakSpots: { pattern: SpellingPattern; count: number }[];
}

export interface WeeklyReport {
  current: WeekStats;
  previous: WeekStats;
}

export interface ReportInput {
  /** 全部复习记录（用来判断某个词是不是本周第一次学） */
  logs: ReportLog[];
  /** 每天的学习秒数 */
  secondsByDay: Map<number, number>;
  /** AI 练习（场景问答、兴趣流回复）的时间与分数 */
  practices: { at: number; score: number | null }[];
  mistakes: MistakeRecord[];
}

function weekStats(start: number, input: ReportInput, firstSeen: Map<string, number>): WeekStats {
  const end = start + 7 * DAY + DAY / 2; // 跨夏令时也能覆盖整周
  const endDay = startOfDay(end);
  const inWeek = (ts: number) => ts >= start && ts < endDay;
  const logs = input.logs.filter((l) => inWeek(l.reviewedAt));
  const newIds = new Set(logs.filter((l) => firstSeen.get(l.wordId) === l.reviewedAt).map((l) => l.wordId));
  const seconds = [...input.secondsByDay.entries()].filter(([d]) => inWeek(d)).reduce((s, [, v]) => s + v, 0);
  const practices = input.practices.filter((p) => inWeek(p.at));
  const scored = practices.filter((p) => p.score !== null) as { at: number; score: number }[];
  const spelling = analyzeSpelling(input.mistakes.filter((m) => inWeek(m.at)));
  return {
    start,
    activeDays: new Set(logs.map((l) => startOfDay(l.reviewedAt))).size,
    newWords: newIds.size,
    reviews: logs.length - newIds.size,
    firstTry: logs.length ? logs.filter((l) => l.errors === 0).length / logs.length : null,
    minutes: Math.round(seconds / 60),
    aiPractices: practices.length,
    aiScore: scored.length ? Math.round(scored.reduce((s, p) => s + p.score, 0) / scored.length) : null,
    weakSpots: spelling.patterns.slice(0, 3).map((p) => ({ pattern: p.pattern, count: p.count })),
  };
}

/** 某一周（weekOf 所在周）与前一周的周报 */
export function buildWeeklyReport(weekOf: number, input: ReportInput): WeeklyReport {
  const firstSeen = new Map<string, number>();
  for (const l of input.logs) {
    const prev = firstSeen.get(l.wordId);
    if (prev === undefined || l.reviewedAt < prev) firstSeen.set(l.wordId, l.reviewedAt);
  }
  const start = weekStart(weekOf);
  return { current: weekStats(start, input, firstSeen), previous: weekStats(weekStart(start - DAY / 2), input, firstSeen) };
}
