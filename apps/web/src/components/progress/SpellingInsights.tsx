import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Tag } from "tdesign-react";
import type { SpellingPattern, SpellingReport } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { loadSpellingReport, patternPracticeWords, SPELLING_DAYS } from "../../lib/spelling";
import type { FocusPractice } from "../../lib/practiceState";
import type { MessageKey } from "../../i18n/messages";
import SlipHeatmap from "./SlipHeatmap";

/** 可以从词库里找到同类词来出专项练习的难点 */
const PRACTICABLE = new Set<SpellingPattern>(["ie-ei", "double", "tion-sion", "ance-ence", "able-ible", "silent", "vowel"]);

/** 把答案中出错的字母标出来，如 rec[e]ive */
function Example({ answer, pos }: { answer: string; pos: number }) {
  return (
    <span className="spelling-example" lang="en">
      {answer.slice(0, pos)}
      <mark>{answer[pos]}</mark>
      {answer.slice(pos + 1)}
    </span>
  );
}

/** 字母级错误分析：按拼写难点汇总最近按错的地方，每类可一键专项练习 */
export default function SpellingInsights() {
  const { t, settings } = useSettings();
  const navigate = useNavigate();
  const [report, setReport] = useState<SpellingReport | null>(null);
  const [busy, setBusy] = useState<SpellingPattern | null>(null);

  useEffect(() => {
    void loadSpellingReport().then(setReport);
  }, []);

  const practice = async (pattern: SpellingPattern, words: string[]) => {
    setBusy(pattern);
    const list = await patternPracticeWords(pattern, words, settings.dictIds);
    setBusy(null);
    if (!list.length) return;
    const state: FocusPractice = {
      key: `spelling-${pattern}-${crypto.randomUUID()}`,
      title: t("spelling.practiceTitle", { name: t(`spelling.${pattern}` as MessageKey) }),
      words: list,
      mode: "spell",
    };
    navigate("/typing", { state: { practice: state } });
  };

  if (!report) return null;
  if (!report.total) return <p className="muted">{t("spelling.empty")}</p>;

  return (
    <div className="spelling-insights">
      <p className="muted">{t("spelling.summary", { days: SPELLING_DAYS, total: report.total, slips: report.slips, spelling: report.total - report.slips })}</p>
      {report.patterns.map((p) => (
        <div key={p.pattern} className="spelling-row">
          <div className="spelling-head">
            <strong>{t(`spelling.${p.pattern}` as MessageKey)}</strong>
            <Tag size="small" variant="light" theme={p.count >= 5 ? "danger" : "warning"}>
              {t("spelling.times", { count: p.count })}
            </Tag>
            <span className="muted spelling-tip">{t(`spelling.tip.${p.pattern}` as MessageKey)}</span>
          </div>
          <div className="spelling-examples">
            {p.examples.map((e) => (
              <Example key={e.answer} answer={e.answer} pos={e.pos} />
            ))}
            {PRACTICABLE.has(p.pattern) && (
              <Button size="small" variant="outline" loading={busy === p.pattern} onClick={() => void practice(p.pattern, p.words)}>
                {t("spelling.practice")}
              </Button>
            )}
          </div>
        </div>
      ))}
      {report.pairs.length > 0 && (
        <p className="muted spelling-pairs">
          {t("spelling.pairs")}
          {report.pairs.slice(0, 5).map((pair) => (
            <span key={`${pair.expected}${pair.typed}`} className="spelling-pair">
              {pair.expected} → {pair.typed} ×{pair.count}
            </span>
          ))}
        </p>
      )}
      {report.slips > 0 && <SlipHeatmap keys={report.slipKeys} />}
    </div>
  );
}
