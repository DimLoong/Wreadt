// 有道公开发音接口：英文 / 日文统一走 dictvoice，type=2 为美式 / 默认语音
import type { Lang, WordItem } from "@wreadt/core";

const MAX_CACHE = 60;
const audioCache = new Map<string, HTMLAudioElement>();

export type Accent = "us" | "uk";

/** type=1 英音，type=2 美音（日语忽略） */
export function getYoudaoPronounceUrl(text: string, lang: Lang, accent: Accent = "us"): string {
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${accent === "uk" ? 1 : 2}&le=${lang}`;
}

export function preloadAudio(text: string, lang: Lang, accent: Accent = "us"): HTMLAudioElement {
  const key = `${lang}:${accent}:${text}`;
  const cached = audioCache.get(key);
  if (cached) return cached;

  const audio = new Audio(getYoudaoPronounceUrl(text, lang, accent));
  audio.preload = "auto";
  audioCache.set(key, audio);
  if (audioCache.size > MAX_CACHE) audioCache.delete(audioCache.keys().next().value!);
  return audio;
}

let current: HTMLAudioElement | null = null;

/** 停止正在播放的发音 */
export function stopAudio() {
  if (!current) return;
  current.pause();
  current = null;
}

/** 播放发音；同一时间只播一个，新的会打断旧的 */
export async function playAudio(text: string, lang: Lang, accent: Accent = "us"): Promise<void> {
  const audio = preloadAudio(text, lang, accent);
  if (current && current !== audio) current.pause();
  current = audio;
  audio.currentTime = 0;
  await audio.play();
}

/** 日语读假名更准确 */
export function speechText(word: Pick<WordItem, "lang" | "answer" | "reading">): string {
  return word.lang === "ja" ? word.reading?.split("/")[0] || word.answer : word.answer;
}
