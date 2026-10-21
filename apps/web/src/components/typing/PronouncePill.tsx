import { SoundIcon } from "tdesign-icons-react";
import type { WordItem } from "@wreadt/core";
import { useSettings } from "../../context/settings";
import type { Accent } from "../../services/youdao";

/**
 * 发音胶囊：左侧“美 / 英”切换口音（切换后立即用新口音播放），右侧显示该口音的音标，点击播放。
 * 日语只显示假名读音，不显示罗马音（那是要默写的答案）。
 */
export default function PronouncePill({ word, onSay, hideText }: { word: WordItem; onSay: (accent: Accent) => void; hideText?: boolean }) {
  const { settings, t, update } = useSettings();
  const accent = settings.accent;
  const text = hideText
    ? ""
    : word.lang === "ja"
      ? word.reading && word.reading !== word.display
        ? word.reading
        : ""
      : (accent === "uk" ? (word.phoneticUk ?? word.phonetic) : word.phonetic) ?? "";
  const other: Accent = accent === "us" ? "uk" : "us";

  return (
    <span className="accent-pill active">
      {word.lang === "en" && (
        <button
          type="button"
          className="accent-toggle"
          title={t("typing.switchAccent", { accent: t(`settings.accent.${other}`) })}
          onClick={() => {
            void update("accent", other);
            onSay(other);
          }}
        >
          {t(`typing.accentShort.${accent}`)}
        </button>
      )}
      <button type="button" className="accent-play" onClick={() => onSay(accent)} title={`${t("typing.replay")} (Ctrl+J)`}>
        {text && <span className={word.lang === "en" ? "accent-phonetic" : ""}>{text}</span>}
        <SoundIcon />
      </button>
    </span>
  );
}
