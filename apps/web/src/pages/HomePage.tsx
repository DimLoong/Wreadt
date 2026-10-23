import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card } from "tdesign-react";
import { FilePasteIcon, BookmarkIcon, BookOpenIcon, ChartBarIcon, ChatIcon, KeyboardIcon, TranslateIcon } from "tdesign-icons-react";
import { useLiveQuery } from "dexie-react-hooks";
import { computeStreakWithLeave } from "@wreadt/core";
import { useDictMetas } from "../hooks/useDictMetas";
import { useSettings } from "../context/settings";
import { db } from "../store/db";
import { startOfDay } from "../lib/date";
import { defaultRole, roleText } from "../lib/roles";
import LearningFeed from "../components/feed/LearningFeed";
import GoalSummary from "../components/GoalSummary";
import WeeklyBanner from "../components/progress/WeeklyBanner";
import PlacementPrompt from "../components/placement/PlacementPrompt";
import type { MessageKey } from "../i18n/messages";

const ENTRIES: { to: string; title: MessageKey; desc: MessageKey; icon: React.ReactElement }[] = [
  { to: "/scenario", title: "nav.practice", desc: "home.entry.practice", icon: <ChatIcon /> },
  { to: "/typing?paste=1", title: "paste.title", desc: "home.entry.paste", icon: <FilePasteIcon /> },
  { to: "/vocabulary", title: "nav.custom", desc: "home.entry.vocab", icon: <BookOpenIcon /> },
  { to: "/marks", title: "nav.marks", desc: "home.entry.marks", icon: <BookmarkIcon /> },
  { to: "/progress", title: "nav.progress", desc: "home.entry.progress", icon: <ChartBarIcon /> },
  { to: "/phonetic", title: "nav.phonetic", desc: "home.entry.phonetic", icon: <TranslateIcon /> },
];


/** 首页：今日概况 + 功能入口 + 学习兴趣流 */
export default function HomePage() {
  const { t, settings } = useSettings();
  const { name: dictName } = useDictMetas();
  const navigate = useNavigate();
  const [now] = useState(() => Date.now());
  const today = startOfDay(now);
  const stats = useLiveQuery(async () => {
    const [cards, logs, marks] = await Promise.all([db.cards.toArray(), db.reviewLogs.where("reviewedAt").aboveOrEqual(today - 120 * 86_400_000).toArray(), db.marks.count()]);
    const live = cards.filter((c) => !c.deleted && c.reps > 0);
    const days = new Set(logs.map((l) => startOfDay(l.reviewedAt)));
    return {
      today: logs.filter((l) => l.reviewedAt >= today).length,
      due: live.filter((c) => c.due <= now).length,
      learned: live.length,
      streak: computeStreakWithLeave(days, today, settings.leavePerWeek),
      marks,
    };
  }, [today, now, settings.leavePerWeek]);

  // 第一次使用且还没学过词：进入新手引导
  useEffect(() => {
    if (stats && !settings.onboarded && stats.learned === 0) navigate("/welcome", { replace: true });
  }, [stats, settings.onboarded, navigate]);

  const role = defaultRole(settings.dictIds);
  const rText = roleText(role, t("scenario.general"));
  return (
    <main className="page home-page">
      {/* 新用户：最醒目的位置建议先做摸底 */}
      {stats && settings.placementStatus === "pending" && stats.learned < 30 && <PlacementPrompt where="home" />}
      <WeeklyBanner />
      <GoalSummary />

      <section className="home-hero">
        <div>
          <h1>{t(stats?.today ? "home.greetingBack" : "home.greeting")}</h1>
          <p className="muted">
            {t("home.summary", {
              today: stats?.today ?? 0,
              due: stats?.due ?? 0,
              streak: stats?.streak.days ?? 0,
              leave: stats?.streak.leaveDays ? t("streak.withLeave", { count: stats.streak.leaveDays }) : "",
              learned: stats?.learned ?? 0,
            })}
          </p>
        </div>
        <div className="home-cta">
          <Button theme="primary" size="large" shape="round" icon={<KeyboardIcon />} onClick={() => navigate("/typing")}>
            {stats?.due ? t("home.startReview", { count: stats.due }) : t("home.start")}
          </Button>
          <span className="muted">{settings.dictIds.map(dictName).join(" + ")}</span>
        </div>
      </section>

      <section className="home-entries">
        {ENTRIES.map((e) => (
          <button key={e.to} type="button" className="home-entry-btn" onClick={() => navigate(e.to)}>
            <Card bordered hoverShadow className="home-entry">
              <span className="home-entry-icon">{e.icon}</span>
              <div>
                <strong>{t(e.title)}</strong>
                <p className="muted">{e.to === "/marks" && stats?.marks ? t("home.entry.marksCount", { count: stats.marks }) : t(e.desc)}</p>
              </div>
            </Card>
          </button>
        ))}
      </section>

      <LearningFeed roleText={rText} />
    </main>
  );
}
