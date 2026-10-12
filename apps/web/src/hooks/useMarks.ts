import { useLiveQuery } from "dexie-react-hooks";
import type { Mark } from "@wreadt/core";
import { db } from "../store/db";

/** 当前所有 mark（按单词标识索引），实时更新 */
export function useMarks(): Map<string, Mark> {
  const rows = useLiveQuery(() => db.marks.toArray(), []);
  return new Map((rows ?? []).filter((m) => !m.deleted).map((m) => [m.id, m]));
}
