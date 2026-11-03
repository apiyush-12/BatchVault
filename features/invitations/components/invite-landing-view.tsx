"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, EyeOff, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";

import { redeemInviteAction, validateInviteAction } from "../actions";
import { GENERIC_INVITE_ERROR } from "../types";

export const PENDING_INVITE_TOKEN_KEY = "bv_pending_invite_token";

type ViewState =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "valid"; batchName: string }
  | { kind: "joining"; batchName: string }
  | { kind: "joined"; batchName: string; status: "active" | "pending" };

function StateIcon({ icon: Icon, tone }: { icon: typeof Mail; tone: "primary" | "muted" | "warning" }) {
  const toneClass =
    tone === "primary"
      ? "bg-primary-soft text-primary"
      : tone === "warning"
        ? "bg-warning-soft text-warning"
        : "bg-surface-sunken text-foreground-muted";
  return (
    <span className={`mb-4 flex size-14 items-center justify-center rounded-full ${toneClass}`}>
      <Icon aria-hidden="true" className="size-6" />
    </span>
  );
}

/**
 * The invite landing/redemption page (phases.md Phase 3A; security.md §9,
 * §9.1; design.md §35). A Client Component because the raw token lives in
 * the URL **fragment**, which is never sent to the server at all — reading
 * it, and then replacing the visible URL, can only happen here.
 */
export function InviteLandingView() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ kind: "loading" });
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    const fromHash = window.location.hash.slice(1);
    const fromStorage = window.sessionStorage.getItem(PENDING_INVITE_TOKEN_KEY);
    // An empty token is handled by the same async path, via the server
    // action's own validation — never a synchronous setState here (every
    // state transition below happens inside a `.then()` callback).
    const token = (fromHash !== "" ? fromHash : fromStorage) ?? "";

    // Replace the visible URL immediately so the raw token is never left in
    // the address bar or added to browser history (security.md §9.1).
    if (fromHash !== "") {
      window.history.replaceState(null, "", window.location.pathname);
    }

    tokenRef.current = token;

    void validateInviteAction({ token }).then((result) => {
      if (!result.ok) {
        window.sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
        setState({ kind: "invalid" });
        return;
      }
      setState({ kind: "valid", batchName: result.data.batchName });
    });
  }, []);

  async function join() {
    const token = tokenRef.current;
    if (token === null || state.kind !== "valid") {
      return;
    }
    setState({ kind: "joining", batchName: state.batchName });

    const result = await redeemInviteAction({ token });

    if (!result.ok) {
      if (result.requiresAuth === true) {
        // Preserve the token (never the URL) across the auth detour, then
        // come back here to finish exactly once signed in.
        window.sessionStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
        router.push("/sign-in");
        return;
      }
      window.sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
      setState({ kind: "invalid" });
      return;
    }

    window.sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
    setState({ kind: "joined", batchName: result.data.batchName, status: result.data.status });

    if (result.data.status === "active") {
      router.push(`/batches/${result.data.batchId}`);
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="flex flex-col items-center">
        <StateIcon icon={Loader2} tone="muted" />
        <p role="status" className="text-body text-foreground-muted">
          Checking your invite…
        </p>
      </div>
    );
  }

  if (state.kind === "invalid") {
    return (
      <div className="flex flex-col items-center gap-3">
        <StateIcon icon={EyeOff} tone="muted" />
        <p className="font-display text-heading-md text-foreground">Can&rsquo;t show this</p>
        <p className="max-w-prose text-body text-foreground-muted">{GENERIC_INVITE_ERROR}</p>
        <Button asChild variant="secondary" className="mt-2">
          <Link href="/home">Back to home</Link>
        </Button>
      </div>
    );
  }

  if (state.kind === "joined" && state.status === "pending") {
    return (
      <div className="flex flex-col items-center gap-3">
        <StateIcon icon={Clock} tone="warning" />
        <p className="font-display text-heading-md text-foreground">Request sent</p>
        <p className="max-w-prose text-body text-foreground-muted">
          Your request to join <strong className="text-foreground">{state.batchName}</strong> is waiting
          for approval. You&rsquo;ll find it on your home page once a batch admin lets you in.
        </p>
        <Button asChild variant="secondary" className="mt-2">
          <Link href="/home">Back to home</Link>
        </Button>
      </div>
    );
  }

  const batchName = state.batchName;
  const isJoining = state.kind === "joining";

  return (
    <div className="flex flex-col items-center gap-3">
      <StateIcon icon={Mail} tone="primary" />
      <p className="font-display text-heading-md text-foreground">You&rsquo;re invited</p>
      <p className="max-w-prose text-body text-foreground-muted">
        Join <strong className="text-foreground">{batchName}</strong>&rsquo;s shared archive on BatchVault.
      </p>
      <Button type="button" size="lg" onClick={join} disabled={isJoining} className="mt-3 min-w-40">
        {isJoining && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
        {isJoining ? "Joining…" : "Join"}
      </Button>
    </div>
  );
}
