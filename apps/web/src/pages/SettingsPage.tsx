import { Button, Card, Switch } from "tdesign-react";
import { useAppContext } from "../context/AppContext";

export default function SettingsPage() {
  const { darkMode, setDarkMode, locale, setLocale, activeLang, setActiveLang } = useAppContext();

  return (
    <Card className="typing-main-card" bordered>
      <h2>设置页</h2>
      <div className="settings-zone">
        <div className="setting-row">
          <span>深色模式</span>
          <Switch value={darkMode} onChange={setDarkMode} />
        </div>
        <div className="setting-row">
          <span>界面语言</span>
          <Button variant="outline" onClick={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}>{locale}</Button>
        </div>
        <div className="setting-row">
          <span>默认词库</span>
          <Button variant="outline" onClick={() => setActiveLang(activeLang === "en" ? "ja" : "en")}>{activeLang.toUpperCase()}</Button>
        </div>
      </div>
    </Card>
  );
}
