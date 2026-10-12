import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "tdesign-react";
import type { Example, WordItem } from "@wreadt/core";
import { useSettings } from "../context/settings";
import { AiUnavailableError, generateExamples } from "../services/ai";

/** 完成面板中的 AI 例句，按需生成 */
export default function WordExamples({ word, onDone }: { word: WordItem; onDone?: () => void }) {
  const { settings, t } = useSettings();
  const [examples, setExamples] = useState<Example[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"unavailable" | string | null>(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      setExamples(await generateExamples(word.lang, word.lang === "ja" ? word.display : word.answer, settings.locale));
    } catch (err) {
      setError(err instanceof AiUnavailableError ? "unavailable" : (err as Error).message);
    } finally {
      setBusy(false);
      onDone?.();
    }
  };

  if (examples) {
    return (
      <ul className="examples">
        {examples.map((ex) => (
          <li key={ex.sentence}>
            <span lang={word.lang}>{ex.sentence}</span>
            <span className="muted">{ex.translation}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="examples-cta">
      <Button size="small" variant="outline" loading={busy} onClick={() => void load()}>
        {t("typing.examples")}
      </Button>
      {error === "unavailable" && (
        <span className="muted">
          {t("ai.unavailable")} <Link to="/settings">{t("ai.configure")}</Link>
        </span>
      )}
      {error && error !== "unavailable" && <span className="hint">{error}</span>}
    </div>
  );
}
