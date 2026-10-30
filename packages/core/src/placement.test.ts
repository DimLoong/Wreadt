import { buildLevels, buildPlacement, knownCard, knownDays, levelConfirmed, unconfirmedLevels, nextPlacementBatch, placementConfidence, placementSettled, type PlacementItem, PSEUDO_WORDS_EN, scorePlacement, wordsToMarkKnown } from "./placement.ts";
import type { WordItem } from "./types.ts";

const w = (id: string, dictId: string): WordItem => ({ id: `en:${id}`, dictId, lang: "en", display: id, answer: id, meanings: [] });
const range = (prefix: string, n: number, dict: string) => Array.from({ length: n }, (_, i) => w(`${prefix}${i}`, dict));

const dicts = {
  gaokao: range("g", 20, "gaokao"),
  cet4: [...range("g", 5, "cet4"), ...range("c", 20, "cet4")],
  cet6: range("s", 20, "cet6"),
  kaoyan: range("k", 10, "kaoyan"),
  ielts: [...range("k", 5, "ielts"), ...range("i", 10, "ielts")],
};
const seq = (() => {
  let x = 0.37;
  return () => (x = (x * 9301 + 0.49297) % 1);
})();

it("buildLevels 每个词只属于最低一级", () => {
  const levels = buildLevels("en", dicts);
  expect(levels.map((l) => l.words.length)).toEqual([20, 20, 20, 20]);
});

it("buildPlacement 每级抽题、跳过已学、混入假词", () => {
  const levels = buildLevels("en", dicts);
  const items = buildPlacement("en", levels, { perLevel: 5, pseudo: 4, exclude: new Set(["en:g0", "en:g1"]), random: seq });
  expect(items).toHaveLength(24);
  expect(items.filter((i) => i.level === null)).toHaveLength(4);
  expect(items.some((i) => i.word.id === "en:g0")).toBe(false);
  for (const i of items.filter((x) => x.level === null)) expect(PSEUDO_WORDS_EN).toContain(i.word.answer);
});

it("scorePlacement 用假词误报率校正，整级达标时整级标记", () => {
  const levels = buildLevels("en", dicts);
  const items = buildPlacement("en", levels, { perLevel: 8, pseudo: 4, random: seq });
  const answers = new Map<string, boolean>();
  for (const i of items) answers.set(i.word.id, i.level === "gaokao" || i.level === "cet4" || (i.level === "cet6" && i.word.answer < "s4"));
  const result = scorePlacement(levels, items, answers);
  expect(result.falseAlarm).toBe(0);
  expect(result.levels.map((l) => l.ratio >= 0.85)).toEqual([true, true, false, false]);
  expect(result.estimate).toBeGreaterThanOrEqual(40);
  const marked = wordsToMarkKnown(levels, items, answers, result);
  expect(marked.filter((m) => m.dictId === "gaokao" || m.dictId === "cet4")).toHaveLength(40);

  // 把假词全点成认识：误报率 100%，什么都不标
  const bluff = new Map(items.map((i) => [i.word.id, true]));
  const r2 = scorePlacement(levels, items, bluff);
  expect(r2.falseAlarm).toBe(1);
  expect(r2.estimate).toBe(0);
  expect(wordsToMarkKnown(levels, items, bluff, r2)).toHaveLength(0);
});

it("knownCard 到期时间在 1～6 个月之间", () => {
  const now = Date.UTC(2026, 9, 13);
  const card = knownCard(w("x", "cet4"), now, () => 0.5);
  expect(card.reps).toBe(1);
  expect(card.state).toBe(2);
  expect((card.due - now) / 86_400_000).toBe(105);
});

it("nextPlacementBatch 从最简单的级别开始，没过的级别之上不再出题", () => {
  const levels = buildLevels("en", dicts);
  const asked: PlacementItem[] = [];
  const answers = new Map<string, boolean>();
  // 只认识高考词的学习者
  const answerAll = (batch: PlacementItem[]) => {
    for (const i of batch) answers.set(i.word.id, i.level === "gaokao");
    asked.push(...batch);
  };
  const first = nextPlacementBatch("en", levels, asked, answers, { random: seq });
  expect(first).toHaveLength(5);
  expect(first.filter((i) => i.level).every((i) => i.level === "gaokao")).toBe(true);
  answerAll(first);
  expect(placementSettled(levels, asked, answers)).toBe(false);
  const second = nextPlacementBatch("en", levels, asked, answers, { random: seq });
  expect(second.filter((i) => i.level).every((i) => i.level === "cet4")).toBe(true);
  answerAll(second);
  // 四级没过：爬梯结束，之后只在高考与四级之间加题
  expect(placementSettled(levels, asked, answers)).toBe(true);
  for (let n = 0; n < 6; n += 1) {
    const more = nextPlacementBatch("en", levels, asked, answers, { random: seq });
    expect(more.every((i) => i.level === null || i.level === "gaokao" || i.level === "cet4")).toBe(true);
    answerAll(more);
  }
  expect(asked.some((i) => i.level === "cet6" || i.level === "advanced")).toBe(false);
  expect(new Set(asked.map((i) => i.word.id)).size).toBe(asked.length);
  expect(placementConfidence(10)).toBe("low");
  expect(placementConfidence(25)).toBe("medium");
  expect(placementConfidence(40)).toBe("high");
});

it("nextPlacementBatch 全都认识时一路爬到最高级", () => {
  const levels = buildLevels("en", dicts);
  const asked: PlacementItem[] = [];
  const answers = new Map<string, boolean>();
  for (let n = 0; n < 4; n += 1) {
    const batch = nextPlacementBatch("en", levels, asked, answers, { random: seq });
    for (const i of batch) answers.set(i.word.id, i.level !== null);
    asked.push(...batch);
  }
  expect(asked.filter((i) => i.level).map((i) => i.level)).toEqual(expect.arrayContaining(["gaokao", "cet4", "cet6", "advanced"]));
  expect(placementSettled(levels, asked, answers)).toBe(true);
});

it("整级标记需要足够样本，或被更高一级印证", () => {
  const level = (asked: number, ratio: number) => ({ id: "x", name: "x", size: 100, ratio, known: Math.round(asked * ratio), asked });
  const r = { falseAlarm: 0, estimate: 0, levels: [level(4, 1), level(4, 1), level(4, 0.25), level(0, 0)] };
  expect(levelConfirmed(r, 0)).toBe(true); // 被四级印证
  expect(levelConfirmed(r, 1)).toBe(false); // 只答了 4 题，六级没过
  expect(unconfirmedLevels(r)).toHaveLength(1);
  r.levels[1] = level(8, 1);
  expect(levelConfirmed(r, 1)).toBe(true);
});

it("knownDays：按单词固定在 30～179 天", () => {
  expect(knownDays("en:gather")).toBe(knownDays("en:gather"));
  for (const id of ["en:a", "en:alignment", "ja:kami"]) {
    expect(knownDays(id)).toBeGreaterThanOrEqual(30);
    expect(knownDays(id)).toBeLessThan(180);
  }
  expect(knownCard(w("x", "cet4"), 0).scheduledDays).toBe(knownDays(w("x", "cet4").id));
});
