import { useMemo, useState } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import PhoneticPage from "./pages/PhoneticPage";
import CustomVocabPage from "./pages/CustomVocabPage";
import SentencePracticePage from "./pages/SentencePracticePage";
import ProgressPage from "./pages/ProgressPage";
import SettingsPage from "./pages/SettingsPage";
import type { Locale } from "./i18n/messages";
import { buildVocabularyByLang } from "./data/vocabulary";
import type { BatchResult, WordItem } from "./types/typing";
import { AppContext, type ProgressRecord } from "./context/AppContext";

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(loadJSON("wreadt.locale", "zh-CN"));
  const [darkMode, setDarkMode] = useState<boolean>(loadJSON("wreadt.dark", true));
  const [activeLang, setActiveLang] = useState<"en" | "ja">(loadJSON("wreadt.activeLang", "en"));
  const [customByLang, setCustomByLang] = useState<Record<"en" | "ja", WordItem[]>>(loadJSON("wreadt.custom", { en: [], ja: [] }));
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>(loadJSON("wreadt.progress", []));

  const saveLocale = (v: Locale) => {
    setLocale(v);
    localStorage.setItem("wreadt.locale", JSON.stringify(v));
  };
  const saveDark = (v: boolean) => {
    setDarkMode(v);
    localStorage.setItem("wreadt.dark", JSON.stringify(v));
  };
  const saveLang = (v: "en" | "ja") => {
    setActiveLang(v);
    localStorage.setItem("wreadt.activeLang", JSON.stringify(v));
  };

  const addCustomWord = (lang: "en" | "ja", word: Omit<WordItem, "id" | "lang">) => {
    const payload: WordItem = {
      ...word,
      id: `custom-${lang}-${Date.now()}`,
      lang,
      phrases: word.phrases ?? [],
      examples: word.examples ?? [],
    };
    const next = {
      ...customByLang,
      [lang]: [...customByLang[lang], payload],
    };
    setCustomByLang(next);
    localStorage.setItem("wreadt.custom", JSON.stringify(next));
  };

  const appendProgress = (lang: "en" | "ja", results: BatchResult[]) => {
    const next = [...progressRecords, { lang, results, createdAt: Date.now() }];
    setProgressRecords(next);
    localStorage.setItem("wreadt.progress", JSON.stringify(next));
  };

  const vocabularyByLang = useMemo(() => buildVocabularyByLang(customByLang), [customByLang]);

  return (
    <AppContext.Provider
      value={{
        locale,
        setLocale: saveLocale,
        darkMode,
        setDarkMode: saveDark,
        activeLang,
        setActiveLang: saveLang,
        customByLang,
        addCustomWord,
        vocabularyByLang,
        progressRecords,
        appendProgress,
      }}
    >
      <nav className="top-nav">
        <Link to="/">打字</Link>
        <Link to="/phonetic">音标页</Link>
        <Link to="/vocabulary">自定义词库</Link>
        <Link to="/sentence">造句练习</Link>
        <Link to="/progress">学习进度</Link>
        <Link to="/settings">设置</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/phonetic" element={<PhoneticPage />} />
        <Route path="/vocabulary" element={<CustomVocabPage />} />
        <Route path="/custom-vocab" element={<CustomVocabPage />} />
        <Route path="/sentence" element={<SentencePracticePage />} />
        <Route path="/sentence-practice" element={<SentencePracticePage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppContext.Provider>
  );
}
