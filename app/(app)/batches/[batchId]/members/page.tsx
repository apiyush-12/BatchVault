import Link from "next/link";
import { Clock, UserPlus } from "lucide-react";

import { BatchFrame } from "@/components/batch/batch-frame";
import { Avatar } from "@/components/ui/avatar";
import { Badge, RoleBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotAvailableState } from "@/components/ui/not-available";
import { PageHeader } from "@/components/ui/page-header";
import { getBatchById } from "@/features/batches/queries";
import { canManageInvites } from "@/features/invitations/permissions";
import { MemberRowActions } from "@/features/memberships/components/member-row-actions";
import { getMyMembership, listBatchMembers } from "@/features/memberships/queries";
import { getVerifiedUser } from "@/lib/auth/session";
import { formatTimestampDate } from "@/lib/format/date";
import { isUuid } from "@/lib/validation/ids";

export const metadata = { title: "Members — BatchVault" };

/**
 * Member list with pending-approval queue (phases.md Phase 3B). Not a data
 * table — a card/list surface (design.md §15, §24). Row-level action
 * visibility here is Layer 2 convenience; each RPC enforces the same
 * ceiling database-side regardless (security.md §4, §11).
 */
export default async function BatchMembersPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  if (!isUuid(batchId)) {
    return <NotAvailableState />;
  }
  // The roster is RLS-scoped (a non-member sees nothing, a pending requester
  // only their own row), so it is fetched alongside the guard queries.
  const [batch, membership, user, members] = await Promise.all([
    getBatchById(batchId),
    getMyMembership(batchId),
    getVerifiedUser(),
    listBatchMembers(batchId),
  ]);

  if (batch === null || membership === null || membership.status !== "active") {
    return <NotAvailableState />;
  }

  const rawCallerProfileId = user?.id;
  if (rawCallerProfileId === undefined) {
    return <NotAvailableState />;
  }

  // Rebound to plain, non-nullable locals: TypeScript's narrowing above
  // does not cross the nested `MemberCard` function's closure boundary.
  const callerRole = membership.role;
  const callerProfileId: string = rawCallerProfileId;
  const canInvite = canManageInvites(callerRole);

  const pending = members.filter((member) => member.status === "pending");
  const active = members.filter((member) => member.status === "active");

  /**
   * Structure note: name → details column → row. Kept deliberately shallow;
   * the row is the unit other code (and tests) reason about.
   */
  function MemberCard({ member, tone }: { member: (typeof members)[number]; tone: "active" | "pending" }) {
    const isSelf = member.profileId === callerProfileId;
    return (
      <li
        className={
          tone === "pending"
            ? "flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning-soft/40 p-3 sm:p-4"
            : "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-raised sm:p-4"
        }
      >
        <Avatar src={member.avatarUrl} name={member.displayName} size="md" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 text-body font-medium text-foreground">
            {member.displayName ?? "Former member"}
            {isSelf && <Badge variant="outline">You</Badge>}
          </span>
          <span className="flex flex-wrap items-center gap-2 text-caption text-foreground-muted">
            <RoleBadge role={member.role} />
            {tone === "pending" ? (
              <span className="inline-flex items-center gap-1">
                <Clock aria-hidden="true" className="size-3.5" />
                Requested {formatTimestampDate(member.requestedAt)}
              </span>
            ) : member.joinedAt !== null ? (
              <span>Joined {formatTimestampDate(member.joinedAt)}</span>
            ) : null}
          </span>
        </div>
        <MemberRowActions
          batchId={batchId}
          member={member}
          callerRole={callerRole}
          callerProfileId={callerProfileId}
        />
      </li>
    );
  }

  return (
    <BatchFrame
      batch={batch}
      role={callerRole}
      current="members"
      action={
        canInvite ? (
          <Button asChild size="sm">
            <Link href={`/batches/${batchId}/invite`}>
              <UserPlus aria-hidden="true" className="size-4" />
              Invite classmates
            </Link>
          </Button>
        ) : null
      }
    >
      <PageHeader
        size="md"
        title="Members"
        description={
          active.length === 1
            ? "It's just you for now. Invite classmates and this space fills up."
            : `${active.length} classmates share this space.`
        }
      />

      {pending.length > 0 && (
        <section aria-labelledby="pending-heading" className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 id="pending-heading" className="text-heading-sm font-semibold">
              Waiting for approval
            </h2>
            <Badge variant="warning">{pending.length}</Badge>
          </div>
          <ul className="flex flex-col gap-3">
            {pending.map((member) => (
              <MemberCard key={member.profileId} member={member} tone="pending" />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="members-heading" className="flex flex-col gap-3">
        <h2 id="members-heading" className={pending.length > 0 ? "text-heading-sm font-semibold" : "sr-only"}>
          Members
        </h2>
        <ul className="flex flex-col gap-3">
          {active.map((member) => (
            <MemberCard key={member.profileId} member={member} tone="active" />
          ))}
        </ul>
      </section>
    </BatchFrame>
  );
}
