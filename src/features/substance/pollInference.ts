import Papa from "papaparse";
import type { Poll } from "../polls/types";
import { normalizeTextInput, slugifyStable, stableChecksum, uniqueStableId } from "./normalization";
import type { Confidence, InferenceIssue, InferenceMeta } from "./types";

export type PollPreview = {
  kind: "polls";
  polls: Poll[];
  pollCount: number;
  optionCounts: number[];
  confidence: Confidence;
  issues: InferenceIssue[];
  meta: InferenceMeta;
};

type PollRow = {
  poll_id?: string;
  title?: string;
  option?: string;
};

export function inferPolls(input: string): PollPreview {
  const normalized = normalizeTextInput(input);
  const csvPreview = tryInferCsvPolls(normalized);

  if (csvPreview) {
    return csvPreview;
  }

  return inferTextPolls(normalized);
}

function tryInferCsvPolls(input: string): PollPreview | null {
  const parsed = Papa.parse<PollRow>(input, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim().toLowerCase(),
    transform: (value) => value.trim()
  });
  const fields = parsed.meta.fields ?? [];

  if (!fields.includes("title") || !fields.includes("option")) {
    return null;
  }

  const issues = parsed.errors.map((error) => ({
    code: "csv-parse-warning",
    message: error.message,
    severity: "warning" as const,
    row: error.row
  }));
  const groups = new Map<string, { title: string; options: string[] }>();
  const idSeen = new Set<string>();

  for (const row of parsed.data) {
    if (!row.title || !row.option) {
      continue;
    }

    const idBase = row.poll_id || slugifyStable(row.title, "poll");
    const id = groups.has(idBase) ? idBase : uniqueStableId(idBase, idSeen);
    const group = groups.get(id) ?? { title: row.title, options: [] };
    group.options.push(row.option);
    groups.set(id, group);
  }

  return buildPreview(
    Array.from(groups, ([id, group]) => toPoll(id, group.title, group.options)),
    issues,
    "poll-csv",
    input,
    "high",
    ["Detected poll CSV columns title and option."]
  );
}

function inferTextPolls(input: string): PollPreview {
  const lines = input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const polls: Poll[] = [];
  const issues: InferenceIssue[] = [];
  const seen = new Set<string>();
  let currentTitle = "";
  let currentIdBasis = "";
  let options: string[] = [];

  const flush = () => {
    if (!currentTitle) {
      return;
    }

    if (options.length < 2) {
      issues.push({
        code: "poll-too-few-options",
        message: `Poll "${currentTitle}" has fewer than two options.`,
        severity: "warning",
        suggestion: "Add at least two answer options or remove this poll."
      });
      return;
    }

    polls.push(
      toPoll(
        uniqueStableId(slugifyStable(currentIdBasis || currentTitle, "poll"), seen),
        currentTitle,
        options
      )
    );
  };

  for (const line of lines) {
    const option = parseOptionLine(line);

    if (option) {
      options.push(option);
      continue;
    }

    flush();
    const title = parseTitleLine(line);
    currentTitle = title.title;
    currentIdBasis = title.idBasis;
    options = [];
  }

  flush();

  return buildPreview(
    polls,
    issues,
    "poll-text",
    input,
    polls.length > 0 && issues.length === 0 ? "high" : "medium",
    ["Detected poll text from headings and bullet/lettered options."]
  );
}

function parseOptionLine(line: string): string | null {
  const bullet = line.match(/^[-*•]\s+(.+)$/);
  const lettered = line.match(/^[A-Z]\)\s+(.+)$/i);
  return bullet?.[1] ?? lettered?.[1] ?? null;
}

function parseTitleLine(line: string): { title: string; idBasis: string } {
  const emDash = line.match(/^(.+?)\s+[—-]\s+(.+)$/);

  if (emDash) {
    return { idBasis: emDash[1]!.trim(), title: line };
  }

  const colon = line.match(/^(.+?):\s+(.+)$/);

  if (colon) {
    const prefix = colon[1]!.trim();
    const suffix = colon[2]!.trim();
    return /poll|question/i.test(prefix)
      ? { idBasis: suffix, title: suffix }
      : { idBasis: prefix, title: line };
  }

  return { idBasis: line, title: line };
}

function toPoll(id: string, title: string, options: string[]): Poll {
  const seen = new Set<string>();

  return {
    id,
    title,
    options: options.map((option) => ({
      id: uniqueStableId(slugifyStable(option, "option"), seen),
      label: option
    }))
  };
}

function buildPreview(
  polls: Poll[],
  issues: InferenceIssue[],
  sourceKind: string,
  source: string,
  confidence: Confidence,
  reasons: string[]
): PollPreview {
  return {
    kind: "polls",
    polls,
    pollCount: polls.length,
    optionCounts: polls.map((poll) => poll.options.length),
    confidence: polls.length === 0 ? "low" : confidence,
    issues,
    meta: {
      schemaVersion: 1,
      sourceKind,
      sourceChecksum: stableChecksum(source),
      confidence: polls.length === 0 ? "low" : confidence,
      reasons,
      issues
    }
  };
}
