import { useEffect, useMemo, useState } from "react";
import { Button } from "tdesign-react";
import Heatmap from "./Heatmap";
import { t, type Locale } from "../i18n/messages";
import type { BatchResult } from "../types/typing";

interface BatchAnimationProps {
  locale: Locale;
  visible: boolean;
  masteredCount: number;
  results: BatchResult[];
  batchSize: number;
  onSkip: () => void;
}

type AnimationStage = "focus" | "color" | "zoomout" | "done";

export default function BatchAnimation({
  locale,
  visible,
  masteredCount,
  results,
  batchSize,
  onSkip,
}: BatchAnimationProps) {
  const [stage, setStage] = useState<AnimationStage>("focus");

  const batchRange = useMemo(() => {
    const end = results.length;
    const start = Math.max(0, end - batchSize);
    return { start, end };
  }, [batchSize, results.length]);

  useEffect(() => {
    if (!visible) return;
    setStage("focus");

    const timers = [
      window.setTimeout(() => setStage("color"), 480),
      window.setTimeout(() => setStage("zoomout"), 1080),
      window.setTimeout(() => setStage("done"), 1680),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="batch-animation-overlay">
      <div className={`batch-animation-card stage-${stage}`}>
        <h3>{t(locale, "progressView")}</h3>
        {(stage === "done" || stage === "zoomout") && (
          <p>{t(locale, "mastered", { count: masteredCount })}</p>
        )}
        <Heatmap total={120} results={results} batchRange={batchRange} stage={stage} />
        <Button theme="primary" variant="outline" onClick={onSkip}>
          {t(locale, "skipAnimation")}
        </Button>
      </div>
    </div>
  );
}
