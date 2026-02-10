import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTypingMachine } from "./useTypingMachine";

vi.mock("../services/youdao", () => ({
  preloadAudio: vi.fn().mockResolvedValue(undefined),
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

describe("仅空格推进下一词门禁", () => {
  it("完整输入单词后不应自动跳到下一词，必须由空格触发", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTypingMachine({ batchSize: 99 }));

    const firstWord = result.current.currentWord;

    act(() => {
      result.current.setInput(firstWord.text);
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.currentWord.id).toBe(firstWord.id);

    act(() => {
      result.current.setInput(`${firstWord.text} `);
    });

    expect(result.current.currentWord.id).not.toBe(firstWord.id);
    vi.useRealTimers();
  });
});
