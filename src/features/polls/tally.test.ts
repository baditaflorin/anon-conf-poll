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

  /**
   * Regression test for a CRDT-consistency bug: `tallyVotes` used to
   * sort duplicate-nullifier votes by `createdAt` alone. When two votes
   * from the same nullifier share a byte-identical `createdAt` — plausible
   * for a scripted double-vote, clock skew, or just two fast concurrent
   * submissions landing in the same millisecond — Array.prototype.sort's
   * *stability* means ties are broken by each peer's own pre-sort array
   * order.
   *
   * Every peer syncs the exact same set of votes via the Yjs Y.Map (that
   * part of the CRDT converges correctly), but `Array.from(map.values())`
   * iterates in local insertion order, which depends on the order updates
   * arrived over the mesh — so two fully-synced, honest peers could
   * previously compute a *different* winning option for a tied pair, i.e.
   * disagree about the poll result despite holding identical data.
   *
   * This test feeds `tallyVotes` the same two votes in both array orders
   * (simulating two peers that received them in opposite arrival order)
   * and asserts both computations agree.
   */
  it("resolves same-timestamp duplicate-nullifier ties the same way regardless of input order", () => {
    const polls = [defaultPolls[0]!];
    const tiedCreatedAt = "2026-05-08T00:00:01.000Z";
    const voteYes: VerifiedVote = {
      id: "vote-yes",
      pollId: "opening-priority",
      optionId: "practical",
      proof,
      nullifier: "same-voter",
      createdAt: tiedCreatedAt,
      verified: true
    };
    const voteNo: VerifiedVote = {
      id: "vote-no",
      pollId: "opening-priority",
      optionId: "security",
      proof,
      nullifier: "same-voter",
      createdAt: tiedCreatedAt,
      verified: true
    };

    const arrivalOrderA = tallyVotes(polls, [voteYes, voteNo]);
    const arrivalOrderB = tallyVotes(polls, [voteNo, voteYes]);

    expect(arrivalOrderA).toEqual(arrivalOrderB);
    // Exactly one of the two options should be credited, and the total
    // count for the poll must stay at 1 regardless of which one it is.
    const totalVotes = arrivalOrderA.reduce((sum, row) => sum + row.votes, 0);
    expect(totalVotes).toBe(1);
  });
});
