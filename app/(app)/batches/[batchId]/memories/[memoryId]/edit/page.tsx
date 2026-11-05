import { FadeIn } from "@/components/motion/fade-in";
import { BackLink } from "@/components/ui/back-link";
import { Card, CardContent } from "@/components/ui/card";
import { NotAvailableState } from "@/components/ui/not-available";
import { PageHeader } from "@/components/ui/page-header";
import { getBatchById } from "@/features/batches/queries";
import { EditMemoryForm } from "@/features/memories/components/edit-memory-form";
import { getMemoryById } from "@/features/memories/queries";
import { canEditMemory } from "@/features/memories/permissions";
import { getMyMembership } from "@/features/memberships/queries";
import { getVerifiedUser } from "@/lib/auth/session";

export const metadata = { title: "Edit memory — BatchVault" };

/**
 * Author edit (phases.md Phase 4B; PRD #7, resolved 2026-10-24). The same
 * indistinguishable-denial posture as every other page in this app
 * (security.md §3): a non-author, a non-member, and a memory that does not
 * exist all render the identical not-available state.
 */
export default async function EditMemoryPage({
  params,
}: {
  params: Promise<{ batchId: string; memoryId: string }>;
}) {
  const { batchId, memoryId } = await params;

  const [user, batch, membership, memory] = await Promise.all([
    getVerifiedUser(),
    getBatchById(batchId),
    getMyMembership(batchId),
    getMemoryById(memoryId),
  ]);

  if (
    batch === null ||
    membership === null ||
    membership.status !== "active" ||
    memory === null ||
    memory.batchId !== batchId ||
    user === null ||
    !canEditMemory(memory.createdBy, user.id)
  ) {
    return <NotAvailableState />;
  }

  return (
    <FadeIn className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 pb-10">
      <PageHeader
        eyebrow={<BackLink href={`/batches/${batchId}/memories/${memoryId}`}>Back to the memory</BackLink>}
        title="Edit memory"
        description="Change the caption, event or date. The photo or video itself stays exactly as it was."
      />
      <Card>
        <CardContent>
          <EditMemoryForm batchId={batchId} memory={memory} />
        </CardContent>
      </Card>
    </FadeIn>
  );
}
