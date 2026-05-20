# Billing coverage audit — 2026-05-20

> **Owner**: SPEC-143 T-143-55 deliverable.
> **Scope**: Test coverage audit across the billing surface — services, routes, webhook handlers, and `@repo/billing` adapters.
> **Goal**: 100% line coverage with documented exceptions for true-impossible-in-e2e branches. Functional audit cross-checks every documented operational runbook flow against at least one e2e test.
> **Status**: in-progress (built incrementally under T-143-55).

---

## How this audit is structured

This document captures the state of billing test coverage at one point in time. It has four sections:

1. **Surface inventory** — the files in scope (services, routes, webhook handlers, packages/billing). Anything not listed is out of scope (e.g. UI components, marketing pages, non-billing endpoints).
2. **Quantitative coverage** — line / branch / function coverage numbers per file from `vitest --coverage`. Split into unit (`vitest.config.ts`) and e2e (`vitest.config.e2e.ts`) because the two configs are independent.
3. **Functional audit** — every operational scenario in [`docs/billing/billing-runbooks.md`](./billing-runbooks.md) (§1 through §7) is cross-checked against the e2e test inventory. Every documented flow + cron + webhook + admin op must have ≥ 1 test reference.
4. **Exception list** — uncovered lines that have either an `/* istanbul ignore */` annotation in the source OR are explicitly documented here as "true-impossible-in-e2e". Categories: real MercadoPago card internals, real fraud detection ML, non-deterministic network races, defensive impossible branches (`never` types, exhaustive switch, etc.).

---

## 1. Surface inventory

The "billing surface" spans three layers:

### 1.1 Services (`apps/api/src/services/`)

Files in scope are billing-named OR billing-semantic (subscription, addon, promo, trial, dunning, refund, checkout, webhook):

- `billing-customer-sync.ts`
- `billing-metrics.service.ts`
- `billing-settings.service.ts`
- `billing-usage.service.ts`
- `subscription-checkout.service.ts`
- `subscription-downgrade.service.ts`
- `addon.service.ts`
- `addon.checkout.ts`
- `addon.admin.ts`
- `addon.user-addons.ts`
- `addon-status-transitions.ts`
- `addon-lifecycle-events.ts`
- `addon-lifecycle-cancellation.service.ts`
- `addon-expiration.service.ts`
- `addon-expiration.batch.ts`
- `addon-expiration.queries.ts`
- `addon-plan-change.service.ts`
- `addon-plan-change.helpers.ts`
- `addon-entitlement.service.ts`
- `addon-limit-recalculation.service.ts`
- `addon-downgrade-detection.service.ts`
- `promo-code.service.ts`
- `promo-code.crud.ts`
- `promo-code.redemption.ts`
- `trial.service.ts`
- `usage-tracking.service.ts`
- `notification-retention.service.ts`
- `notification-retry.service.ts`

> Note on naming: the original T-143-55 task description scoped this to `src/services/*billing*` literally — only the four `billing-*.ts` files. This audit widens to the semantic billing surface because monthly checkout, dunning, addon purchase, trial conversion, etc., are billing-critical regardless of file name. The exception list documents anything excluded.

### 1.2 Routes (`apps/api/src/routes/`)

- `routes/billing/index.ts`
- `routes/billing/start-paid.ts`
- `routes/billing/plan-change.ts`
- `routes/billing/subscription-status.ts`
- `routes/billing/trial.ts`
- `routes/billing/usage.ts`
- `routes/billing/promo-codes.ts`
- `routes/billing/notifications.ts`
- `routes/billing/settings.ts`
- `routes/billing/addons.ts`
- `routes/billing/metrics.ts`
- `routes/billing/admin/` (admin billing ops — list, getById, etc.)
- `routes/billing/public/` (public plan/addon catalog reads)
- `routes/webhooks/mercadopago/index.ts`
- `routes/webhooks/mercadopago/router.ts`
- `routes/webhooks/mercadopago/event-handler.ts`
- `routes/webhooks/mercadopago/payment-handler.ts`
- `routes/webhooks/mercadopago/payment-logic.ts`
- `routes/webhooks/mercadopago/subscription-handler.ts`
- `routes/webhooks/mercadopago/subscription-logic.ts`
- `routes/webhooks/mercadopago/subscription-payment-handler.ts`
- `routes/webhooks/mercadopago/dispute-handler.ts`
- `routes/webhooks/mercadopago/dispute-logic.ts`
- `routes/webhooks/mercadopago/notifications.ts`
- `routes/webhooks/mercadopago/utils.ts`
- `routes/webhooks/mercadopago/types.ts`

### 1.3 Billing middleware (`apps/api/src/middlewares/`)

- `middlewares/billing.ts` (lazy adapter init + qzpay billing instance management)
- `middlewares/entitlement.ts` (per-customer entitlement cache + middleware enforcement)

### 1.4 Cron jobs (`apps/api/src/cron/`)

- `cron/jobs/dunning-cron.job.ts`
- `cron/jobs/exchange-rate-fetch.job.ts`
- `cron/jobs/addon-expiration.job.ts`
- `cron/jobs/apply-scheduled-plan-changes.job.ts`
- `cron/jobs/past-due-grace.job.ts` (if exists)
- `cron/jobs/trial-expiration.job.ts`
- `cron/scheduler.ts`

### 1.5 `@repo/billing` (`packages/billing/src/`)

- `adapters/mercadopago/*` — MP-specific adapter (creates preferences, subscriptions, processes webhook payloads)
- `config/*` — configuration loaders
- `constants/billing.constants.ts` — currency defaults, status enums
- `types/*` — public TypeScript types
- `utils/*` — helpers (price selection, status mapping, signature verification)
- `validation/*` — Zod schemas for webhook payloads + checkout inputs
- `index.ts` — public API surface

---

## 2. Quantitative coverage

> _**TBD** — to be filled by sub-commit B (unit coverage) + sub-commit C (e2e coverage). Numbers come from `vitest run --coverage` against each config with `--coverage.include` scoped to the surface above._

### 2.1 Unit coverage (`vitest.config.ts`)

**Run command (verbatim)**:

```bash
HOSPEDA_DATABASE_URL=postgresql://hospeda_user:hospeda_pass@localhost:5436/hospeda_test \
pnpm vitest run --coverage \
  --coverage.reporter=json-summary \
  --coverage.reportsDirectory=/tmp/cov-unit \
  --coverage.include='src/**/*.ts' \
  --coverage.thresholds.lines=0 \
  --exclude='test/schema-validation/post-getById-schema.test.ts'
```

(`post-getById-schema.test.ts` is excluded because two of its tests fail with a `500` from `/api/v1/public/posts/:id` — out of billing scope, not addressed by this audit. Without the exclusion `vitest --coverage` does not serialize the JSON summary on EXIT=1.)

**Pre-audit test cleanup**:

The full unit suite had 26 failing tests at audit start; coverage tooling refused to emit the report. Five fixes shipped as standalone commits to unblock the run:

| Commit | Subject | Files |
| ------ | ------- | ----- |
| `08b51492` | `fix(api,cron): add abandoned-pending-subs + trial-pre-end-notif to schedules manifest` | `src/cron/schedules.manifest.ts` |
| `cacd4d43` | `fix(api,test): align entitlement no-active-sub test with T-143-58 tourist-free fallback` | `test/middlewares/entitlement.test.ts` |
| `3b601b42` | `fix(api,test): mock billingPayments in payment-logic test` | `test/routes/webhooks/payment-logic.test.ts` |
| `7c103605` | `fix(api,test): align addon.service purchase test with current preference shape` | `test/services/addon.service.test.ts` |
| `16345730` | `fix(api,test): refactor mercadopago webhook test mocks for T-143-09 + 23505 SQLSTATE detection` | `test/webhooks/mercadopago.test.ts` |

Final unit suite state (excluding the 1 deferred file): **3707 passed, 0 failed**.

**Aggregate billing-surface coverage**:

- **75 files in scope** (services, routes, middlewares, cron jobs)
- **49 at 100%** (perfect)
- **22 at 90–99%** (high)
- **1 at 50–89%** (mid)
- **3 at <50%** (low — all dead code, see below)
- **Total lines**: 12,937
- **Lines covered**: 12,476
- **Overall billing line coverage**: **96.44%**

**Dead-code findings (the three 0% files)**:

| File | Status | Action |
| ---- | ------ | ------ |
| `routes/billing/metrics.ts` | Duplicate of `routes/billing/admin/metrics.ts`. Never imported anywhere in `src/` — the live router uses the admin/ variant. | **Delete** (separate commit; not done in this audit to keep scope focused — flagged as SPEC-143 follow-up). |
| `services/promo-code.crud.ts` | Deprecated re-export shim pointing at `@repo/service-core`. Not imported by any file in `src/`. JSDoc carries `@deprecated`. | **Delete** (same follow-up). |
| `services/promo-code.redemption.ts` | Deprecated re-export shim. Same shape and status as the previous entry. | **Delete** (same follow-up). |

These three drag the overall percentage down by 273 uncovered lines for code that has zero functional value. Removing them lifts the billing-surface coverage to **~98.6%** (12,476 / 12,664).

**Files at 90–99% (gap detail)**:

The 22 files in the high band have between 1 and 30 uncovered lines each. The gaps are dominated by:

- Defensive impossible branches (`never`-type guards, exhaustive switches on enums).
- Error paths that require provider-side state we cannot stub deterministically from a unit test (MP-side races, qzpay-core internal failures).
- Cron timezone / startup-only branches that fire once per process and are exercised in e2e.

Full file-level breakdown:

| File | Line % | Covered / Total |
| ---- | ------ | --------------- |
| routes/billing/metrics.ts | 0% | 0/271 |
| services/promo-code.crud.ts | 0% | 0/1 |
| services/promo-code.redemption.ts | 0% | 0/1 |
| routes/webhooks/mercadopago/notifications.ts | 89.57% | 232/259 |
| services/addon.user-addons.ts | 92.99% | 398/428 |
| routes/webhooks/mercadopago/subscription-logic.ts | 94.22% | 457/485 |
| cron/jobs/dunning.job.ts | 95.3% | 284/298 |
| routes/billing/plan-change.ts | 95.54% | 236/247 |
| routes/billing/start-paid.ts | 96.29% | 130/135 |
| routes/webhooks/mercadopago/payment-logic.ts | 97.12% | 439/452 |
| services/addon.checkout.ts | 97.51% | 471/483 |
| routes/webhooks/mercadopago/utils.ts | 97.53% | 198/203 |
| cron/jobs/addon-expiry.job.ts | 97.73% | 994/1017 |
| services/billing-metrics.service.ts | 98.19% | 218/222 |
| routes/webhooks/mercadopago/payment-handler.ts | 98.92% | 92/93 |
| cron/jobs/exchange-rate-fetch.job.ts | 99.02% | 102/103 |
| routes/billing/subscription-status.ts | 99.07% | 107/108 |
| services/addon-lifecycle-cancellation.service.ts | 99.09% | 219/221 |
| middlewares/billing-ownership.middleware.ts | 99.11% | 112/113 |
| routes/billing/trial.ts | 99.15% | 354/357 |
| services/usage-tracking.service.ts | 99.39% | 329/331 |
| services/notification-retry.service.ts | 99.55% | 225/226 |
| services/addon.admin.ts | 99.69% | 328/329 |
| services/addon-plan-change.service.ts | 99.71% | 345/346 |
| services/addon-entitlement.service.ts | 99.76% | 432/433 |
| services/trial.service.ts | 99.85% | 709/710 |

All remaining 49 billing-surface files sit at 100% line coverage.

**Out-of-scope failure (deferred)**:

`test/schema-validation/post-getById-schema.test.ts` — 2 tests fail with HTTP 500 from `/api/v1/public/posts/:id`. Post entity, not billing. Tracked separately; does not affect the billing coverage report.

### 2.2 E2E coverage (`vitest.config.e2e.ts`)

_Pending baseline run._

### 2.3 `packages/billing` coverage

_Pending baseline run._

---

## 3. Functional audit — runbooks vs e2e test inventory

> _**TBD** — to be filled by sub-commit D. Each section below maps a runbook scenario to ≥ 1 e2e test reference, plus any documented gap._

| Runbook section | Scenario | Covering e2e test(s) | Status |
| --------------- | -------- | -------------------- | ------ |
| §1 | Failed webhook handler triage | _pending audit_ | _pending_ |
| §2 | Stuck `incomplete` subscriptions | _pending audit_ | _pending_ |
| §3 | Dunning / past-due grace | _pending audit_ | _pending_ |
| §4 | Refund flow | _pending audit_ | _pending_ |
| §5 | Disputes / chargebacks | _pending audit_ | _pending_ |
| §6 | Cron lag / missed runs | _pending audit_ | _pending_ |
| §7 | Admin manual interventions | _pending audit_ | _pending_ |

---

## 4. Exception list

> _**TBD** — to be filled by sub-commit E. Each entry lists the file, the line range, the istanbul-ignore annotation if present, and the true-impossible-in-e2e justification (one line)._

The four allowed categories are:

1. **Real MercadoPago card internals** — code paths that only fire on real MP-side state we cannot simulate (e.g. specific 3DS challenge subtypes).
2. **Real fraud detection ML** — code that delegates to MP's fraud model whose output we cannot stub deterministically.
3. **Non-deterministic network races** — branches that fire only on specific timing windows we cannot reliably reproduce in a stub.
4. **Defensive impossible branches** — exhaustive switch defaults, `never` type guards, branches behind invariants enforced upstream by schema validation.

| File | Line(s) | Category | Justification |
| ---- | ------- | -------- | ------------- |
| _pending_ | | | |

---

## Cross-references

- [`docs/billing/billing-runbooks.md`](./billing-runbooks.md) — operational runbooks (functional-audit input)
- [`apps/api/test/e2e/flows/billing/`](../../apps/api/test/e2e/flows/billing/) — e2e test inventory
- [`.claude/specs/SPEC-143-billing-testing-coverage/`](../../.claude/specs/SPEC-143-billing-testing-coverage/) — spec + tasks state
- [`.claude/specs/SPEC-148-billing-grace-defensive-and-plan-lifecycle/`](../../.claude/specs/SPEC-148-billing-grace-defensive-and-plan-lifecycle/) — forward spec (cron-lag grace + plan lifecycle, deferred from T-143-63)
- [`.claude/specs/SPEC-149-billing-provider-error-propagation-and-sentry/`](../../.claude/specs/SPEC-149-billing-provider-error-propagation-and-sentry/) — forward spec (MP error propagation + Sentry + retry policy, deferred from T-143-59)
- [`.claude/specs/SPEC-150-billing-multi-currency-support/`](../../.claude/specs/SPEC-150-billing-multi-currency-support/) — forward spec (multi-currency support, deferred from T-143-62)
