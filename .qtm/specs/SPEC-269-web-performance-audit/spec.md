---
spec-id: SPEC-269
title: Web performance audit & improvements — Core Web Vitals (LCP, INP, CLS), bundle, images
type: improvement
complexity: medium
status: draft
created: 2026-06-23T00:00:00Z
effort_estimate_hours: 16-24
tags: [performance, web, audit, core-web-vitals, lcp, inp, cls, bundle, images]
---

# SPEC-269: Web performance audit & improvements

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Auditar y mejorar la performance de toda la app web: Core Web Vitals (LCP, INP, CLS), bundle size, image optimization, JavaScript hydration, y rendering strategy. Asegurar que todas las páginas cumplan los thresholds de Google (LCP <2.5s, INP <200ms, CLS <0.1).

**Why now:** Performance impacta UX, conversión, y SEO ranking. Pre-launch es el momento de asegurar baselines correctos. Especificamente el admin ya tuvo trabajo de bundle perf (SPEC-190) pero la web no tuvo una auditoría completa.

**Related:** SPEC-268 (SEO) — Core Web Vitals son señal de ranking. SPEC-270 (a11y) — algunos a11y fixes mejoran performance (reduced motion, lazy load).

### 2. Out of Scope

- SEO on-page (meta tags, JSON-LD) → SPEC-268
- Accessibility (WCAG 2.1 AA) → SPEC-270
- Admin panel performance — solo web pública
- API performance — solo frontend

### 3. Current State

| Área | Estado | Notas |
|------|--------|-------|
| Rendering | Mix SSG/SSR | SSG en static, SSR en dynamic, Cloudflare cache |
| Islands | React islands con client:* directives | client:visible, client:idle mayormente |
| Images | `<Image>` astro:assets para local, `<img loading="lazy">` para remote | Sin optimization de remote images |
| Bundle | 2 chunks >500KB (~1MB y ~770KB) | Aceptado en BETA-78, pero pendiente de revisión |
| OG image | Dynamic generation via `/api/og` | Potencial bottleneck |
| Fonts | Geologica, Roboto, Caveat | FOUC prevention inline script |
| CSS | CSS Modules + global.css | Sin Tailwind (mejor para bundle) |
| View Transitions | Astro ClientRouter | Puede impactar INP |

### 4. Audit Areas

#### 4.1 Core Web Vitals

- [ ] **LCP (Largest Contentful Paint)** < 2.5s en mobile
  - Identificar LCP element en cada page type
  - Optimizar hero images, fonts, critical CSS
  - Preload critical resources
- [ ] **INP (Interaction to Next Paint)** < 200ms
  - Auditar event handlers en islands
  - Reducir JavaScript execution time
  - Debounce/throttle donde aplique
- [ ] **CLS (Cumulative Layout Shift)** < 0.1
  - Width/height en todas las images/IFrames
  - Skeletons para async content
  - Font-display: swap

#### 4.2 Bundle Size

- [ ] Analizar bundle con `astro build --verbose` o `rollup-plugin-visualizer`
- [ ] Identificar chunks grandes y机会 de code-splitting
- [ ] Tree-shaking: verificar que no se importe código no usado
- [ ] Dynamic imports para islands below-the-fold
- [ ] React vendor bundle: revisar si se puede reducir

#### 4.3 Image Optimization

- [ ] Remote images: considerar proxy con optimization (Cloudflare Image Resizing o similar)
- [ ] `<Image>` de astro:assets para todas las local images
- [ ] `loading="lazy"` en todas las below-the-fold
- [ ] `srcset` y `sizes` para responsive images
- [ ] WebP/AVIF format
- [ ] OG image cache strategy

#### 4.4 JavaScript Hydration

- [ ] Auditar client:* directives — usar el más lazy posible
- [ ] `client:visible` > `client:load` para below-the-fold
- [ ] `client:idle` para low-priority islands
- [ ] Considerar `client:media` para responsive-only
- [ ] Islands que no necesitan interactividad → convertir a Astro

#### 4.5 CSS Performance

- [ ] Critical CSS inline
- [ ] CSS Modules tree-shaking
- [ ] Remover CSS no usado
- [ ] `font-display: swap` en todas las fonts

#### 4.6 Network/Cache

- [ ] Cloudflare cache headers correctos
- [ ] Cache-control en static assets
- [ ] Stale-while-revalidate donde aplique
- [ ] HTTP/2 push o preload hints
- [ ] Prefetch de rutas probables

#### 4.7 Rendering Strategy

- [ ] SSG pages: verificar que no haya data dinámica
- [ ] SSR pages: verificar Cloudflare cache + revalidation
- [ ] Server Islands: usar `server:defer` para auth-dependent fragments
- [ ] Streaming donde aplique

### 5. Deliverables

| Deliverable | Descripción |
|-------------|-------------|
| Audit report | Lighthouse + CrUX data, findings por página, severity |
| Fix plan | Priorizado por impacto (LCP > INP > CLS > bundle) |
| Implementation | Fixes aplicados, puede ser múltiples PRs |
| Monitoring | CI performance budget + Lighthouse CI |

### 6. Tasks

| Task | Title | Status |
|---|---|---|
| T-269-01 | Lighthouse performance audit en home, listing, detail (mobile + desktop) | pending |
| T-269-02 | Bundle analysis con visualizer — identificar chunks grandes | pending |
| T-269-03 | LCP audit — identificar LCP element, optimizar | pending |
| T-269-04 | CLS audit — images sin dimensions, skeletons, fonts | pending |
| T-269-05 | INP audit — event handlers, JavaScript execution | pending |
| T-269-06 | Image optimization audit — remote images, srcset, formats | pending |
| T-269-07 | Hydration audit — client:* directives óptimas | pending |
| T-269-08 | Cache strategy audit — Cloudflare, cache-control | pending |
| T-269-09 | Implementar fixes priorizados (LCP primero) | pending |
| T-269-10 | Lighthouse CI guard — performance budget | pending |
| T-269-11 | Re-run Lighthouse post-fix — score ≥90 mobile | pending |

### 7. Acceptance Criteria

- [ ] Lighthouse Performance score ≥90 en mobile (home, listing, detail)
- [ ] LCP < 2.5s en todas las páginas clave
- [ ] INP < 200ms en todas las páginas clave
- [ ] CLS < 0.1 en todas las páginas clave
- [ ] Bundle: 0 chunks >500KB (o justificado)
- [ ] CI performance budget bloquea regresiones

### 8. Risks

| Risk | Mitigation |
|---|---|
| Remote images no optimizables sin proxy | Evaluar Cloudflare Image Resizing o alternativa |
| Cloudflare cache enmascara issues de rendering | Auditar con cache bypassed |
| Lighthouse scores varían | Usar mediana de 5 runs, Lighthouse CI |
| Fixes pueden romper funcionalidad | Test visual después de cada fix |

---

## Part 2 — Implementation Notes

### Source

Owner question (2026-06-23): "analisis y mejora de seo, performance y accesibilidad de la app web completa"

### Reference

- Rendering: `apps/web/CLAUDE.md` — Rendering Strategy table
- Bundle warnings: `apps/web/CLAUDE.md` — Accepted production-build warnings
- Islands: client:* directives en todas las pages
- Images: `<Image>` astro:assets + `<img loading="lazy">`
- Cache: Cloudflare + revalidation API
- SPEC-190: admin bundle perf (precedent)
- SPEC-176: web color fallback (relacionado)
- SPEC-228: web loading states (relacionado)

### Cross-spec dependencies

- SPEC-268 (SEO) — Core Web Vitals son ranking signal
- SPEC-270 (a11y) — reduced motion, lazy load mejoran ambos
- SPEC-228 (loading states) — skeletons mejoran CLS
