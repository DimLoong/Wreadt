import { useState } from "react";
import { Tabs } from "tdesign-react";
import { useSettings } from "../context/settings";
import { EN_CONSONANTS, EN_VOWELS, GOJUON } from "../data/phonetics";
import { playAudio } from "../services/youdao";

function play(text: string, lang: "en" | "ja") {
  playAudio(text, lang).catch(() => undefined);
}

function IpaGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="sound-grid">
      {items.map(([symbol, example]) => (
        <button key={symbol} type="button" className="sound-card" onClick={() => play(example, "en")}>
          <span className="sound-main">/{symbol}/</span>
          <span className="muted">{example}</span>
        </button>
      ))}
    </div>
  );
}

export default function PhoneticPage() {
  const { t } = useSettings();
  const [katakana, setKatakana] = useState(false);

  return (
    <main className="page">
      <h1>{t("phonetic.title")}</h1>
      <p className="muted">{t("phonetic.tip")}</p>
      <Tabs defaultValue="en">
        <Tabs.TabPanel value="en" label={t("phonetic.en")}>
          <h2>{t("phonetic.vowels")}</h2>
          <IpaGrid items={EN_VOWELS} />
          <h2>{t("phonetic.consonants")}</h2>
          <IpaGrid items={EN_CONSONANTS} />
        </Tabs.TabPanel>
        <Tabs.TabPanel value="ja" label={t("phonetic.ja")}>
          <div className="kana-toggle">
            <button type="button" className={katakana ? "" : "active"} onClick={() => setKatakana(false)}>
              {t("phonetic.hiragana")}
            </button>
            <button type="button" className={katakana ? "active" : ""} onClick={() => setKatakana(true)}>
              {t("phonetic.katakana")}
            </button>
          </div>
          <div className="kana-grid">
            {GOJUON.flat().map((kana, i) =>
              kana ? (
                <button key={kana[2]} type="button" className="sound-card" onClick={() => play(kana[0], "ja")}>
                  <span className="sound-main" lang="ja">{katakana ? kana[1] : kana[0]}</span>
                  <span className="muted">{kana[2]}</span>
                </button>
              ) : (
                <span key={`empty-${i}`} />
              ),
            )}
          </div>
        </Tabs.TabPanel>
      </Tabs>
    </main>
  );
}
