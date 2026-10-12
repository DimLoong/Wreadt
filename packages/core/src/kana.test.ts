import { isKanaText, kanaToRomaji } from "./kana.ts";

it("kanaToRomaji", () => {
  expect(kanaToRomaji("きょういく")).toBe("kyouiku");
  expect(kanaToRomaji("がっこう")).toBe("gakkou");
  expect(kanaToRomaji("まっちゃ")).toBe("matcha");
  expect(kanaToRomaji("コンピューター")).toBe("konpyuutaa");
  expect(kanaToRomaji("しんぶん")).toBe("shinbun");
  expect(isKanaText("ラーメン")).toBe(true);
  expect(isKanaText("教育")).toBe(false);
});
