import { useEffect, useState } from "react";
import { Tag } from "tdesign-react";
import { lemmaCandidates, type CardReview } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { aiSource, reviewPractice } from "../../services/ai";
import { lookupIndex } from "../../store/dicts";
import { markWord } from "../../store/repo";
import { cardQuestion, cardReference, type CardAnswer } from "../../lib/sentenceCards";
import type { MessageKey } from "../../i18n/messages";
import ScoreBadge from "../ScoreBadge";

/** 同一组只点评一次（StrictMode 重复挂载、反复打开总结都复用） */
const reviews = new Map<string, Promise<(CardReview | null)[] | null>>();

/** 用错的目标词自动加入 Mark（原因：用法），之后的打字组会穿插复习 */
async function markMisused(result: (CardReview | null)[]): Promise<string[]> {
  const words = [...new Set(result.flatMap((r) => r?.misused ?? []))];
  if (!words.length) return [];
  const index = await lookupIndex("en");
  const marked: string[] = [];
  for (const w of words) {
    const item = lemmaCandidates(w).map((x) => index.get(x)).find(Boolean);
    if (item) {
      await markWord(item, "usage");
      marked.push(w);
    }
  }
  return marked;
}

function load(key: string, answers: CardAnswer[], locale: string) {
  let pending = reviews.get(key);
  if (!pending) {
    pending = (async () => {
      if (!(await aiSource())) return null;
      const items = answers.map((a) => ({ kind: a.card.kind, words: a.card.words, question: cardQuestion(a.card), reference: cardReference(a.card), answer: a.input }));
      return reviewPractice(items, locale);
    })();
    pending.catch(() => reviews.delete(key));
    reviews.set(key, pending);
  }
  return pending;
}

const VERDICT_THEME = { great: "success", good: "primary", fix: "warning" } as const;

/** 组总结里的造句点评：本地判题结果立即显示，AI 点评后台返回后补上；用错的词自动加入 Mark */
export default function PracticeReview({ batchKey, answers }: { batchKey: string; answers: CardAnswer[] }) {
  const { t, settings } = useSettings();
  const [result, setResult] = useState<(CardReview | null)[] | null | "loading" | "error">("loading");
  const [marked, setMarked] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    load(batchKey, answers, settings.locale)
      .then(async (r) => {
        if (cancelled) return;
        setResult(r);
        if (r) setMarked(await markMisused(r));
      })
      .catch(() => !cancelled && setResult("error"));
    return () => {
      cancelled = true;
    };
  }, [batchKey, answers, settings.locale]);

  if (!answers.length) return null;
  return (
    <section className="practice-review">
      <h3>
        {t("cards.reviewTitle")}
        {result === "loading" && <span className="muted"> · {t("cards.reviewing")}</span>}
        {result === "error" && <span className="muted"> · {t("cards.reviewFailed")}</span>}
      </h3>
      <ul>
        {answers.map((a, i) => {
          const r = Array.isArray(result) ? result[i] : null;
          return (
            <li key={i}>
              <div className="practice-review-q">
                <Tag size="small" variant="light">
                  {t(a.card.kind === "cloze" ? "cards.cloze" : "cards.translate")}
                </Tag>
                <span>{a.card.kind === "cloze" ? a.card.sentence : a.card.zh}</span>
              </div>
              <div className="practice-review-a" lang="en">
                {a.input}
                {r ? (
                  <>
                    <ScoreBadge score={r.score} offTopic={r.score === null} />
                    <Tag size="small" variant="light" theme={VERDICT_THEME[r.verdict]}>
                      {t(`cards.verdict.${r.verdict}` as MessageKey)}
                    </Tag>
                  </>
                ) : (
                  <Tag size="small" variant="light" theme={a.ok ? "success" : "warning"}>
                    {a.ok ? t("cards.localOk") : t("cards.localBad")}
                  </Tag>
                )}
              </div>
              {r?.comment && <div className="muted">{r.comment}</div>}
              {r?.better && r.better !== a.input && (
                <div className="practice-review-better" lang="en">
                  → {r.better}
                </div>
              )}
              {!r && <div className="muted practice-review-better" lang="en">{t("cards.reference")} {cardReference(a.card)}</div>}
            </li>
          );
        })}
      </ul>
      {marked.length > 0 && <p className="muted">{t("cards.marked", { words: marked.join("、") })}</p>}
    </section>
  );
}
