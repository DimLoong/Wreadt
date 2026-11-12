import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { isDue, type WordItem } from "@wreadt/core";
import { db } from "../store/db";
import { loadDueWords } from "../store/dicts";

/**
 * 现在到期、能在词库里找到的词（按到期先后）：首页的“复习 N 个到期词”、今日目标的“待复习”和复习本身都用它，
 * 数字才对得上（词已从词库删掉的旧复习记录不算）。加载中为 null。
 */
export function useDueWords(): WordItem[] | null {
  const key = useLiveQuery(async () => {
    const now = Date.now();
    return (await db.cards.toArray())
      .filter((c) => c.reps > 0 && isDue(c, now))
      .map((c) => c.id)
      .sort()
      .join(",");
  }, []);
  const [due, setDue] = useState<{ key: string; words: WordItem[] } | null>(null);
  useEffect(() => {
    if (key === undefined) return;
    let cancelled = false;
    void loadDueWords().then((words) => !cancelled && setDue({ key, words }));
    return () => {
      cancelled = true;
    };
  }, [key]);
  return due?.words ?? null;
}
