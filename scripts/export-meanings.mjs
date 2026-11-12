// 导出待人工校对的英文释义：每个词一行（word<TAB>[词库] 释义，不同写法用 “  ||  ” 隔开），按每份 400 词切开。
// 词库简称：考研 CET4 CET6 雅思 高考 IT
// 已经校对过的词（scripts/data/meaning-reviewed.txt）跳过。
//   node scripts/export-meanings.mjs <输出目录>

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DICT_DIR = join(ROOT, "apps/web/public/dicts");
const FILES = { "2025KaoYanHongBaoShu.json": "考研", "CET4_T.json": "CET4", "CET6_T.json": "CET6", "IELTS_3_T.json": "雅思", "GaoKao_3500.json": "高考", "itVocabulary.json": "IT" };
const REVIEWED = join(ROOT, "scripts/data/meaning-reviewed.txt");
const PER_FILE = 400;

const out = process.argv[2];
if (!out) {
  console.error("用法：node scripts/export-meanings.mjs <输出目录>");
  process.exit(2);
}
const reviewed = new Set(existsSync(REVIEWED) ? readFileSync(REVIEWED, "utf8").split("\n").filter(Boolean) : []);
const words = new Map();
for (const [f, short] of Object.entries(FILES)) {
  for (const w of JSON.parse(readFileSync(join(DICT_DIR, f), "utf8"))) {
    if (reviewed.has(w.name)) continue;
    if (!words.has(w.name)) words.set(w.name, new Map());
    const text = (w.trans ?? []).join(" / ");
    const variants = words.get(w.name);
    variants.set(text, [...(variants.get(text) ?? []), short]);
  }
}
const lines = [...words].map(([name, variants]) => `${name}\t${[...variants].map(([text, dicts]) => `[${dicts.join(",")}] ${text}`).join("  ||  ")}`);
mkdirSync(out, { recursive: true });
for (let i = 0; i * PER_FILE < lines.length; i += 1) {
  writeFileSync(join(out, `p${String(i).padStart(2, "0")}.tsv`), `${lines.slice(i * PER_FILE, (i + 1) * PER_FILE).join("\n")}\n`);
}
console.log(`待校对 ${lines.length} 个词，${Math.ceil(lines.length / PER_FILE)} 份，写入 ${out}`);
