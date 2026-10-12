import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { WordItem } from "@wreadt/core";
import { SettingsProvider } from "../context/settings";
import { FocusProvider } from "../context/focus";
import { db } from "../store/db";
import * as youdao from "../services/youdao";
import TypingSession, { AUTOPLAY_DELAY_MS } from "./TypingSession";

const words: WordItem[] = ["alpha", "bravo", "charlie", "delta", "echo"].map((w) => ({ id: `en:${w}`, dictId: "d", lang: "en", display: w, answer: w, meanings: [] }));

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ key: "locale", value: "zh-CN", updatedAt: 0 });
});
afterEach(() => vi.useRealTimers());

it("快速跳过时不叠音、不为每个词发请求，停下后才播放当前词", async () => {
  const play = vi.spyOn(youdao, "playAudio").mockResolvedValue();
  const preload = vi.spyOn(youdao, "preloadAudio");
  render(
    <MemoryRouter>
      <SettingsProvider>
        <FocusProvider>
          <TypingSession words={words} onWordDone={() => undefined} onBatchDone={() => undefined} />
        </FocusProvider>
      </SettingsProvider>
    </MemoryRouter>,
  );
  const input = await screen.findByLabelText("输入上面的单词");
  vi.useFakeTimers();
  for (let i = 0; i < 3; i++) {
    fireEvent.keyDown(input, { key: "ArrowDown" });
    act(() => vi.advanceTimersByTime(50));
  }
  expect(play).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(AUTOPLAY_DELAY_MS));
  expect(play).toHaveBeenCalledTimes(1);
  expect(play).toHaveBeenCalledWith("delta", "en", "us");
  expect(preload.mock.calls.map((c) => c[0])).toEqual(["echo"]);
});

it("日语发音胶囊不显示罗马音答案", async () => {
  const ja: WordItem[] = [{ id: "ja:どなた", dictId: "d", lang: "ja", display: "どなた", reading: "どなた", answer: "donata", meanings: ["谁"] }];
  render(
    <MemoryRouter>
      <SettingsProvider>
        <FocusProvider>
          <TypingSession words={ja} onWordDone={() => undefined} onBatchDone={() => undefined} />
        </FocusProvider>
      </SettingsProvider>
    </MemoryRouter>,
  );
  await screen.findByLabelText("输入上面的单词");
  expect(document.body.textContent).not.toContain("donata");
});
