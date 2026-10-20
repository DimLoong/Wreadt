import { Progress, Statistic, Tooltip } from "tdesign-react";
import { InfoCircleIcon } from "tdesign-icons-react";
import { useSettings } from "../../context/settings";
import { formatSeconds, pad, wpmOf, type TypingTotals } from "../../lib/typingStats";
import type { MessageKey } from "../../i18n/messages";

interface Props {
  stats: TypingTotals;
  accuracy: number;
  current: number;
  total: number;
  /** 本组累计用时（秒），由 useElapsedSeconds 计时 */
  seconds: number;
}

/** 本组数据：用时、输入数、速度、正确数、正确率，以及本组进度 */
export default function TypingStats({ stats, accuracy, current, total, seconds }: Props) {
  const { t } = useSettings();
  const wpm = wpmOf(stats, seconds);

  const items: { key: MessageKey; tip: MessageKey; value: string | number; unit?: string }[] = [
    { key: "stats.time", tip: "stats.timeTip", value: formatSeconds(seconds) },
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
