import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./Home";
import type { BatchResult } from "../types/typing";

const mockUseTypingMachine = vi.fn();

vi.mock("../hooks/useTypingMachine", () => ({
  useTypingMachine: () => mockUseTypingMachine(),
}));

function buildHookState(overrides: Partial<ReturnType<typeof mockUseTypingMachine>> = {}) {
  const results: BatchResult[] = [{ wordId: "w1", accuracy: 100, correct: true }];
  return {
    state: "STATE-02-LightHintTriggered",
    input: "",
    setInput: vi.fn(),
    currentWord: {
      id: "w1",
      text: "apple",
      phonetic: "/ˈæp.əl/",
      meaning: "苹果",
      phrases: ["apple pie"],
      examples: ["I eat an apple."],
      lang: "en" as const,
      confusingPhonemes: ["æ"],
    },
    firstValidKeyPressed: true,
    replayAudio: vi.fn().mockResolvedValue(undefined),
    gotoNextWord: vi.fn(),
    showBatchAnimation: false,
    closeBatchAnimation: vi.fn(),
    results,
    errorCount: 2,
    hintReason: "pause",
    accuracy: 88,
    batchSize: 15,
    ...overrides,
  };
}

describe("Home", () => {
  it("首键触发后次级入口带 dismissed 样式，并展示停顿提示", () => {
    mockUseTypingMachine.mockReturnValue(buildHookState());

    const { container } = render(<Home />);

    const secondary = container.querySelector(".secondary-features");
    expect(secondary).toHaveClass("dismissed");
    expect(screen.getByText("输入停顿较久，建议先听发音")).toBeInTheDocument();
  });

  it("可切换语言按钮文本", () => {
    mockUseTypingMachine.mockReturnValue(buildHookState());

    render(<Home />);

    const languageButton = screen.getByRole("button", { name: "zh-CN" });
    fireEvent.click(languageButton);

    expect(screen.getByRole("button", { name: "en-US" })).toBeInTheDocument();
  });
});
