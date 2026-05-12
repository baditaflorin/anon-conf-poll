import type { Poll, PollTally, VerifiedVote } from "./types";

export function tallyVotes(polls: Poll[], votes: VerifiedVote[]): PollTally[] {
  const uniqueByPollAndNullifier = new Set<string>();
  const counts = new Map<string, number>();

  for (const vote of [...votes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!vote.verified) {
      continue;
    }

    const uniqueKey = `${vote.pollId}:${vote.nullifier}`;

    if (uniqueByPollAndNullifier.has(uniqueKey)) {
      continue;
    }

    uniqueByPollAndNullifier.add(uniqueKey);
    const countKey = `${vote.pollId}:${vote.optionId}`;
    counts.set(countKey, (counts.get(countKey) ?? 0) + 1);
  }

  return polls.flatMap((poll) =>
    poll.options.map((option) => ({
      pollId: poll.id,
      optionId: option.id,
      label: option.label,
      votes: counts.get(`${poll.id}:${option.id}`) ?? 0
    }))
  );
}

export function hasVerifiedVoteForPoll(pollId: string, votes: VerifiedVote[]): boolean {
  return votes.some((vote) => vote.pollId === pollId && vote.verified);
}
