import { beforeEach, expect, it, vi } from "vitest";
import { db } from "../store/db";
import * as ai from "../services/ai";
import * as dicts from "../store/dicts";
import { BUILTIN_FEED, feedToScenario, loadFeed, recentScores, recordFeedScore } from "./feed";

const item = { topic: "T?", topicTrans: "", context: "", contextTrans: "", replies: [{ author: "a", stance: "s", text: "x", textTrans: "" }], usedWords: ["latency"] };

beforeEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(db.tables.map((t) => t.clear()));
  vi.spyOn(dicts, "lookupIndex").mockResolvedValue({ get: () => undefined });
});

it("没有 AI 时使用内置话题", async () => {
  vi.spyOn(ai, "aiSource").mockResolvedValue(null);
  expect(await loadFeed("dev", "zh-CN", ["simple", "medium"])).toEqual({ items: BUILTIN_FEED, source: "builtin" });
});

it("每天只生成一次，换一批时重新生成并避开旧话题", async () => {
  vi.spyOn(ai, "aiSource").mockResolvedValue("own");
  const gen = vi.spyOn(ai, "generateFeed").mockResolvedValue([item]);
  await loadFeed("dev", "zh-CN", ["simple", "medium"]);
  await loadFeed("dev", "zh-CN", ["simple", "medium"]);
  expect(gen).toHaveBeenCalledTimes(1);
  await loadFeed("dev", "zh-CN", ["simple", "medium"], true);
  expect(gen).toHaveBeenCalledTimes(2);
  expect(gen.mock.calls[1]![4]).toEqual(["T?"]);
  // 难度变化时重新生成
  await loadFeed("dev", "zh-CN", ["medium", "medium"]);
  expect(gen).toHaveBeenCalledTimes(3);
});

it("最近分数合并兴趣流回复与场景问答，按时间排序", async () => {
  await recordFeedScore(60);
  await recordFeedScore(80);
  expect(await recentScores()).toEqual([60, 80]);
});

it("话题转成简单场景题用于点评", () => {
  expect(feedToScenario(item)).toMatchObject({ level: "simple", question: "T?", recommendedWords: [{ word: "latency" }] });
});
