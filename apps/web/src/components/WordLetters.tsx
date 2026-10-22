interface Props {
  answer: string;
  /** 已正确输入的前缀 */
  typed: string;
  /** 刚按错的字符，显示在下一个位置 */
  wrongChar: string | null;
  /** 手滑按下的字符（宽容模式）：黄色显示在下一个位置，补打正确字母即可继续 */
  slipChar?: string | null;
  /** 默写模式下未输入的字母显示为下划线 */
  hidden: boolean;
  /** 逐步提示时露出的前缀长度 */
  revealed: number;
  /** 已输入的空格显示为真正的空格（伪装皮肤里不显示 ␣，像正常打字一样） */
  plainSpace?: boolean;
}

/** 空格、短横线、撇号等非字母字符：默写时也直接显示（仍需输入），帮助判断词的结构 */
const isMark = (ch: string) => !/[\p{L}\p{N}]/u.test(ch);
const show = (ch: string) => (ch === " " ? "␣" : ch);

/** 逐字母渲染单词：正确为绿色，按错的位置为红色，未输入的字母按模式显示原字母或下划线 */
export default function WordLetters({ answer, typed, wrongChar, slipChar = null, hidden, revealed, plainSpace = false }: Props) {
  return (
    <span className={`letters ${wrongChar ? "shake" : ""}`} aria-label={hidden ? "" : answer}>
      {Array.from(answer).map((ch, i) => {
        const mark = isMark(ch) ? " mark" : "";
        if (i < typed.length) return <span key={i} className={`ok${mark}`}>{plainSpace && ch === " " ? "\u00a0" : show(ch)}</span>;
        if (i === typed.length && wrongChar) return <span key={i} className="bad">{show(wrongChar)}</span>;
        if (i === typed.length && slipChar) return <span key={i} className="slip">{show(slipChar)}</span>;
        // 下一个要输入的位置带光标
        const caret = i === typed.length ? " caret" : "";
        if (mark) return <span key={i} className={`mark${caret}`}>{show(ch)}</span>;
        if (!hidden) return <span key={i} className={caret.trim() || undefined}>{ch}</span>;
        if (i < revealed) return <span key={i} className={`revealed${caret}`}>{ch}</span>;
        return <span key={i} className={`blank${caret}`}>_</span>;
      })}
    </span>
  );
}
