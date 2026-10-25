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

  /**
   * Stores a freshly fetched list and clears `stale`. A lastMessageAt that a
   * new_message moved past the fetched value while it loaded is kept.
   */
  setRooms: (rooms: Room[]) => void;
  /**
   * Adds a room, or merges it into the one held. Fields the incoming copy lacks
   * (a create response has no lastMessageAt and no avatars) keep their held
   * values: creating a DM that already exists returns the existing room.
   */
  upsertRoom: (room: Room) => void;
  removeRoom: (roomId: string) => void;
  /** Moves lastMessageAt forward for a new message, or flags the list stale for an unknown room. */
  touchRoom: (roomId: string, createdAt: string) => void;
  setCurrentRoom: (roomId: string | null) => void;
  reset: () => void;
}

/** The later of two optional instants. */
function later(a: string | null, b: string | null): string | null {
  if (!a || !b) return a ?? b;
  return toEpochMs(a) >= toEpochMs(b) ? a : b;
}

export const useRoomsStore = create<RoomsState>((set) => ({
  rooms: null,
  currentRoomId: null,
  stale: false,

  setRooms: (rooms) =>
    set((state) => ({
      rooms: rooms.map((room) => {
        const held = state.rooms?.find((r) => r.id === room.id);
        return held ? { ...room, lastMessageAt: later(room.lastMessageAt, held.lastMessageAt) } : room;
      }),
      stale: false,
    })),

  upsertRoom: (room) =>
    set((state) => {
      if (!state.rooms) return state; // the first load will bring it
      const held = state.rooms.find((r) => r.id === room.id);
      if (!held) return { rooms: [room, ...state.rooms] };
      const merged: Room = {
        ...held,
        ...room,
        lastMessageAt: later(room.lastMessageAt, held.lastMessageAt),
        members: room.members.map((member) => ({
          ...member,
          profileImageUrl:
            member.profileImageUrl ??
            held.members.find((m) => m.userId === member.userId)?.profileImageUrl ??
            null,
        })),
      };
      return { rooms: state.rooms.map((r) => (r === held ? merged : r)) };
    }),

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
