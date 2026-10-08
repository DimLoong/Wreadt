import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../store/db";
import { SettingsProvider } from "../context/settings";
import { FocusProvider } from "../context/focus";
import Home from "./Home";

const DICT = [
  { name: "cat", trans: ["猫"], usphone: "kæt" },
  { name: "dog", trans: ["狗"], usphone: "dɔɡ" },
];

function renderHome() {
  return render(
    <MemoryRouter>
      <SettingsProvider>
        <FocusProvider>
          <Home />
        </FocusProvider>
      </SettingsProvider>
    </MemoryRouter>,
  );
}

describe("Home", () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.settings.bulkPut([
      { key: "dictId", value: "biomedical", updatedAt: 0 },
      { key: "batchSize", value: 5, updatedAt: 0 },
      { key: "locale", value: "zh-CN", updatedAt: 0 },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => DICT }));
  });

  it("打完一组后展示总结，并写入复习记录", async () => {
    renderHome();
    const input = await screen.findByRole("textbox", { name: "输入上面的单词" });
    await waitFor(() => expect(input).toHaveFocus());
    expect(screen.getByText("猫")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "cat" } });
    expect(screen.getByText("正确！按 Space 继续")).toBeInTheDocument();
    fireEvent.keyDown(input, { key: " " });

    await screen.findByText("狗");
    fireEvent.change(input, { target: { value: "dox" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(input, { target: { value: "dog" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByRole("dialog", { name: "本组完成" })).toBeInTheDocument();
    expect(screen.getByText("本组 2 个词，正确率 50%")).toBeInTheDocument();
    await waitFor(async () => expect(await db.cards.count()).toBe(2));
    expect(await db.reviewLogs.count()).toBe(2);
  });

  it("词库全部学完时提示", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    await db.settings.put({ key: "dictId", value: "jlpt-n5", updatedAt: 0 });
    renderHome();
    expect(await screen.findByText(/已经全部学完/)).toBeInTheDocument();
  });
});
