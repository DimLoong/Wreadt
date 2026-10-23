import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card, Tag, Textarea } from "tdesign-react";
import { usesWord, type FeedItem, type ScenarioReview } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { AiUnavailableError, reviewScenario } from "../../services/ai";
import { addCustomWord } from "../../store/repo";
import { feedToScenario, recordFeedScore } from "../../lib/feed";
import { stripMarkdown } from "../../lib/markdown";
import { ReviewView } from "../scenario/ScenarioWorkspace";
import type { MessageKey } from "../../i18n/messages";
import Avatar from "./Avatar";
import NewsCover from "../news/NewsCover";

/** 把文中用到的目标词（以及模型加粗的词）高亮出来，允许 -s / -ed / -ing 等词形变化 */
export function Highlight({ text, words }: { text: string; words: string[] }) {
  const { text: plain, emphasized } = stripMarkdown(text);
  const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stems = [
    ...words.filter(Boolean).map((w) => escape(w.toLowerCase().replace(/(ing|ed|es|ly|e|y|s)$/, "")) + "[a-z-]{0,5}"),
    ...emphasized.map(escape),
  ];
  if (!stems.length) return <>{plain}</>;
  // 中文没有单词边界，只对英文使用 \b
  const re = new RegExp(`((?:${stems.join("|")}))`, "gi");
  const parts = plain.split(re);
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
  // 发出后，我的回复像真实回复一样出现在示范回复下面，分析显示在更下方
  const [posted, setPosted] = useState(false);
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
    setPosted(true);
    setError(null);
    try {
      const r = await reviewScenario(roleText, feedToScenario(item), answer, settings.locale);
      setReview(r);
      // 分数用于自动调整兴趣流难度
      // 跑题的回复不计入平均分
      if (!r.offTopic) void recordFeedScore(r.score);
    } catch (err) {
      setError(err instanceof AiUnavailableError ? "unavailable" : (err as Error).message);
      // 点评失败：回复退回输入框，可以修改后重发
      setPosted(false);
    } finally {
      setBusy(false);
    }
  };

  const words = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  return (
    <Card bordered className="feed-card">
      {item.news && <NewsCover news={item.news} />}
      <div className="feed-topic">
        <h3 lang="en">
          {item.level && (
            <Tag size="small" variant="light" theme={item.level === "simple" ? "success" : "primary"} className="feed-level-tag">
              {t(`feed.level.${item.level}` as MessageKey)}
            </Tag>
          )}
          {stripMarkdown(item.topic).text}
        </h3>
        <Button size="small" variant="text" onClick={() => toggleTrans(-1)}>
          {t("feed.translate")}
        </Button>
      </div>
      {showTrans.has(-1) && <p className="muted feed-trans">{stripMarkdown(item.topicTrans).text}</p>}
      {item.context && (
        <p className="feed-context" lang="en">
          {stripMarkdown(item.context).text}
          {showTrans.has(-1) && item.contextTrans && <span className="muted feed-trans"> {stripMarkdown(item.contextTrans).text}</span>}
        </p>
      )}

      <div className="feed-replies">
        {item.replies.map((r, i) => (
          <div key={i} className="feed-reply">
            <div className="feed-reply-head">
              <Avatar seed={r.author || String(i)} />
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
            {showTrans.has(i) && (
              <p className="muted feed-trans">
                <Highlight text={r.textTrans} words={[]} />
              </p>
            )}
          </div>
        ))}
        {posted && (
          <div className="feed-reply mine">
            <div className="feed-reply-head">
              <Avatar seed="wreadt-me" />
              <span className="feed-author">{t("feed.me")}</span>
            </div>
            <p lang="en">
              <Highlight text={answer} words={item.usedWords} />
            </p>
          </div>
        )}
      </div>

      {item.usedWords.length > 0 && !posted && (
        <div className="feed-words">
          <span className="muted">{t("feed.tryUsing")}</span>
          {item.usedWords.map((w) => (
            <Tag key={w} size="small" variant={usesWord(answer, w) ? "light" : "outline"} theme={usesWord(answer, w) ? "success" : "default"}>
              {w}
            </Tag>
          ))}
        </div>
      )}

      {!posted ? (
        <div className="feed-answer">
          <Textarea value={answer} onChange={(v) => setAnswer(String(v))} placeholder={t("feed.placeholder")} autosize={{ minRows: 2, maxRows: 8 }} />
          <div className="add-actions">
            <Button theme="primary" variant="outline" loading={busy} disabled={!answer.trim()} onClick={() => void submit()}>
              {t("feed.send")}
            </Button>
            {words > 0 && <span className="muted">{t("feed.wordCount", { count: words })}</span>}
          </div>
          {error === "unavailable" && <Alert theme="info" message={t("ai.unavailable")} operation={<Link to="/settings?tab=ai">{t("ai.configure")} →</Link>} />}
          {error && error !== "unavailable" && <Alert theme="error" message={error} />}
        </div>
      ) : (
        <div className="feed-review">
          <h4 className="feed-review-title">{t("feed.analysis")}</h4>
          {!review && <p className="muted">{t("feed.analyzing")}</p>}
          {review && (
          <ReviewView
            review={review}
            added={added}
            onAddWord={(w) => {
              void addCustomWord({ lang: "en", answer: w.word.toLowerCase(), meanings: [w.meaning].filter(Boolean) });
              setAdded((s) => new Set(s).add(w.word));
            }}
          />
          )}
        </div>
      )}
    </Card>
  );
}
