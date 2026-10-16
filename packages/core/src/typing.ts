import type { WordItem } from "./types.ts";

// 训令式 / 日本式 → 平文式，保证 si/shi、tu/tsu 等写法都能通过
const KUNREI_TO_HEPBURN: [RegExp, string][] = [
  [/sy([aueo])/g, "sh$1"],
  [/ty([aueo])/g, "ch$1"],
  [/cy([aueo])/g, "ch$1"],
  [/(?:zy|jy)([aueo])/g, "j$1"],
  [/si/g, "shi"],
  [/ti/g, "chi"],
  [/tu/g, "tsu"],
  [/hu/g, "fu"],
  [/(?:zi|di)/g, "ji"],
  [/du/g, "zu"],
];

/** 罗马音归一化：去分隔符、统一写法、合并长音与拨音写法差异 */
export function canonicalRomaji(value: string): string {
  let s = value.toLowerCase().replace(/[\s'’\-]/g, "");
  for (const [re, to] of KUNREI_TO_HEPBURN) s = s.replace(re, to);
  return s
    .replace(/nn/g, "n")
    .replace(/ou/g, "o")
    .replace(/ei/g, "e")
    .replace(/([aiueo])\1/g, "$1");
}

function normalizeEnglish(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function isKana(value: string): boolean {
  return /^[ぁ-んァ-ヶー\s]+$/.test(value);
}

function katakanaToHiragana(value: string): string {
  return value.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** 输入是否为该词的正确答案（英文忽略大小写；日语接受罗马音各种写法、假名、汉字写法） */
function answers(word: WordItem): string[] {
  return word.alternatives?.length ? [word.answer, ...word.alternatives] : [word.answer];
}

export function isAnswerCorrect(word: WordItem, input: string): boolean {
  const value = input.trim();
  if (!value) return false;
  if (word.lang === "en") return answers(word).some((a) => normalizeEnglish(value) === normalizeEnglish(a));
  if (value === word.display || word.display.split("/").includes(value)) return true;
  if (word.reading && isKana(value)) {
    const kana = katakanaToHiragana(value.replace(/[\s・]/g, ""));
    return word.reading.split("/").some((r) => katakanaToHiragana(r.replace(/[\s・]/g, "")) === kana);
  }
  return answers(word).some((a) => canonicalRomaji(value) === canonicalRomaji(a));
}

/** 当前输入是否仍可能拼出正确答案（用于实时判错） */
export function isValidPrefix(word: WordItem, input: string): boolean {
  if (!input) return true;
  if (word.lang === "en") {
    const value = input.toLowerCase().replace(/\s+/g, " ").trimStart();
    return answers(word).some((a) => normalizeEnglish(a).startsWith(value));
  }
  if (isKana(input) || /[^\x00-\x7f]/.test(input)) return true; // 输入法组字中，不判错
  // 末尾可能是未完成的音节（如 "sy"、"t"），尝试补一个元音再判断
  return answers(word).some((a) => {
    const target = canonicalRomaji(a);
    return ["", "a", "i", "u", "e", "o"].some((v) => target.startsWith(canonicalRomaji(input + v)));
  });
}

/**
 * 多词短语按单词分段：按错时只回到当前单词的开头，已经打对的单词保留（如 expected result 在 result 处出错，保留 “expected ”）。
 * 正好在空格处按错时，前面的都已打对，原地不动。
 */
export function segmentStart(answer: string, pos: number): number {
  if (answer[pos] === " ") return pos;
  return answer.lastIndexOf(" ", pos - 1) + 1;
}

/**
 * 连续出错时逐步揭示答案：3 次错误起显示 1 个字母，之后每 2 次多显示 1 个。
 * from 为当前单词的起点（短语里只提示正在打的那个单词），返回从答案开头到提示位置的前缀。
 */
export function letterHint(word: WordItem, errorCount: number, from = 0): string {
  if (errorCount < 3) return "";
  const n = Math.min(word.answer.length - 1 - from, 1 + Math.floor((errorCount - 3) / 2));
  return n > 0 ? word.answer.slice(0, from + n) : "";
}

export function accuracy(keystrokes: number, wrongKeystrokes: number): number {
  if (keystrokes <= 0) return 100;
  return Math.round(((keystrokes - wrongKeystrokes) / keystrokes) * 100);
}
