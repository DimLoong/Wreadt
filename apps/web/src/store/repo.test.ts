import { beforeEach, describe, expect, it } from "vitest";
import { Rating, reviewCard } from "@wreadt/core";
import { db } from "./db";
import { addCustomWord, addDictExtras, deleteCustomWord, getAllCards, listCustomWords, listDictExtras, migrateLegacyCards, saveReview, setSetting } from "./repo";
import { loadDictWords } from "./dicts";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("repo", () => {
  it("保存复习结果并进入待同步队列", async () => {
    const card = reviewCard(undefined, { id: "en:cat", dictId: "cet4" }, Rating.Good);
    await saveReview(card, { id: "log1", wordId: card.id, dictId: "cet4", grade: Rating.Good, reviewedAt: 1, durationMs: 1, errors: 0, updatedAt: 1 });
    expect((await getAllCards()).get("en:cat")?.reps).toBe(1);
    expect((await db.outbox.toArray()).map((r) => r.key).sort()).toEqual(["card:en:cat", "reviewLog:log1"]);
  });

  it("自定义词：同词覆盖、软删除", async () => {
    const a = await addCustomWord({ lang: "en", answer: "kubernetes", meanings: ["容器编排"] });
    const b = await addCustomWord({ lang: "en", answer: "kubernetes", meanings: ["k8s"] });
    expect(b.id).toBe(a.id);
    expect(await listCustomWords("en")).toHaveLength(1);
    expect((await loadDictWords("custom-en"))[0]).toMatchObject({ id: "en:kubernetes", meanings: ["k8s"] });

    await deleteCustomWord(a.id);
    expect(await listCustomWords("en")).toHaveLength(0);
    expect((await db.customWords.get(a.id))?.deleted).toBe(true);
  });

  it("设置写入待同步队列", async () => {
    await setSetting("batchSize", 20);
    expect(await db.settings.get("batchSize")).toMatchObject({ value: 20 });
    expect(await db.outbox.get("setting:batchSize")).toBeTruthy();
  });

  it("日语同音不同写法的自定义词不合并", async () => {
    await addCustomWord({ lang: "ja", answer: "kami", display: "紙", meanings: ["纸"] });
    await addCustomWord({ lang: "ja", answer: "kami", display: "神", meanings: ["神"] });
    expect(await listCustomWords("ja")).toHaveLength(2);
  });

  it("旧版按词库区分的卡片迁移为按单词共享，保留最近复习的一张", async () => {
    const old = (id: string, dictId: string, lastReview: number) => ({ ...reviewCard(undefined, { id, dictId }, Rating.Good, lastReview), lastReview });
    await db.cards.bulkPut([old("cet4:cancel", "cet4", 100), old("cet6:cancel", "cet6", 200)]);
    const word = (dictId: string) => ({ id: "en:cancel", dictId, lang: "en" as const, display: "cancel", answer: "cancel", meanings: [], legacyId: `${dictId}:cancel` });

    expect(await migrateLegacyCards([word("cet4")])).toBe(1);
    expect(await migrateLegacyCards([word("cet6")])).toBe(1);
    expect(await migrateLegacyCards([word("cet6")])).toBe(0);

    const cards = await getAllCards();
    expect([...cards.keys()]).toEqual(["en:cancel"]);
    expect(cards.get("en:cancel")?.lastReview).toBe(200);
    expect((await db.cards.get("cet4:cancel"))?.deleted).toBe(true);
    expect(await db.outbox.get("card:cet4:cancel")).toBeTruthy();
  });

  it("词库扩充词条", async () => {
    await addDictExtras("role-pm", "en", [{ name: "North Star", trans: ["n. 北极星指标"] }]);
    expect(await listDictExtras("role-pm")).toEqual([{ name: "North Star", trans: ["n. 北极星指标"] }]);
    expect(await db.outbox.get("dictExtra:role-pm|en:north star")).toBeTruthy();
  });
});
