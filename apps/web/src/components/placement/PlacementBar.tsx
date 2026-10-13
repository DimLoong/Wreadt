import type { PlacementItem } from "@wreadt/core";
import { useSettings } from "../../context/settings";

interface Props {
  items: PlacementItem[];
  answers: Map<string, boolean>;
  /** 当前所在的题 */
  index: number;
  /** 第一道未答的题，只能跳到这里及之前 */
  frontier: number;
  /** 题目还没出到这么多时，用虚线段占位，让用户知道大概要答多少 */
  planned: number;
  onSelect: (index: number) => void;
}

/** 分段进度条：每题一段，认识为绿、不认识为红，小三角标出当前位置；点击已答的段可跳转 */
export default function PlacementBar({ items, answers, index, frontier, planned, onSelect }: Props) {
  const { t } = useSettings();
  return (
    <div className="placement-bar">
      {items.map((it, i) => {
        const a = answers.get(it.word.id);
        const state = a === true ? "known" : a === false ? "unknown" : "";
        return (
          <button
            key={it.word.id}
            type="button"
            className={`placement-seg ${state} ${i === index ? "current" : ""}`}
            disabled={i > frontier}
            onClick={() => onSelect(i)}
            aria-label={t("placement.segment", { n: i + 1 })}
            aria-current={i === index ? "step" : undefined}
          />
        );
      })}
      {Array.from({ length: Math.max(0, planned - items.length) }, (_, i) => (
        <span key={`ghost-${i}`} className="placement-seg ghost" />
      ))}
    </div>
  );
}
