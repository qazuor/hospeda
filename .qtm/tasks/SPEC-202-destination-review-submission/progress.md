# Progress: SPEC-202 — Destination Review Submission Flow

## 2026-06-06 — Implementation complete (17/18)

- Spec formalized, worktree created from origin/staging (406a11b1d).
- T-001..T-017 implemented and committed in 6 work-unit commits:
  - `5672827be` feat(db): unique index + dedup migration (0006_real_callisto.sql)
  - `be2dbef01` feat(schemas): DestinationReviewCreateBodySchema (strict, rejects userId/destinationId)
  - `e7dc63c28` feat(service-core): duplicate pre-check in _beforeCreate (ALREADY_EXISTS → 409)
  - `0ed7ce1cb` fix(api): userId derived from actor (impersonation gap closed) + security tests
  - `a8f161d1a` feat(i18n): 18 dimension keys + form/sidebar keys (es/en/pt)
  - `594666d10` feat(web): DestinationReviewSidebarCard island + SignInCta + page mount + tests
- Quality gate: typecheck 38/38 green; full test suite 46/46 green (service-core 4096 tests). `pnpm lint` fails in hospeda-api on STAGING BASELINE too (31 pre-existing warnings in billing tests) — SPEC-202 files lint clean.
- Adversarial review findings resolved:
  - Reviewer blocker "Zod v4 .omit() loses .strict()" REFUTED empirically (destination body schema rejects injected userId; test added). Collateral: accommodation body schema is NOT strict (pre-existing, not exploitable, saved as engram follow-up).
  - Major (soft-delete vs plain index mismatch → 500): user decided "blocked after soft-delete"; service guard aligned with the plain index (deletedAt filter removed → clean 409).
  - Minors fixed: submit disabled now includes !contentValid (+ inline hint via existing review.form.errors.contentMinLength); empty-string title/content schema tests added.

## Pending

- T-018: local e2e smoke (db migrate in worktree DB, submit → pending → approve → visible, duplicate 409, logged-out CTA).
- Open PR → staging after smoke.
