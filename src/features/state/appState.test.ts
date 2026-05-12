import { describe, expect, it } from "vitest";
import { createGeneratedRoom } from "../proofs/attendees";
import {
  createAppStateSnapshot,
  migrateSavedState,
  parseAppStateSnapshot,
  serializeAppState
} from "./appState";

describe("app state snapshot", () => {
  it("round-trips a setup snapshot through JSON", async () => {
    const generated = await createGeneratedRoom(4);
    const snapshot = createAppStateSnapshot({
      manifest: generated.manifest,
      activeInvite: generated.invites[0] ?? null,
      organizerInvites: generated.invites,
      rosterInput: "First Name,Last Name,Email\nAda,Lovelace,ada@example.com",
      inviteInput: "",
      selectedOptions: { "opening-priority": "practical" },
      activity: [{ at: "2026-05-09T10:00:00.000Z", label: "Imported", detail: "Roster" }],
      votes: [],
      questions: []
    });

    const parsed = parseAppStateSnapshot(serializeAppState(snapshot));

    expect(parsed).toEqual({ ok: true, state: snapshot });
  });

  it("refuses to migrate older saved state versions (v1/v2)", () => {
    // Older versions had polls in the URL and no host key — silently
    // migrating would leave the user with a half-broken room. Better to
    // discard and surface the welcome screen.
    expect(migrateSavedState({ schemaVersion: 1, manifest: {}, invite: null })).toBeNull();
    expect(migrateSavedState({ schemaVersion: 2, exportedAt: "x" })).toBeNull();
  });
});
