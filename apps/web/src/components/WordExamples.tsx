import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "tdesign-react";
import type { Example, WordItem } from "@wreadt/core";
import { useSettings } from "../context/settings";
import { AiUnavailableError, generateExamples } from "../services/ai";

/** 完成面板中的例句：先展示词库自带例句，再可按需用 AI 生成更多 */
export default function WordExamples({ word, onDone }: { word: WordItem; onDone?: () => void }) {
  const { settings, t } = useSettings();
  const [examples, setExamples] = useState<Example[]>(word.examples ?? []);
  const [generated, setGenerated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"unavailable" | string | null>(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const more = await generateExamples(word.lang, word.lang === "ja" ? word.display : word.answer, settings.locale);
      setExamples((prev) => [...prev, ...more]);
      setGenerated(true);
    } catch (err) {
      setError(err instanceof AiUnavailableError ? "unavailable" : (err as Error).message);
    } finally {
      setBusy(false);
      onDone?.();
    }
  };

  return (
    <>
      {examples.length > 0 && (
        <ul className="examples">
          {examples.map((ex) => (
            <li key={ex.sentence}>
              <span lang={word.lang}>{ex.sentence}</span>
              {ex.translation && <span className="muted">{ex.translation}</span>}
            </li>
          ))}
        </ul>
      )}
      {!generated && (
        <div className="examples-cta">
          <Button size="small" variant="outline" loading={busy} onClick={() => void load()}>
            {examples.length ? t("typing.moreExamples") : t("typing.examples")}
          </Button>
          {error === "unavailable" && (
            <span className="muted">
              {t("ai.unavailable")} <Link to="/settings">{t("ai.configure")}</Link>
            </span>
          )}
          {error && error !== "unavailable" && <span className="hint">{error}</span>}
        </div>
      )}
    </>
  );
}
