import { expect, it } from "vitest";
import type { CardState } from "@wreadt/core";
import { ACHIEVEMENTS, keyboardStats } from "./achievements";

const card = (id: string, extra: Partial<CardState> = {}): CardState => ({
  id, dictId: id.split(":")[0]!, due: 0, stability: 1, difficulty: 5, scheduledDays: 1, learningSteps: 0,
  reps: 1, lapses: 0, state: 1, updatedAt: 0, ...extra,
});

it("keyboardStats 按首字母点亮", () => {
  const cards = [
    card("cet4:cat"),
    card("cet4:Cow"),
    card("jlpt-n5:kyouiku"),
    card("cet4:dog", { reps: 0 }),
    ...Array.from({ length: 5 }, (_, i) => card(`cet4:apple${i}`, { state: 2, stability: 30 })),
  ];
  const s = keyboardStats(cards);
  expect(s.c).toEqual({ learned: 2, mastered: 0, level: 1 });
  expect(s.k?.level).toBe(1);
  expect(s.d?.level).toBe(0);
  expect(s.a?.level).toBe(3);
});

it("成就判定", () => {
  const done = ACHIEVEMENTS.filter((a) => a.done({ learned: 120, mastered: 1, streak: 7, today: 3, keysLit: 10 })).map((a) => a.id);
  expect(done).toEqual(["first", "w100", "m1", "streak7"]);
});
