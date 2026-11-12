import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Tag } from "tdesign-react";
import type { WordInsight, WordItem } from "@wreadt/core";
import { useSettings } from "../context/settings";
import { lookupIndex } from "../store/dicts";
import { getMeta, setMeta } from "../store/repo";
import { saveInsights } from "../lib/wordInsight";
import type { FocusPractice } from "../lib/practiceState";
import PRESET from "./insights.json";

// 开发模式专用（只在 pnpm dev 时有这个页面）：用一组固定的词测试“词义详解”。
// 预置的详解由真实 AI 生成（见 insights.json），写入本机缓存后不需要配置 AI 也能看效果；
// 清除缓存后再练，会按当前的 AI 配置现场生成。

const presets = PRESET as Record<string, WordInsight | null>;
const WORDS = Object.keys(presets);

export default function InsightLab() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [items, setItems] = useState<WordItem[] | null>(null);

  useEffect(() => {
    void lookupIndex("en").then((index) => setItems(WORDS.map((w) => index.get(w)).filter((w): w is WordItem => Boolean(w))));
  }, []);

  const keys = (words: string[]) => words.map((w) => `${settings.locale}:${w}`);
  const start = async (seed: boolean) => {
    if (!items) return;
    if (seed) await saveInsights(Object.fromEntries(WORDS.map((w, i) => [keys(WORDS)[i]!, presets[w] ?? null])));
    else {
      const cache = (await getMeta<Record<string, unknown>>("wordInsight")) ?? {};
      for (const k of keys(WORDS)) delete cache[k];
      await setMeta("wordInsight", cache);
      // 内存里的缓存也要清掉：整页刷新最简单
      window.location.assign("/dev/insight?go=live");
      return;
    }
    const practice: FocusPractice = { key: `dev-insight-${Date.now()}`, title: "详解测试", words: items };
    navigate("/typing", { state: { practice } });
  };

  // 清除缓存刷新后自动进入练习
  useEffect(() => {
    if (items && new URLSearchParams(window.location.search).get("go") === "live") {
      const practice: FocusPractice = { key: `dev-insight-${Date.now()}`, title: "详解测试（现场生成）", words: items };
      navigate("/typing", { replace: true, state: { practice } });
    }
  }, [items, navigate]);

  return (
    <main className="page">
      <h1>开发：词义详解</h1>
      <Alert theme="info" message="拼完一个词后看例句下方的“区别 … →”提示，再点“更多”看详解卡片。需要“拼写正确后：按任意键继续”。" />
      <div className="word-chips" style={{ margin: "16px 0" }}>
        {WORDS.map((w) => (
          <Tag key={w} theme={presets[w] ? "primary" : "default"} variant="light">
            {w}
            {presets[w] ? "" : "（无详解）"}
          </Tag>
        ))}
      </div>
      <div className="word-add">
        <Button theme="primary" disabled={!items} onClick={() => void start(true)}>
          用预置详解开始练习
        </Button>
        <Button variant="outline" disabled={!items} onClick={() => void start(false)}>
          清除缓存，现场生成
        </Button>
      </div>
    </main>
  );
}
