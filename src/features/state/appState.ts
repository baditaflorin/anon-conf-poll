import { z } from "zod";
import { inviteSchema, roomManifestSchema } from "../polls/room";
import type { Invite, QuestionRecord, RoomManifest, VoteRecord } from "../polls/types";

const proofSchema = z.custom<VoteRecord["proof"]>(
  (value) => typeof value === "object" && value !== null,
  "proof must be an object"
);

const voteRecordSchema: z.ZodType<VoteRecord> = z.object({
  id: z.string().min(1),
  pollId: z.string().min(1),
  optionId: z.string().min(1),
  proof: proofSchema,
  nullifier: z.string().min(1),
  createdAt: z.string().min(1)
});

const questionRecordSchema: z.ZodType<QuestionRecord> = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  proof: proofSchema,
  nullifier: z.string().min(1),
  createdAt: z.string().min(1)
});

const activityEventSchema = z.object({
  at: z.string().min(1),
  label: z.string().min(1),
  detail: z.string()
});

export type ActivityEvent = z.infer<typeof activityEventSchema>;

export const appStateSchema = z.object({
  schemaVersion: z.literal(3),
  exportedAt: z.string().min(1),
  manifest: roomManifestSchema,
  activeInvite: inviteSchema.nullable(),
  organizerInvites: z.array(inviteSchema),
  rosterInput: z.string(),
  inviteInput: z.string(),
  selectedOptions: z.record(z.string(), z.string()),
  activity: z.array(activityEventSchema),
  votes: z.array(voteRecordSchema),
  questions: z.array(questionRecordSchema)
});

export type AppStateSnapshot = z.infer<typeof appStateSchema>;

export function createAppStateSnapshot(input: {
  manifest: RoomManifest;
  activeInvite: Invite | null;
  organizerInvites: Invite[];
  rosterInput: string;
  inviteInput: string;
  selectedOptions: Record<string, string>;
  activity: ActivityEvent[];
  votes: VoteRecord[];
  questions: QuestionRecord[];
}): AppStateSnapshot {
  return {
    schemaVersion: 3,
    exportedAt: new Date().toISOString(),
    manifest: input.manifest,
    activeInvite: input.activeInvite,
    organizerInvites: input.organizerInvites,
    rosterInput: input.rosterInput,
    inviteInput: input.inviteInput,
    selectedOptions: input.selectedOptions,
    activity: input.activity,
    votes: input.votes,
    questions: input.questions
  };
}

export function parseAppStateSnapshot(
  value: string
): { ok: true; state: AppStateSnapshot } | { ok: false; message: string } {
  try {
    return parseUnknownAppState(JSON.parse(value));
  } catch {
    return { ok: false, message: "State file is not valid JSON." };
  }
}

export function parseUnknownAppState(
  value: unknown
): { ok: true; state: AppStateSnapshot } | { ok: false; message: string } {
  const parsed = appStateSchema.safeParse(value);

  if (parsed.success) {
    return { ok: true, state: parsed.data };
  }

  return {
    ok: false,
    message: parsed.error.issues.map((issue) => issue.path.join(".") || issue.message).join(", ")
  };
}

/**
 * Saved state from a previous schema version is discarded — we can't safely
 * migrate v1 (URL polls, no host key) or v2 (different appState shape) into
 * the host-managed v3 room model. The UI surfaces a fresh welcome screen.
 */
export function migrateSavedState(value: unknown): AppStateSnapshot | null {
  const current = appStateSchema.safeParse(value);
  return current.success ? current.data : null;
}

export function serializeAppState(state: AppStateSnapshot): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}
