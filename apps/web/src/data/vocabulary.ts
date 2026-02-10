import type { WordItem } from "../types/typing";

export const baseVocabularyByLang: Record<"en" | "ja", WordItem[]> = {
  en: [
    {
      id: "en-theme",
      text: "theme",
      phonetic: "/θiːm/",
      meaning: "主题",
      phrases: ["dark theme", "project theme"],
      examples: ["This app uses a default blue theme."],
      confusingPhonemes: ["θ"],
      lang: "en",
    },
    {
      id: "en-progress",
      text: "progress",
      phonetic: "/ˈprəʊɡres/",
      meaning: "进度",
      phrases: ["learning progress", "track progress"],
      examples: ["Typing input drives learning progress."],
      lang: "en",
    },
    {
      id: "en-phoneme",
      text: "phoneme",
      phonetic: "/ˈfəʊniːm/",
      meaning: "音素",
      phrases: ["phoneme confusion", "phoneme hint"],
      examples: ["A light hint appears for confusing phonemes."],
      lang: "en",
    },
  ],
  ja: [
    {
      id: "ja-kyoiku",
      text: "きょういく",
      phonetic: "[kyouiku]",
      meaning: "教育",
      phrases: ["教育制度", "教育方法"],
      examples: ["毎日入力して教育語彙を覚える。"],
      acceptedSpellings: ["kyouiku", "kyoiku"],
      lang: "ja",
    },
    {
      id: "ja-gakushuu",
      text: "がくしゅう",
      phonetic: "[gakushuu]",
      meaning: "学习",
      phrases: ["学習計画", "学習習慣"],
      examples: ["学習の進度を毎日記録する。"],
      acceptedSpellings: ["gakushuu", "gakushu"],
      lang: "ja",
    },
    {
      id: "ja-hatsuon",
      text: "はつおん",
      phonetic: "[hatsuon]",
      meaning: "发音",
      phrases: ["発音練習", "発音確認"],
      examples: ["新しい単語の発音を聞いてから入力する。"],
      acceptedSpellings: ["hatsuon"],
      lang: "ja",
    },
  ],
};

export function buildVocabularyByLang(customByLang: Record<"en" | "ja", WordItem[]>): Record<"en" | "ja", WordItem[]> {
  return {
    en: [...baseVocabularyByLang.en, ...customByLang.en],
    ja: [...baseVocabularyByLang.ja, ...customByLang.ja],
  };
}

// 兼容旧调用方：Home/useTypingMachine 仍在使用这些导出名
export const englishVocabulary = baseVocabularyByLang.en;
export const japaneseVocabulary = baseVocabularyByLang.ja;
export const vocabulary = [...englishVocabulary, ...japaneseVocabulary];
