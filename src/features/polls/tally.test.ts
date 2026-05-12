import { describe, expect, it } from "vitest";
import { defaultPolls } from "./room";
import { tallyVotes } from "./tally";
import type { VerifiedVote } from "./types";

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
    const polls = [defaultPolls[0]!];
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

    const tallies = tallyVotes(polls, votes);

    expect(tallies.find((row) => row.optionId === "practical")?.votes).toBe(1);
    expect(tallies.find((row) => row.optionId === "security")?.votes).toBe(0);
  });
});
