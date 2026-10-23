import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loading } from "tdesign-react";
import { useSettings } from "../../context/settings";
import type { PracticeRow } from "../../store/db";
import { aiSource } from "../../services/ai";
import { buildScenario, clearScenario, takeScenario, type ScenarioArgs } from "../../services/scenarioPrefetch";
import { saveNewPractice } from "../../lib/practice";
import ScenarioWorkspace from "./ScenarioWorkspace";

type State = { kind: "loading" } | { kind: "ready"; row: PracticeRow } | { kind: "noAi" } | { kind: "error"; message: string };

/** 一组完成后的场景练习：优先使用组开始时预生成的题目 */
export default function BatchScenario({ prefetchKey, args, onReviewed }: { prefetchKey: string; args: ScenarioArgs; onReviewed?: () => void }) {
  const { t } = useSettings();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pending = takeScenario(prefetchKey) ?? ((await aiSource()) ? buildScenario(args) : null);
      if (!pending) {
        if (!cancelled) setState({ kind: "noAi" });
        return;
      }
      const scenario = await pending;
      if (cancelled) return;
      clearScenario(prefetchKey);
      setState({ kind: "ready", row: await saveNewPractice(scenario, args.role) });
    })().catch((err: Error) => !cancelled && setState({ kind: "error", message: err.message }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 每组只出一次题
  }, [prefetchKey]);

  return (
    <div className="batch-scenario">
      <h3>{t("batch.scenarioTitle")}</h3>
      {state.kind === "loading" && <Loading size="small" text={t("scenario.preparing")} />}
      {state.kind === "noAi" && (
        <p className="muted">
          {t("batch.scenarioNoAi")} <Link to="/settings?tab=ai">{t("ai.configure")} →</Link>
        </p>
      )}
      {state.kind === "error" && <p className="hint">{state.message}</p>}
      {state.kind === "ready" && (
        <ScenarioWorkspace
          row={state.row}
          onChange={(row) => {
            setState({ kind: "ready", row });
            if (row.review) onReviewed?.();
          }}
          compact
        />
      )}
    </div>
  );
}
