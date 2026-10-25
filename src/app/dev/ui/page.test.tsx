import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import UiGalleryPage from "./page";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
}));

describe("/dev/ui", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the primitives outside production", () => {
    render(<UiGalleryPage />);

    expect(screen.getByRole("button", { name: "primary md" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "select" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "textarea" })).toBeTruthy();
  });

  it("is not served in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(() => UiGalleryPage()).toThrow("404");
  });
});
