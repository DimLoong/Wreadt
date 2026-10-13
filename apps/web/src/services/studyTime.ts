import { db } from "../store/db";
import { startOfDay } from "../lib/date";

/** 当天在打字页实际练习的秒数，存于本地 meta（study:<当天零点>），每 10 秒落盘一次 */
const key = (day: number) => `study:${day}`;
let pending = 0;
let timer: number | null = null;

async function flush() {
  timer = null;
  if (!pending) return;
  const add = pending;
  pending = 0;
  const k = key(startOfDay(Date.now()));
  await db.transaction("rw", db.meta, async () => {
    const row = await db.meta.get(k);
    await db.meta.put({ key: k, value: ((row?.value as number) ?? 0) + add });
  });
}

let lastActivity = 0;
const IDLE_MS = 30_000;

/** 打字时调用；超过 30 秒没有按键视为离开，不计时 */
export function markStudyActivity() {
  lastActivity = Date.now();
}

export function addStudySeconds(seconds: number) {
  if (Date.now() - lastActivity > IDLE_MS) return;
  pending += seconds;
  timer ??= window.setTimeout(() => void flush(), 10_000);
}

export async function studySecondsOn(day: number): Promise<number> {
  return (((await db.meta.get(key(day)))?.value as number) ?? 0) + (day === startOfDay(Date.now()) ? pending : 0);
}

window.addEventListener?.("beforeunload", () => void flush());
