import { useCallback, useEffect, useState } from "react";
import {
  buildSession,
  CUSTOM_DICT_ID,
  dictStats,
  gradeFromTyping,
  isCustomDict,
  isMastered,
  knownCard,
  reviewCard,
  type CardState,
  type DictStats,
  type Grade,
  type Mark,
  type TypingOutcome,
  type WordItem,
} from "@wreadt/core";
import { loadDictWords, loadDicts } from "../store/dicts";
import { db } from "../store/db";
import { getAllCards, markKnown, saveReview, unmarkWords } from "../store/repo";

export interface BatchEntry {
  word: WordItem;
  grade: Grade;
  isNew: boolean;
}

type Status = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready" };

export interface SessionOptions {
  /** null 表示设置尚未加载 */
  dictIds: string[] | null;
  batchSize: number;
  /** 每组混入“我的词库”的词数 */
  mixCount?: number;
  /** 每组混入 mark 的词数 */
  markMixCount?: number;
  /** 掌握后自动取消 mark */
  autoUnmarkMastered?: boolean;
  /** 专项练习：只练这些词（如 mark 列表筛选结果），不再混入其它词 */
  override?: { key: string; words: WordItem[] } | null;
}

/** 加载所选词库（多选去重）与复习状态，组织每组练习（混入“我的词库”与 mark 的词），并把打字结果写入 FSRS 调度 */
export function useStudySession({ dictIds, batchSize, mixCount = 0, markMixCount = 0, autoUnmarkMastered = false, override = null }: SessionOptions) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [allWords, setAllWords] = useState<WordItem[]>([]);
  const [mixWords, setMixWords] = useState<WordItem[]>([]);
  const [marks, setMarks] = useState<Map<string, Mark>>(new Map());
  const [cards, setCards] = useState<Map<string, CardState>>(new Map());
  const [batch, setBatch] = useState<WordItem[]>([]);
  const [batchId, setBatchId] = useState(0);
  const [results, setResults] = useState<BatchEntry[]>([]);
  const [reloadToken, setReloadToken] = useState(0);
  const key = override ? `override:${override.key}` : (dictIds?.join(",") ?? null);
  const mixTotal = override ? 0 : mixCount + markMixCount;

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    (async () => {
      const markRows = (await db.marks.toArray()).filter((m) => !m.deleted);
      const markMap = new Map(markRows.map((m) => [m.id, m]));
      if (override) return { words: override.words, mix: [] as WordItem[], markMap, cardMap: await getAllCards() };
      const ids = key.split(",");
      const words = await loadDicts(ids);
      const langs = new Set(words.map((w) => w.lang));
      // 未选“我的词库”时，把同语言的自加词混进来
      const custom = mixCount > 0 && !ids.some(isCustomDict) ? (await Promise.all([...langs].map((l) => loadDictWords(CUSTOM_DICT_ID[l])))).flat().slice() : [];
      // mark 的词也混进来（同语言）
      const marked = markMixCount > 0 ? markRows.map((m) => m.word).filter((w) => langs.has(w.lang)) : [];
      const seen = new Set<string>();
      const mix = [...marked, ...custom].filter((w) => !seen.has(w.id) && seen.add(w.id));
      return { words, mix, markMap, cardMap: await getAllCards() };
    })()
      .then(({ words, mix, markMap, cardMap }) => {
        if (cancelled) return;
        setAllWords(words);
        setMixWords(mix);
        setMarks(markMap);
        setCards(cardMap);
        let first = buildSession(words, cardMap, { size: batchSize, mix, mixCount: mixTotal });
        // 专项练习不受复习计划限制：没有到期 / 新词时，按到期时间依次练选中的词
        if (override && !first.length) first = words.slice().sort((a, b) => (cardMap.get(a.id)?.due ?? 0) - (cardMap.get(b.id)?.due ?? 0)).slice(0, batchSize);
        setBatch(first);
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
    // override 以 key 区分
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, batchSize, mixCount, markMixCount, reloadToken]);

  const recordWord = useCallback(
    (word: WordItem, outcome: TypingOutcome) => {
      const now = Date.now();
      const prev = cards.get(word.id);
      const grade = gradeFromTyping(outcome);
      const marked = marks.has(word.id);
      // mark 的词使用更高的记忆保持率，复习更频繁
      const card = reviewCard(prev, word, grade, now, marked);
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
      if (marked && autoUnmarkMastered && isMastered(card)) {
        void unmarkWords([word.id]);
        setMarks((m) => {
          const next = new Map(m);
          next.delete(word.id);
          return next;
        });
      }
    },
    [autoUnmarkMastered, cards, marks],
  );

  /** “我早就会了”：推到 1～6 个月后抽查（已有进度的词也一并推后） */
  const markWordKnown = useCallback(async (word: WordItem) => {
    const now = Date.now();
    const card = { ...knownCard(word, now), reps: Math.max(1, cards.get(word.id)?.reps ?? 1) };
    setCards((m) => new Map(m).set(word.id, card));
    await db.cards.delete(word.id);
    await markKnown([word], now);
  }, [cards]);

  /** 开始下一组；ahead 为 true 时没有到期词也按到期时间提前复习 */
  const nextBatch = useCallback(
    (ahead = false) => {
      let next = buildSession(allWords, cards, { size: batchSize, mix: mixWords, mixCount: mixTotal });
      if (!next.length && (ahead || override)) {
        next = allWords
          .slice()
          .sort((a, b) => (cards.get(a.id)?.due ?? 0) - (cards.get(b.id)?.due ?? 0))
          .slice(0, batchSize);
      }
      setBatch(next);
      setBatchId((n) => n + 1);
      setResults([]);
    },
    [allWords, batchSize, cards, mixTotal, mixWords, override],
  );

  const stats: DictStats = dictStats(allWords, cards);

  return {
    status,
    allWords,
    cards,
    marks,
    batch,
    batchId,
    results,
    stats,
    recordWord,
    markWordKnown,
    nextBatch,
    reload: () => setReloadToken((n) => n + 1),
  };
}
