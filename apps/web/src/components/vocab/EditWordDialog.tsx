import { useState } from "react";
import { Alert, Dialog, Input, Textarea } from "tdesign-react";
import type { CustomWord } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import { updateCustomWord } from "../../store/repo";
import { meaningsLackPos } from "../../lib/customWords";

/**
 * 编辑“我的词库”里的词：拼写、音标 / 读音、释义（每行一条，以词性开头）、例句与翻译。
 * 改拼写会被当作另一个词，学习进度从头开始，所以给出提醒。
 */
export default function EditWordDialog({ word, onClose }: { word: CustomWord; onClose: () => void }) {
  const { t } = useSettings();
  const ex = word.examples?.[0];
  const [answer, setAnswer] = useState(word.answer);
  const [phonetic, setPhonetic] = useState(word.lang === "ja" ? (word.reading ?? "") : (word.phonetic ?? ""));
  const [meanings, setMeanings] = useState(word.meanings.join("\n"));
  const [sentence, setSentence] = useState(ex?.sentence ?? "");
  const [translation, setTranslation] = useState(ex?.translation ?? "");

  const lines = meanings.split(/\n+/).map((m) => m.trim()).filter(Boolean);
  const noPos = word.lang === "en" && meaningsLackPos(lines);
  const respelled = answer.trim().toLowerCase() !== word.answer.toLowerCase();
  const valid = answer.trim() && lines.length;

  const save = async () => {
    if (!valid) return;
    await updateCustomWord(word.id, {
      answer: answer.trim(),
      ...(word.lang === "ja" ? { reading: phonetic.trim() || undefined } : { phonetic: phonetic.trim().replace(/^\/|\/$/g, "") || undefined }),
      meanings: lines,
      examples: sentence.trim() ? [{ sentence: sentence.trim(), translation: translation.trim() }, ...(word.examples ?? []).slice(1)] : (word.examples ?? []).slice(1),
    });
    onClose();
  };

  return (
    <Dialog visible header={t("custom.editTitle", { word: word.display || word.answer })} onClose={onClose} onConfirm={() => void save()} confirmBtn={{ content: t("custom.save"), disabled: !valid }} cancelBtn={t("custom.cancel")} width={560}>
      <div className="edit-word">
        <label>
          <span>{t("custom.fieldAnswer")}</span>
          <Input value={answer} onChange={(v) => setAnswer(String(v))} />
        </label>
        {respelled && <Alert theme="warning" message={t("custom.respellTip")} />}
        <label>
          <span>{word.lang === "ja" ? t("custom.fieldReading") : t("custom.fieldPhonetic")}</span>
          <Input value={phonetic} onChange={(v) => setPhonetic(String(v))} placeholder={word.lang === "ja" ? "かな" : "ˈeksəmpl"} />
        </label>
        <label>
          <span>{t("custom.fieldMeanings")}</span>
          <Textarea value={meanings} onChange={(v) => setMeanings(String(v))} autosize={{ minRows: 2, maxRows: 6 }} placeholder={t("custom.meaningsPlaceholder")} />
        </label>
        {noPos && <p className="muted edit-word-tip">{t("custom.posTip")}</p>}
        <label>
          <span>{t("custom.fieldExample")}</span>
          <Textarea value={sentence} onChange={(v) => setSentence(String(v))} autosize={{ minRows: 1, maxRows: 4 }} />
        </label>
        <label>
          <span>{t("custom.fieldExampleTrans")}</span>
          <Input value={translation} onChange={(v) => setTranslation(String(v))} />
        </label>
      </div>
    </Dialog>
  );
}
