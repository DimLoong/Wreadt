import { useEffect, useRef } from "react";

/**
 * 换词时把当前行滚到所在滚动区域的中间（假内容较多时单词可能在首屏以外）。
 * 只滚动最近的可滚动容器，不带动外层页面（设置页里的缩略预览也会用到）。
 */
export function useScrollIntoView<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    let box = el?.parentElement ?? null;
    while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
    if (!el || !box) return;
    const elRect = el.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();
    // 预览是缩放显示的，换算回实际像素
    const scale = boxRect.height / box.offsetHeight || 1;
    box.scrollTop += (elRect.top - boxRect.top - (boxRect.height - elRect.height) / 2) / scale;
  }, [dep]);
  return ref;
}
