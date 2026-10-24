import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { NotAvailableState } from "@/components/ui/not-available";
import { getBatchById } from "@/features/batches/queries";
import { getMyMembership } from "@/features/memberships/queries";
import { canViewAuditLog } from "@/features/moderation/permissions";
import { listAuditLog } from "@/features/moderation/queries";

export const metadata = { title: "Audit log — BatchVault" };

/** Admin+-only audit log view (phases.md Phase 8A; database.md §3.10). */
export default async function AuditLogPage({
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
    !canViewAuditLog(membership.role)
  ) {
    return <NotAvailableState />;
  }

  const entries = await listAuditLog(batchId);

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
        <h1 className="text-heading-lg font-semibold">Audit log</h1>
      </header>

      {entries.length === 0 ? (
        <p className="text-body-sm text-foreground-muted">No recorded actions yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-border bg-surface p-3 text-body-sm">
              <span className="font-medium text-foreground">{entry.action}</span>{" "}
              <span className="text-foreground-muted">
                {entry.targetKind !== null ? `· ${entry.targetKind}` : ""} · {entry.actorRole ?? "unknown role"} ·{" "}
                {new Date(entry.occurredAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
