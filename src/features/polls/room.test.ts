import { describe, expect, it } from "vitest";
import { createGeneratedRoom } from "../proofs/attendees";
import { decodeInvite, decodeRoom, encodeInvite, encodeRoom, inviteBelongsToRoom } from "./room";

describe("room manifest encoding", () => {
  it("round-trips a room through the URL hash contract", async () => {
    const generated = await createGeneratedRoom(4, "Test Room");
    const encoded = encodeRoom(generated.manifest);
    const decoded = decodeRoom(`#${encoded}`);

    expect(decoded?.roomId).toBe(generated.manifest.roomId);
    expect(decoded?.attendeeCommitments).toHaveLength(4);
    expect(decoded?.hostPubKey).toBe(generated.manifest.hostPubKey);
  });

  it("round-trips an invite and validates room membership", async () => {
    const generated = await createGeneratedRoom(4, "Invite Room");
    const invite = generated.invites[0];

    expect(invite).toBeDefined();
    expect(inviteBelongsToRoom(invite!, generated.manifest)).toBe(true);
    expect(decodeInvite(encodeInvite(invite!))).toEqual(invite);
  });
});
