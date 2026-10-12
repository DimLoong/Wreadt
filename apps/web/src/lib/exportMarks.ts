import type { Mark } from "@wreadt/core";

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV：单词、读音 / 音标、释义、原因、来源词库、mark 时间 */
export function marksToCsv(marks: Mark[], dictName: (id: string) => string): string {
  const head = ["word", "answer", "reading_or_phonetic", "meanings", "reason", "dictionary", "marked_at"];
  const rows = marks.map((m) => [
    m.word.display,
    m.word.answer,
    (m.word.lang === "ja" ? m.word.reading : m.word.phonetic) ?? "",
    m.word.meanings.join("; "),
    m.reason ?? "",
    dictName(m.word.dictId),
    new Date(m.createdAt).toISOString(),
  ]);
  // BOM 让 Excel 正确识别 UTF-8
  return "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

/** Anki 导入用 Tab 分隔文本：正面为单词，背面为读音 / 音标与释义 */
export function marksToAnki(marks: Mark[]): string {
  const clean = (s: string) => s.replace(/[\t\n]/g, " ");
  return marks
    .map((m) => {
      const sub = m.word.lang === "ja" ? m.word.reading : m.word.phonetic && `/${m.word.phonetic}/`;
      const back = [sub, m.word.meanings.join("；")].filter(Boolean).join("<br>");
      return `${clean(m.word.display)}\t${clean(back)}`;
    })
    .join("\n");
}

export function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
