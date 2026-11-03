import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * The BatchVault mark: a small rounded "vault" tile with a keepsake fold,
 * beside the wordmark set in the display serif. Pure CSS/SVG, no asset
 * download, so it renders identically in both themes.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[0.6rem] bg-primary text-primary-foreground shadow-raised",
        className,
      )}
    >
      <svg viewBox="0 0 32 32" className="size-full" fill="none">
        <rect x="6" y="9" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
        <path d="M6 14h20" stroke="currentColor" strokeWidth="2" />
        <circle cx="16" cy="20" r="2.2" fill="currentColor" />
        <path d="M11 9V7.5A2.5 2.5 0 0 1 13.5 5h5A2.5 2.5 0 0 1 21 7.5V9" stroke="currentColor" strokeWidth="2" />
      </svg>
    </span>
  );
}

export function Wordmark({
  href = "/home",
  size = "md",
  className,
}: {
  href?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const content = (
    <>
      <BrandMark className={size === "lg" ? "size-10 rounded-xl" : size === "sm" ? "size-7" : undefined} />
      <span
        className={cn(
          "font-display tracking-tight text-foreground",
          size === "lg" ? "text-heading-md" : size === "sm" ? "text-body" : "text-heading-sm",
        )}
      >
        BatchVault
      </span>
    </>
  );

  if (href === null) {
    return <span className={cn("inline-flex items-center gap-2.5", className)}>{content}</span>;
  }

  return (
    <Link
      href={href}
      aria-label="BatchVault home"
      className={cn("inline-flex items-center gap-2.5 rounded-md", className)}
    >
      {content}
    </Link>
  );
}
