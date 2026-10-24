"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { createCommentAction } from "../actions";
import { createCommentInputSchema, type CreateCommentInput } from "../schema";

export function CommentForm({ memoryId }: { memoryId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCommentInput>({
    resolver: zodResolver(createCommentInputSchema),
    defaultValues: { memoryId, body: "" },
  });

  async function onSubmit(values: CreateCommentInput) {
    setError(null);
    const result = await createCommentAction(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    reset({ memoryId, body: "" });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-2">
      <Textarea
        aria-label="Write a comment"
        placeholder="Write a comment…"
        {...register("body")}
      />
      {errors.body !== undefined && (
        <p role="alert" className="text-caption text-danger">
          {errors.body.message}
        </p>
      )}
      {error !== null && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="sm" disabled={isSubmitting} className="self-start">
        {isSubmitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
        Post
      </Button>
    </form>
  );
}
