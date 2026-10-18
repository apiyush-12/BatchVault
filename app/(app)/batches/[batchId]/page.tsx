import Link from "next/link";
import { ArrowLeft, Settings, UserPlus, Users } from "lucide-react";

import { NotAvailableState } from "@/components/ui/not-available";
import { getBatchById } from "@/features/batches/queries";
import { canEditBatchSettings } from "@/features/batches/permissions";
import { canManageInvites } from "@/features/invitations/permissions";
import { getMyMembership } from "@/features/memberships/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const batch = await getBatchById(batchId);
  return { title: batch !== null ? `${batch.name} — BatchVault` : "BatchVault" };
}

/** Batch home/identity (phases.md Phase 2). */
export default async function BatchHomePage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const [batch, membership] = await Promise.all([
    getBatchById(batchId),
    getMyMembership(batchId),
  ]);

  // Deliberately the same generic state whether the batch does not exist or
  // the caller cannot see it (security.md §3, "indistinguishable denial").
  if (batch === null || membership === null || membership.status !== "active") {
    return <NotAvailableState />;
  }

  const canEditSettings = canEditBatchSettings(membership.role);
  const canInvite = canManageInvites(membership.role);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-2">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-body-sm font-medium text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          All batches
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-heading-lg font-semibold">{batch.name}</h1>
            <p className="text-body-sm text-foreground-muted">
              {batch.institutionName}
              {batch.courseName !== null ? ` · ${batch.courseName}` : ""}
              {batch.graduationYear !== null ? ` · ${batch.graduationYear}` : ""}
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-caption font-medium text-foreground-muted">
            🔒 Private
          </span>
        </div>
      </header>

      {batch.description !== null && (
        <p className="max-w-prose text-body text-foreground-muted">
          {batch.description}
        </p>
      )}

      <nav className="flex flex-col gap-3">
        <Link
          href={`/batches/${batch.id}/members`}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-sunken"
        >
          <Users aria-hidden="true" className="size-5 text-primary" />
          <span className="text-body font-medium text-foreground">Members</span>
        </Link>

        {canInvite && (
          <Link
            href={`/batches/${batch.id}/invite`}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-sunken"
          >
            <UserPlus aria-hidden="true" className="size-5 text-primary" />
            <span className="text-body font-medium text-foreground">Invite classmates</span>
          </Link>
        )}

        {canEditSettings && (
          <Link
            href={`/batches/${batch.id}/settings`}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:bg-surface-sunken"
          >
            <Settings aria-hidden="true" className="size-5 text-primary" />
            <span className="text-body font-medium text-foreground">Batch settings</span>
          </Link>
        )}
      </nav>

      <p className="text-body text-foreground-muted">
        Memories, invites, and everything else arrive in the next phases.
      </p>
    </div>
  );
}
