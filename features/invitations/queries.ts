import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { Invite } from "./types";

// Deliberately excludes token_hash — the column-level GRANT on
// batch_invites already refuses to return it to any client role (security
// migration), but naming columns explicitly here, rather than `select("*")`,
// keeps that exclusion visible at the call site too.
const INVITE_COLUMNS =
  "id, batch_id, max_uses, use_count, expires_at, revoked_at, revoked_by, created_by, created_at, updated_at" as const;

interface InviteRow {
  id: string;
  batch_id: string;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapInviteRow(row: InviteRow): Invite {
  return {
    id: row.id,
    batchId: row.batch_id,
    maxUses: row.max_uses,
    useCount: row.use_count,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    revokedBy: row.revoked_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Every invite for a batch, newest first. RLS admits this only to admin+ of
 * that batch (security.md §9) — a plain member reading this list sees
 * nothing, not an empty-looking subset of a superset (architecture §11).
 */
export async function listBatchInvites(batchId: string): Promise<Invite[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("batch_invites")
    .select(INVITE_COLUMNS)
    .eq("batch_id", batchId)
    .order("created_at", { ascending: false });

  if (error !== null) {
    throw error;
  }

  return (data ?? []).map(mapInviteRow);
}

/** Whether an invite is currently usable — a display computation only, never an authorization decision (security.md §3.4's computed-validity predicate). */
export function isInviteUsable(invite: Invite, now: Date = new Date()): boolean {
  if (invite.revokedAt !== null) return false;
  if (invite.expiresAt !== null && new Date(invite.expiresAt) <= now) return false;
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return false;
  return true;
}
