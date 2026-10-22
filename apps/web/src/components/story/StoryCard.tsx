import { useEffect, useState, type ReactNode } from "react";
import { Button } from "tdesign-react";
import { useSettings } from "../../context/settings";
import { commitEpisode, loadStory, takeStory, type PendingEpisode } from "../../lib/story";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 正文里高亮本组用到的词（允许常见变形，如 deploy → deployed） */
function highlight(text: string, words: string[]): ReactNode[] {
  if (!words.length) return [text];
  const stems = words.map((w) => escape(w.length > 4 ? w.replace(/e$/, "") : w));
  const re = new RegExp(`\\b((?:${stems.join("|")})[a-z]*)\\b`, "gi");
  // split 带捕获组：奇数下标是匹配到的词
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

/** 组末的连载小故事：第 N 集，本组用到的词高亮，可切换翻译 */
export default function StoryCard({ storyKey }: { storyKey: string }) {
  const { t } = useSettings();
  const [ep, setEp] = useState<PendingEpisode | null>(null);
  const [title, setTitle] = useState("");
  const [showTrans, setShowTrans] = useState(false);

  useEffect(() => {
    let cancelled = false;
    takeStory(storyKey)
      ?.then(async (e) => {
        if (cancelled) return;
        const story = await loadStory();
        setTitle(story?.title || e.title);
        setEp(e);
        await commitEpisode(e);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [storyKey]);

  if (!ep) return null;
  return (
    <section className="story-card">
      <div className="story-head">
        <span className="story-tag">{t("story.episode", { n: ep.n })}</span>
        <b>{title}</b>
        <Button size="small" variant="text" onClick={() => setShowTrans((v) => !v)}>
          {t(showTrans ? "story.hideTrans" : "story.showTrans")}
        </Button>
      </div>
      <p className="story-text" lang="en">
        {highlight(ep.episode, ep.usedWords)}
      </p>
      {showTrans && <p className="muted story-trans">{ep.translation}</p>}
    </section>
  );
}
