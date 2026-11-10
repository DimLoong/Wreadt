import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Divider, Tag, Tooltip } from "tdesign-react";
import { CheckIcon } from "tdesign-icons-react";
import { isCustomDict, knownDays, type TypingOutcome, type WordItem } from "@wreadt/core";
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
import HotkeyBar, { type HotkeyItem } from "./typing/HotkeyBar";
import FinishConfirm from "./typing/FinishConfirm";
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
  /** 取消“已会” */
  onUnknown?: (word: WordItem) => void;
  /** 这个词是否已经多次一次拼对（拼完后提示标为已会） */
  wellKnown?: (word: WordItem) => boolean;
  /** 这个词是不是第一次学（标“新词 / 复习”；本组开始时判断一次） */
  isNew?: (word: WordItem) => boolean;
  /** 循序渐进时这个词该怎么显示（本组开始时判断一次）；不传时完整默写 */
  stageOf?: (word: WordItem) => SpellStage;
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
  /** 快捷键条的位置：造句题的快捷键显示在和拼单词时同一处 */
  keysSlot: HTMLElement | null;
}

/** 拼写难度：copy 看着拼，hint 给开头几个字母，recall 完整默写 */
export type SpellStage = "copy" | "hint" | "recall";

/** 提示阶段给出的开头字母数：约三分之一，至少 1 个 */
const hintLetters = (answer: string) => Math.max(1, Math.round(answer.length / 3));

function say(word: WordItem, accent: Accent = "us") {
  pronounceWord(speechText(word), word.lang, accent).catch(() => undefined); // 浏览器可能拦截自动播放
}

export default function TypingSession({ words, onWordDone, onBatchDone, toolbar, mode = "normal", active = true, onProgress, onKnown, onUnknown, wellKnown, isNew, stageOf, cardSlots = [], renderCard, batchNotice }: Props) {
  // 本组开始时的新词：打完一遍再跳回来仍然算新词
  const [newIds] = useState(() => new Set(isNew ? words.filter(isNew).map((w) => w.id) : []));
  const [stages] = useState(() => new Map(stageOf ? words.map((w) => [w.id, stageOf(w)]) : []));
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
      if (soundOn && !outcome.skipped && outcome.errors === 0) play("correct");
      onWordDone(w, outcome);
    },
  });
  const { word, state } = m;
  const stageFor = (w?: WordItem): SpellStage => {
    if (settings.typingMode !== "gradual") return settings.typingMode === "copy" ? "copy" : "recall";
    return (w && stages.get(w.id)) ?? "recall";
  };
  // 发音易错题：常读错的词（我的词库）和 mark 原因为“发音”的词不拼写——
  // 只给单词和释义、不给音标，先默读，再听发音，自己判断读对没有（伪装与专项练习里照常拼写）
  const pronQuiz = Boolean(word) && mode === "normal" && !disguised && (word!.focus === "pronunciation" || marks.get(word!.id)?.reason === "pronunciation");
  const [heardId, setHeardId] = useState<string | null>(null);
  const heard = heardId === word?.id || state === "completed";
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
  // 刚刚在这里点亮的词才播放点亮动效；跳走再回来只保持亮着，不重播
  const [justKnown, setJustKnown] = useState<string | null>(null);
  const [shownId, setShownId] = useState(word?.id);
  if (shownId !== word?.id) {
    setShownId(word?.id);
    setJustKnown(null);
  }
  // 按下已会后弹一下气泡，说明多久后再复习，2.5 秒后收起（之后悬浮仍能看到）
  const [popClosedFor, setPopClosedFor] = useState<string | null>(null);
  const knownPop = Boolean(word && justKnown === word.id && popClosedFor !== word.id);
  useEffect(() => {
    if (!knownPop || !word) return;
    const id = word.id;
    const timer = window.setTimeout(() => setPopClosedFor(id), 2500);
    return () => window.clearTimeout(timer);
  }, [knownPop, word]);
  // 已会后约几个月再复习（按单词固定，标记前就能说清楚）
  const knownWhen = word ? t("typing.knownWhen", { n: Math.max(1, Math.round(knownDays(word.id) / 30)) }) : "";
  // 标为已会后留在当前词：按钮从灭到亮，看清生效了再按任意键继续
  const markKnown = () => {
    if (!word || !onKnown || knownIds.has(word.id)) return;
    setKnownIds((s) => new Set(s).add(word.id));
    setJustKnown(word.id);
    setPopClosedFor(null);
    onKnown(word);
  };
  // 再点一次取消已会，恢复之前的复习进度
  const unmarkKnown = () => {
    if (!word || !knownIds.has(word.id)) return;
    setKnownIds((s) => {
      const next = new Set(s);
      next.delete(word.id);
      return next;
    });
    setJustKnown(null);
    onUnknown?.(word);
  };
  const toggleKnown = () => (knownIds.has(word?.id ?? "") ? unmarkKnown() : markKnown());
  // 拼完后的“更多”（构词、短语、更多例句）：本次练习里展开过就一直展开
  const [moreOpen, setMoreOpen] = useState(false);
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


  // 走到最后还有词没做（直接跳过的）：先确认是结束本组还是回去做完
  const unfinished = words.length - m.doneCount;
  const [confirmEnd, setConfirmEnd] = useState(false);
  useEffect(() => {
    if (state !== "batchDone") return;
    if (unfinished > 0) setConfirmEnd(true);
    else onBatchDone();
  }, [state, onBatchDone, unfinished]);
  const backToUnfinished = () => {
    setConfirmEnd(false);
    m.jump(words.findIndex((_, i) => !m.isFinished(i)));
    window.setTimeout(() => captureRef.current?.focus());
  };
  const finishConfirm = confirmEnd && (
    <FinishConfirm
      count={unfinished}
      onBack={backToUnfinished}
      onFinish={() => {
        setConfirmEnd(false);
        onBatchDone();
      }}
    />
  );


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
  const [keysSlot, setKeysSlot] = useState<HTMLElement | null>(null);
  const cardNav: CardNav = {
    keysSlot,
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
      // 常读错的词不管是否开了自动发音都先读一遍
      // 发音易错题要先自己读，不自动发音
      if (settings.autoPlay && !pronQuiz) say(word, settings.accent);
      const upcoming = words[m.index + 1];
      if (upcoming) preloadAudio(speechText(upcoming), upcoming.lang, settings.accent);
    }, AUTOPLAY_DELAY_MS);
    return () => window.clearTimeout(timer);
    // 只在换词时发音；切回页面不重播
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word, settings.autoPlay, settings.accent, words, m.index, onCard, pronQuiz]);

  if (!word) return null;

  // 播放发音（拼完后单词按音节跟着上浮）；发音易错题听过之后才能判断读对没有
  const listen = (accent: Accent = settings.accent) => {
    say(word, accent);
    if (state === "completed" || pronQuiz) setSpeakTick((n) => n + 1);
    if (pronQuiz) setHeardId(word.id);
  };

  const focusCapture = () => {
    if (!onCard) captureRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (confirmEnd) return;
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
      listen();
      return;
    }
    // Ctrl/⌘ + Enter：我早就会了，推到很久以后复习并进入下一个
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      // 拼对之后才能标为已会（先证明会拼）
      if (state === "completed") toggleKnown();
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
    // 发音易错题：空格 / Enter 听发音，听过后 1 读对了、2 读错了
    if (pronQuiz && state !== "completed") {
      if (e.key.length === 1 || e.key === "Enter") e.preventDefault();
      if (e.key === " " || e.key === "Enter") listen();
      else if (heard && (e.key === "1" || e.key === "2")) m.judge(e.key === "1");
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
    if (pronQuiz) return;
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
      typed={pronQuiz ? word.answer : m.typed}
      // 按住 Tab 看答案时只显示正确拼写，不留按错 / 手滑的字母
      wrongChar={m.peeking ? null : m.wrongChar}
      slipChar={m.peeking ? null : m.slipChar}
      soundChar={m.peeking ? null : m.soundChar}
      hidden={!pronQuiz && (stageFor(word) !== "copy" || mode !== "normal") && !m.peeking && state !== "completed"}
      revealed={stageFor(word) === "hint" && mode === "normal" ? Math.max(m.revealed, hintLetters(word.answer)) : m.revealed}
      plainSpace={settings.skin !== "none"}
      // 拼写正确后按音节拆开再合拢，帮助记忆单词结构（仅英文、按任意键继续时）；伪装皮肤里静态显示分隔点
      syllables={settings.syllableSplit && state === "completed" && word.lang === "en" ? syllableBreaks(word.answer) : undefined}
      replay={sylReplay}
      speak={(state === "completed" || pronQuiz) && word.lang === "en" && settings.skin === "none" ? { tick: speakTick, breaks: syllableBreaks(word.answer) } : undefined}
    />
  );

  const sub = (word.lang === "ja" ? word.reading !== word.display && word.reading : word.phonetic && `/${word.phonetic}/`) || undefined;
  const feedbackOk = state === "completed" && !m.skipped;
  const feedback =
    imeWarning
      ? t("typing.imeWarning")
      : state === "completed"
        ? t(m.skipped ? "typing.skippedAnyKey" : "typing.pressAnyKey")
        : state === "hint" && m.hintReason
          ? t(`typing.hint.${m.hintReason}`)
          : "";

  // 快捷键说明，每一项都可以直接点
  const peekByClick = () => {
    m.peek(true);
    window.setTimeout(() => m.peek(false), 1500);
  };
  const hotkeyItems: HotkeyItem[] = [
    ...(settings.wrongHelp === "none" || pronQuiz ? [] : [{ id: "peek", keys: "Tab", label: t("hotkey.peek"), onClick: peekByClick, disabled: state === "completed" }]),
    { id: "prev", keys: "←↑", label: t("typing.prev"), onClick: prev, disabled: m.index === 0 },
    { id: "next", keys: "→↓", label: t("typing.next"), onClick: m.next },
    {
      id: "audio",
      keys: "Ctrl+J",
      label: t("hotkey.audio"),
      onClick: listen,
    },
    ...(onKnown
      ? [{ id: "known", keys: "Ctrl/⌘+Enter", label: t("typing.known"), onClick: toggleKnown, disabled: state !== "completed", active: isKnown, lit: justKnown === word.id, title: state !== "completed" ? t("hotkey.knownLater") : t(isKnown ? "typing.knownDone" : "typing.knownTip", { when: knownWhen }) }]
      : []),
    ...(fullscreen.supported ? [{ id: "fullscreen", keys: "Ctrl+Shift+F", label: t(fullscreen.on ? "typing.exitFullscreen" : "typing.fullscreen"), onClick: fullscreen.toggle }] : []),
  ];

  if (settings.skin !== "none") {
    const Skin = SKINS[settings.skin];
    return (
      <div onClick={focusCapture}>
        {capture}
        {finishConfirm}
        <Skin
          word={word}
          typed={m.typed}
          state={state}
          sub={sub}
          meaning={word.meanings.join("；")}
          feedback={feedback}
          ok={feedbackOk}
          index={m.index}
          stats={{ seconds, wpm: wpmOf(m.stats, seconds), keystrokes: m.stats.keystrokes, correct: m.stats.correct, done: m.stats.done, accuracy: m.accuracy, current: done, total }}
          hotkeys={
            <HotkeyBar
              items={[...hotkeyItems, { id: "exit", keys: "Esc Esc", label: t("hotkey.exitDisguise"), onClick: () => void update("skin", "none") }]}
            />
          }
          density={settings.skinDensity}
          lettersEl={letters}
          card={onCard ? renderCard?.(m.index, cardNav) : undefined}
          notice={state === "batchDone" && !confirmEnd ? batchNotice : undefined}
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
      {finishConfirm}
      <div className="neighbors">
        <WordPreview word={words[m.index - 1]} dir="left" masked={stageFor(words[m.index - 1]) !== "copy" && !m.isFinished(m.index - 1)} onClick={onCard ? cardNav.prev : prev} />
        <div className="neighbors-center" onClick={(e) => e.stopPropagation()}>
          {toolbar}
        </div>
        <WordPreview word={onCard ? word : words[m.index + 1]} dir="right" masked={stageFor(onCard ? word : words[m.index + 1]) !== "copy" && !m.isFinished(onCard ? m.index : m.index + 1)} onClick={onCard ? cardNav.next : m.next} />
      </div>

      {onCard ? (
        renderCard?.(m.index, cardNav)
      ) : (
        <>
          <div className="main-word">
            {word.lang === "ja" && (
              <div key={word.id} className="word-display word-enter" lang="ja">
                {word.display}
              </div>
            )}
            {/* 换词时新词从下方轻轻淡入（key 变化触发动画） */}
            <div
              key={word.id}
              className={`word-letters-row word-enter ${word.lang === "ja" ? "romaji" : ""} ${pronQuiz ? `pron-quiz ${state === "completed" ? (m.errors ? "pron-bad" : "pron-ok") : ""}` : ""}`}
              onMouseEnter={() => state === "completed" && setSylReplay((n) => n + 1)}
            >
              {letters}
              {/* 上次的错误拼法：这次又拼错时才提起，拼对了就不打扰 */}
              {state === "completed" && !pronQuiz && m.errors > 0 && ghost?.id === word.id && (
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
              {/* 题型与来源标签在发音胶囊左侧，打字时也不淡出；放在按钮行里，免得单词上下跳 */}
              <div className="row-tags">
                {pronQuiz && (
                  <Tag theme="primary" variant="light" size="small" className="mine-tag">
                    {t("pron.tag")}
                  </Tag>
                )}
                {isCustomDict(word.dictId) && (
                  <Tag theme="warning" variant="light" size="small" className="mine-tag">
                    {t("typing.mine")}
                  </Tag>
                )}
                {isNew && (
                  <Tag theme={newIds.has(word.id) ? "success" : "default"} variant="light" size="small" className="mine-tag">
                    {t(newIds.has(word.id) ? "typing.newWord" : "typing.reviewWord")}
                  </Tag>
                )}
              </div>
              <div className="row-extras">
                <MarkControl word={word} mark={marks.get(word.id)} pill onDone={focusCapture} />
                {onKnown && state === "completed" && (
                  // 多次一次拼对、这次又一次拼对：按钮轻微律动，并弹出可关闭的气泡（5 秒后自动关闭）；
                  // 标为已会后按钮保持选中状态（跳回来也是），不再提示
                  <Tooltip
                    content={
                      tipOpen ? (
                        <span className="known-tip">
                          {t("typing.knownSuggest", { when: knownWhen })}
                          <button type="button" aria-label={t("common.close")} onClick={() => setTipClosedFor(word.id)}>
                            ✕
                          </button>
                        </span>
                      ) : (
                        t(isKnown ? "typing.knownDone" : "typing.knownTip", { when: knownWhen })
                      )
                    }
                    visible={suggestKnown ? tipOpen : knownPop || undefined}
                    placement="top"
                    showArrow
                  >
                    <button
                      type="button"
                      className={`row-pill known-btn ${isKnown ? "active" : ""} ${justKnown === word.id ? "lit" : ""} ${suggestKnown ? "known-suggest" : ""}`}
                      aria-pressed={isKnown}
                      onClick={() => {
                        toggleKnown();
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
                // 发音易错题听过之前不给音标
                hideText={(mode === "listen" || (pronQuiz && !heard)) && state !== "completed"}
                word={word}
                onSay={(accent) => {
                  listen(accent);
                  focusCapture();
                }}
                onVolumeClose={focusCapture}
              />
            </div>
            {(settings.showMeaning || pronQuiz || state === "completed") && <MeaningRow meanings={word.meanings} />}
            {/* 发音相近的拼错：拼完后讲解（固定占一行，避免布局跳动） */}
        <div className="spelling-tip-slot">
          {state === "completed" && m.soundMistake && word.lang === "en" && <SpellingTip answer={word.answer} mistake={m.soundMistake} />}
        </div>
        <div className="typing-feedback" aria-live="polite">
              {pronQuiz ? (
                <PronJudge heard={heard} done={state === "completed"} right={m.errors === 0} onJudge={(ok) => {
                  m.judge(ok);
                  focusCapture();
                }} />
              ) : (
                feedback && <span className={feedbackOk ? "ok" : "hint"}>{feedback}</span>
              )}
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
              <DetailCards
                word={word}
                visible={state === "completed"}
                onBackToTyping={() => captureRef.current?.focus()}
                expanded={moreOpen}
                onToggle={() => {
                  setMoreOpen((v) => !v);
                  focusCapture();
                }}
                parts={<WordParts word={word} visible={state === "completed"} />}
              />
            </div>
          )}
        </>
      )}

      <TypingStats stats={m.stats} accuracy={m.accuracy} current={done} total={total} seconds={seconds} />
      <p className="muted hotkeys">{onCard ? <span ref={setKeysSlot} /> : <HotkeyBar items={hotkeyItems} />}</p>
    </section>
  );
}

/** 发音易错题的反馈行：先默读再听；听过后自己判断读对没有；判断后按任意键继续 */
function PronJudge({ heard, done, right, onJudge }: { heard: boolean; done: boolean; right: boolean; onJudge: (ok: boolean) => void }) {
  const { t } = useSettings();
  if (done) return <span className={right ? "ok" : "hint"}>{t(right ? "pron.right" : "pron.wrong")}</span>;
  if (!heard) return <span className="muted">{t("pron.readFirst")}</span>;
  return (
    <span className="pron-judge" onClick={(e) => e.stopPropagation()}>
      <span className="muted">{t("pron.ask")}</span>
      <button type="button" className="pron-judge-btn ok" onMouseDown={(e) => e.preventDefault()} onClick={() => onJudge(true)}>
        {t("pron.yes")} <kbd>1</kbd>
      </button>
      <button type="button" className="pron-judge-btn bad" onMouseDown={(e) => e.preventDefault()} onClick={() => onJudge(false)}>
        {t("pron.no")} <kbd>2</kbd>
      </button>
    </span>
  );
}
