import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../store/db";
import { setMeta } from "../store/repo";
import { AiUnavailableError, aiSource, generateExamples, generateExercises, saveAiConfig } from "./ai";

const reply = (content: unknown) => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) });

describe("ai", () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it("未配置 Key 且未登录时不可用", async () => {
    expect(await aiSource()).toBeNull();
    await expect(generateExamples("en", "cat", "zh-CN")).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("自填 Key：浏览器直连 OpenAI 兼容接口", async () => {
    await saveAiConfig({ provider: "qwen", baseUrl: "https://example.com/v1/", apiKey: "sk-test", model: "qwen-plus" });
    const fetchMock = vi.fn().mockResolvedValue(reply({ examples: [{ sentence: "A cat sat.", translation: "一只猫坐着。" }] }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await aiSource()).toBe("own");
    expect(await generateExamples("en", "cat", "zh-CN")).toEqual([{ sentence: "A cat sat.", translation: "一只猫坐着。" }]);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://example.com/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "qwen-plus", response_format: { type: "json_object" } });
    expect(JSON.parse(body.messages[1].content)).toEqual({ lang: "en", locale: "zh-CN", word: "cat" });
  });

  it("Key 无效时给出明确提示", async () => {
    await saveAiConfig({ provider: "deepseek", baseUrl: "https://api.deepseek.com", apiKey: "bad", model: "deepseek-chat" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: "Unauthorized", json: async () => ({ error: { message: "invalid key" } }) }));
    await expect(generateExercises("en", ["cat"], "zh-CN")).rejects.toThrow("API Key 无效");
  });

  it("没有 Key 但已登录时走服务端", async () => {
    await setMeta("session", { accessToken: "a", refreshToken: "r", expiresAt: Date.now() + 600_000, user: { id: "u", email: "e", emailVerified: true } });
    const content = JSON.stringify({ exercises: [{ word: "cat", kind: "cloze", prompt: "p", answer: "cat", explanation: "" }] });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ content }) });
    vi.stubGlobal("fetch", fetchMock);
    expect(await aiSource()).toBe("server");
    expect(await generateExercises("en", ["cat"], "zh-CN")).toHaveLength(1);
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/ai/complete");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({ task: "sentence-exercises", input: { words: ["cat"] } });
  });
});

it("withJsonHint 保证提示词含小写 json", async () => {
  const { withJsonHint } = await import("./ai");
  expect(withJsonHint("只输出 JSON")).toContain("json object");
  expect(withJsonHint("reply in json")).toBe("reply in json");
});
