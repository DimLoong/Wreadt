export const DAY = 86_400_000;

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 连续学习天数：今天没练则从昨天往前数 */
export function computeStreak(days: Set<number>, today = startOfDay(Date.now())): number {
  let day = days.has(today) ? today : startOfDay(today - DAY / 2);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = startOfDay(day - DAY / 2);
  }
  return streak;
}
