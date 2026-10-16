import { afterEach, expect, it, vi } from "vitest";
import { chatDirect } from "./ai";

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

it("ChatGPT：不发送 temperature，带上 reasoning_effort，并去掉 <think>", async () => {
  const fetchMock = vi.fn(async () => json({ choices: [{ message: { content: '<think>hmm</think>{"ok":true}' } }] }));
  vi.stubGlobal("fetch", fetchMock);
  const out = await chatDirect({ provider: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "sk-test", model: "gpt-5-mini" }, "Reply with json", "ping");
  expect(out).toBe('{"ok":true}');
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("https://api.openai.com/v1/chat/completions");
  const body = JSON.parse(String(init.body));
  expect(body.temperature).toBeUndefined();
  expect(body.reasoning_effort).toBe("minimal");
  expect(body.response_format).toEqual({ type: "json_object" });
});

it("Claude：官方 SDK 调用 /v1/messages，低推理强度 + 拒答回退，只取文字内容", async () => {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () =>
    json({
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: "claude-opus-5-5",
      content: [
        { type: "thinking", thinking: "", signature: "sig" },
        { type: "text", text: '{"ok":true}' },
      ],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 5 },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const out = await chatDirect({ provider: "anthropic", baseUrl: "https://api.anthropic.com", apiKey: "sk-ant-test", model: "claude-opus-5-5" }, "Reply with json", "ping");
  expect(out).toBe('{"ok":true}');
  const [input, init] = fetchMock.mock.calls[0]!;
  expect(String(input)).toContain("https://api.anthropic.com/v1/messages");
  const headers = new Headers(init!.headers);
  expect(headers.get("x-api-key")).toBe("sk-ant-test");
  expect(headers.get("anthropic-dangerous-direct-browser-access")).toBe("true");
  expect(headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
  const body = JSON.parse(String(init!.body));
  expect(body).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", output_config: { effort: "low" } });
  expect(body.temperature).toBeUndefined();
});

it("Claude：拒答时给出明确的错误", async () => {
  vi.stubGlobal("fetch", vi.fn(async () =>
    json({ id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: "refusal", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } }),
  ));
  await expect(chatDirect({ provider: "anthropic", baseUrl: "https://api.anthropic.com", apiKey: "k", model: "claude-opus-5-5" }, "s", "u")).rejects.toThrow("拒绝");
});
