import { customWordToItem, parseNotation, parseQwertyDict, splitAnswers } from "./dict.ts";

describe("parseNotation", () => {
  it("拆分汉字写法与假名读音", () => {
    expect(parseNotation("男(おとこ)の子(こ)")).toEqual({ display: "男の子", reading: "おとこのこ" });
    expect(parseNotation("益々(ますます)")).toEqual({ display: "益々", reading: "ますます" });
    expect(parseNotation("どなた")).toEqual({ display: "どなた", reading: "どなた" });
    expect(parseNotation("若々しい(わかわかしい)")).toEqual({ display: "若々しい", reading: "わかわかしい" });
    expect(parseNotation("一通り(ひととおり")).toEqual({ display: "一通り", reading: "ひととおり" });
  });

  it("splitAnswers 拆分多种写法", () => {
    expect(splitAnswers("bike = bicycle")).toEqual(["bike", "bicycle"]);
    expect(splitAnswers("aquaporin(AQP)")).toEqual(["aquaporin"]);
    expect(splitAnswers("kiro/kiroguramu", "キロ/キログラム")).toEqual(["kiro", "kiroguramu"]);
    expect(splitAnswers("bikkuri/suru", "びっくり・する")).toEqual(["bikkuri suru"]);
    expect(splitAnswers("ageru (=yaru)", "あげる (=やる)")).toEqual(["ageru"]);
  });
});

describe("parseQwertyDict", () => {
  it("解析英文词条，trans 兼容字符串与数组，去重", () => {
    const words = parseQwertyDict(
      [
        { name: "cancel", trans: ["取消", "删去"], usphone: "'kænsl" },
        { name: "photosynthetic", trans: "adj. 光合的" },
        { name: "cancel", trans: ["重复"] },
        { name: " " },
      ],
      { id: "cet4", lang: "en" },
    );
    expect(words).toHaveLength(2);
    expect(words[0]).toMatchObject({ id: "cet4:cancel", display: "cancel", answer: "cancel", phonetic: "'kænsl", meanings: ["取消", "删去"] });
    expect(words[1]?.meanings).toEqual(["adj. 光合的"]);
  });

  it("解析日文词条", () => {
    const [word] = parseQwertyDict([{ name: "otokonoko", trans: ["男孩"], notation: "男(おとこ)の子(こ)" }], { id: "jlpt-n5", lang: "ja" });
    expect(word).toMatchObject({ display: "男の子", reading: "おとこのこ", answer: "otokonoko" });
  });
});

it("自定义词转换为词条", () => {
  const item = customWordToItem({ id: "x", lang: "en", answer: "kubernetes", meanings: ["容器编排"], createdAt: 0, updatedAt: 0 });
  expect(item).toMatchObject({ id: "custom-en:kubernetes", dictId: "custom-en", display: "kubernetes" });
});
