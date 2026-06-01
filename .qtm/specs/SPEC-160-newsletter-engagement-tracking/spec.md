---
specId: SPEC-160
title: Newsletter Engagement Tracking (Open / Click)
status: draft
complexity: low
owner: qazuor
created: 2026-05-26
revised: 2026-05-30
parent: (none)
related:
  - SPEC-155 (admin-dashboards-v1 — consumer of the open rate card)
  - SPEC-101 (newsletter MVP — shipped full engagement backend)
tags:
  - newsletter
  - analytics
  - open-rate
  - ctr
  - frontend
  - phase-2
---

# SPEC-160 — Newsletter Engagement Tracking (Open / Click)

> **RE-SCOPED 2026-05-30 — premise obsolete, backend already shipped under SPEC-101.
> This is now a thin frontend task.**
>
> The original spec (2026-05-26) assumed "no engagement metrics exist, build
> tracking from scratch". That premise is false. SPEC-101 delivered the complete
> backend: webhook ingestion, idempotent tracking service, SQL aggregation, and
> an admin API endpoint. What remains is wiring the EDITOR dashboard Card C to
> that endpoint.

---

## 1. Origin

The EDITOR dashboard (SPEC-155) wants an "open rate último envío" widget (Card C).
On 2026-05-26 that card was deferred with the comment:

> "Card C — open rate: PHASE 2 (no email-open tracking today)"

On 2026-05-30 a code audit confirmed the comment is **wrong** — all the tracking
infrastructure was delivered by SPEC-101 and is live in the codebase. The only
missing piece is the dashboard data-source that reads from the existing endpoint
and renders the card.

## 2. Already Implemented (SPEC-101 — do not re-build)

The following exist in the codebase today and must be consumed as-is:

| Artifact | Location | Key detail |
|---|---|---|
| DB columns `openedAt` / `firstClickAt` | `packages/db/src/schemas/newsletter/newsletter_campaign_deliveries.dbschema.ts` (~line 50) | Populated by Brevo webhook; created by SPEC-101. |
| `NewsletterTrackingService` | `packages/service-core/src/services/newsletter/newsletter-tracking.service.ts` | `applyOpened()`, `applyClick()` idempotent; `processBrevoWebhookEvent()`. |
| Brevo webhook handler | `apps/api/src/routes/webhooks/brevo.ts` | Whitelist includes `opened` and `click` events. |
| `computeMetrics()` | `packages/service-core/src/services/newsletter/newsletter-campaign.service.ts` (~lines 997-1073) | SQL FILTER counts `opened` / `clicked`. |
| Admin endpoint | `apps/api/src/routes/newsletter/admin/campaigns.ts` | `GET /api/v1/admin/newsletter/campaigns/{id}/metrics` — returns `CampaignMetricsSchema` with `opened` / `clicked` integers. |
| React hook | `apps/admin/src/hooks/newsletter/use-campaign-metrics.ts` | Fetches the endpoint; calculates `openRate` / `clickRate` client-side. |

## 3. Goal

1. **(Must-have)** Wire the EDITOR dashboard Card C to consume the existing metrics endpoint and display the open rate for the last sent campaign. Remove the stale "PHASE 2" deferral comment from `apps/admin/src/lib/dashboard-sources/editor.ts` (~line 29).
2. **(Nice-to-have)** Decide whether `GET .../metrics` should return computed `openRate` and `clickRate` percentages alongside the raw integers, or keep the percentage math client-side (current). This is a minor API-shape question that can be resolved during implementation.

## 4. Scope

### IN

- Dashboard data-source for EDITOR Card C: query last-sent campaign, call metrics endpoint, expose `openRate%` for the card widget.
- Remove/update the incorrect "no email-open tracking today" comment in `editor.ts`.
- (Optional) Add `openRatePct` / `clickRatePct` computed fields to `CampaignMetricsSchema` and the endpoint response.
- Unit tests for the data-source function and any schema additions.

### OUT

- Any backend tracking infrastructure — it is done. Do not modify `NewsletterTrackingService`, the webhook handler, or `computeMetrics()`.
- Per-recipient engagement timeline.
- A/B testing metrics.
- Tracking pixel or link-wrapping endpoints (Brevo webhooks already handle this).
- New database tables or migrations.

## 5. Acceptance Criteria

```
AC-1 (Card C visible)
Given the EDITOR dashboard loads,
When at least one campaign has been sent (sentAt is not null),
Then Card C displays the open rate percentage of the most recently sent campaign,
  formatted as "N%" with zero decimal places.

AC-2 (Empty state)
Given the EDITOR dashboard loads,
When no campaign has ever been sent,
Then Card C renders a neutral empty-state (e.g. "—") instead of a percentage
  and does not throw an error.

AC-3 (Stale comment removed)
Given the file apps/admin/src/lib/dashboard-sources/editor.ts,
When reviewed after this spec ships,
Then it contains no reference to "PHASE 2 (no email-open tracking today)"
  or any comment implying open-rate tracking is unavailable.

AC-4 (Hook reuse)
Given the existing use-campaign-metrics hook in apps/admin/src/hooks/newsletter/,
When the Card C data-source is implemented,
Then it reuses that hook rather than duplicating the fetch logic.

AC-5 (Tests pass)
Given the new data-source and any schema changes,
When the test suite runs,
Then all new tests pass and overall coverage does not drop below 90%.
```

## 6. Dependencies

- **SPEC-101** (DONE) — provides the complete backend: DB schema, tracking service, webhook handler, `computeMetrics()`, and the admin metrics endpoint.
- **SPEC-155** — the EDITOR dashboard shell that will host Card C. Must be in-progress or completed before this spec's frontend wiring can ship.

## 7. Tasks Sketch

| # | Task | Notes |
|---|---|---|
| T-01 | Wire EDITOR Card C data-source | Read `editor.ts`, implement a `getEditorOpenRateCard()` function that fetches the last-sent campaign ID then calls `use-campaign-metrics`. Remove stale comment. |
| T-02 | Render Card C widget | Wire the data-source result into the dashboard card component; implement empty state for no-sends case. |
| T-03 | (Optional) Expose computed ratios in API | If agreed, add `openRatePct` / `clickRatePct` to `CampaignMetricsSchema` in `@repo/schemas` and update the endpoint. Remove client-side percentage math from the hook. |
| T-04 | Tests | Unit tests for T-01 data-source; update hook tests if T-03 ships. |
