import { createContext, useContext, useMemo, useState } from "react";
import type { Locale } from "../i18n/messages";
import { buildVocabularyByLang } from "../data/vocabulary";
import type { BatchResult, WordItem } from "../types/typing";

export interface ProgressRecord {
  lang: "en" | "ja";
  createdAt: number;
  results: BatchResult[];
}

export interface AppContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  activeLang: "en" | "ja";
  setActiveLang: (lang: "en" | "ja") => void;
  customByLang: Record<"en" | "ja", WordItem[]>;
  addCustomWord: (lang: "en" | "ja", word: Omit<WordItem, "id" | "lang">) => void;
  vocabularyByLang: Record<"en" | "ja", WordItem[]>;
  progressRecords: ProgressRecord[];
  appendProgress: (lang: "en" | "ja", results: BatchResult[]) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext() {
  const ctx = useContext(AppContext);

  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [darkMode, setDarkMode] = useState(true);
  const [activeLang, setActiveLang] = useState<"en" | "ja">("en");
  const [customByLang, setCustomByLang] = useState<Record<"en" | "ja", WordItem[]>>({ en: [], ja: [] });
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([]);

  const addCustomWord = (lang: "en" | "ja", word: Omit<WordItem, "id" | "lang">) => {
    const id = `${lang}-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setCustomByLang((prev) => ({ ...prev, [lang]: [...prev[lang], { ...word, id, lang }] }));
  };

  const appendProgress = (lang: "en" | "ja", results: BatchResult[]) => {
    setProgressRecords((prev) => [...prev, { lang, results, createdAt: Date.now() }]);
  };

  const vocabularyByLang = useMemo(() => buildVocabularyByLang(customByLang), [customByLang]);

  if (ctx) {
    return ctx;
  }

  return {
    locale,
    setLocale,
    darkMode,
    setDarkMode,
    activeLang,
    setActiveLang,
    customByLang,
    addCustomWord,
    vocabularyByLang,
    progressRecords,
    appendProgress,
  } satisfies AppContextValue;
}
