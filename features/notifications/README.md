# features/notifications

**POST-MVP. Reserved boundary only — no code, no schema, no route.**

Notifications of every kind — in-app feed, push, digest, email — are postponed
(architecture §12, §22; database.md §20). No `notifications` table is created
in any MVP phase.

`phases.md` resolves the filename conflict in prompt 18 explicitly: Phase 6
builds comments and reactions **only**, and nothing that is a notification feed
in disguise.

Two constraints for whenever it is eventually built: other modules emit domain
events to this module and never to a delivery provider directly, and a
notification payload carries references only — content is resolved at view time
behind the normal authorization checks.
