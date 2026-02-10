import type { BatchResult } from "../types/typing";

interface HeatmapProps {
  total: number;
  results: BatchResult[];
}

function getColor(result?: BatchResult): string {
  if (!result) return "#9ca3af";
  if (result.accuracy >= 95) return "#1d4ed8";
  if (result.accuracy >= 80) return "#3b82f6";
  return "#93c5fd";
}

export default function Heatmap({ total, results }: HeatmapProps) {
  const squares = Array.from({ length: total });

  return (
    <div className="heatmap-grid" aria-label="Vocabulary Heatmap">
      {squares.map((_, index) => (
        <span
          key={index}
          className="heatmap-square"
          style={{ backgroundColor: getColor(results[index]) }}
        />
      ))}
    </div>
  );
}
