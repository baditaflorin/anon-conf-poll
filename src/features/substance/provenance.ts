import { appConfig } from "../../shared/config";
import type { RoomManifest, VerifiedQuestion, VerifiedVote } from "../polls/types";
import type { PollPreview } from "./pollInference";
import type { RosterPreview } from "./rosterInference";

export type ExportProvenance = {
  schemaVersion: 1;
  appVersion: string;
  sourceCommit: string;
  generatedAt: string;
  roomId: string;
  roster?: {
    sourceKind: string;
    sourceChecksum: string;
    confidence: string;
    eligibleRows: number;
    duplicateRows: number;
    excludedRows: number;
  };
  polls?: {
    sourceKind: string;
    sourceChecksum: string;
    confidence: string;
    pollCount: number;
  };
  counts: {
    verifiedVotes: number;
    verifiedQuestions: number;
  };
};

export function buildExportPayload(input: {
  manifest: RoomManifest;
  votes: VerifiedVote[];
  questions: VerifiedQuestion[];
  rosterPreview: RosterPreview | null;
  pollPreview: PollPreview | null;
}) {
  const provenance: ExportProvenance = {
    schemaVersion: 1,
    appVersion: appConfig.version,
    sourceCommit: appConfig.commit,
    generatedAt: new Date().toISOString(),
    roomId: input.manifest.roomId,
    counts: {
      verifiedVotes: input.votes.filter((vote) => vote.verified).length,
      verifiedQuestions: input.questions.filter((question) => question.verified).length
    }
  };

  if (input.rosterPreview) {
    provenance.roster = {
      sourceKind: input.rosterPreview.sourceKind,
      sourceChecksum: input.rosterPreview.meta.sourceChecksum,
      confidence: input.rosterPreview.confidence,
      eligibleRows: input.rosterPreview.eligibleRows,
      duplicateRows: input.rosterPreview.duplicateRows,
      excludedRows: input.rosterPreview.excludedRows
    };
  }

  if (input.pollPreview) {
    provenance.polls = {
      sourceKind: input.pollPreview.meta.sourceKind,
      sourceChecksum: input.pollPreview.meta.sourceChecksum,
      confidence: input.pollPreview.confidence,
      pollCount: input.pollPreview.pollCount
    };
  }

  return {
    provenance,
    manifest: input.manifest,
    votes: input.votes,
    questions: input.questions
  };
}
