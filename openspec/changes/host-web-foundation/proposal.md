# Proposal: Host Web Foundation

## Intent

Hosts today must use `apps/admin` (TanStack Start, Tailwind) for core daily operations while `apps/web` (Astro, CSS Modules) handles only tourist-facing content and onboarding. This forces app-switching, different UX patterns, and duplicated navigation context. We need to bring host self-service into `apps/web` — starting with the foundation layer: dashboard, navigation, owner promotions, and funnel continuity.

## Scope

### In Scope

- Host dashboard page at `/mi-cuenta/host/` with property summary, plan info, quick stats
- Navigation: enhanced UserMenu + AccountLayout with host-specific sections
- Owner promotions CRUD UI in web (API already exists at `/api/v1/protected/owner-promotions/*`)
- Funnel polish: publicar → propiedades → suscripción without admin redirects
- New endpoint `GET /api/v1/protected/host/dashboard` for aggregated host data

### Out of Scope

- Host conversations inbox → SPEC-206
- Host analytics/KPIs → SPEC-207
- Web accommodation editor → SPEC-208
- Billing self-service gaps (cancel, usage, features) → future
- Removing host routes from admin → Phase 2

## Capabilities

### New Capabilities

- `host-dashboard-web`: Aggregate endpoint + React island for host home in web

### Modified Capabilities

- `owner-promotions-web`: Promotions UI moves from admin-only to web-first (admin stays as staff fallback)
- `host-navigation`: UserMenu and AccountLayout gain host-aware sections

## Approach

1. **New dashboard endpoint** in `apps/api/src/routes/host/protected/dashboard.ts` — single aggregation query returning property counts, plan info, unread count placeholder
2. **Host dashboard page** in `apps/web/src/pages/[lang]/mi-cuerta/host-dashboard.astro` — SSR shell + React island for interactive widgets
3. **Navigation updates** — enhance `UserMenu.client.tsx` and `AccountLayout.astro` with host section; remove admin CTAs from scope items
4. **Owner promotions** — new pages at `/mi-cuenta/promociones/` using existing protected endpoints
5. **Funnel** — update property list to remove "edit in admin" redirect for Phase-1 items

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api/src/routes/host/` | New | Protected dashboard endpoint |
| `apps/web/src/pages/[lang]/mi-cuenta/` | Modified | New dashboard page, enhanced nav |
| `apps/web/src/components/host/` | New | Dashboard widgets, promotion forms |
| `apps/web/src/components/shared/navigation/` | Modified | UserMenu host-aware |
| `apps/web/src/layouts/` | Modified | AccountLayout host section |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dashboard query performance | Low | Single endpoint, limited aggregation, cache at 5-min TTL |
| Promotion UI duplication | Medium | Use @repo/service-core business logic, web-native UI |
| Nav confusion mid-transition | Low | Keep admin link for non-migrated features |

## Rollback Plan

Revert the dashboard endpoint + UI, keep navigation changes (they don't break existing flows). Owner promotions CRUD can stay — it's additive.

## Dependencies

- SPEC-182 (unified auth + host-mode) — COMPLETE
- Owner promotions protected endpoints — EXIST, need verification

## Success Criteria

- [ ] Host dashboard loads with correct property counts, plan info, quick stats
- [ ] UserMenu shows host section for host users, not for tourists
- [ ] Owner promotions CRUD fully functional in web
- [ ] Funnel publish → properties → subscription works without admin redirect
- [ ] All existing tests pass
