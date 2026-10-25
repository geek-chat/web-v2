import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./Select";

describe("Select", () => {
  it("is a native select that forwards its name, value and change", () => {
    const onChange = vi.fn();
    render(
      <Select aria-label="자동 삭제" value="30" onChange={onChange}>
        <option value="0">삭제 안 함</option>
        <option value="30">30초</option>
      </Select>,
    );
    const select = screen.getByRole("combobox", { name: "자동 삭제" }) as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "0" } });

    expect(select.tagName).toBe("SELECT");
    expect(onChange).toHaveBeenCalled();
  });

  it("draws its own arrow in reserved padding instead of the browser's", () => {
    const { container } = render(
      <Select aria-label="자동 삭제" defaultValue="0">
        <option value="0">삭제 안 함</option>
      </Select>,
    );
    const select = screen.getByRole("combobox");

    expect(select.className).toMatch(/\bappearance-none\b/);
    expect(select.className).toMatch(/\bpr-9\b/); // room for the icon at right-3
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("puts layout classes on the outer box and keeps the control's look", () => {
    const { container } = render(
      <Select aria-label="자동 삭제" className="shrink-0" disabled>
        <option value="0">삭제 안 함</option>
      </Select>,
    );

    expect((container.firstChild as HTMLElement).className).toMatch(/\bshrink-0\b/);
    expect(screen.getByRole("combobox")).toHaveProperty("disabled", true);
  });
});
