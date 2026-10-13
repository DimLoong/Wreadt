import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/** 当前这一组的进度，供导航上的 Let's Wreadt 按钮显示进度环 */
export interface TypingProgress {
  current: number;
  total: number;
}

const Ctx = createContext<{ progress: TypingProgress | null; setProgress: (p: TypingProgress | null) => void }>({
  progress: null,
  setProgress: () => undefined,
});

export function TypingProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<TypingProgress | null>(null);
  const value = useMemo(() => ({ progress, setProgress }), [progress]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTypingProgress = () => useContext(Ctx);
