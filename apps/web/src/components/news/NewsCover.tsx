import type { NewsRef } from "@wreadt/core";
import { useSettings } from "../../context/settings";

/** 兴趣流卡片顶部的新闻封面：真实新闻配图 + “据今日新闻” + 原文标题（点开看来源） */
export default function NewsCover({ news }: { news: NewsRef }) {
  const { t } = useSettings();
  return (
    <a className="news-cover" href={news.url} target="_blank" rel="noreferrer">
      {news.image && <img src={news.image} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      <span className="news-cover-caption">
        <span className="map-panel-eyebrow">{t("news.basedOn")} ↗</span>
        <span lang="en">{news.headline}</span>
      </span>
    </a>
  );
}
