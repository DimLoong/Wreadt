import { expect, it } from "vitest";
import { detectLang, parseInput } from "./addWords";

it("detectLang", () => {
  expect(detectLang("deprecate")).toBe("en");
  expect(detectLang("食べる")).toBe("ja");
});

it("parseInput：单词列表、单个短语、句子", () => {
  expect(parseInput("deprecate, idempotent\npull request", "en")).toEqual({ kind: "words", items: ["deprecate", "idempotent", "pull request"] });
  expect(parseInput("pull request", "en")).toEqual({ kind: "words", items: ["pull request"] });
  expect(parseInput("The API is deprecated and will be removed.", "en")).toEqual({
    kind: "sentence",
    tokens: ["The", "API", "is", "deprecated", "and", "will", "be", "removed"],
  });
  expect(parseInput("食べる", "ja")).toEqual({ kind: "words", items: ["食べる"] });
  const ja = parseInput("毎朝コーヒーを飲みます。", "ja");
  expect(ja.kind).toBe("sentence");
  expect(ja.kind === "sentence" && ja.tokens.includes("コーヒー")).toBe(true);
});
