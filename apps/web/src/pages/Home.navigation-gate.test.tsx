import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./Home";

const mockUseTypingMachine = vi.fn();

vi.mock("../hooks/useTypingMachine", () => ({
  useTypingMachine: () => mockUseTypingMachine(),
}));

vi.mock("../context/AppContext", () => ({
  useAppContext: () => ({
    locale: "zh-CN",
    setLocale: vi.fn(),
    darkMode: true,
    setDarkMode: vi.fn(),
    activeLang: "en",
    setActiveLang: vi.fn(),
    customByLang: { en: [], ja: [] },
    addCustomWord: vi.fn(),
    vocabularyByLang: { en: [], ja: [] },
    progressRecords: [],
    appendProgress: vi.fn(),
  }),
}));


describe("上下词按钮与快捷键门禁", () => {
  it("应提供上/下词按钮，并支持 ArrowUp / ArrowDown 快捷键", () => {
    const gotoNextWord = vi.fn();
    const gotoPrevWord = vi.fn();

    mockUseTypingMachine.mockReturnValue({
      state: "STATE-01-Typing",
      input: "",
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
      firstValidKeyPressed: false,
      replayAudio: vi.fn().mockResolvedValue(undefined),
      gotoNextWord,
      gotoPrevWord,
      showBatchAnimation: false,
      closeBatchAnimation: vi.fn(),
      results: [],
      errorCount: 0,
      hintReason: "",
      accuracy: 0,
      batchSize: 15,
    });

    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "上一个词" }));
    fireEvent.click(screen.getByRole("button", { name: "下一个词" }));

    fireEvent.keyDown(window, { key: "ArrowUp" });
    fireEvent.keyDown(window, { key: "ArrowDown" });

    expect(gotoPrevWord).toHaveBeenCalledTimes(1);
    expect(gotoNextWord).toHaveBeenCalledTimes(2);
  });
});
