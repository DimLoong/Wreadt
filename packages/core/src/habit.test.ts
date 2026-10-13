import { buildWeeklyReport, computeStreakWithLeave, weekStart } from "./habit.ts";

const DAY = 86_400_000;
// 2026-10-14 是周三
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d).getTime();
const wed = day(2026, 10, 14);

it("weekStart 取周一", () => {
  expect(weekStart(wed + 5 * 3600_000)).toBe(day(2026, 10, 12));
  expect(weekStart(day(2026, 10, 18))).toBe(day(2026, 10, 12)); // 周日属于本周
});

it("computeStreakWithLeave：每周可请假 1 天", () => {
  // 周三（今天）、周二练了，周一没练，上周日、周六练了
  const days = new Set([wed, day(2026, 10, 13), day(2026, 10, 11), day(2026, 10, 10)]);
  expect(computeStreakWithLeave(days, wed, 0)).toEqual({ days: 2, leaveDays: 0, todayDone: true });
  expect(computeStreakWithLeave(days, wed, 1)).toEqual({ days: 5, leaveDays: 1, todayDone: true });
  // 同一周空了两天：第二天就断了
  const twoGaps = new Set([wed, day(2026, 10, 11)]);
  expect(computeStreakWithLeave(twoGaps, wed, 1).days).toBe(1);
  // 今天还没练：从昨天往前数，开头的空白不算请假
  expect(computeStreakWithLeave(new Set([day(2026, 10, 13)]), wed, 1)).toEqual({ days: 1, leaveDays: 0, todayDone: false });
  expect(computeStreakWithLeave(new Set(), wed, 2).days).toBe(0);
});

it("buildWeeklyReport：新词、复习、一次打对率、时长与对比", () => {
  const mon = day(2026, 10, 12);
  const lastMon = day(2026, 10, 5);
  const logs = [
    { wordId: "en:a", reviewedAt: lastMon + 3600_000, errors: 0 }, // 上周新学
    { wordId: "en:a", reviewedAt: mon + 3600_000, errors: 1 }, // 本周复习
    { wordId: "en:b", reviewedAt: mon + 7200_000, errors: 0 }, // 本周新学
    { wordId: "en:c", reviewedAt: mon + 2 * DAY, errors: 0 }, // 本周新学，另一天
  ];
  const report = buildWeeklyReport(wed, {
    logs,
    secondsByDay: new Map([[mon, 600], [lastMon, 300]]),
    practices: [{ at: mon + DAY, score: 80 }, { at: mon + DAY, score: null }],
    mistakes: [{ answer: "receive", mistakes: [{ pos: 3, expected: "e", typed: "i" }], at: mon + 3600_000 }],
  });
  expect(report.current).toMatchObject({ activeDays: 2, newWords: 2, reviews: 1, minutes: 10, aiPractices: 2, aiScore: 80 });
  expect(report.current.firstTry).toBeCloseTo(2 / 3);
  expect(report.current.weakSpots).toEqual([{ pattern: "ie-ei", count: 1 }]);
  expect(report.previous).toMatchObject({ activeDays: 1, newWords: 1, reviews: 0, minutes: 5, aiScore: null });
});
