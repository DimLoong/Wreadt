import { useEffect, useState } from "react";
import { Drawer } from "tdesign-react";
import { Rating } from "@wreadt/core";
import type { BatchEntry } from "../../hooks/useStudySession";
import type { CardAnswer } from "../../lib/sentenceCards";
import { useSettings } from "../../context/settings";
import PracticeReview from "../typing/PracticeReview";

/** 伪装模式下一组结束的通知：本组结果 + 需要复习的词，造句点评在侧边抽屉里看；按 Enter 进入下一组 */
export default function SkinBatchNotice({ results, answers, onContinue }: { results: BatchEntry[]; answers: CardAnswer[]; onContinue: (reviewed: boolean) => void }) {
  const { t } = useSettings();
  const [open, setOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const correct = results.filter((r) => r.grade >= Rating.Good).length;
  const again = results.filter((r) => r.grade < Rating.Good).map((r) => r.word.display);

  useEffect(() => {
    if (open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("textarea")) return;
      if (e.key === "Enter") {
        e.preventDefault();
        onContinue(reviewed);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onContinue, open, reviewed]);

  return (
    <>
      <strong>{t("skin.batchDone", { count: results.length, correct })}</strong>
      {again.length > 0 && <span className="skin-toast-words">{t("skin.batchAgain", { words: again.join(", ") })}</span>}
      <div className="skin-toast-actions">
        {answers.length > 0 && (
          <button
            type="button"
            className="skin-toast-link"
            onClick={() => {
              setOpen(true);
              setReviewed(true);
            }}
          >
            {t("skin.viewReview", { count: answers.length })}
          </button>
        )}
        <button type="button" onClick={() => onContinue(reviewed)}>
          {t("skin.nextBatch")}
        </button>
      </div>
      <Drawer visible={open} header={t("cards.reviewTitle")} footer={false} size="420px" showOverlay={false} onClose={() => setOpen(false)}>
        <PracticeReview answers={answers} titled={false} />
      </Drawer>
    </>
  );
}
