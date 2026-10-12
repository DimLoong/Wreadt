import { expect, it } from "vitest";
import type { CardState } from "@wreadt/core";
import { pickTargetWords } from "./practiceWords";

const NOW = new Date(2026, 9, 12, 15).getTime();
const card = (id: string, extra: Partial<CardState>): CardState => ({
  id, dictId: "d", due: NOW, stability: 2, difficulty: 5, scheduledDays: 1, learningSteps: 0, reps: 2, lapses: 0, state: 2, updatedAt: 0, lastReview: NOW - 5 * 86_400_000, ...extra,
});

it("按今日 / 易错 / 已学挑选英文目标词，去重并带释义", () => {
  const cards = [
    card("en:latency", { lastReview: NOW - 1000 }),
    card("en:trade-off", { lastReview: NOW - 2000, lapses: 2 }),
    card("en:idempotent", { lapses: 3 }),
    card("en:robust", { difficulty: 8 }),
    card("en:fresh", { reps: 0 }),
    card("ja:教育", { lastReview: NOW - 10 }),
    card("en:deleted", { deleted: true, lastReview: NOW }),
    card("en:scalable", {}),
  ];
  const lookup = { get: (w: string) => (w === "latency" ? { meanings: ["n. 延迟"] } : undefined) };
  const words = pickTargetWords(cards, lookup, NOW, 4, () => 0.5);
  expect(words).toEqual([
    { word: "latency", meaning: "n. 延迟", tag: "today" },
    { word: "trade-off", meaning: "", tag: "today" },
    { word: "idempotent", meaning: "", tag: "weak" },
    { word: "robust", meaning: "", tag: "weak" },
    { word: "scalable", meaning: "", tag: "review" },
  ]);
});
