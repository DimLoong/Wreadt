import {
  AI_PROMPTS,
  isQwenEndpoint,
  parseAnalysis,
  parseExamples,
  parseExercises,
  parseExpansion,
  type AiTask,
  type AnalyzedWord,
  type DictMeta,
  type Example,
  type Exercise,
  type Lang,
  type QwertyEntry,
  type Scenario,
  type ScenarioReview,
  parseScenario,
  parseScenarioReview,
} from "@wreadt/core";
import { getMeta, setMeta } from "../store/repo";
import { ApiError, authed, getSession } from "./api";

/** 用户自填的模型服务（只存本机 meta 表，不参与同步） */
export interface AiConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const AI_CONFIG_KEY = "aiConfig";
export const getAiConfig = () => getMeta<AiConfig>(AI_CONFIG_KEY);
export const saveAiConfig = (cfg: AiConfig | null) => setMeta(AI_CONFIG_KEY, cfg);

export type AiSource = "own" | "server" | null;

/** 优先用自己的 Key（不登录也可用），否则登录后走服务端 */
export async function aiSource(): Promise<AiSource> {
  if ((await getAiConfig())?.apiKey) return "own";
  if (await getSession()) return "server";
  return null;
}

export class AiUnavailableError extends Error {}

/** 浏览器直连 OpenAI 兼容接口 */
export async function chatDirect(cfg: AiConfig, system: string, user: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        ...(isQwenEndpoint(cfg.baseUrl) ? { enable_thinking: false } : {}),
      }),
    });
  } catch {
    throw new Error("无法连接 AI 服务，请检查接口地址与网络");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message ?? body?.message ?? res.statusText;
    if (res.status === 401) throw new Error(`API Key 无效：${msg}（Key 与接口地址需来自同一平台）`);
    if (res.status === 404 || /model/i.test(String(msg))) throw new Error(`AI 服务出错（${res.status}）：${msg}。可点“获取模型列表”选择可用模型`);
    throw new Error(`AI 服务出错（${res.status}）：${msg}`);
  }
  return body?.choices?.[0]?.message?.content ?? "";
}

/** 读取服务商的模型列表（OpenAI 兼容的 GET /models） */
export async function listModels(cfg: Pick<AiConfig, "baseUrl" | "apiKey">): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl.replace(/\/+$/, "")}/models`, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
  } catch {
    throw new Error("无法连接 AI 服务，请检查接口地址与网络");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status === 401 ? "API Key 无效或与该接口地址不匹配" : `获取模型列表失败（${res.status}）`);
  const list: unknown[] = Array.isArray(body?.data) ? body.data : [];
  return list.map((m) => (m as { id?: string })?.id).filter((id): id is string => Boolean(id)).sort();
}

/** 执行一个 AI 任务，返回模型输出的 JSON 文本；解析统一在 packages/core 中完成 */
async function runTask(task: AiTask, input: Record<string, unknown>): Promise<string> {
  const cfg = await getAiConfig();
  if (cfg?.apiKey) return chatDirect(cfg, AI_PROMPTS[task], JSON.stringify(input));
  if (await getSession()) {
    try {
      return (await authed<{ content: string }>("/ai/complete", { method: "POST", json: { task, input } })).content;
    } catch (err) {
      if (err instanceof ApiError && err.code === "AI_DISABLED") throw new AiUnavailableError(err.message);
      throw err;
    }
  }
  throw new AiUnavailableError("未配置 AI");
}

export async function generateExercises(lang: Lang, words: string[], locale: string): Promise<Exercise[]> {
  return parseExercises(await runTask("sentence-exercises", { lang, locale, words }));
}

export async function generateExamples(lang: Lang, word: string, locale: string): Promise<Example[]> {
  return parseExamples(await runTask("word-examples", { lang, locale, word }));
}

/** 分析用户输入的单词（可附原句），得到原形、读音、释义与例句 */
export async function analyzeWords(lang: Lang, words: string[], locale: string, context?: string): Promise<AnalyzedWord[]> {
  return parseAnalysis(await runTask("analyze-words", { lang, locale, words, ...(context ? { context } : {}) }), lang);
}

/** 用 AI 为职业词库生成新词条，排除已有词 */
export async function expandDict(meta: DictMeta, existing: string[], locale: string, count = 30): Promise<QwertyEntry[]> {
  const content = await runTask("expand-dict", { role: `${meta.name}：${meta.description}`, locale, count, exclude: existing });
  return parseExpansion(content, existing);
}

export interface TargetWord {
  word: string;
  meaning: string;
  tag: "today" | "weak" | "review";
}

/** 出一道职业场景问答题，优先用上学习者的今日 / 易错 / 已学词 */
export async function generateScenario(
  role: string,
  targetWords: TargetWord[],
  locale: string,
  level: "intermediate" | "advanced",
  avoidTitles: string[] = [],
): Promise<Scenario> {
  return parseScenario(await runTask("scenario-question", { role, locale, level, targetWords, avoidTitles }));
}

export async function reviewScenario(role: string, scenario: Scenario, answer: string, locale: string): Promise<ScenarioReview> {
  return parseScenarioReview(
    await runTask("scenario-review", {
      role,
      locale,
      scenario: scenario.scenario,
      question: scenario.question,
      keyPoints: scenario.keyPoints,
      recommendedWords: scenario.recommendedWords.map((w) => w.word),
      answer,
    }),
  );
}
