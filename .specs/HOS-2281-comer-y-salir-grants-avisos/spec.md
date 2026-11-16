---
title: Planes de Comer y salir. Habilitar los avisos al turista (additive grant)
linear: HOS-2281
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - db
  - billing
---

# Planes de Comer y salir. Habilitar los avisos al turista

## 1. Resumen

Asigna `venue_event_notifications` a las versiones de pro y premium de venue por el
camino «additive grant». Es el bloque más chico: dos filas de entitlement por conjunto de
versiones y ningún límite. Reusa **sin cambios** el patrón común definido en
`.specs/HOS-2280-comer-y-salir-grants-eventos-metricas-video/spec.md`, secciones 5.1,
5.2, 6.1 a 6.4 y 12 (consultas C-1 a C-5). Este documento solo declara lo propio.

Bloqueado: nada del catálogo se mergea antes de la pasada final de HOS-1352.

## 2. Problema

Los avisos al turista (recordatorio antes del evento, evento nuevo a quienes siguen el
local, cambio o suspensión) se construyen detrás de `venue_event_notifications`
(HOS-2266 a HOS-2269). Mientras ningún plan la otorgue, la función está apagada.

## 3. Alcance

| Clave | Básico | Pro | Premium |
|---|---|---|---|
| `venue_event_notifications` | no | agrega | agrega |

Filas en v1: 2 de `plan_version_entitlement`. Ninguna de límite.

## 4. Fuera de alcance

- Cualquier límite de avisos (no hay decisión de tope; ver pregunta 1).
- El mecanismo de seguir un local y los jobs de envío (HOS-2266 a HOS-2269).
- Otros bloques de grants.

## 5. Estado actual verificado (`origin/staging`)

- La clave no existe todavía: la crea HOS-2259 (entitlement `vertical`, `MAX`, `NONE`).
- `catalog.ts` no la lista en ninguna versión de venue (`venue-pro`, línea 687;
  `venue-premium`, línea 814).
- Precedente técnico y trigger: ver HOS-2280 sección 5.1
  (`0202_hos_2105_faq_draft_catalog.sql`, `extras/041-plan-catalog-immutability.trigger.sql:93-118`,
  `0168-hos-2105-faq-draft-plan-version-grant.ts`, commit `1252aa27b1`).
- Las versiones reales de venue pro/premium no son necesariamente v1 (0156 publica
  versiones nuevas para `venue-basico` y `venue-pro`): HOS-2280 sección 5.2.
- Trial: toma entitlements de la versión de mayor rank (`trial-ratchet.ts`, cabecera), o sea
  que un venue en trial recibirá `venue_event_notifications` apenas se otorgue a premium.
  Para esta clave no hay límite asociado, así que el efecto es coherente (probarla es
  gratis para quien está en trial).
  **Decidido (owner, 16/11/2026):** se acepta, y no lleva fila propia en la versión
  `trial` (solo hay límites ahí). Durante el trial, el panel de avisos muestra el aviso
  «Incluido en Pro y Premium. El plan Básico no lo tiene» (mecanismo y texto en HOS-2262,
  sección 6.6).
- El lector real de la clave es nuevo (HOS-2266 a HOS-2269): `rg venue_event_notifications`
  no tiene usos en `staging`.
- Las notificaciones salen por `packages/notifications` (no hay tabla de seguidores
  hoy: «los favoritos ya funcionan para venue y evento; las alertas y el digest son solo
  de alojamiento», nota de HOS-2252). Eso lo resuelve HOS-2266, no este issue.

## 6. Diseño propuesto

Idéntico a HOS-2280 secciones 6.1 a 6.4, con estos datos propios:

- **Pieza A.** `packages/db/src/migrations/02NN_hos_2281_venue_event_notifications_grant.sql`:
  `set_config('hospeda.catalog_additive_grant','HOS-2281', true)`, un `INSERT` de 2 filas a
  `plan_version_entitlement` (ids de `catalogId('plan:venue:venue-pro:version:1:entitlement:venue_event_notifications')`
  y la de premium; `plan_quota` y `trial_quota` en `NULL`), reset del setting.
- **Pieza B.** Agregar `{ key: 'venue_event_notifications' }` a `venue-pro` y
  `venue-premium` en `catalog.ts` y las 2 entradas a `ADDITIVE_GRANTS_AFTER_0144`
  (la tabla que reemplaza al filtro por nombre de `as-of-0144.ts`; si HOS-2280 ya la
  creó, solo se suman filas).
- **Pieza C.** `packages/seed/src/data-migrations/0NNN-hos-2281-venue-event-notifications-grant.ts`:
  `INSERT ... SELECT` sobre todas las versiones de `venue-pro` y `venue-premium`
  (`p.vertical = pv.vertical`), `NOT EXISTS` por clave, reset del setting solo en éxito,
  resumen con `versionsGranted` y `entitlementsInserted`. Sin límite: no hay conflicto
  posible por valor distinto; solo se saltea quien ya tiene la clave.
- Numeración de ambas migraciones al implementar.

## 7. Modelo de datos / contratos

Sin tablas ni columnas nuevas. 2 filas por conjunto de versiones en
`plan_version_entitlement`. Carriles: versionada + seed.

## 8. UX / UI

Sin UI propia. La fila «Avisos al turista» de la tabla de planes la define HOS-2262 y
está **oculta** mientras ningún plan la otorga (decisión 28 del owner: no se muestra
«Próximamente»); aparece sola al aplicar este grant, sin deploy de web.

## 9. Criterios de aceptación

1. Dada una base nueva, cuando se lee la versión v1 de `venue-pro` y de `venue-premium`,
   entonces tienen `venue_event_notifications`; `venue-basico` no.
2. Dada una versión posterior (v2) de pro o premium, cuando corre la data-migration,
   entonces la recibe; una segunda corrida no inserta nada.
3. Dada una versión que ya la tiene, entonces no se duplica ni falla.
4. G18, G3 y los tests de catálogo desde cero pasan.
5. Un INSERT sin la señal de additive grant sigue rechazado, y UPDATE/DELETE también.
6. Tras aplicar, un owner pro de venue ve la clave en su set efectivo dentro de los
   15 minutos (caché de Redis, `effective-set-cache/cache.ts:4`).
7. Un owner de alojamiento no cambia su set efectivo (scope `vertical`).
8. Antes del grant, la tabla pública de planes de venue no muestra la fila de avisos;
   después, sí, sin cambio de código web.
9. Un venue en trial tiene la clave (por mayor rank) y ve el aviso «Incluido en Pro y
   Premium. El plan Básico no lo tiene» en el panel de avisos.

## 10. Plan de tests

- `scripts/__tests__/production-catalog-g18.test.ts`,
  `packages/db/test/integration/production-catalog-from-empty.test.ts` (proyección por pares).
- Nuevo test de integración de la migración (patrón del de HOS-2280).
- Nuevo test de la data-migration con una versión artificial.
- Smoke de staging (sección 14).

## 11. Riesgos

- R-1. Habilitar antes de que el envío exista: los avisos no salen pero la tabla promete
  avisos. Mitigación: el orden de la épica (Fase 3 antes de Fase 4) y la regla de no
  mergear el grant hasta que HOS-2266 a HOS-2269 estén en `staging` y probados.
- R-2. Avisos sin tope: un local premium puede disparar muchos avisos. No hay límite de
  esta clave; el rate-limit queda a cargo de HOS-2267 y HOS-2268 (pregunta 1).
- R-3. Mismo riesgo de versiones reales que HOS-2280 (R-1 de ese issue).

## 12. Preguntas abiertas para el owner

1. **Tope de avisos.** Opciones: (a) sin tope, solo la clave (la decisión actual);
   (b) un límite mensual de avisos para pro. Recomendación: (a) y medir; si aparece abuso,
   se agrega un límite con el mismo patrón (clave nueva más grant).
2. **Decidido (owner, 16/11/2026): trial.** Recibe la clave por la regla de mayor rank y
   muestra el aviso «Incluido en Pro y Premium. El plan Básico no lo tiene». No se
   bloquea.

Consultas de solo lectura: C-1 a C-5 de HOS-2280, cambiando `in (...)` de C-3 por
`venue_event_notifications`.

## 13. Dependencias

- HOS-2259 (clave), pasada final de HOS-1352 y HOS-2066 (orden de la épica post-MVP).
- HOS-2266, HOS-2267, HOS-2268, HOS-2269 construidas y en `staging` antes de habilitar.
- Misma tabla `ADDITIVE_GRANTS_AFTER_0144` que HOS-2280 (coordinar el orden de merge).

## 14. Labels de smoke y Novedades

- `status-needs-smoke-staging`. Smoke: seguir un local, tocar «Avisame», y recibir
  recordatorio, aviso de evento nuevo y aviso de cambio (los tres con correo real a una
  casilla de prueba), con el local en plan pro y la migración aplicada. Checklist
  `docs/billing/smoke-checklist.md`, staging.
- What's New: sí (la agrupa HOS-2284).

## 15. Desglose de tareas

1. Consultas de solo lectura y confirmación de versiones (0,25 día).
2. `catalog.ts` y tabla de grants post-0144 (0,25 día).
3. Migración SQL + data-migration de seed + tests (0,5 día).
4. Smoke de staging y firma (0,5 día).

## 16. Linear

Canonical tracking:
HOS-2281
