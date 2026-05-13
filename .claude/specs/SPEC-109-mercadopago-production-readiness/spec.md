---
spec-id: SPEC-109
title: MercadoPago Production Readiness — full toggle, code hardening, homologation
type: feat
complexity: high
status: draft
created: 2026-05-13T06:00:00Z
effort_estimate_hours: 12-24
tags: [billing, mercadopago, production, security, qzpay, checkout, subscriptions, homologation]
extracted_from: SPEC-103 T-004 + T-005 (deferred 2026-05-13 after pre-toggle audit revealed gaps)
priority: high (pre-public-launch critical path)
---

# SPEC-109: MercadoPago Production Readiness

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Take Hospeda's MercadoPago integration from the current sandbox state to a fully production-ready state, including: (a) all credentials and env vars configured correctly, (b) all gaps from the 14-item MP quality checklist closed in Hospeda code, (c) qzpay-mercadopago library code audited and gaps reported/fixed upstream, (d) end-to-end smoke validated in staging AND prod, (e) first real production payment generated to unlock MP homologation, (f) homologation process initiated.

**Why now:** Critical path for public launch. Users will not be able to subscribe, change plans, or buy addons unless MP is in production mode. Toggling MP without closing the audit gaps will degrade approval rates (MP's fraud engine flags missing `payer` fields) and force re-work after homologation feedback. Better to do it once, cleanly.

**Why a new spec (not SPEC-103 T-004/T-005):** The original T-004 was "flip the env var + smoke a purchase". The pre-toggle audit (2026-05-13) revealed:
- 4 mandatory MP quality fields missing in Hospeda's only direct preference construction (`addon.checkout.ts`)
- `external_reference` uses `Date.now()` — not retry-safe / not idempotency-key compatible
- No `X-Idempotency-Key` header on `preferenceClient.create()` (double-click → duplicate preferences)
- Webhook signature middleware silently skips when secret unset (defense-in-depth gap)
- Subscriptions / preapproval path is built INSIDE qzpay-mercadopago (external library) — invisible to Hospeda audit unless the library code is granted access
- Verification of MP merchant account (KYC, bank account / CBU) status not confirmed

These extend the work well beyond a simple env-var flip. Wrapping it all under SPEC-103 would balloon that spec; isolating to SPEC-109 lets it have its own design + test plan.

**Audience:** Solo developer (qazuor) with paired-up agent. Likely 2-3 working sessions: code audit + fix (1 session), staging smoke (1 session), prod toggle + homologation (1 session).

---

### 2. Out of Scope

- Migration to a different payment provider (Stripe, Decidir, Modo, etc.).
- New payment flows beyond what Hospeda already supports: addon purchase (Checkout Pro) and subscription preapproval.
- Marketplace / multi-vendor splits (Hospeda is single-merchant).
- PCI-DSS audit (MP-hosted checkout means Hospeda is SAQ-A, no card data on Hospeda servers).
- Brazilian, Chilean, etc. MP variants (Hospeda is ARS / MLA only at launch).

---

### 3. Investigation & Implementation Approach

#### Phase 0 — Pre-checks (account-side)

- Confirm the MercadoPago merchant account is KYC-complete (identity verification passed).
- Confirm bank account (CBU) is registered for receiving payments.
- Confirm the MP **application** (developer panel → Tus integraciones → app Hospeda) has Industria + Sitio web filled.
- Confirm SSL certificate is valid on `api.hospeda.com.ar` AND `hospeda.com.ar` (already via Cloudflare + Let's Encrypt).
- Identify the prod webhook URL: `https://api.hospeda.com.ar/api/v1/webhooks/mercadopago`.

#### Phase 1 — Code hardening (Hospeda side)

Target file: `apps/api/src/services/addon.checkout.ts` lines 223-279 (only direct MP preference construction in Hospeda).

Fixes (each is a focused commit with unit tests):

| # | Gap | Fix |
|---|---|---|
| 1 | `payer.email` missing | Pull from `customer.email` (already loaded at L108-115) |
| 2 | `payer.first_name` missing | Split `customer.metadata?.name` on first space; fallback to email local-part |
| 3 | `payer.last_name` missing | Split remainder of `customer.metadata?.name`; fallback to a space (MP rejects empty) |
| 4 | `items.category_id` missing | Hardcode `'services'` (MP category for digital SaaS) |
| 5 | `external_reference` uses `Date.now()` | Generate a UUID before MP call, store in checkout session, reuse on retries |
| 6 | No `X-Idempotency-Key` | Pass `{ requestOptions: { idempotencyKey: <uuid> } }` (same UUID as #5) |
| 7 | `statement_descriptor` hardcoded `'HOSPEDA'` | Verify ≤11 chars + ASCII uppercase. Move to env or billing config for runtime tunability |
| 8 | Webhook middleware silently passes through when secret unset | Make it throw HTTP 503 in `NODE_ENV=production` even though adapter factory also enforces |

#### Phase 2 — qzpay-mercadopago library audit (upstream)

User to grant access to the qzpay-mercadopago / qzpay-hono codebase. Verify that the preapproval (subscription) request includes:

- `payer.email` (or equivalent — MP preapproval uses a different shape than Checkout Pro)
- `external_reference` mapped to Hospeda's internal subscription ID
- `back_url` for post-checkout redirect
- `notification_url` for webhooks (per-preapproval, not just globally)
- `reason` (subscription product name, equivalent of `items.title`)
- Correct frequency / repetitions for monthly recurrence
- Idempotency handling on `preapproval.create()`

If gaps found, decide: fix upstream in qzpay-mercadopago (preferred — benefits all consumers) OR fork to `@hospeda/qzpay-mercadopago-patched` (last resort).

#### Phase 3 — Env vars + Coolify configuration

- `hops env-list api --target=prod | grep -iE "mercado|mp_"` — inventory current state
- Replace test values with prod equivalents via `hops env-set` (per-key, with confirmation):
  - `HOSPEDA_MERCADO_PAGO_SANDBOX=false`
  - `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN=APP_USR-<prod>`
  - `HOSPEDA_MERCADO_PAGO_PUBLIC_KEY=APP_USR-<prod>`
  - `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET=<prod webhook signing secret>`
  - (Any other MP-related env vars surfaced in inventory)
- For staging, decide: separate prod-MP creds or share prod creds? Recommendation: **share prod creds** (so staging exercises real prod path). Risk: anyone testing in staging makes real payments. Mitigation: staging is internal-only.
- Webhook URL in MP panel: configure `https://api.hospeda.com.ar/api/v1/webhooks/mercadopago` for prod; `https://staging-api.hospeda.com.ar/api/v1/webhooks/mercadopago` if staging uses separate creds.

#### Phase 4 — Staging smoke

- Redeploy hospeda-api-staging with prod MP creds (or with a staging-mode flag if separate creds).
- Verify boot logs: `QZPayBilling initialized {"livemode":true,...}` (currently `livemode: false`).
- Smoke addon checkout end-to-end on `staging.hospeda.com.ar`: pick a low-value addon (~$100 ARS), complete with operator's real card.
- Verify: preference created, redirect to MP page, payment approved, webhook received, signature validated, addon entitlement granted.
- Verify in MP merchant dashboard the payment landed with all `payer` + `items.category_id` fields populated.
- Smoke subscription preapproval end-to-end (plan-change or trial conversion).
- If any failure: pause, fix, re-smoke. Do NOT proceed to prod toggle until staging is green.

#### Phase 5 — Prod toggle

- Defensive prod DB backup: `hops db-backup-now --yes` (or use the daily script directly for encryption).
- Apply prod MP creds to hospeda-api-prod.
- Redeploy. Verify boot logs: `livemode:true`.
- Smoke ONE real addon purchase from operator account (~$100 ARS). Verify on MP dashboard.
- Smoke ONE subscription preapproval. Verify.
- Refund the smoke payments via MP dashboard.
- **Capture the payment_id** of the smoke purchase — this is what unlocks homologation.

#### Phase 6 — Homologation initiation

- MP panel → Tus integraciones → app Hospeda → **Evaluar calidad / Medición de calidad**.
- Manual evaluation: submit the smoke payment_id.
- Read MP's quality feedback. If any items flagged red:
  - Confirm vs our Phase 1 fixes — should be aligned.
  - If new items, decide: fix now or accept for v1.
- Re-measure after fixes (manual flow allows on-demand re-eval).
- Optionally enable **Automatic monthly evaluation** (runs 1-7 of each month using existing prod payments).

#### Phase 7 — Documentation + monitoring

- `docs/migration/mercadopago-production-runbook.md`: full runbook from "credentials in hand" to "homologated". Include rollback path (flip `HOSPEDA_MERCADO_PAGO_SANDBOX=true` + redeploy).
- Monitor first 48h of prod payments via Sentry + MP dashboard. Alert thresholds:
  - Approval rate < 70% → investigate fraud engine flags
  - Webhook signature failures > 1% → investigate timestamp drift / secret rotation
  - Preference creation errors > 0.5% → investigate idempotency / network issues

---

### 4. Tasks (open until investigation produces concrete sub-tasks)

| Task | Title | Phase | Status |
|---|---|---|---|
| T-109-01 | Confirm MP merchant account KYC + CBU status | 0 | pending |
| T-109-02 | Confirm MP app metadata (industria + sitio web) filled | 0 | pending |
| T-109-03 | Add `payer.email/first_name/last_name` to addon preference | 1 | pending |
| T-109-04 | Add `items.category_id='services'` to addon preference | 1 | pending |
| T-109-05 | UUID + idempotency key on preference creation | 1 | pending |
| T-109-06 | Statement descriptor: verify format, move to config | 1 | pending |
| T-109-07 | Webhook middleware: throw 503 in prod when secret unset | 1 | pending |
| T-109-08 | Audit qzpay-mercadopago preapproval payload (user grants access) | 2 | pending |
| T-109-09 | Inventory + plan env var changes for prod toggle | 3 | pending |
| T-109-10 | Apply prod MP env vars to staging (livemode=true smoke env) | 3 | pending |
| T-109-11 | Apply prod MP env vars to prod | 3 | pending |
| T-109-12 | Staging smoke: addon checkout end-to-end | 4 | pending |
| T-109-13 | Staging smoke: subscription preapproval end-to-end | 4 | pending |
| T-109-14 | Prod toggle: addon smoke + refund | 5 | pending |
| T-109-15 | Prod toggle: subscription smoke + cancel | 5 | pending |
| T-109-16 | Submit payment_id to MP homologation (manual evaluation) | 6 | pending |
| T-109-17 | Fix any homologation findings, re-measure | 6 | pending |
| T-109-18 | Write production runbook | 7 | pending |
| T-109-19 | Monitor first 48h prod payments + tune alerts | 7 | pending |

---

### 5. Risks

| Risk | Mitigation |
|---|---|
| MP merchant account not fully verified → "Activar credenciales productivas" fails | Phase 0 confirms KYC + CBU before Phase 3 |
| Real money charged during smoke purchases | Use operator's own card; refund within MP dashboard within 24h; cap at ~$100 ARS per smoke |
| qzpay-mercadopago has un-fixable gaps in preapproval | Fork as last resort; in the meantime mark `T-109-13` (subscription smoke) as accept-with-known-gap and document |
| Homologation flags items we did not anticipate | Phase 6 is iterative; allow 1-3 re-measure cycles before declaring homologated |
| Webhook URL drift between MP panel and Coolify env vars | Lock both to `https://api.hospeda.com.ar/api/v1/webhooks/mercadopago` in the runbook; verify on every redeploy |
| Approval rate drops after toggle because of fraud engine | Phase 1 closes payer-data gaps proactively; monitor in Phase 7; rollback path documented |

---

### 6. Acceptance Criteria

- [ ] `HOSPEDA_MERCADO_PAGO_SANDBOX=false` on hospeda-api-prod
- [ ] `livemode:true` confirmed in api-prod boot logs
- [ ] At least 1 real addon purchase processed end-to-end (preference → payment approved → webhook → entitlement)
- [ ] At least 1 real subscription preapproval processed end-to-end (preapproval → first charge → webhook → entitlement)
- [ ] All 14 MP quality items populated in addon checkout (Hospeda code)
- [ ] qzpay-mercadopago preapproval audit completed with findings documented; any blocking gaps fixed or formally accepted
- [ ] Homologation submitted with smoke payment_id; passing or with documented accept-list
- [ ] Production runbook committed to `docs/migration/mercadopago-production-runbook.md`
- [ ] 48-hour observation completed without payment approval rate dropping below baseline

---

## Part 2 — Implementation Notes

### Source

Extracted from SPEC-103 T-004 + T-005 on 2026-05-13. Pre-toggle audit (engram topic: `spec/SPEC-109/pre-toggle-audit-2026-05-13`) revealed the original 2-task scope (flip env + smoke) understated the work by ~10x.

### Cross-spec dependencies

- **SPEC-079** (Redis rate-limit backend, meta) — related but independent. MP webhook endpoint has its own rate-limit considerations.
- **SPEC-103 T-004 / T-005** — superseded by this spec.
- **SPEC-106** (rate-limiter IP extraction fix) — independent.

### When to start

ASAP. Public launch waits on this. Suggested ordering for SPEC-109:

1. Phase 0 + 1 + 2 (Hospeda code hardening + qzpay audit) — can run in parallel after operator grants library access.
2. Phase 3 + 4 (staging end-to-end with prod creds) — single session, several hours.
3. Phase 5 + 6 (prod toggle + homologation submission) — single session, ideally morning so MP support is responsive if anything fails.
4. Phase 7 (docs + monitoring) — across following days.

### Engram references

- `spec/SPEC-103/t-086-redis-verify` — discovered redis is used; rate-limiter has a separate bug (SPEC-106) unrelated to MP
- `spec/SPEC-109/pre-toggle-audit-2026-05-13` (to be saved) — full pre-toggle audit findings
- `vps-migration/cluster-topology` — confirms hospeda-api-prod + hospeda-api-staging are separate containers; staging can do livemode smoke without contaminating prod
- `gotcha_mercadopago_credentials` — both test and prod use APP_USR- prefix; mode determined ONLY by sandbox env var
- `gotcha_mercadopago_test_credentials_architecture` — test user tokens cannot call /v1/customers; QZPay's providerSyncErrorStrategy:log handles gracefully
