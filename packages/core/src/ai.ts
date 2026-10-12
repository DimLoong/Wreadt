// AI 提示词与结果校验。服务端 apps/server/src/main/resources/prompts/*.txt 是同一份文本，修改时两边同步。

export type ExerciseKind = "cloze" | "usage" | "mistake";

export interface Exercise {
  word: string;
  kind: ExerciseKind;
  prompt: string;
  answer: string;
  explanation: string;
}

export interface Example {
  sentence: string;
  translation: string;
}

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

/** 常见的 OpenAI 兼容服务（均已确认允许浏览器跨域调用） */
export const AI_PRESETS = [
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://api.deepseek.com", model: "deepseek-chat" },
  { id: "qwen", name: "通义千问", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  { id: "zhipu", name: "智谱 GLM", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  { id: "moonshot", name: "Moonshot", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
] as const;
