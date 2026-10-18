import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { NotAvailableState } from "@/components/ui/not-available";
import { getBatchById } from "@/features/batches/queries";
import { InviteManager } from "@/features/invitations/components/invite-manager";
import { canManageInvites } from "@/features/invitations/permissions";
import { listBatchInvites } from "@/features/invitations/queries";
import { getMyMembership } from "@/features/memberships/queries";

export const metadata = { title: "Invite — BatchVault" };

/**
 * Admin+ invite creation/management (phases.md Phase 3A; security.md §4,
 * §9). The page guard here is Layer 2 convenience only —
 * `create_invite`/`revoke_invite` enforce the same admin+ ceiling
 * database-side regardless (security.md §5.2.2, §11).
 */
export default async function BatchInvitePage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const [batch, membership] = await Promise.all([
    getBatchById(batchId),
    getMyMembership(batchId),
  ]);

  const canManage =
    batch !== null &&
    membership !== null &&
    membership.status === "active" &&
    canManageInvites(membership.role);

  if (!canManage || batch === null) {
    return <NotAvailableState />;
  }

  const invites = await listBatchInvites(batchId);

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-2">
        <Link
          href={`/batches/${batchId}`}
          className="inline-flex items-center gap-1 text-body-sm font-medium text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {batch.name}
        </Link>
        <h1 className="text-heading-lg font-semibold">Invite classmates</h1>
      </header>

      <main id="main">
        <InviteManager batchId={batchId} invites={invites} />
      </main>
    </div>
  );
}
