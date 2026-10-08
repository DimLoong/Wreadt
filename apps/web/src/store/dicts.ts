import { customWordToItem, findDict, parseQwertyDict, CUSTOM_DICT_ID, type Lang, type QwertyEntry, type WordItem } from "@wreadt/core";
import { listCustomWords } from "./repo";

const cache = new Map<string, Promise<WordItem[]>>();

/** 加载词库词条；内置词库按需 fetch 并缓存，自定义词库每次读 IndexedDB */
export function loadDictWords(dictId: string): Promise<WordItem[]> {
  const customLang = (Object.keys(CUSTOM_DICT_ID) as Lang[]).find((l) => CUSTOM_DICT_ID[l] === dictId);
  if (customLang) return listCustomWords(customLang).then((rows) => rows.map(customWordToItem));

  const meta = findDict(dictId);
  if (!meta?.file) return Promise.reject(new Error(`未知词库：${dictId}`));
  let pending = cache.get(dictId);
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}dicts/${meta.file}`)
      .then((res) => {
        if (!res.ok) throw new Error(`词库加载失败：${res.status}`);
        return res.json() as Promise<QwertyEntry[]>;
      })
      .then((entries) => parseQwertyDict(entries, meta));
    pending.catch(() => cache.delete(dictId));
    cache.set(dictId, pending);
  }
  return pending;
}
