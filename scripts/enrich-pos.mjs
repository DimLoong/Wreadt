// 给英文词库中缺词性的释义补上词性。
//
// 词性来自 ECDICT（https://github.com/skywind3000/ECDICT，MIT 许可）。只在本地处理时使用，不随应用分发：
//   curl -L -o /tmp/ecdict.csv https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv
//   node scripts/enrich-pos.mjs /tmp/ecdict.csv
//
// 做法：保留词库原有的释义，只按释义内容到 ECDICT 中匹配对应词性的那一行，加上前缀（如“爆炸的”→“adj. 爆炸的”）。
// 同时规范已有的写法：a. → adj.，ad. → adv.，末尾的 (vt.) 移到前面，去掉误写的 “undefined ”。
// 匹配不上的保持原样，宁缺毋滥。

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ecdictPath = process.argv[2];
if (!ecdictPath) {
  console.error("用法：node scripts/enrich-pos.mjs <ecdict.csv>");
  process.exit(2);
}

const DICT_DIR = new URL("../apps/web/public/dicts/", import.meta.url).pathname;
const FILES = ["CET4_T.json", "CET6_T.json", "IELTS_3_T.json", "GaoKao_3500.json", "2025KaoYanHongBaoShu.json", "itVocabulary.json", "BIOmedical.json"];

const POS_ALIAS = { a: "adj", ad: "adv", adj: "adj", adv: "adv", n: "n", v: "v", vt: "vt", vi: "vi", prep: "prep", conj: "conj", pron: "pron", num: "num", int: "int", interj: "int", art: "art", aux: "aux", det: "det" };
const POS_RE = /^\s*(a|ad|adj|adv|n|v|vt|vi|prep|conj|pron|num|int|interj|art|aux|det)\.\s*/i;

/** 解析 CSV 的一行（字段可能带引号，内部换行已被转义为字面量 \n） */
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

console.log("读取 ECDICT……");
const ecdict = new Map();
const lines = readFileSync(ecdictPath, "utf8").split("\n");
for (const line of lines.slice(1)) {
  if (!line) continue;
  const [word, , , translation] = parseCsvLine(line);
  if (!word || !translation) continue;
  const senses = translation
    .split("\\n")
    .map((l) => {
      const m = POS_RE.exec(l);
      return m ? { pos: POS_ALIAS[m[1].toLowerCase()], text: l.slice(m[0].length) } : null;
    })
    .filter(Boolean);
  if (senses.length) ecdict.set(word.toLowerCase(), senses);
}
console.log(`ECDICT 共 ${ecdict.size} 个带词性的词条`);

const cjk = (s) => [...s].filter((c) => /[㐀-鿿]/.test(c) && !"的地得之了是被使有".includes(c));
const bigrams = (s) => {
  const chars = [...s.replace(/[^㐀-鿿]/g, " ")];
  const out = new Set();
  for (let i = 0; i + 1 < chars.length; i += 1) if (chars[i] !== " " && chars[i + 1] !== " ") out.add(chars[i] + chars[i + 1]);
  return out;
};

/** 为一条没有词性的释义找词性：先比较双字重合，再比较单字重合；只有一种词性时直接用 */
function guessPos(meaning, senses) {
  const kinds = [...new Set(senses.map((s) => s.pos))];
  const mb = bigrams(meaning);
  const mc = new Set(cjk(meaning));
  let best = null;
  let bestScore = 0;
  let tie = false;
  for (const s of senses) {
    const sb = bigrams(s.text);
    const score = [...mb].filter((b) => sb.has(b)).length * 3 + cjk(s.text).filter((c) => mc.has(c)).length;
    if (score > bestScore) {
      best = s.pos;
      bestScore = score;
      tie = false;
    } else if (score === bestScore && score > 0 && s.pos !== best) tie = true;
  }
  if (best && bestScore >= 2 && !tie) return best;
  return kinds.length === 1 ? kinds[0] : null;
}

/** 规范已有的写法 */
function normalize(meaning) {
  let m = meaning.replace(/^undefined\s+/, "").trim();
  // 末尾的 (vt.) 移到前面
  const tail = /\s*\((a|ad|adj|adv|n|v|vt|vi|prep|conj|pron)\.\)\s*$/i.exec(m);
  if (tail && !POS_RE.test(m)) m = `${POS_ALIAS[tail[1].toLowerCase()]}. ${m.slice(0, tail.index).trim()}`;
  // a. / ad. → adj. / adv.（只改词性位置：开头或空白之后）
  m = m.replace(/(^|\s)a\.(?=\s|[㐀-鿿])/g, "$1adj.").replace(/(^|\s)ad\.(?=\s|[㐀-鿿])/g, "$1adv.");
  return m;
}

let total = 0;
let added = 0;
let missing = 0;
for (const file of FILES) {
  const path = join(DICT_DIR, file);
  const raw = readFileSync(path, "utf8");
  const indent = /\n( +)/.exec(raw)?.[1].length ?? 2;
  const data = JSON.parse(raw);
  let fileAdded = 0;
  for (const entry of data) {
    const isString = typeof entry.trans === "string";
    const trans = isString ? entry.trans.split(/\s*[；;]\s*(?=[㐀-鿿])/).filter(Boolean) : entry.trans ?? [];
    const senses = ecdict.get(String(entry.name).trim().toLowerCase());
    const next = trans.map((t) => {
      total += 1;
      const m = normalize(t);
      if (POS_RE.test(m) || /^phr\./.test(m)) return m;
      const pos = senses && guessPos(m, senses);
      if (!pos) {
        missing += 1;
        return m;
      }
      added += 1;
      fileAdded += 1;
      return `${pos}. ${m}`;
    });
    entry.trans = next;
  }
  writeFileSync(path, `${JSON.stringify(data, null, indent)}\n`);
  console.log(`${file}：补上 ${fileAdded} 条`);
}
console.log(`共 ${total} 条释义，补上词性 ${added} 条，仍无词性 ${missing} 条`);
