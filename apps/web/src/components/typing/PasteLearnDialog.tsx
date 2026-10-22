import { useState } from "react";
import { Alert, Button, Checkbox, Dialog, Textarea } from "tdesign-react";
import { customWordToItem, masteryLevel, wordKey, type CardState, type ExtractedWord, type WordItem } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { AiUnavailableError, extractWords } from "../../services/ai";
import { addCustomWord } from "../../store/repo";

/** 一次最多粘贴这么多字符（约两三封邮件） */
const MAX_CHARS = 4000;

interface Props {
  visible: boolean;
  onClose: () => void;
  /** 已有的学习卡片：已掌握的词不再挑出来 */
  cards: Map<string, CardState>;
  /** 开始一组专项练习 */
  onStart: (words: WordItem[]) => void;
}

/**
 * 粘贴即学：粘贴邮件、PR、会议纪要等工作中的英文，AI 挑出值得学的词（例句就是原文里的句子），
 * 勾选后加入“我的词库”并立即开始一组练习，之后按复习计划继续出现。
 */
export default function PasteLearnDialog({ visible, onClose, cards, onStart }: Props) {
  const { t, settings } = useSettings();
  const [text, setText] = useState("");
  const [words, setWords] = useState<ExtractedWord[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const find = async () => {
    setBusy(true);
    setError(null);
    try {
      // 已掌握的词不再挑
      const list = (await extractWords(text.slice(0, MAX_CHARS), settings.locale)).filter((w) => masteryLevel(cards.get(wordKey("en", w.word))) < 3);
      setWords(list);
      setPicked(new Set(list.map((w) => w.word)));
      if (!list.length) setError(t("paste.allKnown"));
    } catch (err) {
      setError(err instanceof AiUnavailableError ? t("ai.unavailable") : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    const chosen = (words ?? []).filter((w) => picked.has(w.word));
    const items: WordItem[] = [];
    for (const w of chosen) {
      const saved = await addCustomWord({
        lang: "en",
        answer: w.word,
        phonetic: w.phonetic || undefined,
        meanings: w.meanings,
        examples: w.example ? [{ sentence: w.example, translation: w.exampleTrans }] : undefined,
      });
      items.push(customWordToItem(saved));
    }
    onStart(items);
    setWords(null);
    setText("");
    onClose();
  };

  const toggle = (word: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });

  return (
    <Dialog
      visible={visible}
      header={t("paste.title")}
      width={640}
      onClose={onClose}
      footer={
        words?.length ? (
          <>
            <Button variant="outline" onClick={() => setWords(null)}>
              {t("paste.back")}
            </Button>
            <Button theme="primary" disabled={!picked.size} onClick={() => void start()}>
              {t("paste.start", { count: picked.size })}
            </Button>
          </>
        ) : (
          <Button theme="primary" loading={busy} disabled={!text.trim()} onClick={() => void find()}>
            {t("paste.find")}
          </Button>
        )
      }
    >
      {words?.length ? (
        <ul className="paste-words">
          {words.map((w) => (
            <li key={w.word}>
              <Checkbox checked={picked.has(w.word)} onChange={() => toggle(w.word)}>
                <b lang="en">{w.word}</b>
                {w.phonetic && <span className="muted"> /{w.phonetic}/</span>}
                <span className="paste-meaning">{w.meanings[0]}</span>
              </Checkbox>
              {w.example && (
                <p className="muted paste-example" lang="en">
                  {w.example}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className="muted">{t("paste.desc")}</p>
          <Textarea value={text} onChange={(v) => setText(String(v))} autosize={{ minRows: 8, maxRows: 16 }} maxlength={MAX_CHARS} placeholder={t("paste.placeholder")} />
        </>
      )}
      {error && <Alert theme="warning" message={error} style={{ marginTop: 12 }} />}
    </Dialog>
  );
}
