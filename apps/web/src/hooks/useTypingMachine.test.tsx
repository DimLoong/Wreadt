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

  it("输入完成后不会自动跳词，仅在显式下一词时推进", () => {
    const { result } = renderHook(() => useTypingMachine({ batchSize: 2 }));

    const firstWordId = result.current.currentWord.id;
    const targetWord = result.current.currentWord.text;

    act(() => {
      result.current.setInput(targetWord);
    });

    expect(result.current.state).toBe("STATE-03-WordCompleted");
    expect(result.current.currentWord.id).toBe(firstWordId);

    act(() => {
      result.current.gotoNextWord();
    });

    expect(result.current.currentWord.id).not.toBe(firstWordId);
  });

  it("批次完成后展示批次动画", () => {
    const { result } = renderHook(() => useTypingMachine({ batchSize: 1 }));

    act(() => {
      result.current.setInput(result.current.currentWord.text);
    });

    expect(result.current.state).toBe("STATE-05-BatchCompleted");
    expect(result.current.showBatchAnimation).toBe(true);
  });

  it("输入停顿超过阈值时触发 pause 轻提示", () => {
    const { result } = renderHook(() => useTypingMachine({ batchSize: 2 }));

    act(() => {
      result.current.setInput("t");
    });

    act(() => {
      vi.advanceTimersByTime(2600);
    });

    expect(result.current.state).toBe("STATE-02-LightHintTriggered");
    expect(result.current.hintReason).toBe("pause");
  });

  it("关闭批次动画后应进入下一词并隐藏动画", () => {
    const { result } = renderHook(() => useTypingMachine({ batchSize: 1 }));

    const firstWordId = result.current.currentWord.id;

    act(() => {
      result.current.setInput(result.current.currentWord.text);
      result.current.closeBatchAnimation();
    });

    expect(result.current.showBatchAnimation).toBe(false);
    expect(result.current.currentWord.id).not.toBe(firstWordId);
    expect(result.current.state).toBe("STATE-00-Idle");
  });

  it("日语词支持 romaji 纯拼写判定", () => {
    const { result } = renderHook(() => useTypingMachine({ batchSize: 15 }));

    act(() => {
      result.current.gotoNextWord();
      result.current.gotoNextWord();
    });

    expect(result.current.currentWord.lang).toBe("ja");

    act(() => {
      result.current.setInput("kyouiku");
    });

    expect(result.current.isCurrentInputCorrect).toBe(true);
    expect(result.current.state).toBe("STATE-03-WordCompleted");
  });
});
