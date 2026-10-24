import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { NotAvailableState } from "@/components/ui/not-available";
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
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-5 py-10 sm:px-8">
      <header className="flex flex-col gap-2">
        <Link
          href={`/batches/${batchId}`}
          className="inline-flex items-center gap-1 text-body-sm font-medium text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {batch.name}
        </Link>
        <h1 className="text-heading-lg font-semibold">Moderation queue</h1>
      </header>

      <ModerationQueue batchId={batchId} reports={reports} />
    </div>
  );
}
