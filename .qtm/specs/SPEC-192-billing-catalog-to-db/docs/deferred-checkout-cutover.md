# Deferred cutover: `addon.checkout.ts` (blocked on SPEC-127)

## What is deferred

`apps/api/src/services/addon.checkout.ts` still reads the addon catalog from
config instead of the DB-backed `AddonCatalogService`:

- `import { ALL_PLANS, getAddonBySlug } from '@repo/billing'` (line ~12)
- `getAddonBySlug(input.addonSlug)` at the two checkout entry points
  (lines ~177 and ~469 as of the SPEC-192 branch)

Every other consumer of the addon catalog was cut over in SPEC-192 FR-2
(T-007..T-017). This file is the single intentional exception.

## Why it is deferred

SPEC-127 (qzpay migration) rewrites `addon.checkout.ts` in a different zone of
the same file (MercadoPago preference creation → qzpay checkout API). Cutting
over the catalog reads here in SPEC-192 would guarantee merge conflicts
between the two specs on a money-handling file. Decision recorded during
SPEC-192 task atomization (T-017 notes; see also the inline comment in
`apps/api/src/routes/billing/admin/qzpay-admin-hooks.ts` around line 50).

Because the config catalog and the DB catalog are seeded from the same source
and the seed respects runtime divergences (SPEC-168 policy), the residual
config read is **behavior-equivalent today** but will drift if an operator
edits addons via the new admin CRUD UI (FR-3) without updating config.
This makes the follow-up cutover time-sensitive once admin edits start
happening in production.

## The follow-up task

The cutover must be the FIRST task of either:

1. a SPEC-192 delta spec (preferred if SPEC-127 lands far in the future), or
2. the SPEC-127 closeout checklist (preferred if SPEC-127 is imminent —
   do the cutover in the same PR that rewrites the file).

Scope of the follow-up:

- Replace `getAddonBySlug(input.addonSlug)` with
  `AddonCatalogService.getBySlug()` (dual-resolve is not needed here — the
  checkout input is always a slug).
- Drop the `@repo/billing` catalog imports from the file.
- Parity regression test mirroring the FR-2 cutover tests
  (see `apps/api/src/routes/billing/admin/__tests__/qzpay-admin-hooks.cutover.test.ts`
  for the established pattern).
- Staging smoke section 1.7 (addon purchase) re-run — this is billing CORE.

## Constraint to respect

Both SPEC-127 and this follow-up touch `addon.checkout.ts` in different
zones. Whoever lands second must rebase over the first and re-run the
parity test plus the staging smoke. Do NOT parallelize the two changes.

## Resolution sign-off (2026-06-04)

**RESOLVED — cutover absorbed by SPEC-127** (option 2: same PR that
rewrites the file). PR [#1448](https://github.com/qazuor/hospeda/pull/1448),
branch `spec/SPEC-127-migrate-addon-checkout-to-qzpay`:

- `getAddonBySlug` → `AddonCatalogService.getBySlug()` at both entry
  points (commit `b7a1dcee1`); `@repo/billing` catalog imports fully
  removed from the file.
- Parity regression test added per the FR-2 pattern:
  `apps/api/test/services/addon.checkout.cutover.test.ts` (commit `8c6b6e862`).
- Staging smoke §1.7 (addon purchase): **deferred to the SPEC-193
  end-of-series batch** per owner decision 2026-06-04 — registered in
  [`SPEC-193 pending-staging-smoke`](../../SPEC-193-billing-go-live-readiness-master/docs/pending-staging-smoke.md).
  `main` stays frozen for billing until that batch passes.
