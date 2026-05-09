import { describe, expect, it } from "vitest";
import { createGeneratedRoom } from "../proofs/attendees";
import { createAppStateSnapshot, serializeAppState } from "../state/appState";
import { encodeInvite } from "../polls/room";
import { classifyImport } from "./fileRouting";

describe("file import routing", () => {
  it("detects state, invite, roster, poll, and room inputs", () => {
    const generated = createGeneratedRoom(4);
    const state = createAppStateSnapshot({
      manifest: generated.manifest,
      activeInvite: generated.invites[0] ?? null,
      organizerInvites: generated.invites,
      rosterInput: "",
      pollInput: "",
      inviteInput: "",
      selectedOptions: {},
      activity: [],
      votes: [],
      questions: []
    });
    const invite = generated.invites[0];

    if (!invite) {
      throw new Error("Generated room should include at least one invite.");
    }

    expect(
      classifyImport({
        name: "state.json",
        type: "application/json",
        text: serializeAppState(state)
      }).kind
    ).toBe("state");
    expect(
      classifyImport({
        name: "invite.txt",
        type: "text/plain",
        text: encodeInvite(invite)
      }).kind
    ).toBe("invite");
    expect(
      classifyImport({
        name: "attendees.csv",
        type: "text/csv",
        text: "First Name,Last Name,Email\nAda,Lovelace,ada@example.com"
      }).kind
    ).toBe("roster");
    expect(
      classifyImport({
        name: "agenda.txt",
        type: "text/plain",
        text: "Opening poll: Ship?\n- Yes\n- No"
      }).kind
    ).toBe("poll");
    expect(
      classifyImport({
        name: "room.txt",
        type: "text/plain",
        text: "https://example.com/#room=abc"
      }).kind
    ).toBe("room");
  });
});
