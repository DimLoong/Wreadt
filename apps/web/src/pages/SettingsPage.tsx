import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Input, InputNumber, Radio, Select, Slider, Switch } from "tdesign-react";
import { AI_PRESETS, pickFastModel } from "@wreadt/core";
import { useSettings, type SkinId, type TypingMode } from "../context/settings";
import type { AdvanceMode, WrongHelp } from "../hooks/useTypingMachine";
import type { Locale, MessageKey } from "../i18n/messages";
import { chatDirect, getAiConfig, listModels, saveAiConfig, type AiConfig } from "../services/ai";
import { play, type SoundName } from "../services/sound";

const EMPTY_AI: AiConfig = { provider: AI_PRESETS[0].id, baseUrl: AI_PRESETS[0].baseUrl, apiKey: "", model: AI_PRESETS[0].model };

function AiSettings() {
  const { t } = useSettings();
  const [cfg, setCfg] = useState<AiConfig>(EMPTY_AI);
  const [status, setStatus] = useState<{ theme: "success" | "error"; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  const fetchModels = async () => {
    setLoadingModels(true);
    setStatus(null);
    try {
      const list = await listModels(cfg);
      setModels(list);
      const fast = pickFastModel(list);
      if (fast && !list.includes(cfg.model)) setCfg((c) => ({ ...c, model: fast }));
      setStatus({ theme: "success", text: t("settings.aiModelsLoaded", { count: list.length }) });
    } catch (err) {
      setStatus({ theme: "error", text: (err as Error).message });
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    void getAiConfig().then((saved) => saved && setCfg(saved));
  }, []);

  const choose = (provider: string) => {
    setModels([]);
    const preset = AI_PRESETS.find((p) => p.id === provider);
    setCfg((c) => (preset ? { ...c, provider, baseUrl: preset.baseUrl, model: preset.model } : { ...c, provider }));
    setStatus(null);
  };

  const save = async () => {
    await saveAiConfig({ ...cfg, baseUrl: cfg.baseUrl.trim(), apiKey: cfg.apiKey.trim(), model: cfg.model.trim() });
    setStatus({ theme: "success", text: t("settings.aiSaved") });
  };

  const test = async () => {
    setTesting(true);
    setStatus(null);
    try {
      await chatDirect(cfg, 'Reply with the json object {"ok":true}', "ping");
      setStatus({ theme: "success", text: t("settings.aiTestOk") });
    } catch (err) {
      setStatus({ theme: "error", text: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const clear = async () => {
    await saveAiConfig(null);
    setCfg(EMPTY_AI);
    setStatus(null);
  };

  return (
    <section className="panel settings-list">
      <h2>{t("settings.ai")}</h2>
      <p className="muted setting-tip">{t("settings.aiDesc")}</p>
      <div className="setting-row">
        <span>{t("settings.aiProvider")}</span>
        <Select value={cfg.provider} onChange={(v) => choose(String(v))} style={{ width: 200 }}>
          {AI_PRESETS.map((p) => (
            <Select.Option key={p.id} value={p.id} label={p.name} />
          ))}
          <Select.Option value="custom" label={t("settings.aiCustom")} />
        </Select>
      </div>
      <div className="setting-row">
        <span>{t("settings.aiBaseUrl")}</span>
        <Input value={cfg.baseUrl} onChange={(v) => setCfg({ ...cfg, baseUrl: String(v) })} style={{ maxWidth: 360 }} />
      </div>
      <div className="setting-row">
        <span>{t("settings.aiModel")}</span>
        <div className="model-field">
          {models.length ? (
            <Select value={cfg.model} onChange={(v) => setCfg({ ...cfg, model: String(v) })} filterable creatable style={{ width: 260 }}>
              {models.map((m) => (
                <Select.Option key={m} value={m} label={m} />
              ))}
            </Select>
          ) : (
            <Input value={cfg.model} onChange={(v) => setCfg({ ...cfg, model: String(v) })} style={{ width: 260 }} />
          )}
          <Button variant="outline" loading={loadingModels} disabled={!cfg.apiKey.trim()} onClick={() => void fetchModels()}>
            {t("settings.aiFetchModels")}
          </Button>
        </div>
      </div>
      <div className="setting-row">
        <span>{t("settings.aiKey")}</span>
        <Input type="password" value={cfg.apiKey} onChange={(v) => setCfg({ ...cfg, apiKey: String(v) })} placeholder="sk-..." style={{ maxWidth: 360 }} autocomplete="off" />
      </div>
      {status && <Alert theme={status.theme} message={status.text} />}
      <div className="setting-actions">
        <Button theme="primary" onClick={() => void save()} disabled={!cfg.apiKey.trim() || !cfg.baseUrl.trim() || !cfg.model.trim()}>
          {t("settings.aiSave")}
        </Button>
        <Button variant="outline" loading={testing} onClick={() => void test()} disabled={!cfg.apiKey.trim()}>
          {t("settings.aiTest")}
        </Button>
        <Button variant="text" theme="danger" onClick={() => void clear()}>
          {t("settings.aiClear")}
        </Button>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const { settings, update, t } = useSettings();

  return (
    <main className="page">
      <h1>{t("settings.title")}</h1>

      <section className="panel settings-list">
        <h2>{t("settings.typing")}</h2>
        <div className="setting-row">
          <span>{t("settings.typingMode")}</span>
          <Radio.Group variant="default-filled" value={settings.typingMode} onChange={(v) => void update("typingMode", v as TypingMode)}>
            <Radio.Button value="dictation">{t("settings.typingMode.dictation")}</Radio.Button>
            <Radio.Button value="copy">{t("settings.typingMode.copy")}</Radio.Button>
          </Radio.Group>
        </div>
        <div className="setting-row">
          <span>{t("settings.advance")}</span>
          <Radio.Group variant="default-filled" value={settings.advance} onChange={(v) => void update("advance", v as AdvanceMode)}>
            <Radio.Button value="key">{t("settings.advance.key")}</Radio.Button>
            <Radio.Button value="auto">{t("settings.advance.auto")}</Radio.Button>
          </Radio.Group>
        </div>
        <div className="setting-row">
          <span>{t("settings.wrongHelp")}</span>
          <Radio.Group variant="default-filled" value={settings.wrongHelp} onChange={(v) => void update("wrongHelp", v as WrongHelp)}>
            <Radio.Button value="reveal">{t("settings.wrongHelp.reveal")}</Radio.Button>
            <Radio.Button value="skip">{t("settings.wrongHelp.skip")}</Radio.Button>
            <Radio.Button value="none">{t("settings.wrongHelp.none")}</Radio.Button>
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
        <div className="setting-row">
          <span>{t("settings.mixCount")}</span>
          <InputNumber
            value={settings.mixCount}
            min={0}
            max={10}
            onChange={(v) => {
              const n = Number(v);
              if (n >= 0 && n <= 10) void update("mixCount", n);
            }}
          />
        </div>
        <div className="setting-row">
          <span>{t("settings.markMixCount")}</span>
          <InputNumber
            value={settings.markMixCount}
            min={0}
            max={10}
            onChange={(v) => {
              const n = Number(v);
              if (n >= 0 && n <= 10) void update("markMixCount", n);
            }}
          />
        </div>
        <label className="setting-row">
          <span>{t("settings.autoUnmark")}</span>
          <Switch value={settings.autoUnmarkMastered} onChange={(v) => void update("autoUnmarkMastered", Boolean(v))} />
        </label>
        <label className="setting-row">
          <span>{t("settings.batchScenario")}</span>
          <Switch value={settings.batchScenario} onChange={(v) => void update("batchScenario", Boolean(v))} />
        </label>
        <p className="muted setting-tip">{t("settings.batchScenarioTip")}</p>
        <div className="setting-row">
          <span>{t("settings.accent")}</span>
          <Radio.Group variant="default-filled" value={settings.accent} onChange={(v) => void update("accent", v as "us" | "uk")}>
            <Radio.Button value="us">{t("settings.accent.us")}</Radio.Button>
            <Radio.Button value="uk">{t("settings.accent.uk")}</Radio.Button>
          </Radio.Group>
        </div>
        <label className="setting-row">
          <span>{t("settings.autoPlay")}</span>
          <Switch value={settings.autoPlay} onChange={(v) => void update("autoPlay", Boolean(v))} />
        </label>
        <label className="setting-row">
          <span>{t("settings.showMeaning")}</span>
          <Switch value={settings.showMeaning} onChange={(v) => void update("showMeaning", Boolean(v))} />
        </label>
      </section>

      <section className="panel settings-list">
        <h2>{t("settings.sound")}</h2>
        <label className="setting-row">
          <span>{t("settings.soundEffects")}</span>
          <Switch value={settings.sound} onChange={(v) => void update("sound", Boolean(v))} />
        </label>
        <label className="setting-row">
          <span>{t("settings.keySound")}</span>
          <Switch value={settings.keySound} onChange={(v) => void update("keySound", Boolean(v))} />
        </label>
        <div className="setting-row">
          <span>{t("settings.volume")}</span>
          <Slider value={settings.volume} min={0} max={100} disabled={!settings.sound && !settings.keySound} style={{ width: 220 }} onChange={(v) => void update("volume", Number(v))} />
        </div>
        <div className="setting-actions">
          {(["key", "correct", "wrong", "batch"] as SoundName[]).map((name) => (
            <Button key={name} size="small" variant="outline" onClick={() => play(name)}>
              ▶ {t(`settings.sound.${name}` as MessageKey)}
            </Button>
          ))}
        </div>
        <p className="muted setting-tip">{t("settings.soundTip")}</p>
      </section>

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

      <AiSettings />
    </main>
  );
}
