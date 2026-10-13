import { expect, it } from "vitest";
import { stripMarkdown } from "./markdown";

it("stripMarkdown 去掉加粗等标记并记下强调词", () => {
  expect(stripMarkdown("I think skipping the **stand-up** is risky. Use `code` and *this*.")).toEqual({
    text: "I think skipping the stand-up is risky. Use code and this.",
    emphasized: ["stand-up"],
  });
  expect(stripMarkdown("跳过**站会**有风险").text).toBe("跳过站会有风险");
});
