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
editor de eventos cuando el local llega al tope y desde la página de add-ons. Precio y
ciclo los define el owner; ninguno va en el código (G7).

Este spec también describe el **mecanismo común de elegibilidad de add-ons** (sección 6.4)
que necesitan HOS-2286, HOS-2287 y HOS-2289. Se propone sacarlo como issue propio; ver
pregunta 1.

Bloqueado: toca el catálogo de add-ons, así que no se mergea antes de la pasada final de
HOS-1352. Va después de HOS-2280 (grants de eventos).

## 2. Problema

El tope de eventos de pro es 10 (decisión 1). Un local de nocturnidad o gastronomía con
temporada alta supera ese número; hoy la única salida es pasar a premium. Un pack chico
permite vender más sin vaciar premium.

## 3. Alcance

- Un add-on (`addon` + `addon_version` + `addon_product`) con `max_venue_active_events = 5`.
- Compra desde la página de complementos y desde el editor de eventos al llegar al tope.
- Regla de a quién se ofrece (6.4).
- Comportamiento al vencer: regla de baja de plan, sin borrar nada.
- Textos es/en/pt del add-on.

## 4. Fuera de alcance

- Precio y ciclo (decisión del owner, pregunta 3).
- El tope de eventos y su gate (HOS-2263).
- Packs de otras claves (HOS-2286, HOS-2287, HOS-2289).
- Cantidades variables (+10, +20) y apilar el mismo pack varias veces (riesgo R-2).

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
  `featured_listing`). El precio se escribe en pesos y se convierte a centavos con `ars()`.

### 5.2 Cómo se crea y se vende un add-on nuevo

- **Admin UI ya existe** (HOS-1593 / HOS-1595): `apps/admin/src/features/billing-addon-catalog`
  (`CreateAddonDialog.tsx`, `AddonVersionForm.tsx`) y las rutas
  `POST /api/v1/admin/addon-catalog/addons`, `.../addons/{addonId}/versions` y
  `POST /api/v1/admin/billing-addon-products` (`routes/addon-catalog/admin/index.ts`,
  `routes/billing-addon-product/admin/product-creation.ts`), con permiso
  `BILLING_PUBLISH_ADDON_VERSION`. Crean el add-on con su primera versión (claves y
  límites validados por FK contra `catalog_key`) y luego el producto con precio. Los
  precios se cargan ahí y no en código. Seed 0175 publica el permiso.
- **Migración (alternativa):** `commercial-catalog.ts` + generador (`addon`, `addon_version`,
  `addon_version_limit`, `addon_product` son 4 de las 12 cargas de G18) como hizo 0176.
  El test `scripts/__tests__/production-catalog-commercial.test.ts:100` fija la lista de
  10 add-ons y debería actualizarse.
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
- **No hay elegibilidad por plan ni por rubro.** `readAddonOffers`
  (`apps/api/src/services/addon-offers/addon-offers.service.ts`) lista todo producto no
  retirado y expone `compatibleVerticals`, sin ver al dueño más que para opciones gratis.
  `resolvePurchaseTitle` (`packages/service-core/.../purchase-addon-eligibility.ts`) solo
  valida producto vivo, destino propio, vertical compatible y título pagante. Los
  motivos de rechazo son 7 cerrados (`purchase-addon-types.ts`, `PURCHASE_ADDON_REFUSAL_REASONS`).
  `addonPolicy` del contrato (`inverse.schema.ts:82-118`) no expone las claves que otorga.
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

| Campo | Valor propuesto |
|---|---|
| slug | `extra-venue-events-5` |
| versión | `WHILE_SUBSCRIPTION_ALIVE`, scope `VERTICAL_SUBSCRIPTION`, `entitlements: []`, `limits: [{ key: 'max_venue_active_events', value: 5 }]` |
| producto | `PERIODICO`, ciclo y precio: los define el owner; `compatibleVerticals: ['venue']` |

«Por temporada» pide `UNA_VEZ` + `FIXED_DAYS` (p. ej. 90 días) con scope
`VERTICAL_SUBSCRIPTION`. Esa combinación no está probada en producción (los únicos
`UNA_VEZ` hoy son `LISTING`); verificarla de punta a punta antes de ofrecerla
(pregunta 3).

### 6.2 Crear el add-on

Recomendado: desde el **admin** (sin migración), porque el owner define el precio y el
ciclo y no hay que redeployar para ajustarlos. Pasos de la tarea: crear add-on + versión,
crear el producto, y dejar el runbook en `docs/billing/`. Alternativa: sumarlo a
`commercial-catalog.ts` con migración nueva (reproducible en bases nuevas, pero fija un
precio en un archivo versionado y exige actualizar `production-catalog-commercial.test.ts`
y el guard i18n). Ver pregunta 2.

### 6.3 Textos

`billing.addon.extra-venue-events-5.{name,description}` en es/en/pt, p. ej. «Pack de eventos
extra (+5)». La descripción dice que se suma al tope del plan y qué pasa al vencer. Sin
precio en el texto (G7).

### 6.4 Mecanismo de elegibilidad (compartido con HOS-2286, HOS-2287 y HOS-2289)

Necesidad: ofrecer y vender el add-on solo a quien le sirve. Reglas:

1. **Capacidad base:** el add-on de un límite solo se ofrece si el plan otorga la
   entitlement que gobierna ese límite (events: `manage_venue_events`; promos:
   `create_promotions`; lista: `venue_guest_list`). Un pack de eventos en un plan sin
   eventos no sirve.
2. **No ofrecer lo que ya está al máximo:** un add-on de límite no se ofrece cuando el valor
   efectivo ya es «sin tope» (`>= 2147483647`); un add-on de entitlement no se ofrece
   cuando el set efectivo ya la tiene (HOS-2289, premium).
3. **Rubro:** si la clave pertenece a una sección o trait de `LISTING_SECTIONS` poseída por
   un rubro (`BUSINESS_LINES.venue[].sections`), el add-on solo se ofrece a dueños con
   al menos una ficha de ese rubro (lista de invitados: `nightlife`; carta en idiomas:
   `food`). Es el mismo mecanismo que marca «solo para locales con carta/noche» en la tabla
   (HOS-2262): no se escribe `vertical === 'venue'` ni un rubro literal fuera del catálogo
   (G1, G-FAC-03).

Implementación propuesta (opción A de la pregunta 1):

- `packages/schemas/src/catalog/`: archivo nuevo `addon-eligibility.ts` con el mapa
  declarativo `LIMIT_GOVERNING_ENTITLEMENT` (clave de límite → clave de entitlement) y la
  función pura `resolveKeyEligibilityRequirements({ vertical, keys })` →
  `{ governingEntitlements, businessLines }`, derivada de `LISTING_SECTIONS` y
  `BUSINESS_LINES` (que ya están en `@repo/schemas`). Solo nombres, sin valores.
- **Contrato** `@repo/billing-verticals-contract` (`interfaces.ts`, `inverse.schema.ts`,
  `validation.ts` y simuladores de `/testing`): sumar al inverso (lo que billing pregunta a
  verticals) `addonEligibility({ userId, vertical, addonVersionId })` →
  `{ eligible: true } | { eligible: false, reason: 'MISSING_BASE_CAPABILITY' | 'ALREADY_GRANTED' | 'NO_ELIGIBLE_LISTING' }`,
  y exponer en `addonPolicy` las claves que otorga la versión (necesarias para mostrar
  «+5 eventos» y para el enlace desde el editor). Billing sigue sin importar verticals
  (G14).
- `@repo/verticals`: implementa la pregunta leyendo el set efectivo (`readEffectiveSet`) y
  los rubros de las fichas del dueño por un puerto (`verticals` no importa `@repo/db` en
  `src`).
- Billing: `readAddonOffers` filtra o marca cada oferta por dueño;
  `resolvePurchaseTitle`/`purchase-addon.service.ts` rechaza con un motivo nuevo
  `NOT_ELIGIBLE` (se agrega a `PURCHASE_ADDON_REFUSAL_REASONS` y al `Record` exhaustivo
  `PURCHASE_REJECTION_ANSWERS`: 409, código `ADDON_NOT_ELIGIBLE`, más su texto en
  `billing.addonPurchaseApi.notEligible`, es/en/pt). Orden del contrato de errores:
  auth 401 → permiso 403 → forma 400 → existencia/propiedad 404 → reglas de negocio 409.
  La elegibilidad es regla de negocio (409), después de verificar que el producto y el
  destino existen y son del dueño.
- **Sin ejecución de rechazo no hay seguridad:** filtrar solo en la UI no protege; el
  rechazo del servidor es el control, el filtro de ofertas es cortesía.

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

La instancia pasa a `EXPIRED`/`CANCELLED`, billing emite `coverage-changed`, el set
efectivo se invalida y `max_venue_active_events` baja de 15 a 10. La regla de baja
de plan (HOS-2253, decisión 6) se aplica sin borrar nada: los eventos únicos siguen
visibles hasta su fecha, los semanales pasan a borrador y vuelven si el local vuelve a
tener cupo, y no se pueden cargar nuevos mientras se supere el tope. Esa lógica vive en
HOS-2263 y **debe leer el límite efectivo en vivo**, no un valor cacheado del plan, para
que el add-on y el plan se traten igual.

## 7. Modelo de datos / contratos

- Sin columnas nuevas. Filas: 1 `addon`, 1 `addon_version`, 1 `addon_version_limit`,
  1 `addon_product`.
- Contrato `billing-verticals-contract`: método nuevo `addonEligibility` y campos
  `entitlementKeys` / `limitKeys` en la respuesta de `addonPolicy`.
- API: motivo de rechazo `ADDON_NOT_ELIGIBLE` (409) y campo de elegibilidad en
  `AddonOfferSchema`.
- Carril de migración: ninguno si se crea desde el admin; estructural/versionada si se
  elige la migración.

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
   no aparece; si intenta comprarlo, recibe 409 `ADDON_NOT_ELIGIBLE`.
3. Dado un dueño sin `manage_venue_events` (p. ej. un plan sin eventos), entonces no ve la
   oferta y la compra se rechaza igual.
4. Dado un dueño en trial, entonces no puede comprarlo (`NO_VALID_TITLE`).
5. Dado un dueño pro que llega al tope en el editor, cuando toca «Sumar +5 eventos»,
   entonces llega a la página de complementos con el pack preseleccionado.
6. Dado el vencimiento del add-on, cuando el tope baja de 15 a 10 con 12 eventos activos,
   entonces no se borra nada, los semanales pasan a borrador y no se pueden crear nuevos
   (regla de HOS-2263).
7. Dado el usuario que ya tiene el pack activo para esa suscripción, cuando intenta comprar
   otro igual, entonces recibe `ADDON_ALREADY_ACTIVE`.
8. G1, G2, G14, G18 (si hay migración), G7 y `check-role-never-decides` pasan; un rol nunca
   decide la elegibilidad.
9. Un add-on de venue no cambia nada de alojamiento (`compatibleVerticals ['venue']`).

## 10. Plan de tests

- `packages/schemas/test/catalog/addon-eligibility.test.ts` (nuevo): derivación de
  rubro y entitlement base desde el catálogo.
- `packages/verticals/test/...addon-eligibility.test.ts` (nuevo) y el caso compartido en
  `/testing` del contrato (corre contra las dos implementaciones).
- `packages/service-core/test/services/billing/addon/purchase-addon*.test.ts`: rechazo
  `NOT_ELIGIBLE`; el `Record` exhaustivo obliga a mapear el motivo.
- `apps/api/test/integration/billing-addon/*`: ofertas filtradas y 409
  (fixtures `addon-purchase-route-fixtures.ts`).
- `apps/web/test/components/billing/...`: oferta, preselección por `?product=`, panel del
  editor sin nombres de plan.
- Smoke de staging con MercadoPago sandbox (compra real del complemento).

## 11. Riesgos

- R-1. La elegibilidad es una pieza grande (contrato + dos paquetes + API + web). No es
  trivial «crear un add-on»: ver pregunta 1.
- R-2. Un solo pack por producto y suscripción: si un local necesita +10 no hay forma. Se
  resuelve con otro producto (+10) o con cantidad, fuera de este alcance.
- R-3. Add-on creado en el admin no es reproducible en una base nueva (staging recreado
  pierde el catálogo). Mitigación: runbook y, si se prefiere, migración.
- R-4. `UNA_VEZ + FIXED_DAYS + VERTICAL_SUBSCRIPTION` («por temporada») sin precedente.
- R-5. Cobro real: cualquier cambio de billing exige el smoke de staging
  (`docs/billing/smoke-checklist.md`) con MercadoPago sandbox.

## 12. Preguntas abiertas para el owner

1. **Dónde vive la elegibilidad de los add-ons.** Opciones: (a) derivada del catálogo
   (secciones y rubros), con método nuevo en el contrato (6.4); (b) columnas nuevas en
   `addon_product` (`requires_entitlement`, `required_business_line`); (c) sin elegibilidad
   (se ofrece a todo dueño de venue). Recomendación: (a), mantiene una sola fuente
   (el mismo catálogo que ya marca el rubro en la tabla) y no toca esquema; (b) duplicaría
   el rubro; (c) vende packs que no se pueden usar. Proponemos que sea un issue propio
   que bloquee HOS-2286 y HOS-2289 y se haga antes de HOS-2285.
2. **Cómo se crea el add-on.** Opciones: (a) desde el admin (precio ajustable sin deploy,
   no reproducible); (b) migración con `commercial-catalog.ts` (reproducible, fija el
   precio en el repo). Recomendación: (a) para los cuatro add-ons de la épica, con runbook.
3. **Precio y ciclo** (decide el owner). Opciones: (a) mensual periódico (el patrón
   `extra-venues-1`); (b) por temporada (`UNA_VEZ` + 90 días), pide verificar el flujo;
   (c) ambos productos. Recomendación: (a) para arrancar, (b) en una segunda vuelta.
4. **¿Puede comprarlo un plan básico?** Básico tiene 1 evento de fecha única: +5 daría 6
   únicos. Opciones: (a) sí, es solo un límite; (b) no, solo pro (regla extra por plan).
   Recomendación: (a); la elegibilidad por capacidad base ya alcanza y no se introduce una
   regla por nombre de plan.

## 13. Dependencias

- HOS-2259 (clave `max_venue_active_events`), HOS-2280 (grants de eventos),
  HOS-2263 (tope y regla de baja), pasada final de HOS-1352 y HOS-2066.
- Mecanismo de elegibilidad (issue propio sugerido).
- Orden de la épica: después de HOS-2280.

## 14. Labels de smoke y Novedades

- `status-needs-smoke-staging` (cobro real: MercadoPago sandbox, parte staging del
  checklist) y, por ser un producto cobrable nuevo, el owner decide si agrega
  `status-needs-smoke-prod` (la épica de billing lo reserva para el CORE; este add-on no
  toca checkout ni webhooks, así que no debería).
- What's New: sí, junto con HOS-2284 (presentación y Novedades).

## 15. Desglose de tareas

1. Mecanismo de elegibilidad en `@repo/schemas` + tests (0,5 día).
2. Contrato: `addonEligibility`, claves en `addonPolicy`, simuladores y gate de validación (1 día).
3. Implementación en `@repo/verticals` con puertos (1 día).
4. Billing: filtro en ofertas, rechazo `NOT_ELIGIBLE`, mapeo HTTP y copy (1 día).
5. Web: preselección `?product=`, panel de tope en el editor de eventos (1 día).
6. Textos es/en/pt del add-on y de la elegibilidad (0,5 día).
7. Crear el add-on en admin de staging y runbook (0,5 día).
8. Smoke de staging con MercadoPago sandbox y firma (1 día).

## 16. Linear

Canonical tracking:
HOS-2285
