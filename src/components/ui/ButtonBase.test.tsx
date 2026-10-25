import { fireEvent, render, screen } from "@testing-library/react";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { ButtonBase } from "./ButtonBase";

describe("ButtonBase", () => {
  it("does not submit the form it sits in unless asked to", () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <ButtonBase>다시 보내기</ButtonBase>
        <ButtonBase type="submit">보내기</ButtonBase>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 보내기" }));
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("keeps the shared focus ring under the caller's shape", () => {
    render(<ButtonBase className="rounded-full px-3">칩</ButtonBase>);
    const classes = screen.getByRole("button", { name: "칩" }).className.split(" ");

    expect(classes).toEqual(expect.arrayContaining(["focus-visible:ring-2", "rounded-full", "px-3"]));
  });
});
