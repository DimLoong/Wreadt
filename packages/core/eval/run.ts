// AI 测试集：用真实模型跑固定输入，逐条做规则检查与模型评审。
//
// 用法（在仓库根目录）：
//   pnpm eval:ai                    # 全部用例
//   pnpm eval:ai --only scenario    # 只跑 id 含 scenario 的用例
//   pnpm eval:ai --repeat 3         # 每个用例跑 3 次，看稳定性
//   pnpm eval:ai --no-judge         # 不做模型评审，只做规则检查
//
// Key 只从环境变量读取（也可写在 packages/core/eval/.env，已被 git 忽略）：
//   WREADT_AI_KEY=...               # 必填
//   WREADT_AI_BASE_URL=...          # 默认千问 maas 接口
//   WREADT_AI_MODEL=...             # 默认 qwen-flash
//   WREADT_AI_JUDGE_MODEL=...       # 评审用的模型，默认同上（建议用更强的模型）

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AI_PRESETS, AI_PROMPTS, isQwenEndpoint } from "../src/ai.ts";
import { checkOutput, type Issue } from "./checks.ts";
import { EVAL_CASES, type EvalCase } from "./fixtures.ts";
import { parseVerdict, SCENARIO_JUDGE_PROMPT, verdictIssues } from "./judge.ts";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const apiKey = process.env.WREADT_AI_KEY;
const baseUrl = (process.env.WREADT_AI_BASE_URL ?? AI_PRESETS[0]!.baseUrl).replace(/\/+$/, "");
const model = process.env.WREADT_AI_MODEL ?? AI_PRESETS[0]!.model;
const judgeModel = process.env.WREADT_AI_JUDGE_MODEL ?? model;
const repeat = Math.max(1, Number(option("--repeat") ?? 1));
const only = option("--only");
const judge = !flag("--no-judge");
const concurrency = Math.max(1, Number(option("--concurrency") ?? 3));

if (!apiKey) {
  console.error("缺少 WREADT_AI_KEY。请在终端设置环境变量，或写入 packages/core/eval/.env（不要提交）。");
  process.exit(2);
}

/** 与 apps/web/src/services/ai.ts 的 chatDirect 保持相同的请求参数 */
async function chat(system: string, user: string, useModel: string, temperature = 0.7): Promise<string> {
  const hinted = system.includes("json") ? system : `${system}\n\nRespond with a valid json object only.`;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: useModel,
      messages: [
        { role: "system", content: hinted },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature,
      ...(isQwenEndpoint(baseUrl) ? { enable_thinking: false } : {}),
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string }; choices?: { message?: { content?: string } }[] };
  if (!res.ok) throw new Error(`HTTP ${res.status}：${body.error?.message ?? res.statusText}`);
  return body.choices?.[0]?.message?.content ?? "";
}

interface RunResult {
  id: string;
  task: string;
  note: string;
  attempt: number;
  ms: number;
  issues: Issue[];
  output: string;
  verdict?: unknown;
}

async function runCase(c: EvalCase, attempt: number): Promise<RunResult> {
  const started = Date.now();
  let output = "";
  let issues: Issue[];
  let verdict: unknown;
  try {
    output = await chat(AI_PROMPTS[c.task], JSON.stringify(c.input), model);
    issues = checkOutput(c.task, c.input, output, c.forbid, c.require);
    if (judge && c.task === "scenario-question" && !issues.some((i) => i.rule === "parse")) {
      try {
        const out = JSON.parse(output) as Record<string, unknown>;
        const payload = {
          targetWords: c.input.targetWords,
          output: { scenario: out.scenario, question: out.question, directions: out.directions, keyPoints: out.keyPoints, recommendedWords: out.recommendedWords },
        };
        const v = parseVerdict(await chat(SCENARIO_JUDGE_PROMPT, JSON.stringify(payload), judgeModel, 0));
        verdict = v;
        issues.push(...verdictIssues(v));
      } catch (err) {
        issues.push({ rule: "judge", severity: "warn", detail: `评审失败：${(err as Error).message}` });
      }
    }
  } catch (err) {
    issues = [{ rule: "request", severity: "error", detail: (err as Error).message }];
  }
  return { id: c.id, task: c.task, note: c.note, attempt, ms: Date.now() - started, issues, output, verdict };
}

/** 有限并发地执行，避免触发服务商限流 */
async function pool<T, R>(list: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(list.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        out[i] = await fn(list[i]!);
      }
    }),
  );
  return out;
}

const cases = EVAL_CASES.filter((c) => !only || c.id.includes(only) || c.task.includes(only));
const jobs = cases.flatMap((c) => Array.from({ length: repeat }, (_, i) => ({ c, attempt: i + 1 })));
console.log(`模型 ${model} @ ${baseUrl}${judge ? `，评审模型 ${judgeModel}` : "，不做评审"}；${cases.length} 个用例 × ${repeat} 次\n`);

const results = await pool(jobs, concurrency, async ({ c, attempt }) => {
  const r = await runCase(c, attempt);
  const errors = r.issues.filter((i) => i.severity === "error");
  const warns = r.issues.filter((i) => i.severity === "warn");
  const mark = errors.length ? "✗" : warns.length ? "△" : "✓";
  console.log(`${mark} ${r.id}${repeat > 1 ? ` #${attempt}` : ""}  ${(r.ms / 1000).toFixed(1)}s`);
  for (const i of [...errors, ...warns]) console.log(`    ${i.severity === "error" ? "错误" : "提醒"} [${i.rule}] ${i.detail}`);
  return r;
});

const failed = results.filter((r) => r.issues.some((i) => i.severity === "error"));
const warned = results.filter((r) => !failed.includes(r) && r.issues.length);
console.log(`\n通过 ${results.length - failed.length}/${results.length}（其中 ${warned.length} 个有提醒），失败 ${failed.length}`);

// 完整输出写入报告，便于人工复查（reports/ 已被 git 忽略）
const dir = join(dirname(fileURLToPath(import.meta.url)), "reports");
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const file = join(dir, `${stamp}-${model.replace(/[^\w.-]/g, "_")}.json`);
writeFileSync(file, JSON.stringify({ model, judgeModel: judge ? judgeModel : null, baseUrl, results }, null, 2));
console.log(`报告：${file}`);

process.exit(failed.length ? 1 : 0);
