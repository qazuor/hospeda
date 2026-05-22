---
audit: performance
status: complete
date: 2026-05-21
agent: Explore
---

# 14 — Performance & bundle (code-level audit)

We did not run a real build, Lighthouse, or bundle analyzer here — this is a code-level audit of patterns that drive bundle size and runtime perf.

## Top 3 perf wins already in place

1. **Lazy route for dashboard with Suspense** — `dashboard.lazy.tsx` keeps the entry point lightweight; KPI cards/charts only load on navigation. `DashboardSkeleton` as Suspense fallback.
2. **Query deduplication via factory pattern** — TanStack Query v5.59 with consistent stale times (30-60s standard, 5m for cron jobs). Mutation invalidation is wired correctly. No obvious N+1 patterns.
3. **Virtualization for long lists/tables** — `useVirtualizedTable` and `useVirtualizedList` hooks with smart presets (compact 36px → spacious 80px) and overscan buffers (5-15 items).

## Top 3 perf risks / bundle-bloat areas

### Risk 1 — Icon-comparison dev route bundled to production
- **File:** `apps/admin/src/routes/_authed/dev/icon-comparison.tsx`
- **Size:** ~1095 lines, imports 70+ icons.
- **Estimated impact:** ~13-18 KB gzipped in the production bundle.
- **Fix:** Vite plugin to exclude `/routes/dev/**` from production builds, OR move to `import.meta.env.DEV` conditional rendering.

### Risk 2 — TipTap editor eagerly bundled
- **Where:** newsletter campaign editor (used in 1-2 routes only).
- **Estimated impact:** ~10-12 KB gzipped on routes that don't need it.
- **Fix:** `React.lazy(() => import('./CampaignEditor'))` + Suspense boundary. Saves 10-12 KB on the 26+ non-newsletter routes.

### Risk 3 — Leaflet maps always included
- **Raw size:** ~120 KB unminified, ~30-35 KB gzipped.
- **Used in:** 2-3 location-based forms (events, accommodations).
- **Fix:** Dynamic import or split chunk. Saves ~20-25 KB on non-map routes.

## Key metrics

| Category | Finding |
|----------|---------|
| **Lazy routes** | 1 of 29 routes lazy (`dashboard.lazy.tsx`) ✓ |
| **Icon imports** | 100% tree-shakeable named imports — no `import *` ✓ |
| **Query patterns** | Deduped via key factory, stale times set consistently ✓ |
| **Memoization** | ~56 `useMemo` / `useCallback` instances; ~56 more opportunities in entity-form fields (GalleryField, ImageField) |
| **Virtualization** | Implemented (tables, lists); galleries unvirtualized (rare case) |
| **Images** | `loading="lazy"` used; no responsive `srcset`/`sizes` variants |
| **Suspense** | Used for route code-splitting; limited for data fetching |
| **Estimated bundle** | ~265-287 KB gzipped (reasonable for admin) |

## Critical findings

- **No dynamic imports** except Sentry (correct — error reporting is rare).
- **Newsletter editor** uses TipTap v2 (excellent UI, but eagerly bundled — see Risk 2).
- **Vite build config**: proper manual chunking, correct env handling, Sentry integration solid.
- **No unvirtualized massive lists** detected (threshold: 30 items).
- Most heavy lifting (dashboard, editor) already routes-split or virtualized.

## Estimated quick wins

| Action | Effort | Bundle savings (gzipped) |
|--------|--------|--------------------------|
| Exclude `/routes/dev/**` from prod | Small (Vite plugin) | 13-18 KB |
| Lazy-load TipTap newsletter editor | Small | 10-12 KB |
| Dynamic chunk for Leaflet | Medium | 20-25 KB |
| **Total quick wins** | — | **45-65 KB (≈15-20% reduction)** |

## What we did NOT measure (requires runtime tooling)

- Actual Core Web Vitals (LCP, INP, CLS).
- Real bundle size from a production build.
- Memory leaks during long sessions.
- Network waterfall on cold cache.
- Render performance under throttled CPU.

These belong to a Phase 3 audit if perf becomes a top priority.

## Implication for the redesign

Performance is **not the blocker today**. The bundle is reasonable, query patterns are sane, virtualization is in place. The three quick wins are nice-to-haves, not urgent. The admin is fast enough for what it does — focus on UX + visual coherence + permission-bundle redesign first; performance optimization is a low-cost cleanup we can run alongside.
