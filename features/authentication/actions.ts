"use server";

import { redirect } from "next/navigation";

import { hasCompletedOnboarding } from "@/lib/auth/session";
import { clientEnv } from "@/lib/env/client";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  requestPasswordResetInputSchema,
  signInInputSchema,
  signUpInputSchema,
  updatePasswordInputSchema,
} from "./schema";
import { GENERIC_AUTH_ERROR, GENERIC_ERROR, type ActionResult } from "./types";

/**
 * Server Actions for the authentication domain (architecture §18.1).
 *
 * Every action follows the fixed order: authenticate → validate → authorize
 * → execute → revalidate → return (architecture §18.3). "Authenticate" for
 * sign-up/sign-in/reset-request is trivially satisfied — there is no caller
 * identity yet — and becomes real from `signInAction` onward, where the
 * verified session established by Supabase Auth is what every later step
 * reads from.
 *
 * These wire up Supabase Auth's own flows; no custom crypto, no custom
 * session store (security.md §2).
 */

function buildRedirectUrl(path: "/onboarding" | "/reset-password"): string {
  return `${clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")}/callback?next=${encodeURIComponent(path)}`;
}

export async function signUpAction(
  input: unknown,
): Promise<ActionResult<{ requiresVerification: boolean }>> {
  const parsed = signUpInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? GENERIC_ERROR,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: buildRedirectUrl("/onboarding") },
  });

  if (error !== null) {
    logger.warn("authentication.sign_up_failed", {
      code: error.code ?? "unknown",
    });
    return { ok: false, error: GENERIC_AUTH_ERROR };
  }

  if (data.session !== null) {
    // Email confirmation is disabled for this project: signUp already
    // returned a session, so there is nothing to verify.
    redirect("/onboarding");
  }

  return { ok: true, data: { requiresVerification: true } };
}

export async function signInAction(input: unknown): Promise<ActionResult> {
  const parsed = signInInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? GENERIC_ERROR,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error !== null || data.user === null) {
    logger.warn("authentication.sign_in_failed", {
      code: error?.code ?? "unknown",
    });
    // Same generic message for wrong password, unknown email, and an
    // unverified account — a stranger must not learn which (security.md §3).
    return { ok: false, error: GENERIC_AUTH_ERROR };
  }

  const onboarded = await hasCompletedOnboarding(data.user.id);
  redirect(onboarded ? "/home" : "/onboarding");
}

export async function signOutAction(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export async function requestPasswordResetAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = requestPasswordResetInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? GENERIC_ERROR,
    };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: buildRedirectUrl("/reset-password"),
  });

  // Identical success response whether or not the address is registered —
  // an enumeration probe must learn nothing (security.md §3).
  return { ok: true, data: undefined };
}

export async function updatePasswordAction(
  input: unknown,
): Promise<ActionResult> {
  const parsed = updatePasswordInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? GENERIC_ERROR,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user === null) {
    // Only reachable via the recovery-session link; no session means it was
    // already used or has expired.
    return { ok: false, error: GENERIC_ERROR };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error !== null) {
    logger.warn("authentication.update_password_failed", {
      code: error.code ?? "unknown",
    });
    return { ok: false, error: GENERIC_ERROR };
  }

  const onboarded = await hasCompletedOnboarding(userData.user.id);
  redirect(onboarded ? "/home" : "/onboarding");
}
