---
title: Planes de Comer y salir. Habilitar eventos, métricas y video (additive grant)
linear: HOS-2280
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - db
  - billing
---

# Planes de Comer y salir. Habilitar eventos, métricas y video

## 1. Resumen

Asigna a los planes de venue las claves del bloque de eventos y ficha, por el camino
«additive grant»: una migración SQL nueva (versiones v1 por id) más una data-migration de
seed (versiones publicadas desde el admin o por migraciones de seed). Es el interruptor
comercial: al aplicarla, los suscriptores actuales reciben las funciones sin versión
nueva del plan ni re-anclaje de suscripciones.

Este issue define el **patrón común** de las cuatro migraciones de grants. HOS-2281,
HOS-2282 y HOS-2283 lo reusan y solo cambian filas y texto.

Bloqueado: nada del catálogo se mergea antes de la pasada final de HOS-1352.

## 2. Problema

Las funciones de la épica están construidas detrás de claves que ningún plan otorga
(HOS-2259). Hay que otorgarlas. Las versiones de plan son inmutables
(`extras/041-plan-catalog-immutability.trigger.sql`), así que no se puede editar una
versión publicada: solo agregar claves nuevas con el permiso acotado
`hospeda.catalog_additive_grant` (decisión del owner del 12/11/2026, HOS-2105).

## 3. Alcance

Grants de este bloque (decisiones HOS-2253 aplicadas):

| Clave | Básico | Pro | Premium |
|---|---|---|---|
| `manage_venue_events` | agrega | ya lo tiene | ya lo tiene |
| `max_venue_active_events` | 1 | 10 | 2147483647 (sin tope) |
| `venue_event_recurrence` | no | agrega | agrega |
| `view_advanced_stats` | no | agrega | agrega |
| `can_embed_video` | no | agrega | agrega |
| `venue_event_stats` | no | no | agrega |

Total en las versiones v1: 8 filas de entitlement y 3 de límite.

Además (decisión del owner, 16/11/2026), la versión del plan `trial` de venue recibe un
límite propio, mínimo, para probar: `max_venue_active_events = 1` (1 evento activo). Es
una fila de límite más (4 en total) y va por el mismo camino de additive grant
(pieza D, sección 6.5).

Los límites nuevos de este bloque (`max_venue_active_events`) van con enforcement
`NONE` (decisión 26, HOS-2259): se evalúan en vivo y nunca se archiva ni se borra nada
al bajar de plan o al volver a evaluar.

## 4. Fuera de alcance

- Otorgar a otras verticales o planes de alojamiento/experiencia.
- Subir o cambiar un valor ya existente (los grants nunca sobrescriben).
- Los demás bloques (avisos, promos, reservas: otros issues).
- Textos de la tabla (HOS-2262) y las funciones (HOS-2263 a HOS-2265, HOS-2258, HOS-2261).

## 5. Estado actual verificado (`origin/staging`, 92994b9dc6)

### 5.1 Precedente HOS-2105

- `packages/db/src/migrations/0202_hos_2105_faq_draft_catalog.sql`: (1) redefine
  `reject_catalog_child_insert_into_published_version()` con el cuerpo idéntico al de
  extras 041, porque en un deploy `db:migrate` corre **antes** de extras (líneas 12-43);
  (2) `SELECT set_config('hospeda.catalog_additive_grant','HOS-2105', true)` (línea 45);
  (3) `INSERT` a `catalog_key` y a las dos tablas hijas, **cada uno en su statement**
  (los chunks los reproduce `restoreProductionPlanCatalog`); (4) reset del setting a `''`
  al final (línea 75), porque Drizzle aplica las migraciones pendientes en una
  transacción compartida y una migración posterior heredaría la señal.
- `extras/041-plan-catalog-immutability.trigger.sql:93-118`: el trigger
  `BEFORE INSERT` de `plan_version_entitlement` y `plan_version_limit` solo deja pasar
  una versión ajena si hay `catalog_additive_grant` **y** la clave no existe ya en esa
  versión; duplicar o hacer UPDATE/DELETE se rechaza con `P0001`. Los triggers de
  UPDATE/DELETE siguen bloqueando todo.
- `packages/seed/src/data-migrations/0168-hos-2105-faq-draft-plan-version-grant.ts`:
  `INSERT ... SELECT` por `slug` de plan contra **todas** las versiones
  (`plan_version pv join plan p`), con `NOT EXISTS` para no duplicar, `set_config`
  transaccional y reset **solo si salió bien** (en falla, la transacción del runner
  descarta el setting; un query posterior taparía el error real con «current transaction
  is aborted»). No es `contentOnly`.
- Commit `1252aa27b1`: además de la migración tocó `scripts/production-catalog/as-of-0144.ts`
  y los dos tests que comparan 0144 con el generador
  (`scripts/__tests__/production-catalog-g18.test.ts:62`,
  `packages/db/test/integration/production-catalog-from-empty.test.ts:71`).

### 5.2 Qué tienen hoy las versiones de venue

En `scripts/production-catalog/catalog.ts` (v1, ids deterministas con `catalogId`):

- `venue-basico` (línea 569): no tiene `manage_venue_events`, `view_advanced_stats`,
  `can_embed_video` ni ningún límite de eventos. Sí `max_ai_faq_draft_per_month = 0`.
- `venue-pro` (línea 687): tiene `manage_venue_events`; el resto de este bloque no.
- `venue-premium` (línea 814): tiene `manage_venue_events`; el resto no.
- `view_advanced_stats` y `can_embed_video` no están en ninguna versión de venue de
  `catalog.ts`. `can_embed_video` solo se otorgó a `owner-basico` (accommodation) por la
  versión siguiente de 0133 (`next-version-entitlements.ts:29-31`).

**Pero v1 no es lo que corre hoy.** Las data-migrations de seed 0133 (`HOS-2037`) y 0156
(`HOS-2077`, chat IA en venue/experience básico y pro) **publican una versión nueva**
(copia de la actual + el cambio) y re-anclan las suscripciones vivas
(`reanchorOlderVersions`). Es decir: en staging y producción las versiones de
`venue-basico` y `venue-pro` casi seguro son v2 o posteriores, con ids que **no**
coinciden con `catalogId('plan:venue:venue-pro:version:1')`. Una migración SQL con ids
fijos de v1 cubre bases nuevas y el baseline, pero **no alcanza a los suscriptores
reales**. La que sí los alcanza es la data-migration de seed (por `slug`, todas las
versiones). Por eso el patrón lleva las dos piezas, y hay que leer las filas reales
antes de aplicar (sección 12).

### 5.3 Cómo se representa «sin tope»

Un límite «sin tope» es una **fila con valor 2147483647** (`UNLIMITED_LIMIT_VALUE`,
`catalog.ts:4`; en uso en las 9 versiones de pago, p. ej. `max_favorites`). Una fila
**ausente** equivale a 0 (`limit-step.ts`, `resolveLimitStep`: `max = effectiveMax ?? ... ?? 0`).
Por eso premium lleva fila explícita y básico y pro llevan su número. El check de la
columna es `>= 0` (`plan_version_limit.value`, int4, `plan-catalog.dbschema.ts:196`).

### 5.4 El trial no calza solo (hallazgo)

`trial-ratchet.ts` (cabecera): en un trial, los **entitlements** salen de la versión
**sellable de mayor rank** (premium) y los **límites** de la de **menor rank** (básico),
más los límites de la versión del plan `trial` como override (solo límites; un
entitlement ahí se rechaza). Efecto con estos grants:

- Un venue en trial recibe `venue_event_recurrence` y `venue_event_stats` (premium) pero
  su tope de eventos es el de básico: 1.
- Con HOS-2282 y HOS-2283 es peor: el trial recibe `create_promotions`/`venue_guest_list`
  (entitlements de premium) pero **no tiene fila** de `max_active_promotions` ni de
  `max_venue_guest_list_size` en básico, así que el límite vale 0 y el primer intento
  falla con `LIMIT_REACHED`.

**Decidido (owner, 16/11/2026):** el trial tiene valores especiales y mínimos, solo
para probar: 1 promo activa, 10 lugares en la lista de invitados y 1 evento activo. Se
declaran como filas de límite en la versión del plan `trial` de venue (override de
límites, la única vía que admite `trial-ratchet.ts`), cada una en el issue de su bloque.
Este issue pone el patrón (pieza D) y la de eventos. Durante el trial, las funciones que
el plan Básico no tiene muestran el aviso «Incluido en Pro y Premium. El plan Básico no
lo tiene» (mecanismo y texto en HOS-2262, sección 6.6).

### 5.5 Los lectores de las claves reusadas

- `view_advanced_stats`: solo la leen rutas de alojamiento, con vertical fija
  (`hostMarketComparison.ts:68-71`, `hostFavoritesBreakdown.ts:49-52`:
  `enforceUserGate({ vertical: VerticalEnum.ACCOMMODATION, keys: ['view_advanced_stats'] })`)
  y el panel `AnalyticsSection.client.tsx:150` que pide el set de `vertical:'accommodation'`.
  Como la clave tiene scope `vertical`, otorgarla a venue **no habilita nada de
  alojamiento** (el set efectivo se resuelve por `user + vertical`).
- `can_embed_video`: filtrado de listados de alojamiento
  (`entitlement-filter.ts:162`, `content-detection.ts:179`); el gate de venue
  lo construye HOS-2258 (trait `videos` en `LISTING_SECTIONS`, gateado por esta clave). Ese
  PR llega antes que este grant y deja el video oculto, y la fila «Videos» de la tabla
  de planes oculta (`hideUntilGranted`), hasta que esta migración se aplica.
- `manage_venue_events`: gatea la sección `venueEvents`
  (`listing-sections.ts:108-117`).

### 5.6 Caché del set efectivo

El snapshot de Redis vive como máximo 15 minutos (`ENTRY_MAX_AGE_MS`,
`effective-set-cache/cache.ts:4`). Tras aplicar el grant, los usuarios lo ven a lo sumo
en 15 minutos sin invalidar nada a mano. «En el acto» del issue = dentro de esa ventana.

## 6. Diseño propuesto

### 6.1 Pieza A. Migración SQL (versiones v1, bases nuevas y baseline)

`packages/db/src/migrations/02NN_hos_2280_venue_events_grants.sql` (número real al
implementar). Estructura copiada de 0202 con estos cambios:

1. No inserta en `catalog_key` (las claves llegan en la migración de HOS-2259). Si por
   orden de merge todavía no existen, el FK falla de forma clara.
2. Repite `CREATE OR REPLACE FUNCTION reject_catalog_child_insert_into_published_version()`
   **solo si** la consulta C-1 (sección 12) muestra que el cuerpo vivo difiere del de
   041; si es idéntico, se omite para no abrir una tercera copia que derive. Decisión
   por defecto: omitir y citar 0202 (la función ya está instalada desde su deploy).
3. `SELECT set_config('hospeda.catalog_additive_grant', 'HOS-2280', true);`
4. `INSERT INTO "plan_version_entitlement" ("id","plan_version_id","key","plan_quota","trial_quota") VALUES ...;`
   con 8 filas, y por separado `INSERT INTO "plan_version_limit" ("id","plan_version_id","key","value") VALUES ...;`
   con 3 filas. Los ids salen del generador (`catalogId('plan:venue:<slug>:version:1:entitlement:<key>')`
   y `...:limit:<key>`), no a mano, porque G18 compara por clave primaria.
   `plan_quota` y `trial_quota` van en `NULL` (entitlement plano, igual que 0202).
5. `SELECT set_config('hospeda.catalog_additive_grant', '', true);` al final.

Cada INSERT es un statement propio (`--> statement-breakpoint`), solo `INSERT ... VALUES`
(G18 no lee `INSERT ... SELECT`).

### 6.2 Pieza B. Código del catálogo que acompaña

- `scripts/production-catalog/catalog.ts`: agregar las 8 + 3 filas a las versiones
  `venue-basico`, `venue-pro` y `venue-premium` (G18 compara el acumulado de las
  migraciones con este archivo: sin esto queda rojo por «insertado pero no en el código»).
  Los topes se escriben con `UNLIMITED_LIMIT_VALUE`, sin literales.
- `scripts/production-catalog/as-of-0144.ts`: **hallazgo**. Hoy filtra por *nombre de
  clave* (`ai_faq_draft`, `max_ai_faq_draft_per_month`) para todas las versiones. Para
  las claves reusadas esto no sirve (`manage_venue_events` existe desde 0144 en pro y
  premium; filtrar por nombre las borraría). Se reemplaza por una tabla
  `ADDITIVE_GRANTS_AFTER_0144: { vertical, slug, kind: 'entitlement'|'limit', key }[]`
  con las filas agregadas después de 0144 (las FAQ actuales y las nuevas), y el filtro
  quita **solo** esos pares plan-clave. Los dos tests que usan la proyección no cambian
  de código.
- Las pruebas de integración que reproducen el catálogo reaplican los chunks de hijos
  dentro de la transacción que crea versiones (`restoreProductionPlanCatalog`): verificar
  que el test de `plan-catalog-published-version-children.test.ts` sigue verde.

### 6.3 Pieza C. Data-migration de seed (versiones reales)

`pnpm db:seed:make hos-2280-venue-events-grants` crea
`packages/seed/src/data-migrations/0178-hos-2280-venue-events-grants.ts` (número real al
implementar; hoy el último es 0177). Modelo: 0168.

- `meta`: `group:'required'`, `destructive:false`, sin `contentOnly`.
- Una tabla de grants en código (clave, slug del plan, valor) leída de una sola
  constante exportada; sin valores comerciales hardcodeados fuera de esa tabla.
- `set_config('hospeda.catalog_additive_grant','HOS-2280', true)`, `INSERT ... SELECT`
  sobre **todas** las versiones de cada `slug` con `p.vertical = pv.vertical`, `NOT EXISTS`
  por clave, reset solo en éxito.
- **Conflicto con fila existente.** Si una versión ya tiene `max_venue_active_events`
  (o una clave reusada con otro valor, p. ej. un `0` hecho a mano), **no se cambia**
  (el trigger lo prohíbe) y el resumen devuelve `counts.conflicts` con las versiones.
  Decisión: la migración **no falla**, pero el resumen y un `logger.warn` listan cada
  caso para que el owner decida (así lo pide el issue). Ver pregunta 1.
- Resumen: `versionsGranted`, `entitlementsInserted`, `limitsInserted`, `conflicts`.
- Idempotente: una segunda corrida inserta 0.

### 6.4 Orden y carriles

`db:migrate` (pieza A) → `db:apply-extras` → `db:seed:migrate` (pieza C). En una base
nueva: A otorga v1; 0133/0156 (contentOnly) publican v2 **copiando** la v1 con los
grants; C no encuentra nada para insertar. En vivo: A otorga v1 (si existe) y C cubre
v2 y superiores. Regla de seed dual-write del repo (CLAUDE.md): al ser cambio de dato de
catálogo vivo, van **las dos** piezas en el mismo PR.

### 6.5 Pieza D. Límites del trial (decisión del owner, 16/11/2026)

El plan `trial` de venue (`catalog.ts`, `role: 'trial'`) recibe por additive grant una
fila de límite por cada límite nuevo del bloque. En este issue:
`max_venue_active_events = 1`. Se suman a la pieza A (insert por `catalogId` a la versión
v1 del plan `trial` de venue) y a la pieza C (todas las versiones del `slug` `trial` con
`p.vertical = 'venue'`). Un entitlement ahí se rechazaría, así que van solo límites. El
valor sale de una constante exportada de la tabla de grants, sin literal suelto.
HOS-2282 (`max_active_promotions = 1`) y HOS-2283 (`max_venue_guest_list_size = 10`)
suman sus filas con el mismo patrón. Los valores son mínimos a propósito: alcanzan para
probar la función, no para operar.

## 7. Modelo de datos / contratos

Sin tablas ni columnas nuevas. Filas nuevas: 8 en `plan_version_entitlement` y 3 en
`plan_version_limit` por conjunto de versiones v1; las de seed según las filas reales.
Carriles: estructural/versionada (A) + seed data-migration (C). Nada en extras.

## 8. UX / UI

Sin UI propia. La tabla de planes muestra las filas nuevas leyendo el catálogo
(HOS-2262: las filas sin ningún plan que las otorgue se ocultan y aparecen solas al
aplicar el grant; incluye la fila «Videos» de HOS-2258, que no sale como
«Próximamente»). Revisión visual en staging.

## 9. Criterios de aceptación

1. Dada una base nueva con todas las migraciones, cuando se lee la versión v1 de
   `venue-pro`, entonces tiene `venue_event_recurrence`, `view_advanced_stats`,
   `can_embed_video` y `max_venue_active_events = 10` (y `manage_venue_events` una sola vez).
2. Dado `venue-basico`, entonces tiene `manage_venue_events` y `max_venue_active_events = 1`
   y no tiene recurrencia, métricas ni video.
3. Dado `venue-premium`, entonces `max_venue_active_events = 2147483647` y `venue_event_stats`.
4. Dada una versión posterior publicada antes de la migración (v2), cuando corre la
   data-migration, entonces recibe los mismos grants; una segunda corrida no inserta nada.
5. Dada una versión que ya tiene `max_venue_active_events` con otro valor, cuando corre la
   data-migration, entonces no la modifica y la lista en `conflicts`.
6. G18 y G3 pasan; `catalog-key-fk-from-empty` y `production-catalog-from-empty` pasan.
7. Un intento de UPDATE o DELETE sobre filas de versión sigue rechazado; un INSERT sin
   `catalog_additive_grant` sobre una versión ajena sigue rechazado.
8. El set efectivo de un owner de alojamiento con el mismo usuario no cambia (no leak
   entre verticales).
9. Después de aplicar, un owner pro de venue lee `view_advanced_stats > 0` en
   `/api/v1/protected/me/effective-set?vertical=venue` dentro de los 15 minutos.
10. `GET /api/v1/public/plans` expone las filas nuevas sin cambio de código web, y la
    fila «Videos» pasa de oculta a visible al aplicar el grant (sin deploy de web).
11. Dada la versión del plan `trial` de venue, entonces tiene `max_venue_active_events = 1`
    y ningún entitlement nuevo; un venue en trial resuelve ese tope (no el de básico por
    omisión) y la data-migration es idempotente sobre sus versiones.
12. Los límites nuevos declaran enforcement `NONE`: ningún proceso archiva eventos al
    bajar de plan.

## 10. Plan de tests

- `scripts/__tests__/production-catalog-g18.test.ts` y
  `packages/db/test/integration/production-catalog-from-empty.test.ts`: la proyección por
  pares (`ADDITIVE_GRANTS_AFTER_0144`).
- Nuevo `packages/db/test/integration/venue-events-grants-migration.test.ts`:
  aplica la migración sobre una base con 0144, verifica filas, idempotencia, rechazo de
  UPDATE/DELETE y del INSERT sin señal (patrón de `faq-draft-route.test.ts`).
- Nuevo test de la data-migration: `packages/seed/test/data-migrations/0178-*.test.ts`
  con una versión v2 artificial y una con conflicto.
- `apps/api/test/integration/...effective-set`: un venue pro recibe las claves nuevas y
  un owner de alojamiento no.
- Smoke de staging (checklist, sección 14).

## 11. Riesgos

- R-1. Las versiones reales difieren de v1 (sección 5.2): mitigado por la pieza C y las
  consultas de la sección 12.
- R-2. El setting `catalog_additive_grant` se «filtra» a migraciones siguientes en la
  misma transacción de Drizzle: mitigado con reset al final y test.
- R-3. Que otro issue de la épica (HOS-2281 a HOS-2283) use el mismo número de
  migración: numerar al implementar, después de mergear `staging`.
- R-4. Efecto en el trial (sección 5.4): premium tiene entitlements con tope de básico.
  Resuelto por decisión del owner con la pieza D (límites mínimos propios del trial).
- R-5. Una versión que tenga la clave con valor 0 queda sin función aun después del grant.

## 12. Preguntas abiertas para el owner

1. **Versiones que ya tengan alguna de estas claves** (p. ej. con valor 0): los grants no
   pueden cambiarlas. Opciones: (a) dejarlas y listar el caso para decisión caso por caso;
   (b) publicar una versión nueva de ese plan con el valor correcto y re-anclar (camino
   0133/0156, más pesado). Recomendación: (a) salvo que las consultas muestren ≥ 1
   suscripción viva afectada; en ese caso (b) solo para esas versiones.
2. **Decidido (owner, 16/11/2026): valores del trial.** Valores especiales y mínimos:
   1 evento activo, 1 promo activa y 10 lugares de lista, por additive grant sobre la
   versión `trial` (pieza D). Se descartaron los valores de pro (10 / 5 / 100) y dejarlo
   inutilizable. Sigue abierto un detalle menor: el aviso del trial dice «Incluido en Pro
   y Premium», falso para funciones solo de Premium (`venue_event_stats`); falta decidir
   el texto para esas (HOS-2262, pregunta 4).
3. **«Sin tope»** se resuelve como fila con 2147483647. Confirmar que premium no deba
   tener, en cambio, un tope muy alto razonable (p. ej. 1000). Recomendación: mantener
   2147483647 (decisión 1), con el clamp de HOS-2259 contra overflow.

### Consultas de solo lectura para el coordinador (staging y prod)

C-1. Cuerpo vivo de la función del trigger (¿ya trae `catalog_additive_grant`?):
`select position('catalog_additive_grant' in pg_get_functiondef('reject_catalog_child_insert_into_published_version'::regproc)) > 0;`

C-2. Todas las versiones de los 3 planes de venue y sus filas actuales:
```sql
select p.slug, pv.id, pv.rank, pv.current, pv.created_at,
  (select count(*) from subscription s where s.plan_version_id = pv.id
     and s.status in ('ACTIVE','GRACE_PERIOD')) as live_subs
from plan p join plan_version pv on pv.plan_id = p.id and pv.vertical = p.vertical
where p.vertical = 'venue' and p.slug in ('venue-basico','venue-pro','venue-premium','trial')
order by p.slug, pv.created_at;
```
(el nombre exacto de las columnas de `subscription` se confirma contra el esquema; si
difiere, ajustar).

C-3. Filas de estas claves en cualquier versión de venue (para detectar conflictos):
```sql
select p.slug, pv.id, e.key, e.plan_quota from plan_version_entitlement e
join plan_version pv on pv.id = e.plan_version_id join plan p on p.id = pv.plan_id
where p.vertical='venue' and e.key in ('manage_venue_events','view_advanced_stats','can_embed_video',
  'venue_event_recurrence','venue_event_stats');
select p.slug, pv.id, l.key, l.value from plan_version_limit l
join plan_version pv on pv.id = l.plan_version_id join plan p on p.id = pv.plan_id
where p.vertical='venue' and l.key = 'max_venue_active_events';
```
C-4. Ledger de seed: `select name, applied_at from seed_migrations where name like '0133%' or name like '0156%' or name like '0168%';`
C-5. `select max(id) from drizzle.__drizzle_migrations;` (o el último nombre del journal) para fijar el número de migración.

## 13. Dependencias

- Requiere HOS-2259 (claves) mergeado antes. Pasada final de HOS-1352 antes de mergear
  cualquier cosa de catálogo; HOS-2066 va primero en la épica post-MVP.
- Antes de habilitar: la función de cada clave debe estar construida y gateada
  (HOS-2258, HOS-2261, HOS-2263 a HOS-2265). Sin gate, habilitar la clave no hace nada,
  pero con la tabla de HOS-2262 mostraría una promesa sin función.
- Habilita: HOS-2285 (pack de +5 eventos).

## 14. Labels de smoke y Novedades

- `status-needs-smoke-staging` (checklist `docs/billing/smoke-checklist.md`, parte staging).
  Smoke: venue pro con suscripción real, aplicar la migración, esperar ≤ 15 minutos y ver
  eventos recurrentes, video y métricas habilitados; venue básico con un solo evento y sin
  recurrencia; premium con eventos sin tope; un venue en trial con 1 evento activo y el
  aviso «Incluido en Pro y Premium. El plan Básico no lo tiene» en lo que Básico no tiene. No toca checkout ni webhooks, así que no
  exige parte de producción.
- What's New: sí, lo escribe el flujo de smoke; el cambio visible es «eventos, métricas y
  video». Lo agrupa HOS-2284.

## 15. Desglose de tareas

1. Consultas C-1 a C-5 y definición de filas finales (coordinador, 0,25 día).
2. `catalog.ts` + `ADDITIVE_GRANTS_AFTER_0144` + ajuste de los 2 tests de 0144 (0,5 día).
3. Migración SQL con ids del generador, incluida la fila de límite del trial (0,5 día).
4. Data-migration de seed (también versiones del plan `trial`) + test (0,75 día).
5. Test de integración de la migración y del set efectivo (0,5 día).
6. Smoke de staging y firma (0,5 día).

## 16. Linear

Canonical tracking:
HOS-2280
