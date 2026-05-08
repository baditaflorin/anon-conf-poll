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

export type RoomManifest = {
  schemaVersion: 1;
  roomId: string;
  title: string;
  createdAt: string;
  polls: Poll[];
  attendeeCommitments: string[];
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
