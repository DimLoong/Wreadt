import { Fragment, type FormEvent, type KeyboardEvent, type Ref } from "react";
import { revealCount, type ChunkSpelling } from "../../hooks/useChunkSpelling";

/** 句子按段拼写的输入与渲染：要打的段显示为一条与单词等长的横线，打的字母写在横线上 */

/**
 * 接收键盘输入的隐藏输入框（和拼单词时一样）：Tab 按住看答案、退格、Enter、字符；
 * onKey 先处理页面自己的快捷键（返回 true 表示已处理）
 */
export function ChunkCapture({ s, inputRef, onKey, label }: { s: ChunkSpelling; inputRef: Ref<HTMLInputElement>; onKey?: (e: KeyboardEvent<HTMLInputElement>) => boolean; label: string }) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.key === "Process") return;
    if (onKey?.(e)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Tab") {
      e.preventDefault();
      if (!s.done) s.setPeeking(true);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      s.backspace();
    } else if (e.key === "Enter") {
      e.preventDefault();
      s.enter();
    } else if (e.key.length === 1) {
      e.preventDefault();
      s.press(e.key);
    }
  };
  // 移动端软键盘的 keydown 常拿不到字符，从 input 事件兜底
  const onInput = (e: FormEvent<HTMLInputElement>) => {
    const data = (e.nativeEvent as InputEvent).data ?? "";
    e.currentTarget.value = "";
    for (const ch of data) s.press(ch);
  };
  return (
    <input
      ref={inputRef}
      className="typing-capture"
      onKeyDown={onKeyDown}
      onKeyUp={(e) => e.key === "Tab" && s.setPeeking(false)}
      onInput={onInput}
      onBlur={() => s.setPeeking(false)}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      aria-label={label}
    />
  );
}

/** 渲染按段拼写的句子：每个单词一条横线，长度就是单词长度 */
export function ChunkRow({ s, className = "" }: { s: ChunkSpelling; className?: string }) {
  return (
    <div className={`word-letters-row sentence-row word-enter ${className}`} lang="en">
      {s.chunks.map((c, i) => {
        if (c.given) return <span key={i} className="sentence-given">{c.text}</span>;
        const k = s.order.indexOf(i);
        const state = k < s.pos ? "ok" : k === s.pos ? "current" : "todo";
        const shown = s.peeking ? c.text.length : revealCount(s.misses[i] ?? 0, c.text.length);
        const punct = c.trail.trimEnd();
        let content;
        if (state === "current" && s.wrong !== null) {
          content = (
            <span className="chunk-slot bad shake" style={{ minWidth: `${c.text.length}ch` }}>
              {"\u200b"}
              {s.wrong}
            </span>
          );
        } else {
          // 短语段（如 looking forward to）每个词一条横线
          let offset = 0;
          content = c.text.split(" ").map((part, j) => {
            const from = offset;
            offset += part.length + 1;
            const typed = state === "ok" ? part : state === "current" ? s.buf.slice(from, from + part.length) : "";
            const hint = c.text.slice(from + typed.length, Math.max(from + typed.length, Math.min(from + part.length, shown)));
            return (
              <Fragment key={j}>
                {j > 0 && " "}
                <span className={`chunk-slot ${state} ${state === "current" && s.buf.length >= from && s.buf.length <= from + part.length ? "active" : ""}`} style={{ minWidth: `${part.length}ch` }}>
                  {"\u200b"}
                  {typed}
                  {hint && <span className="chunk-hint">{hint}</span>}
                </span>
              </Fragment>
            );
          });
        }
        return (
          <span key={i}>
            <span className={`sentence-chunk ${c.target ? "target" : ""}`}>
              {c.lead}
              {content}
              {punct}
            </span>
            {c.trail.endsWith(" ") && " "}
          </span>
        );
      })}
    </div>
  );
}
