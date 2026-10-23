import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../store/db";
import { SettingsProvider } from "../context/settings";
import { FocusProvider } from "../context/focus";
import TypingPage from "./TypingPage";

const DICT = [
  { name: "cat", trans: ["猫"], usphone: "kæt" },
  { name: "dog", trans: ["狗"], usphone: "dɔɡ" },
];

function renderHome() {
  return render(
    <MemoryRouter>
      <SettingsProvider>
        <FocusProvider>
          <TypingPage />
        </FocusProvider>
      </SettingsProvider>
    </MemoryRouter>,
  );
}

describe("TypingPage", () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.settings.bulkPut([
      { key: "dictId", value: "biomedical", updatedAt: 0 },
      { key: "batchSize", value: 5, updatedAt: 0 },
      { key: "locale", value: "zh-CN", updatedAt: 0 },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => DICT }));
  });

  it("默写：下划线逐个显示，按错清空，完成后按任意键继续；一组结束展示总结并写入记录", async () => {
    renderHome();
    const input = await screen.findByLabelText("输入上面的单词");
    await waitFor(() => expect(input).toHaveFocus());
    expect(screen.getByText("猫")).toBeInTheDocument();
    const letters = () => document.querySelector(".word-letters-row")!.textContent;
    expect(letters()).toBe("___");

    const keys = (text: string) => [...text].forEach((key) => fireEvent.keyDown(input, { key }));
    keys("ca");
    expect(letters()).toBe("ca_");
    keys("t");
    expect(letters()).toBe("cat");
    expect(screen.getByText("正确！按任意键继续")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: "q" });

    await screen.findByText("狗");
    keys("dx");
    expect(letters()).toBe("dx_");
    await waitFor(() => expect(letters()).toBe("___"));
    keys("dog");
    fireEvent.keyDown(input, { key: "Enter" });

    // 组末总结直接显示在页面里（不是弹窗）
    expect(await screen.findByRole("region", { name: "本组完成" })).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("正确率 · 2 个词（新学 2，复习 0）")).toBeInTheDocument();
    await waitFor(async () => expect(await db.cards.count()).toBe(2));
    expect(await db.reviewLogs.count()).toBe(2);
  });

  it("显示单词模式与自动下一个", async () => {
    await db.settings.bulkPut([
      { key: "typingMode", value: "copy", updatedAt: 0 },
      { key: "advance", value: "auto", updatedAt: 0 },
    ]);
    renderHome();
    const input = await screen.findByLabelText("输入上面的单词");
    await waitFor(() => expect(document.querySelector(".word-letters-row")!.textContent).toBe("cat"));
    [..."cat"].forEach((key) => fireEvent.keyDown(input, { key }));
    await screen.findByText("狗");
  });

  it("词库全部学完时提示", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    await db.settings.put({ key: "dictId", value: "jlpt-n5", updatedAt: 0 });
    renderHome();
    expect(await screen.findByText(/已经全部学完/)).toBeInTheDocument();
  });
});
