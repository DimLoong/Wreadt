import { adjacentKeys, analyzeSpelling, classifyMistake, hasPattern, mistakeFromWords } from "./spelling.ts";

const m = (pos: number, expected: string, typed: string) => ({ pos, expected, typed });

it("adjacentKeys 识别相邻键", () => {
  expect(adjacentKeys("e", "r")).toBe(true);
  expect(adjacentKeys("e", "d")).toBe(true);
  expect(adjacentKeys("e", "a")).toBe(false);
  expect(adjacentKeys("e", "e")).toBe(false);
});

it("classifyMistake 归类常见拼写难点", () => {
  // receive：把 ei 打成 ie
  expect(classifyMistake("receive", m(3, "e", "i"))).toBe("ie-ei");
  // accommodate：第二个 c 没双，直接按了 o
  expect(classifyMistake("accommodate", m(2, "c", "o"))).toBe("double");
  // different 打成 diff→ 多双一次（defer → deffer）
  expect(classifyMistake("defer", m(3, "e", "f"))).toBe("double");
  // mention 打成 mension
  expect(classifyMistake("mention", m(3, "t", "s"))).toBe("tion-sion");
  // independent 打成 independant
  expect(classifyMistake("independent", m(8, "e", "a"))).toBe("ance-ence");
  // responsible 打成 responsable
  expect(classifyMistake("responsible", m(7, "i", "a"))).toBe("able-ible");
  // knowledge 漏掉 k
  expect(classifyMistake("knowledge", m(0, "k", "n"))).toBe("silent");
  // form 打成 from
  expect(classifyMistake("form", m(1, "o", "r"))).toBe("transpose");
  // e 按成相邻的 r
  expect(classifyMistake("ten", m(1, "e", "r"))).toBe("slip");
  // separate 打成 seperate
  expect(classifyMistake("separate", m(3, "a", "e"))).toBe("vowel");
});

it("analyzeSpelling 汇总，同一处反复按错只算一次，手误单列", () => {
  const report = analyzeSpelling([
    { answer: "receive", mistakes: [m(3, "e", "i"), m(3, "e", "i")], at: 1 },
    { answer: "believe", mistakes: [m(3, "i", "e")], at: 2 },
    { answer: "ten", mistakes: [m(1, "e", "r")], at: 3 },
  ]);
  expect(report.total).toBe(3);
  expect(report.slips).toBe(1);
  expect(report.patterns[0]).toMatchObject({ pattern: "ie-ei", count: 2, words: ["receive", "believe"] });
});

it("hasPattern 与 mistakeFromWords", () => {
  expect(hasPattern("ceiling", "ie-ei")).toBe(true);
  expect(hasPattern("committee", "double")).toBe(true);
  expect(hasPattern("cat", "double")).toBe(false);
  expect(mistakeFromWords("separate", "seperate")).toEqual({ pos: 3, expected: "a", typed: "e" });
  expect(mistakeFromWords("report", "report")).toBeNull();
});
