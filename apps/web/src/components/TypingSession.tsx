import { useEffect, useRef, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import type { TypingOutcome, WordItem } from "@wreadt/core";
import { useTypingMachine } from "../hooks/useTypingMachine";
import { useSettings } from "../context/settings";
import { useFocusMode } from "../context/focus";
import { playAudio, preloadAudio, speechText } from "../services/youdao";

interface Props {
  words: WordItem[];
  onWordDone: (word: WordItem, outcome: TypingOutcome) => void;
  onBatchDone: () => void;
}

function say(word: WordItem) {
  playAudio(speechText(word), word.lang).catch(() => undefined); // 浏览器可能拦截自动播放
}

/** 英文：逐字母着色，直观看到哪一位拼错 */
function Letters({ word, input }: { word: WordItem; input: string }) {
  const typed = input.toLowerCase();
  return (
    <span className="letters" aria-label={word.display}>
      {Array.from(word.answer).map((ch, i) => {
        const cls = i >= typed.length ? "" : typed[i] === ch.toLowerCase() ? "ok" : "bad";
        return (
          <span key={i} className={cls}>
            {ch === " " ? " " : ch}
          </span>
        );
      })}
    </span>
  );
}

export default function TypingSession({ words, onWordDone, onBatchDone }: Props) {
  const { settings, t } = useSettings();
  const { setFocused } = useFocusMode();
  const inputRef = useRef<HTMLInputElement>(null);
  const m = useTypingMachine({ words, onWordDone });
  const { word, state } = m;

  useEffect(() => {
    if (state === "batchDone") onBatchDone();
  }, [state, onBatchDone]);

  useEffect(() => {
    if (!word) return;
    inputRef.current?.focus();
    if (settings.autoPlay) say(word);
    const upcoming = words[m.index + 1];
    if (upcoming) preloadAudio(speechText(upcoming), upcoming.lang);
  }, [word, settings.autoPlay, words, m.index]);

  if (!word) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    setFocused(true);
    if ((e.key === " " || e.key === "Enter") && state === "completed") {
      e.preventDefault();
      m.next();
    } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      m.next();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      m.prev();
    } else if (e.key === "j" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      say(word);
    } else if (e.key === "Escape") {
      m.onInput("");
    }
  };

  const sub = word.lang === "ja" ? word.reading !== word.display && word.reading : word.phonetic && `/${word.phonetic}/`;

  return (
    <section className={`typing-stage state-${state}`} onClick={() => inputRef.current?.focus()}>
      <div className="word-display" lang={word.lang}>
        {word.lang === "en" ? <Letters word={word} input={m.input} /> : <span>{word.display}</span>}
      </div>
      <div className="word-sub">
        {sub && <span>{sub}</span>}
        <button type="button" className="icon-btn" onClick={() => say(word)} title={`${t("typing.replay")} (Ctrl+J)`}>
          🔊
        </button>
      </div>
      {(settings.showMeaning || state === "completed") && <p className="word-meaning">{word.meanings.join("；")}</p>}

      <input
        ref={inputRef}
        className="typing-input"
        value={m.input}
        onChange={(e) => m.onInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={word.lang === "ja" ? t("typing.placeholderJa") : t("typing.placeholder")}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label={t("typing.placeholder")}
        aria-invalid={m.errors > 0 && state !== "completed"}
      />

      <div className="typing-feedback" aria-live="polite">
        {state === "completed" && <span className="ok">{t("typing.completed")}</span>}
        {state === "hint" && m.hintReason && <span className="hint">{t(`typing.hint.${m.hintReason}`)}</span>}
        {state !== "completed" && m.hintLetters && (
          <span className="hint letters-hint">{t("typing.hint.letters", { letters: m.hintLetters })}</span>
        )}
      </div>

      {state === "completed" && (
        <div className="word-actions">
          <Link to={`/sentence?word=${encodeURIComponent(word.answer)}&lang=${word.lang}`}>{t("typing.practiceSentence")} →</Link>
        </div>
      )}

      <footer className="typing-footer">
        <span>{t("typing.batch", { current: Math.min(m.index + 1, words.length), total: words.length })}</span>
        <span>{m.accuracy}%</span>
        <span className="muted hotkeys">{t("typing.hotkeys")}</span>
      </footer>
    </section>
  );
}
