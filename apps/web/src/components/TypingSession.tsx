import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Divider, Tag } from "tdesign-react";
import { isCustomDict, type TypingOutcome, type WordItem } from "@wreadt/core";
import { useTypingMachine } from "../hooks/useTypingMachine";
import { useSettings } from "../context/settings";
import { useFocusMode } from "../context/focus";
import { playAudio, preloadAudio, speechText, stopAudio, type Accent } from "../services/youdao";
import { play } from "../services/sound";
import WordLetters from "./WordLetters";
import WordPreview from "./typing/WordPreview";
import MeaningRow from "./typing/MeaningRow";
import AccentPills from "./typing/AccentPills";
import DetailCards from "./typing/DetailCards";
import TypingStats from "./typing/TypingStats";
import WordSkin from "./skins/WordSkin";
import ExcelSkin from "./skins/ExcelSkin";
import CodeSkin from "./skins/CodeSkin";

const SKINS = { word: WordSkin, excel: ExcelSkin, vscode: CodeSkin } as const;

/** 切到新词后停留这么久才自动发音 / 预加载下一个，快速跳过时不会叠音和发出大量请求 */
export const AUTOPLAY_DELAY_MS = 300;

interface Props {
  words: WordItem[];
  onWordDone: (word: WordItem, outcome: TypingOutcome) => void;
  onBatchDone: () => void;
  /** 显示在上方中间的工具区（词库选择等） */
  toolbar?: ReactNode;
}

function say(word: WordItem, accent: Accent = "us") {
  playAudio(speechText(word), word.lang, accent).catch(() => undefined); // 浏览器可能拦截自动播放
}

export default function TypingSession({ words, onWordDone, onBatchDone, toolbar }: Props) {
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
      if (settings.autoPlay) say(word, settings.accent);
      const upcoming = words[m.index + 1];
      if (upcoming) preloadAudio(speechText(upcoming), upcoming.lang, settings.accent);
    }, AUTOPLAY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [word, settings.autoPlay, settings.accent, words, m.index]);

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
      say(word, settings.accent);
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

  const hidden = settings.typingMode === "dictation" && state !== "completed";

  return (
    <section className={`typing-stage state-${state}`} onClick={focusCapture}>
      {capture}
      <div className="neighbors">
        <WordPreview word={words[m.index - 1]} dir="left" masked={settings.typingMode === "dictation"} onClick={m.prev} />
        <div className="neighbors-center" onClick={(e) => e.stopPropagation()}>
          {toolbar}
        </div>
        <WordPreview word={words[m.index + 1]} dir="right" masked={settings.typingMode === "dictation"} onClick={m.next} />
      </div>

      <div className="main-word">
        {isCustomDict(word.dictId) && (
          <Tag theme="warning" variant="light" size="small">
            {t("typing.mine")}
          </Tag>
        )}
        {word.lang === "ja" && (
          <div className="word-display" lang="ja">
            {word.display}
          </div>
        )}
        <div className={`word-letters-row ${word.lang === "ja" ? "romaji" : ""}`}>{letters}</div>
        {(settings.showMeaning || state === "completed") && <MeaningRow meanings={word.meanings} />}
        <div onClick={(e) => e.stopPropagation()}>
          <AccentPills
            word={word}
            onSay={(accent) => {
              say(word, accent);
              focusCapture();
            }}
          />
        </div>
        <div className="typing-feedback" aria-live="polite">
          {feedback && <span className={state === "completed" ? "ok" : "hint"}>{feedback}</span>}
          {m.canSkip && state !== "completed" && (
            <button type="button" className="skip-btn" onClick={m.next}>
              {t("typing.skip")}
            </button>
          )}
        </div>
      </div>

      <Divider />
      <DetailCards word={word} masked={hidden} onFocusBack={focusCapture} />

      <TypingStats stats={m.stats} accuracy={m.accuracy} current={Math.min(m.index + (state === "completed" ? 1 : 0), words.length)} total={words.length} running={state !== "batchDone"} />
      <p className="muted hotkeys">{t(settings.wrongHelp === "none" ? "typing.hotkeysNoPeek" : "typing.hotkeys")}</p>
    </section>
  );
}
