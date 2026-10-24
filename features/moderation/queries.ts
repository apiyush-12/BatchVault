import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { AuditLogEntry, Report } from "./types";

interface ReportRow {
  id: string;
  batch_id: string;
  reporter_id: string | null;
  target_kind: string;
  target_id: string;
  reason: string;
  details: string | null;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
}

function mapReportRow(row: ReportRow): Report {
  return {
    id: row.id,
    batchId: row.batch_id,
    reporterId: row.reporter_id,
    targetKind: row.target_kind as Report["targetKind"],
    targetId: row.target_id,
    reason: row.reason as Report["reason"],
    details: row.details,
    status: row.status as Report["status"],
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
  };
}

/** The moderation queue (phases.md Phase 8A) — mod+ only; the RPC itself enforces that, this is just the typed read. */
export async function listOpenReports(batchId: string): Promise<Report[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_open_reports", { p_batch_id: batchId });
  if (error !== null) {
    return [];
  }
  return ((data ?? []) as ReportRow[]).map(mapReportRow);
}

/** Audit-log view for admin+ of that batch only (phases.md Phase 8A; database.md §3.10). */
export async function listAuditLog(batchId: string): Promise<AuditLogEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("list_audit_log", { p_batch_id: batchId, p_limit: 100 });
  if (error !== null) {
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    actorProfileId: row.actor_profile_id,
    actorRole: row.actor_role,
    action: row.action,
    targetKind: row.target_kind,
    targetId: row.target_id,
  }));
}
