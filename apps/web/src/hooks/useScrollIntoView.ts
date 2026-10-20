import { useEffect, useRef } from "react";

/** 换词时把当前行滚到可见区域（假内容较多时单词可能在首屏以外） */
export function useScrollIntoView<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "center" });
  }, [dep]);
  return ref;
}
