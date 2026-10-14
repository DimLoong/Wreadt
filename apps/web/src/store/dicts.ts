import {
  CUSTOM_DICT_ID,
  DICTIONARIES,
  customWordToItem,
  findDict,
  isUserDict,
  mergeDictWords,
  parseQwertyDict,
  type Lang,
  type QwertyEntry,
  type WordItem,
} from "@wreadt/core";
import { listCustomWords, listDictExtras, migrateLegacyCards } from "./repo";
import { db } from "./db";

const cache = new Map<string, Promise<WordItem[]>>();

function loadStatic(dictId: string): Promise<WordItem[]> {
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

export function customLang(dictId: string): Lang | undefined {
  return (Object.keys(CUSTOM_DICT_ID) as Lang[]).find((l) => CUSTOM_DICT_ID[l] === dictId);
}

/** 加载一个词库：内置词库 = 静态文件 + 本地扩充词条；“我的词库”与用户创建的词库读 IndexedDB */
export async function loadDictWords(dictId: string): Promise<WordItem[]> {
  const lang = customLang(dictId);
  const words = lang
    ? (await listCustomWords(lang)).map(customWordToItem)
    : isUserDict(dictId)
      ? await (async () => {
          const dict = await db.userDicts.get(dictId);
          if (!dict || dict.deleted) throw new Error("词库已删除");
          return parseQwertyDict(await listDictExtras(dictId), dict);
        })()
      : await (async () => {
        const meta = findDict(dictId)!;
        const [base, extras] = await Promise.all([loadStatic(dictId), listDictExtras(dictId)]);
        if (!extras.length) return base;
        const ids = new Set(base.map((w) => w.id));
        return base.concat(parseQwertyDict(extras, meta).filter((w) => !ids.has(w.id)));
      })();
  await migrateLegacyCards(words);
  return words;
}

/** 多选词库：轮流取词并按单词去重 */
export async function loadDicts(dictIds: string[]): Promise<WordItem[]> {
  const lists = await Promise.all(dictIds.map(loadDictWords));
  return mergeDictWords(lists);
}

export interface LookupIndex {
  get(text: string): WordItem | undefined;
}

const indexCache = new Map<Lang, Promise<LookupIndex>>();

/** 在全部内置词库中查词（英文按拼写，日语按写法 / 读音 / 罗马音），用于“添加词汇”离线补全释义 */
export function lookupIndex(lang: Lang): Promise<LookupIndex> {
  let pending = indexCache.get(lang);
  if (!pending) {
    pending = Promise.all(DICTIONARIES.filter((d) => d.lang === lang).map((d) => loadStatic(d.id).catch(() => [] as WordItem[]))).then((lists) => {
      const map = new Map<string, WordItem>();
      const add = (k: string | undefined, w: WordItem) => {
        const key = k?.trim().toLowerCase();
        if (!key) return;
        const existing = map.get(key);
        // 同一个词多个词库都有时，保留释义更完整的
        if (!existing || (!existing.phonetic && w.phonetic) || w.meanings.join("").length > existing.meanings.join("").length) map.set(key, w);
      };
      for (const list of lists)
        for (const w of list) {
          add(w.answer, w);
          w.alternatives?.forEach((a) => add(a, w));
          if (lang === "ja") {
            w.display.split("/").forEach((d) => add(d, w));
            w.reading?.split("/").forEach((r) => add(r, w));
          }
        }
      return { get: (text: string) => map.get(text.trim().toLowerCase()) };
    });
    indexCache.set(lang, pending);
  }
  return pending;
}
