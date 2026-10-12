import { SYNC_PUSH_LIMIT, shouldApplyRemote, type SyncRecord, type SyncResponse, type SyncType } from "@wreadt/core";
import { db, type OutboxRow } from "../store/db";
import { enqueue, getMeta, setMeta } from "../store/repo";
import { authed } from "./api";

const VERSION_KEY = "syncVersion";
export const LAST_SYNC_KEY = "lastSyncAt";

type Row = { updatedAt: number; deleted?: boolean };

const tables = {
  card: () => db.cards,
  customWord: () => db.customWords,
  reviewLog: () => db.reviewLogs,
  setting: () => db.settings,
  dictExtra: () => db.dictExtras,
  mark: () => db.marks,
} as const;

async function readLocal(type: SyncType, id: string): Promise<Row | undefined> {
  return (tables[type]() as unknown as { get(id: string): Promise<Row | undefined> }).get(id);
}

async function toRecord(row: OutboxRow): Promise<SyncRecord | null> {
  const local = await readLocal(row.type, row.id);
  if (!local) return null;
  return { type: row.type, id: row.id, updatedAt: local.updatedAt, deleted: Boolean(local.deleted), data: local };
}

/** 应用服务端变更；不进入待推送队列。本地有更新的未推送修改时保留本地版本 */
async function applyRemote(changes: SyncRecord[]) {
  if (!changes.length) return;
  await db.transaction("rw", [db.cards, db.customWords, db.reviewLogs, db.settings, db.dictExtras, db.marks], async () => {
    for (const change of changes) {
      if (!(change.type in tables) || !change.data) continue;
      const table = tables[change.type]() as unknown as { put(v: unknown): Promise<unknown> };
      const local = await readLocal(change.type, change.id);
      if (shouldApplyRemote(local, change)) await table.put({ ...(change.data as object), deleted: change.deleted, updatedAt: change.updatedAt });
    }
  });
}

let running: Promise<SyncResult> | null = null;

export interface SyncResult {
  pushed: number;
  pulled: number;
}

/** 推送本地待同步变更并拉取服务端增量；并发调用会合并为一次 */
export function syncNow(): Promise<SyncResult> {
  running ??= (async () => {
    let since = (await getMeta<number>(VERSION_KEY)) ?? 0;
    let pushed = 0;
    let pulled = 0;
    for (;;) {
      const outbox = await db.outbox.limit(SYNC_PUSH_LIMIT).toArray();
      const records = (await Promise.all(outbox.map(toRecord))).filter((r): r is SyncRecord => r !== null);
      const res = await authed<SyncResponse>("/sync", { method: "POST", json: { since, changes: records } });

      await applyRemote(res.changes);
      // 只删除推送期间没有再次修改的条目
      await db.transaction("rw", db.outbox, async () => {
        for (const row of outbox) {
          const current = await db.outbox.get(row.key);
          if (current?.seq === row.seq) await db.outbox.delete(row.key);
        }
      });
      since = res.version;
      await setMeta(VERSION_KEY, since);
      pushed += records.length;
      pulled += res.changes.length;

      const morePending = outbox.length === SYNC_PUSH_LIMIT;
      if (!res.hasMore && !morePending) break;
    }
    await setMeta(LAST_SYNC_KEY, Date.now());
    return { pushed, pulled };
  })().finally(() => {
    running = null;
  });
  return running;
}

/** 首次在本设备登录（或换账号）时：从头拉取，并把本地已有数据全部推送一次 */
export async function prepareForNewAccount() {
  await setMeta(VERSION_KEY, 0);
  await setMeta(LAST_SYNC_KEY, null);
  const all: [SyncType, string[]][] = [
    ["card", (await db.cards.toCollection().primaryKeys()) as string[]],
    ["customWord", (await db.customWords.toCollection().primaryKeys()) as string[]],
    ["reviewLog", (await db.reviewLogs.toCollection().primaryKeys()) as string[]],
    ["setting", (await db.settings.toCollection().primaryKeys()) as string[]],
    ["dictExtra", (await db.dictExtras.toCollection().primaryKeys()) as string[]],
    ["mark", (await db.marks.toCollection().primaryKeys()) as string[]],
  ];
  await db.transaction("rw", db.outbox, async () => {
    for (const [type, ids] of all) for (const id of ids) await enqueue(type, id);
  });
}
