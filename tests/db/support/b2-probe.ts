import type { Client } from "pg";

import { assertSafeIdentifier } from "./db";

/**
 * Disposable probe objects for the B2 verification (security.md §32 B2,
 * §5.2.2, §5.3).
 *
 * These are TEST-ONLY objects. They live in their own schema, are created and
 * dropped by the test run, and are deliberately NOT BatchVault product tables
 * — no `batches`, `batch_members` or any other MVP table is created here, and
 * nothing in this file belongs in a production migration.
 *
 * They exist to answer one question empirically: which owner/execution model
 * lets a narrow privileged function perform a write, and a membership helper
 * perform a read, that the caller cannot — on tables carrying
 * `FORCE ROW LEVEL SECURITY` — while the caller is still derived from
 * `auth.uid()`.
 */

export const PROBE_SCHEMA = "b2_probe";

export async function teardownProbe(client: Client): Promise<void> {
  await client.query("reset role");
  await client.query(`drop schema if exists ${PROBE_SCHEMA} cascade`);
}

export async function setupProbe(
  client: Client,
  ownerRole: string,
): Promise<void> {
  const owner = assertSafeIdentifier(ownerRole);

  await teardownProbe(client);
  await client.query(`create schema ${PROBE_SCHEMA} authorization ${owner}`);

  await client.query(`set role ${owner}`);
  try {
    await client.query(`
      -- Stand-ins for a batch, its roster, and the authorization source a
      -- privileged join would consult. Shapes only: this is not the schema.
      create table ${PROBE_SCHEMA}.batches (
        id uuid primary key default gen_random_uuid(),
        label text not null
      );

      create table ${PROBE_SCHEMA}.memberships (
        batch_id uuid not null references ${PROBE_SCHEMA}.batches (id) on delete cascade,
        profile_id uuid not null,
        member_role text not null default 'member',
        primary key (batch_id, profile_id)
      );

      create table ${PROBE_SCHEMA}.invitees (
        batch_id uuid not null references ${PROBE_SCHEMA}.batches (id) on delete cascade,
        profile_id uuid not null,
        primary key (batch_id, profile_id)
      );

      -- Same shape as memberships, but its read policy calls an INVOKER
      -- helper that reads this very table — the recursion trap.
      create table ${PROBE_SCHEMA}.recursive_memberships (
        batch_id uuid not null,
        profile_id uuid not null,
        primary key (batch_id, profile_id)
      );

      -- FORCE RLS with no policy at all: the deny-by-default baseline used to
      -- establish what the owner role itself may do.
      create table ${PROBE_SCHEMA}.unpolicied_writes (
        id uuid primary key default gen_random_uuid(),
        actor uuid,
        note text
      );

      -- FORCE RLS; a policy scoped to the owner role is added later by
      -- grantOwnerWritePolicy(), so the two cases can be compared.
      create table ${PROBE_SCHEMA}.policied_writes (
        id uuid primary key default gen_random_uuid(),
        actor uuid,
        note text
      );
    `);

    for (const table of [
      "batches",
      "memberships",
      "invitees",
      "recursive_memberships",
      "unpolicied_writes",
      "policied_writes",
    ]) {
      await client.query(
        `alter table ${PROBE_SCHEMA}.${table} enable row level security`,
      );
      await client.query(
        `alter table ${PROBE_SCHEMA}.${table} force row level security`,
      );
    }

    // ---------------------------------------------------------------------
    // The membership helper, built to the security.md §5.3 constraints:
    // dedicated and narrow, current caller only (no user-id parameter),
    // schema-qualified, pinned empty search_path, no dynamic SQL, STABLE.
    // ---------------------------------------------------------------------
    await client.query(`
      create function ${PROBE_SCHEMA}.is_active_member(target_batch uuid)
      returns boolean
      language sql
      stable
      security definer
      set search_path = ''
      as $fn$
        select exists (
          select 1
            from ${PROBE_SCHEMA}.memberships m
           where m.batch_id = target_batch
             and m.profile_id = auth.uid()
        );
      $fn$;
    `);

    // The same question asked by an INVOKER function, used by the policy on
    // recursive_memberships to show what the constrained design avoids.
    await client.query(`
      create function ${PROBE_SCHEMA}.is_active_member_invoker(target_batch uuid)
      returns boolean
      language sql
      stable
      security invoker
      set search_path = ''
      as $fn$
        select exists (
          select 1
            from ${PROBE_SCHEMA}.recursive_memberships m
           where m.batch_id = target_batch
             and m.profile_id = auth.uid()
        );
      $fn$;
    `);

    // A deliberately WRONG helper shape — it takes a user id — kept only so
    // the test can demonstrate why security.md §5.3 forbids the parameter.
    await client.query(`
      create function ${PROBE_SCHEMA}.is_member_oracle(target_batch uuid, who uuid)
      returns boolean
      language sql
      stable
      security definer
      set search_path = ''
      as $fn$
        select exists (
          select 1
            from ${PROBE_SCHEMA}.memberships m
           where m.batch_id = target_batch
             and m.profile_id = who
        );
      $fn$;
    `);

    // What identity does a definer function actually see?
    await client.query(`
      create function ${PROBE_SCHEMA}.whoami()
      returns table (jwt_uid uuid, session_role text, effective_role text)
      language sql
      stable
      security definer
      set search_path = ''
      as $fn$
        select auth.uid(), session_user::text, current_user::text;
      $fn$;
    `);

    // -------------------------------------------------------------------
    // Privileged write paths.
    // -------------------------------------------------------------------

    // Authorizes auth.uid() explicitly before writing, ignores every
    // caller-asserted claim, and denies indistinguishably.
    await client.query(`
      create function ${PROBE_SCHEMA}.join_batch(
        target_batch uuid,
        claimed_actor uuid default null,
        claimed_role text default null
      )
      returns ${PROBE_SCHEMA}.memberships
      language plpgsql
      security definer
      set search_path = ''
      as $fn$
      declare
        caller uuid := auth.uid();
        created ${PROBE_SCHEMA}.memberships;
      begin
        -- claimed_actor / claimed_role are accepted by the signature and then
        -- deliberately ignored: identity and role are never caller-asserted.
        if caller is null then
          raise exception 'not authorized' using errcode = '42501';
        end if;

        if not exists (
          select 1
            from ${PROBE_SCHEMA}.invitees i
           where i.batch_id = target_batch
             and i.profile_id = caller
        ) then
          -- The same response whether the batch does not exist or the caller
          -- is simply not entitled to it.
          raise exception 'not authorized' using errcode = '42501';
        end if;

        insert into ${PROBE_SCHEMA}.memberships (batch_id, profile_id, member_role)
        values (target_batch, caller, 'member')
        returning * into created;

        return created;
      end;
      $fn$;
    `);

    // The same privilege, without the authorization check. This is what
    // "a privileged function is itself the trusted boundary" means in
    // practice: nothing else is standing behind it.
    await client.query(`
      create function ${PROBE_SCHEMA}.join_batch_unchecked(target_batch uuid)
      returns ${PROBE_SCHEMA}.memberships
      language plpgsql
      security definer
      set search_path = ''
      as $fn$
      declare
        created ${PROBE_SCHEMA}.memberships;
      begin
        insert into ${PROBE_SCHEMA}.memberships (batch_id, profile_id, member_role)
        values (target_batch, auth.uid(), 'member')
        returning * into created;
        return created;
      end;
      $fn$;
    `);

    await client.query(`
      create function ${PROBE_SCHEMA}.write_unpolicied(note text)
      returns uuid
      language plpgsql
      security definer
      set search_path = ''
      as $fn$
      declare
        new_id uuid;
      begin
        insert into ${PROBE_SCHEMA}.unpolicied_writes (actor, note)
        values (auth.uid(), note)
        returning id into new_id;
        return new_id;
      end;
      $fn$;
    `);

    await client.query(`
      create function ${PROBE_SCHEMA}.write_policied(note text)
      returns uuid
      language plpgsql
      security definer
      set search_path = ''
      as $fn$
      declare
        new_id uuid;
      begin
        insert into ${PROBE_SCHEMA}.policied_writes (actor, note)
        values (auth.uid(), note)
        returning id into new_id;
        return new_id;
      end;
      $fn$;
    `);

    // -------------------------------------------------------------------
    // Policies.
    //
    // Reads are membership-derived. The policy on `memberships` reaches
    // `memberships` through the definer helper — exactly the recursion shape
    // security.md §5.3 warns about — and the policy on
    // `recursive_memberships` does the same through an INVOKER helper.
    //
    // No policy admits the owner role. Whether the owner needs one is the
    // question this experiment answers, so fixtures are seeded through a
    // BYPASSRLS role instead of by quietly granting the owner what the
    // experiment is meant to measure.
    // -------------------------------------------------------------------
    await client.query(`
      create policy memberships_select on ${PROBE_SCHEMA}.memberships
        for select
        to authenticated
        using (${PROBE_SCHEMA}.is_active_member(batch_id));

      create policy batches_select on ${PROBE_SCHEMA}.batches
        for select
        to authenticated
        using (${PROBE_SCHEMA}.is_active_member(id));

      create policy recursive_memberships_select on ${PROBE_SCHEMA}.recursive_memberships
        for select
        to authenticated
        using (${PROBE_SCHEMA}.is_active_member_invoker(batch_id));
    `);

    // -------------------------------------------------------------------
    // Grants. Client roles get reads only; every write is RPC-only, and the
    // privilege is revoked rather than merely policy-restricted.
    // -------------------------------------------------------------------
    await client.query(`
      grant usage on schema ${PROBE_SCHEMA} to anon, authenticated, service_role;
      grant select on
        ${PROBE_SCHEMA}.batches,
        ${PROBE_SCHEMA}.memberships,
        ${PROBE_SCHEMA}.recursive_memberships
      to authenticated;
      -- Fixture seeding, and the separate question of what a BYPASSRLS role
      -- can see under FORCE RLS.
      grant select, insert on
        ${PROBE_SCHEMA}.batches,
        ${PROBE_SCHEMA}.memberships,
        ${PROBE_SCHEMA}.invitees,
        ${PROBE_SCHEMA}.recursive_memberships
      to service_role;
      revoke all on all functions in schema ${PROBE_SCHEMA} from public;
      grant execute on function
        ${PROBE_SCHEMA}.is_active_member(uuid),
        ${PROBE_SCHEMA}.is_active_member_invoker(uuid),
        ${PROBE_SCHEMA}.is_member_oracle(uuid, uuid),
        ${PROBE_SCHEMA}.whoami(),
        ${PROBE_SCHEMA}.join_batch(uuid, uuid, text),
        ${PROBE_SCHEMA}.join_batch_unchecked(uuid),
        ${PROBE_SCHEMA}.write_unpolicied(text),
        ${PROBE_SCHEMA}.write_policied(text)
      to authenticated;
    `);
  } finally {
    await client.query("reset role");
  }
}

/**
 * Admits the owner role's own statements on a forced-RLS table — the missing
 * half of the privileged-execution model when the owner holds no BYPASSRLS.
 *
 * SELECT is admitted alongside INSERT because `INSERT ... RETURNING` is
 * evaluated against the SELECT policies too, and a privileged RPC that
 * returns the row it just wrote therefore needs both.
 */
export async function admitOwnerOn(
  client: Client,
  ownerRole: string,
  table: "memberships" | "policied_writes" | "invitees",
  commands: { select?: boolean; insert?: boolean } = {
    select: true,
    insert: true,
  },
): Promise<void> {
  const owner = assertSafeIdentifier(ownerRole);
  const target = assertSafeIdentifier(table);
  await client.query(`set role ${owner}`);
  try {
    if (commands.select === true) {
      await client.query(`
        create policy ${target}_owner_select on ${PROBE_SCHEMA}.${target}
          for select to ${owner} using (true);
      `);
    }
    if (commands.insert === true) {
      await client.query(`
        create policy ${target}_owner_insert on ${PROBE_SCHEMA}.${target}
          for insert to ${owner} with check (true);
      `);
    }
  } finally {
    await client.query("reset role");
  }
}

export interface ProbeFixture {
  batchA: string;
  batchB: string;
  /** Invited to batch A, a member of nothing yet. */
  inviteeUser: string;
  /** Active member of batch A. */
  memberUser: string;
  /** Active member of batch B only — the cross-batch adversary. */
  outsiderUser: string;
}

/**
 * Seeds fixtures through the BYPASSRLS `service_role`, so the owner role's
 * relationship with FORCE RLS stays untouched by the seeding itself.
 */
export async function seedProbe(client: Client): Promise<ProbeFixture> {
  await client.query("set role service_role");
  try {
    const { rows } = await client.query<{ id: string }>(
      `insert into ${PROBE_SCHEMA}.batches (label)
       values ('batch-a'), ('batch-b')
       returning id`,
    );
    const batchA = rows[0]?.id;
    const batchB = rows[1]?.id;
    if (batchA === undefined || batchB === undefined) {
      throw new Error("probe seed failed to create both batches");
    }

    const { rows: idRows } = await client.query<{
      invitee: string;
      member: string;
      outsider: string;
    }>(
      `select gen_random_uuid() as invitee,
              gen_random_uuid() as member,
              gen_random_uuid() as outsider`,
    );
    const ids = idRows[0];
    if (ids === undefined) {
      throw new Error("probe seed failed to generate persona ids");
    }

    await client.query(
      `insert into ${PROBE_SCHEMA}.memberships (batch_id, profile_id) values ($1, $2), ($3, $4)`,
      [batchA, ids.member, batchB, ids.outsider],
    );
    await client.query(
      `insert into ${PROBE_SCHEMA}.invitees (batch_id, profile_id) values ($1, $2)`,
      [batchA, ids.invitee],
    );
    await client.query(
      `insert into ${PROBE_SCHEMA}.recursive_memberships (batch_id, profile_id) values ($1, $2)`,
      [batchA, ids.member],
    );

    return {
      batchA,
      batchB,
      inviteeUser: ids.invitee,
      memberUser: ids.member,
      outsiderUser: ids.outsider,
    };
  } finally {
    await client.query("reset role");
  }
}
