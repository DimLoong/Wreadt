import type { SkinView } from "./types";

const COLS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const ROWS = 24;

/** 表格外观：当前词在 B 列，释义在 C 列，输入框是编辑栏 */
export default function ExcelSkin(v: SkinView) {
  const row = (v.index % (ROWS - 2)) + 2;
  return (
    <div className="skin skin-excel">
      <div className="skin-titlebar">工作簿1</div>
      <div className="skin-ribbon">
        {["文件", "开始", "插入", "页面布局", "公式", "数据", "审阅", "视图"].map((tab, i) => (
          <button key={tab} type="button" className={i === 1 ? "active" : ""} onClick={i === 0 ? v.onMenu : undefined}>
            {tab}
          </button>
        ))}
      </div>
      <div className="skin-formula">
        <span className="skin-cellref">D{row}</span>
        <span className="skin-fx">fx</span>
        <span className="skin-formula-value">{v.lettersEl}</span>
      </div>
      <div className="skin-grid-wrap">
        <table className="skin-grid">
          <thead>
            <tr>
              <th />
              {COLS.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, r) => {
              const n = r + 1;
              const cells: string[] = Array(COLS.length).fill("");
              if (n === 1) cells.splice(0, 4, "序号", "说明", "备注", "内容");
              if (n === row) cells.splice(0, 4, String(v.index + 1), v.meaning, v.word.lang === "ja" ? v.word.display : v.sub ?? "", v.typed);
              return (
                <tr key={n}>
                  <th>{n}</th>
                  {cells.map((c, i) => (
                    <td key={i} className={n === row && i === 3 ? `active state-${v.state}` : n === 1 ? "head" : ""}>
                      {c}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="skin-sheets">
        <span className="active">Sheet1</span>
        <span>Sheet2</span>
        <span className="skin-dim">{v.feedback}</span>
        <span className="skin-right">
          {v.index + 1}/{v.total} · {v.accuracy}%
        </span>
      </div>
    </div>
  );
}
