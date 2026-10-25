import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/rooms", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/rooms")>()),
  listRooms: vi.fn(),
}));

import { listRooms, type Room } from "@/lib/api/rooms";
import { useAuthStore } from "@/store/auth";
import { useRoomsStore } from "@/store/rooms";
import { useRooms } from "./useRooms";

// A fresh SWR cache per test, so one test's list never leaks into the next.
const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false }}>
    {children}
  </SWRConfig>
);

const room = (id: string, lastMessageAt: string | null): Room => ({
  id,
  type: "DIRECT",
  name: null,
  lastMessageAt,
  expiresAt: null,
  members: [],
});

const ALICE = { id: "u1", nickname: "Alice", username: null, profileImageUrl: null };

describe("useRooms", () => {
  beforeEach(() => {
    vi.mocked(listRooms).mockReset();
    useRoomsStore.getState().reset();
    useAuthStore.setState({ status: "authenticated", user: ALICE });
  });

  it("loads the list into the store, newest activity first and silent rooms last", async () => {
    vi.mocked(listRooms).mockResolvedValue([
      room("silent", null),
      room("older", "2026-10-25T05:00:00Z"),
      room("newer", "2026-10-25T06:00:00Z"),
    ]);

    const { result } = renderHook(() => useRooms(), { wrapper });

    await waitFor(() => expect(result.current.rooms?.map((r) => r.id)).toEqual(["newer", "older", "silent"]));
    expect(useRoomsStore.getState().rooms).toHaveLength(3);
  });

  it("fetches again when a message names a room the list lacks", async () => {
    vi.mocked(listRooms)
      .mockResolvedValueOnce([room("a", null)])
      .mockResolvedValueOnce([room("a", null), room("new", "2026-10-25T07:00:00Z")]);
    const { result } = renderHook(() => useRooms(), { wrapper });
    await waitFor(() => expect(result.current.rooms).toHaveLength(1));

    act(() => useRoomsStore.getState().touchRoom("new", "2026-10-25T07:00:00Z"));

    await waitFor(() => expect(result.current.rooms?.map((r) => r.id)).toEqual(["new", "a"]));
    expect(useRoomsStore.getState().stale).toBe(false);
  });

  it("writes nothing when the session changed while the list loaded", async () => {
    let resolveAlices: (rooms: Room[]) => void = () => {};
    vi.mocked(listRooms)
      .mockReturnValueOnce(new Promise((resolve) => (resolveAlices = resolve)))
      .mockReturnValue(new Promise(() => {})); // the next user's list never arrives here
    renderHook(() => useRooms(), { wrapper });

    act(() => useAuthStore.setState({ user: { ...ALICE, id: "u2", nickname: "Bob" } }));
    await act(async () => resolveAlices([room("alices-room", null)]));

    expect(useRoomsStore.getState().rooms).toBeNull();
  });

  it("reports an error only while no list has loaded", async () => {
    vi.mocked(listRooms).mockRejectedValue(new TypeError("Failed to fetch"));

    const { result } = renderHook(() => useRooms(), { wrapper });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(TypeError));
    act(() => useRoomsStore.getState().setRooms([room("a", null)]));
    expect(result.current.error).toBeUndefined();
  });
});
