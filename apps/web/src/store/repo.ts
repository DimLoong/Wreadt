import {
  CUSTOM_DICT_ID,
  knownCard,
  wordKey,
  type CardState,
  type CustomWord,
  type DictExtra,
  type Mark,
  type MarkReason,
  type Lang,
  type QwertyEntry,
  type ReviewLog,
  type SyncType,
  type UserDict,
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

/** 用户创建的词库（不含已删除） */
export async function listUserDicts(): Promise<UserDict[]> {
  return (await db.userDicts.orderBy("createdAt").toArray()).filter((d) => !d.deleted);
}

/** 保存一个用户词库及其词条（词条存为 dictExtras，与内置词库的扩充共用同步） */
export async function saveUserDict(input: Pick<UserDict, "name" | "description" | "lang" | "topics">, entries: QwertyEntry[]): Promise<UserDict> {
  const now = Date.now();
  const dict: UserDict = { ...input, id: `user-${crypto.randomUUID()}`, createdAt: now, updatedAt: now };
  await db.transaction("rw", db.userDicts, db.outbox, async () => {
    await db.userDicts.put(dict);
    await enqueue("userDict", dict.id);
  });
  await addDictExtras(dict.id, dict.lang, entries);
  return dict;
}

export async function renameUserDict(id: string, name: string, description: string) {
  const dict = await db.userDicts.get(id);
  if (!dict) return;
  await db.transaction("rw", db.userDicts, db.outbox, async () => {
    await db.userDicts.put({ ...dict, name, description, updatedAt: Date.now() });
    await enqueue("userDict", id);
  });
}

/** 删除用户词库：词库与词条都标记删除（学习进度按单词保存，不受影响） */
export async function deleteUserDict(id: string) {
  const now = Date.now();
  await db.transaction("rw", db.userDicts, db.dictExtras, db.outbox, async () => {
    const dict = await db.userDicts.get(id);
    if (dict) {
      await db.userDicts.put({ ...dict, deleted: true, updatedAt: now });
      await enqueue("userDict", id);
    }
    for (const row of await db.dictExtras.where("dictId").equals(id).toArray()) {
      await db.dictExtras.put({ ...row, deleted: true, updatedAt: now });
      await enqueue("dictExtra", row.id);
    }
  });
}

/** mark 一个词（已 mark 时只更新快照与原因）；reason 可不选 */
export async function markWord(word: WordItem, reason?: MarkReason): Promise<Mark> {
  const now = Date.now();
  const existing = await db.marks.get(word.id);
  const { legacyId: _legacy, ...snapshot } = word;
  void _legacy;
  const mark: Mark = {
    id: word.id,
    word: snapshot,
    reason: reason ?? (existing && !existing.deleted ? existing.reason : undefined),
    note: existing?.note,
    createdAt: existing && !existing.deleted ? existing.createdAt : now,
    updatedAt: now,
    deleted: false,
  };
  await db.transaction("rw", db.marks, db.outbox, async () => {
    await db.marks.put(mark);
    await enqueue("mark", mark.id);
  });
  return mark;
}

export async function setMarkReason(id: string, reason: MarkReason | undefined): Promise<void> {
  await db.transaction("rw", db.marks, db.outbox, async () => {
    const mark = await db.marks.get(id);
    if (!mark || mark.deleted) return;
    await db.marks.put({ ...mark, reason, updatedAt: Date.now() });
    await enqueue("mark", id);
  });
}

export async function unmarkWords(ids: string[]): Promise<void> {
  const now = Date.now();
  await db.transaction("rw", db.marks, db.outbox, async () => {
    for (const id of ids) {
      const mark = await db.marks.get(id);
      if (!mark || mark.deleted) continue;
      await db.marks.put({ ...mark, deleted: true, updatedAt: now });
      await enqueue("mark", id);
    }
  });
}

/** 切换 mark 状态，返回切换后是否已 mark */
export async function toggleMark(word: WordItem): Promise<boolean> {
  const existing = await db.marks.get(word.id);
  if (existing && !existing.deleted) {
    await unmarkWords([word.id]);
    return false;
  }
  await markWord(word);
  return true;
}

export async function listMarks(): Promise<Mark[]> {
  return (await db.marks.orderBy("createdAt").reverse().toArray()).filter((m) => !m.deleted);
}

/** 批量标为“已认识”（摸底测试 / 我早就会了）：已经学过的词保留原有进度，不覆盖 */
export async function markKnown(words: WordItem[], now = Date.now()): Promise<number> {
  let count = 0;
  await db.transaction("rw", db.cards, db.reviewLogs, db.outbox, async () => {
    const existing = await db.cards.bulkGet(words.map((w) => w.id));
    const cards: CardState[] = [];
    words.forEach((w, i) => {
      const prev = existing[i];
      if (prev && !prev.deleted && prev.reps > 0) return;
      cards.push(knownCard(w, now));
    });
    await db.cards.bulkPut(cards);
    for (const c of cards) await enqueue("card", c.id);
    count = cards.length;
  });
  return count;
}

export { CUSTOM_DICT_ID };
