"use client";

import { RouteError } from "@/components/ui/route-error";

/** Keeps the app shell (navigation) in place when a page inside it fails. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} />;
}
