import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card, Tag, Textarea } from "tdesign-react";
import { usesWord, type FeedItem, type ScenarioReview } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { AiUnavailableError, reviewScenario } from "../../services/ai";
import { addCustomWord } from "../../store/repo";
import { feedToScenario } from "../../lib/feed";
import { ReviewView } from "../scenario/ScenarioWorkspace";

/** 把文中用到的目标词高亮出来（允许 -s / -ed / -ing 等词形变化） */
function Highlight({ text, words }: { text: string; words: string[] }) {
  const stems = words.filter(Boolean).map((w) => w.toLowerCase().replace(/(ing|ed|es|ly|e|y|s)$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!stems.length) return <>{text}</>;
  const re = new RegExp(`\\b((?:${stems.join("|")})[a-z-]{0,5})\\b`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

/** 一条兴趣流：话题、两个示范回复、跟着回复并获得点评 */
export default function FeedCard({ item, roleText }: { item: FeedItem; roleText: string }) {
  const { t, settings } = useSettings();
  const [showTrans, setShowTrans] = useState<Set<number>>(new Set());
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | "unavailable" | null>(null);
  const [review, setReview] = useState<ScenarioReview | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const toggleTrans = (i: number) =>
    setShowTrans((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      setReview(await reviewScenario(roleText, feedToScenario(item), answer, settings.locale));
    } catch (err) {
      setError(err instanceof AiUnavailableError ? "unavailable" : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  return (
    <Card bordered className="feed-card">
      <div className="feed-topic">
        <h3 lang="en">{item.topic}</h3>
        <Button size="small" variant="text" onClick={() => toggleTrans(-1)}>
          {t("feed.translate")}
        </Button>
      </div>
      {showTrans.has(-1) && <p className="muted feed-trans">{item.topicTrans}</p>}
      {item.context && (
        <p className="feed-context" lang="en">
          {item.context}
          {showTrans.has(-1) && item.contextTrans && <span className="muted feed-trans"> {item.contextTrans}</span>}
        </p>
      )}

      <div className="feed-replies">
        {item.replies.map((r, i) => (
          <div key={i} className="feed-reply">
            <div className="feed-reply-head">
              <span className="feed-author">{r.author}</span>
              {r.stance && (
                <Tag size="small" variant="light" theme={i === 0 ? "primary" : "warning"}>
                  {r.stance}
                </Tag>
              )}
              <Button size="small" variant="text" onClick={() => toggleTrans(i)}>
                {t("feed.translate")}
              </Button>
            </div>
            <p lang="en">
              <Highlight text={r.text} words={item.usedWords} />
            </p>
            {showTrans.has(i) && <p className="muted feed-trans">{r.textTrans}</p>}
          </div>
        ))}
      </div>

      {item.usedWords.length > 0 && (
        <div className="feed-words">
          <span className="muted">{t("feed.tryUsing")}</span>
          {item.usedWords.map((w) => (
            <Tag key={w} size="small" variant={usesWord(answer, w) ? "light" : "outline"} theme={usesWord(answer, w) ? "success" : "default"}>
              {w}
            </Tag>
          ))}
        </div>
      )}

      {!review ? (
        <div className="feed-answer">
          <Textarea value={answer} onChange={(v) => setAnswer(String(v))} placeholder={t("feed.placeholder")} autosize={{ minRows: 2, maxRows: 8 }} />
          <div className="add-actions">
            <Button theme="primary" variant="outline" loading={busy} disabled={words < 8} onClick={() => void submit()}>
              {t("feed.submit")}
            </Button>
            <span className="muted">{t("feed.wordCount", { count: words })}</span>
          </div>
          {error === "unavailable" && <Alert theme="info" message={t("ai.unavailable")} operation={<Link to="/settings">{t("ai.configure")} →</Link>} />}
          {error && error !== "unavailable" && <Alert theme="error" message={error} />}
        </div>
      ) : (
        <div className="feed-review">
          <p className="feed-my-answer" lang="en">
            {answer}
          </p>
          <ReviewView
            review={review}
            added={added}
            onAddWord={(w) => {
              void addCustomWord({ lang: "en", answer: w.word.toLowerCase(), meanings: [w.meaning].filter(Boolean) });
              setAdded((s) => new Set(s).add(w.word));
            }}
          />
        </div>
      )}
    </Card>
  );
}
