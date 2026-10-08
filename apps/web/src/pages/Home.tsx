import { useCallback, useState } from "react";
import { Button, Loading } from "tdesign-react";
import { useSettings } from "../context/settings";
import { useStudySession } from "../hooks/useStudySession";
import TypingSession from "../components/TypingSession";
import BatchSummary from "../components/BatchSummary";
import DictSelect from "../components/DictSelect";

export default function Home() {
  const { settings, ready, t } = useSettings();
  const session = useStudySession(ready ? settings.dictId : null, settings.batchSize);
  const [showSummary, setShowSummary] = useState(false);
  const { nextBatch } = session;

  const onBatchDone = useCallback(() => setShowSummary(true), []);
  const onContinue = useCallback(() => {
    setShowSummary(false);
    nextBatch();
  }, [nextBatch]);

  const { status, batch, stats } = session;
  const newCount = batch.filter((w) => !session.cards.get(w.id)?.reps).length;

  return (
    <main className="page typing-page">
      <div className="typing-toolbar">
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
        />
      )}
    </main>
  );
}
