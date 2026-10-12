import { useEffect, useMemo } from "react";
import { Button } from "tdesign-react";
import { Rating, type CardState, type DictStats, type WordItem } from "@wreadt/core";
import type { BatchEntry } from "../hooks/useStudySession";
import { useSettings } from "../context/settings";
import VocabMap from "./VocabMap";

interface Props {
  results: BatchEntry[];
  allWords: WordItem[];
  cards: Map<string, CardState>;
  stats: DictStats;
  onContinue: () => void;
  /** 用本组单词做场景问答 */
  onScenario?: () => void;
}

const GRADE_CLASS: Record<number, string> = {
  [Rating.Again]: "again",
  [Rating.Hard]: "hard",
  [Rating.Good]: "good",
  [Rating.Easy]: "easy",
};

/** 一组完成：先聚焦本组结果，再“拉远镜头”展示整个词库的掌握地图 */
export default function BatchSummary({ results, allWords, cards, stats, onContinue, onScenario }: Props) {
  const { t } = useSettings();
  const highlight = useMemo(() => new Set(results.map((r) => r.word.id)), [results]);
  const correct = results.filter((r) => r.grade >= Rating.Good).length;
  const accuracy = results.length ? Math.round((correct / results.length) * 100) : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onContinue]);

  return (
    <div className="batch-overlay" role="dialog" aria-label={t("batch.title")}>
      <div className="batch-card">
        <h2>{t("batch.title")}</h2>
        <p className="muted">{t("batch.summary", { count: results.length, accuracy })}</p>
        <ul className="batch-words">
          {results.map((r) => (
            <li key={r.word.id} className={`grade-${GRADE_CLASS[r.grade]}`} title={r.word.meanings.join("；")}>
              {r.word.display}
            </li>
          ))}
        </ul>
        <div className="batch-map">
          <VocabMap words={allWords} cards={cards} highlight={highlight} cell={allWords.length > 3000 ? 5 : 8} />
        </div>
        <p className="batch-mastered">{t("batch.mastered", { count: stats.mastered })}</p>
        <div className="batch-actions">
          <Button theme="primary" size="large" onClick={onContinue}>
            {t("batch.continue")} ⏎
          </Button>
          {onScenario && (
            <Button variant="outline" size="large" onClick={onScenario}>
              {t("batch.scenario")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
