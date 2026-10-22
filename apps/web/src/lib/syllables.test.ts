import { beforeAll, expect, it } from "vitest";
import { loadSyllables, syllableBreaks } from "./syllables";

beforeAll(async () => {
  await loadSyllables();
});

const split = (w: string) => {
  const b = syllableBreaks(w);
  return [...w].map((ch, i) => (b.includes(i) ? `·${ch}` : ch)).join("");
};

it("按音节拆分英文单词", () => {
  expect(split("calculate")).toBe("cal·cu·late");
  expect(split("typography")).toBe("ty·pog·ra·phy");
  expect(split("deadline")).toBe("dead·line");
});

it("短词不拆；短语按单词各自拆分，空格与短横线处不加点", () => {
  expect(syllableBreaks("cat")).toEqual([]);
  expect(split("user interface")).toBe("user in·ter·face");
  expect(split("stand-up")).toBe("stand-up");
});
