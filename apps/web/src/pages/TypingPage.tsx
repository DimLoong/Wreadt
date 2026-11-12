import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Loading, MessagePlugin } from "tdesign-react";
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
import { prefetchWordParts } from "../lib/wordParts";
import { prefetchNewsBrief } from "../lib/newsBrief";
import NewsBriefCard from "../components/news/NewsBriefCard";
import PracticeReview from "../components/typing/PracticeReview";
import { prepareCards, type CardAnswer } from "../lib/sentenceCards";
import { isMastered, planBatchCards, Rating, wordsPerBatch, type CardPlan, type PracticeCard } from "@wreadt/core";

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
  const { setProgress } = useTypingProgress();
  // 穿插造句：每打完几个词插一张卡（填空 / 中译英）；每组题数包含造句卡
  const cardsOn = settings.practiceCards && !focus;
  const session = useStudySession({
    dictIds: ready ? settings.dictIds : null,
    batchSize: cardsOn ? wordsPerBatch(settings.batchSize, settings.practiceEvery) : settings.batchSize,
    mixCount: settings.mixCount,
    markMixCount: settings.markMixCount,
    autoUnmarkMastered: settings.autoUnmarkMastered,
    override: focus ? { key: focus.key, words: focus.words, review: focus.review } : null,
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
    return { role, roleText: roleText(role, t("scenario.general")), targets, locale: settings.locale, level: settings.scenarioLevel, interests: settings.interests };
  }, [scenarioOn, session.batch, settings.dictIds, settings.locale, settings.scenarioLevel, settings.interests, t]);

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
  // 热点短读：一组开始时按兴趣挑一条今天的新闻，用本组的英文单词在后台改写成短讯（专项练习与伪装模式不写）
  const newsOn = settings.batchNews && !disguised && !focus;
  useEffect(() => {
    if (!newsOn || session.status.kind !== "ready") return;
    const words = session.batch.filter((w) => w.lang === "en").slice(0, 8).map((w) => ({ word: w.answer, meaning: w.meanings.join("；") }));
    prefetchNewsBrief(scenarioKey, { locale: settings.locale, role: roleText(defaultRole(settings.dictIds), t("scenario.general")), interests: settings.interests, words });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在换组时生成
  }, [newsOn, scenarioKey, session.status.kind]);
  // 伪装模式下不弹总结窗口，而是在伪装页面右下角显示通知（静音）
  const review = Boolean(focus?.review);
  const { retryCount } = session;
  const exitFocus = useCallback(() => {
    setFocus(null);
    navigate("/typing", { replace: true, state: null });
  }, [navigate]);
  const onBatchDone = useCallback((endedEarly = false) => {
    // 复习到期词：还有没一次拼对的（包括跳过的）就直接再来一遍，全部一次拼对才结束；
    // 中途选了“结束本组”就结束这次复习，没做完的词仍然到期
    const left = review && !endedEarly ? retryCount() : 0;
    if (left) {
      void MessagePlugin.info({ content: t("review.again", { count: left }), duration: 2500 });
      nextBatch();
      return;
    }
    if (settings.sound && !disguised) play("batch");
    setShowSummary(true);
  }, [disguised, settings.sound, review, retryCount, nextBatch, t]);
  const onContinue = useCallback(() => {
    setShowSummary(false);
    // 复习结束后回首页（没做完的词仍然到期，首页会显示还剩几个）
    if (review) {
      setFocus(null);
      navigate("/", { replace: true });
    } else nextBatch();
  }, [nextBatch, review, navigate]);

  const { status, batch, stats } = session;

  // ---------- 穿插造句：题目在组开始时后台准备 ----------
  const plans = useMemo<CardPlan[]>(() => {
    if (!cardsOn) return [];
    const words = batch.map((w) => ({ word: w.answer, meaning: w.meanings.join("；"), lang: w.lang }));
    // 伪装模式静音，不出整句听写
    return planBatchCards(words, settings.practiceEvery).filter((p) => !(disguised && p.kind === "dictation"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在换组时重新安排
  }, [cardsOn, session.batchId, batch.length, settings.practiceEvery, disguised]);
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
        keysSlot={nav.keysSlot}
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

  // 伪装模式下组末的点评在侧边抽屉里看；没看的留到退出伪装后在打字页顶部补看
  const [pendingReview, setPendingReview] = useState<{ key: string; answers: CardAnswer[] } | null>(null);
  const continueDisguised = (reviewed: boolean) => {
    if (practiceAnswers.length && !reviewed) setPendingReview({ key: cardsKey, answers: practiceAnswers });
    onContinue();
  };

  const toolbar = focus ? (
    <div className="typing-toolbar" hidden={disguised}>
      <Alert
        theme="info"
        message={t("marks.focusBanner", { title: focus.title, count: focus.words.length })}
        operation={
          <Button size="small" variant="text" onClick={exitFocus}>
            {t("marks.exitFocus")}
          </Button>
        }
      />
    </div>
  ) : (
    <div className="typing-toolbar" hidden={disguised}>
      <DictSelect open={dictOpen} onOpenChange={setDictOpen} />
      {/* 进度数字在首页已有，这里不显示；保留组件只为达成当天目标时的提示 */}
      {status.kind === "ready" && (
        <span hidden>
          <GoalSummary compact celebrate={active} />
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
      {!disguised && pendingReview && (
        <section className="pending-review">
          <PracticeReview answers={pendingReview.answers} />
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
      {/* 一组完成时，组末总结直接替换打字区（伪装模式仍在伪装页里显示通知） */}
      {status.kind === "ready" && batch.length > 0 && !(showSummary && !disguised) && (
        <TypingSession
          key={session.batchId} words={batch} onWordDone={session.recordWord} onBatchDone={onBatchDone} toolbar={toolbar}
          mode={focus?.mode}
          active={active}
          onProgress={setProgress}
          onKnown={(w) => void session.markWordKnown(w)}
          onUnknown={(w) => void session.unmarkWordKnown(w)}
          // 之前至少 3 次复习、从未遗忘：多次一次拼对的词
          wellKnown={(w) => {
            const c = session.cards.get(w.id);
            return Boolean(c && c.reps >= 3 && c.lapses === 0);
          }}
          isNew={(w) => !session.cards.get(w.id)?.reps}
          // 循序渐进：没学过的看着拼；上次拼错、看了答案或跳过的给开头几个字母；上次拼对的完整默写；
          // 已经很熟（复习间隔约 3 周以上）的英文词认词：看单词想意思，认识就不用再拼
          stageOf={(w) => {
            const card = session.cards.get(w.id);
            if (!card?.reps) return "copy";
            const last = session.lastGrades.get(w.id);
            if (last !== undefined && last < Rating.Good) return "hint";
            // 复习到期词要求每个都拼对一次，不认词
            return w.lang === "en" && isMastered(card) && !review ? "recognize" : "recall";
          }}
          cardSlots={cardSlots}
          renderCard={renderCard}
          batchNotice={disguised && showSummary ? <SkinBatchNotice results={session.results} answers={practiceAnswers} onContinue={continueDisguised} /> : undefined}
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
            review={review ? { left: session.unreviewedCount() } : undefined}
            scenario={scenarioArgs ? { key: scenarioKey, args: scenarioArgs } : undefined}
            reading={newsOn ? <NewsBriefCard briefKey={scenarioKey} /> : undefined}
            practice={practiceAnswers.length ? { key: cardsKey, answers: practiceAnswers } : undefined}
          />
        </Suspense>
      )}
    </main>
  );
}
