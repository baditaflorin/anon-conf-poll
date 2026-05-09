/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;

interface ImportMetaEnv {
  readonly VITE_REPOSITORY_URL?: string;
  readonly VITE_PAYPAL_URL?: string;
  readonly VITE_WEBRTC_SIGNALING?: string;
  // URL of your turn-token-server /credentials endpoint.
  // This is NOT a secret — only TURN_SECRET on the server is sensitive.
  readonly VITE_TURN_TOKEN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
