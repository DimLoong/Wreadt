import type { NewsRef } from "@wreadt/core";
import { getMeta, setMeta } from "../store/repo";

// 热点新闻：维基百科首页“新闻”栏目（In the news），每天更新，浏览器可直接访问（允许跨域），每条配有词条的真实图片。
// 用作热点短读、场景题与兴趣流的素材；AI 模型本身不知道今天发生了什么，新闻必须由这里取来交给它。

export const INTERESTS = ["tech", "business", "science", "sports", "entertainment", "games", "culture"] as const;
export type Interest = (typeof INTERESTS)[number];

export interface NewsItem extends NewsRef {
  /** 相关词条的摘要（给 AI 当背景） */
  summary: string;
  topics: Interest[];
}

/** 伤亡、灾难类新闻不用于学习素材 */
const SKIP = /\b(kill(s|ed|ing)?|dead|deaths?|dies|died|attacks?|war|bomb(s|ing)?|shoot(ing|ings)?|massacre|earthquake|floods?|crash(es|ed)?|injur(y|ies|ed|ing)|hostages?|terror(ist|ism)?|missiles?|airstrikes?|wounded|murder(ed)?|genocide|famine|execut(ed|ion)|riots?|arson)\b/i;

const KEYWORDS: Record<Interest, RegExp> = {
  tech: /\b(software|computer|internet|online|AI|artificial intelligence|app|apps|security|vulnerab\w*|cyber\w*|chip|semiconductor|smartphone|Apple|Google|Microsoft|OpenAI|Meta|Amazon|robot\w*|satellite|data|crypto\w*|bitcoin|PHP|Linux|leap second)\b/i,
  business: /\b(compan(y|ies)|market|stock|econom\w*|bank|trade|tariff|merger|acqui\w*|CEO|revenue|inflation|startup|IPO|billion|industry|brand|retail)\b/i,
  science: /\b(scien\w*|research\w*|study|space|NASA|ESA|planet|moon|climate|species|discover\w*|physics|medicine|vaccine|health|telescope|astronom\w*|weights and measures|Nobel)\b/i,
  sports: /\b(cup|championship|olympic\w*|football|soccer|tennis|NBA|league|tournament|grand prix|marathon|cricket|basketball)\b/i,
  entertainment: /\b(film|movie|music|album|award|Oscar|Grammy|Emmy|series|actor|actress|singer|band|box office)\b/i,
  games: /\b(video game|gaming|esports|Nintendo|PlayStation|Xbox|Steam)\b/i,
  culture: /\b(art|museum|book|literature|heritage|language|festival|architecture|UNESCO)\b/i,
};

interface WikiLink {
  normalizedtitle?: string;
  extract?: string;
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const ymd = (d: Date) => [d.getUTCFullYear(), String(d.getUTCMonth() + 1).padStart(2, "0"), String(d.getUTCDate()).padStart(2, "0")];

async function fetchDay(d: Date): Promise<NewsItem[]> {
  const [y, m, day] = ymd(d);
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${day}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { news?: { story: string; links?: WikiLink[] }[] };
  const out: NewsItem[] = [];
  for (const n of data.news ?? []) {
    const headline = stripHtml(n.story);
    const links = n.links ?? [];
    // 优先用带配图的词条作为主词条
    const main = links.find((l) => l.thumbnail) ?? links[0];
    const summary = (main?.extract ?? "").slice(0, 500);
    if (!headline || SKIP.test(headline) || SKIP.test(summary)) continue;
    const text = `${headline} ${summary}`;
    out.push({
      id: `${y}${m}${day}-${(main?.normalizedtitle ?? headline).slice(0, 40)}`,
      headline,
      summary,
      image: main?.thumbnail?.source,
      url: main?.content_urls?.desktop?.page,
      topics: (Object.keys(KEYWORDS) as Interest[]).filter((k) => KEYWORDS[k].test(text)),
    });
  }
  return out;
}

let today: Promise<NewsItem[]> | null = null;

/** 今天的新闻（本机缓存一天）；当天还没更新时用昨天的；取不到时为空数组 */
export function loadNews(): Promise<NewsItem[]> {
  today ??= (async () => {
    const key = `news:${ymd(new Date()).join("-")}`;
    const cached = await getMeta<NewsItem[]>(key);
    if (cached?.length) return cached;
    let list: NewsItem[] = [];
    try {
      list = await fetchDay(new Date());
      if (!list.length) list = await fetchDay(new Date(Date.now() - 86_400_000));
    } catch {
      list = [];
    }
    if (list.length) await setMeta(key, list);
    return list;
  })();
  return today;
}

const USED_KEY = "newsUsed";

/** 按兴趣挑一条今天还没用过的新闻（都用过了就重新开始），并记为已用 */
export async function pickNews(interests: readonly string[], exclude: string[] = []): Promise<NewsItem | null> {
  const list = await loadNews();
  if (!list.length) return null;
  const used = new Set([...((await getMeta<string[]>(USED_KEY)) ?? []), ...exclude]);
  const score = (n: NewsItem) => n.topics.filter((t) => interests.includes(t)).length * 2 + (n.image ? 1 : 0) + Math.random();
  const fresh = list.filter((n) => !used.has(n.id));
  const pool = fresh.length ? fresh : list.filter((n) => !exclude.includes(n.id));
  const best = [...pool].sort((a, b) => score(b) - score(a))[0];
  if (!best) return null;
  await setMeta(USED_KEY, [...[...used].slice(-60), best.id]);
  return best;
}

/** 给兴趣流用：按兴趣排序的几条新闻（不标记为已用） */
export async function topNews(interests: readonly string[], count: number): Promise<NewsItem[]> {
  const list = await loadNews();
  return [...list].sort((a, b) => b.topics.filter((t) => interests.includes(t)).length - a.topics.filter((t) => interests.includes(t)).length).slice(0, count);
}

export const toRef = (n: NewsItem): NewsRef => ({ id: n.id, headline: n.headline, image: n.image, url: n.url });
