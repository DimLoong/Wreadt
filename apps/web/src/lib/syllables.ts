// 英文单词按音节拆分（TeX 断字规则，如 calculate → cal·cu·late）。规则数据约 100 KB，第一次用到时才加载。

type Hyphenate = (text: string, options?: { hyphenChar?: string; minWordLength?: number }) => string;

let loader: Promise<Hyphenate> | null = null;
let hyphenate: Hyphenate | null = null;
const cache = new Map<string, number[]>();

/** 预先加载断字规则（打开打字页时调用，拼完时即可同步取到结果） */
export function loadSyllables(): Promise<Hyphenate> {
  // CommonJS 包：开发与生产构建下导出形式不同，两种都兼容
  loader ??= import("hyphen/en-us").then((m) => {
    const mod = m as { hyphenateSync?: Hyphenate; default?: { hyphenateSync: Hyphenate } };
    hyphenate = mod.hyphenateSync ?? mod.default!.hyphenateSync;
    return hyphenate;
  });
  return loader;
}

const MARK = "­";

/**
 * 音节分界：返回在哪些字母之前插入分隔点（答案中的下标）。规则未加载时返回空数组。
 * 短语按单词各自拆分，空格与短横线处本身就是分界，不再加点。
 */
export function syllableBreaks(answer: string): number[] {
  if (!hyphenate) return [];
  const hit = cache.get(answer);
  if (hit) return hit;
  const out = hyphenate(answer, { hyphenChar: MARK, minWordLength: 4 });
  const breaks: number[] = [];
  let i = 0;
  for (const ch of out) {
    if (ch === MARK) breaks.push(i);
    else i += 1;
  }
  cache.set(answer, breaks);
  return breaks;
}
