import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Divider, Tag, Tooltip } from "tdesign-react";
import { CheckIcon } from "tdesign-icons-react";
import { isCustomDict, type TypingOutcome, type WordItem } from "@wreadt/core";
import { useTypingMachine } from "../hooks/useTypingMachine";
import { useSettings } from "../context/settings";
import { useFocusMode } from "../context/focus";
import { useFullscreen } from "../hooks/useFullscreen";
import { loadSyllables, syllableBreaks } from "../lib/syllables";
import { loadGhost } from "../lib/spelling";
import type { Ghost } from "@wreadt/core";
import { preloadAudio, speechText, stopAudio, type Accent } from "../services/youdao";
import { pronounceWord } from "../services/speech";
import { play } from "../services/sound";
import { markStudyActivity } from "../services/studyTime";
import WordLetters from "./WordLetters";
import WordPreview from "./typing/WordPreview";
import MeaningRow from "./typing/MeaningRow";
import PronouncePill from "./typing/PronouncePill";
import DetailCards from "./typing/DetailCards";
import WordParts from "./typing/WordParts";
import SpellingTip from "./typing/SpellingTip";
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
  /** “我早就会了”（拼对之后，Ctrl/⌘ + Enter） */
  onKnown?: (word: WordItem) => void;
  /** 这个词是否已经多次一次拼对（拼完后提示标为已会） */
  wellKnown?: (word: WordItem) => boolean;
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

export default function TypingSession({ words, onWordDone, onBatchDone, toolbar, mode = "normal", active = true, onProgress, onKnown, wellKnown, cardSlots = [], renderCard, batchNotice }: Props) {
  const marks = useMarks();
  const { settings, t, update } = useSettings();
  const { focused, setFocused } = useFocusMode();
  const fullscreen = useFullscreen();
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
    typoMode: settings.typoMode,
    onWordDone: (w, outcome) => {
      if (soundOn && !outcome.skipped) play("correct");
      onWordDone(w, outcome);
    },
  });
  const { word, state } = m;
  // 错词幽灵回放：换词时查这个词上次拼错的样子，拼完后在单词下方对照显示（拼写过程中不显示，避免泄底）
  const [ghost, setGhost] = useState<{ id: string; ghost: Ghost } | null>(null);
  useEffect(() => {
    if (!word) return;
    let cancelled = false;
    void loadGhost(word).then((g) => !cancelled && setGhost(g ? { id: word.id, ghost: g } : null));
    return () => {
      cancelled = true;
    };
  }, [word]);
  // 本组里已标为已会的词：跳回来时按钮保持选中，不再提示
  const [knownIds, setKnownIds] = useState<Set<string>>(() => new Set());
  const isKnown = Boolean(word && knownIds.has(word.id));
  // 这次一次拼对，且之前已经多次一次拼对：建议标为已会
  const suggestKnown = Boolean(word && state === "completed" && m.errors === 0 && !m.skipped && !isKnown && wellKnown?.(word) && active);
  // 建议气泡：可手动关闭，5 秒后自动关闭（每个词只弹一次）
  const [tipClosedFor, setTipClosedFor] = useState<string | null>(null);
  const tipOpen = suggestKnown && tipClosedFor !== word?.id;
  useEffect(() => {
    if (!tipOpen || !word) return;
    const id = word.id;
    const timer = window.setTimeout(() => setTipClosedFor(id), 5000);
    return () => window.clearTimeout(timer);
  }, [tipOpen, word]);
  const markKnown = () => {
    if (!word || !onKnown) return;
    setKnownIds((s) => new Set(s).add(word.id));
    onKnown(word);
    m.next();
  };
  // 鼠标悬浮拼写完的单词时重新播放音节拆分动画
  const [sylReplay, setSylReplay] = useState(0);
  // 拼完后播放发音时，单词按音节依次上浮（跟读）
  const [speakTick, setSpeakTick] = useState(0);
  // 断字规则按需加载：进入打字页就开始加载，拼完时可以立即拆分
  useEffect(() => {
    if (settings.syllableSplit) void loadSyllables();
  }, [settings.syllableSplit]);
  // 用时：只在打字页且本组未结束时计时（伪装模式同样计入学习时长）
  const seconds = useElapsedSeconds(m.stats.startedAt > 0, active && state !== "batchDone");

  useEffect(() => {
    if (soundOn && m.wrongChar) play("wrong");
  }, [soundOn, m.wrongChar, m.errors]);


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
    // Ctrl+Shift+F：全屏
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      fullscreen.toggle();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
      e.preventDefault();
      say(word, settings.accent);
      if (state === "completed") setSpeakTick((n) => n + 1);
      return;
    }
    // Ctrl/⌘ + Enter：我早就会了，推到很久以后复习并进入下一个
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      // 拼对之后才能标为已会（先证明会拼）
      if (state === "completed" && onKnown) {
        onKnown(word);
        m.next();
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
    // ← ↑ 上一个，→ ↓ 下一个
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      m.next();
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      m.peek(true);
      return;
    }
    // 完成后按任意键进入下一个；建议标为已会时，Enter 就是“已会”（不用动鼠标）
    if (state === "completed") {
      if (e.key === "Enter" && suggestKnown && onKnown) {
        e.preventDefault();
        markKnown();
        return;
      }
      if (e.key.length === 1 || e.key === "Enter") {
        e.preventDefault();
        m.next();
      }
      return;
    }
    if (e.key.length === 1) {
      e.preventDefault();
      setImeWarning(false);
      // 按下即发声（不等界面更新），避免“按了才响”的延迟感
      if (keySoundOn) play("key");
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
    for (const ch of data) {
      if (keySoundOn) play("key");
      m.press(ch);
    }
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
      slipChar={m.slipChar}
      soundChar={m.soundChar}
      hidden={(settings.typingMode === "dictation" || mode !== "normal") && !m.peeking && state !== "completed"}
      revealed={m.revealed}
      plainSpace={settings.skin !== "none"}
      // 拼写正确后按音节拆开再合拢，帮助记忆单词结构（仅英文、按任意键继续时）
      syllables={settings.syllableSplit && state === "completed" && word.lang === "en" && settings.skin === "none" ? syllableBreaks(word.answer) : undefined}
      replay={sylReplay}
      speak={state === "completed" && word.lang === "en" && settings.skin === "none" ? { tick: speakTick, breaks: syllableBreaks(word.answer) } : undefined}
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
          onMenu={() => navigate("/settings?tab=appearance")}
          onExit={() => void update("skin", "none")}
        />
      </div>
    );
  }


  return (
    // focused：正在打字时淡出次要信息（词库选择、前后词预览、统计、快捷键），移动鼠标即恢复
    <section className={`typing-stage state-${state} ${focused ? "focused" : ""}`} onClick={focusCapture}>
      {capture}
      <div className="neighbors">
        <WordPreview word={words[m.index - 1]} dir="left" masked={settings.typingMode === "dictation" && !m.isFinished(m.index - 1)} onClick={onCard ? cardNav.prev : prev} />
        <div className="neighbors-center" onClick={(e) => e.stopPropagation()}>
          {toolbar}
        </div>
        <WordPreview word={onCard ? word : words[m.index + 1]} dir="right" masked={settings.typingMode === "dictation" && !m.isFinished(onCard ? m.index : m.index + 1)} onClick={onCard ? cardNav.next : m.next} />
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
              <div key={word.id} className="word-display word-enter" lang="ja">
                {word.display}
              </div>
            )}
            {/* 换词时新词从下方轻轻淡入（key 变化触发动画） */}
            <div
              key={word.id}
              className={`word-letters-row word-enter ${word.lang === "ja" ? "romaji" : ""}`}
              onMouseEnter={() => state === "completed" && setSylReplay((n) => n + 1)}
            >
              {letters}
              {state === "completed" && ghost?.id === word.id && (
                <span className="ghost-word" title={t("typing.ghostTip")}>
                  <span className="ghost-label">{t("typing.ghostLabel")}</span>
                  <s>
                    {ghost.ghost.text.slice(0, ghost.ghost.from)}
                    <b>{ghost.ghost.text.slice(ghost.ghost.from, ghost.ghost.to)}</b>
                    {ghost.ghost.text.slice(ghost.ghost.to)}
                  </s>
                </span>
              )}
            </div>
            <div className="pronounce-row" onClick={(e) => e.stopPropagation()}>
              <div className="row-extras">
                <MarkControl word={word} mark={marks.get(word.id)} pill onDone={focusCapture} />
                {onKnown && state === "completed" && (
                  // 多次一次拼对、这次又一次拼对：按钮轻微律动，并弹出可关闭的气泡（5 秒后自动关闭）；
                  // 标为已会后按钮保持选中状态（跳回来也是），不再提示
                  <Tooltip
                    content={
                      tipOpen ? (
                        <span className="known-tip">
                          {t("typing.knownSuggest")}
                          <button type="button" aria-label={t("common.close")} onClick={() => setTipClosedFor(word.id)}>
                            ✕
                          </button>
                        </span>
                      ) : isKnown ? (
                        t("typing.knownDone")
                      ) : (
                        t("typing.knownTip")
                      )
                    }
                    visible={suggestKnown ? tipOpen : undefined}
                    placement="top"
                    showArrow
                  >
                    <button
                      type="button"
                      className={`row-pill known-btn ${isKnown ? "active" : ""} ${suggestKnown ? "known-suggest" : ""}`}
                      aria-pressed={isKnown}
                      onClick={() => {
                        if (isKnown) return;
                        markKnown();
                        focusCapture();
                      }}
                    >
                      {isKnown && <CheckIcon />}
                      {t("typing.known")}
                      {suggestKnown && <kbd className="known-kbd">↵</kbd>}
                    </button>
                  </Tooltip>
                )}
              </div>
              <PronouncePill
                hideText={mode === "listen" && state !== "completed"}
                word={word}
                onSay={(accent) => {
                  say(word, accent);
                  if (state === "completed") setSpeakTick((n) => n + 1);
                  focusCapture();
                }}
                onVolumeClose={focusCapture}
              />
            </div>
            {(settings.showMeaning || state === "completed") && <MeaningRow meanings={word.meanings} />}
            {/* 发音相近的拼错：拼完后讲解（固定占一行，避免布局跳动） */}
        <div className="spelling-tip-slot">
          {state === "completed" && m.soundMistake && word.lang === "en" && <SpellingTip answer={word.answer} mistake={m.soundMistake} />}
        </div>
        <div className="typing-feedback" aria-live="polite">
              {feedback && <span className={state === "completed" && !m.skipped ? "ok" : "hint"}>{feedback}</span>}
              {m.canSkip && state !== "completed" && (
                <button type="button" className="skip-btn" onClick={m.next}>
                  {t("typing.skip")}
                </button>
              )}
            </div>
          </div>

          {/* 自动前进时拼完就换词，不显示短语与例句，也不占位 */}
          {settings.advance === "key" && (
            <div className={`detail-reveal ${state === "completed" ? "shown" : ""}`}>
              <Divider />
              <WordParts word={word} visible={state === "completed"} />
              <DetailCards word={word} visible={state === "completed"} onBackToTyping={() => captureRef.current?.focus()} />
            </div>
          )}
        </>
      )}

      <TypingStats stats={m.stats} accuracy={m.accuracy} current={done} total={total} seconds={seconds} />
      <p className="muted hotkeys" hidden={onCard}>
        {t(settings.wrongHelp === "none" ? "typing.hotkeysNoPeek" : "typing.hotkeys")}
        {fullscreen.supported && (
          <button
            type="button"
            className="fullscreen-btn"
            onClick={(e) => {
              e.stopPropagation();
              fullscreen.toggle();
              focusCapture();
            }}
          >
            {t(fullscreen.on ? "typing.exitFullscreen" : "typing.fullscreen")}
          </button>
        )}
      </p>
    </section>
  );
}
