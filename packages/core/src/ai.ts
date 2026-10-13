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

另外给出 3～5 个包含该词的常用短语或固定搭配：phrase 为短语原文，meaning 为母语释义（可用 ; 分隔多个译法）。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"phrases":[{"phrase":"...","meaning":"..."}],"examples":[{"sentence":"...","translation":"..."}]}`;

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

export const SCENARIO_QUESTION_PROMPT = `你是一名职场英语教练，为某个职业的学习者出一道“场景问答”题，让他们用英语解释、论证和阐述，练习灵活运用学过的单词、短语与语法。

输入是一个 JSON 对象：
- role：学习者的职业与说明；
- locale：学习者的母语界面语言（如 zh-CN），所有 *Trans、directions、keyPoints、meaning 字段使用该语言；
- level：难度，simple / medium / professional；
- targetWords：学习者最近学过或容易出错的单词，每项含 word、meaning、tag（marked 学习者主动标记、要重点掌握 / today 今日学习 / weak 易错 / review 已学待巩固）；
- avoidTitles：最近做过的题目标题，新题不要重复这些场景。

按难度出题（严格遵守长度与数量）：
- simple：一个简单、具体、常见的问题，例如“解释间距在 UI 设计中的重要性”“说明代码评审的作用”。scenario 用 1～2 句、不超过 35 个英文单词交代背景；question 是一句简短直白的英文问题；directions 给 2～3 条回答方向（如“使信息密度合理分布”“增加呼吸感”“减少认知负担”）；expectedWords 为 30～50；recommendedWords 3～5 个，优先选常用词；phrases 2 个；grammar 最多 1 个简单句式；
- medium：一个具体的工作情境，需要解释原因或做简单比较。scenario 40～70 个英文单词；directions 给 3～4 条回答方向；expectedWords 为 60～100；recommendedWords 5～8 个；phrases 3～4 个；grammar 1～2 个；
- professional：真实、深入的专业场景，例如解释某个设计 / 接口 / 模块的作用、为什么这样设计、权衡了什么、技术架构各部分的职责与关系，在评审会上为方案辩护，复盘线上事故等。scenario 60～120 个英文单词并给出足够细节；question 为开放式问题，要求解释 what / why / how 与各部分关系；directions 可以为空数组；expectedWords 为 120～200；recommendedWords 8～12 个；phrases 4～6 个；grammar 2～3 个高级结构（倒装、分词状语、虚拟语气、强调句、非限制性定语从句等）。

通用要求：
- 场景贴近该职业的日常工作，题目用英文，难度要与 level 匹配，simple 不要出得太专业；
- keyPoints 给出回答可以覆盖的要点（simple 2 条、medium 3 条、professional 3～5 条），不要写成范文；
- recommendedWords：优先从 targetWords 中挑选能自然用进本题的（原样保留其 tag，marked 的词最优先，尽量设计让它们自然出现的场景），再补充本场景下地道的表达（tag 为 new）；usage 给一个适合本题的搭配示例；
- phrases 为有用的短语或句式；grammar 每个附一个贴合本题的例句。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"title":"...","scenario":"...","scenarioTrans":"...","question":"...","questionTrans":"...","directions":["..."],"expectedWords":40,"keyPoints":["..."],"recommendedWords":[{"word":"...","meaning":"...","usage":"...","tag":"marked|today|weak|review|new"}],"phrases":[{"phrase":"...","meaning":"..."}],"grammar":[{"pattern":"...","example":"...","meaning":"..."}]}`;

export const SCENARIO_REVIEW_PROMPT = `你是一名严格又鼓励人的职场英语教练，点评学习者对一道“场景问答”题的英文回答。

输入是一个 JSON 对象：
- role：学习者的职业；
- locale：学习者的母语界面语言（如 zh-CN），summary、strengths、notes、missedPoints、meaning 等说明性字段使用该语言；
- level：题目难度，simple / medium / professional；
- expectedWords：题目期望的回答长度（英文单词数）；
- scenario、question、directions、keyPoints：题目；
- recommendedWords：题目推荐使用的词；
- answer：学习者的回答。

点评要求：
- 按原文顺序把 answer 拆成句子，逐句给出 improved（更地道、更精确的改写，保留原意；原句已经很好时可以只做微调或保持不变）和 notes（指出问题与改写理由，具体到用词、搭配、语法结构）；tags 从 grammar、word-choice、collocation、clarity、style、good 中选择；
- 改写的难度与 level 匹配：simple 只修正错误、换用更自然的常用表达，不要改成复杂长句；medium 可适当升级用词与句式；professional 可使用高级语法与专业表达；
- original 必须逐字取自 answer，不要改动；
- usedWords 列出 recommendedWords 中被正确使用的词；misusedWords 列出用错的词及原因；
- missedPoints 列出回答中缺失或论证不足的要点（simple 最多 2 条）；
- scores 四项各 0～10：content（内容与论证）、vocabulary（词汇丰富与准确）、grammar（语法正确与多样）、coherence（逻辑与衔接），评分标准按 level 调整，不要用专业级标准要求 simple 题；score 为 0～100 的总分；
- modelAnswer 写一篇长度接近 expectedWords 的参考回答，难度与 level 匹配，自然地用上多数推荐词；
- newWords 从 improved 与 modelAnswer 中挑 2～6 个值得学习、学习者没用到的词或短语（simple 2～3 个）。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"score":0,"scores":{"content":0,"vocabulary":0,"grammar":0,"coherence":0},"summary":"...","strengths":["..."],"sentences":[{"original":"...","improved":"...","notes":"...","tags":["..."]}],"usedWords":["..."],"misusedWords":[{"word":"...","note":"..."}],"missedPoints":["..."],"modelAnswer":"...","newWords":[{"word":"...","meaning":"..."}]}`;

export const FEED_PROMPT = `你是一个语言学习社区的内容编辑，为学习者挑选有意思、可以参与讨论的话题，帮助他们在真实语境中复习最近学过的词。

输入是一个 JSON 对象：
- role：学习者的职业或方向（可能是“通用职场”）；
- locale：学习者的母语界面语言（如 zh-CN），所有 *Trans 与 stance 字段使用该语言；
- words：学习者最近学过或标记的词，每项含 word 与 meaning；
- count：需要的话题数量；
- avoidTopics：最近推送过的话题，不要重复。

要求：
- 每个话题是一个轻松、有观点碰撞的讨论问题，贴近该职业或日常生活（例如“发布时带着已知小 bug 可以接受吗？”“远程办公让沟通更高效还是更低效？”），不要太专业、不要考试腔；
- topic 用英文提出问题（不超过 15 个词）；context 用 1～2 句英文交代背景；
- 每个话题给 2 个示范回复，代表不同立场或角度（stance 用简短的母语标签，如“赞成”“反对”“补充一个角度”）；author 为简短的英文身份描述（如 "A PM at a fintech startup"）；
- 每个回复 40～70 个英文单词，口语自然，像真实社区回复；每个回复自然地用上 words 中的 2～3 个词或包含它们的短语，usedWords 列出该话题两条回复中实际用到的 words 原词；
- 不同话题尽量覆盖不同的词。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"items":[{"topic":"...","topicTrans":"...","context":"...","contextTrans":"...","replies":[{"author":"...","stance":"...","text":"...","textTrans":"..."}],"usedWords":["..."]}]}`;

export const CONFUSABLE_PROMPT = `你是一名语言老师，帮学习者分清容易混淆的词。

输入是一个 JSON 对象：
- lang：目标语言代码（如 en、ja）；
- locale：学习者的母语界面语言（如 zh-CN），explanation 使用该语言；
- words：学习者标记为“易混”的词，每项含 word 与 meaning。

要求：
- 为每个输入词找出最常与它混淆的 1～2 个词（拼写相近、意思相近或用法易错，如 affect / effect、complement / compliment、economic / economical）；如果输入里已有互相易混的词，把它们放在同一组；
- 每组给出 explanation：简明对比各词的含义、词性与用法区别（不超过 80 字）；
- 每组出 2～3 道选择填空题：sentence 为挖空（用 ___ 表示）的自然例句，options 为该组的词，answer 为正确选项（必须是 options 之一），explanation 一句话说明为什么；
- 句子 8～20 个词，贴近日常或职场。

只输出 JSON，不要输出任何其他文字。

输出格式：
{"groups":[{"words":["...","..."],"explanation":"...","items":[{"sentence":"...","options":["...","..."],"answer":"...","explanation":"..."}]}]}`;

/** 服务端 /api/ai/complete 支持的任务（与 prompts/*.txt 文件名一致） */
export type AiTask =
  | "sentence-exercises"
  | "word-examples"
  | "analyze-words"
  | "expand-dict"
  | "scenario-question"
  | "scenario-review"
  | "confusable-quiz"
  | "interest-feed";

export const AI_PROMPTS: Record<AiTask, string> = {
  "sentence-exercises": EXERCISES_PROMPT,
  "word-examples": EXAMPLES_PROMPT,
  "analyze-words": ANALYZE_PROMPT,
  "expand-dict": EXPAND_PROMPT,
  "scenario-question": SCENARIO_QUESTION_PROMPT,
  "scenario-review": SCENARIO_REVIEW_PROMPT,
  "confusable-quiz": CONFUSABLE_PROMPT,
  "interest-feed": FEED_PROMPT,
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

export interface Phrase {
  phrase: string;
  meaning: string;
}

/** 例句接口同时返回的常用短语（旧版输出没有时为空） */
export function parsePhrases(content: string): Phrase[] {
  return items(content, "phrases")
    .map((n) => ({ phrase: str(n.phrase), meaning: str(n.meaning) }))
    .filter((p) => p.phrase);
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

export type WordTag = "marked" | "today" | "weak" | "review" | "new";

export type ScenarioLevel = "simple" | "medium" | "professional";

/** 各难度默认的期望回答长度（AI 未给出时使用）与最少提交词数 */
export const SCENARIO_LEVELS: Record<ScenarioLevel, { expectedWords: number; minWords: number }> = {
  simple: { expectedWords: 40, minWords: 10 },
  medium: { expectedWords: 80, minWords: 25 },
  professional: { expectedWords: 150, minWords: 50 },
};

export interface Scenario {
  level: ScenarioLevel;
  title: string;
  scenario: string;
  scenarioTrans: string;
  question: string;
  questionTrans: string;
  /** 回答方向提示（简单 / 中等难度） */
  directions: string[];
  expectedWords: number;
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

const WORD_TAGS = new Set(["marked", "today", "weak", "review", "new"]);
const SENTENCE_TAGS = new Set(["grammar", "word-choice", "collocation", "clarity", "style", "good"]);

export function parseScenario(content: string, level: ScenarioLevel = "professional"): Scenario {
  const r = parseRoot(content);
  const expected = num(r.expectedWords, 400);
  const s: Scenario = {
    level,
    title: str(r.title),
    scenario: str(r.scenario),
    scenarioTrans: str(r.scenarioTrans),
    question: str(r.question),
    questionTrans: str(r.questionTrans),
    directions: strList(r.directions),
    expectedWords: expected >= 10 ? expected : SCENARIO_LEVELS[level].expectedWords,
    keyPoints: strList(r.keyPoints),
    recommendedWords: objList(r.recommendedWords)
      .map((n) => ({ word: str(n.word), meaning: str(n.meaning), usage: str(n.usage), tag: (WORD_TAGS.has(str(n.tag)) ? str(n.tag) : "new") as WordTag }))
      .filter((w) => w.word),
    phrases: objList(r.phrases).map((n) => ({ phrase: str(n.phrase), meaning: str(n.meaning) })).filter((p) => p.phrase),
    grammar: objList(r.grammar).map((n) => ({ pattern: str(n.pattern), example: str(n.example), meaning: str(n.meaning) })).filter((g) => g.pattern),
  };
  // 简单题可能只有问题、没有背景描述
  if (!s.question) throw new Error("AI 未返回有效的场景题");
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

export interface ConfusableGroup {
  words: string[];
  explanation: string;
  items: { sentence: string; options: string[]; answer: string; explanation: string }[];
}

/** 易混词辨析题：答案必须是选项之一 */
export function parseConfusable(content: string): ConfusableGroup[] {
  const groups = objList(parseRoot(content).groups)
    .map((g) => ({
      words: strList(g.words),
      explanation: str(g.explanation),
      items: objList(g.items)
        .map((it) => ({ sentence: str(it.sentence), options: strList(it.options), answer: str(it.answer), explanation: str(it.explanation) }))
        .filter((it) => it.sentence && it.options.length >= 2 && it.options.includes(it.answer)),
    }))
    .filter((g) => g.words.length >= 2 && g.items.length);
  if (!groups.length) throw new Error("AI 未返回有效的辨析题");
  return groups;
}

export interface FeedReply {
  author: string;
  stance: string;
  text: string;
  textTrans: string;
}

/** 学习兴趣流的一条：讨论话题 + 两个示范回复 */
export interface FeedItem {
  topic: string;
  topicTrans: string;
  context: string;
  contextTrans: string;
  replies: FeedReply[];
  usedWords: string[];
}

export function parseFeed(content: string): FeedItem[] {
  const items = objList(parseRoot(content).items)
    .map((n) => ({
      topic: str(n.topic),
      topicTrans: str(n.topicTrans),
      context: str(n.context),
      contextTrans: str(n.contextTrans),
      replies: objList(n.replies)
        .map((r) => ({ author: str(r.author), stance: str(r.stance), text: str(r.text), textTrans: str(r.textTrans) }))
        .filter((r) => r.text),
      usedWords: strList(n.usedWords),
    }))
    .filter((it) => it.topic && it.replies.length);
  if (!items.length) throw new Error("AI 未返回有效的话题");
  return items;
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
  const text = models.filter((m) => !/(vl|omni|audio|tts|asr|embed|image|coder|math|ocr|rerank|realtime|thinking|mt-|translate|character|speech|s2s)/i.test(m));
  const rank = (m: string) => {
    const base = /flash/i.test(m) ? 0 : /turbo/i.test(m) ? 1 : /(mini|lite|nano|air)/i.test(m) ? 2 : /plus/i.test(m) ? 3 : 4;
    // 同档优先不带日期快照的别名（如 qwen-flash 而不是 qwen-flash-2025-07-28）
    return base * 10 + (/\d{4}-\d{2}-\d{2}|\d{8}/.test(m) ? 1 : 0);
  };
  return [...text].sort((a, b) => rank(a) - rank(b) || a.length - b.length)[0];
}
