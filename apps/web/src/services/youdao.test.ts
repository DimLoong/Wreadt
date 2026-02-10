import { describe, expect, it } from "vitest";
import { getYoudaoPronounceUrl } from "./youdao";

describe("youdao service", () => {
  it("构建英文发音 URL", () => {
    const url = getYoudaoPronounceUrl("hello world", "en");
    expect(url).toContain("audio=hello%20world");
    expect(url).toContain("le=en");
  });

  it("构建日文发音 URL", () => {
    const url = getYoudaoPronounceUrl("こんにちは", "ja");
    expect(url).toContain("le=ja");
  });
});
