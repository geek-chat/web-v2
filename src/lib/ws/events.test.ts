import { describe, expect, it } from "vitest";
import { isConnectRejectionCode, parseServerEvent } from "./events";

const frame = (type: string, data: unknown) => JSON.stringify({ type, data });

const newMessage = {
  id: "m1",
  roomId: "r1",
  senderId: "u2",
  content: "hi",
  type: "TEXT",
  createdAt: "2026-10-25T05:13:25.123456Z",
  expiresAt: null,
  replyToMessageId: null,
  burnAfterRead: false,
};

describe("parseServerEvent", () => {
  it("parses every event the server sends", () => {
    const events: Array<[string, unknown]> = [
      ["message_ack", { clientMessageId: "c1", serverId: "m1" }],
      ["new_message", newMessage],
      ["typing_indicator", { roomId: "r1", userId: "u2" }],
      ["read_update", { roomId: "r1", userId: "u2", lastReadAt: "2026-10-25T05:13:25Z" }],
      ["room_expiring", { roomId: "r1", roomName: null, expiresAt: "2026-10-25T05:23:25Z" }],
      ["room_expired", { roomId: "r1", roomName: "study" }],
      ["message_expired", { roomId: "r1", messageIds: ["m1", "m2"] }],
      ["message_burned", { roomId: "r1", messageId: "m1" }],
      ["error", { code: "TOKEN_EXPIRED", message: "Token expired" }],
    ];
    for (const [type, data] of events) {
      expect(parseServerEvent(frame(type, data))).toEqual({ type, data });
    }
  });

  it("keeps clientMessageId on a send failure", () => {
    const data = { code: "SEND_FAILED", message: "Not a member of this chat room", clientMessageId: "c1" };

    expect(parseServerEvent(frame("error", data))).toEqual({ type: "error", data });
  });

  it("returns null for frames outside the contract", () => {
    expect(parseServerEvent("not json")).toBeNull();
    expect(parseServerEvent(new ArrayBuffer(4))).toBeNull();
    expect(parseServerEvent(JSON.stringify({ data: {} }))).toBeNull();
    expect(parseServerEvent(frame("user_joined", { roomId: "r1" }))).toBeNull();
    // An inherited property name is not an event type.
    expect(parseServerEvent(frame("toString", {}))).toBeNull();
    expect(parseServerEvent(frame("new_message", { ...newMessage, type: "IMAGE" }))).toBeNull();
    expect(parseServerEvent(frame("message_ack", { clientMessageId: "c1" }))).toBeNull();
  });
});

describe("isConnectRejectionCode", () => {
  it("accepts only the five codes sent before a 1008 close", () => {
    for (const code of ["NO_TOKEN", "TOKEN_EXPIRED", "INVALID_TOKEN", "RATE_LIMITED", "MAX_CONNECTIONS"]) {
      expect(isConnectRejectionCode(code)).toBe(true);
    }
    for (const code of ["SEND_FAILED", "INVALID_DATA", "NOT_AUTHENTICATED", "UNKNOWN_EVENT"]) {
      expect(isConnectRejectionCode(code)).toBe(false);
    }
  });
});
