import type { FeedItem, Scenario } from "@wreadt/core";
import { db } from "../store/db";
import { getMeta, setMeta } from "../store/repo";
import { lookupIndex } from "../store/dicts";
import { aiSource, generateFeed } from "../services/ai";
import { pickTargetWords } from "./practiceWords";
import { startOfDay } from "./date";

const FEED_KEY = "feed";

interface CachedFeed {
  day: number;
  items: FeedItem[];
  source: "ai" | "builtin";
  history: string[];
}

/** 没有 AI 时的内置话题 */
export const BUILTIN_FEED: FeedItem[] = [
  {
    topic: "Is it okay to ship a feature with known minor bugs?",
    topicTrans: "带着已知的小 bug 发布功能可以接受吗？",
    context: "Your team can launch on Friday, but two small UI bugs are still open.",
    contextTrans: "团队周五就能上线，但还有两个小的界面 bug 没修。",
    replies: [
      {
        author: "A PM at a startup",
        stance: "可以接受",
        text: "Honestly, I'd ship it. The deadline matters, and these bugs don't block anyone. We can set a clear priority to fix them next sprint. Waiting for perfection is a trade-off that usually costs more than it saves.",
        textTrans: "说实话我会发布。截止日期很重要，而且这些 bug 不影响使用。我们可以明确优先级，下个迭代修掉。追求完美是一种权衡，通常得不偿失。",
      },
      {
        author: "A QA engineer",
        stance: "要谨慎",
        text: "I'd be careful. Small bugs still shape the first impression, and users rarely report them. If we ship, let's at least document them and make sure they are easy to reproduce and fix quickly.",
        textTrans: "我会谨慎一些。小 bug 依然会影响第一印象，而且用户很少会主动反馈。如果要发布，至少把它们记录下来，确保容易复现、能快速修复。",
      },
    ],
    usedWords: ["deadline", "priority", "trade-off", "reproduce"],
  },
  {
    topic: "Do remote meetings make teams more or less efficient?",
    topicTrans: "远程会议让团队更高效还是更低效？",
    context: "Many teams now meet online even when they work in the same city.",
    contextTrans: "现在很多团队即使在同一个城市，也习惯线上开会。",
    replies: [
      {
        author: "A developer who works from home",
        stance: "更高效",
        text: "For me, remote meetings are more efficient. Everyone joins on time, the agenda is shared in advance, and we can record decisions automatically. I also get long blocks of focus between meetings.",
        textTrans: "对我来说远程会议更高效。大家都准时入会，议程提前共享，决定可以自动记录下来。会议之间我还有大段专注时间。",
      },
      {
        author: "A team lead",
        stance: "看情况",
        text: "It depends on the goal. Status updates work well online, but brainstorming suffers. People hesitate to interrupt each other, so ideas don't build on each other the way they do in a room.",
        textTrans: "要看目的。进度同步在线上效果不错，但头脑风暴会打折扣。大家不太好意思打断别人，想法就不像在会议室里那样能互相激发。",
      },
    ],
    usedWords: ["efficient", "agenda", "focus", "hesitate"],
  },
  {
    topic: "What's one habit that helped you learn faster?",
    topicTrans: "有什么习惯帮你学得更快？",
    context: "Share a small, practical habit that made a real difference in your learning.",
    contextTrans: "分享一个让你的学习真正有改善的小习惯。",
    replies: [
      {
        author: "A designer learning English",
        stance: "每天一点",
        text: "I review ten words every morning before checking messages. It only takes five minutes, but the consistency is what matters. After a month, I noticed I could understand meetings much better.",
        textTrans: "我每天早上看消息前先复习十个单词。只要五分钟，但关键在于坚持。一个月后，我发现开会时能听懂的多了很多。",
      },
      {
        author: "An engineer preparing for IELTS",
        stance: "学了就用",
        text: "I try to use every new word in a real sentence the same day, usually in a chat or an email. If I can't apply it, I probably don't really understand it yet.",
        textTrans: "每个新词我都尽量当天在真实的句子里用上，通常是在聊天或邮件里。如果用不出来，说明我可能还没真正理解它。",
      },
    ],
    usedWords: ["review", "consistency", "apply"],
  },
];

/** 兴趣流用的词：mark 的词优先，再按今日 / 易错 / 已学补充（仅英文） */
async function feedWords(): Promise<{ word: string; meaning: string }[]> {
  const [cards, index, marks] = await Promise.all([db.cards.toArray(), lookupIndex("en"), db.marks.toArray()]);
  const marked = marks.filter((m) => !m.deleted && m.word.lang === "en").slice(0, 3).map((m) => ({ word: m.word.answer, meaning: m.word.meanings.join("；") }));
  const rest = pickTargetWords(cards, index, Date.now(), 3).filter((w) => !marked.some((m) => m.word === w.word));
  return [...marked, ...rest].slice(0, 9).map(({ word, meaning }) => ({ word, meaning }));
}

/** 每天生成一次并缓存；force 为 true 时“换一批” */
export async function loadFeed(roleText: string, locale: string, force = false): Promise<{ items: FeedItem[]; source: "ai" | "builtin" }> {
  const today = startOfDay(Date.now());
  const cached = await getMeta<CachedFeed>(FEED_KEY);
  if (!force && cached?.day === today && cached.items.length) return cached;
  if (!(await aiSource())) return { items: BUILTIN_FEED, source: "builtin" };
  const words = await feedWords();
  const history = cached?.history ?? [];
  const items = await generateFeed(roleText, words, locale, 3, history.slice(-12));
  await setMeta(FEED_KEY, { day: today, items, source: "ai", history: [...history, ...items.map((i) => i.topic)].slice(-30) } satisfies CachedFeed);
  return { items, source: "ai" };
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
