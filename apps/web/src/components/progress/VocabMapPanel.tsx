import { masteryLevel, type CardState, type WordItem } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import VocabMap from "../VocabMap";
import { LEVEL_KEYS } from "../../lib/mapLevels";

/** 学习进度页顶部的词汇地图：概览数字 + 分段进度条 + 地图（悬浮看词） */
export default function VocabMapPanel({ name, words, cards }: { name: string; words: WordItem[]; cards: Map<string, CardState> }) {
  const { t } = useSettings();
  const counts = [0, 0, 0, 0];
  for (const w of words) counts[masteryLevel(cards.get(w.id))]! += 1;
  const total = words.length || 1;
  const pct = (n: number) => Math.round((n / total) * 1000) / 10;
  // 从“已掌握”到“未学”排列，最重要的在前
  const order = [3, 2, 1, 0];
  return (
    <section className="map-panel">
      <header className="map-panel-head">
        <div>
          <span className="map-panel-eyebrow">{t("map.title")}</span>
          <h2>{name}</h2>
        </div>
        <div className="map-legend">
          <span>{t("map.less")}</span>
          {[0, 1, 2, 3].map((l) => (
            <i key={l} className={`level-${l}`} title={t(LEVEL_KEYS[l]!)} />
          ))}
          <span>{t("map.more")}</span>
        </div>
      </header>

      <div className="map-kpis">
        {order.map((l) => (
          <div key={l} className="map-kpi">
            <span className="map-kpi-label">
              <i className={`level-${l}`} />
              {t(LEVEL_KEYS[l]!)}
            </span>
            <span className="map-kpi-value">{counts[l]}</span>
            <span className="map-kpi-pct">{pct(counts[l]!)}%</span>
          </div>
        ))}
      </div>

      <div className="map-bar" aria-hidden>
        {order.map((l) => (counts[l] ? <span key={l} className={`level-${l}`} style={{ flexGrow: counts[l] }} /> : null))}
      </div>

      <VocabMap words={words} cards={cards} cell={words.length > 3000 ? 7 : 10} className="map-panel-map" />
    </section>
  );
}
