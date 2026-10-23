import type { NewsRef } from "@wreadt/core";
import { useSettings } from "../../context/settings";

/** 基于新闻的题目 / 话题：小配图 + “据今日新闻” + 新闻原文标题（可点开来源） */
export default function NewsRefLine({ news }: { news: NewsRef }) {
  const { t } = useSettings();
  return (
    <a className="news-ref" href={news.url} target="_blank" rel="noreferrer">
      {news.image && <img src={news.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      <span className="news-ref-text">
        <span>{t("news.basedOn")} ↗</span>
        <span lang="en">{news.headline}</span>
      </span>
    </a>
  );
}
