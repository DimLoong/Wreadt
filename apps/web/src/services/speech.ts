// 统一的朗读服务（T3 发音兜底）：
// - 单词：有道发音；有道失败（网络 / 接口不可用）时改用系统语音；
// - 整句：优先云端神经语音（千问 TTS：自带千问 Key 时浏览器直连，否则登录后走服务端），
//   没有云端时用浏览器 / 系统里最自然的声音；有道只适合单词，长句听起来像机械拼接。
// 所有朗读共用“发音音量”。
import { DASHSCOPE_NATIVE_URL, DEFAULT_TTS_VOICE, TTS_MODEL, isQwenEndpoint, isTtsVoice, type Lang } from "@wreadt/core";
import { getAiConfig } from "./ai";
import { ApiError, authed, getSession } from "./api";
import { playAudio, stopAudio, type Accent } from "./youdao";
import { pronounceVolume } from "./volume";

/** 设置里的取值：auto 自动；youdao 有道；cloud:<声音> 云端；其余为系统声音的 voiceURI */
export type SentenceVoice = "auto" | "youdao" | `cloud:${string}` | (string & {});

/** macOS 自带的趣味 / 低质量声音，不适合学习 */
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/i;

/** 声音的自然程度打分：越高越自然 */
export function voiceScore(v: Pick<SpeechSynthesisVoice, "name" | "lang" | "localService">, accent: Accent, lang: Lang = "en"): number {
  const langRe = lang === "ja" ? /^ja[-_]/i : /^en[-_]/i;
  if (!langRe.test(v.lang) || NOVELTY.test(v.name)) return -100;
  let score = 0;
  if (/natural|neural/i.test(v.name)) score += 10; // Edge 的在线神经语音
  else if (/online/i.test(v.name)) score += 6;
  if (/google/i.test(v.name)) score += 6; // Chrome 的在线语音
  if (/premium|enhanced|siri/i.test(v.name)) score += 6; // macOS 下载的高质量语音
  if (/samantha|daniel|karen|moira|ava|allison|tom|serena|aria|jenny|guy|libby|sonia|ryan|kyoko|otoya|nanami/i.test(v.name)) score += 2;
  if (!v.localService) score += 1;
  if (lang === "en" && (accent === "uk" ? /^en[-_]gb/i : /^en[-_]us/i).test(v.lang)) score += 3;
  return score;
}

let voicesReady: Promise<SpeechSynthesisVoice[]> | null = null;

/** 语音列表是异步加载的：等到 voiceschanged 或最多 1.5 秒 */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!synth) return Promise.resolve([]);
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  voicesReady ??= new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener?.("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
  return voicesReady;
}

/** 可选的系统声音，最自然的在前 */
export async function systemVoices(accent: Accent, lang: Lang = "en"): Promise<SpeechSynthesisVoice[]> {
  return (await loadVoices()).filter((v) => voiceScore(v, accent, lang) > -100).sort((a, b) => voiceScore(b, accent, lang) - voiceScore(a, accent, lang));
}

/** 用系统语音朗读；没有可用声音时返回 false */
async function speakSystem(text: string, opts: { accent: Accent; lang?: Lang; voiceURI?: string; rate?: number }): Promise<boolean> {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return false;
  const voices = await systemVoices(opts.accent, opts.lang);
  const voice = voices.find((v) => v.voiceURI === opts.voiceURI) ?? voices[0];
  if (!voice) return false;
  stopAll();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = opts.rate ?? 1;
  u.volume = pronounceVolume();
  await new Promise<void>((resolve) => {
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
  return true;
}

// ---------- 云端语音 ----------

export type CloudSource = "own" | "server" | null;
/** 服务端返回“未启用”后，本次会话不再尝试 */
let serverDisabled = false;

/** 云端语音的来源：自带千问 Key 时浏览器直连；否则登录后走服务端 */
export async function cloudSource(): Promise<CloudSource> {
  const cfg = await getAiConfig();
  if (cfg?.apiKey && isQwenEndpoint(cfg.baseUrl)) return "own";
  if (!serverDisabled && (await getSession())) return "server";
  return null;
}

const CACHE_NAME = "wreadt-tts";
const memory = new Map<string, Promise<Blob>>();
const cacheUrl = (voice: string, text: string) => `https://tts.wreadt.local/${TTS_MODEL}/${voice}/${encodeURIComponent(text)}`;

async function synthesizeOwn(text: string, voice: string, apiKey: string): Promise<Blob> {
  const res = await fetch(DASHSCOPE_NATIVE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: TTS_MODEL, input: { text, voice, language_type: "English" } }),
  });
  const body = await res.json().catch(() => ({}));
  const url: string | undefined = body?.output?.audio?.url;
  if (!res.ok || !url) throw new Error(body?.message ?? `语音合成失败（${res.status}）`);
  // 对象存储返回 http 地址，页面是 https 时需要换成 https
  const audio = await fetch(url.replace(/^http:/, "https:"));
  if (!audio.ok) throw new Error(`语音下载失败（${audio.status}）`);
  return audio.blob();
}

/** 取一句话的云端音频：先查本地缓存（Cache Storage），没有再合成并写入缓存 */
export function cloudAudio(text: string, voice: string, source: Exclude<CloudSource, null>): Promise<Blob> {
  const key = cacheUrl(voice, text);
  let pending = memory.get(key);
  if (pending) return pending;
  pending = (async () => {
    const cache = typeof caches !== "undefined" ? await caches.open(CACHE_NAME).catch(() => null) : null;
    const hit = await cache?.match(key);
    if (hit) return hit.blob();
    let blob: Blob;
    if (source === "own") {
      const cfg = await getAiConfig();
      blob = await synthesizeOwn(text, voice, cfg!.apiKey);
    } else {
      try {
        blob = await authed<Blob>("/tts", { method: "POST", json: { text, voice }, blob: true });
      } catch (err) {
        if (err instanceof ApiError && err.code === "TTS_DISABLED") serverDisabled = true;
        throw err;
      }
    }
    await cache?.put(key, new Response(blob, { headers: { "Content-Type": blob.type || "audio/wav" } })).catch(() => undefined);
    return blob;
  })();
  pending.catch(() => memory.delete(key));
  memory.set(key, pending);
  if (memory.size > 40) memory.delete(memory.keys().next().value!);
  return pending;
}

let cloudPlayer: HTMLAudioElement | null = null;

async function playCloud(text: string, voice: string, source: Exclude<CloudSource, null>, rate: number): Promise<void> {
  const blob = await cloudAudio(text, voice, source);
  stopAll();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.volume = pronounceVolume();
  audio.playbackRate = rate; // 慢速时保持音调
  cloudPlayer = audio;
  try {
    await audio.play();
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onpause = () => resolve();
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- 对外接口 ----------

export function stopAll() {
  window.speechSynthesis?.cancel();
  cloudPlayer?.pause();
  cloudPlayer = null;
  stopAudio();
}

/** 设置里选的声音对应的云端声音名；不是云端时为 null */
function cloudVoiceOf(choice: SentenceVoice): string | null {
  if (choice === "auto") return DEFAULT_TTS_VOICE;
  if (choice.startsWith("cloud:")) {
    const v = choice.slice(6);
    return isTtsVoice(v) ? v : DEFAULT_TTS_VOICE;
  }
  return null;
}

/** 朗读一句英文。rate < 1 为慢速。云端失败时退回系统语音，再退回有道 */
export async function speakSentence(text: string, opts: { accent: Accent; voice: SentenceVoice; rate?: number }): Promise<void> {
  const rate = opts.rate ?? 1;
  const cloudVoice = cloudVoiceOf(opts.voice);
  if (cloudVoice) {
    const source = await cloudSource();
    if (source) {
      try {
        return await playCloud(text, cloudVoice, source, rate);
      } catch {
        // 云端不可用时继续往下兜底
      }
    }
  }
  if (opts.voice !== "youdao" || rate < 1) {
    const voiceURI = opts.voice.startsWith("cloud:") || opts.voice === "auto" ? undefined : opts.voice;
    if (await speakSystem(text, { accent: opts.accent, voiceURI, rate })) return;
  }
  return playAudio(text, "en", opts.accent);
}

/** 预先准备下一句的云端音频，切换时几乎即时 */
export async function preloadSentence(text: string, voice: SentenceVoice): Promise<void> {
  const cloudVoice = cloudVoiceOf(voice);
  const source = cloudVoice ? await cloudSource() : null;
  if (cloudVoice && source) await cloudAudio(text, cloudVoice, source).catch(() => undefined);
}

/** 朗读单词：有道发音，失败时（非浏览器拦截自动播放）改用系统语音 */
export async function pronounceWord(text: string, lang: Lang, accent: Accent = "us"): Promise<void> {
  try {
    await playAudio(text, lang, accent);
  } catch (err) {
    if ((err as DOMException)?.name === "NotAllowedError") throw err;
    if (!(await speakSystem(text, { accent, lang }))) throw err;
  }
}
