import Image from "next/image";

import { cn } from "@/lib/cn";

const SIZE_CLASS = {
  xs: "size-6 text-[0.625rem]",
  sm: "size-8 text-caption",
  md: "size-10 text-body-sm",
  lg: "size-14 text-body",
  xl: "size-20 text-heading-sm",
} as const;

const SIZE_PX = { xs: 24, sm: 32, md: 40, lg: 56, xl: 80 } as const;

/**
 * Avatar with a warm initial fallback. Signed Storage URLs are short-lived
 * and a poor cache key, so the image is deliberately `unoptimized`
 * (architecture §9) — the same choice every existing surface makes.
 */
export function Avatar({
  src,
  name,
  size = "md",
  className,
}: {
  src: string | null;
  name: string | null;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft font-semibold text-primary ring-1 ring-border/60",
        SIZE_CLASS[size],
        className,
      )}
    >
      {src !== null ? (
        <Image
          src={src}
          alt=""
          width={SIZE_PX[size]}
          height={SIZE_PX[size]}
          unoptimized
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
}
