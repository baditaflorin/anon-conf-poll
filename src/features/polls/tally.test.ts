import { describe, expect, it } from "vitest";
import { defaultPolls } from "./room";
import { tallyVotes } from "./tally";
import type { RoomManifest, VerifiedVote } from "./types";

const manifest: RoomManifest = {
  schemaVersion: 1,
  roomId: "room-test01",
  title: "Test",
  createdAt: "2026-05-08T00:00:00.000Z",
  polls: [defaultPolls[0]!],
  attendeeCommitments: ["1", "2", "3", "4"],
  proofProfile: "semaphore-v4-groth16"
};

const proof = {
  merkleTreeDepth: 1,
  merkleTreeRoot: "1",
  message: "1",
  nullifier: "n1",
  scope: "1",
  points: ["0", "0", "0", "0", "0", "0", "0", "0"] as never
};

describe("tallyVotes", () => {
  it("counts only verified votes and ignores duplicate nullifiers per poll", () => {
    const votes: VerifiedVote[] = [
      {
        id: "vote-1",
        pollId: "opening-priority",
        optionId: "practical",
        proof,
        nullifier: "same",
        createdAt: "2026-05-08T00:00:01.000Z",
        verified: true
      },
      {
        id: "vote-2",
        pollId: "opening-priority",
        optionId: "security",
        proof,
        nullifier: "same",
        createdAt: "2026-05-08T00:00:02.000Z",
        verified: true
      },
      {
        id: "vote-3",
        pollId: "opening-priority",
        optionId: "security",
        proof,
        nullifier: "other",
        createdAt: "2026-05-08T00:00:03.000Z",
        verified: false
      }
    ];

    const tallies = tallyVotes(manifest, votes);

    expect(tallies.find((row) => row.optionId === "practical")?.votes).toBe(1);
    expect(tallies.find((row) => row.optionId === "security")?.votes).toBe(0);
  });
});
