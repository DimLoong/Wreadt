import { expect, it } from "vitest";
import { maskWord, splitMeaning } from "./meaning";

it("splitMeaning", () => {
  expect(splitMeaning("n. 题目，主题；")).toEqual({ pos: "n.", text: "题目，主题；" });
  expect(splitMeaning("adj.以奇想主题布置的")).toEqual({ pos: "adj.", text: "以奇想主题布置的" });
  expect(splitMeaning("取消， 撤销")).toEqual({ pos: "", text: "取消， 撤销" });
});

it("maskWord 遮住目标词及其变形", () => {
  expect(maskWord("The themes of the theme park.", ["theme"])).toBe("The ______ of the _____ park.");
  expect(maskWord("Pull requests need review.", ["pull request"])).toBe("________ need review.");
  expect(maskWord("学習の進度を記録する。", ["学習"])).toBe("__の進度を記録する。");
});
