import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, Button, Dropdown, Input, Radio, Select, Table, Tag, type PrimaryTableCol } from "tdesign-react";
import { DeleteIcon, DownloadIcon, PrintIcon, SearchIcon } from "tdesign-icons-react";
import { useLiveQuery } from "dexie-react-hooks";
import { MARK_REASONS, masteryLevel, type Mark, type MarkReason } from "@wreadt/core";
import { useDictMetas } from "../hooks/useDictMetas";
import { useSettings } from "../context/settings";
import { db } from "../store/db";
import { setMarkReason, unmarkWords } from "../store/repo";
import { startOfDay } from "../lib/date";
import { downloadText, marksToAnki, marksToCsv } from "../lib/exportMarks";
import type { FocusPractice } from "../lib/practiceState";
import ConfusableQuiz from "../components/marks/ConfusableQuiz";
import type { MessageKey } from "../i18n/messages";

type ReasonFilter = "all" | "none" | MarkReason;
type TimeFilter = "all" | "today" | "week" | "month";
type StatusFilter = "all" | "learning" | "mastered";

const DAY = 86_400_000;
const LEVEL_THEME = ["default", "primary", "primary", "success"] as const;


export default function MarksPage() {
  const { t, settings } = useSettings();
  const { name: dictName } = useDictMetas();
  const navigate = useNavigate();
  const marks = useLiveQuery(async () => (await db.marks.orderBy("createdAt").reverse().toArray()).filter((m) => !m.deleted), []);
  const cards = useLiveQuery(() => db.cards.toArray(), []);
  const [reason, setReason] = useState<ReasonFilter>("all");
  const [time, setTime] = useState<TimeFilter>("all");
  const [dict, setDict] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [quizWords, setQuizWords] = useState<Mark[] | null>(null);
  const [now] = useState(() => Date.now());

  const cardMap = useMemo(() => new Map((cards ?? []).filter((c) => !c.deleted).map((c) => [c.id, c])), [cards]);
  const level = (m: Mark) => masteryLevel(cardMap.get(m.id));
  const dicts = useMemo(() => [...new Set((marks ?? []).map((m) => m.word.dictId))], [marks]);

  const filtered = useMemo(() => {
    const since = time === "today" ? startOfDay(now) : time === "week" ? now - 7 * DAY : time === "month" ? now - 30 * DAY : 0;
    const q = query.trim().toLowerCase();
    return (marks ?? []).filter(
      (m) =>
        (reason === "all" || (reason === "none" ? !m.reason : m.reason === reason)) &&
        m.createdAt >= since &&
        (dict === "all" || m.word.dictId === dict) &&
        (status === "all" || (status === "mastered") === (masteryLevel(cardMap.get(m.id)) === 3)) &&
        (!q || m.word.answer.toLowerCase().includes(q) || m.word.display.toLowerCase().includes(q) || m.word.meanings.join(" ").includes(q)),
    );
  }, [marks, reason, time, dict, status, query, now, cardMap]);

  const mastered = (marks ?? []).filter((m) => level(m) === 3);
  const english = filtered.filter((m) => m.word.lang === "en");

  /** 进入打字页做专项练习 */
  const practice = (mode: FocusPractice["mode"], titleKey: MessageKey) => {
    const practiceState: FocusPractice = { key: `marks-${mode}-${Date.now()}`, title: t(titleKey), words: filtered.map((m) => m.word), mode };
    navigate("/typing", { state: { practice: practiceState } });
  };

  /** 进入场景问答，把这些词作为目标词（marked 优先） */
  const toScenario = () => {
    const targets = english.slice(0, 8).map((m) => ({ word: m.word.answer, meaning: m.word.meanings.join("；"), tag: "marked" as const }));
    navigate("/scenario", { state: { targets } });
  };

  // 按原因推荐的练法
  const recommended: Record<ReasonFilter, string> = { all: "normal", none: "normal", spelling: "spell", pronunciation: "listen", confusable: "quiz", usage: "scenario" };
  const primary = (key: string) => (recommended[reason] === key ? "primary" : "default");

  const columns: PrimaryTableCol<Mark>[] = [
    {
      colKey: "word",
      title: t("marks.col.word"),
      width: 220,
      cell: ({ row }) => (
        <div className="mark-word">
          <strong lang={row.word.lang}>{row.word.display}</strong>
          <span className="muted">{row.word.lang === "ja" ? row.word.reading : row.word.phonetic}</span>
        </div>
      ),
    },
    { colKey: "meanings", title: t("marks.col.meaning"), ellipsis: true, cell: ({ row }) => row.word.meanings.join("；") },
    {
      colKey: "reason",
      title: t("marks.col.reason"),
      width: 150,
      cell: ({ row }) => (
        <Select
          size="small"
          value={row.reason ?? "none"}
          borderless
          onChange={(v) => void setMarkReason(row.id, v === "none" ? undefined : (v as MarkReason))}
          options={[{ value: "none", label: t("marks.reason.none") }, ...MARK_REASONS.map((r) => ({ value: r, label: t(`marks.reason.${r}` as MessageKey) }))]}
        />
      ),
    },
    { colKey: "dict", title: t("marks.col.dict"), width: 120, cell: ({ row }) => dictName(row.word.dictId) },
    {
      colKey: "level",
      title: t("marks.col.level"),
      width: 100,
      cell: ({ row }) => (
        <Tag size="small" variant="light" theme={LEVEL_THEME[level(row)]}>
          {t(`marks.level.${level(row)}` as MessageKey)}
        </Tag>
      ),
    },
    { colKey: "createdAt", title: t("marks.col.time"), width: 120, cell: ({ row }) => new Date(row.createdAt).toLocaleDateString(settings.locale) },
    {
      colKey: "op",
      title: "",
      width: 60,
      cell: ({ row }) => <Button size="small" variant="text" shape="circle" icon={<DeleteIcon />} aria-label={t("marks.unmark")} onClick={() => void unmarkWords([row.id])} />,
    },
  ];

  return (
    <main className="page marks-page">
      <div className="marks-head">
        <h1>
          {t("marks.title")} <span className="muted">{marks?.length ?? 0}</span>
        </h1>
        <div className="marks-tools no-print">
          <Dropdown
            options={[
              { content: "CSV", value: "csv" },
              { content: t("marks.exportAnki"), value: "anki" },
            ]}
            onClick={({ value }) =>
              value === "csv"
                ? downloadText("wreadt-marks.csv", marksToCsv(filtered, dictName), "text/csv")
                : downloadText("wreadt-marks-anki.txt", marksToAnki(filtered), "text/plain")
            }
          >
            <Button variant="outline" icon={<DownloadIcon />} disabled={!filtered.length}>
              {t("marks.export")}
            </Button>
          </Dropdown>
          <Button variant="outline" icon={<PrintIcon />} disabled={!filtered.length} onClick={() => window.print()}>
            {t("marks.print")}
          </Button>
        </div>
      </div>
      <p className="muted no-print">{t("marks.desc")}</p>

      {!marks?.length ? (
        <Alert theme="info" message={t("marks.empty")} operation={<Link to="/typing">{t("nav.typing")} →</Link>} />
      ) : (
        <>
          <section className="panel marks-filters no-print">
            <Input value={query} onChange={(v) => setQuery(String(v))} placeholder={t("marks.search")} prefixIcon={<SearchIcon />} clearable style={{ width: 200 }} />
            <Select
              value={reason}
              onChange={(v) => setReason(v as ReasonFilter)}
              style={{ width: 140 }}
              options={[
                { value: "all", label: t("marks.reason.all") },
                { value: "none", label: t("marks.reason.none") },
                ...MARK_REASONS.map((r) => ({ value: r, label: t(`marks.reason.${r}` as MessageKey) })),
              ]}
            />
            <Radio.Group variant="default-filled" value={time} onChange={(v) => setTime(v as TimeFilter)}>
              {(["all", "today", "week", "month"] as TimeFilter[]).map((v) => (
                <Radio.Button key={v} value={v}>
                  {t(`marks.time.${v}` as MessageKey)}
                </Radio.Button>
              ))}
            </Radio.Group>
            <Select
              value={dict}
              onChange={(v) => setDict(String(v))}
              style={{ width: 150 }}
              options={[{ value: "all", label: t("marks.allDicts") }, ...dicts.map((d) => ({ value: d, label: dictName(d) }))]}
            />
            <Radio.Group variant="default-filled" value={status} onChange={(v) => setStatus(v as StatusFilter)}>
              {(["all", "learning", "mastered"] as StatusFilter[]).map((v) => (
                <Radio.Button key={v} value={v}>
                  {t(`marks.status.${v}` as MessageKey)}
                </Radio.Button>
              ))}
            </Radio.Group>
          </section>

          <section className="panel marks-actions no-print">
            <span className="muted">{t("marks.selected", { count: filtered.length })}</span>
            <Button theme={primary("normal")} disabled={!filtered.length} onClick={() => practice("normal", "marks.practice.normal")}>
              {t("marks.practice.normal")}
            </Button>
            <Button theme={primary("spell")} variant="outline" disabled={!filtered.length} onClick={() => practice("spell", "marks.practice.spell")}>
              {t("marks.practice.spell")}
            </Button>
            <Button theme={primary("listen")} variant="outline" disabled={!filtered.length} onClick={() => practice("listen", "marks.practice.listen")}>
              {t("marks.practice.listen")}
            </Button>
            <Button theme={primary("quiz")} variant="outline" disabled={filtered.length < 1} onClick={() => setQuizWords(filtered.slice(0, 6))}>
              {t("marks.practice.quiz")}
            </Button>
            <Button theme={primary("scenario")} variant="outline" disabled={!english.length} onClick={toScenario}>
              {t("marks.practice.scenario")}
            </Button>
            {mastered.length > 0 && (
              <Button variant="text" theme="warning" onClick={() => void unmarkWords(mastered.map((m) => m.id))}>
                {t("marks.clearMastered", { count: mastered.length })}
              </Button>
            )}
          </section>
          {reason !== "all" && <p className="muted marks-tip no-print">{t(`marks.tip.${reason}` as MessageKey)}</p>}

          {quizWords && <ConfusableQuiz marks={quizWords} onClose={() => setQuizWords(null)} />}

          <Table className="marks-table" rowKey="id" data={filtered} columns={columns} size="small" hover tableLayout="fixed" />
        </>
      )}
    </main>
  );
}
