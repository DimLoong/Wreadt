import { useEffect, useMemo, useRef, useState } from "react";
import { baseVocabularyByLang } from "../data/vocabulary";
import { playAudio, preloadAudio } from "../services/youdao";
import type { BatchResult, TypingState, WordItem } from "../types/typing";

interface TypingMachineOptions {
  batchSize?: number;
  words?: WordItem[];
  onBatchCompleted?: (results: BatchResult[]) => void;
}

const PAUSE_HINT_MS = 2600;
const MAX_ERRORS_FOR_HINT = 2;

function normalizeRomaji(value: string): string {
  return value.toLowerCase().replace(/[\s-]/g, "");
}

function normalizeForMatch(word: WordItem, value: string): string {
  if (word.lang === "ja" && /^[a-z\s-]+$/i.test(value)) {
    return normalizeRomaji(value);
  }
  return value.toLowerCase();
}

export function useTypingMachine(options: TypingMachineOptions = {}) {
  const words = options.words?.length ? options.words : baseVocabularyByLang.ja;
  const batchSize = options.batchSize ?? words.length;
  const [state, setState] = useState<TypingState>("STATE-00-Idle");
  const [wordIndex, setWordIndex] = useState(0);
  const [input, setInput] = useState("");
  const [errorCount, setErrorCount] = useState(0);
  const [firstValidKeyPressed, setFirstValidKeyPressed] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [showBatchAnimation, setShowBatchAnimation] = useState(false);
  const [hintReason, setHintReason] = useState<string>("");

  const pauseTimerRef = useRef<number | null>(null);
  const batchProgressTimerRef = useRef<number | null>(null);
  const autoPlayedWordIdRef = useRef<string | null>(null);
  const committedWordIdRef = useRef<string | null>(null);
  const batchAdvanceLockRef = useRef(false);

  const currentWord: WordItem = words[wordIndex % words.length];

  const acceptedInputs = useMemo(() => {
    const base = [currentWord.text, ...(currentWord.acceptedSpellings ?? [])];
    return Array.from(new Set(base.map((item) => normalizeForMatch(currentWord, item))));
  }, [currentWord]);

  const isCurrentInputCorrect = useMemo(
    () => acceptedInputs.includes(normalizeForMatch(currentWord, input.trimEnd())),
    [acceptedInputs, currentWord, input],
  );

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

  const clearBatchProgressTimer = () => {
    if (batchProgressTimerRef.current) {
      window.clearTimeout(batchProgressTimerRef.current);
      batchProgressTimerRef.current = null;
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
    clearBatchProgressTimer();
    committedWordIdRef.current = null;
    setState("STATE-00-Idle");
    setInput("");
    setErrorCount(0);
    setHintReason("");
  };

  const gotoNextWord = () => {
    resetWordState();
    setWordIndex((prev) => prev + 1);
  };

  const gotoPrevWord = () => {
    resetWordState();
    setWordIndex((prev) => Math.max(0, prev - 1));
  };

  const onType = (value: string) => {
    const normalizedValue = value.trimEnd();
    const normalizedLower = normalizeForMatch(currentWord, normalizedValue);
    const hasAcceptedExactMatch = acceptedInputs.includes(normalizedLower);

    if (state === "STATE-03-WordCompleted" && value.endsWith(" ") && hasAcceptedExactMatch) {
      gotoNextWord();
      return;
    }

    if (!firstValidKeyPressed && normalizedValue.trim().length > 0) setFirstValidKeyPressed(true);
    if (state === "STATE-00-Idle") setState("STATE-01-Typing");

    setInput(value);
    startPauseTimer();

    const expected = normalizeForMatch(currentWord, currentWord.text.slice(0, normalizedValue.length));
    if (normalizedValue && !hasAcceptedExactMatch && normalizedLower !== expected) {
      const nextErrorCount = errorCount + 1;
      setErrorCount(nextErrorCount);
      const shouldHintByErrors = nextErrorCount >= MAX_ERRORS_FOR_HINT;
      const shouldHintByPhoneme = Boolean(currentWord.confusingPhonemes?.length);
      if (shouldHintByErrors || shouldHintByPhoneme) {
        setState("STATE-02-LightHintTriggered");
        setHintReason(shouldHintByPhoneme ? "phoneme" : "errors");
      }
    }

    if (state === "STATE-03-WordCompleted") return;

    if (hasAcceptedExactMatch && committedWordIdRef.current !== currentWord.id) {
      clearPauseTimer();
      const correct = errorCount === 0;
      const finalAccuracy = correct ? 100 : Math.max(60, accuracy);
      const nextResults = [...results, { wordId: currentWord.id, accuracy: finalAccuracy, correct }];
      const isBatchCompleted = nextResults.length % batchSize === 0;

      committedWordIdRef.current = currentWord.id;
      setResults(nextResults);

      if (isBatchCompleted) {
        batchAdvanceLockRef.current = false;
        setState("STATE-05-BatchCompleted");
        setShowBatchAnimation(true);
        options.onBatchCompleted?.(nextResults.slice(nextResults.length - batchSize));
      } else {
        setState("STATE-04-BatchProgressing");
        clearBatchProgressTimer();
        batchProgressTimerRef.current = window.setTimeout(() => {
          setState("STATE-03-WordCompleted");
          batchProgressTimerRef.current = null;
        }, 120);
      }
    }
  };

  const closeBatchAnimation = () => {
    if (batchAdvanceLockRef.current) return;
    batchAdvanceLockRef.current = true;
    setShowBatchAnimation(false);
    resetWordState();
    setWordIndex((prev) => prev + 1);
  };

  const replayAudio = async () => {
    await playAudio(currentWord.text, currentWord.lang);
  };

  useEffect(() => {
    setWordIndex(0);
    setInput("");
    setErrorCount(0);
    setHintReason("");
    setState("STATE-00-Idle");
  }, [words]);

  useEffect(
    () => () => {
      clearPauseTimer();
      clearBatchProgressTimer();
    },
    [],
  );

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
    gotoPrevWord,
    hintReason,
    accuracy,
    isCurrentInputCorrect,
  };
}
