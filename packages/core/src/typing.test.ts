import { accuracy, canonicalRomaji, isAnswerCorrect, isValidPrefix, letterHint, segmentStart } from "./typing.ts";
import type { WordItem } from "./types.ts";

const en: WordItem = { id: "e", dictId: "d", lang: "en", display: "give up", answer: "give up", meanings: [] };
const ja: WordItem = { id: "j", dictId: "d", lang: "ja", display: "教育", reading: "きょういく", answer: "kyouiku", meanings: [] };
const shashin: WordItem = { id: "s", dictId: "d", lang: "ja", display: "写真", reading: "しゃしん", answer: "shashin", meanings: [] };

describe("isAnswerCorrect", () => {
  it("英文忽略大小写与多余空格", () => {
    expect(isAnswerCorrect(en, "Give  Up ")).toBe(true);
    expect(isAnswerCorrect(en, "giveup")).toBe(false);
  });

  it("日语接受多种罗马音、假名与汉字", () => {
    for (const v of ["kyouiku", "kyoiku", "kyōiku".replace("ō", "o"), "きょういく", "キョウイク", "教育"]) {
      expect(isAnswerCorrect(ja, v)).toBe(true);
    }
    expect(isAnswerCorrect(shashin, "syasinn")).toBe(true);
    expect(isAnswerCorrect(ja, "kyouika")).toBe(false);
  });
});

describe("isValidPrefix", () => {
  it("英文前缀", () => {
    expect(isValidPrefix(en, "giv")).toBe(true);
    expect(isValidPrefix(en, "give ")).toBe(true);
    expect(isValidPrefix(en, "gx")).toBe(false);
  });

  it("日语未完成音节不判错", () => {
    expect(isValidPrefix(shashin, "sy")).toBe(true);
    expect(isValidPrefix(shashin, "s")).toBe(true);
    expect(isValidPrefix(ja, "kyo")).toBe(true);
    expect(isValidPrefix(ja, "kyou")).toBe(true);
    expect(isValidPrefix(ja, "kya")).toBe(false);
    expect(isValidPrefix(ja, "きょ")).toBe(true);
  });
});

it("canonicalRomaji 统一训令式与长音", () => {
  expect(canonicalRomaji("tukue")).toBe(canonicalRomaji("tsukue"));
  expect(canonicalRomaji("gakkou")).toBe(canonicalRomaji("gakko"));
});

it("letterHint 随错误次数逐步揭示", () => {
  expect(letterHint(en, 2)).toBe("");
  expect(letterHint(en, 3)).toBe("g");
  expect(letterHint(en, 5)).toBe("gi");
  expect(letterHint(en, 100)).toBe("give u");
  // 短语中只提示当前单词：从第二个单词开头算起
  expect(letterHint(en, 3, 5)).toBe("give u");
  expect(letterHint(en, 2, 5)).toBe("");
});

it("segmentStart：短语按单词分段，出错只回到当前单词开头", () => {
  expect(segmentStart("expected result", 12)).toBe(9); // 在 result 里出错
  expect(segmentStart("expected result", 8)).toBe(8); // 在空格处出错：原地不动
  expect(segmentStart("expected result", 3)).toBe(0);
  expect(segmentStart("deadline", 4)).toBe(0);
});

it("accuracy 按按键计算", () => {
  expect(accuracy(0, 0)).toBe(100);
  expect(accuracy(10, 2)).toBe(80);
});
