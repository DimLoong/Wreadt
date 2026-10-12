import { useCallback, useEffect, useState } from "react";
import {
  buildSession,
  CUSTOM_DICT_ID,
  dictStats,
  gradeFromTyping,
  isCustomDict,
  reviewCard,
  type CardState,
  type DictStats,
  type Grade,
  type TypingOutcome,
  type WordItem,
} from "@wreadt/core";
import { loadDictWords, loadDicts } from "../store/dicts";
import { getAllCards, saveReview } from "../store/repo";

export interface BatchEntry {
  word: WordItem;
  grade: Grade;
  isNew: boolean;
}

type Status = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready" };

/** 加载所选词库（多选去重）与复习状态，组织每组练习（可混入“我的词库”），并把打字结果写入 FSRS 调度 */
export function useStudySession(dictIds: string[] | null, batchSize: number, mixCount = 0) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [allWords, setAllWords] = useState<WordItem[]>([]);
  const [mixWords, setMixWords] = useState<WordItem[]>([]);
  const [cards, setCards] = useState<Map<string, CardState>>(new Map());
  const [batch, setBatch] = useState<WordItem[]>([]);
  const [batchId, setBatchId] = useState(0);
  const [results, setResults] = useState<BatchEntry[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const key = dictIds?.join(",") ?? null;

  useEffect(() => {
    if (key === null) return;
    const ids = key.split(",");
    let cancelled = false;
    (async () => {
      const words = await loadDicts(ids);
      // 未选“我的词库”时，把同语言的自加词混进来
      const langs = new Set(words.map((w) => w.lang));
      const mixIds = mixCount > 0 && !ids.some(isCustomDict) ? [...langs].map((l) => CUSTOM_DICT_ID[l]) : [];
      const mix = (await Promise.all(mixIds.map(loadDictWords))).flat();
      return { words, mix, cardMap: await getAllCards() };
    })()
      .then(({ words, mix, cardMap }) => {
        if (cancelled) return;
        setAllWords(words);
        setMixWords(mix);
        setCards(cardMap);
        setBatch(buildSession(words, cardMap, { size: batchSize, mix, mixCount }));
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
  }, [key, batchSize, mixCount, reloadToken]);

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
      let next = buildSession(allWords, cards, { size: batchSize, mix: mixWords, mixCount });
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
    [allWords, batchSize, cards, mixCount, mixWords],
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
