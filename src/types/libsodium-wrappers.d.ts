declare module "libsodium-wrappers" {
  type SodiumApi = {
    ready: Promise<void>;
    crypto_generichash(outputLength: number, message: string | Uint8Array): Uint8Array;
  };

  const sodium: SodiumApi;
  export default sodium;
}
