import type { NewsBrief } from "@wreadt/core";
import { aiSource, generateNewsBrief } from "../services/ai";
import { pickNews, toRef, type NewsItem } from "./news";

// 热点短读：每组开始时按兴趣挑一条今天的新闻，在后台用本组单词改写成短讯，组末阅读

export interface ReadyBrief extends NewsBrief {
  news: ReturnType<typeof toRef>;
}

const slots = new Map<string, Promise<ReadyBrief | null>>();

/** 后台预生成；没有 AI 或今天没有合适的新闻时为 null */
export function prefetchNewsBrief(key: string, args: { locale: string; role: string; interests: readonly string[]; words: { word: string; meaning: string }[] }): void {
  if (slots.has(key) || args.words.length < 3) return;
  const job = (async () => {
    if (!(await aiSource())) return null;
    const news: NewsItem | null = await pickNews(args.interests);
    if (!news) return null;
    const brief = await generateNewsBrief({ locale: args.locale, role: args.role, words: args.words, news: { headline: news.headline, summary: news.summary } });
    return { ...brief, news: toRef(news) };
  })().catch(() => null);
  slots.set(key, job);
}

export function takeNewsBrief(key: string): Promise<ReadyBrief | null> | undefined {
  return slots.get(key);
}
