import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTypingMachine } from "./useTypingMachine";
import type { WordItem } from "../types/typing";

vi.mock("../services/youdao", () => ({
  preloadAudio: vi.fn().mockResolvedValue(undefined),
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

const enWords: WordItem[] = [
  { id: "en-1", text: "theme", phonetic: "/θiːm/", meaning: "主题", phrases: ["dark theme"], examples: ["a"], lang: "en" },
  { id: "en-2", text: "progress", phonetic: "/ˈprəʊɡres/", meaning: "进度", phrases: ["learning progress"], examples: ["b"], lang: "en" },
  { id: "en-3", text: "phoneme", phonetic: "/ˈfəʊniːm/", meaning: "音素", phrases: ["phoneme hint"], examples: ["c"], lang: "en" },
];

const jaWords: WordItem[] = [
  { id: "ja-1", text: "きょういく", phonetic: "[kyouiku]", meaning: "教育", phrases: ["教育制度"], examples: ["a"], acceptedSpellings: ["kyouiku"], lang: "ja" },
  { id: "ja-2", text: "がくしゅう", phonetic: "[gakushuu]", meaning: "学习", phrases: ["学習計画"], examples: ["b"], acceptedSpellings: ["gakushuu"], lang: "ja" },
  { id: "ja-3", text: "はつおん", phonetic: "[hatsuon]", meaning: "发音", phrases: ["発音練習"], examples: ["c"], acceptedSpellings: ["hatsuon"], lang: "ja" },
];

describe("B) 词库切换与语言隔离门禁", () => {
  it("切换到 ja 词库后，不应混入 en 词条，且 en 输入不判定为正确", () => {
    const { result, rerender } = renderHook(({ words }) => useTypingMachine({ words, batchSize: 99 }), {
      initialProps: { words: enWords },
    });

    expect(result.current.currentWord.lang).toBe("en");

    rerender({ words: jaWords });
    expect(result.current.currentWord.lang).toBe("ja");

    act(() => {
      result.current.setInput("theme");
    });

    expect(result.current.isCurrentInputCorrect).toBe(false);
    expect(result.current.results).toHaveLength(0);
  });
});
