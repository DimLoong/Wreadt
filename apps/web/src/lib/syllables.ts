// 英文单词按音节拆分（cal·cu·late）。
// 优先使用 Moby Hyphenator II 的词典式音节划分（内置词库的单词，scripts/build-syllables.mjs 生成）；
// 查不到的词（如自己添加的词）退回 TeX 断字规则。TeX 规则是为排版换行设计的，会按构词断开
// （severity → sever·i·ty），与词典的音节划分（se·ver·i·ty）不完全一致，所以只作兜底。
// 两份数据都在第一次用到时才加载。

type Hyphenate = (text: string, options?: { hyphenChar?: string; minWordLength?: number }) => string;

let loader: Promise<void> | null = null;
let hyphenate: Hyphenate | null = null;
let moby: Record<string, number[]> | null = null;
const cache = new Map<string, number[]>();

/** 预先加载音节数据（打开打字页时调用，拼完时即可同步取到结果） */
export function loadSyllables(): Promise<void> {
  loader ??= Promise.all([
    // 静态文件（约 120 KB，gzip 后约 32 KB），浏览器会缓存
    fetch(`${import.meta.env.BASE_URL}syllables.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, number[]>>) : {}))
      .then((data) => {
        moby = data;
      })
      .catch(() => undefined),
    // CommonJS 包：开发与生产构建下导出形式不同，两种都兼容
    import("hyphen/en-us").then((m) => {
      const mod = m as { hyphenateSync?: Hyphenate; default?: { hyphenateSync: Hyphenate } };
      hyphenate = mod.hyphenateSync ?? mod.default!.hyphenateSync;
    }),
  ]).then(() => undefined);
  return loader;
}

const MARK = "­";

/** 单个单词的音节分界（词内下标） */
function wordBreaks(word: string): number[] {
  const lower = word.toLowerCase();
  const known = moby?.[lower];
  if (known) return known;
  if (!hyphenate || word.length < 4) return [];
  const breaks: number[] = [];
  let i = 0;
  for (const ch of hyphenate(word, { hyphenChar: MARK, minWordLength: 4 })) {
    if (ch === MARK) breaks.push(i);
    else i += 1;
  }
  return breaks;
}

/**
 * 音节分界：返回在哪些字母之前插入分隔点（答案中的下标）。数据未加载时返回空数组。
 * 短语按单词各自拆分，空格与短横线处本身就是分界，不再加点。
 */
export function syllableBreaks(answer: string): number[] {
  if (!moby && !hyphenate) return [];
  const hit = cache.get(answer);
  if (hit) return hit;
  const breaks: number[] = [];
  for (const m of answer.matchAll(/[A-Za-z]+/g)) for (const b of wordBreaks(m[0])) breaks.push(m.index + b);
  cache.set(answer, breaks);
  return breaks;
}
