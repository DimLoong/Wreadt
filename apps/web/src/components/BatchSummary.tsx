import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "tdesign-react";
import { BookmarkCheckedFilledIcon, ChevronDownIcon, ChevronUpIcon } from "tdesign-icons-react";
import { Rating, type CardState, type DictStats, type WordItem } from "@wreadt/core";
import type { BatchEntry } from "../hooks/useStudySession";
import { useSettings } from "../context/settings";
import PracticeReview from "./typing/PracticeReview";
import type { CardAnswer } from "../lib/sentenceCards";
import VocabMap from "./VocabMap";
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
  /** 本组的场景练习（预生成题目的 key 与出题参数）：默认折叠，点开才出题 */
  scenario?: { key: string; args: ScenarioArgs };
  /** 组末阅读（热点短读） */
  reading?: ReactNode;
  /** 本组穿插的造句卡作答，组末统一点评 */
  practice?: { key: string; answers: CardAnswer[] };
}

const GRADE_CLASS: Record<number, string> = {
  [Rating.Again]: "again",
  [Rating.Hard]: "hard",
  [Rating.Good]: "good",
  [Rating.Easy]: "easy",
};

/**
 * 一组完成：直接显示在打字区（不再是弹窗）。上方是本组成绩与单词，下方左侧是阅读与造句点评、右侧是词库地图缩略；
 * 场景题折叠成一行，点开再出题。Enter 继续下一组。
 */
export default function BatchSummary({ results, allWords, cards, stats, onContinue, scenario, reading, practice }: Props) {
  const { t } = useSettings();
  const marks = useMarks();
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const highlight = useMemo(() => new Set(results.map((r) => r.word.id)), [results]);
  const correct = results.filter((r) => r.grade >= Rating.Good).length;
  const accuracy = results.length ? Math.round((correct / results.length) * 100) : 0;
  const fresh = results.filter((r) => r.isNew).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 在场景练习、造句里打字时不触发“继续”
      if ((e.target as HTMLElement | null)?.closest("textarea, input")) return;
      if (e.key === "Enter") {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onContinue]);

  return (
    <section className="batch-page" aria-label={t("batch.title")}>
      <header className="batch-page-head">
        <div>
          <span className="map-panel-eyebrow">{t("batch.title")}</span>
          <div className="batch-page-stats">
            <span className="batch-page-big">{accuracy}%</span>
            <span className="muted">{t("batch.statsLine", { count: results.length, fresh, review: results.length - fresh })}</span>
          </div>
        </div>
        <Button theme="primary" size="large" onClick={onContinue}>
          {t("batch.continue")} ↵
        </Button>
      </header>

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

      <div className="batch-page-body">
        <div className="batch-page-main">
          {reading}
          {practice && <PracticeReview batchKey={practice.key} answers={practice.answers} />}
        </div>
        <aside className="batch-page-side">
          <div className="batch-map-card">
            <div className="batch-map-card-head">
              <b>{stats.mastered}</b>
              <span className="muted">{t("batch.masteredShort")}</span>
            </div>
            <VocabMap words={allWords} cards={cards} highlight={highlight} cell={allWords.length > 3000 ? 3 : 5} />
            <Link to="/progress" className="batch-map-link">
              {t("batch.toProgress")} →
            </Link>
          </div>
        </aside>
      </div>

      {scenario && (
        <div className={`batch-scenario-fold ${scenarioOpen ? "open" : ""}`}>
          <button type="button" className="batch-scenario-toggle" onClick={() => setScenarioOpen((v) => !v)}>
            <span>{t("batch.scenarioAsk")}</span>
            <span className="muted">{t("batch.scenarioHint")}</span>
            {scenarioOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </button>
          {/* 点开才出题（题目在组开始时已预生成） */}
          {scenarioOpen && <BatchScenario prefetchKey={scenario.key} args={scenario.args} />}
        </div>
      )}
    </section>
  );
}
