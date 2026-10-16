// Claude（Anthropic）：用官方 SDK 在浏览器里直接调用 Messages 接口（用户自带 Key，只存在本机）。
import Anthropic from "@anthropic-ai/sdk";

/** 支持服务端拒答回退（fallbacks: "default"）的模型 */
const FALLBACK_MODELS = /^claude-(fable-5-1|opus-5-5|opus-5|sonnet-5-5)$/;
/** 支持 output_config.effort 的模型（5 代及以上） */
const EFFORT_MODELS = /^claude-(fable|mythos|opus|sonnet|haiku)-5/;

function client(apiKey: string, baseUrl?: string) {
  // 用户在设置里填的是自己的 Key，只在本机使用，所以允许浏览器直连
  return new Anthropic({ apiKey, baseURL: baseUrl?.replace(/\/+$/, "") || undefined, dangerouslyAllowBrowser: true, maxRetries: 1 });
}

/** 把 SDK 的错误转成给用户看的说明 */
function explain(err: unknown): Error {
  if (err instanceof Anthropic.AuthenticationError) return new Error("API Key 无效：请确认填的是 Anthropic 控制台创建的 Key");
  if (err instanceof Anthropic.PermissionDeniedError) return new Error(`没有权限使用该模型：${err.message}`);
  if (err instanceof Anthropic.NotFoundError) return new Error(`模型不存在：${err.message}。可点“获取模型列表”选择可用模型`);
  if (err instanceof Anthropic.RateLimitError) return new Error("请求太频繁或额度不足，请稍后再试");
  if (err instanceof Anthropic.BadRequestError) return new Error(`请求无效：${err.message}`);
  if (err instanceof Anthropic.APIConnectionError) return new Error("无法连接 Anthropic，请检查网络（国内网络可能需要代理）");
  if (err instanceof Anthropic.APIError) return new Error(`Claude 服务出错（${err.status ?? "?"}）：${err.message}`);
  return err instanceof Error ? err : new Error(String(err));
}

/** 调用一次 Claude，返回文本（提示词要求只输出 JSON，解析由 packages/core 完成） */
export async function chatClaude(cfg: { apiKey: string; baseUrl?: string; model: string }, system: string, user: string): Promise<string> {
  try {
    const res = await client(cfg.apiKey, cfg.baseUrl).beta.messages.create({
      model: cfg.model,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: user }],
      // 出题、点评这类任务不需要深度推理，低强度更快
      ...(EFFORT_MODELS.test(cfg.model) ? { output_config: { effort: "low" as const } } : {}),
      // 被安全策略拒答时，由服务端自动换用合适的模型重试
      ...(FALLBACK_MODELS.test(cfg.model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
    if (res.stop_reason === "refusal") throw new Error("Claude 拒绝了这个请求，请换个说法或稍后再试");
    if (res.stop_reason === "max_tokens") throw new Error("Claude 的回答被截断了，请重试");
    return res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  } catch (err) {
    throw explain(err);
  }
}

/** Claude 的模型列表 */
export async function listClaudeModels(cfg: { apiKey: string; baseUrl?: string }): Promise<string[]> {
  try {
    const ids: string[] = [];
    for await (const m of client(cfg.apiKey, cfg.baseUrl).models.list()) ids.push(m.id);
    return ids;
  } catch (err) {
    throw explain(err);
  }
}
