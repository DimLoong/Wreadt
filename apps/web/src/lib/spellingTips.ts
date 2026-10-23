import { aiSource, generateSpellingTip } from "../services/ai";
import { getMeta, setMeta } from "../store/repo";

// 发音相近拼错的 AI 讲解：同一个词的同一种错法只请求一次，缓存在本机

const META_KEY = "spellingTips";
const MAX = 500;

let cache: Record<string, string> | null = null;

/** 有 AI 时返回针对这个词的讲解，否则返回 null（界面使用内置模板） */
export async function spellingTipFor(word: string, wrong: string, at: string, pattern: string, locale: string): Promise<string | null> {
  const key = `${locale}|${word}|${wrong}`;
  cache ??= (await getMeta<Record<string, string>>(META_KEY)) ?? {};
  if (cache[key]) return cache[key]!;
  if (!(await aiSource())) return null;
  try {
    const tip = await generateSpellingTip({ locale, word, wrong, at, pattern });
    cache[key] = tip;
    const keys = Object.keys(cache);
    if (keys.length > MAX) for (const k of keys.slice(0, keys.length - MAX)) delete cache[k];
    await setMeta(META_KEY, cache);
    return tip;
  } catch {
    return null;
  }
}
