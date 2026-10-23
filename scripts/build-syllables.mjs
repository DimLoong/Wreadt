// 生成音节划分数据：从 Moby Hyphenator II（公有领域，Project Gutenberg #3204）中取出内置英文词库用到的单词。
//   node scripts/build-syllables.mjs
// 输出 apps/web/public/syllables.json（运行时按需 fetch）：{ "severity": [2, 5, 6] } —— 在这些下标的字母之前分音节（se·ver·i·ty）。
// 原始文件约 2.6 MB，只下载到临时目录，不入库。新增或修改英文词库后重新运行。

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = new URL("..", import.meta.url).pathname;
const SOURCE = "https://www.gutenberg.org/files/3204/files/mhyph.txt";
const cache = join(tmpdir(), "wreadt-mhyph.txt");

if (!existsSync(cache)) {
  console.log("下载 Moby Hyphenator II …");
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`下载失败：HTTP ${res.status}`);
  writeFileSync(cache, Buffer.from(await res.arrayBuffer()));
}

// 文件为 Latin-1 编码，音节之间用 0xA5 分隔
const SEP = "¥";
const moby = new Map();
for (const raw of readFileSync(cache, "latin1").split(/\r?\n/)) {
  if (!raw || raw.includes(" ")) continue;
  const word = raw.replaceAll(SEP, "");
  if (!/^[A-Za-z'-]+$/.test(word)) continue;
  if (!moby.has(word.toLowerCase())) moby.set(word.toLowerCase(), raw);
}

// 内置英文词库中出现的单词（短语拆成单词，4 个字母以上才可能有多个音节）
const registry = readFileSync(join(ROOT, "packages/core/src/dict.ts"), "utf8");
const files = [...registry.matchAll(/lang: "en"[^}]*file: "([^"]+)"/g)].map((m) => m[1]);
const words = new Set();
for (const f of files) {
  for (const e of JSON.parse(readFileSync(join(ROOT, "apps/web/public/dicts", f), "utf8"))) {
    for (const w of String(e.name ?? "").toLowerCase().split(/[\s/=()-]+/)) if (w.length >= 4 && /^[a-z]+$/.test(w)) words.add(w);
  }
}

const out = {};
let missing = 0;
for (const w of [...words].sort()) {
  const m = moby.get(w);
  if (!m) {
    missing += 1;
    continue;
  }
  const breaks = [];
  let i = 0;
  for (const ch of m) {
    if (ch === SEP) breaks.push(i);
    else i += 1;
  }
  if (breaks.length) out[w] = breaks;
}

writeFileSync(join(ROOT, "apps/web/public/syllables.json"), JSON.stringify(out));
console.log(`词库单词 ${words.size} 个：多音节 ${Object.keys(out).length} 个写入，Moby 中没有 ${missing} 个（运行时改用 TeX 断字规则）`);
