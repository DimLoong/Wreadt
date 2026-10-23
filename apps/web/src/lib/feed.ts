import type { FeedItem, FeedLevel, Reading, Scenario, WordTip } from "@wreadt/core";
import { db } from "../store/db";
import { getMeta, setMeta } from "../store/repo";
import { loadDictWords, lookupIndex } from "../store/dicts";
import { aiSource, generateFeed, generateReading, generateWordTips } from "../services/ai";
import { pickTargetWords } from "./practiceWords";
import { startOfDay } from "./date";
import { topNews } from "./news";

/** 没有 AI 时的内置话题：一个简单、一个中等 */
export const BUILTIN_FEED: FeedItem[] = [
  {
    level: "simple",
    topic: "Do you work better in the morning or at night?",
    topicTrans: "你早上效率高，还是晚上效率高？",
    context: "Everyone has a time of day when they focus best.",
    contextTrans: "每个人都有一天中最专注的时段。",
    replies: [
      {
        author: "A designer",
        stance: "早上",
        text: "Morning, for sure. My mind is fresh, and I can focus on hard tasks before the meetings start.",
        textTrans: "肯定是早上。头脑清醒，可以在开会前专心做难的事。",
      },
      {
        author: "A developer",
        stance: "晚上",
        text: "I like the night. It is quiet, nobody sends messages, and I can finish my work without a break.",
        textTrans: "我喜欢晚上。很安静，没人发消息，我可以一口气做完工作。",
      },
    ],
    usedWords: ["focus", "task"],
  },
  {
    level: "medium",
    topic: "Is it okay to ship a feature with known minor bugs?",
    topicTrans: "带着已知的小 bug 发布功能可以接受吗？",
    context: "Your team can launch on Friday, but two small UI bugs are still open.",
    contextTrans: "团队周五就能上线，但还有两个小的界面 bug 没修。",
    replies: [
      {
        author: "A PM at a startup",
        stance: "可以接受",
        text: "I'd ship it. The deadline matters, and these bugs don't block anyone. We can set a clear priority to fix them next sprint.",
        textTrans: "我会发布。截止日期很重要，而且这些 bug 不影响使用。我们可以明确优先级，下个迭代修掉。",
      },
      {
        author: "A QA engineer",
        stance: "要谨慎",
        text: "I'd be careful. Small bugs still shape the first impression. If we ship, let's at least document them so they are easy to reproduce later.",
        textTrans: "我会谨慎一些。小 bug 依然会影响第一印象。如果要发布，至少把它们记录下来，方便之后复现。",
      },
    ],
    usedWords: ["deadline", "priority", "reproduce"],
  },
];

/** 没有 AI 时的内置短文 */
export const BUILTIN_READING: Reading = {
  title: "The Five-Minute Rule",
  text: "Lisa always felt busy, but she never finished her list. One day, a colleague told her a simple rule: if a task takes less than five minutes, do it now.\nLisa tried it. She answered short emails at once and fixed small problems right away. A week later, her list was much shorter, and she felt more relaxed.",
  textTrans: "Lisa 总觉得很忙，却从来做不完清单上的事。有一天，一位同事告诉她一个简单的规则：如果一件事不到五分钟就能做完，就马上做。\nLisa 试了试。她立刻回复简短的邮件，马上解决小问题。一周后，她的清单短了很多，她也感觉轻松了不少。",
  questions: [
    {
      question: "Why did Lisa's list become shorter?",
      options: ["She got a new job", "She did small tasks right away", "Her colleague helped her finish it"],
      answer: "She did small tasks right away",
      explanation: "她按“五分钟规则”马上处理小事，所以清单变短了。",
    },
  ],
  usedWords: ["colleague", "task"],
};

/** 没有 AI 时的内置小知识 */
export const BUILTIN_TIPS: WordTip[] = [
  {
    word: "deadline",
    kind: "collocation",
    title: "deadline 常和哪些动词搭配",
    tip: "赶上截止日期用 meet a deadline，错过用 miss a deadline，延期用 extend a deadline。",
    example: "We worked late to meet the deadline.",
    exampleTrans: "我们加班赶上了截止日期。",
  },
  {
    word: "affect",
    kind: "confusable",
    title: "affect 还是 effect？",
    tip: "affect 多作动词“影响”，effect 多作名词“效果、影响”。记法：Affect 是 Action（动作）。",
    example: "The delay will affect our launch date.",
    exampleTrans: "延误会影响我们的上线日期。",
  },
  {
    word: "schedule",
    kind: "usage",
    title: "ahead of / behind schedule",
    tip: "进度提前说 ahead of schedule，落后说 behind schedule，按计划说 on schedule。",
    example: "The project is two days behind schedule.",
    exampleTrans: "项目比计划落后两天。",
  },
];

/** 兴趣流用的词：mark 的词优先，再按今日 / 易错 / 已学补充（仅英文） */
/**
 * fillUpcoming：学过的词不足 3 个时，是否从词库取“即将学到的词”补足。
 * 只有词汇小知识需要（必须围绕具体的词）；话题与短文硬套随机词会很生硬，宁可让 AI 自由发挥。
 */
export async function feedWords(fillUpcoming = false): Promise<{ word: string; meaning: string }[]> {
  const [cards, index, marks] = await Promise.all([db.cards.toArray(), lookupIndex("en"), db.marks.toArray()]);
  const marked = marks.filter((m) => !m.deleted && m.word.lang === "en").slice(0, 3).map((m) => ({ word: m.word.answer, meaning: m.word.meanings.join("；") }));
  const rest = pickTargetWords(cards, index, Date.now(), 3).filter((w) => !marked.some((m) => m.word === w.word));
  const words = [...marked, ...rest].slice(0, 9).map(({ word, meaning }) => ({ word, meaning }));
  return words.length >= 3 || !fillUpcoming ? words : [...words, ...(await upcomingWords(6 - words.length))];
}

/** 新用户还没学过几个词：从当前所选的英文词库里随机取几个“即将学到的词” */
async function upcomingWords(n: number): Promise<{ word: string; meaning: string }[]> {
  const row = await db.settings.get("dictIds");
  const ids = (row?.value as string[] | undefined) ?? ["cet4"];
  const words = (await Promise.all(ids.map((id) => loadDictWords(id).catch(() => [])))).flat().filter((w) => w.lang === "en");
  const picked: { word: string; meaning: string }[] = [];
  for (let i = 0; i < n * 3 && picked.length < n && words.length; i += 1) {
    const w = words[Math.floor(Math.random() * words.length)]!;
    if (!picked.some((p) => p.word === w.answer)) picked.push({ word: w.answer, meaning: w.meanings.join("；") });
  }
  return picked;
}

interface Cached<T> {
  day: number;
  /** 生成参数（如难度）变了就重新生成 */
  key: string;
  data: T;
  history: string[];
}

export type FeedSource = "ai" | "builtin";

/**
 * 兴趣流各分页通用的加载：每天生成一次并缓存，参数变化或 force（换一批）时重新生成；
 * 没有 AI 时返回内置内容。history 记录最近的标题，用来避免重复。
 */
export async function cachedLoad<T>(
  name: string,
  key: string,
  force: boolean,
  builtin: T,
  generate: (history: string[]) => Promise<{ data: T; titles: string[] }>,
): Promise<{ data: T; source: FeedSource }> {
  // 同一内容同时只请求一次（如开发模式下的重复挂载、快速切换分页）
  const flight = `${name}|${key}|${force}`;
  const pending = inFlight.get(flight) as Promise<{ data: T; source: FeedSource }> | undefined;
  if (pending) return pending;
  const run = doCachedLoad(name, key, force, builtin, generate).finally(() => inFlight.delete(flight));
  inFlight.set(flight, run);
  return run;
}

const inFlight = new Map<string, Promise<unknown>>();

async function doCachedLoad<T>(
  name: string,
  key: string,
  force: boolean,
  builtin: T,
  generate: (history: string[]) => Promise<{ data: T; titles: string[] }>,
): Promise<{ data: T; source: FeedSource }> {
  const today = startOfDay(Date.now());
  const metaKey = `feed:${name}`;
  // 同一类内容的多批（瀑布流加载更多）共用一份历史，避免重复
  const historyKey = `feed:history:${name.split("#")[0]}`;
  const cached = await getMeta<Cached<T>>(metaKey);
  if (!force && cached?.day === today && cached.key === key) return { data: cached.data, source: "ai" };
  if (!(await aiSource())) return { data: builtin, source: "builtin" };
  const history = (await getMeta<string[]>(historyKey)) ?? cached?.history ?? [];
  // 模型偶尔返回无效内容，自动重试一次
  const { data, titles } = await generate(history).catch(() => generate(history));
  await setMeta(metaKey, { day: today, key, data, history: [] } satisfies Cached<T>);
  await setMeta(historyKey, [...history, ...titles].slice(-30));
  return { data, source: "ai" };
}

/** 第几批（瀑布流加载更多）：第一批沿用原来的缓存名 */
const slotName = (kind: string, slot: number) => (slot ? `${kind}#${slot}` : kind);

/** 回复练习：话题数与难度由 levels 决定（简单在前） */
export async function loadFeed(roleText: string, locale: string, levels: FeedLevel[], force = false, slot = 0): Promise<{ items: FeedItem[]; source: FeedSource }> {
  const { data, source } = await cachedLoad(slotName("replies", slot), `${roleText}|${locale}|${levels.join(",")}`, force, BUILTIN_FEED, async (history) => {
    // 按兴趣取今天的 3 条新闻作为素材（取不到时照常出题）
    const interests = ((await db.settings.get("interests"))?.value as string[] | undefined) ?? ["tech", "business", "science"];
    const news = await topNews(interests, 3).catch(() => []);
    const items = await generateFeed(roleText, await feedWords(), locale, levels, history.slice(-12), news);
    return { data: items, titles: items.map((i) => i.topic) };
  });
  return { items: data, source };
}

/** 微阅读：一篇小短文 + 理解题 */
export async function loadReading(roleText: string, locale: string, level: FeedLevel, force = false, slot = 0): Promise<{ reading: Reading; source: FeedSource }> {
  const { data, source } = await cachedLoad(slotName("reading", slot), `${roleText}|${locale}|${level}`, force, BUILTIN_READING, async (history) => {
    const reading = await generateReading(roleText, await feedWords(), locale, level, history.slice(-12));
    return { data: reading, titles: [reading.title] };
  });
  return { reading: data, source };
}

/** 词汇小知识：3 条 */
export async function loadTips(locale: string, level: FeedLevel, force = false, slot = 0): Promise<{ tips: WordTip[]; source: FeedSource }> {
  const { data, source } = await cachedLoad(slotName("tips", slot), `${locale}|${level}`, force, BUILTIN_TIPS, async () => {
    const words = await feedWords(true);
    // 小知识必须围绕具体的词，实在没有词就用内置内容
    if (!words.length) return { data: BUILTIN_TIPS, titles: [] };
    const tips = await generateWordTips(words, locale, level, 3);
    return { data: tips, titles: tips.map((t) => t.word) };
  });
  return { tips: data, source };
}

const SCORES_KEY = "feedScores";

/** 记录一次回复点评的分数，用于自动调整兴趣流难度 */
export async function recordFeedScore(score: number) {
  const list = (await getMeta<{ at: number; score: number }[]>(SCORES_KEY)) ?? [];
  await setMeta(SCORES_KEY, [...list, { at: Date.now(), score }].slice(-10));
}

/** 最近的点评分数（兴趣流回复与场景问答），按时间顺序 */
export async function recentScores(): Promise<number[]> {
  const [feed, practices] = await Promise.all([getMeta<{ at: number; score: number }[]>(SCORES_KEY), db.practices.orderBy("createdAt").reverse().limit(10).toArray()]);
  return [...(feed ?? []), ...practices.filter((p) => p.review).map((p) => ({ at: p.createdAt, score: p.review!.score }))]
    .sort((a, b) => a.at - b.at)
    .map((x) => x.score);
}

/** 把话题转成一道简单场景题，复用场景点评 */
export function feedToScenario(item: FeedItem): Scenario {
  return {
    level: "simple",
    title: item.topicTrans || item.topic,
    scenario: item.context,
    scenarioTrans: item.contextTrans,
    question: item.topic,
    questionTrans: item.topicTrans,
    directions: [],
    expectedWords: 50,
    keyPoints: [],
    recommendedWords: item.usedWords.map((w) => ({ word: w, meaning: "", usage: "", tag: "today" as const })),
    phrases: [],
    grammar: [],
  };
}
