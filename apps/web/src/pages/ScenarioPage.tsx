import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Progress, Radio, Select, Tag, Textarea } from "tdesign-react";
import { useLiveQuery } from "dexie-react-hooks";
import { DICTIONARIES, usesWord, type Scenario, type ScenarioReview } from "@wreadt/core";
import { useSettings } from "../context/settings";
import { db, type PracticeRow } from "../store/db";
import { addCustomWord } from "../store/repo";
import { lookupIndex } from "../store/dicts";
import { AiUnavailableError, generateScenario, reviewScenario, type TargetWord } from "../services/ai";
import { pickTargetWords } from "../lib/practiceWords";
import PracticeTabs from "../components/PracticeTabs";
import type { MessageKey } from "../i18n/messages";

const ROLES = DICTIONARIES.filter((d) => d.category === "role");
const GENERAL = "general";
const TAG_THEME = { today: "primary", weak: "danger", review: "success", new: "default" } as const;

function roleText(id: string, generalText: string) {
  const meta = ROLES.find((r) => r.id === id);
  return meta ? `${meta.name}：${meta.description}` : generalText;
}

function ReviewView({ review, onAddWord, added }: { review: ScenarioReview; onAddWord: (w: { word: string; meaning: string }) => void; added: Set<string> }) {
  const { t } = useSettings();
  const [showModel, setShowModel] = useState(false);
  const dims = ["content", "vocabulary", "grammar", "coherence"] as const;
  return (
    <section className="panel review">
      <div className="review-head">
        <Progress theme="circle" percentage={review.score} size="small" label={`${review.score}`} />
        <div className="review-dims">
          {dims.map((d) => (
            <div key={d} className="review-dim">
              <span>{t(`scenario.dim.${d}` as MessageKey)}</span>
              <Progress percentage={review.scores[d] * 10} label={`${review.scores[d]}/10`} />
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

export default function ScenarioPage() {
  const { t, settings } = useSettings();
  const defaultRole = settings.dictIds.find((id) => ROLES.some((r) => r.id === id)) ?? GENERAL;
  const [role, setRole] = useState(defaultRole);
  const [level, setLevel] = useState<"intermediate" | "advanced">("intermediate");
  const [targets, setTargets] = useState<TargetWord[]>([]);
  const [current, setCurrent] = useState<PracticeRow | null>(null);
  const [answer, setAnswer] = useState("");
  const [showTrans, setShowTrans] = useState(false);
  const [busy, setBusy] = useState<"question" | "review" | null>(null);
  const [error, setError] = useState<string | "unavailable" | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const history = useLiveQuery(() => db.practices.orderBy("createdAt").reverse().limit(10).toArray(), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([db.cards.toArray(), lookupIndex("en")]).then(([cards, index]) => {
      if (!cancelled) setTargets(pickTargetWords(cards, index));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const scenario: Scenario | null = current?.scenario ?? null;
  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const usedCount = useMemo(() => scenario?.recommendedWords.filter((w) => usesWord(answer, w.word)).length ?? 0, [answer, scenario]);

  const run = async <T,>(kind: "question" | "review", fn: () => Promise<T>) => {
    setBusy(kind);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err instanceof AiUnavailableError ? "unavailable" : (err as Error).message);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const newQuestion = async () => {
    const avoid = (history ?? []).map((h) => h.scenario.title).filter(Boolean);
    const s = await run("question", () => generateScenario(roleText(role, t("scenario.general")), targets, settings.locale, level, avoid));
    if (!s) return;
    const row: PracticeRow = { id: crypto.randomUUID(), createdAt: Date.now(), role, scenario: s, answer: "" };
    await db.practices.put(row);
    setCurrent(row);
    setAnswer("");
    setShowTrans(false);
    setAdded(new Set());
  };

  const submit = async () => {
    if (!current) return;
    const review = await run("review", () => reviewScenario(roleText(current.role, t("scenario.general")), current.scenario, answer, settings.locale));
    if (!review) return;
    const row = { ...current, answer, review };
    await db.practices.put(row);
    setCurrent(row);
  };

  const addWord = async (w: { word: string; meaning: string }) => {
    await addCustomWord({ lang: "en", answer: w.word.toLowerCase(), meanings: [w.meaning].filter(Boolean) });
    setAdded((s) => new Set(s).add(w.word));
  };

  return (
    <main className="page scenario-page">
      <PracticeTabs />
      <p className="muted">{t("scenario.desc")}</p>

      <section className="panel settings-list">
        <div className="setting-row">
          <span>{t("scenario.role")}</span>
          <Select value={role} onChange={(v) => setRole(String(v))} style={{ width: 200 }}>
            {ROLES.map((r) => (
              <Select.Option key={r.id} value={r.id} label={r.name} />
            ))}
            <Select.Option value={GENERAL} label={t("scenario.general")} />
          </Select>
        </div>
        <div className="setting-row">
          <span>{t("scenario.level")}</span>
          <Radio.Group variant="default-filled" value={level} onChange={(v) => setLevel(v as typeof level)}>
            <Radio.Button value="intermediate">{t("scenario.level.intermediate")}</Radio.Button>
            <Radio.Button value="advanced">{t("scenario.level.advanced")}</Radio.Button>
          </Radio.Group>
        </div>
        <div>
          <div className="muted setting-tip">{t("scenario.targets")}</div>
          <div className="word-chips">
            {targets.map((w) => (
              <Tag key={w.word} theme={TAG_THEME[w.tag]} variant="light" closable onClose={() => setTargets(targets.filter((x) => x !== w))} title={w.meaning}>
                {w.word}
              </Tag>
            ))}
            {targets.length === 0 && <span className="muted">{t("scenario.noTargets")}</span>}
          </div>
          <div className="tag-legend muted">
            {(["today", "weak", "review"] as const).map((tag) => (
              <span key={tag}>
                <Tag size="small" theme={TAG_THEME[tag]} variant="light">
                  {t(`scenario.wordTag.${tag}` as MessageKey)}
                </Tag>
              </span>
            ))}
          </div>
        </div>
        <Button theme="primary" loading={busy === "question"} onClick={() => void newQuestion()}>
          {scenario ? t("scenario.next") : t("scenario.generate")}
        </Button>
        {error === "unavailable" && (
          <Alert
            theme="info"
            message={t("ai.unavailable")}
            operation={
              <span className="alert-links">
                <Link to="/settings">{t("ai.configure")} →</Link>
                <Link to="/account">{t("ai.login")} →</Link>
              </span>
            }
          />
        )}
        {error && error !== "unavailable" && <Alert theme="error" message={error} />}
      </section>

      {scenario && current && (
        <section className="panel scenario">
          <h2>{scenario.title}</h2>
          <p className="scenario-text" lang="en">
            {scenario.scenario}
          </p>
          <p className="scenario-question" lang="en">
            {scenario.question}
          </p>
          <Button size="small" variant="text" onClick={() => setShowTrans(!showTrans)}>
            {showTrans ? t("scenario.hideTrans") : t("scenario.showTrans")}
          </Button>
          {showTrans && (
            <div className="scenario-trans muted">
              <p>{scenario.scenarioTrans}</p>
              <p>{scenario.questionTrans}</p>
            </div>
          )}

          {scenario.keyPoints.length > 0 && (
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
            autosize={{ minRows: 8, maxRows: 20 }}
            disabled={Boolean(current.review)}
          />
          <div className="add-actions">
            {!current.review && (
              <Button theme="primary" loading={busy === "review"} disabled={words < 20} onClick={() => void submit()}>
                {t("scenario.submit")}
              </Button>
            )}
            <span className="muted">{t("scenario.wordCount", { count: words })}</span>
          </div>
        </section>
      )}

      {current?.review && <ReviewView review={current.review} onAddWord={(w) => void addWord(w)} added={added} />}

      {history && history.some((h) => h.review) && (
        <section className="panel">
          <h2>{t("scenario.history")}</h2>
          <ul className="history">
            {history
              .filter((h) => h.review)
              .map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrent(h);
                      setAnswer(h.answer);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <span>{h.scenario.title}</span>
                    <span className="muted">
                      {new Date(h.createdAt).toLocaleDateString(settings.locale)} · {h.review!.score}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}
    </main>
  );
}
