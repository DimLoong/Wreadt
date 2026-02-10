import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./Home";

const mockUseTypingMachine = vi.fn();
const mockSetDarkMode = vi.fn();

vi.mock("../hooks/useTypingMachine", () => ({
  useTypingMachine: () => mockUseTypingMachine(),
}));

vi.mock("../context/AppContext", () => ({
  useAppContext: () => ({
    locale: "zh-CN",
    setLocale: vi.fn(),
    darkMode: true,
    setDarkMode: mockSetDarkMode,
    activeLang: "en",
    setActiveLang: vi.fn(),
    customByLang: { en: [], ja: [] },
    addCustomWord: vi.fn(),
    vocabularyByLang: { en: [], ja: [] },
    progressRecords: [],
    appendProgress: vi.fn(),
  }),
}));


describe("首页视觉改造关键交互回归", () => {
  it("保留单词主区、操作区、设置区并可切换主题", () => {
    mockUseTypingMachine.mockReturnValue({
      state: "STATE-01-Typing",
      input: "th",
      setInput: vi.fn(),
      currentWord: {
        id: "w1",
        text: "theme",
        phonetic: "/θiːm/",
        meaning: "主题",
        phrases: ["dark theme"],
        examples: ["This app uses a default blue theme."],
        lang: "en" as const,
      },
      firstValidKeyPressed: true,
      replayAudio: vi.fn().mockResolvedValue(undefined),
      gotoNextWord: vi.fn(),
      showBatchAnimation: false,
      closeBatchAnimation: vi.fn(),
      results: [],
      errorCount: 0,
      hintReason: "",
      accuracy: 60,
      batchSize: 15,
    });

    render(<Home />);

    expect(screen.getByText("theme")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "播放发音" })).toBeInTheDocument();
    expect(screen.getByText("Accuracy")).toBeInTheDocument();

    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    expect(mockSetDarkMode).toHaveBeenCalledWith(false);
  });
});
