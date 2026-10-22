// 交互音效：用 Web Audio 实时合成（无音频文件、无版权问题）。
// 音色参考 macOS 系统提示音：正确为玻璃质感的铃音（Glass / Ping），错误为低沉短促的 Basso，按键为极轻的触感“嗒”。

export type SoundName = "key" | "wrong" | "correct" | "batch";
/** 按键音色：soft 轻触 · mechanical 机械键盘 · typewriter 打字机 */
export type KeySoundStyle = "soft" | "mechanical" | "typewriter";

let ctx: BaseAudioContext | null = null;
let master: GainNode | null = null;
let reverb: ConvolverNode | null = null;
let live: AudioContext | null = null;
let volume = 0.6;
let keyStyle: KeySoundStyle = "soft";

export function setKeySoundStyle(style: KeySoundStyle) {
  keyStyle = style;
}

function build(c: BaseAudioContext) {
  ctx = c;
  // 总线：压缩器防爆音 → 输出
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 3;
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(comp).connect(ctx.destination);

  // 合成一段 1.4 秒的小房间混响，给铃音一点空间感
  reverb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 1.4);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
  }
  reverb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  reverb.connect(wet).connect(master);
}

function setup(): AudioContext | null {
  if (!live) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    live = new Ctor();
  }
  if (ctx !== live) build(live);
  return live;
}

export function setVolume(v: number) {
  volume = Math.max(0, Math.min(1, v));
  if (master) master.gain.value = volume;
}

/** 输出到干声与混响 */
function out(node: AudioNode, reverbSend = 0) {
  node.connect(master!);
  if (reverbSend > 0 && reverb) {
    const send = ctx!.createGain();
    send.gain.value = reverbSend;
    node.connect(send).connect(reverb);
  }
}

/** 铃音：基频 + 非整数倍泛音（玻璃 / 金属质感），高频泛音衰减更快 */
function bell(freq: number, at: number, gain = 0.32, decay = 1.1) {
  const c = ctx!;
  const partials: [ratio: number, amp: number, decayScale: number][] = [
    [1, 1, 1],
    [2.01, 0.42, 0.55],
    [2.76, 0.26, 0.4],
    [4.07, 0.12, 0.28],
    [5.43, 0.07, 0.2],
  ];
  const sum = c.createGain();
  sum.gain.setValueAtTime(0, at);
  sum.gain.linearRampToValueAtTime(gain, at + 0.004);
  sum.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  for (const [ratio, amp, scale] of partials) {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq * ratio;
    const g = c.createGain();
    g.gain.setValueAtTime(amp, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay * scale);
    osc.connect(g).connect(sum);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }
  out(sum, 0.9);
}

/** 按键：带通噪声 + 短促高频正弦，约 25ms */
function keyTick(at: number) {
  const c = ctx!;
  const len = Math.floor(c.sampleRate * 0.025);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  const noise = c.createBufferSource();
  noise.buffer = buf;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 3200 + Math.random() * 600; // 轻微随机，避免机械感
  band.Q.value = 1.2;
  const g = c.createGain();
  g.gain.value = 0.9;
  noise.connect(band).connect(g);
  out(g);
  noise.start(at);

  const osc = c.createOscillator();
  osc.frequency.value = 1900;
  const og = c.createGain();
  og.gain.setValueAtTime(0.18, at);
  og.gain.exponentialRampToValueAtTime(0.0001, at + 0.02);
  osc.connect(og);
  out(og);
  osc.start(at);
  osc.stop(at + 0.03);
}

/** 一段衰减的滤波噪声（敲击声的“咔”） */
function noiseBurst(at: number, seconds: number, type: BiquadFilterType, freq: number, q: number, gain: number, curve = 6) {
  const c = ctx!;
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, curve);
  const noise = c.createBufferSource();
  noise.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = c.createGain();
  g.gain.value = gain;
  noise.connect(filter).connect(g);
  out(g);
  noise.start(at);
}

/** 一个音高下滑的短促正弦（敲击声的“咚”） */
function thump(at: number, from: number, to: number, seconds: number, gain: number) {
  const c = ctx!;
  const osc = c.createOscillator();
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + seconds * 0.7);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  osc.connect(g);
  out(g);
  osc.start(at);
  osc.stop(at + seconds + 0.02);
}

/** 机械键盘：轴体的清脆“咔” + 键帽触底的低沉“咚”（类似线性轴 / 茶轴） */
function mechanicalKey(at: number) {
  noiseBurst(at, 0.014, "highpass", 2600 + Math.random() * 500, 0.7, 0.75, 8);
  thump(at + 0.004, 210 + Math.random() * 30, 95, 0.06, 0.55);
  noiseBurst(at + 0.006, 0.03, "lowpass", 900, 0.8, 0.35, 5);
}

/** 打字机：较响的金属敲击 + 一点短促的金属余振 */
function typewriterKey(at: number) {
  noiseBurst(at, 0.035, "bandpass", 1700 + Math.random() * 300, 0.9, 1.1, 5);
  thump(at, 140, 80, 0.05, 0.35);
  const c = ctx!;
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = 3150 + Math.random() * 150;
  const g = c.createGain();
  g.gain.setValueAtTime(0.06, at + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
  osc.connect(g);
  out(g, 0.3);
  osc.start(at);
  osc.stop(at + 0.1);
}

const KEY_STYLES: Record<KeySoundStyle, (at: number) => void> = { soft: keyTick, mechanical: mechanicalKey, typewriter: typewriterKey };

/** 错误：低频三角波 + 正弦，音高轻微下滑，低通后短促衰减（类似 Basso） */
function basso(at: number) {
  const c = ctx!;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(1400, at);
  lp.frequency.exponentialRampToValueAtTime(300, at + 0.18);
  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(1.15, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.28);
  lp.connect(g);
  out(g, 0.25);
  for (const [type, freq, amp] of [
    ["triangle", 138, 0.9],
    ["sine", 69, 0.7],
    ["sine", 276, 0.18],
  ] as [OscillatorType, number, number][]) {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.88, at + 0.25);
    const og = c.createGain();
    og.gain.value = amp;
    osc.connect(og).connect(lp);
    osc.start(at);
    osc.stop(at + 0.32);
  }
}

const PLAYERS: Record<SoundName, (at: number) => void> = {
  key: (at) => KEY_STYLES[keyStyle](at),
  wrong: basso,
  // E6 → B6 上行纯五度，清亮不刺耳
  correct: (at) => {
    bell(1318.5, at, 0.42, 0.9);
    bell(1975.5, at + 0.075, 0.38, 1.2);
  },
  // C6 E6 G6 C7 琶音
  batch: (at) => [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(f, at + i * 0.09, 0.3, 1.4)),
};

export function play(name: SoundName) {
  const c = setup();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  try {
    PLAYERS[name](c.currentTime + 0.005);
  } catch {
    // 个别浏览器在后台标签页里会拒绝调度，忽略即可
  }
}

/** 离线渲染一个音效（调音与自动化检查用） */
export async function renderSound(name: SoundName, seconds = 2): Promise<AudioBuffer> {
  const offline = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
  build(offline);
  PLAYERS[name](0.005);
  const buffer = await offline.startRendering();
  ctx = null; // 下次 play 时重建实时音频图
  return buffer;
}
