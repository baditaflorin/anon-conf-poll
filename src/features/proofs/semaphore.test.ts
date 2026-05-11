import { afterEach, describe, expect, it, vi } from "vitest";
import { preloadSemaphore, resetPreloadCache } from "./semaphore";

// `generateProof` is expensive (downloads ~hundreds of MB on the first
// real run); we mock it to keep the test fast and offline.
vi.mock("@semaphore-protocol/proof", () => ({
  generateProof: vi.fn(() =>
    Promise.resolve({
      merkleTreeRoot: "0",
      message: "0",
      nullifier: "0",
      scope: "0",
      points: ["0"]
    })
  ),
  verifyProof: vi.fn(() => Promise.resolve(true))
}));

// libsodium is loaded asynchronously via WebAssembly; mock the helper
// it backs so we don't depend on the wasm binary being resolvable
// inside vitest's Node ESM loader.
vi.mock("./crypto", () => ({
  scalarSignal: vi.fn((input: string) =>
    Promise.resolve({
      bytes: new Uint8Array(new TextEncoder().encode(input)),
      decimal: "0"
    })
  )
}));

afterEach(() => {
  resetPreloadCache();
  vi.clearAllMocks();
});

describe("preloadSemaphore", () => {
  it("resolves successfully on the happy path", async () => {
    await expect(preloadSemaphore()).resolves.toBeUndefined();
  });

  it("only triggers a single generateProof regardless of how many times it is called", async () => {
    const proofModule = await import("@semaphore-protocol/proof");
    const generate = vi.mocked(proofModule.generateProof);

    await Promise.all([preloadSemaphore(), preloadSemaphore(), preloadSemaphore()]);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("recovers from a transient failure on the next call", async () => {
    const proofModule = await import("@semaphore-protocol/proof");
    const generate = vi.mocked(proofModule.generateProof);
    generate.mockRejectedValueOnce(new Error("cdn cold start"));

    // First call swallows the error so callers don't have to .catch().
    await expect(preloadSemaphore()).rejects.toThrow(/cdn cold start/);

    // After the failure, the cached promise should reset so a follow-up
    // call retries the underlying generateProof rather than re-throwing
    // the same stale error forever.
    await expect(preloadSemaphore()).resolves.toBeUndefined();
    expect(generate).toHaveBeenCalledTimes(2);
  });
});
