import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
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
import DictSelect from "../components/DictSelect";
import GoalSummary from "../components/GoalSummary";
import PlacementPrompt from "../components/placement/PlacementPrompt";
import PracticeCardView from "../components/typing/PracticeCardView";
import SkinBatchNotice from "../components/skins/SkinBatchNotice";
import PasteLearnDialog from "../components/typing/PasteLearnDialog";
import { FilePasteIcon } from "tdesign-icons-react";
import { prefetchWordParts } from "../lib/wordParts";
import { prefetchStory } from "../lib/story";
import PracticeReview from "../components/typing/PracticeReview";
import { useMarks } from "../hooks/useMarks";
import { prepareCards, type CardAnswer } from "../lib/sentenceCards";
import { planBatchCards, wordsPerBatch, type CardPlan, type PracticeCard, type WordItem } from "@wreadt/core";

// 组总结（含词库地图、场景练习）在一组打完时才需要：按需加载，组开始时在后台预取
const loadBatchSummary = () => import("../components/BatchSummary");
const BatchSummary = lazy(loadBatchSummary);

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
  const [pasteOpen, setPasteOpen] = useState(false);
  // 首页 / 添加单词弹窗的“粘贴即学”入口：/typing?paste=1
  const wantPaste = active && new URLSearchParams(location.search).get("paste") === "1";
  useEffect(() => {
    if (!wantPaste) return;
    setPasteOpen(true);
    navigate("/typing", { replace: true });
  }, [wantPaste, navigate]);
  const { setProgress } = useTypingProgress();
  // 穿插造句：每打完几个词插一张卡（填空 / 中译英）；每组题数包含造句卡
  const cardsOn = settings.practiceCards && !focus;
  const session = useStudySession({
    dictIds: ready ? settings.dictIds : null,
    batchSize: cardsOn ? wordsPerBatch(settings.batchSize, settings.practiceEvery) : settings.batchSize,
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

  useEffect(() => {
    if (session.status.kind === "ready") void loadBatchSummary();
  }, [session.status.kind]);
  // 构词拆分：一组开始时为整组词一次性生成（缓存在本机）
  useEffect(() => {
    if (session.status.kind === "ready" && session.batch.length && !disguised) void prefetchWordParts(session.batch, settings.locale);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在换组时生成
  }, [session.batchId, session.status.kind, disguised]);
  // 一组开始时就在后台预生成，打完一组通常已经准备好
  useEffect(() => {
    if (scenarioArgs) void prefetchScenario(scenarioKey, scenarioArgs);
  }, [scenarioArgs, scenarioKey]);
  // 连载小故事：一组开始时用本组的英文单词在后台续写一集（专项练习与伪装模式不写）
  const storyOn = settings.batchStory && !disguised && !focus;
  useEffect(() => {
    if (!storyOn || session.status.kind !== "ready") return;
    const words = session.batch.filter((w) => w.lang === "en").slice(0, 8).map((w) => ({ word: w.answer, meaning: w.meanings.join("；") }));
    void prefetchStory(scenarioKey, { locale: settings.locale, role: roleText(defaultRole(settings.dictIds), t("scenario.general")), words });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在换组时生成
  }, [storyOn, scenarioKey, session.status.kind]);
  // 伪装模式下不弹总结窗口，而是在伪装页面右下角显示通知（静音）
  const onBatchDone = useCallback(() => {
    if (settings.sound && !disguised) play("batch");
    setShowSummary(true);
  }, [disguised, settings.sound]);
  const onContinue = useCallback(() => {
    setShowSummary(false);
    nextBatch();
  }, [nextBatch]);

  const { status, batch, stats } = session;

  // ---------- 穿插造句：题目在组开始时后台准备 ----------
  const marks = useMarks();
  const plans = useMemo<CardPlan[]>(() => {
    if (!cardsOn) return [];
    const words = batch.map((w) => ({ word: w.answer, meaning: w.meanings.join("；"), lang: w.lang }));
    // 中译英混入一个 mark 的词，帮助把重点词用起来
    const extras = [...marks.values()].filter((m) => m.word.lang === "en").map((m) => ({ word: m.word.answer, meaning: m.word.meanings.join("；") }));
    return planBatchCards(words, extras, settings.practiceEvery);
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

  // 伪装模式下组末不显示 AI 点评：留到退出伪装后在打字页顶部补看
  const [pendingReview, setPendingReview] = useState<{ key: string; answers: CardAnswer[] } | null>(null);
  const continueDisguised = () => {
    if (practiceAnswers.length) setPendingReview({ key: cardsKey, answers: practiceAnswers });
    onContinue();
  };

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
      <div className="typing-toolbar-row">
        <DictSelect open={dictOpen} onOpenChange={setDictOpen} />
        <Button size="small" variant="text" icon={<FilePasteIcon />} onClick={() => setPasteOpen(true)}>
          {t("paste.title")}
        </Button>
      </div>
      {/* 进度数字在首页已有，这里不显示；保留组件只为达成当天目标时的提示 */}
      {status.kind === "ready" && (
        <span hidden>
          <GoalSummary compact celebrate={active} />
        </span>
      )}
    </div>
  );
  const inSession = status.kind === "ready" && batch.length > 0;
  // 粘贴即学：挑出的词作为一组专项练习开始
  const startPasted = (words: WordItem[]) => {
    if (!words.length) return;
    navigate("/typing", { state: { practice: { key: `paste-${Date.now()}`, title: t("paste.title"), words } } });
  };

  return (
    <main className={disguised ? "skin-page" : "page typing-page"}>
      {/* 还没学过词、也没做过摸底：开始前建议先摸底 */}
      {!disguised && !focus && status.kind === "ready" && stats.learned === 0 && settings.placementStatus === "pending" && <PlacementPrompt where="typing" />}
      {!inSession && toolbar}
      {!disguised && pendingReview && (
        <section className="pending-review">
          <PracticeReview batchKey={pendingReview.key} answers={pendingReview.answers} />
          <Button size="small" variant="text" onClick={() => setPendingReview(null)}>
            {t("cards.dismissReview")}
          </Button>
        </section>
      )}

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
          batchNotice={disguised && showSummary ? <SkinBatchNotice results={session.results} practiced={practiceAnswers.length} onContinue={continueDisguised} /> : undefined}
        />
      )}

      {showSummary && active && !disguised && (
        <Suspense fallback={null}>
          <BatchSummary
            results={session.results}
            allWords={session.allWords}
            cards={session.cards}
            stats={stats}
            onContinue={onContinue}
            scenario={scenarioArgs ? { key: scenarioKey, args: scenarioArgs } : undefined}
            storyKey={storyOn ? scenarioKey : undefined}
            practice={practiceAnswers.length ? { key: cardsKey, answers: practiceAnswers } : undefined}
          />
        </Suspense>
      )}
      {pasteOpen && <PasteLearnDialog visible={pasteOpen} onClose={() => setPasteOpen(false)} cards={session.cards} onStart={startPasted} />}
    </main>
  );
}
