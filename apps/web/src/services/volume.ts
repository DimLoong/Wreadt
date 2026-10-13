// 发音音量（0～1）：单词、整句、例句等所有朗读共用，由设置同步过来
let level = 1;

export function setPronounceVolume(v: number) {
  level = Math.min(1, Math.max(0, v));
}

export function pronounceVolume(): number {
  return level;
}
