import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "tdesign-react";
import { CloseIcon } from "tdesign-icons-react";
import { weekStart, type WeekStats } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { loadWeeklyReport } from "../../lib/weekly";
import { getMeta, setMeta } from "../../store/repo";
import { DAY } from "../../lib/date";

const SEEN_KEY = "weeklySeen";

/** 每周一、二在首页提示上周周报；看过或关闭后本周不再出现 */
export default function WeeklyBanner() {
  const { t } = useSettings();
  const navigate = useNavigate();
  const [last, setLast] = useState<WeekStats | null>(null);

  useEffect(() => {
    const now = Date.now();
    const weekday = (new Date(now).getDay() + 6) % 7; // 周一为 0
    if (weekday > 1) return;
    const lastWeek = weekStart(now - 7 * DAY);
    let cancelled = false;
    void (async () => {
      if ((await getMeta<number>(SEEN_KEY)) === lastWeek) return;
      const report = await loadWeeklyReport(lastWeek);
      if (!cancelled && report.current.activeDays > 0) setLast(report.current);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!last) return null;
  const dismiss = () => {
    void setMeta(SEEN_KEY, last.start);
    setLast(null);
  };
  return (
    <section className="weekly-banner">
      <span>📊</span>
      <span className="weekly-banner-text">{t("weekly.banner", { days: last.activeDays, words: last.newWords, minutes: last.minutes })}</span>
      <Button
        size="small"
        theme="primary"
        variant="text"
        onClick={() => {
          dismiss();
          navigate("/progress", { state: { week: "last" } });
        }}
      >
        {t("weekly.view")} →
      </Button>
      <Button size="small" variant="text" shape="square" icon={<CloseIcon />} aria-label={t("weekly.dismiss")} onClick={dismiss} />
    </section>
  );
}
