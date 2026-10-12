// AI 提示词与结果校验。服务端 apps/server/src/main/resources/prompts/*.txt 是同一份文本，修改时两边同步。

export type ExerciseKind = "cloze" | "usage" | "mistake";

export interface Exercise {
  word: string;
  kind: ExerciseKind;
  prompt: string;
  answer: string;
  explanation: string;
}

import type { Example, Lang, QwertyEntry } from "./types.ts";

export const EXERCISES_PROMPT = `你是一名语言老师，为学习者生成用于“打字练习”的例句题目。

输入是一个 JSON 对象：
- lang：目标语言代码（如 en、ja），题目中的句子必须使用该语言；
- locale：学习者的母语界面语言（如 zh-CN），explanation 必须使用该语言；
- words：需要练习的单词列表。

为每个单词生成 1 道题，kind 从以下三种中选择（尽量混合使用）：
- cloze：给出一个自然、地道的例句，把目标词替换为 ___，answer 为被挖掉的词（使用句中实际出现的形式）；
- usage：prompt 用 locale 语言描述一个情境，要求学习者用目标词写一句话，answer 为一个参考句子；
- mistake：prompt 为一个包含该词典型误用的句子，answer 为改正后的完整句子。

要求：
- 句子长度适中（8～20 个词），贴近日常或职场场景，避免生僻内容；
- explanation 简短（不超过 40 字），说明词义或用法要点；
- 只输出 JSON，不要输出任何其他文字。

输出格式：
{"exercises":[{"word":"...","kind":"cloze|usage|mistake","prompt":"...","answer":"...","explanation":"..."}]}`;

export const EXAMPLES_PROMPT = `你是一名语言老师，为刚背完一个单词的学习者提供例句。

输入是一个 JSON 对象：
- lang：目标语言代码（如 en、ja），例句必须使用该语言；
- locale：学习者的母语界面语言（如 zh-CN），translation 必须使用该语言；
- word：目标单词（日语可能是罗马音，请换成自然的日文写法）。

生成 3 个例句：
- 覆盖该词最常见的 2～3 种含义或搭配；
- 句子自然地道，8～20 个词，贴近日常、学习或职场场景；
- translation 为对应的母语翻译。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"examples":[{"sentence":"...","translation":"..."}]}`;

export const ANALYZE_PROMPT = `你是一名词典编辑，帮语言学习者把他们遇到的单词整理进个人词库。

输入是一个 JSON 对象：
- lang：单词所属语言（en 或 ja）；
- locale：学习者的母语界面语言（如 zh-CN），meanings 与 exampleTrans 必须使用该语言；
- words：学习者选中的单词或短语（可能是变形，如 running、went、食べた）；
- context：可选，单词所在的原句。

对每个输入返回一条：
- input：原样返回输入；
- word：词典原形。英文为小写原形（专有名词、缩写保留大小写）；日语为常用写法（有汉字用汉字）；
- reading：仅日语，word 的平假名读音；英文为空字符串；
- romaji：仅日语，reading 的平文式（Hepburn）罗马音，长音写成 ou / uu 等，小写无空格；英文为空字符串；
- phonetic：仅英文，美式国际音标，不带斜杠；日语为空字符串；
- meanings：1～3 条释义，每条以词性开头（n. / v. / adj. / adv. / phr.）；如果提供了 context，第一条必须是该语境下的意思；
- example：一个自然的例句。如果提供了 context，直接使用 context 原句；
- exampleTrans：example 的翻译。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"words":[{"input":"...","word":"...","reading":"","romaji":"","phonetic":"...","meanings":["..."],"example":"...","exampleTrans":"..."}]}`;

export const EXPAND_PROMPT = `你是一名职业英语教练，为某个职业的从业者扩充专业词汇表。

输入是一个 JSON 对象：
- role：职业名称与说明；
- locale：学习者的母语界面语言（如 zh-CN），trans 与 exampleTrans 必须使用该语言；
- count：需要生成的词条数量；
- exclude：词表中已有的词条，生成结果不能与其重复（忽略大小写）。

要求：
- 选择该职业日常工作中真正高频、实用的英文术语或固定短语（最多 3 个词），避免人人都会的基础词和品牌名；
- name 只能包含字母、空格、连字符和撇号；
- trans 为 1～2 条释义，每条以词性开头（n. / v. / adj. / adv. / phr.）；
- usphone 为美式国际音标，不带斜杠；
- example 为一个 8～18 个词的职场例句，exampleTrans 为其翻译。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"words":[{"name":"...","trans":["..."],"usphone":"...","example":"...","exampleTrans":"..."}]}`;

export const SCENARIO_QUESTION_PROMPT = `你是一名资深的职场英语教练，为某个职业的学习者出一道“场景问答”题，让他们用英语解释、论证和阐述，练习灵活运用词汇、短语与高级语法。

输入是一个 JSON 对象：
- role：学习者的职业与说明；
- locale：学习者的母语界面语言（如 zh-CN），所有 *Trans、keyPoints、meaning 字段使用该语言；
- level：intermediate 或 advanced；
- targetWords：学习者最近学过或容易出错的单词，每项含 word、meaning、tag（today 今日学习 / weak 易错 / review 已学待巩固）；
- avoidTitles：最近做过的题目标题，新题不要重复这些场景。

出题要求：
- 场景必须真实、具体，贴近该职业的日常工作，例如：向新同事解释某个设计 / 接口 / 模块的作用，说明你为什么这样设计、权衡了什么，阐述技术架构中各部分的职责与关系，在评审会上为方案辩护，复盘一次线上事故等；按职业调整场景类型；
- scenario 用英文写 60～120 词的情境描述，给出足够的背景细节（产品、约束、听众是谁）；question 用英文提出开放式问题，要求解释 what / why / how 与各部分关系，鼓励发散；
- keyPoints 给出 3～5 个回答可以覆盖的要点（不要写成范文）；
- recommendedWords 给出 8～12 个推荐使用的单词或短语：优先从 targetWords 中挑选能自然用进本题的（并原样保留其 tag），再补充少量本场景下地道、进阶的表达（tag 为 new）；usage 给一个适合本题的搭配示例；
- phrases 给出 4～6 个有用的短语或句式（如 strike a balance between, at the expense of）；
- grammar 给出 2～3 个可以尝试的高级语法结构（如倒装、分词状语、虚拟语气、强调句、非限制性定语从句），每个附一个贴合本题的例句。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"title":"...","scenario":"...","scenarioTrans":"...","question":"...","questionTrans":"...","keyPoints":["..."],"recommendedWords":[{"word":"...","meaning":"...","usage":"...","tag":"today|weak|review|new"}],"phrases":[{"phrase":"...","meaning":"..."}],"grammar":[{"pattern":"...","example":"...","meaning":"..."}]}`;

export const SCENARIO_REVIEW_PROMPT = `你是一名严格又鼓励人的职场英语教练，点评学习者对一道“场景问答”题的英文回答。

输入是一个 JSON 对象：
- role：学习者的职业；
- locale：学习者的母语界面语言（如 zh-CN），summary、strengths、notes、missedPoints、meaning 等说明性字段使用该语言；
- scenario、question、keyPoints：题目；
- recommendedWords：题目推荐使用的词；
- answer：学习者的回答。

点评要求：
- 按原文顺序把 answer 拆成句子，逐句给出 improved（更地道、更精确、语法更高级的改写，保留原意；原句已经很好时可以只做微调或保持不变）和 notes（指出问题与改写理由，具体到用词、搭配、语法结构）；tags 从 grammar、word-choice、collocation、clarity、style、good 中选择；
- original 必须逐字取自 answer，不要改动；
- usedWords 列出 recommendedWords 中被正确使用的词；misusedWords 列出用错的词及原因；
- missedPoints 列出回答中缺失或论证不足的要点；
- scores 四项各 0～10：content（内容与论证）、vocabulary（词汇丰富与准确）、grammar（语法正确与多样）、coherence（逻辑与衔接）；score 为 0～100 的总分；
- modelAnswer 写一篇 120～200 词的参考回答，自然地用上多数推荐词与至少一个高级语法结构；
- newWords 从 improved 与 modelAnswer 中挑 3～6 个值得学习、学习者没用到的词或短语。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"score":0,"scores":{"content":0,"vocabulary":0,"grammar":0,"coherence":0},"summary":"...","strengths":["..."],"sentences":[{"original":"...","improved":"...","notes":"...","tags":["..."]}],"usedWords":["..."],"misusedWords":[{"word":"...","note":"..."}],"missedPoints":["..."],"modelAnswer":"...","newWords":[{"word":"...","meaning":"..."}]}`;

/** 服务端 /api/ai/complete 支持的任务（与 prompts/*.txt 文件名一致） */
export type AiTask = "sentence-exercises" | "word-examples" | "analyze-words" | "expand-dict" | "scenario-question" | "scenario-review";

export const AI_PROMPTS: Record<AiTask, string> = {
  "sentence-exercises": EXERCISES_PROMPT,
  "word-examples": EXAMPLES_PROMPT,
  "analyze-words": ANALYZE_PROMPT,
  "expand-dict": EXPAND_PROMPT,
  "scenario-question": SCENARIO_QUESTION_PROMPT,
  "scenario-review": SCENARIO_REVIEW_PROMPT,
};

const KINDS = new Set<string>(["cloze", "usage", "mistake"]);

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function items(content: string, key: string): Record<string, unknown>[] {
  let root: unknown;
  try {
    // 有些模型会包一层 ```json 代码块
    root = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, ""));
  } catch {
    throw new Error("AI 返回内容无法解析");
  }
  const list = (root as Record<string, unknown>)?.[key];
  return Array.isArray(list) ? (list as Record<string, unknown>[]) : [];
}

export function parseExercises(content: string): Exercise[] {
  const out = items(content, "exercises")
    .map((n) => ({ word: str(n.word), kind: str(n.kind) as ExerciseKind, prompt: str(n.prompt), answer: str(n.answer), explanation: str(n.explanation) }))
    .filter((e) => e.word && KINDS.has(e.kind) && e.prompt && e.answer);
  if (!out.length) throw new Error("AI 未返回有效题目");
  return out;
}

export function parseExamples(content: string): Example[] {
  const out = items(content, "examples")
    .map((n) => ({ sentence: str(n.sentence), translation: str(n.translation) }))
    .filter((e) => e.sentence);
  if (!out.length) throw new Error("AI 未返回有效例句");
  return out;
}

export interface AnalyzedWord {
  input: string;
  word: string;
  reading: string;
  romaji: string;
  phonetic: string;
  meanings: string[];
  example: string;
  exampleTrans: string;
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : str(v) ? [str(v)] : [];
}

export function parseAnalysis(content: string, lang: Lang): AnalyzedWord[] {
  const out = items(content, "words")
    .map((n) => ({
      input: str(n.input),
      word: str(n.word),
      reading: str(n.reading),
      romaji: str(n.romaji).toLowerCase().replace(/[^a-z' -]/g, ""),
      phonetic: str(n.phonetic).replace(/^[/[]|[/\]]$/g, ""),
      meanings: strList(n.meanings),
      example: str(n.example),
      exampleTrans: str(n.exampleTrans),
    }))
    .filter((w) => w.word && w.meanings.length && (lang === "en" || w.romaji));
  if (!out.length) throw new Error("AI 未返回有效的单词信息");
  return out;
}

const TERM_RE = /^[A-Za-z][A-Za-z '-]*$/;

/** 解析 AI 扩充的职业词条，过滤格式不对或与已有词重复的 */
export function parseExpansion(content: string, exclude: Iterable<string>): QwertyEntry[] {
  const seen = new Set([...exclude].map((n) => n.toLowerCase()));
  const out: QwertyEntry[] = [];
  for (const n of items(content, "words")) {
    const name = str(n.name).replace(/\s+/g, " ");
    if (!TERM_RE.test(name) || name.split(" ").length > 3 || seen.has(name.toLowerCase())) continue;
    const trans = strList(n.trans);
    if (!trans.length) continue;
    seen.add(name.toLowerCase());
    out.push({ name, trans, usphone: str(n.usphone).replace(/^[/[]|[/\]]$/g, ""), example: str(n.example), exampleTrans: str(n.exampleTrans) });
  }
  if (!out.length) throw new Error("AI 未返回新的词条");
  return out;
}

export type WordTag = "today" | "weak" | "review" | "new";

export interface Scenario {
  title: string;
  scenario: string;
  scenarioTrans: string;
  question: string;
  questionTrans: string;
  keyPoints: string[];
  recommendedWords: { word: string; meaning: string; usage: string; tag: WordTag }[];
  phrases: { phrase: string; meaning: string }[];
  grammar: { pattern: string; example: string; meaning: string }[];
}

export type SentenceTag = "grammar" | "word-choice" | "collocation" | "clarity" | "style" | "good";

export interface ScenarioReview {
  score: number;
  scores: { content: number; vocabulary: number; grammar: number; coherence: number };
  summary: string;
  strengths: string[];
  sentences: { original: string; improved: string; notes: string; tags: SentenceTag[] }[];
  usedWords: string[];
  misusedWords: { word: string; note: string }[];
  missedPoints: string[];
  modelAnswer: string;
  newWords: { word: string; meaning: string }[];
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function objList(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.map(obj) : [];
}

function num(v: unknown, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : 0;
}

function parseRoot(content: string): Record<string, unknown> {
  try {
    return obj(JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "")));
  } catch {
    throw new Error("AI 返回内容无法解析");
  }
}

const WORD_TAGS = new Set(["today", "weak", "review", "new"]);
const SENTENCE_TAGS = new Set(["grammar", "word-choice", "collocation", "clarity", "style", "good"]);

export function parseScenario(content: string): Scenario {
  const r = parseRoot(content);
  const s: Scenario = {
    title: str(r.title),
    scenario: str(r.scenario),
    scenarioTrans: str(r.scenarioTrans),
    question: str(r.question),
    questionTrans: str(r.questionTrans),
    keyPoints: strList(r.keyPoints),
    recommendedWords: objList(r.recommendedWords)
      .map((n) => ({ word: str(n.word), meaning: str(n.meaning), usage: str(n.usage), tag: (WORD_TAGS.has(str(n.tag)) ? str(n.tag) : "new") as WordTag }))
      .filter((w) => w.word),
    phrases: objList(r.phrases).map((n) => ({ phrase: str(n.phrase), meaning: str(n.meaning) })).filter((p) => p.phrase),
    grammar: objList(r.grammar).map((n) => ({ pattern: str(n.pattern), example: str(n.example), meaning: str(n.meaning) })).filter((g) => g.pattern),
  };
  if (!s.scenario || !s.question) throw new Error("AI 未返回有效的场景题");
  return s;
}

export function parseScenarioReview(content: string): ScenarioReview {
  const r = parseRoot(content);
  const scores = obj(r.scores);
  const review: ScenarioReview = {
    score: num(r.score, 100),
    scores: { content: num(scores.content, 10), vocabulary: num(scores.vocabulary, 10), grammar: num(scores.grammar, 10), coherence: num(scores.coherence, 10) },
    summary: str(r.summary),
    strengths: strList(r.strengths),
    sentences: objList(r.sentences)
      .map((n) => ({
        original: str(n.original),
        improved: str(n.improved),
        notes: str(n.notes),
        tags: strList(n.tags).filter((t) => SENTENCE_TAGS.has(t)) as SentenceTag[],
      }))
      .filter((x) => x.original),
    usedWords: strList(r.usedWords),
    misusedWords: objList(r.misusedWords).map((n) => ({ word: str(n.word), note: str(n.note) })).filter((m) => m.word),
    missedPoints: strList(r.missedPoints),
    modelAnswer: str(r.modelAnswer),
    newWords: objList(r.newWords).map((n) => ({ word: str(n.word), meaning: str(n.meaning) })).filter((w) => w.word),
  };
  if (!review.sentences.length && !review.summary) throw new Error("AI 未返回有效的点评");
  return review;
}

/** 推荐词是否已出现在回答中（忽略大小写，允许常见词形变化：-s / -ed / -ing / -ly 等） */
export function usesWord(answer: string, word: string): boolean {
  const text = answer.toLowerCase();
  const w = word.toLowerCase().trim();
  if (!w) return false;
  const stem = w.length > 4 ? w.replace(/(ing|ed|es|ly|e|y|s)$/, "") : w;
  const re = new RegExp(`(^|[^a-z])${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")}[a-z]{0,4}($|[^a-z])`);
  return re.test(text);
}

/** 常见的 OpenAI 兼容服务（均已确认允许浏览器跨域调用）；默认选各家便宜且快的模型 */
export const AI_PRESETS = [
  { id: "qwen-maas", name: "千问（maas.qianwenaiapi.com）", baseUrl: "https://maas.qianwenaiapi.com/compatible-mode/v1", model: "qwen-flash" },
  { id: "qwen", name: "通义千问（阿里云百炼）", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-flash" },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  { id: "zhipu", name: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  { id: "moonshot", name: "Moonshot", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
] as const;

/** 千问 3 系列混合推理模型默认可能开启思考，出题 / 点评不需要，关闭可大幅提速 */
export function isQwenEndpoint(baseUrl: string): boolean {
  return /qianwen|dashscope|aliyuncs/i.test(baseUrl);
}

/** 从模型列表里挑一个又快又便宜的：flash > turbo > mini / lite > plus，排除视觉、语音、向量等专用模型 */
export function pickFastModel(models: string[]): string | undefined {
  const text = models.filter((m) => !/(vl|omni|audio|tts|asr|embed|image|coder|math|ocr|rerank|realtime|thinking)/i.test(m));
  const rank = (m: string) => {
    const base = /flash/i.test(m) ? 0 : /turbo/i.test(m) ? 1 : /(mini|lite|nano|air)/i.test(m) ? 2 : /plus/i.test(m) ? 3 : 4;
    // 同档优先不带日期快照的别名（如 qwen-flash 而不是 qwen-flash-2025-07-28）
    return base * 10 + (/\d{4}-\d{2}-\d{2}|\d{8}/.test(m) ? 1 : 0);
  };
  return [...text].sort((a, b) => rank(a) - rank(b) || a.length - b.length)[0];
}
