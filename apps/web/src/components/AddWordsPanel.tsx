import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Button, Checkbox, Input, Radio, Tag, Textarea, Tooltip } from "tdesign-react";
import { useLiveQuery } from "dexie-react-hooks";
import { customWordToItem, isKanaText, kanaToRomaji, masteryLevel, wordKey, type AnalyzedWord, type ExtractedWord, type Lang, type WordFocus, type WordItem } from "@wreadt/core";
import { useSettings } from "../context/settings";
import { db } from "../store/db";
import { addCustomWord } from "../store/repo";
import { lookupIndex } from "../store/dicts";
import { AiUnavailableError, analyzeWords, extractWords } from "../services/ai";
import { detectLang, parseInput } from "../lib/addWords";
import AiProgress from "./AiProgress";

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

function fromExtracted(w: ExtractedWord): Draft {
  return {
    input: w.word,
    lang: "en",
    include: true,
    source: "ai",
    answer: w.word,
    display: "",
    reading: "",
    phonetic: w.phonetic,
    meanings: w.meanings.join("；"),
    example: w.example,
    exampleTrans: w.exampleTrans,
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

/** 一次最多交给 AI 挑词的字符数（约两三封邮件） */
const MAX_CHARS = 4000;
/** 粘贴了这么长的英文才出现“挑出生词” */
const LONG_TEXT = 80;

const valid = (d: Draft) => d.answer.trim() && d.meanings.trim() && (d.lang === "en" || /^[a-z' -]+$/i.test(d.answer.trim()));

/**
 * 添加词汇：输入单词或句子点选生词 → AI / 内置词库补全 → 加入我的词库；
 * 粘贴一大段英文时还可以让 AI 直接挑出生词（例句就用原文里的句子）
 */
export default function AddWordsPanel({ onLeave }: { onLeave?: () => void }) {
  const { t, settings } = useSettings();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  // 这批词为什么加：不认识 / 常读错
  const [focus, setFocus] = useState<WordFocus>("meaning");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ theme: "info" | "warning" | "success" | "error"; text: string; configure?: boolean } | null>(null);
  // 刚加入的词：可以马上练一组
  const [saved, setSaved] = useState<WordItem[]>([]);
  const recent = useLiveQuery(() => db.customWords.orderBy("answer").filter((w) => !w.deleted).toArray(), []);

  const lang = detectLang(text);
  const parsed = useMemo(() => parseInput(text, lang), [text, lang]);
  const selected = parsed.kind === "sentence" ? parsed.tokens.filter((_, i) => picked.has(i)) : parsed.items;
  const long = lang === "en" && text.trim().length >= LONG_TEXT;
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
            ? { theme: "info", text: t("add.noAi"), configure: true }
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

  // 粘贴的大段英文：AI 挑出值得学的词，已经掌握的不再挑
  const extract = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const cards = await db.cards.toArray();
      const mastered = new Set(cards.filter((c) => !c.deleted && masteryLevel(c) >= 3).map((c) => c.id));
      const list = (await extractWords(text.slice(0, MAX_CHARS), settings.locale)).filter((w) => !mastered.has(wordKey("en", w.word)));
      if (list.length) setDrafts(list.map(fromExtracted));
      else setNotice({ theme: "info", text: t("add.allKnown") });
    } catch (err) {
      // AI 没挑出词：提示直接在上面点选
      setNotice(err instanceof AiUnavailableError ? { theme: "info", text: t("add.noAiExtract"), configure: true } : { theme: "info", text: t("add.noneFound") });
    } finally {
      setBusy(false);
    }
  };

  const update = (i: number, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const save = async () => {
    const ok = drafts.filter((d) => d.include && valid(d));
    const items: WordItem[] = [];
    for (const d of ok) {
      const w = await addCustomWord({
        lang: d.lang,
        answer: d.answer.trim(),
        display: d.lang === "ja" ? d.display.trim() || undefined : undefined,
        reading: d.reading.trim() || undefined,
        phonetic: d.phonetic.trim() || undefined,
        meanings: d.meanings.split(/[;；]/).map((m) => m.trim()).filter(Boolean),
        examples: d.example.trim() ? [{ sentence: d.example.trim(), translation: d.exampleTrans.trim() }] : undefined,
        ...(focus === "pronunciation" ? { focus } : {}),
      });
      items.push(customWordToItem(w));
    }
    setSaved(items);
    setDrafts([]);
    setText("");
    setPicked(new Set());
    setNotice({ theme: "success", text: settings.mixCount > 0 ? t("add.saved", { count: ok.length, mix: settings.mixCount }) : t("add.savedNoMix", { count: ok.length }) });
  };

  const practice = () => {
    onLeave?.();
    navigate("/typing", { state: { practice: { key: `added-${Date.now()}`, title: t("add.practiceTitle"), words: saved } } });
  };

  const includeCount = drafts.filter((d) => d.include && valid(d)).length;

  return (
    <div className="add-panel">

      <section className="panel add-input">
        <Textarea
          value={text}
          onChange={(v) => {
            setText(String(v));
            setPicked(new Set());
            setSaved([]);
          }}
          placeholder={t("add.placeholder")}
          maxlength={MAX_CHARS}
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
          {long && (
            <Button className="pop-in" theme="primary" variant="outline" disabled={busy} onClick={() => void extract()}>
              {t("add.extract")}
            </Button>
          )}
        </div>
        {busy && <AiProgress task="analyze-words" />}
      </section>

      {notice && (
        <Alert
          theme={notice.theme}
          message={notice.text}
          operation={
            notice.configure ? (
              <Link to="/settings?tab=ai" onClick={onLeave}>{t("ai.configure")} →</Link>
            ) : notice.theme === "success" && saved.length > 0 ? (
              <a onClick={practice}>{t("add.practice", { count: saved.length })} →</a>
            ) : undefined
          }
        />
      )}

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
          <div className="add-focus">
            <span className="muted">{t("add.focus")}</span>
            <Radio.Group variant="default-filled" size="small" value={focus} onChange={(v) => setFocus(v as WordFocus)}>
              <Radio.Button value="meaning">{t("add.focus.meaning")}</Radio.Button>
              <Tooltip content={t("add.focusTip")} placement="top">
                <Radio.Button value="pronunciation">{t("add.focus.pronunciation")}</Radio.Button>
              </Tooltip>
            </Radio.Group>
          </div>
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

    </div>
  );
}
