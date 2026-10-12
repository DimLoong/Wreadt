/** 把 “n. 题目，主题；” 拆成词性与释义；没有词性时 pos 为空 */
export function splitMeaning(meaning: string): { pos: string; text: string } {
  const m = /^\s*((?:[a-z]{1,5}\.\s*)+(?:&\s*[a-z]{1,5}\.)?)\s*(.*)$/i.exec(meaning);
  return m && m[2] ? { pos: m[1]!.replace(/\s+/g, ""), text: m[2].trim() } : { pos: "", text: meaning.trim() };
}
