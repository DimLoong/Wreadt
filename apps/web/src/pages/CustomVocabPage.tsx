import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Input, Radio } from "tdesign-react";
import { useLiveQuery } from "dexie-react-hooks";
import { CUSTOM_DICT_ID, type Lang } from "@wreadt/core";
import { db } from "../store/db";
import { addCustomWord, deleteCustomWord } from "../store/repo";
import { useSettings } from "../context/settings";

const EMPTY = { answer: "", display: "", reading: "", phonetic: "", meanings: "" };

export default function CustomVocabPage() {
  const { t, update } = useSettings();
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>("en");
  const [form, setForm] = useState(EMPTY);
  const words = useLiveQuery(
    () => db.customWords.where("lang").equals(lang).filter((w) => !w.deleted).sortBy("createdAt"),
    [lang],
  );

  const set = (key: keyof typeof EMPTY) => (v: string | number) => setForm((f) => ({ ...f, [key]: String(v) }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const answer = form.answer.trim();
    if (!answer) return;
    await addCustomWord({
      lang,
      answer,
      display: form.display.trim() || undefined,
      reading: form.reading.trim() || undefined,
      phonetic: form.phonetic.trim() || undefined,
      meanings: form.meanings.split(/[;；]/).map((s) => s.trim()).filter(Boolean),
    });
    setForm(EMPTY);
  };

  const practice = async () => {
    await update("dictIds", [CUSTOM_DICT_ID[lang]]);
    navigate("/");
  };

  return (
    <main className="page">
      <h1>{t("custom.title")}</h1>
      <p className="muted">{t("custom.desc")}</p>

      <Radio.Group variant="default-filled" value={lang} onChange={(v) => setLang(v as Lang)}>
        <Radio.Button value="en">English</Radio.Button>
        <Radio.Button value="ja">日本語</Radio.Button>
      </Radio.Group>

      <form className="panel form-grid" onSubmit={onSubmit}>
        <Input value={form.answer} onChange={set("answer")} maxlength={40} placeholder={t("custom.answer")} aria-label={t("custom.answer")} />
        {lang === "ja" ? (
          <>
            <Input value={form.display} onChange={set("display")} placeholder={t("custom.display")} aria-label={t("custom.display")} />
            <Input value={form.reading} onChange={set("reading")} placeholder={t("custom.reading")} aria-label={t("custom.reading")} />
          </>
        ) : (
          <Input value={form.phonetic} onChange={set("phonetic")} placeholder={t("custom.phonetic")} aria-label={t("custom.phonetic")} />
        )}
        <Input value={form.meanings} onChange={set("meanings")} placeholder={t("custom.meanings")} aria-label={t("custom.meanings")} />
        <Button type="submit" theme="primary" disabled={!form.answer.trim()}>
          {t("custom.add")}
        </Button>
      </form>

      <section className="panel">
        <div className="panel-head">
          <h2>{t("custom.count", { count: words?.length ?? 0 })}</h2>
          <Button variant="outline" onClick={practice} disabled={!words?.length}>
            {t("custom.practice")}
          </Button>
        </div>
        {words?.length === 0 && <p className="muted">{t("custom.empty")}</p>}
        <ul className="word-list">
          {words?.map((w) => (
            <li key={w.id}>
              <strong>{w.display || w.answer}</strong>
              {w.display && <span className="muted">{w.answer}</span>}
              <span className="muted">{w.reading || (w.phonetic && `/${w.phonetic}/`)}</span>
              <span className="word-list-meaning">{w.meanings.join("；")}</span>
              <Button size="small" variant="text" theme="danger" onClick={() => void deleteCustomWord(w.id)}>
                {t("custom.delete")}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
