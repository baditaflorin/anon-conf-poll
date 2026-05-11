import { Identity } from "@semaphore-protocol/identity";
import { defaultPolls, makeId } from "../polls/room";
import type { GeneratedRoom, Poll } from "../polls/types";

export function createGeneratedRoom(
  // Default kept low (12) so a fresh room's share URL stays well under
  // ~1.5 KB — comfortably below the truncation thresholds that some
  // messaging apps apply to long URLs. Callers may pass higher counts.
  attendeeCount = 12,
  title = "Anonymous Conference Poll",
  polls: Poll[] = defaultPolls
): GeneratedRoom {
  const roomId = makeId("room");
  const identities = Array.from({ length: attendeeCount }, () => new Identity());
  const invites = identities.map((identity) => ({
    schemaVersion: 1 as const,
    roomId,
    privateKey: identity.export(),
    commitment: identity.commitment.toString()
  }));

  return {
    manifest: {
      schemaVersion: 1,
      roomId,
      title,
      createdAt: new Date().toISOString(),
      polls,
      attendeeCommitments: invites.map((invite) => invite.commitment),
      proofProfile: "semaphore-v4-groth16"
    },
    invites
  };
}
