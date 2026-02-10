import { useEffect, useMemo, useState } from "react";
import { Button } from "tdesign-react";
import Heatmap from "./Heatmap";
import { t, type Locale } from "../i18n/messages";
import type { BatchResult } from "../types/typing";

interface BatchAnimationProps {
  locale: Locale;
  visible?: boolean;
  masteredCount: number;
  results: BatchResult[];
  batchSize: number;
  onSkip: () => void;
}

type AnimationStage = "focus" | "color" | "zoomout" | "done";

const TASK_ANIMATION_PLAN: Record<AnimationStage, number> = {
  focus: 0,
  color: 480,
  zoomout: 1080,
  done: 1680,
};

export default function BatchAnimation({ locale, visible = true, masteredCount, results, batchSize, onSkip }: BatchAnimationProps) {
  const [stage, setStage] = useState<AnimationStage>("focus");

  const batchRange = useMemo(() => {
    const end = results.length;
    const start = Math.max(0, end - batchSize);
    return { start, end };
  }, [batchSize, results.length]);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStage("color"), TASK_ANIMATION_PLAN.color),
      window.setTimeout(() => setStage("zoomout"), TASK_ANIMATION_PLAN.zoomout),
      window.setTimeout(() => setStage("done"), TASK_ANIMATION_PLAN.done),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (stage !== "done") return;
    const autoClose = window.setTimeout(() => {
      onSkip();
    }, 720);

    return () => window.clearTimeout(autoClose);
  }, [onSkip, stage]);

  if (!visible) return null;

  return (
    <div className="batch-animation-overlay">
      <div className={`batch-animation-card stage-${stage}`}>
        <h3>{t(locale, "progressView")}</h3>
        {(stage === "done" || stage === "zoomout") && (
          <p>{t(locale, "mastered", { count: masteredCount })}</p>
        )}
        <Heatmap total={120} results={results} batchRange={batchRange} stage={stage} />
        <Button
          theme="primary"
          variant="outline"
          onClick={() => {
            window.setTimeout(() => onSkip(), 120);
          }}
        >
          {t(locale, "skipAnimation")}
        </Button>
      </div>
    </div>
  );
}
