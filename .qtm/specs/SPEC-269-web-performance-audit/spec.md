---
spec-id: SPEC-269
title: Web performance audit & improvements — Core Web Vitals, 12 findings + fix catalog
type: improvement
complexity: medium
status: draft
created: 2026-06-23T00:00:00Z
audited: 2026-06-23
model_fit: mixed
effort_estimate_hours: 16-24
tags: [performance, web, audit, core-web-vitals, lcp, inp, cls, bundle, images]
---

# SPEC-269: Web performance audit & improvements

> ## ✅ RECON DONE + DECISIONS RESOLVED (2026-06-23)
>
> El recon se ejecutó sobre el código real de `apps/web` (no es "auditá todo"
> abstracto): **12 findings concretos** con archivo:línea en `## 3. Recon Findings`,
> y un fix catalog en `## 5`. Decisiones del owner:
>
> - **Hero LCP → static first-frame SSR.** Se renderiza el primer slide del hero como
>   `<img>` estático server-side (sin depender de JS para el LCP) y el `HeroImageRotator`
>   hidrata encima. Es el fix correcto, pero toca la arquitectura del rotator →
>   **subtarea POTENTE** (T-269-03b).
> - **Lighthouse CI → report-only primero.** Se agrega `@lhci/cli` + job que corre pero
>   NO bloquea PRs (los scores son flaky). Se promueve a gate bloqueante en un follow-up
>   tras estabilizar baselines.
> - **Bundle → full chunk-splitting a 0 chunks >500KB, SOLO `apps/web`** (admin fuera de
>   scope). Esto incluye el tuning iterativo de `manualChunks` con visualizer →
>   **subtarea POTENTE** (T-269-02b).
>
> **Model fit = MIXTO:** la mayoría de los fixes son mecánicos (BÁSICO); dos subtareas
> son arquitectónicas (POTENTE) y están atomizadas y marcadas como tal.

---

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Auditar y mejorar la performance de `apps/web` (web pública): Core Web Vitals
(LCP <2.5s, INP <200ms, CLS <0.1), bundle size (0 chunks >500KB), image optimization,
hydration strategy. El admin queda **fuera de scope** (ya tuvo SPEC-190).

**Why now:** Performance impacta UX, conversión y ranking SEO. Pre-launch es el momento
de fijar baselines. La web nunca tuvo una auditoría completa (a diferencia del admin).

### 2. Out of Scope

- SEO on-page (meta/JSON-LD) → SPEC-268.
- Accesibilidad WCAG → SPEC-270.
- **Admin panel performance** — solo `apps/web` (decisión owner).
- API/backend performance — solo frontend.
- Self-hosting de fonts → diferido (las fonts ya usan `display=swap` no-bloqueante; ver F11).
- Promover Lighthouse CI a gate bloqueante → follow-up (v1 = report-only).

### 3. Recon Findings (código real, no supuestos)

| # | Finding | Severity | Archivo:línea | Fit |
|---|---------|----------|---------------|-----|
| F1 | **Hero LCP bloqueado por hydration**: `HeroImageRotator` es `client:load` → el `<img>` del hero no existe en el HTML inicial; el browser no puede descubrir/preloadear la imagen LCP hasta hidratar React | **HIGH** | `HeroSection.astro:120`, `HeroImageRotator.client.tsx:108-114` | POTENTE |
| F2 | **Gallery LCP demorado por `client:visible`**: en accommodation detail el `ImageGallery` (primer contenido above-the-fold en desktop) monta `client:visible`, demorando la imagen LCP | **HIGH** | `[lang]/alojamientos/[slug].astro:482`, `ImageGallery.client.tsx:435-453` | BÁSICO |
| F3 | **2 chunks >500KB (~1MB, ~770KB)** sin `manualChunks` ni visualizer → imposible saber qué islands los causan sin instrumentar primero | **HIGH** | `astro.config.mjs:146-194` (sin `rollupOptions`), `apps/web/CLAUDE.md:817-840` | POTENTE |
| F4 | **Leaflet importado estático** (no lazy) en 2 mapas → leaflet (~150KB gzip) entra al bundle de esas islands | **MEDIUM** | `maps/LocationMap.client.tsx:8-15`, `maps/ListingMap.client.tsx:17-34` (vs el patrón correcto `host/editor/LocationPickerMap.client.tsx:44-56` que usa `import('leaflet')`) | BÁSICO |
| F5 | **`FavoriteButton` con `client:load` inconsistente** en event cards (below-the-fold) cuando el resto de las cards usa `client:visible` | **MEDIUM** | `EventCardFeatured.astro:96`, `EventCardHorizontal.astro:114` (vs `AccommodationCard.astro:135`, `ArticleCard.astro:117`, `DestinationCard.astro:126` que usan `client:visible`) | BÁSICO |
| F6 | **Avatar `<img>` sin width/height** (CLS): perfil + navbar | **MEDIUM** | `mi-cuenta/index.astro:145`, `shared/navigation/UserMenu.client.tsx:540` | BÁSICO |
| F7 | **Hero del home sin `<link rel=preload as=image>`** (complementa F1) | **MEDIUM** | `BaseLayout.astro` / `[lang]/index.astro` (no existe el preload) | BÁSICO |
| F8 | **Destination detail hero sin `fetchpriority=high`** (tiene `loading=eager`) | **LOW** | `[lang]/destinos/[...path].astro:412,419` (vs `atraccion/[slug]/index.astro:58-59` que sí lo tiene) | BÁSICO |
| F9 | **Lighthouse CI muerto**: `lighthouserc.json` existe pero `lhci` no es devDependency ni lo llama ningún workflow | **MEDIUM** | `apps/web/lighthouserc.json`, `apps/web/package.json:22` (script `lighthouse`), `.github/workflows/*` (0 hits) | BÁSICO |
| F10 | **Sin bundle-size guard** (no visualizer, no `build:analyze`, no size-limit) — el gap que SPEC-190 cerró para admin | **MEDIUM** | `apps/web/package.json` (sin scripts), patrón reusable: `.qtm/specs/SPEC-190-admin-bundle-perf-icons-and-codesplit/spec.md` | BÁSICO |
| F11 | **Fonts vía Google Fonts** (ya con `display=swap` + preconnect + load no-bloqueante) — self-hosting daría ~100ms pero es opcional | **LOW** | `shared/FontsLoader.astro:32,35-37` | BÁSICO (diferido) |
| F12 | **`ImageGallery` lightbox `<img>` sin dimensions** — NO es CLS risk (está dentro de un modal ya abierto), pero conviene normalizar | **LOW** | `ImageGallery.client.tsx:297` | BÁSICO |

**Findings POSITIVOS verificados (no tocar):** GLightbox ya se carga lazy condicional
(`BaseLayout.astro:316-320`); Cloudinary remote images ya optimizadas con presets
`q_auto,f_auto,dpr_auto` (`packages/media/src/presets.ts`); OG image bien cacheada
(`api/og.ts:191`, `s-maxage=604800` + caches module-scope); prefetch `hover` bien
configurado (`astro.config.mjs:75-78`); tiptap/recharts son **auth-only** (host
dashboard/editor) → NO afectan el LCP público.

### 4. Remaining Audit Procedure (a ejecutar por el implementador)

Estos checks NO se pueden hacer leyendo el código; requieren correr la app:

| Check | Cómo | Pass criteria |
|-------|------|---------------|
| Lighthouse Performance | `pnpm --filter web lighthouse` (tras T-269-10) o `npx lighthouse <url> --preset=perf`, mediana de 5 runs, **mobile** | ≥90 mobile en home/listing/detail |
| LCP por página | DevTools Performance panel / web-vitals, mobile throttle | <2.5s |
| INP | DevTools / web-vitals, interactuar con search + filters | <200ms |
| CLS | DevTools Layout Shift regions | <0.1 |
| Bundle real | `pnpm --filter web build:analyze` (tras T-269-02a) → leer el visualizer | identificar chunks >500KB y su origen |

Páginas clave (mínimo): home `/{lang}/`, listados (`/alojamientos/`, `/eventos/`,
`/destinos/`, `/gastronomia/`, `/experiencias/`, `/publicaciones/`), y un detail de cada
entidad.

### 5. Fix Catalog (detalle por finding)

**F1 — Hero static first-frame (POTENTE):** Renderizar el primer slide del hero como
`<img>` estático SSR en `HeroSection.astro` (con el WebP srcset ya generado por
`getImage()`, líneas 69-84), visible sin JS. El `HeroImageRotator` hidrata encima
(`client:load`) y, en su primer render, debe reusar/no-reemplazar ese primer frame para
evitar flicker (montar con el mismo `src`/dimensiones, opacidad estable). Mantener
`fetchpriority=high`/`loading=eager` en ese primer frame.

**F2 — Gallery LCP:** cambiar `ImageGallery` de `client:visible` a `client:load` en
`alojamientos/[slug].astro:482` (la galería es el primer contenido above-the-fold en
desktop). Alternativa equivalente: renderizar SSR el primer cell. Elegir `client:load`
por simplicidad.

**F3 — Chunk-splitting a 0 >500KB (POTENTE):** ver T-269-02a/02b. Requiere instrumentar
(visualizer) → identificar islands culpables → definir `manualChunks` en
`astro.config.mjs` `vite.build.rollupOptions.output.manualChunks` (agrupar vendor común,
separar leaflet/tiptap/recharts en su propio chunk lazy). Loop measure-tune-measure hasta
0 chunks >500KB. Meta auth-only (tiptap/recharts) puede quedar en chunks propios siempre
que cada uno baje de 500KB; lo crítico es el bundle de páginas públicas.

**F4 — Leaflet lazy:** en `LocationMap.client.tsx` y `ListingMap.client.tsx` cambiar los
imports estáticos de `leaflet`/`react-leaflet` por dinámicos, espejando
`host/editor/LocationPickerMap.client.tsx:44-56` (`const L = await import('leaflet')`).

**F5 — Event card directives:** `EventCardFeatured.astro:96` y
`EventCardHorizontal.astro:114` → `FavoriteButton client:visible` (igual que las otras cards).

**F6/F12 — Image dimensions:** agregar `width`/`height` (avatar: `width={40} height={40}`
+ CSS `object-fit:cover`) en `mi-cuenta/index.astro:145`, `UserMenu.client.tsx:540`, y
normalizar `ImageGallery.client.tsx:297`.

**F7 — Hero preload:** agregar `<link rel="preload" as="image" imagesrcset=... imagesizes=...>`
del primer hero en el `<head>` del home (complementa F1; juntos resuelven el LCP del hero).

**F8 — Destination hero:** agregar `fetchpriority="high"` a los `<img>` en
`destinos/[...path].astro:412,419`.

**F9/F10 — Lighthouse CI + bundle guard:** ver T-269-10/T-269-02a.

**F11 — Fonts (diferido):** dejar Google Fonts como está (ya `display=swap`). El
self-hosting en `public/fonts/` + `preload as=font` queda como nota de follow-up.

### 6. Tasks

| Task | Title | Status | Fit |
|---|---|---|---|
| T-269-01 | Lighthouse audit manual (home/listing/detail, mobile+desktop) — capturar baseline | pending | BÁSICO |
| T-269-02a | Bundle: agregar `rollup-plugin-visualizer` + script `build:analyze` + baseline snapshot (patrón SPEC-190) | pending | BÁSICO |
| T-269-02b | Bundle: definir `manualChunks` en `astro.config.mjs` + iterar hasta **0 chunks >500KB** | pending | **POTENTE** |
| T-269-03a | LCP F7: `<link rel=preload as=image>` del hero en el home | pending | BÁSICO |
| T-269-03b | LCP F1: hero **static first-frame SSR** + rotator hidrata encima sin flicker | pending | **POTENTE** |
| T-269-04 | LCP F2: `ImageGallery` → `client:load` en accommodation detail | pending | BÁSICO |
| T-269-05 | CLS F6/F12: width/height en avatars + normalizar lightbox img | pending | BÁSICO |
| T-269-06 | Hydration F5: event card `FavoriteButton` → `client:visible` | pending | BÁSICO |
| T-269-07 | Images F4: lazy-import leaflet en `LocationMap`/`ListingMap` | pending | BÁSICO |
| T-269-08 | Images F8: `fetchpriority=high` en destination hero | pending | BÁSICO |
| T-269-09 | INP audit: revisar event handlers de islands (search, filters) — debounce donde aplique | pending | BÁSICO |
| T-269-10 | CI F9: agregar `@lhci/cli` devDependency + job CI **report-only** (no bloqueante) contra preview build | pending | BÁSICO |
| T-269-11 | Re-run Lighthouse post-fix → score ≥90 mobile en páginas clave | pending | BÁSICO |

### 7. Acceptance Criteria

- [ ] Lighthouse Performance ≥90 mobile en home, listing, detail (mediana de 5 runs).
- [ ] LCP <2.5s en páginas clave; el hero del home pinta sin esperar hydration (F1+F7).
- [ ] INP <200ms en páginas clave.
- [ ] CLS <0.1 en páginas clave; avatars con dimensions (F6).
- [ ] **0 chunks >500KB** en el build de `apps/web` (verificable por visualizer).
- [ ] Leaflet se carga lazy en `LocationMap`/`ListingMap` (no en el bundle inicial).
- [ ] Event card `FavoriteButton` usa `client:visible`.
- [ ] CI corre Lighthouse **report-only** (no bloquea, deja artefacto/score visible).
- [ ] Cada fix verificado visualmente (sin regresión funcional).

### 8. Risks

| Risk | Mitigation |
|---|---|
| Hero static-first-frame causa flicker al hidratar (F1) | El rotator monta con el mismo `src`/dims/opacidad del frame SSR; test visual del primer paint. |
| `manualChunks` mal definido rompe el lazy-loading o duplica vendor | Iterar con visualizer (T-269-02a primero), verificar que cada chunk baje de 500KB sin romper islands. |
| Lighthouse scores flaky | report-only v1 (no bloquea); mediana de 5 runs; gate bloqueante diferido. |
| Remote images no-Cloudinary (Unsplash/Pexels) sin optimizar | Trade-off aceptado (SSRF guard); fuera de scope de esta pasada. |
| Fixes rompen funcionalidad | Test visual después de cada fix (las islands son interactivas). |

---

## Part 2 — Implementation Notes

### Source

Owner question (2026-06-23): "analisis y mejora de seo, performance y accesibilidad de la
app web completa". Refinado 2026-06-23 con recon real + 3 decisiones owner (ver banner).

### Reference (verificado en recon)

- Bundle accepted-warning: `apps/web/CLAUDE.md:817-840`. Sin `manualChunks`: `astro.config.mjs:146-194`.
- Heavy deps: `apps/web/package.json` (leaflet `:52`, tiptap `:40-44`, recharts `:59`, glightbox `:50`).
- Hero: `HeroSection.astro:120`, `HeroImageRotator.client.tsx:108-114`.
- Gallery: `ImageGallery.client.tsx:435-453`, montaje `[lang]/alojamientos/[slug].astro:482`.
- Leaflet patrón correcto (a copiar): `host/editor/LocationPickerMap.client.tsx:44-56`.
- Avatars CLS: `mi-cuenta/index.astro:145`, `UserMenu.client.tsx:540`.
- Cloudinary presets (ya optimizado): `packages/media/src/presets.ts`, `apps/web/src/lib/media.ts:169-208`.
- Fonts: `shared/FontsLoader.astro:32-51`.
- Lighthouse: `apps/web/lighthouserc.json`, script `apps/web/package.json:22`.
- Bundle guard pattern: `.qtm/specs/SPEC-190-admin-bundle-perf-icons-and-codesplit/spec.md`.
- OG (ya cacheado): `apps/web/src/pages/api/og.ts:191`.
- astro.config: `output:'server'` + node standalone (`astro.config.mjs:64-66`), prefetch hover (`:75-78`).

### Cross-spec dependencies

- SPEC-268 (SEO) — Core Web Vitals son ranking signal.
- SPEC-270 (a11y) — reduced motion / lazy load ayudan a ambos.
- SPEC-228 (loading states) — skeletons ayudan a CLS.
- SPEC-190 (admin bundle perf) — patrón reusable de visualizer + `build:analyze`.

---

## Model Fit Verdict

**MIXTO.** La mayoría del trabajo es mecánico y BÁSICO: agregar width/height (F6/F12),
downgradear directivas `client:*` (F2/F5), lazy-import de leaflet (F4), preload del hero
(F7), `fetchpriority` (F8), wirear `@lhci/cli` report-only (F9/F10). Todos tienen
archivo:línea y un patrón existente a copiar.

**Dos subtareas son POTENTE y están atomizadas y marcadas:**
- **T-269-03b (hero static first-frame):** reestructurar `HeroImageRotator` para SSR del
  primer frame + hydration sin flicker. Requiere criterio sobre el ciclo de hydration de
  Astro islands; no es un fix de una línea.
- **T-269-02b (manualChunks a 0 chunks >500KB):** requiere el loop measure-tune-measure
  con el visualizer (T-269-02a es prerequisito BÁSICO que lo habilita). El target full
  (decisión owner) implica iteración, no una config fija.

**Recomendación de ejecución:** un modelo chico puede tomar todas las tareas BÁSICAS
(F2,F4,F5,F6,F7,F8 + T-269-01/02a/10/11) de corrido. Las dos POTENTE conviene
asignarlas a un modelo más capaz o revisarlas con cuidado. T-269-02a (instrumentar)
DEBE ir antes que 02b (tunear), porque sin el visualizer el chunk-splitting es a ciegas.
