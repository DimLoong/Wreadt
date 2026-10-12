interface Props {
  answer: string;
  /** 已正确输入的前缀 */
  typed: string;
  /** 刚按错的字符，显示在下一个位置 */
  wrongChar: string | null;
  /** 默写模式下未输入的字母显示为下划线 */
  hidden: boolean;
  /** 逐步提示时露出的前缀长度 */
  revealed: number;
}

/** 逐字母渲染单词：正确为绿色，按错的位置为红色，未输入的字母按模式显示原字母或下划线 */
export default function WordLetters({ answer, typed, wrongChar, hidden, revealed }: Props) {
  return (
    <span className={`letters ${wrongChar ? "shake" : ""}`} aria-label={hidden ? "" : answer}>
      {Array.from(answer).map((ch, i) => {
        const isSpace = ch === " ";
        if (i < typed.length) return <span key={i} className="ok">{isSpace ? "␣" : ch}</span>;
        if (i === typed.length && wrongChar) return <span key={i} className="bad">{wrongChar === " " ? "␣" : wrongChar}</span>;
        if (isSpace) return <span key={i} className="space">␣</span>;
        if (!hidden) return <span key={i}>{ch}</span>;
        if (i < revealed) return <span key={i} className="revealed">{ch}</span>;
        return <span key={i} className="blank">_</span>;
      })}
    </span>
  );
}
