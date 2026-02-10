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


function buildState(overrides: Record<string, unknown> = {}) {
  return {
    state: "STATE-02-LightHintTriggered",
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
    gotoNextWord: vi.fn(),
    gotoPrevWord: vi.fn(),
    showBatchAnimation: false,
    closeBatchAnimation: vi.fn(),
    results: [],
    errorCount: 0,
    hintReason: "errors",
    accuracy: 0,
    batchSize: 15,
    isCurrentInputCorrect: false,
    ...overrides,
  };
}

describe("Home 提示分支与空格门禁", () => {
  it("应覆盖拼写错误与易混音标提示文案", () => {
    mockUseTypingMachine.mockReturnValue(buildState({ hintReason: "errors" }));
    const { rerender } = render(<Home />);
    expect(screen.getByText("拼写错误次数过多")).toBeInTheDocument();

    mockUseTypingMachine.mockReturnValue(buildState({ hintReason: "phoneme" }));
    rerender(<Home />);
    expect(screen.getByText("命中易混音标，关注发音")).toBeInTheDocument();
  });

  it("空格键仅在当前输入正确时触发下一词", () => {
    const gotoNextWord = vi.fn();
    const preventDefault = vi.fn();

    mockUseTypingMachine.mockReturnValue(
      buildState({ state: "STATE-01-Typing", gotoNextWord, isCurrentInputCorrect: false }),
    );

    const { rerender } = render(<Home />);
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: " ", preventDefault });
    expect(gotoNextWord).not.toHaveBeenCalled();

    mockUseTypingMachine.mockReturnValue(
      buildState({ state: "STATE-01-Typing", gotoNextWord, isCurrentInputCorrect: true }),
    );

    rerender(<Home />);
    const input2 = screen.getByRole("textbox");
    fireEvent.keyDown(input2, { key: " ", preventDefault });
    expect(gotoNextWord).toHaveBeenCalledTimes(1);
  });
});
