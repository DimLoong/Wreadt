import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, it, vi } from "vitest";
import { loadSyllables, syllableBreaks } from "./syllables";

beforeAll(async () => {
  // 测试环境没有静态文件服务：直接读 public/syllables.json
  const data = readFileSync(join(process.cwd(), "public/syllables.json"), "utf8");
  vi.stubGlobal("fetch", async () => new Response(data));
  await loadSyllables();
  vi.unstubAllGlobals();
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

it("优先使用词典式音节划分（severity 不再拆成 sever·i·ty）", () => {
  expect(split("severity")).toBe("se·ver·i·ty");
  expect(split("consistent")).toBe("con·sist·ent");
  expect(split("vocabulary")).toBe("vo·cab·u·lar·y");
});

it("短词不拆；短语按单词各自拆分，空格与短横线处不加点", () => {
  expect(syllableBreaks("cat")).toEqual([]);
  expect(split("user interface")).toBe("us·er in·ter·face");
  expect(split("stand-up")).toBe("stand-up");
});
