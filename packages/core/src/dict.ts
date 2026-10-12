import type { CustomWord, DictMeta, Example, Lang, QwertyEntry, WordItem } from "./types.ts";

/**
 * 单词标识：英文按小写拼写；日语同一罗马音可能对应多个词（kami：紙 / 神 / 髪），按写法区分。
 * 同一个词在任何词库里共享同一张复习卡片。
 */
export function wordKey(lang: Lang, answer: string, display?: string): string {
  const base = lang === "ja" ? display || answer : answer.toLowerCase();
  return `${lang}:${base.trim().replace(/\s+/g, " ")}`;
}

export function keyLang(key: string): Lang | undefined {
  const lang = key.slice(0, key.indexOf(":"));
  return lang === "en" || lang === "ja" ? lang : undefined;
}

/** 内置词库：职业词库由 Wreadt 整理，其余数据来自 qwerty-learner（GPL-3.0） */
export const DICTIONARIES: DictMeta[] = [
  { id: "role-dev", name: "软件开发", lang: "en", category: "role", file: "roles/role-dev.json", size: 260, description: "代码评审、站会、文档与架构讨论常用词" },
  { id: "role-pm", name: "产品经理", lang: "en", category: "role", file: "roles/role-pm.json", size: 255, description: "需求、优先级、指标与干系人沟通常用词" },
  { id: "role-ui", name: "UI 设计", lang: "en", category: "role", file: "roles/role-ui.json", size: 256, description: "布局、排版、配色、组件与设计交付常用词" },
  { id: "role-ux", name: "UX 设计", lang: "en", category: "role", file: "roles/role-ux.json", size: 240, description: "用户研究、交互设计与可用性常用词" },
  { id: "role-qa", name: "测试", lang: "en", category: "role", file: "roles/role-qa.json", size: 255, description: "测试用例、缺陷报告与自动化测试常用词" },
  { id: "cet4", name: "CET-4", lang: "en", category: "exam", file: "CET4_T.json", size: 2607, description: "大学英语四级" },
  { id: "cet6", name: "CET-6", lang: "en", category: "exam", file: "CET6_T.json", size: 2345, description: "大学英语六级" },
  { id: "gaokao", name: "高考 3500", lang: "en", category: "exam", file: "GaoKao_3500.json", size: 3893, description: "高考考纲词汇" },
  { id: "kaoyan", name: "考研", lang: "en", category: "exam", file: "2025KaoYanHongBaoShu.json", size: 6705, description: "考研英语词汇" },
  { id: "ielts", name: "IELTS", lang: "en", category: "exam", file: "IELTS_3_T.json", size: 3575, description: "雅思词汇" },
  { id: "it", name: "IT 行业", lang: "en", category: "industry", file: "itVocabulary.json", size: 1665, description: "程序员与 IT 从业者常用词" },
  { id: "biomedical", name: "生物医学", lang: "en", category: "industry", file: "BIOmedical.json", size: 560, description: "生物医学专业词汇" },
  { id: "jlpt-n5", name: "JLPT N5", lang: "ja", category: "jlpt", file: "JapVocabList.N5_zh.json", size: 669, description: "日语能力考 N5" },
  { id: "jlpt-n4", name: "JLPT N4", lang: "ja", category: "jlpt", file: "JapVocabList.N4_zh.json", size: 634, description: "日语能力考 N4" },
  { id: "jlpt-n3", name: "JLPT N3", lang: "ja", category: "jlpt", file: "JapVocabList.N3_zh.json", size: 1830, description: "日语能力考 N3" },
  { id: "jlpt-n2", name: "JLPT N2", lang: "ja", category: "jlpt", file: "JapVocabList.N2_zh.json", size: 1834, description: "日语能力考 N2" },
  { id: "jlpt-n1", name: "JLPT N1", lang: "ja", category: "jlpt", file: "JapVocabList.N1_zh.json", size: 3473, description: "日语能力考 N1" },
];

export const CUSTOM_DICT_ID: Record<Lang, string> = { en: "custom-en", ja: "custom-ja" };

export function customDictMeta(lang: Lang, size: number): DictMeta {
  return {
    id: CUSTOM_DICT_ID[lang],
    name: lang === "en" ? "我的英语词库" : "我的日语词库",
    lang,
    category: "custom",
    size,
    description: "自己添加的词汇",
  };
}

export function findDict(id: string): DictMeta | undefined {
  return DICTIONARIES.find((d) => d.id === id);
}


const NOTATION_RE = /([^()ぁ-んァ-ヶー]+)\(([^()]+)\)/g;

/** 解析 `男(おとこ)の子(こ)` → 展示 `男の子`、读音 `おとこのこ` */
export function parseNotation(notation: string): { display: string; reading: string } {
  const reading = notation.replace(NOTATION_RE, "$2");
  // `若々しい(わかわかしい)`、`一通り(ひととおり` 这类整词注音
  const whole = /^([^(]+)\(([ぁ-んァ-ヶー]+)\)?$/.exec(reading);
  if (whole) return { display: whole[1]!.trim(), reading: whole[2]! };
  return { display: notation.replace(NOTATION_RE, "$1"), reading };
}

/** 拆分 `bike = bicycle`、`kiro/kiroguramu`、`ageru (=yaru)`、`aquaporin(AQP)` 为多种写法 */
export function splitAnswers(name: string, notation?: string): string[] {
  let s = name.replace(/\(=?[^)]*\)/g, " ");
  // 日语注音里没有 `/` 时，罗马音中的 `/` 只是词间分隔（如 bikkuri/suru ↔ びっくり・する）
  if (notation !== undefined && !notation.includes("/")) s = s.replace(/\//g, " ");
  const parts = s.split(/[/=]/).map((p) => p.trim().replace(/\s+/g, " ")).filter(Boolean);
  return Array.from(new Set(parts));
}

function toList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).map((s) => s.trim()).filter(Boolean);
}

export function parseQwertyDict(entries: QwertyEntry[], meta: Pick<DictMeta, "id" | "lang">): WordItem[] {
  const seen = new Set<string>();
  const words: WordItem[] = [];
  for (const entry of entries) {
    const name = entry.name?.trim();
    if (!name) continue;
    const notation = meta.lang === "ja" ? entry.notation?.trim() || name : undefined;
    const [answer, ...alternatives] = splitAnswers(name, notation);
    if (!answer) continue;
    const parsed = notation !== undefined ? parseNotation(notation) : undefined;
    const id = wordKey(meta.lang, answer, parsed?.display);
    if (seen.has(id)) continue;
    seen.add(id);

    const base: WordItem = { id, dictId: meta.id, lang: meta.lang, display: name, answer, meanings: toList(entry.trans), legacyId: `${meta.id}:${name}` };
    if (alternatives.length) base.alternatives = alternatives;
    if (entry.example?.trim()) base.examples = [{ sentence: entry.example.trim(), translation: entry.exampleTrans?.trim() ?? "" }];
    if (parsed) {
      words.push({ ...base, ...parsed });
    } else {
      const phonetic = (entry.usphone || entry.ukphone)?.trim();
      words.push(phonetic ? { ...base, phonetic } : base);
    }
  }
  return words;
}

export function customWordToItem(word: CustomWord): WordItem {
  const examples: Example[] | undefined = word.examples?.length ? word.examples : undefined;
  return {
    id: wordKey(word.lang, word.answer, word.display),
    dictId: CUSTOM_DICT_ID[word.lang],
    lang: word.lang,
    answer: word.answer,
    display: word.display || word.answer,
    reading: word.reading,
    phonetic: word.phonetic,
    meanings: word.meanings,
    examples,
    legacyId: `${CUSTOM_DICT_ID[word.lang]}:${word.answer}`,
  };
}

export function isCustomDict(dictId: string): boolean {
  return dictId === CUSTOM_DICT_ID.en || dictId === CUSTOM_DICT_ID.ja;
}

/** 合并多个词库：按顺序轮流取词（多选时新词来自各个词库），同一个词只保留第一次出现 */
export function mergeDictWords(lists: WordItem[][]): WordItem[] {
  const seen = new Set<string>();
  const out: WordItem[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i += 1) {
    for (const list of lists) {
      const word = list[i];
      if (word && !seen.has(word.id)) {
        seen.add(word.id);
        out.push(word);
      }
    }
  }
  return out;
}
