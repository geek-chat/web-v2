import { describe, expect, it } from "vitest";
import { ko } from "@/i18n/ko";
import { oauthErrorMessage, providerLabel } from "./oauthText";

describe("oauthErrorMessage", () => {
  it.each([
    ["oauth_cancelled", ko["auth.callbackError.oauth_cancelled"]],
    ["missing_params", ko["auth.callbackError.missing_params"]],
    ["invalid_state", ko["auth.callbackError.invalid_state"]],
    ["oauth_failed", ko["auth.callbackError.oauth_failed"]],
  ])("maps %s", (code, expected) => {
    expect(oauthErrorMessage(code)).toBe(expected);
  });

  it.each([null, "", "constructor", "../../etc"])("falls back for %j", (code) => {
    expect(oauthErrorMessage(code)).toBe(ko["auth.callbackError.unknown"]);
  });
});

describe("providerLabel", () => {
  it("names known providers", () => {
    expect(providerLabel("GOOGLE")).toBe("Google");
    expect(providerLabel("NAVER")).toBe("네이버");
  });

  it("shows an unknown provider as sent", () => {
    expect(providerLabel("KAKAO")).toBe("KAKAO");
  });
});
