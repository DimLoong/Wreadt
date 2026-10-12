import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card } from "tdesign-react";
import type { Example, Phrase, WordItem } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { AiUnavailableError, generateWordExtras } from "../../services/ai";
import { maskWord } from "../../lib/meaning";

interface Props {
  word: WordItem;
  /** 拼写完成前遮住例句与短语中的目标词 */
  masked: boolean;
  onFocusBack?: () => void;
}

/** 短语 / 例句卡片：词库自带的先展示，可用 AI 补充 */
export default function DetailCards({ word, masked, onFocusBack }: Props) {
  const { settings, t } = useSettings();
  const [ai, setAi] = useState<{ examples: Example[]; phrases: Phrase[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 换词时清空
  useEffect(() => {
    setAi(null);
    setError(null);
  }, [word.id]);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      setAi(await generateWordExtras(word.lang, word.lang === "ja" ? word.display : word.answer, settings.locale));
    } catch (err) {
      setError(err instanceof AiUnavailableError ? t("ai.unavailable") : (err as Error).message);
    } finally {
      setBusy(false);
      onFocusBack?.();
    }
  };

  const hide = (s: string) => (masked ? maskWord(s, [word.answer, ...(word.alternatives ?? []), ...(word.lang === "ja" ? [word.display] : [])]) : s);
  const examples = [...(word.examples ?? []), ...(ai?.examples ?? [])];
  const phrases = ai?.phrases ?? [];
  const aiButton = !ai && (
    <Button size="small" variant="text" theme="primary" loading={busy} onClick={() => void load()}>
      {t("typing.aiGenerate")}
    </Button>
  );

  return (
    <div className="detail-cards" onClick={(e) => e.stopPropagation()}>
      <Card title={t("typing.phrases")} bordered size="small" actions={aiButton} className="detail-card">
        {phrases.length ? (
          <ul className="detail-list">
            {phrases.map((p) => (
              <li key={p.phrase}>
                <span className="primary">{hide(p.phrase)}</span>
                <span className="secondary">{p.meaning}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted detail-empty">{error ?? (ai ? t("typing.noneYet") : t("typing.phrasesEmpty"))}</p>
        )}
      </Card>
      <Card title={t("typing.examplesTitle")} bordered size="small" actions={phrases.length ? undefined : aiButton} className="detail-card">
        {examples.length ? (
          <ul className="detail-list">
            {examples.map((ex) => (
              <li key={ex.sentence}>
                <span className="primary" lang={word.lang}>
                  {hide(ex.sentence)}
                </span>
                {ex.translation && <span className="secondary">{ex.translation}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted detail-empty">{error ?? (ai ? t("typing.noneYet") : t("typing.examplesEmpty"))}</p>
        )}
        {!masked && (
          <Link className="detail-link" to={`/sentence?word=${encodeURIComponent(word.answer)}&lang=${word.lang}`}>
            {t("typing.practiceSentence")} →
          </Link>
        )}
      </Card>
    </div>
  );
}
