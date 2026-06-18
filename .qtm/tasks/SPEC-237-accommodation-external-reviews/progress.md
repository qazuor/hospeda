# SPEC-237 — External-platform reviews & reputation on accommodation pages

## Progress: 0 / 15 tasks complete

**Status:** in-progress
**Created:** 2026-06-18
**Phase:** setup (not started)

---

## Phase Overview

| Phase | Tasks | Done | Notes |
|-------|-------|------|-------|
| setup | T-001, T-002, T-003 | 0/3 | Schemas + env + i18n — no blockers, parallel |
| core | T-004, T-005, T-006, T-007, T-014 | 0/5 | DB → adapters → services; T-014 (seed) unblocked after T-005 |
| integration | T-008, T-009, T-011, T-012, T-013 | 0/5 | Endpoints + cron + Web UI + Owner config |
| docs | T-010, T-015 | 0/2 | Gate matrix + ADR; T-010 unblocked after T-008+T-009 |

---

## Parallel Tracks

```
Track A (Schemas):   T-001 → T-004 → T-005 → T-006 → T-007 → T-008 → T-009
                                                              ↘           ↘
Track B (Env):       T-002 ──────────────────────────────→ T-006        T-010
Track C (i18n):      T-003 ──────────────────────────────────────→ T-011, T-012, T-013
Track D (Seed):                          T-005 → T-014 (unblocked after migration)
```

Merge points:

- T-006 needs T-002 (env vars) + T-005 (DB migrated)
- T-007 needs T-005 (DB) + T-006 (adapters)
- T-008 needs T-007 (services)
- T-009 needs T-007 (services)
- T-010 needs T-008 + T-009 (routes registered)
- T-011 needs T-007 (services) + T-003 (i18n)
- T-012 needs T-003 (i18n) + T-009 (public endpoint)
- T-013 needs T-003 (i18n) + T-008 (protected endpoints)
- T-015 needs T-009 + T-011 (all backend complete)

---

## Critical Path

`T-001 → T-004 → T-005 → T-006 → T-007 → T-008 → T-009 → T-015` (8 steps)

This is the bottleneck. T-002 and T-003 have float and can be done in parallel with T-001/T-004.

---

## Task Status

| ID | Title | Phase | Complexity | Status | Blocked By |
|----|-------|-------|-----------|--------|-----------|
| T-001 | Add ExternalPlatformEnum + schemas | setup | 2 | pending | — |
| T-002 | Register env vars (registry + env.ts + .env.example) | setup | 2 | pending | — |
| T-003 | Add i18n keys (es/en/pt) | setup | 1 | pending | — |
| T-004 | DB enums + two tables + models + master-toggle column | core | 3 | pending | T-001 |
| T-005 | Generate, review, apply DB migration | core | 1 | pending | T-004 |
| T-006 | Build reputation fetch adapters (Google + aggregate-only) | core | 3 | pending | T-002, T-005 |
| T-007 | AccommodationExternalListingService + ReputationService | core | 3 | pending | T-005, T-006 |
| T-008 | Owner listing-config CRUD + refresh endpoints | integration | 2 | pending | T-007 |
| T-009 | Public GET + admin disable endpoints | integration | 2 | pending | T-007 |
| T-010 | Endpoint-gate-matrix rows | docs | 1 | pending | T-008, T-009 |
| T-011 | refresh-external-reputation cron job | integration | 2 | pending | T-007, T-003 |
| T-012 | ExternalReputation.astro + ExternalReviews.client.tsx | integration | 3 | pending | T-003, T-009 |
| T-013 | Owner config UI section in AccommodationEditor | integration | 3 | pending | T-003, T-008 |
| T-014 | Seed data for external listings + reputation | core | 1 | pending | T-005 |
| T-015 | ADR + route docs + smoke checklist | docs | 1 | pending | T-009, T-011 |

---

## Key Decisions Recorded

1. **Master toggle** = additive `accommodations.show_external_reputation` boolean column (default false). SSR-friendly (no join on public render). Resolved pre-spec.
2. **Admin takedown** = minimal soft-disable only (sets all listings showLink/showReviews=false). No destructive purge. Resolved pre-spec.
3. **Owner config surface** = web host UI only (AccommodationEditor.client.tsx in apps/web). No admin-panel config UI. Resolved pre-spec.
4. **`verified` flag** = DB column only, NOT validated in MVP. Resolved pre-spec.
5. **Google adapter** = separate from SPEC-222 google-places.adapter.ts (which explicitly excludes reviews/rating from its field mask). A new `google-reputation.adapter.ts` fetches rating + userRatingsTotal + reviews. Do NOT modify the SPEC-222 adapter.
6. **safeExternalFetch** = already exists in packages/utils/src/safe-fetch.ts, exported from @repo/utils. Reuse directly (no rebuild).
7. **Apify client** = already exists at packages/service-core/src/services/accommodation-import/adapters/apify-client.ts. Reuse for Booking/Airbnb aggregate adapters.

---

## Owner Action Required

After T-002 (env vars registration) is complete, the following env vars must be set in Coolify before the refresh endpoint will function on staging:

- `HOSPEDA_GOOGLE_PLACES_API_KEY` — Google Places API key (secret)
- `HOSPEDA_APIFY_TOKEN` — Apify API token (secret)

Note: if SPEC-222 already set these in Coolify, no action needed. Verify with `hops env-get api`.

---

## Acceptance Criteria Coverage

| AC | Covered By |
|----|-----------|
| AC-1.1 Owner CRUD listing config | T-007, T-008 |
| AC-1.2 Master toggle | T-004, T-007, T-008 |
| AC-1.3 showLink / showReviews independent | T-001, T-004, T-007 |
| AC-1.4 Owner UI shows explainer | T-013 |
| AC-2.1 Refresh rate-limited (429 + retry hint) | T-007, T-008 |
| AC-2.2 Fetch fully automatic (no manual data entry) | T-006, T-007 |
| AC-2.3 Partial failure graceful | T-007, T-011 |
| US-3 Cron refresh | T-011 |
| AC-4.1 showLink deep link with platform name | T-012 |
| AC-4.2 showReviews aggregate badge | T-012 |
| AC-4.3 Google snippets + TTL degrade | T-006, T-007, T-012 |
| AC-4.4 Internal averageRating untouched | T-004 (separate tables), T-012 |
| AC-4.5 Every item labeled with source | T-012 |
| AC-5.1 UI explainer (owner + public) | T-012, T-013 |
| AC-5.2 i18n es/en/pt | T-003 |
| AC-6.1 No owner edit/delete of reputation rows | T-007 (constrained service) |
| AC-6.2 Admin disable (soft) | T-007, T-009 |
| AC-7.1 No review text for non-Google | T-006 (adapter strips text, test enforces) |
| AC-7.2 Google snippets TTL | T-006, T-007, T-012 |
| AC-7.3 Owner opt-in as auth basis | T-007 (toggle check in listForDisplay) |
| AC-8.1 safeExternalFetch for direct fetches | T-006 |
