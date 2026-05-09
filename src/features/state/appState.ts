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
  schemaVersion: z.literal(2),
  exportedAt: z.string().min(1),
  manifest: roomManifestSchema,
  activeInvite: inviteSchema.nullable(),
  organizerInvites: z.array(inviteSchema),
  rosterInput: z.string(),
  pollInput: z.string(),
  inviteInput: z.string(),
  selectedOptions: z.record(z.string(), z.string()),
  activity: z.array(activityEventSchema),
  votes: z.array(voteRecordSchema),
  questions: z.array(questionRecordSchema)
});

export type AppStateSnapshot = z.infer<typeof appStateSchema>;

const legacyRecentRoomSchema = z.object({
  manifest: roomManifestSchema,
  invite: inviteSchema.nullable(),
  savedAt: z.string().optional()
});

export function createAppStateSnapshot(input: {
  manifest: RoomManifest;
  activeInvite: Invite | null;
  organizerInvites: Invite[];
  rosterInput: string;
  pollInput: string;
  inviteInput: string;
  selectedOptions: Record<string, string>;
  activity: ActivityEvent[];
  votes: VoteRecord[];
  questions: QuestionRecord[];
}): AppStateSnapshot {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    manifest: input.manifest,
    activeInvite: input.activeInvite,
    organizerInvites: input.organizerInvites,
    rosterInput: input.rosterInput,
    pollInput: input.pollInput,
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

export function migrateSavedState(value: unknown): AppStateSnapshot | null {
  const current = appStateSchema.safeParse(value);

  if (current.success) {
    return current.data;
  }

  const legacy = legacyRecentRoomSchema.safeParse(value);

  if (!legacy.success) {
    return null;
  }

  return createAppStateSnapshot({
    manifest: legacy.data.manifest,
    activeInvite: legacy.data.invite,
    organizerInvites: [],
    rosterInput: "",
    pollInput: "",
    inviteInput: "",
    selectedOptions: {},
    activity: [
      {
        at: legacy.data.savedAt ?? new Date().toISOString(),
        label: "Legacy room restored",
        detail: "Migrated saved room and invite into the v0.3 state format."
      }
    ],
    votes: [],
    questions: []
  });
}

export function serializeAppState(state: AppStateSnapshot): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}
