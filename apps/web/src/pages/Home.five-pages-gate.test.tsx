import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./Home";

const mockUseTypingMachine = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  };
});

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


describe("A) 五个页面可渲染与核心交互门禁", () => {
  it("首页+五个二级页面入口应可见，并具备可用导航链接", () => {
    mockUseTypingMachine.mockReturnValue({
      state: "STATE-01-Typing",
      input: "",
      setInput: vi.fn(),
      currentWord: {
        id: "en-theme",
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
      hintReason: "",
      accuracy: 0,
      batchSize: 15,
      isCurrentInputCorrect: false,
    });

    render(<Home />);

    expect(screen.getByRole("heading", { name: "Wreadt" })).toBeInTheDocument();

    const entries: Array<{ name: string; path: string }> = [
      { name: "音标页", path: "/phonetic" },
      { name: "自定义词库", path: "/custom-vocab" },
      { name: "造句练习", path: "/sentence-practice" },
      { name: "学习进度", path: "/progress" },
      { name: "设置", path: "/settings" },
    ];

    entries.forEach(({ name, path }) => {
      const link = screen.getByRole("link", { name });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", path);
    });
  });
});
