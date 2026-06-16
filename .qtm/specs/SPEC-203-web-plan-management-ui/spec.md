---
spec-id: SPEC-203
title: Self-serve plan management UI (web)
type: feature
complexity: medium
status: in-progress
created: 2026-06-06T00:00:00Z
parent: SPEC-193
depends_on: [SPEC-167, SPEC-147]
relates_to: [SPEC-145]
priority: medium
base: staging
worktree: spec/SPEC-203-web-plan-management-ui
---

# SPEC-203: Self-serve plan management UI (web)

> Draft created during SPEC-167 realign (decision D-4, owner 2026-06-06). Formalized 2026-06-15
> after the dependencies (SPEC-167, SPEC-147) both landed and a gap analysis of the existing web
> surface. See §9 Revision History.

## 1. Problem

Hosts cannot fully manage their subscription from the web app. The "My subscription" page exists
(`apps/web/src/pages/[lang]/mi-cuenta/suscripcion/index.astro` → `SubscriptionDashboard.client.tsx`)
and covers viewing the current plan, but it has NO plan-change flow and its cancel button only
redirects to email support. The plan-change (SPEC-167) and soft-cancel (SPEC-147) APIs are complete
but have no self-serve surface.

## 2. Current state (gap analysis, 2026-06-15)

| Flow | Status | Notes |
|------|--------|-------|
| View current subscription | DONE | `SubscriptionDashboard` → `GET /protected/users/me/subscription`. Plan, status, renewal, payment, invoices, pause/resume. i18n es/en/pt complete. |
| Plan change (upgrade/downgrade + preview + keepIds) | MISSING | Upgrade link is a plain `<a>` to the public pricing page. No plan picker, no preview, no keepIds selector, no scheduled-change state. |
| Cancel (SPEC-147 soft-cancel) | EMAIL-ONLY | Cancel button opens a modal that redirects to `info@hospeda.com`. The real `POST /subscriptions/:id/cancel` endpoint is never called. |

## 3. Architecture decision (D-1) — preview-first downgrade flow

The original sketch assumed "no new endpoints". SPEC-167 instead shipped a **schedule-first** contract:
the downgrade `restrictionPreview` is only returned by `POST .../change-plan` *after* the change is
scheduled. Showing the impact *before* the user commits would otherwise require scheduling-then-cancelling.

**Decision (owner-delegated 2026-06-15, "most robust + consistent"): preview-first via a dedicated
read endpoint.** Expose the already-existing `computeDowngradeExcess` service through a new
`GET /api/v1/protected/billing/subscriptions/downgrade-preview`. The UI calls it to render the impact
before the user picks `keepIds` and confirms. Rationale:

- **Single source of truth**: reuses `computeDowngradeExcess` (the exact logic the POST path runs).
  Rejected the client-side estimate option, which would duplicate plan-limit logic in the browser and
  drift from the backend.
- **Robust UX**: the user sees what gets restricted *before* committing to a sensitive downgrade.
  Rejected the schedule-first option (schedules first, previews after — forces a cancel-on-regret).
- The endpoint is a thin read wrapper over existing logic; widening SPEC-203's scope by one GET is
  itself part of formalizing the sketch.

## 4. Scope

### 4.1 Backend (1 new read endpoint)

- `GET /api/v1/protected/billing/subscriptions/downgrade-preview?targetPlan=<slug>`
  - Auth: protected tier; owner-scoped (actor.id). No entitlement gate (read-only informational).
  - Handler calls `computeDowngradeExcess({ userId: actor.id, targetPlanSlug })` →
    returns `DowngradePreview` (`packages/schemas/.../downgrade-preview.schema.ts`).
  - Adds an `endpoint-gate-matrix.md` row (SPEC-145 guard) with Decision = `none` + reason.
  - Tests + OpenAPI metadata.

### 4.2 Web API client (`apps/web/src/lib/api/endpoints-protected.ts`)

- New `billingApi.previewDowngrade({ targetPlan })` → calls the new GET, returns `DowngradePreview`.
- Fix `billingApi.changePlan()`: add `keepSelections?: KeepSelections`, send `X-Idempotency-Key`,
  correct the return type to the discriminated-union `PlanChangeResponse`
  (`active | scheduled | pending_payment`, with `restrictionPreview?` on `scheduled`).
- Fix `billingApi.cancelSubscription()`: it currently calls the WRONG endpoint
  (`DELETE /billing/subscriptions/:id` = QZPay hard-cancel). Repoint to the SPEC-147 soft-cancel
  `POST /billing/subscriptions/:id/cancel` with `{ reason?: string }`, return
  `UserCancelSubscriptionResponse` (`cancelAtPeriodEnd`, `accessUntil`).
- Extend `SubscriptionData` with `scheduledPlanChange` (+ optional `restrictionPreview`) so the
  dashboard can show a "downgrade scheduled" banner.

### 4.3 Web UI (`apps/web`, Astro + React islands, CSS Modules, i18n es/en/pt)

- **Plan picker**: choose a target plan (upgrade or downgrade) from the catalog the user can switch to.
- **Downgrade preview renderer**: render `DowngradePreview` (accommodations/promotions/photos excess,
  grandfather flags) when `hasExcess`.
- **keepIds selector**: choose-what-to-keep UI that builds `KeepSelections`
  (`accommodationIds`, `promotionIds`, `photoKeepMap`).
- **Confirm + scheduled-change state**: on confirm, POST change-plan; render the resulting
  `active | scheduled | pending_payment` state (incl. a "scheduled at period end" banner with
  `effectiveAt`; `pending_payment` redirects to `checkoutUrl`).
- **Cancel flow**: replace the email-redirect modal with a real cancel calling the SPEC-147 API
  (gated by `HOSPEDA_USER_CANCEL_ENABLED`; when off the endpoint 404s — UI must degrade gracefully,
  keeping the email fallback until the flag is enabled).
- i18n keys (es/en/pt) under `account.pages.subscription.*` for all new copy.

## 5. Out of scope

- Admin UI changes.
- New billing business logic (reuses SPEC-167 change-plan + SPEC-147 cancel + `computeDowngradeExcess`).
  The ONLY new endpoint is the thin `downgrade-preview` read wrapper (D-1).
- Enabling `HOSPEDA_USER_CANCEL_ENABLED` in prod — that is an operational decision for the owner.
- Upgrade payment/checkout itself (handled by the existing `pending_payment` → `checkoutUrl` flow).

## 6. Backend contracts (verified 2026-06-15)

- `DowngradePreview`: `packages/schemas/src/api/billing/downgrade-preview.schema.ts` —
  `{ accommodations|promotions: { cap, activeCount, excessCount, items[] }, photos[], grandfatherFlags[], hasExcess }`.
- `computeDowngradeExcess(input: { userId, targetPlanSlug }, deps)`:
  `apps/api/src/services/subscription-downgrade-excess.service.ts:284`.
- `KeepSelections`: `{ accommodationIds?, promotionIds?, photoKeepMap? }` (same schema file).
- change-plan: `POST /api/v1/protected/billing/subscriptions/change-plan`, body
  `{ newPlanId, billingInterval, keepSelections? }`, requires `X-Idempotency-Key`; response is the
  `active | scheduled | pending_payment` union (`plan-change.schema.ts`).
- cancel (147): `POST /api/v1/protected/billing/subscriptions/{id}/cancel`, body `{ reason? }`,
  flag `HOSPEDA_USER_CANCEL_ENABLED` (off → 404), response `{ subscriptionId, cancelAtPeriodEnd, canceledAt, accessUntil }`.

## 7. Risks

- `billingApi.cancelSubscription()` currently points at a hard-cancel path — fixing it is a behavior
  change; verify no other caller depends on the old behavior before repointing.
- `HOSPEDA_USER_CANCEL_ENABLED` defaults off → the cancel flow must degrade gracefully (keep email
  fallback) when the endpoint 404s, and only show the API path when enabled.
- Downgrade is sensitive: the keepIds selector must default to `keepByDefault` items and clearly show
  what will be restricted; a wrong selection restricts the wrong resources at period end.

## 8. Implementation phases

1. **Backend**: `downgrade-preview` GET endpoint + gate-matrix row + tests.
2. **Web client**: `previewDowngrade`, fix `changePlan` (keepSelections + idempotency + types),
   fix `cancelSubscription` (repoint to 147), extend `SubscriptionData`.
3. **UI — view**: scheduled-change banner on the dashboard (consumes extended `SubscriptionData`).
4. **UI — plan change**: plan picker → preview renderer → keepIds selector → confirm/scheduled state.
5. **UI — cancel**: wire cancel button to the 147 API with graceful flag-off degradation.
6. **i18n + tests**: es/en/pt keys; component + integration tests; manual smoke on staging.

## 9. Revision History

- 2026-06-06 — Draft sketch created (SPEC-167 realign D-4).
- 2026-06-15 — Formalized: gap analysis (§2), D-1 preview-first decision (§3), full scope (§4),
  backend/client contracts (§6), phased plan (§8). Status draft → in-progress.
