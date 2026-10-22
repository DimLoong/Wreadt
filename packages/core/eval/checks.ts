// AI 输出的规则检查：不依赖模型，可以对任意一次输出重复运行。
// 主观的“题目是否自洽”交给 judge.ts 里的模型评审。

import {
  parseConfusable,
  parseDictation,
  parseDictOutline,
  parseExpansion,
  parseExamples,
  parseExercises,
  parseReading,
  parseWordTips,
  parseFeed,
  parsePhrases,
  parseScenario,
  parseScenarioReview,
  usesWord,
  type AiTask,
  type ScenarioLevel,
} from "../src/ai.ts";
import { parsePracticeCards, parsePracticeReview } from "../src/sentenceCards.ts";

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

/** 文本是否使用界面语言：中文界面要有中文（允许夹带英文），英文界面不应出现中文 */
export function inLocale(text: string, locale: string): boolean {
  if (!text.trim()) return true;
  if (!locale.startsWith("zh")) return cjkRatio(text) === 0;
  // 说明里常引用英文原词（如“affect 还是 effect？”），所以只要求有中文；整段英文才算错
  return (text.match(/[\u3400-\u9fff]/g) ?? []).length >= 2;
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
  for (const [field, text] of [["title", s.title], ["scenario", s.scenario], ["question", s.question]] as const)
    if (cjkRatio(text) > 0) c.error("english", `${field} 应为英文：${short(text)}`);
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
  // 与应用一致：解析时传入词表，虚报的 usedWords 会被过滤
  const items = parseFeed(content, (input.words as { word: string }[]).map((w) => w.word));
  const avoid = ((input.avoidTopics as string[]) ?? []).map((t) => t.toLowerCase());

  c.markdown(items);
  const levels = (input.levels as string[]) ?? [];
  if (items.length !== levels.length) c.warn("count", `话题数为 ${items.length}，期望 ${levels.length}`);
  items.forEach((it, idx) => {
    const level = levels[idx] ?? "medium";
    if (avoid.includes(it.topic.toLowerCase())) c.error("repeat", `与最近的话题重复：${it.topic}`);
    c.range("topic 词数", wordCount(it.topic), 3, 18);
    c.locale("topicTrans", [it.topicTrans], locale);
    c.locale("contextTrans", [it.contextTrans], locale);
    c.locale("stance", it.replies.map((r) => r.stance), locale);
    c.locale("textTrans", it.replies.map((r) => r.textTrans), locale);
    if (it.replies.length !== 2) c.warn("count", `“${short(it.topic)}”有 ${it.replies.length} 条回复，期望 2`);
    // 简单 15～30 词、中等 30～50 词，略放宽
    for (const r of it.replies) c.range(`${level} 回复词数`, wordCount(r.text), ...((level === "simple" ? [10, 36] : [16, 60]) as [number, number]));
    if (!it.usedWords.length) c.warn("usedWords", `“${short(it.topic)}”没有用上任何输入词`);
  });
}

function checkReading(c: Collector, input: Input, content: string) {
  const locale = String(input.locale);
  const r = parseReading(content, (input.words as { word: string }[]).map((w) => w.word));
  c.markdown(r);
  if (cjkRatio(`${r.title} ${r.text}`) > 0) c.error("english", `title / text 应为英文：${short(r.title)}`);
  c.locale("textTrans", [r.textTrans], locale);
  c.locale("explanation", r.questions.map((q) => q.explanation), locale);
  const simple = input.level === "simple";
  c.range("短文词数", wordCount(r.text), ...((simple ? [40, 80] : [70, 135]) as [number, number]));
  c.range("理解题数", r.questions.length, simple ? 1 : 2, simple ? 1 : 2);
  if (r.usedWords.length < 2) c.warn("usedWords", `只用上了 ${r.usedWords.length} 个输入词`);
}

function checkTips(c: Collector, input: Input, content: string) {
  const locale = String(input.locale);
  const tips = parseWordTips(content);
  const words = ((input.words as { word: string }[]) ?? []).map((w) => w.word.toLowerCase());
  c.markdown(tips);
  c.range("条数", tips.length, Number(input.count), Number(input.count));
  if (new Set(tips.map((t) => t.kind)).size < Math.min(2, tips.length)) c.warn("kind", "几条小知识的类型都一样");
  for (const t of tips) {
    if (!words.includes(t.word.toLowerCase())) c.error("word", `“${t.word}”不在输入词表里`);
    // 标题常以英文为主（如“complement 与 contrast”），只检查说明
    c.locale("tip", [t.tip], locale);
    c.locale("exampleTrans", [t.exampleTrans], locale);
    if (t.tip.length > 80) c.warn("length", `tip 过长（${t.tip.length} 字）：${short(t.tip)}`);
    if (t.example && !usesWord(t.example, t.word.split(" ")[0]!)) c.warn("example", `例句没有用到“${t.word}”：${short(t.example)}`);
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

function checkDictation(c: Collector, input: Input, content: string) {
  const locale = String(input.locale);
  const list = parseDictation(content);
  c.markdown(list);
  c.range("句子数", list.length, Number(input.count), Number(input.count));
  const [min, max] = input.level === "simple" ? [5, 11] : [9, 17];
  for (const x of list) {
    c.range("句子词数", wordCount(x.text), min, max);
    if (!/[.?!]$/.test(x.text)) c.warn("sentence", `不是完整句子：${short(x.text)}`);
    if (/\d|[A-Z]{2,}/.test(x.text)) c.warn("sentence", `含数字或缩写，难以听写：${short(x.text)}`);
    if (x.word && !usesWord(x.text, x.word)) c.error("word", `声称用了“${x.word}”，但句中没有：${short(x.text)}`);
  }
  c.locale("translation", list.map((x) => x.translation), locale);
}

function checkDictOutline(c: Collector, input: Input, content: string) {
  const o = parseDictOutline(content);
  c.markdown(o);
  c.locale("name / description", [o.name, o.description], String(input.locale));
  c.locale("topics.title", o.topics.map((t) => t.title), String(input.locale));
  c.range("主题数", o.topics.length, 5, 8);
  if (o.name.length > 14) c.warn("length", `名字过长：${o.name}`);
  for (const t of o.topics) {
    if (t.examples.length < 2) c.warn("examples", `“${t.title}”的例子太少`);
    for (const e of t.examples) if (wordCount(e) > 4) c.warn("examples", `例子应为短语而不是句子：${short(e)}`);
  }
}

function checkDictWords(c: Collector, input: Input, content: string) {
  const words = parseExpansion(content, (input.exclude as string[]) ?? []);
  c.markdown(words);
  c.range("词条数", words.length, Math.round(Number(input.count) * 0.7), Number(input.count) + 2);
  for (const w of words) {
    const trans = Array.isArray(w.trans) ? w.trans : [w.trans ?? ""];
    if (!trans.every((x) => /^(n|v|vt|vi|adj|adv|phr|prep)\./.test(x))) c.warn("pos", `“${w.name}”的释义没有词性：${trans.join("；")}`);
    c.locale("trans", trans, String(input.locale));
    if (w.example && !usesWord(w.example, w.name.split(" ")[0]!)) c.warn("example", `例句没用到“${w.name}”：${short(w.example)}`);
  }
}

function checkPracticeCards(c: Collector, input: Input, content: string) {
  const plans = (input.cards as { kind: "cloze" | "translate"; words: { word: string; meaning: string }[] }[]).map((p, i) => ({ after: (i + 1) * 5, ...p }));
  const cards = parsePracticeCards(content, plans);
  c.markdown(cards);
  cards.forEach((card, i) => {
    if (!card) return c.error("card", `第 ${i + 1} 题不合格（缺空 / 没用到目标词 / 中文夹英文）`);
    if (card.kind === "cloze") {
      c.range("填空句词数", wordCount(card.sentence ?? ""), 6, 18);
      c.locale("translation", [card.translation ?? ""], String(input.locale));
      for (const w of card.words) if ((card.translation ?? "").toLowerCase().includes(w.toLowerCase())) c.error("leak", `填空提示里出现了答案“${w}”`);
    } else {
      c.range("参考译文词数", wordCount(card.reference ?? ""), 6, 20);
    }
  });
}

function checkExercises(c: Collector, input: Input, content: string) {
  const raw = (JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "")) as { exercises?: unknown[] }).exercises ?? [];
  const list = parseExercises(content);
  c.markdown(list);
  // 被解析过滤掉的题 = 填空露出答案、改错没有明确错误片段等
  if (list.length < raw.length) c.error("rejected", `${raw.length - list.length} 道题不合格被丢弃（填空露出答案 / 改错没有给出原句中的错误片段）`);
  const words = input.words as string[];
  if (list.length < words.length) c.warn("count", `${words.length} 个词只出了 ${list.length} 道有效题`);
  for (const e of list) {
    c.locale("explanation", [e.explanation], String(input.locale));
    if (e.kind === "cloze" && !e.hint) c.warn("hint", `填空题“${e.word}”没有中文提示`);
    if (e.kind === "cloze" && e.explanation.toLowerCase().includes(e.word.toLowerCase())) c.warn("leak", `填空题的说明里出现了答案“${e.word}”（作答后才显示，影响不大）`);
  }
}

function checkPracticeReview(c: Collector, input: Input, content: string) {
  const items = input.items as { answer: string; words: string[] }[];
  const reviews = parsePracticeReview(content, items.map((x) => x.words));
  c.markdown(reviews);
  reviews.forEach((r, i) => {
    if (!r) return c.error("review", `第 ${i + 1} 项没有点评`);
    c.locale("comment", [r.comment], String(input.locale));
  });
  // 第 2 项与参考答案说法不同但正确，不应判为 fix；第 3 项用错了 budget，应判为 fix 并列入 misused
  if (reviews[1]?.verdict === "fix") c.error("strict", "说法不同但正确的答案被判为 fix");
  if (reviews[2] && (reviews[2].verdict !== "fix" || !reviews[2].misused.some((m) => /budget/i.test(m)))) c.warn("lenient", "明显用错的答案没有判为 fix 或没列出 misused");
}

const CHECKERS: Partial<Record<AiTask, (c: Collector, input: Input, content: string) => void>> = {
  "scenario-question": checkScenario,
  "interest-feed": checkFeed,
  "scenario-review": checkReview,
  "confusable-quiz": checkConfusable,
  "word-examples": checkExamples,
  "micro-reading": checkReading,
  "word-tips": checkTips,
  "dictation-sentences": checkDictation,
  "dict-outline": checkDictOutline,
  "dict-words": checkDictWords,
  "practice-cards": checkPracticeCards,
  "practice-review": checkPracticeReview,
  "sentence-exercises": checkExercises,
};

/** 检查一次模型输出；解析失败本身也是一条 error */
export function checkOutput(task: AiTask, input: Input, content: string, forbid: RegExp[] = [], require: RegExp[] = []): Issue[] {
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
  for (const re of require) if (!allStrings(parsed).some((t) => re.test(t))) c.error("require", `缺少应覆盖的内容 ${re}`);
  return c.issues;
}
