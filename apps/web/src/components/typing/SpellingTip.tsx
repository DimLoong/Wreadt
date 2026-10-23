import { useEffect, useState } from "react";
import { ghostSpelling, type Mistake, type SpellingPattern } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import type { MessageKey } from "../../i18n/messages";
import { spellingTipFor } from "../../lib/spellingTips";

/**
 * 拼完后讲解这次发音相近的拼错：你的拼法 → 正确拼法（错处标出），加一句为什么容易错、怎么记。
 * 先显示内置的规律说明，有 AI 时换成针对这个词的讲解。
 */
export default function SpellingTip({ answer, mistake }: { answer: string; mistake: Mistake & { pattern: SpellingPattern } }) {
  const { t, settings } = useSettings();
  const ghost = ghostSpelling(answer, mistake);
  const [ai, setAi] = useState<{ key: string; tip: string } | null>(null);
  const key = `${answer}|${ghost?.text}`;

  useEffect(() => {
    if (!ghost) return;
    let cancelled = false;
    // 出错位置前后各取几个字母，告诉 AI 错在哪里（如 ali → ale）
    const from = Math.max(0, ghost.from - 2);
    const at = `${answer.slice(from, ghost.to + 1 + (answer.length - ghost.text.length))} → ${ghost.text.slice(from, ghost.to + 1)}`;
    void spellingTipFor(answer, ghost.text, at, mistake.pattern, settings.locale).then((tip) => !cancelled && tip && setAi({ key, tip }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在这次的错法变化时请求
  }, [key, settings.locale]);

  if (!ghost) return null;
  const tip = ai?.key === key ? ai.tip : t(`spelling.tip.${mistake.pattern}` as MessageKey);
  return (
    <div className="spelling-tip">
      <span className="spelling-tip-words" lang="en">
        <span>
          {ghost.text.slice(0, ghost.from)}
          <s>{ghost.text.slice(ghost.from, ghost.to)}</s>
          {ghost.text.slice(ghost.to)}
        </span>
        <span className="arrow">→</span>
        <b>{answer}</b>
      </span>
      <span className="spelling-tip-kind">{t(`spelling.${mistake.pattern}` as MessageKey)}</span>
      <span className="spelling-tip-text">{tip}</span>
    </div>
  );
}
