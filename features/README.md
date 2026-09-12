# features/

Domain modules (architecture §16–17). This is where the real code lives; `app/`
only routes and composes.

Every active MVP domain follows the same internal shape when it is implemented:

| File | Purpose |
|---|---|
| `actions.ts` | Server Actions — the module's write surface |
| `queries.ts` | Server-side reads; the only place queries are built |
| `schema.ts` | Zod input validation schemas |
| `types.ts` | Domain types |
| `permissions.ts` | Capability checks for this domain |
| `components/` | Domain UI (server + client components) |

Boundary rules that keep this structure real rather than decorative
(architecture §17):

- A module owns its data. Another module reads it through this module's
  exported query functions, never by writing its own query against its tables.
- Dependency direction runs one way: domains may depend on `lib/*` and
  `components/ui`; `lib/*` never depends on a domain.
- `media` is the only module that talks to Storage.
- `authz` is the only place the role hierarchy is expressed in application code.
- `notifications` is the only module that would talk to a delivery provider.

**As of Phase 0 no domain is implemented.** Each directory below holds a
boundary note only. `albums`, `notifications`, `time-capsules` and `yearbook`
are post-MVP reserved boundaries and are not built in any MVP phase
(`docs/phases.md`).
