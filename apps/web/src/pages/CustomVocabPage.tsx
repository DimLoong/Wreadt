import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Radio } from "tdesign-react";
import { useLiveQuery } from "dexie-react-hooks";
import { CUSTOM_DICT_ID, type Lang } from "@wreadt/core";
import { db } from "../store/db";
import { deleteCustomWord } from "../store/repo";
import { useSettings } from "../context/settings";
import AddWordsPanel from "../components/AddWordsPanel";

/** 我的词库：顶部直接添加词汇，下方是已添加的词 */
export default function CustomVocabPage() {
  const { t, update } = useSettings();
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>("en");
  const words = useLiveQuery(
    () => db.customWords.where("lang").equals(lang).filter((w) => !w.deleted).sortBy("createdAt"),
    [lang],
  );

  const practice = async () => {
    await update("dictIds", [CUSTOM_DICT_ID[lang]]);
    navigate("/typing");
  };

  return (
    <main className="page vocab-page">
      <h1>{t("custom.title")}</h1>
      <p className="muted">{t("add.desc")}</p>

      <AddWordsPanel />

      <section className="panel">
        <div className="panel-head">
          <Radio.Group variant="default-filled" value={lang} onChange={(v) => setLang(v as Lang)}>
            <Radio.Button value="en">English</Radio.Button>
            <Radio.Button value="ja">日本語</Radio.Button>
          </Radio.Group>
          <span className="muted">{t("custom.count", { count: words?.length ?? 0 })}</span>
          <Button variant="outline" onClick={() => void practice()} disabled={!words?.length}>
            {t("custom.practice")}
          </Button>
        </div>
        {words?.length === 0 && <p className="muted">{t("custom.empty")}</p>}
        <ul className="word-list">
          {words
            ?.slice()
            .reverse()
            .map((w) => (
              <li key={w.id}>
                <strong>{w.display || w.answer}</strong>
                {w.display && <span className="muted">{w.answer}</span>}
                <span className="muted">{w.reading || w.phonetic}</span>
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
