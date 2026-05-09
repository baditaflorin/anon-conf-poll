export type IceServer = {
  urls: string;
  username?: string;
  credential?: string;
};

const ICE_KEY = "anon-conf-poll:iceServers";
const SIGNALING_KEY = "anon-conf-poll:signalingUrl";

export const DEFAULT_ICE_SERVERS: IceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function loadIceServers(): IceServer[] {
  try {
    const raw = localStorage.getItem(ICE_KEY);
    if (raw) {
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

export function loadSignalingUrl(): string {
  return localStorage.getItem(SIGNALING_KEY) ?? "";
}

export function saveSignalingUrl(url: string): void {
  const trimmed = url.trim();
  if (trimmed) {
    localStorage.setItem(SIGNALING_KEY, trimmed);
  } else {
    localStorage.removeItem(SIGNALING_KEY);
  }
}
