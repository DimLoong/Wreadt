import { AI_PROMPTS, EXERCISES_PROMPT, parseAnalysis, parseExamples, parseExercises, parseExpansion } from "./ai.ts";

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

it("parseAnalysis：日语必须有罗马音，英文去掉音标斜杠", () => {
  const en = parseAnalysis('{"words":[{"input":"running","word":"run","phonetic":"/rʌn/","meanings":["v. 跑"],"example":"I run.","exampleTrans":"我跑。"},{"input":"x","word":"","meanings":[]}]}', "en");
  expect(en).toEqual([{ input: "running", word: "run", reading: "", romaji: "", phonetic: "rʌn", meanings: ["v. 跑"], example: "I run.", exampleTrans: "我跑。" }]);
  expect(() => parseAnalysis('{"words":[{"input":"食べた","word":"食べる","reading":"たべる","meanings":["v. 吃"]}]}', "ja")).toThrow();
});

it("parseExpansion：过滤已有词、非法格式与重复", () => {
  const content = JSON.stringify({ words: [
    { name: "Backlog", trans: ["n. 待办"] },
    { name: "user story", trans: ["n. 用户故事"], usphone: "/ˈjuːzər ˈstɔːri/" },
    { name: "user story", trans: ["n. 重复"] },
    { name: "A/B test", trans: ["n. AB 测试"] },
    { name: "too many words here", trans: ["x"] },
  ] });
  expect(parseExpansion(content, ["backlog"])).toEqual([{ name: "user story", trans: ["n. 用户故事"], usphone: "ˈjuːzər ˈstɔːri", example: "", exampleTrans: "" }]);
});

it("服务端提示词与 core 一致", async () => {
  const { readFileSync } = await import("node:fs");
  for (const [task, prompt] of Object.entries(AI_PROMPTS)) {
    const file = readFileSync(new URL(`../../../apps/server/src/main/resources/prompts/${task}.txt`, import.meta.url), "utf8");
    expect(prompt, task).toBe(file.trimEnd());
  }
});
