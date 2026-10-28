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
import { compareInstants } from "@/store/messages";

interface RoomsState {
  /** null until the list is loaded for the first time. */
  rooms: Room[] | null;
  /** The room on screen, set by the room view. */
  currentRoomId: string | null;
  stale: boolean;
  /**
   * Read points: roomId → userId → lastReadAt (the createdAt of the message
   * read). They start from the members' lastReadAt in the room list (server-v2
   * bf2c85d) and move forward with read_update, never back: a list fetched
   * before a read_update can land after it.
   */
  reads: Record<string, Record<string, string>>;
  /**
   * "roomId:senderId" pairs the list was already refetched for, so a sender
   * the refetched list still lacks cannot trigger refetch after refetch.
   */
  askedSenders: Record<string, true>;

  /**
   * Stores a freshly fetched list and clears `stale`. A lastMessageAt that a
   * new_message moved past the fetched value while it loaded is kept. The
   * members' lastReadAt move their read points forward.
   */
  setRooms: (rooms: Room[]) => void;
  /**
   * Adds a room, or merges it into the one held. Fields the incoming copy lacks
   * (a create response has no lastMessageAt and no avatars) keep their held
   * values: creating a DM that already exists returns the existing room.
   */
  upsertRoom: (room: Room) => void;
  removeRoom: (roomId: string) => void;
  /**
   * Moves lastMessageAt forward for a new message. Flags the list stale for an
   * unknown room, and for a sender the room does not list: someone who joined
   * by invite, which the server announces to nobody (once per room and sender).
   */
  touchRoom: (roomId: string, createdAt: string, senderId?: string) => void;
  /** Asks the list owner to refetch, e.g. after joining a room by invite. */
  markStale: () => void;
  setCurrentRoom: (roomId: string | null) => void;
  /** Moves a member's read point forward only. */
  markRead: (roomId: string, userId: string, lastReadAt: string) => void;
  reset: () => void;
}

/** The later of two optional instants. */
function later(a: string | null, b: string | null): string | null {
  if (!a || !b) return a ?? b;
  return compareInstants(a, b) >= 0 ? a : b;
}

/** Moves one member's read point forward only; returns `reads` itself when it does not move. */
function advanceRead(
  reads: RoomsState["reads"],
  roomId: string,
  userId: string,
  lastReadAt: string,
): RoomsState["reads"] {
  const held = reads[roomId]?.[userId];
  if (held && compareInstants(held, lastReadAt) >= 0) return reads;
  return { ...reads, [roomId]: { ...reads[roomId], [userId]: lastReadAt } };
}

export const useRoomsStore = create<RoomsState>((set) => ({
  rooms: null,
  currentRoomId: null,
  stale: false,
  reads: {},
  askedSenders: {},

  setRooms: (rooms) =>
    set((state) => {
      let reads = state.reads;
      for (const room of rooms) {
        for (const { userId, lastReadAt } of room.members) {
          if (lastReadAt) reads = advanceRead(reads, room.id, userId, lastReadAt);
        }
      }
      return {
        rooms: rooms.map((room) => {
          const held = state.rooms?.find((r) => r.id === room.id);
          return held ? { ...room, lastMessageAt: later(room.lastMessageAt, held.lastMessageAt) } : room;
        }),
        reads,
        stale: false,
      };
    }),

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
    set((state) => {
      const reads = { ...state.reads };
      delete reads[roomId];
      return { reads, rooms: state.rooms ? state.rooms.filter((r) => r.id !== roomId) : state.rooms };
    }),

  touchRoom: (roomId, createdAt, senderId) =>
    set((state) => {
      if (!state.rooms) return state; // the first load will bring it
      const room = state.rooms.find((r) => r.id === roomId);
      if (!room) return { stale: true };
      const next: Partial<RoomsState> = {};
      if (!room.lastMessageAt || compareInstants(room.lastMessageAt, createdAt) < 0) {
        next.rooms = state.rooms.map((r) => (r === room ? { ...r, lastMessageAt: createdAt } : r));
      }
      const asked = `${roomId}:${senderId}`;
      if (senderId && !room.members.some((m) => m.userId === senderId) && !state.askedSenders[asked]) {
        next.stale = true;
        next.askedSenders = { ...state.askedSenders, [asked]: true };
      }
      return next.rooms || next.stale ? next : state;
    }),

  markStale: () => set({ stale: true }),
  setCurrentRoom: (currentRoomId) => set({ currentRoomId }),

  markRead: (roomId, userId, lastReadAt) =>
    set((state) => {
      const reads = advanceRead(state.reads, roomId, userId, lastReadAt);
      return reads === state.reads ? state : { reads };
    }),

  reset: () => set({ rooms: null, currentRoomId: null, stale: false, reads: {}, askedSenders: {} }),
}));
