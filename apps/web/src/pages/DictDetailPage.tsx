import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Input, Loading, Radio, Tag } from "tdesign-react";
import { SearchIcon, SoundIcon } from "tdesign-icons-react";
import { useLiveQuery } from "dexie-react-hooks";
import { isUserDict, masteryLevel, type WordItem } from "@wreadt/core";
import { useSettings } from "../context/settings";
import { useDictMetas } from "../hooks/useDictMetas";
import { db } from "../store/db";
import { addDictExtras, listDictExtras } from "../store/repo";
import { loadDictWords } from "../store/dicts";
import { pronounceWord } from "../services/speech";
import { speechText } from "../services/youdao";
import { AiUnavailableError, expandDict } from "../services/ai";
import type { MessageKey } from "../i18n/messages";

type Filter = "all" | "new" | "learning" | "mastered";
const PAGE = 60;
const LEVEL_THEME = ["default", "primary", "primary", "success"] as const;

/** 词库详情：浏览全部词条（搜索、按掌握程度筛选、发音），用户词库按主题分组 */
export default function DictDetailPage() {
  const { id = "" } = useParams();
  const { t, settings, update } = useSettings();
  const navigate = useNavigate();
  const { metas } = useDictMetas();
  const meta = metas.find((m) => m.id === id);
  const [words, setWords] = useState<WordItem[] | null>(null);
  const [topics, setTopics] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(PAGE);
  const [reload, setReload] = useState(0);
  const [expanding, setExpanding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const cards = useLiveQuery(() => db.cards.toArray(), []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadDictWords(id)
      .then(async (list) => {
        // 用户词库：按创建时的主题分组
        const topicMap = new Map<string, string>();
        if (isUserDict(id)) for (const e of await listDictExtras(id)) if (e.topic) topicMap.set(e.name.toLowerCase(), e.topic);
        if (!cancelled) {
          setWords(list);
          setTopics(topicMap);
        }
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [id, reload]);

  const cardMap = useMemo(() => new Map((cards ?? []).filter((c) => !c.deleted).map((c) => [c.id, c])), [cards]);
  const level = (w: WordItem) => masteryLevel(cardMap.get(w.id));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (words ?? []).filter((w) => {
      const lv = masteryLevel(cardMap.get(w.id));
      if (filter === "new" && lv !== 0) return false;
      if (filter === "learning" && (lv === 0 || lv === 3)) return false;
      if (filter === "mastered" && lv !== 3) return false;
      return !q || w.answer.toLowerCase().includes(q) || w.display.toLowerCase().includes(q) || w.meanings.join(" ").includes(q);
    });
  }, [words, query, filter, cardMap]);

  const counts = useMemo(() => {
    const c = { learned: 0, mastered: 0 };
    for (const w of words ?? []) {
      const lv = masteryLevel(cardMap.get(w.id));
      if (lv > 0) c.learned += 1;
      if (lv === 3) c.mastered += 1;
    }
    return c;
  }, [words, cardMap]);

  const inPractice = settings.dictIds.includes(id);
  const togglePractice = () => {
    const next = inPractice ? settings.dictIds.filter((x) => x !== id) : [...settings.dictIds, id];
    if (next.length) void update("dictIds", next);
  };

  const expand = async () => {
    if (!meta || !words) return;
    setExpanding(true);
    setNotice(null);
    try {
      const entries = await expandDict(meta, words.map((w) => w.answer), settings.locale);
      await addDictExtras(meta.id, meta.lang, entries);
      setNotice(t("progress.expanded", { name: meta.name, count: entries.length }));
      setReload((n) => n + 1);
    } catch (err) {
      setNotice(err instanceof AiUnavailableError ? t("ai.unavailable") : (err as Error).message);
    } finally {
      setExpanding(false);
    }
  };

  // 用户词库按主题分组显示；其他词库按原顺序
  const shown = filtered.slice(0, limit);
  const grouped = new Map<string, WordItem[]>();
  for (const w of shown) {
    const key = topics.size ? (topics.get(w.answer.toLowerCase()) ?? t("detail.otherTopic")) : "";
    grouped.set(key, [...(grouped.get(key) ?? []), w]);
  }
  const groups = [...grouped.entries()];

  return (
    <main className="page dict-detail-page">
      <Link to="/vocabulary" className="detail-back">
        ← {t("vocab.title")}
      </Link>
      <div className="detail-head">
        <div>
          <h1>{meta?.name ?? id}</h1>
          {meta?.description && <p className="muted">{meta.description}</p>}
          {words && <p className="muted">{t("detail.stats", { total: words.length, learned: counts.learned, mastered: counts.mastered })}</p>}
        </div>
        <div className="vocab-card-actions">
          <Button variant={inPractice ? "base" : "outline"} theme={inPractice ? "primary" : "default"} onClick={togglePractice}>
            {inPractice ? t("vocab.inPractice") : t("vocab.addToPractice")}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void update("dictIds", [id]);
              navigate("/typing");
            }}
          >
            {t("vocab.practiceNow")}
          </Button>
          {(meta?.category === "role" || meta?.category === "user") && (
            <Button variant="text" loading={expanding} onClick={() => void expand()}>
              {t("progress.expand")}
            </Button>
          )}
        </div>
      </div>
      {notice && <Alert theme="info" message={notice} closeBtn onClose={() => setNotice(null)} />}
      {error && <Alert theme="error" message={error} />}

      <section className="panel detail-tools">
        <Input value={query} onChange={(v) => setQuery(String(v))} placeholder={t("detail.search")} prefixIcon={<SearchIcon />} clearable style={{ width: 240 }} />
        <Radio.Group variant="default-filled" value={filter} onChange={(v) => setFilter(v as Filter)}>
          {(["all", "new", "learning", "mastered"] as Filter[]).map((f) => (
            <Radio.Button key={f} value={f}>
              {t(`detail.filter.${f}` as MessageKey)}
            </Radio.Button>
          ))}
        </Radio.Group>
        <span className="muted">{t("detail.count", { count: filtered.length })}</span>
      </section>

      {!words && !error && <Loading text={t("typing.loading")} />}

      {groups.map(([topic, list]) => (
        <section key={topic || "all"} className="panel">
          {topic && <h2>{topic}</h2>}
          <ul className="word-list detail-list">
            {list.map((w) => (
              <li key={w.id}>
                <button type="button" className="detail-say" aria-label={t("typing.replay")} onClick={() => void pronounceWord(speechText(w), w.lang, settings.accent).catch(() => undefined)}>
                  <SoundIcon />
                </button>
                <strong lang={w.lang}>{w.display}</strong>
                {w.lang === "ja" && w.answer !== w.display && <span className="muted">{w.answer}</span>}
                <span className="muted">{w.lang === "ja" ? w.reading : w.phonetic && `/${w.phonetic}/`}</span>
                <span className="word-list-meaning">{w.meanings.join("；")}</span>
                <Tag size="small" variant="light" theme={LEVEL_THEME[level(w)]}>
                  {t(`marks.level.${level(w)}` as MessageKey)}
                </Tag>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {filtered.length > limit && (
        <div className="detail-more">
          <Button variant="outline" onClick={() => setLimit((n) => n + PAGE * 2)}>
            {t("detail.more", { count: filtered.length - limit })}
          </Button>
        </div>
      )}
    </main>
  );
}
