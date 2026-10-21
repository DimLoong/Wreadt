import { dictStats, buildSession } from "./queue.ts";
import { gradeFromTyping, isDue, masteryLevel, Rating, reviewCard, type CardState } from "./scheduler.ts";
import type { WordItem } from "./types.ts";

const DAY = 86_400_000;
const word = (n: number): WordItem => ({ id: `d:w${n}`, dictId: "d", lang: "en", display: `w${n}`, answer: `w${n}`, meanings: [] });

describe("gradeFromTyping", () => {
  const base = { errors: 0, hinted: false, skipped: false, durationMs: 3000, answerLength: 8 };
  it("映射打字表现", () => {
    expect(gradeFromTyping({ ...base, skipped: true })).toBe(Rating.Again);
    expect(gradeFromTyping({ ...base, errors: 5 })).toBe(Rating.Again);
    expect(gradeFromTyping({ ...base, errors: 1 })).toBe(Rating.Hard);
    expect(gradeFromTyping({ ...base, hinted: true })).toBe(Rating.Hard);
    expect(gradeFromTyping(base)).toBe(Rating.Good);
    expect(gradeFromTyping({ ...base, durationMs: 1500 })).toBe(Rating.Easy);
  });

  it("只是手滑（宽容模式）：不降为 Hard，但最多 Good", () => {
    expect(gradeFromTyping({ ...base, slips: 2, durationMs: 1500 })).toBe(Rating.Good);
    expect(gradeFromTyping({ ...base, slips: 1, errors: 1 })).toBe(Rating.Hard);
  });
});

describe("reviewCard", () => {
  it("新词复习后进入调度，连续答对间隔增长", () => {
    const now = Date.UTC(2026, 0, 1);
    const first = reviewCard(undefined, word(1), Rating.Good, now);
    expect(first).toMatchObject({ id: "d:w1", dictId: "d", reps: 1, updatedAt: now });
    expect(first.due).toBeGreaterThan(now);

    let card = first;
    let t = now;
    for (let i = 0; i < 6; i += 1) {
      t = card.due;
      card = reviewCard(card, word(1), Rating.Good, t);
    }
    expect(card.due - t).toBeGreaterThan(20 * DAY);
    expect(masteryLevel(card)).toBe(3);
  });

  it("Again 记一次遗忘", () => {
    const now = Date.UTC(2026, 0, 1);
    let card = reviewCard(undefined, word(1), Rating.Easy, now);
    card = reviewCard(card, word(1), Rating.Again, card.due);
    expect(card.lapses).toBe(1);
  });
});

describe("buildSession / dictStats", () => {
  const now = Date.UTC(2026, 5, 1);
  const words = [1, 2, 3, 4, 5].map(word);
  const card = (n: number, due: number, extra: Partial<CardState> = {}): CardState => ({
    id: `d:w${n}`, dictId: "d", due, stability: 1, difficulty: 5, scheduledDays: 1, learningSteps: 0,
    reps: 1, lapses: 0, state: 2, updatedAt: 0, ...extra,
  });
  const cards = new Map([
    ["d:w1", card(1, now + DAY)],
    ["d:w2", card(2, now - DAY)],
    ["d:w3", card(3, now - 2 * DAY)],
  ]);

  it("到期复习优先，其次新词", () => {
    expect(buildSession(words, cards, { size: 3, now }).map((w) => w.answer)).toEqual(["w3", "w2", "w4"]);
    expect(buildSession(words, cards, { size: 5, now, newLimit: 1 }).map((w) => w.answer)).toEqual(["w3", "w2", "w4"]);
  });

  it("统计", () => {
    expect(dictStats(words, cards, now)).toEqual({ total: 5, learned: 3, mastered: 0, due: 2 });
    expect(isDue(card(9, now), now)).toBe(true);
  });
});

it("buildSession 混入我的词库：先到期再新词，随机插入且不与主词库重复", () => {
  const now = Date.UTC(2026, 5, 1);
  const main = [1, 2, 3, 4, 5].map(word);
  const mine = [word(2), word(10), word(11), word(12)].map((w) => ({ ...w, dictId: "custom-en" }));
  const cards = new Map([["d:w11", { id: "d:w11", dictId: "custom-en", due: now - 1, stability: 1, difficulty: 5, scheduledDays: 1, learningSteps: 0, reps: 1, lapses: 0, state: 2, updatedAt: 0 } as CardState]]);
  const session = buildSession(main, cards, { size: 5, now, mix: mine, mixCount: 2, random: () => 0 });
  expect(session.map((w) => w.answer)).toEqual(["w10", "w11", "w1", "w2", "w3"]);
  expect(buildSession(main, cards, { size: 5, now, mix: mine, mixCount: 0 })).toHaveLength(5);
});

it("mark 的词（strict）复习间隔更短", () => {
  const now = Date.UTC(2026, 0, 1);
  let normal = reviewCard(undefined, word(1), Rating.Good, now);
  let strict = reviewCard(undefined, word(1), Rating.Good, now, true);
  for (let i = 0; i < 4; i++) {
    normal = reviewCard(normal, word(1), Rating.Good, normal.due);
    strict = reviewCard(strict, word(1), Rating.Good, strict.due, true);
  }
  expect(strict.scheduledDays).toBeLessThan(normal.scheduledDays);
});
