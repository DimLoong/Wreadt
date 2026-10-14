import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Button, Checkbox, Input, Radio, Steps, Tag, Textarea } from "tdesign-react";
import { AddIcon, RefreshIcon } from "tdesign-icons-react";
import type { DictOutline, QwertyEntry, UserDict } from "@wreadt/core";
import { useSettings } from "../context/settings";
import { AiUnavailableError, generateDictOutline, generateDictWords } from "../services/ai";
import { saveUserDict } from "../store/repo";
import type { MessageKey } from "../i18n/messages";

/** 常见场景：点一下填入描述，用户再按自己的情况改 */
const SCENARIOS = ["livestream", "crossBorder", "trade", "hotel", "restaurant", "studyAbroad", "travel", "interview"] as const;
const SIZES = [30, 60, 100];
/** 同时生成的主题数，避免触发限流 */
const CONCURRENCY = 3;

type Level = "basic" | "advanced";
interface Topic {
  title: string;
  examples: string[];
  on: boolean;
}
type TopicState = { status: "loading" } | { status: "done"; entries: QwertyEntry[] } | { status: "error"; message: string };

/**
 * 用 AI 创建词库：
 * 1. 用母语描述场景（可点常见场景、可粘贴资料）；
 * 2. AI 拆成主题，用户勾选 / 补充主题、选难度与词量；
 * 3. 按主题生成词条，预览后保存。
 */
export default function DictWizardPage() {
  const { t, settings, update } = useSettings();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | "unavailable" | null>(null);
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [level, setLevel] = useState<Level>("basic");
  const [size, setSize] = useState(60);
  const [results, setResults] = useState<Record<string, TopicState>>({});
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<UserDict | null>(null);

  const fail = (err: unknown) => setError(err instanceof AiUnavailableError ? "unavailable" : (err as Error).message);

  const outline = async () => {
    setBusy(true);
    setError(null);
    try {
      const o: DictOutline = await generateDictOutline(description.trim(), "en", settings.locale);
      setName(o.name);
      setSummary(o.description);
      setTopics(o.topics.map((x) => ({ ...x, on: true })));
      setStep(1);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const addTopic = () => {
    const title = newTopic.trim();
    if (!title || topics.some((x) => x.title === title)) return;
    setTopics([...topics, { title, examples: [], on: true }]);
    setNewTopic("");
  };

  const chosen = topics.filter((x) => x.on);
  const perTopic = Math.max(4, Math.ceil(size / Math.max(1, chosen.length)));
  const dictText = `${name}：${summary || description.trim().slice(0, 120)}`;

  /** 生成一个主题的词条，排除其他主题已经生成的词 */
  const generateTopic = async (topic: Topic, exclude: string[]) => {
    setResults((r) => ({ ...r, [topic.title]: { status: "loading" } }));
    try {
      const entries = await generateDictWords(dictText, topic, level, settings.locale, perTopic, exclude);
      setResults((r) => ({ ...r, [topic.title]: { status: "done", entries } }));
      return entries.map((e) => e.name);
    } catch (err) {
      setResults((r) => ({ ...r, [topic.title]: { status: "error", message: err instanceof AiUnavailableError ? t("ai.unavailable") : (err as Error).message } }));
      return [];
    }
  };

  const generateAll = async () => {
    setStep(2);
    setResults({});
    setExcluded(new Set());
    const queue = chosen.slice();
    const seen: string[] = [];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (queue.length) {
          const topic = queue.shift()!;
          seen.push(...(await generateTopic(topic, [...seen])));
        }
      }),
    );
  };

  const allEntries = chosen.flatMap((x) => {
    const r = results[x.title];
    return r?.status === "done" ? r.entries : [];
  });
  // 几个主题同时生成时可能出现同一个词：按主题顺序保留第一次出现的，后面的标为重复、不保存
  const firstTopic = new Map<string, string>();
  for (const e of allEntries) if (!firstTopic.has(e.name.toLowerCase())) firstTopic.set(e.name.toLowerCase(), e.topic ?? "");
  const isDuplicate = (e: QwertyEntry) => firstTopic.get(e.name.toLowerCase()) !== (e.topic ?? "");
  const keep = allEntries.filter((e) => !excluded.has(e.name) && !isDuplicate(e));
  const generating = chosen.some((x) => results[x.title]?.status === "loading");

  const save = async () => {
    setBusy(true);
    try {
      const dict = await saveUserDict({ name: name.trim() || t("wizard.defaultName"), description: summary.trim(), lang: "en", topics: chosen.map((x) => x.title) }, keep);
      setSaved(dict);
      setStep(3);
    } finally {
      setBusy(false);
    }
  };

  const toggleWord = (w: string) =>
    setExcluded((s) => {
      const next = new Set(s);
      if (next.has(w)) next.delete(w);
      else next.add(w);
      return next;
    });

  return (
    <main className="page narrow wizard-page">
      <div className="wizard-head">
        <h1>{t("wizard.title")}</h1>
        <Link to="/vocabulary">← {t("vocab.title")}</Link>
      </div>
      <Steps current={Math.min(step, 2)} readonly className="wizard-steps">
        <Steps.StepItem title={t("wizard.step.describe")} />
        <Steps.StepItem title={t("wizard.step.topics")} />
        <Steps.StepItem title={t("wizard.step.words")} />
      </Steps>

      {error === "unavailable" && (
        <Alert
          theme="info"
          message={t("ai.unavailable")}
          operation={
            <span className="alert-links">
              <Link to="/settings">{t("ai.configure")} →</Link>
              <Link to="/account">{t("ai.login")} →</Link>
            </span>
          }
        />
      )}
      {error && error !== "unavailable" && <Alert theme="error" message={error} />}

      {step === 0 && (
        <section className="panel wizard-panel">
          <p>{t("wizard.describe")}</p>
          <div className="word-chips">
            {SCENARIOS.map((s) => (
              <Tag key={s} className="wizard-scenario" variant="outline" onClick={() => setDescription(t(`wizard.scenario.${s}.text` as MessageKey))}>
                {t(`wizard.scenario.${s}` as MessageKey)}
              </Tag>
            ))}
          </div>
          <Textarea
            value={description}
            onChange={(v) => setDescription(String(v))}
            placeholder={t("wizard.placeholder")}
            autosize={{ minRows: 4, maxRows: 12 }}
            maxlength={2000}
          />
          <p className="muted setting-tip">{t("wizard.describeTip")}</p>
          <div className="add-actions">
            <Button theme="primary" loading={busy} disabled={description.trim().length < 4} onClick={() => void outline()}>
              {t("wizard.toTopics")}
            </Button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="panel wizard-panel">
          <div className="wizard-fields">
            <Input value={name} onChange={(v) => setName(String(v))} placeholder={t("wizard.name")} maxlength={20} />
            <Input value={summary} onChange={(v) => setSummary(String(v))} placeholder={t("wizard.summary")} maxlength={60} />
          </div>
          <p>{t("wizard.topicsTip")}</p>
          <div className="wizard-topics">
            {topics.map((x, i) => (
              <label key={x.title} className={`wizard-topic ${x.on ? "" : "off"}`}>
                <Checkbox checked={x.on} onChange={(v) => setTopics(topics.map((y, j) => (j === i ? { ...y, on: Boolean(v) } : y)))} />
                <div>
                  <strong>{x.title}</strong>
                  {x.examples.length > 0 && (
                    <div className="muted wizard-examples" lang="en">
                      {x.examples.join(" · ")}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
          <div className="wizard-add-topic">
            <Input value={newTopic} onChange={(v) => setNewTopic(String(v))} onEnter={addTopic} placeholder={t("wizard.addTopic")} maxlength={16} />
            <Button variant="outline" icon={<AddIcon />} disabled={!newTopic.trim()} onClick={addTopic}>
              {t("wizard.add")}
            </Button>
          </div>
          <div className="setting-row">
            <span>{t("wizard.level")}</span>
            <Radio.Group variant="default-filled" value={level} onChange={(v) => setLevel(v as Level)}>
              <Radio.Button value="basic">{t("wizard.level.basic")}</Radio.Button>
              <Radio.Button value="advanced">{t("wizard.level.advanced")}</Radio.Button>
            </Radio.Group>
          </div>
          <div className="setting-row">
            <span>{t("wizard.size")}</span>
            <Radio.Group variant="default-filled" value={size} onChange={(v) => setSize(Number(v))}>
              {SIZES.map((n) => (
                <Radio.Button key={n} value={n}>
                  {t("dict.words", { count: n })}
                </Radio.Button>
              ))}
            </Radio.Group>
          </div>
          <div className="add-actions">
            <Button variant="outline" onClick={() => setStep(0)}>
              {t("welcome.back")}
            </Button>
            <Button theme="primary" disabled={!chosen.length} onClick={() => void generateAll()}>
              {t("wizard.generate", { count: chosen.length })}
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="panel wizard-panel">
          <p className="muted">{generating ? t("wizard.generating") : t("wizard.previewTip")}</p>
          {chosen.map((x) => {
            const r = results[x.title];
            return (
              <div key={x.title} className="wizard-group">
                <div className="wizard-group-head">
                  <strong>{x.title}</strong>
                  {r?.status === "loading" && <span className="muted">{t("wizard.loading")}</span>}
                  {r?.status === "done" && <span className="muted">{t("dict.words", { count: r.entries.filter((e) => !excluded.has(e.name) && !isDuplicate(e)).length })}</span>}
                  {r?.status === "error" && (
                    <>
                      <span className="wizard-error">{r.message}</span>
                      <Button size="small" variant="text" icon={<RefreshIcon />} onClick={() => void generateTopic(x, allEntries.map((e) => e.name))}>
                        {t("feed.reload")}
                      </Button>
                    </>
                  )}
                </div>
                {r?.status === "done" && (
                  <ul className="wizard-words">
                    {r.entries.map((e) => {
                      const dup = isDuplicate(e);
                      const off = excluded.has(e.name) || dup;
                      const trans = Array.isArray(e.trans) ? e.trans.join("；") : (e.trans ?? "");
                      return (
                        <li key={e.name} className={off ? "off" : ""}>
                          <Checkbox checked={!off} disabled={dup} onChange={() => toggleWord(e.name)} />
                          {dup && (
                            <Tag size="small" variant="outline">
                              {t("wizard.duplicate", { topic: firstTopic.get(e.name.toLowerCase()) ?? "" })}
                            </Tag>
                          )}
                          <strong lang="en">{e.name}</strong>
                          {e.usphone && <span className="muted">/{e.usphone}/</span>}
                          <span className="wizard-trans">{trans}</span>
                          {e.example && (
                            <span className="muted wizard-example" lang="en">
                              {e.example}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
          <div className="add-actions">
            <Button variant="outline" disabled={generating} onClick={() => setStep(1)}>
              {t("welcome.back")}
            </Button>
            <Button theme="primary" loading={busy} disabled={generating || !keep.length} onClick={() => void save()}>
              {t("wizard.save", { count: keep.length })}
            </Button>
          </div>
        </section>
      )}

      {step === 3 && saved && (
        <section className="panel wizard-panel">
          <Alert theme="success" message={t("wizard.saved", { name: saved.name, count: keep.length })} />
          <div className="add-actions">
            <Button
              theme="primary"
              onClick={() => {
                void update("dictIds", [saved.id]);
                navigate("/typing");
              }}
            >
              {t("vocab.practiceNow")}
            </Button>
            <Button variant="outline" onClick={() => void update("dictIds", [...new Set([...settings.dictIds, saved.id])])}>
              {settings.dictIds.includes(saved.id) ? t("vocab.inPractice") : t("vocab.addToPractice")}
            </Button>
            <Button variant="text" onClick={() => navigate("/vocabulary")}>
              {t("wizard.backToList")}
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
