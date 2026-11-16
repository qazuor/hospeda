---
title: Planes de Comer y salir. Habilitar listas y reservas (additive grant)
linear: HOS-2283
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - db
  - billing
---

# Planes de Comer y salir. Habilitar listas y reservas

## 1. Resumen

Asigna a los planes de venue las claves del bloque de reservas por «additive grant»:
lista de invitados con cupo, reservas de mesa o VIP, y reservas de grupo y cumpleaños.
Reusa el patrón común de
`.specs/HOS-2280-comer-y-salir-grants-eventos-metricas-video/spec.md` (secciones 5.1,
5.2, 6.1 a 6.4, 12 y consultas C-1 a C-5). Este documento declara los datos propios y el
punto delicado de este bloque: la lista de invitados es solo para locales con rubro
«noche», y eso **no lo decide el plan**.

Bloqueado: nada del catálogo se mergea antes de la pasada final de HOS-1352.

## 2. Problema

Las funciones de lista (HOS-2274) y reservas (HOS-2275 a HOS-2278) no existen en ninguna
vertical. Cuando estén construidas detrás de sus claves, hay que otorgarlas.

## 3. Alcance

| Clave | Básico | Pro | Premium |
|---|---|---|---|
| `venue_guest_list` | no | agrega | agrega |
| `max_venue_guest_list_size` | no | 100 por evento | 2147483647 (sin tope) |
| `venue_reservations` | no | no | agrega |
| `venue_group_reservations` | no | no | agrega |

Decisión 3 (HOS-2253): cupo de lista en pro 100 por evento; premium sin tope. Filas en
v1: 4 de entitlement (`venue_guest_list` pro y premium, `venue_reservations` y
`venue_group_reservations` premium) y 2 de límite.

## 4. Fuera de alcance

- La función de lista, mesa, QR de ingreso, grupos y cumpleaños (HOS-2274 a HOS-2278).
- El pack de +100 lugares (HOS-2286).
- La restricción por rubro: no es un grant (ver 5.3 y 6.5).

## 5. Estado actual verificado (`origin/staging`)

### 5.1 Qué existe hoy

Reservas, listas y QR de ingreso **no existen en ninguna vertical**; `centralized_booking`
es una clave sin código (nota de HOS-2252). Las seis claves de este bloque no existen
todavía (las crea HOS-2259). Ninguna versión de venue de `catalog.ts` las tiene
(`venue-basico` 569, `venue-pro` 687, `venue-premium` 814).

### 5.2 Cupo por evento y unlimited

`max_venue_guest_list_size` mide lugares **por evento**; no es un contador acumulado. Se
comparará en la ruta de anotarse (HOS-2274) con `resolveLimitStep` (`limit-step.ts`,
límite ausente = 0, de ahí que haga falta fila explícita en pro y en premium). Con `SUM`,
premium `2147483647` + add-on `100` = `2147483747` (no se persiste: HOS-2259 sección 6.5).

### 5.3 «Solo para locales de noche» no lo da el plan

La decisión 4 dice que la lista solo aplica a locales con rubro «noche». Ese rubro es
atributo **de la ficha** (`venue.businessLines`), no del plan. El mecanismo existente
(`LISTING_SECTIONS` + `BUSINESS_LINES.venue[].sections`, `business-lines.ts:26-39`) resuelve
la sección por ficha en `resolveListingSections`
(`packages/verticals/src/listing-sections/resolve-listing-sections.ts:134-200`): una
sección `common:false` cuyo rubro la ficha no tiene queda `absent`, aunque el plan otorgue
la clave. Por lo tanto:

- El grant de `venue_guest_list` a pro y premium **no** habilita la lista en un
  restaurante sin rubro noche; la sección `guestList` (la declara HOS-2274, ver
  HOS-2262 sección 6.2) estará `absent` para esa ficha. Es lo que se quiere: un solo
  plan, función visible solo donde corresponde.
- Un plan premium con una ficha `food` y otra `nightlife` ve la lista solo en la segunda.
- **Consecuencia para el add-on de HOS-2286:** el estado de sección es por ficha pero el
  add-on es por suscripción de vertical; quien tenga solo fichas `food` podría comprar un
  pack de cupo que no puede usar. La elegibilidad se resuelve en el add-on, no acá.

### 5.4 El trial

Entitlements del trial = versión de mayor rank (premium); límites = menor rank (básico),
más override del plan `trial` (`trial-ratchet.ts`, cabecera). Un venue en trial recibe
`venue_guest_list`, `venue_reservations`, `venue_group_reservations` y **no** tiene fila de
`max_venue_guest_list_size`: cupo 0, no puede anotar a nadie.

**Decidido (owner, 16/11/2026):** el trial recibe una fila propia
`max_venue_guest_list_size = 10` (10 lugares en la lista, mínimo para probar) en la
versión del plan `trial` de venue, por additive grant (HOS-2280, pieza D). Durante el
trial, la lista muestra el aviso con los planes que la incluyen, leídos del catálogo (HOS-2262 6.6)
(HOS-2262, sección 6.6): Básico de venue no tiene lista. Los límites nuevos van con
enforcement `NONE` (decisión 26, HOS-2259): `max_venue_guest_list_size` se evalúa en vivo
al anotarse y no archiva nada.

### 5.5 Reservas y cobro

`venue_reservations` y `venue_group_reservations` son entitlements puros: no llevan
cantidad. Si se quisiera un tope de reservas, sería un límite nuevo (no está decidido).

## 6. Diseño propuesto

Idéntico a HOS-2280 secciones 6.1 a 6.4. Datos propios:

- **Pieza A.** `02NN_hos_2283_venue_reservations_grants.sql`:
  `set_config('hospeda.catalog_additive_grant','HOS-2283', true)`, `INSERT` de 4 filas a
  `plan_version_entitlement`, aparte `INSERT` de 2 filas a `plan_version_limit`
  (`max_venue_guest_list_size`: pro 100, premium `UNLIMITED_LIMIT_VALUE`), reset.
- **Pieza B.** `catalog.ts` suma las filas a `venue-pro` y `venue-premium`; 6 pares nuevos
  en `ADDITIVE_GRANTS_AFTER_0144`.
- **Pieza C.** Data-migration de seed por `slug` sobre todas las versiones, `NOT EXISTS`,
  `conflicts` si ya hay un `max_venue_guest_list_size` con otro valor.
- **Pieza D (trial).** Fila `max_venue_guest_list_size = 10` en la versión `trial` de venue,
  en la migración SQL y en la data-migration (patrón de HOS-2280, sección 6.5). Solo
  límite. Con esto la migración queda en 4 + 3 filas en v1.
- **6.5 Rubro y add-on.** Este issue no toca rubros. HOS-2262 pone la marca visual y
  HOS-2274 declara la sección; HOS-2286 pone la elegibilidad del add-on.
- **Orden dentro del bloque.** La lista (`venue_guest_list`) y las reservas se pueden
  habilitar en migraciones separadas si HOS-2274 sale antes que HOS-2275 a HOS-2278: el
  patrón admite grants por subconjunto (cada uno con su `catalog_additive_grant`).
  Recomendación: una sola migración al final, con todo construido, para un solo smoke.

## 7. Modelo de datos / contratos

Sin tablas nuevas. 4 + 2 filas por conjunto de versiones v1. Carriles: versionada + seed.

## 8. UX / UI

Sin UI propia. Filas en la tabla de planes (HOS-2262): lista de invitados con marca
«Para locales del rubro Noche», cupo (100 / Ilimitado), reservas y reservas de grupo.
Cada fila se oculta mientras ningún plan la otorgue (no «Próximamente») y aparece sola al
aplicar el grant.

## 9. Criterios de aceptación

1. Dada una base nueva, `venue-pro` tiene `venue_guest_list` y `max_venue_guest_list_size = 100`
   y no tiene reservas; `venue-premium` tiene las cuatro entitlements y
   `max_venue_guest_list_size = 2147483647`; `venue-basico` no tiene ninguna.
2. Dada una versión v2+, la data-migration la completa; idempotente.
3. Dada una versión con `max_venue_guest_list_size` de otro valor, no se toca y se lista.
4. Dado un local pro con rubro `food` solamente, cuando consulta los estados de sección,
   entonces `guestList` es `absent` aunque el plan otorgue `venue_guest_list`.
5. Dado un local pro con rubro `nightlife`, `guestList` está `available` y el cupo es 100.
6. G18, G3 y los tests de catálogo desde cero pasan.
7. Un owner de alojamiento no cambia su set efectivo.
8. El set efectivo de pro/premium refleja las claves nuevas dentro de los 15 minutos.
9. Dada la versión del plan `trial` de venue, tiene `max_venue_guest_list_size = 10`; un
   venue nocturno en trial anota hasta 10 lugares y el siguiente falla, y ve el aviso
   con los planes que la incluyen, leídos del catálogo (HOS-2262 6.6).

## 10. Plan de tests

- `packages/verticals/test/listing-sections/*` (caso `guestList` absent por rubro).
- `scripts/__tests__/production-catalog-g18.test.ts` y
  `packages/db/test/integration/production-catalog-from-empty.test.ts`.
- Test de integración de la migración y de la data-migration (patrón de HOS-2280).
- E2E en staging: anotarse en una lista, reservar mesa, grupo y cumpleaños, validar el QR
  en la puerta.

## 11. Riesgos

- R-1. Habilitar antes de tener las funciones y sus gates: las claves quedan en la tabla
  sin función real. Mitigación: no mergear hasta tener HOS-2274 a HOS-2278 en `staging`.
- R-2. El rubro «noche» confunde al owner: un premium food ve «lista de invitados» en la
  tabla con la leyenda de rubro, pero no en su editor. Mitigación: la marca de HOS-2262.
- R-3. Premium con tope ilimitado y add-on de cupo (HOS-2286): sumar desborda int4 en
  memoria. Cubierto por el clamp (HOS-2259).
- R-4. Mismo riesgo de versiones reales que HOS-2280.

## 12. Preguntas abiertas para el owner

1. **Un solo grant al final o grants por función.** Opciones: (a) una migración al
   terminar lista + reservas; (b) una por función a medida que salen. Recomendación: (a).
2. **Decidido (owner, 16/11/2026): trial.** Cupo de 10 lugares en la versión `trial` de
   venue (pieza D), con el aviso con los planes que la incluyen, leídos del catálogo (HOS-2262 6.6).
   Abierto menor: el aviso para reservas (`venue_reservations`, solo Premium) necesita
   otro texto (HOS-2262, pregunta 4).
3. **Tope de reservas.** Hoy no hay. Opciones: (a) sin tope; (b) límite por mes para
   premium. Recomendación: (a) hasta ver uso real.

Consultas de solo lectura: C-1 a C-5 de HOS-2280, con las claves `venue_guest_list`,
`venue_reservations`, `venue_group_reservations`, `max_venue_guest_list_size`.

## 13. Dependencias

- HOS-2259, pasada final de HOS-1352, HOS-2066.
- HOS-2260 (spec de reservas y listas), HOS-2274 a HOS-2278 construidas antes.
- Habilita HOS-2286 (pack +100 lugares).

## 14. Labels de smoke y Novedades

- `status-needs-smoke-staging`. Smoke: con un local pro de rubro noche, anotarse en una
  lista; con premium, reservar mesa, grupo y cumpleaños, y validar el QR en la puerta;
  confirmar que un local `food` no ve la lista; un venue en trial con 10 lugares y el aviso
  del plan Básico. Checklist de billing, staging.
- What's New: sí (HOS-2284).

## 15. Desglose de tareas

1. Consultas de solo lectura y confirmación de filas (0,25 día).
2. `catalog.ts` y tabla de grants post-0144 (0,25 día).
3. Migración SQL + data-migration + tests, incluida la fila de límite del trial (0,75 día).
4. Test de `guestList` absent por rubro (0,25 día).
5. Smoke de staging y firma (0,75 día).

## 16. Linear

Canonical tracking:
HOS-2283
