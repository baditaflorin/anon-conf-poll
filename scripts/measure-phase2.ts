import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { parseInviteInput } from "../src/features/substance/inviteInput";
import { inferPolls } from "../src/features/substance/pollInference";
import { inferRoster } from "../src/features/substance/rosterInference";
import { safeDecodeRoomInput } from "../src/features/substance/roomLink";

const fixtureDir = join(process.cwd(), "test/fixtures/realdata");
const outputPath = join(process.cwd(), "docs/perf/phase2-substance.json");

const tasks = [
  ["invite-clean", () => parseInviteInput(readFixture("01-clean-invite.input.txt"))],
  ["invite-wrapped", () => parseInviteInput(readFixture("02-email-wrapped-invite.input.txt"))],
  ["roster-eventbrite", () => inferRoster(readFixture("04-eventbrite-roster.csv"))],
  ["roster-zoom", () => inferRoster(readFixture("05-zoom-roster.csv"))],
  ["poll-text", () => inferPolls(readFixture("06-agenda-poll.input.txt"))],
  ["poll-csv", () => inferPolls(readFixture("07-poll-spreadsheet.csv"))],
  ["room-corrupt", () => safeDecodeRoomInput(readFixture("08-corrupt-room-hash.input.txt"))],
  ["room-legacy", () => safeDecodeRoomInput(readFixture("09-legacy-manifest.json"))],
  ["roster-5000", () => inferRoster(makeLargeRoster(5000))]
] as const;

const results = tasks.map(([name, run]) => {
  const samples: number[] = [];

  for (let index = 0; index < 20; index += 1) {
    const started = performance.now();
    run();
    samples.push(Number((performance.now() - started).toFixed(3)));
  }

  samples.sort((a, b) => a - b);

  return {
    name,
    medianMs: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    worstMs: samples.at(-1) ?? 0
  };
});

mkdirSync(join(process.cwd(), "docs/perf"), { recursive: true });
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      measuredAt: new Date().toISOString(),
      samplesPerTask: 20,
      results
    },
    null,
    2
  )}\n`
);

function readFixture(name: string): string {
  return readFileSync(join(fixtureDir, name), "utf8");
}

function percentile(values: number[], percentileValue: number): number {
  const index = Math.min(values.length - 1, Math.floor(values.length * percentileValue));
  return values[index] ?? 0;
}

function makeLargeRoster(size: number): string {
  const lines = ["First Name,Last Name,Email,Registration Time,Approval Status"];

  for (let index = 0; index < size; index += 1) {
    lines.push(`User${index},Test,user${index}@example.com,2026-05-09 10:00,approved`);
  }

  return lines.join("\n");
}
