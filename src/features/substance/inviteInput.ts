import { decodeInvite } from "../polls/room";
import type { Invite } from "../polls/types";
import type { Confidence } from "./types";

export type InviteParseResult =
  | {
      kind: "invite";
      ok: true;
      invite: Invite;
      roomId: string;
      commitment: string;
      confidence: Confidence;
      normalizations: string[];
    }
  | {
      kind: "invite";
      ok: false;
      confidence: "low";
      code: "invite-empty" | "invite-damaged";
      message: string;
      suggestion: string;
      normalizations: string[];
    };

export function parseInviteInput(rawInput: string): InviteParseResult {
  const normalizations: string[] = [];
  const trimmed = rawInput.trim();

  if (!trimmed) {
    return {
      kind: "invite",
      ok: false,
      confidence: "low",
      code: "invite-empty",
      message: "No invite code was pasted.",
      suggestion: "Paste the invite code sent by the organizer.",
      normalizations
    };
  }

  const extracted = extractInviteToken(trimmed, normalizations);

  if (!extracted) {
    return damaged(normalizations);
  }

  const compact = extracted.replace(/\s+/g, "");

  if (compact !== extracted) {
    normalizations.push("removed-token-whitespace");
  }

  try {
    const invite = decodeInvite(compact);
    return {
      kind: "invite",
      ok: true,
      invite,
      roomId: invite.roomId,
      commitment: invite.commitment,
      confidence: normalizations.length === 0 ? "high" : "medium",
      normalizations
    };
  } catch {
    return damaged(normalizations);
  }
}

function extractInviteToken(input: string, normalizations: string[]): string | null {
  const jsonToken = extractJsonToken(input, normalizations);

  if (jsonToken) {
    return jsonToken;
  }

  try {
    const url = new URL(input);
    const invite =
      url.searchParams.get("invite") ?? new URLSearchParams(url.hash.slice(1)).get("invite");

    if (invite) {
      normalizations.push("invite-url-wrapper");
      return invite;
    }
  } catch {
    // Not a URL; keep looking for a token in pasted text.
  }

  const assignment = input.match(/invite\s*=\s*([A-Za-z0-9+_\-\s]{40,})/i);

  if (assignment?.[1]) {
    normalizations.push("invite-prefix-wrapper");
    return assignment[1];
  }

  const token = input.match(/[A-Za-z0-9+_\-\s]{60,}/)?.[0];

  if (token && token.trim() !== input) {
    normalizations.push("extracted-token");
    return token;
  }

  return input;
}

function extractJsonToken(input: string, normalizations: string[]): string | null {
  try {
    const parsed = JSON.parse(input) as unknown;

    if (typeof parsed === "string") {
      normalizations.push("json-string-wrapper");
      return parsed;
    }

    if (Array.isArray(parsed) && typeof parsed[0] === "string") {
      normalizations.push("json-array-wrapper");
      return parsed[0];
    }
  } catch {
    return null;
  }

  return null;
}

function damaged(normalizations: string[]): InviteParseResult {
  return {
    kind: "invite",
    ok: false,
    confidence: "low",
    code: "invite-damaged",
    message: "The invite code is incomplete or damaged.",
    suggestion: "Paste the full invite code again, including any wrapped lines.",
    normalizations
  };
}
