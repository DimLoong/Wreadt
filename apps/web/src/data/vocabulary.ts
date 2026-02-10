import type { WordItem } from "../types/typing";

export const vocabulary: WordItem[] = [
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
    id: "ja-kyoiku",
    text: "きょういく",
    phonetic: "[kyo-i-ku]",
    meaning: "教育",
    phrases: ["教育制度", "教育方法"],
    examples: ["毎日入力して教育語彙を覚える。"],
    lang: "ja",
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
];
