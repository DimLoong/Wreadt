// AI 测试集的固定输入：覆盖各任务、各职业与难度，以及历史上出过问题的情形。
// 输入结构与 apps/web/src/services/ai.ts 中各任务发送的完全一致。

import type { AiTask } from "../src/ai.ts";

export interface EvalCase {
  id: string;
  task: AiTask;
  /** 这组用例要重点防的问题，出现在报告里 */
  note: string;
  input: Record<string, unknown>;
  /** 输出中任何文本都不应匹配的内容（针对具体用例的回归检查） */
  forbid?: RegExp[];
}

const DEV = "软件开发：代码评审、站会、文档与架构讨论常用词";
const PM = "产品经理：需求、优先级、指标与干系人沟通常用词";
const UI = "UI 设计：布局、排版、配色、组件与设计交付常用词";
const UX = "UX 设计：用户研究、交互设计与可用性常用词";
const QA = "测试：测试用例、缺陷报告与自动化测试常用词";
const GENERAL = "通用职场";
const LOCALE = "zh-CN";

type Tag = "marked" | "today" | "weak" | "review";
const w = (word: string, meaning: string, tag: Tag = "today") => ({ word, meaning, tag });

export const EVAL_CASES: EvalCase[] = [
  // ---------- 场景问答出题（12） ----------
  {
    id: "scenario-dev-simple",
    task: "scenario-question",
    note: "简单题：短、直白、方向为中文",
    input: { role: DEV, locale: LOCALE, level: "simple", targetWords: [w("refactor", "重构"), w("readable", "可读的"), w("maintain", "维护", "weak")], avoidTitles: [] },
  },
  {
    id: "scenario-dev-medium",
    task: "scenario-question",
    note: "中等题：解释原因或比较",
    input: {
      role: DEV,
      locale: LOCALE,
      level: "medium",
      targetWords: [w("latency", "延迟"), w("cache", "缓存"), w("trade-off", "权衡", "marked"), w("bottleneck", "瓶颈", "weak"), w("scalable", "可扩展的", "review")],
      avoidTitles: [],
    },
  },
  {
    id: "scenario-dev-pro",
    task: "scenario-question",
    note: "专业题：what / why / how 与高级语法",
    input: {
      role: DEV,
      locale: LOCALE,
      level: "professional",
      targetWords: [w("idempotent", "幂等的", "marked"), w("retry", "重试"), w("consistency", "一致性"), w("rollback", "回滚", "weak"), w("deploy", "部署", "review"), w("postmortem", "事故复盘")],
      avoidTitles: [],
    },
  },
  {
    id: "scenario-qa-bug-offtopic",
    task: "scenario-question",
    note: "回归：报告 bug 的题里不能为了用上 password 等词加入题外要求（曾出现“禁止使用旧密码”）",
    input: {
      role: QA,
      locale: LOCALE,
      level: "simple",
      targetWords: [w("password", "密码", "marked"), w("reproduce", "复现"), w("severity", "严重程度"), w("expire", "过期", "weak"), w("mortgage", "抵押贷款", "review")],
      avoidTitles: [],
    },
    forbid: [/mortgage|抵押/i],
  },
  {
    id: "scenario-qa-medium",
    task: "scenario-question",
    note: "中等题：测试策略",
    input: { role: QA, locale: LOCALE, level: "medium", targetWords: [w("regression", "回归"), w("flaky", "不稳定的", "weak"), w("coverage", "覆盖率"), w("edge case", "边界情况", "marked")], avoidTitles: [] },
  },
  {
    id: "scenario-pm-simple",
    task: "scenario-question",
    note: "简单题：不要出得太专业",
    input: { role: PM, locale: LOCALE, level: "simple", targetWords: [w("priority", "优先级"), w("deadline", "截止日期"), w("stakeholder", "干系人", "weak")], avoidTitles: [] },
  },
  {
    id: "scenario-pm-pro",
    task: "scenario-question",
    note: "专业题：为方案辩护",
    input: {
      role: PM,
      locale: LOCALE,
      level: "professional",
      targetWords: [w("retention", "留存"), w("metric", "指标", "marked"), w("roadmap", "路线图"), w("hypothesis", "假设", "weak"), w("churn", "流失", "review")],
      avoidTitles: ["Defending a Feature Cut Before Launch"],
    },
  },
  {
    id: "scenario-ui-simple",
    task: "scenario-question",
    note: "简单题：设计类",
    input: { role: UI, locale: LOCALE, level: "simple", targetWords: [w("spacing", "间距"), w("contrast", "对比度", "marked"), w("hierarchy", "层级")], avoidTitles: ["Why Spacing Matters in UI Design"] },
  },
  {
    id: "scenario-ux-medium",
    task: "scenario-question",
    note: "中等题：用户研究",
    input: { role: UX, locale: LOCALE, level: "medium", targetWords: [w("usability", "可用性"), w("persona", "用户画像"), w("friction", "阻力", "weak"), w("onboarding", "新手引导")], avoidTitles: [] },
  },
  {
    id: "scenario-general-unrelated",
    task: "scenario-question",
    note: "目标词与职业无关时应舍弃，而不是硬塞",
    input: {
      role: GENERAL,
      locale: LOCALE,
      level: "medium",
      targetWords: [w("photosynthesis", "光合作用", "marked"), w("volcano", "火山"), w("negotiate", "谈判", "weak"), w("budget", "预算")],
      avoidTitles: [],
    },
    forbid: [/photosynthesis|volcano|光合|火山/i],
  },
  {
    id: "scenario-general-simple-empty",
    task: "scenario-question",
    note: "没有目标词时也能出题",
    input: { role: GENERAL, locale: LOCALE, level: "simple", targetWords: [], avoidTitles: [] },
  },
  {
    id: "scenario-dev-en-locale",
    task: "scenario-question",
    note: "界面语言为英文时，方向等字段应为英文",
    input: { role: "Software development", locale: "en", level: "simple", targetWords: [w("deprecate", "to mark as obsolete"), w("migrate", "to move to a new system")], avoidTitles: [] },
  },

  // ---------- 学习兴趣流（3） ----------
  {
    id: "feed-dev",
    task: "interest-feed",
    note: "无 Markdown、usedWords 真的出现在回复里",
    input: {
      role: DEV,
      locale: LOCALE,
      levels: ["simple", "medium"],
      avoidTopics: [],
      words: [
        { word: "refactor", meaning: "重构" },
        { word: "deadline", meaning: "截止日期" },
        { word: "trade-off", meaning: "权衡" },
        { word: "legacy", meaning: "遗留的" },
        { word: "estimate", meaning: "估算" },
        { word: "burnout", meaning: "倦怠" },
      ],
    },
  },
  {
    id: "feed-general",
    task: "interest-feed",
    note: "通用职场话题，不要考试腔",
    input: {
      role: GENERAL,
      locale: LOCALE,
      levels: ["simple", "medium"],
      avoidTopics: ["Is it okay to ship a feature with known minor bugs?"],
      words: [
        { word: "commute", meaning: "通勤" },
        { word: "productive", meaning: "高效的" },
        { word: "flexible", meaning: "灵活的" },
        { word: "distraction", meaning: "分心的事" },
      ],
    },
  },
  {
    id: "feed-pm-few-words",
    task: "interest-feed",
    note: "词很少时也不编造 usedWords",
    input: { role: PM, locale: LOCALE, levels: ["simple", "simple"], avoidTopics: [], words: [{ word: "prioritize", meaning: "确定优先次序" }] },
  },

  // ---------- 微阅读与词汇小知识（2） ----------
  {
    id: "reading-simple",
    task: "micro-reading",
    note: "简单短文：50～70 词，理解题答案在选项中",
    input: {
      role: GENERAL,
      locale: LOCALE,
      level: "simple",
      avoidTitles: [],
      words: [
        { word: "deadline", meaning: "截止日期" },
        { word: "colleague", meaning: "同事" },
        { word: "schedule", meaning: "日程" },
        { word: "relax", meaning: "放松" },
      ],
    },
  },
  {
    id: "tips-medium",
    task: "word-tips",
    note: "小知识简短具体，例句用到该词",
    input: {
      locale: LOCALE,
      level: "medium",
      count: 3,
      words: [
        { word: "affect", meaning: "影响" },
        { word: "deadline", meaning: "截止日期" },
        { word: "make a decision", meaning: "做决定" },
        { word: "complement", meaning: "补充" },
      ],
    },
  },

  // ---------- 场景点评（2） ----------
  {
    id: "review-simple-errors",
    task: "scenario-review",
    note: "simple 改写不要太复杂；original 逐字取自回答",
    input: {
      role: DEV,
      locale: LOCALE,
      level: "simple",
      expectedWords: 40,
      scenario: "Your new teammate asks why the team spends time on code reviews.",
      question: "Why are code reviews important?",
      recommendedWords: ["catch", "knowledge", "consistent"],
      answer: "Code review is important because it can catch bugs early. Also people can learning from each other and the code style keep consistent.",
    },
  },
  {
    id: "review-ignore-offtopic-direction",
    task: "scenario-review",
    note: "回归：出题时曾带出“禁止使用旧密码”的题外方向，点评不应把它当成缺失要点",
    input: {
      role: QA,
      locale: LOCALE,
      level: "simple",
      expectedWords: 40,
      scenario: "You found a bug where users cannot log in after resetting their password.",
      question: "How would you report this bug to the developers?",
      recommendedWords: ["reproduce", "severity"],
      answer:
        "I would write a clear bug report. First, I list the steps to reproduce: reset the password, then try to log in with the new one. The expected result is a successful login, but the actual result is an error. I would mark the severity as high because users are blocked.",
    },
    forbid: [/旧密码|old password/i],
  },

  // ---------- 其他任务（3） ----------
  {
    id: "confusable-en",
    task: "confusable-quiz",
    note: "答案必须是选项之一，题干含 ___",
    input: {
      lang: "en",
      locale: LOCALE,
      words: [
        { word: "affect", meaning: "影响（动词）" },
        { word: "complement", meaning: "补充" },
      ],
    },
  },
  {
    id: "examples-en",
    task: "word-examples",
    note: "例句含目标词，翻译为中文",
    input: { lang: "en", locale: LOCALE, word: "leverage" },
  },
  {
    id: "examples-ja",
    task: "word-examples",
    note: "日语例句用日文书写",
    input: { lang: "ja", locale: LOCALE, word: "taberu" },
  },
];
