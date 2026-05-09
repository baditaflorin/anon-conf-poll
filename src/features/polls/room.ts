import lzString from "lz-string";
import { z } from "zod";
import type { Invite, Poll, RoomManifest } from "./types";

const { compressToEncodedURIComponent, decompressFromEncodedURIComponent } = lzString;

const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1)
});

const pollSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  options: z.array(optionSchema).min(2)
});

export const roomManifestSchema = z.object({
  schemaVersion: z.literal(1),
  roomId: z.string().min(6),
  title: z.string().min(1),
  createdAt: z.string().min(1),
  polls: z.array(pollSchema).min(1),
  attendeeCommitments: z.array(z.string().regex(/^\d+$/)).min(1),
  proofProfile: z.literal("semaphore-v4-groth16")
}) satisfies z.ZodType<RoomManifest>;

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
  return `room=${compressToEncodedURIComponent(JSON.stringify(manifest))}`;
}

export function decodeRoom(hash: string): RoomManifest | null {
  const rawHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(rawHash);
  const encoded = params.get("room");

  if (!encoded) {
    return null;
  }

  const decompressed = decompressFromEncodedURIComponent(encoded);

  if (!decompressed) {
    return null;
  }

  return roomManifestSchema.parse(JSON.parse(decompressed));
}

export function encodeInvite(invite: Invite): string {
  return compressToEncodedURIComponent(JSON.stringify(invite));
}

export function decodeInvite(value: string): Invite {
  const decompressed = decompressFromEncodedURIComponent(value.trim());

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

export function attendeeShareUrl(manifest: RoomManifest, invite: Invite, href = currentHref()): string {
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
