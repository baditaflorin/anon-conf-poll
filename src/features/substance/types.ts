export type Confidence = "high" | "medium" | "low";

export type InferenceIssue = {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
  row?: number;
  field?: string;
  suggestion?: string;
};

export type InferenceMeta = {
  schemaVersion: 1;
  sourceKind: string;
  sourceChecksum: string;
  normalizedAt?: string;
  confidence: Confidence;
  reasons: string[];
  issues: InferenceIssue[];
};

export type FieldRoles = Record<string, string | undefined>;
