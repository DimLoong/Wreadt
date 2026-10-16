import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button, Input, Tag, type InputRef } from "tdesign-react";
import { gradeCloze, gradeTranslate, type CardWord, type PracticeCard } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { cardReference, type CardAnswer } from "../../lib/sentenceCards";
import DiffView from "../DiffView";

/**
 * 穿插在打字中的造句卡：填空（只给中文提示，不露出目标词）或中译英（必须用上列出的词）。
 * 提交后本地立即判题，Enter 继续；Esc 跳过。AI 点评在一组结束时统一显示。
 */
export default function PracticeCardView({ card, words, onDone }: { card: PracticeCard; words: CardWord[]; onDone: (answer: CardAnswer | null) => void }) {
  const { t } = useSettings();
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const cloze = card.kind === "cloze" ? gradeCloze(card, input) : null;
  const translate = card.kind === "translate" ? gradeTranslate(card, input) : null;
  const ok = cloze ? cloze.correct : Boolean(translate?.ok);

  const submit = () => {
    if (!input.trim()) return;
    setSubmitted(true);
  };
  const finish = () => onDone({ card, input: input.trim(), ok });

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onDone(null);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (submitted) finish();
      else submit();
    }
  };

  const meaningOf = (w: string) => words.find((x) => x.word === w)?.meaning;

  return (
    <section className="practice-card">
      <div className="practice-card-head">
        <Tag theme="primary" variant="light">
          {t(card.kind === "cloze" ? "cards.cloze" : "cards.translate")}
        </Tag>
        <span className="muted">{t(card.kind === "cloze" ? "cards.clozeTip" : "cards.translateTip")}</span>
      </div>

      {card.kind === "cloze" ? (
        <>
          <p className="practice-card-sentence" lang="en">
            {card.sentence}
          </p>
          {card.translation && <p className="muted practice-card-hint">{card.translation}</p>}
        </>
      ) : (
        <>
          <p className="practice-card-sentence">{card.zh}</p>
          <div className="word-chips">
            {card.words.map((w) => (
              <Tag key={w} variant={submitted ? "light" : "outline"} theme={submitted ? (translate?.used[w] ? "success" : "danger") : "default"} title={meaningOf(w)}>
                {w}
                {meaningOf(w) ? <span className="muted"> {meaningOf(w)}</span> : null}
              </Tag>
            ))}
          </div>
        </>
      )}

      <Input
        ref={inputRef}
        size="large"
        value={input}
        onChange={(v) => setInput(String(v))}
        onKeydown={(_, { e }) => onKeyDown(e as KeyboardEvent<HTMLInputElement>)}
        readonly={submitted}
        placeholder={t(card.kind === "cloze" ? "cards.clozePlaceholder" : "cards.translatePlaceholder")}
        className="practice-card-input"
        autocomplete="off"
        spellCheck={false}
      />

      {submitted && (
        <div className={`practice-card-result ${ok ? "ok" : "bad"}`}>
          {cloze && (
            <p>
              {cloze.correct ? (cloze.exact ? t("cards.correct") : t("cards.formHint", { answer: card.answer ?? "" })) : t("cards.wrong", { answer: card.answer ?? "" })}
              <span className="muted practice-card-full" lang="en">
                {cardReference(card)}
              </span>
            </p>
          )}
          {translate && (
            <>
              <p>{translate.ok ? t("cards.translateOk") : t("cards.translateMissing")}</p>
              <div className="muted">{t("cards.reference")}</div>
              <DiffView diff={translate.diff} />
            </>
          )}
          <p className="muted practice-card-note">{t("cards.reviewLater")}</p>
        </div>
      )}

      <div className="practice-card-actions">
        <Button variant="text" onClick={() => onDone(null)}>
          {t("cards.skip")} Esc
        </Button>
        {submitted ? (
          <Button theme="primary" onClick={finish}>
            {t("cards.continue")} ↵
          </Button>
        ) : (
          <Button theme="primary" disabled={!input.trim()} onClick={submit}>
            {t("dictation.check")} ↵
          </Button>
        )}
      </div>
    </section>
  );
}
