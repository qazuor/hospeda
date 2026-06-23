---
spec-id: SPEC-268
title: Web SEO audit & improvements — meta tags, JSON-LD, sitemap, robots, canonical
type: improvement
complexity: medium
status: draft
created: 2026-06-23T00:00:00Z
effort_estimate_hours: 12-20
tags: [seo, web, audit, meta-tags, json-ld, sitemap, robots, core-web-vitals]
---

# SPEC-268: Web SEO audit & improvements

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Auditar y mejorar el SEO on-page de toda la app web: meta tags, datos estructurados (JSON-LD), sitemap, robots.txt, canonical, hreflang, Open Graph, y Technical SEO (crawlability, indexability, Core Web Vitals SEO impact).

**Why now:** La web está en pre-beta. Antes del launch público hay que asegurar que todas las páginas tengan SEO correcto para indexación y ranking. Errores de SEO post-launch son más costosos de fixear (Google re-crawl takes days/weeks).

**Related:** SPEC-267 (SEO fields decision) — su resultado afecta si esta spec incluye mejoras al admin SEO tab o no. SPEC-157 (web-seo-polish) fue un primer paso; esta spec es la auditoría completa.

### 2. Out of Scope

- Performance optimización (LCP/INP/CLS) → SPEC-269
- Accessibility (WCAG 2.1 AA) → SPEC-270
- Admin panel SEO — solo web pública
- Off-page SEO (backlinks, link building) — fuera de scope técnico

### 3. Current State

| Área | Estado actual | Archivo |
|------|--------------|---------|
| Meta tags | `SEOHead.astro` renderiza title, description, OG, Twitter Card, hreflang | `apps/web/src/components/seo/SEOHead.astro` |
| JSON-LD | Components por entidad: LodgingBusiness, Event, Place, Article, Breadcrumb, FAQ, ItemList | `apps/web/src/components/seo/*JsonLd.astro` |
| Sitemap | Dynamic `sitemap-dynamic.xml.ts` — fetcha entidades, genera URLs por locale | `apps/web/src/pages/sitemap-dynamic.xml.ts` |
| Robots.txt | Dynamic endpoint con noindex hosts (staging) + GPTBot block | `apps/web/src/pages/robots.txt.ts` |
| Canonical | `SEOHead.astro` emite `<link rel="canonical">` | OK |
| Hreflang | `SEOHead.astro` emite es/en/pt + x-default | OK |
| noindex | Aplicado en account pages, filter pages, 404, autor/tag/categoria | OK |
| OG image | Dynamic `/api/og` endpoint con photo/brand cards | `apps/web/src/pages/api/og.ts` |
| Prerender | SSG en static pages, SSR en dynamic | Mix de strategies |

### 4. Audit Areas

#### 4.1 Meta Tags

- [ ] Todas las páginas tienen title único y descriptivo
- [ ] Description dentro de 70-160 chars en todas las páginas
- [ ] No duplicate titles/descriptions entre páginas
- [ ] Title format consistente (Page | Hospeda)
- [ ] Meta viewport presente
- [ ] charset declarado

#### 4.2 Datos Estructurados (JSON-LD)

- [ ] Todas las entity detail pages tienen su JSON-LD correspondiente
- [ ] JSON-LD válido según Schema.org validator
- [ ] Breadcrumbs en todas las páginas con jerarquía
- [ ] No missing required fields en JSON-LD
- [ ] Review/rating aggregate en accommodations
- [ ] FAQPage en páginas con FAQs

#### 4.3 Sitemap

- [ ] Todas las public URLs están en el sitemap
- [ ] No URLs noindex en sitemap
- [ ] lastmod correcto (updatedAt de entidad)
- [ ] Priority/changefreq razonables
- [ ] Sitemap index si >50k URLs (escalabilidad)
- [ ] Sitemap referenciado en robots.txt

#### 4.4 Robots.txt

- [ ] Block correcto de rutas privadas
- [ ] Allow de rutas públicas
- [ ] Sitemap reference
- [ ] Crawl-delay si necesario
- [ ] GPTBot / AI crawler policy

#### 4.5 Canonical & Hreflang

- [ ] Canonical en todas las páginas (no self-referential en noindex)
- [ ] Hreflang es/en/pt correcto
- [ ] x-default apunta a es
- [ ] No conflict entre canonical y hreflang

#### 4.6 Open Graph & Social

- [ ] OG image en todas las páginas
- [ ] OG type correcto (website vs article)
- [ ] Twitter Card tags
- [ ] OG image dimensions correctas (1200x630)

#### 4.7 Technical SEO

- [ ] No broken internal links
- [ ] Trailing slash consistente
- [ ] Redirect chains minimizadas
- [ ] 404 page tiene noindex
- [ ] 500 page no indexada
- [ ] HTTPS enforced
- [ ] Page speed mobile (relacionado con SPEC-269)

### 5. Deliverables

| Deliverable | Descripción |
|-------------|-------------|
| Audit report | Documento con findings por página/categoría, severity (critical/medium/low) |
| Fix plan | Lista priorizada de fixes con estimación |
| Implementation | Fixes aplicados (pueden ser 1 PR o varios por categoría) |
| Validation | Lighthouse SEO score ≥90 en todas las páginas clave |
| Monitoring | CI check para prevenir regresiones SEO |

### 6. Tasks

| Task | Title | Status |
|---|---|---|
| T-268-01 | Lighthouse SEO audit en todas las páginas clave (home, listing, detail) | pending |
| T-268-02 | Schema.org JSON-LD validator en todas las entity detail pages | pending |
| T-268-03 | Sitemap completeness check — todas las public URLs presentes | pending |
| T-268-04 | Meta tags audit — title/description únicos, length, format | pending |
| T-268-05 | Canonical/hreflang consistency audit | pending |
| T-268-06 | Robots.txt review + sitemap reference | pending |
| T-268-07 | OG image validation en todas las páginas | pending |
| T-268-08 | Broken internal links scan | pending |
| T-268-09 | Implementar fixes priorizados | pending |
| T-268-10 | CI guard para prevenir regresiones SEO | pending |
| T-268-11 | Lighthouse re-run post-fix — score ≥90 | pending |

### 7. Acceptance Criteria

- [ ] Lighthouse SEO score ≥90 en home, listing pages, y entity detail pages
- [ ] 0 errores en Schema.org validator para todas las entity detail pages
- [ ] Sitemap incluye todas las public URLs, 0 noindex URLs
- [ ] 0 duplicate titles/descriptions
- [ ] CI guard bloquea PRs que rompan SEO

### 8. Risks

| Risk | Mitigation |
|---|---|
| Lighthouse scores varían entre runs | Usar mediana de 5 runs, no single run |
| Fixes pueden requerir cambios en API (ej: datos faltantes para JSON-LD) | Coordinar con API team si se descubren gaps |
| SPEC-267 resultado afecta scope (SEO fields) | Comenzar con audit independiente, aplicar fixes de SEO fields después |

---

## Part 2 — Implementation Notes

### Source

Owner question (2026-06-23): "analisis y mejora de seo, performance y accesibilidad de la app web completa"

### Reference

- SEOHead: `apps/web/src/components/seo/SEOHead.astro`
- JSON-LD: `apps/web/src/components/seo/*JsonLd.astro` (LodgingBusiness, Event, Place, Article, Breadcrumb, FAQ, ItemList)
- Sitemap: `apps/web/src/pages/sitemap-dynamic.xml.ts`
- Robots: `apps/web/src/pages/robots.txt.ts`
- Middleware (noindex headers): `apps/web/src/middleware.ts`
- SPEC-157: web-seo-polish (primer paso SEO, completado)

### Cross-spec dependencies

- SPEC-267 (SEO fields decision) — su resultado afecta qué fixes se aplican
- SPEC-269 (web performance) — Core Web Vitals impactan SEO ranking
- SPEC-270 (web accessibility) — algunos a11y fixes mejoran SEO también
