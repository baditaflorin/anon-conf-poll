import Papa from "papaparse";
import { normalizeTextInput, stableChecksum } from "./normalization";
import type { Confidence, FieldRoles, InferenceIssue, InferenceMeta } from "./types";

export type RosterPreview = {
  kind: "roster";
  sourceKind: "eventbrite" | "zoom" | "generic";
  eligibleRows: number;
  duplicateRows: number;
  excludedRows: number;
  totalRows: number;
  confidence: Confidence;
  fieldRoles: FieldRoles;
  issues: InferenceIssue[];
  meta: InferenceMeta;
};

type ParsedRow = Record<string, string>;

export function inferRoster(input: string): RosterPreview {
  const normalized = normalizeTextInput(input);
  const parsed = Papa.parse<ParsedRow>(normalized, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim()
  });
  const fields = parsed.meta.fields ?? [];
  const rows = parsed.data.filter((row) => Object.values(row).some(Boolean));
  const fieldRoles = inferFieldRoles(fields);
  const sourceKind = inferSourceKind(fields);
  const issues: InferenceIssue[] = parsed.errors.map((error) => ({
    code: "csv-parse-warning",
    message: error.message,
    severity: "warning",
    row: error.row
  }));

  let eligibleRows = 0;
  let duplicateRows = 0;
  let excludedRows = 0;
  const seenEmails = new Set<string>();

  rows.forEach((row, index) => {
    const email = readField(row, fieldRoles.email).toLowerCase();
    const status = readField(row, fieldRoles.status).toLowerCase();

    if (!email || !isLikelyEmail(email)) {
      excludedRows += 1;
      issues.push({
        code: "missing-email",
        message: "Roster row has no usable email address.",
        severity: "warning",
        row: index + 2,
        field: fieldRoles.email,
        suggestion: "Skip this row or add an email before generating invites."
      });
      return;
    }

    if (isExcludedStatus(status)) {
      excludedRows += 1;
      issues.push({
        code: "excluded-status",
        message: `Roster row status "${status}" is not eligible for voting.`,
        severity: "info",
        row: index + 2,
        field: fieldRoles.status,
        suggestion: "Review the eligibility status if this attendee should vote."
      });
      return;
    }

    if (seenEmails.has(email)) {
      duplicateRows += 1;
      issues.push({
        code: "duplicate-email",
        message: "Duplicate attendee email detected.",
        severity: "warning",
        row: index + 2,
        field: fieldRoles.email,
        suggestion: "Keep the first invite unless this is a legitimate group ticket."
      });
      return;
    }

    seenEmails.add(email);
    eligibleRows += 1;
  });

  const confidence = inferConfidence(fieldRoles, sourceKind, rows.length, issues);

  return {
    kind: "roster",
    sourceKind,
    eligibleRows,
    duplicateRows,
    excludedRows,
    totalRows: rows.length,
    confidence,
    fieldRoles,
    issues,
    meta: {
      schemaVersion: 1,
      sourceKind,
      sourceChecksum: stableChecksum(normalized),
      confidence,
      reasons: buildReasons(fieldRoles, sourceKind),
      issues
    }
  };
}

function inferFieldRoles(fields: string[]): FieldRoles {
  const byPattern = (patterns: RegExp[]) =>
    fields.find((field) => patterns.some((pattern) => pattern.test(field.toLowerCase())));

  return {
    email: byPattern([/^e-?mail$/, /email address/]),
    firstName: byPattern([/first.*name/, /given.*name/]),
    lastName: byPattern([/last.*name/, /family.*name/, /surname/]),
    ticketType: byPattern([/ticket.*type/, /^ticket$/]),
    status: byPattern([/approval.*status/, /checked.*in/, /^status$/])
  };
}

function inferSourceKind(fields: string[]): RosterPreview["sourceKind"] {
  const normalized = fields.map((field) => field.toLowerCase());

  if (normalized.includes("order #") && normalized.includes("ticket type")) {
    return "eventbrite";
  }

  if (normalized.includes("registration time") && normalized.includes("approval status")) {
    return "zoom";
  }

  return "generic";
}

function readField(row: ParsedRow, field: string | undefined): string {
  return field ? (row[field] ?? "") : "";
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isExcludedStatus(value: string): boolean {
  return /pending|cancel|rejected|denied|waitlist/.test(value);
}

function inferConfidence(
  roles: FieldRoles,
  sourceKind: RosterPreview["sourceKind"],
  rowCount: number,
  issues: InferenceIssue[]
): Confidence {
  if (!roles.email || rowCount === 0) {
    return "low";
  }

  if (sourceKind !== "generic" && issues.every((issue) => issue.severity !== "error")) {
    return "high";
  }

  return "medium";
}

function buildReasons(roles: FieldRoles, sourceKind: RosterPreview["sourceKind"]): string[] {
  const reasons = [`Detected ${sourceKind} roster shape.`];

  if (roles.email) {
    reasons.push(`Detected email field "${roles.email}".`);
  }

  if (roles.status) {
    reasons.push(`Detected eligibility/status field "${roles.status}".`);
  }

  return reasons;
}
