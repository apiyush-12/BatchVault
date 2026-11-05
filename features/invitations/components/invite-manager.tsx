"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDate } from "@/components/ui/local-date";

import { revokeInviteAction } from "../actions";
import type { Invite } from "../types";
import { InviteCreateForm } from "./invite-create-form";

const noopSubscribe = () => () => {};

function isUsable(invite: Invite, now: Date): boolean {
  if (invite.revokedAt !== null) return false;
  if (invite.expiresAt !== null && new Date(invite.expiresAt) <= now) return false;
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return false;
  return true;
}

function CopyLinkRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  // The native share sheet exists on most phones; the server pass assumes not.
  const canShare = useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard access can be denied (permissions, embedded browsers).
      setCopyFailed(true);
      return;
    }
    setCopyFailed(false);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    try {
      await navigator.share({ title: "Join our batch on BatchVault", url });
    } catch {
      // Dismissing the share sheet rejects; nothing to report.
    }
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary-soft/60 p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Link2 aria-hidden="true" className="size-4" />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-body font-semibold text-foreground">Your invite link is ready</p>
          <p className="text-body-sm text-foreground-muted">
            Share this link with your classmates. It won&rsquo;t be shown again, so copy it now.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface px-3 py-2.5 text-caption text-foreground-muted select-all">
          {url}
        </code>
        <Button type="button" variant={copied ? "soft" : "primary"} onClick={copy} className="shrink-0">
          {copied ? (
            <>
              <Check aria-hidden="true" className="size-4" />
              Copied
            </>
          ) : (
            <>
              <Copy aria-hidden="true" className="size-4" />
              Copy link
            </>
          )}
        </Button>
        {canShare && (
          <Button type="button" variant="secondary" onClick={share} className="shrink-0">
            <Share2 aria-hidden="true" className="size-4" />
            Share
          </Button>
        )}
      </div>
      {copyFailed && (
        <p role="alert" className="text-caption font-medium text-danger">
          Couldn&rsquo;t copy automatically. Select the link above and copy it by hand.
        </p>
      )}
    </div>
  );
}

function InviteRow({ invite, batchId }: { invite: Invite; batchId: string }) {
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usable = isUsable(invite, new Date());

  async function revoke() {
    if (!window.confirm("Revoke this invite link? Anyone holding it will no longer be able to join.")) {
      return;
    }
    setError(null);
    setIsRevoking(true);
    const result = await revokeInviteAction({ inviteId: invite.id, batchId });
    setIsRevoking(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  const status = usable ? "Active" : invite.revokedAt !== null ? "Revoked" : "Expired or used up";

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-raised">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={usable ? "success" : "neutral"}>{status}</Badge>
          <span className="text-caption text-foreground-muted">
            Created <LocalDate value={invite.createdAt} />
          </span>
        </div>
        <span className="text-body-sm text-foreground-muted">
          Used {invite.useCount}
          {invite.maxUses !== null ? ` of ${invite.maxUses}` : ""} time
          {invite.useCount === 1 ? "" : "s"}
          {invite.expiresAt !== null ? (
            <>
              {" · expires "}
              <LocalDate value={invite.expiresAt} />
            </>
          ) : (
            " · no expiry"
          )}
        </span>
        {error !== null && (
          <span role="alert" className="text-caption font-medium text-danger">
            {error}
          </span>
        )}
      </div>
      {usable && (
        <Button type="button" variant="danger-outline" size="sm" onClick={revoke} disabled={isRevoking}>
          {isRevoking ? "Revoking…" : "Revoke"}
        </Button>
      )}
    </li>
  );
}

/** Admin+ invite management (phases.md Phase 3A). */
export function InviteManager({ batchId, invites }: { batchId: string; invites: Invite[] }) {
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      {lastCreatedUrl !== null && <CopyLinkRow url={lastCreatedUrl} />}

      <Card>
        <CardHeader>
          <CardTitle>New invite link</CardTitle>
          <CardDescription>
            Both limits are optional. A link with no limit works until you revoke it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteCreateForm batchId={batchId} onCreated={setLastCreatedUrl} />
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <section aria-labelledby="existing-invites-heading" className="flex flex-col gap-3">
          <h2 id="existing-invites-heading" className="text-heading-sm font-semibold">
            Existing links
          </h2>
          <ul className="flex flex-col gap-3">
            {invites.map((invite) => (
              <InviteRow key={invite.id} invite={invite} batchId={batchId} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
