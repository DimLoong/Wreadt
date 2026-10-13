import { useEffect, useState } from "react";
import { Button, Select } from "tdesign-react";
import { useSettings } from "../context/settings";
import { englishVoices, speakSentence } from "../services/speech";

const SAMPLE = "Could you send me the final report before the meeting tomorrow?";

/** 设置：整句朗读的声音（整句听写等），可试听 */
export default function SentenceVoiceRow() {
  const { t, settings, update } = useSettings();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    void englishVoices(settings.accent).then(setVoices);
  }, [settings.accent]);

  const options = [
    { value: "auto", label: voices[0] ? t("settings.voice.auto", { name: voices[0].name }) : t("settings.voice.autoNone") },
    ...voices.map((v) => ({ value: v.voiceURI, label: `${v.name} (${v.lang})` })),
    { value: "youdao", label: t("settings.voice.youdao") },
  ];

  return (
    <>
      <div className="setting-row">
        <span>{t("settings.voice")}</span>
        <div className="voice-select">
          <Select value={settings.sentenceVoice} onChange={(v) => void update("sentenceVoice", String(v))} options={options} style={{ width: 300 }} filterable />
          <Button variant="outline" onClick={() => void speakSentence(SAMPLE, { accent: settings.accent, voice: settings.sentenceVoice })}>
            ▶ {t("settings.voice.preview")}
          </Button>
        </div>
      </div>
      <p className="muted setting-tip">{t("settings.voiceTip")}</p>
    </>
  );
}
