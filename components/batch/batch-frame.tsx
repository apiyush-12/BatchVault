import Link from "next/link";
import { ChevronLeft, Lock, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { BatchNav, type BatchNavPermissions, type BatchSection } from "@/components/batch/batch-nav";
import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canEditBatchSettings } from "@/features/batches/permissions";
import type { Batch } from "@/features/batches/types";
import { canManageInvites } from "@/features/invitations/permissions";
import { canModerate, canViewAuditLog } from "@/features/moderation/permissions";
import type { BatchRole } from "@/lib/authz/roles";
import { cn } from "@/lib/cn";

/** Derives the tab visibility flags from the caller's role — convenience only (security.md §11). */
export function batchNavPermissions(role: BatchRole): BatchNavPermissions {
  return {
    canInvite: canManageInvites(role),
    canModerate: canModerate(role),
    canViewAuditLog: canViewAuditLog(role),
    canEditSettings: canEditBatchSettings(role),
  };
}

export function batchMetaLine(batch: Batch): string {
  return [batch.institutionName, batch.courseName, batch.graduationYear]
    .filter((part): part is string | number => part !== null && part !== "")
    .join(" · ");
}

/**
 * The batch's private room (design.md §3.5, §15): identity header that stays
 * compact, a tab strip for its sections, then the page. Pages pass the batch
 * and membership they already fetched — this component performs no data
 * access and no authorization of its own.
 *
 * `headingLevel="h1"` only on the batch overview, so every other page keeps
 * exactly one h1 for its own title.
 */
export function BatchFrame({
  batch,
  role,
  current,
  children,
  headingLevel = "p",
  showNav = true,
  action,
}: {
  batch: Batch;
  role: BatchRole;
  current: BatchSection;
  children: ReactNode;
  headingLevel?: "h1" | "p";
  showNav?: boolean;
  /** Replace the default "Add memory" action; pass `null` to hide it. */
  action?: ReactNode | null;
}) {
  const Heading = headingLevel;
  const permissions = batchNavPermissions(role);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <header className="flex flex-col gap-4">
        <Link
          href="/home"
          className="inline-flex min-h-8 w-fit items-center gap-1 text-caption font-medium text-foreground-muted transition-colors hover:text-foreground lg:hidden"
        >
          <ChevronLeft aria-hidden="true" className="size-3.5" />
          All batches
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Heading
                className={cn(
                  "font-display truncate text-foreground",
                  headingLevel === "h1" ? "text-heading-lg sm:text-display-sm" : "text-heading-md sm:text-heading-lg",
                )}
              >
                {batch.name}
              </Heading>
              <Badge variant="outline" className="gap-1">
                <Lock aria-hidden="true" />
                Private
              </Badge>
            </div>
            <p className="truncate text-body-sm text-foreground-muted">{batchMetaLine(batch)}</p>
          </div>

          {action !== null && (
            <div className="flex items-center gap-2">
              {action ?? (
                <Button asChild size="sm">
                  <Link href={`/batches/${batch.id}/upload`}>
                    <Plus aria-hidden="true" className="size-4" />
                    Add memory
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>

        {showNav && <BatchNav batchId={batch.id} permissions={permissions} current={current} />}
      </header>

      <FadeIn className="flex flex-1 flex-col gap-8 pb-10">{children}</FadeIn>
    </div>
  );
}
