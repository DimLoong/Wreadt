import type { ReactNode } from "react";
import { useSettings } from "../../context/settings";
import { formatSeconds } from "../../lib/typingStats";
import type { SkinStats } from "./types";

/** 标题栏右侧的窗口按钮：✕ 退出伪装 */
export function WindowControls({ onExit }: { onExit: () => void }) {
  const { t } = useSettings();
  return (
    <span className="skin-window-controls">
      <span aria-hidden>—</span>
      <span aria-hidden>▢</span>
      <button type="button" className="skin-close" title={t("skin.exit")} aria-label={t("skin.exit")} onClick={onExit}>
        ✕
      </button>
    </span>
  );
}

/** 状态栏里的本组数据：用时、速度、一次拼对、正确率、进度 */
export function StatusStats({ stats }: { stats: SkinStats }) {
  const { t } = useSettings();
  return (
    <>
      <span title={t("stats.time")}>{formatSeconds(stats.seconds)}</span>
      <span title={t("stats.speed")}>{stats.wpm} WPM</span>
      <span title={t("stats.correct")}>
        ✓ {stats.correct}/{stats.done}
      </span>
      <span title={t("stats.accuracy")}>{stats.accuracy}%</span>
      <span>
        {stats.current}/{stats.total}
      </span>
    </>
  );
}

/** 右下角通知（一组结束时） */
export function SkinToast({ children }: { children: ReactNode }) {
  return (
    <div className="skin-toast" role="status">
      {children}
    </div>
  );
}
