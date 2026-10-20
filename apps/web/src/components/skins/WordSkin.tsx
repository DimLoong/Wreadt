import type { SkinView } from "./types";
import { DOC_PARAGRAPHS, WORD_PARAS } from "./filler";
import { SkinToast, StatusStats, WindowControls } from "./SkinParts";
import { useScrollIntoView } from "../../hooks/useScrollIntoView";

const TABS = ["文件", "开始", "插入", "设计", "布局", "引用", "邮件", "审阅", "视图"];

/** 文档编辑器外观：单词是正文中的一条，前后是假的会议纪要段落 */
export default function WordSkin(v: SkinView) {
  const [before, after] = WORD_PARAS[v.density];
  const itemRef = useScrollIntoView<HTMLDivElement>(`${v.index}-${Boolean(v.card)}`);
  return (
    <div className="skin skin-word">
      <div className="skin-titlebar">
        <span>会议纪要（草稿） - 已保存到此电脑</span>
        <WindowControls onExit={v.onExit} />
      </div>
      <div className="skin-ribbon">
        {TABS.map((tab, i) => (
          <button key={tab} type="button" className={i === 1 ? "active" : ""} onClick={i === 0 ? v.onMenu : undefined}>
            {tab}
          </button>
        ))}
      </div>
      <div className="skin-ribbon-tools">
        <span>宋体</span>
        <span>五号</span>
        <b>B</b>
        <i>I</i>
        <u>U</u>
        <span className="sep" />
        <span>正文</span>
        <span>标题 1</span>
        <span>标题 2</span>
      </div>
      <div className="skin-word-canvas">
        <div className="skin-word-page">
          <h3>会议纪要（草稿）</h3>
          {DOC_PARAGRAPHS.slice(0, before).map((p) => (
            <p key={p}>{p}</p>
          ))}
          <div ref={itemRef} className="skin-word-item">
            {v.card ?? (
              <>
                <p>
                  {v.index + 1}. {v.word.lang === "ja" && <strong>{v.word.display} </strong>}
                  {v.sub ?? ""}
                  <span className="skin-word-meaning">{v.meaning}</span>
                </p>
                <div className="skin-word-line">{v.lettersEl}</div>
                <p className={`skin-feedback ${v.ok ? "ok" : ""}`}>{v.feedback}</p>
              </>
            )}
          </div>
          {DOC_PARAGRAPHS.slice(before, before + after).map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </div>
      <div className="skin-statusbar">
        <span>
          第 {Math.min(v.stats.current + 1, v.stats.total)} 页，共 {v.stats.total} 页
        </span>
        <span>{v.stats.keystrokes} 个字</span>
        <StatusStats stats={v.stats} />
        <span className="skin-right skin-hotkeys">{v.hotkeys}</span>
      </div>
      {v.notice && <SkinToast>{v.notice}</SkinToast>}
    </div>
  );
}
