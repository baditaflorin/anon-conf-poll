import { parseAppStateSnapshot } from "../state/appState";
import { parseInviteInput } from "../substance/inviteInput";

export type TextFileInput = {
  name: string;
  type: string;
  text: string;
};

export type ImportKind = "state" | "room" | "invite" | "roster" | "poll" | "unknown";

export type ClassifiedImport = TextFileInput & {
  kind: ImportKind;
};

export async function readTextFiles(files: FileList | File[]): Promise<TextFileInput[]> {
  const fileArray = Array.from(files);

  return Promise.all(
    fileArray.map(async (file) => ({
      name: file.name,
      type: file.type || inferMimeFromName(file.name),
      text: await file.text()
    }))
  );
}

export function classifyImport(input: TextFileInput): ClassifiedImport {
  const name = input.name.toLowerCase();
  const text = input.text.trim();

  if (!text) {
    return { ...input, kind: "unknown" };
  }

  if (parseAppStateSnapshot(text).ok) {
    return { ...input, kind: "state" };
  }

  if (looksLikeRoomLink(text)) {
    return { ...input, kind: "room" };
  }

  if (parseInviteInput(text).ok || name.includes("invite")) {
    return { ...input, kind: "invite" };
  }

  if (looksLikeRoster(text) || name.includes("roster") || name.includes("attendee")) {
    return { ...input, kind: "roster" };
  }

  if (looksLikePoll(text) || name.includes("poll") || name.includes("agenda")) {
    return { ...input, kind: "poll" };
  }

  return { ...input, kind: "unknown" };
}

function inferMimeFromName(name: string): string {
  if (name.endsWith(".json")) {
    return "application/json";
  }

  if (name.endsWith(".csv")) {
    return "text/csv";
  }

  return "text/plain";
}

function looksLikeRoomLink(text: string): boolean {
  return text.includes("room=") || text.startsWith("#room=");
}

function looksLikeRoster(text: string): boolean {
  const header = text.split(/\r?\n/, 1)[0]?.toLowerCase() ?? "";
  return header.includes("email") && (header.includes("first") || header.includes("last"));
}

function looksLikePoll(text: string): boolean {
  const header = text.split(/\r?\n/, 1)[0]?.toLowerCase() ?? "";
  return (
    header.includes("poll_id") ||
    header.includes("option") ||
    /\bpoll\b/i.test(text) ||
    /^[-*]\s+\S+/m.test(text)
  );
}
