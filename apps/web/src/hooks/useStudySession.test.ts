import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { db } from "../store/db";
import { addCustomWord, markWord } from "../store/repo";
import { useStudySession } from "./useStudySession";

const FILES: Record<string, unknown[]> = {
  "roles/role-pm.json": [{ name: "backlog", trans: ["n. 待办"] }, { name: "roadmap", trans: ["n. 路线图"] }],
  "roles/role-qa.json": [{ name: "backlog", trans: ["n. 待办（重复）"] }, { name: "regression", trans: ["n. 回归"] }],
};

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => FILES[url.replace(/^.*dicts\//, "")] ?? [] })));
});

it("多选词库按单词去重，并混入我的词库", async () => {
  await addCustomWord({ lang: "en", answer: "kubernetes", meanings: ["容器编排"] });
  const { result } = renderHook(() => useStudySession({ dictIds: ["role-pm", "role-qa"], batchSize: 10, mixCount: 2 }));
  await waitFor(() => expect(result.current.status.kind).toBe("ready"));

  expect(result.current.allWords.map((w) => w.answer)).toEqual(["backlog", "roadmap", "regression"]);
  const batch = result.current.batch.map((w) => `${w.answer}@${w.dictId}`).sort();
  expect(batch).toEqual(["backlog@role-pm", "kubernetes@custom-en", "regression@role-qa", "roadmap@role-pm"]);
});

it("选中我的词库时不重复混入", async () => {
  await addCustomWord({ lang: "en", answer: "kubernetes", meanings: ["容器编排"] });
  const { result } = renderHook(() => useStudySession({ dictIds: ["custom-en"], batchSize: 10, mixCount: 3 }));
  await waitFor(() => expect(result.current.status.kind).toBe("ready"));
  expect(result.current.batch.map((w) => w.answer)).toEqual(["kubernetes"]);
});

it("mark 的词混入每组（同语言），专项练习只练指定的词", async () => {
  await markWord({ id: "en:kubernetes", dictId: "scenario", lang: "en", display: "kubernetes", answer: "kubernetes", meanings: [] });
  await markWord({ id: "ja:紙", dictId: "jlpt-n5", lang: "ja", display: "紙", answer: "kami", meanings: [] });
  const { result } = renderHook(() => useStudySession({ dictIds: ["role-pm"], batchSize: 10, markMixCount: 3 }));
  await waitFor(() => expect(result.current.status.kind).toBe("ready"));
  expect(result.current.batch.map((w) => w.answer).sort()).toEqual(["backlog", "kubernetes", "roadmap"]);
  expect(result.current.marks.has("en:kubernetes")).toBe(true);

  const focus = [{ id: "en:x", dictId: "d", lang: "en" as const, display: "x", answer: "xenial", meanings: [] }];
  const { result: r2 } = renderHook(() => useStudySession({ dictIds: ["role-pm"], batchSize: 10, markMixCount: 3, override: { key: "k", words: focus } }));
  await waitFor(() => expect(r2.current.status.kind).toBe("ready"));
  expect(r2.current.batch.map((w) => w.answer)).toEqual(["xenial"]);
});

it("专项练习的词即使都未到期也能练", async () => {
  const word = { id: "en:x", dictId: "d", lang: "en" as const, display: "x", answer: "xenial", meanings: [] };
  await db.cards.put({ id: "en:x", dictId: "d", due: Date.now() + 86_400_000, stability: 3, difficulty: 5, scheduledDays: 1, learningSteps: 0, reps: 2, lapses: 0, state: 2, updatedAt: 0 });
  const { result } = renderHook(() => useStudySession({ dictIds: ["role-pm"], batchSize: 10, override: { key: "k2", words: [word] } }));
  await waitFor(() => expect(result.current.status.kind).toBe("ready"));
  expect(result.current.batch.map((w) => w.answer)).toEqual(["xenial"]);
});

