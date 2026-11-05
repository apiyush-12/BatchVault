import { BatchFrame } from "@/components/batch/batch-frame";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NotAvailableState } from "@/components/ui/not-available";
import { PageHeader } from "@/components/ui/page-header";
import { BatchSettingsForm } from "@/features/batches/components/batch-settings-form";
import { DeleteBatchForm } from "@/features/batches/components/delete-batch-form";
import { canDeleteBatch, canEditBatchSettings } from "@/features/batches/permissions";
import { getBatchById } from "@/features/batches/queries";
import { getMyMembership } from "@/features/memberships/queries";
import { isUuid } from "@/lib/validation/ids";

export const metadata = { title: "Batch settings — BatchVault" };

/**
 * Admin+ batch settings (phases.md Phase 2; security.md §4, §11). The page
 * guard here is Layer 2 convenience only — `update_batch_settings` enforces
 * the same ceiling database-side regardless of what this page shows
 * (security.md §5.2.2, §11).
 */
export default async function BatchSettingsPage({
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

  const canEdit =
    batch !== null &&
    membership !== null &&
    membership.status === "active" &&
    canEditBatchSettings(membership.role);

  if (!canEdit || batch === null) {
    return <NotAvailableState />;
  }

  return (
    <BatchFrame batch={batch} role={membership.role} current="settings" action={null}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <PageHeader
          size="md"
          title="Batch settings"
          description="How this batch presents itself, and who can join it."
        />

        <Card>
          <CardHeader>
            <CardTitle>Identity and joining</CardTitle>
            <CardDescription>Changes apply for everyone the moment you save.</CardDescription>
          </CardHeader>
          <CardContent>
            <BatchSettingsForm batch={batch} />
          </CardContent>
        </Card>

        {canDeleteBatch(membership.role) && (
          <DeleteBatchForm batchId={batch.id} batchName={batch.name} />
        )}
      </div>
    </BatchFrame>
  );
}
