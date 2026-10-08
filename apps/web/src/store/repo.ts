import { CUSTOM_DICT_ID, type CardState, type CustomWord, type Lang, type ReviewLog, type SyncType } from "@wreadt/core";
import { db } from "./db";

function enqueue(type: SyncType, id: string) {
  return db.outbox.put({ key: `${type}:${id}`, type, id });
}

export async function getCardsByDict(dictId: string): Promise<Map<string, CardState>> {
  const rows = await db.cards.where("dictId").equals(dictId).toArray();
  return new Map(rows.map((c) => [c.id, c]));
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
  const existing = await db.customWords.where("answer").equals(input.answer).filter((w) => w.lang === input.lang).first();
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

export { CUSTOM_DICT_ID };
