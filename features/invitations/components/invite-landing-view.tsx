"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
      <p role="status" className="text-body text-foreground-muted">
        Checking your invite…
      </p>
    );
  }

  if (state.kind === "invalid") {
    return (
      <div className="flex flex-col gap-3 text-center">
        <p className="text-heading-md font-semibold">Can&rsquo;t show this</p>
        <p className="max-w-prose text-body text-foreground-muted">{GENERIC_INVITE_ERROR}</p>
        <Link href="/home" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  if (state.kind === "joined" && state.status === "pending") {
    return (
      <div className="flex flex-col gap-3 text-center">
        <p className="text-heading-md font-semibold">Request sent</p>
        <p className="max-w-prose text-body text-foreground-muted">
          Your request to join <strong>{state.batchName}</strong> is waiting for approval.
        </p>
        <Link href="/home" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  const batchName = state.batchName;
  const isJoining = state.kind === "joining";

  return (
    <div className="flex flex-col gap-4 text-center">
      <p className="text-heading-md font-semibold">You&rsquo;re invited</p>
      <p className="max-w-prose text-body text-foreground-muted">
        Join <strong>{batchName}</strong>&rsquo;s shared archive on BatchVault.
      </p>
      <Button type="button" onClick={join} disabled={isJoining} className="self-center">
        {isJoining ? "Joining…" : "Join"}
      </Button>
    </div>
  );
}
