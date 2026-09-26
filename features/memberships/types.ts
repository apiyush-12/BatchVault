import type { BatchRole } from "@/lib/authz/roles";

export type MembershipStatus = "pending" | "active" | "rejected" | "removed" | "left";

/** One roster row: a member's own status/role plus their profile display info. */
export interface RosterMember {
  profileId: string;
  role: BatchRole;
  status: MembershipStatus;
  joinedAt: string | null;
  requestedAt: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface MyMembership {
  batchId: string;
  role: BatchRole;
  status: MembershipStatus;
}
