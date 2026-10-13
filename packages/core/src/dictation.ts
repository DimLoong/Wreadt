// 整句听写：逐词比对用户输入与原句

/** 拆成小写单词：忽略大小写与标点，保留词内的撇号与连字符（don't、follow-up） */
export function tokenizeSentence(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[‐-—]/g, "-")
    .split(/[^a-z0-9'-]+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ""))
    .filter(Boolean);
}

export type DiffStatus = "ok" | "wrong" | "missing" | "extra";

export interface DiffToken {
  status: DiffStatus;
  /** 原句中的词（extra 没有） */
  expected?: string;
  /** 用户打的词（missing 没有） */
  typed?: string;
}

export interface SentenceDiff {
  tokens: DiffToken[];
  /** 原句中写对的词数 */
  correct: number;
  /** 原句词数 */
  total: number;
  /** 0～1：写对的词 / max(原句词数, 输入词数)，多打的词也会拉低分数 */
  accuracy: number;
}

/**
 * 按最长公共子序列对齐；相邻的“漏掉 + 多打”配成一对，视为写错了这个词（如 recieve → receive）。
 */
export function diffSentence(expected: string, typed: string): SentenceDiff {
  const a = tokenizeSentence(expected);
  const b = tokenizeSentence(typed);
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1)
    for (let j = b.length - 1; j >= 0; j -= 1) dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);

  const raw: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      raw.push({ status: "ok", expected: a[i], typed: b[j] });
      i += 1;
      j += 1;
    } else if (j < b.length && (i >= a.length || dp[i]![j + 1]! >= dp[i + 1]![j]!)) {
      raw.push({ status: "extra", typed: b[j] });
      j += 1;
    } else {
      raw.push({ status: "missing", expected: a[i] });
      i += 1;
    }
  }

  // 把同一段里的漏掉与多打按顺序配对成“写错”
  const tokens: DiffToken[] = [];
  for (let k = 0; k < raw.length; ) {
    if (raw[k]!.status === "ok") {
      tokens.push(raw[k]!);
      k += 1;
      continue;
    }
    const missing: string[] = [];
    const extra: string[] = [];
    while (k < raw.length && raw[k]!.status !== "ok") {
      const tk = raw[k]!;
      if (tk.status === "missing") missing.push(tk.expected!);
      else extra.push(tk.typed!);
      k += 1;
    }
    const pairs = Math.min(missing.length, extra.length);
    for (let p = 0; p < pairs; p += 1) tokens.push({ status: "wrong", expected: missing[p], typed: extra[p] });
    for (const m of missing.slice(pairs)) tokens.push({ status: "missing", expected: m });
    for (const e of extra.slice(pairs)) tokens.push({ status: "extra", typed: e });
  }

  const correct = tokens.filter((t) => t.status === "ok").length;
  const denom = Math.max(a.length, b.length);
  return { tokens, correct, total: a.length, accuracy: denom ? correct / denom : 1 };
}

/** 原句中没写对（写错或漏掉）的词 */
export function missedWords(diff: SentenceDiff): string[] {
  return diff.tokens.filter((t) => t.status === "wrong" || t.status === "missing").map((t) => t.expected!);
}

/** 最常见的功能词：听写出错时不值得加入 Mark */
const STOP_WORDS = new Set(
  (
    "a an the and or but if so as at by for from in into of on onto to up with without about after before over under " +
    "i me my mine you your yours he him his she her hers it its we us our ours they them their theirs this that these those " +
    "is am are was were be been being have has had do does did will would shall should can could may might must " +
    "not no yes there here what which who whom whose when where why how all any some each every both few more most other such " +
    "than then too very just also only own same again ever even still yet now out off down let let's get got go goes went " +
    "i'm you're it's we're they're don't doesn't didn't can't won't isn't aren't wasn't weren't i'll i've i'd you'll we'll"
  ).split(" "),
);

export interface MarkCandidate {
  word: string;
  /** 写错算拼写问题，漏掉算没听出来 */
  reason: "spelling" | "pronunciation";
  /** 默认勾选：拼错的词与句子的目标词 */
  preselect: boolean;
}

/** 一组听写结束后，值得加入 Mark 的词（去掉功能词与过短的词，按出现顺序去重） */
export function markCandidates(results: { diff: SentenceDiff; target?: string }[]): MarkCandidate[] {
  const out = new Map<string, MarkCandidate>();
  for (const { diff, target } of results)
    for (const tk of diff.tokens) {
      if (tk.status !== "wrong" && tk.status !== "missing") continue;
      const w = tk.expected!;
      if (w.length < 3 || STOP_WORDS.has(w)) continue;
      const isTarget = Boolean(target && w.startsWith(target.toLowerCase().slice(0, Math.max(3, target.length - 2))));
      const reason = tk.status === "wrong" ? "spelling" : "pronunciation";
      const prev = out.get(w);
      out.set(w, {
        word: w,
        reason: prev?.reason === "spelling" ? "spelling" : reason,
        preselect: Boolean(prev?.preselect) || reason === "spelling" || isTarget,
      });
    }
  return [...out.values()];
}

/** 简单的词形还原候选：先原词，再去掉常见词尾（只对足够长的词，避免 has → ha） */
export function lemmaCandidates(word: string): string[] {
  const w = word.toLowerCase();
  const out = [w];
  if (w.length >= 5) {
    if (w.endsWith("ies")) out.push(`${w.slice(0, -3)}y`);
    if (w.endsWith("es")) out.push(w.slice(0, -2));
    if (w.endsWith("s") && !w.endsWith("ss")) out.push(w.slice(0, -1));
    if (w.endsWith("ed")) out.push(w.slice(0, -2), w.slice(0, -1));
    if (w.endsWith("ing")) out.push(w.slice(0, -3), `${w.slice(0, -3)}e`);
  }
  return [...new Set(out)].filter((x) => x.length >= 3);
}
