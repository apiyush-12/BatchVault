import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { NotAvailableState } from "@/components/ui/not-available";
import { BatchSettingsForm } from "@/features/batches/components/batch-settings-form";
import { DeleteBatchForm } from "@/features/batches/components/delete-batch-form";
import { canDeleteBatch, canEditBatchSettings } from "@/features/batches/permissions";
import { getBatchById } from "@/features/batches/queries";
import { getMyMembership } from "@/features/memberships/queries";

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
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-2">
        <Link
          href={`/batches/${batchId}`}
          className="inline-flex items-center gap-1 text-body-sm font-medium text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {batch.name}
        </Link>
        <h1 className="text-heading-lg font-semibold">Batch settings</h1>
      </header>

      <main id="main" className="flex flex-col gap-10">
        <BatchSettingsForm batch={batch} />
        {canDeleteBatch(membership.role) && (
          <DeleteBatchForm batchId={batch.id} batchName={batch.name} />
        )}
      </main>
    </div>
  );
}
