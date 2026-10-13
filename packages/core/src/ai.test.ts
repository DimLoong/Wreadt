import { AI_PROMPTS, EXERCISES_PROMPT, parseAnalysis, parseExamples, parseExercises, parseExpansion, parseScenario, parseScenarioReview, usesWord } from "./ai.ts";

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

it("parseScenario / parseScenarioReview 容错", () => {
  const s = parseScenario(JSON.stringify({ title: "t", scenario: "s", question: "q", recommendedWords: [{ word: "trade-off", tag: "weird" }, { word: "" }], keyPoints: "one" }));
  expect(s.recommendedWords).toEqual([{ word: "trade-off", meaning: "", usage: "", tag: "new" }]);
  expect(s.keyPoints).toEqual(["one"]);
  expect(() => parseScenario('{"title":"x","scenario":"s"}')).toThrow("场景题");

  const r = parseScenarioReview(JSON.stringify({ score: 140, scores: { content: "8", grammar: -2 }, summary: "ok", sentences: [{ original: "I think.", improved: "I believe.", tags: ["grammar", "bogus"] }] }));
  expect(r.score).toBe(100);
  expect(r.scores).toEqual({ content: 8, vocabulary: 0, grammar: 0, coherence: 0 });
  expect(r.sentences[0]!.tags).toEqual(["grammar"]);
});

it("usesWord 识别词形变化", () => {
  const answer = "We decoupled the services and made a deliberate trade-off between latency and cost.";
  expect(usesWord(answer, "decouple")).toBe(true);
  expect(usesWord(answer, "trade-off")).toBe(true);
  expect(usesWord(answer, "deliberately")).toBe(true);
  expect(usesWord(answer, "scalability")).toBe(false);
  expect(usesWord(answer, "cost")).toBe(true);
  expect(usesWord("costly", "cost")).toBe(true);
  expect(usesWord("broadcast", "cast")).toBe(false);
});

it("pickFastModel / isQwenEndpoint", async () => {
  const { pickFastModel, isQwenEndpoint } = await import("./ai.ts");
  expect(pickFastModel(["qwen3.8-max", "qwen-plus", "qwen-flash-2026-01-01", "qwen-flash", "qwen-vl-flash", "text-embedding-v4"])).toBe("qwen-flash");
  expect(pickFastModel(["deepseek-chat", "deepseek-reasoner"])).toBe("deepseek-chat");
  expect(pickFastModel(["qwen-mt-flash", "qwen-flash-character", "qwen3-livetranslate-flash", "deepseek-v4.1-flash", "qwen-flash"])).toBe("qwen-flash");
  expect(pickFastModel([])).toBeUndefined();
  expect(isQwenEndpoint("https://maas.qianwenaiapi.com/compatible-mode/v1")).toBe(true);
  expect(isQwenEndpoint("https://api.deepseek.com")).toBe(false);
});

it("parseScenario 带难度、回答方向与期望长度", async () => {
  const { parseScenario } = await import("./ai.ts");
  const s = parseScenario(JSON.stringify({ title: "间距", question: "Why does spacing matter in UI design?", directions: ["信息密度", "呼吸感"], expectedWords: 40 }), "simple");
  expect(s).toMatchObject({ level: "simple", directions: ["信息密度", "呼吸感"], expectedWords: 40, scenario: "" });
  expect(parseScenario(JSON.stringify({ question: "q" }), "medium").expectedWords).toBe(80);
});

it("parsePhrases", async () => {
  const { parsePhrases } = await import("./ai.ts");
  expect(parsePhrases('{"phrases":[{"phrase":"theme park","meaning":"主题公园"},{"phrase":""}],"examples":[]}')).toEqual([{ phrase: "theme park", meaning: "主题公园" }]);
  expect(parsePhrases('{"examples":[]}')).toEqual([]);
});

it("parseConfusable 过滤答案不在选项中的题", async () => {
  const { parseConfusable } = await import("./ai.ts");
  const groups = parseConfusable(JSON.stringify({ groups: [
    { words: ["affect", "effect"], explanation: "动词 / 名词", items: [
      { sentence: "It will ___ sales.", options: ["affect", "effect"], answer: "affect" },
      { sentence: "Bad item", options: ["affect", "effect"], answer: "impact" },
    ] },
    { words: ["solo"], items: [{ sentence: "x", options: ["a", "b"], answer: "a" }] },
  ] }));
  expect(groups).toHaveLength(1);
  expect(groups[0]!.items).toHaveLength(1);
});

it("parseFeed 过滤没有回复的话题", async () => {
  const { parseFeed } = await import("./ai.ts");
  const items = parseFeed(JSON.stringify({ items: [
    { topic: "Ship with known bugs?", replies: [{ author: "PM", stance: "赞成", text: "Sometimes yes." }], usedWords: ["trade-off"] },
    { topic: "Empty", replies: [] },
  ] }));
  expect(items).toHaveLength(1);
  expect(items[0]!.replies[0]).toEqual({ author: "PM", stance: "赞成", text: "Sometimes yes.", textTrans: "" });
});

it("parseFeed 只保留词表里、且真的出现在回复中的 usedWords", async () => {
  const { parseFeed } = await import("./ai.ts");
  const content = JSON.stringify({ items: [
    { topic: "Refactor now?", replies: [{ text: "A quick refactor is a smart trade-off before the deadlines pile up." }], usedWords: ["refactor", "trade-off", "deadline", "burnout", "standups"] },
  ] });
  expect(parseFeed(content, ["refactor", "trade-off", "deadline", "burnout"])[0]!.usedWords).toEqual(["refactor", "trade-off", "deadline"]);
});

it("scenarioHasCjk 发现写成中文的题目", async () => {
  const { scenarioHasCjk } = await import("./ai.ts");
  expect(scenarioHasCjk({ title: "Why reviews matter", scenario: "团队在站会上…", question: "Why?" })).toBe(true);
  expect(scenarioHasCjk({ title: "Why reviews matter", scenario: "A teammate asks.", question: "Why?" })).toBe(false);
});

it("兴趣流难度：自动从简单开始，表现好再升级", async () => {
  const { feedBaseLevel, feedTopicLevels } = await import("./ai.ts");
  expect(feedBaseLevel("auto", { recentScores: [], learned: 1000 })).toBe("simple");
  expect(feedBaseLevel("auto", { recentScores: [80, 78, 90], learned: 120 })).toBe("simple");
  expect(feedBaseLevel("auto", { recentScores: [80, 78, 90], learned: 500 })).toBe("medium");
  expect(feedBaseLevel("medium", { recentScores: [], learned: 0 })).toBe("medium");
  expect(feedTopicLevels("auto", "simple")).toEqual(["simple", "medium"]);
  expect(feedTopicLevels("simple", "simple")).toEqual(["simple", "simple"]);
  expect(feedTopicLevels("medium", "medium")).toEqual(["medium", "medium"]);
});

it("parseReading / parseWordTips 校验", async () => {
  const { parseReading, parseWordTips } = await import("./ai.ts");
  const r = parseReading(JSON.stringify({ title: "A Busy Monday", text: "Tom had a tight deadline.", questions: [{ question: "Q?", options: ["a", "b"], answer: "c" }, { question: "Q2?", options: ["a", "b"], answer: "a" }], usedWords: ["deadline", "budget"] }), ["deadline", "budget"]);
  expect(r.questions).toHaveLength(1);
  expect(r.usedWords).toEqual(["deadline"]);
  expect(parseWordTips(JSON.stringify({ tips: [{ word: "affect", kind: "weird", tip: "动词" }, { word: "x" }] }))).toEqual([{ word: "affect", kind: "usage", title: "", tip: "动词", example: "", exampleTrans: "" }]);
});

it("parseDictation 过滤过短、过长与非英文的句子", async () => {
  const { parseDictation } = await import("./ai.ts");
  const list = parseDictation(JSON.stringify({ sentences: [{ text: "Hi.", translation: "嗨" }, { text: "We need to meet the deadline today.", translation: "我们今天要赶上截止日期。", word: "deadline" }, { text: "这是中文。" }] }));
  expect(list).toEqual([{ text: "We need to meet the deadline today.", translation: "我们今天要赶上截止日期。", word: "deadline" }]);
});

it("parseFeed 兼容常见的字段名变体", async () => {
  const { parseFeed } = await import("./ai.ts");
  const items = parseFeed(JSON.stringify({ topics: [{ question: "Tea or coffee?", replies: [{ author: "A", stance: "茶", content: "Tea keeps me calm." }] }] }));
  expect(items[0]).toMatchObject({ topic: "Tea or coffee?", replies: [{ text: "Tea keeps me calm." }] });
  expect(parseFeed(JSON.stringify([{ topic: "T?", replies: [{ text: "x" }] }]))).toHaveLength(1);
});
