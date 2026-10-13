import { useEffect, useState } from "react";
import { Progress, Statistic, Tooltip } from "tdesign-react";
import { InfoCircleIcon } from "tdesign-icons-react";
import { useSettings } from "../../context/settings";
import { addStudySeconds } from "../../services/studyTime";
import type { MessageKey } from "../../i18n/messages";

interface Props {
  stats: { keystrokes: number; wrongKeystrokes: number; startedAt: number; done: number; correct: number };
  accuracy: number;
  current: number;
  total: number;
  running: boolean;
}

/** 累计用时：只在 running（在打字页且本组未结束）时计时，离开页面暂停、回来继续 */
function useElapsedSeconds(started: boolean, running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!started || !running) return;
    const timer = window.setInterval(() => {
      setSeconds((s) => s + 1);
      addStudySeconds(1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [started, running]);
  return seconds;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 本组数据：用时、输入数、速度、正确数、正确率，以及本组进度 */
export default function TypingStats({ stats, accuracy, current, total, running }: Props) {
  const { t } = useSettings();
  const seconds = useElapsedSeconds(stats.startedAt > 0, running);
  const correctKeys = stats.keystrokes - stats.wrongKeystrokes;
  const wpm = seconds >= 5 ? Math.round(correctKeys / 5 / (seconds / 60)) : 0;

  const items: { key: MessageKey; tip: MessageKey; value: string | number; unit?: string }[] = [
    { key: "stats.time", tip: "stats.timeTip", value: `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}` },
    { key: "stats.keys", tip: "stats.keysTip", value: stats.keystrokes },
    { key: "stats.speed", tip: "stats.speedTip", value: wpm, unit: "WPM" },
    { key: "stats.correct", tip: "stats.correctTip", value: `${stats.correct} / ${stats.done}` },
    { key: "stats.accuracy", tip: "stats.accuracyTip", value: accuracy, unit: "%" },
  ];

  return (
    <div className="typing-stats">
      <div className="stats-card">
        {items.map((it) => (
          <Statistic
            key={it.key}
            className="stat"
            title={
              <span className="stat-title">
                {t(it.key)}
                <Tooltip content={t(it.tip)}>
                  <InfoCircleIcon />
                </Tooltip>
              </span>
            }
            value={it.value as never}
            unit={it.unit}
          />
        ))}
      </div>
      <Progress percentage={total ? Math.round((current / total) * 100) : 0} label={false} strokeWidth={2} className="batch-progress" />
      <span className="batch-progress-text">
        {pad(current)} / {pad(total)}
      </span>
    </div>
  );
}
