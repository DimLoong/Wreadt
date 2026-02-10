import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Heatmap from "./Heatmap";
import BatchAnimation from "./BatchAnimation";

describe("Heatmap", () => {
  it("按照结果渲染词汇热力方格", () => {
    const { container } = render(
      <Heatmap
        total={8}
        stage="color"
        batchRange={{ start: 0, end: 4 }}
        results={[
          { wordId: "w1", accuracy: 100, correct: true },
          { wordId: "w2", accuracy: 89, correct: true },
          { wordId: "w3", accuracy: 70, correct: false },
        ]}
      />,
    );

    const squares = container.querySelectorAll(".heatmap-square");
    expect(squares.length).toBe(8);
    expect(container.querySelectorAll(".in-batch").length).toBe(4);
  });
});

describe("BatchAnimation", () => {
  it("可见时展示动画层与可跳过按钮", () => {
    render(
      <BatchAnimation
        locale="zh-CN"
        visible
        masteredCount={3}
        results={[
          { wordId: "w1", accuracy: 100, correct: true },
          { wordId: "w2", accuracy: 82, correct: true },
          { wordId: "w3", accuracy: 64, correct: false },
        ]}
        batchSize={3}
        onSkip={() => undefined}
      />,
    );

    expect(screen.getByText("学习进度")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "跳过动画" })).toBeInTheDocument();
  });
});
