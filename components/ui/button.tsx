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
 * Press feedback is a tiny scale on `:active`; the global reduced-motion
 * backstop neutralises the transition.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium",
    "transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-raised hover:bg-primary-hover hover:shadow-floating",
        secondary:
          "border border-border bg-surface text-foreground shadow-raised hover:border-border-strong hover:bg-surface-sunken",
        ghost:
          "text-foreground-muted hover:bg-surface-sunken hover:text-foreground",
        soft: "bg-primary-soft text-primary hover:bg-primary/15",
        danger: "bg-danger text-primary-foreground shadow-raised hover:opacity-90",
        "danger-outline":
          "border border-danger/40 bg-transparent text-danger hover:bg-danger-soft",
      },
      size: {
        xs: "h-8 px-2.5 text-caption",
        sm: "h-9 px-3.5 text-body-sm",
        md: "h-11 px-5 text-body-sm",
        lg: "h-12 px-6 text-body",
        // Comfortable touch targets sized for thumbs (design.md §7, §22).
        icon: "size-10",
        "icon-sm": "size-9",
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
