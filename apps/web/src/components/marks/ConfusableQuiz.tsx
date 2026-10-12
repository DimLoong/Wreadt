import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Loading, Radio, Tag } from "tdesign-react";
import type { ConfusableGroup, Mark } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { AiUnavailableError, generateConfusableQuiz } from "../../services/ai";

/** 易混词辨析：AI 为每个词找出易混词，给出对比说明与选择填空 */
export default function ConfusableQuiz({ marks, onClose }: { marks: Mark[]; onClose: () => void }) {
  const { t, settings } = useSettings();
  const [groups, setGroups] = useState<ConfusableGroup[] | null>(null);
  const [error, setError] = useState<string | "unavailable" | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const lang = marks[0]?.word.lang ?? "en";
    generateConfusableQuiz(
      lang,
      marks.filter((m) => m.word.lang === lang).map((m) => ({ word: m.word.lang === "ja" ? m.word.display : m.word.answer, meaning: m.word.meanings.join("；") })),
      settings.locale,
    )
      .then((g) => !cancelled && setGroups(g))
      .catch((err) => !cancelled && setError(err instanceof AiUnavailableError ? "unavailable" : (err as Error).message));
    return () => {
      cancelled = true;
    };
  }, [marks, settings.locale]);

  return (
    <section className="panel confusable no-print">
      <div className="panel-head">
        <h2>{t("marks.practice.quiz")}</h2>
        <Button variant="text" onClick={onClose}>
          {t("marks.close")}
        </Button>
      </div>
      {!groups && !error && <Loading size="small" text={t("scenario.preparing")} />}
      {error === "unavailable" && <Alert theme="info" message={t("ai.unavailable")} operation={<Link to="/settings">{t("ai.configure")} →</Link>} />}
      {error && error !== "unavailable" && <Alert theme="error" message={error} />}
      {groups?.map((g) => (
        <div key={g.words.join("|")} className="confusable-group">
          <div className="word-chips">
            {g.words.map((w) => (
              <Tag key={w} theme="primary" variant="light">
                {w}
              </Tag>
            ))}
          </div>
          <p className="muted">{g.explanation}</p>
          <ol className="confusable-items">
            {g.items.map((it, i) => {
              const id = `${g.words.join("|")}#${i}`;
              const picked = answers[id];
              return (
                <li key={id}>
                  <p>{it.sentence}</p>
                  <Radio.Group value={picked} onChange={(v) => setAnswers((a) => ({ ...a, [id]: String(v) }))} disabled={Boolean(picked)}>
                    {it.options.map((o) => (
                      <Radio key={o} value={o}>
                        {o}
                      </Radio>
                    ))}
                  </Radio.Group>
                  {picked && (
                    <p className={picked === it.answer ? "ok" : "hint"}>
                      {picked === it.answer ? t("sentence.correct") : t("marks.quizAnswer", { answer: it.answer })} {it.explanation}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </section>
  );
}
