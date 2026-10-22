import type { StoryEpisode } from "@wreadt/core";
import { aiSource, generateStoryEpisode } from "../services/ai";
import { getMeta, setMeta } from "../store/repo";

// 连载小故事：每组开始时在后台用本组单词续写一集；在组末总结里展示后才记入连载（中途放弃的组不会让剧情跳集）

export interface SavedEpisode {
  n: number;
  text: string;
  translation: string;
  words: string[];
  at: number;
}

export interface Story {
  title: string;
  summary: string;
  episodes: SavedEpisode[];
}

const META_KEY = "story";
/** 本机只保留最近这么多集 */
const KEEP = 30;

export async function loadStory(): Promise<Story | null> {
  return (await getMeta<Story>(META_KEY)) ?? null;
}

export interface PendingEpisode extends StoryEpisode {
  n: number;
}

const slots = new Map<string, Promise<PendingEpisode>>();

/** 后台预生成下一集；没有 AI 时什么都不做 */
export async function prefetchStory(key: string, args: { locale: string; role: string; words: { word: string; meaning: string }[] }): Promise<void> {
  if (slots.has(key) || args.words.length < 3 || !(await aiSource())) return;
  const job = (async () => {
    const story = await loadStory();
    const last = story?.episodes.at(-1);
    const n = (last?.n ?? 0) + 1;
    const ep = await generateStoryEpisode({
      ...args,
      episode: n,
      story: story && last ? { title: story.title, summary: story.summary, last: last.text } : null,
    });
    return { ...ep, n };
  })();
  job.catch(() => slots.delete(key));
  slots.set(key, job);
}

export function takeStory(key: string): Promise<PendingEpisode> | undefined {
  return slots.get(key);
}

/** 展示后记入连载（同一集只记一次） */
export async function commitEpisode(ep: PendingEpisode): Promise<void> {
  const story = await loadStory();
  if (story?.episodes.some((e) => e.n === ep.n)) return;
  const episodes = [...(story?.episodes ?? []), { n: ep.n, text: ep.episode, translation: ep.translation, words: ep.usedWords, at: Date.now() }].slice(-KEEP);
  await setMeta(META_KEY, { title: story?.title || ep.title, summary: ep.summary || story?.summary || "", episodes });
}
