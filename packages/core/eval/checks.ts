// AI 输出的规则检查：不依赖模型，可以对任意一次输出重复运行。
// 主观的“题目是否自洽”交给 judge.ts 里的模型评审。

import {
  parseConfusable,
  parseExamples,
  parseFeed,
  parsePhrases,
  parseScenario,
  parseScenarioReview,
  usesWord,
  type AiTask,
  type ScenarioLevel,
} from "../src/ai.ts";

export interface Issue {
  rule: string;
  severity: "error" | "warn";
  detail: string;
}

type Input = Record<string, unknown>;

// ---------- 通用工具 ----------

/** 中文字符占（中文 + 拉丁字母）的比例 */
export function cjkRatio(text: string): number {
  const cjk = (text.match(/[㐀-鿿]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return cjk + latin ? cjk / (cjk + latin) : 1;
}

/** 文本是否使用界面语言：中文界面要有足够的中文（允许夹带英文术语），英文界面不应出现中文 */
export function inLocale(text: string, locale: string): boolean {
  if (!text.trim()) return true;
  if (!locale.startsWith("zh")) return cjkRatio(text) === 0;
  return (text.match(/[\u3400-\u9fff]/g) ?? []).length >= 2 && cjkRatio(text) >= 0.25;
}

/** 常见 Markdown 痕迹：加粗、标题、行内代码、行首列表符号 */
export function hasMarkdown(text: string): boolean {
  return /\*\*[^*]+\*\*|^#{1,6}\s|`[^`]+`|^\s*[-*+]\s+\S|^\s*\d+\.\s+\S/m.test(text);
}

export const wordCount = (text: string) => (text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length;

/** 递归收集对象里的所有字符串 */
export function allStrings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(allStrings);
  if (v && typeof v === "object") return Object.values(v).flatMap(allStrings);
  return [];
}

const short = (s: string) => (s.length > 60 ? `${s.slice(0, 60)}…` : s);

class Collector {
  issues: Issue[] = [];
  error(rule: string, detail: string) {
    this.issues.push({ rule, severity: "error", detail });
  }
  warn(rule: string, detail: string) {
    this.issues.push({ rule, severity: "warn", detail });
  }
  locale(field: string, texts: string[], locale: string) {
    for (const t of texts) if (!inLocale(t, locale)) this.error("locale", `${field} 不是界面语言（${locale}）：${short(t)}`);
  }
  markdown(value: unknown) {
    for (const t of allStrings(value)) if (hasMarkdown(t)) this.error("markdown", `含 Markdown：${short(t)}`);
  }
  range(field: string, n: number, min: number, max: number) {
    if (n < min || n > max) this.warn("length", `${field} 为 ${n}，期望 ${min}～${max}`);
  }
}

// ---------- 各任务 ----------

const SCENARIO_RULES: Record<ScenarioLevel, { scenarioMax: number; directions: [number, number]; words: [number, number]; expected: [number, number] }> = {
  simple: { scenarioMax: 45, directions: [2, 3], words: [3, 5], expected: [30, 50] },
  medium: { scenarioMax: 85, directions: [3, 4], words: [5, 8], expected: [60, 100] },
  professional: { scenarioMax: 140, directions: [0, 6], words: [8, 12], expected: [120, 200] },
};

function checkScenario(c: Collector, input: Input, content: string) {
  const level = input.level as ScenarioLevel;
  const locale = String(input.locale);
  const s = parseScenario(content, level);
  const rule = SCENARIO_RULES[level];

  c.markdown(s);
  if (cjkRatio(`${s.scenario} ${s.question}`) > 0) c.error("english", `scenario / question 应为英文：${short(s.question)}`);
  c.locale("directions", s.directions, locale);
  c.locale("keyPoints", s.keyPoints, locale);
  c.locale("scenarioTrans", [s.scenarioTrans], locale);
  c.locale("questionTrans", [s.questionTrans], locale);
  c.locale("recommendedWords.meaning", s.recommendedWords.map((w) => w.meaning), locale);

  c.range("scenario 词数", wordCount(s.scenario), 0, rule.scenarioMax);
  if (level === "simple") c.range("question 词数", wordCount(s.question), 3, 25);
  c.range("directions 条数", s.directions.length, ...rule.directions);
  c.range("recommendedWords 个数", s.recommendedWords.length, ...rule.words);
  c.range("expectedWords", s.expectedWords, ...rule.expected);

  const targets = (input.targetWords as { word: string; tag: string }[]) ?? [];
  for (const w of s.recommendedWords) {
    const target = targets.find((t) => t.word.toLowerCase() === w.word.toLowerCase());
    if (w.tag !== "new" && !target) c.error("recommended", `“${w.word}”标为 ${w.tag}，但不在 targetWords 中`);
    if (target && w.tag !== target.tag) c.warn("recommended", `“${w.word}”的 tag 应为 ${target.tag}，实际 ${w.tag}`);
    if (w.usage && !usesWord(w.usage, w.word)) c.warn("recommended", `“${w.word}”的 usage 没有用到该词：${short(w.usage)}`);
  }
  const avoid = ((input.avoidTitles as string[]) ?? []).map((t) => t.toLowerCase());
  if (avoid.includes(s.title.toLowerCase())) c.error("repeat", `与最近的题目重复：${s.title}`);
}

function checkFeed(c: Collector, input: Input, content: string) {
  const locale = String(input.locale);
  const items = parseFeed(content);
  const words = ((input.words as { word: string }[]) ?? []).map((w) => w.word.toLowerCase());
  const avoid = ((input.avoidTopics as string[]) ?? []).map((t) => t.toLowerCase());

  c.markdown(items);
  if (items.length !== input.count) c.warn("count", `话题数为 ${items.length}，期望 ${input.count}`);
  for (const it of items) {
    if (avoid.includes(it.topic.toLowerCase())) c.error("repeat", `与最近的话题重复：${it.topic}`);
    c.range("topic 词数", wordCount(it.topic), 3, 18);
    c.locale("topicTrans", [it.topicTrans], locale);
    c.locale("contextTrans", [it.contextTrans], locale);
    c.locale("stance", it.replies.map((r) => r.stance), locale);
    c.locale("textTrans", it.replies.map((r) => r.textTrans), locale);
    if (it.replies.length !== 2) c.warn("count", `“${short(it.topic)}”有 ${it.replies.length} 条回复，期望 2`);
    for (const r of it.replies) c.range("回复词数", wordCount(r.text), 30, 90);
    const text = it.replies.map((r) => r.text).join(" ");
    for (const u of it.usedWords) {
      if (!words.includes(u.toLowerCase())) c.error("usedWords", `usedWords 中的“${u}”不在输入词表里`);
      else if (!usesWord(text, u)) c.error("usedWords", `声称用了“${u}”，但回复里没有出现`);
    }
  }
}

function checkReview(c: Collector, input: Input, content: string) {
  const locale = String(input.locale);
  const r = parseScenarioReview(content);
  const answer = String(input.answer).replace(/\s+/g, " ");
  const recommended = ((input.recommendedWords as string[]) ?? []).map((w) => w.toLowerCase());

  c.markdown(r);
  c.locale("summary", [r.summary], locale);
  c.locale("strengths", r.strengths, locale);
  c.locale("notes", r.sentences.map((x) => x.notes), locale);
  c.locale("missedPoints", r.missedPoints, locale);
  for (const x of r.sentences) {
    if (!answer.includes(x.original.replace(/\s+/g, " "))) c.error("original", `original 不是逐字取自回答：${short(x.original)}`);
    if (input.level === "simple" && wordCount(x.improved) > wordCount(x.original) * 1.8 + 5)
      c.warn("simple", `简单题的改写过长：${short(x.improved)}`);
  }
  for (const u of r.usedWords) {
    if (!recommended.includes(u.toLowerCase())) c.error("usedWords", `usedWords 中的“${u}”不是推荐词`);
    else if (!usesWord(answer, u)) c.error("usedWords", `声称回答用了“${u}”，但回答里没有出现`);
  }
  if (input.level === "simple") c.range("missedPoints 条数", r.missedPoints.length, 0, 2);
  const expected = Number(input.expectedWords);
  c.range("modelAnswer 词数", wordCount(r.modelAnswer), Math.round(expected * 0.6), Math.round(expected * 1.6));
}

function checkConfusable(c: Collector, input: Input, content: string) {
  const locale = String(input.locale);
  const groups = parseConfusable(content);
  c.markdown(groups);
  for (const g of groups) {
    c.locale("explanation", [g.explanation, ...g.items.map((i) => i.explanation)], locale);
    for (const it of g.items) if (!it.sentence.includes("___")) c.error("blank", `题干缺少 ___：${short(it.sentence)}`);
  }
  const words = ((input.words as { word: string }[]) ?? []).map((w) => w.word.toLowerCase());
  for (const w of words) if (!groups.some((g) => g.words.some((x) => x.toLowerCase() === w))) c.warn("coverage", `输入词“${w}”没有出现在任何一组里`);
}

function checkExamples(c: Collector, input: Input, content: string) {
  const locale = String(input.locale);
  const examples = parseExamples(content);
  const phrases = parsePhrases(content);
  c.markdown({ examples, phrases });
  c.range("例句数", examples.length, 3, 3);
  c.range("短语数", phrases.length, 3, 5);
  c.locale("translation", examples.map((e) => e.translation), locale);
  c.locale("phrases.meaning", phrases.map((p) => p.meaning), locale);
  for (const e of examples) {
    if (input.lang === "en" && !usesWord(e.sentence, String(input.word))) c.error("example", `例句没有用到目标词：${short(e.sentence)}`);
    if (input.lang === "ja" && !/[぀-ヿ]/.test(e.sentence)) c.error("example", `日语例句应使用日文书写：${short(e.sentence)}`);
  }
}

const CHECKERS: Partial<Record<AiTask, (c: Collector, input: Input, content: string) => void>> = {
  "scenario-question": checkScenario,
  "interest-feed": checkFeed,
  "scenario-review": checkReview,
  "confusable-quiz": checkConfusable,
  "word-examples": checkExamples,
};

/** 检查一次模型输出；解析失败本身也是一条 error */
export function checkOutput(task: AiTask, input: Input, content: string, forbid: RegExp[] = []): Issue[] {
  const c = new Collector();
  const checker = CHECKERS[task];
  if (!checker) return [{ rule: "unsupported", severity: "warn", detail: `暂无 ${task} 的检查规则` }];
  try {
    checker(c, input, content);
  } catch (err) {
    c.error("parse", (err as Error).message);
    return c.issues;
  }
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
  } catch {
    // 上面已能解析，这里不会失败
  }
  for (const re of forbid) for (const t of allStrings(parsed)) if (re.test(t)) c.error("forbid", `出现了不应出现的内容 ${re}：${short(t)}`);
  return c.issues;
}
