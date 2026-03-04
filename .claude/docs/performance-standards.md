# Performance Standards (Quick Reference)

> Concise rules for AI agents. Full details: [docs/performance/](../../docs/performance/)

## API Targets

- List endpoints: <200ms p95
- Single entity: <100ms p95
- Search: <500ms p95
- All responses: use `ResponseFactory` (consistent format)

## Web (Lighthouse) Targets

- Performance score: >90
- TTFB: <500ms
- FCP: <1.5s
- LCP: <2.5s
- CLS: <0.1
- TBT: <200ms

## Frontend Optimization

- Astro components by default (zero JS)
- React islands ONLY when interactivity required
- Default hydration: `client:visible` (lazy, below fold)
- Use `client:load` only for above-fold interactive elements
- Use `client:idle` for low-priority components
- Images: Astro `<Image>` component, lazy loading, WebP format
- Fonts: preload critical fonts, use `font-display: swap`

## Database Optimization

- Indexes on all foreign keys and frequently queried columns
- Use `select()` to pick only needed columns
- Pagination: always paginate list queries (never return all rows)
- Soft delete by default (indexed `deletedAt` column)
- Transactions for multi-step operations

## Caching

- HTTP cache headers on static assets
- TanStack Query for client-side cache (admin)
- API responses: appropriate Cache-Control headers
- CDN caching via Vercel Edge Network

## Bundle Size

- Minimize client-side JavaScript
- Tree-shake via ESM imports
- No duplicate dependencies across packages
- Monitor bundle size in CI
