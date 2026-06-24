---
spec-id: SPEC-268
title: Web SEO audit & improvements — 12 concrete findings + fix catalog
type: improvement
complexity: medium
status: draft
created: 2026-06-23T00:00:00Z
audited: 2026-06-23
model_fit: basic
effort_estimate_hours: 12-20
tags: [seo, web, audit, meta-tags, json-ld, sitemap, robots, canonical]
---

# SPEC-268: Web SEO audit & improvements

> ## ✅ AUDIT DONE + DECISIONS RESOLVED (2026-06-23)
>
> La auditoría ya se ejecutó sobre el código real (no es "auditá todo" abstracto):
> **12 findings concretos** con archivo y fix, en `## 3. Audit Findings`. Decisiones
> de producto tomadas por el owner:
>
> - **Sub-listados por destino** (`/destinos/[slug]/alojamientos|eventos/`) → **INDEX**
>   con canonical self (long-tail local "alojamientos en Colón"). NO noindex.
> - **Schema.org types** para los detail sin JSON-LD: gastronomía → `Restaurant`,
>   experiencias → `TouristAttraction`, atracción → `TouristAttraction`.
> - **Sitemap priority** diferenciado: home `1.0` / listados `0.7` / detail `0.8`.
> - **AI crawlers**: se mantienen PERMITIDOS (decisión AEO ya implementada en
>   `robots.txt.ts`, no se toca).
> - **SEO fields** (`keywords`): los elimina SPEC-267; esta spec NO toca
>   title/description (siguen vía `SEOHead.astro`).

---

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Corregir los 12 findings SEO detectados y completar la auditoría con las
validaciones automatizables (Lighthouse, Schema.org validator, broken-link scan), de
modo que toda página pública tenga SEO correcto antes del launch.

### 2. Out of Scope

- Performance / Core Web Vitals → SPEC-269
- Accesibilidad WCAG → SPEC-270
- Admin panel SEO tab → SPEC-267
- SEO fields (`keywords` removal) → SPEC-267
- Off-page SEO (backlinks) → fuera de scope técnico

### 3. Audit Findings (ya descubiertos)

| # | Finding | Severity | Archivo | Fix (resumen) |
|---|---------|----------|---------|---------------|
| F1 | `gastronomia/[slug]` sin JSON-LD | **HIGH** | `apps/web/src/pages/[lang]/gastronomia/[slug].astro` | Agregar `Restaurant` JSON-LD (nuevo `RestaurantJsonLd.astro` o vía `JsonLd.astro`) |
| F2 | `experiencias/[slug]` sin JSON-LD | **HIGH** | `apps/web/src/pages/[lang]/experiencias/[slug].astro` | Agregar `TouristAttraction` JSON-LD |
| F3 | `destinos/atraccion/[slug]` sin JSON-LD | **HIGH** | `apps/web/src/pages/[lang]/destinos/atraccion/[slug]/index.astro` | Agregar `TouristAttraction` JSON-LD |
| F4 | gastronomía y experiencias ausentes del sitemap | **HIGH** | `apps/web/src/pages/sitemap-dynamic.xml.ts` | Agregar fetch de ambas entidades con su `pathFn` |
| F5 | XSS: `contacto` usa JSON-LD inline sin escape | **HIGH (seguridad)** | `apps/web/src/pages/[lang]/contacto/index.astro:120-161` | Pasar por `JsonLd.astro` (aplica `</`→`<` escape) |
| F6 | robots no bloquea `/reset-password`, `/verify-email*` | MEDIUM | `apps/web/src/pages/robots.txt.ts:66-74` | Agregar a `DISALLOW_PATHS` |
| F7 | `alojamientos/mapa`, `destinos/mapa` sin noindex | MEDIUM | `[lang]/alojamientos/mapa.astro`, `[lang]/destinos/mapa.astro` | `noindex=true` (app interactiva, sin contenido) |
| F8 | `alojamientos/[slug]/fotos` sin noindex ni canonical al padre | MEDIUM | `[lang]/alojamientos/[slug]/fotos.astro` | `noindex=true` + canonical → alojamiento padre |
| F9 | sitemap `priority 0.8` uniforme | LOW | `sitemap-dynamic.xml.ts` | home `1.0` / listados `0.7` / detail `0.8` |
| F10 | sitemap sin fallback de `lastmod` | LOW | `sitemap-dynamic.xml.ts:174` | Fallback a build date si la entidad no trae `updatedAt` |
| F11 | `contacto` JSON-LD usa tipo implícito | LOW | `contacto/index.astro` | (resuelto junto con F5) |
| F12 | `SEOHead` no emite robots positivo (no permite `max-image-preview`) | LOW (opcional) | `SEOHead.astro:128` | Emitir `index,follow,max-image-preview:large` en caso positivo |

**Decisión sobre sub-listados por destino (era un gap candidato a noindex):** se
INDEXAN con canonical self. NO requieren fix de noindex. Verificar que emiten canonical
correcto (self) y JSON-LD `ItemList`.

### 4. Remaining Audit Procedure (validaciones a ejecutar)

Estos checks NO se pudieron correr en la lectura estática; el implementador los ejecuta:

| Check | Cómo | Pass criteria |
|-------|------|---------------|
| Lighthouse SEO | `npx lighthouse <url> --only-categories=seo`, mediana de 5 runs | ≥90 en cada página clave |
| Schema.org validez | https://validator.schema.org/ o `npx structured-data-testing-tool` por cada detail page | 0 errores |
| Broken internal links | crawler (`npx linkinator <base-url> --recurse`) | 0 broken |
| Duplicate title/description | crawl + diff de `<title>`/`<meta description>` | 0 duplicados entre páginas distintas |

Páginas clave a auditar (mínimo): home `/{lang}/`, cada listado (`/alojamientos/`,
`/destinos/`, `/eventos/`, `/gastronomia/`, `/experiencias/`, `/publicaciones/`), y un
detail de cada entidad. Lista completa de rutas en `## Ruteo público` (Part 2).

### 5. Fix Catalog (detalle por finding)

**F1/F2/F3 — JSON-LD faltantes:** seguir el patrón de `LodgingBusinessJsonLd.astro` /
`EventJsonLd.astro` existentes. Para cada uno:
- Crear el componente (o usar `JsonLd.astro` con el objeto) con el `@type` decidido.
- Mapear campos de la entidad (name, description, image, address/geo si aplica, priceRange
  para Restaurant, etc.). Si un campo requerido no está en la API, registrarlo como gap de
  API (no inventar datos).
- Importarlo en la detail page correspondiente, igual que las otras detail pages.

**F4 — sitemap gastronomía/experiencias:** en `sitemap-dynamic.xml.ts`, agregar 2 entradas
al array de fetch (líneas ~219-224) replicando el shape de `events`/`posts`:
`/api/v1/public/gastronomy` → `/gastronomia/{slug}/`, `/api/v1/public/experiences` →
`/experiencias/{slug}/`. priority `0.8`, changefreq `weekly`.

**F5 — XSS contacto:** reemplazar el `set:html={JSON.stringify(...)}` inline por
`<JsonLd data={contactPageJsonLd} />` (el wrapper ya escapa `<`). Verificar que el resto
de páginas con JSON-LD inline también usen el wrapper.

**F6 — robots:** agregar `/*/reset-password`, `/*/verify-email`, `/*/verify-email-sent`
a `DISALLOW_PATHS`.

**F7/F8 — noindex:** pasar `noindex={true}` al `SEOHead`/layout de las páginas de mapa;
en fotos además setear canonical al alojamiento padre (no self).

**F9 — sitemap priority:** parametrizar `priority` por tipo. Home no está hoy en el
dynamic sitemap (la genera `@astrojs/sitemap`); verificar que la home quede con `1.0` en
el sitemap final. Listados `0.7`, detail `0.8`.

**F10 — lastmod fallback:** si `item.updatedAt ?? item.updated_at` es undefined, usar la
fecha de build en vez de omitir el tag.

**F12 (opcional):** emitir robots positivo con directivas de preview.

### 6. User Stories con Acceptance Checks

#### US-1 — Como buscador (Google), quiero datos estructurados en TODAS las detail pages

```
GIVEN una detail page de gastronomía, experiencia o atracción
WHEN Google la crawlea
THEN encuentra un bloque JSON-LD válido con el @type correcto
 AND el JSON-LD pasa el Schema.org validator sin errores
```

Checks:
- [ ] `gastronomia/[slug]` emite `Restaurant` JSON-LD válido
- [ ] `experiencias/[slug]` emite `TouristAttraction` JSON-LD válido
- [ ] `destinos/atraccion/[slug]` emite `TouristAttraction` JSON-LD válido
- [ ] Los 3 pasan validator.schema.org con 0 errores

#### US-2 — Como buscador, quiero descubrir todas las entidades vía sitemap

```
GIVEN el sitemap dinámico
WHEN lo solicito
THEN incluye URLs de gastronomía y experiencias (además de las 4 actuales)
 AND la home tiene priority 1.0, listados 0.7, detail pages 0.8
 AND ninguna URL noindex aparece en el sitemap
```

Checks:
- [ ] `curl /sitemap-dynamic.xml` contiene URLs `/gastronomia/` y `/experiencias/`
- [ ] priority diferenciado por tipo verificable en el XML
- [ ] 0 URLs noindex (mapas, fotos, facetas) en el sitemap

#### US-3 — Como equipo de seguridad, quiero que ningún JSON-LD permita inyección

```
GIVEN cualquier página que emite JSON-LD
WHEN un campo de datos contiene la secuencia "</script>"
THEN se escapa (</ → <) y NO rompe el documento ni inyecta script
```

Checks:
- [ ] `contacto` usa `JsonLd.astro` (no `set:html` crudo)
- [ ] grep: no quedan `set:html={JSON.stringify` de JSON-LD fuera del wrapper

#### US-4 — Como buscador, quiero no malgastar crawl budget en páginas sin valor

```
GIVEN páginas de mapa, galería de fotos, y rutas de auth
WHEN las crawleo
THEN mapas y fotos tienen noindex; fotos canonicaliza al alojamiento padre
 AND robots.txt bloquea reset-password y verify-email*
```

Checks:
- [ ] `alojamientos/mapa`, `destinos/mapa` → `<meta robots noindex>`
- [ ] `alojamientos/[slug]/fotos` → noindex + canonical al `/alojamientos/[slug]/`
- [ ] robots.txt incluye `/*/reset-password`, `/*/verify-email`, `/*/verify-email-sent`

### 7. Acceptance Criteria (global)

- [ ] Los 12 findings resueltos (F1–F12) o explícitamente diferidos con razón
- [ ] Lighthouse SEO ≥90 en home, los 6 listados, y un detail por entidad
- [ ] 0 errores Schema.org en todas las detail pages
- [ ] Sitemap completo (6 entidades) sin URLs noindex, priority diferenciado
- [ ] 0 JSON-LD inline sin escape
- [ ] CI guard que corre Lighthouse SEO en las páginas clave y falla < 90

### 8. Risks

| Risk | Mitigation |
|------|-----------|
| Lighthouse varía entre runs | Mediana de 5 runs, no single |
| JSON-LD requiere campos que la API no expone (Restaurant priceRange, geo) | Registrar como gap de API; no inventar; emitir JSON-LD con los campos disponibles |
| Sub-listados por destino con 1 item = thin content | Aceptado por decisión; monitorear post-launch, canonical self mitiga duplicación |

---

## Part 2 — Implementation Notes

### Ruteo público (relevado del código, 2026-06-23)

`output: 'server'` (SSR default); `trailingSlash: 'always'`.

**Indexables (necesitan SEO correcto):**
- Home: `/{lang}/` (SSG)
- Listados: `/{lang}/{alojamientos|destinos|eventos|gastronomia|experiencias|publicaciones}/`
- Detail: `/{lang}/alojamientos/[slug]`, `/destinos/[...path]`, `/destinos/atraccion/[slug]`,
  `/eventos/[slug]`, `/gastronomia/[slug]`, `/experiencias/[slug]`, `/publicaciones/[slug]`
- Sub-listados destino (INDEX): `/{lang}/destinos/[slug]/{alojamientos|eventos}/`
- Marketing/legales SSG: `/nosotros/`, `/beneficios/`, `/preguntas-frecuentes/`, `/contacto/`,
  `/colaborar/*`, `/legal/{terminos|privacidad|cookies}/`, `/suscriptores/{planes|turistas|propietarios}/`

**noindex ya aplicado (verificar, no romper):** facetas tipo/características/comodidades,
categorías/tags/autor de blog, búsqueda, checkout success/pending/failure, newsletter/*.

**A poner noindex (F7/F8):** mapas, galería de fotos.

### Reference

- SEOHead: `apps/web/src/components/seo/SEOHead.astro` (emite title, description, canonical,
  OG, Twitter, hreflang es/en/pt + x-default; noindex condicional)
- charset/viewport: `apps/web/src/layouts/BaseLayout.astro:88-89`
- JSON-LD components: `apps/web/src/components/seo/*JsonLd.astro` (Lodging, Event, Place,
  Article, Organization, WebSite, Breadcrumb, FAQPage, ItemList, AboutPage, PriceSpecification)
- Sitemap: `apps/web/src/pages/sitemap-dynamic.xml.ts`
- Robots: `apps/web/src/pages/robots.txt.ts` (AI crawlers permitidos por decisión AEO)

### Cross-spec dependencies

- SPEC-267 (resuelta): keywords se elimina; esta spec no toca SEO fields.
- SPEC-269 (perf), SPEC-270 (a11y): solapan en CWV y alt text; coordinar para no duplicar fixes.

---

## Model Fit Verdict

**BÁSICO.** La auditoría (la parte que requería criterio) ya está hecha: 12 findings con
archivo y fix concreto, decisiones de producto cerradas, tipos de schema definidos. Quedan:
(a) aplicar fixes mecánicos siguiendo patrones existentes (`*JsonLd.astro`, el wrapper, el
sitemap), y (b) correr validaciones automatizables (Lighthouse, Schema.org, linkinator) con
pass-criteria objetivos. Ningún paso requiere decisión abierta. Verificación por CI guard +
validators externos.
