import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageInput } from "./MessageInput";

describe("MessageInput", () => {
  const onSend = vi.fn();
  const onTyping = vi.fn();

  beforeEach(() => {
    onSend.mockClear();
    onTyping.mockClear();
    render(<MessageInput onSend={onSend} onTyping={onTyping} />);
  });

  const box = () => screen.getByLabelText("메시지") as HTMLTextAreaElement;
  const type = (value: string) => fireEvent.change(box(), { target: { value } });

  it("sends the trimmed text on Enter and clears the box", () => {
    type("  안녕  ");
    fireEvent.keyDown(box(), { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith("안녕", 0);
    expect(box().value).toBe("");
  });

  it("keeps Shift+Enter as a line break", () => {
    type("첫 줄");
    fireEvent.keyDown(box(), { key: "Enter", shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send on the Enter that finishes a Korean syllable", () => {
    type("안녕하세");
    fireEvent.keyDown(box(), { key: "Enter", isComposing: true });
    expect(onSend).not.toHaveBeenCalled();

    // Safari: one more Enter right after compositionend, flagged only by keyCode 229.
    fireEvent.keyDown(box(), { key: "Enter", keyCode: 229 });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("never sends a blank message", () => {
    type("   ");
    fireEvent.keyDown(box(), { key: "Enter" });

    expect(onSend).not.toHaveBeenCalled();
    expect(onTyping).not.toHaveBeenCalled();
  });

  it("sends with the chosen lifetime and reports typing", () => {
    fireEvent.change(screen.getByLabelText("메시지 자동 삭제"), { target: { value: "300" } });
    type("사라질 메시지");
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    expect(onTyping).toHaveBeenCalled();
    expect(onSend).toHaveBeenCalledWith("사라질 메시지", 300);
  });
});
