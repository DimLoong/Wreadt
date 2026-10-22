import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, Loading } from "tdesign-react";
import type { Example, Phrase, WordItem } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { aiSource, generateWordExtras } from "../../services/ai";

/** 停留这么久才开始请求，快速跳词时不为每个词发请求 */
const FETCH_DELAY_MS = 300;

type Extras = { status: "idle" | "loading" | "noAi" | "error"; message?: string } | { status: "ready"; examples: Example[]; phrases: Phrase[] };

interface Props {
  word: WordItem;
  /** 拼写正确后才显示；内容在打开单词时就开始后台获取 */
  visible: boolean;
}

/** 短语 / 例句卡片：词库自带例句 + AI 自动生成的短语与例句 */
export default function DetailCards({ word, visible }: Props) {
  const { settings, t } = useSettings();
  const [extras, setExtras] = useState<Extras>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!(await aiSource())) {
        if (!cancelled) setExtras({ status: "noAi" });
        return;
      }
      if (!cancelled) setExtras({ status: "loading" });
      try {
        const result = await generateWordExtras(word.lang, word.lang === "ja" ? word.display : word.answer, settings.locale);
        if (!cancelled) setExtras({ status: "ready", ...result });
      } catch (err) {
        if (!cancelled) setExtras({ status: "error", message: (err as Error).message });
      }
    }, FETCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [word.id, word.lang, word.display, word.answer, settings.locale]);

  const examples = [...(word.examples ?? []), ...(extras.status === "ready" ? extras.examples : [])];
  const phrases = extras.status === "ready" ? extras.phrases : [];

  const placeholder =
    extras.status === "loading" || extras.status === "idle" ? (
      <Loading size="small" />
    ) : extras.status === "noAi" ? (
      <p className="muted detail-empty">
        {t("typing.extrasNoAi")} <Link to="/settings?tab=ai">{t("ai.configure")} →</Link>
      </p>
    ) : (
      <p className="muted detail-empty">{extras.status === "error" ? extras.message : t("typing.noneYet")}</p>
    );

  return (
    // 始终占位、拼写正确后淡入：布局不跳动；内容在打开单词时就在后台准备好
    <div className={`detail-cards ${visible ? "shown" : ""}`} aria-hidden={!visible} inert={!visible} onClick={(e) => e.stopPropagation()}>
      <Card title={t("typing.phrases")} bordered={false} size="small" className="detail-card">
        <div className="detail-scroll">
          {phrases.length ? (
            <ul className="detail-list">
              {phrases.map((p) => (
                <li key={p.phrase}>
                  <span className="primary">{p.phrase}</span>
                  <span className="secondary">{p.meaning}</span>
                </li>
              ))}
            </ul>
          ) : (
            placeholder
          )}
        </div>
      </Card>
      <Card title={t("typing.examplesTitle")} bordered={false} size="small" className="detail-card" actions={<Link to={`/sentence?word=${encodeURIComponent(word.answer)}&lang=${word.lang}`}>{t("typing.practiceSentence")} →</Link>}>
        <div className="detail-scroll">
          {examples.length ? (
            <ul className="detail-list">
              {examples.map((ex) => (
                <li key={ex.sentence}>
                  <span className="primary" lang={word.lang}>
                    {ex.sentence}
                  </span>
                  {ex.translation && <span className="secondary">{ex.translation}</span>}
                </li>
              ))}
            </ul>
          ) : (
            placeholder
          )}
        </div>
      </Card>
    </div>
  );
}
