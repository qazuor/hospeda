---
title: Promos de local exclusivas para turistas VIP
linear: HOS-2273
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - billing
  - api
  - web
---

# Promos de local exclusivas para turistas VIP (premium)

Hijo de HOS-2252, Fase 3 (funciones con gate de clave nueva). Depende de HOS-2270, HOS-2271 y HOS-2272 (promos de local), de HOS-2259 (la clave nueva en el catálogo) y, para verse en producción, de HOS-2282 (grant en los planes).

## 1. Resumen

Un local premium puede marcar una promo como «solo para turistas VIP». Esa promo aparece en «Beneficios exclusivos» del turista VIP, junto a las de alojamiento. Un turista que no es VIP ve en la ficha que existe una promo exclusiva y un upsell al plan VIP, pero no ve el detalle.

- Crear una promo VIP exige la clave nueva del lado del local: `venue_vip_promotions`.
- Verla exige las claves del lado del turista: `exclusive_deals` y `vip_promotions_access`. Esas dos no se reusan para crear.

## 2. Problema

- Hoy `owner_promotions.tourist_audience` (`plus` | `vip`) ya existe, pero para alojamiento no hay gate de quién puede marcar VIP: el formulario muestra el interruptor a cualquiera que pueda crear promos (`PromotionForm.client.tsx:864-886`).
- La lista de beneficios exclusivos solo conoce promos de alojamiento: su filtro de visibilidad trata el alojamiento (`ownerPromotion.visibility.ts:24-35`) y no hay forma de que una promo de local lo pase.
- La ficha pública de un local es HTML cacheado y no puede leer quién la mira. Hay que mostrar «existe, pero no te lo muestro» sin filtrar el detalle y sin tocar la sesión en el servidor.

## 3. Objetivos

- G-1. Gate de creación con `venue_vip_promotions`, modelado como rasgo (trait) de la sección `promotions`.
- G-2. Los turistas con `vip_promotions_access` (incluye a quienes lo heredan por su plan) ven las promos VIP de un local; el resto, solo que existen y el upsell.
- G-3. Las promos VIP de local entran en «Beneficios exclusivos».
- G-4. El detalle de una promo VIP nunca sale en HTML cacheado ni en una respuesta pública.
- G-5. Baja de plan (decisión 6): las promos VIP ya cargadas se respetan; se frena crear nuevas.
- G-6. Las claves de scope `vertical` no se cruzan: crear mira `venue`, ver mira `tourist`.

## 4. Fuera de alcance

- Crear la clave y asignarla a los planes: HOS-2259 (catálogo, migración, G3 y G18) y HOS-2282 (additive grant a premium).
- Gate de VIP en alojamiento. Hoy es libre; limitar a Premium el interruptor VIP de las promos de alojamiento va **en un issue aparte, HOS-2357** (decidido el 18/11/2026, HOS-2252 ronda 2, #31 ✱; ver OQ-4).
- Cerrar la fuga de promos VIP en la ficha de alojamiento: es el bug aparte HOS-2293 (accommodation VIP promo leak), relacionado pero separado de esta spec. Esta spec no lo arregla; en local la fuga se evita desde el diseño (la ruta pública de HOS-2271 filtra `tourist_audience = 'plus'`).
- (Eliminado el 18/11/2026.) El nombre del comercio en «Beneficios exclusivos» **sí** se muestra también en las promos de alojamiento (decisión #30 ✱, ver 6.4 y OQ-3).

## 5. Estado actual del código

Verificado en `origin/staging` (`92994b9dc6`).

- **Audiencia.** `owner_promotion.dbschema.ts:35` (`tourist_audience`), `packages/schemas/src/enums/tourist-audience.enum.ts` (`plus`: cualquier turista con el derecho; `vip`: solo el plan VIP; aditivo). El comentario del enum avisa que hoy todo lo que un turista puede comprar que da `exclusive_deals` también da `vip_promotions_access`.
- **Lista de beneficios exclusivos.** `apps/api/src/routes/owner-promotion/protected/exclusive-deals.ts:45-68`: exige `exclusive_deals` (vertical `TOURIST`, `enforceUserGate`), lee `vip_promotions_access` con `readEffectiveKeys` (`:51-55`) y calcula el alcance en el servidor (`:56-58`: `['plus','vip']` o `['plus']`). Solo acepta `accommodationId` como filtro (`:32-34`). El servicio: `ownerPromotion.service.ts:415-460` (`findExclusiveDeals`), cuyo docblock dice que el alcance NUNCA viene de un parámetro de la request. La visibilidad es `buildAccommodationVisibilityCondition` (`ownerPromotion.visibility.ts:24-35`, solo alojamientos publicados). El esquema de ítem (`owner-promotion.query.schema.ts:124-142`) trae `touristAudience`, pero no `venueId`.
- **Isla de beneficios.** `apps/web/src/components/account/ExclusiveDealsList.client.tsx:111-130`: llama a la ruta con la sesión y traduce 403 `ENTITLEMENT_REQUIRED` en «upgrade».
- **Cómo se resuelve el VIP del turista.**
  - `packages/verticals/src/effective-set/resolve-effective-set.ts:134-160` y `tourist-vip-inheritance.ts:20-47`: en el vertical `tourist`, el effective set suma la herencia. Si el usuario tiene un título vivo y no de prueba en otro vertical cuya versión de plan tiene `inherits_tourist_vip`, se le entrega Tourist VIP en runtime.
  - En el catálogo de producción, los nueve planes pagos de alojamiento, local y experiencia tienen `inheritsTouristVip: true` (`scripts/production-catalog/catalog.ts`, por ejemplo `:43`, `:209`, `:390` y los de `venue-*`). Consecuencia: **cualquier dueño con plan vivo ve las promos VIP como turista**, incluido un local básico. Es la regla existente, no un cambio de esta spec.
  - `vip_promotions_access` es una clave de scope `vertical` (`entitlement-keys.ts:44`) y se lee con `vertical: tourist`.
- **Web y sesión.** `apps/web/src/lib/entitlements-cache.ts:60-81` (`getEntitlementsCached({ vertical })`) es solo de navegador: la clave de caché es la vertical porque el módulo es de un usuario. Los servidores usan `fetchEntitlementsUncached`. `apps/web/test/pages/cacheable-pages-are-session-blind.guard.test.ts` prohíbe que cualquier página de `src/pages` lea la sesión; las islas `.tsx` están excluidas porque corren en el navegador.
- **Rasgos de sección.** `packages/verticals/src/authorization/resolve-listing-access.ts:212-221` evalúa la clave de cada rasgo pedido, salvo con `intent: 'delete'`. Precedentes: `traits` de `menu` en `listing-sections.ts:80-86` y `sectionTraits` dinámico en `putMenu.ts:91-94`, con el detector del payload en `menu-item-photo-gate.ts`. En web, `useListingPlanGate({ vertical: 'venue', entitlementKey })` (`VenueMenuManager.client.tsx:370`) lee la clave para pintar el upsell.
- **Evaluador.** `promo-offer-evaluator.service.ts:359` solo arma mails de alojamiento. Con HOS-2270 queda cerrado para filas de local: no hay que extenderlo (ver 6.7).
- La clave `venue_vip_promotions` **no existe todavía** en `packages/schemas/src/catalog/entitlement-keys.ts`, ni en `key-enums.ts`, ni en `scripts/production-catalog/catalog.ts`.

## 6. Diseño propuesto

### 6.1 La clave y el rasgo

- La fila `['venue_vip_promotions', 'vertical', 'MAX', 'NONE', 'COMMERCIAL']`, el miembro del enum y la migración del catálogo (`catalog_key` más el grant aditivo) los crea HOS-2259 y HOS-2282. Esta spec los consume y **no mergea antes** que HOS-2259 (el guard G3 `check-catalog-key-usage` falla con una clave que no está en el catálogo).
- En `LISTING_SECTIONS.venue`, sección `promotions` (HOS-2270): `traits: [{ id: 'vipPromotions', entitlementKey: K.VENUE_VIP_PROMOTIONS }]`. El rasgo se evalúa en el vertical del local (`resolveEntitlementStep` con `vertical: venue`), nunca en `tourist`.
- `plan-comparison-catalog-rows.ts` (bloque venue) suma `promotions.traits.vipPromotions` apuntando a las claves de i18n que escribe HOS-2262.
- No hay operación nueva en el pipeline: no toca `OPERATION_STEP6_KEY` ni `check-step5-declared`.

### 6.2 Gate de crear y editar (API del dueño)

- `VenuePromotionCreateRequestSchema` (HOS-2270) pasa a aceptar `touristAudience: 'plus' | 'vip'`. Default `plus`.
- Las rutas `POST` y `PUT`/`PATCH` de HOS-2270 declaran `sectionTraits: ({ body }) => (body?.touristAudience === 'vip' ? ['vipPromotions'] : [])`. El detector vive en un módulo propio, `venue-promotion-vip-gate.ts`, junto a `menu-item-photo-gate.ts`, para testearlo sin armar un contexto de Hono.
- Sin la clave: 403 `ENTITLEMENT_REQUIRED` con `entitlementKey: 'venue_vip_promotions'` (se rechaza, no se degrada en silencio a `plus`: el dueño lo ve y puede corregir, como las fotos de platos).
- Con `intent: 'delete'` (pausar o borrar) el rasgo no se pide: una promo VIP ya cargada se puede pausar o borrar siempre.
- **Sin Premium (sin el rasgo), el dueño no puede editar una promo VIP ya cargada** (decidido, owner, 18/11/2026, HOS-2252 ronda 2, #29 ✱; ver OQ-2). Un `PATCH`/`PUT` sobre una promo existente con `touristAudience = 'vip'` en la base exige el rasgo `vipPromotions`, aunque el body no mencione `touristAudience` (por ejemplo, cambiar el título). Como `sectionTraits` hoy solo ve el body, hace falta que el detector compare con la fila guardada (patrón del helper de HOS-2264 6.2). Pausar y borrar siguen sin pedir el rasgo (`intent: 'delete'`). Si pasar una VIP a `plus` cuenta como editar, queda como OQ-6.

### 6.3 Qué ve cada visitante en la ficha pública (session-blind)

Reglas de privacidad: el detalle de una promo VIP no sale de la API sin autenticación ni en HTML cacheado.

- **Ruta pública de HOS-2271** (`GET /api/v1/public/venues/{id}/promotions`): devuelve solo promos `plus` en `items` (como ya dice HOS-2271) y suma `vipPromotionsCount: number`: cuántas promos VIP vigentes tiene el local. Mismos filtros de vigencia que `items` (ACTIVE, no borrada, dentro de `valid_from` y `valid_until`, local publicado). Solo el número, nada de título, condición ni vigencia.
- **Ficha (SSR).** `VenuePromotions.astro` recibe `items` y `vipPromotionsCount`. Si hay VIP, pinta un bloque «Promociones para turistas VIP» con la isla `VenueVipPromotions.client.tsx` (`client:visible`) y, como contenido del servidor, solo el texto del teaser: «Este local tiene N promoción(es) exclusiva(s) para turistas VIP» y el botón «Conocé el plan VIP» (`buildUrl({ locale, path: PRICING_PAGE_PATH_BY_AUDIENCE.tourist })`, igual que `ExclusiveDealsList`). El HTML es idéntico para todos: ninguna lectura de sesión en la página, el guard sigue verde.
- **Isla (navegador).** Al hacerse visible:
  1. `getEntitlementsCached({ vertical: 'tourist' })`. Es la misma lectura que hace «Mi cuenta». Para un visitante sin sesión devuelve `failed: true`: se trata como «sin VIP».
  2. Con `vip_promotions_access > 0`: `GET /api/v1/protected/owner-promotions/exclusive-deals?venueId={id}&pageSize=50` con credenciales, y pinta las filas con `touristAudience === 'vip'`. Las `plus` ya están pintadas por el servidor.
  3. Sin VIP o con error: deja el teaser. No hay estado de error ruidoso; un fallo deja el teaser, nunca el detalle.
  4. Mientras carga muestra el teaser (nada salta).
- **Defensa en profundidad.** La ruta protegida recalcula el alcance en el servidor (`exclusive-deals.ts:51-58`). Un visitante sin `vip_promotions_access` que fuerce la llamada recibe solo las `plus`. La isla no es la barrera: es solo la presentación.
- Un dueño con plan vivo hereda VIP (ver 5) y por lo tanto ve sus propias promos VIP y las de otros locales.

### 6.4 «Beneficios exclusivos»

- `exclusive-deals.ts` suma el filtro opcional `venueId` (uuid) junto a `accommodationId`. `OwnerPromotionService.findExclusiveDeals` lo recibe en `params` (el alcance sigue siendo un argumento aparte, nunca de la request).
- `buildAccommodationVisibilityCondition` (HOS-2270 la deja como `entity_type = 'accommodation' AND (entity_id IS NULL OR …)`) pasa a una condición de visibilidad por tipo, que se renombra `buildPromotionVisibilityCondition`:
  `(entity_type = 'accommodation' AND entity_id IS NULL) OR (entity_type = 'accommodation' AND EXISTS alojamiento PUBLISHED con id = entity_id) OR (entity_type = 'venue' AND EXISTS local PUBLISHED con id = entity_id)`.
  Como `entity_id` no tiene FK, la existencia del listado se resuelve con `EXISTS` por tipo (no con una relación Drizzle).
  El predicado de «local publicado» es el mismo que usa el modelo de venue para lecturas públicas (`publicationStatus = 'PUBLISHED'`, `venue.model.ts:218`), reusado y no reescrito. Se compara por columna, no por vertical (G1).
- El ítem de la lista suma `venueId`, `venueName` y `venueSlug` (nulos para alojamiento), resueltos con una sola consulta por página, no N. **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #30 ✱):** «Beneficios exclusivos» muestra el nombre del comercio **también en las promos de alojamiento** (el nombre del alojamiento de la promo). Esto **toca una pantalla existente** y su ruta: el ítem suma el nombre del alojamiento, resuelto en la misma consulta por página (el nombre de campo y qué mostrar cuando la promo vale para todos los alojamientos del dueño, `entity_id` nulo, queda como OQ-7). `ExclusiveDealsList.client.tsx` muestra el nombre del comercio (local o alojamiento), un enlace a `/comer-y-salir/{slug}/` cuando es un local, y una marca «VIP» cuando `touristAudience === 'vip'` (el campo ya viene en el ítem).
- Orden y paginación: una sola tabla, una sola consulta. No hay unión de dos fuentes.

### 6.5 Editor del dueño

- `VenuePromotionForm` (HOS-2271) suma el interruptor «Exclusiva para turistas VIP».
  - Con el rasgo (`useListingPlanGate({ vertical: 'venue', entitlementKey: 'venue_vip_promotions' })` abierto): se puede activar, con la ayuda «Solo la ven los turistas con plan VIP. Los demás ven que existe y el plan para acceder».
  - Sin el rasgo: el interruptor queda deshabilitado con el upsell y el nombre del plan que lo habilita (`resolveVenueUpsellPlans` suma `vipPromotions`, resuelto desde el rasgo del catálogo con un helper `sectionTraitEntitlement(sectionId, traitId)`, generalización del `menuTraitEntitlement` actual). Si ningún plan lo lista todavía, texto genérico.
  - Una promo VIP ya cargada sin el rasgo: **el formulario de edición queda bloqueado** (decisión #29 ✱), con el upsell. Solo se puede pausar o borrar. Si el interruptor puede apagarse (pasar a `plus`) queda como OQ-6.
  - Si la API devuelve 403 `ENTITLEMENT_REQUIRED` con `entitlementKey: 'venue_vip_promotions'`, se muestra el upsell (el gate pudo cambiar entre la lectura y el guardado).
- En la lista del dueño, las promos VIP llevan la marca «VIP».

### 6.6 Baja de plan (decisión 6)

- Premium a pro, o a básico: las promos VIP vigentes siguen viéndose para los VIP hasta su fin, siguen contando como activas y se pueden pausar o borrar, **pero no editar** (decisión #29 ✱). No se crean ni se activan nuevas VIP, y no se puede pasar una `plus` a `vip`.
- No se oculta ni se degrada ninguna VIP a `plus`: un degradado silencioso cambiaría a quién se le muestra algo que el dueño prometió. Ver OQ-1.
- El tope `max_active_promotions` y la clave `create_promotions` siguen su regla (HOS-2270): VIP no tiene tope propio.

### 6.7 Evaluador de alertas

`promo-offer-evaluator.service.ts` no se extiende. Sus mails son «promo en un alojamiento que seguís» y se arman con alojamientos. HOS-2270 deja afuera las filas con `entity_type = 'venue'`. Un aviso de «promo nueva en un local que seguís» es parte de la épica de avisos (HOS-2266 a HOS-2269), no de esta spec.

### 6.8 i18n (es, en, pt)

- `venue.detail.promotions.vip.title`, `vip.teaser` (con plural: una, otras), `vip.cta`, `vip.loading`.
- `venue.owner.editor.promotionsManager.vipToggle`, `vipHint`, `vipUpsell`, `vipBadge`.
- `account.exclusiveDeals.venueLabel` y `account.exclusiveDeals.vipBadge` (revisar si ya existe en `account.json`).
- El plural del teaser usa `tPlural`. Los prefijos `venue.detail` y `account.exclusiveDeals` ya están (o se suman) a `i18n-client-namespaces.ts`.

## 7. Contratos

- Público: `GET /api/v1/public/venues/{id}/promotions` → `{ items: VenuePromotionPublic[], vipPromotionsCount: number }`.
- Protegido (turista): `GET /api/v1/protected/owner-promotions/exclusive-deals?venueId=&accommodationId=&page=&pageSize=`. Errores: 401 sin sesión; 403 `ENTITLEMENT_REQUIRED` sin `exclusive_deals` (como hoy); 400 si `venueId` no es uuid.
- Protegido (dueño): `touristAudience` en el body de las rutas de HOS-2270; 403 `ENTITLEMENT_REQUIRED` con `entitlementKey: 'venue_vip_promotions'`.
- Item de lista: `+ venueId, venueName, venueSlug` (nulos para alojamiento; `venueId` se deriva de `entity_id` cuando `entity_type = 'venue'`) y el nombre del alojamiento para promos de alojamiento (decisión #30 ✱, nombre de campo en OQ-7).

## 8. UX

- Tarjeta del listado: si el local tiene **solo promos VIP**, la tarjeta pública muestra «Promo VIP» (decisión #32 ✱; dato en HOS-2271 6.4). Con promos `plus` muestra «Promo», como hasta ahora. No revela títulos ni beneficios.
- Teaser: bloque sobrio con un ícono de «VIP», texto y un botón. Sin mostrar títulos ni números de descuento. Para quien tiene VIP, el mismo bloque muestra las tarjetas.
- «Beneficios exclusivos»: marca «VIP» y nombre del comercio (local o alojamiento).
- Accesibilidad: el teaser es texto, no imagen; el botón tiene nombre claro; el estado «cargando» no anuncia alertas.

## 9. Criterios de aceptación

- AC-1. Dado un dueño con `venue_vip_promotions`, cuando guarda una promo con `touristAudience: 'vip'`, entonces se crea con audiencia `vip`.
- AC-2. Dado un dueño sin esa clave, cuando guarda una promo `vip`, entonces 403 `ENTITLEMENT_REQUIRED` con `entitlementKey: 'venue_vip_promotions'`; y con `plus` se crea normalmente.
- AC-3. Dado un dueño con `vip_promotions_access` de turista pero sin `venue_vip_promotions` de local, entonces no puede crear promos VIP (las claves no se cruzan). Y al revés: con `venue_vip_promotions` y sin las de turista, puede crearlas.
- AC-4. Dado un dueño que bajó de premium a pro, entonces sus promos VIP vigentes se siguen mostrando a los VIP, puede pausarlas o borrarlas, y no puede crear ni activar nuevas VIP ni **editar** las cargadas.
- AC-5. Dada una ficha de local con una promo VIP vigente, entonces el HTML del servidor trae el teaser con el número y no contiene el título, la descripción ni el beneficio de esa promo.
- AC-6. Dada `GET /public/venues/{id}/promotions`, entonces `items` no incluye promos `vip` y `vipPromotionsCount` es el número de VIP vigentes de ese local publicado.
- AC-7. Dado un turista con `vip_promotions_access`, cuando abre la ficha, entonces la isla muestra el detalle de las promos VIP del local.
- AC-8. Dado un turista sin VIP, o sin sesión, entonces ve el teaser y el botón al plan VIP, y nunca el detalle.
- AC-9. Dado un visitante sin VIP que llama directo a `exclusive-deals?venueId=`, entonces recibe solo promos `plus` (el alcance sale del servidor).
- AC-10. Dado un dueño de local con plan vivo, cuando abre la ficha de otro local, entonces ve las promos VIP por herencia.
- AC-11. Dadas promos VIP de local y de alojamiento, cuando un turista VIP abre «Beneficios exclusivos», entonces ve ambas, en una sola lista paginada.
- AC-12. Dada una promo de un local no publicado, entonces no aparece en «Beneficios exclusivos».
- AC-13. Dado el guard `cacheable-pages-are-session-blind`, entonces sigue verde con la ficha nueva.
- AC-14. Dado un dueño sin el rasgo, un `PATCH` que solo cambia el título de una promo VIP existente responde 403 `ENTITLEMENT_REQUIRED` con `entitlementKey: 'venue_vip_promotions'` (decisión #29 ✱), y el editor la muestra bloqueada. Pausar y borrar siguen permitidos. Sobre una promo `plus` el mismo `PATCH` pasa.
- AC-17. Dado un local cuyas únicas promos vigentes son VIP, entonces su tarjeta del listado muestra «Promo VIP»; con al menos una promo `plus` vigente muestra «Promo»; sin promos vigentes, nada. El HTML de la tarjeta no contiene título ni beneficio de la VIP.
- AC-16. Dada una promo de alojamiento en «Beneficios exclusivos», entonces el ítem muestra el nombre del alojamiento, igual que las de local muestran el nombre del local (decisión #30 ✱).
- AC-15. Dada la clave `venue_vip_promotions` ausente del catálogo (HOS-2259 no mergeada), entonces el build o el guard G3 falla, no el runtime.

## 10. Plan de pruebas

- Unit `apps/api/test/routes/venue/protected/venue-promotion-vip-gate.test.ts`: el detector del payload (AC-14, formas hostiles de `body`).
- API `apps/api/test/routes/venue/protected/`: AC-1 a AC-4 (fixtures de effective set con `rehydrateEffectiveSet`, vertical `venue` con y sin la clave, y vertical `tourist` aparte para AC-3).
- API pública `apps/api/test/routes/venue/public/`: AC-5 y AC-6 (el cuerpo serializado no contiene el texto de la VIP, test de «no leak» sobre el JSON).
- API `apps/api/test/routes/owner-promotion/protected/exclusive-deals*.test.ts` (extender): `venueId`, AC-9, AC-11, AC-12.
- Servicio `packages/service-core/test/services/owner-promotion/ownerPromotion.exclusive-deals.test.ts` y `.visibility.test.ts` (extender): visibilidad por target.
- Web: `VenueVipPromotions` (VIP, no VIP, sin sesión, error), `ExclusiveDealsList` (nombre del local, marca VIP), formulario (interruptor con y sin rasgo).
- Guards: `cacheable-pages-are-session-blind` (AC-13), G1, G2, G3 y G18 (los cubre HOS-2259), `check-grant-floor-by-vertical`.
- e2e (`apps/e2e`): un caso, turista VIP y turista free sobre la misma ficha. Corre en staging con los grants de HOS-2282 aplicados.

## 11. Riesgos y preguntas para el dueño

Riesgos:
- R-1. Orden de merge: el rasgo referencia una clave que crea HOS-2259, bloqueada hasta la pasada final de HOS-1352. Mitigación: esta spec no se implementa antes; el código puede prepararse en una rama que dependa de HOS-2259.
- R-2. La herencia hace que todo dueño con plan vea promos VIP. Un dueño de alojamiento básico puede leer las VIP de otro local. Es la regla de HOS-1224 y se informa; no se cambia acá.
- R-3. La ruta `exclusive-deals` pagina de a 20: la isla pide `pageSize=50`. Un local con más de 50 promos VIP vigentes (premium sin tope) quedaría cortado. Se acepta; con ese volumen la ficha ya sería ilegible.
- R-4. El teaser cacheado puede quedar con un número viejo hasta que corra la revalidación (HOS-2270, AC-16).

Preguntas:
- OQ-1. **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #28): opción (a).** Si el dueño baja de Premium, sus promos VIP siguen hasta vencer. Baja de premium con promos VIP cargadas. Opciones: (a) se respetan hasta que venzan, solo se frena crear nuevas; (b) se pausan; (c) se pasan a `plus` (más visibles). **Recomiendo (a)**: es la decisión 6 («lo confirmado se respeta») y no cambia a quién se le promete algo.
- OQ-2. **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #29 ✱): opción (b).** Sin Premium el dueño **no puede editar** una promo VIP ya cargada (se aparta de la recomendación; ver 6.2, AC-14). ¿Editar el texto de una VIP ya cargada sin el rasgo? Opciones: (a) sí, el rasgo solo gatea poner `vip` en el body; (b) no, se bloquea toda edición de una VIP sin el rasgo. **Recomiendo (a)**: más simple y no castiga correcciones de un typo.
- OQ-3. **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #30 ✱): opción (b).** Se muestra el nombre del comercio también en las promos de alojamiento (toca una pantalla existente; ver 6.4). Nombre del local en «Beneficios exclusivos». Opciones: (a) mostrarlo solo para promos de local, como pide esta spec; (b) mostrar también el del alojamiento (cambia pantalla existente). **Recomiendo (a)**, y (b) como mejora aparte.
- OQ-4. **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #31 ✱): opción (b).** Limitar a Premium el interruptor VIP de alojamiento va en un issue aparte, **HOS-2357**; esta spec no lo toca. El interruptor VIP de alojamiento hoy no tiene gate. Opciones: (a) dejarlo; (b) gatearlo con una clave análoga en una spec aparte. **Recomiendo (a)** y abrir un issue si el dueño quiere (b): cambiarlo ahora quita una función a quien ya la usa.
- OQ-5. **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #32 ✱): opción (b).** Si el local tiene solo promos VIP, la tarjeta pública muestra **«Promo VIP»** (se aparta de la recomendación; el cambio en el dato de la tarjeta está en HOS-2271 6.4 y AC-11). ¿La tarjeta del listado marca «Promo» si el local solo tiene una promo VIP? Opciones: (a) no (se alinea con que el detalle es privado); (b) sí, con «Promo VIP». **Recomiendo (a)**.
- OQ-6. **Editar una VIP sin Premium: qué cuenta como editar (abierta, la abre la decisión #29).** ¿Apagar el interruptor VIP (pasar a `plus`) está permitido, o también queda bloqueado? ¿Y reactivar una VIP pausada? La spec bloquea todo `PATCH`/`PUT` de contenido y deja pausar y borrar; el resto lo define el implementador con el owner.
- OQ-7. **Nombre del comercio en promos de alojamiento (abierta, la abre la decisión #30).** Nombre del campo del ítem y qué mostrar cuando la promo vale para todos los alojamientos del dueño (`entity_id` nulo): ¿el nombre del dueño, un texto genérico o nada?
- OQ-8. **Tarjeta «Promo VIP» con franja viva (abierta, la abre la decisión #32).** Si el local tiene solo promos VIP y una tiene franja vigente (HOS-2272), ¿la tarjeta muestra «Ahora» o sigue en «Promo VIP»? La spec no lo decide.

## 12. Dependencias

- HOS-2259: crear `venue_vip_promotions` en el catálogo (bloqueada por la pasada final de HOS-1352).
- HOS-2282: asignarla a `venue-premium` con el additive grant, y asignar `create_promotions` y `max_active_promotions`.
- HOS-2262: textos de la tabla de planes para el rasgo.
- HOS-2270, HOS-2271 y HOS-2272: rutas, editor, ficha y franja.
- Regla del owner: nada que toque el catálogo mergea antes de la pasada final de HOS-1352.

## 13. Etiquetas de smoke y Novedades

- `status-needs-smoke-staging`: gate de clave nueva y un teaser que depende del estado de sesión y de VIP. Smoke con tres usuarios: dueño premium, turista VIP y turista free o invitado, sobre la misma ficha. Sigue el checklist de staging de `docs/billing/smoke-checklist.md`.
- Novedades: sí, entrada nueva («Promociones exclusivas para turistas VIP»), audiencias dueños de local y turistas. Se escribe en el smoke-tanda.

## 14. Desglose de tareas

1. T-1 Rasgo `vipPromotions` en la sección `promotions`, fila de la tabla de planes y `sectionTraitEntitlement`. (Después de HOS-2259.)
2. T-2 `touristAudience` en los schemas de local y `venue-promotion-vip-gate.ts` con sus tests.
3. T-3 Rutas de local: `sectionTraits` dinámico y tests de AC-1 a AC-4, AC-14.
4. T-4 Ruta pública: `vipPromotionsCount` y test de «no leak».
5. T-5 `exclusive-deals`: filtro `venueId`, visibilidad por target y campos del local en el ítem. Tests de servicio y de ruta.
6. T-6 `VenueVipPromotions.client.tsx` y su montaje en `VenuePromotions.astro`.
7. T-7 `ExclusiveDealsList`: nombre del comercio (local y alojamiento), enlace y marca VIP.
7b. T-7b Tarjeta del listado: «Promo VIP» cuando el local solo tiene promos VIP (en coordinación con HOS-2271 6.4).
8. T-8 Formulario del dueño: interruptor con rasgo, upsell y estados de baja.
9. T-9 i18n es, en, pt.
10. T-10 e2e, guards y smoke de staging.

## 15. Linear

Canonical tracking: HOS-2273. Épica: HOS-2252. Previas: HOS-2270, HOS-2271, HOS-2272. Catálogo: HOS-2259, HOS-2282.
