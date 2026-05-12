import { Identity } from "@semaphore-protocol/identity";
import { makeId } from "../polls/room";
import type { GeneratedRoom } from "../polls/types";
import { generateHostKeyPair } from "./crypto";

export async function createGeneratedRoom(
  // Default kept low (12) so a fresh room's share URL stays well under
  // ~1.5 KB — comfortably below the truncation thresholds that some
  // messaging apps apply to long URLs. Callers may pass higher counts.
  attendeeCount = 12,
  title = "Anonymous Conference Poll"
): Promise<GeneratedRoom> {
  const roomId = makeId("room");
  const identities = Array.from({ length: attendeeCount }, () => new Identity());
  const invites = identities.map((identity) => ({
    schemaVersion: 1 as const,
    roomId,
    privateKey: identity.export(),
    commitment: identity.commitment.toString()
  }));
  const hostKey = await generateHostKeyPair();

  return {
    manifest: {
      schemaVersion: 2,
      roomId,
      title,
      createdAt: new Date().toISOString(),
      attendeeCommitments: invites.map((invite) => invite.commitment),
      hostPubKey: hostKey.publicKey,
      proofProfile: "semaphore-v4-groth16"
    },
    invites,
    hostKey
  };
}
