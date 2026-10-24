export type ReportTargetKind = "memory" | "comment" | "member";
export type ReportStatus = "open" | "resolved";
export type ReportReason = "harassment" | "inappropriate" | "privacy" | "spam" | "other";

export const REPORT_REASONS: readonly ReportReason[] = [
  "harassment",
  "inappropriate",
  "privacy",
  "spam",
  "other",
];

export interface Report {
  id: string;
  batchId: string;
  reporterId: string | null;
  targetKind: ReportTargetKind;
  targetId: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: number;
  occurredAt: string;
  actorProfileId: string | null;
  actorRole: string | null;
  action: string;
  targetKind: string | null;
  targetId: string | null;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const GENERIC_ERROR = "Something went wrong. Please try again.";
