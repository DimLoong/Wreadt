import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Select, Skeleton } from "tdesign-react";
import { RefreshIcon } from "tdesign-icons-react";
import { useLiveQuery } from "dexie-react-hooks";
import { feedBaseLevel, feedTopicLevels, type FeedItem, type FeedLevelSetting, type Reading, type WordTip } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { db } from "../../store/db";
import { BUILTIN_FEED, BUILTIN_READING, BUILTIN_TIPS, loadFeed, loadReading, loadTips, recentScores, type FeedSource } from "../../lib/feed";
import FeedCard from "./FeedCard";
import ReadingCard from "./ReadingCard";
import TipCard from "./TipCard";
import type { MessageKey } from "../../i18n/messages";

type Kind = "replies" | "reading" | "tips";
const KINDS: Kind[] = ["replies", "reading", "tips"];
const LEVELS: FeedLevelSetting[] = ["auto", "simple", "medium"];
/** 每天最多加载几批（第一批 + 滚动到底部自动加载的） */
const MAX_SLOTS = 3;

/** 一类内容的加载状态：失败时 data 为内置内容（第一批）或空，并带上错误信息 */
type Loaded<T> = { data: T | null; source: FeedSource | null; error?: string } | null;
interface Slot {
  replies: Loaded<FeedItem[]>;
  reading: Loaded<Reading>;
  tips: Loaded<WordTip[]>;
}
const EMPTY_SLOT: Slot = { replies: null, reading: null, tips: null };

interface Entry {
  key: string;
  kind: Kind;
  /** 估计高度，用来把卡片分到较短的那一列 */
  weight: number;
  node: React.ReactNode;
}

function useColumns(): number {
  const query = "(min-width: 900px)";
  const [wide, setWide] = useState(() => window.matchMedia?.(query).matches ?? true);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide ? 2 : 1;
}

/**
 * 学习兴趣流：回复练习、微阅读、词汇小知识混排成瀑布流，打开即自动加载；滚动到底部自动再加载一批（每天最多 3 批）。
 * 每类内容单独加载，失败时第一批显示内置内容并可重新加载。
 */
export default function LearningFeed({ roleText }: { roleText: string }) {
  const { t, settings, update } = useSettings();
  const navigate = useNavigate();
  const columns = useColumns();
  const perf = useLiveQuery(async () => ({
    recentScores: await recentScores(),
    learned: await db.cards.filter((c) => !c.deleted && c.reps > 0).count(),
  }));
  const base = perf ? feedBaseLevel(settings.feedLevel, perf) : null;
  const topicLevels = base ? feedTopicLevels(settings.feedLevel, base) : null;
  const levelKey = topicLevels?.join(",");

  const [slots, setSlots] = useState<Slot[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  const setKind = useCallback((slot: number, kind: Kind, value: Loaded<unknown>) => {
    setSlots((all) => all.map((s, i) => (i === slot ? { ...s, [kind]: value } : s)));
  }, []);

  /** 加载某一批中的某一类；第一批失败时用内置内容兜底 */
  const loadKind = useCallback(
    async (slot: number, kind: Kind, force: boolean) => {
      if (!base || !topicLevels) return;
      const gen = generation.current;
      setKind(slot, kind, null);
      const fallback = slot === 0 ? { replies: BUILTIN_FEED, reading: BUILTIN_READING, tips: BUILTIN_TIPS }[kind] : null;
      let value: Loaded<unknown>;
      try {
        if (kind === "replies") {
          const r = await loadFeed(roleText, settings.locale, topicLevels, force, slot);
          value = { data: r.items, source: r.source };
        } else if (kind === "reading") {
          const r = await loadReading(roleText, settings.locale, base, force, slot);
          value = { data: r.reading, source: r.source };
        } else {
          const r = await loadTips(settings.locale, base, force, slot);
          value = { data: r.tips, source: r.source };
        }
      } catch (err) {
        value = { data: fallback, source: fallback ? "builtin" : null, error: (err as Error).message };
      }
      if (gen === generation.current) setKind(slot, kind, value);
    },
    [base, topicLevels, roleText, settings.locale, setKind],
  );

  const loadSlot = useCallback(
    (slot: number, force: boolean) => {
      for (const k of KINDS) void loadKind(slot, k, force);
    },
    [loadKind],
  );

  // 参数变化（难度、职业、语言）时从第一批重新开始
  useEffect(() => {
    if (!levelKey) return;
    generation.current += 1;
    setSlots([EMPTY_SLOT]);
    loadSlot(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在参数变化时重新开始
  }, [levelKey, roleText, settings.locale]);

  const settled = (s: Slot) => KINDS.every((k) => s[k] !== null);
  const aiOn = slots[0]?.replies?.source === "ai" || slots[0]?.reading?.source === "ai";
  const canLoadMore = aiOn && slots.length < MAX_SLOTS && slots.every(settled);

  // 滚动到底部自动加载下一批
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !canLoadMore) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const next = slots.length;
      setSlots((all) => [...all, EMPTY_SLOT]);
      loadSlot(next, false);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [canLoadMore, slots.length, loadSlot]);

  /** 换一批：重新生成第一批，丢掉后面加载的 */
  const refresh = async () => {
    setRefreshing(true);
    generation.current += 1;
    setSlots([EMPTY_SLOT]);
    await Promise.all(KINDS.map((k) => loadKind(0, k, true)));
    setRefreshing(false);
  };

  // 把每批内容混排：回复、小知识、阅读、小知识、回复、小知识
  const entries: Entry[] = [];
  slots.forEach((slot, si) => {
    const failed = (kind: Kind) => {
      const s = slot[kind];
      return s?.error ? (
        <div className="feed-failed">
          <span className="muted">{s.data ? t("feed.failedFallback") : t("feed.failed")}</span>
          <Button size="small" variant="text" theme="primary" icon={<RefreshIcon />} onClick={() => void loadKind(si, kind, true)}>
            {t("feed.reload")}
          </Button>
        </div>
      ) : null;
    };
    /** 失败后显示的是内置内容：在这一类的第一张卡片上方附上“重新加载” */
    const withNotice = (kind: Kind, i: number, card: React.ReactNode) =>
      i === 0 && slot[kind]?.error ? (
        <>
          {failed(kind)}
          {card}
        </>
      ) : (
        card
      );
    const skeleton = (kind: Kind, i = 0) => ({
      key: `${si}-${kind}-sk-${i}`,
      kind,
      weight: 2,
      node: (
        <Card bordered className="feed-skeleton">
          <Skeleton animation="gradient" loading theme="paragraph" />
        </Card>
      ),
    });
    const replies = slot.replies?.data ?? [];
    const tips = slot.tips?.data ?? [];
    const pushReply = (i: number) => {
      if (slot.replies === null) return i === 0 && entries.push(skeleton("replies"));
      const item = replies[i];
      if (item) entries.push({ key: `${si}-r-${item.topic}`, kind: "replies", weight: 3, node: withNotice("replies", i, <FeedCard item={item} roleText={roleText} />) });
      else if (i === 0 && slot.replies.error) entries.push({ key: `${si}-r-err`, kind: "replies", weight: 1, node: failed("replies") });
    };
    const pushTip = (i: number) => {
      if (slot.tips === null) return i === 0 && entries.push(skeleton("tips"));
      const tip = tips[i];
      if (tip) entries.push({ key: `${si}-t-${tip.word}-${i}`, kind: "tips", weight: 1.3, node: withNotice("tips", i, <TipCard tip={tip} />) });
      else if (i === 0 && slot.tips.error) entries.push({ key: `${si}-t-err`, kind: "tips", weight: 1, node: failed("tips") });
    };
    pushReply(0);
    pushTip(0);
    if (slot.reading === null) entries.push(skeleton("reading"));
    else if (slot.reading.data)
      entries.push({ key: `${si}-reading-${slot.reading.data.title}`, kind: "reading", weight: 3, node: withNotice("reading", 0, <ReadingCard reading={slot.reading.data} />) });
    else if (slot.reading.error) entries.push({ key: `${si}-reading-err`, kind: "reading", weight: 1, node: failed("reading") });
    pushTip(1);
    pushReply(1);
    pushTip(2);
  });

  // 瀑布流：依次放到当前较短的一列
  const cols: Entry[][] = Array.from({ length: columns }, () => []);
  const heights = new Array<number>(columns).fill(0);
  for (const e of entries) {
    const c = heights.indexOf(Math.min(...heights));
    cols[c]!.push(e);
    heights[c]! += e.weight;
  }

  const builtin = slots[0] && KINDS.some((k) => slots[0]![k]?.source === "builtin" && !slots[0]![k]?.error);

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
          <Button size="small" variant="text" icon={<RefreshIcon />} loading={refreshing} disabled={!aiOn} onClick={() => void refresh()}>
            {t("feed.refresh")}
          </Button>
        </div>
      </div>
      <p className="muted feed-desc">
        {t("feed.desc")}
        {settings.feedLevel === "auto" && base && ` ${t(`feed.autoTip.${base}` as MessageKey)}`}
      </p>

      {builtin && (
        <Alert
          theme="info"
          message={t("feed.builtin")}
          operation={
            <Button size="small" variant="text" onClick={() => navigate("/settings?tab=ai")}>
              {t("ai.configure")} →
            </Button>
          }
        />
      )}

      <div className="feed-masonry" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {cols.map((col, i) => (
          <div key={i} className="feed-column">
            {col.map((e) => (
              <div key={e.key} className={`feed-entry feed-entry-${e.kind}`}>
                <span className="feed-kind">{t(`feed.tab.${e.kind}` as MessageKey)}</span>
                {e.node}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div ref={sentinel} className="feed-sentinel">
        {aiOn && slots.length >= MAX_SLOTS && slots.every(settled) && <span className="muted">{t("feed.enough")}</span>}
      </div>
    </section>
  );
}
