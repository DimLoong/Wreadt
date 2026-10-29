import type { CustomWord } from "@wreadt/core";
import { lookupIndex } from "../store/dicts";
import { addCustomWord, updateCustomWord } from "../store/repo";
import { aiSource, analyzeWords } from "../services/ai";

/** 释义是否以词性开头（n. / v. / adj. / phr. …） */
export const hasPos = (meaning: string) => /^(n|v|vt|vi|adj|adv|phr|prep|conj|pron|int|interj|abbr|num|art|aux|a|ad)\.\s?/i.test(meaning.trim());

/**
 * 一组释义是否缺少词性：只看第一条——后面不带词性的几条沿用前面的词性
 *（如 ["v. 挣扎", "奋斗", "n. 斗争"]，“奋斗”属于 v.）
 */
export const meaningsLackPos = (meanings: string[]) => meanings.length > 0 && !hasPos(meanings[0]!);

/** 一个英文单词缺少词性 */
export const lacksPos = (w: Pick<CustomWord, "lang" | "meanings">) => w.lang === "en" && meaningsLackPos(w.meanings);

type Details = Pick<CustomWord, "answer" | "phonetic" | "meanings" | "examples">;

/** 两段中文释义是否意思相近：有共同的两字词（如“对齐”） */
function overlaps(a: string, b: string): boolean {
  const grams = (s: string) => new Set([...s.replace(/[^\u4e00-\u9fff]/g, " ").matchAll(/(?=([\u4e00-\u9fff]{2}))/g)].map((m) => m[1]!));
  const ga = grams(a);
  return [...grams(b)].some((g) => ga.has(g));
}

/**
 * 查一组英文单词的完整信息：先查内置词库（释义带词性、有音标）；
 * 给了原释义（hints）而词库的意思对不上时（同一个词在不同词库里意思不同），交给 AI 按原意补全；
 * 没有 AI 时退回词库的结果。都查不到的不在结果里。
 */
async function lookupDetails(words: string[], locale: string, hints: Record<string, string> = {}): Promise<Map<string, Details>> {
  const out = new Map<string, Details>();
  const fallback = new Map<string, Details>();
  const index = await lookupIndex("en");
  const missing: string[] = [];
  for (const w of words) {
    const hit = index.get(w);
    if (hit && hit.meanings.length && !meaningsLackPos(hit.meanings)) {
      const details = { answer: hit.answer, phonetic: hit.phonetic, meanings: hit.meanings, examples: hit.examples };
      if (!hints[w] || overlaps(hints[w]!, hit.meanings.join("；"))) {
        out.set(w, details);
        continue;
      }
      fallback.set(w, details);
    }
    missing.push(w);
  }
  if (missing.length && (await aiSource())) {
    // analyze-words 一次最多处理 10 个
    for (let i = 0; i < missing.length; i += 10) {
      const batch = missing.slice(i, i + 10);
      const result = await analyzeWords("en", batch, locale).catch(() => []);
      for (const a of result) {
        if (!a.meanings.length) continue;
        out.set(a.input, { answer: a.word || a.input, phonetic: a.phonetic || fallback.get(a.input)?.phonetic || undefined, meanings: a.meanings, examples: a.example ? [{ sentence: a.example, translation: a.exampleTrans }] : undefined });
      }
    }
  }
  for (const [w, d] of fallback) if (!out.has(w)) out.set(w, d);
  return out;
}

/** 从场景点评、回复分析等处加入我的词库：补全词性、音标与例句（查不到时退回给定的释义） */
export async function addWordWithDetails(word: string, meaning: string, locale: string): Promise<void> {
  const lower = word.trim().toLowerCase();
  // 查询失败（词库加载失败等）也要把词加进去，只是没有补全
  const details = await lookupDetails([lower], locale, { [lower]: meaning })
    .then((m) => m.get(lower))
    .catch(() => undefined);
  await addCustomWord({ lang: "en", answer: lower, meanings: details?.meanings ?? [meaning].filter(Boolean), phonetic: details?.phonetic, examples: details?.examples });
}

/** 给“我的词库”里缺少词性的英文单词补全释义（保留原有例句）；返回补全的个数 */
export async function fillMissingPos(words: CustomWord[], locale: string): Promise<number> {
  const targets = words.filter(lacksPos);
  if (!targets.length) return 0;
  const details = await lookupDetails(
    targets.map((w) => w.answer),
    locale,
    Object.fromEntries(targets.map((w) => [w.answer, w.meanings.join("；")])),
  );
  let filled = 0;
  for (const w of targets) {
    const d = details.get(w.answer);
    if (!d) continue;
    await updateCustomWord(w.id, { meanings: d.meanings, phonetic: w.phonetic || d.phonetic, examples: w.examples?.length ? w.examples : d.examples });
    filled += 1;
  }
  return filled;
}
