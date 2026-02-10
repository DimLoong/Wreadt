// 有道公开发音接口封装：仅构建 URL，避免把 API 调用耦合到组件。
// 英文/日文统一走 dictvoice，type=2 为美式/默认语音。

const audioCache = new Map<string, HTMLAudioElement>();

export function getYoudaoPronounceUrl(text: string, lang: "en" | "ja"): string {
  const le = lang === "ja" ? "ja" : "en";
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2&le=${le}`;
}

export async function preloadAudio(text: string, lang: "en" | "ja"): Promise<HTMLAudioElement> {
  const key = `${lang}:${text}`;
  const cached = audioCache.get(key);
  if (cached) return cached;

  const audio = new Audio(getYoudaoPronounceUrl(text, lang));
  audio.preload = "auto";
  audioCache.set(key, audio);
  return audio;
}

export async function playAudio(text: string, lang: "en" | "ja"): Promise<void> {
  const audio = await preloadAudio(text, lang);
  await audio.play();
}
