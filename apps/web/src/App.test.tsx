import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

vi.mock("./pages/Home", () => ({
  default: () => <div>home-page-mock</div>,
}));

describe("App routes", () => {
  it("根路由渲染 Home 页面", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("home-page-mock")).toBeInTheDocument();
  });
});
