import { expect, it } from "vitest";
import type { Mark } from "@wreadt/core";
import { marksToAnki, marksToCsv } from "./exportMarks";

const mark: Mark = {
  id: "en:trade-off",
  word: { id: "en:trade-off", dictId: "role-pm", lang: "en", display: "trade-off", answer: "trade-off", phonetic: "ˈtreɪdɔːf", meanings: ["n. 权衡, 取舍"] },
  reason: "usage",
  createdAt: Date.UTC(2026, 9, 12),
  updatedAt: 0,
};

it("marksToCsv 转义逗号并带 BOM", () => {
  const csv = marksToCsv([mark], () => "产品经理");
  expect(csv.startsWith("﻿")).toBe(true);
  expect(csv.split("\n")[1]).toBe('trade-off,trade-off,ˈtreɪdɔːf,"n. 权衡, 取舍",usage,产品经理,2026-10-12T00:00:00.000Z');
});

it("marksToAnki", () => {
  expect(marksToAnki([mark])).toBe("trade-off\t/ˈtreɪdɔːf/<br>n. 权衡, 取舍");
});
