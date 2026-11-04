import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Tag } from "tdesign-react";
import { bracketChunks, isTargetForm, State, type UseWordsItem, type WordItem } from "@wreadt/core";
import { db } from "../store/db";
import { lookupIndex } from "../store/dicts";
import { markWord } from "../store/repo";
import { useSettings } from "../context/settings";
import { useSync } from "../context/sync";
import { AiUnavailableError, generateUseWords } from "../services/ai";
import { speakSentence, stopAll } from "../services/speech";
import { useChunkSpelling } from "../hooks/useChunkSpelling";
import { ChunkCapture, ChunkRow } from "../components/typing/ChunkSpelling";
import HotkeyBar from "../components/typing/HotkeyBar";
import PracticeTabs from "../components/PracticeTabs";
import AiProgress from "../components/AiProgress";

const MAX_WORDS = 10;

interface LearnedWord {
  word: string;
  meaning: string;
  item?: WordItem;
}

/** 最近学会的英文词：已进入复习阶段（拼对过、或标为已会）的词，最近复习的在前 */
async function learnedWords(): Promise<LearnedWord[]> {
  const cards = (await db.cards.toArray())
    .filter((c) => !c.deleted && c.state === State.Review && c.id.startsWith("en:"))
    .sort((a, b) => (b.lastReview ?? b.updatedAt) - (a.lastReview ?? a.updatedAt));
  const index = await lookupIndex("en");
  const custom = new Map((await db.customWords.toArray()).filter((w) => !w.deleted && w.lang === "en").map((w) => [w.answer.toLowerCase(), w]));
  const out: LearnedWord[] = [];
  for (const c of cards) {
    const name = c.id.slice(3);
    const item = index.get(name);
    const meaning = (custom.get(name)?.meanings[0] ?? item?.meanings[0] ?? "").trim();
    if (!meaning) continue;
    out.push({ word: custom.get(name)?.answer ?? item?.answer ?? name, meaning, item });
    if (out.length >= MAX_WORDS) break;
  }
  return out;
}

/** 一句：看中文，把括起来的目标词拼进英文；拼完按任意键下一句 */
function UseWordsStage({ item, index, total, onDone }: { item: UseWordsItem; index: number; total: number; onDone: (missed: string[]) => void }) {
  const { t, settings } = useSettings();
  const captureRef = useRef<HTMLInputElement>(null);
  const chunks = useMemo(() => bracketChunks(item.en), [item.en]);
  const plain = item.en.replace(/[[\]]/g, "");
  const say = () => void speakSentence(plain, { accent: settings.accent, voice: settings.sentenceVoice }).catch(() => undefined);
  const s = useChunkSpelling(chunks, {
    onComplete: () => settings.autoPlay && say(),
    onContinue: () => onDone(s.missed()),
  });
  // 跳过：没拼出来的词都算没用出来
  const skip = () => onDone(s.done ? s.missed() : [...new Set([...s.missed(), ...s.order.slice(s.pos).map((i) => chunks[i]!.text)])]);

  useEffect(() => {
    captureRef.current?.focus();
    return () => stopAll();
  }, []);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
      e.preventDefault();
      say();
      return true;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      skip();
      return true;
    }
    return false;
  };

  return (
    <div className="use-stage main-word practice-stage" onClick={() => captureRef.current?.focus()}>
      <ChunkCapture s={s} inputRef={captureRef} onKey={onKey} label={t("use.title")} />
      <span className="muted use-count">
        {index + 1} / {total}
      </span>
      <p className="sentence-zh">{item.zh}</p>
      <ChunkRow s={s} className="use-row" />
      <div className="typing-feedback" aria-live="polite">
        {s.done ? <span className="ok">{t(index + 1 < total ? "use.next" : "use.finish")}</span> : s.wrong !== null && <span className="hint">{t("cards.chunkWrong")}</span>}
      </div>
      <p className="muted hotkeys">
        <HotkeyBar
          items={[
            { id: "peek", keys: "Tab", label: t("hotkey.peek"), onClick: s.peekByClick, disabled: s.done },
            { id: "next", keys: "→↓", label: t(s.done ? "typing.next" : "use.skip"), onClick: skip },
            { id: "audio", keys: "Ctrl+J", label: t("use.listen"), onClick: say },
          ]}
        />
      </p>
    </div>
  );
}

/**
 * 用起来：认得却用不出来的词，放进几句日常的话里自己用一遍。
 * AI 用最近学会的词写几句话，看着中文把这些词拼进英文；用不出来的词加入 Mark（想用起来）。
 */
export default function UseWordsPage() {
  const { t, settings } = useSettings();
  const { session } = useSync();
  const [words, setWords] = useState<LearnedWord[] | null>(null);
  const [items, setItems] = useState<UseWordsItem[]>([]);
  const [at, setAt] = useState(0);
  const [missed, setMissed] = useState<string[][]>([]);
  const [marked, setMarked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    void learnedWords().then(setWords);
  }, []);

  const generate = async () => {
    if (!words?.length) return;
    setBusy(true);
    setError(null);
    setUnavailable(false);
    try {
      const list = await generateUseWords(
        words.map(({ word, meaning }) => ({ word, meaning })),
        settings.locale,
      );
      setItems(list);
      setAt(0);
      setMissed([]);
      setMarked([]);
    } catch (err) {
      if (err instanceof AiUnavailableError) setUnavailable(true);
      else setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const finishItem = async (miss: string[]) => {
    const all = [...missed, miss];
    setMissed(all);
    setAt(at + 1);
    if (at + 1 < items.length) return;
    // 一组结束：没用出来的词加入 Mark（想用起来），之后的打字组会穿插复习；已经 mark 过的保持原样
    const names = [...new Set(all.flat().map((text) => words?.find((w) => isTargetForm(text, w.word))?.word).filter((w): w is string => Boolean(w)))];
    const done: string[] = [];
    for (const name of names) {
      const item = words?.find((w) => w.word === name)?.item;
      if (item && !(await db.marks.get(item.id))) {
        await markWord(item, "usage");
        done.push(name);
      }
    }
    setMarked(done);
  };

  const playing = items.length > 0 && at < items.length;
  const finished = items.length > 0 && at >= items.length;

  return (
    <main className="page">
      <PracticeTabs />
      <p className="muted">{t("use.desc")}</p>

      {!playing && (
        <section className="panel">
          <div className="panel-head">
            <h2>{t("use.words")}</h2>
          </div>
          <div className="word-chips">
            {words?.map((w) => (
              <Tag key={w.word} closable title={w.meaning} onClose={() => setWords(words.filter((x) => x !== w))}>
                {w.word}
              </Tag>
            ))}
            {words?.length === 0 && <span className="muted">{t("use.noWords")}</span>}
          </div>
          <div className="word-add">
            <Button theme="primary" loading={busy} disabled={!words?.length} onClick={() => void generate()}>
              {items.length ? t("use.again") : t("use.start")}
            </Button>
          </div>
          {busy && <AiProgress task="use-words" />}
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
      )}

      {playing && (
        <section className="panel">
          <UseWordsStage key={at} item={items[at]!} index={at} total={items.length} onDone={(m) => void finishItem(m)} />
        </section>
      )}

      {finished && (
        <section className="panel practice-review">
          <h3>{t("use.reviewTitle")}</h3>
          <ul>
            {items.map((it, i) => (
              <li key={i}>
                <div className="practice-review-q">{it.zh}</div>
                <div className="practice-review-a" lang="en">
                  {bracketChunks(it.en).map((c, j) =>
                    c.given ? (
                      <span key={j}>{c.text}</span>
                    ) : (
                      <b key={j} className={missed[i]?.includes(c.text) ? "missed" : "used"}>
                        {c.text}
                      </b>
                    ),
                  )}
                </div>
              </li>
            ))}
          </ul>
          {marked.length > 0 && <p className="muted">{t("use.marked", { words: marked.join("、") })}</p>}
        </section>
      )}
    </main>
  );
}
