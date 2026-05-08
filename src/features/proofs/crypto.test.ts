import { describe, expect, it } from "vitest";
import { bytesToDecimal } from "./crypto";

describe("bytesToDecimal", () => {
  it("converts big-endian bytes into a decimal scalar string", () => {
    expect(bytesToDecimal(new Uint8Array([0x01, 0x00]))).toBe("256");
  });
});
