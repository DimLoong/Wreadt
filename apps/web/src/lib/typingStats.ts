import { useEffect, useState } from "react";
import { addStudySeconds } from "../services/studyTime";

export interface TypingTotals {
  keystrokes: number;
  wrongKeystrokes: number;
  startedAt: number;
  done: number;
  correct: number;
}

/** 累计用时：只在 running（在打字页且本组未结束）时计时，离开页面暂停、回来继续 */
export function useElapsedSeconds(started: boolean, running: boolean) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!started || !running) return;
    const timer = window.setInterval(() => {
      setSeconds((s) => s + 1);
      addStudySeconds(1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [started, running]);
  return seconds;
}

export const pad = (n: number) => String(n).padStart(2, "0");
export const formatSeconds = (s: number) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
/** 速度：每 5 个正确按键算一个词 */
export const wpmOf = (stats: TypingTotals, seconds: number) => (seconds >= 5 ? Math.round((stats.keystrokes - stats.wrongKeystrokes) / 5 / (seconds / 60)) : 0);

