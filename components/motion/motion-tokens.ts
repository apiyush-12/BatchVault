import type { Transition } from "framer-motion";

/**
 * The shared motion grammar (design.md §28).
 *
 * Easing, duration and spring values live here so they stay consistent
 * product-wide instead of being reinvented per component. Durations lean
 * short and physically plausible — motion communicates, it does not decorate.
 */

export const MOTION_DURATION = {
  /** Feedback on tap/press. */
  fast: 0.12,
  /** Entrance of new content. */
  base: 0.24,
  /** A continuous-feeling move between two surfaces. */
  slow: 0.4,
} as const;

export const MOTION_EASE = [0.22, 0.61, 0.36, 1] as const;

export const MOTION_SPRING: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.8,
};

/**
 * Reduced motion swaps animation for a near-instant equivalent that preserves
 * the same information — it never removes the content (design.md §29).
 */
export const REDUCED_MOTION_TRANSITION: Transition = { duration: 0.01 };
