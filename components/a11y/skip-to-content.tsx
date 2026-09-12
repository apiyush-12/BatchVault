/**
 * Skip-to-content link (design.md §26).
 *
 * Visually hidden until focused, so keyboard and screen-reader users can move
 * past repeated chrome without seeing it as visual clutter.
 */
export function SkipToContent({ targetId = "main" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-body-sm focus:font-medium focus:text-foreground focus:shadow-floating"
    >
      Skip to content
    </a>
  );
}
