import { useEffect, useMemo, useRef, useState } from "react";
import { vocabulary } from "../data/vocabulary";
import { playAudio, preloadAudio } from "../services/youdao";
import type { BatchResult, TypingState, WordItem } from "../types/typing";

interface TypingMachineOptions {
  batchSize?: number;
}

const PAUSE_HINT_MS = 2600;
const MAX_ERRORS_FOR_HINT = 2;

export function useTypingMachine(options: TypingMachineOptions = {}) {
  const batchSize = options.batchSize ?? 15;
  const [state, setState] = useState<TypingState>("STATE-00-Idle");
  const [wordIndex, setWordIndex] = useState(0);
  const [input, setInput] = useState("");
  const [errorCount, setErrorCount] = useState(0);
  const [firstValidKeyPressed, setFirstValidKeyPressed] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [showBatchAnimation, setShowBatchAnimation] = useState(false);
  const [hintReason, setHintReason] = useState<string>("");
  const pauseTimerRef = useRef<number | null>(null);
  const autoPlayedWordIdRef = useRef<string | null>(null);

  const currentWord: WordItem = vocabulary[wordIndex % vocabulary.length];

  const accuracy = useMemo(() => {
    if (!input.length) return 0;
    let matched = 0;
    for (let i = 0; i < input.length; i += 1) {
      if (input[i] === currentWord.text[i]) matched += 1;
    }
    return Math.round((matched / Math.max(input.length, currentWord.text.length)) * 100);
  }, [input, currentWord.text]);

  useEffect(() => {
    void preloadAudio(currentWord.text, currentWord.lang);
    if (autoPlayedWordIdRef.current !== currentWord.id) {
      autoPlayedWordIdRef.current = currentWord.id;
      void playAudio(currentWord.text, currentWord.lang).catch(() => undefined);
    }
  }, [currentWord.id, currentWord.lang, currentWord.text]);

  const clearPauseTimer = () => {
    if (pauseTimerRef.current) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  };

  const startPauseTimer = () => {
    clearPauseTimer();
    pauseTimerRef.current = window.setTimeout(() => {
      setState("STATE-02-LightHintTriggered");
      setHintReason("pause");
    }, PAUSE_HINT_MS);
  };

  const resetWordState = () => {
    clearPauseTimer();
    setState("STATE-00-Idle");
    setInput("");
    setErrorCount(0);
    setHintReason("");
  };

  const onType = (value: string) => {
    if (!firstValidKeyPressed && value.trim().length > 0) {
      setFirstValidKeyPressed(true);
    }

    if (state === "STATE-00-Idle") {
      setState("STATE-01-Typing");
    }

    setInput(value);
    startPauseTimer();

    const expected = currentWord.text.slice(0, value.length);
    if (value && value !== expected) {
      const nextErrorCount = errorCount + 1;
      setErrorCount(nextErrorCount);
      if (nextErrorCount >= MAX_ERRORS_FOR_HINT) {
        setState("STATE-02-LightHintTriggered");
        setHintReason("errors");
      }
      if (currentWord.confusingPhonemes?.length) {
        setState("STATE-02-LightHintTriggered");
        setHintReason("phoneme");
      }
    }

    if (value === currentWord.text) {
      clearPauseTimer();
      const correct = errorCount === 0;
      const finalAccuracy = correct ? 100 : Math.max(60, accuracy);
      const nextResults = [...results, { wordId: currentWord.id, accuracy: finalAccuracy, correct }];
      setResults(nextResults);
      setState("STATE-03-WordCompleted");
      const nextIndex = wordIndex + 1;

      if (nextResults.length % batchSize === 0) {
        setState("STATE-05-BatchCompleted");
        setShowBatchAnimation(true);
      } else {
        setState("STATE-04-BatchProgressing");
        window.setTimeout(() => {
          resetWordState();
          setWordIndex(nextIndex);
        }, 300);
      }
    }
  };

  const gotoNextWord = () => {
    resetWordState();
    setWordIndex((prev) => prev + 1);
  };

  const closeBatchAnimation = () => {
    setShowBatchAnimation(false);
    resetWordState();
    setWordIndex((prev) => prev + 1);
  };

  const replayAudio = async () => {
    await playAudio(currentWord.text, currentWord.lang);
  };

  useEffect(() => () => clearPauseTimer(), []);

  return {
    state,
    input,
    setInput: onType,
    currentWord,
    errorCount,
    firstValidKeyPressed,
    results,
    batchSize,
    showBatchAnimation,
    closeBatchAnimation,
    replayAudio,
    gotoNextWord,
    hintReason,
    accuracy,
  };
}
