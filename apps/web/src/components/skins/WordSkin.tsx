import type { SkinView } from "./types";

const TABS = ["文件", "开始", "插入", "设计", "布局", "引用", "邮件", "审阅", "视图"];

/** 文档编辑器外观：单词是正文段落，输入框是光标所在的一行 */
export default function WordSkin(v: SkinView) {
  return (
    <div className="skin skin-word">
      <div className="skin-titlebar">文档1 - 已保存到此电脑</div>
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
          <p>
            {v.index + 1}. <strong>{v.word.display}</strong>
            {v.sub ? `  ${v.sub}` : ""}
          </p>
          <p>{v.meaning}</p>
          <div className="skin-word-line">{v.inputEl}</div>
          <p className="skin-dim">{v.feedback}</p>
        </div>
      </div>
      <div className="skin-statusbar">
        <span>第 1 页，共 1 页</span>
        <span>
          {v.index + 1}/{v.total} 个字
        </span>
        <span>中文(中国)</span>
        <span>{v.accuracy}%</span>
      </div>
    </div>
  );
}
