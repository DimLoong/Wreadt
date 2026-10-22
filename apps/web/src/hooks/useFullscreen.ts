import { useEffect, useState } from "react";

/** 浏览器全屏（去掉标签栏与地址栏）：返回是否全屏与切换函数；不支持全屏的浏览器（如 iPhone Safari）supported 为 false */
export function useFullscreen() {
  const [on, setOn] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const sync = () => setOn(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  return { on, toggle, supported: Boolean(document.documentElement.requestFullscreen) };
}
