import { useCallback, useEffect, useState } from "react";
import {
  buildSession,
  dictStats,
  gradeFromTyping,
  reviewCard,
  type CardState,
  type DictStats,
  type Grade,
  type TypingOutcome,
  type WordItem,
} from "@wreadt/core";
import { loadDictWords } from "../store/dicts";
import { getCardsByDict, saveReview } from "../store/repo";

export interface BatchEntry {
  word: WordItem;
  grade: Grade;
  isNew: boolean;
}

type Status = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready" };

/** 加载词库与复习状态，组织每组练习，并把打字结果写入 FSRS 调度 */
export function useStudySession(dictId: string | null, batchSize: number) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [allWords, setAllWords] = useState<WordItem[]>([]);
  const [cards, setCards] = useState<Map<string, CardState>>(new Map());
  const [batch, setBatch] = useState<WordItem[]>([]);
  const [batchId, setBatchId] = useState(0);
  const [results, setResults] = useState<BatchEntry[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!dictId) return;
    let cancelled = false;
    Promise.all([loadDictWords(dictId), getCardsByDict(dictId)])
      .then(([words, cardMap]) => {
        if (cancelled) return;
        setAllWords(words);
        setCards(cardMap);
        setBatch(buildSession(words, cardMap, { size: batchSize }));
        setBatchId((n) => n + 1);
        setResults([]);
        setStatus({ kind: "ready" });
      })
      .catch((err: Error) => {
        if (!cancelled) setStatus({ kind: "error", message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [dictId, batchSize, reloadToken]);

  const recordWord = useCallback(
    (word: WordItem, outcome: TypingOutcome) => {
      const now = Date.now();
      const prev = cards.get(word.id);
      const grade = gradeFromTyping(outcome);
      const card = reviewCard(prev, word, grade, now);
      setCards((m) => new Map(m).set(word.id, card));
      setResults((r) => [...r.filter((e) => e.word.id !== word.id), { word, grade, isNew: !prev || prev.reps === 0 }]);
      void saveReview(card, {
        id: crypto.randomUUID(),
        wordId: word.id,
        dictId: word.dictId,
        grade,
        reviewedAt: now,
        durationMs: outcome.durationMs,
        errors: outcome.errors,
        updatedAt: now,
      });
    },
    [cards],
  );

  /** 开始下一组；ahead 为 true 时没有到期词也按到期时间提前复习 */
  const nextBatch = useCallback(
    (ahead = false) => {
      let next = buildSession(allWords, cards, { size: batchSize });
      if (!next.length && ahead) {
        next = allWords
          .filter((w) => cards.has(w.id))
          .sort((a, b) => cards.get(a.id)!.due - cards.get(b.id)!.due)
          .slice(0, batchSize);
      }
      setBatch(next);
      setBatchId((n) => n + 1);
      setResults([]);
    },
    [allWords, batchSize, cards],
  );

  const stats: DictStats = dictStats(allWords, cards);

  return {
    status,
    allWords,
    cards,
    batch,
    batchId,
    results,
    stats,
    recordWord,
    nextBatch,
    reload: () => setReloadToken((n) => n + 1),
  };
}
