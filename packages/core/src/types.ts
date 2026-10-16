export type Lang = "en" | "ja";

/** qwerty-learner 词库条目格式（职业词库额外带例句） */
export interface QwertyEntry {
  name: string;
  trans?: string | string[];
  usphone?: string;
  ukphone?: string;
  notation?: string;
  example?: string;
  exampleTrans?: string;
  /** 自定义词库中所属的主题（如“邮费与税费”） */
  topic?: string;
}

export interface Example {
  sentence: string;
  translation: string;
}

/** 打字练习中的一个词条，词库词与自定义词统一为该结构 */
export interface WordItem {
  /** 单词标识 wordKey(lang, …)：同一个词在任何词库中共享学习进度 */
  id: string;
  /** 来源词库 */
  dictId: string;
  lang: Lang;
  /** 大字展示的内容：英文单词 / 日文汉字写法 */
  display: string;
  /** 需要输入的答案：英文单词 / 日语罗马音 */
  answer: string;
  /** 其它同样算对的写法（如 bike = bicycle、kiro/kiroguramu） */
  alternatives?: string[];
  /** 日语假名读音 */
  reading?: string;
  /** 英文音标（美式优先，不含斜杠） */
  phonetic?: string;
  /** 英式音标（词库提供时） */
  phoneticUk?: string;
  meanings: string[];
  examples?: Example[];
  /** 旧版（按词库区分）的卡片 id `${dictId}:${name}`，用于迁移已有进度 */
  legacyId?: string;
}

/** topic：话题词库（日常闲聊、旅行、职场通用等） */
export type DictCategory = "topic" | "role" | "exam" | "industry" | "jlpt" | "custom" | "user";

export interface DictMeta {
  id: string;
  name: string;
  lang: Lang;
  category: DictCategory;
  /** 静态词库文件名（public/dicts 下），自定义词库为空 */
  file?: string;
  size: number;
  description: string;
}

export interface CustomWord {
  id: string;
  lang: Lang;
  answer: string;
  display?: string;
  reading?: string;
  phonetic?: string;
  meanings: string[];
  examples?: Example[];
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

/** 用户用 AI 创建的词库（词条存为 DictExtra，dictId 即本词库 id），同步 */
export interface UserDict {
  /** `user-<uuid>` */
  id: string;
  name: string;
  description: string;
  lang: Lang;
  /** 创建时选定的主题，扩充时沿用 */
  topics: string[];
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

/** 内置词库的扩充词条（如用 AI 扩充职业词库），按词库归属，只存在用户本地并同步 */
export interface DictExtra {
  /** `${dictId}|${wordKey}` */
  id: string;
  dictId: string;
  entry: QwertyEntry;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

/** mark 原因（可不选）：难拼 / 发音 / 易混 / 想用起来 */
export type MarkReason = "spelling" | "pronunciation" | "confusable" | "usage";

export const MARK_REASONS: MarkReason[] = ["spelling", "pronunciation", "confusable", "usage"];

/** 被 mark 的词；保存词条快照，列表页与专项练习无需重新加载词库 */
export interface Mark {
  /** = WordItem.id（wordKey） */
  id: string;
  word: WordItem;
  reason?: MarkReason;
  note?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}
