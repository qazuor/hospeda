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

## Go-live gate (prod smoke)

Prod Flows 1–3 (annual checkout, monthly checkout, addon purchase) remain
the staging → main promotion gate, unchanged.

## Sign-off log (batch run)

| Date | Executor | Sections run | Result | Notes |
|------|----------|--------------|--------|-------|
| _pending_ | | | | |
