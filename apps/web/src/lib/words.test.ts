import { expect, it } from "vitest";
import { dictLang, normalizeSentence, splitWordId } from "./words";

it("splitWordId / dictLang / normalizeSentence", () => {
  expect(splitWordId("cet4:give up")).toEqual({ dictId: "cet4", name: "give up" });
  expect(splitWordId("custom-ja:a:b")).toEqual({ dictId: "custom-ja", name: "a:b" });
  expect(dictLang("jlpt-n5")).toBe("ja");
  expect(dictLang("custom-en")).toBe("en");
  expect(normalizeSentence("  He  gave up. ")).toBe("he gave up");
});
