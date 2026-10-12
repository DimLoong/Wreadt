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

/** 服务端 /api/ai/complete 支持的任务（与 prompts/*.txt 文件名一致） */
export type AiTask = "sentence-exercises" | "word-examples" | "analyze-words" | "expand-dict";

export const AI_PROMPTS: Record<AiTask, string> = {
  "sentence-exercises": EXERCISES_PROMPT,
  "word-examples": EXAMPLES_PROMPT,
  "analyze-words": ANALYZE_PROMPT,
  "expand-dict": EXPAND_PROMPT,
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

/** 常见的 OpenAI 兼容服务（均已确认允许浏览器跨域调用） */
export const AI_PRESETS = [
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  { id: "qwen", name: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  { id: "zhipu", name: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  { id: "moonshot", name: "Moonshot", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
] as const;
