"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { removeContentAction, resolveReportAction } from "../actions";
import type { Report } from "../types";

/** Mod+ moderation queue (phases.md Phase 8A) — card/list language, not a data table. */
export function ModerationQueue({ batchId, reports }: { batchId: string; reports: Report[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleResolve(reportId: string) {
    setPendingId(reportId);
    await resolveReportAction(batchId, { reportId });
    setPendingId(null);
    router.refresh();
  }

  async function handleRemove(report: Report) {
    if (report.targetKind === "member") {
      return; // member removal already has its own dedicated flow (Phase 3B members page).
    }
    if (!window.confirm(`Remove this ${report.targetKind}? This can be restored by a moderator later.`)) {
      return;
    }
    setPendingId(report.id);
    await removeContentAction(batchId, { targetKind: report.targetKind, targetId: report.targetId });
    await resolveReportAction(batchId, { reportId: report.id, resolutionNote: "Content removed" });
    setPendingId(null);
    router.refresh();
  }

  if (reports.length === 0) {
    return <p className="text-body-sm text-foreground-muted">No open reports.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {reports.map((report) => (
        <li key={report.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-body-sm font-medium text-foreground">
              {report.targetKind} · {report.reason}
            </span>
            <span className="text-caption text-foreground-muted">
              {new Date(report.createdAt).toLocaleDateString()}
            </span>
          </div>
          {report.details !== null && <p className="text-body-sm text-foreground-muted">{report.details}</p>}
          <div className="flex gap-2">
            {report.targetKind !== "member" && (
              <Button
                size="sm"
                variant="danger"
                disabled={pendingId === report.id}
                onClick={() => handleRemove(report)}
              >
                Remove content
              </Button>
            )}
            <Button size="sm" variant="secondary" disabled={pendingId === report.id} onClick={() => handleResolve(report.id)}>
              Dismiss
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
