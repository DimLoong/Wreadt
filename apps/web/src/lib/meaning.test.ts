import { expect, it } from "vitest";
import { splitMeaning } from "./meaning";

it("splitMeaning", () => {
  expect(splitMeaning("n. 题目，主题；")).toEqual({ pos: "n.", text: "题目，主题；" });
  expect(splitMeaning("adj.以奇想主题布置的")).toEqual({ pos: "adj.", text: "以奇想主题布置的" });
  expect(splitMeaning("取消， 撤销")).toEqual({ pos: "", text: "取消， 撤销" });
});
