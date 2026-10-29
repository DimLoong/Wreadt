import { expect, it } from "vitest";
import { hasPos, lacksPos } from "./customWords";

it("hasPos / lacksPos：释义是否以词性开头", () => {
  expect(hasPos("n. 对齐")).toBe(true);
  expect(hasPos("phr. 就……达成一致")).toBe(true);
  expect(hasPos("vt.取消")).toBe(true);
  expect(hasPos("使一致，使对齐")).toBe(false);
  expect(lacksPos({ lang: "en", meanings: ["使一致", "n. 对齐"] })).toBe(true);
  // 后面不带词性的几条沿用前面的词性
  expect(lacksPos({ lang: "en", meanings: ["v. 挣扎", "奋斗", "努力", "n. 斗争"] })).toBe(false);
  expect(lacksPos({ lang: "en", meanings: ["n. 对齐"] })).toBe(false);
  expect(lacksPos({ lang: "ja", meanings: ["猫"] })).toBe(false); // 日语释义不要求词性
});
