import { useEffect, useState } from "react";
import type { WordItem, WordPart } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { wordPartsFor } from "../../lib/wordParts";

/** 构词：un- 不 · believ 相信 · -able 能…的。拼完后与短语、例句一起出现；没有可拆的词时这一行留空（占位不变） */
export default function WordParts({ word, visible }: { word: WordItem; /** 拼完时再取一次：组开始时的批量生成可能还没返回 */ visible: boolean }) {
  const { t } = useSettings();
  const [parts, setParts] = useState<{ id: string; parts: WordPart[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void wordPartsFor(word).then((p) => !cancelled && setParts({ id: word.id, parts: p }));
    return () => {
      cancelled = true;
    };
  }, [word, visible]);
  const list = parts?.id === word.id ? parts.parts : [];
  return (
    <div className="word-parts">
      {list.length > 0 && (
        <>
          <span className="word-parts-label">{t("typing.wordParts")}</span>
          {list.map((p, i) => (
            <span key={i} className={`word-part ${p.type}`}>
              <b lang="en">{p.type === "prefix" ? `${p.text}-` : p.type === "suffix" ? `-${p.text}` : p.text}</b>
              <span>{p.meaning}</span>
            </span>
          ))}
        </>
      )}
    </div>
  );
}
