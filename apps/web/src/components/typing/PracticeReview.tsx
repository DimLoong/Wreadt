import { Tag } from "tdesign-react";
import { clozeChunks, translateChunks } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import type { CardAnswer } from "../../lib/sentenceCards";

/** 组总结里的造句回顾：每道题的中文与英文，拼错过的段标出来；放在自带标题的容器里时不再显示标题 */
export default function PracticeReview({ answers, titled = true }: { answers: CardAnswer[]; titled?: boolean }) {
  const { t } = useSettings();
  if (!answers.length) return null;
  return (
    <section className="practice-review">
      {titled && <h3>{t("cards.reviewTitle")}</h3>}
      <ul>
        {answers.map((a, i) => {
          const card = a.card;
          const chunks = card.kind === "cloze" ? clozeChunks(card.sentence ?? "", card.answer ?? "") : translateChunks(card.reference ?? "", card.words);
          const missed = new Set(a.misses ?? []);
          return (
            <li key={i}>
              <div className="practice-review-q">
                <Tag size="small" variant="light">
                  {t(card.kind === "cloze" ? "cards.cloze" : "cards.translate")}
                </Tag>
                <span>{card.kind === "cloze" ? card.translation : card.zh}</span>
                <Tag size="small" variant="light" theme={missed.size ? "warning" : "success"}>
                  {missed.size ? t("cards.missCount", { n: missed.size }) : t("cards.allRight")}
                </Tag>
              </div>
              <div className="practice-review-a" lang="en">
                {chunks.map((c, j) => (
                  <span key={j} className={!c.given && missed.has(c.text) ? "missed" : undefined}>
                    {c.lead}
                    {c.text}
                    {c.trail}
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
