import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeDuplicateVotes } from "./duplicateVote";
import { parseInviteInput } from "./inviteInput";
import { inferPolls } from "./pollInference";
import { inferRoster } from "./rosterInference";
import { safeDecodeRoomInput } from "./roomLink";

const fixtureDir = join(process.cwd(), "test/fixtures/realdata");

describe("Phase 2 real-data fixtures", () => {
  it.each([
    ["01-clean-invite.input.txt", "01-clean-invite.expected.json"],
    ["02-email-wrapped-invite.input.txt", "02-email-wrapped-invite.expected.json"],
    ["03-json-array-invite.input.txt", "03-json-array-invite.expected.json"]
  ])("normalizes invite fixture %s", (inputFile, expectedFile) => {
    const actual = parseInviteInput(readFixture(inputFile));
    const expected = readJson(expectedFile);

    expect(projectInvite(actual)).toEqual(expected);
  });

  it.each([
    ["04-eventbrite-roster.csv", "04-eventbrite-roster.expected.json"],
    ["05-zoom-roster.csv", "05-zoom-roster.expected.json"]
  ])("infers roster fixture %s", (inputFile, expectedFile) => {
    const actual = inferRoster(readFixture(inputFile));
    const expected = readJson(expectedFile);

    expect({
      kind: actual.kind,
      sourceKind: actual.sourceKind,
      eligibleRows: actual.eligibleRows,
      duplicateRows: actual.duplicateRows,
      excludedRows: actual.excludedRows,
      confidence: actual.confidence,
      fieldRoles: actual.fieldRoles
    }).toEqual(expected);
  });

  it.each([
    ["06-agenda-poll.input.txt", "06-agenda-poll.expected.json"],
    ["07-poll-spreadsheet.csv", "07-poll-spreadsheet.expected.json"]
  ])("infers poll fixture %s", (inputFile, expectedFile) => {
    const actual = inferPolls(readFixture(inputFile));
    const expected = readJson(expectedFile);

    expect({
      kind: actual.kind,
      pollCount: actual.pollCount,
      optionCounts: actual.optionCounts,
      confidence: actual.confidence,
      pollIds: actual.polls.map((poll) => poll.id)
    }).toEqual(expected);
  });

  it("turns a corrupt room hash into a recoverable state", () => {
    const actual = safeDecodeRoomInput(readFixture("08-corrupt-room-hash.input.txt"));
    const expected = readJson("08-corrupt-room-hash.expected.json");

    expect(projectRoomResult(actual)).toEqual(expected);
  });

  it("localizes invalid manifest fields", () => {
    const actual = safeDecodeRoomInput(readFixture("09-legacy-manifest.json"));
    const expected = readJson("09-legacy-manifest.expected.json");

    expect(projectRoomResult(actual)).toEqual(expected);
  });

  it("summarizes duplicate nullifiers honestly", () => {
    const actual = summarizeDuplicateVotes(readJson("10-duplicate-nullifier.json"));
    const expected = readJson("10-duplicate-nullifier.expected.json");

    expect(actual).toEqual(expected);
  });

  it("produces deterministic inference outputs for repeated runs", () => {
    const roster = readFixture("04-eventbrite-roster.csv");
    const polls = readFixture("06-agenda-poll.input.txt");

    expect(inferRoster(roster)).toEqual(inferRoster(roster));
    expect(inferPolls(polls)).toEqual(inferPolls(polls));
  });
});

function readFixture(name: string): string {
  return readFileSync(join(fixtureDir, name), "utf8");
}

function readJson(name: string) {
  return JSON.parse(readFixture(name)) as unknown;
}

function projectInvite(result: ReturnType<typeof parseInviteInput>) {
  if (!result.ok) {
    return {
      kind: result.kind,
      ok: result.ok,
      confidence: result.confidence,
      code: result.code,
      normalizations: result.normalizations
    };
  }

  const projected: Record<string, unknown> = {
    kind: result.kind,
    ok: result.ok,
    roomId: result.roomId,
    commitment: result.commitment,
    confidence: result.confidence
  };

  if (result.normalizations.length > 0) {
    projected.normalizations = result.normalizations;
  }

  return projected;
}

function projectRoomResult(result: ReturnType<typeof safeDecodeRoomInput>) {
  if (result.ok) {
    return { kind: result.kind, ok: true };
  }

  const projected: Record<string, unknown> = {
    kind: result.kind,
    ok: false,
    recoverable: result.recoverable,
    code: result.code
  };

  if (result.fieldIssues.length > 0) {
    projected.fieldIssues = result.fieldIssues;
  }

  return projected;
}
