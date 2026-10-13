import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { goalProgress, planDailyNew, type GoalProgress } from "@wreadt/core";
import { useSettings } from "../context/settings";
import { db } from "../store/db";
import { loadDicts } from "../store/dicts";
import { studySecondsOn } from "../services/studyTime";
import { startOfDay } from "../lib/date";

export interface TodayPlan {
  newToday: number;
  newTarget: number;
  reviewedToday: number;
  dueLeft: number;
  secondsToday: number;
  daysLeft: number | null;
  reviewOnly: boolean;
  remaining: number;
  progress: GoalProgress;
}

/**
 * 今日计划与完成度：
 * - 新词 = 今天第一次学的词；复习 = 今天复习了的、以前学过的词；到期剩余 = 现在已到期还没复习的
 * - 设置考试日期时，新词目标按“当天开始时剩余新词 ÷ 可学天数”倒推
 */
export function useTodayPlan(): TodayPlan | null {
  const { settings } = useSettings();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [today] = useState(() => startOfDay(Date.now()));

  const data = useLiveQuery(async () => {
    const [logs, cards, seconds] = await Promise.all([db.reviewLogs.where("reviewedAt").aboveOrEqual(today).toArray(), db.cards.toArray(), studySecondsOn(today)]);
    const wordsToday = [...new Set(logs.map((l) => l.wordId))];
    // 今天之前有没有复习记录，区分新词与复习
    const earlier = await Promise.all(wordsToday.map((id) => db.reviewLogs.where("wordId").equals(id).filter((l) => l.reviewedAt < today).count()));
    const newToday = earlier.filter((n) => n === 0).length;
    const now = Date.now();
    const dueLeft = cards.filter((c) => !c.deleted && c.reps > 0 && c.due <= now && (c.lastReview ?? 0) < today).length;
    return { newToday, reviewedToday: wordsToday.length - newToday, dueLeft, seconds, cards };
  }, [today]);

  // 所选词库里还没学过的词数（考试倒推用）
  const dictKey = settings.dictIds.join(",");
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const learned = new Set(data.cards.filter((c) => !c.deleted && c.reps > 0).map((c) => c.id));
    void loadDicts(dictKey.split(",")).then((words) => {
      if (!cancelled) setRemaining(words.filter((w) => !learned.has(w.id)).length);
    });
    return () => {
      cancelled = true;
    };
  }, [dictKey, data]);

  if (!data || remaining === null) return null;
  const plan = planDailyNew({ remainingAtDayStart: remaining + data.newToday, today, examDate: settings.examDate, dailyNew: settings.dailyNew });
  const p = { newToday: data.newToday, newTarget: plan.perDay, reviewedToday: data.reviewedToday, dueLeft: data.dueLeft, secondsToday: data.seconds, minutesTarget: settings.dailyMinutes };
  return { ...p, daysLeft: plan.daysLeft, reviewOnly: plan.reviewOnly, remaining, progress: goalProgress(settings.goalType, p) };
}
