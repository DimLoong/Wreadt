import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTypingMachine } from "./useTypingMachine";
import type { WordItem } from "../types/typing";

vi.mock("../services/youdao", () => ({
  preloadAudio: vi.fn().mockResolvedValue(undefined),
  playAudio: vi.fn().mockResolvedValue(undefined),
}));

const enWords: WordItem[] = [
  { id: "en-1", text: "theme", phonetic: "/θiːm/", meaning: "主题", phrases: ["x"], examples: ["x"], lang: "en" },
  { id: "en-2", text: "progress", phonetic: "/ˈprəʊɡres/", meaning: "进度", phrases: ["x"], examples: ["x"], lang: "en" },
  { id: "en-3", text: "phoneme", phonetic: "/ˈfəʊniːm/", meaning: "音素", phrases: ["x"], examples: ["x"], lang: "en" },
];

const jaWords: WordItem[] = [
  { id: "ja-1", text: "きょういく", phonetic: "[kyouiku]", meaning: "教育", phrases: ["x"], examples: ["x"], acceptedSpellings: ["kyouiku", "kyoiku"], lang: "ja" },
  { id: "ja-2", text: "がくしゅう", phonetic: "[gakushuu]", meaning: "学习", phrases: ["x"], examples: ["x"], acceptedSpellings: ["gakushuu", "gakushu"], lang: "ja" },
  { id: "ja-3", text: "はつおん", phonetic: "[hatsuon]", meaning: "发音", phrases: ["x"], examples: ["x"], acceptedSpellings: ["hatsuon"], lang: "ja" },
];

describe("C) en/ja 各3个示例词规则校验", () => {
  it("en 三词精确匹配可完成", () => {
    const { result } = renderHook(() => useTypingMachine({ words: enWords, batchSize: 99 }));

    enWords.forEach((word, idx) => {
      act(() => {
        result.current.setInput(word.text);
      });
      expect(result.current.results.at(-1)?.wordId).toBe(word.id);
      if (idx < enWords.length - 1) {
        act(() => result.current.gotoNextWord());
      }
    });
  });

  it("ja 三词支持 acceptedSpellings romaji", () => {
    const { result } = renderHook(() => useTypingMachine({ words: jaWords, batchSize: 99 }));
    const romaji = ["kyouiku", "gakushuu", "hatsuon"];

    romaji.forEach((input, idx) => {
      const word = jaWords[idx];
      act(() => {
        result.current.setInput(input);
      });
      expect(result.current.results.at(-1)?.wordId).toBe(word.id);
      if (idx < romaji.length - 1) {
        act(() => result.current.gotoNextWord());
      }
    });
  });
});
