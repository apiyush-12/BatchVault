import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { NotAvailableState } from "@/components/ui/not-available";
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
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-2">
        <Link
          href={`/batches/${batchId}/upload`}
          className="inline-flex items-center gap-1 text-body-sm font-medium text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {batch.name}
        </Link>
        <h1 className="text-heading-lg font-semibold">Add a short video</h1>
      </header>

      <main id="main">
        <VideoUploadForm batchId={batchId} />
      </main>
    </div>
  );
}
