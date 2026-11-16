---
title: Planes de Comer y salir. Habilitar promos, happy hour y promos VIP (additive grant)
linear: HOS-2282
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - db
  - billing
---

# Planes de Comer y salir. Habilitar promos, happy hour y promos VIP

## 1. Resumen

Asigna a los planes de venue las claves del bloque de promos por «additive grant».
Reusa el patrón común de
`.specs/HOS-2280-comer-y-salir-grants-eventos-metricas-video/spec.md` (secciones 5.1,
5.2, 6.1 a 6.4, 12 y consultas C-1 a C-5). Lo propio de este bloque: dos claves
**reusadas** de alojamiento (`create_promotions`, `max_active_promotions`) y una nueva
(`venue_vip_promotions`), y la verificación de que asignarlas a venue no habilita nada
de alojamiento.

Bloqueado: nada del catálogo se mergea antes de la pasada final de HOS-1352.

## 2. Problema

Las promos de local y el happy hour (HOS-2270 a HOS-2272) y las promos VIP (HOS-2273)
tienen que gatearse por plan. `create_promotions` y `max_active_promotions` hoy solo las
otorgan los planes de alojamiento. Hay que otorgarlas a pro y premium de venue sin
mezclar los dos mundos.

## 3. Alcance

| Clave | Básico | Pro | Premium |
|---|---|---|---|
| `create_promotions` | no | agrega | agrega |
| `max_active_promotions` | no | 5 | 2147483647 (sin tope) |
| `venue_vip_promotions` | no | no | agrega |

Decisión 5 (HOS-2253): pro 5, premium sin tope, «igual que alojamiento»; básico no tiene
promos; el happy hour cuenta como una promo más. Filas en v1: 3 de entitlement
(`create_promotions` pro y premium, `venue_vip_promotions` premium) y 2 de límite.

## 4. Fuera de alcance

- Cambiar el comportamiento de las promos de alojamiento.
- El modelo y la API de promos de venue (HOS-2270), el editor (HOS-2271), el happy hour
  (HOS-2272) y las promos VIP (HOS-2273).
- El pack de +3 promos (HOS-2287).

## 5. Estado actual verificado (`origin/staging`)

- Valores de alojamiento en `catalog.ts`: `owner-basico` 2 (línea 171), `owner-pro` 5
  (línea 352), `owner-premium` sin tope (línea 542). Venue pro 5 y premium sin tope copian
  pro y premium de alojamiento; básico de venue queda sin promos, a diferencia de
  alojamiento básico, que tiene 2 (decisión 5, confirmada).
- Ninguna versión de venue de `catalog.ts` tiene `create_promotions`,
  `max_active_promotions` ni `venue_vip_promotions` (`venue-basico` 569, `venue-pro` 687,
  `venue-premium` 814). `create_promotions` y `max_active_promotions` están definidas en
  `entitlement-keys.ts:25` y `limit-keys.ts:18` (`SUM`, `ARCHIVE`).
- **No hay leak a alojamiento.** Las dos claves tienen scope `vertical`, y el set efectivo
  se resuelve por `user + vertical` (`resolve-effective-set.ts`, `scope.ts`). La ruta que
  crea promos de alojamiento pide siempre el vertical de alojamiento:
  `apps/api/src/routes/owner-promotion/protected/create.ts:42-47`
  (`enforceUserGate({ vertical: VerticalEnum.ACCOMMODATION, keys: ['create_promotions'], limit: max_active_promotions })`).
  El panel web `PromotionList.client.tsx:182` lee `create_promotions` del set de
  alojamiento. `owner_promotions` es solo de alojamiento (nota de HOS-2252). Un owner con
  plan pro de venue y sin plan de alojamiento no puede crear promos de alojamiento por
  esas rutas.
- Efecto inverso a verificar: las rutas nuevas de promos de venue (HOS-2270) deben pedir
  `VerticalEnum.VENUE` (G2, guard `check-vertical-context`), o leerían el set equivocado.
- `max_active_promotions` es `SUM`: un add-on (HOS-2287) y el plan se suman. Premium
  `2147483647` + 3 = `2147483650` sale del rango int4, pero ese total no se persiste
  (HOS-2259 sección 6.5); el clamp propuesto lo cubre.
- Trial: entitlements de premium (incluido `venue_vip_promotions`) y límites de básico
  (sin `max_active_promotions`) producen **tope 0** (HOS-2280 sección 5.4). Un venue en
  trial vería «Promos» habilitadas y no podría crear ninguna.
  **Decidido (owner, 16/11/2026):** el trial recibe una fila propia
  `max_active_promotions = 1` (1 promo activa, mínimo para probar) en la versión del plan
  `trial` de venue, por additive grant (HOS-2280, pieza D). Durante el trial el editor de
  promos muestra el aviso «Incluido en Pro y Premium. El plan Básico no lo tiene»
  (HOS-2262, sección 6.6): el plan Básico de venue no tiene promos.
- Decisión 6 (baja de plan): las promos confirmadas se respetan «como en alojamiento».
  La clave `max_active_promotions` declara enforcement `ARCHIVE`, pero ningún proceso lo
  ejecuta hoy para promos (verificado: el atributo solo se lee en el generador de SQL);
  el comportamiento de «no borrar, frenar lo nuevo» lo implementa el gate de creación
  (HOS-2270).

## 6. Diseño propuesto

Idéntico a HOS-2280 secciones 6.1 a 6.4. Datos propios:

- **Pieza A.** `02NN_hos_2282_venue_promotions_grants.sql`:
  `set_config('hospeda.catalog_additive_grant','HOS-2282', true)`, `INSERT` de 3 filas a
  `plan_version_entitlement` y, separado, `INSERT` de 2 filas a `plan_version_limit` con
  ids de `catalogId(...)` del generador; valores `5` y `2147483647` tomados de
  `UNLIMITED_LIMIT_VALUE` en `catalog.ts`, no a mano; reset del setting.
- **Pieza B.** `catalog.ts` suma las filas a `venue-pro` y `venue-premium`; se agregan
  los 5 pares a `ADDITIVE_GRANTS_AFTER_0144`. **Ojo:** `create_promotions` y
  `max_active_promotions` ya existen en alojamiento; el filtro de `as-of-0144.ts` debe
  ser por par plan-clave (la tabla), nunca por nombre de clave, o borraría las de
  alojamiento (HOS-2280 sección 6.2).
- **Pieza C.** Data-migration de seed con `INSERT ... SELECT` sobre todas las versiones de
  `venue-pro` y `venue-premium`, `NOT EXISTS`, reset en éxito, y `conflicts` si ya
  hay un `max_active_promotions` con otro valor. Suma también la fila de límite del
  `trial` de venue (`max_active_promotions = 1`, valor desde la tabla de grants).
- **Pieza D (trial).** La fila `max_active_promotions = 1` de la versión `trial` entra en
  la misma migración SQL (por `catalogId` del plan `trial` de venue) y en la
  data-migration (ver HOS-2280, sección 6.5). Solo límite, nunca entitlement.
- **Verificación de no-leak** como test (sección 10): el set efectivo de un usuario con
  solo plan de venue no contiene `create_promotions` en el vertical de alojamiento.

## 7. Modelo de datos / contratos

Sin tablas nuevas. Filas: 3 + 2 por conjunto de versiones v1. Carriles: versionada + seed.

## 8. UX / UI

Sin UI propia. Las filas de la tabla de planes (promos activas, promos VIP) las define
HOS-2262; la de tope de promos es una celda `limit` que lee `max_active_promotions`. Una
fila sin ningún plan que la otorgue se oculta (no «Próximamente»); aparece sola al aplicar
este grant.

## 9. Criterios de aceptación

1. Dada una base nueva, `venue-pro` tiene `create_promotions` y `max_active_promotions = 5`;
   `venue-premium` tiene ambas con `2147483647` y además `venue_vip_promotions`;
   `venue-basico` no tiene ninguna.
2. Dado un usuario solo con plan pro de venue, cuando pide el set efectivo del vertical de
   alojamiento, entonces `create_promotions` no está.
3. Dado ese mismo usuario, cuando llama `POST /api/v1/protected/owner-promotions`, entonces
   recibe el rechazo de entitlement de alojamiento (no puede crear promos de alojamiento).
4. Dadas versiones posteriores (v2+) de pro y premium, la data-migration las completa y
   es idempotente.
5. Dada una versión con `max_active_promotions` de otro valor, no se toca y se lista.
6. G18, G3, G2 (`check-vertical-context`) y los tests de catálogo desde cero pasan.
7. Un owner pro de venue ve `create_promotions` y `max_active_promotions = 5` en
   `/api/v1/protected/me/effective-set?vertical=venue` dentro de los 15 minutos.
8. El panel de promos de alojamiento de un owner con ambos planes no cambia.
9. Dada la versión del plan `trial` de venue, tiene `max_active_promotions = 1`; un venue en
   trial crea una promo y la segunda falla con el mensaje de tope, y ve el aviso «Incluido
   en Pro y Premium. El plan Básico no lo tiene».

## 10. Plan de tests

- `apps/api/test/integration/billing-subscription/...` (set efectivo por vertical, patrón de
  `real-coverage-addon-fixtures.ts`): venue pro ve las claves; alojamiento no.
- `apps/api/test/routes/owner-promotion/protected/create.test.ts` (existente): sigue verde
  y se agrega el caso de usuario solo-venue.
- `scripts/__tests__/production-catalog-g18.test.ts`,
  `production-catalog-from-empty.test.ts`.
- Test de integración de la migración y de la data-migration (patrón de HOS-2280).
- Smoke de staging.

## 11. Riesgos

- R-1. Filtro por nombre de clave en `as-of-0144.ts` borraría promos de alojamiento
  (mitigado: filtro por par plan-clave).
- R-2. Trial con tope 0 (sección 5): resuelto con la fila mínima del trial (decisión del
  owner, 1 promo activa).
- R-3. Una ruta de venue que pida el vertical equivocado leería alojamiento. Mitigado por G2
  y por el test de no-leak.
- R-4. Las promos de alojamiento de un usuario con dos verticales: independientes por scope.

## 12. Preguntas abiertas para el owner

1. **Promos de venue y `owner_promotions`.** La clave y el límite se comparten por nombre
   con alojamiento pero se resuelven por vertical. Opciones: (a) mantener los mismos nombres
   (decisión actual del issue); (b) claves propias de venue (`create_venue_promotions`).
   Recomendación: (a), menos claves; el scope por vertical ya los separa.
2. **Decidido (owner, 16/11/2026): trial.** 1 promo activa en la versión `trial` de venue,
   por additive grant, con el aviso «Incluido en Pro y Premium. El plan Básico no lo
   tiene». Abierto menor: el texto del aviso para `venue_vip_promotions` (solo Premium),
   ver HOS-2262, pregunta 4.
3. **Premium «sin tope»** (decisión 5). Confirmado en HOS-2253; sin pregunta nueva.

Consultas de solo lectura: C-1 a C-5 de HOS-2280, con las claves `create_promotions`,
`max_active_promotions`, `venue_vip_promotions`. Consulta adicional C-6, qué venue tiene
promos hoy: no hay tabla de promos de venue todavía (la crea HOS-2270), así que no
hace falta.

## 13. Dependencias

- HOS-2259 (claves), pasada final de HOS-1352, HOS-2066.
- HOS-2270 a HOS-2273 construidas antes de habilitar.
- Habilita HOS-2287 (pack de +3 promos).

## 14. Labels de smoke y Novedades

- `status-needs-smoke-staging`. Smoke: venue pro crea hasta 5 promos y el sexto falla con el
  mensaje de tope; premium crea sin tope y una promo VIP; básico no ve el editor de promos;
  un usuario con alojamiento y venue no ve cruces; un venue en trial crea 1 promo y ve el
  aviso del plan Básico. Checklist de billing, staging.
- What's New: sí (HOS-2284).

## 15. Desglose de tareas

1. Consultas de solo lectura y confirmación de filas (0,25 día).
2. `catalog.ts` + tabla de grants post-0144 (0,25 día).
3. Migración SQL + data-migration + tests, incluida la fila de límite del trial (0,75 día).
4. Test de no-leak entre verticales (0,25 día).
5. Smoke de staging y firma (0,5 día).

## 16. Linear

Canonical tracking:
HOS-2282
