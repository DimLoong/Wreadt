import { useCallback, useEffect, useRef, useState } from "react";
import { accuracy, isAnswerCorrect, isValidPrefix, letterHint, type TypingOutcome, type WordItem } from "@wreadt/core";

/**
 * idle：展示新词，尚未输入
 * typing：输入中
 * hint：触发轻提示（连续出错 / 停顿过久），不阻塞输入
 * completed：本词拼写正确，等待 Space / Enter 进入下一个
 * batchDone：本组全部完成
 */
export type TypingState = "idle" | "typing" | "hint" | "completed" | "batchDone";
export type HintReason = "errors" | "pause" | null;

export const PAUSE_HINT_MS = 4000;
export const ERRORS_FOR_HINT = 2;

interface Options {
  words: WordItem[];
  onWordDone?: (word: WordItem, outcome: TypingOutcome) => void;
}

interface WordProgress {
  input: string;
  errors: number;
  keystrokes: number;
  wrongKeystrokes: number;
  startedAt: number | null;
  hinted: boolean;
  hintReason: HintReason;
}

const EMPTY: WordProgress = { input: "", errors: 0, keystrokes: 0, wrongKeystrokes: 0, startedAt: null, hinted: false, hintReason: null };

/** 一组词对应一次挂载；换组时请给使用方组件换 key */
export function useTypingMachine({ words, onWordDone }: Options) {
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<TypingState>(words.length ? "idle" : "batchDone");
  const [progress, setProgress] = useState<WordProgress>(EMPTY);
  const [firstKeyPressed, setFirstKeyPressed] = useState(false);
  const [totals, setTotals] = useState({ keystrokes: 0, wrongKeystrokes: 0 });

  const pauseTimer = useRef<number | null>(null);
  const onWordDoneRef = useRef(onWordDone);
  useEffect(() => {
    onWordDoneRef.current = onWordDone;
  });

  const word = words[index] as WordItem | undefined;

  const clearPause = () => {
    if (pauseTimer.current !== null) window.clearTimeout(pauseTimer.current);
    pauseTimer.current = null;
  };

  useEffect(() => clearPause, []);

  const goTo = useCallback(
    (next: number) => {
      clearPause();
      setProgress(EMPTY);
      if (next >= words.length) {
        setState("batchDone");
        return;
      }
      setIndex(Math.max(0, next));
      setState("idle");
    },
    [words.length],
  );

  const onInput = useCallback(
    (value: string) => {
      if (!word || state === "completed" || state === "batchDone") return;
      if (!firstKeyPressed && value.trim()) setFirstKeyPressed(true);

      const now = Date.now();
      const added = Math.max(0, value.length - progress.input.length);
      const wrong = added > 0 && !isValidPrefix(word, value);
      const next: WordProgress = {
        ...progress,
        input: value,
        startedAt: progress.startedAt ?? (value ? now : null),
        keystrokes: progress.keystrokes + added,
        wrongKeystrokes: progress.wrongKeystrokes + (wrong ? 1 : 0),
        errors: progress.errors + (wrong ? 1 : 0),
      };
      if (added) setTotals((s) => ({ keystrokes: s.keystrokes + added, wrongKeystrokes: s.wrongKeystrokes + (wrong ? 1 : 0) }));

      clearPause();
      if (isAnswerCorrect(word, value)) {
        setProgress(next);
        setState("completed");
        onWordDoneRef.current?.(word, {
          errors: next.errors,
          hinted: next.hinted,
          skipped: false,
          durationMs: now - (next.startedAt ?? now),
          answerLength: word.answer.length,
        });
        return;
      }

      if (next.errors >= ERRORS_FOR_HINT) {
        setProgress({ ...next, hinted: true, hintReason: "errors" });
        setState("hint");
      } else {
        setProgress(next);
        setState(next.hintReason ? "hint" : value ? "typing" : "idle");
      }
      pauseTimer.current = window.setTimeout(() => {
        setProgress((p) => ({ ...p, hinted: true, hintReason: p.hintReason ?? "pause" }));
        setState((s) => (s === "typing" || s === "idle" ? "hint" : s));
      }, PAUSE_HINT_MS);
    },
    [firstKeyPressed, progress, state, word],
  );

  /** 前进；当前词未完成且有过尝试时记为“跳过”（FSRS Again） */
  const next = useCallback(() => {
    if (!word || state === "batchDone") return;
    if (state !== "completed" && (progress.input || progress.errors)) {
      onWordDoneRef.current?.(word, {
        errors: progress.errors,
        hinted: progress.hinted,
        skipped: true,
        durationMs: Date.now() - (progress.startedAt ?? Date.now()),
        answerLength: word.answer.length,
      });
    }
    goTo(index + 1);
  }, [goTo, index, progress, state, word]);

  const prev = useCallback(() => {
    if (index > 0) goTo(index - 1);
  }, [goTo, index]);

  return {
    state,
    index,
    word,
    input: progress.input,
    errors: progress.errors,
    hintReason: progress.hintReason,
    hintLetters: word ? letterHint(word, progress.errors) : "",
    wordAccuracy: accuracy(progress.keystrokes, progress.wrongKeystrokes),
    accuracy: accuracy(totals.keystrokes, totals.wrongKeystrokes),
    firstKeyPressed,
    onInput,
    next,
    prev,
  };
}
