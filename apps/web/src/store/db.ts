import Dexie, { type EntityTable } from "dexie";
import type { CardState, CustomWord, DictExtra, ReviewLog, SyncType } from "@wreadt/core";

export interface SettingRow {
  key: string;
  value: unknown;
  updatedAt: number;
}

/** 待推送到服务端的变更，`key = type:id`，同一记录多次修改只保留一条 */
export interface OutboxRow {
  key: string;
  type: SyncType;
  id: string;
  /** 入队序号：同步期间若记录再次修改，序号变化，推送成功后不会被误删 */
  seq: number;
}

/** 本地元数据：同步版本号、登录态等，不参与同步 */
export interface MetaRow {
  key: string;
  value: unknown;
}

export class WreadtDB extends Dexie {
  cards!: EntityTable<CardState, "id">;
  customWords!: EntityTable<CustomWord, "id">;
  dictExtras!: EntityTable<DictExtra, "id">;
  reviewLogs!: EntityTable<ReviewLog, "id">;
  settings!: EntityTable<SettingRow, "key">;
  outbox!: EntityTable<OutboxRow, "key">;
  meta!: EntityTable<MetaRow, "key">;

  constructor(name = "wreadt") {
    super(name);
    this.version(1).stores({
      cards: "id, dictId, due",
      customWords: "id, lang, answer",
      reviewLogs: "id, wordId, reviewedAt",
      settings: "key",
      outbox: "key",
      meta: "key",
    });
    this.version(2).stores({ dictExtras: "id, dictId" });
  }
}

export const db = new WreadtDB();
