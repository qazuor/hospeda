---
title: Add-on de Comer y salir. Pack de +3 promos activas
linear: HOS-2287
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

# Add-on de Comer y salir. Pack de +3 promos activas

## 1. Resumen

Un add-on de venue que suma **3 promos activas** al tope del plan (pro tiene 5). Otorga
`max_active_promotions = 3` y se suma al plan (`SUM`). Se compra desde la sección de promos
cuando el local llega al tope. Que el producto sea de venue no debe afectar las promos de
alojamiento. Precio y ciclo los define el owner.

Comparte creación, venta y elegibilidad con
`.specs/HOS-2285-comer-y-salir-addon-pack-eventos/spec.md` (secciones 5 y 6.1 a 6.6).
Bloqueado: no se mergea antes de la pasada final de HOS-1352; va después de HOS-2282.

## 2. Problema

Un local pro con promos de varios días (almuerzo, happy hour, fin de semana) puede
necesitar más de 5 a la vez. Sin pack, la única salida es premium.

## 3. Alcance

- Un add-on `max_active_promotions = +3` solo para venue.
- Compra desde el editor de promos y desde complementos.
- Elegibilidad: capacidad base `create_promotions`; no se ofrece con tope ilimitado.
- Textos es/en/pt.

## 4. Fuera de alcance

- Las promos de venue, el editor y el happy hour (HOS-2270 a HOS-2272).
- El pack de alojamiento (no existe; ver 5).
- Precio y ciclo.

## 5. Estado actual verificado (`origin/staging`)

- `max_active_promotions` existe (`limit-keys.ts:18`, `SUM`, enforcement `ARCHIVE`, scope
  `vertical`). Hoy no hay add-on de promos de alojamiento: el catálogo de producción tiene
  `extra-accommodations-5`, `extra-photos-20`, `extra-venues-1`, `extra-experiences-1` y
  los `visibility-boost-*` (`commercial-catalog.ts`).
- **Aislamiento de alojamiento.** Un add-on con scope `VERTICAL_SUBSCRIPTION` solo emite su
  fuente en el vertical de la suscripción destino
  (`addon-coverage-verticals.ts:16-25`), y el producto con
  `compatibleVerticals ['venue']` solo puede apuntar a una suscripción de venue
  (`purchase-addon-eligibility.ts:75-91`: `compatibleVerticals.includes(target.vertical)`).
  El set efectivo se pliega por `user + vertical` (`resolve-effective-set.ts`,
  `scope.ts`) y la ruta de alojamiento pide siempre `VerticalEnum.ACCOMMODATION`
  (`apps/api/src/routes/owner-promotion/protected/create.ts:42-47`). Conclusión: las promos
  de alojamiento no cambian. **Nunca** usar scope `USER` o `GLOBAL` para este add-on: esos
  emiten en todos los verticales compatibles (`addon-coverage-verticals.ts:14-15`).
- Valores del plan: pro 5 y premium sin tope (HOS-2282). Con el add-on: pro 8; premium
  `2147483647 + 3` (no se persiste; clamp de HOS-2259 6.5).
- El add-on es complemento: solo rinde con título pagante vivo y no en trial
  (`plegable.ts`).
- Modelo y venta: HOS-2285 sección 5. Sin elegibilidad hoy.

## 6. Diseño propuesto

### 6.1 Add-on

| Campo | Valor propuesto |
|---|---|
| slug | `extra-venue-promotions-3` |
| versión | `WHILE_SUBSCRIPTION_ALIVE`, `VERTICAL_SUBSCRIPTION`, `entitlements: []`, `limits: [{ key: 'max_active_promotions', value: 3 }]` |
| producto | `PERIODICO` mensual (patrón `extra-venues-1`), precio del owner; `compatibleVerticals: ['venue']` |

### 6.2 Elegibilidad

Mecanismo de HOS-2285 6.4: capacidad base `create_promotions` (excluye básico); no se
ofrece con `max_active_promotions` ya ilimitado (excluye premium); sin regla de rubro
(las promos sirven a todo rubro).

### 6.3 Comprar desde la sección de promos

La ruta de crear promo de venue (HOS-2270) responde `LIMIT_REACHED` con
`limitKey = 'max_active_promotions'` y vertical venue. El editor (HOS-2271) muestra
«Sumá +3 promos activas» con enlace a `complementos/?product=extra-venue-promotions-3`.
Como la clave es compartida con alojamiento, el enlace **debe decidirse por vertical**: el
panel de alojamiento no ofrece este producto (G1: el vertical llega del contexto de la
ruta, sin `=== 'venue'` en código compartido).

### 6.4 Al vencer

El tope vuelve al del plan. Las promos confirmadas se respetan «como en alojamiento»
(decisión 6): las que están activas siguen hasta su fecha de fin; no se pueden crear
nuevas mientras se supere el tope. No se borra nada.

## 7. Modelo de datos / contratos

Mismas piezas que HOS-2285 (sección 7). Filas: 1 `addon`, 1 `addon_version`,
1 `addon_version_limit`, 1 `addon_product`. Sin esquema nuevo.

## 8. UX / UI

- Complementos: «Pack de promos extra (+3)» solo para dueños de venue pro.
- Editor de promos: panel de tope con botón de compra, sin nombres de plan.

## 9. Criterios de aceptación

1. Dado un dueño pro de venue con 5 promos activas, cuando compra el pack, entonces puede
   tener 8 (dentro de los 15 minutos de acreditado el pago).
2. Dado un dueño premium o básico, no se ofrece y la compra se rechaza (409
   `ADDON_NOT_ELIGIBLE`).
3. Dado un dueño con alojamiento y venue pro, cuando compra el pack, entonces su tope de
   promos de alojamiento no cambia.
4. Dado un intento de apuntar la compra a una suscripción de alojamiento, entonces 404
   `ADDON_TARGET_NOT_FOUND` (el producto es de venue).
5. Dado el vencimiento, el tope vuelve a 5; las promos activas siguen; no se crean nuevas
   por encima del tope.
6. G1, G2, G7, G14 pasan.

## 10. Plan de tests

- Los de HOS-2285 sección 10 (derivación, contrato, ofertas, rechazo).
- `apps/api/test/integration/billing-addon/*`: venue pro con el pack suma 3; alojamiento no.
- `apps/api/test/routes/owner-promotion/protected/create.test.ts`: sin cambios (regresión).
- Smoke de staging.

## 11. Riesgos

- R-1. Confundir el vertical al mostrar la oferta (clave compartida). Mitigación: la
  oferta se decide con el contexto del vertical.
- R-2. Mismo riesgo de elegibilidad grande (HOS-2285 R-1) y de add-on no reproducible.
- R-3. Un pack por suscripción: +3 como máximo.

## 12. Preguntas abiertas para el owner

1. **Precio y ciclo.** Opciones: (a) mensual periódico; (b) por temporada. Recomendación:
   (a).
2. **¿Tiene sentido ofrecerlo a básico?** Básico no tiene promos (decisión 5). Opciones:
   (a) no; (b) sí, +3 le daría 3 promos sin `create_promotions`: no funciona.
   Recomendación: (a), la regla de capacidad base lo excluye sola.

## 13. Dependencias

- HOS-2259, HOS-2282 (grants de promos), HOS-2270 a HOS-2272 (promos de venue),
  mecanismo de elegibilidad de HOS-2285, pasada final de HOS-1352, HOS-2066.

## 14. Labels de smoke y Novedades

- `status-needs-smoke-staging` (compra real con MercadoPago sandbox).
- What's New: sí, con HOS-2284.

## 15. Desglose de tareas

1. Crear el add-on en admin de staging y runbook (0,25 día).
2. Panel de tope en el editor de promos y enlace por vertical (0,5 día).
3. Textos es/en/pt (0,25 día).
4. Tests de aislamiento y compra (0,5 día).
5. Smoke de staging y firma (0,5 día).

## 16. Linear

Canonical tracking:
HOS-2287
