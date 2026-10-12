import { EXERCISES_PROMPT, parseExamples, parseExercises } from "./ai.ts";

it("parseExercises 过滤无效题目，兼容代码块包裹", () => {
  const content = '```json\n{"exercises":[{"word":"a","kind":"cloze","prompt":"p","answer":"a","explanation":"e"},{"word":"b","kind":"bogus","prompt":"p","answer":"b"}]}\n```';
  expect(parseExercises(content)).toEqual([{ word: "a", kind: "cloze", prompt: "p", answer: "a", explanation: "e" }]);
  expect(() => parseExercises("not json")).toThrow("无法解析");
  expect(() => parseExercises('{"exercises":[]}')).toThrow("有效题目");
});

it("parseExamples", () => {
  expect(parseExamples('{"examples":[{"sentence":"Hi.","translation":"你好。"},{"sentence":""}]}')).toEqual([{ sentence: "Hi.", translation: "你好。" }]);
});

it("提示词与服务端一致", async () => {
  const { readFileSync } = await import("node:fs");
  const server = readFileSync(new URL("../../../apps/server/src/main/resources/prompts/sentence-exercises.txt", import.meta.url), "utf8");
  expect(EXERCISES_PROMPT).toBe(server.trimEnd());
});
