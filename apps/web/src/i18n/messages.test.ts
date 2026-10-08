import { describe, expect, it } from "vitest";
import { messages, t } from "./messages";

describe("i18n", () => {
  it("模板变量替换", () => {
    expect(t("zh-CN", "batch.mastered", { count: 12 })).toBe("这个词库你已经掌握了 12 个单词");
    expect(t("en-US", "batch.summary", { count: 7, accuracy: 90 })).toBe("7 words, 90% accuracy");
  });

  it("中英文案键一致", () => {
    expect(Object.keys(messages["en-US"]).sort()).toEqual(Object.keys(messages["zh-CN"]).sort());
  });
});
