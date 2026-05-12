import type { SemaphoreProof } from "@semaphore-protocol/proof";

export type ProofProfile = "semaphore-v4-groth16";

export type PollOption = {
  id: string;
  label: string;
};

export type Poll = {
  id: string;
  title: string;
  options: PollOption[];
};

/**
 * Schema v2: polls are no longer in the URL — they live in the room's Yjs
 * ydoc, signed by the host. The URL carries the room "bones" plus the host
 * public key so any peer can verify host-signed actions (poll edits, phase
 * transitions). See features/host/signing.ts for the signed payload shape.
 */
export type RoomManifest = {
  schemaVersion: 2;
  roomId: string;
  title: string;
  createdAt: string;
  attendeeCommitments: string[];
  hostPubKey: string;
  proofProfile: ProofProfile;
};

export type Invite = {
  schemaVersion: 1;
  roomId: string;
  privateKey: string;
  commitment: string;
};

export type GeneratedRoom = {
  manifest: RoomManifest;
  invites: Invite[];
  hostKey: { publicKey: string; privateKey: string };
};

export type VoteRecord = {
  id: string;
  pollId: string;
  optionId: string;
  proof: SemaphoreProof;
  nullifier: string;
  createdAt: string;
};

export type QuestionRecord = {
  id: string;
  text: string;
  proof: SemaphoreProof;
  nullifier: string;
  createdAt: string;
};

export type VerifiedVote = VoteRecord & {
  verified: boolean;
  reason?: string;
};

export type VerifiedQuestion = QuestionRecord & {
  verified: boolean;
  reason?: string;
};

export type PollTally = {
  pollId: string;
  optionId: string;
  label: string;
  votes: number;
};
