import type { Lang } from "@wreadt/core";

/** 含假名或汉字视为日语 */
export function detectLang(text: string): Lang {
  return /[ぁ-んァ-ヶー一-龯々]/.test(text) ? "ja" : "en";
}

export type ParsedInput = { kind: "words"; items: string[] } | { kind: "sentence"; tokens: string[] };

/**
 * 判断输入是“单词列表”还是“一句话”：
 * - 有逗号 / 顿号 / 分号 / 换行分隔 → 单词列表（每项可以是短语，如 pull request）
 * - 英文不超过 3 个词、日语不超过 6 个字且没有句读 → 单个单词或短语
 * - 其余视为句子，拆成可点选的词
 */
export function parseInput(text: string, lang: Lang): ParsedInput {
  const value = text.trim();
  if (!value) return { kind: "words", items: [] };
  if (/[,，;；、\n]/.test(value)) {
    const items = value.split(/[,，;；、\n]+/).map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
    return { kind: "words", items: [...new Set(items)] };
  }
  if (lang === "en") {
    const tokens = value.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
    if (tokens.length <= 3 && !/[.!?]$/.test(value)) return { kind: "words", items: [tokens.join(" ")].filter(Boolean) };
    return { kind: "sentence", tokens };
  }
  if (value.length <= 6 && !/[。！？、]/.test(value)) return { kind: "words", items: [value] };
  const segmenter = new Intl.Segmenter("ja", { granularity: "word" });
  const tokens = [...segmenter.segment(value)].filter((s) => s.isWordLike).map((s) => s.segment);
  return { kind: "sentence", tokens };
}
