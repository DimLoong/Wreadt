import { useEffect, useMemo, useState } from "react";
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
    gotoPrevWord,
    showBatchAnimation,
    closeBatchAnimation,
    results,
    errorCount,
    hintReason,
    accuracy,
    batchSize,
    isCurrentInputCorrect,
  } = useTypingMachine({ batchSize: 15 });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const actionHint = useMemo(() => {
    if (locale === "zh-CN") {
      return "快捷键：Space 下一词 · ↑ 上一词 · ↓ 下一词";
    }
    return "Hotkeys: Space next · ↑ previous · ↓ next";
  }, [locale]);

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        gotoPrevWord();
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        gotoNextWord();
      }
    };

    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [gotoNextWord, gotoPrevWord]);

  return (
    <main className="typing-page linear-home">
      <div className="linear-bg-glow" aria-hidden="true" />
      <Card className="typing-main-card" bordered>
        <header className="hero-header">
          <p className="hero-badge">WREADT / LINEAR</p>
          <h1>{t(locale, "title")}</h1>
          <p className="subtitle">{t(locale, "subtitle")}</p>
        </header>

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
          onKeyDown={(event) => {
            if (event.key === " ") {
              if (isCurrentInputCorrect) {
                event.preventDefault();
                gotoNextWord();
              }
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              gotoNextWord();
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              gotoPrevWord();
            }
          }}
        />

        <Space className="actions">
          <Button variant="outline" onClick={() => void replayAudio()}>
            {t(locale, "replayAudio")}
          </Button>
          <Button variant="outline" onClick={gotoPrevWord}>
            {locale === "zh-CN" ? "上一个词" : "Previous"}
          </Button>
          <Button theme="default" onClick={gotoNextWord}>
            {locale === "zh-CN" ? "下一个词" : "Next"}
          </Button>
          <span className="state-tag">{state}</span>
          <span className={isCurrentInputCorrect ? "ok" : "warn"}>
            {isCurrentInputCorrect ? t(locale, "wordCorrect") : t(locale, "wordWrong")}
          </span>
        </Space>
        <p className="action-hint">{actionHint}</p>

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
            <Button variant="outline" size="small" onClick={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN") }>
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

      {showBatchAnimation && (
        <BatchAnimation
          locale={locale}
          masteredCount={results.filter((item) => item.correct).length}
          results={results}
          batchSize={batchSize}
          onSkip={closeBatchAnimation}
        />
      )}
    </main>
  );
}
