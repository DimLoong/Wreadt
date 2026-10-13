import type { DictationSentence, FeedLevel } from "@wreadt/core";
import { generateDictation } from "../services/ai";
import { cachedLoad, feedWords, type FeedSource } from "./feed";

/** 没有 AI 时的内置句子 */
export const BUILTIN_DICTATION: Record<FeedLevel, DictationSentence[]> = {
  simple: [
    { text: "Can we talk about this after lunch?", translation: "我们午饭后再聊这个好吗？", word: "" },
    { text: "Please send me the report by Friday.", translation: "请在周五前把报告发给我。", word: "report" },
    { text: "The meeting has been moved to tomorrow.", translation: "会议改到明天了。", word: "meeting" },
    { text: "I will check the details and get back to you.", translation: "我核对一下细节再回复你。", word: "detail" },
    { text: "We need more time to finish the project.", translation: "我们需要更多时间来完成这个项目。", word: "project" },
    { text: "Thanks for your help with the new design.", translation: "谢谢你帮忙做新设计。", word: "design" },
    { text: "Let me know if you have any questions.", translation: "有问题的话告诉我。", word: "" },
    { text: "She works from home on Mondays.", translation: "她每周一在家办公。", word: "" },
  ],
  medium: [
    { text: "If we fix this bug today, we can release the update on time.", translation: "如果今天修好这个 bug，我们就能按时发布更新。", word: "release" },
    { text: "Could you share the slides before the meeting starts?", translation: "能在会议开始前把幻灯片分享出来吗？", word: "share" },
    { text: "The new feature was popular, but it made the app a little slower.", translation: "新功能很受欢迎，但让应用变慢了一点。", word: "feature" },
    { text: "We should ask the users what they actually need before we build it.", translation: "在做之前，我们应该先问问用户真正需要什么。", word: "" },
    { text: "I think we can reduce the cost without losing much quality.", translation: "我觉得可以在不太影响质量的情况下降低成本。", word: "reduce" },
    { text: "The team agreed to review the plan again next week.", translation: "团队同意下周再审一遍这个计划。", word: "review" },
    { text: "Although the deadline is close, the results look very promising.", translation: "虽然截止日期临近，但结果看起来很有希望。", word: "deadline" },
    { text: "Please make sure every change is tested before it goes live.", translation: "请确保每个改动在上线前都经过测试。", word: "" },
  ],
};

/** 一组 8 句；每天生成一次，换一组时重新生成 */
export async function loadDictation(roleText: string, locale: string, level: FeedLevel, force = false): Promise<{ sentences: DictationSentence[]; source: FeedSource }> {
  const { data, source } = await cachedLoad("dictation", `${roleText}|${locale}|${level}`, force, BUILTIN_DICTATION[level], async () => {
    const sentences = await generateDictation(roleText, await feedWords(), locale, level, 8);
    return { data: sentences, titles: [] };
  });
  return { sentences: data, source };
}
