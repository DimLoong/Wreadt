import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrowseIcon, ChevronLeftIcon } from "tdesign-icons-react";
import { Alert, Button, Checkbox, Loading, Progress, Radio } from "tdesign-react";
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
  const [revealed, setRevealed] = useState(false);
  /** 看过释义的假词不计入误报率 */
  const [peekedFakes, setPeekedFakes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const start = async () => {
    setStep({ kind: "loading" });
    const ids = [...new Set(PLACEMENT_LEVELS[lang].flatMap((l) => l.dicts))];
    const lists = await Promise.all(ids.map((id) => loadDictWords(id).catch(() => [])));
    const lv = buildLevels(lang, Object.fromEntries(ids.map((id, i) => [id, lists[i]!])));
    // 已经学过的词不再出题
    const known = new Set((await db.cards.toArray()).filter((c) => !c.deleted && c.reps > 0).map((c) => c.id));
    const first = buildPlacementRound(lang, lv, [], { exclude: known });
    setLevels(lv);
    setLearned(known);
    setItems(first);
    setRoundEnds([first.length]);
    setAnswers(new Map());
    setPeekedFakes(new Set());
    setRevealed(false);
    setStep({ kind: "quiz", index: 0 });
  };

  const answered = answers.size;
  const rounds = roundEnds.filter((end) => end <= answered).length;
  const canFinish = rounds >= PLACEMENT_MIN_ROUNDS;
  const minCount = roundEnds[PLACEMENT_MIN_ROUNDS - 1] ?? (roundEnds[0] ?? 0) * PLACEMENT_MIN_ROUNDS;

  const goto = (index: number) => {
    setRevealed(false);
    setStep({ kind: "quiz", index });
  };

  const answer = useCallback(
    (known: boolean) => {
      if (step.kind !== "quiz") return;
      const item = items[step.index];
      if (!item) return;
      setAnswers((a) => new Map(a).set(item.word.id, known));
      setRevealed(false);
      const next = step.index + 1;
      if (next < items.length) return setStep({ kind: "quiz", index: next });
      // 一轮答完：没到上限就接着出下一轮，用户随时可以先看结果
      const more = roundEnds.length < PLACEMENT_MAX_ROUNDS ? buildPlacementRound(lang, levels, items, { exclude: learned }) : [];
      if (!more.length) return setStep({ kind: "result" });
      setItems([...items, ...more]);
      setRoundEnds([...roundEnds, items.length + more.length]);
      setStep({ kind: "quiz", index: next });
    },
    [items, step, roundEnds, lang, levels, learned],
  );

  const reveal = useCallback(() => {
    if (step.kind !== "quiz") return;
    const item = items[step.index];
    if (!item) return;
    setRevealed(true);
    if (item.level === null) setPeekedFakes((s) => new Set(s).add(item.word.id));
  }, [items, step]);

  // ← / J：不认识；→ / K：认识；空格：看释义；Backspace：回到上一题；Enter：答够后直接看结果
  useEffect(() => {
    if (step.kind !== "quiz") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "arrowright" || k === "k") answer(true);
      else if (k === "arrowleft" || k === "j") answer(false);
      else if (k === " ") reveal();
      else if (k === "backspace" && step.index > 0) goto(step.index - 1);
      else if (k === "enter" && canFinish) setStep({ kind: "result" });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, reveal, step, canFinish]);

  // 只按答过的题算分；看过释义的假词不计入
  const scored = useMemo(() => items.filter((i) => answers.has(i.word.id) && !peekedFakes.has(i.word.id)), [items, answers, peekedFakes]);
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
            <Progress
              percentage={Math.min(100, Math.round((answered / (canFinish ? (roundEnds[0] ?? 1) * PLACEMENT_MAX_ROUNDS : minCount)) * 100))}
              label={false}
              status={canFinish ? "success" : undefined}
            />
            <span className="muted">
              {canFinish
                ? t("placement.confidence", { count: answered, level: t(`placement.confidence.${placementConfidence(rounds)}` as MessageKey) })
                : t("placement.remaining", { count: minCount - answered })}
            </span>
          </div>
          <div className="placement-word" lang={current.word.lang}>
            {current.word.display}
          </div>
          {current.word.lang === "ja" && current.word.reading && current.word.reading !== current.word.display && (
            <div className="muted placement-reading">{current.word.reading}</div>
          )}
          <div className="placement-meaning">
            {revealed ? (
              current.level === null ? (
                <span className="muted">{t("placement.fake")}</span>
              ) : (
                <span>
                  {current.word.phonetic && <span className="muted">{current.word.phonetic} </span>}
                  {current.word.meanings.join("；") || t("placement.noMeaning")}
                </span>
              )
            ) : (
              <Button variant="text" theme="primary" icon={<BrowseIcon />} onClick={reveal}>
                {t("placement.reveal")}
              </Button>
            )}
          </div>
          <div className="placement-actions">
            <Button size="large" variant="outline" onClick={() => answer(false)}>
              ← {t("placement.unknown")}
            </Button>
            <Button size="large" theme="primary" onClick={() => answer(true)}>
              {t("placement.known")} →
            </Button>
          </div>
          <div className="placement-nav">
            <Button variant="text" icon={<ChevronLeftIcon />} disabled={step.index === 0} onClick={() => goto(step.index - 1)}>
              {t("placement.prev")}
            </Button>
            {canFinish && (
              <Button variant="outline" theme="primary" onClick={() => setStep({ kind: "result" })}>
                {t("placement.finish")}
              </Button>
            )}
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
              <Button variant="text" theme="primary" size="small" onClick={() => goto(Math.max(0, items.findIndex((i) => !answers.has(i.word.id))))}>
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
