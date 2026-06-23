# SPEC-251 — Progress

## Origin (2026-06-20)

Surfaced during SPEC-249 close-out when `pnpm cli wt:up` brought up a stale worktree
DB: `hospeda_template` predated SPEC-239 (no `gastronomies`/`experiences` tables, no
`COMMERCE_OWNER` enum). Even `hospeda_dev` was partially stale (had `gastronomies`
but missing the `experiences` table from SPEC-240). Every new worktree required manual
`db:push` + `apply-extras` + seed to be usable.

## Task status

| ID | Title | Phase | Status |
| --- | --- | --- | --- |
| T-001 | Write DB lifecycle + refresh runbook docs | docs | pending |
| T-002 | Add schema-drift detection + auto-heal to wt-db.sh ensure-ready path | core | pending |
| T-003 | Verify commerce seed data is present after wt:up | integration | pending |

## Notes

- T-001 and T-002 are independent and can run in parallel.
- T-003 depends on T-002 being done (needs a healed wt:up to smoke-test).
- T-002 is the critical-path task (the actual auto-heal logic in wt-db.sh).
- wt-db.sh lives at ~/.claude/skills/worktree/scripts/wt-db.sh (outside the repo).
  The in-repo artifact is .claude/project.config.json (schemaVersionSentinel key).
- db:fresh-dev is DESTRUCTIVE — wipes hospeda_dev via docker compose down -v.
  Must be documented clearly in T-001 before anyone runs it unaware.
