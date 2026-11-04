import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Tag } from "tdesign-react";
import { SonicIcon } from "tdesign-icons-react";
import { clozeChunks, fillHintBlank, translateChunks, type CardWord, type PracticeCard } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { cardReference, type CardAnswer } from "../../lib/sentenceCards";
import { speakSentence, stopAll } from "../../services/speech";
import HotkeyBar, { type HotkeyItem } from "./HotkeyBar";
import { ChunkCapture, ChunkRow } from "./ChunkSpelling";
import { useChunkSpelling } from "../../hooks/useChunkSpelling";

/**
 * 穿插在打字中的造句题，和拼写单词同一套布局，按段拼写（见 ChunkSpelling）。
 * 中译英：中文在上，英文每个单词都是一条与单词等长的横线；填空：只有空位那一段要打，中文提示在下。
 * 拼完后按任意键继续。
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

export default function PracticeCardView({ card, words, initial, onPrev, onDone, keysSlot }: Props) {
  const { t, settings } = useSettings();
  const captureRef = useRef<HTMLInputElement>(null);
  const chunks = useMemo(
    () => (card.kind === "cloze" ? clozeChunks(card.sentence ?? "", card.answer ?? "") : translateChunks(card.reference ?? "", card.words)),
    [card],
  );
  const sayReference = () => speakSentence(cardReference(card), { accent: settings.accent, voice: settings.sentenceVoice }).catch(() => undefined);
  const finish = () => {
    const missed = s.missed();
    onDone({ card, input: cardReference(card), ok: missed.length === 0, misses: missed });
  };
  const s = useChunkSpelling(chunks, {
    initialDone: Boolean(initial),
    initialMisses: initial?.misses,
    // 整句拼完：读一遍完整的句子
    onComplete: () => settings.autoPlay && void sayReference(),
    onContinue: () => finish(),
  });
  const skip = () => (s.done ? finish() : onDone(null));

  useEffect(() => {
    captureRef.current?.focus();
  }, []);
  useEffect(() => () => stopAll(), []);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
      e.preventDefault();
      void sayReference();
      return true;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      onPrev();
      return true;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      skip();
      return true;
    }
    return false;
  };

  const meaningOf = (w: string) => words.find((x) => x.word === w)?.meaning ?? "";
  const translate = card.kind === "translate";
  // 填空的提示里可能也留了空，显示时用释义补上
  const zh = translate ? (card.zh ?? "") : fillHintBlank(card.translation ?? "", meaningOf(card.words[0] ?? ""));

  const hotkeys: HotkeyItem[] = [
    { id: "peek", keys: "Tab", label: t("hotkey.peek"), onClick: s.peekByClick, disabled: s.done },
    { id: "prev", keys: "←↑", label: t("typing.prev"), onClick: onPrev },
    { id: "next", keys: "→↓", label: t("typing.next"), onClick: skip },
    { id: "audio", keys: "Ctrl+J", label: t("hotkey.audio"), onClick: () => void sayReference() },
  ];

  return (
    <div className={`main-word practice-stage ${s.done ? "is-done" : ""}`} onClick={() => captureRef.current?.focus()}>
      <ChunkCapture s={s} inputRef={captureRef} onKey={onKey} label={t(translate ? "cards.translate" : "cards.cloze")} />
      {/* 中译英：中文就是题目，放在最上面 */}
      {translate && <p className="sentence-zh">{zh}</p>}
      <ChunkRow s={s} />
      <div className="pronounce-row" onClick={(e) => e.stopPropagation()}>
        <div className="row-extras">
          <Tag theme="primary" variant="light" size="small">
            {t(translate ? "cards.translate" : "cards.cloze")}
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
      {!translate && (
        <div className="meaning-row">
          <span className="meaning-item">{zh}</span>
        </div>
      )}
      <div className="typing-feedback" aria-live="polite">
        {s.done ? <span className="ok">{t("typing.pressAnyKey")}</span> : s.wrong !== null && <span className="hint">{t("cards.chunkWrong")}</span>}
      </div>
      {keysSlot && createPortal(<HotkeyBar items={hotkeys} />, keysSlot)}
    </div>
  );
}
