"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { createReportAction } from "../actions";
import { REPORT_REASONS, type ReportReason, type ReportTargetKind } from "../types";

/**
 * Deliberately quiet for ordinary members (security.md §18) — a plain
 * disclosure link, not a prominent action; no modal primitive exists in
 * this repo yet (same simplification earlier phases recorded).
 */
export function ReportButton({ targetKind, targetId }: { targetKind: ReportTargetKind; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("other");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (status === "sent") {
    return <p className="text-caption text-foreground-muted">Thanks — this has been reported to the moderators.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-caption text-foreground-muted underline hover:text-foreground"
      >
        Report
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-lg border border-border bg-surface-sunken p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setStatus("sending");
        const result = await createReportAction({
          targetKind,
          targetId,
          reason,
          details: details.trim() === "" ? undefined : details.trim(),
        });
        setStatus(result.ok ? "sent" : "error");
      }}
    >
      <Select value={reason} onChange={(event) => setReason(event.target.value as ReportReason)} aria-label="Reason">
        {REPORT_REASONS.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </Select>
      <Textarea
        placeholder="Anything else moderators should know? (optional)"
        value={details}
        onChange={(event) => setDetails(event.target.value)}
      />
      {status === "error" && (
        <p role="alert" className="text-caption text-danger">
          Something went wrong. Please try again.
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={status === "sending"}>
          Submit report
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
