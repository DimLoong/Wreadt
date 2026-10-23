// 字母级错误分析：把打字时按错的每个键归类成常见的拼写难点，并区分“手误”（相邻键误触）。

/** 一次按错：答案中的位置、应输入的字符、实际按下的字符 */
export interface Mistake {
  pos: number;
  expected: string;
  typed: string;
  /** 宽容模式下按手滑处理（补打即可继续），不计入提示与拼写错误 */
  slip?: boolean;
}

export type SpellingPattern =
  | "ie-ei"
  | "double"
  | "tion-sion"
  | "ance-ence"
  | "able-ible"
  | "silent"
  | "vowel"
  | "transpose"
  | "c-s-k"
  | "slip"
  | "other";

/** 拼写难点（不含手误），按教学价值排序 */
export const SPELLING_PATTERNS: SpellingPattern[] = ["ie-ei", "double", "tion-sion", "ance-ence", "able-ible", "silent", "vowel", "transpose", "c-s-k", "other"];

const QWERTY = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const KEY_POS = new Map<string, [number, number]>();
QWERTY.forEach((row, r) => [...row].forEach((ch, c) => KEY_POS.set(ch, [r, c + r * 0.5])));

/** 键盘上是否相邻（含斜向） */
export function adjacentKeys(a: string, b: string): boolean {
  const pa = KEY_POS.get(a.toLowerCase());
  const pb = KEY_POS.get(b.toLowerCase());
  if (!pa || !pb || a.toLowerCase() === b.toLowerCase()) return false;
  return Math.abs(pa[0] - pb[0]) <= 1 && Math.abs(pa[1] - pb[1]) <= 1;
}

const VOWELS = new Set([..."aeiou"]);
/** 常见不发音字母组合：首字母 kn / wr / gn / ps / pn，词尾 mb / mn，以及 gh、wh、rh */
const SILENT_RE = [/^kn/, /^wr/, /^gn/, /^ps/, /^pn/, /mb$/, /mn$/, /gh/, /wh/, /rh/];

/** 字母 pos 是否落在 re 匹配到的某一段里 */
function inMatch(word: string, re: RegExp, pos: number): boolean {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  for (const m of word.matchAll(g)) if (pos >= m.index && pos < m.index + m[0].length) return true;
  return false;
}

/** 把一次按错归类 */
export function classifyMistake(answer: string, m: Mistake): SpellingPattern {
  const w = answer.toLowerCase();
  const exp = m.expected.toLowerCase();
  const typ = m.typed.toLowerCase();
  const prev = w[m.pos - 1] ?? "";
  const next = w[m.pos + 1] ?? "";

  // 双写：该双没双（按成了后一个字母），或不该双却双了（又按了一次前一个字母）
  if (prev === exp && typ === next && exp !== next) return "double";
  if (exp !== prev && typ === prev && /[a-z]/.test(prev) && !VOWELS.has(prev)) return "double";
  if (inMatch(w, /ie|ei/, m.pos) && (typ === "i" || typ === "e")) return "ie-ei";
  if (inMatch(w, /[ts]ion$|ssion$|cian$/, m.pos) && "tsc".includes(typ)) return "tion-sion";
  if (inMatch(w, /[ae]n(ce|cy|t)$/, m.pos) && (typ === "a" || typ === "e")) return "ance-ence";
  if (inMatch(w, /[ai]ble$|[ai]bly$|[ai]bility$/, m.pos) && (typ === "a" || typ === "i")) return "able-ible";
  // 不发音字母：漏掉它直接按了下一个字母
  if (typ === next && SILENT_RE.some((re) => inMatch(w, re, m.pos))) return "silent";
  // 字母顺序颠倒：先按了后一个字母
  if (typ === next && exp !== next) return "transpose";
  if (adjacentKeys(exp, typ)) return "slip";
  if (VOWELS.has(exp) && VOWELS.has(typ)) return "vowel";
  if ("csk".includes(exp) && "csk".includes(typ)) return "c-s-k";
  return "other";
}

export interface MistakeRecord {
  /** 英文单词的答案（小写） */
  answer: string;
  mistakes: Mistake[];
  at: number;
  /** 来源标识（整句听写为句子原文）：同一来源再次提交时替换之前的记录，不重复计数 */
  source?: string;
}

export interface PatternStat {
  pattern: SpellingPattern;
  count: number;
  /** 出错的词，按出错次数排序 */
  words: string[];
  /** 例子：答案与当时按错的位置 */
  examples: { answer: string; pos: number; typed: string }[];
}

export interface SpellingReport {
  patterns: PatternStat[];
  /** 相邻键误触（手误），不算拼写问题 */
  slips: number;
  /** 手误按“本该按的键”统计次数（手滑热力图） */
  slipKeys: Record<string, number>;
  /** 按错的总次数 */
  total: number;
  /** 最常按错的字母对 expected→typed（不含手误） */
  pairs: { expected: string; typed: string; count: number }[];
}

/**
 * 汇总拼写弱点。同一个词同一位置反复按错只算一次（打错后整词重来，同一处常会连错好几次）。
 */
export function analyzeSpelling(records: MistakeRecord[]): SpellingReport {
  const byPattern = new Map<SpellingPattern, { count: number; words: Map<string, number>; examples: PatternStat["examples"] }>();
  const pairs = new Map<string, number>();
  let slips = 0;
  let total = 0;
  const slipKeys: Record<string, number> = {};
  for (const r of records) {
    const seen = new Set<string>();
    for (const m of r.mistakes) {
      const key = `${m.pos}:${m.typed.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      total += 1;
      const p = classifyMistake(r.answer, m);
      if (p === "slip") {
        slips += 1;
        const k = m.expected.toLowerCase();
        slipKeys[k] = (slipKeys[k] ?? 0) + 1;
        continue;
      }
      const stat = byPattern.get(p) ?? { count: 0, words: new Map<string, number>(), examples: [] as PatternStat["examples"] };
      stat.count += 1;
      stat.words.set(r.answer, (stat.words.get(r.answer) ?? 0) + 1);
      if (stat.examples.length < 5 && !stat.examples.some((e) => e.answer === r.answer)) stat.examples.push({ answer: r.answer, pos: m.pos, typed: m.typed });
      byPattern.set(p, stat);
      // 只统计字母之间的混淆（空格、短横线等结构符号不算）
      if (/^[a-z]$/i.test(m.expected) && /^[a-z]$/i.test(m.typed)) {
        const pair = `${m.expected.toLowerCase()}→${m.typed.toLowerCase()}`;
        pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
      }
    }
  }
  const patterns = [...byPattern.entries()]
    .map(([pattern, s]) => ({ pattern, count: s.count, words: [...s.words.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w), examples: s.examples }))
    .sort((a, b) => b.count - a.count || SPELLING_PATTERNS.indexOf(a.pattern) - SPELLING_PATTERNS.indexOf(b.pattern));
  return {
    patterns,
    slips,
    slipKeys,
    total,
    pairs: [...pairs.entries()]
      .map(([k, count]) => ({ expected: k.split("→")[0]!, typed: k.split("→")[1]!, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };
}

/** 词表里含有该难点的词（用于专项练习时补充新词） */
export function hasPattern(answer: string, pattern: SpellingPattern): boolean {
  const w = answer.toLowerCase();
  switch (pattern) {
    case "ie-ei":
      return /ie|ei/.test(w);
    case "double":
      return /([b-df-hj-np-tv-z])\1/.test(w);
    case "tion-sion":
      return /[ts]ion$|cian$/.test(w);
    case "ance-ence":
      return /[ae]n(ce|cy|t)$/.test(w);
    case "able-ible":
      return /[ai]ble$|[ai]bly$/.test(w);
    case "silent":
      return SILENT_RE.some((re) => re.test(w));
    case "vowel":
      return /[aeiou][^aeiou]+[aeiou]/.test(w) && w.length >= 7;
    default:
      return false;
  }
}

/**
 * 从整句听写的“写错的词”推出按错的位置：逐字母比较，第一个不同处即为出错位置
 * （与打字时“按错即整词重来”的记录方式一致，只取第一处）。
 */
export function mistakeFromWords(expected: string, typed: string): Mistake | null {
  const a = expected.toLowerCase();
  const b = typed.toLowerCase();
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return b[i] ? { pos: i, expected: a[i]!, typed: b[i]! } : null;
  return null;
}

/** 还原出来的错误拼写：text 为当时的拼法，[from, to) 为与正确拼写不同的那一段 */
export interface Ghost {
  text: string;
  from: number;
  to: number;
}

/**
 * 根据一次按错还原“当时拼成的样子”，用于拼完后与正确拼写对照（错词幽灵回放）。
 * 漏写双字母 → 删掉该字母；多写 → 插入；字母顺序颠倒 → 交换；其余按替换处理。手滑与非字母不还原。
 */
export function ghostSpelling(answer: string, m: Mistake): Ghost | null {
  const typed = m.typed.toLowerCase();
  if (m.slip || !/^[a-z]$/.test(typed) || m.pos >= answer.length) return null;
  const kind = classifyMistake(answer, m);
  if (kind === "slip") return null;
  const w = answer;
  const p = m.pos;
  const prev = w[p - 1]?.toLowerCase() ?? "";
  const next = w[p + 1]?.toLowerCase() ?? "";
  const exp = m.expected.toLowerCase();
  // 该双没双：漏掉了这个重复字母
  if (kind === "double" && prev === exp && typed === next) return { text: w.slice(0, p) + w.slice(p + 1), from: p - 1, to: p };
  // 不该双却双了：多写了前一个字母
  if (kind === "double" && typed === prev) return { text: w.slice(0, p) + typed + w.slice(p), from: p, to: p + 1 };
  // 不发音字母被漏掉
  if (kind === "silent") return { text: w.slice(0, p) + w.slice(p + 1), from: Math.max(0, p - 1), to: p };
  // 字母顺序颠倒（含 ie / ei：先按了后一个字母）
  if (kind === "transpose" || (typed === next && exp !== next)) return { text: w.slice(0, p) + w[p + 1] + w[p] + w.slice(p + 2), from: p, to: p + 2 };
  return { text: w.slice(0, p) + typed + w.slice(p + 1), from: p, to: p + 1 };
}

/**
 * 发音相近导致的拼错（宽容模式下不必整词重打，但仍算拼错，并在拼完后讲解）：
 * 弱读元音、双写辅音、ie/ei、-tion/-sion、-ance/-ence、-able/-ible、c/s/k、不发音字母。
 */
export const SOUND_ALIKE = new Set<SpellingPattern>(["vowel", "double", "ie-ei", "tion-sion", "ance-ence", "able-ible", "c-s-k", "silent"]);
