import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Checkbox, Input, Tag, Textarea } from "tdesign-react";
import { useLiveQuery } from "dexie-react-hooks";
import { isKanaText, kanaToRomaji, wordKey, type AnalyzedWord, type Lang, type WordItem } from "@wreadt/core";
import { useSettings } from "../context/settings";
import { db } from "../store/db";
import { addCustomWord } from "../store/repo";
import { lookupIndex } from "../store/dicts";
import { AiUnavailableError, analyzeWords } from "../services/ai";
import { detectLang, parseInput } from "../lib/addWords";

type Source = "ai" | "dict" | "manual";

interface Draft {
  input: string;
  lang: Lang;
  include: boolean;
  source: Source;
  answer: string;
  display: string;
  reading: string;
  phonetic: string;
  meanings: string;
  example: string;
  exampleTrans: string;
}

function fromDict(input: string, lang: Lang, w: WordItem, context?: string): Draft {
  const ex = w.examples?.[0];
  return {
    input,
    lang,
    include: true,
    source: "dict",
    answer: w.answer,
    display: lang === "ja" ? w.display.split("/")[0]! : "",
    reading: w.reading?.split("/")[0] ?? "",
    phonetic: w.phonetic ?? "",
    meanings: w.meanings.join("；"),
    example: context ?? ex?.sentence ?? "",
    exampleTrans: context ? "" : (ex?.translation ?? ""),
  };
}

function fromAi(a: AnalyzedWord, lang: Lang, known?: WordItem): Draft {
  return {
    input: a.input,
    lang,
    include: true,
    source: "ai",
    answer: lang === "ja" ? a.romaji : a.word,
    display: lang === "ja" ? a.word : "",
    reading: a.reading,
    phonetic: a.phonetic || known?.phonetic || "",
    meanings: a.meanings.join("；"),
    example: a.example,
    exampleTrans: a.exampleTrans,
  };
}

function manual(input: string, lang: Lang, context?: string): Draft {
  const kana = lang === "ja" && isKanaText(input);
  return {
    input,
    lang,
    include: true,
    source: "manual",
    answer: lang === "en" ? input.toLowerCase() : kana ? kanaToRomaji(input) : "",
    display: lang === "ja" ? input : "",
    reading: kana ? input : "",
    phonetic: "",
    meanings: "",
    example: context ?? "",
    exampleTrans: "",
  };
}

const valid = (d: Draft) => d.answer.trim() && d.meanings.trim() && (d.lang === "en" || /^[a-z' -]+$/i.test(d.answer.trim()));

export default function AddWordsPage() {
  const { t, settings } = useSettings();
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ theme: "info" | "warning" | "success" | "error"; text: string } | null>(null);
  const recent = useLiveQuery(() => db.customWords.orderBy("answer").filter((w) => !w.deleted).toArray(), []);

  const lang = detectLang(text);
  const parsed = useMemo(() => parseInput(text, lang), [text, lang]);
  const selected = parsed.kind === "sentence" ? parsed.tokens.filter((_, i) => picked.has(i)) : parsed.items;
  const existingKeys = useMemo(() => new Set((recent ?? []).map((w) => wordKey(w.lang, w.answer, w.display))), [recent]);

  const toggle = (i: number) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const analyze = async () => {
    const items = [...new Set(selected.map((s) => s.trim()).filter(Boolean))].slice(0, 10);
    if (!items.length) return;
    setBusy(true);
    setNotice(null);
    const context = parsed.kind === "sentence" ? text.trim() : undefined;
    try {
      const index = await lookupIndex(lang);
      let ai: AnalyzedWord[] | null = null;
      try {
        ai = await analyzeWords(lang, items, settings.locale, context);
      } catch (err) {
        setNotice(
          err instanceof AiUnavailableError
            ? { theme: "info", text: t("add.noAi") }
            : { theme: "warning", text: t("add.aiFailed", { message: (err as Error).message }) },
        );
      }
      setDrafts(
        items.map((input) => {
          const a = ai?.find((x) => x.input.toLowerCase() === input.toLowerCase()) ?? (ai?.length === items.length ? ai[items.indexOf(input)] : undefined);
          if (a) return fromAi(a, lang, index.get(a.word));
          const known = index.get(input);
          return known ? fromDict(input, lang, known, context) : manual(input, lang, context);
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  const update = (i: number, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const save = async () => {
    const ok = drafts.filter((d) => d.include && valid(d));
    for (const d of ok) {
      await addCustomWord({
        lang: d.lang,
        answer: d.answer.trim(),
        display: d.lang === "ja" ? d.display.trim() || undefined : undefined,
        reading: d.reading.trim() || undefined,
        phonetic: d.phonetic.trim() || undefined,
        meanings: d.meanings.split(/[;；]/).map((m) => m.trim()).filter(Boolean),
        examples: d.example.trim() ? [{ sentence: d.example.trim(), translation: d.exampleTrans.trim() }] : undefined,
      });
    }
    setDrafts([]);
    setText("");
    setPicked(new Set());
    setNotice({ theme: "success", text: settings.mixCount > 0 ? t("add.saved", { count: ok.length, mix: settings.mixCount }) : t("add.savedNoMix", { count: ok.length }) });
  };

  const includeCount = drafts.filter((d) => d.include && valid(d)).length;

  return (
    <main className="page add-page">
      <h1>{t("add.title")}</h1>
      <p className="muted">{t("add.desc")}</p>

      <section className="panel add-input">
        <Textarea
          value={text}
          onChange={(v) => {
            setText(String(v));
            setPicked(new Set());
          }}
          placeholder={t("add.placeholder")}
          autosize={{ minRows: 3, maxRows: 8 }}
          autofocus
          onKeydown={(_, { e }) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void analyze();
          }}
        />
        {parsed.kind === "sentence" && (
          <div className="token-picker">
            <span className="muted">{t("add.pickHint")}</span>
            <div className="tokens" lang={lang}>
              {parsed.tokens.map((tok, i) => (
                <button key={`${i}-${tok}`} type="button" className={picked.has(i) ? "picked" : ""} onClick={() => toggle(i)}>
                  {tok}
                </button>
              ))}
            </div>
          </div>
        )}
        {parsed.kind === "words" && parsed.items.length > 0 && (
          <div className="tokens static">
            {parsed.items.map((w) => (
              <Tag key={w} variant="light">
                {w}
              </Tag>
            ))}
          </div>
        )}
        <div className="add-actions">
          <Button theme="primary" loading={busy} disabled={!selected.length} onClick={() => void analyze()}>
            {t("add.analyze")} {selected.length ? `(${Math.min(selected.length, 10)})` : ""}
          </Button>
          <span className="muted">{lang === "ja" ? "日本語" : "English"} · ⌘/Ctrl + Enter</span>
        </div>
      </section>

      {notice && <Alert theme={notice.theme} message={notice.text} operation={notice.theme === "info" ? <Link to="/settings">{t("ai.configure")} →</Link> : undefined} />}

      {drafts.length > 0 && (
        <section className="panel drafts">
          {drafts.map((d, i) => {
            const exists = existingKeys.has(wordKey(d.lang, d.answer, d.display));
            return (
              <div key={`${d.input}-${i}`} className={`draft ${d.include ? "" : "excluded"}`}>
                <div className="draft-head">
                  <Checkbox checked={d.include} onChange={(v) => update(i, { include: Boolean(v) })} />
                  <strong>{d.input}</strong>
                  <Tag size="small" variant="light" theme={d.source === "ai" ? "primary" : d.source === "dict" ? "success" : "warning"}>
                    {t(`add.source.${d.source}`)}
                  </Tag>
                  {exists && <Tag size="small" variant="outline">{t("add.exists")}</Tag>}
                </div>
                <div className="draft-fields">
                  {d.lang === "ja" && <Input value={d.display} onChange={(v) => update(i, { display: String(v) })} placeholder={t("custom.display")} />}
                  {d.lang === "ja" && (
                    <Input
                      value={d.reading}
                      onChange={(v) => {
                        const reading = String(v);
                        update(i, isKanaText(reading) ? { reading, answer: kanaToRomaji(reading) } : { reading });
                      }}
                      placeholder={t("custom.reading")}
                    />
                  )}
                  <Input value={d.answer} onChange={(v) => update(i, { answer: String(v) })} placeholder={d.lang === "ja" ? t("add.romaji") : t("custom.answer")} status={d.answer.trim() ? "default" : "error"} />
                  {d.lang === "en" && <Input value={d.phonetic} onChange={(v) => update(i, { phonetic: String(v) })} placeholder={t("custom.phonetic")} />}
                  <Input className="wide" value={d.meanings} onChange={(v) => update(i, { meanings: String(v) })} placeholder={t("custom.meanings")} status={d.meanings.trim() ? "default" : "error"} />
                  <Input className="wide" value={d.example} onChange={(v) => update(i, { example: String(v) })} placeholder={t("add.example")} />
                  {d.example && <Input className="wide" value={d.exampleTrans} onChange={(v) => update(i, { exampleTrans: String(v) })} placeholder={t("add.exampleTrans")} />}
                </div>
              </div>
            );
          })}
          <div className="add-actions">
            <Button theme="primary" disabled={!includeCount} onClick={() => void save()}>
              {t("add.save", { count: includeCount })}
            </Button>
            <Button variant="text" onClick={() => setDrafts([])}>
              {t("add.cancel")}
            </Button>
          </div>
        </section>
      )}

      <p className="muted add-footer">
        {t("add.total", { count: recent?.length ?? 0 })} · <Link to="/vocabulary">{t("nav.custom")} →</Link>
      </p>
    </main>
  );
}
