type SodiumApi = {
  ready: Promise<void>;
  crypto_generichash(outputLength: number, message: string | Uint8Array): Uint8Array;
};

let sodiumReady: Promise<SodiumApi> | null = null;

export async function getSodium(): Promise<SodiumApi> {
  sodiumReady ??= import("libsodium-wrappers").then(async (module) => {
    await module.default.ready;
    return module.default;
  });
  return sodiumReady;
}

export async function scalarSignal(value: string): Promise<{ bytes: Uint8Array; decimal: string }> {
  const sodiumApi = await getSodium();
  const bytes = sodiumApi.crypto_generichash(31, value);

  return {
    bytes,
    decimal: bytesToDecimal(bytes)
  };
}

export function bytesToDecimal(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return BigInt(`0x${hex || "0"}`).toString();
}
