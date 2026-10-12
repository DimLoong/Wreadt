import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { db } from "../store/db";
import { addCustomWord } from "../store/repo";
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
  const { result } = renderHook(() => useStudySession(["role-pm", "role-qa"], 10, 2));
  await waitFor(() => expect(result.current.status.kind).toBe("ready"));

  expect(result.current.allWords.map((w) => w.answer)).toEqual(["backlog", "roadmap", "regression"]);
  const batch = result.current.batch.map((w) => `${w.answer}@${w.dictId}`).sort();
  expect(batch).toEqual(["backlog@role-pm", "kubernetes@custom-en", "regression@role-qa", "roadmap@role-pm"]);
});

it("选中我的词库时不重复混入", async () => {
  await addCustomWord({ lang: "en", answer: "kubernetes", meanings: ["容器编排"] });
  const { result } = renderHook(() => useStudySession(["custom-en"], 10, 3));
  await waitFor(() => expect(result.current.status.kind).toBe("ready"));
  expect(result.current.batch.map((w) => w.answer)).toEqual(["kubernetes"]);
});
