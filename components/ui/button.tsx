import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

/**
 * shadcn/ui-style primitive, vendored into the repository (rules.md §1.5).
 * Once copied it is our code: reviewed and edited in place, never silently
 * bumped by a package update.
 *
 * Styling is expressed through the design tokens in app/globals.css, so the
 * button follows the palette in both themes without a `dark:` variant.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-body-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-hover shadow-raised",
        secondary:
          "border border-border bg-surface text-foreground hover:bg-surface-sunken",
        ghost: "text-foreground-muted hover:bg-surface-sunken hover:text-foreground",
        danger: "bg-danger text-primary-foreground hover:opacity-90",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-11 px-5",
        // Comfortable touch targets sized for thumbs (design.md §7, §22).
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
