import { useEffect, useState } from "react";
import type { AiTask } from "@wreadt/core";
import { expectedMs } from "../services/aiTiming";

/**
 * 等 AI 时的进度条（估算的）：按这种任务最近的实际耗时推进，先快后慢，
 * 到预计时间时约 80%，之后越来越慢、停在 95% 前，不会提前走满让人干等。
 * 等待中挂载、拿到结果卸载。
 */
export default function AiProgress({ task, label, className = "" }: { task: AiTask; label?: string; className?: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const timer = window.setInterval(() => setElapsed(performance.now() - start), 120);
    return () => window.clearInterval(timer);
  }, []);
  const expected = expectedMs(task);
  const pct = 95 * (1 - Math.exp((-2 * elapsed) / expected));
  return (
    <div className={`ai-progress ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
      <div className="ai-progress-track">
        <div className="ai-progress-bar" style={{ transform: `scaleX(${Math.max(0.04, pct / 100)})` }} />
      </div>
      {label && <span className="ai-progress-label">{label}</span>}
    </div>
  );
}
