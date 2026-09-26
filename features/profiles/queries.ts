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
 *
 * Reads own row only — the shared-batch clause is Phase 2 (phases.md Phase
 * 1, "Explicitly NOT in scope").
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
    .maybeSingle();

  if (error !== null) {
    throw error;
  }
  return data === null ? null : mapRow(data);
}

/**
 * A short-lived signed URL for the caller's own avatar, or `null` if none is
 * set. The exact TTL is a Phase 1 delivery-convenience choice, independent of
 * R1 (which is specifically about batch-media TTL, still open).
 */
const OWN_AVATAR_URL_TTL_SECONDS = 60;

export async function getOwnAvatarUrl(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const profile = await getOwnProfile();
  if (profile === null || profile.avatarPath === null) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(profile.avatarPath, OWN_AVATAR_URL_TTL_SECONDS);

  if (error !== null) {
    return null;
  }
  return data.signedUrl;
}
