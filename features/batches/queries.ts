import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BatchRole } from "@/lib/authz/roles";

import type { Batch, JoinPolicy, MyBatch } from "./types";

const BATCH_COLUMNS =
  "id, name, institution_name, course_name, department_name, graduation_year, section, description, join_policy, created_at, updated_at" as const;

interface BatchRow {
  id: string;
  name: string;
  institution_name: string;
  course_name: string | null;
  department_name: string | null;
  graduation_year: number | null;
  section: string | null;
  description: string | null;
  join_policy: JoinPolicy;
  created_at: string;
  updated_at: string;
}

function mapBatchRow(row: BatchRow): Batch {
  return {
    id: row.id,
    name: row.name,
    institutionName: row.institution_name,
    courseName: row.course_name,
    departmentName: row.department_name,
    graduationYear: row.graduation_year,
    section: row.section,
    description: row.description,
    joinPolicy: row.join_policy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Every batch the caller is an ACTIVE member of, with their own role in
 * each. This is the batch switcher's data source (PRD §16; design.md §15).
 *
 * Reads batch_members joined to batches. RLS admits exactly the rows an
 * active member is entitled to (security.md §5.4) — no application-side
 * filtering of a superset (architecture §11).
 */
export async function listMyBatches(): Promise<MyBatch[]> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user === null) {
    return [];
  }

  const { data, error } = await supabase
    .from("batch_members")
    .select(`role, batch:batches(${BATCH_COLUMNS})`)
    .eq("profile_id", userData.user.id)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (error !== null) {
    throw error;
  }

  return (data ?? [])
    .filter(
      (row): row is { role: BatchRole; batch: BatchRow } => row.batch !== null,
    )
    .map((row) => ({ role: row.role, batch: mapBatchRow(row.batch) }));
}

/**
 * A single batch by id, or `null` if it does not exist OR the caller cannot
 * see it — deliberately indistinguishable (security.md §3, "indistinguishable
 * denial"; architecture §18.6).
 */
export async function getBatchById(batchId: string): Promise<Batch | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("batches")
    .select(BATCH_COLUMNS)
    .eq("id", batchId)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }
  return data === null ? null : mapBatchRow(data);
}
