import Link from "next/link";
import { ArrowRight, Clock, Images, Plus, UserPlus, Users } from "lucide-react";

import { BatchFrame } from "@/components/batch/batch-frame";
import { MemoryCard } from "@/components/memory/memory-card";
import { MemoryGrid } from "@/components/memory/memory-grid";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { NotAvailableState } from "@/components/ui/not-available";
import { getBatchById } from "@/features/batches/queries";
import { canManageInvites } from "@/features/invitations/permissions";
import { listGalleryPage } from "@/features/memories/queries";
import { getMyMembership, listBatchMembers } from "@/features/memberships/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const batch = await getBatchById(batchId);
  return { title: batch !== null ? `${batch.name} — BatchVault` : "BatchVault" };
}

const PREVIEW_COUNT = 8;

/**
 * Batch home/identity (phases.md Phase 2): the room you walk into. The most
 * recent memories (the gallery's first page, nothing extra), who's here, and
 * the way deeper. All data comes from the same RLS-scoped queries the
 * section pages already use.
 */
export default async function BatchHomePage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const [batch, membership] = await Promise.all([
    getBatchById(batchId),
    getMyMembership(batchId),
  ]);

  // Deliberately the same generic state whether the batch does not exist or
  // the caller cannot see it (security.md §3, "indistinguishable denial").
  if (batch === null || membership === null || membership.status !== "active") {
    return <NotAvailableState />;
  }

  const [{ memories, nextCursor }, members] = await Promise.all([
    listGalleryPage(batchId, null, PREVIEW_COUNT),
    listBatchMembers(batchId),
  ]);

  const activeMembers = members.filter((member) => member.status === "active");
  const pendingCount = members.filter((member) => member.status === "pending").length;
  const canInvite = canManageInvites(membership.role);
  const hasMore = nextCursor !== null;

  return (
    <BatchFrame batch={batch} role={membership.role} current="overview" headingLevel="h1">
      {batch.description !== null && (
        <p className="max-w-prose text-body text-foreground-muted">{batch.description}</p>
      )}

      <section aria-labelledby="recent-memories-heading" className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-4">
          <h2 id="recent-memories-heading" className="font-display text-heading-sm text-foreground">
            {memories.length === 0 ? "Your gallery" : "Latest in the gallery"}
          </h2>
          {memories.length > 0 && (
            <Link
              href={`/batches/${batchId}/memories`}
              className="inline-flex min-h-9 items-center gap-1 text-body-sm font-medium text-primary hover:underline"
            >
              {hasMore ? "See everything" : "Open the gallery"}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          )}
        </div>

        {memories.length === 0 ? (
          <EmptyState
            icon={Images}
            title="No memories yet"
            description="This is where your batch's photos and videos will live. Add the first one — a hostel corridor, a fest night, the last day."
            action={
              <Button asChild>
                <Link href={`/batches/${batchId}/upload`}>
                  <Plus aria-hidden="true" className="size-4" />
                  Add the first memory
                </Link>
              </Button>
            }
          />
        ) : (
          <MemoryGrid>
            {memories.map((memory) => (
              <li key={memory.id}>
                <MemoryCard memory={memory} batchId={batchId} />
              </li>
            ))}
          </MemoryGrid>
        )}
      </section>

      <section aria-labelledby="people-heading" className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 id="people-heading" className="flex items-center gap-2 text-heading-sm font-semibold">
                <Users aria-hidden="true" className="size-5 text-primary" />
                People
              </h2>
              <Link
                href={`/batches/${batchId}/members`}
                className="text-body-sm font-medium text-primary hover:underline"
              >
                Everyone
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {activeMembers.slice(0, 6).map((member) => (
                  <Avatar
                    key={member.profileId}
                    src={member.avatarUrl}
                    name={member.displayName}
                    size="md"
                    className="ring-2 ring-surface"
                  />
                ))}
              </div>
              <p className="text-body-sm text-foreground-muted">
                {activeMembers.length === 1
                  ? "Just you so far"
                  : `${activeMembers.length} classmates here`}
                {pendingCount > 0 && canInvite
                  ? ` · ${pendingCount} waiting for approval`
                  : ""}
              </p>
            </div>
            {canInvite && (
              <Button asChild variant="soft" size="sm" className="self-start">
                <Link href={`/batches/${batchId}/invite`}>
                  <UserPlus aria-hidden="true" className="size-4" />
                  Invite classmates
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2 text-heading-sm font-semibold">
              <Clock aria-hidden="true" className="size-5 text-primary" />
              Through the years
            </h2>
            <p className="text-body-sm text-foreground-muted">
              Walk the batch&rsquo;s story in order — first days to farewell — grouped by year.
            </p>
            <Button asChild variant="secondary" size="sm" className="self-start">
              <Link href={`/batches/${batchId}/timeline`}>
                Open the timeline
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </BatchFrame>
  );
}
