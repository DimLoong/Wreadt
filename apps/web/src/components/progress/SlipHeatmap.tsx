import { useSettings } from "../../context/settings";
import type { MessageKey } from "../../i18n/messages";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
/** 标准指法：每个键由哪根手指负责 */
const FINGER: Record<string, string> = {
  q: "lp", a: "lp", z: "lp",
  w: "lr", s: "lr", x: "lr",
  e: "lm", d: "lm", c: "lm",
  r: "li", f: "li", v: "li", t: "li", g: "li", b: "li",
  y: "ri", h: "ri", n: "ri", u: "ri", j: "ri", m: "ri",
  i: "rm", k: "rm",
  o: "rr", l: "rr",
  p: "rp",
};

/** 手滑热力图：相邻键误触按“本该按的键”统计，颜色越深越常手滑 */
export default function SlipHeatmap({ keys }: { keys: Record<string, number> }) {
  const { t } = useSettings();
  const max = Math.max(1, ...Object.values(keys));
  const top = Object.entries(keys)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (!top.length) return null;
  return (
    <div className="slip-heatmap">
      <div className="slip-title">{t("spelling.slipTitle")}</div>
      <div className="slip-keyboard">
        {ROWS.map((row, r) => (
          <div key={row} className="slip-row" style={{ paddingLeft: `${r * 0.5 * 36}px` }}>
            {[...row].map((k) => {
              const n = keys[k] ?? 0;
              return (
                <span key={k} className="slip-key" style={{ "--heat": n / max } as React.CSSProperties} title={t("spelling.times", { count: n })}>
                  {k.toUpperCase()}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="muted slip-top">
        {t("spelling.slipTop")}
        {top.map(([k, n]) => (
          <span key={k} className="spelling-pair">
            {k.toUpperCase()}（{t(`finger.${FINGER[k] ?? "li"}` as MessageKey)}）×{n}
          </span>
        ))}
      </p>
    </div>
  );
}
