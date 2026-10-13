import { useState } from "react";
import { Button, Card, Tag } from "tdesign-react";
import type { WordTip } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { speakSentence } from "../../services/speech";
import { Highlight } from "./FeedCard";
import type { MessageKey } from "../../i18n/messages";

const KIND_THEME = { collocation: "primary", confusable: "warning", origin: "success", usage: "default" } as const;

/** 词汇小知识：每条一张小卡片，例句可发音、可看翻译 */
export default function TipsList({ tips }: { tips: WordTip[] }) {
  const { t, settings } = useSettings();
  const [shown, setShown] = useState<Set<number>>(new Set());
  return (
    <div className="tips-list">
      {tips.map((tip, i) => (
        <Card key={`${tip.word}-${i}`} bordered className="tip-card">
          <div className="tip-head">
            <Tag size="small" variant="light" theme={KIND_THEME[tip.kind]}>
              {t(`feed.tip.${tip.kind}` as MessageKey)}
            </Tag>
            <strong lang="en">{tip.word}</strong>
          </div>
          {tip.title && <div className="tip-title">{tip.title}</div>}
          <p className="tip-body">{tip.tip}</p>
          {tip.example && (
            <div className="tip-example">
              <button type="button" lang="en" onClick={() => void speakSentence(tip.example, { accent: settings.accent, voice: settings.sentenceVoice })} title={t("feed.tip.listen")}>
                <Highlight text={tip.example} words={[tip.word]} />
              </button>
              <Button
                size="small"
                variant="text"
                onClick={() =>
                  setShown((s) => {
                    const next = new Set(s);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  })
                }
              >
                {t("feed.translate")}
              </Button>
            </div>
          )}
          {shown.has(i) && <p className="muted feed-trans">{tip.exampleTrans}</p>}
        </Card>
      ))}
    </div>
  );
}
