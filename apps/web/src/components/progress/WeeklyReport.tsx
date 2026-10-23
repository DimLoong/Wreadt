import { useEffect, useState } from "react";
import { Radio, Tag } from "tdesign-react";
import type { WeekStats, WeeklyReport as Report } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { loadWeeklyReport } from "../../lib/weekly";
import { DAY } from "../../lib/date";
import type { MessageKey } from "../../i18n/messages";
import { displayScore } from "@wreadt/core";

type Which = "this" | "last";

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

/** 与上一周相比的变化：↑ 绿 / ↓ 灰（不用红色，避免挫败感） */
function Delta({ now, before, percent }: { now: number | null; before: number | null; percent?: boolean }) {
  if (now === null || before === null) return null;
  const diff = percent ? Math.round((now - before) * 100) : now - before;
  if (!diff) return <span className="weekly-delta same">±0</span>;
  return <span className={`weekly-delta ${diff > 0 ? "up" : "down"}`}>{diff > 0 ? `↑${diff}` : `↓${-diff}`}{percent ? "%" : ""}</span>;
}

/** 周报：本周 / 上周的练习天数、新词、复习、时长、一次打对率、AI 练习与拼写弱点，并与前一周对比 */
export default function WeeklyReport({ initial = "this" }: { initial?: Which }) {
  const { t, settings } = useSettings();
  const [which, setWhich] = useState<Which>(initial);
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    let cancelled = false;
    const weekOf = which === "this" ? Date.now() : Date.now() - 7 * DAY;
    void loadWeeklyReport(weekOf).then((r) => !cancelled && setReport(r));
    return () => {
      cancelled = true;
    };
  }, [which]);

  if (!report) return null;
  const { current: c, previous: p } = report;
  const range = (s: WeekStats) => {
    const fmt = (ts: number) => new Date(ts).toLocaleDateString(settings.locale, { month: "numeric", day: "numeric" });
    return `${fmt(s.start)} – ${fmt(s.start + 6 * DAY)}`;
  };
  const rows: { key: MessageKey; value: string; delta: React.ReactNode }[] = [
    { key: "weekly.activeDays", value: `${c.activeDays} / 7`, delta: <Delta now={c.activeDays} before={p.activeDays} /> },
    { key: "weekly.newWords", value: String(c.newWords), delta: <Delta now={c.newWords} before={p.newWords} /> },
    { key: "weekly.reviews", value: String(c.reviews), delta: <Delta now={c.reviews} before={p.reviews} /> },
    { key: "weekly.minutes", value: String(c.minutes), delta: <Delta now={c.minutes} before={p.minutes} /> },
    { key: "weekly.firstTry", value: pct(c.firstTry), delta: <Delta now={c.firstTry} before={p.firstTry} percent /> },
    { key: "weekly.ai", value: c.aiPractices ? `${c.aiPractices}${c.aiScore !== null ? ` · ${displayScore(c.aiScore)?.toFixed(1)}${t("score.unit")}` : ""}` : "0", delta: <Delta now={c.aiPractices} before={p.aiPractices} /> },
  ];
  const empty = !c.activeDays && !c.aiPractices;

  return (
    <div className="weekly-report">
      <div className="weekly-head">
        <Radio.Group variant="default-filled" value={which} onChange={(v) => setWhich(v as Which)}>
          <Radio.Button value="this">{t("weekly.this")}</Radio.Button>
          <Radio.Button value="last">{t("weekly.last")}</Radio.Button>
        </Radio.Group>
        <span className="muted">{range(c)}</span>
      </div>
      {empty ? (
        <p className="muted">{t("weekly.empty")}</p>
      ) : (
        <>
          <p className="weekly-summary">{t(c.activeDays >= 5 ? "weekly.praise.great" : c.activeDays >= 3 ? "weekly.praise.good" : "weekly.praise.start", { days: c.activeDays, words: c.newWords })}</p>
          <div className="weekly-grid">
            {rows.map((r) => (
              <div key={r.key} className="weekly-cell">
                <div className="weekly-value">
                  {r.value}
                  {r.delta}
                </div>
                <div className="muted weekly-label">{t(r.key)}</div>
              </div>
            ))}
          </div>
          {c.weakSpots.length > 0 && (
            <p className="muted weekly-weak">
              {t("weekly.weakSpots")}
              {c.weakSpots.map((w) => (
                <Tag key={w.pattern} size="small" variant="light" theme="warning">
                  {t(`spelling.${w.pattern}` as MessageKey)} ×{w.count}
                </Tag>
              ))}
            </p>
          )}
        </>
      )}
    </div>
  );
}
