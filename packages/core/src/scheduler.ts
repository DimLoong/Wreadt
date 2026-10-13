import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";
import type { WordItem } from "./types.ts";
import type { Mistake } from "./spelling.ts";

export { Rating, State };
export type { Grade };

/** 可序列化的单词复习状态（日期统一为毫秒时间戳，便于存 IndexedDB 与同步） */
export interface CardState {
  /** = WordItem.id */
  id: string;
  dictId: string;
  due: number;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: State;
  lastReview?: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface ReviewLog {
  id: string;
  wordId: string;
  dictId: string;
  grade: Grade;
  reviewedAt: number;
  durationMs: number;
  errors: number;
  /** 按错的位置与按键，用于字母级错误分析（旧记录没有） */
  mistakes?: Mistake[];
  updatedAt: number;
}

export interface TypingOutcome {
  errors: number;
  mistakes?: Mistake[];
  hinted: boolean;
  skipped: boolean;
  durationMs: number;
  answerLength: number;
}

const scheduler = fsrs({ enable_fuzz: true });
/** mark 的词：更高的目标记忆保持率 → 更短的复习间隔 */
const strictScheduler = fsrs({ enable_fuzz: true, request_retention: 0.95 });

/** 打字表现 → FSRS 评分 */
export function gradeFromTyping(o: TypingOutcome): Grade {
  if (o.skipped) return Rating.Again;
  if (o.errors > 0 || o.hinted) return o.errors >= 4 ? Rating.Again : Rating.Hard;
  // 每字符 ≤ 250ms 视为非常熟练
  return o.durationMs <= Math.max(1200, o.answerLength * 250) ? Rating.Easy : Rating.Good;
}

function toFsrs(c: CardState): Card {
  return {
    due: new Date(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: 0,
    scheduled_days: c.scheduledDays,
    learning_steps: c.learningSteps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.lastReview ? new Date(c.lastReview) : undefined,
  };
}

function fromFsrs(card: Card, word: Pick<WordItem, "id" | "dictId">, now: number): CardState {
  return {
    id: word.id,
    dictId: word.dictId,
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review?.getTime(),
    updatedAt: now,
  };
}

export function reviewCard(
  current: CardState | undefined,
  word: Pick<WordItem, "id" | "dictId">,
  grade: Grade,
  now = Date.now(),
  /** 被 mark 的词复习更频繁 */
  strict = false,
): CardState {
  const card = current && !current.deleted ? toFsrs(current) : createEmptyCard(new Date(now));
  const { card: next } = (strict ? strictScheduler : scheduler).next(card, new Date(now), grade);
  return fromFsrs(next, word, now);
}

export function isDue(card: CardState, now = Date.now()): boolean {
  return !card.deleted && card.due <= now;
}

/** 稳定性 ≥ 21 天视为“掌握” */
export function isMastered(card: CardState | undefined): boolean {
  return Boolean(card && !card.deleted && card.state === State.Review && card.stability >= 21);
}

/** 0 未学 · 1 初识 · 2 熟悉 · 3 掌握，用于热力图 / 拼图着色 */
export function masteryLevel(card: CardState | undefined): 0 | 1 | 2 | 3 {
  if (!card || card.deleted || card.reps === 0) return 0;
  if (isMastered(card)) return 3;
  if (card.state === State.Review) return 2;
  return 1;
}
