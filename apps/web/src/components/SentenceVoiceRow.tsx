import { useEffect, useState } from "react";
import { Button, Select, Slider } from "tdesign-react";
import { TTS_VOICES } from "@wreadt/core";
import { useSettings } from "../context/settings";
import { cloudSource, speakSentence, systemVoices, type CloudSource } from "../services/speech";
import { pronounceWord } from "../services/speech";
import type { MessageKey } from "../i18n/messages";

const SAMPLE = "Could you send me the final report before the meeting tomorrow?";

/** 设置：发音音量、整句朗读的声音（云端 / 系统 / 有道），可试听 */
export default function SentenceVoiceRow() {
  const { t, settings, update } = useSettings();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [cloud, setCloud] = useState<CloudSource>(null);
  const [previewing, setPreviewing] = useState(false);
  useEffect(() => {
    void systemVoices(settings.accent).then(setVoices);
    void cloudSource().then(setCloud);
  }, [settings.accent]);

  const autoLabel = cloud ? t("settings.voice.autoCloud") : voices[0] ? t("settings.voice.auto", { name: voices[0].name }) : t("settings.voice.autoNone");
  const options = [
    { value: "auto", label: autoLabel },
    ...(cloud
      ? [
          {
            group: t("settings.voice.cloudGroup"),
            children: TTS_VOICES.map((v) => ({ value: `cloud:${v.id}`, label: `${v.id} · ${t(`settings.voice.${v.gender}` as MessageKey)}` })),
          },
        ]
      : []),
    { group: t("settings.voice.systemGroup"), children: voices.map((v) => ({ value: v.voiceURI, label: `${v.name} (${v.lang})` })) },
    { value: "youdao", label: t("settings.voice.youdao") },
  ];

  const preview = async () => {
    setPreviewing(true);
    await speakSentence(SAMPLE, { accent: settings.accent, voice: settings.sentenceVoice }).catch(() => undefined);
    setPreviewing(false);
  };

  return (
    <>
      <div className="setting-row">
        <span>{t("settings.voiceVolume")}</span>
        <div className="voice-select">
          <Slider value={settings.voiceVolume} min={0} max={100} style={{ width: 220 }} onChange={(v) => void update("voiceVolume", Number(v))} />
          <Button variant="text" onClick={() => void pronounceWord("volume", "en", settings.accent)}>
            ▶ {t("settings.voice.preview")}
          </Button>
        </div>
      </div>
      <div className="setting-row">
        <span>{t("settings.voice")}</span>
        <div className="voice-select">
          <Select value={settings.sentenceVoice} onChange={(v) => void update("sentenceVoice", String(v))} options={options} style={{ width: 300 }} filterable />
          <Button variant="outline" loading={previewing} onClick={() => void preview()}>
            ▶ {t("settings.voice.preview")}
          </Button>
        </div>
      </div>
      <p className="muted setting-tip">{cloud ? t("settings.voiceTipCloud") : t("settings.voiceTip")}</p>
    </>
  );
}
