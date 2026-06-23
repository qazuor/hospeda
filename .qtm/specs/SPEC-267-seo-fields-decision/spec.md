---
spec-id: SPEC-267
title: SEO entity fields — keep & improve vs remove in favor of Astro auto-generation
type: evaluation
complexity: low
status: draft
created: 2026-06-23T00:00:00Z
effort_estimate_hours: 2-3 (eval) / 4-8 (implementation if keep) / 6-10 (if remove)
tags: [evaluation, seo, web, admin, schemas, db, architecture]
---

# SPEC-267: SEO entity fields — keep & improve vs remove

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Decidir si los campos SEO manuales (`seo.title`, `seo.description`, `seo.keywords`) que existen en todas las entidades (accommodation, destination, event, post, gastronomy, experience) aportan valor real o si conviene eliminarlos y depender 100% de la generación automática de Astro desde los datos de la entidad.

**Why now:** Los campos SEO existen en DB (`jsonb('seo')`), schemas (`BaseSeoFields`), admin (tab SEO por entidad), y web (override con fallback). Hay que validar si el override manual se usa en la práctica o si es carga muerta que genera complejidad sin beneficio.

**Output esperado:** Una recomendación (keep & improve / remove / hybrid) con reasoning concreto, basada en análisis de uso real, costo de mantenimiento, y valor SEO medible.

### 2. Current State

#### Donde existen los campos SEO

| Capa | Archivo | Estado |
|------|---------|--------|
| DB schema | `packages/db/src/schemas/*/*.dbschema.ts` — `seo: jsonb('seo').$type<Seo>()` en 6 entidades | Activo, nullable |
| Zod schema | `packages/schemas/src/common/seo.schema.ts` — `SeoSchema` + `BaseSeoFields` | Activo, optional |
| Entity schemas | accommodation, destination, event, post, gastronomy, experience — todas tienen `...BaseSeoFields` | Activo |
| Admin UI | Tab "SEO" por entidad (`/posts/$id/seo`, etc.) + permiso `ACCOMMODATION_SEO_EDIT` + `SEO_MANAGE` | Activo |
| Platform settings | `seo.defaults` en `platform_settings` (title/description/keywords globales) | Activo |
| Web rendering | `SEOHead.astro` + `pickLocalizedSeo()` — usa `entity.seo?.title ?? fallback` | Activo con fallback |
| JSON-LD | Components por entidad (LodgingBusiness, Event, Place, Article) — no leen seo.*, usan entity data | No usa SEO fields |

#### Cómo funciona hoy

1. Admin user puede editar title/description/keywords por entidad en tab SEO
2. Web hace fallback: si `seo.title` existe lo usa, sino genera desde `entity.name + " | Hospeda"`
3. `seo.description` fallback: genera desde `entity.summary` o `entity.description` (truncado)
4. `keywords` existe en schema pero NO se renderiza en ningún meta tag (Google ignora keywords meta desde 2009)
5. Platform settings `seo.defaults` provee defaults globales separados

### 3. Trade-off Analysis

#### Opción A: Keep & Improve (mantener y mejorar)

**Pros:**

- Control fino: SEO editor puede optimizar title/description para CTR sin cambiar el nombre visible
- Localización: `pickLocalizedSeo()` ya maneja overrides por locale — si se elimina, se pierde esta capacidad
- Competitividad: para alojamientos con nombres genéricos ("Casa de playa"), el SEO title puede ser "Alquiler temporal frente al río — Concepción del Uruguay"
- Datos estructurados: el override puede ser más rico que el auto-generado

**Contras:**

- Complejidad: 6 entidades × tab SEO × permisos × validación × i18n = superficie grande
- Mantenimiento: cada nueva entidad debe incluir `BaseSeoFields` + tab SEO + access schema
- Cargo muerte: si nadie lo usa, es código/DB/UI que pesa sin aportar
- Keywords: campo que no se renderiza — pura deuda

#### Opción B: Remove entirely (eliminar)

**Pros:**

- Simplificación: menos código, menos DB columns, menos admin UI, menos permisos
- Astro auto-gen: `SEOHead` ya tiene fallback robusto desde entity data
- Menos superficie: nuevas entidades no necesitan tab SEO
- foco: si el auto-gen es bueno enough, el override es optimización prematura

**Contras:**

- Pierde control fino de CTR (title/description optimizados para search, no para display)
- Pierde localización SEO (overrides por locale)
- Migración: DROP column + remover schemas + remover admin tabs + remover permisos + cleanup tests
- Si después se necesita, hay que volver a agregar todo

#### Opción C: Hybrid (keep title/description, remove keywords)

**Pros:**

- Mantiene el valor real (title/description override para CTR)
- Elimina lo muerto (keywords no se renderiza, Google lo ignora)
- Menor superficie de cambio

**Contras:**

- No resuelve la complejidad de tab SEO por entidad
- Migración parcial (solo remover keywords)

### 4. Data Needed for Decision

| Dato | Cómo obtenerlo | Prioridad |
|------|---------------|-----------|
| Cuántas entidades tienen `seo.title` o `seo.description` no-null en prod | Query DB: `SELECT COUNT(*) FROM accommodations WHERE seo->>'title' IS NOT NULL` (por entidad) | Alta |
| Cuántas usan `keywords` | Query DB: `SELECT COUNT(*) FROM accommodations WHERE seo->'keywords' IS NOT NULL` | Alta |
| Frecuencia de edición del tab SEO en admin | PostHog event tracking (si existe) o Sentry breadcrumbs | Media |
| Calidad del auto-gen vs manual | Comparar title/description auto-generado vs manual en muestras | Media |

### 5. Evaluation Tasks

| Task | Title | Status |
|---|---|---|
| T-267-01 | Query DB: contar entidades con seo.title/description/keywords no-null por tipo | pending |
| T-267-02 | Revisar si PostHog/Sentry tiene eventos de edición del tab SEO en admin | pending |
| T-267-03 | Comparar 10 ejemplos: auto-gen title/description vs manual — evaluar calidad diferencial | pending |
| T-267-04 | Mapear costo de remoción: LOC a tocar, migraciones DB, tests, admin tabs | pending |
| T-267-05 | Escribir decisión: keep & improve / remove / hybrid con reasoning | pending |

### 6. Acceptance Criteria

- [ ] Data de uso real obtenida (counts por entidad)
- [ ] Cada opción (A/B/C) tiene evaluación de 1 párrafo con pros/contras concretos
- [ ] Recomendación final committeada con reasoning
- [ ] Si "remove", spec follow-up con plan de migración
- [ ] Si "keep & improve", spec follow-up con mejoras propuestas

### 7. Risks

| Risk | Mitigation |
|---|---|
| Datos de prod no accesibles desde dev | Correr queries contra staging si prod no disponible |
| Decisión basada en datos parciales (poca adopción puede ser por UX deficiente, no por falta de valor) | Considerar si el tab SEO es descubierto/usable antes de concluir "no aporta" |
| Remover keywords rompa compat con datos históricos | Schema compat policy: aditivo-only, removal requiere migración 3-fases |

---

## Part 2 — Implementation Notes

### Source

Owner question (2026-06-23): "tenemos en las entidades manejo de campos seo, pero creo que no se estan usando.. conviene dejarlos y que se empiecen a usar, o eliminarlos y que el seo lo maneje astro automaticamente?"

### Reference

- Schema SSOT: `packages/schemas/src/common/seo.schema.ts`
- DB: `packages/db/src/schemas/*/*.dbschema.ts` — `seo: jsonb('seo').$type<Seo>()`
- Web rendering: `apps/web/src/components/seo/SEOHead.astro`, `apps/web/src/lib/seo.ts` (`pickLocalizedSeo`)
- Admin SEO tab: `apps/admin/src/routes/_authed/posts/$id_/seo/`, `apps/admin/src/routes/_authed/platform/configuration/seo.tsx`
- Platform defaults: `packages/schemas/src/entities/platformSettings/platform-settings.schema.ts` — `seo.defaults`
- Permissions: `PermissionEnum.ACCOMMODATION_SEO_EDIT`, `PermissionEnum.SEO_MANAGE`

### Cross-spec dependencies

- Ninguna directa. Si la decisión es "remove", se crea spec follow-up para migración.
- SPEC-157 (web-seo-polish) — puede informar la decisión si tiene datos de uso.
