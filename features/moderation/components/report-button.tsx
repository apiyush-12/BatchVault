"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { createReportAction } from "../actions";
import { REPORT_REASONS, type ReportReason, type ReportTargetKind } from "../types";

const REASON_LABEL: Record<ReportReason, string> = {
  harassment: "Harassment",
  inappropriate: "Inappropriate content",
  privacy: "Privacy concern",
  spam: "Spam",
  other: "Something else",
};

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
    return (
      <p role="status" className="text-caption text-foreground-muted">
        Thanks — this has been reported to the moderators.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-caption text-foreground-muted transition-colors hover:text-foreground"
      >
        <Flag aria-hidden="true" className="size-3.5" />
        Report
      </button>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-3 rounded-xl border border-border bg-surface-sunken/70 p-4"
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
      <p className="text-body-sm font-medium text-foreground">Report this {targetKind}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`report-reason-${targetId}`}>Reason</Label>
        <Select
          id={`report-reason-${targetId}`}
          value={reason}
          onChange={(event) => setReason(event.target.value as ReportReason)}
        >
          {REPORT_REASONS.map((value) => (
            <option key={value} value={value}>
              {REASON_LABEL[value]}
            </option>
          ))}
        </Select>
      </div>
      <Textarea
        aria-label="Details for moderators"
        placeholder="Anything else moderators should know? (optional)"
        className="min-h-20"
        value={details}
        onChange={(event) => setDetails(event.target.value)}
      />
      {status === "error" && (
        <p role="alert" className="text-caption font-medium text-danger">
          Something went wrong. Please try again.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={status === "sending"}>
          Submit report
        </Button>
      </div>
    </form>
  );
}
