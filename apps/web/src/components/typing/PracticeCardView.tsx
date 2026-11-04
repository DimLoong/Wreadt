import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Tag } from "tdesign-react";
import { SonicIcon } from "tdesign-icons-react";
import { chunkMatches, clozeChunks, fillHintBlank, translateChunks, type CardWord, type PracticeCard, type SentenceChunk } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { cardReference, type CardAnswer } from "../../lib/sentenceCards";
import { speakSentence, stopAll } from "../../services/speech";
import { play } from "../../services/sound";
import { markStudyActivity } from "../../services/studyTime";
import HotkeyBar, { type HotkeyItem } from "./HotkeyBar";

/**
 * 穿插在打字中的造句题，和拼写单词同一套布局：上面是要拼的句子，下面是中文，再下面是反馈与快捷键。
 * 句子按段拼写（一个单词一段，目标短语合成一段）：打满一段或按空格时检查这一段，
 * 对了变绿进入下一段；不对就标红、清空这一段重新打（之前打对的保留），连错几次逐步露出字母。
 * 填空题只有空位那一段要打。拼完后按任意键继续。
 */
interface Props {
  card: PracticeCard;
  words: CardWord[];
  /** 之前的作答：跳回来时直接显示拼完的样子 */
  initial?: CardAnswer;
  onPrev: () => void;
  /** 完成（answer）或跳过（null），进入后面的单词 */
  onDone: (answer: CardAnswer | null) => void;
  /** 快捷键条的位置（与拼单词时同一处）；没有时不显示 */
  keysSlot?: HTMLElement | null;
}

/** 空格、短横线、撇号：始终显示（仍需输入），帮助判断结构 */
const isMark = (ch: string) => !/[\p{L}\p{N}]/u.test(ch);
/** 句中的标点只显示，不用打；按下时忽略 */
const IGNORED = /[,.!?;:"“”()—–]/;

/** 一段连错几次后露出几个字母：1 次露首字母，2 次露一半，3 次全露 */
const revealCount = (misses: number, len: number) => (misses <= 0 ? 0 : misses === 1 ? 1 : misses === 2 ? Math.ceil(len / 2) : len);

export default function PracticeCardView({ card, words, initial, onPrev, onDone, keysSlot }: Props) {
  const { t, settings } = useSettings();
  const captureRef = useRef<HTMLInputElement>(null);
  const chunks = useMemo<SentenceChunk[]>(
    () => (card.kind === "cloze" ? clozeChunks(card.sentence ?? "", card.answer ?? "") : translateChunks(card.reference ?? "", card.words)),
    [card],
  );
  /** 要打的段在 chunks 里的下标 */
  const order = useMemo(() => chunks.flatMap((c, i) => (c.given ? [] : [i])), [chunks]);
  const [pos, setPos] = useState(initial ? order.length : 0);
  const [buf, setBuf] = useState("");
  /** 刚检查出错的一段：红色显示打错的内容，下一次按键时清掉 */
  const [wrong, setWrong] = useState<string | null>(null);
  const [misses, setMisses] = useState<Record<number, number>>(() => Object.fromEntries((initial?.misses ?? []).map((text) => [chunks.findIndex((c) => c.text === text), 1])));
  const [peeking, setPeeking] = useState(false);
  const done = pos >= order.length;
  const current = order[pos];
  const disguised = settings.skin !== "none";

  useEffect(() => {
    captureRef.current?.focus();
  }, []);

  const sayReference = () => speakSentence(cardReference(card), { accent: settings.accent, voice: settings.sentenceVoice }).catch(() => undefined);
  useEffect(() => () => stopAll(), []);
  // 打错的内容红着停一下，再换回空位（连错时空位里会露出提示字母）
  useEffect(() => {
    if (wrong === null) return;
    const timer = window.setTimeout(() => setWrong(null), 700);
    return () => window.clearTimeout(timer);
  }, [wrong]);

  const finish = () => onDone({ card, input: cardReference(card), ok: Object.keys(misses).length === 0, misses: Object.keys(misses).map((i) => chunks[Number(i)]!.text) });
  const skip = () => (done ? finish() : onDone(null));

  // 检查当前这一段
  const check = (value: string) => {
    if (current === undefined) return;
    if (chunkMatches(chunks[current]!.text, value)) {
      setBuf("");
      setPos(pos + 1);
      // 整句拼完：读一遍完整的句子
      if (pos + 1 >= order.length && settings.autoPlay) void sayReference();
      return;
    }
    setBuf("");
    setWrong(value);
    setMisses({ ...misses, [current]: (misses[current] ?? 0) + 1 });
    if (settings.sound && !disguised) play("wrong");
  };

  const press = (ch: string) => {
    markStudyActivity();
    if (done) {
      // 句末顺手打的空格、句号不算“继续”，免得一打完就跳走、看不到整句
      if (ch !== " " && !IGNORED.test(ch)) finish();
      return;
    }
    const target = chunks[current!]!.text;
    setWrong(null);
    if (ch === " ") {
      // 短语段中间的空格要打；其他时候空格表示这一段打完了
      if (buf && target[buf.length] === " ") setBuf(buf + " ");
      else if (buf.trim()) check(buf);
      return;
    }
    if (IGNORED.test(ch)) return;
    if (settings.keySound && !disguised) play("key");
    const next = buf + ch;
    if (next.length >= target.length) check(next);
    else setBuf(next);
  };

  const peekByClick = () => {
    setPeeking(true);
    window.setTimeout(() => setPeeking(false), 1500);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.key === "Process") return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
      e.preventDefault();
      void sayReference();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      onPrev();
    } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      skip();
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (!done) setPeeking(true);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      setWrong(null);
      setBuf(buf.slice(0, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (done) finish();
      else if (buf.trim()) check(buf);
    } else if (e.key.length === 1) {
      e.preventDefault();
      press(e.key);
    }
  };

  // 移动端软键盘的 keydown 常拿不到字符，从 input 事件兜底
  const onInput = (e: FormEvent<HTMLInputElement>) => {
    const data = (e.nativeEvent as InputEvent).data ?? "";
    e.currentTarget.value = "";
    for (const ch of data) press(ch);
  };

  const renderChunk = (c: SentenceChunk, i: number) => {
    if (c.given) return <span key={i} className="sentence-given">{c.text}</span>;
    const k = order.indexOf(i);
    const state = k < pos ? "ok" : k === pos ? "current" : "todo";
    const shown = revealCount(misses[i] ?? 0, c.text.length);
    // 目标词本身给出来（就是要用上的词），默写模式下也藏起来
    const visible = peeking || (c.target && card.kind === "translate" && settings.typingMode !== "dictation");
    const punct = c.trail.trimEnd();
    const letters =
      state === "current" && wrong !== null ? (
        <span className="letters shake">
          {Array.from(wrong).map((ch, j) => (
            <span key={j} className="bad">
              {ch}
            </span>
          ))}
        </span>
      ) : (
        <span className="letters">
          {Array.from(c.text).map((ch, j) => {
            if (state === "ok") return <span key={j} className={`ok${isMark(ch) ? " mark" : ""}`}>{ch}</span>;
            const caret = state === "current" && j === buf.length ? " caret" : "";
            if (state === "current" && j < buf.length) return <span key={j} className="typed">{buf[j]}</span>;
            if (isMark(ch)) return <span key={j} className={`mark${caret}`}>{ch}</span>;
            if (visible || j < shown) return <span key={j} className={`revealed${caret}`}>{ch}</span>;
            return <span key={j} className={`blank${caret}`}>_</span>;
          })}
        </span>
      );
    return (
      <span key={i}>
        <span className={`sentence-chunk ${state} ${c.target ? "target" : ""}`}>
          {c.lead}
          {letters}
          {punct}
        </span>
        {c.trail.endsWith(" ") && " "}
      </span>
    );
  };

  const meaningOf = (w: string) => words.find((x) => x.word === w)?.meaning ?? "";
  // 填空的提示里可能也留了空，显示时用释义补上
  const zh = card.kind === "cloze" ? fillHintBlank(card.translation ?? "", meaningOf(card.words[0] ?? "")) : (card.zh ?? "");

  const hotkeys: HotkeyItem[] = [
    { id: "peek", keys: "Tab", label: t("hotkey.peek"), onClick: peekByClick, disabled: done },
    { id: "prev", keys: "←↑", label: t("typing.prev"), onClick: onPrev },
    { id: "next", keys: "→↓", label: t("typing.next"), onClick: skip },
    { id: "audio", keys: "Ctrl+J", label: t("hotkey.audio"), onClick: () => void sayReference() },
  ];

  return (
    <div className={`main-word practice-stage ${done ? "is-done" : ""}`} onClick={() => captureRef.current?.focus()}>
      <input
        ref={captureRef}
        className="typing-capture"
        onKeyDown={onKeyDown}
        onKeyUp={(e) => e.key === "Tab" && setPeeking(false)}
        onInput={onInput}
        onBlur={() => setPeeking(false)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label={t(card.kind === "cloze" ? "cards.cloze" : "cards.translate")}
      />
      <div className="word-letters-row sentence-row word-enter" lang="en">
        {chunks.map(renderChunk)}
      </div>
      <div className="pronounce-row" onClick={(e) => e.stopPropagation()}>
        <div className="row-extras">
          <Tag theme="primary" variant="light" size="small">
            {t(card.kind === "cloze" ? "cards.cloze" : "cards.translate")}
          </Tag>
        </div>
        <span className="accent-pill active">
          <button
            type="button"
            className="accent-play"
            title={`${t("typing.replay")} (Ctrl+J)`}
            onClick={() => {
              void sayReference();
              captureRef.current?.focus();
            }}
          >
            <SonicIcon />
          </button>
        </span>
      </div>
      <div className="meaning-row">
        <span className="meaning-item">{zh}</span>
      </div>
      <div className="spelling-tip-slot" />
      <div className="typing-feedback" aria-live="polite">
        {done ? (
          <span className="ok">{t("typing.pressAnyKey")}</span>
        ) : (
          wrong !== null && <span className="hint">{t("cards.chunkWrong")}</span>
        )}
      </div>
      {keysSlot && createPortal(<HotkeyBar items={hotkeys} />, keysSlot)}
    </div>
  );
}
