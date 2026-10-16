// 校验职业词库与话题词库的数据格式（也检查 packages/core/src/dict.ts 中登记的词数）。
//   node scripts/check-dicts.mjs            # 校验全部
//   node scripts/check-dicts.mjs topics     # 只校验 topics 目录
// 有问题时逐条列出并以退出码 1 结束。

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DICT_DIR = join(ROOT, "apps/web/public/dicts");
const DIRS = (process.argv[2] ? [process.argv[2]] : ["roles", "topics"]).filter((d) => existsSync(join(DICT_DIR, d)));
const POS = /^(n|v|adj|adv|phr|prep|conj|pron|int)\. \S/;
const KEYS = ["name", "trans", "usphone", "example", "exampleTrans"];
const registry = readFileSync(join(ROOT, "packages/core/src/dict.ts"), "utf8");

let problems = 0;
const report = (file, name, msg) => {
  problems += 1;
  console.log(`${file}  ${name ? `「${name}」` : ""}${msg}`);
};

for (const dir of DIRS) {
  for (const f of readdirSync(join(DICT_DIR, dir)).filter((x) => x.endsWith(".json")).sort()) {
    const rel = `${dir}/${f}`;
    const raw = readFileSync(join(DICT_DIR, dir, f), "utf8");
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      report(rel, "", `不是合法的 JSON：${err.message}`);
      continue;
    }
    if (!Array.isArray(data)) {
      report(rel, "", "顶层必须是数组");
      continue;
    }
    if (/\\u[0-9a-f]{4}/i.test(raw)) report(rel, "", "中文被转义成了 \\uXXXX，请用 ensure_ascii=False / 原样写入");
    const maxWords = dir === "topics" ? 6 : 4;
    const seen = new Set();
    for (const e of data) {
      const n = String(e.name ?? "");
      const keys = Object.keys(e).sort().join(",");
      if (keys !== [...KEYS].sort().join(",")) report(rel, n, `字段必须正好是 ${KEYS.join(" / ")}`);
      if (!/^[A-Za-z][A-Za-z' -]*$/.test(n) || n.split(" ").length > maxWords) report(rel, n, `name 只能含字母、空格、连字符、撇号，最多 ${maxWords} 个词`);
      if (n !== n.trim() || /\s{2,}/.test(n)) report(rel, n, "name 首尾或中间有多余空格");
      if (seen.has(n.toLowerCase())) report(rel, n, "重复词条");
      seen.add(n.toLowerCase());
      if (!Array.isArray(e.trans) || !e.trans.length || e.trans.length > 3 || !e.trans.every((t) => POS.test(t))) report(rel, n, "trans 须为 1～3 条、每条以词性开头（如 “n. 行李”）");
      if (!e.usphone || /[/[\]]/.test(e.usphone)) report(rel, n, "usphone 必填且不带斜杠 / 方括号");
      const ex = String(e.example ?? "");
      const len = ex.split(/\s+/).filter(Boolean).length;
      if (len < 6 || len > 20) report(rel, n, `例句长度 ${len} 词，须为 6～20 词`);
      const head = n.toLowerCase().split(" ")[0];
      const stem = head.slice(0, Math.max(3, head.length - 2));
      if (!ex.toLowerCase().includes(stem)) report(rel, n, "例句没有用到该词");
      if (!/[一-鿿]/.test(String(e.exampleTrans ?? ""))) report(rel, n, "exampleTrans 须为中文翻译");
    }
    // 词库登记：id 为文件名（去掉 .json），size 须等于实际词条数
    const id = f.replace(/\.json$/, "");
    const m = new RegExp(`id: "${id}"[^}]*file: "${dir}/${f}"[^}]*size: (\\d+)`).exec(registry);
    if (!m) report(rel, "", `packages/core/src/dict.ts 的 DICTIONARIES 里没有登记 id "${id}"（file 须为 "${dir}/${f}"）`);
    else if (Number(m[1]) !== data.length) report(rel, "", `dict.ts 登记的 size 为 ${m[1]}，实际 ${data.length} 条`);
  }
}

console.log(problems ? `\n共 ${problems} 处问题` : "OK");
process.exit(problems ? 1 : 0);
