import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/invite", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/invite")>()),
  createInviteLink: vi.fn(),
}));

import { createInviteLink } from "@/lib/api/invite";
import { InvitePanel } from "./InvitePanel";

const link = {
  code: "AbC12dEf",
  roomId: "g1",
  expiresAt: "2026-10-26T12:00:00.123456Z",
  maxUses: null,
  currentUses: 0,
};

/** jsdom has no clipboard; install one for a test. */
function installClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

describe("InvitePanel", () => {
  beforeEach(() => {
    vi.mocked(createInviteLink).mockReset();
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "clipboard");
  });

  async function made() {
    vi.mocked(createInviteLink).mockResolvedValue(link);
    render(<InvitePanel roomId="g1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "초대 링크 만들기" }));
    return (await screen.findByLabelText("초대 링크 주소")) as HTMLInputElement;
  }

  it("makes a link only when asked, and shows its whole address", async () => {
    vi.mocked(createInviteLink).mockResolvedValue(link);
    render(<InvitePanel roomId="g1" onClose={vi.fn()} />);
    expect(createInviteLink).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "초대 링크 만들기" }));

    const field = (await screen.findByLabelText("초대 링크 주소")) as HTMLInputElement;
    expect(createInviteLink).toHaveBeenCalledWith("g1");
    expect(field.value).toBe(`${window.location.origin}/invite/AbC12dEf`);
  });

  it("copies the address", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    installClipboard(writeText);
    const field = await made();

    fireEvent.click(screen.getByRole("button", { name: "복사" }));

    expect(await screen.findByText("복사했습니다")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(field.value);
  });

  it("asks for a manual copy where there is no clipboard", async () => {
    await made();

    fireEvent.click(screen.getByRole("button", { name: "복사" }));

    expect(await screen.findByText("자동 복사가 되지 않습니다. 주소를 직접 선택해 복사해 주세요")).toBeTruthy();
  });

  it("says when the link could not be made, and lets the user try again", async () => {
    vi.mocked(createInviteLink).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<InvitePanel roomId="g1" onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "초대 링크 만들기" }));

    expect(await screen.findByText("초대 링크를 만들지 못했습니다")).toBeTruthy();
    expect(screen.getByRole("button", { name: "초대 링크 만들기" })).toBeTruthy();
  });
});
