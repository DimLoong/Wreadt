import { beforeEach, expect, it, vi } from "vitest";
import * as ai from "./ai";
import { clearScenario, hasScenario, prefetchScenario, takeScenario, type ScenarioArgs } from "./scenarioPrefetch";

const args: ScenarioArgs = { role: "role-dev", roleText: "dev", targets: [{ word: "latency", meaning: "", tag: "today" }], locale: "zh-CN", level: "simple" };
const scenario = { title: "t" } as never;

beforeEach(() => vi.restoreAllMocks());

it("预生成一次，参数相同复用、不同则不取", async () => {
  vi.spyOn(ai, "aiSource").mockResolvedValue("own");
  const gen = vi.spyOn(ai, "generateScenario").mockResolvedValue(scenario);
  await prefetchScenario("k", args);
  await prefetchScenario("k", args);
  expect(gen).toHaveBeenCalledTimes(1);
  expect(takeScenario("k", { ...args, level: "professional" })).toBeUndefined();
  await expect(takeScenario("k", args)).resolves.toBe(scenario);
  expect(hasScenario("k")).toBe(true);
  clearScenario("k");
  expect(hasScenario("k")).toBe(false);
});

it("没有 AI 时不预生成", async () => {
  vi.spyOn(ai, "aiSource").mockResolvedValue(null);
  const gen = vi.spyOn(ai, "generateScenario");
  await prefetchScenario("x", args);
  expect(gen).not.toHaveBeenCalled();
  expect(hasScenario("x")).toBe(false);
});
