# Tasks: Host Web Foundation (SPEC-205 Phase 1)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1000–1200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | API foundation — dashboard endpoint, types, transforms | PR 1 | Base: staging. Includes API tests. |
| 2 | Navigation + Dashboard UI — UserMenu, AccountLayout, island, SSR page | PR 2 | Base: staging or PR 1. Includes component tests. |
| 3 | Owner promotions CRUD — list, create, edit pages + islands | PR 3 | Base: staging or PR 2. Uses existing endpoints. |
| 4 | Funnel polish — PropertyCard admin links removal, limit badges | PR 4 | Base: staging. Smallest slice. |

## Phase 1: API Foundation

- [ ] 1.1 Create `apps/api/src/routes/host/protected/dashboard.ts` with GET aggregation endpoint
- [ ] 1.2 Create `apps/api/src/routes/host/protected/index.ts` barrel re-export
- [ ] 1.3 Create `apps/api/src/routes/host/index.ts` barrel export
- [ ] 1.4 Modify `apps/api/src/routes/index.ts` to register `/api/v1/protected/host` routes
- [ ] 1.5 Add `HostDashboardData` type to `apps/web/src/lib/api/types.ts`
- [ ] 1.6 Add `hostDashboardApi` to `apps/web/src/lib/api/endpoints-protected.ts`
- [ ] 1.7 Add `transformHostDashboard` to `apps/web/src/lib/api/transforms.ts`
- [ ] 1.8 Write API integration tests for dashboard endpoint (auth, shape, host scope)

## Phase 2: Navigation & Dashboard UI

- [ ] 2.1 Update `UserMenu.client.tsx` with host dashboard link for host users
- [ ] 2.2 Update `AccountLayout.astro` with "Anfitrión" nav section
- [ ] 2.3 Create `HostDashboard.client.tsx` React island with 4 widget slots
- [ ] 2.4 Create host dashboard SSR page at `[lang]/mi-cuenta/host-dashboard.astro`
- [ ] 2.5 Write component tests for `HostDashboard` (render, widgets, loading)

## Phase 3: Owner Promotions CRUD

- [ ] 3.1 Create promotions list page at `[lang]/mi-cuenta/promociones/index.astro`
- [ ] 3.2 Create promotion form page at `[lang]/mi-cuenta/promociones/nueva.astro`
- [ ] 3.3 Create promotion edit page at `[lang]/mi-cuenta/promociones/[id]/editar.astro`
- [ ] 3.4 Create `PromotionList.client.tsx` React island for list operations
- [ ] 3.5 Create `PromotionForm.client.tsx` React island for create/edit
- [ ] 3.6 Write component tests for `PromotionList` and `PromotionForm`

## Phase 4: Funnel Polish

- [ ] 4.1 Modify `PropertyCard.astro` to remove admin-only edit link
- [ ] 4.2 Update propiedades index page with plan/limit awareness badges
- [ ] 4.3 Write integration tests verifying no admin redirects in Phase-1 flows
