import { describe, expect, it } from "vitest";
import { t } from "./index";
import { ko } from "./ko";

describe("t", () => {
  it("returns the plain string without vars", () => {
    expect(t("auth.link.title")).toBe(ko["auth.link.title"]);
  });

  it("fills placeholders and leaves unknown ones untouched", () => {
    const filled = t("auth.link.body", { nickname: "홍길동" });

    expect(filled).toContain("홍길동");
    expect(filled).toContain("{provider}");
  });
});
