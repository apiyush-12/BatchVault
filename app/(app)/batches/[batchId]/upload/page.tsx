import Link from "next/link";
import { Video } from "lucide-react";

import { BatchFrame } from "@/components/batch/batch-frame";
import { NotAvailableState } from "@/components/ui/not-available";
import { PageHeader } from "@/components/ui/page-header";
import { getBatchById } from "@/features/batches/queries";
import { PhotoUploadForm } from "@/features/media/components/photo-upload-form";
import { getMyMembership } from "@/features/memberships/queries";

export const metadata = { title: "Add a memory — BatchVault" };

/** The upload moment (phases.md Phase 4A; architecture §8). Any active member. */
export default async function UploadPhotoPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const [batch, membership] = await Promise.all([
    getBatchById(batchId),
    getMyMembership(batchId),
  ]);

  if (batch === null || membership === null || membership.status !== "active") {
    return <NotAvailableState />;
  }

  return (
    <BatchFrame batch={batch} role={membership.role} current="upload" action={null}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <PageHeader
          size="md"
          title="Add a memory"
          description="One photo, with the story around it. It's kept exactly as you took it."
          actions={
            <Link
              href={`/batches/${batchId}/upload/video`}
              className="inline-flex min-h-9 items-center gap-2 rounded-md text-body-sm font-medium text-primary hover:underline"
            >
              <Video aria-hidden="true" className="size-4" />
              Add a short video instead
            </Link>
          }
        />
        <PhotoUploadForm batchId={batchId} />
      </div>
    </BatchFrame>
  );
}
