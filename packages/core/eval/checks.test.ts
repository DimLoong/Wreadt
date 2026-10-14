import { checkOutput, cjkRatio, hasMarkdown, inLocale } from "./checks.ts";
import { EVAL_CASES } from "./fixtures.ts";

const input = (id: string) => EVAL_CASES.find((c) => c.id === id)!;

const goodScenario = {
  title: "Why Code Reviews Matter",
  scenario: "A new teammate asks why the team reviews every pull request.",
  scenarioTrans: "一位新同事问团队为什么要评审每个合并请求。",
  question: "Why should we keep our code readable when we refactor?",
  questionTrans: "重构时为什么要保持代码可读？",
  directions: ["方便他人理解", "降低维护成本"],
  expectedWords: 40,
  keyPoints: ["可读性帮助协作", "减少后续维护的时间"],
  recommendedWords: [
    { word: "readable", meaning: "可读的", usage: "keep the code readable", tag: "today" },
    { word: "maintain", meaning: "维护", usage: "easier to maintain", tag: "weak" },
    { word: "clarity", meaning: "清晰", usage: "improve clarity", tag: "new" },
  ],
  phrases: [],
  grammar: [],
};

it("文本工具", () => {
  expect(cjkRatio("降低维护成本 API")).toBeGreaterThan(0.5);
  expect(inLocale("方便他人理解", "zh-CN")).toBe(true);
  expect(inLocale("在 PR 中提出 code review 意见", "zh-CN")).toBe(true);
  expect(inLocale("'set the severity to' 是更标准的术语搭配；'prevents users from accessing' 更具体", "zh-CN")).toBe(true);
  expect(inLocale("added 'concise' to better reflect professional standards", "zh-CN")).toBe(false);
  expect(inLocale("affect 还是 effect？", "zh-CN")).toBe(true);
  expect(inLocale("Make it easy to read", "zh-CN")).toBe(false);
  expect(inLocale("Make it easy to read", "en")).toBe(true);
  expect(hasMarkdown("This is **bold**")).toBe(true);
  expect(hasMarkdown("- item")).toBe(true);
  expect(hasMarkdown("The ___ was late and ___ again.")).toBe(false);
});

it("合格的场景题没有错误", () => {
  const c = input("scenario-dev-simple");
  expect(checkOutput(c.task, c.input, JSON.stringify(goodScenario), c.forbid).filter((i) => i.severity === "error")).toEqual([]);
});

it("场景题：英文方向、Markdown、编造 tag、禁止内容都会被发现", () => {
  const c = input("scenario-qa-bug-offtopic");
  const bad = {
    ...goodScenario,
    directions: ["Explain the steps", "**严重程度**"],
    recommendedWords: [{ word: "deploy", meaning: "部署", usage: "deploy it", tag: "marked" }],
    keyPoints: ["说明 mortgage 的影响"],
  };
  const rules = checkOutput(c.task, c.input, JSON.stringify(bad), c.forbid).map((i) => i.rule);
  expect(rules).toEqual(expect.arrayContaining(["locale", "markdown", "recommended", "forbid"]));
});

it("兴趣流：虚报的 usedWords 被过滤，没用上任何词时提醒", () => {
  const c = input("feed-pm-few-words");
  const text = "I think we should ship it on Friday because the bugs are small and users will barely notice them at all, while the launch date really matters for the marketing team and the sales folks who promised it.";
  const out = { items: [{ topic: "Ship with small bugs?", topicTrans: "带着小 bug 发布可以吗？", context: "", contextTrans: "", usedWords: ["prioritize"], replies: [{ author: "A PM", stance: "赞成", text, textTrans: "我觉得可以发布。" }, { author: "A QA", stance: "反对", text, textTrans: "我反对。" }] }] };
  const issues = checkOutput(c.task, c.input, JSON.stringify(out));
  expect(issues.some((i) => i.rule === "usedWords" && i.severity === "warn")).toBe(true);
});

it("点评：original 必须逐字取自回答", () => {
  const c = input("review-simple-errors");
  const out = { score: 70, scores: { content: 7, vocabulary: 7, grammar: 6, coherence: 7 }, summary: "整体不错。", strengths: [], sentences: [{ original: "Code review is very important.", improved: "Code reviews are important.", notes: "主谓一致。", tags: ["grammar"] }], usedWords: ["catch"], misusedWords: [], missedPoints: [], modelAnswer: "Code reviews help us catch bugs early and share knowledge across the team. They also keep our code style consistent, which makes the codebase easier to read for everyone who joins later.", newWords: [] };
  const issues = checkOutput(c.task, c.input, JSON.stringify(out));
  expect(issues.map((i) => i.rule)).toContain("original");
  expect(issues.filter((i) => i.rule === "usedWords")).toEqual([]);
});

it("无法解析的输出记为 parse 错误", () => {
  const c = input("examples-en");
  expect(checkOutput(c.task, c.input, "not json")[0]!.rule).toBe("parse");
});

it("测试集共 25 个用例且 id 唯一", () => {
  expect(EVAL_CASES).toHaveLength(25);
  expect(new Set(EVAL_CASES.map((c) => c.id)).size).toBe(25);
});
