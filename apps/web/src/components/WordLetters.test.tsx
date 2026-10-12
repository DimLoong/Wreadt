import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import WordLetters from "./WordLetters";

it("默写时空格、短横线、撇号直接显示", () => {
  const { container } = render(<WordLetters answer="follow-up don't x" typed="fo" wrongChar={null} hidden revealed={0} />);
  expect(container.textContent).toBe("fo____-__␣___'_␣_");
  expect(container.querySelectorAll(".mark")).toHaveLength(4);
});
