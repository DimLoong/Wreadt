import type { SkinView } from "./types";
import { CODE_AFTER, CODE_BEFORE, CODE_LINES } from "./filler";
import { SkinToast, StatusStats, WindowControls } from "./SkinParts";
import { useScrollIntoView } from "../../hooks/useScrollIntoView";

const FILES = ["src", "  api", "  components", "  utils", "    format.ts", "    glossary.ts", "    types.ts", "package.json", "README.md"];

function quote(s: string) {
  return JSON.stringify(s);
}

/** 代码编辑器外观：单词是一个常量定义，前后是假的业务代码；反馈像行内提示一样跟在当前行后面 */
export default function CodeSkin(v: SkinView) {
  const [nBefore, nAfter] = CODE_LINES[v.density];
  const before = CODE_BEFORE.slice(0, nBefore);
  const term: [string, string][] = [
    ["", ""],
    ["cm", `// TODO: review term ${v.index + 1}/${v.stats.total}`],
    ["", `export const term: Term = {`],
    ["", `  id: ${v.index + 1},`],
    ...(v.word.lang === "ja" ? [["", `  label: ${quote(v.word.display)},`] as [string, string]] : []),
    ["", `  note: ${quote(v.sub ?? "")},`],
    ["cm", `  // ${v.meaning}`],
  ];
  const top = [...before, ...term];
  const after = CODE_AFTER.slice(0, nAfter);
  const valueLine = top.length + 1;
  const lineRef = useScrollIntoView<HTMLDivElement>(`${v.index}-${Boolean(v.card)}`);

  return (
    <div className="skin skin-code">
      <div className="skin-titlebar skin-code-titlebar">
        <span>glossary.ts — wreadt</span>
        <WindowControls onExit={v.onExit} />
      </div>
      <div className="skin-code-body">
        <aside className="skin-code-side">
          <div className="skin-code-side-title" onClick={v.onMenu}>
            资源管理器
          </div>
          {FILES.map((f) => (
            <div key={f} className={f.includes("glossary") ? "active" : ""}>
              {f.trimStart() === f ? f : <span style={{ paddingLeft: (f.length - f.trimStart().length) * 6 }}>{f.trim()}</span>}
            </div>
          ))}
        </aside>
        <section className="skin-code-main">
          <div className="skin-code-tabs">
            <span className="active">glossary.ts</span>
            <span>format.ts</span>
            <span>types.ts</span>
          </div>
          <div className="skin-code-editor">
            {top.map(([cls, text], i) => (
              <div key={i} className="skin-code-line">
                <span className="ln">{i + 1}</span>
                <span className={cls}>{text}</span>
              </div>
            ))}
            {v.card ? (
              // 造句题像编辑器里的行内对话框一样插在当前位置
              <div ref={lineRef} className="skin-code-inline">
                {v.card}
              </div>
            ) : (
              <div ref={lineRef} className="skin-code-line current">
                <span className="ln">{valueLine}</span>
                <span>{'  value: "'}</span>
                <span className="str">{v.lettersEl}</span>
                <span>{'",'}</span>
                {v.feedback && <span className={`skin-code-ghost ${v.ok ? "ok" : ""}`}>{v.feedback}</span>}
              </div>
            )}
            <div className="skin-code-line">
              <span className="ln">{valueLine + 1}</span>
              <span>{"};"}</span>
            </div>
            {after.map(([cls, text], i) => (
              <div key={i} className="skin-code-line">
                <span className="ln">{valueLine + 2 + i}</span>
                <span className={cls}>{text}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="skin-statusbar skin-code-status">
        <span>main</span>
        <span>
          Ln {valueLine}, Col {v.typed.length + 11}
        </span>
        <StatusStats stats={v.stats} />
        <span className="skin-right skin-hotkeys">{v.hotkeys}</span>
      </div>
      {v.notice && <SkinToast>{v.notice}</SkinToast>}
    </div>
  );
}
