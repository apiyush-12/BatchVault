# Prompt 10 — Create Persistent Project Memory

Read all existing files in `/docs`.

Your only job is to create:

`/docs/memory.md`

Do not write application code.
Do not change other docs unless a contradiction makes memory.md impossible to write; if so, report it instead.

## Purpose

memory.md is a concise handoff document for future AI coding sessions.

It must stay short enough to read at the beginning of every implementation task.

## Required structure

# BatchVault Project Memory

## Product Purpose
Very short summary.

## Current Phase
Set to: Planning complete / implementation not started.

## Completed
List completed planning documents.

## Current Work
State that implementation has not started.

## Core Architecture Decisions
Only durable decisions.

## Security Invariants
Include the rules that must never be violated.

## Important Paths
List docs and expected source directories.

## Known Issues / Open Decisions
Only real unresolved items.

## Do Not Change Without Explicit Decision
List architecture/security foundations.

## Next Task
Recommend Phase 0 Foundation.

## Update Rules
Explain that future AI sessions must update:
- current phase,
- completed work,
- key decisions,
- known bugs,
- next task.

Do not turn memory.md into a full duplicate of the PRD.

Keep it concise.

At the end:

1. print the final `Next Task`,
2. then STOP.
