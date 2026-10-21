import { useEffect, useState, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Button, Input, Radio, Tag, Textarea } from "tdesign-react";
import type { Exercise, Lang } from "@wreadt/core";
import { db } from "../store/db";
import { useSettings } from "../context/settings";
import { useSync } from "../context/sync";
import { AiUnavailableError, generateExercises } from "../services/ai";
import { dictLang, normalizeSentence, splitWordId } from "../lib/words";
import type { MessageKey } from "../i18n/messages";
import PracticeTabs from "../components/PracticeTabs";

const MAX_WORDS = 8;

/** 最近复习过的该语言单词（去重，最新在前） */
async function recentWords(lang: Lang): Promise<string[]> {
  const logs = await db.reviewLogs.orderBy("reviewedAt").reverse().limit(300).toArray();
  const words: string[] = [];
  for (const log of logs) {
    const { dictId, name } = splitWordId(log.wordId);
    const word = name.split(/[/=]/)[0]!.trim();
    if (dictLang(dictId) === lang && !words.includes(word)) words.push(word);
    if (words.length >= MAX_WORDS) break;
  }
  return words;
}

function ExerciseCard({ ex }: { ex: Exercise }) {
  const { t } = useSettings();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | "revealed" | null>(null);

  const check = () => {
    if (ex.kind === "usage") return setResult("revealed");
    setResult(normalizeSentence(value) === normalizeSentence(ex.answer) ? "correct" : "wrong");
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && ex.kind !== "usage") {
      e.preventDefault();
      check();
    }
  };

  return (
    <article className="panel exercise">
      <div className="exercise-head">
        <Tag variant="light" theme="primary">{t(`sentence.kind.${ex.kind}` as MessageKey)}</Tag>
        <strong>{ex.word}</strong>
      </div>
      <p className="exercise-prompt">{ex.prompt}</p>
      {ex.kind === "usage" ? (
        <Textarea value={value} onChange={(v) => setValue(String(v))} placeholder={t("sentence.writePlaceholder")} autosize={{ minRows: 2 }} />
      ) : (
        <div onKeyDown={onKeyDown}>
          <Input value={value} onChange={(v) => setValue(String(v))} placeholder={t("sentence.answerPlaceholder")} status={result === "wrong" ? "error" : result === "correct" ? "success" : "default"} />
        </div>
      )}
      <div className="exercise-actions">
        {ex.kind !== "usage" && <Button variant="outline" onClick={check} disabled={!value.trim()}>{t("sentence.check")}</Button>}
        <Button variant="text" onClick={() => setResult("revealed")}>{t("sentence.reveal")}</Button>
        {result === "correct" && <span className="ok">{t("sentence.correct")}</span>}
        {result === "wrong" && <span className="hint">{t("sentence.wrong")}</span>}
      </div>
      {(result === "revealed" || result === "correct") && (
        <p className="exercise-answer">
          {t("sentence.reference", { answer: ex.answer })}
          <br />
          <span className="muted">{ex.explanation}</span>
        </p>
      )}
    </article>
  );
}

export default function SentencePracticePage() {
  const { t, settings } = useSettings();
  const { session } = useSync();
  const [params] = useSearchParams();
  const [lang, setLang] = useState<Lang>((params.get("lang") as Lang) || dictLang(settings.dictIds[0] ?? "") || "en");
  const [words, setWords] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const fromLink = params.get("word");
    void recentWords(lang).then((recent) => {
      const list = fromLink && params.get("lang") === lang ? [fromLink, ...recent.filter((w) => w !== fromLink)] : recent;
      setWords(list.slice(0, MAX_WORDS));
    });
  }, [lang, params]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setUnavailable(false);
    try {
      setExercises(await generateExercises(lang, words, settings.locale));
    } catch (err) {
      if (err instanceof AiUnavailableError) setUnavailable(true);
      else setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addWord = () => {
    const w = draft.trim();
    if (w && !words.includes(w) && words.length < 10) setWords([...words, w]);
    setDraft("");
  };

  return (
    <main className="page">
      <PracticeTabs />
      <p className="muted">{t("sentence.desc")}</p>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("sentence.words")}</h2>
          <Radio.Group variant="default-filled" value={lang} onChange={(v) => setLang(v as Lang)}>
            <Radio.Button value="en">English</Radio.Button>
            <Radio.Button value="ja">日本語</Radio.Button>
          </Radio.Group>
        </div>
        <div className="word-chips">
          {words.map((w) => (
            <Tag key={w} closable onClose={() => setWords(words.filter((x) => x !== w))}>
              {w}
            </Tag>
          ))}
          {words.length === 0 && <span className="muted">{t("sentence.noWords")}</span>}
        </div>
        <div className="word-add" onKeyDown={(e) => e.key === "Enter" && addWord()}>
          <Input value={draft} onChange={(v) => setDraft(String(v))} placeholder={t("sentence.addWord")} maxlength={64} />
          <Button theme="primary" loading={busy} disabled={!words.length} onClick={() => void generate()}>
            {exercises.length ? t("sentence.regenerate") : t("sentence.generate")}
          </Button>
        </div>
        {error && <Alert theme="error" message={error} style={{ marginTop: 12 }} />}
        {unavailable && (
          <Alert
            theme="info"
            style={{ marginTop: 12 }}
            message={session ? t("sentence.disabled") : t("ai.unavailable")}
            operation={
              <span className="alert-links">
                <Link to="/settings?tab=ai">{t("ai.configure")} →</Link>
                {!session && <Link to="/account">{t("ai.login")} →</Link>}
              </span>
            }
          />
        )}
      </section>

      {exercises.map((ex, i) => (
        <ExerciseCard key={`${ex.word}-${i}-${ex.prompt}`} ex={ex} />
      ))}
    </main>
  );
}
