import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { NotAvailableState } from "@/components/ui/not-available";
import { getBatchById } from "@/features/batches/queries";
import { EditMemoryForm } from "@/features/memories/components/edit-memory-form";
import { getMemoryById } from "@/features/memories/queries";
import { canEditMemory } from "@/features/memories/permissions";
import { getMyMembership } from "@/features/memberships/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();

  const [batch, membership, memory] = await Promise.all([
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
    userData.user === null ||
    !canEditMemory(memory.createdBy, userData.user.id)
  ) {
    return <NotAvailableState />;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-2">
        <Link
          href={`/batches/${batchId}/memories`}
          className="inline-flex items-center gap-1 text-body-sm font-medium text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {batch.name}
        </Link>
        <h1 className="text-heading-lg font-semibold">Edit memory</h1>
      </header>

      <main id="main">
        <EditMemoryForm batchId={batchId} memory={memory} />
      </main>
    </div>
  );
}
