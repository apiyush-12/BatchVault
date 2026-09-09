# BatchVault AI Instructions

This project uses a documentation-first development workflow.

Before performing a task:

1. Read the prompt file explicitly requested by the user.
2. Read every documentation file referenced by that prompt.
3. Perform only the requested task.
4. Do not implement future phases.
5. Do not silently change architecture or technology choices.
6. Never weaken security, authorization, or Row Level Security.
7. Never claim tests passed unless they were actually executed.
8. Keep changes focused.
9. Update /docs/memory.md when an implementation prompt requires it.
10. When a prompt says STOP, stop and wait for the next instruction.

Primary product:

BatchVault — a private collaborative digital memory and time-capsule platform for college batches.

Do not turn it into a generic social network.