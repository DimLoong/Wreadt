import type { SkinView } from "./types";

const FILES = ["src", "  api", "  components", "  utils", "    format.ts", "    glossary.ts", "package.json", "README.md"];

function quote(s: string) {
  return JSON.stringify(s);
}

/** 代码编辑器外观：单词是常量定义，输入框是正在编辑的一行 */
export default function CodeSkin(v: SkinView) {
  const lines: [string, string][] = [
    ["kw", "import type { Term } from \"./types\";"],
    ["", ""],
    ["cm", `// TODO: review term ${v.index + 1}/${v.total}`],
    ["", `export const term: Term = {`],
    ["", `  id: ${v.index + 1},`],
    ...(v.word.lang === "ja" ? [["", `  label: ${quote(v.word.display)},`] as [string, string]] : []),
    ["", `  note: ${quote(v.sub ?? "")},`],
    ["cm", `  // ${v.meaning}`],
  ];
  return (
    <div className="skin skin-code">
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
        </div>
        <div className="skin-code-editor">
          {lines.map(([cls, text], i) => (
            <div key={i} className="skin-code-line">
              <span className="ln">{i + 1}</span>
              <span className={cls}>{text}</span>
            </div>
          ))}
          <div className="skin-code-line">
            <span className="ln">{lines.length + 1}</span>
            <span>{"  value: \""}</span>
            <span className="str">{v.lettersEl}</span>
            <span>{"\","}</span>
          </div>
          <div className="skin-code-line">
            <span className="ln">{lines.length + 2}</span>
            <span>{"};"}</span>
          </div>
        </div>
        <div className="skin-statusbar skin-code-status">
          <span>main</span>
          <span>{v.feedback || "TypeScript"}</span>
          <span className="skin-right">
            Ln {lines.length + 1}, Col {v.typed.length + 11} · {v.accuracy}%
          </span>
        </div>
      </section>
    </div>
  );
}
