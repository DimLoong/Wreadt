import { EXAMPLES_PROMPT, EXERCISES_PROMPT, parseExamples, parseExercises, type Example, type Exercise, type Lang } from "@wreadt/core";
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
      }),
    });
  } catch {
    throw new Error("无法连接 AI 服务，请检查接口地址与网络");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message ?? body?.message ?? res.statusText;
    throw new Error(res.status === 401 ? `API Key 无效：${msg}` : `AI 服务出错（${res.status}）：${msg}`);
  }
  return body?.choices?.[0]?.message?.content ?? "";
}

async function run<T>(
  system: string,
  input: Record<string, unknown>,
  serverPath: string,
  parse: (content: string) => T,
  pick: (body: never) => T,
): Promise<T> {
  const cfg = await getAiConfig();
  if (cfg?.apiKey) return parse(await chatDirect(cfg, system, JSON.stringify(input)));
  if (await getSession()) {
    try {
      return pick(await authed<never>(serverPath, { method: "POST", json: input }));
    } catch (err) {
      if (err instanceof ApiError && err.code === "AI_DISABLED") throw new AiUnavailableError(err.message);
      throw err;
    }
  }
  throw new AiUnavailableError("未配置 AI");
}

export function generateExercises(lang: Lang, words: string[], locale: string): Promise<Exercise[]> {
  return run(EXERCISES_PROMPT, { lang, locale, words }, "/ai/sentence-exercises", parseExercises, (b: { exercises: Exercise[] }) => b.exercises);
}

export function generateExamples(lang: Lang, word: string, locale: string): Promise<Example[]> {
  return run(EXAMPLES_PROMPT, { lang, locale, word }, "/ai/word-examples", parseExamples, (b: { examples: Example[] }) => b.examples);
}
