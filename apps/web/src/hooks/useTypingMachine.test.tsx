import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useTypingMachine } from "./useTypingMachine";

vi.mock("../services/youdao", () => ({
  preloadAudio: vi.fn().mockResolvedValue(undefined),
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

describe("useTypingMachine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });

  it("首个有效输入后进入打字态并隐藏次级入口", () => {
    const { result } = renderHook(() => useTypingMachine({ batchSize: 2 }));

    expect(result.current.state).toBe("STATE-00-Idle");
    expect(result.current.firstValidKeyPressed).toBe(false);

    act(() => {
      result.current.setInput("t");
    });

    expect(result.current.state).toBe("STATE-01-Typing");
    expect(result.current.firstValidKeyPressed).toBe(true);
  });

  it("错误达到阈值时触发轻提示", () => {
    const { result } = renderHook(() => useTypingMachine({ batchSize: 2 }));

    act(() => {
      result.current.setInput("x");
      result.current.setInput("xx");
    });

    expect(result.current.state).toBe("STATE-02-LightHintTriggered");
    expect(["errors", "phoneme"]).toContain(result.current.hintReason);
  });

  it("批次完成后展示批次动画", () => {
    const { result } = renderHook(() => useTypingMachine({ batchSize: 1 }));

    const targetWord = result.current.currentWord.text;

    act(() => {
      result.current.setInput(targetWord);
    });

    expect(result.current.state).toBe("STATE-05-BatchCompleted");
    expect(result.current.showBatchAnimation).toBe(true);
  });
});
