import { useState } from "react";
import { Button, Card, Radio } from "tdesign-react";
import type { Reading } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { Highlight } from "./FeedCard";
import NewsCover from "../news/NewsCover";

/** 微阅读：小短文（高亮学过的词）+ 理解题，选完立即显示对错与解析 */
export default function ReadingCard({ reading }: { reading: Reading }) {
  const { t } = useSettings();
  const [showTrans, setShowTrans] = useState(false);
  const [picked, setPicked] = useState<Record<number, string>>({});

  return (
    <Card bordered className="feed-card reading-card">
      {reading.news && <NewsCover news={reading.news} />}
      <div className="feed-topic">
        <h3 lang="en">{reading.title}</h3>
        <Button size="small" variant="text" onClick={() => setShowTrans((v) => !v)}>
          {t("feed.translate")}
        </Button>
      </div>
      {reading.text.split(/\n+/).map((para, i) => (
        <p key={i} lang="en" className="reading-text">
          <Highlight text={para} words={reading.usedWords} />
        </p>
      ))}
      {showTrans &&
        reading.textTrans.split(/\n+/).map((para, i) => (
          <p key={i} className="muted feed-trans">
            {para}
          </p>
        ))}

      {reading.questions.map((q, i) => {
        const choice = picked[i];
        return (
          <div key={i} className="reading-question">
            <strong lang="en">{q.question}</strong>
            <Radio.Group value={choice ?? ""} disabled={choice !== undefined} onChange={(v) => setPicked((p) => ({ ...p, [i]: String(v) }))} className="reading-options">
              {q.options.map((o) => (
                <Radio key={o} value={o} className={choice !== undefined && o === q.answer ? "correct" : choice === o ? "wrong" : ""}>
                  <span lang="en">{o}</span>
                </Radio>
              ))}
            </Radio.Group>
            {choice !== undefined && (
              <p className={choice === q.answer ? "reading-result correct" : "reading-result wrong"}>
                {choice === q.answer ? t("feed.reading.correct") : t("feed.reading.wrong")}
                {q.explanation && <span className="muted"> {q.explanation}</span>}
              </p>
            )}
          </div>
        );
      })}
    </Card>
  );
}
