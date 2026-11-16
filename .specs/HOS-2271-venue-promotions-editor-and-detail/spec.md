---
title: Promos de local, editor y ficha
linear: HOS-2271
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - web
  - api
---

# Promos de local: editor y ficha

Hijo de HOS-2252. Depende de HOS-2270 (modelo `entity_type` + `entity_id`, rutas y sección de catálogo). Antecede a HOS-2272 (franja horaria) y HOS-2273 (VIP).

## 1. Resumen

El dueño de un local crea, edita, pausa y borra sus promos desde una sección «Promociones» del editor, y ve cuántas activas le quedan según su plan. El turista ve las promos vigentes en la ficha pública (título, condición y vigencia) y una marca discreta «Promo» en las tarjetas del listado. Sin la clave `create_promotions`, el editor muestra el upsell. Incluye el tipo de beneficio «oferta especial» (texto libre, moderado). Textos en es, en y pt.

## 2. Problema

Con HOS-2270 las promos de local existen en la API, pero no hay forma de cargarlas ni de verlas. Los componentes de alojamiento (`PromotionForm`, `PromotionList`, `PromotionBanner`) están atados a alojamiento y no sirven tal cual.

## 3. Objetivos

- G-1. Sección «Promociones» en el editor de local, por el catálogo de secciones (G-FAC-05), sin comparar la vertical en el editor.
- G-2. Crear, editar, pausar y borrar. Se ve «N de M activas» (o «sin tope»).
- G-3. Ficha pública: bloque con cada promo vigente (título, condición, vigencia). HTML cacheable, sin leer sesión.
- G-4. Tarjetas del listado con marca «Promo».
- G-5. Sin entitlement: upsell. Con promos ya cargadas tras una baja de plan: se ven, se pausan y se borran, no se crean ni se editan.
- G-6. i18n es, en y pt.
- G-7. «Oferta especial»: el dueño escribe el beneficio en texto libre; se muestra en la ficha y se modera (decisión del owner, 16/11/2026; el modelo y la moderación viven en HOS-2270).

## 4. Fuera de alcance

- Franja horaria y badge «Ahora» (HOS-2272). El formulario y la tarjeta quedan listos para sumarlo.
- Promos VIP (HOS-2273).
- Fila de promos en la tabla de planes (HOS-2262).
- Cambios a `/mi-cuenta/promociones` (alojamiento).

## 5. Estado actual del código

Verificado en `origin/staging` (`92994b9dc6`).

**Componentes de alojamiento.**
- `apps/web/src/components/host/PromotionForm.client.tsx` (945 líneas, pasa el límite de 500): arma el body con `accommodationId` (`:304`), `minNights` y `maxRedemptions` (`:291-303`), carga propiedades con `protectedAccommodationsApi.listOwn()` (`:34`, `:798-806`), valida con `OwnerPromotionCreateRequestSchema` y redirige a `/mi-cuenta/promociones/`.
- `PromotionList.client.tsx:180` lee el effective set con `getEntitlementsCached({ vertical: 'accommodation' })` y `:182` mira `create_promotions`. Lista con `ownerPromotionApi.list()` (`:152`), que trae todas las promos del dueño.
- `apps/web/src/components/accommodation/PromotionBanner.astro:35-52`: `formatDiscount` (percentage, fixed, free_night) duplicado también en `ExclusiveDealsList.client.tsx:163-167`.

**Editor de local.**
- Una página por sección: `apps/web/src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar/eventos.astro` (modelo a copiar). Usa `resolveListingEditorPage`, `ListingEditorSectionLayout`, `sectionStates`, `fetchAudiencePlans` y `resolveVenueUpsellPlans` (`apps/web/src/lib/venue/section-upsell-plan.ts:7-14`, `:51-62`) para el nombre del plan que desbloquea. Con la sección bloqueada, `VenueEventsManager` recibe `sectionState='locked'` y `upsellPlanName`.
- El slug y la etiqueta salen de `apps/web/src/lib/editor/listing-section-presentation.ts:78-81`.
- Antes de que algún plan liste `create_promotions` para local, `resolveUnlockingPlanName` devuelve `null`. La pantalla debe aguantar `upsellPlanName = null`.

**Ficha pública.** `apps/web/src/pages/[lang]/comer-y-salir/[slug].astro`: el cuerpo se arma ordenando las secciones del catálogo (`orderVenueDetailSections`, `apps/web/src/lib/venue/venue-detail-sections.ts:35-80`) y un mapa de componentes (`[slug].astro:351-358` para `venueEvents`). El HTML se cachea en el borde: no puede leer `Astro.locals.user` (`apps/web/test/pages/cacheable-pages-are-session-blind.guard.test.ts`). `VenueEvents.astro` es el modelo de bloque puramente presentacional.

**Tarjeta.** `apps/web/src/components/venue/VenueCard.astro:124-131` ya pinta una isla `VenueOpenNowBadge` sobre la imagen. La lista pública: `apps/api/src/routes/venue/public/list.ts:40-76` (`projectPublicListings`, `VenuePublicListItemSchema`). Las tarjetas se usan en `comer-y-salir/index.astro` y `comer-y-salir/rubro/[rubro]/index.astro`.

**i18n web.** `apps/web/src/lib/i18n-client-namespaces.ts:268-282` ya expone `venue.card` y `venue.detail` al navegador. `host.promotions.*` (alojamiento) vive en `packages/i18n/src/locales/es/host.json:866`.

## 6. Diseño propuesto

### 6.1 Decisión de reuso (a confirmar, OQ-1)

Los componentes de alojamiento no se parametrizan. Razones: el formulario ya supera las 500 líneas, está lleno de campos de alojamiento, y parametrizarlo por vertical (`vertical === 'venue'` dentro de un componente compartido) es justo lo que prohíbe G1. Se reusa lo que es puro:
- Extraer `formatPromotionBenefit({ discountType, discountValue, locale })` a `apps/web/src/lib/promotions/format-benefit.ts` y usarlo en `PromotionBanner.astro`, `ExclusiveDealsList.client.tsx` y los componentes nuevos. Se agrega el caso `special_offer` (HOS-2270): muestra el texto libre de la oferta (escapado, sin HTML ni links), sin cifra.
- Reusar los estilos base y los helpers de formularios (`zodIssuesToFieldErrors`, `@/lib/forms/field-errors`).
- Componentes nuevos de local, cada uno por debajo de 500 líneas: `VenuePromotionsManager.client.tsx`, `VenuePromotionForm.client.tsx`, `VenuePromotions.astro`.

### 6.2 Editor del dueño

- Página nueva `.../editar/promociones.astro` (copia de `eventos.astro`): `resolveListingEditorPage({ sectionSlug: 'promociones' })`, `sectionState` y `upsellPlanName` desde `resolveVenueUpsellPlans`, que suma `promotions: resolve(sectionEntitlement('promotions'))`.
- `listing-section-presentation.ts` pasa de valor mínimo a la entrada final: slug `promociones`, etiqueta `listing.owner.editor.sectionNav.venuePromotions`.
- `VenuePromotionsManager` (isla `client:load`):
  - Carga `GET /api/v1/protected/venues/{id}/promotions` (HOS-2270). Recibe `{ items, meta: { activeCount, maxActive } }`.
  - Lista cada promo con estado (activa, pausada, vencida), vigencia y acciones Editar, Pausar o Reactivar, Borrar (confirmación inline como `PromotionList`).
  - Contador: «N de M activas» o «N activas, sin tope» cuando `maxActive === 2147483647` (`isUnlimitedLimit`, `apps/web/src/components/billing/plan-card-delta.ts:51`).
  - Botón «Nueva promoción» deshabilitado si `sectionState === 'locked'` o si `activeCount >= maxActive`; en ambos casos muestra el upsell con el nombre del plan, o texto genérico si `upsellPlanName` es `null`.
  - Bloqueada con promos cargadas (baja de plan): la lista se ve completa, Pausar y Borrar funcionan, Editar y Reactivar muestran el upsell. El 403 `ENTITLEMENT_REQUIRED` o `LIMIT_REACHED` de la API se traduce con `apps/web/src/lib/billing-limit-error.ts` (ya conoce `max_active_promotions`, `:69`).
- `VenuePromotionForm` (diálogo o panel dentro del manager): título (≤200), condición/descripción (≤1000), tipo de beneficio (porcentaje, monto, oferta especial), valor (solo para porcentaje y monto; porcentaje tope 100, como `PromotionForm`), texto de la oferta (solo para oferta especial, obligatorio, con contador de caracteres y ayuda «Contá el beneficio en pocas palabras, por ejemplo 2x1 en tragos»; si la moderación lo rechaza, el 400 se muestra en el campo), vigencia desde y hasta (`validUntil` opcional). Sin `minNights`, sin propiedad, sin canjes. Valida con el schema de alta de local de HOS-2270 (`safeParse` antes de llamar).
- Cliente API: `venuePromotionsApi` (`list`, `create`, `update`, `patch`, `remove`) en `apps/web/src/lib/api/endpoints-protected.ts`, junto a `ownerPromotionApi` (`:4369`).

### 6.3 Ficha pública (session-blind)

- Ruta pública nueva en `apps/api/src/routes/venue/public/getPromotions.ts`: `GET /api/v1/public/venues/{id}/promotions`.
  - Responde 404 si el local no está `PUBLISHED` (igual que `getBySlug`, HOS-1641).
  - Devuelve las promos del local (`entity_type = 'venue'` y `entity_id = {id}`) con `lifecycle_state = ACTIVE`, `deleted_at IS NULL`, dentro de la ventana `valid_from`/`valid_until` y `tourist_audience = 'plus'`. Las `vip` no salen (HOS-2273 suma solo un contador).
  - Campos: `id`, `title`, `description`, `discountType`, `discountValue`, `validFrom`, `validUntil`. Sin `ownerId`, sin canjes.
  - HOS-2273 le suma `vipPromotionsCount` (solo el número de promos VIP vigentes).
  - Cacheable como el resto de lecturas públicas; sin leer sesión.
  - No usa el proyector público: la promo ya cargada sigue visible tras una baja de plan (decisión 6, igual que alojamiento).
- `VenuePromotions.astro`: bloque presentacional (modelo `VenueEvents.astro`), no pinta nada con lista vacía. Muestra título, condición, beneficio con `formatPromotionBenefit` y vigencia («hasta el 30 de noviembre» o «sin fecha de fin», con `formatCalendarDate` de `@repo/utils`).
- `[slug].astro`: en el `Promise.all` de lecturas se suma `venuePromotionsApi.list({ venueId })` (cliente público en `apps/web/src/lib/api/endpoints.ts`, sin cookie). `VENUE_DETAIL_SECTION_BODY.promotions` pasa a `true` y el mapa de componentes suma `promotions: [{ Component: VenuePromotions, props }]`. Si la lectura falla, el bloque no se pinta y la página no cae (`markResponseDegradedFromApi` como las demás lecturas).
- Etiquetas de caché: toda escritura de promo de local revalida el local (HOS-2270, AC-16). Verificar con un test que la entidad `venue` cubre la ficha y la lista.

### 6.4 Marca «Promo» en la tarjeta

- API: `VenuePublicListItemSchema` suma `promoBadge?: { hasPromo: true }` (HOS-2272 le suma las franjas). En `list.ts` y en las otras rutas que arman tarjetas de local (`getByDestination.ts` y destacados del home) se hace una sola lectura por página: `OwnerPromotionModel.findVenueIdsWithActivePromo({ venueIds })` (`entity_type = 'venue'`, `entity_id IN venueIds`, ACTIVE, vigente, `tourist_audience = 'plus'`, `GROUP BY entity_id`). Una consulta, no N.
- Web: `toVenueCardProps` (`apps/web/src/lib/api/transforms.ts:2729`) pasa el dato. `VenueCard.astro` pinta una etiqueta chica «Promo» si `data.promoBadge`. Discreta: misma altura y estilo que los otros chips de la tarjeta, texto fijo, sin interacción, `aria-label` descriptivo.
- Como el dato es estático (hay o no hay promo vigente), vive en HTML cacheado y se revalida con la etiqueta del local. La parte que depende de la hora (badge «Ahora») es isla de cliente y va en HOS-2272.

### 6.5 i18n (es, en, pt)

Claves nuevas (los tres idiomas; prefijos ya expuestos al cliente o a sumar en `i18n-client-namespaces.ts`):
- `listing.owner.editor.sectionNav.venuePromotions` («Promociones»).
- `venue.owner.editor.promotionsManager.*`: título, vacío, contador, «Nueva promoción», campos, ayudas, estados, confirmación de borrado, errores, upsell. El prefijo `venue.owner.editor` hay que verificarlo contra `CLIENT_I18N_KEY_PREFIXES`, como lo hace `VenueEventsManager`.
- `venue.detail.promotions.*`: título del bloque, vigencia, «sin fecha de fin».
- `venue.card.promo` («Promo»).
- `host.promotions.discountTypes.special_offer` («Oferta especial») y las claves del campo de texto (etiqueta, ayuda, contador).
Los textos van con la tilde correcta y sin inventar traducciones: pt y en con el mismo cuidado que es. Los guards de i18n miran estructura, no contenido: revisar a mano.

## 7. Contratos

- Protegido (HOS-2270): `GET|POST|PUT|PATCH|DELETE /api/v1/protected/venues/{id}/promotions[/{promotionId}]`.
- Público nuevo: `GET /api/v1/public/venues/{id}/promotions` → `{ items: VenuePromotionPublic[] }`. Tier público, sin permisos. Errores: 400 si `{id}` no es uuid, 404 si el local no existe o no está publicado.
- Lista de local: `promoBadge?: { hasPromo: true }`.
- La ruta pública es de venue: va en `routes/venue/public/` y se registra en `public/index.ts`. Las rutas públicas de local no usan `listingAccess` hoy (se leen por proyector); revisar `check-vertical-context` (G2) y declarar `VerticalEnum.VENUE` si el guard lo exige para una ruta pública con id de local.

## 8. UX

- Editor: lista arriba, botón «Nueva promoción», formulario en panel. Mensajes en voseo neutro, cortos. El contador usa el mismo componente visual que los topes de otras secciones si existe; si no, texto simple.
- Estados: vacío («Todavía no cargaste promociones»), cargando (esqueleto), error con reintento, bloqueada con upsell, tope alcanzado con upsell, éxito.
- Ficha: bloque «Promociones» después de eventos y antes de preguntas (orden del catálogo, `order` de la sección). Cada promo es una tarjeta: título, beneficio, condición, vigencia.
- Accesibilidad: etiquetas asociadas, foco al abrir el panel, confirmación de borrado alcanzable con teclado, marca «Promo» con texto, no solo color.

## 9. Criterios de aceptación

- AC-1. Dado un dueño con `create_promotions` y cupo, cuando completa y guarda el formulario, entonces la promo aparece en la lista y en la ficha pública (tras la revalidación) con título, condición y vigencia.
- AC-2. Dado un dueño con `maxActive = 5` y 5 activas, entonces el contador dice «5 de 5 activas», «Nueva promoción» queda deshabilitado y se ve el upsell.
- AC-3. Dado un `maxActive` de 2147483647, entonces el contador dice «sin tope» y nunca imprime el número.
- AC-4. Dado un dueño sin `create_promotions` y sin promos, entonces la sección muestra el upsell con el nombre del plan que la desbloquea, o el texto genérico si no hay plan que la liste.
- AC-5. Dado un dueño que bajó de plan con 3 promos activas, entonces las ve, puede pausarlas y borrarlas, y Editar, Reactivar y Nueva muestran el upsell. Las 3 siguen en la ficha pública.
- AC-6. Dado el formulario de local, entonces no pide `minNights`, propiedad ni canjes, y valida porcentaje ≤ 100.
- AC-16. Dado un dueño que elige «oferta especial», entonces el formulario pide el texto libre (sin valor numérico), lo guarda, y la ficha lo muestra tal cual escrito y escapado; un texto que la moderación rechaza muestra el error en el campo.
- AC-17. Dada la tarjeta o la ficha con una promo `special_offer`, entonces nunca se imprime una cifra ni `0`.
- AC-7. Dado un local sin promos vigentes, entonces la ficha no pinta el bloque ni deja un hueco.
- AC-8. Dado un local no publicado, entonces `GET /public/venues/{id}/promotions` responde 404.
- AC-9. Dado un local con una promo vigente, entonces su tarjeta del listado muestra «Promo»; sin promo, no.
- AC-10. Dada una promo pausada, vencida o aún no iniciada, entonces no sale en la ficha ni marca la tarjeta.
- AC-11. Dada una promo `vip` (HOS-2273), entonces no sale en la ruta pública ni marca la tarjeta.
- AC-12. Dada la ficha, entonces su HTML es idéntico para cualquier visitante (el guard `cacheable-pages-are-session-blind` sigue verde).
- AC-13. Dado el idioma en, pt o es, entonces todos los textos nuevos se ven traducidos y sin claves crudas.
- AC-14. Dado `upsellPlanName = null`, entonces ninguna pantalla imprime `null` ni queda en blanco.
- AC-15. Dado un error de la API al cargar, entonces el editor muestra el error con reintento y la ficha se renderiza igual sin el bloque.

## 10. Plan de pruebas

- Unit web:
  - `apps/web/test/lib/promotions/format-benefit.test.ts`: los cuatro tipos (incluida la oferta especial sin cifra) y los tres idiomas.
  - `apps/web/test/components/venue/VenuePromotionsManager.test.tsx`: contador, sin tope, bloqueado, tope, errores 403 (`ENTITLEMENT_REQUIRED` y `LIMIT_REACHED`), baja de plan.
  - `apps/web/test/components/venue/VenuePromotionForm.test.tsx`: campos, validación, tope de porcentaje.
  - `apps/web/test/components/venue/VenuePromotions.test.ts` (Astro): vacío y completo.
  - `VenueCard`: marca presente y ausente.
- Unit API: `getPromotions` (404 no publicado, filtros de vigencia y audiencia), `promoBadge` en lista (una sola consulta por página).
- Guards: `cacheable-pages-are-session-blind`, el de `VENUE_DETAIL_SECTION_BODY` (exhaustivo), `check-vertical-context`, i18n.
- e2e (`apps/e2e`, un solo spec nuevo): dueño de local con grant manual crea una promo y el turista invitado la ve en la ficha. Corre en staging cuando HOS-2282 esté aplicado.

## 11. Riesgos y preguntas para el dueño

Riesgos:
- R-1. La promo nueva tarda en verse hasta que corra la revalidación de caché. Mitigación: test de AC-16 de HOS-2270 y mensaje en el editor («puede tardar unos minutos en verse»).
- R-2. Dos sitios más de `formatDiscount` duplicados quedan sin migrar y se desfasan. Mitigación: la extracción de `format-benefit.ts` migra los tres sitios en este mismo PR.
- R-3. El bloque público depende de una segunda llamada en SSR: un fallo no tumba la página.

Decidido (owner, 16/11/2026): se suma el tipo de beneficio «oferta especial» con texto libre moderado (HOS-2270, HOS-2271). Esta spec lo muestra y lo pide en el formulario.

Preguntas abiertas (menores):
- OQ-1. Reuso de formularios. Opciones: (a) componentes de local nuevos más helpers compartidos; (b) parametrizar `PromotionForm`/`PromotionList` por vertical. **Recomiendo (a)**: (b) rompe G1 y ya pasa las 500 líneas.
- OQ-2. Posición del bloque en la ficha. Opciones: (a) por orden del catálogo, tras eventos; (b) arriba, antes de la carta, para que se vea más. **Recomiendo (a)**: cambiar el orden es una decisión de producto y el catálogo ya lo define; (b) se puede pedir después.
- OQ-4. Texto de la oferta en la tarjeta del listado: la marca queda en «Promo» fija (no se muestra el texto libre ahí). Opciones: (a) solo «Promo»; (b) mostrar el texto corto. **Recomiendo (a)**: la tarjeta es discreta y el texto libre no tiene largo controlado.
- OQ-3. Aviso de «puede tardar en verse». Opciones: (a) mostrarlo; (b) esperar la revalidación sin aviso. **Recomiendo (a)**.

## 12. Dependencias

- HOS-2270 (ruta, sección, permisos) es previa.
- HOS-2282 (grants) para smoke real.
- HOS-2262: fila de promos en la tabla de planes. Coordinar el stub `promotions: {}`.
- HOS-2272 y HOS-2273 extienden estas pantallas.

## 13. Etiquetas de smoke y Novedades

- `status-needs-smoke-staging`: pantalla nueva con gate de plan y caché de borde. Smoke con HOS-2282 aplicado (o grant manual) y una promo visible desde un navegador sin sesión. Local alcanza para el formulario, no para el gate.
- Novedades: sí. Entrada «Promociones en tu local» (audiencia dueños de local), se escribe en el smoke-tanda. La suma de HOS-2272 extiende la misma entrada (`whats-new-done`).

## 14. Desglose de tareas

1. T-1 Extraer `formatPromotionBenefit` y migrar `PromotionBanner`, `ExclusiveDealsList` y la lista de alojamiento. Tests.
2. T-2 Cliente API web: `venuePromotionsApi` protegido y público. Tipos.
3. T-3 Ruta pública `GET /public/venues/{id}/promotions` + schema + tests.
4. T-4 `VenuePromotionForm` (incluye el campo de texto de la oferta especial) + tests.
5. T-5 `VenuePromotionsManager` (lista, contador, upsell, baja de plan) + tests.
6. T-6 Página `promociones.astro`, presentación, `resolveVenueUpsellPlans`.
7. T-7 `VenuePromotions.astro` + `[slug].astro` + `VENUE_DETAIL_SECTION_BODY`.
8. T-8 `promoBadge` en las rutas de lista, consulta batch, `VenueCard`, `toVenueCardProps`.
9. T-9 i18n es, en, pt y prefijos del cliente.
10. T-10 e2e y quality gate (guards, session-blind).

## 15. Linear

Canonical tracking: HOS-2271. Épica: HOS-2252. Previa: HOS-2270.
