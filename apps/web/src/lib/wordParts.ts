import type { WordPart, WordItem } from "@wreadt/core";
import { aiSource, generateWordParts } from "../services/ai";
import { getMeta, setMeta } from "../store/repo";

// 构词拆分（un·believ·able）：一组开始时为整组英文单词一次性生成，结果缓存在本机（拆不开的词也记下，不再重复请求）

const META_KEY = "wordParts";
/** 本机最多缓存这么多个词 */
const MAX = 3000;

let store: Record<string, WordPart[]> | null = null;
const pending = new Map<string, Promise<WordPart[]>>();

async function load(): Promise<Record<string, WordPart[]>> {
  store ??= (await getMeta<Record<string, WordPart[]>>(META_KEY)) ?? {};
  return store;
}

/** 值得拆的词：英文、单个单词、6 个字母以上（短词基本没有可拆的构词） */
const eligible = (w: WordItem) => w.lang === "en" && !/[\s-]/.test(w.answer) && w.answer.length >= 6;

/** 为一组词预先生成构词拆分（已缓存的跳过）；没有 AI 时什么都不做 */
export async function prefetchWordParts(words: WordItem[], locale: string): Promise<void> {
  const cache = await load();
  const todo = [...new Set(words.filter(eligible).map((w) => w.answer.toLowerCase()))].filter((w) => !(w in cache) && !pending.has(w));
  if (!todo.length) return;
  // 先登记为“生成中”，拼完时查询的组件会等这次请求
  const job = (async () => {
    if (!(await aiSource())) return {} as Record<string, WordPart[]>;
    return generateWordParts(todo, locale);
  })().then(async (result) => {
    Object.assign(cache, result);
    const keys = Object.keys(cache);
    if (keys.length > MAX) for (const k of keys.slice(0, keys.length - MAX)) delete cache[k];
    await setMeta(META_KEY, cache);
    return result;
  });
  for (const w of todo) pending.set(w, job.then((r) => r[w] ?? []).catch(() => []).finally(() => pending.delete(w)));
  await job.catch(() => undefined);
}

/** 某个词的构词拆分：已缓存直接返回，正在生成则等待，没有则为空数组 */
export async function wordPartsFor(word: WordItem): Promise<WordPart[]> {
  if (!eligible(word)) return [];
  const key = word.answer.toLowerCase();
  const cache = await load();
  if (key in cache) return cache[key]!;
  return pending.get(key) ?? [];
}
