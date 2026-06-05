# SPEC-193 — Pending staging-smoke batch (cumulative)

> **Why this exists.** Owner decision (2026-06-04): instead of running the
> SPEC-143 staging smoke per billing PR, the MP-dependent sections are
> BATCHED and executed once at the end of the SPEC-193 billing series,
> before the staging → main promotion. Conditions:
>
> 1. `main` stays FROZEN for billing changes until this batch passes.
> 2. Every merged billing PR adds its deferred sections to this list.
> 3. Each PR documents the deferral in its own smoke-signoff doc.
>
> Reference checklists: [`SPEC-143 staging`](../../SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md)
> · [`SPEC-143 prod`](../../SPEC-143-billing-testing-coverage/docs/prod-smoke-checklist.md)

## Accumulated sections to run (staging, MP sandbox)

| Added by | PR | Sections | Notes |
|----------|----|----------|-------|
| SPEC-192 (catalog to DB) | #1428 | 1.1, 1.2 (checkout happy paths), 1.7 (addon purchase), 1.8–1.11 (webhooks: idempotency, signature, past_due, concurrency), 1.15-A2 (photo limit — needs media infra), 2.5 (addon-expiry cron, production-like timing), 3.1 (promo apply at checkout) | MP-independent sections (1.14, 1.15-A1/A3, 3.1 read path, 3.5 admin ops) already PASSED locally — see [SPEC-192 sign-off](../../SPEC-192-billing-catalog-to-db/docs/smoke-signoff-checklist.md). Highest risk: webhook `payment-logic.ts` + cron cutovers. |
| SPEC-127 (addon checkout → qzpay) | #1448 | 1.7 (addon purchase — full flow: checkout create via qzpay, MP redirect, webhook confirm; verify metadata duals + `order_id` arrive, `external_reference` is the qzpay session UUID), 1.8 (webhook idempotency — addon paymentId dedup), 3.1 (promo apply on addon checkout incl. 100% discount → zero-amount preference acceptance), NEW: addon polling fallback (block the webhook, verify the `one_time_payment` polling job confirms the purchase within the poll window; verify webhook+polling race stays idempotent) | Billing CORE (checkout + webhook + cron paths rewritten). Intentional behavior changes to verify live: prod-first init point selection (sandbox URL must still be used in sandbox mode), removed `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` guard. Deferral sign-off: [SPEC-192 deferred-checkout-cutover](../../SPEC-192-billing-catalog-to-db/docs/deferred-checkout-cutover.md). |
| SPEC-194 (lifecycle robustness) | #1455 | NEW: refund lifecycle (admin full refund → sub cancelled + entitlements revoked + cache cleared; partial refund → `refunded_amount` accumulates, sub stays active; accumulated partials reaching total → cancels; refund of an ADDON payment must NOT cancel the subscription; webhook-sourced refund applies the same policy), 2.x crons production-like timing: trial-expiry (lock claim + TRIAL_EXPIRED email now actually sends), dunning non-payment cancel (entitlement cache cleared — re-check access right after), scheduled plan-change apply (no double-apply on bookkeeping retry), addon-expiry (notification gap closed + Phase 7 grant reconciliation), abandoned-pending-subs (sub marked `abandoned` + user notification), NEW: annual sub pause → clear 400 PAUSE_NOT_SUPPORTED_FOR_ANNUAL, NEW: checkout return URLs respect user language | Billing CORE (refund/dunning/trial/scheduled-change rewritten on the new state-machine). ⚠️ PRE-SMOKE deploy step: `hops db-apply-extras --target=staging` (extras migration 010 canonicalizes `incomplete_expired` → `abandoned`). Adversarial review fixed 2 blockers + 4 majors pre-merge. |

## Go-live gate (prod smoke)

Prod Flows 1–3 (annual checkout, monthly checkout, addon purchase) remain
the staging → main promotion gate, unchanged.

## Sign-off log (batch run)

| Date | Executor | Sections run | Result | Notes |
|------|----------|--------------|--------|-------|
| _pending_ | | | | |
