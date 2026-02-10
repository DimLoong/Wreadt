import { describe, expect, it } from "vitest";
import { t } from "./messages";

describe("i18n", () => {
  it("中文模板变量替换", () => {
    expect(t("zh-CN", "mastered", { count: 12 })).toBe("你掌握了 12 个单词");
  });

  it("英文模板变量替换", () => {
    expect(t("en-US", "mastered", { count: 7 })).toBe("You have mastered 7 words");
  });
});
