"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useSyncExternalStore, type ReactNode } from "react";

import { resolveEntrance } from "@/components/motion/reduced-motion";

const noopSubscribe = () => () => {};

/**
 * True only once this browser has hydrated. During SSR and the hydration
 * pass it is `false`, so the server HTML is rendered at its settled state
 * instead of `opacity: 0` — first paint never waits on the JS bundle.
 */
function useHasHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Shared entrance wrapper (architecture §16; design.md §28–29).
 *
 * Reduced motion is checked here, once, rather than in each component that
 * animates. Under reduced motion the content still appears — it simply
 * appears without movement.
 *
 * The entrance plays on client-side navigations only. On a full page load
 * the content is already visible in the server-rendered HTML.
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
  const hasHydrated = useHasHydrated();
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
      initial={hasHydrated ? initial : false}
      animate={animate}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
