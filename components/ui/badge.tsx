import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import type { BatchRole } from "@/lib/authz/roles";
import { cn } from "@/lib/cn";

/**
 * Small, quiet labels — roles, statuses, privacy. Soft tints rather than
 * saturated fills so they never compete with photography (design.md §4).
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-caption font-medium whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        neutral: "border-border bg-surface-sunken text-foreground-muted",
        outline: "border-border bg-transparent text-foreground-muted",
        primary: "border-transparent bg-primary-soft text-primary",
        accent: "border-transparent bg-accent-soft text-accent",
        success: "border-transparent bg-success-soft text-success",
        warning: "border-transparent bg-warning-soft text-warning",
        danger: "border-transparent bg-danger-soft text-danger",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

const ROLE_VARIANT: Record<BatchRole, BadgeProps["variant"]> = {
  owner: "primary",
  admin: "accent",
  moderator: "success",
  member: "neutral",
};

/**
 * A member's role. The text is the raw role string (lowercase) so copy and
 * tests that look for "owner"/"moderator"/"member" keep matching; the
 * capitalisation is purely visual.
 */
export function RoleBadge({ role, className }: { role: BatchRole; className?: string }) {
  return (
    <Badge variant={ROLE_VARIANT[role]} className={cn("capitalize", className)}>
      {role}
    </Badge>
  );
}

export { badgeVariants };
