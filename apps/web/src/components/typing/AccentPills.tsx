import { Radio } from "tdesign-react";
import { SoundIcon } from "tdesign-icons-react";
import type { WordItem } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import type { Accent } from "../../services/youdao";

/** 英 / 美发音选择：选中的口音用于自动发音，点喇叭试听 */
export default function AccentPills({ word, onSay }: { word: WordItem; onSay: (accent: Accent) => void }) {
  const { settings, update, t } = useSettings();

  if (word.lang === "ja") {
    return (
      <div className="accent-pills">
        <button type="button" className="accent-pill" onClick={() => onSay("us")} title={`${t("typing.replay")} (Ctrl+J)`}>
          {/* 只显示假名读音，不能显示罗马音（那是要默写的答案） */}
          {word.reading && word.reading !== word.display && <span>{word.reading}</span>}
          <SoundIcon />
        </button>
      </div>
    );
  }

  const options: { accent: Accent; label: string; phonetic?: string }[] = [
    { accent: "uk", label: t("typing.accentUk"), phonetic: word.phoneticUk ?? word.phonetic },
    { accent: "us", label: t("typing.accentUs"), phonetic: word.phonetic },
  ];
  return (
    <Radio.Group className="accent-pills" value={settings.accent} onChange={(v) => void update("accent", v as Accent)}>
      {options.map((o) => (
        <div key={o.accent} className={`accent-pill ${settings.accent === o.accent ? "active" : ""}`}>
          <Radio value={o.accent} onClick={() => onSay(o.accent)}>
            <span className="accent-label">{o.label}</span>
            {o.phonetic && <span className="accent-phonetic">/{o.phonetic}/</span>}
          </Radio>
          <button type="button" className="icon-only" onClick={() => onSay(o.accent)} title={`${t("typing.replay")} (Ctrl+J)`}>
            <SoundIcon />
          </button>
        </div>
      ))}
    </Radio.Group>
  );
}
