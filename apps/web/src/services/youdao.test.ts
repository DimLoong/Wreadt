import { beforeEach, describe, expect, it, vi } from "vitest";
import { getYoudaoPronounceUrl, playAudio, preloadAudio, speechText } from "./youdao";

class MockAudio {
  public preload = "";

  public currentTime = 0;

  public src: string;

  constructor(src: string) {
    this.src = src;
  }

  play = vi.fn().mockResolvedValue(undefined);

  pause = vi.fn();
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
    const first = preloadAudio("hello", "en");
    const second = preloadAudio("hello", "en");

    expect(first).toBe(second);
  });

  it("播放音频会调用 audio.play", async () => {
    const audio = preloadAudio("world", "en") as unknown as MockAudio;

    await playAudio("world", "en");

    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("日语使用假名读音", () => {
    expect(speechText({ lang: "ja", answer: "otokonoko", reading: "おとこのこ" })).toBe("おとこのこ");
    expect(speechText({ lang: "en", answer: "cat" })).toBe("cat");
  });
});
