import { displayScore } from "@wreadt/core";
import { useSettings } from "../context/settings";

/**
 * 统一的分数显示：AI 内部 0～100，显示为 5～10 分（一位小数）；跑题或无法识别显示“无评分”。
 * size="large" 用于点评页的总分。
 */
export default function ScoreBadge({ score, offTopic = false, size = "small" }: { score: number | null | undefined; offTopic?: boolean; size?: "small" | "large" }) {
  const { t } = useSettings();
  const value = displayScore(score, offTopic);
  if (value === null)
    return (
      <span className={`score-badge ${size} none`} title={t("score.noneTip")}>
        {t("score.none")}
      </span>
    );
  const tier = value >= 9 ? "great" : value >= 7.5 ? "good" : "ok";
  return (
    <span className={`score-badge ${size} ${tier}`}>
      <b>{value.toFixed(1)}</b>
      <span>{t("score.unit")}</span>
    </span>
  );
}
