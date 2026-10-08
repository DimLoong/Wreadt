import { expect, it } from "vitest";
import { computeStreak, DAY, startOfDay } from "./date";

it("computeStreak", () => {
  const today = startOfDay(Date.UTC(2026, 9, 8, 12));
  const d = (n: number) => startOfDay(today - n * DAY + DAY / 2);
  expect(computeStreak(new Set(), today)).toBe(0);
  expect(computeStreak(new Set([d(0), d(1), d(2)]), today)).toBe(3);
  expect(computeStreak(new Set([d(1), d(2)]), today)).toBe(2);
  expect(computeStreak(new Set([d(0), d(2)]), today)).toBe(1);
});
