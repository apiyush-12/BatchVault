import { Lock } from "lucide-react";

import { FadeIn } from "@/components/motion/fade-in";
import { BackLink } from "@/components/ui/back-link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { CreateBatchForm } from "@/features/batches/components/create-batch-form";

export const metadata = { title: "Create a batch — BatchVault" };

export default function NewBatchPage() {
  return (
    <FadeIn className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 pb-10">
      <PageHeader
        eyebrow={<BackLink href="/home">Home</BackLink>}
        title="Create your batch"
        description="You'll become its owner. Give it the name your classmates would recognise."
      />

      <Card>
        <CardContent className="flex flex-col gap-6">
          <p className="flex items-start gap-2.5 rounded-lg bg-primary-soft/70 px-3.5 py-3 text-body-sm text-foreground">
            <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              Private by default. Nothing here is public — only classmates you invite can see it.
            </span>
          </p>
          <CreateBatchForm />
        </CardContent>
      </Card>
    </FadeIn>
  );
}
