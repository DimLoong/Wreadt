// 浏览器自带的语音合成：用于慢速朗读（有道接口不支持调速）
import type { Accent } from "./youdao";
import { playAudio } from "./youdao";

/** 慢速朗读一句英文；浏览器不支持语音合成时退回正常语速的有道发音 */
export async function speakSlow(text: string, accent: Accent = "us", rate = 0.7): Promise<void> {
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return playAudio(text, "en", accent);
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = accent === "uk" ? "en-GB" : "en-US";
  u.rate = rate;
  const voice = synth.getVoices().find((v) => v.lang === u.lang);
  if (voice) u.voice = voice;
  synth.speak(u);
}
