import type { PlacementItem } from "@wreadt/core";
import { useSettings } from "../../context/settings";

interface Props {
  items: PlacementItem[];
  answers: Map<string, boolean>;
  /** 当前所在的题 */
  index: number;
  /** 第一道未答的题，只能跳到这里及之前 */
  frontier: number;
  /** 答到这里即可出结果，画一条刻度 */
  minCount: number;
  onSelect: (index: number) => void;
}

/** 分段进度条：每题一段，认识为绿、不认识为红，小三角标出当前位置；点击已答的段可跳转 */
export default function PlacementBar({ items, answers, index, frontier, minCount, onSelect }: Props) {
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
            className={`placement-seg ${state} ${i === index ? "current" : ""} ${i === minCount - 1 ? "min" : ""}`}
            disabled={i > frontier}
            onClick={() => onSelect(i)}
            aria-label={t("placement.segment", { n: i + 1 })}
            aria-current={i === index ? "step" : undefined}
          />
        );
      })}
    </div>
  );
}
