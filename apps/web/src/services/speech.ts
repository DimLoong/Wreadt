// 整句朗读：优先用浏览器 / 系统自带的高质量语音（Edge 的 Natural 神经语音、Chrome 的 Google 语音、macOS 的增强语音），
// 有道接口只适合单词，长句听起来像机械拼接。
import { playAudio, stopAudio, type Accent } from "./youdao";

/** 设置里的取值：auto 自动挑最自然的；youdao 用有道；其余为 voiceURI */
export type SentenceVoice = "auto" | "youdao" | (string & {});

/** macOS 自带的趣味 / 低质量声音，不适合学习 */
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|ralph|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley/i;

/** 声音的自然程度打分：越高越自然 */
export function voiceScore(v: Pick<SpeechSynthesisVoice, "name" | "lang" | "localService">, accent: Accent): number {
  if (!/^en[-_]/i.test(v.lang) || NOVELTY.test(v.name)) return -100;
  let score = 0;
  if (/natural|neural/i.test(v.name)) score += 10; // Edge 的在线神经语音
  else if (/online/i.test(v.name)) score += 6;
  if (/google/i.test(v.name)) score += 6; // Chrome 的在线语音
  if (/premium|enhanced|siri/i.test(v.name)) score += 6; // macOS 下载的高质量语音
  if (/samantha|daniel|karen|moira|ava|allison|tom|serena|aria|jenny|guy|libby|sonia|ryan/i.test(v.name)) score += 2;
  if (!v.localService) score += 1;
  const wanted = accent === "uk" ? /^en[-_]gb/i : /^en[-_]us/i;
  if (wanted.test(v.lang)) score += 3;
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

/** 可选的英文声音，最自然的在前 */
export async function englishVoices(accent: Accent): Promise<SpeechSynthesisVoice[]> {
  return (await loadVoices()).filter((v) => voiceScore(v, accent) > -100).sort((a, b) => voiceScore(b, accent) - voiceScore(a, accent));
}

async function resolveVoice(choice: SentenceVoice, accent: Accent): Promise<SpeechSynthesisVoice | null> {
  const voices = await englishVoices(accent);
  if (choice !== "auto" && choice !== "youdao") return voices.find((v) => v.voiceURI === choice) ?? voices[0] ?? null;
  return voices[0] ?? null;
}

/** 朗读一句英文。rate < 1 为慢速；没有可用的系统语音时退回有道 */
export async function speakSentence(text: string, opts: { accent: Accent; voice: SentenceVoice; rate?: number }): Promise<void> {
  const synth = window.speechSynthesis;
  const rate = opts.rate ?? 1;
  if (opts.voice === "youdao" && rate >= 1) return playAudio(text, "en", opts.accent);
  const voice = synth && typeof SpeechSynthesisUtterance !== "undefined" ? await resolveVoice(opts.voice, opts.accent) : null;
  if (!synth || !voice) return playAudio(text, "en", opts.accent);
  stopAudio();
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = rate;
  await new Promise<void>((resolve) => {
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}

export function stopSpeech() {
  window.speechSynthesis?.cancel();
  stopAudio();
}
