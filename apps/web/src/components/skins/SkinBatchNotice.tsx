import { useEffect } from "react";
import { Rating } from "@wreadt/core";
import type { BatchEntry } from "../../hooks/useStudySession";
import { useSettings } from "../../context/settings";

/** 伪装模式下一组结束的通知：本组结果 + 需要复习的词，按 Enter 进入下一组 */
export default function SkinBatchNotice({ results, practiced, onContinue }: { results: BatchEntry[]; practiced: number; onContinue: () => void }) {
  const { t } = useSettings();
  const correct = results.filter((r) => r.grade >= Rating.Good).length;
  const again = results.filter((r) => r.grade < Rating.Good).map((r) => r.word.display);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest("textarea")) return;
      if (e.key === "Enter") {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onContinue]);

  return (
    <>
      <strong>{t("skin.batchDone", { count: results.length, correct })}</strong>
      {practiced > 0 && <span>{t("skin.batchPractice", { count: practiced })}</span>}
      {again.length > 0 && <span className="skin-toast-words">{t("skin.batchAgain", { words: again.join(", ") })}</span>}
      <button type="button" onClick={onContinue}>
        {t("skin.nextBatch")}
      </button>
    </>
  );
}
