import { useCallback, useEffect, useRef, useState } from "react";
import { accuracy, classifyMistake, letterHint, segmentStart, type Mistake, type TypingOutcome, type WordItem } from "@wreadt/core";

/**
 * 逐字母默写（参考 qwerty-learner）：
 * idle：新词，尚未输入
 * typing：已输入正确前缀
 * wrong：刚按错，短暂标红抖动后清空重来，期间忽略输入
 * hint：触发轻提示（错误较多 / 停顿过久），不阻塞输入
 * completed：拼写完成（仅“按任意键继续”模式会停留在此状态）
 * batchDone：本组全部完成
 */
export type TypingState = "idle" | "typing" | "wrong" | "hint" | "completed" | "batchDone";
export type HintReason = "errors" | "pause" | null;
export type AdvanceMode = "key" | "auto";
/** reveal：逐步露出字母；skip：错 4 次后可跳过；none：不提示 */
export type WrongHelp = "reveal" | "skip" | "none";
/**
 * lenient：相邻键误触（手滑）只标黄、补打正确字母即可继续，不算拼写错误；同一位置连续手滑按拼错处理。
 * strict：任何按错都回到当前单词开头。
 */
export type TypoMode = "lenient" | "strict";

export const WRONG_RESET_MS = 300;
export const PAUSE_HINT_MS = 4000;
export const ERRORS_FOR_HINT = 2;
export const ERRORS_FOR_SKIP = 4;

interface Options {
  words: WordItem[];
  onWordDone?: (word: WordItem, outcome: TypingOutcome) => void;
  advance?: AdvanceMode;
  wrongHelp?: WrongHelp;
  typoMode?: TypoMode;
}

interface WordProgress {
  typed: string;
  wrongChar: string | null;
  errors: number;
  /** 每次按错：位置、应输入、实际按下（字母级错误分析） */
  mistakes: Mistake[];
  keystrokes: number;
  startedAt: number | null;
  hinted: boolean;
  hintReason: HintReason;
  /** 跳过 / 已会（没有拼完） */
  skipped?: boolean;
  /** 宽容模式：当前位置手滑按下的键（黄色显示，等待补打） */
  slipChar: string | null;
  /** 宽容模式下的手滑次数（不计入 errors） */
  slips: number;
}

const EMPTY: WordProgress = { typed: "", wrongChar: null, errors: 0, mistakes: [], keystrokes: 0, startedAt: null, hinted: false, hintReason: null, slipChar: null, slips: 0 };

/** 当前单词的提示：只按当前单词里的出错次数来露出字母 */
function hintFor(word: WordItem, progress: WordProgress): string {
  const from = segmentStart(word.answer, progress.typed.length);
  return letterHint(word, progress.mistakes.filter((m) => m.pos >= from && !m.slip).length, from);
}

function sameChar(expected: string, typed: string): boolean {
  return expected.toLowerCase() === typed.toLowerCase();
}

/** 一组词对应一次挂载；换组时请给使用方组件换 key */
export function useTypingMachine({ words, onWordDone, advance = "key", wrongHelp = "reveal", typoMode = "strict" }: Options) {
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<TypingState>(words.length ? "idle" : "batchDone");
  const [progress, setProgress] = useState<WordProgress>(EMPTY);
  const [peeking, setPeeking] = useState(false);
  const [firstKeyPressed, setFirstKeyPressed] = useState(false);
  // 本组统计：按键数、错误按键数、第一次按键时间、完成词数、一次拼对的词数
  const [totals, setTotals] = useState({ keystrokes: 0, wrongKeystrokes: 0, startedAt: 0, done: 0, correct: 0 });
  // 已经记录过结果的词（拼完 / 跳过 / 已会）：跳回去时保持完成状态，不会重复记录
  const [finished, setFinished] = useState<Record<number, WordProgress>>({});

  const pauseTimer = useRef<number | null>(null);
  const resetTimer = useRef<number | null>(null);
  const onWordDoneRef = useRef(onWordDone);
  useEffect(() => {
    onWordDoneRef.current = onWordDone;
  });

  const word = words[index] as WordItem | undefined;

  const clearTimers = () => {
    for (const ref of [pauseTimer, resetTimer]) {
      if (ref.current !== null) window.clearTimeout(ref.current);
      ref.current = null;
    }
  };
  useEffect(() => clearTimers, []);

  const goTo = useCallback(
    (next: number, done?: Record<number, WordProgress>) => {
      clearTimers();
      setPeeking(false);
      if (next >= words.length) {
        setProgress(EMPTY);
        setState("batchDone");
        return;
      }
      const target = Math.max(0, next);
      const kept = (done ?? finished)[target];
      setIndex(target);
      setProgress(kept ?? EMPTY);
      setState(kept ? "completed" : "idle");
    },
    [finished, words.length],
  );

  /** 记下本词已完成（跳回来时显示完整拼写） */
  const finish = useCallback(
    (p: WordProgress) => {
      const done = { ...finished, [index]: { ...p, typed: word?.answer ?? p.typed, wrongChar: null, hintReason: null } };
      setFinished(done);
      return done;
    },
    [finished, index, word],
  );

  const schedulePauseHint = useCallback(() => {
    if (wrongHelp === "none") return;
    if (pauseTimer.current !== null) window.clearTimeout(pauseTimer.current);
    pauseTimer.current = window.setTimeout(() => {
      setProgress((p) => ({ ...p, hintReason: p.hintReason ?? "pause" }));
      setState((s) => (s === "typing" || s === "idle" ? "hint" : s));
    }, PAUSE_HINT_MS);
  }, [wrongHelp]);

  /** 输入一个字符 */
  const press = useCallback(
    (char: string) => {
      if (!word || state === "wrong" || state === "completed" || state === "batchDone") return;
      if (!firstKeyPressed) setFirstKeyPressed(true);

      const now = Date.now();
      const expected = word.answer[progress.typed.length] ?? "";
      const startedAt = progress.startedAt ?? now;
      const keystrokes = progress.keystrokes + 1;

      if (!sameChar(expected, char)) {
        const mistake = { pos: progress.typed.length, expected, typed: char };
        // 宽容模式：相邻键误触只标黄，光标停在原地等待补打；同一位置已经手滑过一次，再错就按拼错处理
        if (typoMode === "lenient" && !progress.slipChar && classifyMistake(word.answer, mistake) === "slip") {
          setTotals((s) => ({ ...s, keystrokes: s.keystrokes + 1, wrongKeystrokes: s.wrongKeystrokes + 1, startedAt: s.startedAt || now }));
          setProgress({ ...progress, slipChar: char, slips: progress.slips + 1, mistakes: [...progress.mistakes, { ...mistake, slip: true }], keystrokes, startedAt });
          schedulePauseHint();
          return;
        }
        const errors = progress.errors + 1;
        const hintReason: HintReason = wrongHelp !== "none" && errors >= ERRORS_FOR_HINT ? "errors" : progress.hintReason;
        setTotals((s) => ({ ...s, keystrokes: s.keystrokes + 1, wrongKeystrokes: s.wrongKeystrokes + 1, startedAt: s.startedAt || now }));
        const mistakes = [...progress.mistakes, mistake];
        setProgress({ ...progress, wrongChar: char, slipChar: null, errors, mistakes, keystrokes, startedAt, hintReason });
        setState("wrong");
        clearTimers();
        // 按错：短暂标红后回到当前单词的开头（短语中已经打对的单词保留）
        const keep = segmentStart(word.answer, progress.typed.length);
        resetTimer.current = window.setTimeout(() => {
          setProgress((p) => ({ ...p, typed: p.typed.slice(0, keep), wrongChar: null }));
          setState(hintReason ? "hint" : "idle");
          resetTimer.current = null;
        }, WRONG_RESET_MS);
        return;
      }

      setTotals((s) => ({ ...s, keystrokes: s.keystrokes + 1, startedAt: s.startedAt || now }));
      const typed = progress.typed + expected;
      const next = { ...progress, typed, keystrokes, startedAt, slipChar: null };
      clearTimers();

      if (typed.length < word.answer.length) {
        setProgress(next);
        setState(next.hintReason ? "hint" : "typing");
        schedulePauseHint();
        return;
      }

      const revealed = wrongHelp === "reveal" ? hintFor(word, progress).length : 0;
      const clean = next.errors === 0 && !next.hinted && revealed === 0;
      setTotals((s) => ({ ...s, done: s.done + 1, correct: s.correct + (clean ? 1 : 0) }));
      onWordDoneRef.current?.(word, {
        errors: next.errors,
        slips: next.slips,
        mistakes: next.mistakes,
        hinted: next.hinted || revealed > 0,
        skipped: false,
        durationMs: now - startedAt,
        answerLength: word.answer.length,
      });
      const done = finish(next);
      if (advance === "auto") {
        goTo(index + 1, done);
      } else {
        setProgress(next);
        setState("completed");
      }
    },
    [advance, finish, firstKeyPressed, goTo, index, progress, schedulePauseHint, state, typoMode, word, wrongHelp],
  );

  /** 直接进入下一个，不记录本词结果（“我早就会了”由调用方单独记录） */
  const dismiss = useCallback(() => {
    if (word && state !== "batchDone") goTo(index + 1, finish({ ...progress, skipped: true }));
  }, [finish, goTo, index, progress, state, word]);

  /** 前进；当前词未完成且有过尝试时记为“跳过”（FSRS Again） */
  const next = useCallback(() => {
    if (!word || state === "batchDone") return;
    if (state !== "completed" && (progress.keystrokes > 0 || progress.hinted)) {
      onWordDoneRef.current?.(word, {
        errors: progress.errors,
        mistakes: progress.mistakes,
        hinted: progress.hinted,
        skipped: true,
        durationMs: Date.now() - (progress.startedAt ?? Date.now()),
        answerLength: word.answer.length,
      });
      goTo(index + 1, finish({ ...progress, skipped: true }));
      return;
    }
    goTo(index + 1);
  }, [finish, goTo, index, progress, state, word]);

  const prev = useCallback(() => {
    if (index > 0) goTo(index - 1);
  }, [goTo, index]);

  /** 按住 Tab 临时查看完整单词（视为用了提示） */
  const peek = useCallback(
    (on: boolean) => {
      if (wrongHelp === "none" || state === "completed") return;
      setPeeking(on);
      if (on) setProgress((p) => ({ ...p, hinted: true }));
    },
    [state, wrongHelp],
  );

  return {
    state,
    index,
    word,
    typed: progress.typed,
    wrongChar: progress.wrongChar,
    /** 宽容模式下手滑按下的键（黄色显示） */
    slipChar: progress.slipChar,
    errors: progress.errors,
    skipped: Boolean(progress.skipped),
    hintReason: progress.hintReason,
    /** 逐步露出的前缀长度（仅 reveal 模式） */
    revealed: word && wrongHelp === "reveal" ? hintFor(word, progress).length : 0,
    canSkip: wrongHelp === "skip" && progress.errors >= ERRORS_FOR_SKIP,
    peeking,
    accuracy: accuracy(totals.keystrokes, totals.wrongKeystrokes),
    stats: totals,
    /** 本组已完成（记录过结果）的词数 */
    doneCount: Object.keys(finished).length,
    firstKeyPressed,
    press,
    next,
    prev,
    dismiss,
    peek,
  };
}
