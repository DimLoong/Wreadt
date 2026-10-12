import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isCustomDict, type TypingOutcome, type WordItem } from "@wreadt/core";
import { useTypingMachine } from "../hooks/useTypingMachine";
import { useSettings } from "../context/settings";
import { useFocusMode } from "../context/focus";
import { playAudio, preloadAudio, speechText, stopAudio } from "../services/youdao";

/** 切到新词后停留这么久才自动发音 / 预加载下一个，快速跳过时不会叠音和发出大量请求 */
export const AUTOPLAY_DELAY_MS = 300;
import { play } from "../services/sound";
import WordLetters from "./WordLetters";
import WordExamples from "./WordExamples";
import WordSkin from "./skins/WordSkin";
import ExcelSkin from "./skins/ExcelSkin";
import CodeSkin from "./skins/CodeSkin";

const SKINS = { word: WordSkin, excel: ExcelSkin, vscode: CodeSkin } as const;

interface Props {
  words: WordItem[];
  onWordDone: (word: WordItem, outcome: TypingOutcome) => void;
  onBatchDone: () => void;
}

function say(word: WordItem) {
  playAudio(speechText(word), word.lang).catch(() => undefined); // 浏览器可能拦截自动播放
}

export default function TypingSession({ words, onWordDone, onBatchDone }: Props) {
  const { settings, t, update } = useSettings();
  const { setFocused } = useFocusMode();
  const navigate = useNavigate();
  const captureRef = useRef<HTMLInputElement>(null);
  const lastEsc = useRef(0);
  const [imeWarning, setImeWarning] = useState(false);
  // 伪装模式下静音，避免在办公室暴露
  const disguised = settings.skin !== "none";
  const soundOn = settings.sound && !disguised;
  const keySoundOn = settings.keySound && !disguised;
  const m = useTypingMachine({
    words,
    advance: settings.advance,
    wrongHelp: settings.wrongHelp,
    onWordDone: (w, outcome) => {
      if (soundOn && !outcome.skipped) play("correct");
      onWordDone(w, outcome);
    },
  });
  const { word, state } = m;

  useEffect(() => {
    if (soundOn && m.wrongChar) play("wrong");
  }, [soundOn, m.wrongChar, m.errors]);

  useEffect(() => {
    if (keySoundOn && m.typed) play("key");
  }, [keySoundOn, m.typed]);

  useEffect(() => {
    if (state === "batchDone") onBatchDone();
  }, [state, onBatchDone]);

  useEffect(() => {
    if (!word) return;
    captureRef.current?.focus();
    stopAudio();
    const timer = window.setTimeout(() => {
      if (settings.autoPlay) say(word);
      const upcoming = words[m.index + 1];
      if (upcoming) preloadAudio(speechText(upcoming), upcoming.lang);
    }, AUTOPLAY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [word, settings.autoPlay, words, m.index]);

  if (!word) return null;

  const focusCapture = () => captureRef.current?.focus();

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    setFocused(true);
    if (e.nativeEvent.isComposing || e.key === "Process") {
      setImeWarning(true);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
      e.preventDefault();
      say(word);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === "Escape") {
      // 连按两次 Esc 立即退出伪装
      if (settings.skin !== "none" && Date.now() - lastEsc.current < 500) void update("skin", "none");
      lastEsc.current = Date.now();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      m.prev();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      m.next();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      m.peek(true);
      return;
    }
    // 完成后按任意键进入下一个
    if (state === "completed") {
      if (e.key.length === 1 || e.key === "Enter") {
        e.preventDefault();
        m.next();
      }
      return;
    }
    if (e.key.length === 1) {
      e.preventDefault();
      setImeWarning(false);
      m.press(e.key);
    }
  };

  // 移动端软键盘的 keydown 常拿不到字符，从 input 事件兜底
  const onInput = (e: FormEvent<HTMLInputElement>) => {
    const native = e.nativeEvent as InputEvent;
    const data = native.data ?? "";
    e.currentTarget.value = "";
    if (native.isComposing) return;
    if (state === "completed") {
      if (data) m.next();
      return;
    }
    for (const ch of data) m.press(ch);
  };

  const capture = (
    <input
      ref={captureRef}
      className="typing-capture"
      onKeyDown={onKeyDown}
      onKeyUp={(e) => e.key === "Tab" && m.peek(false)}
      onInput={onInput}
      onCompositionEnd={(e) => {
        e.currentTarget.value = "";
        setImeWarning(true);
      }}
      onBlur={() => m.peek(false)}
      autoFocus
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      aria-label={t("typing.placeholder")}
    />
  );

  const letters = (
    <WordLetters
      answer={word.answer}
      typed={m.typed}
      wrongChar={m.wrongChar}
      hidden={settings.typingMode === "dictation" && !m.peeking && state !== "completed"}
      revealed={m.revealed}
    />
  );

  const sub = (word.lang === "ja" ? word.reading !== word.display && word.reading : word.phonetic && `/${word.phonetic}/`) || undefined;
  const feedback =
    imeWarning
      ? t("typing.imeWarning")
      : state === "completed"
        ? t("typing.pressAnyKey")
        : state === "hint" && m.hintReason
          ? t(`typing.hint.${m.hintReason}`)
          : "";

  if (settings.skin !== "none") {
    const Skin = SKINS[settings.skin];
    return (
      <div onClick={focusCapture}>
        {capture}
        <Skin
          word={word}
          typed={m.typed}
          state={state}
          sub={sub}
          meaning={word.meanings.join("；")}
          feedback={feedback}
          index={m.index}
          total={words.length}
          accuracy={m.accuracy}
          lettersEl={letters}
          onMenu={() => navigate("/settings")}
        />
      </div>
    );
  }

  return (
    <section className={`typing-stage state-${state}`} onClick={focusCapture}>
      {capture}
      {isCustomDict(word.dictId) && <span className="mine-tag">{t("typing.mine")}</span>}
      {word.lang === "ja" && (
        <div className="word-display" lang="ja">
          {word.display}
        </div>
      )}
      <div className={`word-letters-row ${word.lang === "ja" ? "romaji" : ""}`}>{letters}</div>
      <div className="word-sub">
        {sub && <span>{sub}</span>}
        <button type="button" className="icon-btn" onClick={() => say(word)} title={`${t("typing.replay")} (Ctrl+J)`}>
          🔊
        </button>
      </div>
      {(settings.showMeaning || state === "completed") && <p className="word-meaning">{word.meanings.join("；")}</p>}

      <div className="typing-feedback" aria-live="polite">
        {feedback && <span className={state === "completed" ? "ok" : "hint"}>{feedback}</span>}
        {m.canSkip && state !== "completed" && (
          <button type="button" className="skip-btn" onClick={m.next}>
            {t("typing.skip")}
          </button>
        )}
      </div>

      {state === "completed" && (
        <div className="completion-panel" onClick={(e) => e.stopPropagation()}>
          <WordExamples word={word} onDone={focusCapture} />
          <Link to={`/sentence?word=${encodeURIComponent(word.answer)}&lang=${word.lang}`}>{t("typing.practiceSentence")} →</Link>
        </div>
      )}

      <footer className="typing-footer">
        <span>{t("typing.batch", { current: Math.min(m.index + 1, words.length), total: words.length })}</span>
        <span>{m.accuracy}%</span>
        <span className="muted hotkeys">{t(settings.wrongHelp === "none" ? "typing.hotkeysNoPeek" : "typing.hotkeys")}</span>
      </footer>
    </section>
  );
}
