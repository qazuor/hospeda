---
title: Resolución vuelta 1 · Arreglos aplicados
linear: HOS-1787
created: 2026-10-25
---

# Resolución vuelta 1 · Arreglos aplicados

Se aplicó sólo lo que **no** necesita una decisión del owner ni depende de una pendiente: correcciones
factuales, mecánica de migración claramente correcta, diseño de guards y huecos de spec con una opción
claramente mejor. Lo que sí necesita al owner está en
[`10-decisiones-del-owner.md`](10-decisiones-del-owner.md). Hallazgos en
[`../10-revision-vuelta-1/00-consolidado.md`](../10-revision-vuelta-1/00-consolidado.md).

Las decisiones técnicas tomadas acá quedaron registradas como DEC-FAC-018 a DEC-FAC-025 en
`../01-decision-log.md`, sin reemplazar ninguna anterior (DEC-FAC-022 aclara DEC-FAC-015).

**Total: 41 arreglos.**

## Correcciones factuales

| fix | hallazgo | archivos | qué cambió |
|---|---|---|---|
| FIX-V1-01 | F-V1-001 | `spec.md`, `sub-specs/1-renombrado.md`, `docs/05-discovery-a-renombrado.md` | Contexto «staging no es prod»: prod en 0124 sin el mundo de HOS-1352, staging en 0177, el paso 6 del corte aplasta la historia. Sección «Compuerta» en el sub-spec 1 y prohibición de que el corte caiga entre dos PRs del renombrado |
| FIX-V1-02 | F-V1-003 | `docs/05-discovery-a-renombrado.md` §5 y §10, `docs/04-open-decisions.md` (OD-04) | Los ids UUIDv5 **sí** derivan de la vertical y de cada clave (`loads.ts:22,46-50,67-70,82-85`); «posiblemente» eliminado |
| FIX-V1-03 | F-V1-008 | `docs/05-discovery-a-renombrado.md` §4 y §5 | `entity_subscriptions` marcada como borrada en staging (0125) y borrada en prod por la misma 0125, nunca tocada por el renombrado. Agregados `user_role_audit.role`, `ai_usage.feature`, `quota_window (vertical, key)`, `domain_event` (append-only), `email_outbox.payload`, `qr_codes.target_url`, `plan.name`, hash Redis. FK compuestas con la vertical. Tabla nueva con columnas entorno y tratamiento |
| FIX-V1-04 | F-V1-008 | `sub-specs/1-renombrado.md` (paso 2, criterio) | Resumen del inventario corregido; criterio con una consulta `count(*) … = 0` por fila MV/RV excluyendo `deleted_at` |
| FIX-V1-05 | F-V1-007 | `sub-specs/1-renombrado.md` (paso 4), `docs/05-discovery-a-renombrado.md` §5 y §10 | El sticker codifica `/q/<slug>`; lo que se migra es `qr_codes.target_url` de las filas GENERATED (menú y folleto). La regex de repunte acepta las dos formas, con test de regresión. El 301 de `/carta/` queda para enlaces y MANUAL; su duración, según la medición |
| FIX-V1-06 | F-V1-011 | `docs/05-discovery-a-renombrado.md` §6, `sub-specs/1-renombrado.md` (paso 3, criterio) | El checksum del ledger no se verifica (`ledger.ts:14-16`); la restricción real es que `0079`, `0110`, `0034` dejan de compilar. Se editan sólo imports y literales. Criterio: typecheck de `@repo/seed` y corrida de las pendientes de prod en una base clonada de prod-main |
| FIX-V1-07 | F-V1-002 | `sub-specs/1-renombrado.md` (paso 2) | El «riesgo a revisar» de G18 pasa a **bloqueante** con su evidencia (G18 sólo pliega `INSERT`, triggers de `extras/041`, FK compuestas, triggers sólo donde corrió `apply-extras`). La salida queda en Q-02 |
| FIX-V1-08 | F-V1-016 | `sub-specs/3-resolvedor.md`, `sub-specs/4-tipos-y-noche.md`, `docs/01-decision-log.md` (DEC-FAC-018) | `AUSENTE → 404` al dueño viola la regla 3 del contrato (`error-contract.md:277-281`): pasa a 409 `ALREADY_EXISTS` con `reason: CAPABILITY_ABSENT`; el camino ajeno sigue en 404 |
| FIX-V1-09 | F-V1-029 | `sub-specs/6-web-publica.md` | «Verificar que la invalidación de cobertura ya revalide» tiene respuesta: no lo hace (`coverage-recalculation.ts:249-255`). Se diseña la revalidación por cambio de conjunto efectivo |

## Mecánica de migración

| fix | hallazgo | archivos | qué cambió |
|---|---|---|---|
| FIX-V1-10 | F-V1-013 (parte técnica) | `sub-specs/1-renombrado.md` (paso 1) | La migración física se escribe a mano con snapshot regenerado y verificado por la guarda de drift (drizzle-kit `generate` es interactivo; precedente `0114`) |
| FIX-V1-11 | F-V1-022 | `sub-specs/1-renombrado.md` (paso 1), `sub-specs/4-tipos-y-noche.md`, `docs/05-discovery-a-renombrado.md` §4 | `RENAME VALUE` para los valores y `RENAME TO` para los 4 enums, nunca recreación; CHECKs con `DROP` → `UPDATE` → `ADD`; `ADD VALUE` de tipos nuevos en migración separada de su uso |
| FIX-V1-12 | F-V1-023 | `sub-specs/1-renombrado.md` (paso 1, criterio) | Renombrado explícito de cada índice, FK, constraint y secuencia; `026` y `032` reescritos en el mismo PR; criterio con `pg_indexes`/`pg_constraint` |
| FIX-V1-13 | F-V1-010 | `sub-specs/1-renombrado.md` (paso 2) | Conversiones de datos leídos estrictamente (outbox, `ai_settings`, `target_url`, revalidación) en la migración versionada, no en seed; lectores tolerantes un release; test del blob con feature desconocida |
| FIX-V1-14 | F-V1-008, F-V1-013 | `sub-specs/1-renombrado.md` (paso 7) | Pasos de deploy: invalidar `gen:all` del cache del conjunto efectivo; purgar Cloudflare y actualizar las reglas a mano en el mismo momento |
| FIX-V1-15 | F-V1-009, F-V1-012 | `sub-specs/1-renombrado.md` (pasos 2 y 3) | `domain_event` y los ids de fixtures documentados con sus dos variantes, atados a Q-01 y Q-05 |
| FIX-V1-16 | F-V1-017 | `sub-specs/2-catalogos.md` | Backfill en la migración versionada que crea la estructura, incluidas fichas con `deleted_at`, con test que compara el `CASE` con el catálogo; baseline del seed con filas hechas |
| FIX-V1-17 | F-V1-017 | `sub-specs/2-catalogos.md`, `sub-specs/4-tipos-y-noche.md`, `docs/06-guards.md` | Sección «En PURGED»: la clasificación por rubro se conserva; `nightInfo` se borra en PB9/PB12; filas de G-R9 si hay tablas nuevas |

## Guards

| fix | hallazgo | archivos | qué cambió |
|---|---|---|---|
| FIX-V1-18 | F-V1-004 | `docs/06-guards.md`, `sub-specs/2-catalogos.md` | G-FAC-01 rediseñado: G18 indexa por la primera columna. Rama array (CHECK generado, sin `listing_facet`) y rama tabla (id sintético UUIDv5 + `UNIQUE (vertical, slug)`, sin tocar G18, sumado al modo baseline). La rama la fija Q-06 |
| FIX-V1-19 | F-V1-025 | `docs/06-guards.md` | G-FAC-R1: patrón por forma de identificador + regla de ruta + `gastro-` opcional; exención por marcador en línea contado; «cuarta» → «sexta» (cinco entradas); escanea `scripts/` |
| FIX-V1-20 | F-V1-007, F-V1-045 | `docs/06-guards.md` | G-FAC-R2: caso «QR de un salto»; acepta redirects declarados en la página; ruta profunda y query conservadas; código de estado según Q-03 |
| FIX-V1-21 | F-V1-030, F-V1-031, F-V1-014, F-V1-036 | `docs/06-guards.md` | G-FAC-02: regla 6 deriva la vertical de la clave del catálogo de planes; reglas nuevas 7 (id único), 8 (≥1 capacidad por vertical con ficha), 9 (rubro único no público) |
| FIX-V1-22 | F-V1-018 | `docs/06-guards.md` | G-FAC-03 partido en (a) decidir secciones (ningún literal de rubro fuera del resolvedor) y (b) lista cerrada de lectores; importar el catálogo para mostrar opciones queda permitido |
| FIX-V1-23 | F-V1-019 | `docs/06-guards.md`, `sub-specs/3-resolvedor.md` | G-FAC-04 ampliado a rasgos, `step6Key`, constantes y `enforceUserGate`/`readEffectiveKeys`; guard nuevo G-FAC-06 «toda ruta de contenido declara su capacidad» |
| FIX-V1-24 | F-V1-028 | `docs/06-guards.md` | G-FAC-05 por lista cerrada de archivos con predicado ancho (`&&`, `if`, lookups, ids de capacidad); cierra el «Abierto» |
| FIX-V1-25 | F-V1-032 | `docs/06-guards.md`, `sub-specs/2-catalogos.md` | Guard nuevo G-FAC-07 (billing no lee rubros) como caso de G14 |
| FIX-V1-26 | F-V1-024 | `docs/06-guards.md`, `sub-specs/1-renombrado.md` | Tabla «Guards atados al nombre» con una mutación posterior al renombrado por guard (G2c, G-R9, G1(b), G18) |

## Resolvedor y superficies

| fix | hallazgo | archivos | qué cambió |
|---|---|---|---|
| FIX-V1-27 | F-V1-005 | `sub-specs/3-resolvedor.md`, `spec.md` (regla 5) | Lista cerrada de lectores de contenido con su comportamiento; lector público único por vertical con carga en lote para listados |
| FIX-V1-28 | F-V1-006 | `sub-specs/2-catalogos.md`, `sub-specs/3-resolvedor.md`, `sub-specs/5-editor.md`, `docs/01-decision-log.md` (DEC-FAC-020) | Rasgos dentro de una capacidad; mapa de rutas a capacidad y rasgo; widgets y tour consultan el mapa |
| FIX-V1-29 | F-V1-015, F-V1-035 | `sub-specs/3-resolvedor.md`, `sub-specs/7-admin.md`, `docs/01-decision-log.md` (DEC-FAC-019) | AUSENTE como paso 4b; BLOQUEADA en `requiredKeys` del paso 6; `evaluatedSteps` admite `'4b'`; endpoint del mapa con `subjectId`; la acción 15 hereda el paso |
| FIX-V1-30 | F-V1-016 | `sub-specs/3-resolvedor.md`, `sub-specs/4-tipos-y-noche.md`, `docs/01-decision-log.md` (DEC-FAC-021) | `contentCapability` como función del cuerpo por campos no nulos; evaluación sobre rubros resultantes; caso del alta |
| FIX-V1-31 | F-V1-031 | `sub-specs/2-catalogos.md`, `sub-specs/3-resolvedor.md` | Ids como unión literal por vertical; el resolvedor lanza ante un id desconocido |
| FIX-V1-32 | F-V1-034 | `sub-specs/2-catalogos.md`, `sub-specs/3-resolvedor.md`, `sub-specs/5-editor.md`, `docs/01-decision-log.md` (DEC-FAC-024) | Tabla de estados degradados; reglas de edición (cambio de tipo, rubro huérfano, volver a agregar); validación sólo cuando cambian tipo o rubros; `facets ≥ 1` en el gate de publicación; se retira la regla de addon dependiente |
| FIX-V1-33 | F-V1-005 | `sub-specs/3-resolvedor.md`, `sub-specs/6-web-publica.md`, `docs/01-decision-log.md` (DEC-FAC-023) | `/carta/` sin carta disponible → 301 a la ficha |
| FIX-V1-34 | F-V1-036, F-V1-047, F-V1-048 | `sub-specs/2-catalogos.md`, `sub-specs/5-editor.md`, `sub-specs/7-admin.md` | Default del rubro único en el servidor; selector, columna y filtro sólo con más de un rubro; entrada `facets: slug[]` sin `vertical`; presentación en un `Record` exhaustivo del web |
| FIX-V1-35 | F-V1-037 | `sub-specs/5-editor.md`, `docs/01-decision-log.md` (DEC-FAC-025) | BLOQUEADA: sólo lectura + upsell + borrado; hub distingue con datos / vacía; aviso con conteos y QR activos (objetable) |
| FIX-V1-36 | F-V1-020 (parte) | `sub-specs/7-admin.md` | Permiso para editar rubros = el de editar el tipo; cambio registrado en la línea de tiempo |
| FIX-V1-37 | F-V1-038 (parte) | `sub-specs/4-tipos-y-noche.md` | Listas planas de tipos derivadas del enum con test; etiqueta pt «balada» |
| FIX-V1-38 | F-V1-039, F-V1-040 | `sub-specs/6-web-publica.md` | Prompt neutral desde capacidades disponibles (sin pisar ediciones del admin); JSON-LD `@type` por tipo con `Record` exhaustivo y `hasMenu` condicionado |
| FIX-V1-39 | F-V1-041, F-V1-044 | `sub-specs/6-web-publica.md` | Parámetro de rubro en la política de crawl y la canónica promovida; sitemap sólo con colecciones no vacías; `noindex` para vacías; listado general paginado |
| FIX-V1-40 | F-V1-042 | `sub-specs/2-catalogos.md`, `sub-specs/6-web-publica.md`, `docs/01-decision-log.md` (DEC-FAC-022) | Etiqueta del rubro por i18n; breadcrumb sin rubro; etiquetas es/en/pt como tarea de contenido |
| FIX-V1-41 | F-V1-045, F-V1-046 | `sub-specs/5-editor.md`, `sub-specs/1-renombrado.md` | What's New para dueños; redirects de `mi-cuenta` con ruta profunda y query; dependencia de la regla de dirección nombrada |

## Housekeeping

- `docs/04-open-decisions.md`: OD-01 a OD-07 apuntan a su Q; OD-08 a OD-14 nuevas (la 14 es la medición).
- `docs/01-decision-log.md`: DEC-FAC-018 a DEC-FAC-025 agregadas al final y al índice.

## Lo que NO se aplicó (espera al owner)

F-V1-001 (Q-01), 002 y 003 (Q-02), 009 (vía Q-01), 012 (Q-05), 013 en lo no técnico (Q-03), 014 (Q-07),
020 en lo de moderación (Q-08), 021 (Q-09), 025 en el alcance del patrón (Q-04, Q-05), 027 (Q-06), 033
(Q-04), 038 en los campos y `PUB` (Q-10), 043 (Q-05), 045 en el segmento de `mi-cuenta` (Q-04) y el
nombre del plan (Q-02). F-V1-026 es una medición, no una decisión.
