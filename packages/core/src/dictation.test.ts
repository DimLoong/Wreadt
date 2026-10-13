import { diffSentence, lemmaCandidates, markCandidates, missedWords, tokenizeSentence } from "./dictation.ts";

it("tokenizeSentence 忽略大小写与标点，保留撇号和连字符", () => {
  expect(tokenizeSentence("Don’t miss the follow-up, OK?")).toEqual(["don't", "miss", "the", "follow-up", "ok"]);
});

it("完全正确", () => {
  const d = diffSentence("We need to meet the deadline.", "we need to meet the deadline");
  expect(d.accuracy).toBe(1);
  expect(d.tokens.every((t) => t.status === "ok")).toBe(true);
});

it("拼错、漏词、多打", () => {
  const d = diffSentence("Please send me the final report today.", "please send the finel report today now");
  expect(d.tokens.map((t) => t.status)).toEqual(["ok", "ok", "missing", "ok", "wrong", "ok", "ok", "extra"]);
  expect(d.tokens[4]).toEqual({ status: "wrong", expected: "final", typed: "finel" });
  expect(d.correct).toBe(5);
  expect(d.total).toBe(7);
  expect(d.accuracy).toBeCloseTo(5 / 7);
  expect(missedWords(d)).toEqual(["me", "final"]);
});

it("什么都没打", () => {
  const d = diffSentence("Hello world", "");
  expect(d.tokens.map((t) => t.status)).toEqual(["missing", "missing"]);
  expect(d.accuracy).toBe(0);
});

it("markCandidates 去掉功能词，拼错与目标词默认勾选", () => {
  const d1 = diffSentence("She has moved the meeting to tomorrow.", "she moved the meating");
  const d2 = diffSentence("We need to postpone the launch.", "we need to the launch");
  const list = markCandidates([{ diff: d1 }, { diff: d2, target: "postpone" }]);
  expect(list).toEqual([
    { word: "meeting", reason: "spelling", preselect: true },
    { word: "tomorrow", reason: "pronunciation", preselect: false },
    { word: "postpone", reason: "pronunciation", preselect: true },
  ]);
});

it("lemmaCandidates 不会把 has 还原成 ha", () => {
  expect(lemmaCandidates("has")).toEqual(["has"]);
  expect(lemmaCandidates("meetings")).toContain("meeting");
  expect(lemmaCandidates("moved")).toContain("move");
  expect(lemmaCandidates("studies")).toContain("study");
});
