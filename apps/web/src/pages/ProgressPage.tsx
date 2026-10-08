import { useEffect, useMemo, useState } from "react";
import { Progress } from "tdesign-react";
import { useLiveQuery } from "dexie-react-hooks";
import { DICTIONARIES, customDictMeta, isMastered, type CardState, type DictMeta, type WordItem } from "@wreadt/core";
import { db } from "../store/db";
import { loadDictWords } from "../store/dicts";
import { useSettings } from "../context/settings";
import VocabMap from "../components/VocabMap";
import { computeStreak, DAY, startOfDay } from "../lib/date";

const WEEKS = 16;

export default function ProgressPage() {
  const { settings, t } = useSettings();
  const [now] = useState(() => Date.now());
  const today = startOfDay(now);
  const cards = useLiveQuery(() => db.cards.toArray(), []);
  const since = today - (WEEKS * 7 - 1) * DAY;
  const logs = useLiveQuery(() => db.reviewLogs.where("reviewedAt").aboveOrEqual(since).toArray(), [since]);
  const customWords = useLiveQuery(() => db.customWords.filter((w) => !w.deleted).toArray(), []);
  const [currentWords, setCurrentWords] = useState<WordItem[]>([]);

  useEffect(() => {
    loadDictWords(settings.dictId).then(setCurrentWords, () => setCurrentWords([]));
  }, [settings.dictId]);

  const byDict = useMemo(() => {
    const map = new Map<string, Map<string, CardState>>();
    for (const c of cards ?? []) {
      if (!map.has(c.dictId)) map.set(c.dictId, new Map());
      map.get(c.dictId)!.set(c.id, c);
    }
    return map;
  }, [cards]);

  const perDay = useMemo(() => {
    const counts = new Map<number, number>();
    for (const log of logs ?? []) counts.set(startOfDay(log.reviewedAt), (counts.get(startOfDay(log.reviewedAt)) ?? 0) + 1);
    return counts;
  }, [logs]);

  const live = (cards ?? []).filter((c) => !c.deleted && c.reps > 0);
  const tiles = [
    { label: t("progress.today"), value: perDay.get(today) ?? 0 },
    { label: t("progress.streak"), value: computeStreak(new Set(perDay.keys()), today) },
    { label: t("progress.learned"), value: live.length },
    { label: t("progress.mastered"), value: live.filter(isMastered).length },
    { label: t("progress.due"), value: live.filter((c) => c.due <= now).length },
  ];

  const customSize = (lang: "en" | "ja") => (customWords ?? []).filter((w) => w.lang === lang).length;
  const dicts: DictMeta[] = [...DICTIONARIES, customDictMeta("en", customSize("en")), customDictMeta("ja", customSize("ja"))];
  const studied = dicts.filter((d) => byDict.has(d.id));
  const currentMeta = dicts.find((d) => d.id === settings.dictId);
  const currentCards = byDict.get(settings.dictId) ?? new Map<string, CardState>();
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
        {studied.length === 0 && <p className="muted">{t("progress.empty")}</p>}
        {studied.map((d) => {
          const learned = [...byDict.get(d.id)!.values()].filter((c) => !c.deleted && c.reps > 0).length;
          return (
            <div className="dict-progress" key={d.id}>
              <span className="dict-progress-name">{d.name}</span>
              <Progress percentage={d.size ? Math.round((learned / d.size) * 100) : 0} label={`${learned} / ${d.size}`} />
            </div>
          );
        })}
      </section>

      {currentMeta && currentWords.length > 0 && (
        <section className="panel">
          <h2>{t("progress.map", { name: currentMeta.name })}</h2>
          <VocabMap words={currentWords} cards={currentCards} cell={currentWords.length > 3000 ? 5 : 8} />
        </section>
      )}
    </main>
  );
}
