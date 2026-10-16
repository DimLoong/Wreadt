import { useEffect, useMemo, useState } from "react";
import { Button } from "tdesign-react";
import { Rating, type CardState, type DictStats, type WordItem } from "@wreadt/core";
import type { BatchEntry } from "../hooks/useStudySession";
import { useSettings } from "../context/settings";
import PracticeReview from "./typing/PracticeReview";
import type { CardAnswer } from "../lib/sentenceCards";
import VocabMap from "./VocabMap";
import { BookmarkCheckedFilledIcon } from "tdesign-icons-react";
import { useMarks } from "../hooks/useMarks";
import { toggleMark } from "../store/repo";
import BatchScenario from "./scenario/BatchScenario";
import type { ScenarioArgs } from "../services/scenarioPrefetch";

interface Props {
  results: BatchEntry[];
  allWords: WordItem[];
  cards: Map<string, CardState>;
  stats: DictStats;
  onContinue: () => void;
  /** 本组的场景练习（预生成题目的 key 与出题参数） */
  scenario?: { key: string; args: ScenarioArgs };
  /** 本组穿插的造句卡作答，组末统一点评 */
  practice?: { key: string; answers: CardAnswer[] };
}

const GRADE_CLASS: Record<number, string> = {
  [Rating.Again]: "again",
  [Rating.Hard]: "hard",
  [Rating.Good]: "good",
  [Rating.Easy]: "easy",
};

/** 一组完成：先聚焦本组结果，再“拉远镜头”展示整个词库的掌握地图 */
export default function BatchSummary({ results, allWords, cards, stats, onContinue, scenario, practice }: Props) {
  const { t } = useSettings();
  const marks = useMarks();
  const [scenarioDone, setScenarioDone] = useState(false);
  const highlight = useMemo(() => new Set(results.map((r) => r.word.id)), [results]);
  const correct = results.filter((r) => r.grade >= Rating.Good).length;
  const accuracy = results.length ? Math.round((correct / results.length) * 100) : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 在场景练习里打字时不触发“继续”
      if ((e.target as HTMLElement | null)?.closest("textarea, input")) return;
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
            <li key={r.word.id} className={`grade-${GRADE_CLASS[r.grade]} ${marks.has(r.word.id) ? "marked" : ""}`}>
              <button type="button" title={`${r.word.meanings.join("；")} · ${t("marks.clickToMark")}`} onClick={() => void toggleMark(r.word)}>
                {marks.has(r.word.id) && <BookmarkCheckedFilledIcon />}
                {r.word.display}
              </button>
            </li>
          ))}
        </ul>
        <p className="muted batch-mark-tip">{t("marks.batchTip")}</p>
        <div className="batch-map">
          <VocabMap words={allWords} cards={cards} highlight={highlight} cell={allWords.length > 3000 ? 5 : 8} />
        </div>
        <p className="batch-mastered">{t("batch.mastered", { count: stats.mastered })}</p>
        {practice && <PracticeReview batchKey={practice.key} answers={practice.answers} />}
        {scenario && <BatchScenario prefetchKey={scenario.key} args={scenario.args} onReviewed={() => setScenarioDone(true)} />}
        <div className="batch-actions">
          <Button theme="primary" size="large" onClick={onContinue}>
            {scenario && !scenarioDone ? t("batch.continueSkip") : t("batch.continue")} ⏎
          </Button>
        </div>
      </div>
    </div>
  );
}
