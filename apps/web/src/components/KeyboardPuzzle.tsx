import { useMemo } from "react";
import type { CardState } from "@wreadt/core";
import { ACHIEVEMENTS, KEY_ROWS, keyboardStats, type AchievementInput } from "../lib/achievements";
import { useSettings } from "../context/settings";

interface Props {
  cards: CardState[];
  stats: Omit<AchievementInput, "keysLit">;
}

/** 以键盘为拼图：每个键是一块，随学习逐步点亮；下方是里程碑徽章 */
export default function KeyboardPuzzle({ cards, stats }: Props) {
  const { settings } = useSettings();
  const keys = useMemo(() => keyboardStats(cards), [cards]);
  const keysLit = Object.values(keys).filter((k) => k.level > 0).length;
  const input = { ...stats, keysLit };
  const zh = settings.locale === "zh-CN";

  return (
    <div className="puzzle">
      <div className="puzzle-keyboard" aria-label={`${keysLit}/26`}>
        {KEY_ROWS.map((row, r) => (
          <div className="puzzle-row" key={row} style={{ paddingLeft: `${r * 1.4}em` }}>
            {Array.from(row).map((ch) => {
              const k = keys[ch]!;
              return (
                <span key={ch} className={`puzzle-key level-${k.level}`} title={`${ch.toUpperCase()} · ${k.learned} / ${k.mastered}★`}>
                  {ch.toUpperCase()}
                </span>
              );
            })}
          </div>
        ))}
        <div className="puzzle-count">{keysLit} / 26</div>
      </div>
      <ul className="badges">
        {ACHIEVEMENTS.map((a) => {
          const done = a.done(input);
          return (
            <li key={a.id} className={done ? "done" : ""} title={zh ? a.zh : a.en}>
              <span className="badge-icon">{a.icon}</span>
              <span>{zh ? a.zh : a.en}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
