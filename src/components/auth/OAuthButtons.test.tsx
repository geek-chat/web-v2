import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { t } from "@/i18n";
import { OAuthButtons } from "./OAuthButtons";

// The Naver button replaces the secondary variant's colors. Tailwind orders
// same-property utilities by name, so a variant color left next to the brand
// color can win: the button once rendered in the variant's gray.
describe("OAuthButtons", () => {
  it("gives the Naver button its brand colors and drops the variant's", () => {
    render(<OAuthButtons />);
    const classes = screen.getByRole("button", { name: t("auth.oauth.naver") }).className.split(" ");

    expect(classes).toEqual(
      expect.arrayContaining([
        "bg-[#03c75a]",
        "text-white",
        "border-transparent",
        "enabled:hover:bg-[#02a94c]",
        "enabled:hover:border-transparent",
      ]),
    );
    for (const variantColor of [
      "bg-muted",
      "text-foreground",
      "border-border",
      "enabled:hover:bg-border",
      "enabled:hover:border-muted-foreground/50",
    ]) {
      expect(classes).not.toContain(variantColor);
    }
  });
});
