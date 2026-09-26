import "server-only";

import { getAvatarUrl, getProfilesByIds } from "@/features/profiles/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BatchRole } from "@/lib/authz/roles";

import type { MembershipStatus, MyMembership, RosterMember } from "./types";

interface MembershipRow {
  profile_id: string;
  role: BatchRole;
  status: MembershipStatus;
  joined_at: string | null;
  requested_at: string;
}

/**
 * The roster for a batch (phases.md Phase 2, "member list basics").
 *
 * Reads `batch_members` directly — RLS decides the result shape: an ACTIVE
 * member sees the full roster, a PENDING requester sees only their own row
 * (security.md §5.4). This function does not distinguish those cases; it
 * simply returns whatever RLS admitted.
 *
 * Display info comes through `features/profiles`' own exported queries
 * (architecture §17: a module owns its data) — never a direct read of the
 * `profiles` table from here.
 */
export async function listBatchMembers(batchId: string): Promise<RosterMember[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("batch_members")
    .select("profile_id, role, status, joined_at, requested_at")
    .eq("batch_id", batchId)
    .order("joined_at", { ascending: true, nullsFirst: false });

  if (error !== null) {
    throw error;
  }

  const rows = (data ?? []) as MembershipRow[];
  const profiles = await getProfilesByIds(rows.map((row) => row.profile_id));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const members = await Promise.all(
    rows.map(async (row) => {
      const profile = profileById.get(row.profile_id) ?? null;
      return {
        profileId: row.profile_id,
        role: row.role,
        status: row.status,
        joinedAt: row.joined_at,
        requestedAt: row.requested_at,
        displayName: profile?.displayName ?? null,
        avatarUrl: profile === null ? null : await getAvatarUrl(profile.avatarPath),
      } satisfies RosterMember;
    }),
  );

  return members;
}

/** The caller's own membership row in a batch, or `null` if they have none. */
export async function getMyMembership(batchId: string): Promise<MyMembership | null> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user === null) {
    return null;
  }

  const { data, error } = await supabase
    .from("batch_members")
    .select("role, status")
    .eq("batch_id", batchId)
    .eq("profile_id", userData.user.id)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }
  if (data === null) {
    return null;
  }

  return { batchId, role: data.role, status: data.status };
}
