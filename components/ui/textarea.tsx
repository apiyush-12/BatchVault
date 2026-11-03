import type { ComponentProps } from "react";

import { fieldClassName } from "@/components/ui/input";
import { cn } from "@/lib/cn";

/** shadcn/ui-style primitive, vendored in-repo (rules.md §1.5). */
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClassName, "min-h-24 resize-y px-3.5 py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
}
