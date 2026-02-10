export type TypingState =
  | "STATE-00-Idle"
  | "STATE-01-Typing"
  | "STATE-02-LightHintTriggered"
  | "STATE-03-WordCompleted"
  | "STATE-04-BatchProgressing"
  | "STATE-05-BatchCompleted";

export interface WordItem {
  id: string;
  text: string;
  phonetic: string;
  meaning: string;
  phrases: string[];
  examples: string[];
  confusingPhonemes?: string[];
  acceptedSpellings?: string[];
  lang: "en" | "ja";
}

export interface BatchResult {
  wordId: string;
  accuracy: number;
  correct: boolean;
}
