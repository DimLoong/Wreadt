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
import TypingSession, { type CardNav } from "../components/TypingSession";
import BatchSummary from "../components/BatchSummary";
import DictSelect from "../components/DictSelect";
import GoalSummary from "../components/GoalSummary";
import PlacementPrompt from "../components/placement/PlacementPrompt";
import PracticeCardView from "../components/typing/PracticeCardView";
import { useMarks } from "../hooks/useMarks";
import { prepareCards, type CardAnswer } from "../lib/sentenceCards";
import { planCards, type CardPlan, type PracticeCard } from "@wreadt/core";

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

  // ---------- 穿插造句：每打完几个词插一张卡（填空 / 中译英），题目在组开始时后台准备 ----------
  const cardsOn = settings.practiceCards && !disguised && !focus;
  const marks = useMarks();
  const plans = useMemo<CardPlan[]>(() => {
    if (!cardsOn) return [];
    const en = batch.filter((w) => w.lang === "en").map((w) => ({ word: w.answer, meaning: w.meanings.join("；") }));
    // 中译英混入一个 mark 的词，帮助把重点词用起来
    const extras = [...marks.values()].filter((m) => m.word.lang === "en").map((m) => ({ word: m.word.answer, meaning: m.word.meanings.join("；") }));
    // 最后一个词之后是组总结，不在那里插卡
    return planCards(en, extras, settings.practiceEvery).filter((p) => p.after < batch.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在换组时重新安排，组内 mark 变化不影响
  }, [cardsOn, session.batchId, batch.length, settings.practiceEvery]);
  const cardsKey = `cards-${session.batchId}-${plans.map((p) => p.words.map((w) => w.word).join("+")).join("|")}`;
  const [readyCards, setReadyCards] = useState<{ key: string; cards: (PracticeCard | null)[] } | null>(null);
  // 每道题的作答（跳回去可以查看或改答）
  const [cardAnswers, setCardAnswers] = useState<{ key: string; byPlan: Record<number, CardAnswer> }>({ key: "", byPlan: {} });
  const answersByPlan = cardAnswers.key === cardsKey ? cardAnswers.byPlan : {};

  useEffect(() => {
    if (!plans.length) return;
    let cancelled = false;
    void prepareCards(cardsKey, plans, batch, settings.locale).then((cards) => !cancelled && setReadyCards({ key: cardsKey, cards }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 题目由 cardsKey 唯一确定
  }, [cardsKey]);

  // 造句题排在第 after 个词之前，和单词一样可以前后跳转；还没准备好或出题失败的题不出现，不让学习者等
  const cards = readyCards?.key === cardsKey ? readyCards.cards : [];
  const cardSlots = plans.flatMap((p, i) => (cards[i] ? [p.after] : []));
  const renderCard = (index: number, nav: CardNav) => {
    const i = plans.findIndex((p) => p.after === index);
    const card = cards[i];
    if (!card) return null;
    return (
      <PracticeCardView
        key={`${cardsKey}-${i}`}
        card={card}
        words={plans[i]?.words ?? []}
        initial={answersByPlan[i]}
        onPrev={nav.prev}
        onDone={(answer) => {
          if (answer) setCardAnswers({ key: cardsKey, byPlan: { ...answersByPlan, [i]: answer } });
          nav.next();
        }}
      />
    );
  };
  const practiceAnswers = Object.keys(answersByPlan)
    .map(Number)
    .sort((x, y) => x - y)
    .map((i) => answersByPlan[i]!);

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
          cardSlots={cardSlots}
          renderCard={renderCard}
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
          practice={practiceAnswers.length ? { key: cardsKey, answers: practiceAnswers } : undefined}
        />
      )}
    </main>
  );
}
