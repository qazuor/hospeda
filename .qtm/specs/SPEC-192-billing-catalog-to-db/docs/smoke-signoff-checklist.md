# SPEC-192 — Smoke Sign-off Checklist (merge gate)

> **Why this exists.** SPEC-192 cut over the billing addon catalog and residual
> plan/promo reads from config to DB. FR-2 touched the MercadoPago webhook
> (`payment-logic.ts`, T-016) and the addon-expiry cron (T-015), which are
> **billing CORE** per the project rule in `CLAUDE.md` ("Billing testing —
> manual smoke checklist required (SPEC-143)"). The vitest suite uses an MP
> stub, so the staging smoke against the real MP sandbox is the merge gate,
> and the prod smoke is the go-live gate.

Reference checklists:

- Staging: [`.qtm/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md`](../../SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md)
- Production: [`.qtm/specs/SPEC-143-billing-testing-coverage/docs/prod-smoke-checklist.md`](../../SPEC-143-billing-testing-coverage/docs/prod-smoke-checklist.md)
- MP cards: [`.qtm/specs/SPEC-143-billing-testing-coverage/docs/mp-test-cards-reference.md`](../../SPEC-143-billing-testing-coverage/docs/mp-test-cards-reference.md)

## Staging sections required before merging the SPEC-192 PR

Run against `https://staging.hospeda.com.ar` with the MP sandbox credentials
configured on `hospeda-api-staging`. File the sign-off entry inside each
section of the SPEC-143 checklist (date, executor, PR number, result, notes)
and reference it from the PR description.

| Section | Why SPEC-192 requires it |
|---------|--------------------------|
| 1.1 — Annual checkout (happy path) | Plan resolution in `subscription-checkout.service.ts` now resolves plans via `PlanService` (DB) instead of config (FR-4, T-022/T-023). |
| 1.2 — Monthly checkout (happy path) | Same plan-resolution cutover as 1.1, monthly price row path (`billing_prices`). |
| 1.7 — Addon purchase | Addon catalog reads in the purchase path are DB-backed (`AddonCatalogService`, FR-1/FR-2). Note: `addon.checkout.ts` itself is NOT cut over (see `deferred-checkout-cutover.md`) — this section validates the surrounding DB-backed reads. |
| 1.8 — Webhook idempotency | `payment-logic.ts` (T-016) resolves addons from DB inside the MP webhook. HIGHEST RISK — real money path. |
| 1.9 — Webhook signature validation | Same file as 1.8; confirms the cutover did not disturb signature handling. |
| 1.10 — Failed payment webhook (past_due) | Webhook addon/plan resolution on the failure path. |
| 1.11 — Webhook concurrency | DB-backed resolution under concurrent webhook delivery (catalog reads are per-request now). |
| 1.14 — Entitlement load post-activation | `entitlement.ts` middleware plan lookup cut over to `PlanService` with 5-min promise memoization (T-024). |
| 1.15 — Entitlements & limits FACTUALLY APPLIED | End-to-end proof that DB-resolved plans/addons produce the same effective entitlements/limits as the old config path. |
| 2.5 — Addon expiry / cancel | `addon-expiry.job.ts` cron cut over to `AddonCatalogService` (T-015). |
| 3.1 — Promo code apply / validate / expire | `DEFAULT_PROMO_CODES` scoped to seed/startup (T-029); validates request-time promo reads go through `PromoCodeService`. |
| 3.5 — Admin billing ops | New admin addon CRUD routes + UI (FR-3, T-018/T-019/T-021): create/update/toggle/soft-delete/restore/hard-delete with audit logging. |

### Sign-off log (staging)

| Date | Executor | PR | Sections run | Result | Notes |
|------|----------|----|--------------|--------|-------|
| _deferred_ | owner | #1428 | MP-dependent sections (1.1, 1.2, 1.7, 1.8–1.11, 2.5 timing) | DEFERRED | Owner decision 2026-06-04: staging smoke batched at the end of the SPEC-193 billing series, before the staging → main promotion. `main` stays frozen for billing until then. |

## Local complementary evidence (2026-06-04, executor: claude + owner approval, PR #1428)

MP-independent sections were executed locally against the worktree (API :3011,
admin :3013, web :4321, dev DB) with seeded test users. This does NOT replace
the staging smoke for MP-dependent sections — it narrows what the batched
staging run must cover.

| Section | Result | Evidence |
|---------|--------|----------|
| 1.14 — Entitlement load | ✅ PASS (local) | `GET /users/me/entitlements` as `host-basico@local.test` returns exactly the owner-basico matrix: 6 entitlements (publish, edit, basic stats, respond reviews, calendar, whatsapp display) + limits `{max_accommodations: 1, max_active_promotions: 0, max_photos_per_accommodation: 5}` resolved from the DB plan. Second call served warm (24ms vs 93ms). |
| 1.15-A1 — MAX_ACCOMMODATIONS=1 | ✅ PASS (local) | 1st `POST /accommodations/draft` → 201; 2nd → 403 `LIMIT_REACHED` with `details: {limitKey: max_accommodations, currentCount: 1, maxAllowed: 1, usagePercent: 100}` and localized message. Smoke row removed afterwards. |
| 1.15-A3 — MAX_ACTIVE_PROMOTIONS=0 | ✅ PASS (local) | `POST /owner-promotions` → 403 `LIMIT_REACHED` `{limitKey: max_active_promotions, maxAllowed: 0}`. |
| 1.15-A2 — MAX_PHOTOS | ⏭️ SKIPPED (local) | Requires real media upload infra (Cloudinary); deferred to staging batch. |
| 1.15-B5/B7 — stats/calendar endpoints | ⚠️ N/A | Endpoints do not exist under `/protected/accommodations` — consistent with the documented gate-wiring hypothesis (engram `billing/entitlement-enforcement-gap-hypothesis`, SPEC-145 scope). Not a SPEC-192 regression. |
| 3.1 — Promo codes (read path) | ✅ PASS (local) | `GET /protected/billing/promo-codes` returns the 4 seeded codes from DB incl. `HOSPEDA_FREE` (T-029 startup path). Apply-at-checkout deferred to staging (MP). |
| 3.5 — Admin addon ops | ✅ PASS (local) | Full cycle via admin UI as SUPER_ADMIN: create → deactivate → soft-delete → show-deleted → restore → soft-delete → hard-delete. All toasts/dialogs correct (new i18n keys verified). `billing_audit_logs` recorded all 6 actions (`addon_created/deactivated/soft_deleted/restored/soft_deleted/hard_deleted`). Catalog restored to its original 5 addons. SPEC-182 auth flow (web signin → admin) also exercised. |

**Environmental findings during local run (NOT SPEC-192, for owner awareness):**

1. Dev DB schema drift vs branch: `user_permission` lacks the `effect` column
   (SPEC-170 migration unapplied) — logs a DB error per request, graceful
   fallback; and `accommodations.findOneWithRelations` fails on newer columns
   (soft-delete via API 500s locally). Fix: run `pnpm db:migrate` on the dev DB.
2. Local API needs `HOSPEDA_MERCADO_PAGO_*` (prefixed) env vars; the dev
   `.env.local` still has the unprefixed legacy names, so billing-gated routes
   503 until provided (SPEC-035 no-aliasing policy).
3. Admin local dev now requires `VITE_ADMIN_URL` (post-SPEC-180/182 sync) and
   has no own signin page (SPEC-182): login happens on the web app.

## Production sections required (billing CORE gate, go-live)

SPEC-192 changes the webhook and cron paths, so the prod smoke is mandatory
before the staging → main promotion that ships this spec.

| Flow | Why |
|------|-----|
| Flow 1 — Annual checkout (production) | DB-backed plan resolution in the real checkout. |
| Flow 2 — Monthly checkout (production) | Monthly price row resolution from `billing_prices`. |
| Flow 3 — Addon purchase (production) | DB-backed addon catalog in the real purchase + webhook path. |

### Sign-off log (production)

| Date | Executor | PR | Flows run | Result | Notes |
|------|----------|----|-----------|--------|-------|
| _pending_ | | | | | |

## Rules

1. Failed smokes **block merge**.
2. Notes-only passes (smoke surfaces a known documented bug with an engram
   entry) can merge, but the bug entry must be linked from the PR.
3. CI green is required **in addition to** the smoke sign-off, never instead
   of it.
