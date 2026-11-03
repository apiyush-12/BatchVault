import { FileClock } from "lucide-react";

import { BatchFrame } from "@/components/batch/batch-frame";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { NotAvailableState } from "@/components/ui/not-available";
import { PageHeader } from "@/components/ui/page-header";
import { getBatchById } from "@/features/batches/queries";
import { getMyMembership } from "@/features/memberships/queries";
import { canViewAuditLog } from "@/features/moderation/permissions";
import { listAuditLog } from "@/features/moderation/queries";
import { formatTimestamp } from "@/lib/format/date";

export const metadata = { title: "Audit log — BatchVault" };

/** "member_removed" → "Member removed". Display only; the stored action string is untouched. */
function humanizeAction(action: string): string {
  const spaced = action.replace(/[_.-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

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
    <BatchFrame batch={batch} role={membership.role} current="audit-log" action={null}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <PageHeader
          size="md"
          title="Audit log"
          description="A quiet record of the moderation and management actions taken in this batch."
        />

        {entries.length === 0 ? (
          <EmptyState
            icon={FileClock}
            title="No recorded actions yet"
            description="Approvals, role changes, removals and settings changes will appear here as they happen."
          />
        ) : (
          <ol className="relative flex flex-col border-l border-border pl-6">
            {entries.map((entry) => (
              <li key={entry.id} className="relative flex flex-col gap-1 pb-6 last:pb-0">
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 -left-[1.8rem] size-2.5 rounded-full border-2 border-background bg-border-strong"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body-sm font-medium text-foreground">
                    {humanizeAction(entry.action)}
                  </span>
                  {entry.targetKind !== null && <Badge variant="outline">{entry.targetKind}</Badge>}
                </div>
                <p className="text-caption text-foreground-muted">
                  By {entry.actorRole !== null ? `a${/^[aeiou]/i.test(entry.actorRole) ? "n" : ""} ${entry.actorRole}` : "an unknown role"}
                  {" · "}
                  <time dateTime={entry.occurredAt}>{formatTimestamp(entry.occurredAt)}</time>
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </BatchFrame>
  );
}
