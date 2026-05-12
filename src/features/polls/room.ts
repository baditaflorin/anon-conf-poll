import lzString from "lz-string";
import { z } from "zod";
import type { Invite, Poll, RoomManifest } from "./types";

const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } = lzString;

// lz-string's compressToEncodedURIComponent emits an alphabet that includes
// the '+' character. '+' is technically valid in URL fragments per RFC 3986,
// but it confuses many real-world URL detectors — most notably WhatsApp, which
// truncates the linkified URL at the first '+'. Other apps treat '+' as a
// word boundary or re-encode it as a space (the query-string semantic).
//
// We post-process the encoded payload to swap '+' for '_'. '_' is unreserved
// in RFC 3986 (always safe), and lz-string never emits '_' itself, so the
// mapping is unambiguous and fully reversible. The decoder swaps '_' back to
// '+' before handing it to lz-string, which keeps OLD share-links (with '+')
// working too — old links contain no '_', so the swap is a no-op for them.
function encodeUrlSafe(input: string): string {
  return compressToEncodedURIComponent(input).replace(/\+/g, "_");
}

function decodeUrlSafe(input: string): string | null {
  return decompressFromEncodedURIComponent(input.replace(/_/g, "+"));
}

const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1)
});

export const pollSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  options: z.array(optionSchema).min(2)
});

export const roomManifestSchema = z.object({
  schemaVersion: z.literal(2),
  roomId: z.string().min(6),
  title: z.string().min(1),
  createdAt: z.string().min(1),
  attendeeCommitments: z.array(z.string().regex(/^\d+$/)).min(1),
  hostPubKey: z.string().min(16),
  proofProfile: z.literal("semaphore-v4-groth16")
}) satisfies z.ZodType<RoomManifest>;

/**
 * Legacy v1 manifest shape (polls in the URL, no host pubkey). We still
 * recognise it on decode so the user can be told the room is too old and
 * needs to be recreated — see DamagedRoomScreen.
 */
export const legacyRoomManifestSchema = z.object({
  schemaVersion: z.literal(1),
  roomId: z.string().min(6),
  title: z.string().min(1),
  createdAt: z.string().min(1),
  polls: z.array(pollSchema).min(1),
  attendeeCommitments: z.array(z.string().regex(/^\d+$/)).min(1),
  proofProfile: z.literal("semaphore-v4-groth16")
});

export const inviteSchema = z.object({
  schemaVersion: z.literal(1),
  roomId: z.string().min(6),
  privateKey: z.string().min(16),
  commitment: z.string().regex(/^\d+$/)
}) satisfies z.ZodType<Invite>;

export const defaultPolls: Poll[] = [
  {
    id: "opening-priority",
    title: "What should this session optimize for?",
    options: [
      { id: "practical", label: "Practical demos" },
      { id: "architecture", label: "Architecture depth" },
      { id: "security", label: "Security review" },
      { id: "qa", label: "Open Q&A" }
    ]
  },
  {
    id: "confidence",
    title: "How confident are you about anonymous polling?",
    options: [
      { id: "new", label: "New to it" },
      { id: "curious", label: "Curious" },
      { id: "comfortable", label: "Comfortable" },
      { id: "expert", label: "I can review proofs" }
    ]
  }
];

export function encodeRoom(manifest: RoomManifest): string {
  return `room=${encodeUrlSafe(JSON.stringify(manifest))}`;
}

export function decodeRoom(hash: string): RoomManifest | null {
  const rawHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(rawHash);
  const encoded = params.get("room");

  if (!encoded) {
    return null;
  }

  const decompressed = decodeUrlSafe(encoded);

  if (!decompressed) {
    return null;
  }

  return roomManifestSchema.parse(JSON.parse(decompressed));
}

/**
 * Inspect the URL fragment and return v2 success, legacy v1 detected (so the
 * UI can show a clear "this room link is too old" message), or null when
 * nothing is decodable.
 */
export function inspectRoom(
  hash: string
): { kind: "v2"; manifest: RoomManifest } | { kind: "v1-legacy" } | { kind: "none" } {
  const rawHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(rawHash);
  const encoded = params.get("room");
  if (!encoded) return { kind: "none" };

  const decompressed = decodeUrlSafe(encoded);
  if (!decompressed) return { kind: "none" };

  let json: unknown;
  try {
    json = JSON.parse(decompressed);
  } catch {
    return { kind: "none" };
  }

  const v2 = roomManifestSchema.safeParse(json);
  if (v2.success) return { kind: "v2", manifest: v2.data };

  const legacy = legacyRoomManifestSchema.safeParse(json);
  if (legacy.success) return { kind: "v1-legacy" };

  return { kind: "none" };
}

export function encodeInvite(invite: Invite): string {
  return encodeUrlSafe(JSON.stringify(invite));
}

export function decodeInvite(value: string): Invite {
  const decompressed = decodeUrlSafe(value.trim());

  if (!decompressed) {
    throw new Error("Invite code is not valid compressed JSON");
  }

  return inviteSchema.parse(JSON.parse(decompressed));
}

export function inviteBelongsToRoom(invite: Invite, manifest: RoomManifest): boolean {
  return (
    invite.roomId === manifest.roomId && manifest.attendeeCommitments.includes(invite.commitment)
  );
}

export function roomShareUrl(manifest: RoomManifest, href = currentHref()): string {
  const url = new URL(href);
  url.hash = encodeRoom(manifest);
  return url.toString();
}

export function attendeeShareUrl(
  manifest: RoomManifest,
  invite: Invite,
  href = currentHref()
): string {
  const url = new URL(href);
  url.hash = `${encodeRoom(manifest)}&invite=${encodeInvite(invite)}`;
  return url.toString();
}

export function decodeInviteFromHash(hash: string): Invite | null {
  const rawHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(rawHash);
  const encoded = params.get("invite");
  if (!encoded) return null;
  try {
    return decodeInvite(encoded);
  } catch {
    return null;
  }
}

export function makeId(prefix: string): string {
  const random = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${random.replace(/-/g, "").slice(0, 16)}`;
}

function currentHref(): string {
  const runtimeGlobal = globalThis as typeof globalThis & {
    location?: { href?: string };
  };

  return runtimeGlobal.location?.href ?? "https://baditaflorin.github.io/anon-conf-poll/";
}
