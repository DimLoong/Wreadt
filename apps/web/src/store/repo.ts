import {
  CUSTOM_DICT_ID,
  wordKey,
  type CardState,
  type CustomWord,
  type DictExtra,
  type Lang,
  type QwertyEntry,
  type ReviewLog,
  type SyncType,
  type WordItem,
} from "@wreadt/core";
import { db } from "./db";

let seq = 0;

export function enqueue(type: SyncType, id: string) {
  seq += 1;
  return db.outbox.put({ key: `${type}:${id}`, type, id, seq: Date.now() * 1000 + (seq % 1000) });
}

export async function getAllCards(): Promise<Map<string, CardState>> {
  const rows = await db.cards.toArray();
  return new Map(rows.filter((c) => !c.deleted).map((c) => [c.id, c]));
}

/**
 * 旧版卡片按“词库:单词”区分，新版按单词共享进度。加载词库时把这些词的旧卡片迁移到新 id：
 * 同一个词在多个词库都学过时保留最近复习的那张；旧卡片标记删除并同步，其他设备也会收到。
 */
export async function migrateLegacyCards(words: WordItem[]): Promise<number> {
  const byLegacy = new Map(words.filter((w) => w.legacyId && w.legacyId !== w.id).map((w) => [w.legacyId!, w]));
  if (!byLegacy.size) return 0;
  const dictIds = [...new Set(words.map((w) => w.dictId))];
  return db.transaction("rw", db.cards, db.outbox, async () => {
    const legacy = (await db.cards.where("dictId").anyOf(dictIds).toArray()).filter((c) => !c.deleted && byLegacy.has(c.id));
    const now = Date.now();
    for (const old of legacy) {
      const word = byLegacy.get(old.id)!;
      const current = await db.cards.get(word.id);
      if (!current || current.deleted || (old.lastReview ?? 0) > (current.lastReview ?? 0)) {
        await db.cards.put({ ...old, id: word.id, updatedAt: now, deleted: false });
        await enqueue("card", word.id);
      }
      await db.cards.put({ ...old, deleted: true, updatedAt: now });
      await enqueue("card", old.id);
    }
    return legacy.length;
  });
}

export async function saveReview(card: CardState, log: ReviewLog): Promise<void> {
  await db.transaction("rw", db.cards, db.reviewLogs, db.outbox, async () => {
    await db.cards.put(card);
    await db.reviewLogs.put(log);
    await enqueue("card", card.id);
    await enqueue("reviewLog", log.id);
  });
}

export async function addCustomWord(input: Omit<CustomWord, "id" | "createdAt" | "updatedAt">): Promise<CustomWord> {
  const now = Date.now();
  const key = wordKey(input.lang, input.answer, input.display);
  const existing = await db.customWords.filter((w) => w.lang === input.lang && wordKey(w.lang, w.answer, w.display) === key).first();
  const word: CustomWord = { ...input, id: existing?.id ?? crypto.randomUUID(), createdAt: existing?.createdAt ?? now, updatedAt: now, deleted: false };
  await db.transaction("rw", db.customWords, db.outbox, async () => {
    await db.customWords.put(word);
    await enqueue("customWord", word.id);
  });
  return word;
}

export async function deleteCustomWord(id: string): Promise<void> {
  await db.transaction("rw", db.customWords, db.outbox, async () => {
    const word = await db.customWords.get(id);
    if (!word) return;
    await db.customWords.put({ ...word, deleted: true, updatedAt: Date.now() });
    await enqueue("customWord", id);
  });
}

export async function listCustomWords(lang: Lang): Promise<CustomWord[]> {
  const rows = await db.customWords.where("lang").equals(lang).toArray();
  return rows.filter((w) => !w.deleted).sort((a, b) => a.createdAt - b.createdAt);
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.transaction("rw", db.settings, db.outbox, async () => {
    await db.settings.put({ key, value, updatedAt: Date.now() });
    await enqueue("setting", key);
  });
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function listDictExtras(dictId: string): Promise<QwertyEntry[]> {
  const rows = await db.dictExtras.where("dictId").equals(dictId).toArray();
  return rows.filter((r) => !r.deleted).sort((a, b) => a.createdAt - b.createdAt).map((r) => r.entry);
}

/** 给内置词库追加词条（如 AI 扩充职业词库） */
export async function addDictExtras(dictId: string, lang: Lang, entries: QwertyEntry[]): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", db.dictExtras, db.outbox, async () => {
    for (const entry of entries) {
      const row: DictExtra = { id: `${dictId}|${wordKey(lang, entry.name)}`, dictId, entry, createdAt: now, updatedAt: now };
      await db.dictExtras.put(row);
      await enqueue("dictExtra", row.id);
    }
  });
}

export { CUSTOM_DICT_ID };
