import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { Profile } from "./types";

const OWN_PROFILE_COLUMNS =
  "id, display_name, avatar_path, bio, onboarding_completed_at, created_at, updated_at" as const;

interface ProfileRow {
  id: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarPath: row.avatar_path,
    bio: row.bio,
    onboardingCompletedAt: row.onboarding_completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The signed-in caller's own profile row, or `null` if none exists yet (a
 * new signup that has not completed onboarding) or no session exists
 * (architecture §6: query construction confined to this file).
 */
export async function getOwnProfile(): Promise<Profile | null> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user === null) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(OWN_PROFILE_COLUMNS)
    // Explicit, not left to RLS alone: `profiles` now carries multiple
    // additive OR-combined read policies (co-member, and — since Phase
    // 3B — mod+ reviewing a pending requester), so an unfiltered query can
    // legitimately admit more than one row once the caller shares a batch
    // with anyone else. `.maybeSingle()` with no WHERE clause would then
    // error (PGRST116) instead of returning the caller's own row — a real,
    // latent defect this phase's own test flow surfaced.
    .eq("id", userData.user.id)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }
  return data === null ? null : mapRow(data);
}

/**
 * Profiles by id — the caller's own row always, and (since Phase 2) any
 * profile sharing an active batch with the caller (security.md §5.4, §6.1).
 * RLS decides which of `ids` actually come back; a non-shared profile is
 * simply absent from the result, not an error.
 *
 * The domain this belongs to (`profiles`) owns this read so other modules —
 * `memberships`' roster view, currently — never query the `profiles` table
 * directly (architecture §17, rules.md §4).
 */
export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(OWN_PROFILE_COLUMNS)
    .in("id", ids);

  if (error !== null) {
    throw error;
  }
  return (data ?? []).map(mapRow);
}

/**
 * A short-lived signed URL for the given avatar path, or `null` if the path
 * is absent or the caller cannot read that object (security.md §6.1, §8).
 * The exact TTL is a Phase 1 delivery-convenience choice, independent of R1
 * (which is specifically about batch-media TTL, still open).
 */
const AVATAR_URL_TTL_SECONDS = 60;

export async function getAvatarUrl(avatarPath: string | null): Promise<string | null> {
  if (avatarPath === null) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(avatarPath, AVATAR_URL_TTL_SECONDS);

  if (error !== null) {
    return null;
  }
  return data.signedUrl;
}

/** The caller's own avatar, specifically. */
export async function getOwnAvatarUrl(): Promise<string | null> {
  const profile = await getOwnProfile();
  return profile === null ? null : getAvatarUrl(profile.avatarPath);
}
