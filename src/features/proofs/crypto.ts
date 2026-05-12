type Base64Variant = number;

type KeyPair = {
  keyType: "ed25519";
  publicKey: Uint8Array;
  privateKey: Uint8Array;
};

type SodiumApi = {
  ready: Promise<void>;
  base64_variants: {
    ORIGINAL: Base64Variant;
    URLSAFE_NO_PADDING: Base64Variant;
  };
  crypto_generichash(outputLength: number, message: string | Uint8Array): Uint8Array;
  crypto_sign_keypair(): KeyPair;
  // libsodium-wrappers accepts either a string or a Uint8Array for `message`.
  // We use strings so the test environment (jsdom realm) doesn't trip the
  // library's instanceof Uint8Array check (jsdom and Node have separate
  // Uint8Array constructors).
  crypto_sign_detached(message: string, privateKey: Uint8Array): Uint8Array;
  crypto_sign_verify_detached(
    signature: Uint8Array,
    message: string,
    publicKey: Uint8Array
  ): boolean;
  to_base64(input: Uint8Array, variant?: Base64Variant): string;
  from_base64(input: string, variant?: Base64Variant): Uint8Array;
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

/**
 * Host identity keypair. The room creator gets one of these at room-create
 * time; the public key travels in the URL-encoded manifest, the private key
 * stays in this browser's localStorage. Any peer can verify that a poll or
 * phase transition really came from the host by checking the signature
 * against the manifest's hostPubKey.
 */
export type HostKeyPair = {
  publicKey: string;
  privateKey: string;
};

export async function generateHostKeyPair(): Promise<HostKeyPair> {
  const sodiumApi = await getSodium();
  const kp = sodiumApi.crypto_sign_keypair();
  return {
    publicKey: sodiumApi.to_base64(kp.publicKey, sodiumApi.base64_variants.URLSAFE_NO_PADDING),
    privateKey: sodiumApi.to_base64(kp.privateKey, sodiumApi.base64_variants.URLSAFE_NO_PADDING)
  };
}

export async function signMessage(privateKey: string, message: string): Promise<string> {
  const sodiumApi = await getSodium();
  const privBytes = sodiumApi.from_base64(privateKey, sodiumApi.base64_variants.URLSAFE_NO_PADDING);
  const sig = sodiumApi.crypto_sign_detached(message, privBytes);
  return sodiumApi.to_base64(sig, sodiumApi.base64_variants.URLSAFE_NO_PADDING);
}

export async function verifySignature(
  publicKey: string,
  message: string,
  signature: string
): Promise<boolean> {
  try {
    const sodiumApi = await getSodium();
    const pubBytes = sodiumApi.from_base64(publicKey, sodiumApi.base64_variants.URLSAFE_NO_PADDING);
    const sigBytes = sodiumApi.from_base64(signature, sodiumApi.base64_variants.URLSAFE_NO_PADDING);
    return sodiumApi.crypto_sign_verify_detached(sigBytes, message, pubBytes);
  } catch {
    return false;
  }
}

/**
 * Canonical JSON: deterministic stringification with sorted keys so that two
 * peers signing or verifying the same logical payload always hash the same
 * bytes regardless of property ordering.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}
