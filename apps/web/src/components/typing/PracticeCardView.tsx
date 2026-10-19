import { useEffect, useRef, useState, type ComponentRef, type KeyboardEvent } from "react";
import { Textarea } from "tdesign-react";
import { gradeCloze, gradeTranslate, type CardWord, type PracticeCard } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { type CardAnswer } from "../../lib/sentenceCards";

/**
 * 穿插在打字中的造句题，和拼写单词一样就地出现在打字区：
 * 填空直接在句子的空位里输入（只给中文提示，不露出目标词）；中译英在多行输入框里写（Shift+Enter 换行）。
 * Enter 检查，再按 Enter 继续；Esc 跳过。AI 点评在一组结束时统一显示。
 */
interface Props {
  card: PracticeCard;
  words: CardWord[];
  /** 之前的作答：跳回来时直接显示判题结果 */
  initial?: CardAnswer;
  onPrev: () => void;
  /** 完成（answer）或跳过（null），进入后面的单词 */
  onDone: (answer: CardAnswer | null) => void;
}

export default function PracticeCardView({ card, words, initial, onPrev, onDone }: Props) {
  const { t } = useSettings();
  const [input, setInput] = useState(initial?.input ?? "");
  const [submitted, setSubmitted] = useState(Boolean(initial));
  const blankRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<ComponentRef<typeof Textarea>>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initial) stageRef.current?.focus();
    else if (card.kind === "cloze") blankRef.current?.focus();
    else textareaRef.current?.textareaElement?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在出现时聚焦
  }, []);

  const cloze = card.kind === "cloze" ? gradeCloze(card, input) : null;
  const translate = card.kind === "translate" ? gradeTranslate(card, input) : null;
  const ok = cloze ? cloze.correct : Boolean(translate?.ok);

  const finish = () => onDone({ card, input: input.trim().replace(/\s+/g, " "), ok });

  // 多行输入框里 ↑ / ↓ 用来移动光标，只有光标在开头 / 结尾时才跳到上一个 / 下一个
  const atEdge = (e: KeyboardEvent<HTMLElement>, end: boolean) => {
    const el = e.target as HTMLTextAreaElement;
    if (submitted || el.tagName !== "TEXTAREA") return true;
    return end ? el.selectionStart === el.value.length : el.selectionEnd === 0;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      if (submitted) finish();
      else onDone(null);
    } else if (e.key === "ArrowUp" && atEdge(e, false)) {
      e.preventDefault();
      onPrev();
    } else if (e.key === "ArrowDown" && atEdge(e, true)) {
      e.preventDefault();
      if (submitted) finish();
      else onDone(null);
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (submitted) finish();
      else if (input.trim()) {
        setSubmitted(true);
        // 判题后空位可能换成答案，焦点交给外层，Enter 继续仍然有效
        stageRef.current?.focus();
      }
    }
  };

  const meaningOf = (w: string) => words.find((x) => x.word === w)?.meaning;
  const [before, after] = (card.sentence ?? "").split("___");
  const answer = card.answer ?? "";

  return (
    <div ref={stageRef} tabIndex={-1} onKeyDown={onKeyDown} className={`main-word practice-stage ${submitted ? (ok ? "is-ok" : "is-bad") : ""}`}>
      <div className="practice-kind muted">
        {t(card.kind === "cloze" ? "cards.cloze" : "cards.translate")} · {t(card.kind === "cloze" ? "cards.clozeTip" : "cards.translateTip")}
      </div>

      {card.kind === "cloze" ? (
        <>
          <p className="practice-sentence" lang="en">
            {before}
            {submitted && !cloze?.exact ? (
              <span className="practice-blank-result">
                {input.trim() && <s>{input.trim()}</s>}
                <b>{answer}</b>
              </span>
            ) : (
              <input
                ref={blankRef}
                className="practice-blank"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                readOnly={submitted}
                style={{ width: `${Math.max(answer.length, input.length, 4) + 1}ch` }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                aria-label={t("cards.clozePlaceholder")}
              />
            )}
            {after}
          </p>
          {card.translation && <p className="meaning-row practice-hint">{card.translation}</p>}
        </>
      ) : (
        <>
          <p className="practice-sentence">{card.zh}</p>
          <div className="practice-words">
            {card.words.map((w) => (
              <span key={w} className={`practice-word ${submitted ? (translate?.used[w] ? "used" : "missing") : ""}`}>
                <b lang="en">{w}</b>
                {meaningOf(w) && <span className="muted"> {meaningOf(w)}</span>}
              </span>
            ))}
          </div>
          <Textarea
            ref={textareaRef}
            className="practice-textarea"
            value={input}
            onChange={(v) => setInput(String(v))}
            readonly={submitted}
            autosize={{ minRows: 2, maxRows: 6 }}
            placeholder={t("cards.translatePlaceholder")}
            spellCheck={false}
          />
          {submitted && translate && (
            <div className="practice-reference">
              <span className="muted">{t("cards.reference")}</span>
              <span lang="en">{card.reference}</span>
            </div>
          )}
        </>
      )}

      <div className="typing-feedback" aria-live="polite">
        {submitted ? (
          <>
            <span className={ok ? "ok" : "hint"}>
              {cloze
                ? cloze.correct
                  ? cloze.exact
                    ? t("cards.correct")
                    : t("cards.formHint", { answer })
                  : t("cards.wrong", { answer })
                : translate?.ok
                  ? t("cards.translateOk")
                  : t("cards.translateMissing")}
            </span>
            <button type="button" className="skip-btn" onClick={finish}>
              {t("cards.continue")} ↵
            </button>
          </>
        ) : (
          <>
            <span className="muted">{t(card.kind === "cloze" ? "cards.clozeKeys" : "cards.translateKeys")}</span>
            <button type="button" className="skip-btn" onClick={() => onDone(null)}>
              {t("cards.skip")} Esc
            </button>
          </>
        )}
      </div>
    </div>
  );
}
