import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Input, Loading, Progress, Radio, Tag, type InputRef } from "tdesign-react";
import { PlayCircleIcon, RefreshIcon } from "tdesign-icons-react";
import { diffSentence, lemmaCandidates, markCandidates, missedWords, type DictationSentence, type FeedLevel, type SentenceDiff } from "@wreadt/core";
import { useSettings } from "../context/settings";
import PracticeTabs from "../components/PracticeTabs";
import DiffView from "../components/DiffView";
import { loadDictation } from "../lib/dictation";
import { recordDictationMistakes } from "../lib/spelling";
import type { FeedSource } from "../lib/feed";
import { defaultRole, roleText } from "../lib/roles";
import { preloadSentence, speakSentence, stopAll } from "../services/speech";
import VolumeControl from "../components/VolumeControl";
import { addStudySeconds, markStudyActivity } from "../services/studyTime";
import { lookupIndex } from "../store/dicts";
import { markWord } from "../store/repo";

type Loaded = { sentences: DictationSentence[]; source: FeedSource } | { error: string } | null;

/** 整句听写：听一句、打一句，提交后逐词比对；一组结束后可把出错的词加入 Mark */
export default function DictationPage() {
  const { t, settings, update } = useSettings();
  const level = settings.dictationLevel;
  const rText = roleText(defaultRole(settings.dictIds), t("scenario.general"));
  const [loaded, setLoaded] = useState<Loaded>(null);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [results, setResults] = useState<SentenceDiff[]>([]);
  const [hint, setHint] = useState(false);
  const [marked, setMarked] = useState<Set<string>>(new Set());
  /** 用户在总结里勾选 / 取消的词（未操作的按默认勾选） */
  const [picked, setPicked] = useState<Map<string, boolean>>(new Map());
  const inputRef = useRef<InputRef>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (force: boolean) => {
      setLoaded(null);
      setIndex(0);
      setInput("");
      setResults([]);
      setHint(false);
      setMarked(new Set());
      setPicked(new Map());
      // 只采用最后一次请求的结果
      const id = ++requestId.current;
      const res = await loadDictation(rText, settings.locale, level, force).catch((err: Error) => ({ error: err.message }));
      if (id === requestId.current) setLoaded(res);
    },
    [rText, settings.locale, level],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  const sentences = loaded && "sentences" in loaded ? loaded.sentences : [];
  const current = sentences[index];
  const result = results[index];
  const finished = sentences.length > 0 && index >= sentences.length;

  const play = useCallback(
    (slow = false) => {
      if (!current) return;
      void speakSentence(current.text, { accent: settings.accent, voice: settings.sentenceVoice, rate: slow ? 0.75 : 1 }).catch(() => undefined);
    },
    [current, settings.accent, settings.sentenceVoice],
  );

  // 换句时自动播放并聚焦输入框
  useEffect(() => {
    if (!current) return;
    if (settings.autoPlay) play();
    inputRef.current?.focus();
    // 后台准备下一句的云端音频
    const upcoming = sentences[index + 1];
    if (upcoming) void preloadSentence(upcoming.text, settings.sentenceVoice);
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在换句时触发
  }, [current]);

  // Ctrl+J 重播，Ctrl+K 慢速
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "j") play();
      else if (k === "k") play(true);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [play]);

  // 计入每日学习时长（有按键才算）
  useEffect(() => {
    const timer = window.setInterval(() => addStudySeconds(5), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const submit = () => {
    if (!current || !input.trim()) return;
    const diff = diffSentence(current.text, input);
    setResults((r) => {
      const next = r.slice();
      next[index] = diff;
      return next;
    });
    // 拼错的词计入字母级错误分析
    void recordDictationMistakes(diff, current.text);
  };

  const next = () => {
    setIndex((i) => i + 1);
    setInput("");
    setHint(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    markStudyActivity();
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (result) next();
    else submit();
  };

  // 值得加入 Mark 的词：去掉功能词；拼错的词与句子的目标词默认勾选
  const candidates = markCandidates(results.map((diff, i) => ({ diff, target: sentences[i]?.word })));
  const isPicked = (w: string, preselect: boolean) => picked.get(w) ?? preselect;
  const selected = candidates.filter((c) => isPicked(c.word, c.preselect) && !marked.has(c.word));

  const addToMarks = async () => {
    const index = await lookupIndex("en");
    const done = new Set(marked);
    for (const c of selected) {
      // 词形变化时尝试找原形（meetings → meeting，moved → move）
      const item = lemmaCandidates(c.word).map((x) => index.get(x)).find(Boolean);
      if (!item) continue;
      await markWord(item, c.reason);
      done.add(c.word);
    }
    setMarked(done);
  };

  const avg = results.length ? Math.round((results.reduce((s, d) => s + d.accuracy, 0) / results.length) * 100) : 0;

  return (
    <main className="page dictation-page">
      <PracticeTabs />
      <p className="muted">{t("dictation.desc")}</p>

      <section className="panel dictation-toolbar">
        <span>{t("dictation.level")}</span>
        <Radio.Group variant="default-filled" value={level} onChange={(v) => void update("dictationLevel", v as FeedLevel)}>
          <Radio.Button value="simple">{t("feed.level.simple")}</Radio.Button>
          <Radio.Button value="medium">{t("feed.level.medium")}</Radio.Button>
        </Radio.Group>
        <Button variant="text" icon={<RefreshIcon />} disabled={!loaded || ("source" in loaded && loaded.source !== "ai")} onClick={() => void load(true)}>
          {t("dictation.newSet")}
        </Button>
      </section>

      {loaded && "source" in loaded && loaded.source === "builtin" && (
        <Alert theme="info" message={t("dictation.builtin")} operation={<Link to="/settings?tab=ai">{t("ai.configure")} →</Link>} />
      )}
      {loaded && "error" in loaded && <Alert theme="error" message={loaded.error} />}
      {!loaded && <Loading text={t("dictation.loading")} />}

      {current && (
        <section className="panel dictation-card">
          <div className="dictation-progress">
            <Progress percentage={Math.round(((index + (result ? 1 : 0)) / sentences.length) * 100)} label={false} />
            <span className="muted">
              {index + 1} / {sentences.length}
            </span>
          </div>

          <div className="dictation-play">
            <Button shape="circle" size="large" theme="primary" icon={<PlayCircleIcon />} onClick={() => play()} aria-label={t("dictation.play")} />
            <Button variant="outline" onClick={() => play(true)}>
              {t("dictation.slow")}
            </Button>
            <VolumeControl size="medium" />
            <Button variant="text" onClick={() => setHint((h) => !h)} disabled={Boolean(result)}>
              {hint ? t("dictation.hideHint") : t("dictation.hint")}
            </Button>
          </div>
          {(hint || result) && <p className="dictation-translation">{current.translation}</p>}

          <Input
            ref={inputRef}
            size="large"
            value={input}
            onChange={(v) => setInput(String(v))}
            onKeydown={(_, { e }) => onKeyDown(e as KeyboardEvent<HTMLInputElement>)}
            readonly={Boolean(result)}
            placeholder={t("dictation.placeholder")}
            className="dictation-input"
            autocomplete="off"
            spellCheck={false}
          />

          {result && (
            <div className="dictation-result">
              <DiffView diff={result} />
              <div className="dictation-score">
                <Tag theme={result.accuracy === 1 ? "success" : result.accuracy >= 0.7 ? "warning" : "danger"} variant="light">
                  {result.accuracy === 1 ? t("dictation.perfect") : t("dictation.accuracy", { pct: Math.round(result.accuracy * 100) })}
                </Tag>
                {missedWords(result).length > 0 && <span className="muted">{t("dictation.missed", { words: missedWords(result).join(", ") })}</span>}
              </div>
            </div>
          )}

          <div className="dictation-actions">
            {result ? (
              <Button theme="primary" onClick={next}>
                {index + 1 < sentences.length ? t("dictation.next") : t("dictation.finish")} ↵
              </Button>
            ) : (
              <Button theme="primary" disabled={!input.trim()} onClick={submit}>
                {t("dictation.check")} ↵
              </Button>
            )}
          </div>
          <p className="muted dictation-tip">{t("dictation.tip")}</p>
        </section>
      )}

      {finished && (
        <section className="panel dictation-summary">
          <h2>{t("dictation.summary", { pct: avg })}</h2>
          {candidates.length > 0 ? (
            <>
              <p className="muted">{t("dictation.summaryMissed")}</p>
              <div className="word-chips">
                {candidates.map((c) => {
                  const done = marked.has(c.word);
                  const on = done || isPicked(c.word, c.preselect);
                  return (
                    <Tag
                      key={c.word}
                      className="dictation-chip"
                      variant={on ? "light" : "outline"}
                      theme={done ? "success" : on ? (c.reason === "spelling" ? "danger" : "primary") : "default"}
                      onClick={() => !done && setPicked((m) => new Map(m).set(c.word, !on))}
                    >
                      {c.word}
                    </Tag>
                  );
                })}
              </div>
              <div className="add-actions">
                <Button variant="outline" disabled={!selected.length} onClick={() => void addToMarks()}>
                  {t("dictation.markSelected", { count: selected.length })}
                </Button>
              </div>
              <p className="muted setting-tip">{t("dictation.markTip")}</p>
            </>
          ) : (
            <p>{t("dictation.allCorrect")}</p>
          )}
          <div className="add-actions">
            <Button theme="primary" onClick={() => void load(loaded !== null && "source" in loaded && loaded.source === "ai")}>
              {t("dictation.again")}
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
