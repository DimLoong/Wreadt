import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Space, Switch } from "tdesign-react";
import BatchAnimation from "../components/BatchAnimation";
import { t } from "../i18n/messages";
import { useTypingMachine } from "../hooks/useTypingMachine";
import { useAppContext } from "../context/AppContext";

const secondaryFeatures = [
  { key: "phoneticPage", to: "/phonetic" },
  { key: "customVocab", to: "/custom-vocab" },
  { key: "sentencePractice", to: "/sentence-practice" },
  { key: "progressView", to: "/progress" },
  { key: "settings", to: "/settings" },
] as const;

export default function Home() {
  const { locale, setLocale, darkMode, setDarkMode, activeLang, setActiveLang, vocabularyByLang, appendProgress } = useAppContext();
  const [uiLocale, setUiLocale] = useState(locale);
  const words = vocabularyByLang[activeLang];

  const {
    state,
    input,
    setInput,
    currentWord,
    firstValidKeyPressed,
    replayAudio,
    gotoNextWord,
    gotoPrevWord,
    showBatchAnimation,
    closeBatchAnimation,
    results,
    errorCount,
    hintReason,
    accuracy,
    batchSize,
    isCurrentInputCorrect,
  } = useTypingMachine({ words, batchSize: words.length || 1, onBatchCompleted: (r) => appendProgress(activeLang, r) });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        gotoNextWord();
      }
    };
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [gotoNextWord, gotoPrevWord]);

  const actionHint = useMemo(() => {
    if (uiLocale === "zh-CN") return "快捷键：Space 下一词 · ↑ 上一词 · ↓ 下一词";
    return "Hotkeys: Space next · ↑ previous · ↓ next";
  }, [uiLocale]);

  return (
    <main className="typing-page linear-home">
      <div className="linear-bg-glow" aria-hidden="true" />
      <Card className="typing-main-card" bordered>
        <header className="hero-header">
          <p className="hero-badge">WREADT / LINEAR</p>
          <h1>{t(uiLocale, "title")}</h1>
          <p className="subtitle">{t(uiLocale, "subtitle")}</p>
        </header>

        <div className="setting-row" style={{ marginBottom: 12 }}>
          <span>切换词库（完全隔离）</span>
          <Button variant="outline" size="small" onClick={() => setActiveLang(activeLang === "en" ? "ja" : "en")}>{activeLang.toUpperCase()}</Button>
        </div>

        <section className="word-zone">
          <div className="word-text">{currentWord.text}</div>
          <div className="word-meta"><span>{currentWord.phonetic}</span><span>{currentWord.meaning}</span></div>
        </section>

        <Input key={currentWord.id} value={input} autofocus placeholder={t(uiLocale, "placeholder")}
          onChange={(value) => setInput(String(value))}
          onKeydown={(_, context) => {
            const { e } = context;
            if (e.key === " ") {
              if (isCurrentInputCorrect) {
                e.preventDefault();
                gotoNextWord();
              }
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              gotoNextWord();
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              gotoPrevWord();
            }
          }}
        />

        <Space className="actions">
          <Button variant="outline" onClick={() => void replayAudio()}>{t(uiLocale, "replayAudio")}</Button>
          <Button variant="outline" onClick={gotoPrevWord}>{uiLocale === "zh-CN" ? "上一个词" : "Previous"}</Button>
          <Button theme="default" onClick={gotoNextWord}>{uiLocale === "zh-CN" ? "下一个词" : "Next"}</Button>
          <span className="state-tag">{state}</span>
          <span className={isCurrentInputCorrect ? "ok" : "warn"}>{isCurrentInputCorrect ? t(uiLocale, "wordCorrect") : t(uiLocale, "wordWrong")}</span>
        </Space>
        <p className="action-hint">{actionHint}</p>

        {state === "STATE-02-LightHintTriggered" && (
          <div className="hint-box" aria-live="polite"><strong>{t(uiLocale, "hintTitle")}: </strong>
            {hintReason === "errors" && "拼写错误次数过多"}
            {hintReason === "phoneme" && "命中易混音标，关注发音"}
            {hintReason === "pause" && "输入停顿较久，建议先听发音"}
          </div>
        )}

        {(state === "STATE-03-WordCompleted" || state === "STATE-04-BatchProgressing") && (
          <section className="expandable-zone">
            <h3>{t(uiLocale, "expandable")}</h3>
            <ul>{currentWord.phrases.map((item) => <li key={item}>{item}</li>)}</ul>
            <ul>{currentWord.examples.map((item) => <li key={item}>{item}</li>)}</ul>
            <Space>
              <Button theme="primary" variant="outline" tag="a" href="/sentence-practice">{t(uiLocale, "sentenceEntry")}</Button>
              <Button theme="default" onClick={gotoNextWord}>{t(uiLocale, "nextWord")}</Button>
            </Space>
          </section>
        )}

        <section className={`secondary-features ${firstValidKeyPressed ? "dismissed" : ""}`}>
          {secondaryFeatures.map((feature) => (
            <Button key={feature.key} size="small" variant="text" theme="default" tag="a" href={feature.to}>{t(uiLocale, feature.key)}</Button>
          ))}
        </section>

        <section className="settings-zone">
          <div className="setting-row"><span>{t(uiLocale, "darkMode")}</span><Switch value={darkMode} onChange={() => { document.documentElement.setAttribute("data-theme", darkMode ? "light" : "dark"); setDarkMode(!darkMode); }} /></div>
          <div className="setting-row"><span>{t(uiLocale, "language")}</span><Button variant="outline" size="small" onClick={() => { const next = uiLocale === "zh-CN" ? "en-US" : "zh-CN"; setUiLocale(next); setLocale(next); }}>{uiLocale}</Button></div>
          <div className="setting-row"><span>Accuracy</span><span>{accuracy}%</span></div>
          <div className="setting-row"><span>Errors</span><span>{errorCount}</span></div>
          <div className="setting-row"><span>Word Count</span><span>{words.length}</span></div>
        </section>
      </Card>

      {showBatchAnimation && <BatchAnimation locale={uiLocale} masteredCount={results.filter((item) => item.correct).length} results={results} batchSize={batchSize} onSkip={closeBatchAnimation} />}
    </main>
  );
}
