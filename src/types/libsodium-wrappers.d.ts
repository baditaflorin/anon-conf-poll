declare module "libsodium-wrappers" {
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
      ORIGINAL_NO_PADDING: Base64Variant;
      URLSAFE: Base64Variant;
      URLSAFE_NO_PADDING: Base64Variant;
    };
    crypto_generichash(outputLength: number, message: string | Uint8Array): Uint8Array;
    crypto_sign_keypair(): KeyPair;
    crypto_sign_detached(message: string, privateKey: Uint8Array): Uint8Array;
    crypto_sign_verify_detached(
      signature: Uint8Array,
      message: string,
      publicKey: Uint8Array
    ): boolean;
    to_base64(input: Uint8Array, variant?: Base64Variant): string;
    from_base64(input: string, variant?: Base64Variant): Uint8Array;
  };

  const sodium: SodiumApi;
  export default sodium;
}
