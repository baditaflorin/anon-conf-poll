import { describe, expect, it } from "vitest";
import { summarizeDuplicateVotes } from "./duplicateVote";

describe("summarizeDuplicateVotes", () => {
  it("counts one vote and flags the rest as duplicates for a repeated nullifier", () => {
    const summary = summarizeDuplicateVotes({
      pollId: "opening-priority",
      votes: [
        {
          id: "vote-a",
          optionId: "practical",
          nullifier: "same",
          createdAt: "2026-05-09T10:00:00.000Z"
        },
        {
          id: "vote-b",
          optionId: "security",
          nullifier: "same",
          createdAt: "2026-05-09T10:00:01.000Z"
        }
      ]
    });

    expect(summary).toEqual({
      kind: "duplicate-vote",
      countedVotes: 1,
      duplicateVotes: 1,
      message: "This invite already has a counted vote for this poll."
    });
  });

  /**
   * Regression test: this used to break createdAt ties by whatever order
   * the caller's array happened to be in. Under real CRDT sync, two peers
   * can hold the identical vote set but iterate their local Y.Map in a
   * different order (arrival order differs), so a same-millisecond
   * duplicate-nullifier pair could previously be summarized identically
   * in count, but the *specific* record picked as "the counted one" could
   * silently differ per peer. The count itself (which is what this
   * summary reports) must be arrival-order independent.
   */
  it("produces the same counted/duplicate split regardless of array order when createdAt ties", () => {
    const tiedCreatedAt = "2026-05-09T10:00:00.000Z";
    const voteA = {
      id: "vote-a",
      optionId: "practical",
      nullifier: "same",
      createdAt: tiedCreatedAt
    };
    const voteB = {
      id: "vote-b",
      optionId: "security",
      nullifier: "same",
      createdAt: tiedCreatedAt
    };

    const forward = summarizeDuplicateVotes({ pollId: "opening-priority", votes: [voteA, voteB] });
    const backward = summarizeDuplicateVotes({ pollId: "opening-priority", votes: [voteB, voteA] });

    expect(forward).toEqual(backward);
    expect(forward.countedVotes).toBe(1);
    expect(forward.duplicateVotes).toBe(1);
  });

  it("counts distinct nullifiers independently with no duplicates", () => {
    const summary = summarizeDuplicateVotes({
      pollId: "opening-priority",
      votes: [
        {
          id: "vote-a",
          optionId: "practical",
          nullifier: "voter-1",
          createdAt: "2026-05-09T10:00:00.000Z"
        },
        {
          id: "vote-b",
          optionId: "security",
          nullifier: "voter-2",
          createdAt: "2026-05-09T10:00:01.000Z"
        }
      ]
    });

    expect(summary.countedVotes).toBe(2);
    expect(summary.duplicateVotes).toBe(0);
    expect(summary.message).toBe("All verified votes are unique for this poll.");
  });
});
