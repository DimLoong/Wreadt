import { useCallback, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { DICTIONARIES, customDictMeta, userDictMeta, type DictMeta } from "@wreadt/core";
import { db } from "../store/db";

/** 全部词库的元信息：内置词库、我的词库（英 / 日）、用户用 AI 创建的词库（含词数） */
export function useDictMetas(): { metas: DictMeta[]; name: (id: string) => string } {
  const dynamic = useLiveQuery(async () => {
    const custom = (await db.customWords.toArray()).filter((w) => !w.deleted);
    const userDicts = (await db.userDicts.toArray()).filter((d) => !d.deleted).sort((a, b) => a.createdAt - b.createdAt);
    const sizes = new Map<string, number>();
    for (const d of userDicts) sizes.set(d.id, await db.dictExtras.where("dictId").equals(d.id).filter((r) => !r.deleted).count());
    return [
      customDictMeta("en", custom.filter((w) => w.lang === "en").length),
      customDictMeta("ja", custom.filter((w) => w.lang === "ja").length),
      ...userDicts.map((d) => userDictMeta(d, sizes.get(d.id) ?? 0)),
    ];
  }, []);
  const metas = useMemo(() => [...DICTIONARIES, ...(dynamic ?? [customDictMeta("en", 0), customDictMeta("ja", 0)])], [dynamic]);
  const name = useCallback((id: string) => metas.find((d) => d.id === id)?.name ?? id, [metas]);
  return { metas, name };
}
