import { analyzeSpelling, ghostSpelling, hasPattern, mistakeFromWords, type Ghost, type MistakeRecord, type SentenceDiff, type SpellingPattern, type SpellingReport, type WordItem } from "@wreadt/core";
import { db } from "../store/db";
import { getMeta, setMeta } from "../store/repo";
import { loadDictWords, lookupIndex } from "../store/dicts";
import { DAY } from "./date";

const DICTATION_KEY = "spelling:dictation";
/** 分析最近这么多天的记录 */
export const SPELLING_DAYS = 60;

/** 记录整句听写中拼错的词（只存本机，最近 300 条） */
export async function recordDictationMistakes(diff: SentenceDiff) {
  const now = Date.now();
  const records: MistakeRecord[] = [];
  for (const tk of diff.tokens) {
    if (tk.status !== "wrong" || !tk.expected || !tk.typed || !/^[a-z]+$/.test(tk.expected)) continue;
    const m = mistakeFromWords(tk.expected, tk.typed);
    if (m) records.push({ answer: tk.expected, mistakes: [m], at: now });
  }
  if (!records.length) return;
  const list = (await getMeta<MistakeRecord[]>(DICTATION_KEY)) ?? [];
  await setMeta(DICTATION_KEY, [...list, ...records].slice(-300));
}

/** 最近的按错记录：打字（英文词）+ 整句听写 */
export async function loadMistakeRecords(now = Date.now()): Promise<MistakeRecord[]> {
  const since = now - SPELLING_DAYS * DAY;
  const logs = await db.reviewLogs.where("reviewedAt").aboveOrEqual(since).toArray();
  const typing = logs
    .filter((l) => l.mistakes?.length && l.wordId.startsWith("en:"))
    .map((l) => ({ answer: l.wordId.slice(3), mistakes: l.mistakes!, at: l.reviewedAt }));
  const dictation = ((await getMeta<MistakeRecord[]>(DICTATION_KEY)) ?? []).filter((r) => r.at >= since);
  return [...typing, ...dictation];
}

/** 这个词最近一次真正拼错（不含手滑）时的拼法，用于拼完后对照；没有拼错过返回 null */
export async function loadGhost(word: WordItem): Promise<Ghost | null> {
  if (word.lang !== "en") return null;
  const logs = await db.reviewLogs.where("wordId").equals(word.id).toArray();
  logs.sort((a, b) => b.reviewedAt - a.reviewedAt);
  for (const log of logs) {
    for (const m of log.mistakes ?? []) {
      const g = ghostSpelling(word.answer, m);
      if (g) return g;
    }
  }
  return null;
}

export async function loadSpellingReport(): Promise<SpellingReport> {
  return analyzeSpelling(await loadMistakeRecords());
}

/**
 * 某个难点的专项练习：先练自己错过的词，再从当前词库补充含同样难点、还没学过的词，凑满 count 个。
 */
export async function patternPracticeWords(pattern: SpellingPattern, wrongWords: string[], dictIds: string[], count = 15): Promise<WordItem[]> {
  const index = await lookupIndex("en");
  const out = new Map<string, WordItem>();
  for (const w of wrongWords) {
    const item = index.get(w);
    if (item) out.set(item.id, item);
    if (out.size >= Math.ceil(count / 2)) break;
  }
  const learned = new Set((await db.cards.toArray()).filter((c) => !c.deleted && c.reps > 0).map((c) => c.id));
  const pool = (await Promise.all(dictIds.map((id) => loadDictWords(id).catch(() => [] as WordItem[]))))
    .flat()
    .filter((w) => w.lang === "en" && !out.has(w.id) && !learned.has(w.id) && hasPattern(w.answer, pattern));
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  for (const w of pool) {
    if (out.size >= count) break;
    out.set(w.id, w);
  }
  return [...out.values()];
}
