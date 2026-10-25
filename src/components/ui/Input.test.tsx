import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./Input";

describe("Input", () => {
  it("puts layout classes on the outer box and keeps the control's look", () => {
    const { container } = render(
      <Input aria-label="초대 링크 주소" readOnly value="https://example.test/invite/AbC12dEf" className="min-w-0 flex-1" />,
    );
    const field = screen.getByRole("textbox", { name: "초대 링크 주소" });

    expect((container.firstChild as HTMLElement).className).toMatch(/\bflex-1\b/);
    expect(field.className).not.toMatch(/\bflex-1\b/);
    expect(field.className).toMatch(/\bh-10\b/); // level with a md Button
  });
});
