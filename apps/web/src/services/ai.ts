import {
  AI_PROMPTS,
  findPreset,
  isQwenEndpoint,
  stripThinking,
  parseAnalysis,
  parseExamples,
  parsePhrases,
  type Phrase,
  parseExercises,
  parseExpansion,
  parseWordParts,
  parseExtracted,
  parseStoryEpisode,
  type StoryEpisode,
  type ExtractedWord,
  type WordPart,
  type AiTask,
  type AnalyzedWord,
  type DictMeta,
  type Example,
  type Exercise,
  type Lang,
  type QwertyEntry,
  type Scenario,
  type ScenarioLevel,
  type ScenarioReview,
  parseScenario,
  parseScenarioReview,
  scenarioHasCjk,
  parseConfusable,
  parseFeed,
  type ConfusableGroup,
  type FeedItem,
  type FeedLevel,
  type Reading,
  type WordTip,
  parseReading,
  parseWordTips,
  parseDictation,
  parseDictOutline,
  parsePracticeCards,
  parsePracticeReview,
  type CardPlan,
  type CardReview,
  type PracticeCard,
  type DictationSentence,
  type DictOutline,
} from "@wreadt/core";
import { getMeta, setMeta } from "../store/repo";
import { ApiError, authed, getSession } from "./api";

/** 用户自填的模型服务（只存本机 meta 表，不参与同步） */
export interface AiConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const AI_CONFIG_KEY = "aiConfig";
export const getAiConfig = () => getMeta<AiConfig>(AI_CONFIG_KEY);
export const saveAiConfig = (cfg: AiConfig | null) => setMeta(AI_CONFIG_KEY, cfg);

export type AiSource = "own" | "server" | null;

/** 优先用自己的 Key（不登录也可用），否则登录后走服务端 */
export async function aiSource(): Promise<AiSource> {
  if ((await getAiConfig())?.apiKey) return "own";
  if (await getSession()) return "server";
  return null;
}

export class AiUnavailableError extends Error {}

/** 千问等服务要求开启 json_object 时，消息中必须出现小写的 “json” 一词 */
export function withJsonHint(system: string): string {
  return system.includes("json") ? system : `${system}\n\nRespond with a valid json object only.`;
}

/** 浏览器直连：Claude 用官方 SDK，其他服务用 OpenAI 兼容接口 */
export async function chatDirect(cfg: AiConfig, system: string, user: string): Promise<string> {
  const preset = findPreset(cfg.provider);
  if (preset?.protocol === "anthropic") {
    const { chatClaude } = await import("./claude");
    return stripThinking(await chatClaude(cfg, withJsonHint(system), user));
  }
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: "system", content: withJsonHint(system) },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        // OpenAI 的推理模型等不接受 temperature
        ...(preset?.noTemperature ? {} : { temperature: 0.7 }),
        ...(isQwenEndpoint(cfg.baseUrl) ? { enable_thinking: false } : {}),
        ...preset?.extraBody,
      }),
    });
  } catch {
    throw new Error("无法连接 AI 服务，请检查接口地址与网络");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message ?? body?.message ?? res.statusText;
    if (res.status === 401) throw new Error(`API Key 无效：${msg}（Key 与接口地址需来自同一平台）`);
    if (res.status === 404 || /model/i.test(String(msg))) throw new Error(`AI 服务出错（${res.status}）：${msg}。可点“获取模型列表”选择可用模型`);
    throw new Error(`AI 服务出错（${res.status}）：${msg}`);
  }
  return stripThinking(body?.choices?.[0]?.message?.content ?? "");
}

/** 读取服务商的模型列表（OpenAI 兼容的 GET /models） */
export async function listModels(cfg: Pick<AiConfig, "baseUrl" | "apiKey" | "provider">): Promise<string[]> {
  if (findPreset(cfg.provider)?.protocol === "anthropic") {
    const { listClaudeModels } = await import("./claude");
    return (await listClaudeModels(cfg)).sort();
  }
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl.replace(/\/+$/, "")}/models`, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
  } catch {
    throw new Error("无法连接 AI 服务，请检查接口地址与网络");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status === 401 ? "API Key 无效或与该接口地址不匹配" : `获取模型列表失败（${res.status}）`);
  const list: unknown[] = Array.isArray(body?.data) ? body.data : [];
  return list.map((m) => (m as { id?: string })?.id).filter((id): id is string => Boolean(id)).sort();
}

/** 解析失败时把模型原始输出打到控制台，方便排查 */
function parseOrWarn<T>(task: AiTask, content: string, parse: (c: string) => T): T {
  try {
    return parse(content);
  } catch (err) {
    console.warn(`[AI] ${task} 输出无法使用：${(err as Error).message}`, content);
    throw err;
  }
}

/** 执行一个 AI 任务，返回模型输出的 JSON 文本；解析统一在 packages/core 中完成 */
async function runTask(task: AiTask, input: Record<string, unknown>): Promise<string> {
  const cfg = await getAiConfig();
  if (cfg?.apiKey) return chatDirect(cfg, AI_PROMPTS[task], JSON.stringify(input));
  if (await getSession()) {
    try {
      return (await authed<{ content: string }>("/ai/complete", { method: "POST", json: { task, input } })).content;
    } catch (err) {
      if (err instanceof ApiError && err.code === "AI_DISABLED") throw new AiUnavailableError(err.message);
      throw err;
    }
  }
  throw new AiUnavailableError("未配置 AI");
}

export async function generateExercises(lang: Lang, words: string[], locale: string): Promise<Exercise[]> {
  return parseExercises(await runTask("sentence-exercises", { lang, locale, words }));
}

export async function generateExamples(lang: Lang, word: string, locale: string): Promise<Example[]> {
  return (await generateWordExtras(lang, word, locale)).examples;
}

const extrasCache = new Map<string, Promise<{ examples: Example[]; phrases: Phrase[] }>>();

/** 一次请求同时生成例句与常用短语；同一个词只请求一次 */
export function generateWordExtras(lang: Lang, word: string, locale: string): Promise<{ examples: Example[]; phrases: Phrase[] }> {
  const key = `${lang}|${locale}|${word}`;
  let pending = extrasCache.get(key);
  if (!pending) {
    pending = runTask("word-examples", { lang, locale, word }).then((content) => ({ examples: parseExamples(content), phrases: parsePhrases(content) }));
    pending.catch(() => extrasCache.delete(key));
    extrasCache.set(key, pending);
  }
  return pending;
}

/** 分析用户输入的单词（可附原句），得到原形、读音、释义与例句 */
export async function analyzeWords(lang: Lang, words: string[], locale: string, context?: string): Promise<AnalyzedWord[]> {
  return parseAnalysis(await runTask("analyze-words", { lang, locale, words, ...(context ? { context } : {}) }), lang);
}

/** 用 AI 为职业词库生成新词条，排除已有词 */
export async function expandDict(meta: DictMeta, existing: string[], locale: string, count = 30): Promise<QwertyEntry[]> {
  const content = await runTask("expand-dict", { role: `${meta.name}：${meta.description}`, locale, count, exclude: existing });
  return parseExpansion(content, existing);
}

export interface TargetWord {
  word: string;
  meaning: string;
  tag: "marked" | "today" | "weak" | "review";
}

/** 出一道职业场景问答题，优先用上学习者的今日 / 易错 / 已学词 */
export async function generateScenario(
  role: string,
  targetWords: TargetWord[],
  locale: string,
  level: ScenarioLevel,
  avoidTitles: string[] = [],
): Promise<Scenario> {
  const input = { role, locale, level, targetWords, avoidTitles };
  const first = parseScenario(await runTask("scenario-question", input), level);
  // 偶尔题目会被写成中文，自动重出一次；仍不行就用第一次的结果
  if (!scenarioHasCjk(first)) return first;
  try {
    const retry = parseScenario(await runTask("scenario-question", input), level);
    return scenarioHasCjk(retry) ? first : retry;
  } catch {
    return first;
  }
}

export async function reviewScenario(role: string, scenario: Scenario, answer: string, locale: string): Promise<ScenarioReview> {
  return parseScenarioReview(
    await runTask("scenario-review", {
      role,
      locale,
      level: scenario.level,
      expectedWords: scenario.expectedWords,
      scenario: scenario.scenario,
      question: scenario.question,
      // 不发送回答方向与要点：点评只按题目本身评判，避免被不相关的方向带偏
      recommendedWords: scenario.recommendedWords.map((w) => w.word),
      answer,
    }),
  );
}

/** 易混词辨析题 */
export async function generateConfusableQuiz(lang: Lang, words: { word: string; meaning: string }[], locale: string): Promise<ConfusableGroup[]> {
  return parseConfusable(await runTask("confusable-quiz", { lang, locale, words }));
}

/** 学习兴趣流 · 回复练习：讨论话题 + 两个示范回复，levels 为每个话题的难度 */
export async function generateFeed(role: string, words: { word: string; meaning: string }[], locale: string, levels: FeedLevel[], avoidTopics: string[] = []): Promise<FeedItem[]> {
  const content = await runTask("interest-feed", { role, locale, words, levels, avoidTopics });
  return parseOrWarn("interest-feed", content, (c) => parseFeed(c, words.map((w) => w.word)));
}

/** 学习兴趣流 · 微阅读 */
export async function generateReading(role: string, words: { word: string; meaning: string }[], locale: string, level: FeedLevel, avoidTitles: string[] = []): Promise<Reading> {
  const content = await runTask("micro-reading", { role, locale, level, words, avoidTitles });
  return parseOrWarn("micro-reading", content, (c) => parseReading(c, words.map((w) => w.word)));
}

/** 自定义词库：把用户的场景描述拆成主题大纲 */
export async function generateDictOutline(description: string, lang: Lang, locale: string): Promise<DictOutline> {
  return parseOrWarn("dict-outline", await runTask("dict-outline", { description, lang, locale }), parseDictOutline);
}

/** 自定义词库：为一个主题生成词条 */
export async function generateDictWords(
  dict: string,
  topic: { title: string; examples: string[] },
  level: "basic" | "advanced",
  locale: string,
  count: number,
  exclude: string[],
): Promise<QwertyEntry[]> {
  const content = await runTask("dict-words", { dict, topic, level, locale, count, exclude });
  return parseOrWarn("dict-words", content, (c) => parseExpansion(c, exclude)).map((e) => ({ ...e, topic: topic.title }));
}

/** 穿插造句：为本组安排好的几张卡出题（与安排一一对应，不合格的为 null） */
export async function generatePracticeCards(plans: CardPlan[], locale: string): Promise<(PracticeCard | null)[]> {
  const content = await runTask("practice-cards", { locale, cards: plans.map((p) => ({ kind: p.kind, words: p.words })) });
  return parseOrWarn("practice-cards", content, (c) => parsePracticeCards(c, plans));
}

/** 穿插造句：一组结束时批量点评 */
export async function reviewPractice(
  items: { kind: string; words: string[]; question: string; reference: string; answer: string }[],
  locale: string,
): Promise<(CardReview | null)[]> {
  const content = await runTask("practice-review", { locale, items });
  return parseOrWarn("practice-review", content, (c) => parsePracticeReview(c, items.map((x) => x.words)));
}

/** 整句听写的句子 */
export async function generateDictation(role: string, words: { word: string; meaning: string }[], locale: string, level: FeedLevel, count = 8): Promise<DictationSentence[]> {
  return parseOrWarn("dictation-sentences", await runTask("dictation-sentences", { role, locale, level, words, count }), parseDictation);
}

/** 学习兴趣流 · 词汇小知识 */
export async function generateWordTips(words: { word: string; meaning: string }[], locale: string, level: FeedLevel, count = 3): Promise<WordTip[]> {
  return parseOrWarn("word-tips", await runTask("word-tips", { locale, level, words, count }), parseWordTips);
}

/** 构词拆分（一次请求一组词）；拆不开的词为空数组 */
export async function generateWordParts(words: string[], locale: string): Promise<Record<string, WordPart[]>> {
  const content = await runTask("word-parts", { locale, words });
  return parseOrWarn("word-parts", content, (c) => parseWordParts(c, words));
}

/** 粘贴即学：从一段工作中的英文里挑出值得学的词（例句摘自原文） */
export async function extractWords(text: string, locale: string): Promise<ExtractedWord[]> {
  const content = await runTask("extract-words", { locale, text });
  return parseOrWarn("extract-words", content, parseExtracted);
}

/** 连载小故事：用本组单词续写一集 */
export async function generateStoryEpisode(input: {
  locale: string;
  role: string;
  words: { word: string; meaning: string }[];
  story: { title: string; summary: string; last: string } | null;
  episode: number;
}): Promise<StoryEpisode> {
  const content = await runTask("story-episode", input);
  return parseOrWarn("story-episode", content, (c) => parseStoryEpisode(c, input.words.map((w) => w.word)));
}
