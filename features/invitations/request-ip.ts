import "server-only";

import { headers } from "next/headers";

/**
 * Best-effort caller IP for the invite-redemption rate limit (security.md
 * §17: "Invite redemption | ... | IP and account"). This is a Layer-2
 * throttling signal, not an identity — `x-forwarded-for` is attacker-
 * influenceable off of Vercel's trusted edge, which is an accepted,
 * documented limitation of IP-based rate limiting generally, not something
 * this function can fix. The account dimension (profile id, checked
 * server-side from the verified session) is the half of the limit that
 * cannot be forged.
 */
export async function requestIp(): Promise<string | null> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor !== null && forwardedFor.trim() !== "") {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }
  const realIp = headerList.get("x-real-ip");
  return realIp !== null && realIp.trim() !== "" ? realIp.trim() : null;
}
