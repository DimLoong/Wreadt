import { Link } from "react-router-dom";
import { InputNumber, Radio, Switch } from "tdesign-react";
import { useSettings, type SkinId } from "../context/settings";
import type { Locale } from "../i18n/messages";

export default function SettingsPage() {
  const { settings, update, t } = useSettings();

  return (
    <main className="page">
      <h1>{t("settings.title")}</h1>
      <section className="panel settings-list">
        <label className="setting-row">
          <span>{t("settings.theme")}</span>
          <Switch value={settings.dark} onChange={(v) => void update("dark", Boolean(v))} />
        </label>
        <div className="setting-row">
          <span>{t("settings.language")}</span>
          <Radio.Group variant="default-filled" value={settings.locale} onChange={(v) => void update("locale", v as Locale)}>
            <Radio.Button value="zh-CN">中文</Radio.Button>
            <Radio.Button value="en-US">English</Radio.Button>
          </Radio.Group>
        </div>
        <div className="setting-row">
          <span>{t("settings.batchSize")}</span>
          <InputNumber
            value={settings.batchSize}
            min={5}
            max={50}
            step={5}
            onChange={(v) => {
              const n = Number(v);
              if (n >= 5 && n <= 50) void update("batchSize", n);
            }}
          />
        </div>
        <label className="setting-row">
          <span>{t("settings.autoPlay")}</span>
          <Switch value={settings.autoPlay} onChange={(v) => void update("autoPlay", Boolean(v))} />
        </label>
        <label className="setting-row">
          <span>{t("settings.showMeaning")}</span>
          <Switch value={settings.showMeaning} onChange={(v) => void update("showMeaning", Boolean(v))} />
        </label>
        <div className="setting-row">
          <span>{t("settings.skin")}</span>
          <Radio.Group variant="default-filled" value={settings.skin} onChange={(v) => void update("skin", v as SkinId)}>
            <Radio.Button value="none">Wreadt</Radio.Button>
            <Radio.Button value="word">Word</Radio.Button>
            <Radio.Button value="excel">Excel</Radio.Button>
            <Radio.Button value="vscode">VS Code</Radio.Button>
          </Radio.Group>
        </div>
        <p className="muted setting-tip">{t("settings.skinTip")}</p>
        <div className="setting-row">
          <span>{t("settings.account")}</span>
          <Link to="/account">→</Link>
        </div>
      </section>
    </main>
  );
}
