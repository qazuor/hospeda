---
title: Add-on de Comer y salir. Pack de +100 lugares en la lista de invitados
linear: HOS-2286
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - db
  - billing
  - api
  - web
  - admin
---

# Add-on de Comer y salir. Pack de +100 lugares en la lista de invitados

## 1. Resumen

Un add-on de venue que suma **100 lugares por evento** a la lista de invitados, para un
local pro con una fecha fuerte. Otorga `max_venue_guest_list_size = 100`, que se suma
al cupo del plan (`SUM`). Se compra desde la lista cuando llega al cupo y desde la
página de complementos. Solo se ofrece a locales con el rubro «noche» (HOS-2253,
decisión 4).

Decidido (owner, 16/11/2026): pack **mensual** y **no apilable** (si hace falta más, se crea
un pack más grande; la variante por temporada se evalúa cuando se resuelva HOS-2094). Precio
**provisorio** $7.000/mes, a revisar con el owner antes de crear el producto en producción.
Se crea desde el admin existente, con runbook.

Comparte el mecanismo de venta con
`.specs/HOS-2285-comer-y-salir-addon-pack-eventos/spec.md` (secciones 5.1 a 5.3, 6.1 a 6.3 y
6.5 a 6.6). La **elegibilidad** (capacidad base, rubro, ya-otorgado, `ADDON_NOT_ELIGIBLE`)
la define **HOS-2292**, de la que este add-on depende (6.2).

Bloqueado: toca el catálogo de add-ons; no se mergea antes de la pasada final de HOS-1352.
Va después de HOS-2283 (grants de listas y reservas).

## 2. Problema

Pro tiene un cupo de 100 por evento (decisión 3). Un boliche con una fecha fuerte necesita
más para esa noche. Hoy la salida es premium (sin tope). Un pack permite resolverlo sin
cambiar de plan.

## 3. Alcance

- Un add-on `max_venue_guest_list_size = +100`.
- Compra desde la lista cuando se alcanza el cupo y desde complementos.
- Declaración de lo que necesita de la elegibilidad: rubro noche y capacidad base
  (`venue_guest_list`); el mecanismo es de HOS-2292.
- Creación desde el admin con runbook.
- Textos es/en/pt.

## 4. Fuera de alcance

- La lista de invitados (HOS-2274) y el cupo base (HOS-2283).
- El mecanismo de elegibilidad (HOS-2292) y cualquier código o migración para crear el
  add-on (se crea desde el admin).
- Variante por fecha (`UNA_VEZ`): se evalúa cuando se resuelva HOS-2094.
- Cupo por noche específica o por ficha (el límite es por evento y por usuario+vertical).

## 5. Estado actual verificado (`origin/staging`)

- La clave `max_venue_guest_list_size` no existe todavía (HOS-2259) y ninguna versión de venue
  la otorga (HOS-2283). El módulo de lista tampoco existe (HOS-2274).
- Modelo, creación (admin UI), venta y política: ver HOS-2285 sección 5. Dato clave de
  alcance: un add-on con scope `VERTICAL_SUBSCRIPTION` emite su fuente de cobertura solo en
  el vertical de la suscripción destino
  (`packages/service-core/src/services/billing/addon/addon-coverage-verticals.ts:16-25`), y
  un scope `LISTING` emite en el vertical de la ficha pero el set efectivo se pliega por
  `user + vertical` (`resolve-effective-set.ts`), así que **no limita a una sola ficha**.
  Por eso este add-on usa `VERTICAL_SUBSCRIPTION`.
- Como `max_venue_guest_list_size` es `SUM` (HOS-2259), plan pro 100 + add-on 100 = 200 por
  evento, aplicado a todos los eventos del dueño en venue (no a uno solo).
- **Rubro «noche»:** la sección `guestList` (la declara HOS-2274; HOS-2262 sección 6.2) es
  `common:false` y la posee `nightlife` en `BUSINESS_LINES.venue[].sections`
  (`business-lines.ts:26-39`). `resolveListingSections` la marca `absent` en una ficha sin
  ese rubro (`resolve-listing-sections.ts:134-200`). Esa es la regla de la ficha; el add-on
  necesita su par a nivel de oferta (HOS-2292, regla de rubro).
- No hay elegibilidad de add-ons hoy (HOS-2292).
- Una instancia por `(owner, producto, destino)` activa o pendiente: el pack no se apila
  (decidido, 16/11/2026); el máximo para pro es 200 por evento.

## 6. Diseño propuesto

### 6.1 Add-on

| Campo | Valor |
|---|---|
| slug | `extra-guest-list-100` |
| versión | `WHILE_SUBSCRIPTION_ALIVE`, `VERTICAL_SUBSCRIPTION`, `entitlements: []`, `limits: [{ key: 'max_venue_guest_list_size', value: 100 }]` |
| producto | `PERIODICO` mensual, precio provisorio $7.000/mes (a revisar con el owner antes de producción), `compatibleVerticals: ['venue']` |

Se crea desde el admin existente siguiendo el runbook de HOS-2285 (6.2), sin migración.
Una oferta por fecha (`UNA_VEZ` + `FIXED_DAYS` con `VERTICAL_SUBSCRIPTION`, sin precedente en
producción) se evalúa cuando se resuelva HOS-2094.

### 6.2 Elegibilidad (HOS-2292)

El mecanismo lo define y lo implementa HOS-2292. Este add-on necesita:

- Capacidad base: el plan debe otorgar `venue_guest_list` (excluye básico).
- No se ofrece si el cupo efectivo ya es «sin tope» (excluye premium).
- Rubro: la clave gobernante `venue_guest_list` es la entitlement de la sección `guestList`,
  poseída por `nightlife`; el dueño debe tener al menos una ficha de venue con ese rubro,
  derivado del catálogo y sin literales de rubro fuera de `@repo/schemas` (G1, G-FAC-03).
- Rechazo de compra: 409 `ADDON_NOT_ELIGIBLE`.

Matiz honesto: el rubro es por ficha y el add-on es por suscripción. Un dueño con una ficha
noche y otra gastronomía lo ve y lo compra; el cupo solo se usa en la ficha noche
(la sección `guestList` está `absent` en la otra). Es consistente: se paga por el vertical,
se usa donde corresponde.

### 6.3 Comprar desde la lista

La ruta de anotarse (HOS-2274) responde `LIMIT_REACHED` con `limitKey =
'max_venue_guest_list_size'`; el editor de la lista muestra «Sumá +100 lugares» con
enlace a `complementos/?product=extra-guest-list-100` (preselección de HOS-2285 6.5). El
texto no nombra planes.

### 6.4 Al vencer

El cupo vuelve al del plan. Lo ya anotado se respeta (decisión 6): nadie sale de una lista
por la baja; no se aceptan nuevas anotaciones por encima del cupo. HOS-2274 debe leer el
cupo en vivo.

## 7. Modelo de datos / contratos

Sin esquema ni migración. Filas creadas desde el admin: 1 `addon`, 1 `addon_version`,
1 `addon_version_limit`, 1 `addon_product`. Contratos de elegibilidad: HOS-2292.

## 8. UX / UI

- Oferta en complementos solo para dueños con ficha noche y plan pro.
- Panel en el editor de la lista al llegar al cupo, con botón de compra.
- Texto es: «Pack de lugares extra en tu lista (+100 por evento)».

## 9. Criterios de aceptación

1. Dado un dueño pro con ficha de rubro noche, cuando compra el pack, entonces su cupo
   efectivo por evento pasa a 200 dentro de los 15 minutos.
2. Dado un dueño pro solo con fichas gastronomía, entonces no ve la oferta y la compra se
   rechaza con 409 `ADDON_NOT_ELIGIBLE` (regla de HOS-2292).
3. Dado un dueño premium o básico, entonces no se ofrece y se rechaza (HOS-2292).
4. Dado el vencimiento del add-on, el cupo baja a 100 y las anotaciones existentes se
   respetan; no se aceptan nuevas por encima del cupo.
5. Dado un dueño con plan de alojamiento, entonces su set efectivo de alojamiento no cambia.
6. Dado un dueño con el pack activo, cuando intenta comprarlo otra vez, entonces recibe
   `ADDON_ALREADY_ACTIVE` (no apilable).
7. G1, G2, G14, G7 pasan; ningún rol decide la elegibilidad; no hay precio en el código.
8. El producto de producción se crea solo tras la revisión del precio con el owner.

## 10. Plan de tests

- Los tests de elegibilidad (derivación, contrato, ofertas, rechazo, caso de rubro `food` vs
  `nightlife`) viven en HOS-2292.
- `packages/verticals/test/listing-sections/resolve-listing-sections.test.ts`: `guestList`
  `absent` sin rubro.
- Test de integración de compra con el producto de venue y ficha noche.
- Smoke de staging con MercadoPago sandbox.

## 11. Riesgos

- R-1. Depende de la elegibilidad de HOS-2292 (pieza grande, aislada allá).
- R-2. No apilable: máximo +200 para pro; si hace falta más, otro pack más grande.
- R-3. Cupo «por evento» calculado en vivo contra un límite plegado: cualquier cambio de
  cobertura hay que reflejarlo (invalidación de caché ≤ 15 minutos).
- R-4. Add-on creado desde admin no es reproducible en bases nuevas; mitigación: runbook.
- R-5. Precio provisorio: no crear el producto en producción sin revisión del owner.

## 12. Preguntas abiertas y decisiones

Decidido (owner, 16/11/2026):

1. **Precio y ciclo.** Mensual periódico, no apilable, $7.000/mes provisorio a revisar con el
   owner antes de producción. La oferta por fecha (`UNA_VEZ` 30 días) se evalúa cuando se
   resuelva HOS-2094.
2. **Combinación `UNA_VEZ` + `FIXED_DAYS` + `VERTICAL_SUBSCRIPTION`.** Queda fuera de este
   spec por lo anterior; se verifica si se retoma la oferta por fecha.

Abierta (menor): **rubro por ficha vs. por suscripción** (matiz de 6.2). Recomendación:
aceptarlo (limitarlo a `LISTING` no sirve: el set se pliega por vertical).

## 13. Dependencias

- **HOS-2292** (elegibilidad de add-ons): prerrequisito.
- HOS-2259, HOS-2283 (cupo base y sección), HOS-2274 (lista), HOS-2262 (marca de rubro).
- Pasada final de HOS-1352 y HOS-2066.

## 14. Labels de smoke y Novedades

- `status-needs-smoke-staging` (compra real de complemento con MercadoPago sandbox y una
  lista que llega al cupo). No se necesita producción.
- What's New: sí, junto con HOS-2284.

## 15. Desglose de tareas

1. Crear el add-on en el admin de staging siguiendo el runbook de HOS-2285 (0,25 día).
2. Panel de tope en el editor de la lista y enlace de compra (0,5 día).
3. Textos es/en/pt (0,25 día).
4. Tests de compra y no apilado (0,25 día); los de elegibilidad por rubro van en HOS-2292.
5. Smoke de staging y firma (0,75 día).
6. Revisión del precio provisorio con el owner y creación en producción (0,25 día).

(La elegibilidad común se estima en HOS-2292.)

## 16. Linear

Canonical tracking:
HOS-2286
