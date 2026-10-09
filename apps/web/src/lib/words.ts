import { findDict, type Lang } from "@wreadt/core";

/** 词条 id 形如 `${dictId}:${name}` */
export function splitWordId(wordId: string): { dictId: string; name: string } {
  const i = wordId.indexOf(":");
  return { dictId: wordId.slice(0, i), name: wordId.slice(i + 1) };
}

export function dictLang(dictId: string): Lang | undefined {
  if (dictId === "custom-en") return "en";
  if (dictId === "custom-ja") return "ja";
  return findDict(dictId)?.lang;
}

/** 比较句子时忽略大小写、首尾空白与结尾标点 */
export function normalizeSentence(s: string): string {
  return s.trim().toLowerCase().replace(/[\s]+/g, " ").replace(/[.!?。！？]+$/, "");
}
