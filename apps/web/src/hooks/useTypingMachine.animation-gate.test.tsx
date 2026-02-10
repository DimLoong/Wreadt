import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTypingMachine } from "./useTypingMachine";

vi.mock("../services/youdao", () => ({
  preloadAudio: vi.fn().mockResolvedValue(undefined),
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

describe("单元完成动画触发与 skip 行为门禁", () => {
  it("批次完成触发动画，skip 后 200ms 内关闭且仅推进一个词", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTypingMachine({ batchSize: 1 }));

    const firstWordId = result.current.currentWord.id;

    act(() => {
      result.current.setInput(result.current.currentWord.text);
    });

    expect(result.current.showBatchAnimation).toBe(true);

    act(() => {
      result.current.closeBatchAnimation();
      vi.advanceTimersByTime(200);
    });

    expect(result.current.showBatchAnimation).toBe(false);
    expect(result.current.currentWord.id).not.toBe(firstWordId);
    expect(result.current.results).toHaveLength(1);

    vi.useRealTimers();
  });
});
