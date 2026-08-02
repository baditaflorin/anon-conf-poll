import { describe, expect, it } from "vitest";
import { compareByCreatedAtThenId } from "./ordering";

describe("compareByCreatedAtThenId", () => {
  it("orders primarily by createdAt", () => {
    const earlier = { id: "z", createdAt: "2026-01-01T00:00:00.000Z" };
    const later = { id: "a", createdAt: "2026-01-01T00:00:01.000Z" };

    expect(compareByCreatedAtThenId(earlier, later)).toBeLessThan(0);
    expect(compareByCreatedAtThenId(later, earlier)).toBeGreaterThan(0);
  });

  it("breaks createdAt ties deterministically by id, independent of array order", () => {
    const a = { id: "vote-a", createdAt: "2026-01-01T00:00:00.000Z" };
    const b = { id: "vote-b", createdAt: "2026-01-01T00:00:00.000Z" };

    const sortedForward = [b, a].sort(compareByCreatedAtThenId);
    const sortedBackward = [a, b].sort(compareByCreatedAtThenId);

    // Regardless of which order the records started in (which is what
    // differs between two CRDT peers that received the same two records
    // over the network in a different order), the sorted result — and
    // therefore anything that picks the "first" record for a dedup key —
    // must be identical.
    expect(sortedForward).toEqual(sortedBackward);
    expect(sortedForward.map((r) => r.id)).toEqual(["vote-a", "vote-b"]);
  });

  it("is transitive/stable enough to produce a total order for Array.prototype.sort", () => {
    const records = [
      { id: "c", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "a", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", createdAt: "2026-01-01T00:00:00.000Z" }
    ];

    const sorted = [...records].sort(compareByCreatedAtThenId);
    expect(sorted.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});
