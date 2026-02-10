import { useEffect, useState } from "react";
import { Button, Card, Input, Space, Switch } from "tdesign-react";
import BatchAnimation from "../components/BatchAnimation";
import { t, type Locale } from "../i18n/messages";
import { useTypingMachine } from "../hooks/useTypingMachine";

const secondaryFeatures = [
  "phoneticPage",
  "customVocab",
  "sentencePractice",
  "progressView",
  "settings",
] as const;

export default function Home() {
  const [locale, setLocale] = useState<Locale>("zh-CN");
  const [darkMode, setDarkMode] = useState(true);

  const {
    state,
    input,
    setInput,
    currentWord,
    firstValidKeyPressed,
    replayAudio,
    gotoNextWord,
    showBatchAnimation,
    closeBatchAnimation,
    results,
    errorCount,
    hintReason,
    accuracy,
    batchSize,
  } = useTypingMachine({ batchSize: 15 });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const isWordCorrect = input === currentWord.text;

  return (
    <main className="typing-page">
      <Card className="typing-main-card" bordered>
        <h1>{t(locale, "title")}</h1>
        <p className="subtitle">{t(locale, "subtitle")}</p>

        <section className="word-zone">
          <div className="word-text">{currentWord.text}</div>
          <div className="word-meta">
            <span>{currentWord.phonetic}</span>
            <span>{currentWord.meaning}</span>
          </div>
        </section>

        <Input
          key={currentWord.id}
          value={input}
          autofocus
          placeholder={t(locale, "placeholder")}
          onChange={(value) => setInput(String(value))}
        />

        <Space className="actions">
          <Button variant="outline" onClick={() => void replayAudio()}>
            {t(locale, "replayAudio")}
          </Button>
          <span className="state-tag">{state}</span>
          <span className={isWordCorrect ? "ok" : "warn"}>
            {isWordCorrect ? t(locale, "wordCorrect") : t(locale, "wordWrong")}
          </span>
        </Space>

        {state === "STATE-02-LightHintTriggered" && (
          <div className="hint-box" aria-live="polite">
            <strong>{t(locale, "hintTitle")}: </strong>
            {hintReason === "errors" && "拼写错误次数过多"}
            {hintReason === "phoneme" && "命中易混音标，关注发音"}
            {hintReason === "pause" && "输入停顿较久，建议先听发音"}
          </div>
        )}

        {(state === "STATE-03-WordCompleted" || state === "STATE-04-BatchProgressing") && (
          <section className="expandable-zone">
            <h3>{t(locale, "expandable")}</h3>
            <ul>
              {currentWord.phrases.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <ul>
              {currentWord.examples.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Space>
              <Button theme="primary" variant="outline">
                {t(locale, "sentenceEntry")}
              </Button>
              <Button theme="default" onClick={gotoNextWord}>
                {t(locale, "nextWord")}
              </Button>
            </Space>
          </section>
        )}

        <section className={`secondary-features ${firstValidKeyPressed ? "dismissed" : ""}`}>
          {secondaryFeatures.map((feature) => (
            <Button key={feature} size="small" variant="text" theme="default">
              {t(locale, feature)}
            </Button>
          ))}
        </section>

        <section className="settings-zone">
          <div className="setting-row">
            <span>{t(locale, "darkMode")}</span>
            <Switch value={darkMode} onChange={setDarkMode} />
          </div>
          <div className="setting-row">
            <span>{t(locale, "language")}</span>
            <Button variant="outline" size="small" onClick={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}>
              {locale}
            </Button>
          </div>
          <div className="setting-row">
            <span>Accuracy</span>
            <span>{accuracy}%</span>
          </div>
          <div className="setting-row">
            <span>Errors</span>
            <span>{errorCount}</span>
          </div>
        </section>
      </Card>

      <BatchAnimation
        locale={locale}
        visible={showBatchAnimation}
        masteredCount={results.filter((item) => item.correct).length}
        results={results}
        batchSize={batchSize}
        onSkip={closeBatchAnimation}
      />
    </main>
  );
}
