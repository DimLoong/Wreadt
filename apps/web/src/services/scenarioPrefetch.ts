import type { Scenario, ScenarioLevel } from "@wreadt/core";
import { aiSource, generateScenario, type TargetWord } from "./ai";
import { pickNews } from "../lib/news";

export interface ScenarioArgs {
  role: string;
  roleText: string;
  targets: TargetWord[];
  locale: string;
  level: ScenarioLevel;
  avoid?: string[];
  /** 感兴趣的方向：提供时约一半的题以今天的新闻为背景（题目更多样） */
  interests?: readonly string[];
}

/** 出一道场景题：有兴趣方向时约一半以今天的真实新闻为背景，其余为常规职场场景 */
export async function buildScenario(args: ScenarioArgs): Promise<Scenario> {
  const news = args.interests && Math.random() < 0.5 ? await pickNews(args.interests) : null;
  return generateScenario(args.roleText, args.targets, args.locale, args.level, args.avoid, news ?? undefined);
}

interface Slot {
  key: string;
  sig: string;
  promise: Promise<Scenario>;
}

// 出题较慢（10~30 秒），提前在后台生成；每个 key 只保留最近一次
const slots = new Map<string, Slot>();

const signature = (a: ScenarioArgs) => JSON.stringify([a.role, a.level, a.locale, a.targets.map((t) => t.word)]);

/** 后台预生成；没有可用 AI 时不做任何事 */
export async function prefetchScenario(key: string, args: ScenarioArgs): Promise<void> {
  const sig = signature(args);
  if (slots.get(key)?.sig === sig) return;
  if (!(await aiSource())) return;
  const promise = buildScenario(args);
  promise.catch(() => slots.get(key)?.promise === promise && slots.delete(key));
  slots.set(key, { key, sig, promise });
}

/** 读取预生成的题目（参数不一致时返回 undefined）。只读不删，题目展示后再调用 clearScenario，避免 StrictMode 重复执行时丢失 */
export function takeScenario(key: string, args?: ScenarioArgs): Promise<Scenario> | undefined {
  const slot = slots.get(key);
  if (!slot || (args && slot.sig !== signature(args))) return undefined;
  return slot.promise;
}

export function clearScenario(key: string) {
  slots.delete(key);
}

export function hasScenario(key: string): boolean {
  return slots.has(key);
}
