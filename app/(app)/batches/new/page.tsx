import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CreateBatchForm } from "@/features/batches/components/create-batch-form";

export const metadata = { title: "Create a batch — BatchVault" };

export default function NewBatchPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-2">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-body-sm font-medium text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Home
        </Link>
        <h1 className="text-heading-lg font-semibold">Create your batch</h1>
        <p className="text-body-sm text-foreground-muted">
          You&rsquo;ll become its owner. This space is private by default —
          only classmates you invite can see it.
        </p>
      </header>

      <main id="main">
        <CreateBatchForm />
      </main>
    </div>
  );
}
