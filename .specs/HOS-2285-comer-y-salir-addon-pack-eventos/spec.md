---
title: Add-on de Comer y salir. Pack de +5 eventos activos
linear: HOS-2285
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

# Add-on de Comer y salir. Pack de +5 eventos activos

## 1. Resumen

Un add-on de venue que suma **5 eventos activos** al tope del plan (por ejemplo, un local
pro que en temporada alta necesita más de 10). Otorga `max_venue_active_events = 5` y se
suma al plan porque la clave agrega con `SUM` (HOS-2253, decisión 7). Se compra desde el
editor de eventos cuando el local llega al tope y desde la página de add-ons.

Decidido (owner, 16/11/2026): es un pack **mensual** (`PERIODICO`) y **no apilable**. Si un
local necesita más, se crea un pack más grande; la variante por temporada se evalúa cuando
se resuelva HOS-2179. Precio **provisorio**: $5.000/mes, a revisar con el owner antes de
crear el producto en producción (ninguno va en el código, G7). Se crea desde el admin que ya
existe, con un runbook.

**A quién se ofrece** (capacidad base, rubro, ya-otorgado, motivo de rechazo
`ADDON_NOT_ELIGIBLE`) lo define **HOS-2292** (elegibilidad de add-ons, extraída de la
sección 6.4 de este spec). HOS-2285 depende de ese issue y solo declara qué necesita (6.4).

Bloqueado: toca el catálogo de add-ons, así que no se mergea antes de la pasada final de
HOS-1352. Va después de HOS-2280 (grants de eventos).

## 2. Problema

El tope de eventos de pro es 10 (decisión 1). Un local de nocturnidad o gastronomía con
temporada alta supera ese número; hoy la única salida es pasar a premium. Un pack chico
permite vender más sin vaciar premium.

## 3. Alcance

- Un add-on (`addon` + `addon_version` + `addon_product`) con `max_venue_active_events = 5`.
- Compra desde la página de complementos y desde el editor de eventos al llegar al tope.
- Declaración de lo que este add-on necesita de la elegibilidad (6.4); el mecanismo vive en
  HOS-2292.
- Comportamiento al vencer: regla de baja de plan, sin borrar nada.
- Textos es/en/pt del add-on.

## 4. Fuera de alcance

- El mecanismo de elegibilidad (HOS-2292).
- Cambios de código para crear el add-on: se crea desde el admin existente, con runbook.
- El tope de eventos y su gate (HOS-2263).
- Packs de otras claves (HOS-2286, HOS-2287, HOS-2289).
- Apilar el mismo pack: decidido que no se apila; si hace falta más se crea un pack más
  grande (otro producto), fuera de este alcance. Variante por temporada: se evalúa cuando se
  resuelva HOS-2179.

## 5. Estado actual verificado (`origin/staging`, 92994b9dc6)

### 5.1 Modelo de add-ons

- `addon` (identidad, mutable), `addon_version` (inmutable: validez, scope), y sus hijos
  `addon_version_entitlement` y `addon_version_limit` (valor int4, check `>= 0`)
  (`packages/db/src/schemas/vertical/addon-catalog.dbschema.ts:35-135`). Validez:
  `FIXED_DAYS` o `WHILE_SUBSCRIPTION_ALIVE`; scope: `LISTING`, `VERTICAL_SUBSCRIPTION`,
  `USER`, `GLOBAL`.
- `addon_product` (precio int4 > 0 en centavos, ARS, `charge_kind` `UNA_VEZ`|`PERIODICO`,
  `cycle`, `compatible_verticals`, `retired_at`)
  (`addon-product.dbschema.ts:35-80`). Un producto periódico exige `WHILE_SUBSCRIPTION_ALIVE`
  (`addon-product-creation.service.ts`: `ADDON_VERSION_INCOMPATIBLE_WITH_CHARGE_KIND`).
- Add-ons de venue existentes en el catálogo de producción
  (`scripts/production-catalog/commercial-catalog.ts`): `extra-venues-1`
  (`limitPack`: `max_venues = 1`, `WHILE_SUBSCRIPTION_ALIVE`, `VERTICAL_SUBSCRIPTION`,
  `PERIODICO` mensual, `compatibleVerticals ['venue']`, $15.000) y
  `visibility-boost-venue-7d/30d` (`UNA_VEZ`, `FIXED_DAYS`, `LISTING`,
  `featured_listing`). El precio de un producto creado por el admin se carga en el formulario (ARS).

### 5.2 Cómo se crea y se vende un add-on nuevo

- **Admin UI ya existe** (HOS-1593 / HOS-1595): `apps/admin/src/features/billing-addon-catalog`
  (`CreateAddonDialog.tsx`, `AddonVersionForm.tsx`) y las rutas
  `POST /api/v1/admin/addon-catalog/addons`, `.../addons/{addonId}/versions` y
  `POST /api/v1/admin/billing-addon-products` (`routes/addon-catalog/admin/index.ts`,
  `routes/billing-addon-product/admin/product-creation.ts`), con permiso
  `BILLING_PUBLISH_ADDON_VERSION`. Crean el add-on con su primera versión (claves y
  límites validados por FK contra `catalog_key`) y luego el producto con precio. Los
  precios se cargan ahí y no en código. Seed 0175 publica el permiso.
- **Producto creado por el admin:** como los precios son provisorios, no se fija ninguno en
  `commercial-catalog.ts` ni se agrega migración (decisión del owner, 16/11/2026).
- **Venta:** `GET /api/v1/protected/billing/addons/offers` y
  `POST /api/v1/protected/billing/addons/purchases`
  (`routes/index.ts:538`; `AddonPurchaseRequestSchema`: `productId`, `targetId`,
  `orderRequestId`, `addonVersionId`). Página web
  `apps/web/src/pages/[lang]/mi-cuenta/complementos/index.astro` con
  `AddonPurchase.client.tsx` (el scope `VERTICAL_SUBSCRIPTION` pide elegir la suscripción
  destino). El cobro es MercadoPago (complemento periódico, `complement_subscription_id`).
- Textos: la web resuelve `billing.addon.<slug>.name|description` y cae en el nombre de la
  base (`apps/web/src/lib/billing/addon-purchase.ts:59-73`). El guard
  `scripts/__tests__/addon-catalog-i18n.guard.test.ts` exige es/en/pt solo para los slugs de
  `PRODUCTION_ADDON_CATALOG` (código): un add-on creado desde el admin no lo dispara, pero
  su texto tiene que vivir igual en `billing.json`.
- **No hay elegibilidad por plan ni por rubro hoy.** `readAddonOffers`
  (`apps/api/src/services/addon-offers/addon-offers.service.ts`) lista todo producto no
  retirado y `resolvePurchaseTitle` solo valida producto vivo, destino propio, vertical
  compatible y título pagante. El análisis y el diseño para cerrarlo están en HOS-2292.
- Un solo pack por producto: el índice `uq_addon_instance_purchase_identity` limita a una
  instancia pendiente o activa por `(owner, producto, destino)` (`addon-product.dbschema.ts`).

### 5.3 Cómo entra el add-on al set efectivo

`resolve-effective-set.ts:87-106`: una fuente `ADDON` aporta sus límites con su estrategia
(`SUM`). El add-on es **complemento**: `plegable.ts` solo lo pliega si hay un título vivo
que no sea trial. Por lo tanto: no se puede comprar ni rinde en trial
(`purchase-addon-eligibility.ts:19-47` exige principal pagante o ancla de grant), y suma
al plan cuando hay suscripción. `foldKey` suma con `reduce` (`fold.ts:91-100`).

### 5.4 Overflow int4

Premium `2147483647` + `5` supera int4 en memoria, pero el total no se persiste en
ninguna columna (HOS-2259 sección 6.5); el valor `5` del add-on cabe de sobra en
`addon_version_limit.value`.

## 6. Diseño propuesto

### 6.1 Add-on

| Campo | Valor |
|---|---|
| slug | `extra-venue-events-5` |
| versión | `WHILE_SUBSCRIPTION_ALIVE`, scope `VERTICAL_SUBSCRIPTION`, `entitlements: []`, `limits: [{ key: 'max_venue_active_events', value: 5 }]` |
| producto | `PERIODICO` mensual (patrón `extra-venues-1`), precio provisorio $5.000/mes, `compatibleVerticals: ['venue']` |

Decidido (owner, 16/11/2026): mensual y no apilable. El índice
`uq_addon_instance_purchase_identity` ya limita a una instancia viva por
`(owner, producto, destino)`, así que no hace falta código. Para más cupo se crea un pack
más grande como producto aparte. La variante por temporada (`UNA_VEZ` + `FIXED_DAYS`, sin
precedente con scope `VERTICAL_SUBSCRIPTION`) se evalúa cuando se resuelva HOS-2179.

### 6.2 Crear el add-on

Decidido (owner, 16/11/2026): desde el **admin que ya existe** (sección 5.2), sin
migración ni código nuevo. Pasos: crear add-on + versión, crear el producto con el precio, y
dejar el runbook en `docs/billing/`. Antes de crear el producto en producción, el precio
provisorio se **revisa con el owner**; en staging se puede crear con el valor provisorio.
El runbook incluye el orden (crear en staging, smoke, recién después producción) y cómo
retirar el producto (`retired_at`) si hay que corregir el precio.

### 6.3 Textos

`billing.addon.extra-venue-events-5.{name,description}` en es/en/pt, p. ej. «Pack de eventos
extra (+5)». La descripción dice que se suma al tope del plan y qué pasa al vencer. Sin
precio en el texto (G7).

### 6.4 Elegibilidad (extraída a HOS-2292)

El mecanismo común de elegibilidad (reglas, derivación del catálogo, método nuevo en el
contrato `billing-verticals-contract`, rechazo `NOT_ELIGIBLE` / `ADDON_NOT_ELIGIBLE` 409,
filtro de ofertas) se diseña y se implementa en **HOS-2292**, que pasa a ser prerrequisito
de HOS-2285, HOS-2286, HOS-2287 y HOS-2289. Acá solo se declara lo que este add-on necesita:

- **Regla general (decidida por el owner, 18/11/2026, HOS-2252 ronda 1, #3):** un complemento se ofrece **cuando el plan ya tiene la capacidad base, nunca por el nombre del plan.**
- Capacidad base: el plan debe otorgar `manage_venue_events`. **El plan Básico sí califica**: tiene 1 evento base y con el pack llega a 6.
- No se ofrece cuando `max_venue_active_events` ya es «sin tope» (premium).
- Sin regla de rubro (los eventos sirven a todo rubro de venue).
- La oferta debe poder identificarse por la clave que otorga (`max_venue_active_events`),
  para el enlace desde el editor; HOS-2292 expone esas claves en `addonPolicy`.
- El rechazo del servidor es el control; el filtro de ofertas es cortesía.

### 6.5 Comprar desde el editor de eventos

Cuando `PUT /api/v1/protected/venues/:id/events` devuelve `LIMIT_REACHED` con
`details.limitKey = 'max_venue_active_events'` (la ruta de HOS-2263), el editor
(`VenueEventsManager.client.tsx`) muestra un llamado a comprar el pack. Hace falta que la
oferta se identifique por la clave que otorga (por eso `addonPolicy` expone las claves) y
que la página de complementos acepte preseleccionar un producto: hoy
`complementos/index.astro` solo lee `?listing=` y `returnOrderRequestId`; se le suma
`?product=<slug>` (preselección, solo cliente). El destino por defecto es la suscripción
de venue del dueño. La página sigue sin ser cacheable por sesión (es de `mi-cuenta`).

### 6.6 Al vencer o cancelar

Como el pack es mensual, vence al no renovarse. La instancia pasa a `EXPIRED`/`CANCELLED`, billing emite `coverage-changed`, el set
efectivo se invalida y `max_venue_active_events` baja de 15 a 10. La regla de baja
de plan (HOS-2253, decisión 6) se aplica sin borrar nada: los eventos únicos siguen
visibles hasta su fecha, los semanales pasan a borrador y vuelven si el local vuelve a
tener cupo, y no se pueden cargar nuevos mientras se supere el tope. Esa lógica vive en
HOS-2263 y **debe leer el límite efectivo en vivo**, no un valor cacheado del plan, para
que el add-on y el plan se traten igual.

## 7. Modelo de datos / contratos

- Sin columnas nuevas ni migración. Filas creadas desde el admin: 1 `addon`,
  1 `addon_version`, 1 `addon_version_limit`, 1 `addon_product`.
- Contrato y API de elegibilidad (`addonEligibility`, `entitlementKeys` / `limitKeys` en
  `addonPolicy`, `ADDON_NOT_ELIGIBLE`, campo en `AddonOfferSchema`): los define HOS-2292.
- Carril de migración: ninguno.

## 8. UX / UI

- Página de complementos: la oferta aparece solo para quien califica, con nombre
  «Pack de eventos extra (+5)» y qué otorga (+5 eventos activos).
- Editor de eventos: al llegar al tope, un panel «Llegaste al tope de eventos» con botón
  «Sumar +5 eventos» que lleva a la página de complementos con el producto preseleccionado.
  El texto no nombra planes (guard de upsell de editores de venue).
- En móvil el panel ocupa el ancho completo; sin scroll horizontal.

## 9. Criterios de aceptación

1. Dado el add-on creado y vendible, cuando un dueño pro con 10 eventos activos lo compra y
   el pago se acredita, entonces su tope efectivo pasa a 15 dentro de los 15 minutos.
2. Dado un dueño premium (tope sin límite), cuando consulta las ofertas, entonces el pack
   no aparece; si intenta comprarlo, recibe 409 `ADDON_NOT_ELIGIBLE` (regla de HOS-2292).
3. Dado un dueño sin `manage_venue_events` (p. ej. un plan sin eventos), entonces no ve la
   oferta y la compra se rechaza igual (regla de HOS-2292).
3b. Dado un dueño del plan **Básico** (con `manage_venue_events` y 1 evento), entonces **sí** ve la oferta y puede comprarla; con el pack su tope efectivo es 6 (decidido el 18/11/2026). La regla no nombra ningún plan.
4. Dado un dueño en trial, entonces no puede comprarlo (`NO_VALID_TITLE`).
5. Dado un dueño pro que llega al tope en el editor, cuando toca «Sumar +5 eventos»,
   entonces llega a la página de complementos con el pack preseleccionado.
6. Dado el vencimiento del add-on, cuando el tope baja de 15 a 10 con 12 eventos activos,
   entonces no se borra nada, los semanales pasan a borrador y no se pueden crear nuevos
   (regla de HOS-2263).
7. Dado el usuario que ya tiene el pack activo para esa suscripción, cuando intenta comprar
   otro igual, entonces recibe `ADDON_ALREADY_ACTIVE` (no apilable).
8. G1, G2, G14, G7 y `check-role-never-decides` pasan; no hay precio en el código.
9. Un add-on de venue no cambia nada de alojamiento (`compatibleVerticals ['venue']`).
10. El producto de producción se crea solo después de que el owner confirmó el precio
    (provisorio $5.000/mes) y el runbook queda en `docs/billing/`.

## 10. Plan de tests

- Los tests de elegibilidad (derivación, contrato, rechazo `NOT_ELIGIBLE`, ofertas
  filtradas) viven en HOS-2292.
- `apps/api/test/integration/billing-addon/*`: compra del pack con venue pro suma 5 y la
  segunda compra da `ADDON_ALREADY_ACTIVE` (fixtures `addon-purchase-route-fixtures.ts`).
- `apps/web/test/components/billing/...`: preselección por `?product=` y panel del editor
  sin nombres de plan.
- Smoke de staging con MercadoPago sandbox (compra real del complemento).

## 11. Riesgos

- R-1. La elegibilidad es una pieza grande; se aisló en HOS-2292 y este add-on queda
  bloqueado por ella.
- R-2. No apilable: un local que necesita +10 no tiene salida inmediata. Mitigación decidida:
  crear un pack más grande como producto aparte.
- R-3. El add-on creado desde el admin no es reproducible en una base nueva (staging
  recreado pierde el catálogo). Mitigación: runbook (decisión del owner, 16/11/2026).
- R-4. Precio provisorio: crear el producto en producción sin la revisión del owner. El
  runbook lo exige como paso previo.
- R-5. Cobro real: cualquier cambio de billing exige el smoke de staging
  (`docs/billing/smoke-checklist.md`) con MercadoPago sandbox.

## 12. Preguntas abiertas y decisiones

Decidido (owner, 16/11/2026):

1. **Dónde vive la elegibilidad.** Se extrajo como issue propio: HOS-2292. Este spec solo
   la declara (6.4).
2. **Cómo se crea el add-on.** Desde el admin que ya existe, con runbook; sin migración
   (6.2).
3. **Precio y ciclo.** Mensual, no apilable, precio provisorio $5.000/mes a revisar con el
   owner antes de crear el producto en producción. La variante por temporada se evalúa
   cuando se resuelva HOS-2179.

**Decidido (owner, 18/11/2026, HOS-2252 ronda 1, #3): ¿puede comprarlo un plan básico? Sí.** Básico tiene 1 evento de fecha única; +5 daría 6. La regla de capacidad base alcanza y no se introduce una regla por nombre de plan. Con esto HOS-2292 puede pasar a `kind-spec`, con el diseño de 6.4 de esta spec.

**Precio (decidido el 18/11/2026, ronda 1, #6):** sigue provisorio y se confirma antes de crear el producto en producción.

## 13. Dependencias

- **HOS-2292** (elegibilidad de add-ons): prerrequisito.
- HOS-2259 (clave `max_venue_active_events`), HOS-2280 (grants de eventos),
  HOS-2263 (tope y regla de baja), pasada final de HOS-1352 y HOS-2066.
- Orden de la épica: después de HOS-2280 y de HOS-2292.

## 14. Labels de smoke y Novedades

- `status-needs-smoke-staging` (cobro real: MercadoPago sandbox, parte staging del
  checklist) y, por ser un producto cobrable nuevo, el owner decide si agrega
  `status-needs-smoke-prod` (la épica de billing lo reserva para el CORE; este add-on no
  toca checkout ni webhooks, así que no debería).
- What's New: sí, junto con HOS-2284 (presentación y Novedades).

## 15. Desglose de tareas

(La elegibilidad común se estima en HOS-2292.)

1. Web: preselección `?product=` y panel de tope en el editor de eventos (1 día).
2. Textos es/en/pt del add-on (0,25 día).
3. Runbook en `docs/billing/` y creación del add-on en el admin de staging con el precio
   provisorio (0,5 día).
4. Smoke de staging con MercadoPago sandbox y firma (1 día).
5. Revisión del precio con el owner y creación del producto en producción (0,25 día,
   después del smoke).

## 16. Linear

Canonical tracking:
HOS-2285
