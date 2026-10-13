import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Loading } from "tdesign-react";
import { BookmarkIcon, BookOpenIcon, ChartBarIcon, ChatIcon, CheckRectangleIcon, KeyboardIcon, RefreshIcon, TranslateIcon } from "tdesign-icons-react";
import { useLiveQuery } from "dexie-react-hooks";
import { DICTIONARIES, customDictMeta, type FeedItem } from "@wreadt/core";
import { useSettings } from "../context/settings";
import { db } from "../store/db";
import { loadFeed } from "../lib/feed";
import { computeStreak, startOfDay } from "../lib/date";
import { defaultRole, roleText } from "../lib/roles";
import FeedCard from "../components/feed/FeedCard";
import GoalSummary from "../components/GoalSummary";
import type { MessageKey } from "../i18n/messages";

const ENTRIES: { to: string; title: MessageKey; desc: MessageKey; icon: React.ReactElement }[] = [
  { to: "/scenario", title: "nav.practice", desc: "home.entry.practice", icon: <ChatIcon /> },
  { to: "/vocabulary", title: "nav.custom", desc: "home.entry.vocab", icon: <BookOpenIcon /> },
  { to: "/marks", title: "nav.marks", desc: "home.entry.marks", icon: <BookmarkIcon /> },
  { to: "/progress", title: "nav.progress", desc: "home.entry.progress", icon: <ChartBarIcon /> },
  { to: "/phonetic", title: "nav.phonetic", desc: "home.entry.phonetic", icon: <TranslateIcon /> },
];

function dictName(id: string) {
  if (id === "custom-en" || id === "custom-ja") return customDictMeta(id === "custom-en" ? "en" : "ja", 0).name;
  return DICTIONARIES.find((d) => d.id === id)?.name ?? id;
}

/** 首页：今日概况 + 功能入口 + 学习兴趣流 */
export default function HomePage() {
  const { t, settings } = useSettings();
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
      streak: computeStreak(days, today),
      marks,
    };
  }, [today, now]);

  // 第一次使用且还没学过词：进入新手引导
  useEffect(() => {
    if (stats && !settings.onboarded && stats.learned === 0) navigate("/welcome", { replace: true });
  }, [stats, settings.onboarded, navigate]);

  const role = defaultRole(settings.dictIds);
  const rText = roleText(role, t("scenario.general"));
  const [feed, setFeed] = useState<{ items: FeedItem[]; source: "ai" | "builtin" } | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async (force: boolean) => {
    setRefreshing(true);
    setFeedError(null);
    try {
      setFeed(await loadFeed(rText, settings.locale, force));
    } catch (err) {
      setFeedError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    loadFeed(rText, settings.locale)
      .then((f) => !cancelled && setFeed(f))
      .catch((err: Error) => !cancelled && setFeedError(err.message));
    return () => {
      cancelled = true;
    };
  }, [rText, settings.locale]);

  return (
    <main className="page home-page">
      <GoalSummary />

      <section className="home-hero">
        <div>
          <h1>{t(stats?.today ? "home.greetingBack" : "home.greeting")}</h1>
          <p className="muted">
            {t("home.summary", { today: stats?.today ?? 0, due: stats?.due ?? 0, streak: stats?.streak ?? 0, learned: stats?.learned ?? 0 })}
          </p>
        </div>
        <div className="home-cta">
          <Button theme="primary" size="large" shape="round" icon={<KeyboardIcon />} onClick={() => navigate("/typing")}>
            {stats?.due ? t("home.startReview", { count: stats.due }) : t("home.start")}
          </Button>
          <span className="muted">{settings.dictIds.map(dictName).join(" + ")}</span>
        </div>
      </section>

      {stats && stats.learned < 30 && (
        <button type="button" className="home-entry-btn home-placement" onClick={() => navigate("/placement")}>
          <Card bordered hoverShadow className="home-entry">
            <span className="home-entry-icon">
              <CheckRectangleIcon />
            </span>
            <div>
              <strong>{t("home.placementTitle")}</strong>
              <p className="muted">{t("home.placementDesc")}</p>
            </div>
          </Card>
        </button>
      )}

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

      <section className="home-feed">
        <div className="panel-head">
          <h2>{t("feed.title")}</h2>
          <Button size="small" variant="text" icon={<RefreshIcon />} loading={refreshing} disabled={feed?.source === "builtin"} onClick={() => void refresh(true)}>
            {t("feed.refresh")}
          </Button>
        </div>
        <p className="muted">{t("feed.desc")}</p>
        {feed?.source === "builtin" && <Alert theme="info" message={t("feed.builtin")} operation={<Button size="small" variant="text" onClick={() => navigate("/settings")}>{t("ai.configure")} →</Button>} />}
        {feedError && <Alert theme="error" message={feedError} />}
        {!feed && !feedError && <Loading size="small" text={t("feed.loading")} />}
        <div className="feed-list">
          {feed?.items.map((item) => (
            <FeedCard key={item.topic} item={item} roleText={rText} />
          ))}
        </div>
      </section>
    </main>
  );
}
