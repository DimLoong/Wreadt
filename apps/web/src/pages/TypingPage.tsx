import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Loading } from "tdesign-react";
import { readFocusPractice, type FocusPractice } from "../lib/practiceState";
import { useTypingProgress } from "../context/typingProgress";
import { useSettings } from "../context/settings";
import { useStudySession } from "../hooks/useStudySession";
import { play } from "../services/sound";
import { prefetchScenario, type ScenarioArgs } from "../services/scenarioPrefetch";
import { defaultRole, roleText } from "../lib/roles";
import TypingSession from "../components/TypingSession";
import BatchSummary from "../components/BatchSummary";
import DictSelect from "../components/DictSelect";
import GoalSummary from "../components/GoalSummary";
import PlacementPrompt from "../components/placement/PlacementPrompt";

/** active：当前是否在 /typing。页面切走时组件保留（只隐藏），学习进度与计时不丢失 */
export default function TypingPage({ active = true }: { active?: boolean }) {
  const { settings, ready, t } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  // mark 列表等页面带来的专项练习
  // 专项练习在进入时记下来，切到别的页面再回来仍然保留，直到手动退出
  const [focus, setFocus] = useState<FocusPractice | null>(() => readFocusPractice(location.state));
  const incoming = active ? readFocusPractice(location.state) : null;
  if (incoming && incoming.key !== focus?.key) setFocus(incoming);
  const [dictOpen, setDictOpen] = useState(false);
  const { setProgress } = useTypingProgress();
  const session = useStudySession({
    dictIds: ready ? settings.dictIds : null,
    batchSize: settings.batchSize,
    mixCount: settings.mixCount,
    markMixCount: settings.markMixCount,
    autoUnmarkMastered: settings.autoUnmarkMastered,
    override: focus ? { key: focus.key, words: focus.words } : null,
  });
  const [showSummary, setShowSummary] = useState(false);
  const { nextBatch } = session;

  const disguised = settings.skin !== "none";
  const scenarioKey = `batch-${session.batchId}`;
  const scenarioOn = settings.batchScenario && !disguised;

  // 本组的场景题参数：用本组的英文单词（简单难度只取前 5 个）
  const scenarioArgs = useMemo<ScenarioArgs | null>(() => {
    const targets = session.batch
      .filter((w) => w.lang === "en")
      .slice(0, settings.scenarioLevel === "simple" ? 5 : 8)
      .map((w) => ({ word: w.answer, meaning: w.meanings.join("；"), tag: "today" as const }));
    if (!scenarioOn || targets.length < 3) return null;
    const role = defaultRole(settings.dictIds);
    return { role, roleText: roleText(role, t("scenario.general")), targets, locale: settings.locale, level: settings.scenarioLevel };
  }, [scenarioOn, session.batch, settings.dictIds, settings.locale, settings.scenarioLevel, t]);

  // 一组开始时就在后台预生成，打完一组通常已经准备好
  useEffect(() => {
    if (scenarioArgs) void prefetchScenario(scenarioKey, scenarioArgs);
  }, [scenarioArgs, scenarioKey]);
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

  const toolbar = focus ? (
    <div className="typing-toolbar" hidden={disguised}>
      <Alert
        theme="info"
        message={t("marks.focusBanner", { title: focus.title, count: focus.words.length })}
        operation={
          <Button size="small" variant="text" onClick={() => {
            setFocus(null);
            navigate("/typing", { replace: true, state: null });
          }}>
            {t("marks.exitFocus")}
          </Button>
        }
      />
    </div>
  ) : (
    <div className="typing-toolbar" hidden={disguised}>
      <DictSelect open={dictOpen} onOpenChange={setDictOpen} />
      {status.kind === "ready" && (
        <span className="muted">
          {stats.learned} / {stats.total} · <GoalSummary compact celebrate={active} />
        </span>
      )}
    </div>
  );
  const inSession = status.kind === "ready" && batch.length > 0;

  return (
    <main className={disguised ? "skin-page" : "page typing-page"}>
      {/* 还没学过词、也没做过摸底：开始前建议先摸底 */}
      {!disguised && !focus && status.kind === "ready" && stats.learned === 0 && settings.placementStatus === "pending" && <PlacementPrompt where="typing" />}
      {!inSession && toolbar}

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
        <TypingSession
          key={session.batchId} words={batch} onWordDone={session.recordWord} onBatchDone={onBatchDone} toolbar={toolbar}
          mode={focus?.mode}
          active={active}
          onProgress={setProgress}
          onKnown={(w) => void session.markWordKnown(w)}
        />
      )}

      {showSummary && active && (
        <BatchSummary
          results={session.results}
          allWords={session.allWords}
          cards={session.cards}
          stats={stats}
          onContinue={onContinue}
          scenario={scenarioArgs ? { key: scenarioKey, args: scenarioArgs } : undefined}
        />
      )}
    </main>
  );
}
