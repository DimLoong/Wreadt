import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTypingMachine } from "./useTypingMachine";

vi.mock("../services/youdao", () => ({
  preloadAudio: vi.fn().mockResolvedValue(undefined),
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

describe("日语 romaji 输入门禁", () => {
  it("日语词条应支持 romaji 输入完成判定（きょういく -> kyouiku）", () => {
    const { result } = renderHook(() => useTypingMachine({ batchSize: 99 }));

    act(() => {
      result.current.gotoNextWord();
      result.current.gotoNextWord();
      result.current.gotoNextWord();
    });

    expect(result.current.currentWord.lang).toBe("ja");
    expect(result.current.currentWord.text).toBe("きょういく");

    const jaWordId = result.current.currentWord.id;
    const beforeCount = result.current.results.length;

    act(() => {
      result.current.setInput("kyouiku");
    });

    expect(result.current.results.length).toBe(beforeCount + 1);
    expect(result.current.results.at(-1)?.wordId).toBe(jaWordId);
  });
});
