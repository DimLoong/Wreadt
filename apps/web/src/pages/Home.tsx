import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Loading } from "tdesign-react";
import { useSettings } from "../context/settings";
import { useStudySession } from "../hooks/useStudySession";
import { play } from "../services/sound";
import { prefetchScenario } from "../services/scenarioPrefetch";
import { defaultRole, roleText } from "../lib/roles";
import TypingSession from "../components/TypingSession";
import BatchSummary from "../components/BatchSummary";
import DictSelect from "../components/DictSelect";

export default function Home() {
  const { settings, ready, t } = useSettings();
  const session = useStudySession(ready ? settings.dictIds : null, settings.batchSize, settings.mixCount);
  const [showSummary, setShowSummary] = useState(false);
  const { nextBatch } = session;

  const disguised = settings.skin !== "none";
  const navigate = useNavigate();
  const scenarioKey = `batch-${session.batchId}`;
  const scenarioOn = settings.batchScenario && !disguised;

  // 一组开始时就在后台用本组的英文单词预生成场景题，打完一组通常已经准备好
  useEffect(() => {
    if (!scenarioOn) return;
    const targets = session.batch
      .filter((w) => w.lang === "en")
      .slice(0, 8)
      .map((w) => ({ word: w.answer, meaning: w.meanings.join("；"), tag: "today" as const }));
    if (targets.length < 3) return;
    const role = defaultRole(settings.dictIds);
    void prefetchScenario(scenarioKey, { role, roleText: roleText(role, t("scenario.general")), targets, locale: settings.locale, level: settings.scenarioLevel });
  }, [scenarioOn, scenarioKey, session.batch, settings.dictIds, settings.locale, settings.scenarioLevel, t]);
  // 伪装模式下不弹总结，直接进入下一组
  const onBatchDone = useCallback(() => {
    if (disguised) return nextBatch();
    if (settings.sound) play("batch");
    setShowSummary(true);
  }, [disguised, nextBatch, settings.sound]);
  const onContinue = useCallback(() => {
    setShowSummary(false);
    nextBatch();
  }, [nextBatch]);

  const { status, batch, stats } = session;
  const newCount = batch.filter((w) => !session.cards.get(w.id)?.reps).length;

  return (
    <main className={disguised ? "skin-page" : "page typing-page"}>
      <div className="typing-toolbar" hidden={disguised}>
        <DictSelect />
        {status.kind === "ready" && (
          <span className="muted">
            {stats.learned} / {stats.total} · {t("typing.due", { count: stats.due })} · {newCount} {t("typing.newWords")}
          </span>
        )}
      </div>

      {status.kind === "loading" && <Loading text={t("typing.loading")} />}
      {status.kind === "error" && (
        <div className="empty-state">
          <p>{t("typing.loadFailed", { message: status.message })}</p>
          <Button onClick={session.reload}>{t("typing.retry")}</Button>
        </div>
      )}
      {status.kind === "ready" && batch.length === 0 && (
        <div className="empty-state">
          <p>{t("typing.allDone")}</p>
          <Button onClick={() => nextBatch(true)} disabled={!stats.learned}>
            {t("typing.reviewAhead")}
          </Button>
        </div>
      )}
      {status.kind === "ready" && batch.length > 0 && (
        <TypingSession key={session.batchId} words={batch} onWordDone={session.recordWord} onBatchDone={onBatchDone} />
      )}

      {showSummary && (
        <BatchSummary
          results={session.results}
          allWords={session.allWords}
          cards={session.cards}
          stats={stats}
          onContinue={onContinue}
          onScenario={scenarioOn ? () => navigate("/scenario", { state: { prefetchKey: scenarioKey } }) : undefined}
        />
      )}
    </main>
  );
}
