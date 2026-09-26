import type { BatchRole } from "@/lib/authz/roles";

export type JoinPolicy = "invite_only_auto_approve" | "invite_only_requires_approval";

export interface Batch {
  id: string;
  name: string;
  institutionName: string;
  courseName: string | null;
  departmentName: string | null;
  graduationYear: number | null;
  section: string | null;
  description: string | null;
  joinPolicy: JoinPolicy;
  createdAt: string;
  updatedAt: string;
}

/** A batch the caller belongs to, with the caller's own role in it. */
export interface MyBatch {
  batch: Batch;
  role: BatchRole;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export const GENERIC_ERROR = "Something went wrong. Please try again.";
