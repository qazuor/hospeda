---
title: Comer y salir. Claves nuevas en el catálogo (sin asignar a planes)
linear: HOS-2259
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - db
  - billing
  - web
---

# Comer y salir. Claves nuevas en el catálogo (sin asignar a planes)

## 1. Resumen

Se agregan al catálogo de claves 7 entitlements y 2 límites nuevos de la épica HOS-2252.
Ninguna clave se asigna a un plan en este issue. Las funciones se construyen detrás de
las claves y se habilitan después, en los issues de grants (HOS-2280 a HOS-2283).

Este issue está **bloqueado**: no se mergea a `staging` antes de la pasada final de
HOS-1352, y la épica post-MVP de HOS-1352 empieza por HOS-2066 (ver HOS-2252).

## 2. Problema

Las funciones nuevas (recurrencia, avisos, estadísticas por evento, lista de invitados,
reservas, promos VIP, tope de eventos y cupo de lista) necesitan claves para gatearse.
Sin claves en el catálogo no se puede escribir un gate, y las claves no pueden existir
solo en código: cada asignación apunta a `catalog_key` por FK.

## 3. Alcance

- 7 entitlements y 2 límites en el catálogo de claves (código + migración).
- Enums, textos mínimos que exigen los guards de CI, y tests.
- Verificación del riesgo de overflow int4 de la decisión 7 (ver sección 6.5).

## 4. Fuera de alcance

- Asignar claves a planes o add-ons (HOS-2280 a HOS-2283, HOS-2285 a HOS-2289). Eso incluye los **valores del trial** (decidido por el owner, 16/11/2026: 1 promo activa, 10 lugares en la lista, 1 evento activo; HOS-2280 a HOS-2283 y HOS-2262). Esta spec declara las claves, no ningún valor.
- Textos ricos de la tabla de planes (HOS-2262). Aquí solo el mínimo que evita CI rojo.
- Las funciones que usan las claves (Fase 3 de la épica).

## 5. Estado actual verificado (checkout `origin/staging`, 92994b9dc6)

- Las claves viven en `packages/schemas/src/catalog/entitlement-keys.ts` y
  `limit-keys.ts`, como filas compactas
  `[key, scope, aggregation, enforcement, class]` (`key-row.ts`). El archivo declara
  que no lleva valores, precios ni asignaciones (`entitlement-keys.ts:3-9`).
  Hoy hay 59 entitlements y 23 límites.
- Los enums espejo están en `key-enums.ts` (`EntitlementKeyEnum`, `LimitKeyEnum`).
  `packages/schemas/test/catalog/key-enums.test.ts` exige que el enum coincida con el
  catálogo y que cada miembro sea `value.toUpperCase()`.
- `scripts/generate-catalog-sql.ts` genera el SQL de 12 cargas. `pnpm gen:catalog-sql`
  (`package.json:155`) corre `tsx scripts/generate-catalog-sql.ts`. La carga
  `catalog_key` emite **la tabla entera**, ordenada por clave
  (`generate-catalog-sql.ts:10-30`, `buildCatalogKeyLoad`). Es solo lectura: imprime
  SQL a stdout y no toca la base. Precedente: la migración 0202 pegó únicamente las
  filas nuevas (`0202_hos_2105_faq_draft_catalog.sql:47-49`).
- G18 (`scripts/check-catalog-sql.ts`) compara las filas **acumuladas** de todas las
  migraciones contra lo que genera el código, clave por clave. Falla ante cualquier
  `INSERT ... SELECT`, `UPDATE`, `DELETE` o `ON CONFLICT` sobre esas tablas.
  El test `packages/db/test/integration/catalog-key-fk-from-empty.test.ts` verifica que
  la tabla armada desde cero coincide con el generador.
- G3 (`scripts/check-catalog-key-usage.ts`) falla si el código usa
  `EntitlementKeyEnum.X` / `LimitKeyEnum.X` o `getCatalogKey({key:'...'})` con una clave
  que no está en el catálogo. Mientras no haya uso, es neutro.
- G7 (`scripts/check-commercial-values-in-code.ts`) mira solo
  `packages/payments/src` y `packages/service-core/src/services/billing`: busca
  literales numéricos de precio. No aplica a este issue.
- **Guards de i18n que se ponen rojos con una clave nueva** (hallazgo que cambia el
  alcance del issue):
  - `apps/web/src/lib/__tests__/entitlement-label-coverage.test.ts`: cada
    `EntitlementKeyEnum` debe tener `billing.entitlement.<key>` en es, en y pt.
  - `apps/web/test/lib/billing-limit-key-i18n-coverage.guard.test.ts`: cada
    `LimitKeyEnum` debe tener `billing.limit.<key>.title`,
    `billing.comparison.limitLabel.<key>` y estar en `KNOWN_LIMIT_KEYS`
    (`apps/web/src/lib/billing-limit-error.ts:65`).
  - Paridad es/en/pt (`packages/i18n/test/key-coverage.test.ts`).
- El `catalog.ts` de producción (`scripts/production-catalog/catalog.ts`) declara qué
  otorga cada versión de plan. Como este issue no asigna nada, **no se toca**.
  `as-of-0144.ts` filtra del catálogo las filas que llegaron después de 0144; sin
  asignaciones no hay nada que filtrar. Esto corrige el criterio del issue, que
  pedía tocarlos: pertenece a los issues de grants.
- Mecanismo del marcador «solo para locales con carta»: sale de
  `BUSINESS_LINES.venue[].sections` (`business-lines.ts:26-39`, `food` posee
  `menu` y `dailySpecials`; `nightlife` posee `nightInfo`) y de
  `resolveSectionBusinessLines`. Detalle en HOS-2262.

## 6. Diseño propuesto

### 6.1 Filas nuevas

Todas con scope `vertical`, clase `COMMERCIAL` (siguen el patrón `manage_venue_*` /
`venue_*`, ver nota de HOS-2252).

Entitlements (`MAX`, enforcement `NONE`, igual que todos los entitlements actuales):

| Clave | Para qué |
|---|---|
| `venue_event_recurrence` | Fechas recurrentes (pro y premium) |
| `venue_event_notifications` | Avisos al turista |
| `venue_event_stats` | Estadísticas por evento |
| `venue_guest_list` | Lista de invitados por evento |
| `venue_reservations` | Reservas de mesa o VIP con QR |
| `venue_group_reservations` | Reservas de grupo y cumpleaños |
| `venue_vip_promotions` | Promos para turistas VIP (no reusar `vip_promotions_access`, que es del turista) |

Límites (`SUM`, decisión 7). Decidido (owner, 16/11/2026): ambos con enforcement `NONE`, es decir, se evalúan en vivo y no se archiva nada.

| Clave | Aggregation | Enforcement (decidido) |
|---|---|---|
| `max_venue_active_events` | `SUM` | `NONE` |
| `max_venue_guest_list_size` | `SUM` | `NONE` |

Enforcement `NONE` y no `ARCHIVE` (decidido por el owner, 16/11/2026, pregunta 1): `ARCHIVE` declara que «el excedente más nuevo se
archiva» (`key-attributes.ts`), pero la decisión 6 dice que los eventos únicos siguen
visibles hasta su fecha y los semanales pasan a borrador. Además hoy ningún proceso
ejecuta `ARCHIVE` para claves que no son de listado: `enforcementStrategy` solo se lee
en el generador de SQL y se declara en `catalog-key.dbschema.ts` (verificado con `rg`
en `apps/`, `packages/` y `scripts/`, sin contar snapshots de migración). Como `NONE` no archiva ni reconcilia nada, la regla de baja de plan la implementa el código de cada función (HOS-2263 para eventos, HOS-2274 para la lista).

### 6.2 Archivos

1. `entitlement-keys.ts` y `limit-keys.ts`: filas nuevas, con comentario `HOS-2259`.
2. `key-enums.ts`: miembros `VENUE_EVENT_RECURRENCE`, ..., `MAX_VENUE_ACTIVE_EVENTS`,
   `MAX_VENUE_GUEST_LIST_SIZE` (mayúsculas del valor).
3. Migración nueva `packages/db/src/migrations/02NN_hos_2259_comer_y_salir_keys.sql`
   (número real al implementar: hoy el último es `0226`). Se crea con el flujo
   estándar de migración custom para que `meta/_journal.json` reciba su entrada
   (0202 figura en el journal). Contenido: solo los 9 `INSERT` a `catalog_key`
   copiados de `pnpm gen:catalog-sql --load=catalog_key`, en un único
   `INSERT INTO "catalog_key" (...) VALUES ...;`. Sin `set_config`: no se tocan
   tablas de versiones, así que el trigger de inmutabilidad no interviene.
4. `billing.json` (es/en/pt): `entitlement.<key>` para las 7 claves,
   `limit.<key>.title` y `comparison.limitLabel.<key>` para los 2 límites.
   Los textos en/pt son traducciones reales. Los textos ricos (descripciones,
   filas de tabla) van en HOS-2262.
5. `KNOWN_LIMIT_KEYS` en `billing-limit-error.ts`: sumar los 2 límites.

### 6.3 Procedimiento (de epica-billing, 16/11), verificado

1. Filas en `entitlement-keys.ts` / `limit-keys.ts` + `key-enums.ts`.
2. `pnpm gen:catalog-sql --load=catalog_key` y pegar solo las filas nuevas en una
   migración NUEVA (nunca editar una aplicada).
3. `catalog.ts` y `as-of-0144.ts`: **solo si hay asignación**; acá no.
4. Los grants son otro issue y otro archivo.

### 6.4 Decisión de unlimited

El valor «sin tope» de un límite es `2147483647` (`UNLIMITED_LIMIT_VALUE`,
`scripts/production-catalog/catalog.ts:4`), el máximo de int4. Una fila ausente cuenta
como 0 (`packages/verticals/src/authorization/limit-step.ts`, `resolveLimitStep`: el
límite ausente da `max = 0`). Hay que asignar filas explícitas. La constante está
**duplicada** en `plan-card-delta.ts:43` (web) y en `catalog.ts:4` (scripts); no hay
una fuente única en `@repo/schemas`. Se propone moverla a
`packages/schemas/src/catalog/` y que ambos lados la importen (también la necesita el
clamp de 6.5).

### 6.5 Decisión 7: ¿se persiste algún valor sumado en una columna int4?

**Conclusión: no.** Verificado:

- `foldKey` (`packages/verticals/src/effective-set/fold.ts:91-100`) suma con
  `reduce` en JavaScript. El resultado es un `number` (doble), no hay tope int4 en
  memoria.
- Donde vive el set efectivo plegado: el snapshot de Redis
  (`effective-set-cache/snapshot.ts`, JSON con `encodeFiniteOrInfinite`;
  `number-codec.ts`), con vida máxima de 15 minutos (`cache.ts:4`). No es columna SQL.
- `resolveEffectiveSet` (`resolve-effective-set.ts`) y `readEffectiveSet` no escriben
  en tablas. `selectQuotaGrant` (`quota/quota-grant.ts`) pliega pero no persiste el
  total.
- `quota-window.consumed` (`quota-window.dbschema.ts:23`) es int4 pero guarda **lo
  consumido**, no el plegado, y solo para claves medidas por mes (las `max_ai_*`).
  Los dos límites nuevos no son medidos.
- Las columnas int4 de catálogo (`plan_version_limit.value`, `addon_version_limit.value`,
  `plan-catalog.dbschema.ts:196`, `addon-catalog.dbschema.ts:132`) guardan valores de
  **una** fuente, nunca la suma. Un add-on de +5 guarda 5.
- Los esquemas de respuesta no tienen `int32` ni `.max(2147483647)`: `admin-effective-set.schema.ts:8`
  usa `z.number().finite().nonnegative()`.

El caso que sí pasa: premium `2147483647` + add-on `5` = `2147483652`. Hoy no se
guarda en ningún lado, y `isUnlimitedLimit` usa `>=` (`plan-card-delta.ts:51`), así que
la UI lo trata como ilimitado. Aun así se propone un **clamp defensivo** en el `SUM`
de `foldKey`: `Math.min(suma, UNLIMITED_LIMIT_VALUE)`. Costo: 3 líneas más un test.
Beneficio: el set efectivo nunca devuelve un valor fuera de int4, y si en el futuro
alguien lo persiste (snapshot en tabla, reporte), no revienta. Ver pregunta 2.

## 7. Modelo de datos / contratos

- `catalog_key` (tabla): 9 filas nuevas. Sin columnas nuevas.
- Contrato: ninguno. Las claves no entran en `billing-verticals-contract`.
- Carriles de migración: solo **estructural/versionada** (SQL). Ni extras ni seed:
  la tabla `catalog_key` es dato de referencia que viaja como SQL generado (G18).

## 8. UX / UI

Ninguna visible. Con las claves sin asignar a ningún plan, la tabla de planes **no**
muestra filas nuevas (decidido por el owner, 16/11/2026: las filas sin grant se ocultan hasta que algún plan las tenga, ver HOS-2262) (las filas de venue se generan desde `LISTING_SECTIONS`, no desde
el catálogo de claves; ver HOS-2262).

## 9. Criterios de aceptación

1. Dado el catálogo, cuando se corre `pnpm gen:catalog-sql --load=catalog_key`, entonces
   incluye las 9 claves con los atributos de la sección 6.1.
2. Dada la migración nueva, cuando se aplica sobre una base vacía, entonces `catalog_key`
   tiene exactamente las filas del generador (test `catalog-key-fk-from-empty`).
3. G18 pasa y G3 pasa.
4. Una asignación a `plan_version_entitlement` con una clave inventada sigue rechazada
   por FK (no regresión).
5. Los guards de i18n de entitlement y de límite pasan en es, en y pt.
6. `key-enums.test.ts` pasa (enum = catálogo, mayúsculas).
7. Ninguna `plan_version_entitlement` ni `plan_version_limit` contiene las claves nuevas
   al terminar el issue.
8. Si se aprueba el clamp: `foldPlegableSet` con `2147483647` y `5` en
   `max_venue_active_events` devuelve `2147483647`.

## 10. Plan de tests

- `packages/schemas/test/catalog/key-enums.test.ts` y `key-catalog.test.ts` (existentes,
  deben seguir verdes; sumar casos para los atributos de las 9 claves).
- `scripts/__tests__/check-catalog-sql.test.ts` y `check-catalog-key-usage.test.ts`.
- `packages/db/test/integration/catalog-key-fk-from-empty.test.ts` (integración, requiere DB).
- `apps/web/src/lib/__tests__/entitlement-label-coverage.test.ts`,
  `apps/web/test/lib/billing-limit-key-i18n-coverage.guard.test.ts`,
  `packages/i18n/test/key-coverage.test.ts`.
- Clamp (si se aprueba): `packages/verticals/test/effective-set/fold.test.ts` (nuevo caso).

## 11. Riesgos

- R-1. Mergear antes de la pasada final de HOS-1352 rompe el orden pedido por
  epica-billing. Mitigación: la rama espera; el PR no lleva `Closes`.
- R-2. Un número de migración que choque con otra rama. Mitigación: tomar el número
  recién al implementar, después de mergear `staging`.
- R-3. Aceptar `enforcement: NONE` (decidido) y que luego se pida archivado automático. Mitigación:
  el enforcement es un atributo de catálogo y cambiarlo es una migración nueva solo si
  hay filas que cambiar; pero **no se puede editar una fila de `catalog_key` ya
  insertada sin migración de UPDATE**, y G18 falla ante `UPDATE`. Por eso el owner lo
  fijó ahora, en `NONE` (pregunta 1).

## 12. Preguntas abiertas para el owner

1. **Enforcement de los dos límites nuevos.** Decidido (owner, 16/11/2026): `NONE`. Se evalúan en vivo y no se archiva nada; la regla de baja de plan la implementa el código de cada función (HOS-2263 y HOS-2274). `ARCHIVE` prometía algo que no ocurre.
2. **Clamp del `SUM` a 2147483647.** Opciones: (a) sí, en `foldKey`; (b) no, dejar crecer
   el número porque nada lo persiste. Recomendación: (a), es barato y blinda el futuro.
3. **Fuente única de `UNLIMITED_LIMIT_VALUE`.** Opciones: (a) moverla a `@repo/schemas`
   en este issue; (b) dejar las dos copias. Recomendación: (a), el clamp necesita
   importarla desde `@repo/verticals`, que no puede importar `scripts/`.

## 13. Dependencias

- Bloqueado por: pasada final de HOS-1352; HOS-2066 va primero en la épica post-MVP.
- Desbloquea: HOS-2262, HOS-2263 a HOS-2278 (gates) y HOS-2280 a HOS-2289.
- Si HOS-2253/HOS-2260 suman otra clave, entra acá antes de mergear.

## 14. Labels de smoke y Novedades

- Labels: `status-needs-smoke-staging`. El cambio es de datos de catálogo sin comportamiento;
  alcanza con aplicar migraciones en staging y verificar G18 y que `/api/v1/public/plans`
  no cambia. No requiere smoke de prod.
- What's New: no aplica (sin cambio visible). El PR de la épica lleva `whats-new-none`.

## 15. Desglose de tareas

1. Mover `UNLIMITED_LIMIT_VALUE` a `@repo/schemas` y reemplazar las dos copias (0,5 día).
2. Filas + enums + tests de schemas (0,5 día).
3. Migración SQL con la salida del generador y verificación G18/G3/from-empty (0,5 día).
4. Textos mínimos es/en/pt + `KNOWN_LIMIT_KEYS` (0,5 día).
5. Clamp en `foldKey` + test (0,5 día).
6. Revisión de epica-billing y espera de HOS-1352 (sin esfuerzo).

## 16. Linear

Canonical tracking:
HOS-2259
