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
alojamiento.

Decidido (owner, 16/11/2026): pack **mensual** y **no apilable** (si hace falta más, se crea
un pack más grande; la variante por temporada se evalúa cuando se resuelva HOS-2179). Precio
**provisorio** $5.000/mes, a revisar con el owner antes de crear el producto en producción.
Se crea desde el admin existente, con runbook (HOS-2285, 6.2).

Comparte la venta con `.specs/HOS-2285-comer-y-salir-addon-pack-eventos/spec.md`
(secciones 5 y 6.1 a 6.3, 6.5 y 6.6). La **elegibilidad** (capacidad base, ya-otorgado,
`ADDON_NOT_ELIGIBLE`) la define **HOS-2292**, de la que este add-on depende.
Bloqueado: no se mergea antes de la pasada final de HOS-1352; va después de HOS-2282.

## 2. Problema

Un local pro con promos de varios días (almuerzo, happy hour, fin de semana) puede
necesitar más de 5 a la vez. Sin pack, la única salida es premium.

## 3. Alcance

- Un add-on `max_active_promotions = +3` solo para venue.
- Compra desde el editor de promos y desde complementos.
- Declaración de lo que necesita de la elegibilidad (HOS-2292): capacidad base
  `create_promotions`; no se ofrece con tope ilimitado.
- Creación desde el admin con runbook, sin código ni migración.
- Textos es/en/pt.

## 4. Fuera de alcance

- Las promos de venue, el editor y el happy hour (HOS-2270 a HOS-2272).
- El pack de alojamiento (no existe; ver 5).
- El mecanismo de elegibilidad (HOS-2292).
- Variante por temporada (se evalúa cuando se resuelva HOS-2179).

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
- Modelo y venta: HOS-2285 sección 5. Sin elegibilidad hoy (HOS-2292).
- HOS-2270 pasa `owner_promotions` a `entity_type` + `entity_id`; el aislamiento de arriba no
  cambia porque el tope se mide por vertical del título, no por la columna de la promo.
  Verificarlo al implementar.

## 6. Diseño propuesto

### 6.1 Add-on

| Campo | Valor |
|---|---|
| slug | `extra-venue-promotions-3` |
| versión | `WHILE_SUBSCRIPTION_ALIVE`, `VERTICAL_SUBSCRIPTION`, `entitlements: []`, `limits: [{ key: 'max_active_promotions', value: 3 }]` |
| producto | `PERIODICO` mensual (patrón `extra-venues-1`), precio provisorio $5.000/mes (a revisar con el owner antes de producción); `compatibleVerticals: ['venue']` |

No apilable: el índice `uq_addon_instance_purchase_identity` ya limita a una instancia viva
por `(owner, producto, destino)`.

### 6.2 Elegibilidad (HOS-2292)

El mecanismo lo define HOS-2292. Este add-on necesita: capacidad base `create_promotions`
(excluye básico); no ofrecer con `max_active_promotions` ya ilimitado (excluye premium); sin
regla de rubro (las promos sirven a todo rubro).

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

Sin esquema ni migración. Filas creadas desde el admin: 1 `addon`, 1 `addon_version`,
1 `addon_version_limit`, 1 `addon_product`. Contratos de elegibilidad: HOS-2292.

## 8. UX / UI

- Complementos: «Pack de promos extra (+3)» solo para dueños de venue pro.
- Editor de promos: panel de tope con botón de compra, sin nombres de plan.

## 9. Criterios de aceptación

1. Dado un dueño pro de venue con 5 promos activas, cuando compra el pack, entonces puede
   tener 8 (dentro de los 15 minutos de acreditado el pago).
2. Dado un dueño premium o básico, no se ofrece y la compra se rechaza (409
   `ADDON_NOT_ELIGIBLE`, regla de HOS-2292).
3. Dado un dueño con alojamiento y venue pro, cuando compra el pack, entonces su tope de
   promos de alojamiento no cambia.
4. Dado un intento de apuntar la compra a una suscripción de alojamiento, entonces 404
   `ADDON_TARGET_NOT_FOUND` (el producto es de venue).
5. Dado el vencimiento, el tope vuelve a 5; las promos activas siguen; no se crean nuevas
   por encima del tope.
6. Dado un dueño con el pack activo, cuando intenta comprarlo otra vez, entonces recibe
   `ADDON_ALREADY_ACTIVE` (no apilable).
7. G1, G2, G7, G14 pasan; no hay precio en el código.
8. El producto de producción se crea solo tras la revisión del precio con el owner.

## 10. Plan de tests

- Los tests de elegibilidad (derivación, contrato, ofertas, rechazo) viven en HOS-2292.
- `apps/api/test/integration/billing-addon/*`: venue pro con el pack suma 3; alojamiento no.
- `apps/api/test/routes/owner-promotion/protected/create.test.ts`: sin cambios (regresión).
- Smoke de staging.

## 11. Riesgos

- R-1. Confundir el vertical al mostrar la oferta (clave compartida). Mitigación: la
  oferta se decide con el contexto del vertical.
- R-2. Depende de la elegibilidad de HOS-2292; add-on creado desde admin no reproducible en
  bases nuevas (mitigación: runbook).
- R-3. No apilable: +3 como máximo; si hace falta más, otro pack más grande.
- R-4. Precio provisorio: no crear el producto en producción sin revisión del owner.

## 12. Preguntas abiertas y decisiones

Decidido (owner, 16/11/2026):

1. **Precio y ciclo.** Mensual periódico, no apilable, $5.000/mes provisorio a revisar con el
   owner antes de producción; la variante por temporada se evalúa con HOS-2179.
2. **¿Se ofrece a básico?** No: básico no tiene promos y la regla de capacidad base
   (HOS-2292) lo excluye sola.

Sin preguntas abiertas propias.

## 13. Dependencias

- HOS-2259, HOS-2282 (grants de promos), HOS-2270 a HOS-2272 (promos de venue),
  **HOS-2292** (elegibilidad de add-ons, prerrequisito), pasada final de HOS-1352, HOS-2066.

## 14. Labels de smoke y Novedades

- `status-needs-smoke-staging` (compra real con MercadoPago sandbox).
- What's New: sí, con HOS-2284.

## 15. Desglose de tareas

1. Crear el add-on en el admin de staging siguiendo el runbook de HOS-2285 (0,25 día).
2. Panel de tope en el editor de promos y enlace por vertical (0,5 día).
3. Textos es/en/pt (0,25 día).
4. Tests de aislamiento, compra y no apilado (0,5 día).
5. Smoke de staging y firma (0,5 día).
6. Revisión del precio provisorio con el owner y creación en producción (0,25 día).

## 16. Linear

Canonical tracking:
HOS-2287
