import type { Target, Transition } from "framer-motion";

import {
  MOTION_DURATION,
  MOTION_EASE,
  REDUCED_MOTION_TRANSITION,
} from "@/components/motion/motion-tokens";

/**
 * The single place `prefers-reduced-motion` is resolved (design.md §29;
 * architecture §16). Components never branch on it themselves.
 *
 * These are pure functions of a boolean so the reduced-motion branch is unit
 * testable without a browser (testing.md §2.1).
 */

export interface MotionPair {
  initial: Target;
  animate: Target;
  transition: Transition;
}

/**
 * Entrance: a gentle fade and rise normally; a plain fade with no movement
 * under reduced motion. The element still appears either way.
 */
export function resolveEntrance(
  prefersReducedMotion: boolean,
  distance = 8,
): MotionPair {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: REDUCED_MOTION_TRANSITION,
    };
  }

  return {
    initial: { opacity: 0, y: distance },
    animate: { opacity: 1, y: 0 },
    transition: { duration: MOTION_DURATION.base, ease: MOTION_EASE },
  };
}

/** Press feedback: a small scale normally, nothing at all under reduced motion. */
export function resolvePressFeedback(
  prefersReducedMotion: boolean,
): { scale: number; transition: Transition } | undefined {
  if (prefersReducedMotion) {
    return undefined;
  }
  return {
    scale: 0.97,
    transition: { duration: MOTION_DURATION.fast, ease: MOTION_EASE },
  };
}
