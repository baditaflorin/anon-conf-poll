import { get, set } from "idb-keyval";
import type { Invite, RoomManifest } from "../polls/types";

const recentRoomKey = "anon-conf-poll:recent-room";

export type RecentRoom = {
  manifest: RoomManifest;
  invite: Invite | null;
  savedAt: string;
};

export async function saveRecentRoom(manifest: RoomManifest, invite: Invite | null): Promise<void> {
  await set(recentRoomKey, {
    manifest,
    invite,
    savedAt: new Date().toISOString()
  } satisfies RecentRoom);
}

export async function loadRecentRoom(): Promise<RecentRoom | null> {
  return (await get<RecentRoom>(recentRoomKey)) ?? null;
}
