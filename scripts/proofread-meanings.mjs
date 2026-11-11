// 用 AI 校对英文词库的释义：只挑出明显不主流的词（常用义没放第一位、首义项生僻或不准、缺常用义、乱码），
// 其余原样不动。每条修正再盲评复核一次（原释义与修正打乱成 A / B，问哪个更主流），修正胜出才写回。
// 结果写入 scripts/data/meaning-fixes.json（可审阅、可手改：verified 为 true 的才写回），再写回各词库。
//
//   node --env-file=packages/core/eval/.env scripts/proofread-meanings.mjs          # 校对、复核（做过的跳过）并写回
//   node scripts/proofread-meanings.mjs --apply                                       # 只按 meaning-fixes.json 写回
//
// 环境变量：WREADT_AI_KEY（必填）、WREADT_AI_BASE_URL、WREADT_PROOFREAD_MODEL（默认 qwen-plus）、
//           WREADT_VERIFY_MODEL（复核用，默认 qwen-max）

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { trimMeanings } from "./unify-meanings.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const DICT_DIR = join(ROOT, "apps/web/public/dicts");
const FILES = ["2025KaoYanHongBaoShu.json", "CET4_T.json", "CET6_T.json", "IELTS_3_T.json", "GaoKao_3500.json", "itVocabulary.json"];
const OUT = join(ROOT, "scripts/data/meaning-fixes.json");
const BATCH = 40;
const CONCURRENCY = 4;

const SYSTEM = `你是一名词典编辑，为中国学习者校对英语单词的中文释义。
输入 JSON：{"words":[{"word":"...","meanings":["词性. 义项，近义说法；义项"]}]}
大多数释义没有问题，不要改。只挑出有明显问题的词：
- 当代最常用的意思没有放在第一位（如 click 应先是“点击”，却先写“发出喀嗒声”）；
- 第一个义项是生僻、过时或不准确的说法（如 possess 写成“占用”）；
- 缺少当代非常常用的意思；
- 释义为空、乱码或词性错误。
修正时：保留原有的正确写法与近义说法（不要删短），只调整顺序、替换错误义项、补上缺失的常用义；每个词性最多 2 组义项（组间用“；”），常用词性在前。
只输出 JSON：{"fixes":[{"word":"...","meanings":["n. ...","v. ..."],"reason":"一句话说明"}]}；没有问题的词不要输出。`;

const VERIFY = `你是一名词典编辑。每个英语单词有 A、B 两版中文释义，判断哪一版更适合中国学习者背单词：
当代最常用的意思排在最前、义项准确、没有生僻或过时的说法。两版差不多时选 same。
输入 JSON：{"items":[{"word":"...","A":["..."],"B":["..."]}]}
只输出 JSON：{"results":[{"word":"...","better":"A"|"B"|"same"}]}`;

const read = (f) => JSON.parse(readFileSync(join(DICT_DIR, f), "utf8"));
const fixes = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { checked: [], fixes: {} };
const POS_LINE = /^[a-z]+\. \S/;

/** AI 的修正要合格：每项带词性，最多 3 个词性、每个词性最多 2 组义项，且确实有变化 */
function accept(meanings, before) {
  if (!Array.isArray(meanings) || !meanings.length || !meanings.every((m) => typeof m === "string" && POS_LINE.test(m.trim()))) return null;
  const trimmed = trimMeanings(meanings.map((m) => m.trim())).slice(0, 3);
  return JSON.stringify(trimmed) === JSON.stringify(trimMeanings(before)) ? null : trimmed;
}

async function chat(system, payload, model) {
  const base = (process.env.WREADT_AI_BASE_URL ?? "https://maas.qianwenaiapi.com/compatible-mode/v1").replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.WREADT_AI_KEY}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(payload) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      enable_thinking: false,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}：${body.error?.message ?? res.statusText}`);
  return JSON.parse(body.choices?.[0]?.message?.content ?? "{}");
}

if (!process.argv.includes("--apply")) {
  if (!process.env.WREADT_AI_KEY) {
    console.error("缺少 WREADT_AI_KEY");
    process.exit(2);
  }
  // 每个词校对一次：以第一个收录它的词库（红宝书优先）的释义为准
  const words = new Map();
  for (const f of FILES) for (const w of read(f)) if (!words.has(w.name)) words.set(w.name, w.trans ?? []);
  const checked = new Set(fixes.checked);
  const todo = [...words].filter(([name]) => !checked.has(name));
  const batches = [];
  for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));
  console.log(`共 ${words.size} 个词，待校对 ${todo.length} 个，${batches.length} 批`);
  let done = 0;
  const save = () => {
    mkdirSync(join(ROOT, "scripts/data"), { recursive: true });
    fixes.checked = [...checked].sort();
    writeFileSync(OUT, `${JSON.stringify(fixes, null, 1)}\n`);
  };
  const worker = async () => {
    for (let batch = batches.shift(); batch; batch = batches.shift()) {
      try {
        const out = (await chat(SYSTEM, { words: batch.map(([word, meanings]) => ({ word, meanings })) }, process.env.WREADT_PROOFREAD_MODEL ?? "qwen-plus")).fixes ?? [];
        for (const fix of out) {
          const before = words.get(fix.word);
          const meanings = before && accept(fix.meanings, before);
          if (meanings) fixes.fixes[fix.word] = { meanings, reason: String(fix.reason ?? "").slice(0, 200) };
        }
        batch.forEach(([word]) => checked.add(word));
      } catch (err) {
        console.log(`一批失败（之后重跑会补上）：${err.message}`);
      }
      done += 1;
      if (done % 10 === 0) {
        save();
        console.log(`${done} 批完成，累计修正 ${Object.keys(fixes.fixes).length} 个`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  save();

  // 复核：原释义与修正随机排成 A / B，修正胜出才算数（verified）
  // 只截短、没改义项的旧记录不用复核（写回时也会跳过）
  const pending = Object.entries(fixes.fixes).filter(([word, f]) => f.verified === undefined && JSON.stringify(trimMeanings(words.get(word) ?? [])) !== JSON.stringify(f.meanings));
  const groups = [];
  for (let i = 0; i < pending.length; i += 30) groups.push(pending.slice(i, i + 30));
  console.log(`复核 ${pending.length} 条，${groups.length} 批`);
  const verifier = async () => {
    for (let group = groups.shift(); group; group = groups.shift()) {
      const flipped = new Map(group.map(([word]) => [word, Math.random() < 0.5]));
      const items = group.map(([word, f]) => {
        const old = trimMeanings(words.get(word) ?? []);
        return flipped.get(word) ? { word, A: f.meanings, B: old } : { word, A: old, B: f.meanings };
      });
      try {
        const { results = [] } = await chat(VERIFY, { items }, process.env.WREADT_VERIFY_MODEL ?? "qwen-max");
        for (const r of results) {
          const f = fixes.fixes[r.word];
          if (!f || !flipped.has(r.word)) continue;
          f.verified = r.better === (flipped.get(r.word) ? "A" : "B");
        }
      } catch (err) {
        console.log(`一批复核失败（之后重跑会补上）：${err.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, verifier));
  save();
  const all = Object.values(fixes.fixes);
  console.log(`复核通过 ${all.filter((f) => f.verified).length} / ${all.length}`);
}

for (const f of FILES) {
  const data = read(f);
  let n = 0;
  for (const w of data) {
    const fix = fixes.fixes[w.name];
    // 只是把义项截短（每个词性 2 组）的不算修正，保持原样
    if (fix?.verified && JSON.stringify(trimMeanings(w.trans ?? [])) !== JSON.stringify(fix.meanings)) {
      w.trans = fix.meanings;
      n += 1;
    }
  }
  // 沿用原文件的缩进
  const indent = /^( +)/.exec(readFileSync(join(DICT_DIR, f), "utf8").split("\n")[1] ?? "")?.[1].length ?? 4;
  writeFileSync(join(DICT_DIR, f), `${JSON.stringify(data, null, indent)}\n`);
  console.log(`${f}：写回 ${n} 个`);
}
