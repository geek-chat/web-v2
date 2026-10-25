/**
 * Rooms store (RULES.md R6). Phase 2.2 fetches the list with SWR and writes
 * it here with setRooms(); WebSocket events update it in place.
 *
 * The server has no "you were added to a room" event: on RoomMemberJoined it
 * only registers the live sessions (ChatEventListener.onRoomMemberJoined).
 * So a new_message for a room missing from the list sets `stale`, and the
 * list owner refetches.
 */
import { create } from "zustand";
import type { Room } from "@/lib/api/rooms";
import { toEpochMs } from "@/store/messages";

interface RoomsState {
  /** null until the list is loaded for the first time. */
  rooms: Room[] | null;
  /** The room on screen, set by the room view. */
  currentRoomId: string | null;
  stale: boolean;

  /** Stores a freshly fetched list and clears `stale`. */
  setRooms: (rooms: Room[]) => void;
  removeRoom: (roomId: string) => void;
  /** Moves lastMessageAt forward for a new message, or flags the list stale for an unknown room. */
  touchRoom: (roomId: string, createdAt: string) => void;
  setCurrentRoom: (roomId: string | null) => void;
  reset: () => void;
}

export const useRoomsStore = create<RoomsState>((set) => ({
  rooms: null,
  currentRoomId: null,
  stale: false,

  setRooms: (rooms) => set({ rooms, stale: false }),

  removeRoom: (roomId) =>
    set((state) => (state.rooms ? { rooms: state.rooms.filter((r) => r.id !== roomId) } : state)),

  touchRoom: (roomId, createdAt) =>
    set((state) => {
      if (!state.rooms) return state; // the first load will bring it
      const room = state.rooms.find((r) => r.id === roomId);
      if (!room) return { stale: true };
      if (room.lastMessageAt && toEpochMs(room.lastMessageAt) >= toEpochMs(createdAt)) return state;
      return {
        rooms: state.rooms.map((r) => (r === room ? { ...r, lastMessageAt: createdAt } : r)),
      };
    }),

  setCurrentRoom: (currentRoomId) => set({ currentRoomId }),

  reset: () => set({ rooms: null, currentRoomId: null, stale: false }),
}));
