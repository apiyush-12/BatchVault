import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { NotAvailableState } from "@/components/ui/not-available";
import { getBatchById } from "@/features/batches/queries";
import { getMyMembership, listBatchMembers } from "@/features/memberships/queries";

export const metadata = { title: "Members — BatchVault" };

/** Member list basics (phases.md Phase 2). Not a data table — a card/list surface (design.md §24). */
export default async function BatchMembersPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const [batch, membership] = await Promise.all([
    getBatchById(batchId),
    getMyMembership(batchId),
  ]);

  if (batch === null || membership === null || membership.status !== "active") {
    return <NotAvailableState />;
  }

  const members = await listBatchMembers(batchId);

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

      <ul className="flex flex-col gap-3">
        {members.map((member) => (
          <li
            key={member.profileId}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
          >
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
          </li>
        ))}
      </ul>
    </div>
  );
}
