"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

import { revokeInviteAction } from "../actions";
import type { Invite } from "../types";
import { InviteCreateForm } from "./invite-create-form";

function isUsable(invite: Invite, now: Date): boolean {
  if (invite.revokedAt !== null) return false;
  if (invite.expiresAt !== null && new Date(invite.expiresAt) <= now) return false;
  if (invite.maxUses !== null && invite.useCount >= invite.maxUses) return false;
  return true;
}

function CopyLinkRow({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-sunken p-4">
      <p className="text-body-sm font-medium text-foreground">
        Share this link with your classmates. It won&rsquo;t be shown again.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border border-border bg-surface px-3 py-2 text-caption text-foreground-muted">
          {url}
        </code>
        <Button type="button" variant="secondary" size="icon" onClick={copy} aria-label="Copy invite link">
          {copied ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <Copy aria-hidden="true" className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function InviteRow({ invite, batchId }: { invite: Invite; batchId: string }) {
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usable = isUsable(invite, new Date());

  async function revoke() {
    setError(null);
    setIsRevoking(true);
    const result = await revokeInviteAction({ inviteId: invite.id, batchId });
    setIsRevoking(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-body-sm font-medium text-foreground">
          {usable ? "Active" : invite.revokedAt !== null ? "Revoked" : "Expired or used up"}
        </span>
        <span className="text-caption text-foreground-muted">
          Used {invite.useCount}
          {invite.maxUses !== null ? ` / ${invite.maxUses}` : ""} time
          {invite.useCount === 1 ? "" : "s"}
          {invite.expiresAt !== null
            ? ` · expires ${new Date(invite.expiresAt).toLocaleDateString()}`
            : ""}
        </span>
        {error !== null && (
          <span role="alert" className="text-caption font-medium text-danger">
            {error}
          </span>
        )}
      </div>
      {usable && (
        <Button type="button" variant="danger" size="sm" onClick={revoke} disabled={isRevoking}>
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
      <InviteCreateForm batchId={batchId} onCreated={setLastCreatedUrl} />

      {lastCreatedUrl !== null && <CopyLinkRow url={lastCreatedUrl} />}

      {invites.length > 0 && (
        <ul className="flex flex-col gap-3">
          {invites.map((invite) => (
            <InviteRow key={invite.id} invite={invite} batchId={batchId} />
          ))}
        </ul>
      )}
    </div>
  );
}
