import type { WordInsight, WordItem } from "@wreadt/core";
import { aiSource, generateWordInsight } from "../services/ai";
import { getMeta, setMeta } from "../store/repo";

// 词义详解：拼完一个英文词后按需生成（每个词只请求一次），结果缓存在本机；不需要讲的简单词记为 null，也不再请求

const META_KEY = "wordInsight";
/** 本机最多缓存这么多个词 */
const MAX = 2000;

let store: Record<string, WordInsight | null> | null = null;
const pending = new Map<string, Promise<WordInsight | null>>();

async function load(): Promise<Record<string, WordInsight | null>> {
  store ??= (await getMeta<Record<string, WordInsight | null>>(META_KEY)) ?? {};
  return store;
}

const keyOf = (word: WordItem, locale: string) => `${locale}:${word.answer.toLowerCase()}`;

/** 写入缓存（开发模式预置详解时也用它） */
export async function saveInsights(entries: Record<string, WordInsight | null>): Promise<void> {
  const cache = await load();
  Object.assign(cache, entries);
  const keys = Object.keys(cache);
  if (keys.length > MAX) for (const k of keys.slice(0, keys.length - MAX)) delete cache[k];
  await setMeta(META_KEY, cache);
}

/** 某个英文词的详解：已缓存直接返回；没有 AI、出错或不需要讲时为 null */
export async function insightFor(word: WordItem, locale: string): Promise<WordInsight | null> {
  if (word.lang !== "en") return null;
  const key = keyOf(word, locale);
  const cache = await load();
  if (key in cache) return cache[key]!;
  let job = pending.get(key);
  if (!job) {
    job = (async () => {
      if (!(await aiSource())) return null;
      const insight = await generateWordInsight(word.answer, word.meanings, locale);
      await saveInsights({ [key]: insight });
      return insight;
    })()
      .catch(() => null)
      .finally(() => pending.delete(key));
    pending.set(key, job);
  }
  return job;
}
