export type Lang = "en" | "ja";

/** 打字练习中的一个词条，词库词与自定义词统一为该结构 */
export interface WordItem {
  /** `${dictId}:${answer}`，跨端稳定 */
  id: string;
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
  /** 英文音标（不含斜杠） */
  phonetic?: string;
  meanings: string[];
  phrases?: string[];
  examples?: string[];
}

export type DictCategory = "exam" | "industry" | "jlpt" | "custom";

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
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}
