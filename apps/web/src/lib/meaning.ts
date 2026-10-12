/** 把 “n. 题目，主题；” 拆成词性与释义；没有词性时 pos 为空 */
export function splitMeaning(meaning: string): { pos: string; text: string } {
  const m = /^\s*((?:[a-z]{1,5}\.\s*)+(?:&\s*[a-z]{1,5}\.)?)\s*(.*)$/i.exec(meaning);
  return m && m[2] ? { pos: m[1]!.replace(/\s+/g, ""), text: m[2].trim() } : { pos: "", text: meaning.trim() };
}

/** 在例句 / 短语中遮住目标词（默写未完成时不泄露答案） */
export function maskWord(text: string, words: string[]): string {
  let out = text;
  for (const w of words.filter((x) => x && x.length > 1)) {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const re = /^[ -~]+$/.test(w) ? new RegExp(`\\b${escaped}[a-z]{0,3}\\b`, "gi") : new RegExp(escaped, "g");
    out = out.replace(re, (m) => "_".repeat(Math.min(m.length, 8)));
  }
  return out;
}
