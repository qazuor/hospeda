---
title: Add-on de Comer y salir. Carta en idiomas para pro
linear: HOS-2289
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

# Add-on de Comer y salir. Carta en idiomas para pro

## 1. Resumen

Un add-on que le da a un local pro la **carta en idiomas** (en y pt) sin pasar a premium,
pensado para restaurantes de la región con muchos turistas brasileños. Otorga
`multilingual_venue_menu`, una clave que ya existe y hoy es solo de premium. Se ofrece
solo a locales con carta (rubro gastronomía) y no a quien ya la tiene por su plan.
Decisión del owner (16/11): fotos de platos y métricas del QR **no** se venden como
add-on, para no vaciar premium.

Decidido (owner, 16/11/2026): pack **mensual** (`PERIODICO`) y **no apilable** (es un
entitlement, no hay cantidad). Precio **provisorio** $9.000/mes, a revisar con el owner antes
de crear el producto en producción. Se crea desde el admin existente, con runbook
(HOS-2285, 6.2). La variante por temporada se evalúa cuando se resuelva HOS-2179.

Comparte la venta con `.specs/HOS-2285-comer-y-salir-addon-pack-eventos/spec.md`
(secciones 5 y 6.1 a 6.3, 6.5 y 6.6). La **elegibilidad** (capacidad base, rubro,
ya-otorgado, `ADDON_NOT_ELIGIBLE`) la define **HOS-2292**, de la que este add-on depende.

Orden: toca el catálogo de add-ons; no se mergea antes de la pasada final de HOS-1352.
Es el único add-on de la épica que no depende de claves nuevas ni de grants: puede ir
apenas esté listo HOS-2292.

## 2. Problema

Un restaurante pro que atiende turistas brasileños quiere su carta en portugués, pero la
clave es premium. Hoy tiene que pagar la diferencia entera por una sola función.

## 3. Alcance

- Un add-on con `multilingual_venue_menu` (entitlement, sin límite).
- Declaración de lo que necesita de la elegibilidad (HOS-2292): capacidad base
  `manage_venue_menu`, rubro gastronomía, y no ofrecer a quien ya tiene la clave.
- Creación desde el admin con runbook, sin código ni migración.
- Verificar (y cubrir con test) que la compuerta lee el set efectivo, no solo el plan.
- Textos es/en/pt.

## 4. Fuera de alcance

- Fotos de platos (`menu_item_photos`) y métricas del QR (`menu_qr_scan_metrics`): decisión
  del owner, no se venden.
- Cambiar la carta, la edición de traducciones o los idiomas disponibles.
- El mecanismo de elegibilidad (HOS-2292).
- Variante por temporada (se evalúa cuando se resuelva HOS-2179).

## 5. Estado actual verificado (`origin/staging`)

### 5.1 La clave y el gate

- `multilingual_venue_menu` está en el catálogo (`entitlement-keys.ts:38`, `vertical`, `MAX`,
  `NONE`, `COMMERCIAL`) y solo la otorga `venue-premium`
  (`scripts/production-catalog/catalog.ts:905`; `venue-pro`, línea 687, no la tiene).
- Es un **trait** `translations` de la sección `menu`
  (`packages/schemas/src/catalog/listing-sections.ts:82-95`), y la sección `menu` está
  poseída por el rubro `food` (`business-lines.ts:26-31`). Un trait hereda el estado de su
  sección: si la sección es `locked` o `absent`, el trait también
  (`resolve-listing-sections.ts`, tramo de traits). Por lo tanto la carta en idiomas exige
  **`manage_venue_menu`** (que tiene pro, no básico: `venue-basico` no la lista) además de
  la clave propia.
- **Escritura:** `PUT /api/v1/protected/venues/:id/menu`
  (`apps/api/src/routes/venue/protected/putMenu.ts:80-97`) declara
  `sectionTraits: ... ['translations']` cuando el cuerpo trae `nameI18n`/`descriptionI18n`.
  El pipeline `resolveListingAccess` suma la clave del trait al paso 6
  (`packages/verticals/src/authorization/resolve-listing-access.ts:205-245`) y la evalúa
  contra `effectiveSet`.
- **Lectura pública:** `projectVenueMenuTraits`
  (`apps/api/src/utils/public-listing-projector.ts:50-52`) conserva las traducciones solo si
  `menu.traits.get('translations') === 'available'`, estado que sale de
  `resolveListingSections({ effective })` con el set del dueño leído por
  `readOwnerEffectiveSets` (`public-listing-projector.ts:159-182`).
- **Conclusión de la verificación pedida en el issue:** los dos caminos (escritura y lectura
  pública) leen el **set efectivo** (`getListingAccessPorts().effectiveSet`, que es
  `readEffectiveSet` con `billing.coverage`, `apps/api/src/utils/listing-access/ports.ts:75-84`),
  no el plan directo. Una fuente `ADDON` entra al set (`resolve-effective-set.ts:87-106`),
  siempre que haya un título pagante vivo que no sea trial (`plegable.ts`). El add-on de
  entitlement aporta valor `+Infinity` en el pliegue, que con estrategia `MAX` equivale a
  «concedida». Falta el **test** que lo pruebe de punta a punta (sección 10).

### 5.2 Cómo se vende

Todo lo de HOS-2285 sección 5.2: admin UI para crear add-on + versión + producto,
`GET/POST /api/v1/protected/billing/addons/{offers,purchases}`, pantalla de complementos,
textos por slug. Hoy ninguna oferta se filtra por plan o rubro.

### 5.3 Qué falta

- La elegibilidad (HOS-2292): capacidad base, ya-otorgada y rubro.
- Un add-on cuya versión tiene `entitlements: ['multilingual_venue_menu']` y sin límites.
- Caché pública: el efecto sobre la ficha pública depende de la vida de la respuesta
  cacheada de la API y del CDN; solo los partners tienen invalidación explícita al cambiar
  la cobertura (`apps/api/src/utils/effective-set-cache.ts:41-53`). Para venue hay que
  verificar el tiempo en que la carta traducida aparece en la ficha (riesgo R-2).

## 6. Diseño propuesto

### 6.1 Add-on

| Campo | Valor propuesto |
|---|---|
| slug | `venue-menu-translations` |
| versión | `WHILE_SUBSCRIPTION_ALIVE`, `VERTICAL_SUBSCRIPTION`, `entitlements: ['multilingual_venue_menu']`, `limits: []` |
| producto | `PERIODICO` mensual (patrón `extra-venues-1`), precio provisorio $9.000/mes (a revisar con el owner antes de producción), `compatibleVerticals: ['venue']` |

Scope `VERTICAL_SUBSCRIPTION` porque el set se pliega por `user + vertical`: la carta en
idiomas rige en todas las fichas del dueño en el vertical, igual que en premium. (Un scope
`LISTING` también pliega por vertical y no limitaría a una ficha; no se usa.)

### 6.2 Elegibilidad (HOS-2292)

- **Regla general (decidida por el owner, 18/11/2026, HOS-2252 ronda 1, #3):** el complemento se ofrece cuando el plan ya tiene la capacidad base, nunca por el nombre del plan.
- Capacidad base: `manage_venue_menu` en el set efectivo. **El plan Básico no la tiene, así que no se le ofrece la carta en idiomas** (decidido el 18/11/2026, #3).
- Ya otorgada: `multilingual_venue_menu` ya en el set (excluye premium).
- Rubro: la clave `multilingual_venue_menu` es trait de la sección `menu`, poseída por
  `food`, así que el dueño debe tener al menos una ficha de venue con rubro gastronomía.
  Derivado del catálogo; sin literales de rubro (G1, G-FAC-03).
- Rechazo de compra: 409 `ADDON_NOT_ELIGIBLE`.

El mecanismo lo define y lo implementa HOS-2292; acá solo se declara qué necesita este
add-on.

Un restaurante con rubro noche solamente no ve la oferta, porque no tiene carta.

### 6.3 Dónde se ofrece

- Complementos (siempre).
- En el editor de la carta, cuando el dueño intenta guardar una traducción sin la clave: hoy
  el trait queda `locked`; el aviso existente (`VenueMenuTranslationFields.client.tsx`,
  `VenueMenuPlanNotice.client.tsx`) pasa a ofrecer el add-on cuando el dueño es elegible,
  sin nombrar planes (guard de upsell de editores de venue). El enlace usa la preselección
  `?product=` de HOS-2285 6.5.

### 6.4 Al vencer

Billing emite `coverage-changed`, el set efectivo se invalida y el trait vuelve a `locked`.
Las traducciones ya escritas **no se borran** (nunca se borra): quedan en la base y la
proyección pública las oculta (`nameI18n`/`descriptionI18n` en `null`), igual que hoy con
un dueño que baja de premium a pro (`venue.access.schema.ts` documenta ese comportamiento
para `menuSections`). Si renueva, vuelven.

## 7. Modelo de datos / contratos

Sin esquema ni migración. Filas creadas desde el admin: 1 `addon`, 1 `addon_version`,
1 `addon_version_entitlement`, 1 `addon_product`. Los contratos de elegibilidad son los
de HOS-2292.

## 8. UX / UI

- Complementos: oferta «Carta en varios idiomas» solo para dueños elegibles.
- Editor de la carta: en el bloque de traducciones bloqueado, mensaje «Ofrecé tu carta en
  inglés y portugués» con botón a la oferta; sin precios fijos en el texto.
- Ficha pública: la carta muestra el selector de idioma cuando el trait está disponible.

## 9. Criterios de aceptación

1. Dado un dueño pro con rubro gastronomía, cuando compra el add-on y se acredita el pago,
   entonces puede guardar `PUT .../menu` con `nameI18n`/`descriptionI18n` (hoy se rechaza
   por falta de la entitlement, con la respuesta de acceso denegado del pipeline) dentro de
   los 15 minutos.
2. Dado ese dueño, cuando se pide la ficha pública, entonces incluye las traducciones
   (tras la vida de la caché pública, que se mide y documenta).
3. Dado un dueño premium, entonces no ve la oferta y la compra se rechaza con 409
   `ADDON_NOT_ELIGIBLE` (regla de HOS-2292).
4. Dado un dueño básico (sin `manage_venue_menu`) o con rubro solo noche, entonces no ve la
   oferta y se rechaza (HOS-2292).
5. Dado un dueño en trial, entonces no puede comprarlo (`NO_VALID_TITLE`).
6. Dado el vencimiento del add-on, entonces el trait vuelve a `locked`, las traducciones
   quedan guardadas pero ocultas, y no hay filas borradas.
7. Dado el mismo usuario con alojamiento, entonces su set de alojamiento no cambia.
8. Fotos de platos y métricas del QR siguen bloqueadas en pro con el add-on activo.
9. G1, G2, G14, G7 y `check-role-never-decides` pasan; no hay precio en el código.
10. El producto de producción se crea solo tras la revisión del precio con el owner.

## 10. Plan de tests

- **Nuevo, clave del issue:** `apps/api/test/integration/billing-addon/menu-translations-addon.test.ts`:
  con un dueño pro más add-on activo, el set efectivo contiene `multilingual_venue_menu`, el
  `PUT .../menu` con traducción pasa (200) y la proyección pública conserva las
  traducciones; sin el add-on, 403 y proyección con `null`. Prueba directa de que el gate
  lee el set efectivo, no el plan.
- `packages/verticals/test/listing-sections/resolve-listing-sections.test.ts`: trait
  `translations` `available` con el entitlement llegando por una fuente `ADDON`.
- Los tests de elegibilidad (casos premium, básico, rubro noche) viven en HOS-2292.
- Regresión: foto de plato y métricas QR siguen `locked` con el add-on.
- Smoke de staging con MercadoPago sandbox.

## 11. Riesgos

- R-1. El mecanismo de elegibilidad es la pieza grande; está aislado en HOS-2292 y este
  add-on depende de él.
- R-2. Aparición de la carta traducida en la ficha pública depende de la caché de la API y
  del CDN; sin invalidación para venue puede demorar. Medir; si excede lo razonable,
  pedir invalidación por cobertura para venue (fuera de este alcance, nuevo issue).
- R-3. Un restaurante pro con rubro mixto (comida y noche) ve el add-on: correcto, tiene
  carta.
- R-4. Add-on de admin no reproducible en bases nuevas; mitigación: runbook.
- R-6. Precio provisorio: no crear el producto en producción sin revisión del owner.
- R-5. Cobro real: smoke de staging obligatorio para billing.

## 12. Preguntas abiertas y decisiones

Decidido (owner, 16/11/2026; precio confirmado como provisorio el 18/11/2026, ronda 1, #6):

1. **Precio y ciclo.** Mensual periódico, $9.000/mes provisorio, a revisar con el owner
   antes de producción. Hay que comprobar que pro + este add-on no deje a premium como
   opción absurda (canibalización), con el precio final.

Abiertas (menores):

2. **¿Se ofrece también a básico con carta?** Básico no tiene `manage_venue_menu`, así que
   la clave sola no le sirve. Recomendación: no (regla de capacidad base de HOS-2292).
   **Decidido (owner, 18/11/2026, HOS-2252 ronda 1, #3): no.** La regla es la capacidad base, no el nombre del plan; el Básico no tiene `manage_venue_menu`.
3. **Caché pública.** Si la carta traducida tarda más de lo aceptable en aparecer tras
   comprar: opciones (a) aceptar la vida de la caché; (b) invalidación al cambiar la
   cobertura de un dueño de venue. Recomendación: medir en staging y decidir con el dato.

## 13. Dependencias

- **HOS-2292** (elegibilidad de add-ons): prerrequisito.
- Pasada final de HOS-1352 y HOS-2066.
- No depende de HOS-2259 ni de grants (la clave existe).
- Relacionado con la decisión del owner de 16/11 sobre premium (fotos y QR no se venden).

## 14. Labels de smoke y Novedades

- `status-needs-smoke-staging` (compra real de complemento con MercadoPago sandbox: comprar,
  escribir la carta en pt y verla en la ficha pública).
- What's New: sí, con HOS-2284.

## 15. Desglose de tareas

1. Test del gate leyendo el set efectivo con fuente ADDON (0,5 día).
2. Crear el add-on en el admin de staging siguiendo el runbook de HOS-2285 (0,25 día).
3. Oferta en el aviso del editor de la carta (0,5 día).
4. Textos es/en/pt (0,25 día).
5. Medición de caché pública en staging (0,25 día).
6. Smoke de staging y firma (0,75 día).
7. Revisión del precio provisorio con el owner y creación en producción (0,25 día).

(La elegibilidad común se estima en HOS-2292.)

## 16. Linear

Canonical tracking:
HOS-2289
