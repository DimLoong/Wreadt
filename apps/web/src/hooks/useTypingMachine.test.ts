import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WordItem } from "@wreadt/core";
import { PAUSE_HINT_MS, useTypingMachine, WRONG_RESET_MS } from "./useTypingMachine";

const w = (answer: string, extra: Partial<WordItem> = {}): WordItem => ({
  id: `d:${answer}`, dictId: "d", lang: "en", display: answer, answer, meanings: [], ...extra,
});
const words = [w("cat"), w("dog")];

function type(result: { current: ReturnType<typeof useTypingMachine> }, text: string) {
  for (const ch of text) act(() => result.current.press(ch));
}

describe("useTypingMachine", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("逐字母输入，完成后停留等待任意键，next 前进", () => {
    const onWordDone = vi.fn();
    const { result } = renderHook(() => useTypingMachine({ words, onWordDone }));
    expect(result.current.state).toBe("idle");

    type(result, "C");
    expect(result.current.typed).toBe("c");
    expect(result.current.state).toBe("typing");
    expect(result.current.firstKeyPressed).toBe(true);
    type(result, "at");
    expect(result.current.state).toBe("completed");
    expect(onWordDone).toHaveBeenCalledWith(words[0], expect.objectContaining({ errors: 0, skipped: false, hinted: false }));

    type(result, "x"); // 完成状态下的输入被忽略，由组件负责“任意键继续”
    expect(result.current.typed).toBe("cat");
    act(() => result.current.next());
    expect(result.current.word?.answer).toBe("dog");
    expect(result.current.typed).toBe("");
  });

  it("按错一个字母：标红后整词清空重来，期间忽略输入", () => {
    const { result } = renderHook(() => useTypingMachine({ words }));
    type(result, "ce");
    expect(result.current.state).toBe("wrong");
    expect(result.current.wrongChar).toBe("e");
    expect(result.current.typed).toBe("c");
    type(result, "a");
    expect(result.current.typed).toBe("c");

    act(() => vi.advanceTimersByTime(WRONG_RESET_MS));
    expect(result.current.typed).toBe("");
    expect(result.current.wrongChar).toBeNull();
    expect(result.current.state).toBe("idle");
  });

  it("记录每次按错的位置与按键，完成时一并交给调用方", () => {
    const onWordDone = vi.fn();
    const { result } = renderHook(() => useTypingMachine({ words, onWordDone }));
    type(result, "cx");
    act(() => vi.advanceTimersByTime(WRONG_RESET_MS));
    type(result, "cat");
    expect(onWordDone).toHaveBeenCalledWith(words[0], expect.objectContaining({ errors: 1, mistakes: [{ pos: 1, expected: "a", typed: "x" }] }));
  });

  it("短语：在第二个单词里按错，只回到这个单词的开头", () => {
    const { result } = renderHook(() => useTypingMachine({ words: [w("expected result")] }));
    type(result, "expected rx");
    expect(result.current.state).toBe("wrong");
    act(() => vi.advanceTimersByTime(WRONG_RESET_MS));
    expect(result.current.typed).toBe("expected ");
    // 在空格处按错：前面的单词原样保留
    const { result: r2 } = renderHook(() => useTypingMachine({ words: [w("expected result")] }));
    type(r2, "expectedx");
    act(() => vi.advanceTimersByTime(WRONG_RESET_MS));
    expect(r2.current.typed).toBe("expected");
  });

  it("auto 模式完成后直接进入下一个", () => {
    const onWordDone = vi.fn();
    const { result } = renderHook(() => useTypingMachine({ words, onWordDone, advance: "auto" }));
    type(result, "cat");
    expect(onWordDone).toHaveBeenCalledTimes(1);
    expect(result.current.word?.answer).toBe("dog");
    expect(result.current.state).toBe("idle");
  });

  it("reveal 模式：错 3 次露出 1 个字母，完成时记为用过提示", () => {
    const onWordDone = vi.fn();
    const { result } = renderHook(() => useTypingMachine({ words, onWordDone }));
    for (let i = 0; i < 3; i++) {
      type(result, "x");
      act(() => vi.advanceTimersByTime(WRONG_RESET_MS));
    }
    expect(result.current.revealed).toBe(1);
    expect(result.current.state).toBe("hint");
    expect(result.current.hintReason).toBe("errors");
    type(result, "cat");
    expect(onWordDone).toHaveBeenCalledWith(words[0], expect.objectContaining({ errors: 3, hinted: true }));
  });

  it("skip 模式：错 4 次后可跳过，不露出字母", () => {
    const { result } = renderHook(() => useTypingMachine({ words, wrongHelp: "skip" }));
    for (let i = 0; i < 4; i++) {
      expect(result.current.canSkip).toBe(false);
      type(result, "x");
      act(() => vi.advanceTimersByTime(WRONG_RESET_MS));
    }
    expect(result.current.canSkip).toBe(true);
    expect(result.current.revealed).toBe(0);
  });

  it("none 模式：没有任何提示，Tab 也不能看答案", () => {
    const { result } = renderHook(() => useTypingMachine({ words, wrongHelp: "none" }));
    for (let i = 0; i < 5; i++) {
      type(result, "x");
      act(() => vi.advanceTimersByTime(WRONG_RESET_MS));
    }
    act(() => vi.advanceTimersByTime(PAUSE_HINT_MS * 2));
    act(() => result.current.peek(true));
    expect(result.current).toMatchObject({ revealed: 0, canSkip: false, peeking: false, hintReason: null, state: "idle" });
  });

  it("按住 Tab 查看答案记为用过提示", () => {
    const onWordDone = vi.fn();
    const { result } = renderHook(() => useTypingMachine({ words, onWordDone }));
    act(() => result.current.peek(true));
    expect(result.current.peeking).toBe(true);
    act(() => result.current.peek(false));
    type(result, "cat");
    expect(onWordDone).toHaveBeenCalledWith(words[0], expect.objectContaining({ hinted: true }));
  });

  it("停顿过久触发提示", () => {
    const { result } = renderHook(() => useTypingMachine({ words }));
    type(result, "c");
    act(() => vi.advanceTimersByTime(PAUSE_HINT_MS + 10));
    expect(result.current.state).toBe("hint");
    expect(result.current.hintReason).toBe("pause");
  });

  it("尝试过再跳过记为 skipped；未尝试直接跳过不记录；最后一个后进入 batchDone", () => {
    const onWordDone = vi.fn();
    const { result } = renderHook(() => useTypingMachine({ words, onWordDone }));
    act(() => result.current.next());
    expect(onWordDone).not.toHaveBeenCalled();
    type(result, "d");
    act(() => result.current.next());
    expect(onWordDone).toHaveBeenCalledWith(words[1], expect.objectContaining({ skipped: true }));
    expect(result.current.state).toBe("batchDone");
  });

  it("短语中的空格需要输入；日语输入罗马音", () => {
    const { result } = renderHook(() => useTypingMachine({ words: [w("give up"), w("kyouiku", { lang: "ja", display: "教育" })], advance: "auto" }));
    type(result, "give up");
    expect(result.current.word?.answer).toBe("kyouiku");
    type(result, "kyouiku");
    expect(result.current.state).toBe("batchDone");
  });

  it("准确率按按键计算", () => {
    const { result } = renderHook(() => useTypingMachine({ words }));
    type(result, "x");
    act(() => vi.advanceTimersByTime(WRONG_RESET_MS));
    type(result, "cat");
    expect(result.current.accuracy).toBe(75);
  });

  it("跳回已完成的词：保持完成状态、不重复记录；跳过的词标记为 skipped", () => {
    const onWordDone = vi.fn();
    const three = [w("cat"), w("dog"), w("fox")];
    const { result } = renderHook(() => useTypingMachine({ words: three, onWordDone }));
    type(result, "cat");
    act(() => result.current.next());
    type(result, "d"); // 尝试过再跳过
    act(() => result.current.next());
    expect(onWordDone).toHaveBeenCalledTimes(2);
    expect(result.current.doneCount).toBe(2);

    act(() => result.current.prev());
    expect(result.current.word?.answer).toBe("dog");
    expect(result.current.state).toBe("completed");
    expect(result.current.typed).toBe("dog");
    expect(result.current.skipped).toBe(true);

    act(() => result.current.prev());
    expect(result.current.state).toBe("completed");
    expect(result.current.typed).toBe("cat");
    expect(result.current.skipped).toBe(false);
    type(result, "x"); // 完成状态下的输入被忽略
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.word?.answer).toBe("fox");
    expect(result.current.state).toBe("idle");
    expect(onWordDone).toHaveBeenCalledTimes(2);
  });

  it("自动前进模式下跳回已完成的词也保持完成状态", () => {
    const { result } = renderHook(() => useTypingMachine({ words, advance: "auto" }));
    type(result, "cat");
    expect(result.current.word?.answer).toBe("dog");
    act(() => result.current.prev());
    expect(result.current.state).toBe("completed");
    expect(result.current.typed).toBe("cat");
  });

  it("宽容模式：相邻键手滑只标黄，补打即可继续，不算拼错", () => {
    const onWordDone = vi.fn();
    const { result } = renderHook(() => useTypingMachine({ words: [w("great")], onWordDone, typoMode: "lenient" }));
    type(result, "g");
    type(result, "t"); // 该打 r，按成了相邻的 t
    expect(result.current.state).not.toBe("wrong");
    expect(result.current.slipChar).toBe("t");
    expect(result.current.typed).toBe("g");
    type(result, "r"); // 补打
    expect(result.current.slipChar).toBeNull();
    type(result, "eat");
    expect(onWordDone).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ errors: 0, slips: 1, hinted: false }));
    expect(result.current.stats.correct).toBe(1);
    // 手滑记录下来供错误分析，但标记为 slip
    expect(onWordDone.mock.calls[0]![1].mistakes).toEqual([{ pos: 1, expected: "r", typed: "t", slip: true }]);
  });

  it("宽容模式：同一位置连续手滑、或不相邻的错误，仍按拼错处理", () => {
    const { result } = renderHook(() => useTypingMachine({ words: [w("great")], typoMode: "lenient" }));
    type(result, "gt");
    type(result, "e"); // 同一位置再次按错
    expect(result.current.state).toBe("wrong");
    expect(result.current.errors).toBe(1);
    act(() => vi.advanceTimersByTime(WRONG_RESET_MS));
    expect(result.current.typed).toBe("");

    type(result, "gm"); // m 与 r 不相邻
    expect(result.current.state).toBe("wrong");
    expect(result.current.errors).toBe(2);
  });

  it("严格模式（默认）：手滑也整词重打", () => {
    const { result } = renderHook(() => useTypingMachine({ words: [w("great")] }));
    type(result, "gt");
    expect(result.current.state).toBe("wrong");
    expect(result.current.slipChar).toBeNull();
  });

  it("宽容模式：发音相近的拼错标橙、补打即可，但仍算拼错并留下讲解", () => {
    const onWordDone = vi.fn();
    const { result } = renderHook(() => useTypingMachine({ words: [w("kettle")], onWordDone, typoMode: "lenient" }));
    type(result, "ka"); // kattle：弱读 / 元音混淆
    expect(result.current.state).not.toBe("wrong");
    expect(result.current.soundChar).toBe("a");
    expect(result.current.typed).toBe("k");
    type(result, "ettle");
    expect(onWordDone).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ errors: 1, slips: 0 }));
    expect(result.current.soundMistake).toMatchObject({ pos: 1, typed: "a", pattern: "vowel" });
    expect(result.current.stats.correct).toBe(0);
  });

  it("宽容模式：发音相近的拼错在同一位置再错，按拼错整词重打", () => {
    const { result } = renderHook(() => useTypingMachine({ words: [w("kettle")], typoMode: "lenient" }));
    type(result, "kai");
    expect(result.current.state).toBe("wrong");
    act(() => vi.advanceTimersByTime(WRONG_RESET_MS));
    expect(result.current.typed).toBe("");
  });
});
