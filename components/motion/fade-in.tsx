"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import { resolveEntrance } from "@/components/motion/reduced-motion";

/**
 * Shared entrance wrapper (architecture §16; design.md §28–29).
 *
 * Reduced motion is checked here, once, rather than in each component that
 * animates. Under reduced motion the content still appears — it simply
 * appears without movement.
 */
export function FadeIn({
  children,
  distance,
  className,
}: {
  children: ReactNode;
  distance?: number;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const { initial, animate, transition } = resolveEntrance(
    prefersReducedMotion,
    distance,
  );

  return (
    <motion.div
      // Lets a test wait for the entrance to settle instead of sampling a
      // half-faded frame.
      data-motion="entrance"
      className={className}
      initial={initial}
      animate={animate}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
