import { ZodError } from "zod";
import {
  decodeRoom,
  inspectRoom,
  legacyRoomManifestSchema,
  roomManifestSchema
} from "../polls/room";
import type { RoomManifest } from "../polls/types";

export type SafeRoomResult =
  | { kind: "room-link"; ok: true; manifest: RoomManifest }
  | {
      kind: "room-link";
      ok: false;
      recoverable: true;
      code: "room-link-damaged" | "room-manifest-invalid" | "room-link-legacy";
      message: string;
      suggestion: string;
      fieldIssues: string[];
    };

export function safeDecodeRoomInput(input: string): SafeRoomResult {
  const trimmed = normalizeRoomInput(input);

  if (!trimmed) {
    return damaged("The room link is empty.");
  }

  try {
    if (trimmed.startsWith("{")) {
      const json = JSON.parse(trimmed);
      // Reject legacy v1 inline JSON explicitly so the host knows to recreate.
      if (legacyRoomManifestSchema.safeParse(json).success) {
        return legacy();
      }
      return {
        kind: "room-link",
        ok: true,
        manifest: roomManifestSchema.parse(json)
      };
    }

    const inspection = inspectRoom(trimmed);
    if (inspection.kind === "v1-legacy") {
      return legacy();
    }

    const manifest = decodeRoom(trimmed);

    if (!manifest) {
      return damaged("The room link is incomplete or damaged.");
    }

    return { kind: "room-link", ok: true, manifest };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        kind: "room-link",
        ok: false,
        recoverable: true,
        code: "room-manifest-invalid",
        message: "The room data does not match the supported room format.",
        suggestion: "Ask the organizer for a fresh room link or create a new room.",
        fieldIssues: error.issues
          .map((issue) => issue.path.join("."))
          .filter(Boolean)
          .sort()
      };
    }

    return damaged("The room link could not be decoded.");
  }
}

function legacy(): SafeRoomResult {
  return {
    kind: "room-link",
    ok: false,
    recoverable: true,
    code: "room-link-legacy",
    message: "This is an older room link that no longer works with the host-managed format.",
    suggestion: "Ask the organizer to create a new room and share the fresh link.",
    fieldIssues: []
  };
}

function damaged(message: string): SafeRoomResult {
  return {
    kind: "room-link",
    ok: false,
    recoverable: true,
    code: "room-link-damaged",
    message,
    suggestion: "Paste the complete room link again or create a new room.",
    fieldIssues: []
  };
}

function normalizeRoomInput(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    return url.hash || trimmed;
  } catch {
    return trimmed;
  }
}
