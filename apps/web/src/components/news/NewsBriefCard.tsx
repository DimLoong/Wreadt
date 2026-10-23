import { useEffect, useState, type ReactNode } from "react";
import { Button } from "tdesign-react";
import { useSettings } from "../../context/settings";
import { takeNewsBrief, type ReadyBrief } from "../../lib/newsBrief";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 正文里高亮本组用到的词（允许常见变形，如 deploy → deployed） */
function highlight(text: string, words: string[]): ReactNode[] {
  if (!words.length) return [text];
  const stems = words.map((w) => escape(w.length > 4 ? w.replace(/e$/, "") : w));
  const re = new RegExp(`\\b((?:${stems.join("|")})[a-z]*)\\b`, "gi");
  // split 带捕获组：奇数下标是匹配到的词
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

/** 组末的热点短读：新闻配图 + 中文标题 + 用上本组单词的英文短讯（单词高亮），可看翻译，附来源 */
export default function NewsBriefCard({ briefKey }: { briefKey: string }) {
  const { t } = useSettings();
  const [brief, setBrief] = useState<ReadyBrief | null>(null);
  const [showTrans, setShowTrans] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void takeNewsBrief(briefKey)?.then((b) => !cancelled && setBrief(b));
    return () => {
      cancelled = true;
    };
  }, [briefKey]);

  if (!brief) return null;
  return (
    <section className="news-card">
      {brief.news.image && <img className="news-image" src={brief.news.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      <div className="news-body">
        <div className="news-head">
          <span className="map-panel-eyebrow">{t("news.eyebrow")}</span>
          <Button size="small" variant="text" onClick={() => setShowTrans((v) => !v)}>
            {t(showTrans ? "story.hideTrans" : "story.showTrans")}
          </Button>
        </div>
        <h3>{brief.title}</h3>
        <p className="news-text" lang="en">
          {highlight(brief.text, brief.usedWords)}
        </p>
        {showTrans && <p className="muted news-trans">{brief.translation}</p>}
        {brief.news.url && (
          <a className="news-source" href={brief.news.url} target="_blank" rel="noreferrer">
            {t("news.source")} ↗
          </a>
        )}
      </div>
    </section>
  );
}
