"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Flag, Loader2, ShieldCheck, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTimestamp } from "@/lib/format/date";

import { removeContentAction, resolveReportAction } from "../actions";
import type { Report, ReportReason, ReportTargetKind } from "../types";

const REASON_LABEL: Record<ReportReason, string> = {
  harassment: "Harassment",
  inappropriate: "Inappropriate content",
  privacy: "Privacy concern",
  spam: "Spam",
  other: "Other",
};

const TARGET_LABEL: Record<ReportTargetKind, string> = {
  memory: "Memory",
  comment: "Comment",
  member: "Member",
};

/** Mod+ moderation queue (phases.md Phase 8A) — card/list language, not a data table. */
export function ModerationQueue({ batchId, reports }: { batchId: string; reports: Report[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ reportId: string; message: string } | null>(null);

  async function handleResolve(reportId: string) {
    setFailed(null);
    setPendingId(reportId);
    const result = await resolveReportAction(batchId, { reportId });
    setPendingId(null);
    if (!result.ok) {
      setFailed({ reportId, message: result.error });
      return;
    }
    router.refresh();
  }

  async function handleRemove(report: Report) {
    if (report.targetKind === "member") {
      return; // member removal already has its own dedicated flow (Phase 3B members page).
    }
    if (!window.confirm(`Remove this ${report.targetKind}? This can be restored by a moderator later.`)) {
      return;
    }
    setFailed(null);
    setPendingId(report.id);
    const removed = await removeContentAction(batchId, { targetKind: report.targetKind, targetId: report.targetId });
    // Never close the report as "Content removed" when the removal itself failed.
    const result = removed.ok
      ? await resolveReportAction(batchId, { reportId: report.id, resolutionNote: "Content removed" })
      : removed;
    setPendingId(null);
    if (!result.ok) {
      setFailed({ reportId: report.id, message: result.error });
    }
    router.refresh();
  }

  if (reports.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No open reports"
        description="When a member reports a memory or comment, it shows up here for a quiet, deliberate decision."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {reports.map((report) => {
        const busy = pendingId === report.id;
        return (
          <li
            key={report.id}
            className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-raised sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="warning">
                    <Flag aria-hidden="true" />
                    {REASON_LABEL[report.reason]}
                  </Badge>
                  <Badge variant="outline">{TARGET_LABEL[report.targetKind]}</Badge>
                </div>
                <p className="text-caption text-foreground-muted">
                  Reported {formatTimestamp(report.createdAt)}
                </p>
              </div>
            </div>

            {report.details !== null && (
              <p className="rounded-md bg-surface-sunken px-3 py-2.5 text-body-sm whitespace-pre-wrap text-foreground">
                {report.details}
              </p>
            )}

            {report.targetKind === "member" && (
              <p className="text-caption text-foreground-muted">
                Member reports are handled from the Members page, where removal has its own confirmation.
              </p>
            )}

            {failed?.reportId === report.id && (
              <p role="alert" className="text-caption font-medium text-danger">
                {failed.message}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleResolve(report.id)}>
                {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}
                Dismiss
              </Button>
              {report.targetKind !== "member" && (
                <Button size="sm" variant="danger-outline" disabled={busy} onClick={() => handleRemove(report)}>
                  <Trash2 aria-hidden="true" className="size-4" />
                  Remove content
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
