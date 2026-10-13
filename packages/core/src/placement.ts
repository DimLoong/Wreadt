import { State, type CardState } from "./scheduler.ts";
import type { Lang, WordItem } from "./types.ts";

/** 词库难度阶梯：一个词归入它出现的最低一级 */
export const PLACEMENT_LEVELS: Record<Lang, { id: string; name: string; dicts: string[] }[]> = {
  en: [
    { id: "gaokao", name: "高考", dicts: ["gaokao"] },
    { id: "cet4", name: "四级", dicts: ["cet4"] },
    { id: "cet6", name: "六级", dicts: ["cet6"] },
    { id: "advanced", name: "考研 / 雅思", dicts: ["kaoyan", "ielts"] },
  ],
  ja: [
    { id: "n5", name: "N5", dicts: ["jlpt-n5"] },
    { id: "n4", name: "N4", dicts: ["jlpt-n4"] },
    { id: "n3", name: "N3", dicts: ["jlpt-n3"] },
    { id: "n2", name: "N2", dicts: ["jlpt-n2"] },
    { id: "n1", name: "N1", dicts: ["jlpt-n1"] },
  ],
};

/**
 * 看起来像英文、但并不存在的假词（参考 LexTALE 词汇测试的做法）。
 * 用来估计“随便点认识”的比例并校正结果。
 */
export const PSEUDO_WORDS_EN = [
  "platery", "plaudate", "kermshaw", "alberation", "mensible", "exprate", "purrage", "quirty",
  "pudour", "crumper", "fellick", "proom", "pristen", "kilp", "magrity", "abergy", "spaunch", "rebondicate",
];

export interface LevelWords {
  id: string;
  name: string;
  /** 该级别独有的词（低级别出现过的不再计入） */
  words: WordItem[];
}

/** 把各级词库去重分层：每个词只属于它出现的最低一级 */
export function buildLevels(lang: Lang, dicts: Record<string, WordItem[]>): LevelWords[] {
  const seen = new Set<string>();
  return PLACEMENT_LEVELS[lang].map((level) => {
    const words: WordItem[] = [];
    for (const d of level.dicts)
      for (const w of dicts[d] ?? []) {
        if (seen.has(w.id)) continue;
        seen.add(w.id);
        words.push(w);
      }
    return { id: level.id, name: level.name, words };
  });
}

export interface PlacementItem {
  /** 真词为所属级别 id；假词为 null */
  level: string | null;
  word: WordItem;
}

function sample<T>(list: T[], n: number, random: () => number): T[] {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}

/** 生成一套摸底题：每级抽 perLevel 个（跳过已学过的词），英文混入 pseudo 个假词，整体打乱 */
export function buildPlacement(
  lang: Lang,
  levels: LevelWords[],
  opts: { perLevel?: number; pseudo?: number; exclude?: Set<string>; random?: () => number } = {},
): PlacementItem[] {
  const { perLevel = 8, pseudo = lang === "en" ? 6 : 0, exclude = new Set(), random = Math.random } = opts;
  const items: PlacementItem[] = levels.flatMap((l) =>
    sample(l.words.filter((w) => !exclude.has(w.id)), perLevel, random).map((word) => ({ level: l.id, word })),
  );
  if (lang === "en")
    for (const fake of sample(PSEUDO_WORDS_EN.filter((f) => !exclude.has(`pseudo:${f}`)), pseudo, random))
      items.push({ level: null, word: { id: `pseudo:${fake}`, dictId: "pseudo", lang: "en", display: fake, answer: fake, meanings: [] } });
  return sample(items, items.length, random);
}

/**
 * 自适应摸底（爬梯）：从最简单的级别开始，每批 4 个真词（英文再混 1 个假词）。
 * 一级认识过半才升到下一级；某级没过就停止往上，之后的题集中在“过了的最高级”和“没过的那一级”之间，越答越准。
 * 没考到的更高级别按“不会”计，结论偏保守，不会把还不会的词跳过。
 */
export const PLACEMENT_BATCH = { real: 4, pseudo: 1 };
/** 一级认识过半才继续往上 */
export const PLACEMENT_PASS_RATIO = 0.5;
/** 爬梯结束且至少答了这么多题即可出结果 */
export const PLACEMENT_MIN_ANSWERS = 10;
export const PLACEMENT_MAX_ANSWERS = 50;

interface LevelTally {
  asked: number;
  known: number;
}

function tally(levels: LevelWords[], asked: PlacementItem[], answers: Map<string, boolean>): LevelTally[] {
  return levels.map((l) => {
    const items = asked.filter((i) => i.level === l.id && answers.has(i.word.id));
    return { asked: items.length, known: items.filter((i) => answers.get(i.word.id)).length };
  });
}

const passed = (t: LevelTally) => t.asked > 0 && t.known / t.asked >= PLACEMENT_PASS_RATIO;

/** 爬梯阶段下一个要考的级别；爬梯结束返回 -1 */
function climbTarget(levels: LevelWords[], tallies: LevelTally[], available: (i: number) => boolean): number {
  for (let i = 0; i < levels.length; i += 1) {
    const t = tallies[i]!;
    if (t.asked < PLACEMENT_BATCH.real && available(i)) return i;
    if (t.asked > 0 && !passed(t)) return -1;
  }
  return -1;
}

/** 爬梯结束（所有已答的题都已作答，且不需要再往上考） */
export function placementSettled(levels: LevelWords[], asked: PlacementItem[], answers: Map<string, boolean>): boolean {
  if (asked.some((i) => !answers.has(i.word.id))) return false;
  return climbTarget(levels, tally(levels, asked, answers), () => true) < 0;
}

/**
 * 生成下一批题。爬梯阶段考下一级；爬梯结束后在边界附近加题（过了的最高级与没过的那一级中，答得少的那个）。
 * 没有可出的题或已达上限时返回空数组。
 */
export function nextPlacementBatch(
  lang: Lang,
  levels: LevelWords[],
  asked: PlacementItem[],
  answers: Map<string, boolean>,
  opts: { exclude?: Set<string>; random?: () => number } = {},
): PlacementItem[] {
  if (asked.length >= PLACEMENT_MAX_ANSWERS) return [];
  const random = opts.random ?? Math.random;
  const used = new Set([...(opts.exclude ?? []), ...asked.map((i) => i.word.id)]);
  const pool = (i: number) => levels[i]!.words.filter((w) => !used.has(w.id));
  const available = (i: number) => pool(i).length > 0;
  const tallies = tally(levels, asked, answers);

  let target = climbTarget(levels, tallies, available);
  if (target < 0) {
    // 边界：最后一个过了的级别、第一个没过的级别
    const firstFail = tallies.findIndex((t) => t.asked > 0 && !passed(t));
    const lastPass = firstFail < 0 ? tallies.length - 1 : firstFail - 1;
    const candidates = [lastPass, firstFail].filter((i) => i >= 0 && available(i));
    if (!candidates.length) return [];
    target = candidates.sort((a, b) => tallies[a]!.asked - tallies[b]!.asked)[0]!;
  }

  const batch: PlacementItem[] = sample(pool(target), PLACEMENT_BATCH.real, random).map((word) => ({ level: levels[target]!.id, word }));
  if (lang === "en") {
    const fakes = PSEUDO_WORDS_EN.filter((f) => !used.has(`pseudo:${f}`));
    for (const fake of sample(fakes, PLACEMENT_BATCH.pseudo, random))
      batch.push({ level: null, word: { id: `pseudo:${fake}`, dictId: "pseudo", lang: "en", display: fake, answer: fake, meanings: [] } });
  }
  return sample(batch, batch.length, random);
}

export type PlacementConfidence = "low" | "medium" | "high";

/** 按已答题数给出结果的可信度 */
export function placementConfidence(answered: number): PlacementConfidence {
  return answered >= 35 ? "high" : answered >= 20 ? "medium" : "low";
}

export interface LevelResult {
  id: string;
  name: string;
  size: number;
  /** 校正后的认识比例 0~1 */
  ratio: number;
  known: number;
  asked: number;
}

export interface PlacementResult {
  levels: LevelResult[];
  /** 把假词点成“认识”的比例 */
  falseAlarm: number;
  /** 估计词汇量（各级大小 × 校正后比例之和） */
  estimate: number;
}

/**
 * 计算结果。按“认识率 − 误报率”做校正：r' = (r − f) / (1 − f)，
 * 避免把随手点“认识”的人估得过高。
 */
export function scorePlacement(levels: LevelWords[], items: PlacementItem[], answers: Map<string, boolean>): PlacementResult {
  const fakes = items.filter((i) => i.level === null);
  const falseAlarm = fakes.length ? fakes.filter((i) => answers.get(i.word.id)).length / fakes.length : 0;
  const result = levels.map((l) => {
    const asked = items.filter((i) => i.level === l.id);
    const known = asked.filter((i) => answers.get(i.word.id)).length;
    const raw = asked.length ? known / asked.length : 0;
    const ratio = falseAlarm >= 1 ? 0 : Math.max(0, (raw - falseAlarm) / (1 - falseAlarm));
    return { id: l.id, name: l.name, size: l.words.length, ratio, known, asked: asked.length };
  });
  return { levels: result, falseAlarm, estimate: Math.round(result.reduce((s, l) => s + l.size * l.ratio, 0)) };
}

/** 整级标为“已认识”的门槛 */
export const LEVEL_KNOWN_THRESHOLD = 0.85;
/** 整级标记至少要答过的题数（更高一级也达标时可以互相印证，不受此限） */
export const LEVEL_CONFIRM_ASKED = 8;

/** 某一级是否可以整级标为已认识 */
export function levelConfirmed(result: PlacementResult, index: number): boolean {
  const l = result.levels[index];
  if (!l || l.ratio < LEVEL_KNOWN_THRESHOLD) return false;
  if (l.asked >= LEVEL_CONFIRM_ASKED) return true;
  const higher = result.levels[index + 1];
  return Boolean(higher && higher.asked > 0 && higher.ratio >= LEVEL_KNOWN_THRESHOLD);
}

/** 认识率达标、但样本还不够确认整级的级别（提示用户再答几题） */
export function unconfirmedLevels(result: PlacementResult): LevelResult[] {
  return result.levels.filter((l, i) => l.ratio >= LEVEL_KNOWN_THRESHOLD && !levelConfirmed(result, i));
}

/**
 * 根据结果决定要标为已认识的词：认识率 ≥ 85% 且样本足够（或被更高一级印证）的级别整级标记；
 * 其余级别只标记本次点了“认识”的词（误报率过高时这些也不标）。
 */
export function wordsToMarkKnown(levels: LevelWords[], items: PlacementItem[], answers: Map<string, boolean>, result: PlacementResult): WordItem[] {
  const out = new Map<string, WordItem>();
  levels.forEach((l, i) => {
    if (levelConfirmed(result, i)) for (const w of l.words) out.set(w.id, w);
  });
  if (result.falseAlarm < 0.34)
    for (const i of items) if (i.level && answers.get(i.word.id)) out.set(i.word.id, i.word);
  return [...out.values()];
}

const DAY = 86_400_000;

/**
 * “已认识”的卡片：直接进入复习状态，1～6 个月后随机抽查一次（分散到期时间，避免某天集中出现）。
 * 抽查时如果拼错，FSRS 会自然把它拉回正常复习。
 */
export function knownCard(word: Pick<WordItem, "id" | "dictId">, now = Date.now(), random = Math.random): CardState {
  const days = 30 + Math.floor(random() * 150);
  return {
    id: word.id,
    dictId: word.dictId,
    due: now + days * DAY,
    stability: days,
    difficulty: 3,
    scheduledDays: days,
    learningSteps: 0,
    reps: 1,
    lapses: 0,
    state: State.Review,
    lastReview: now,
    updatedAt: now,
  };
}
