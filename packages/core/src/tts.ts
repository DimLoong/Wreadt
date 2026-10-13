// 云端语音合成（阿里云百炼 · 千问 TTS）。服务端 apps/server/.../TtsService.VOICES 与此保持一致。

export const TTS_MODEL = "qwen3-tts-flash";

/** 适合英文朗读的声音 */
export const TTS_VOICES = [
  { id: "Jennifer", gender: "female" },
  { id: "Cherry", gender: "female" },
  { id: "Katerina", gender: "female" },
  { id: "Ryan", gender: "male" },
  { id: "Ethan", gender: "male" },
  { id: "Elias", gender: "male" },
] as const;

export type TtsVoice = (typeof TTS_VOICES)[number]["id"];
export const DEFAULT_TTS_VOICE: TtsVoice = "Jennifer";

/** 千问的 Key 也能调用百炼原生接口（浏览器可直连 dashscope.aliyuncs.com，其他地址不支持跨域） */
export const DASHSCOPE_NATIVE_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";

export function isTtsVoice(v: string): v is TtsVoice {
  return TTS_VOICES.some((x) => x.id === v);
}
