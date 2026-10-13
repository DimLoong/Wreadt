import { describe } from "vitest";
import { voiceScore } from "./speech";

const v = (name: string, lang = "en-US", localService = true) => ({ name, lang, localService });

it("voiceScore：神经 / 在线语音优先，趣味声音与非英文排除", () => {
  const natural = voiceScore(v("Microsoft Aria Online (Natural) - English (United States)", "en-US", false), "us");
  const google = voiceScore(v("Google US English", "en-US", false), "us");
  const samantha = voiceScore(v("Samantha"), "us");
  expect(natural).toBeGreaterThan(google);
  expect(google).toBeGreaterThan(samantha);
  expect(voiceScore(v("Zarvox"), "us")).toBe(-100);
  expect(voiceScore(v("Ting-Ting", "zh-CN"), "us")).toBe(-100);
  // 英音偏好
  expect(voiceScore(v("Daniel", "en-GB"), "uk")).toBeGreaterThan(voiceScore(v("Daniel", "en-GB"), "us"));
});

describe("云端语音", () => {
  it("自带千问 Key：直连百炼、下载时换成 https，同一句只合成一次", async () => {
    const { vi } = await import("vitest");
    const ai = await import("./ai");
    vi.spyOn(ai, "getAiConfig").mockResolvedValue({ provider: "qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", apiKey: "k", model: "qwen-flash" });
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("multimodal-generation")) return new Response(JSON.stringify({ output: { audio: { url: "http://x.oss-cn-beijing.aliyuncs.com/a.wav" } } }));
      return new Response(new Blob(["wav"], { type: "audio/wav" }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { cloudAudio, cloudSource } = await import("./speech");
    expect(await cloudSource()).toBe("own");
    const [a, b] = await Promise.all([cloudAudio("Hello there.", "Jennifer", "own"), cloudAudio("Hello there.", "Jennifer", "own")]);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]![0]).toContain("dashscope.aliyuncs.com/api/v1");
    expect(fetchMock.mock.calls[1]![0]).toBe("https://x.oss-cn-beijing.aliyuncs.com/a.wav");
    vi.unstubAllGlobals();
  });
});
