import type { Scenario } from "@wreadt/core";
import { db, type PracticeRow } from "../store/db";

export async function saveNewPractice(scenario: Scenario, role: string): Promise<PracticeRow> {
  const row: PracticeRow = { id: crypto.randomUUID(), createdAt: Date.now(), role, scenario, answer: "" };
  await db.practices.put(row);
  return row;
}
