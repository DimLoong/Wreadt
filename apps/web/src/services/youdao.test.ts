import { beforeEach, describe, expect, it, vi } from "vitest";
import { getYoudaoPronounceUrl, playAudio, preloadAudio } from "./youdao";

class MockAudio {
  public preload = "";

  public src: string;

  constructor(src: string) {
    this.src = src;
  }

  play = vi.fn().mockResolvedValue(undefined);
}

describe("youdao service", () => {
  beforeEach(() => {
    vi.stubGlobal("Audio", MockAudio);
  });

  it("构建英文发音 URL", () => {
    const url = getYoudaoPronounceUrl("hello world", "en");
    expect(url).toContain("audio=hello%20world");
    expect(url).toContain("le=en");
  });

  it("构建日文发音 URL", () => {
    const url = getYoudaoPronounceUrl("こんにちは", "ja");
    expect(url).toContain("le=ja");
  });

  it("预加载音频时会命中缓存", async () => {
    const first = await preloadAudio("hello", "en");
    const second = await preloadAudio("hello", "en");

    expect(first).toBe(second);
  });

  it("播放音频会调用 audio.play", async () => {
    const audio = (await preloadAudio("world", "en")) as unknown as MockAudio;

    await playAudio("world", "en");

    expect(audio.play).toHaveBeenCalledTimes(1);
  });
});
