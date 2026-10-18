import { describe, expect, it } from "vitest";

import {
  assignableRoles,
  canAssignRole,
  canRemoveMember,
  canTransferOwnership,
} from "@/features/memberships/permissions";

/**
 * Pure-function coverage for the memberships domain's Layer-2 capability
 * checks (testing.md §2.1; phases.md Phase 3B). These mirror the single
 * ceiling comparison each privileged RPC enforces database-side
 * (security.md §4, §11) — never the authorization guarantee itself.
 */

describe("canRemoveMember", () => {
  it("a moderator may remove a member only", () => {
    expect(canRemoveMember("moderator", "member")).toBe(true);
    expect(canRemoveMember("moderator", "moderator")).toBe(false);
    expect(canRemoveMember("moderator", "admin")).toBe(false);
  });

  it("an admin may remove a moderator or member, never a peer admin or the owner", () => {
    expect(canRemoveMember("admin", "member")).toBe(true);
    expect(canRemoveMember("admin", "moderator")).toBe(true);
    expect(canRemoveMember("admin", "admin")).toBe(false);
    expect(canRemoveMember("admin", "owner")).toBe(false);
  });

  it("the owner may remove anyone below owner", () => {
    expect(canRemoveMember("owner", "admin")).toBe(true);
    expect(canRemoveMember("owner", "moderator")).toBe(true);
    expect(canRemoveMember("owner", "member")).toBe(true);
  });

  it("a null (non-member) role never qualifies", () => {
    expect(canRemoveMember(null, "member")).toBe(false);
  });
});

describe("canAssignRole", () => {
  it("'owner' is never an assignable target, for any actor", () => {
    expect(canAssignRole("owner", "member", "owner")).toBe(false);
  });

  it("an admin may promote a member to moderator but never to admin", () => {
    expect(canAssignRole("admin", "member", "moderator")).toBe(true);
    expect(canAssignRole("admin", "member", "admin")).toBe(false);
  });

  it("an admin may not touch a peer admin's role at all", () => {
    expect(canAssignRole("admin", "admin", "moderator")).toBe(false);
  });

  it("only the owner may promote to admin", () => {
    expect(canAssignRole("owner", "member", "admin")).toBe(true);
    expect(canAssignRole("admin", "member", "admin")).toBe(false);
  });

  it("a moderator can never assign a role at or above moderator (ceiling never clears that high)", () => {
    expect(canAssignRole("moderator", "member", "moderator")).toBe(false);
    expect(canAssignRole("moderator", "member", "admin")).toBe(false);
  });

  it("a moderator 'assigning' member to an already-member target is a harmless no-op the ceiling permits", () => {
    // Matches change_member_role's own DB-side ceiling exactly: rank(1) > 0
    // holds on both sides. The real UI never offers this (member-row-
    // actions.tsx filters out `newRole === member.role`), so this is a
    // documented, intentional edge of the raw rule, not a hole.
    expect(canAssignRole("moderator", "member", "member")).toBe(true);
  });
});

describe("canTransferOwnership", () => {
  it("only the owner can transfer ownership", () => {
    expect(canTransferOwnership("owner")).toBe(true);
    expect(canTransferOwnership("admin")).toBe(false);
    expect(canTransferOwnership(null)).toBe(false);
  });
});

describe("assignableRoles", () => {
  it("an admin can assign member or moderator, never admin or owner", () => {
    expect(assignableRoles("admin")).toEqual(["member", "moderator"]);
  });

  it("an owner can assign member, moderator, or admin", () => {
    expect(assignableRoles("owner")).toEqual(["member", "moderator", "admin"]);
  });

  it("a moderator's only rank below itself is member; a plain member has none", () => {
    // Raw "ranks below me" — not role-change intent. The UI additionally
    // filters out a target's current role (member-row-actions.tsx), so a
    // moderator never actually sees an enabled control from this alone.
    expect(assignableRoles("moderator")).toEqual(["member"]);
    expect(assignableRoles("member")).toEqual([]);
  });

  it("a null role can assign nothing", () => {
    expect(assignableRoles(null)).toEqual([]);
  });
});
