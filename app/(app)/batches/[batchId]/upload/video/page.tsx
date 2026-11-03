import Link from "next/link";
import { ImageIcon } from "lucide-react";

import { BatchFrame } from "@/components/batch/batch-frame";
import { NotAvailableState } from "@/components/ui/not-available";
import { PageHeader } from "@/components/ui/page-header";
import { getBatchById } from "@/features/batches/queries";
import { VideoUploadForm } from "@/features/media/components/video-upload-form";
import { getMyMembership } from "@/features/memberships/queries";

export const metadata = { title: "Add a video — BatchVault" };

/** The short-video upload moment (phases.md Phase 4B). Any active member. */
export default async function UploadVideoPage({
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
          title="Add a short video"
          description="A minute or two is plenty. We'll grab a still from it for the gallery."
          actions={
            <Link
              href={`/batches/${batchId}/upload`}
              className="inline-flex min-h-9 items-center gap-2 rounded-md text-body-sm font-medium text-primary hover:underline"
            >
              <ImageIcon aria-hidden="true" className="size-4" />
              Add a photo instead
            </Link>
          }
        />
        <VideoUploadForm batchId={batchId} />
      </div>
    </BatchFrame>
  );
}
