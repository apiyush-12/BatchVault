# features/time-capsules

**POST-MVP. Reserved boundary only — no code, no schema, no route.**

Time capsules are post-MVP (architecture §22, ADR-11; database.md §22;
PRD §15). Phase 7 carries no MVP scope, and prompt 19's build brief is
declined by `phases.md`.

Two constraints that must survive into any future implementation: unlock is a
**read-time visibility predicate**, never a scheduled flag flip — a cron that
fires early is a privacy breach and one that fails is a broken promise — and
**every row storing a sealed payload carries its own lock**. Q8 (whether a
sealed capsule's existence is visible before unlock) must be decided first.
