# Design: Host Web Foundation — Phase 1

## Technical Approach

Create a dedicated `host/` route namespace in the API for cross-entity aggregation (dashboard), build web-native Astro + React islands for the host dashboard and owner promotions CRUD, and enhance navigation surfaces (UserMenu + AccountLayout) to surface host sections — all without removing existing admin routes.

## Architecture Decisions

### Decision: Dedicated host API namespace

| Option | Tradeoff | Decision |
|--------|----------|----------|
| New `routes/host/` directory | Clean boundary for cross-entity aggregation; follows entity pattern | ✅ **Chosen** |
| Piggyback on `accommodation/` routes | Mixed concerns; dashboard spans billing + accommodations | ❌ Rejected |

**Rationale**: Dashboard aggregates across accommodations, billing, and conversations. A dedicated namespace keeps the boundary clean and follows every other entity's directory pattern.

### Decision: Single dashboard aggregation endpoint

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Single `GET /api/v1/protected/host/dashboard` | One round-trip, cacheable at 5-min TTL | ✅ **Chosen** |
| Multiple existing endpoint calls from client | N+1 requests, slower page load, complex island state | ❌ Rejected |

**Rationale**: Single round-trip gives faster page load and simpler island hydration state. Same pattern as `hostFavoritesBreakdown`.

### Decision: React island with SSR data pre-fetch

| Option | Tradeoff | Decision |
|--------|----------|----------|
| React island + SSR fetch | Instant first paint, hydrates for interactivity | ✅ **Chosen** |
| Pure Astro SSR | No interactivity for dashboard widgets | ❌ Rejected |

**Rationale**: Dashboard needs interactive quick-action cards and navigation. SSR fetch gives zero-CLS first paint; `client:load` island hydrates interactions.

### Decision: Web-native promotion forms

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Web-native Astro + React forms | Same UX as rest of web; no iframe | ✅ **Chosen** |
| Embed admin panel iframe | Technical debt, inconsistent UX | ❌ Rejected |

**Rationale**: Matches SPEC-205 migration goal. Admin stays available for staff-only operations.

## Data Flow

```
Browser ──→ /mi-cuenta/host/ (Astro SSR)
               │
               ├── pre-fetch via cookie ──→ GET /api/v1/protected/host/dashboard
               │                                │
               │                          HostDashboardService.aggregate()
               │                            ├── AccommodationService → counts
               │                            ├── BillingService → plan info
               │                            └── ConversationService → unread (placeholder)
               │                                │
               │                           Response → transformHostDashboard()
               │
               └── <HostDashboard client:load data={dashboard} />
                     ├── PropertySummaryWidget
                     ├── PlanInfoWidget
                     ├── QuickStatsWidget
                     └── QuickActionsCard
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/api/src/routes/host/protected/dashboard.ts` | Create | GET aggregation endpoint |
| `apps/api/src/routes/host/protected/index.ts` | Create | Re-export protected routes |
| `apps/api/src/routes/host/index.ts` | Create | Barrel export |
| `apps/api/src/routes/index.ts` | Modify | Register `/api/v1/protected/host` |
| `apps/web/src/lib/api/types.ts` | Modify | Add `HostDashboardData` type |
| `apps/web/src/lib/api/endpoints-protected.ts` | Modify | Add `hostDashboardApi` |
| `apps/web/src/lib/api/transforms.ts` | Modify | Add `transformHostDashboard` |
| `apps/web/src/components/host/HostDashboard.client.tsx` | Create | Dashboard React island |
| `apps/web/src/pages/[lang]/mi-cuenta/host-dashboard.astro` | Create | Dashboard SSR page |
| `apps/web/src/components/shared/navigation/UserMenu.client.tsx` | Modify | Add host dashboard link for host role |
| `apps/web/src/layouts/AccountLayout.astro` | Modify | Add "Anfitrión" nav group |
| `apps/web/src/pages/[lang]/mi-cuenta/promociones/index.astro` | Create | Promotions list |
| `apps/web/src/pages/[lang]/mi-cuenta/promociones/nueva.astro` | Create | Create promotion |
| `apps/web/src/pages/[lang]/mi-cuenta/promociones/[id]/editar.astro` | Create | Edit promotion |
| `apps/web/src/components/host/PromotionList.client.tsx` | Create | Promotions list island |
| `apps/web/src/components/host/PromotionForm.client.tsx` | Create | Promotion create/edit island |
| `apps/web/src/components/host/PropertyCard.astro` | Modify | Remove admin-only edit link |
| `apps/web/src/pages/[lang]/mi-cuenta/propiedades/index.astro` | Modify | Add limit/plan awareness |

## Interfaces / Contracts

### Dashboard endpoint response

```ts
interface HostDashboardResponse {
  properties: {
    total: number;
    published: number;
    draft: number;
    archived: number;
  };
  plan: {
    slug: string;
    name: string;
    status: 'active' | 'trial' | 'cancelled' | 'expired' | 'past_due';
    isTrial: boolean;
  } | null;
  unreadConversations: number;
}

// Transform result passed to HostDashboard island
interface HostDashboardData {
  propertySummary: { total: number; published: number; draft: number };
  planInfo: { name: string; status: string; isTrial: boolean } | null;
  unreadCount: number;
  quickActions: Array<{ label: string; href: string; icon: string }>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `transformHostDashboard` | Raw → clean props mapping with null inputs |
| Unit | `HostDashboardService.aggregate` | Mock services, verify aggregation |
| Integration | `GET /protected/host/dashboard` | Mock actor, assert response shape + owner scope |
| Integration | Promotion CRUD via `endpoints-protected.ts` | Verify fetch params match API contract |
| Component | `HostDashboard` island | @testing-library/react render + assert widgets |
| Component | `PromotionList` / `PromotionForm` | Render + assert CRUD flow |
| Astro | SSR pages | Read source, assert correct layout + API calls |

## Migration / Rollout

No migration required. All files are additive — new endpoints, new pages, enhanced navigation. The admin panel remains fully available for non-migrated features (SPEC-206/207/208). Host dashboard URL is additive; no existing redirects are removed.

## Resolved Questions

### Dashboard route

**Decisión**: Ruta separada en `/mi-cuenta/host/`. El dashboard NO reemplaza la landing de cuenta. El host elige desde el menú. Turistas nunca ven la ruta host.

### Entitlement keys

**Decisión**: Usar existentes. Dashboard gateado con `VIEW_BASIC_STATS` (ya asignado a planes host). Promociones con `CREATE_PROMOTIONS` (ya existe). No se crean keys nuevas para SPEC-205.
