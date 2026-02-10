import { Button } from "tdesign-react";
import Heatmap from "./Heatmap";
import { t, type Locale } from "../i18n/messages";
import type { BatchResult } from "../types/typing";

interface BatchAnimationProps {
  locale: Locale;
  visible: boolean;
  masteredCount: number;
  results: BatchResult[];
  onSkip: () => void;
}

export default function BatchAnimation({
  locale,
  visible,
  masteredCount,
  results,
  onSkip,
}: BatchAnimationProps) {
  if (!visible) return null;

  return (
    <div className="batch-animation-overlay">
      <div className="batch-animation-card">
        <h3>{t(locale, "progressView")}</h3>
        <p>{t(locale, "mastered", { count: masteredCount })}</p>
        <Heatmap total={120} results={results} />
        <Button theme="primary" variant="outline" onClick={onSkip}>
          {t(locale, "skipAnimation")}
        </Button>
      </div>
    </div>
  );
}
