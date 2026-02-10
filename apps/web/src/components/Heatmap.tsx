import type { BatchResult } from "../types/typing";

interface HeatmapProps {
  total: number;
  results: BatchResult[];
  batchRange: { start: number; end: number };
  stage: "focus" | "color" | "zoomout" | "done";
}

function getLevel(result?: BatchResult): "unlearned" | "learned_light" | "learned_medium" | "learned_deep" {
  if (!result) return "unlearned";
  if (result.accuracy >= 95) return "learned_deep";
  if (result.accuracy >= 80) return "learned_medium";
  return "learned_light";
}

export default function Heatmap({ total, results, batchRange, stage }: HeatmapProps) {
  const squares = Array.from({ length: total });

  return (
    <div className={`heatmap-grid stage-${stage}`} aria-label="Vocabulary Heatmap">
      {squares.map((_, index) => {
        const level = getLevel(results[index]);
        const inBatch = index >= batchRange.start && index < batchRange.end;
        const colorMap = {
          unlearned: "#9ca3af",
          learned_light: "#93c5fd",
          learned_medium: "#3b82f6",
          learned_deep: "#1d4ed8",
        } as const;
        return (
          <span
            key={index}
            className={`heatmap-square level-${level} ${inBatch ? "in-batch" : ""}`.trim()}
            style={{ backgroundColor: colorMap[level] }}
          />
        );
      })}
    </div>
  );
}
