import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { NotAvailableState } from "@/components/ui/not-available";
import { getBatchById } from "@/features/batches/queries";
import { MemberRowActions } from "@/features/memberships/components/member-row-actions";
import { getMyMembership, listBatchMembers } from "@/features/memberships/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const supabase = await createSupabaseServerClient();
  const [batch, membership, userResult] = await Promise.all([
    getBatchById(batchId),
    getMyMembership(batchId),
    supabase.auth.getUser(),
  ]);

  if (batch === null || membership === null || membership.status !== "active") {
    return <NotAvailableState />;
  }

  const rawCallerProfileId = userResult.data.user?.id;
  if (rawCallerProfileId === undefined) {
    return <NotAvailableState />;
  }

  // Rebound to plain, non-nullable locals: TypeScript's narrowing above
  // does not cross the nested `MemberCard` function's closure boundary.
  const callerRole = membership.role;
  const callerProfileId: string = rawCallerProfileId;

  const members = await listBatchMembers(batchId);
  const pending = members.filter((member) => member.status === "pending");
  const active = members.filter((member) => member.status === "active");

  function MemberCard({ member }: { member: (typeof members)[number] }) {
    return (
      <li className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
        {member.avatarUrl !== null ? (
          <Image
            src={member.avatarUrl}
            alt=""
            width={40}
            height={40}
            className="size-10 rounded-full object-cover"
            unoptimized
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-full bg-surface-sunken text-body-sm font-semibold text-foreground-muted"
          >
            {(member.displayName ?? "?").charAt(0).toUpperCase()}
          </span>
        )}
        <div className="flex flex-1 flex-col">
          <span className="text-body font-medium text-foreground">
            {member.displayName ?? "Former member"}
          </span>
          <span className="text-caption text-foreground-muted">{member.role}</span>
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
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-2">
        <Link
          href={`/batches/${batchId}`}
          className="inline-flex items-center gap-1 text-body-sm font-medium text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {batch.name}
        </Link>
        <h1 className="text-heading-lg font-semibold">Members</h1>
      </header>

      {pending.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-heading-sm font-semibold">Waiting for approval</h2>
          <ul className="flex flex-col gap-3">
            {pending.map((member) => (
              <MemberCard key={member.profileId} member={member} />
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        {pending.length > 0 && <h2 className="text-heading-sm font-semibold">Members</h2>}
        <ul className="flex flex-col gap-3">
          {active.map((member) => (
            <MemberCard key={member.profileId} member={member} />
          ))}
        </ul>
      </section>
    </div>
  );
}
