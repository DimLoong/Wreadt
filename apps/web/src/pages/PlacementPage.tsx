import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeftIcon, ChevronRightIcon, InfoCircleIcon } from "tdesign-icons-react";
import { Alert, Button, Checkbox, Loading, Progress, Radio, Tag, Tooltip } from "tdesign-react";
import PlacementBar from "../components/placement/PlacementBar";
import {
  buildLevels,
  buildPlacementRound,
  LEVEL_KNOWN_THRESHOLD,
  PLACEMENT_LEVELS,
  PLACEMENT_MAX_ROUNDS,
  PLACEMENT_MIN_ROUNDS,
  placementConfidence,
  scorePlacement,
  wordsToMarkKnown,
  type Lang,
  type LevelWords,
  type PlacementItem,
} from "@wreadt/core";
import { useSettings } from "../context/settings";
import { loadDictWords } from "../store/dicts";
import { db } from "../store/db";
import { markKnown } from "../store/repo";
import type { MessageKey } from "../i18n/messages";

type Step = { kind: "intro" } | { kind: "loading" } | { kind: "quiz"; index: number } | { kind: "result" } | { kind: "done"; count: number };

/** 词汇摸底：按难度阶梯抽词，认识 / 不认识快速判断，估计词汇量并跳过已会的词 */
export default function PlacementPage() {
  const { t, settings, update } = useSettings();
  const [switchDict, setSwitchDict] = useState(true);
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>("en");
  const [step, setStep] = useState<Step>({ kind: "intro" });
  const [levels, setLevels] = useState<LevelWords[]>([]);
  const [items, setItems] = useState<PlacementItem[]>([]);
  const [answers, setAnswers] = useState<Map<string, boolean>>(new Map());
  /** 每轮结束的位置（items 下标），用来计算已完成几轮 */
  const [roundEnds, setRoundEnds] = useState<number[]>([]);
  const [learned, setLearned] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const start = async () => {
    setStep({ kind: "loading" });
    const ids = [...new Set(PLACEMENT_LEVELS[lang].flatMap((l) => l.dicts))];
    const lists = await Promise.all(ids.map((id) => loadDictWords(id).catch(() => [])));
    const lv = buildLevels(lang, Object.fromEntries(ids.map((id, i) => [id, lists[i]!])));
    // 已经学过的词不再出题
    const known = new Set((await db.cards.toArray()).filter((c) => !c.deleted && c.reps > 0).map((c) => c.id));
    // 一开始就出够“可出结果”所需的轮数，进度条不会在答题中途重新切分
    const first: PlacementItem[] = [];
    const ends: number[] = [];
    for (let r = 0; r < PLACEMENT_MIN_ROUNDS; r += 1) {
      first.push(...buildPlacementRound(lang, lv, first, { exclude: known }));
      ends.push(first.length);
    }
    setLevels(lv);
    setLearned(known);
    setItems(first);
    setRoundEnds(ends);
    setAnswers(new Map());
    setStep({ kind: "quiz", index: 0 });
  };

  const answered = answers.size;
  const rounds = roundEnds.filter((end) => end <= answered).length;
  const canFinish = rounds >= PLACEMENT_MIN_ROUNDS;
  const minCount = roundEnds[PLACEMENT_MIN_ROUNDS - 1] ?? 0;
  /** 第一道未答的题 */
  const frontier = useMemo(() => {
    const i = items.findIndex((it) => !answers.has(it.word.id));
    return i < 0 ? items.length : i;
  }, [items, answers]);

  const goto = useCallback((index: number) => setStep({ kind: "quiz", index: Math.max(0, Math.min(index, frontier)) }), [frontier]);

  /**
   * Y / N 作答。在新题上作答后自动进入下一题；回看已答的题时只改判、停在原题。
   * 假词答过后不能改判，否则校正就失效了。
   */
  const answer = useCallback(
    (known: boolean) => {
      if (step.kind !== "quiz") return;
      const item = items[step.index];
      if (!item) return;
      const revisit = answers.has(item.word.id);
      if (revisit && item.level === null) return;
      setAnswers((a) => new Map(a).set(item.word.id, known));
      if (revisit) return;
      const next = step.index + 1;
      if (next < items.length) return setStep({ kind: "quiz", index: next });
      // 题目答完：没到上限就再出一轮，用户随时可以先看结果
      const more = roundEnds.length < PLACEMENT_MAX_ROUNDS ? buildPlacementRound(lang, levels, items, { exclude: learned }) : [];
      if (!more.length) return setStep({ kind: "result" });
      setItems([...items, ...more]);
      setRoundEnds([...roundEnds, items.length + more.length]);
      setStep({ kind: "quiz", index: next });
    },
    [items, answers, step, roundEnds, lang, levels, learned],
  );

  /** 改判某一题（刚答完的上一题或正在回看的题） */
  const flip = useCallback((item: PlacementItem) => {
    if (item.level === null) return;
    setAnswers((a) => (a.has(item.word.id) ? new Map(a).set(item.word.id, !a.get(item.word.id)) : a));
  }, []);

  // Y：认识；N：不认识；← / →：上一题 / 下一题；Enter：答够后直接看结果
  useEffect(() => {
    if (step.kind !== "quiz") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "y") answer(true);
      else if (k === "n") answer(false);
      else if (k === "arrowleft") goto(step.index - 1);
      else if (k === "arrowright") goto(step.index + 1);
      else if (k === "enter" && canFinish) setStep({ kind: "result" });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, goto, step, canFinish]);

  // 只按答过的题算分
  const scored = useMemo(() => items.filter((i) => answers.has(i.word.id)), [items, answers]);
  const result = useMemo(() => (step.kind === "result" ? scorePlacement(levels, scored, answers) : null), [step.kind, levels, scored, answers]);
  const toMark = useMemo(() => (result ? wordsToMarkKnown(levels, scored, answers, result) : []), [result, levels, scored, answers]);

  // 推荐从第一个“还没掌握”的级别开始；如果当前所选的考试词库都已基本掌握，默认切换过去
  const recommended = useMemo(() => {
    if (!result) return null;
    const idx = result.levels.findIndex((l) => l.ratio < LEVEL_KNOWN_THRESHOLD);
    return idx >= 0 ? PLACEMENT_LEVELS[lang][idx]! : null;
  }, [result, lang]);
  const masteredDicts = useMemo(() => {
    if (!result) return new Set<string>();
    return new Set(PLACEMENT_LEVELS[lang].filter((_, i) => (result.levels[i]?.ratio ?? 0) >= LEVEL_KNOWN_THRESHOLD).flatMap((l) => l.dicts));
  }, [result, lang]);
  const currentMastered = settings.dictIds.length > 0 && settings.dictIds.every((id) => masteredDicts.has(id));

  const apply = async () => {
    setSaving(true);
    const count = await markKnown(toMark);
    if (recommended && currentMastered && switchDict) await update("dictIds", recommended.dicts);
    setSaving(false);
    setStep({ kind: "done", count });
  };

  const current = step.kind === "quiz" ? items[step.index] : undefined;
  const currentKnown = current ? answers.get(current.word.id) : undefined;
  const prev = step.kind === "quiz" && step.index > 0 ? items[step.index - 1] : undefined;
  const prevKnown = prev ? answers.get(prev.word.id) : undefined;

  return (
    <main className="page narrow placement-page">
      <h1>{t("placement.title")}</h1>

      {step.kind === "intro" && (
        <section className="panel placement-intro">
          <p>{t("placement.desc")}</p>
          <Radio.Group variant="default-filled" value={lang} onChange={(v) => setLang(v as Lang)}>
            <Radio.Button value="en">English</Radio.Button>
            <Radio.Button value="ja">日本語</Radio.Button>
          </Radio.Group>
          <p className="muted">{t("placement.howto")}</p>
          <Button theme="primary" size="large" onClick={() => void start()}>
            {t("placement.start")}
          </Button>
        </section>
      )}

      {step.kind === "loading" && <Loading text={t("typing.loading")} />}

      {step.kind === "quiz" && current && (
        <section className="panel placement-quiz">
          <div className="placement-progress">
            <PlacementBar items={items} answers={answers} index={step.index} frontier={frontier} minCount={minCount} onSelect={goto} />
            <div className="placement-progress-text muted">
              <span>{t("placement.position", { n: step.index + 1 })}</span>
              <span>
                {canFinish
                  ? t("placement.confidence", { count: answered, level: t(`placement.confidence.${placementConfidence(rounds)}` as MessageKey) })
                  : t("placement.remaining", { count: minCount - answered })}
              </span>
            </div>
          </div>

          <div className="placement-word" lang={current.word.lang}>
            {current.word.display}
          </div>
          {current.word.lang === "ja" && current.word.reading && current.word.reading !== current.word.display && (
            <div className="muted placement-reading">{current.word.reading}</div>
          )}

          {currentKnown === undefined ? (
            <>
              <div className="placement-actions">
                <Button size="large" theme="primary" onClick={() => answer(true)}>
                  {t("placement.known")} <kbd>Y</kbd>
                </Button>
                <Button size="large" variant="outline" onClick={() => answer(false)}>
                  {t("placement.unknown")} <kbd>N</kbd>
                </Button>
              </div>
              {/* 刚答完的上一题：显示释义，判断错了可以改判 */}
              {prev && prevKnown !== undefined ? (
                <AnswerDetail item={prev} known={prevKnown} label={t("placement.prevAnswer")} onFlip={() => flip(prev)} />
              ) : (
                <div className="placement-feedback muted">{t("placement.feedbackHint")}</div>
              )}
            </>
          ) : (
            // 回看已答的题：直接显示释义与回答，不再出现作答按钮
            <AnswerDetail item={current} known={currentKnown} label={t("placement.yourAnswer")} onFlip={() => flip(current)} revisit />
          )}

          <div className="placement-nav">
            <Button variant="text" icon={<ChevronLeftIcon />} disabled={step.index === 0} onClick={() => goto(step.index - 1)}>
              {t("placement.prev")}
            </Button>
            {canFinish && (
              <Button variant="outline" theme="primary" onClick={() => setStep({ kind: "result" })}>
                {t("placement.finish")}
              </Button>
            )}
            <Button variant="text" disabled={step.index >= frontier} onClick={() => goto(step.index + 1)}>
              {t("placement.next")} <ChevronRightIcon />
            </Button>
          </div>
          <p className="muted placement-tip">{canFinish ? t("placement.tipMore") : t("placement.tip")}</p>
        </section>
      )}

      {step.kind === "result" && result && (
        <section className="panel placement-result">
          <h2>{t("placement.estimate", { count: result.estimate })}</h2>
          <p className="muted">
            {t("placement.basedOn", { count: scored.length, level: t(`placement.confidence.${placementConfidence(rounds)}` as MessageKey) })}
            {answered < items.length && (
              <Button variant="text" theme="primary" size="small" onClick={() => goto(frontier)}>
                {t("placement.continue")}
              </Button>
            )}
          </p>
          {result.falseAlarm > 0 && <Alert theme="warning" message={t("placement.falseAlarm", { pct: Math.round(result.falseAlarm * 100) })} />}
          <div className="placement-levels">
            {result.levels.map((l) => (
              <div key={l.id} className="placement-level">
                <span>{l.name}</span>
                <Progress percentage={Math.round(l.ratio * 100)} status={l.ratio >= LEVEL_KNOWN_THRESHOLD ? "success" : undefined} />
                <span className="muted">
                  {l.known}/{l.asked}
                </span>
              </div>
            ))}
          </div>
          <p>{toMark.length ? t("placement.proposal", { count: toMark.length }) : t("placement.nothing")}</p>
          {recommended && <p>{t("placement.recommend", { level: recommended.name })}</p>}
          {recommended && currentMastered && (
            <Checkbox checked={switchDict} onChange={(v) => setSwitchDict(Boolean(v))}>
              {t("placement.switchDict", { level: recommended.name })}
            </Checkbox>
          )}
          <div className="add-actions">
            {toMark.length > 0 && (
              <Button theme="primary" loading={saving} onClick={() => void apply()}>
                {t("placement.apply", { count: toMark.length })}
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate("/typing")}>
              {t("placement.skip")}
            </Button>
          </div>
        </section>
      )}

      {step.kind === "done" && (
        <section className="panel placement-result">
          <Alert theme="success" message={t("placement.done", { count: step.count })} />
          <div className="add-actions">
            <Button theme="primary" onClick={() => navigate("/typing")}>
              {t("home.start")}
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}

/** 一道已答题的释义与回答；真词可以改判，假词附说明 */
function AnswerDetail({ item, known, label, onFlip, revisit }: { item: PlacementItem; known: boolean; label: string; onFlip: () => void; revisit?: boolean }) {
  const { t } = useSettings();
  const fake = item.level === null;
  return (
    <div className={`placement-feedback ${revisit ? "revisit" : ""}`}>
      <div className="placement-feedback-head">
        <span className="muted">{label}</span>
        {!revisit && <strong lang={item.word.lang}>{item.word.display}</strong>}
        <Tag size="small" variant="light" theme={known ? "success" : "danger"}>
          {known ? t("placement.known") : t("placement.unknown")}
        </Tag>
        {!fake && (
          <Button size="small" variant="text" theme="primary" onClick={onFlip}>
            {known ? t("placement.toUnknown") : t("placement.toKnown")}
            {revisit && <kbd>{known ? "N" : "Y"}</kbd>}
          </Button>
        )}
      </div>
      {fake ? (
        <div className="muted placement-feedback-meaning">
          {t("placement.fake")}
          <Tooltip content={t("placement.fakeWhy")} placement="top" overlayStyle={{ maxWidth: 320 }}>
            <InfoCircleIcon className="placement-info" aria-label={t("placement.fakeWhyLabel")} />
          </Tooltip>
        </div>
      ) : (
        <div className="placement-feedback-meaning">
          {item.word.lang === "ja"
            ? item.word.reading && <span className="muted">{item.word.reading} </span>
            : item.word.phonetic && <span className="muted">/{item.word.phonetic}/ </span>}
          {item.word.meanings.join("；") || t("placement.noMeaning")}
        </div>
      )}
    </div>
  );
}
