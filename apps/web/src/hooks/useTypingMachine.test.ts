import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WordItem } from "@wreadt/core";
import { PAUSE_HINT_MS, useTypingMachine } from "./useTypingMachine";

const w = (answer: string, extra: Partial<WordItem> = {}): WordItem => ({
  id: `d:${answer}`, dictId: "d", lang: "en", display: answer, answer, meanings: [], ...extra,
});
const words = [w("cat"), w("dog")];

describe("useTypingMachine", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("输入正确后完成并上报结果，next 前进", () => {
    const onWordDone = vi.fn();
    const { result } = renderHook(() => useTypingMachine({ words, onWordDone }));
    expect(result.current.state).toBe("idle");

    act(() => result.current.onInput("c"));
    expect(result.current.state).toBe("typing");
    expect(result.current.firstKeyPressed).toBe(true);
    act(() => result.current.onInput("ca"));
    act(() => result.current.onInput("cat"));
    expect(result.current.state).toBe("completed");
    expect(onWordDone).toHaveBeenCalledWith(words[0], expect.objectContaining({ errors: 0, skipped: false, hinted: false }));

    act(() => result.current.next());
    expect(result.current.word?.answer).toBe("dog");
    expect(result.current.input).toBe("");
  });

  it("连续出错触发提示并逐步揭示字母", () => {
    const { result } = renderHook(() => useTypingMachine({ words }));
    act(() => result.current.onInput("x"));
    act(() => result.current.onInput(""));
    act(() => result.current.onInput("z"));
    expect(result.current.state).toBe("hint");
    expect(result.current.hintReason).toBe("errors");
    act(() => result.current.onInput(""));
    act(() => result.current.onInput("q"));
    expect(result.current.hintLetters).toBe("c");
    expect(result.current.accuracy).toBe(0);
  });

  it("停顿过久触发提示", () => {
    const { result } = renderHook(() => useTypingMachine({ words }));
    act(() => result.current.onInput("c"));
    act(() => vi.advanceTimersByTime(PAUSE_HINT_MS + 10));
    expect(result.current.state).toBe("hint");
    expect(result.current.hintReason).toBe("pause");
  });

  it("尝试过再跳过记为 skipped；未尝试直接跳过不记录", () => {
    const onWordDone = vi.fn();
    const { result } = renderHook(() => useTypingMachine({ words, onWordDone }));
    act(() => result.current.next());
    expect(onWordDone).not.toHaveBeenCalled();
    act(() => result.current.onInput("d"));
    act(() => result.current.next());
    expect(onWordDone).toHaveBeenCalledWith(words[1], expect.objectContaining({ skipped: true }));
    expect(result.current.state).toBe("batchDone");
  });

  it("日语接受罗马音变体", () => {
    const ja = w("kyouiku", { lang: "ja", display: "教育", reading: "きょういく" });
    const { result } = renderHook(() => useTypingMachine({ words: [ja] }));
    act(() => result.current.onInput("kyoiku"));
    expect(result.current.state).toBe("completed");
  });

  it("完成后忽略输入", () => {
    const { result } = renderHook(() => useTypingMachine({ words }));
    act(() => result.current.onInput("cat"));
    act(() => result.current.onInput("catx"));
    expect(result.current.input).toBe("cat");
  });
});
