import { useState } from "react";
import { Card } from "tdesign-react";
import type { WordInsight } from "@wreadt/core";
import { useSettings } from "../../context/settings";

/** 收起时的一行提示：和哪些熟词容易混，点一下展开“更多” */
export function InsightTeaser({ word, insight, onOpen }: { word: string; insight: WordInsight; onOpen: () => void }) {
  const { t } = useSettings();
  if (!insight.contrasts.length) return null;
  return (
    <button
      type="button"
      className="insight-teaser pop-in"
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <span className="muted">{t("insight.vs")}</span> <b lang="en">{word}</b> ≠ <b lang="en">{insight.contrasts.map((c) => c.word).join(" · ")}</b> →
    </button>
  );
}

/** 词义详解：先只给一句话的核心，点“展开详解”再看共同核心、搭配、语气与辨析 */
export default function WordInsightCard({ insight }: { insight: WordInsight }) {
  const { t } = useSettings();
  const [open, setOpen] = useState(false);
  return (
    <Card title={t("insight.title")} bordered={false} size="small" className="detail-card insight-card">
      <p className="insight-core">{insight.core}</p>
      {/* 辨析最有用：默认就显示，其余收进“展开详解” */}
      {insight.contrasts.length > 0 && (
        <ul className="detail-list insight-contrasts">
          {insight.contrasts.map((c) => (
            <li key={c.word}>
              <span className="primary" lang="en">
                vs {c.word}
              </span>
              <span className="secondary">{c.note}</span>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="insight-more pop-in">
          {insight.essence && (
            <section>
              <h4>{t("insight.essence")}</h4>
              <p>{insight.essence}</p>
            </section>
          )}
          {insight.collocations.length > 0 && (
            <section>
              <h4>{t("insight.collocations")}</h4>
              <ul className="detail-list">
                {insight.collocations.map((c) => (
                  <li key={c.phrase}>
                    <span className="primary" lang="en">
                      {c.phrase}
                    </span>
                    <span className="secondary">{c.note}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {insight.tone && (
            <section>
              <h4>{t("insight.tone")}</h4>
              <p>{insight.tone}</p>
            </section>
          )}
        </div>
      )}
      {(insight.essence || insight.collocations.length > 0 || insight.tone) && (
        <button
          type="button"
          className="detail-more-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          {t(open ? "insight.less" : "insight.more")}
        </button>
      )}
    </Card>
  );
}
