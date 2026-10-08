import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom 不实现媒体播放
vi.stubGlobal(
  "Audio",
  class {
    preload = "";
    currentTime = 0;
    src: string;
    constructor(src: string) {
      this.src = src;
    }
    play = vi.fn().mockResolvedValue(undefined);
  },
);

afterEach(() => cleanup());
