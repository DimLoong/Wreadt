import type { SkinView } from "./types";
import { EXCEL_COLUMNS, EXCEL_SIZE, excelRow } from "./filler";
import { SkinToast, StatusStats, WindowControls } from "./SkinParts";
import { useScrollIntoView } from "../../hooks/useScrollIntoView";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** 表格外观：假的项目台账，当前词占一行（B 列释义、C 列音标、D 列为输入），反馈在 E 列 */
export default function ExcelSkin(v: SkinView) {
  const { rows, filled, cols } = EXCEL_SIZE[v.density];
  const row = (v.index % (rows - 2)) + 2;
  const rowRef = useScrollIntoView<HTMLTableRowElement>(row);
  return (
    <div className="skin skin-excel">
      <div className="skin-titlebar">
        <span>项目台账 2026Q4.xlsx</span>
        <WindowControls onExit={v.onExit} />
      </div>
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
      <div className="skin-excel-body">
        <div className="skin-grid-wrap">
          <table className="skin-grid">
            <thead>
              <tr>
                <th />
                {Array.from(LETTERS.slice(0, EXCEL_COLUMNS)).map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }, (_, r) => {
                const n = r + 1;
                let cells = [...(n <= filled + 1 ? excelRow(n, cols) : []), ...Array<string>(EXCEL_COLUMNS).fill("")].slice(0, EXCEL_COLUMNS);
                if (n === row) {
                  cells = [...cells];
                  cells.splice(0, 5, String(v.index + 1), v.meaning, v.word.lang === "ja" ? v.word.display : (v.sub ?? ""), v.typed, v.feedback);
                }
                return (
                  <tr key={n} ref={n === row ? rowRef : undefined}>
                    <th>{n}</th>
                    {cells.map((c, i) => (
                      <td
                        key={i}
                        className={n === row && i === 3 ? `active state-${v.state}` : n === row && i === 4 ? `skin-feedback ${v.ok ? "ok" : ""}` : n === 1 ? "head" : ""}
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* 造句题显示在右侧的批注窗格里 */}
        {v.card && (
          <aside className="skin-excel-pane">
            <div className="skin-excel-pane-title">批注</div>
            {v.card}
          </aside>
        )}
      </div>
      <div className="skin-sheets">
        <span className="active">台账</span>
        <span>汇总</span>
        <span>预算</span>
        <span className="skin-hotkeys">{v.hotkeys}</span>
        <span className="skin-right skin-sheets-stats">
          <StatusStats stats={v.stats} />
        </span>
      </div>
      {v.notice && <SkinToast>{v.notice}</SkinToast>}
    </div>
  );
}
