"use client";

import { RouteError } from "@/components/ui/route-error";

/** Fallback for routes outside the app shell (auth, onboarding, invite landing). */
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main id="main" className="bg-paper flex min-h-dvh flex-col">
      <RouteError error={error} retry={retry} />
    </main>
  );
}
