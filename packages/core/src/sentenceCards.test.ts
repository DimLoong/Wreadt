import { gradeCloze, gradeTranslate, localCloze, parsePracticeCards, parsePracticeReview, planCards } from "./sentenceCards.ts";

const w = (word: string) => ({ word, meaning: "" });

it("planCards：每 5 个词一张，题型轮流，中译英混入一个易错词", () => {
  const batch = ["a1", "deadline", "cat", "approve", "dog", "postpone", "go", "budget", "x", "y", "schedule", "z", "q"].map(w);
  const plans = planCards(batch, [w("negotiate"), w("deadline")], 5);
  expect(plans.map((p) => [p.after, p.kind, p.words.map((x) => x.word)])).toEqual([
    [5, "cloze", ["deadline"]],
    [10, "translate", ["postpone", "budget", "negotiate"]],
  ]);
  expect(planCards(batch.slice(0, 4), [], 5)).toEqual([]);
});

it("localCloze 用例句出填空，允许词形变化", () => {
  expect(localCloze("delay", { sentence: "The flight was delayed by two hours.", translation: "航班延误了两小时。" })).toMatchObject({ sentence: "The flight was ___ by two hours.", answer: "delayed" });
  expect(localCloze("budget", { sentence: "No match here.", translation: "" })).toBeNull();
});

it("gradeCloze / gradeTranslate", () => {
  const card = { kind: "cloze" as const, words: ["delay"], sentence: "It was ___.", answer: "delayed" };
  expect(gradeCloze(card, " Delayed ")).toEqual({ correct: true, exact: true });
  expect(gradeCloze(card, "delay")).toEqual({ correct: true, exact: false });
  expect(gradeCloze(card, "late").correct).toBe(false);
  const tr = { kind: "translate" as const, words: ["postpone", "budget"], zh: "因为预算问题，我们推迟了会议。", reference: "We postponed the meeting because of budget issues." };
  const g = gradeTranslate(tr, "We postponed the meeting due to the budget");
  expect(g.used).toEqual({ postpone: true, budget: true });
  expect(g.ok).toBe(true);
  expect(gradeTranslate(tr, "We delayed the meeting").ok).toBe(false);
});

it("parsePracticeCards 与安排对应，不合格的题为 null", () => {
  const plans = [{ after: 5, kind: "cloze" as const, words: [w("delay")] }, { after: 10, kind: "translate" as const, words: [w("budget")] }];
  const ok = parsePracticeCards(JSON.stringify({ cards: [{ sentence: "The train was ___ again.", answer: "delayed", translation: "火车又晚点了。" }, { zh: "我们的预算不够。", reference: "Our budget is not enough." }] }), plans);
  expect(ok.map((c) => c?.kind)).toEqual(["cloze", "translate"]);
  const bad = parsePracticeCards(JSON.stringify({ cards: [{ sentence: "No blank here.", answer: "delayed" }, { zh: "We have no money.", reference: "x" }] }), plans);
  expect(bad).toEqual([null, null]);
});

it("parsePracticeReview", () => {
  const r = parsePracticeReview(JSON.stringify({ reviews: [{ verdict: "fix", comment: "中文：时态不对", better: "We postponed it.", misused: ["postponed", "too more"] }] }), [["postpone"], ["budget"]]);
  expect(r).toEqual([{ verdict: "fix", comment: "时态不对", better: "We postponed it.", misused: ["postpone"] }, null]);
});
