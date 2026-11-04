import { useEffect, useMemo, useState } from "react";
import { chunkMatches, type SentenceChunk } from "@wreadt/core";
import { useSettings } from "../context/settings";
import { play } from "../services/sound";
import { markStudyActivity } from "../services/studyTime";

/**
 * 句子按段拼写的状态（造句卡、“用起来”练习共用；渲染见 components/typing/ChunkSpelling）：
 * 打满一段或按空格时检查这一段，对了进入下一段，不对就清空这一段重打（之前打对的保留），连错几次逐步露出字母。
 */

/** 句中的标点只显示，不用打；按下时忽略 */
const IGNORED = /[,.!?;:"“”()—–]/;

/** 一段连错几次后露出几个字母：1 次露首字母，2 次露一半，3 次全露 */
export const revealCount = (misses: number, len: number) => (misses <= 0 ? 0 : misses === 1 ? 1 : misses === 2 ? Math.ceil(len / 2) : len);

interface Options {
  /** 已经拼完（跳回来查看） */
  initialDone?: boolean;
  /** 之前拼错过的段（按段的文字） */
  initialMisses?: string[];
  /** 整句拼完 */
  onComplete?: () => void;
  /** 拼完后按任意键继续 */
  onContinue: () => void;
}

export function useChunkSpelling(chunks: SentenceChunk[], { initialDone = false, initialMisses = [], onComplete, onContinue }: Options) {
  const { settings } = useSettings();
  /** 要打的段在 chunks 里的下标 */
  const order = useMemo(() => chunks.flatMap((c, i) => (c.given ? [] : [i])), [chunks]);
  const [pos, setPos] = useState(initialDone ? order.length : 0);
  const [buf, setBuf] = useState("");
  /** 刚检查出错的一段：红色显示打错的内容，过一会儿或下一次按键时清掉 */
  const [wrong, setWrong] = useState<string | null>(null);
  const [misses, setMisses] = useState<Record<number, number>>(() => Object.fromEntries(initialMisses.map((text) => [chunks.findIndex((c) => !c.given && c.text === text), 1])));
  const [peeking, setPeeking] = useState(false);
  const done = pos >= order.length;
  const current = order[pos];
  const soundOn = settings.skin === "none";

  // 打错的内容红着停一下，再换回横线（连错时横线上会露出提示字母）
  useEffect(() => {
    if (wrong === null) return;
    const timer = window.setTimeout(() => setWrong(null), 700);
    return () => window.clearTimeout(timer);
  }, [wrong]);

  const check = (value: string) => {
    if (current === undefined) return;
    setBuf("");
    if (chunkMatches(chunks[current]!.text, value)) {
      setPos(pos + 1);
      if (pos + 1 >= order.length) onComplete?.();
      return;
    }
    setWrong(value);
    setMisses({ ...misses, [current]: (misses[current] ?? 0) + 1 });
    if (settings.sound && soundOn) play("wrong");
  };

  const press = (ch: string) => {
    markStudyActivity();
    if (done) {
      // 句末顺手打的空格、句号不算“继续”，免得一打完就跳走、看不到整句
      if (ch !== " " && !IGNORED.test(ch)) onContinue();
      return;
    }
    const target = chunks[current!]!.text;
    setWrong(null);
    if (ch === " ") {
      // 短语段中间的空格要打；其他时候空格表示这一段打完了
      if (buf && target[buf.length] === " ") setBuf(buf + " ");
      else if (buf.trim()) check(buf);
      return;
    }
    if (IGNORED.test(ch)) return;
    if (settings.keySound && soundOn) play("key");
    const next = buf + ch;
    if (next.length >= target.length) check(next);
    else setBuf(next);
  };

  const backspace = () => {
    setWrong(null);
    setBuf(buf.slice(0, -1));
  };

  const enter = () => {
    if (done) onContinue();
    else if (buf.trim()) check(buf);
  };

  const peekByClick = () => {
    setPeeking(true);
    window.setTimeout(() => setPeeking(false), 1500);
  };

  return {
    chunks,
    order,
    pos,
    buf,
    wrong,
    misses,
    peeking,
    done,
    press,
    backspace,
    enter,
    setPeeking,
    peekByClick,
    /** 拼错过的段（按段的文字） */
    missed: () => Object.keys(misses).map((i) => chunks[Number(i)]!.text),
  };
}

export type ChunkSpelling = ReturnType<typeof useChunkSpelling>;

