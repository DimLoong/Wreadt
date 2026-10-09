import { beforeEach, describe, expect, it, vi } from "vitest";
import { Rating, reviewCard, type SyncRecord } from "@wreadt/core";
import { db } from "../store/db";
import { addCustomWord, getMeta, setMeta, setSetting } from "../store/repo";
import { prepareForNewAccount, syncNow } from "./sync";

/** 内存版服务端，实现 docs/api.md 的同步协议 */
function fakeServer() {
  let version = 0;
  const rows = new Map<string, SyncRecord & { version: number }>();
  const handler = vi.fn(async (_url: string, init: RequestInit) => {
    const { since, changes } = JSON.parse(String(init.body)) as { since: number; changes: SyncRecord[] };
    for (const c of changes) {
      const key = `${c.type}:${c.id}`;
      const stored = rows.get(key);
      if (!stored || c.updatedAt >= stored.updatedAt) rows.set(key, { ...c, version: ++version });
    }
    const out = [...rows.values()].filter((r) => r.version > since).sort((a, b) => a.version - b.version);
    return { ok: true, status: 200, json: async () => ({ version, changes: out, hasMore: false }) };
  });
  return { handler, rows, push: (c: SyncRecord) => rows.set(`${c.type}:${c.id}`, { ...c, version: ++version }) };
}

describe("syncNow", () => {
  let server: ReturnType<typeof fakeServer>;

  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await setMeta("session", { accessToken: "a", refreshToken: "r", expiresAt: Date.now() + 600_000, user: { id: "u", email: "a@b.c", emailVerified: true } });
    server = fakeServer();
    vi.stubGlobal("fetch", server.handler);
  });

  it("推送本地变更、清空队列并记录版本号", async () => {
    await setSetting("batchSize", 20);
    await addCustomWord({ lang: "en", answer: "kubernetes", meanings: [] });
    const result = await syncNow();

    expect(result.pushed).toBe(2);
    expect(await db.outbox.count()).toBe(0);
    expect(server.rows.get("setting:batchSize")?.data).toMatchObject({ key: "batchSize", value: 20 });
    expect(await getMeta("syncVersion")).toBe(2);
    expect(new Headers(server.handler.mock.calls[0]?.[1].headers).get("Authorization")).toBe("Bearer a");
  });

  it("拉取远端变更；本地更新的未推送修改不被覆盖", async () => {
    const card = reviewCard(undefined, { id: "cet4:cat", dictId: "cet4" }, Rating.Good, 1000);
    server.push({ type: "card", id: card.id, updatedAt: 1000, deleted: false, data: card });
    server.push({ type: "setting", id: "dark", updatedAt: 1000, deleted: false, data: { key: "dark", value: true, updatedAt: 1000 } });
    await db.settings.put({ key: "dark", value: false, updatedAt: 5000 });

    await syncNow();
    expect(await db.cards.get("cet4:cat")).toMatchObject({ reps: 1 });
    expect((await db.settings.get("dark"))?.value).toBe(false);
  });

  it("同步期间再次修改的记录保留在队列中", async () => {
    await setSetting("batchSize", 20);
    server.handler.mockImplementationOnce(async (url, init) => {
      await setSetting("batchSize", 25); // 请求进行中用户又改了设置
      return fakeServer().handler(url, init);
    });
    await syncNow();
    expect(await db.outbox.get("setting:batchSize")).toBeTruthy();
  });

  it("新账号登录时把本地全部数据加入队列", async () => {
    await db.cards.put(reviewCard(undefined, { id: "cet4:dog", dictId: "cet4" }, Rating.Good));
    await setMeta("syncVersion", 9);
    await prepareForNewAccount();
    expect(await db.outbox.get("card:cet4:dog")).toBeTruthy();
    expect(await getMeta("syncVersion")).toBe(0);
  });

  it("未登录时报错", async () => {
    await setMeta("session", null);
    await expect(syncNow()).rejects.toMatchObject({ status: 401 });
  });
});
