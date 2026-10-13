import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Loading, Select, Tabs } from "tdesign-react";
import { RefreshIcon } from "tdesign-icons-react";
import { useLiveQuery } from "dexie-react-hooks";
import { feedBaseLevel, feedTopicLevels, type FeedItem, type FeedLevelSetting, type Reading, type WordTip } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { db } from "../../store/db";
import { loadFeed, loadReading, loadTips, recentScores, type FeedSource } from "../../lib/feed";
import FeedCard from "./FeedCard";
import ReadingCard from "./ReadingCard";
import TipsList from "./TipsList";
import type { MessageKey } from "../../i18n/messages";

type Tab = "replies" | "reading" | "tips";
const TABS: Tab[] = ["replies", "reading", "tips"];
const LEVELS: FeedLevelSetting[] = ["auto", "simple", "medium"];

type State<T> = { data: T; source: FeedSource } | { error: string } | null;

/**
 * 学习兴趣流：回复练习、微阅读、词汇小知识三个分页，都用上学习者最近学的词。
 * 难度可手动选，也可自动按表现循序渐进；每个分页只在第一次打开时加载。
 */
export default function LearningFeed({ roleText }: { roleText: string }) {
  const { t, settings, update } = useSettings();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("replies");
  const perf = useLiveQuery(async () => ({
    recentScores: await recentScores(),
    learned: await db.cards.filter((c) => !c.deleted && c.reps > 0).count(),
  }));
  const base = perf ? feedBaseLevel(settings.feedLevel, perf) : null;
  const topicLevels = base ? feedTopicLevels(settings.feedLevel, base) : null;
  const levelKey = topicLevels?.join(",");

  const [replies, setReplies] = useState<State<FeedItem[]>>(null);
  const [reading, setReading] = useState<State<Reading>>(null);
  const [tips, setTips] = useState<State<WordTip[]>>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (which: Tab, force: boolean) => {
    if (!base || !topicLevels) return;
    const fail = (err: unknown) => ({ error: (err as Error).message });
    if (which === "replies")
      setReplies(await loadFeed(roleText, settings.locale, topicLevels, force).then((r) => ({ data: r.items, source: r.source }), fail));
    else if (which === "reading")
      setReading(await loadReading(roleText, settings.locale, base, force).then((r) => ({ data: r.reading, source: r.source }), fail));
    else setTips(await loadTips(settings.locale, base, force).then((r) => ({ data: r.tips, source: r.source }), fail));
  };

  // 参数变化时清空已加载的内容，当前分页重新加载
  useEffect(() => {
    setReplies(null);
    setReading(null);
    setTips(null);
  }, [roleText, settings.locale, levelKey]);

  const current = tab === "replies" ? replies : tab === "reading" ? reading : tips;
  useEffect(() => {
    if (!current && levelKey) void load(tab, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在分页或参数变化、且尚未加载时触发
  }, [tab, current, levelKey]);

  const refresh = async () => {
    setRefreshing(true);
    await load(tab, true);
    setRefreshing(false);
  };

  const source = current && "source" in current ? current.source : null;

  return (
    <section className="home-feed">
      <div className="panel-head">
        <h2>{t("feed.title")}</h2>
        <div className="feed-tools">
          <span className="muted">{t("feed.level")}</span>
          <Select
            size="small"
            value={settings.feedLevel}
            onChange={(v) => void update("feedLevel", v as FeedLevelSetting)}
            options={LEVELS.map((l) => ({ value: l, label: t(`feed.level.${l}` as MessageKey) }))}
            style={{ width: 92 }}
          />
          <Button size="small" variant="text" icon={<RefreshIcon />} loading={refreshing} disabled={source !== "ai"} onClick={() => void refresh()}>
            {t("feed.refresh")}
          </Button>
        </div>
      </div>
      {settings.feedLevel === "auto" && base && <p className="muted feed-level-tip">{t(`feed.autoTip.${base}` as MessageKey)}</p>}

      <Tabs value={tab} onChange={(v) => setTab(v as Tab)} className="feed-tabs">
        {TABS.map((k) => (
          <Tabs.TabPanel key={k} value={k} label={t(`feed.tab.${k}` as MessageKey)} />
        ))}
      </Tabs>
      <p className="muted feed-desc">{t(`feed.desc.${tab}` as MessageKey)}</p>

      {source === "builtin" && (
        <Alert
          theme="info"
          message={t("feed.builtin")}
          operation={
            <Button size="small" variant="text" onClick={() => navigate("/settings")}>
              {t("ai.configure")} →
            </Button>
          }
        />
      )}
      {current && "error" in current && <Alert theme="error" message={current.error} />}
      {!current && <Loading size="small" text={t("feed.loading")} />}

      {tab === "replies" && replies && "data" in replies && (
        <div className="feed-list">
          {replies.data.map((item) => (
            <FeedCard key={item.topic} item={item} roleText={roleText} />
          ))}
        </div>
      )}
      {tab === "reading" && reading && "data" in reading && <ReadingCard key={reading.data.title} reading={reading.data} />}
      {tab === "tips" && tips && "data" in tips && <TipsList tips={tips.data} />}
    </section>
  );
}
