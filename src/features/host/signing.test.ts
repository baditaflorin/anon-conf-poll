import { describe, expect, it } from "vitest";
import { generateHostKeyPair } from "../proofs/crypto";
import type { Poll } from "../polls/types";
import { signPhase, signPoll, verifySignedPhase, verifySignedPoll } from "./signing";

const samplePoll: Poll = {
  id: "poll-1",
  title: "Should we ship?",
  options: [
    { id: "opt-yes", label: "Yes" },
    { id: "opt-no", label: "No" }
  ]
};

describe("host signing", () => {
  it("a host-signed poll verifies against the host's public key", async () => {
    const kp = await generateHostKeyPair();
    const signed = await signPoll(kp, samplePoll, "room-abc");
    expect(await verifySignedPoll(kp.publicKey, signed)).toBe(true);
  });

  it("a tampered poll fails verification", async () => {
    const kp = await generateHostKeyPair();
    const signed = await signPoll(kp, samplePoll, "room-abc");
    const tampered = {
      ...signed,
      poll: { ...signed.poll, title: "Should we ship NOW?" }
    };
    expect(await verifySignedPoll(kp.publicKey, tampered)).toBe(false);
  });

  it("a poll signed by a different host fails verification under the real host", async () => {
    const real = await generateHostKeyPair();
    const imposter = await generateHostKeyPair();
    const signed = await signPoll(imposter, samplePoll, "room-abc");
    expect(await verifySignedPoll(real.publicKey, signed)).toBe(false);
    expect(await verifySignedPoll(imposter.publicKey, signed)).toBe(true);
  });

  it("phase transitions verify and detect tampering", async () => {
    const kp = await generateHostKeyPair();
    const signed = await signPhase(kp, "voting", "room-abc");
    expect(await verifySignedPhase(kp.publicKey, signed)).toBe(true);
    const tampered = { ...signed, phase: "draft" as const };
    expect(await verifySignedPhase(kp.publicKey, tampered)).toBe(false);
  });

  it("signatures from one room do not verify under a different roomId", async () => {
    const kp = await generateHostKeyPair();
    const signed = await signPoll(kp, samplePoll, "room-abc");
    const wrongRoom = { ...signed, roomId: "room-xyz" };
    expect(await verifySignedPoll(kp.publicKey, wrongRoom)).toBe(false);
  });
});
