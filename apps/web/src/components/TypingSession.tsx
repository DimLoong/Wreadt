import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Divider, Tag, Tooltip } from "tdesign-react";
import { isCustomDict, type TypingOutcome, type WordItem } from "@wreadt/core";
import { useTypingMachine } from "../hooks/useTypingMachine";
import { useSettings } from "../context/settings";
import { useFocusMode } from "../context/focus";
import { preloadAudio, speechText, stopAudio, type Accent } from "../services/youdao";
import { pronounceWord } from "../services/speech";
import { play } from "../services/sound";
import { markStudyActivity } from "../services/studyTime";
import WordLetters from "./WordLetters";
import WordPreview from "./typing/WordPreview";
import MeaningRow from "./typing/MeaningRow";
import PronouncePill from "./typing/PronouncePill";
import DetailCards from "./typing/DetailCards";
import TypingStats from "./typing/TypingStats";
import { useElapsedSeconds, wpmOf } from "../lib/typingStats";
import MarkControl from "./marks/MarkControl";
import { useMarks } from "../hooks/useMarks";
import { toggleMark } from "../store/repo";
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
  /** 专项练习模式：listen 听写（不显示音标）；spell 强制默写 */
  mode?: "normal" | "listen" | "spell";
  /** 是否在 /typing 页面（切走时只隐藏，不发音、不抢焦点、暂停计时） */
  active?: boolean;
  /** 本组进度（已完成 / 总数），供导航按钮显示进度环 */
  onProgress?: (p: { current: number; total: number } | null) => void;
  /** “我早就会了”（Ctrl/⌘ + Enter） */
  onKnown?: (word: WordItem) => void;
  /** 穿插的造句题：cardSlots 为有题的位置（题目排在第 i 个词之前），和单词一样可以前后跳转 */
  cardSlots?: number[];
  renderCard?: (index: number, nav: CardNav) => ReactNode;
  /** 伪装模式下一组结束时的通知（正常模式由页面弹出组总结） */
  batchNotice?: ReactNode;
}

export interface CardNav {
  prev: () => void;
  /** 完成或跳过本题，进入后面的单词 */
  next: () => void;
}

function say(word: WordItem, accent: Accent = "us") {
  pronounceWord(speechText(word), word.lang, accent).catch(() => undefined); // 浏览器可能拦截自动播放
}

export default function TypingSession({ words, onWordDone, onBatchDone, toolbar, mode = "normal", active = true, onProgress, onKnown, cardSlots = [], renderCard, batchNotice }: Props) {
  const marks = useMarks();
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
  // 用时：只在打字页且本组未结束时计时（伪装模式同样计入学习时长）
  const seconds = useElapsedSeconds(m.stats.startedAt > 0, active && state !== "batchDone");

  useEffect(() => {
    if (soundOn && m.wrongChar) play("wrong");
  }, [soundOn, m.wrongChar, m.errors]);

  useEffect(() => {
    if (keySoundOn && m.typed) play("key");
  }, [keySoundOn, m.typed]);

  useEffect(() => {
    if (state === "batchDone") onBatchDone();
  }, [state, onBatchDone]);


  // ---------- 造句题：排在第 cardAt 个词之前；向前走到这个词时先出题，在该词上按“上一个”回到题目 ----------
  const [cardAt, setCardAt] = useState<number | null>(null);
  const [passed, setPassed] = useState<number[]>([]);
  const [lastIndex, setLastIndex] = useState(m.index);
  const hasCard = (i: number) => Boolean(renderCard) && cardSlots.includes(i);
  if (lastIndex !== m.index) {
    setLastIndex(m.index);
    setCardAt(m.index > lastIndex && hasCard(m.index) ? m.index : null);
  }
  const onCard = cardAt !== null && cardAt === m.index && state !== "batchDone";
  const prev = () => {
    if (!onCard && hasCard(m.index)) setCardAt(m.index);
    else m.prev();
  };
  const cardNav: CardNav = {
    prev: () => {
      setCardAt(null);
      m.prev();
    },
    next: () => {
      if (cardAt !== null && !passed.includes(cardAt)) setPassed([...passed, cardAt]);
      setCardAt(null);
    },
  };

  // 进度：单词与造句题都算一道题
  const total = words.length + cardSlots.length;
  const done = Math.min(m.doneCount + passed.length, total);
  useEffect(() => {
    onProgress?.({ current: done, total });
  }, [done, total, onProgress]);
  useEffect(() => () => onProgress?.(null), [onProgress]);

  // 回到打字页时重新聚焦
  useEffect(() => {
    if (active && cardAt === null) captureRef.current?.focus();
  }, [active, cardAt]);

  useEffect(() => {
    if (!word || !active || onCard) return;
    captureRef.current?.focus();
    stopAudio();
    const timer = window.setTimeout(() => {
      if (settings.autoPlay) say(word, settings.accent);
      const upcoming = words[m.index + 1];
      if (upcoming) preloadAudio(speechText(upcoming), upcoming.lang, settings.accent);
    }, AUTOPLAY_DELAY_MS);
    return () => window.clearTimeout(timer);
    // 只在换词时发音；切回页面不重播
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word, settings.autoPlay, settings.accent, words, m.index, onCard]);

  if (!word) return null;

  const focusCapture = () => {
    if (!onCard) captureRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    setFocused(true);
    markStudyActivity();
    if (e.nativeEvent.isComposing || e.key === "Process") {
      setImeWarning(true);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
      e.preventDefault();
      say(word, settings.accent);
      return;
    }
    // Ctrl/⌘ + Enter：我早就会了，推到很久以后复习并进入下一个
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (state !== "completed" && onKnown) {
        onKnown(word);
        m.dismiss();
      }
      return;
    }
    // Ctrl+M：mark / 取消 mark 当前词（Mac 上 Cmd+M 是最小化窗口，因此只用 Ctrl）
    if (e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "m") {
      e.preventDefault();
      void toggleMark(word);
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
      prev();
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
      hidden={(settings.typingMode === "dictation" || mode !== "normal") && !m.peeking && state !== "completed"}
      revealed={m.revealed}
      plainSpace={settings.skin !== "none"}
    />
  );

  const sub = (word.lang === "ja" ? word.reading !== word.display && word.reading : word.phonetic && `/${word.phonetic}/`) || undefined;
  const feedback =
    imeWarning
      ? t("typing.imeWarning")
      : state === "completed"
        ? t(m.skipped ? "typing.skippedAnyKey" : "typing.pressAnyKey")
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
          ok={state === "completed" && !m.skipped}
          index={m.index}
          stats={{ seconds, wpm: wpmOf(m.stats, seconds), keystrokes: m.stats.keystrokes, correct: m.stats.correct, done: m.stats.done, accuracy: m.accuracy, current: done, total }}
          hotkeys={`${t(settings.wrongHelp === "none" ? "typing.hotkeysNoPeek" : "typing.hotkeys")} · ${t("skin.exitHint")}`}
          density={settings.skinDensity}
          lettersEl={letters}
          card={onCard ? renderCard?.(m.index, cardNav) : undefined}
          notice={state === "batchDone" ? batchNotice : undefined}
          onMenu={() => navigate("/settings")}
          onExit={() => void update("skin", "none")}
        />
      </div>
    );
  }


  return (
    <section className={`typing-stage state-${state}`} onClick={focusCapture}>
      {capture}
      <div className="neighbors">
        <WordPreview word={words[m.index - 1]} dir="left" masked={settings.typingMode === "dictation"} onClick={onCard ? cardNav.prev : prev} />
        <div className="neighbors-center" onClick={(e) => e.stopPropagation()}>
          {toolbar}
        </div>
        <WordPreview word={onCard ? word : words[m.index + 1]} dir="right" masked={settings.typingMode === "dictation"} onClick={onCard ? cardNav.next : m.next} />
      </div>

      {onCard ? (
        renderCard?.(m.index, cardNav)
      ) : (
        <>
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
            <div className="pronounce-row" onClick={(e) => e.stopPropagation()}>
              <div className="row-extras">
                <MarkControl word={word} mark={marks.get(word.id)} pill onDone={focusCapture} />
                {onKnown && state !== "completed" && (
                  <Tooltip content={t("typing.knownTip")}>
                    <button
                      type="button"
                      className="row-pill"
                      onClick={() => {
                        onKnown(word);
                        m.dismiss();
                        focusCapture();
                      }}
                    >
                      {t("typing.known")}
                    </button>
                  </Tooltip>
                )}
              </div>
              <PronouncePill
                hideText={mode === "listen" && state !== "completed"}
                word={word}
                onSay={(accent) => {
                  say(word, accent);
                  focusCapture();
                }}
                onVolumeClose={focusCapture}
              />
            </div>
            {(settings.showMeaning || state === "completed") && <MeaningRow meanings={word.meanings} />}
            <div className="typing-feedback" aria-live="polite">
              {feedback && <span className={state === "completed" && !m.skipped ? "ok" : "hint"}>{feedback}</span>}
              {m.canSkip && state !== "completed" && (
                <button type="button" className="skip-btn" onClick={m.next}>
                  {t("typing.skip")}
                </button>
              )}
            </div>
          </div>

          {state === "completed" && <Divider />}
          <DetailCards word={word} visible={state === "completed"} />
        </>
      )}

      <TypingStats stats={m.stats} accuracy={m.accuracy} current={done} total={total} seconds={seconds} />
      <p className="muted hotkeys" hidden={onCard}>{t(settings.wrongHelp === "none" ? "typing.hotkeysNoPeek" : "typing.hotkeys")}</p>
    </section>
  );
}
