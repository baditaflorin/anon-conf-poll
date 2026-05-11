export const appConfig = {
  appName: "anon-conf-poll",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
  repositoryUrl:
    import.meta.env.VITE_REPOSITORY_URL ?? "https://github.com/baditaflorin/anon-conf-poll",
  paypalUrl: import.meta.env.VITE_PAYPAL_URL ?? "https://www.paypal.com/paypalme/florinbadita",
  signalingUrl: import.meta.env.VITE_WEBRTC_SIGNALING ?? "wss://turn.0docker.com/ws",
  pagesUrl: "https://baditaflorin.github.io/anon-conf-poll/"
} as const;

export const isProduction = import.meta.env.PROD;
