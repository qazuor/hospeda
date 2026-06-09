# Tasks: SPEC-208 Phase C — Web Accommodation Editor (Rich Text, Leaflet, Premium)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 600–800 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Entitlement infra + RichTextEditor | PR 1 | base: feature branch; tests included |
| 2 | LocationPicker + Geocoding proxy + Wiring | PR 2 | base: PR 1 branch; depends on PR 1 |

---

## Phase 1: Entitlement Infrastructure

- [x] 1.1 Create `apps/web/src/hooks/useMyEntitlements.ts` — native fetch hook with 60s in-memory cache, `has()` + `limit()` + `plan`. Reuse `MyEntitlementsResponseSchema` Zod shape from admin.
- [x] 1.2 Create `apps/web/src/components/host/editor/PlanEntitlementGate.client.tsx` — CSS Module fallback, nudge variants (`rich-description`, `video`, `generic`), `upgradeUrl` prop.
- [x] 1.3 Create `apps/web/src/components/host/editor/PlanEntitlementGate.module.css` — locked state styling (amber border, muted bg, premium nudge text).
- [x] 1.4 Test: `apps/web/test/hooks/useMyEntitlements.test.ts` — mock fetch, verify 60s stale, error fallback, `has()`/`limit()` logic.
- [x] 1.5 Test: `apps/web/test/components/PlanEntitlementGate.test.tsx` — render paths: loading→children, error→fallback, has→children, locked→nudge.

## Phase 2: Rich Text Editor

- [x] 2.1 Create `apps/web/src/components/host/editor/RichTextEditor.client.tsx` — adapt admin `RichTextField`: TipTap StarterKit+Underline+Link+Markdown, simplified props (`value`, `onChange`, `placeholder`, `disabled`, `hasError`, `errorMessage`). Wrap with `client:only="react"` + `React.lazy`.
- [x] 2.2 Create `apps/web/src/components/host/editor/RichTextEditor.module.css` — toolbar + editor content styling (replaces Tailwind prose classes). Use CSS custom properties.
- [x] 2.3 Test: `apps/web/test/components/RichTextEditor.test.tsx` — render TipTap, verify toolbar buttons, type content, assert Markdown output round-trip.

## Phase 3: Geocoding Proxy + Location Picker

- [ ] 3.1 Create `apps/api/src/routes/geocoding/protected/index.ts` — autocomplete + reverse proxy (same as admin but `createProtectedRoute`, no admin permission needed). Reuse `geocodingAutocomplete`/`geocodingReverse` from `@repo/service-core`.
- [ ] 3.2 Modify `apps/api/src/routes/geocoding/index.ts` — add re-export of `protectedGeocodingRoutes`.
- [ ] 3.3 Modify `apps/api/src/routes/index.ts` — register `/api/v1/protected/geocoding` route.
- [ ] 3.4 Create `apps/web/src/hooks/useGeocoding.ts` — fetch-based hooks for autocomplete (debounced) + reverse. No TanStack Query; use native fetch + useState.
- [ ] 3.5 Create `apps/web/src/components/host/editor/LocationPicker.client.tsx` — adapt admin LocationPickerField: raw Leaflet map, address autocomplete dropdown, pin drag reverse geocoding. `client:only="react"` + `React.lazy`. CSS Module styling.
- [ ] 3.6 Create `apps/web/src/components/host/editor/LocationPicker.module.css` — map container, autocomplete dropdown, field grid layout.
- [ ] 3.7 Test: `apps/api/test/routes/geocoding/protected/index.test.ts` — Hono `app.request` with mock auth, assert autocomplete + reverse proxying.
- [ ] 3.8 Test: `apps/web/test/hooks/useGeocoding.test.ts` — mock fetch, test debounce timing + enabled flag.
- [ ] 3.9 Test: `apps/web/test/components/LocationPicker.test.tsx` — mock geocoding API, verify suggestion selection updates value.

## Phase 4: Wiring + Integration

- [ ] 4.1 Modify `apps/web/src/components/host/AccommodationEditor.client.tsx` — import `PlanEntitlementGate` + `RichTextEditor` + `LocationPicker`. Wrap rich description field in `PlanEntitlementGate(entitlementKey=CAN_USE_RICH_DESCRIPTION)`. Replace `LocationSection` lat/lng inputs with `LocationPicker` island.
- [ ] 4.2 Add i18n keys to `packages/i18n/src/locales/es/host.json` — editor entitlement nudge labels, rich text placeholder, location picker labels.
- [ ] 4.3 Add i18n keys to `packages/i18n/src/locales/en/host.json` and `pt/host.json` — English/Portuguese translations (fallback to es).
- [ ] 4.4 Modify `apps/api/docs/billing/endpoint-gate-matrix.md` — add rows for new protected geocoding endpoints (Decision: none, Reason: session auth only).
- [ ] 4.5 Test: end-to-end wiring verification — load editor with free-plan user, verify rich description is gated; load with premium user, verify editor renders; verify LocationPicker updates lat/lng on pin drag.
