import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { generateProof, verifyProof } from "@semaphore-protocol/proof";
import type {
  Invite,
  Poll,
  QuestionRecord,
  RoomManifest,
  VerifiedQuestion,
  VerifiedVote,
  VoteRecord
} from "../polls/types";
import { makeId } from "../polls/room";
import { scalarSignal } from "./crypto";

export type ProofReadiness = {
  libsodium: boolean;
  semaphore: boolean;
};

let preloadPromise: Promise<void> | null = null;

/**
 * Force the Semaphore zk-SNARK proving artifacts (~hundreds of MB on
 * first run, then service-worker cached) to download in the background
 * instead of blocking the first vote. The user lands on the page,
 * navigates to the room they want, picks an answer — and by then the
 * artifacts are usually warm.
 *
 * Implementation: build a throw-away 1-attendee group, generate a
 * proof, discard the result. Idempotent; safe to call repeatedly. On
 * failure (offline, blocked CDN, ancient browser) the error is
 * swallowed so the rest of the app keeps working — the next real
 * proof attempt will surface the error in context.
 *
 * Surfaced as a separate function rather than running at module load
 * so unit tests and the smoke build can decide when to fire it.
 */
export function preloadSemaphore(): Promise<void> {
  if (preloadPromise) {
    return preloadPromise;
  }
  preloadPromise = (async () => {
    try {
      const identity = new Identity();
      const group = new Group([identity.commitment]);
      const message = await scalarSignal("preload");
      const scope = await scalarSignal("preload");
      // Discard the result — we only care about the side effect of
      // downloading the snarkjs/proving-key blobs the first time.
      await generateProof(identity, group, message.bytes, scope.bytes);
    } catch (error) {
      // Reset so a later real attempt can retry from scratch with
      // its own error surface, rather than this background warm-up
      // failing the next call.
      preloadPromise = null;
      throw error;
    }
  })();
  // Swallow rejections at the boundary — callers that pass
  // `.catch(() => {})` already do this, but it's harder to misuse if
  // preload() itself never raises. The reset-on-error above keeps the
  // promise re-runnable.
  preloadPromise.catch(() => {});
  return preloadPromise;
}

/** Test-only: forget any in-flight preload promise. */
export function resetPreloadCache(): void {
  preloadPromise = null;
}

export function createGroup(manifest: RoomManifest): Group {
  return new Group(manifest.attendeeCommitments.map((commitment) => BigInt(commitment)));
}

export function identityFromInvite(invite: Invite): Identity {
  const identity = Identity.import(invite.privateKey);

  if (identity.commitment.toString() !== invite.commitment) {
    throw new Error("Invite commitment does not match its private key");
  }

  return identity;
}

export async function createVoteRecord(
  manifest: RoomManifest,
  invite: Invite,
  pollId: string,
  optionId: string
): Promise<VoteRecord> {
  const group = createGroup(manifest);
  const identity = identityFromInvite(invite);
  const message = await scalarSignal(`vote:${pollId}:${optionId}`);
  const scope = await scalarSignal(`poll:${manifest.roomId}:${pollId}`);
  const proof = await generateProof(identity, group, message.bytes, scope.bytes);

  return {
    id: makeId("vote"),
    pollId,
    optionId,
    proof,
    nullifier: proof.nullifier,
    createdAt: new Date().toISOString()
  };
}

export async function createQuestionRecord(
  manifest: RoomManifest,
  invite: Invite,
  text: string
): Promise<QuestionRecord> {
  const group = createGroup(manifest);
  const identity = identityFromInvite(invite);
  const message = await scalarSignal(`question:${text.trim()}`);
  const scope = await scalarSignal(`question:${manifest.roomId}`);
  const proof = await generateProof(identity, group, message.bytes, scope.bytes);

  return {
    id: makeId("question"),
    text: text.trim(),
    proof,
    nullifier: proof.nullifier,
    createdAt: new Date().toISOString()
  };
}

export async function verifyVoteRecord(
  manifest: RoomManifest,
  polls: Poll[],
  vote: VoteRecord
): Promise<VerifiedVote> {
  const poll = polls.find((candidate) => candidate.id === vote.pollId);
  const option = poll?.options.find((candidate) => candidate.id === vote.optionId);

  if (!poll || !option) {
    return { ...vote, verified: false, reason: "Unknown poll option" };
  }

  const group = createGroup(manifest);
  const message = await scalarSignal(`vote:${vote.pollId}:${vote.optionId}`);
  const scope = await scalarSignal(`poll:${manifest.roomId}:${vote.pollId}`);

  if (vote.proof.merkleTreeRoot !== group.root.toString()) {
    return { ...vote, verified: false, reason: "Group root mismatch" };
  }

  if (vote.proof.message !== message.decimal || vote.proof.scope !== scope.decimal) {
    return { ...vote, verified: false, reason: "Proof signal mismatch" };
  }

  const verified = await verifyProof(vote.proof);
  return verified ? { ...vote, verified } : { ...vote, verified, reason: "Invalid zk proof" };
}

export async function verifyQuestionRecord(
  manifest: RoomManifest,
  question: QuestionRecord
): Promise<VerifiedQuestion> {
  if (question.text.trim().length < 3) {
    return { ...question, verified: false, reason: "Question is too short" };
  }

  const group = createGroup(manifest);
  const message = await scalarSignal(`question:${question.text.trim()}`);
  const scope = await scalarSignal(`question:${manifest.roomId}`);

  if (question.proof.merkleTreeRoot !== group.root.toString()) {
    return { ...question, verified: false, reason: "Group root mismatch" };
  }

  if (question.proof.message !== message.decimal || question.proof.scope !== scope.decimal) {
    return { ...question, verified: false, reason: "Proof signal mismatch" };
  }

  const verified = await verifyProof(question.proof);
  return verified
    ? { ...question, verified }
    : { ...question, verified, reason: "Invalid zk proof" };
}
