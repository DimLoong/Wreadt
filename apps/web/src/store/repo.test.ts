import { beforeEach, describe, expect, it } from "vitest";
import { Rating, reviewCard } from "@wreadt/core";
import { db } from "./db";
import { addCustomWord, deleteCustomWord, getCardsByDict, listCustomWords, saveReview, setSetting } from "./repo";
import { loadDictWords } from "./dicts";

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe("repo", () => {
  it("保存复习结果并进入待同步队列", async () => {
    const card = reviewCard(undefined, { id: "cet4:cat", dictId: "cet4" }, Rating.Good);
    await saveReview(card, { id: "log1", wordId: card.id, dictId: "cet4", grade: Rating.Good, reviewedAt: 1, durationMs: 1, errors: 0, updatedAt: 1 });
    expect((await getCardsByDict("cet4")).get("cet4:cat")?.reps).toBe(1);
    expect((await db.outbox.toArray()).map((r) => r.key).sort()).toEqual(["card:cet4:cat", "reviewLog:log1"]);
  });

  it("自定义词：同词覆盖、软删除", async () => {
    const a = await addCustomWord({ lang: "en", answer: "kubernetes", meanings: ["容器编排"] });
    const b = await addCustomWord({ lang: "en", answer: "kubernetes", meanings: ["k8s"] });
    expect(b.id).toBe(a.id);
    expect(await listCustomWords("en")).toHaveLength(1);
    expect((await loadDictWords("custom-en"))[0]).toMatchObject({ id: "custom-en:kubernetes", meanings: ["k8s"] });

    await deleteCustomWord(a.id);
    expect(await listCustomWords("en")).toHaveLength(0);
    expect((await db.customWords.get(a.id))?.deleted).toBe(true);
  });

  it("设置写入待同步队列", async () => {
    await setSetting("batchSize", 20);
    expect(await db.settings.get("batchSize")).toMatchObject({ value: 20 });
    expect(await db.outbox.get("setting:batchSize")).toBeTruthy();
  });
});
