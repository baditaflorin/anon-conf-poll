import { describe, expect, it } from "vitest";
import { createGeneratedRoom } from "../proofs/attendees";
import {
  createAppStateSnapshot,
  migrateSavedState,
  parseAppStateSnapshot,
  serializeAppState
} from "./appState";

describe("app state snapshot", () => {
  it("round-trips a setup snapshot through JSON", () => {
    const generated = createGeneratedRoom(4);
    const snapshot = createAppStateSnapshot({
      manifest: generated.manifest,
      activeInvite: generated.invites[0] ?? null,
      organizerInvites: generated.invites,
      rosterInput: "First Name,Last Name,Email\nAda,Lovelace,ada@example.com",
      pollInput: "Opening poll: Ship?\n- Yes\n- No",
      inviteInput: "",
      selectedOptions: { "opening-priority": "practical" },
      activity: [{ at: "2026-05-09T10:00:00.000Z", label: "Imported", detail: "Roster" }],
      votes: [],
      questions: []
    });

    const parsed = parseAppStateSnapshot(serializeAppState(snapshot));

    expect(parsed).toEqual({ ok: true, state: snapshot });
  });

  it("migrates the v0.1 recent-room persistence shape", () => {
    const generated = createGeneratedRoom(4);
    const migrated = migrateSavedState({
      manifest: generated.manifest,
      invite: generated.invites[0] ?? null,
      savedAt: "2026-05-09T10:00:00.000Z"
    });

    expect(migrated?.schemaVersion).toBe(2);
    expect(migrated?.manifest.roomId).toBe(generated.manifest.roomId);
    expect(migrated?.activeInvite?.roomId).toBe(generated.manifest.roomId);
  });
});
