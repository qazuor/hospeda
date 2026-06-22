# SPEC-262 — Progress

## Atomized (2026-06-22)

15 tasks across 6 phases. Spec fully closed (5 OQs resolved by owner 2026-06-22).

## Phase breakdown

| Phase | Tasks | Notes |
| --- | --- | --- |
| spike | T-001 | MP preapproval mutation capability — gates case-3 renewal logic |
| core | T-002, T-003, T-004, T-005, T-006, T-007 | DB schema, extras migration, Zod schemas, service-core engine |
| migration | T-003 (also tagged migration) | extras carril 018, backfill, comp-subscription reconciliation |
| integration | T-008, T-009, T-010, T-011, T-012 | API routes, admin UI, web checkout feedback |
| testing | T-013, T-014 | Migration regression + HOSPEDA_FREE latent-bug lock + SPEC-143 MP smoke |
| docs | T-015 | Architecture notes, CLAUDE.md billing quick reference |

## Critical path

T-002 (DB schema) → T-003 (extras/backfill) → T-004 (Zod schemas) → T-005 (service-core engine) → T-006 (trial-extension service) → T-009 (trial-extension API route) → T-011 (subscription view) → T-012 (checkout feedback) → T-013 (regression tests) → T-014 (SPEC-143 smoke) → T-015 (docs)

T-001 (spike) runs in parallel with T-002/T-003/T-004/T-005/T-006 but blocks T-007 (renewal decrement).
T-007 blocks T-011 (subscription detail cannot show remaining-cycles until renewal logic exists).

## Parallel tracks

Track A (DB + schemas, no MP dependency):
T-002 → T-003 → T-004 → T-005 → T-006 → T-008/T-009/T-010 → T-011/T-012 → T-013 → T-014 → T-015

Track B (MP spike):
T-001 → T-007 (post-spike; merges into T-011 dep)

## Key decisions honored

1. comp = explicit subscription state (Model β, OQ-1) — T-002 adds comp to status values; T-005 short-circuits MP preapproval for comp; T-007 skips comp subs.
2. Explicit typed columns + CHECK constraints (OQ-2) — T-002 (structural columns), T-003 (CHECK + backfill, extras carril 018).
3. extra_days canonical unit (OQ-3) — T-004 Zod schema; T-010 admin form converts months to days at UI layer.
4. MP amount-mutation primary, refunds VETOED (OQ-4) — T-001 spike verifies; T-007 implements only if Outcome A; Outcome B = redesign surface, no silent fallback.
5. Annual sub trial-extension: extend if in trial, reject if past trial (OQ-5) — T-006 service, T-009 API.
