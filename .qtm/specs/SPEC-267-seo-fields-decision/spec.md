---
spec-id: SPEC-267
title: SEO entity fields — Hybrid (keep title/description, remove keywords) + improve SEO tab UX
type: feature
complexity: low
status: draft
created: 2026-06-23T00:00:00Z
decided: 2026-06-23
effort_estimate_hours: 10-16 (WS-1 remove keywords 3-5h + WS-3 SEO tab UX 6-10h)
model_fit: basic
tags: [seo, web, admin, schemas, db, ux]
---

# SPEC-267: SEO entity fields — Hybrid + improve SEO tab UX

> ## ✅ DECISION RESOLVED (2026-06-23)
>
> Originalmente esta spec era una **evaluación** (keep / remove / hybrid). El owner
> tomó la decisión: **Opción C (Hybrid) + las mejoras de UX de la Opción A**.
>
> - **KEEP** `seo.title` y `seo.description` — aportan valor real: optimización de
>   CTR independiente del nombre visible, y override **por locale** (es/en/pt) vía
>   `pickLocalizedSeo()`.
> - **REMOVE** `seo.keywords` — deuda muerta: no se renderiza en ningún meta tag y
>   Google lo ignora desde 2009.
> - **IMPROVE** el tab SEO del admin para que efectivamente se use (era la
>   preocupación de origen: "creo que no se están usando"). El problema no es que no
>   aporten, es que el editor es ciego: no muestra cómo queda en Google ni qué se
>   auto-genera. Se agrega SERP preview, contadores con rangos óptimos, y
>   placeholders que muestran el valor auto-generado.
>
> **Reasoning:** ver `## Decision Reasoning` más abajo. Esta spec deja de ser
> evaluación y pasa a ser implementación auto-contenida (no genera follow-up).

---

## Part 1 — Functional Specification

### 1. Overview & Goals

**Goal:** Eliminar el campo SEO muerto (`keywords`) de las 6 entidades, conservar los
campos con valor (`title`, `description`), y rehacer el tab SEO del admin para que sea
usable y descubrible — de modo que los editores efectivamente optimicen el SEO en vez
de dejarlo en blanco por falta de feedback.

**Non-goals:**

- NO se tocan los JSON-LD (no leen `seo.*`, usan datos de la entidad — fuera de scope).
- NO se cambia el fallback de Astro (ya es robusto; sigue igual).
- NO se agrega multi-idioma nuevo (la localización SEO por locale ya existe).

### 2. Scope — 3 Workstreams

| WS | Título | Naturaleza | Model fit |
|----|--------|-----------|-----------|
| WS-1 | Remove `keywords` del schema SEO | Mecánico (jsonb field cleanup) | básico |
| WS-2 | Confirmar `title`/`description` (no-op, documentar) | Verificación | básico |
| WS-3 | Mejorar el tab SEO del admin (SERP preview, counters, placeholders) | UI conocida (shadcn) | básico |

### 3. User Stories con Acceptance Checks

#### US-1 — Como dev, quiero que `keywords` desaparezca del modelo SEO sin romper datos históricos

```
GIVEN una entidad (accommodation/destination/event/post/gastronomy/experience)
  con seo = { title, description, keywords } en la columna jsonb
WHEN se aplica WS-1
THEN el SeoSchema/BaseSeoFields ya no acepta ni expone `keywords`
 AND el admin SEO tab ya no muestra el input de keywords
 AND las filas existentes quedan con seo sin la clave `keywords` (limpieza de datos)
 AND title/description de esas filas permanecen intactos
```

Checks esperados:

- [ ] `SeoSchema` (en `packages/schemas/src/common/seo.schema.ts`) no tiene `keywords`
- [ ] `grep -r "seo.keywords\|seo\['keywords'\]\|keywords:" apps/ packages/` no devuelve usos productivos
- [ ] Test: parsear `{ title, description, keywords }` con `SeoSchema` → `keywords` se descarta (strip), no error de validación que rompa imports existentes
- [ ] Migración de datos: `UPDATE <tabla> SET seo = seo - 'keywords' WHERE seo ? 'keywords'` aplicada a las 6 entidades (script idempotente en carril extras)
- [ ] Tras la migración, `SELECT count(*) FROM <tabla> WHERE seo ? 'keywords'` = 0

#### US-2 — Como SEO editor, quiero ver cómo va a verse mi página en Google mientras edito

```
GIVEN estoy en el tab SEO de una entidad en el admin
WHEN escribo o edito el title y la description
THEN veo un preview tipo snippet de Google (SERP preview) que se actualiza en vivo
 AND el preview muestra el título (azul), la URL canónica (verde) y la description (gris)
 AND si dejo un campo vacío, el preview muestra el valor AUTO-GENERADO (no vacío),
     indicado visualmente como "auto" para que sepa qué saldría sin override
```

Checks esperados:

- [ ] El SERP preview renderiza con datos en vivo del formulario (sin guardar)
- [ ] Campo vacío → el preview usa el fallback (`entity.name + " | Hospeda"` para title,
      `entity.summary` truncado para description) y lo marca como auto-generado
- [ ] El preview respeta el locale activo del editor

#### US-3 — Como SEO editor, quiero saber si mi título/descripción tienen el largo óptimo

```
GIVEN estoy editando title o description en el tab SEO
WHEN el largo del texto entra/sale del rango recomendado
THEN un contador de caracteres muestra el largo actual y el rango óptimo
 AND el contador cambia de color: verde (en rango), amarillo (cerca del límite),
     rojo (excede y Google va a truncar)
```

Checks esperados:

- [ ] Title: rango óptimo 50–60 chars; warning a >60; el contador muestra "N/60"
- [ ] Description: rango óptimo 120–155 chars; warning a >155; muestra "N/155"
- [ ] Los límites son `const` configurables en un solo lugar (no hardcode disperso)

### 4. Detailed Implementation Plan

#### WS-1 — Remove `keywords` (mecánico)

`keywords` vive DENTRO del `jsonb('seo')`, NO es una columna → no hay `DROP COLUMN`.

1. **Schema (`packages/schemas/src/common/seo.schema.ts`):** quitar `keywords` de
   `SeoSchema` y de `BaseSeoFields`. Mantener `title`, `description`. Usar `.strip()`
   o equivalente para que payloads viejos con `keywords` no rompan validación (se ignora).
2. **Admin:** quitar el input de keywords del tab SEO (rutas en
   `apps/admin/src/routes/_authed/*/$id_/seo/` y el form compartido). Quitar referencias
   en componentes/validación.
3. **DB cleanup (carril extras, idempotente):** script SQL que para cada una de las 6
   tablas con `seo` jsonb haga `UPDATE <t> SET seo = seo - 'keywords' WHERE seo ? 'keywords';`
   Va en `packages/db/src/migrations/extras/` (es Drizzle-invisible: limpieza de jsonb).
4. **Platform settings:** revisar `seo.defaults` en `platform-settings.schema.ts` — si
   tiene `keywords`, quitarlo también (mismo criterio).
5. **Tests:** actualizar fixtures/tests que construyan `seo` con keywords.

#### WS-2 — Keep title/description (verificación, no-op de código)

- Confirmar que `SEOHead.astro` + `pickLocalizedSeo()` siguen leyendo `seo.title`/
  `seo.description` con fallback. No requiere cambios. Documentar en el PR que se
  verificó (1 check de no-regresión).

#### WS-3 — Mejorar el tab SEO (UI, shadcn)

1. **Componente `SeoTabEditor`** (o extender el existente): layout con los inputs
   title/description + el SERP preview + los counters.
2. **`SerpPreview` component:** recibe `{ title, description, canonicalUrl, locale }`,
   renderiza el snippet estilo Google. Si title/description vienen vacíos, calcula el
   fallback con la misma lógica que `SEOHead.astro` (extraer a un helper compartido
   `buildSeoFallback({ entity, locale })` si hace falta para no duplicar).
3. **`CharCounter` component:** props `{ value, min, max }`, color por rango.
4. **Constantes:** `SEO_LIMITS = { title: { min: 50, max: 60 }, description: { min: 120, max: 155 } } as const`.
5. **i18n:** strings nuevas (preview labels, counter hints) en `@repo/i18n` para es/en/pt.

### 5. Examples

**SERP preview (mockup ASCII de referencia visual):**

```
┌─────────────────────────────────────────────────────────┐
│ Alquiler temporal frente al río — Concepción del Uruguay │  ← title (azul, 50-60)
│ hospeda.com.ar › alojamientos › casa-del-rio             │  ← URL (verde)
│ Casa de 3 ambientes a 50m de la costanera, ideal para    │  ← description (gris,
│ familias. Cochera, parrilla y wifi. Reservá online.      │     120-155, truncada a ~155)
└─────────────────────────────────────────────────────────┘
```

**Char limits:**

| Campo | Mín óptimo | Máx óptimo | Hard truncate de Google (aprox) |
|-------|-----------|-----------|---------------------------------|
| title | 50 | 60 | ~600px ≈ 60 chars |
| description | 120 | 155 | ~920px ≈ 155–160 chars |

**Migración de datos (idempotente, carril extras):**

```sql
-- packages/db/src/migrations/extras/NNN-remove-seo-keywords.sql
UPDATE accommodations SET seo = seo - 'keywords' WHERE seo ? 'keywords';
UPDATE destinations  SET seo = seo - 'keywords' WHERE seo ? 'keywords';
UPDATE events        SET seo = seo - 'keywords' WHERE seo ? 'keywords';
UPDATE posts         SET seo = seo - 'keywords' WHERE seo ? 'keywords';
UPDATE gastronomy    SET seo = seo - 'keywords' WHERE seo ? 'keywords';
UPDATE experiences   SET seo = seo - 'keywords' WHERE seo ? 'keywords';
-- Idempotente: re-correr no afecta filas ya limpias (el WHERE las excluye).
```

**Schema before/after:**

```ts
// before — packages/schemas/src/common/seo.schema.ts
export const SeoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(), // ← REMOVE
});

// after
export const SeoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
}).strip(); // payloads viejos con `keywords` no rompen: se ignora
```

### 6. Edge Cases

- Entidad con `seo = null` → el tab muestra todo auto-generado; guardar sin override no crea fila vacía.
- Title/description con solo espacios → tratar como vacío (usar fallback en el preview).
- Locale sin override pero otro locale con override → el preview del locale activo usa su propio fallback, no el override del otro.
- Payload legacy de la API con `keywords` (apps externas, cache) → `.strip()` lo ignora sin romper.

### 7. Acceptance Criteria (global)

- [ ] `keywords` removido de schema, admin, platform settings, y datos (6 tablas a 0)
- [ ] `title`/`description` intactos y verificados sin regresión en web
- [ ] Tab SEO con SERP preview en vivo, respetando locale y fallback auto-gen
- [ ] Char counters con rangos óptimos y colores por estado
- [ ] i18n es/en/pt para todas las strings nuevas
- [ ] Tests de schema + un test de componente del preview/counter
- [ ] `db:generate` no detecta drift (keywords no era columna; solo cleanup de datos en extras)

### 8. Risks

| Risk | Mitigation |
|------|-----------|
| Remover keywords rompe payload de un consumidor externo | `.strip()` en vez de `.strict()`: se ignora, no falla |
| El SERP preview duplica la lógica de fallback de Astro | Extraer `buildSeoFallback()` a un helper compartido y usarlo en ambos lados |
| Editores siguen sin usar el tab pese a las mejoras | Fuera de scope medirlo aquí; SPEC futura puede instrumentar adopción con PostHog |

---

## Part 2 — Implementation Notes

### Decision Reasoning

1. **keywords**: no se renderiza en ningún meta tag y Google lo ignora desde 2009 →
   cero valor, pura superficie. Remove sin debate.
2. **title/description**: afectan `<title>` y `<meta description>` reales, permiten
   tunear CTR sin cambiar el nombre visible, y tienen override por locale ya
   implementado (`pickLocalizedSeo()`). Tirarlos (Opción B) perdía capacidad real de
   SEO multi-idioma. Keep.
3. **mejorar el tab**: la baja adopción que motivó la pregunta del owner se explica
   mejor por un editor ciego (no muestra resultado ni auto-gen) que por falta de
   valor. Por eso se invierte en UX en vez de eliminar (Opción A applied to C).
4. Los datos de adopción real no eran accesibles desde dev (solo seed), así que la
   decisión se fundó en arquitectura, no en counts poco confiables.

### Reference

- Schema SSOT: `packages/schemas/src/common/seo.schema.ts` — `SeoSchema` + `BaseSeoFields`
- DB: `packages/db/src/schemas/*/*.dbschema.ts` — `seo: jsonb('seo').$type<Seo>()` (6 entidades)
- Web rendering: `apps/web/src/components/seo/SEOHead.astro`, `apps/web/src/lib/seo.ts` (`pickLocalizedSeo`)
- Admin SEO tab: `apps/admin/src/routes/_authed/posts/$id_/seo/`, `apps/admin/src/routes/_authed/platform/configuration/seo.tsx`
- Platform defaults: `packages/schemas/src/entities/platformSettings/platform-settings.schema.ts` — `seo.defaults`
- Permissions: `PermissionEnum.ACCOMMODATION_SEO_EDIT`, `PermissionEnum.SEO_MANAGE` (sin cambios)

### Cross-spec dependencies

- Desbloquea **SPEC-268** (Web SEO audit): la 268 ya sabe que keywords se va y que
  title/description se quedan, así que su auditoría no propone tocar esos campos.
- Carril de migración: el cleanup de jsonb va en `extras/` (ver `packages/db/CLAUDE.md`).

---

## Model Fit Verdict

**BÁSICO.** Con la decisión tomada y el plan detallado arriba, las 3 workstreams son
ejecutables por un modelo menor en OpenCode:

- WS-1: field removal + cleanup SQL idempotente — patrón mecánico conocido.
- WS-2: verificación/no-op.
- WS-3: UI shadcn con componentes acotados (preview + counter) y constantes claras.

Ningún paso requiere decisiones de arquitectura abiertas ni lógica con invariantes de
concurrencia/seguridad. La verificación es por tests + revisión visual del tab.
