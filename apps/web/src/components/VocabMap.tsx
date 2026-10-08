import { useEffect, useRef } from "react";
import { masteryLevel, type CardState, type WordItem } from "@wreadt/core";

interface Props {
  words: WordItem[];
  cards: Map<string, CardState>;
  /** 需要高亮的词（本组） */
  highlight?: Set<string>;
  cell?: number;
  className?: string;
}

const GAP = 2;

function palette() {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return [
    v("--wd-level-0", "#e5e7eb"),
    v("--wd-level-1", "#bfdbfe"),
    v("--wd-level-2", "#60a5fa"),
    v("--wd-level-3", "#1d4ed8"),
    v("--wd-highlight", "#f59e0b"),
  ];
}

/** 每个词一个小方块，按掌握程度着色；词库可达数千词，故用 canvas 绘制 */
export default function VocabMap({ words, cards, highlight, cell = 8, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const width = boxRef.current?.clientWidth || 600;
    const cols = Math.max(1, Math.floor((width + GAP) / (cell + GAP)));
    const rows = Math.ceil(words.length / cols);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cols * (cell + GAP) * dpr;
    canvas.height = Math.max(1, rows * (cell + GAP)) * dpr;
    canvas.style.width = `${cols * (cell + GAP)}px`;
    canvas.style.height = `${rows * (cell + GAP)}px`;
    ctx.scale(dpr, dpr);

    const colors = palette();
    words.forEach((word, i) => {
      const x = (i % cols) * (cell + GAP);
      const y = Math.floor(i / cols) * (cell + GAP);
      ctx.fillStyle = colors[masteryLevel(cards.get(word.id))]!;
      ctx.fillRect(x, y, cell, cell);
      if (highlight?.has(word.id)) {
        ctx.strokeStyle = colors[4]!;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 0.75, y + 0.75, cell - 1.5, cell - 1.5);
      }
    });
  }, [words, cards, highlight, cell]);

  return (
    <div ref={boxRef} className={className} style={{ width: "100%" }}>
      <canvas ref={ref} role="img" aria-label={`${words.length} words`} style={{ display: "block" }} />
    </div>
  );
}
