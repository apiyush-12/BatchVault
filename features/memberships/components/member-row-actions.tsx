"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { BatchRole } from "@/lib/authz/roles";

import {
  approveMemberAction,
  changeMemberRoleAction,
  rejectMemberAction,
  removeMemberAction,
  transferOwnershipAction,
} from "../actions";
import {
  assignableRoles,
  canAssignRole,
  canDecideJoinRequests,
  canRemoveMember,
  canTransferOwnership,
} from "../permissions";
import type { RosterMember } from "../types";

/**
 * Per-row membership controls (phases.md Phase 3B). Page-level/row-level
 * guards here are Layer 2 convenience only — every RPC enforces the same
 * ceiling database-side regardless (security.md §4, §11, §5.2.2).
 */
export function MemberRowActions({
  batchId,
  member,
  callerRole,
  callerProfileId,
}: {
  batchId: string;
  member: RosterMember;
  callerRole: BatchRole;
  callerProfileId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isSelf = member.profileId === callerProfileId;

  if (member.status === "pending") {
    if (!canDecideJoinRequests(callerRole)) {
      return null;
    }

    async function approve() {
      setError(null);
      setPending(true);
      const result = await approveMemberAction({ batchId, profileId: member.profileId });
      setPending(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // `revalidatePath` inside the Server Action invalidates the cache but
      // does not re-render this already-mounted client page by itself.
      router.refresh();
    }
    async function reject() {
      setError(null);
      setPending(true);
      const result = await rejectMemberAction({ batchId, profileId: member.profileId });
      setPending(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    }

    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <Button type="button" size="sm" disabled={pending} onClick={approve}>
            Approve
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={reject}>
            Decline
          </Button>
        </div>
        {error !== null && (
          <span role="alert" className="text-caption font-medium text-danger">
            {error}
          </span>
        )}
      </div>
    );
  }

  if (member.status !== "active" || isSelf) {
    return null;
  }

  const canRemove = canRemoveMember(callerRole, member.role);
  const roleOptions = assignableRoles(callerRole).filter(
    (role) => role !== member.role && canAssignRole(callerRole, member.role, role),
  );
  const canTransfer = canTransferOwnership(callerRole);

  async function remove() {
    if (!window.confirm(`Remove ${member.displayName ?? "this member"} from the batch?`)) {
      return;
    }
    setError(null);
    setPending(true);
    const result = await removeMemberAction({ batchId, profileId: member.profileId });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function changeRole(newRole: BatchRole) {
    setError(null);
    setPending(true);
    const result = await changeMemberRoleAction({ batchId, profileId: member.profileId, newRole });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {roleOptions.length > 0 && (
          <Select
            aria-label={`Change ${member.displayName ?? "member"}'s role`}
            disabled={pending}
            defaultValue=""
            onChange={(event) => {
              const value = event.target.value as BatchRole | "";
              if (value !== "") changeRole(value);
            }}
          >
            <option value="" disabled>
              Change role…
            </option>
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                Make {role}
              </option>
            ))}
          </Select>
        )}
        {canRemove && (
          <Button type="button" variant="danger" size="sm" disabled={pending} onClick={remove}>
            Remove
          </Button>
        )}
      </div>
      {canTransfer && <TransferOwnership batchId={batchId} member={member} onError={setError} />}
      {error !== null && (
        <span role="alert" className="text-caption font-medium text-danger">
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Highest-tier confirmation (design.md §13-16; security.md §11): typing the
 * exact target display name, re-verified server-side, before an owner can
 * hand over the batch's single most consequential role.
 */
function TransferOwnership({
  batchId,
  member,
  onError,
}: {
  batchId: string;
  member: RosterMember;
  onError: (error: string | null) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Transfer ownership here
      </Button>
    );
  }

  async function confirm() {
    onError(null);
    setPending(true);
    const result = await transferOwnershipAction({
      batchId,
      newOwnerProfileId: member.profileId,
      confirmDisplayName: confirmText,
    });
    setPending(false);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-2 rounded-lg border border-danger/40 bg-surface-sunken p-3">
      <p className="text-caption text-foreground-muted">
        Type <strong>{member.displayName ?? "this member's name"}</strong> to confirm — this
        hands over the batch and cannot be undone by you alone.
      </p>
      <Input
        aria-label="Type the member's name to confirm ownership transfer"
        value={confirmText}
        onChange={(event) => setConfirmText(event.target.value)}
      />
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="button" variant="danger" size="sm" disabled={pending} onClick={confirm}>
          {pending ? "Transferring…" : "Confirm transfer"}
        </Button>
      </div>
    </div>
  );
}
