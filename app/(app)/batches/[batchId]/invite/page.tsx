import { BatchFrame } from "@/components/batch/batch-frame";
import { NotAvailableState } from "@/components/ui/not-available";
import { PageHeader } from "@/components/ui/page-header";
import { getBatchById } from "@/features/batches/queries";
import { InviteManager } from "@/features/invitations/components/invite-manager";
import { canManageInvites } from "@/features/invitations/permissions";
import { listBatchInvites } from "@/features/invitations/queries";
import { getMyMembership } from "@/features/memberships/queries";
import { isUuid } from "@/lib/validation/ids";

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
  if (!isUuid(batchId)) {
    return <NotAvailableState />;
  }
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
    <BatchFrame batch={batch} role={membership.role} current="invite" action={null}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <PageHeader
          size="md"
          title="Invite classmates"
          description={
            batch.joinPolicy === "invite_only_requires_approval"
              ? "Share a link. Anyone who opens it can ask to join, and you approve each request."
              : "Share a link. Anyone who opens it joins straight away."
          }
        />
        <InviteManager batchId={batchId} invites={invites} />
      </div>
    </BatchFrame>
  );
}
