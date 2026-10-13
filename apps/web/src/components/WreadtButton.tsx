import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "tdesign-react";
import { useSettings } from "../context/settings";
import { useTypingProgress } from "../context/typingProgress";

const RIPPLE_EVERY_MS = 10_000;
/** 进度环与按钮之间的间隙 */
const GAP = 4;

/** 是否正在别处的输入框里打字（此时不打扰用户） */
function typingElsewhere() {
  const el = document.activeElement;
  return Boolean(el?.closest("textarea, input:not(.typing-capture), [contenteditable=true]"));
}

/**
 * 导航主按钮：Let's Wreadt。
 * 本组学到一半时显示进度环（已学 / 本组总数）；离开打字页时文字变为“继续 7/10”，并每 10 秒轻轻涟漪提醒
 * （正在别处输入或系统开启“减少动态效果”时不提醒）。
 */
export default function WreadtButton({ onTypingPage }: { onTypingPage: boolean }) {
  const { t } = useSettings();
  const navigate = useNavigate();
  const { progress } = useTypingProgress();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [ripple, setRipple] = useState(false);
  const [brandFont, setBrandFont] = useState(true);

  const inProgress = Boolean(progress && progress.current > 0 && progress.current < progress.total);
  const pct = progress && progress.total ? (progress.current / progress.total) * 100 : 0;
  const away = inProgress && !onTypingPage;

  // 本机装有腾讯体时直接使用（自带倾斜），否则用倾斜的系统粗体模拟
  useEffect(() => {
    void document.fonts?.load('16px "TencentSans W7"').then((faces) => setBrandFont(faces.length > 0));
  }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!away || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let clear: number | undefined;
    const timer = window.setInterval(() => {
      if (typingElsewhere() || document.visibilityState !== "visible") return;
      setRipple(true);
      clear = window.setTimeout(() => setRipple(false), 1200);
    }, RIPPLE_EVERY_MS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(clear);
    };
  }, [away]);

  const { w, h } = size;
  return (
    <span ref={wrapRef} className={`wreadt-btn-wrap ${ripple ? "ripple" : ""}`}>
      {/* 已在打字页时降为“当前页”样式，不再抢视觉 */}
      <Button
        theme="primary"
        variant={onTypingPage ? "text" : "base"}
        shape="round"
        className={`wreadt-btn ${brandFont ? "" : "brand-fallback"} ${onTypingPage ? "current" : ""}`}
        aria-current={onTypingPage ? "page" : undefined}
        onClick={() => navigate("/typing")}
      >
        {away ? `${t("nav.resume")} ${progress!.current}/${progress!.total}` : "Let's Wreadt"}
      </Button>
      {inProgress && w > 0 && (
        <svg className="wreadt-ring" width={w + GAP * 2 + 2} height={h + GAP * 2 + 2} style={{ left: -GAP - 1, top: -GAP - 1 }} aria-hidden="true">
          <rect className="track" x={1} y={1} width={w + GAP * 2} height={h + GAP * 2} rx={(h + GAP * 2) / 2} pathLength={100} />
          <rect className="bar" x={1} y={1} width={w + GAP * 2} height={h + GAP * 2} rx={(h + GAP * 2) / 2} pathLength={100} strokeDasharray={`${pct} 100`} />
        </svg>
      )}
    </span>
  );
}
