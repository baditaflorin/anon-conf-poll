/**
 * Deterministic "first submission wins" ordering for CRDT-synced records.
 *
 * Votes/questions arrive at each peer over a Yjs Y.Map, whose iteration
 * order (`Map.values()`) reflects the order keys were first inserted
 * *locally* — which depends on network arrival order and therefore can
 * differ from peer to peer, even once every peer holds the exact same set
 * of records (CRDT convergence guarantees the *set* is identical, not the
 * iteration order).
 *
 * Any place that picks a "winner" among records sharing a dedup key (e.g.
 * the earliest vote for a given Semaphore nullifier) by sorting on
 * `createdAt` alone is therefore not fully deterministic: two records
 * created in the same millisecond (plausible for a scripted double-vote,
 * clock skew, or simply fast concurrent submissions) sort in
 * arrival-dependent order, so different peers can pick a different
 * "first" record and disagree about the result — even though they agree
 * on the underlying data.
 *
 * Breaking ties on a content field that is itself part of the converged
 * data (`id`, which is unique per record) makes the sort a pure function
 * of the record set, so every peer that holds the same set computes the
 * same order and therefore the same winner, regardless of arrival order.
 */
export function compareByCreatedAtThenId<T extends { createdAt: string; id: string }>(
  a: T,
  b: T
): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}
