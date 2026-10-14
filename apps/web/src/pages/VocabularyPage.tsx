import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Popconfirm, Radio, Tag } from "tdesign-react";
import { AddIcon, DeleteIcon, ChevronDownIcon, ChevronUpIcon } from "tdesign-icons-react";
import { useLiveQuery } from "dexie-react-hooks";
import { CUSTOM_DICT_ID, type DictCategory, type DictMeta, type Lang } from "@wreadt/core";
import { db } from "../store/db";
import { addDictExtras, deleteCustomWord, deleteUserDict } from "../store/repo";
import { loadDictWords } from "../store/dicts";
import { useSettings } from "../context/settings";
import { useDictMetas } from "../hooks/useDictMetas";
import { AiUnavailableError, expandDict } from "../services/ai";
import QuickAddDialog from "../components/QuickAddDialog";
import type { MessageKey } from "../i18n/messages";

const BUILTIN_GROUPS: DictCategory[] = ["role", "exam", "industry", "jlpt"];

/** 词库：我的词库（自己添加的词）、我创建的词库（AI 按场景生成）、内置词库；都可以加入或移出练习 */
export default function VocabularyPage() {
  const { t, settings, update } = useSettings();
  const navigate = useNavigate();
  const { metas } = useDictMetas();
  const [lang, setLang] = useState<Lang>("en");
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [expanding, setExpanding] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ theme: "success" | "error" | "info"; text: string } | null>(null);
  const words = useLiveQuery(() => db.customWords.where("lang").equals(lang).filter((w) => !w.deleted).sortBy("createdAt"), [lang]);
  const userDicts = useLiveQuery(async () => (await db.userDicts.toArray()).filter((d) => !d.deleted).sort((a, b) => b.createdAt - a.createdAt), []);

  const inPractice = (id: string) => settings.dictIds.includes(id);
  const togglePractice = (id: string) => {
    const next = inPractice(id) ? settings.dictIds.filter((x) => x !== id) : [...settings.dictIds, id];
    if (next.length) void update("dictIds", next);
  };
  const practiceOnly = async (id: string) => {
    await update("dictIds", [id]);
    navigate("/typing");
  };

  const expand = async (meta: DictMeta) => {
    setExpanding(meta.id);
    setNotice(null);
    try {
      const existing = await loadDictWords(meta.id);
      const entries = await expandDict(meta, existing.map((w) => w.answer), settings.locale);
      await addDictExtras(meta.id, meta.lang, entries);
      setNotice({ theme: "success", text: t("progress.expanded", { name: meta.name, count: entries.length }) });
    } catch (err) {
      setNotice(err instanceof AiUnavailableError ? { theme: "info", text: t("ai.unavailable") } : { theme: "error", text: (err as Error).message });
    } finally {
      setExpanding(null);
    }
  };

  const remove = async (id: string) => {
    await deleteUserDict(id);
    const next = settings.dictIds.filter((x) => x !== id);
    await update("dictIds", next.length ? next : ["cet4"]);
  };

  const list = (words ?? []).slice().reverse();
  const shown = showAll ? list : list.slice(0, 12);
  const metaOf = (id: string) => metas.find((m) => m.id === id);

  const practiceButton = (id: string, disabled = false) => (
    <Button size="small" variant={inPractice(id) ? "base" : "outline"} theme={inPractice(id) ? "primary" : "default"} disabled={disabled} onClick={() => togglePractice(id)}>
      {inPractice(id) ? t("vocab.inPractice") : t("vocab.addToPractice")}
    </Button>
  );

  return (
    <main className="page vocab-page">
      <h1>{t("vocab.title")}</h1>
      <p className="muted">{t("vocab.desc")}</p>
      {notice && <Alert theme={notice.theme} message={notice.text} closeBtn onClose={() => setNotice(null)} />}

      {/* 我的词库 */}
      <section className="panel">
        <div className="panel-head">
          <h2>{t("vocab.mine")}</h2>
          <div className="vocab-actions">
            <Radio.Group variant="default-filled" size="small" value={lang} onChange={(v) => setLang(v as Lang)}>
              <Radio.Button value="en">English</Radio.Button>
              <Radio.Button value="ja">日本語</Radio.Button>
            </Radio.Group>
            <Button size="small" theme="primary" icon={<AddIcon />} onClick={() => setAdding(true)}>
              {t("vocab.addWords")}
            </Button>
            {practiceButton(CUSTOM_DICT_ID[lang], !words?.length)}
          </div>
        </div>
        <p className="muted">{t("custom.count", { count: words?.length ?? 0 })}</p>
        {words?.length === 0 && <p className="muted">{t("custom.empty")}</p>}
        <ul className="word-list">
          {shown.map((w) => (
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
        {list.length > 12 && (
          <Button variant="text" size="small" icon={showAll ? <ChevronUpIcon /> : <ChevronDownIcon />} onClick={() => setShowAll((v) => !v)}>
            {showAll ? t("vocab.collapse") : t("vocab.showAll", { count: list.length })}
          </Button>
        )}
      </section>

      {/* 我创建的词库 */}
      <section className="panel">
        <div className="panel-head">
          <h2>{t("vocab.created")}</h2>
          <Button theme="primary" variant="outline" icon={<AddIcon />} onClick={() => navigate("/vocabulary/new")}>
            {t("vocab.create")}
          </Button>
        </div>
        {userDicts?.length === 0 && (
          <button type="button" className="vocab-create-empty" onClick={() => navigate("/vocabulary/new")}>
            <strong>{t("vocab.createTitle")}</strong>
            <span className="muted">{t("vocab.createDesc")}</span>
          </button>
        )}
        <div className="vocab-grid">
          {userDicts?.map((d) => (
            <Card key={d.id} bordered className="vocab-card">
              <div className="vocab-card-head">
                <strong>{d.name}</strong>
                <span className="muted">{t("dict.words", { count: metaOf(d.id)?.size ?? 0 })}</span>
              </div>
              <p className="muted vocab-card-desc">{d.description}</p>
              <div className="word-chips">
                {d.topics.slice(0, 6).map((topic) => (
                  <Tag key={topic} size="small" variant="light">
                    {topic}
                  </Tag>
                ))}
              </div>
              <div className="vocab-card-actions">
                {practiceButton(d.id)}
                <Button size="small" variant="text" onClick={() => void practiceOnly(d.id)}>
                  {t("vocab.practiceNow")}
                </Button>
                <Button size="small" variant="text" loading={expanding === d.id} onClick={() => metaOf(d.id) && void expand(metaOf(d.id)!)}>
                  {t("progress.expand")}
                </Button>
                <Popconfirm content={t("vocab.deleteConfirm", { name: d.name })} onConfirm={() => void remove(d.id)}>
                  <Button size="small" variant="text" theme="danger" icon={<DeleteIcon />} aria-label={t("custom.delete")} />
                </Popconfirm>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 内置词库 */}
      <section className="panel">
        <h2>{t("vocab.builtin")}</h2>
        {BUILTIN_GROUPS.map((group) => (
          <div key={group} className="vocab-group">
            <div className="muted vocab-group-title">{t(`dict.${group}` as MessageKey)}</div>
            <div className="vocab-grid compact">
              {metas
                .filter((m) => m.category === group)
                .map((m) => (
                  <Card key={m.id} bordered className={`vocab-card ${inPractice(m.id) ? "selected" : ""}`}>
                    <div className="vocab-card-head">
                      <strong>{m.name}</strong>
                      <span className="muted">{t("dict.words", { count: m.size })}</span>
                    </div>
                    <p className="muted vocab-card-desc">{m.description}</p>
                    <div className="vocab-card-actions">
                      {practiceButton(m.id)}
                      {m.category === "role" && (
                        <Button size="small" variant="text" loading={expanding === m.id} onClick={() => void expand(m)}>
                          {t("progress.expand")}
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        ))}
      </section>

      <QuickAddDialog visible={adding} onClose={() => setAdding(false)} />
    </main>
  );
}
