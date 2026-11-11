// 统一考试词库的释义：同一个词在 CET4 / CET6 / 雅思 / 高考词库里改用 2025 考研红宝书的释义。
//   node scripts/unify-meanings.mjs
//
// 原词库（来自 qwerty-learner）的释义偏旧、偏简，义项顺序随意（如 possess 写成“占用，拥有”）；
// 红宝书的释义较新，常用义在前。每个词性只取前 2 组义项，避免过长、带出冷门义项。
// 美式音标与红宝书差得很远的（多种读法混写、写成别的词的音标），一并换成红宝书的。
// 红宝书里没有的词保持原样。可重复运行。

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DICT_DIR = new URL("../apps/web/public/dicts/", import.meta.url).pathname;
const SOURCE = "2025KaoYanHongBaoShu.json";
const TARGETS = ["CET4_T.json", "CET6_T.json", "IELTS_3_T.json", "GaoKao_3500.json"];
const GROUPS_PER_POS = 2;

const POS = /(?:^|[；;\s])((?:n|v|vt|vi|adj|adv|prep|conj|pron|num|int|art|aux|abbr)\.)\s*/g;

/** 按词性拆开，每个词性保留前几组义项：["v. 拥有，具有；控制，支配；占有"] → ["v. 拥有，具有；控制，支配"] */
export function trimMeanings(trans) {
  const text = trans.join("；");
  const marks = [...text.matchAll(POS)];
  if (!marks.length) return trans;
  return marks.map((m, i) => {
    const body = text.slice(m.index + m[0].length, marks[i + 1]?.index ?? text.length);
    const groups = body
      .split(/[；;]/)
      .map((g) => g.trim())
      .filter(Boolean);
    return `${m[1]} ${groups.slice(0, GROUPS_PER_POS).join("；")}`;
  });
}

const norm = (s) =>
  (s ?? "")
    .replace(/['ˈˌː.\s/()[\]]/g, "")
    .replace(/ɛ/g, "e")
    .replace(/ɝ|ɚ/g, "ər")
    .replace(/ɡ/g, "g")
    .replace(/r/g, "");

function distance(a, b) {
  const d = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i += 1) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length];
}

/** 原音标与红宝书相差超过四成：多种读法混写、注释、或是别的词的音标 */
function phoneticOff(mine, ref) {
  const a = norm(mine);
  const b = norm(ref);
  return !a || distance(a, b) / Math.max(a.length, b.length) > 0.4;
}

const read = (f) => JSON.parse(readFileSync(join(DICT_DIR, f), "utf8"));
const source = new Map(read(SOURCE).map((w) => [w.name, w]));

for (const file of TARGETS) {
  const data = read(file);
  let meanings = 0;
  let phones = 0;
  for (const w of data) {
    const ref = source.get(w.name);
    if (!ref) continue;
    const trans = trimMeanings(ref.trans);
    if (JSON.stringify(trans) !== JSON.stringify(w.trans)) {
      w.trans = trans;
      meanings += 1;
    }
    if (ref.usphone && phoneticOff(w.usphone, ref.usphone)) {
      w.usphone = ref.usphone.replace(/\./g, "");
      phones += 1;
    }
  }
  writeFileSync(join(DICT_DIR, file), `${JSON.stringify(data, null, 4)}\n`);
  console.log(`${file}：释义更新 ${meanings} 个，音标更新 ${phones} 个`);
}
