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

_Pending baseline run._

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
