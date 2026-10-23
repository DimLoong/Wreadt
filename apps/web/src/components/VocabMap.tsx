import { useEffect, useRef, useState } from "react";
import { masteryLevel, type CardState, type WordItem } from "@wreadt/core";
import { useSettings } from "../context/settings";
import { LEVEL_KEYS } from "../lib/mapLevels";

interface Props {
  words: WordItem[];
  cards: Map<string, CardState>;
  /** 需要高亮的词（本组） */
  highlight?: Set<string>;
  cell?: number;
  className?: string;
}

const GAP = 3;

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

/**
 * 每个词一个小圆角方块，按掌握程度着色（GitHub 贡献图式）；词库可达数千词，用 canvas 绘制。
 * 鼠标悬浮显示该词的拼写、释义与掌握状态。
 */
export default function VocabMap({ words, cards, highlight, cell = 8, className }: Props) {
  const { t } = useSettings();
  const ref = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // 每行格数：绘制时算出，悬浮时用来换算是第几个词
  const colsRef = useRef(1);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const width = boxRef.current?.clientWidth || 600;
    const n = Math.max(1, Math.floor((width + GAP) / (cell + GAP)));
    colsRef.current = n;
    const rows = Math.ceil(words.length / n);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = n * (cell + GAP) * dpr;
    canvas.height = Math.max(1, rows * (cell + GAP)) * dpr;
    canvas.style.width = `${n * (cell + GAP)}px`;
    canvas.style.height = `${rows * (cell + GAP)}px`;
    ctx.scale(dpr, dpr);

    const colors = palette();
    const radius = Math.max(1, cell / 4);
    words.forEach((word, i) => {
      const x = (i % n) * (cell + GAP);
      const y = Math.floor(i / n) * (cell + GAP);
      ctx.fillStyle = colors[masteryLevel(cards.get(word.id))]!;
      ctx.beginPath();
      ctx.roundRect(x, y, cell, cell, radius);
      ctx.fill();
      if (highlight?.has(word.id)) {
        ctx.strokeStyle = colors[4]!;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(x + 0.75, y + 0.75, cell - 1.5, cell - 1.5, radius);
        ctx.stroke();
      }
    });
  }, [words, cards, highlight, cell]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const col = Math.floor((e.clientX - r.left) / (cell + GAP));
    const row = Math.floor((e.clientY - r.top) / (cell + GAP));
    const cols = colsRef.current;
    const i = row * cols + col;
    setHover(col < cols && i < words.length ? { i, x: e.clientX - r.left, y: e.clientY - r.top } : null);
  };

  const word = hover ? words[hover.i] : undefined;
  return (
    <div ref={boxRef} className={`vocab-map ${className ?? ""}`}>
      <canvas ref={ref} role="img" aria-label={`${words.length} words`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      {word && hover && (
        <div className="vocab-map-tip" style={{ left: hover.x, top: hover.y }}>
          <b lang={word.lang}>{word.display}</b>
          <span className={`vocab-map-level level-${masteryLevel(cards.get(word.id))}`}>{t(LEVEL_KEYS[masteryLevel(cards.get(word.id))]!)}</span>
          <span className="muted">{word.meanings[0]}</span>
        </div>
      )}
    </div>
  );
}
