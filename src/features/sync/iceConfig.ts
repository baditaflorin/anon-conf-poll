export type IceServer = {
  urls: string;
  username?: string;
  credential?: string;
};

export type TurnCredential = {
  username: string;
  password: string;
  ttl: number;
  uris: string[];
};

const ICE_KEY       = "anon-conf-poll:iceServers";
const SIGNALING_KEY = "anon-conf-poll:signalingUrl";
const TOKEN_URL_KEY = "anon-conf-poll:turnTokenUrl";

const STUN_SERVERS: IceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// Fallback used only when no token server is configured and nothing is saved.
// openrelay.metered.ca is a free public relay — fine for testing, not production.
export const DEFAULT_ICE_SERVERS: IceServer[] = [
  ...STUN_SERVERS,
  { urls: "turn:openrelay.metered.ca:80",                  username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:80?transport=tcp",    username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turns:openrelay.metered.ca:443",                username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turns:openrelay.metered.ca:443?transport=tcp",  username: "openrelayproject", credential: "openrelayproject" },
];

const STUN_ONLY_FINGERPRINT = JSON.stringify(STUN_SERVERS);

// ── ICE servers ───────────────────────────────────────────────────────────────

export function loadIceServers(): IceServer[] {
  try {
    const raw = localStorage.getItem(ICE_KEY);
    if (raw && raw !== STUN_ONLY_FINGERPRINT) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as IceServer[];
    }
  } catch {}
  return DEFAULT_ICE_SERVERS;
}

export function saveIceServers(servers: IceServer[]): void {
  localStorage.setItem(ICE_KEY, JSON.stringify(servers));
}

export function resetIceServers(): void {
  localStorage.removeItem(ICE_KEY);
}

// ── Signaling URL ─────────────────────────────────────────────────────────────

// Signaling servers known to be dead — clear them from localStorage so the
// build-time default (our self-hosted server) is used instead.
const DEAD_SIGNALING_SERVERS = [
  "wss://signaling.yjs.dev",
  "ws://signaling.yjs.dev",
];

export function loadSignalingUrl(): string {
  const stored = localStorage.getItem(SIGNALING_KEY) ?? "";
  if (stored && DEAD_SIGNALING_SERVERS.includes(stored)) {
    localStorage.removeItem(SIGNALING_KEY);
    return "";
  }
  return stored;
}

export function saveSignalingUrl(url: string): void {
  const trimmed = url.trim();
  if (trimmed) {
    localStorage.setItem(SIGNALING_KEY, trimmed);
  } else {
    localStorage.removeItem(SIGNALING_KEY);
  }
}

// ── TURN token server URL ─────────────────────────────────────────────────────
// Runtime localStorage overrides the build-time env var.
// The token URL is not a secret — only TURN_SECRET on the server is.

export function loadTurnTokenUrl(): string {
  return (
    localStorage.getItem(TOKEN_URL_KEY) ??
    (import.meta.env.VITE_TURN_TOKEN_URL as string | undefined) ??
    ""
  );
}

export function saveTurnTokenUrl(url: string): void {
  const trimmed = url.trim();
  if (trimmed) {
    localStorage.setItem(TOKEN_URL_KEY, trimmed);
  } else {
    localStorage.removeItem(TOKEN_URL_KEY);
  }
}

// ── Credential fetch ──────────────────────────────────────────────────────────
// Called before the WebrtcProvider is created. Fetches fresh HMAC credentials
// from the token server and saves them as the active ICE server list.
// Falls back silently to whatever is already in localStorage on any error.

export async function maybeFetchTurnCredentials(): Promise<void> {
  const tokenUrl = loadTurnTokenUrl();
  if (!tokenUrl) return;

  try {
    const res = await fetch(tokenUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const cred = (await res.json()) as TurnCredential;
    if (!Array.isArray(cred.uris) || cred.uris.length === 0) {
      throw new Error("Token server returned no TURN URIs");
    }

    saveIceServers([
      ...STUN_SERVERS,
      ...cred.uris.map((u) => ({
        urls: u,
        username: cred.username,
        credential: cred.password,
      })),
    ]);
  } catch (err) {
    console.warn("[turn-token] credential fetch failed — using cached ICE servers:", err);
  }
}
