import { ArrowLeftIcon, ArrowRightIcon } from "tdesign-icons-react";
import type { WordItem } from "@wreadt/core";
import { splitMeaning } from "../../lib/meaning";

interface Props {
  word?: WordItem;
  dir: "left" | "right";
  /** 默写模式下隐藏拼写 */
  masked: boolean;
  /** 认词的词还没做时不给释义，免得提前看到答案 */
  hideMeaning?: boolean;
  onClick: () => void;
}

/** 上一个 / 下一个词的预览，点击切换 */
export default function WordPreview({ word, dir, masked, hideMeaning = false, onClick }: Props) {
  if (!word) return <div className="word-preview empty" />;
  const Icon = dir === "left" ? ArrowLeftIcon : ArrowRightIcon;
  const spelled = masked ? Array.from(word.answer, (c) => (c === " " ? " " : "_")).join(" ") : word.display;
  return (
    <button type="button" className={`word-preview ${dir}`} onClick={onClick} tabIndex={-1}>
      <Icon size="24px" />
      <span className="word-preview-word" lang={word.lang}>
        {word.lang === "ja" ? word.display : spelled}
      </span>
      <span className="word-preview-meanings">
        {(hideMeaning ? [] : word.meanings.slice(0, 3)).map((m) => {
          const { pos, text } = splitMeaning(m);
          return (
            <span key={m} className="row">
              {pos && <span className="pos">{pos}</span>}
              <span>{text}</span>
            </span>
          );
        })}
      </span>
    </button>
  );
}
