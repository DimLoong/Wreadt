import { useMemo, useState } from "react";
import { Alert, Button, Progress, Tag, Textarea } from "tdesign-react";
import { displaySubScore, SCENARIO_LEVELS, usesWord, wordKey, type ScenarioReview, type WordItem } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { db, type PracticeRow } from "../../store/db";
import { addCustomWord, markWord } from "../../store/repo";
import { reviewScenario } from "../../services/ai";
import { roleText } from "../../lib/roles";
import type { MessageKey } from "../../i18n/messages";
import ScoreBadge from "../ScoreBadge";

/** 场景点评里的新词不在任何词库中，mark 时构造一个词条快照 */
function scenarioWordItem(w: { word: string; meaning: string }): WordItem {
  return { id: wordKey("en", w.word), dictId: "scenario", lang: "en", display: w.word, answer: w.word.toLowerCase(), meanings: [w.meaning].filter(Boolean) };
}

export const TAG_THEME = { marked: "warning", today: "primary", weak: "danger", review: "success", new: "default" } as const;

export function ReviewView({ review, onAddWord, added }: { review: ScenarioReview; onAddWord: (w: { word: string; meaning: string }) => void; added: Set<string> }) {
  const { t } = useSettings();
  const [showModel, setShowModel] = useState(false);
  const dims = ["content", "vocabulary", "grammar", "coherence"] as const;
  return (
    <section className="panel review">
      <div className="review-head">
        <ScoreBadge score={review.score} offTopic={review.offTopic} size="large" />
        <div className="review-dims">
          {dims.map((d) => (
            <div key={d} className="review-dim">
              <span>{t(`scenario.dim.${d}` as MessageKey)}</span>
              {/* 分项同样显示为 5～10 */}
              <Progress percentage={review.offTopic ? 0 : displaySubScore(review.scores[d]) * 10} label={review.offTopic ? "—" : `${displaySubScore(review.scores[d]).toFixed(1)}`} />
            </div>
          ))}
        </div>
      </div>
      {review.summary && <p>{review.summary}</p>}
      {review.strengths.length > 0 && (
        <ul className="review-list good">
          {review.strengths.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}

      <h3>{t("scenario.sentences")}</h3>
      <ol className="sentence-review">
        {review.sentences.map((s, i) => (
          <li key={`${i}-${s.original}`}>
            <p className="original">{s.original}</p>
            {s.improved && s.improved !== s.original && <p className="improved">→ {s.improved}</p>}
            <div className="sentence-meta">
              {s.tags.map((tag) => (
                <Tag key={tag} size="small" variant="light" theme={tag === "good" ? "success" : "warning"}>
                  {t(`scenario.tag.${tag}` as MessageKey)}
                </Tag>
              ))}
              {s.notes && <span className="muted">{s.notes}</span>}
            </div>
          </li>
        ))}
      </ol>

      {(review.usedWords.length > 0 || review.misusedWords.length > 0 || review.missedPoints.length > 0) && (
        <div className="review-columns">
          {review.usedWords.length > 0 && (
            <div>
              <h3>{t("scenario.used")}</h3>
              <div className="word-chips">
                {review.usedWords.map((w) => (
                  <Tag key={w} theme="success" variant="light">
                    {w}
                  </Tag>
                ))}
              </div>
            </div>
          )}
          {review.misusedWords.length > 0 && (
            <div>
              <h3>{t("scenario.misused")}</h3>
              <ul className="review-list">
                {review.misusedWords.map((m) => (
                  <li key={m.word}>
                    <strong>{m.word}</strong> <span className="muted">{m.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {review.missedPoints.length > 0 && (
            <div>
              <h3>{t("scenario.missed")}</h3>
              <ul className="review-list">
                {review.missedPoints.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {review.newWords.length > 0 && (
        <>
          <h3>{t("scenario.newWords")}</h3>
          <div className="new-words">
            {review.newWords.map((w) => (
              <div key={w.word} className="new-word">
                <strong>{w.word}</strong>
                <span className="muted">{w.meaning}</span>
                <Button size="small" variant="text" disabled={added.has(w.word)} onClick={() => onAddWord(w)}>
                  {added.has(w.word) ? t("scenario.added") : t("scenario.addWord")}
                </Button>
                <Button size="small" variant="text" theme="warning" onClick={() => void markWord(scenarioWordItem(w))}>
                  {t("marks.mark")}
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      {review.modelAnswer && (
        <>
          <Button variant="outline" onClick={() => setShowModel(!showModel)}>
            {t("scenario.modelAnswer")}
          </Button>
          {showModel && <p className="model-answer">{review.modelAnswer}</p>}
        </>
      )}
    </section>
  );
}


interface Props {
  row: PracticeRow;
  onChange: (row: PracticeRow) => void;
  /** 紧凑模式：用于“一组完成”后的场景练习 */
  compact?: boolean;
}

/** 一道场景题：题目、推荐词 / 短语 / 句式、作答、提交点评、点评结果 */
export default function ScenarioWorkspace({ row, onChange, compact }: Props) {
  const { t, settings } = useSettings();
  const scenario = row.scenario;
  const [answer, setAnswer] = useState(row.answer);
  const [showTrans, setShowTrans] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const level = SCENARIO_LEVELS[scenario.level ?? "professional"];
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const usedCount = useMemo(() => scenario.recommendedWords.filter((w) => usesWord(answer, w.word)).length, [answer, scenario]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const review = await reviewScenario(roleText(row.role, t("scenario.general")), scenario, answer, settings.locale);
      const next = { ...row, answer, review };
      await db.practices.put(next);
      onChange(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addWord = async (w: { word: string; meaning: string }) => {
    await addCustomWord({ lang: "en", answer: w.word.toLowerCase(), meanings: [w.meaning].filter(Boolean) });
    setAdded((s) => new Set(s).add(w.word));
  };

  return (
    <>
      <section className={`panel scenario ${compact ? "compact" : ""}`}>
        <div className="scenario-title">
          <h2>{scenario.title}</h2>
          <Tag variant="light">{t(`scenario.level.${scenario.level ?? "professional"}` as MessageKey)}</Tag>
        </div>
        {scenario.scenario && (
          <p className="scenario-text" lang="en">
            {scenario.scenario}
          </p>
        )}
        <p className="scenario-question" lang="en">
          {scenario.question}
        </p>
        <Button size="small" variant="text" onClick={() => setShowTrans(!showTrans)}>
          {showTrans ? t("scenario.hideTrans") : t("scenario.showTrans")}
        </Button>
        {showTrans && (
          <div className="scenario-trans muted">
            {scenario.scenarioTrans && <p>{scenario.scenarioTrans}</p>}
            <p>{scenario.questionTrans}</p>
          </div>
        )}

        {scenario.directions.length > 0 && (
          <div className="directions">
            <span className="muted">{t("scenario.directions")}</span>
            {scenario.directions.map((d) => (
              <Tag key={d} variant="outline" theme="primary">
                {d}
              </Tag>
            ))}
          </div>
        )}

        {scenario.keyPoints.length > 0 && !scenario.directions.length && (
          <details>
            <summary>{t("scenario.keyPoints")}</summary>
            <ul className="review-list">
              {scenario.keyPoints.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </details>
        )}

        <h3>
          {t("scenario.recommended")} <span className="muted">{t("scenario.usedCount", { used: usedCount, total: scenario.recommendedWords.length })}</span>
        </h3>
        <div className="recommended">
          {scenario.recommendedWords.map((w) => (
            <div key={w.word} className={`rec-word ${usesWord(answer, w.word) ? "used" : ""}`} title={w.usage}>
              <strong>{w.word}</strong>
              <span className="muted">{w.meaning}</span>
              {w.tag !== "new" && (
                <Tag size="small" theme={TAG_THEME[w.tag]} variant="light">
                  {t(`scenario.wordTag.${w.tag}` as MessageKey)}
                </Tag>
              )}
            </div>
          ))}
        </div>

        {(scenario.phrases.length > 0 || scenario.grammar.length > 0) && (
          <div className="review-columns">
            {scenario.phrases.length > 0 && (
              <div>
                <h3>{t("scenario.phrases")}</h3>
                <ul className="review-list">
                  {scenario.phrases.map((p) => (
                    <li key={p.phrase} className={usesWord(answer, p.phrase) ? "used" : ""}>
                      <strong>{p.phrase}</strong> <span className="muted">{p.meaning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {scenario.grammar.length > 0 && (
              <div>
                <h3>{t("scenario.grammar")}</h3>
                <ul className="review-list">
                  {scenario.grammar.map((g) => (
                    <li key={g.pattern}>
                      <strong>{g.pattern}</strong> <span className="muted">{g.meaning}</span>
                      <div className="grammar-example">{g.example}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <Textarea
          value={answer}
          onChange={(v) => setAnswer(String(v))}
          placeholder={t("scenario.answerPlaceholder")}
          autosize={{ minRows: compact ? 4 : 6, maxRows: 16 }}
          disabled={Boolean(row.review)}
        />
        <div className="add-actions">
          {!row.review && (
            <Button theme="primary" loading={busy} disabled={words < level.minWords} onClick={() => void submit()}>
              {t("scenario.submit")}
            </Button>
          )}
          <span className="muted">{t("scenario.wordCount", { count: words, expected: scenario.expectedWords, min: level.minWords })}</span>
        </div>
        {error && <Alert theme="error" message={error} />}
      </section>

      {row.review && <ReviewView review={row.review} onAddWord={(w) => void addWord(w)} added={added} />}
    </>
  );
}
