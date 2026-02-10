import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTypingMachine } from "./useTypingMachine";
import { baseVocabularyByLang } from "../data/vocabulary";

vi.mock("../services/youdao", () => ({
  preloadAudio: vi.fn().mockResolvedValue(undefined),
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

describe("E) 打字主流程不回退门禁", () => {
  it("进入单词完成态后，继续输入不应回退到 Typing 态", () => {
    vi.useFakeTimers();
    const words = baseVocabularyByLang.en;
    const { result } = renderHook(() => useTypingMachine({ words, batchSize: 99 }));

    act(() => {
      result.current.setInput(words[0].text);
    });

    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(result.current.state).toBe("STATE-03-WordCompleted");

    const completedWordId = result.current.currentWord.id;
    act(() => {
      result.current.setInput(`${words[0].text}x`);
    });

    expect(result.current.state).not.toBe("STATE-01-Typing");
    expect(result.current.currentWord.id).toBe(completedWordId);
    vi.useRealTimers();
  });
});
