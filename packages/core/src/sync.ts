/** 与服务端 /api/sync 约定的数据结构，见 docs/api.md */
export type SyncType = "card" | "customWord" | "reviewLog" | "setting" | "dictExtra" | "mark";

export interface SyncRecord<T = unknown> {
  type: SyncType;
  id: string;
  updatedAt: number;
  deleted: boolean;
  data: T;
}

export interface SyncRequest {
  since: number;
  changes: SyncRecord[];
}

export interface SyncResponse {
  version: number;
  changes: SyncRecord[];
  hasMore: boolean;
}

export const SYNC_PUSH_LIMIT = 500;

/** 本地合并规则与服务端一致：更新时间不早于本地才覆盖 */
export function shouldApplyRemote(local: { updatedAt: number } | undefined, remote: { updatedAt: number }): boolean {
  return !local || remote.updatedAt >= local.updatedAt;
}
