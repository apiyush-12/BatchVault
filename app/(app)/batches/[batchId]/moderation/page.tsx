import { BatchFrame } from "@/components/batch/batch-frame";
import { NotAvailableState } from "@/components/ui/not-available";
import { PageHeader } from "@/components/ui/page-header";
import { getBatchById } from "@/features/batches/queries";
import { getMyMembership } from "@/features/memberships/queries";
import { ModerationQueue } from "@/features/moderation/components/moderation-queue";
import { canModerate } from "@/features/moderation/permissions";
import { listOpenReports } from "@/features/moderation/queries";

export const metadata = { title: "Moderation — BatchVault" };

/** Mod+-only moderation queue (phases.md Phase 8A). */
export default async function ModerationPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const [batch, membership] = await Promise.all([
    getBatchById(batchId),
    getMyMembership(batchId),
  ]);

  if (
    batch === null ||
    membership === null ||
    membership.status !== "active" ||
    !canModerate(membership.role)
  ) {
    return <NotAvailableState />;
  }

  const reports = await listOpenReports(batchId);

  return (
    <BatchFrame batch={batch} role={membership.role} current="moderation" action={null}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <PageHeader
          size="md"
          title="Moderation queue"
          description={
            reports.length === 0
              ? "Reports from members land here. Nothing needs your attention right now."
              : `${reports.length} open ${reports.length === 1 ? "report" : "reports"} waiting for a decision.`
          }
        />
        <ModerationQueue batchId={batchId} reports={reports} />
      </div>
    </BatchFrame>
  );
}
