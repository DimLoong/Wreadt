// hyphen 没有自带类型：只用到同步断字函数
declare module "hyphen/en-us" {
  export function hyphenateSync(text: string, options?: { hyphenChar?: string; minWordLength?: number }): string;
}
