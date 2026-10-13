import { daysBetween, goalProgress, planDailyNew, reviewReserve } from "./plan.ts";

const today = new Date(2026, 9, 13).getTime();

it("daysBetween / reviewReserve", () => {
  expect(daysBetween(today, "2026-12-19")).toBe(67);
  expect(daysBetween(today, "2026-10-13")).toBe(0);
  expect(reviewReserve(67)).toBe(7);
  expect(reviewReserve(20)).toBe(3);
  expect(reviewReserve(4)).toBe(2);
  expect(reviewReserve(300)).toBe(14);
});

it("planDailyNew 按剩余词数与天数倒推，考前进入纯复习", () => {
  expect(planDailyNew({ remainingAtDayStart: 1200, today, dailyNew: 15 })).toEqual({ perDay: 15, daysLeft: null, reviewOnly: false });
  expect(planDailyNew({ remainingAtDayStart: 1200, today, examDate: "2026-12-19", dailyNew: 15 })).toEqual({ perDay: 20, daysLeft: 67, reviewOnly: false });
  expect(planDailyNew({ remainingAtDayStart: 500, today, examDate: "2026-10-15", dailyNew: 15 })).toEqual({ perDay: 0, daysLeft: 2, reviewOnly: true });
  expect(planDailyNew({ remainingAtDayStart: 500, today, examDate: "2026-01-01", dailyNew: 15 }).reviewOnly).toBe(true);
});

it("goalProgress", () => {
  const base = { newToday: 10, newTarget: 15, reviewedToday: 5, dueLeft: 5, secondsToday: 300, minutesTarget: 10 };
  expect(goalProgress("words", base)).toEqual({ done: false, ratio: 15 / 25 });
  expect(goalProgress("words", { ...base, newToday: 20, dueLeft: 0 }).done).toBe(true);
  expect(goalProgress("minutes", base)).toEqual({ done: false, ratio: 0.5 });
  expect(goalProgress("minutes", { ...base, secondsToday: 600 }).done).toBe(true);
});
