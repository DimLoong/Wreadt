import { SoundIcon } from "tdesign-icons-react";
import type { WordItem } from "@wreadt/core";
import { useSettings } from "../../context/settings";

/**
 * 发音胶囊：显示当前口音（设置中切换英 / 美）的音标，点击播放。
 * 日语只显示假名读音，不显示罗马音（那是要默写的答案）。
 */
export default function PronouncePill({ word, onSay, hideText }: { word: WordItem; onSay: () => void; hideText?: boolean }) {
  const { settings, t } = useSettings();
  const text = hideText
    ? ""
    : word.lang === "ja"
      ? word.reading && word.reading !== word.display
        ? word.reading
        : ""
      : (settings.accent === "uk" ? (word.phoneticUk ?? word.phonetic) : word.phonetic) ?? "";

  return (
    <button type="button" className="accent-pill active" onClick={onSay} title={`${t("typing.replay")} (Ctrl+J)`}>
      {text && <span className={word.lang === "en" ? "accent-phonetic" : ""}>{text}</span>}
      <SoundIcon />
    </button>
  );
}
