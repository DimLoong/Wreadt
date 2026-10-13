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

/** 渐进式摸底：每轮每级 2 个词（英文再加 2 个假词），至少答完 2 轮即可出结果，最多 5 轮，越多越准 */
export const PLACEMENT_ROUND = { perLevel: 2, pseudo: 2 };
export const PLACEMENT_MIN_ROUNDS = 2;
export const PLACEMENT_MAX_ROUNDS = 5;

/** 生成下一轮题目，跳过已学过的词和本次已经问过的词 */
export function buildPlacementRound(
  lang: Lang,
  levels: LevelWords[],
  asked: PlacementItem[],
  opts: { exclude?: Set<string>; random?: () => number } = {},
): PlacementItem[] {
  const exclude = new Set([...(opts.exclude ?? []), ...asked.map((i) => i.word.id)]);
  return buildPlacement(lang, levels, { perLevel: PLACEMENT_ROUND.perLevel, pseudo: lang === "en" ? PLACEMENT_ROUND.pseudo : 0, exclude, random: opts.random });
}

export type PlacementConfidence = "low" | "medium" | "high";

/** 按已完成的轮数给出结果的可信度 */
export function placementConfidence(rounds: number): PlacementConfidence {
  return rounds >= PLACEMENT_MAX_ROUNDS ? "high" : rounds > PLACEMENT_MIN_ROUNDS ? "medium" : "low";
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

/**
 * 根据结果决定要标为已认识的词：认识率 ≥ 85% 的级别整级标记；
 * 其余级别只标记本次点了“认识”的词（误报率过高时这些也不标）。
 */
export function wordsToMarkKnown(levels: LevelWords[], items: PlacementItem[], answers: Map<string, boolean>, result: PlacementResult): WordItem[] {
  const out = new Map<string, WordItem>();
  for (const l of levels) {
    const r = result.levels.find((x) => x.id === l.id);
    if (r && r.ratio >= LEVEL_KNOWN_THRESHOLD) for (const w of l.words) out.set(w.id, w);
  }
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
