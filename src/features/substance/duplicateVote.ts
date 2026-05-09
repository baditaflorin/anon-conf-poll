export type DuplicateVoteInput = {
  pollId: string;
  votes: Array<{
    id: string;
    optionId: string;
    nullifier: string;
    createdAt: string;
  }>;
};

export type DuplicateVoteSummary = {
  kind: "duplicate-vote";
  countedVotes: number;
  duplicateVotes: number;
  message: string;
};

export function summarizeDuplicateVotes(input: DuplicateVoteInput): DuplicateVoteSummary {
  const seen = new Set<string>();
  let countedVotes = 0;
  let duplicateVotes = 0;

  for (const vote of [...input.votes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const key = `${input.pollId}:${vote.nullifier}`;

    if (seen.has(key)) {
      duplicateVotes += 1;
      continue;
    }

    seen.add(key);
    countedVotes += 1;
  }

  return {
    kind: "duplicate-vote",
    countedVotes,
    duplicateVotes,
    message:
      duplicateVotes > 0
        ? "This invite already has a counted vote for this poll."
        : "All verified votes are unique for this poll."
  };
}
