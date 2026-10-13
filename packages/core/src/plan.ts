/** 学习计划：每日目标与考试倒计时 */

export type GoalType = "words" | "minutes";
export type Persona = "student" | "worker" | "self";

const DAY = 86_400_000;

/** 两个本地日期（YYYY-MM-DD 或时间戳所在日）之间相差的天数 */
export function daysBetween(fromDay: number, toDate: string): number {
  const [y, m, d] = toDate.split("-").map(Number);
  const target = new Date(y!, m! - 1, d!).getTime();
  return Math.round((target - fromDay) / DAY);
}

/** 考前留出的纯复习天数：最后 3 天一定只复习；更长时取 10%，至少 3 天、最多 14 天，且不超过总天数的一半 */
export function reviewReserve(daysLeft: number): number {
  if (daysLeft <= 3) return daysLeft;
  return Math.min(Math.floor(daysLeft / 2), Math.max(3, Math.min(14, Math.round(daysLeft * 0.1))));
}

export interface DailyNewPlan {
  /** 今天应学的新词数 */
  perDay: number;
  /** 距考试天数（未设置考试为 null；已过考试为 0） */
  daysLeft: number | null;
  /** 是否已进入考前纯复习阶段 */
  reviewOnly: boolean;
}

/**
 * 今日新词量。设置了考试日期时按“当天开始时的剩余新词 ÷ 可学天数”倒推，
 * 所以多学的部分会让之后每天的量自动下调；否则使用固定的每日新词数。
 */
export function planDailyNew(opts: { remainingAtDayStart: number; today: number; examDate?: string | null; dailyNew: number }): DailyNewPlan {
  const { remainingAtDayStart, today, examDate, dailyNew } = opts;
  if (!examDate) return { perDay: dailyNew, daysLeft: null, reviewOnly: false };
  const daysLeft = Math.max(0, daysBetween(today, examDate));
  const studyDays = daysLeft - reviewReserve(daysLeft);
  if (studyDays <= 0) return { perDay: 0, daysLeft, reviewOnly: true };
  return { perDay: Math.ceil(remainingAtDayStart / studyDays), daysLeft, reviewOnly: false };
}

export interface GoalProgress {
  done: boolean;
  /** 0~1 */
  ratio: number;
}

/** 按词数：新词达标且当天到期的复习都已完成；按时长：练够分钟数 */
export function goalProgress(
  type: GoalType,
  p: { newToday: number; newTarget: number; reviewedToday: number; dueLeft: number; secondsToday: number; minutesTarget: number },
): GoalProgress {
  if (type === "minutes") {
    const target = Math.max(1, p.minutesTarget * 60);
    return { done: p.secondsToday >= target, ratio: Math.min(1, p.secondsToday / target) };
  }
  const total = p.newTarget + p.reviewedToday + p.dueLeft;
  const finished = Math.min(p.newToday, p.newTarget) + p.reviewedToday;
  const ratio = total ? Math.min(1, finished / total) : 1;
  return { done: p.newToday >= p.newTarget && p.dueLeft === 0, ratio };
}
