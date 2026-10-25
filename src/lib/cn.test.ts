import { describe, expect, it } from "vitest";
import { cn } from "./cn";

// How this theme's tokens (globals.css) merge. If a tailwind-merge or Tailwind
// upgrade changes any of these, overrides on the ui primitives change with it.
describe("cn", () => {
  it("lets a caller's color replace the variant's", () => {
    expect(cn("bg-muted", "bg-[#03c75a]")).toBe("bg-[#03c75a]");
    expect(cn("bg-primary", "bg-primary-hover")).toBe("bg-primary-hover");
    expect(cn("text-foreground", "text-white")).toBe("text-white");
    expect(cn("border border-border", "border-transparent")).toBe("border border-transparent");
  });

  it("keeps the font size apart from the text color", () => {
    expect(cn("text-sm text-foreground", "text-white")).toBe("text-sm text-white");
    expect(cn("text-muted-foreground", "text-xs")).toBe("text-muted-foreground text-xs");
    expect(cn("text-primary-foreground text-sm", "text-base")).toBe("text-primary-foreground text-base");
  });

  it("merges within the same variant only", () => {
    expect(cn("enabled:hover:bg-border", "enabled:hover:bg-[#02a94c]")).toBe("enabled:hover:bg-[#02a94c]");
    expect(cn("enabled:hover:border-muted-foreground/50", "enabled:hover:border-transparent")).toBe(
      "enabled:hover:border-transparent",
    );
    expect(cn("bg-muted enabled:hover:bg-border", "bg-[#03c75a]")).toBe("enabled:hover:bg-border bg-[#03c75a]");
    expect(cn("disabled:opacity-50", "opacity-80")).toBe("disabled:opacity-50 opacity-80");
  });

  it("replaces sizes and spacing, and skips falsy values", () => {
    expect(cn("h-10 px-3", "h-8 px-4")).toBe("h-8 px-4");
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });
});
