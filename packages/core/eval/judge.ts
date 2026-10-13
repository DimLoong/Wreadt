// 用模型评审规则难以判断的问题：场景题是否自洽、推荐词是否与题目相关、是否硬塞了目标词。

import type { Issue } from "./checks.ts";

export const SCENARIO_JUDGE_PROMPT = `你是一名严格的出题质检员，检查一道英语“场景问答”题的质量。

输入是一个 JSON 对象：
- targetWords：出题时提供的候选词（可以不用，不应硬塞）；
- output：模型出的题，含 scenario、question、directions（回答方向）、keyPoints（要点）、recommendedWords（推荐词）。

逐项检查：
1. offTopic：directions 与 keyPoints 中，回答 question 本身时不会涉及、属于题外要求的条目（原文照抄）；
2. forcedWords：为了用上某个 targetWord 而生硬塞进 scenario、question、directions 或 keyPoints 的词；
3. irrelevantWords：recommendedWords 中回答本题时很难自然用上的词；
4. consistent：scenario、question、directions、keyPoints 之间是否互相一致、没有矛盾。

宁缺毋滥：只有明显的问题才列出，拿不准时不要列。

只输出 JSON：
{"consistent":true,"offTopic":["..."],"forcedWords":["..."],"irrelevantWords":["..."],"comment":"一句话中文总结"}`;

export interface ScenarioVerdict {
  consistent: boolean;
  offTopic: string[];
  forcedWords: string[];
  irrelevantWords: string[];
  comment: string;
}

const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);

export function parseVerdict(content: string): ScenarioVerdict {
  const r = JSON.parse(content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "")) as Record<string, unknown>;
  return {
    consistent: r.consistent !== false,
    offTopic: list(r.offTopic),
    forcedWords: list(r.forcedWords),
    irrelevantWords: list(r.irrelevantWords),
    comment: typeof r.comment === "string" ? r.comment : "",
  };
}

export function verdictIssues(v: ScenarioVerdict): Issue[] {
  const issues: Issue[] = [];
  if (!v.consistent) issues.push({ rule: "judge:consistent", severity: "error", detail: `题目不自洽：${v.comment}` });
  for (const t of v.offTopic) issues.push({ rule: "judge:offTopic", severity: "error", detail: `题外要求：${t}` });
  for (const t of v.forcedWords) issues.push({ rule: "judge:forced", severity: "error", detail: `硬塞的目标词：${t}` });
  for (const t of v.irrelevantWords) issues.push({ rule: "judge:irrelevant", severity: "warn", detail: `与题目关系不大的推荐词：${t}` });
  return issues;
}
