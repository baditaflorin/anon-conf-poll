import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseInviteInput } from "./inviteInput";
import { inferPolls } from "./pollInference";
import { inferRoster } from "./rosterInference";
import { safeDecodeRoomInput } from "./roomLink";

describe("substance parser fuzzing", () => {
  it("does not throw for arbitrary pasted invite text", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(() => parseInviteInput(value)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it("does not throw for arbitrary room hashes", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(() => safeDecodeRoomInput(value)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it("does not throw for arbitrary poll drafts", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(() => inferPolls(value)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it("does not throw for arbitrary roster CSV-like input", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(() => inferRoster(value)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });
});
