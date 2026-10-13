import { beforeEach, expect, it, vi } from "vitest";
import { db } from "../store/db";
import * as ai from "../services/ai";
import * as dicts from "../store/dicts";
import { BUILTIN_FEED, feedToScenario, loadFeed } from "./feed";

const item = { topic: "T?", topicTrans: "", context: "", contextTrans: "", replies: [{ author: "a", stance: "s", text: "x", textTrans: "" }], usedWords: ["latency"] };

beforeEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(db.tables.map((t) => t.clear()));
  vi.spyOn(dicts, "lookupIndex").mockResolvedValue({ get: () => undefined });
});

it("没有 AI 时使用内置话题", async () => {
  vi.spyOn(ai, "aiSource").mockResolvedValue(null);
  expect(await loadFeed("dev", "zh-CN")).toEqual({ items: BUILTIN_FEED, source: "builtin" });
});

it("每天只生成一次，换一批时重新生成并避开旧话题", async () => {
  vi.spyOn(ai, "aiSource").mockResolvedValue("own");
  const gen = vi.spyOn(ai, "generateFeed").mockResolvedValue([item]);
  await loadFeed("dev", "zh-CN");
  await loadFeed("dev", "zh-CN");
  expect(gen).toHaveBeenCalledTimes(1);
  await loadFeed("dev", "zh-CN", true);
  expect(gen).toHaveBeenCalledTimes(2);
  expect(gen.mock.calls[1]![4]).toEqual(["T?"]);
});

it("话题转成简单场景题用于点评", () => {
  expect(feedToScenario(item)).toMatchObject({ level: "simple", question: "T?", recommendedWords: [{ word: "latency" }] });
});
