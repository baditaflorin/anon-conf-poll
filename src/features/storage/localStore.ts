import { del, get, set } from "idb-keyval";
import type { AppStateSnapshot } from "../state/appState";
import { migrateSavedState } from "../state/appState";

const recentRoomKey = "anon-conf-poll:recent-room";
const appStateKey = "anon-conf-poll:app-state";

export async function saveAppState(state: AppStateSnapshot): Promise<void> {
  await set(appStateKey, state);
}

export async function loadAppState(): Promise<AppStateSnapshot | null> {
  const current = migrateSavedState(await get<unknown>(appStateKey));

  if (current) {
    return current;
  }

  const legacy = migrateSavedState(await get<unknown>(recentRoomKey));

  if (legacy) {
    await saveAppState(legacy);
    return legacy;
  }

  return null;
}

export async function clearAppState(): Promise<void> {
  await Promise.all([del(appStateKey), del(recentRoomKey)]);
}
