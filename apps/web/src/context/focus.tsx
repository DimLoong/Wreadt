import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** 打字时淡出导航等次要元素，鼠标一动即恢复 */
const FocusContext = createContext<{ focused: boolean; setFocused: (v: boolean) => void }>({
  focused: false,
  setFocused: () => undefined,
});

export function FocusProvider({ children }: { children: ReactNode }) {
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) return;
    const wake = () => setFocused(false);
    window.addEventListener("mousemove", wake, { once: true });
    return () => window.removeEventListener("mousemove", wake);
  }, [focused]);
  return <FocusContext.Provider value={{ focused, setFocused }}>{children}</FocusContext.Provider>;
}

export const useFocusMode = () => useContext(FocusContext);
