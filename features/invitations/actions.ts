"use server";

import { revalidatePath } from "next/cache";

import { clientEnv } from "@/lib/env/client";
import { logger } from "@/lib/logging/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  createInviteInputSchema,
  redeemInviteInputSchema,
  revokeInviteInputSchema,
  validateInviteInputSchema,
} from "./schema";
import { requestIp } from "./request-ip";
import { generateInviteToken, hashInviteToken } from "./token";
import {
  GENERIC_ERROR,
  GENERIC_INVITE_ERROR,
  type ActionResult,
  type RedemptionResult,
} from "./types";

/**
 * Server Actions for the invitations domain (architecture §18.1).
 *
 * Fixed order throughout: authenticate → validate → authorize → execute →
 * revalidate → return (architecture §18.3). "Authorize" for every action
 * below is the privileged RPC's own job (security.md §5.2, §9, §11) — this
 * layer never re-implements it.
 *
 * `createInviteAction` is the ONLY place the raw bearer token ever exists —
 * generated here, hashed here, and only the hash is ever sent to the
 * database (security.md §9). The raw token is returned to the caller once,
 * in the Server Action's own result, never persisted, logged, or echoed
 * back from a later read.
 */

function daysFromNowIso(days: string | undefined): string | undefined {
  if (days === undefined || days === "") return undefined;
  const ms = Number(days) * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

function toPositiveIntOrUndefined(value: string | undefined): number | undefined {
  return value === undefined || value === "" ? undefined : Number(value);
}

export async function createInviteAction(
  input: unknown,
): Promise<ActionResult<{ inviteUrl: string }>> {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = createInviteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }
  const { batchId, maxUses, expiresInDays } = parsed.data;

  const rawToken = generateInviteToken();
  const tokenHash = hashInviteToken(rawToken);

  const { error } = await supabase.rpc("create_invite", {
    p_batch_id: batchId,
    p_token_hash: tokenHash,
    p_max_uses: toPositiveIntOrUndefined(maxUses) ?? null,
    p_expires_at: daysFromNowIso(expiresInDays) ?? null,
  });

  if (error !== null) {
    // Same generic shape whether the batch doesn't exist or the caller
    // simply lacks admin+ authority in it (security.md §3).
    logger.error("invitations.create_failed", { userId: userData.user.id, batchId });
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/batches/${batchId}/invite`);

  // The token travels in the URL fragment (security.md §9.1) — never a
  // query string. Built here, once, from the raw token this process just
  // generated; it is never read back from anywhere.
  const siteUrl = clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  const inviteUrl = `${siteUrl}/invite#${rawToken}`;

  return { ok: true, data: { inviteUrl } };
}

export async function revokeInviteAction(input: unknown): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR };
  }

  const parsed = revokeInviteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }
  const { inviteId, batchId } = parsed.data;

  const { error } = await supabase.rpc("revoke_invite", { p_invite_id: inviteId });

  if (error !== null) {
    logger.error("invitations.revoke_failed", { userId: userData.user.id, batchId });
    return { ok: false, error: GENERIC_ERROR };
  }

  revalidatePath(`/batches/${batchId}/invite`);
  return { ok: true, data: undefined };
}

/**
 * Validates a token for the invite landing page — callable by a visitor who
 * is not yet signed in (PRD Journey C). Returns the batch name only, after
 * the token validates (security.md §5.4, §9); otherwise one generic,
 * indistinguishable failure.
 */
export async function validateInviteAction(
  input: unknown,
): Promise<ActionResult<{ batchName: string }>> {
  const parsed = validateInviteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: GENERIC_INVITE_ERROR };
  }

  const supabase = await createSupabaseServerClient();
  const ip = await requestIp();
  const tokenHash = hashInviteToken(parsed.data.token);

  const { data, error } = await supabase.rpc("validate_invite", {
    p_token_hash: tokenHash,
    p_ip: ip,
  });

  if (error !== null || data === null) {
    return { ok: false, error: GENERIC_INVITE_ERROR };
  }

  return { ok: true, data: { batchName: data } };
}

export type RedeemInviteResult =
  | { ok: true; data: RedemptionResult }
  | { ok: false; error: string; requiresAuth?: boolean };

/**
 * Redeems a token into a membership (security.md §5.2, §9, §10).
 * Authenticated only — a visitor who is not yet signed in gets
 * `requiresAuth: true` so the client can route them to sign-in/sign-up
 * without spending a rate-limit hit on a call that cannot succeed.
 */
export async function redeemInviteAction(input: unknown): Promise<RedeemInviteResult> {
  const parsed = redeemInviteInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: GENERIC_INVITE_ERROR };
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError !== null || userData.user === null) {
    return { ok: false, error: GENERIC_ERROR, requiresAuth: true };
  }

  const ip = await requestIp();
  const tokenHash = hashInviteToken(parsed.data.token);

  const { data, error } = await supabase.rpc("redeem_invite", {
    p_token_hash: tokenHash,
    p_ip: ip,
  });

  if (error !== null || data === null || data.length === 0) {
    return { ok: false, error: GENERIC_INVITE_ERROR };
  }

  const row = data[0];
  if (row === undefined || (row.status !== "active" && row.status !== "pending")) {
    return { ok: false, error: GENERIC_INVITE_ERROR };
  }

  revalidatePath("/home");
  revalidatePath(`/batches/${row.batch_id}`);

  return {
    ok: true,
    data: { batchId: row.batch_id, batchName: row.batch_name, status: row.status },
  };
}
