import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Progress } from "tdesign-react";
import { useLiveQuery } from "dexie-react-hooks";
import { DICTIONARIES, computeStreakWithLeave, customDictMeta, isMastered, mergeDictWords, type CardState, type DictMeta, type WordItem } from "@wreadt/core";
import { db } from "../store/db";
import { loadDictWords } from "../store/dicts";
import { addDictExtras } from "../store/repo";
import { AiUnavailableError, expandDict } from "../services/ai";
import { useSettings } from "../context/settings";
import VocabMap from "../components/VocabMap";
import KeyboardPuzzle from "../components/KeyboardPuzzle";
import SpellingInsights from "../components/progress/SpellingInsights";
import WeeklyReport from "../components/progress/WeeklyReport";
import { useLocation } from "react-router-dom";
import { DAY, startOfDay } from "../lib/date";

const WEEKS = 16;

export default function ProgressPage() {
  const { settings, t } = useSettings();
  // 首页“上周周报”入口带过来的参数
  const initialWeek = (useLocation().state as { week?: "this" | "last" } | null)?.week ?? "this";
  const [now] = useState(() => Date.now());
  const today = startOfDay(now);
  const cards = useLiveQuery(() => db.cards.toArray(), []);
  const since = today - (WEEKS * 7 - 1) * DAY;
  const logs = useLiveQuery(() => db.reviewLogs.where("reviewedAt").aboveOrEqual(since).toArray(), [since]);
  const customWords = useLiveQuery(() => db.customWords.filter((w) => !w.deleted).toArray(), []);
  const [selectedWords, setSelectedWords] = useState<[string, WordItem[]][]>([]);
  const [expanding, setExpanding] = useState<string | null>(null);
  const [expandNotice, setExpandNotice] = useState<{ theme: "success" | "error" | "info"; text: string } | null>(null);
  const [reload, setReload] = useState(0);
  const dictKey = settings.dictIds.join(",");

  useEffect(() => {
    let cancelled = false;
    const ids = dictKey.split(",");
    Promise.all(ids.map((id) => loadDictWords(id).catch(() => [] as WordItem[]))).then((lists) => {
      if (!cancelled) setSelectedWords(ids.map((id, i) => [id, lists[i]!]));
    });
    return () => {
      cancelled = true;
    };
  }, [dictKey, reload]);

  /** 用 AI 给职业词库追加 30 个新词（排除已有词），存为本地扩充词条并同步 */
  const expand = async (meta: DictMeta, words: WordItem[]) => {
    setExpanding(meta.id);
    setExpandNotice(null);
    try {
      const entries = await expandDict(meta, words.map((w) => w.answer), settings.locale);
      await addDictExtras(meta.id, meta.lang, entries);
      setExpandNotice({ theme: "success", text: t("progress.expanded", { name: meta.name, count: entries.length }) });
      setReload((n) => n + 1);
    } catch (err) {
      setExpandNotice(err instanceof AiUnavailableError ? { theme: "info", text: t("ai.unavailable") } : { theme: "error", text: (err as Error).message });
    } finally {
      setExpanding(null);
    }
  };

  // 进度按单词共享：同一个词在任何词库学过都算
  const cardMap = useMemo(() => new Map((cards ?? []).filter((c) => !c.deleted).map((c) => [c.id, c])), [cards]);

  const perDay = useMemo(() => {
    const counts = new Map<number, number>();
    for (const log of logs ?? []) counts.set(startOfDay(log.reviewedAt), (counts.get(startOfDay(log.reviewedAt)) ?? 0) + 1);
    return counts;
  }, [logs]);

  const live = (cards ?? []).filter((c) => !c.deleted && c.reps > 0);
  const streakInfo = computeStreakWithLeave(new Set(perDay.keys()), today, settings.leavePerWeek);
  const streak = streakInfo.days;
  const tiles = [
    { label: t("progress.today"), value: perDay.get(today) ?? 0 },
    { label: streakInfo.leaveDays ? `${t("progress.streak")}${t("streak.withLeave", { count: streakInfo.leaveDays })}` : t("progress.streak"), value: streak },
    { label: t("progress.learned"), value: live.length },
    { label: t("progress.mastered"), value: live.filter(isMastered).length },
    { label: t("progress.due"), value: live.filter((c) => c.due <= now).length },
  ];

  const customSize = (lang: "en" | "ja") => (customWords ?? []).filter((w) => w.lang === lang).length;
  const dicts: DictMeta[] = [...DICTIONARIES, customDictMeta("en", customSize("en")), customDictMeta("ja", customSize("ja"))];
  const mapWords = mergeDictWords(selectedWords.map(([, words]) => words));
  const mapName = selectedWords.map(([id]) => dicts.find((d) => d.id === id)?.name ?? id).join(" + ");
  const max = Math.max(1, ...perDay.values());

  return (
    <main className="page">
      <h1>{t("progress.title")}</h1>

      <div className="stat-tiles">
        {tiles.map((tile) => (
          <div className="stat-tile" key={tile.label}>
            <div className="stat-value">{tile.value}</div>
            <div className="stat-label">{tile.label}</div>
          </div>
        ))}
      </div>

      <section className="panel" id="weekly">
        <h2>{t("weekly.title")}</h2>
        <WeeklyReport initial={initialWeek} />
      </section>

      <section className="panel">
        <h2>{t("spelling.title")}</h2>
        <SpellingInsights />
      </section>

      <section className="panel">
        <h2>{t("progress.achievements")}</h2>
        <KeyboardPuzzle
          cards={cards ?? []}
          stats={{ learned: live.length, mastered: live.filter(isMastered).length, streak, today: perDay.get(today) ?? 0 }}
        />
      </section>

      <section className="panel">
        <h2>{t("progress.activity")}</h2>
        <div className="activity-grid" style={{ gridTemplateRows: "repeat(7, 1fr)" }}>
          {Array.from({ length: WEEKS * 7 }, (_, i) => {
            const day = startOfDay(since + i * DAY + DAY / 2);
            const count = perDay.get(day) ?? 0;
            const level = count === 0 ? 0 : Math.min(3, Math.ceil((count / max) * 3));
            return <span key={day} className={`activity-cell level-${level}`} title={`${new Date(day).toLocaleDateString()} · ${count}`} />;
          })}
        </div>
      </section>

      <section className="panel">
        <h2>{t("progress.dicts")}</h2>
        {live.length === 0 && <p className="muted">{t("progress.empty")}</p>}
        {selectedWords.map(([id, words]) => {
          const learned = words.filter((w) => (cardMap.get(w.id)?.reps ?? 0) > 0).length;
          const meta = dicts.find((d) => d.id === id);
          return (
            <div className="dict-progress" key={id}>
              <span className="dict-progress-name">{meta?.name ?? id}</span>
              <Progress percentage={words.length ? Math.round((learned / words.length) * 100) : 0} label={`${learned} / ${words.length}`} />
              {meta?.category === "role" && (
                <Button size="small" variant="text" theme="primary" loading={expanding === id} disabled={expanding !== null} onClick={() => void expand(meta, words)}>
                  {t("progress.expand")}
                </Button>
              )}
            </div>
          );
        })}
        {expandNotice && <Alert theme={expandNotice.theme} message={expandNotice.text} />}
      </section>

      {mapWords.length > 0 && (
        <section className="panel">
          <h2>{t("progress.map", { name: mapName })}</h2>
          <VocabMap words={mapWords} cards={cardMap as Map<string, CardState>} cell={mapWords.length > 3000 ? 5 : 8} />
        </section>
      )}
    </main>
  );
}
