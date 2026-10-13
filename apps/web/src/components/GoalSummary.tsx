import { useEffect } from "react";
import { MessagePlugin, Progress } from "tdesign-react";
import { useSettings } from "../context/settings";
import { useTodayPlan } from "../hooks/useTodayPlan";
import { getMeta, setMeta } from "../store/repo";
import { startOfDay } from "../lib/date";

/**
 * 今日目标完成度。compact：打字页工具栏中的一行；否则为首页卡片（含考试倒计时）。
 * celebrate：首次达成当天目标时提示一次（可继续学）。
 */
export default function GoalSummary({ compact = false, celebrate = false }: { compact?: boolean; celebrate?: boolean }) {
  const { t, settings } = useSettings();
  const plan = useTodayPlan();
  const done = plan?.progress.done ?? false;

  useEffect(() => {
    if (!celebrate || !done) return;
    const key = `goalDone:${startOfDay(Date.now())}`;
    void getMeta<boolean>(key).then((shown) => {
      if (shown) return;
      void setMeta(key, true);
      void MessagePlugin.success({ content: t("goal.doneToast"), duration: 4000 });
    });
  }, [celebrate, done, t]);

  if (!plan) return null;
  const minutes = Math.floor(plan.secondsToday / 60);
  const line =
    settings.goalType === "minutes"
      ? t("goal.minutes", { done: minutes, target: settings.dailyMinutes })
      : plan.reviewOnly
        ? t("goal.reviewOnly", { due: plan.dueLeft })
        : t("goal.words", { done: plan.newToday, target: plan.newTarget, reviewed: plan.reviewedToday, due: plan.dueLeft });

  if (compact) {
    return (
      <span className={`goal-compact ${done ? "done" : ""}`}>
        {done ? "✓ " : ""}
        {line}
      </span>
    );
  }

  return (
    <div className={`goal-summary ${done ? "done" : ""}`}>
      <Progress theme="circle" size="small" percentage={Math.round(plan.progress.ratio * 100)} status={done ? "success" : undefined} />
      <div>
        <strong>{done ? t("goal.doneTitle") : t("goal.title")}</strong>
        <p className="muted">{line}</p>
        {plan.daysLeft !== null && (
          <p className="muted">
            {plan.reviewOnly
              ? t("goal.examReview", { name: settings.examName ?? t("goal.exam"), days: plan.daysLeft })
              : t("goal.exam.countdown", { name: settings.examName ?? t("goal.exam"), days: plan.daysLeft, remaining: plan.remaining, perDay: plan.newTarget })}
          </p>
        )}
      </div>
    </div>
  );
}
