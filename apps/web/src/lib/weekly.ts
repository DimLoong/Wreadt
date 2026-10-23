import { buildWeeklyReport, type WeeklyReport } from "@wreadt/core";
import { db } from "../store/db";
import { getMeta } from "../store/repo";
import { loadMistakeRecords } from "./spelling";

/** 读取本地数据生成 weekOf 所在周（及前一周）的周报 */
export async function loadWeeklyReport(weekOf: number): Promise<WeeklyReport> {
  const [logs, metas, practices, feedScores, mistakes] = await Promise.all([
    db.reviewLogs.toArray(),
    db.meta.filter((m) => m.key.startsWith("study:")).toArray(),
    db.practices.toArray(),
    getMeta<{ at: number; score: number }[]>("feedScores"),
    loadMistakeRecords(),
  ]);
  return buildWeeklyReport(weekOf, {
    logs: logs.map((l) => ({ wordId: l.wordId, reviewedAt: l.reviewedAt, errors: l.errors })),
    secondsByDay: new Map(metas.map((m) => [Number(m.key.slice(6)), Number(m.value) || 0])),
    practices: [...practices.map((p) => ({ at: p.createdAt, score: p.review && !p.review.offTopic ? p.review.score : null })), ...(feedScores ?? []).map((f) => ({ at: f.at, score: f.score }))],
    mistakes,
  });
}
