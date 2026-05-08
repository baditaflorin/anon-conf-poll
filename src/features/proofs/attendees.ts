import { Identity } from "@semaphore-protocol/identity";
import { defaultPolls, makeId } from "../polls/room";
import type { GeneratedRoom } from "../polls/types";

export function createGeneratedRoom(
  attendeeCount = 24,
  title = "Anonymous Conference Poll"
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
      polls: defaultPolls,
      attendeeCommitments: invites.map((invite) => invite.commitment),
      proofProfile: "semaphore-v4-groth16"
    },
    invites
  };
}
