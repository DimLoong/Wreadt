import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Alert, Button, Radio, Select, Tag } from "tdesign-react";
import { useLiveQuery } from "dexie-react-hooks";
import type { ScenarioLevel } from "@wreadt/core";
import { useSettings } from "../context/settings";
import { db, type PracticeRow } from "../store/db";
import { lookupIndex } from "../store/dicts";
import { AiUnavailableError, generateScenario, type TargetWord } from "../services/ai";
import { clearScenario, prefetchScenario, takeScenario, type ScenarioArgs } from "../services/scenarioPrefetch";
import { defaultRole, GENERAL_ROLE, ROLES, roleText } from "../lib/roles";
import { pickTargetWords } from "../lib/practiceWords";
import { saveNewPractice } from "../lib/practice";
import PracticeTabs from "../components/PracticeTabs";
import ScenarioWorkspace, { TAG_THEME } from "../components/scenario/ScenarioWorkspace";
import type { MessageKey } from "../i18n/messages";

const NEXT_KEY = "scenario-next";
const LEVELS: ScenarioLevel[] = ["simple", "medium", "professional"];

export default function ScenarioPage() {
  const { t, settings, update } = useSettings();
  const location = useLocation();
  const [role, setRole] = useState(() => defaultRole(settings.dictIds));
  const level = settings.scenarioLevel;
  const [targets, setTargets] = useState<TargetWord[]>([]);
  const [current, setCurrent] = useState<PracticeRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | "unavailable" | null>(null);
  const history = useLiveQuery(() => db.practices.orderBy("createdAt").reverse().limit(10).toArray(), []);

  useEffect(() => {
    const fromMarks = (location.state as { targets?: TargetWord[] } | null)?.targets;
    if (fromMarks?.length) {
      setTargets(fromMarks);
      return;
    }
    let cancelled = false;
    Promise.all([db.cards.toArray(), lookupIndex("en"), db.marks.toArray()]).then(([cards, index, marks]) => {
      if (cancelled) return;
      // mark 的英文词最优先（最多 4 个），再按今日 / 易错 / 已学补充
      const marked = marks
        .filter((m) => !m.deleted && m.word.lang === "en")
        .slice(0, 4)
        .map((m) => ({ word: m.word.answer, meaning: m.word.meanings.join("；"), tag: "marked" as const }));
      const rest = pickTargetWords(cards, index).filter((w) => !marked.some((m) => m.word === w.word));
      setTargets([...marked, ...rest]);
    });
    return () => {
      cancelled = true;
    };
  }, [location.state]);

  const args = (): ScenarioArgs => ({
    role,
    roleText: roleText(role, t("scenario.general")),
    // 简单题少用几个目标词
    targets: level === "simple" ? targets.slice(0, 5) : targets,
    locale: settings.locale,
    level,
    avoid: (history ?? []).map((h) => h.scenario.title).filter(Boolean),
  });

  const newQuestion = async () => {
    const a = args();
    // 优先使用后台预生成的题（参数一致时）
    const ready = takeScenario(NEXT_KEY, a);
    clearScenario(NEXT_KEY);
    setBusy(true);
    setError(null);
    try {
      const s = await (ready ?? generateScenario(a.roleText, a.targets, a.locale, a.level, a.avoid));
      setCurrent(await saveNewPractice(s, role));
    } catch (err) {
      setError(err instanceof AiUnavailableError ? "unavailable" : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // 当前题出来后，后台预生成下一题，“换一道题”几乎即时
  useEffect(() => {
    if (!current) return;
    void prefetchScenario(NEXT_KEY, args());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 依赖由 args() 的输入决定
  }, [current?.id, role, level, targets, settings.locale]);

  return (
    <main className="page scenario-page">
      <PracticeTabs />
      <p className="muted">{t("scenario.desc")}</p>

      <section className="panel settings-list">
        <div className="setting-row">
          <span>{t("scenario.role")}</span>
          <Select value={role} onChange={(v) => setRole(String(v))} style={{ width: 200 }}>
            {ROLES.map((r) => (
              <Select.Option key={r.id} value={r.id} label={r.name} />
            ))}
            <Select.Option value={GENERAL_ROLE} label={t("scenario.general")} />
          </Select>
        </div>
        <div className="setting-row">
          <span>{t("scenario.level")}</span>
          <Radio.Group variant="default-filled" value={level} onChange={(v) => void update("scenarioLevel", v as ScenarioLevel)}>
            {LEVELS.map((l) => (
              <Radio.Button key={l} value={l}>
                {t(`scenario.level.${l}` as MessageKey)}
              </Radio.Button>
            ))}
          </Radio.Group>
        </div>
        <p className="muted setting-tip">{t(`scenario.levelTip.${level}` as MessageKey)}</p>
        <div>
          <div className="muted setting-tip">{t("scenario.targets")}</div>
          <div className="word-chips">
            {targets.map((w) => (
              <Tag key={w.word} theme={TAG_THEME[w.tag]} variant="light" closable onClose={() => setTargets(targets.filter((x) => x !== w))} title={w.meaning}>
                {w.word}
              </Tag>
            ))}
            {targets.length === 0 && <span className="muted">{t("scenario.noTargets")}</span>}
          </div>
        </div>
        {busy && <p className="muted">{t("scenario.preparing")}</p>}
        <Button theme="primary" loading={busy} onClick={() => void newQuestion()}>
          {current ? t("scenario.next") : t("scenario.generate")}
        </Button>
        {error === "unavailable" && (
          <Alert
            theme="info"
            message={t("ai.unavailable")}
            operation={
              <span className="alert-links">
                <Link to="/settings">{t("ai.configure")} →</Link>
                <Link to="/account">{t("ai.login")} →</Link>
              </span>
            }
          />
        )}
        {error && error !== "unavailable" && <Alert theme="error" message={error} />}
      </section>

      {current && <ScenarioWorkspace key={current.id} row={current} onChange={setCurrent} />}

      {history && history.some((h) => h.review) && (
        <section className="panel">
          <h2>{t("scenario.history")}</h2>
          <ul className="history">
            {history
              .filter((h) => h.review)
              .map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrent(h);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <span>{h.scenario.title}</span>
                    <span className="muted">
                      {new Date(h.createdAt).toLocaleDateString(settings.locale)} · {h.review!.score}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}
    </main>
  );
}
