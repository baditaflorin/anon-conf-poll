import { del, get, set } from "idb-keyval";
import type { HostKeyPair } from "../proofs/crypto";

const prefix = "anon-conf-poll:hostKey:";

function key(roomId: string): string {
  return `${prefix}${roomId}`;
}

export async function saveHostKey(roomId: string, kp: HostKeyPair): Promise<void> {
  await set(key(roomId), kp);
}

export async function loadHostKey(roomId: string): Promise<HostKeyPair | null> {
  const value = await get<HostKeyPair | undefined>(key(roomId));
  if (!value || typeof value.publicKey !== "string" || typeof value.privateKey !== "string") {
    return null;
  }
  return value;
}

export async function deleteHostKey(roomId: string): Promise<void> {
  await del(key(roomId));
}

/** Export the host key as JSON text for backup or device transfer. */
export function serializeHostKey(roomId: string, kp: HostKeyPair): string {
  return `${JSON.stringify({ schemaVersion: 1, roomId, ...kp }, null, 2)}\n`;
}

export function parseHostKey(
  value: string
): { ok: true; roomId: string; key: HostKeyPair } | { ok: false; message: string } {
  try {
    const parsed = JSON.parse(value) as {
      schemaVersion?: number;
      roomId?: string;
      publicKey?: string;
      privateKey?: string;
    };
    if (
      parsed.schemaVersion !== 1 ||
      typeof parsed.roomId !== "string" ||
      typeof parsed.publicKey !== "string" ||
      typeof parsed.privateKey !== "string"
    ) {
      return { ok: false, message: "Host key file is missing required fields." };
    }
    return {
      ok: true,
      roomId: parsed.roomId,
      key: { publicKey: parsed.publicKey, privateKey: parsed.privateKey }
    };
  } catch {
    return { ok: false, message: "Host key file is not valid JSON." };
  }
}
