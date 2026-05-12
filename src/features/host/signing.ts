import { canonicalJson, signMessage, verifySignature, type HostKeyPair } from "../proofs/crypto";
import type { Poll } from "../polls/types";

export type Phase = "draft" | "voting";

/**
 * A poll signed by the room's host. Any peer (including non-hosts) can
 * verify that this poll really came from the host by canonicalising the
 * payload and checking the signature against the manifest's hostPubKey.
 */
export type SignedPoll = {
  poll: Poll;
  roomId: string;
  signedAt: string;
  hostSig: string;
};

/**
 * The current phase transition, signed by the host. There is only ever one
 * "current" entry per room (overwritten on each transition).
 */
export type SignedPhase = {
  phase: Phase;
  roomId: string;
  signedAt: string;
  hostSig: string;
};

function pollPayloadString(poll: Poll, roomId: string, signedAt: string): string {
  return canonicalJson({ kind: "poll", roomId, signedAt, poll });
}

function phasePayloadString(phase: Phase, roomId: string, signedAt: string): string {
  return canonicalJson({ kind: "phase", roomId, signedAt, phase });
}

export async function signPoll(
  keypair: HostKeyPair,
  poll: Poll,
  roomId: string
): Promise<SignedPoll> {
  const signedAt = new Date().toISOString();
  const hostSig = await signMessage(keypair.privateKey, pollPayloadString(poll, roomId, signedAt));
  return { poll, roomId, signedAt, hostSig };
}

export async function verifySignedPoll(publicKey: string, signed: SignedPoll): Promise<boolean> {
  return verifySignature(
    publicKey,
    pollPayloadString(signed.poll, signed.roomId, signed.signedAt),
    signed.hostSig
  );
}

export async function signPhase(
  keypair: HostKeyPair,
  phase: Phase,
  roomId: string
): Promise<SignedPhase> {
  const signedAt = new Date().toISOString();
  const hostSig = await signMessage(
    keypair.privateKey,
    phasePayloadString(phase, roomId, signedAt)
  );
  return { phase, roomId, signedAt, hostSig };
}

export async function verifySignedPhase(publicKey: string, signed: SignedPhase): Promise<boolean> {
  return verifySignature(
    publicKey,
    phasePayloadString(signed.phase, signed.roomId, signed.signedAt),
    signed.hostSig
  );
}
