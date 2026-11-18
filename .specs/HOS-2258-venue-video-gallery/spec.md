---
title: Ficha de local - galería con video (pro y premium)
linear: HOS-2258
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - api
  - web
  - billing
---

# Ficha de local: galería con video

## 1. Resumen

Los alojamientos ya cargan y muestran videos (YouTube, Vimeo, Dailymotion). Los locales tienen la columna `venues.videos` pero no la pantalla del editor ni el bloque en la ficha. La página de presentación de «Comer y salir» ya promete «videos si tenés».

Esta spec agrega: sección de videos en el editor del local, bloque de videos en la ficha pública, y un **gate real** con `can_embed_video`. Esa clave ya existe en el catálogo, pero hoy **ningún** plan de local la tiene: la función queda oculta hasta HOS-2280 (additive grant).

Hija de la épica HOS-2252. Fase 1: no agrega claves ni migraciones de catálogo. **Sí toca una constante del catálogo en código** (un trait nuevo en `LISTING_SECTIONS`), que merece una revisión explícita (sección 6.1 y R-1).

**Decidido (owner, 16/11/2026, decisión 6):** el video se restringe por plan **ya en la fase 1**, con el trait `videos` en `LISTING_SECTIONS` (venue) gateado por `can_embed_video`. La sesión de billing de la épica HOS-1352 dio su OK con condiciones (sección 6.8). Hasta que HOS-2280 otorgue la clave, la función y su fila en la tabla de planes quedan **ocultas**.

## 2. Problema

- Hoy `venues.videos` es **escribible y público sin ningún gate**. El dueño puede mandar `videos` por `PATCH /api/v1/protected/venues/:id` y el valor sale en el payload público. La ficha simplemente no lo dibuja. Es decir: el contrato ya filtra mal antes de que exista la pantalla.
- El issue cita como "patrón a copiar" `gateVideoEmbed` en `accommodation/protected/patch.ts:69-76`. **Ese middleware ya no existe**: HOS-1416 lo sacó con el billing viejo. Lo que queda en ese archivo es el rastro de un override que nadie setea (`ctx.get('accommodationVideosOverride')`). El mecanismo vigente es el **catálogo de secciones**: un trait con `entitlementKey` y `fields` (`packages/schemas/src/catalog/listing-sections.ts:351`), proyectado en la lectura pública y gateado en la escritura por el pipeline de autorización.
- Sin gate, al habilitar la pantalla cualquier plan cargaría videos. Con el gate, ningún plan los cargaría hasta que HOS-2280 los asigne: es el estado buscado.
- Las descripciones traducidas de alojamiento filtraban videos aun sin el entitlement (HOS-2191). Hay que confirmar que en local no existe ese camino (sección 5.4).

## 3. Objetivos

- G-1. Editor del local con una sección de videos (enlaces YouTube/Vimeo/Dailymotion), igual que alojamiento.
- G-2. Ficha pública con un bloque de videos bajo la galería, con el mismo componente de carga diferida.
- G-3. Gate con `can_embed_video` por el catálogo: sin la clave no se escribe (403) ni se publica por **ningún** camino.
- G-4. Baja de plan: se oculta en lectura, **nunca se borra** (decisión 6 del owner).
- G-5. Sin claves, límites ni migraciones nuevas.

## 4. No-objetivos

- NG-1. Asignar `can_embed_video` a planes de local: HOS-2280.
- NG-2. Videos en experiencia. La sección `media` de experiencia no gana trait.
- NG-3. Subida de archivos de video propios (sólo enlaces externos, como alojamiento).
- NG-4. Nuevo límite de cantidad como clave del catálogo (se acota con Zod, ver 6.3).
- NG-5. Reescribir la descripción del dueño (no se hace `stripVideoEmbeds` sobre el texto, ver 5.4).

## 5. Estado actual del código (verificado en `origin/staging`)

### 5.1 Datos y contrato del local

- Columna: `packages/db/src/schemas/venue/venue.dbschema.ts:174` (`videos: jsonb('videos').$type<Video[]>()`), con nota HOS-372.
- La sección `media` del local: `packages/schemas/src/catalog/listing-sections.ts:66`, `common: true`, `fields: ['videos']`, **sin traits** (la de alojamiento, línea 351, sí tiene el trait `videos`).
- `VenuePublicSchema` incluye `videos` (`packages/schemas/src/entities/venue/venue.access.schema.ts:107`) y el protegido también (`:349`).
- Escritura: el body del PATCH es `VenueOwnerUpdateInputSchema` con `videos: true` (`packages/schemas/src/entities/venue/venue.crud.schema.ts:205`). El elemento es `VideoSchema` de dominio (`packages/schemas/src/common/media.schema.ts:120`): exige `moderationState` y `url` http/https; `caption` 3-100 si existe. La web de alojamiento usa en cambio un `HttpVideoSchema` flexible que **fabrica** `moderationState: APPROVED` (`accommodation.http.schema.ts:210`, `:795-830`). Para el local no existe ese equivalente: un cliente tendría que mandar él mismo `moderationState`.
- Lectura: `venue.media-read.ts` compone `media.videos` desde la columna (`packages/service-core/src/services/venue/venue.media-read.ts:43`, `composeListingMedia({ rows, videos: entity.videos })`). Es decir, el payload tiene el video **dos veces**: `videos` y `media.videos`.
- Ruta PATCH del local: `apps/api/src/routes/venue/protected/patch.ts:49`. Declara `listingAccess` con `listingSection` pero **no** `sectionTraits`. La de experiencia sí (`experience/protected/patch.ts:73`, con `sectionTraitsTouchedByBody`).

### 5.2 Cómo se hace efectivo un trait

- Escritura: el pipeline recibe `sectionTraits` y exige la clave de cada trait tocado (`packages/verticals/src/authorization/resolve-listing-access.ts:211-222`). `sectionTraitsTouchedByBody` considera tocado un trait si algún campo viene `!= null` (`packages/schemas/src/catalog/sections-touched.ts:58-75`): **un `videos: []` cuenta como tocado**, un `videos: null` no.
- Lectura pública: `projectPublicListing` quita del payload los `fields` de todo trait cuyo estado no es `available` (`apps/api/src/utils/public-listing-projector.ts:91-130`). Lo usan **todas** las rutas públicas del local (`getBySlug`, `getById`, `list`, `getByDestination`) y la protegida `brochure.ts`. Eso cubre la columna `videos` pero **no** el `media.videos` anidado (el proyector sólo toca claves de primer nivel).
- Alojamiento lo cubre aparte: `public-accommodation-projection.ts:66-81` vacía `media.videos` y, además, hace `stripVideoEmbeds` de `description` y de `descriptionI18n` (HOS-2191).
- Estados por sección y trait para el editor: `GET /protected/venues/{id}/sections`; el esquema se deriva solo de `LISTING_SECTIONS` (`listing-section-states.schema.ts:19-25`), así que el trait aparece sin código extra.

### 5.3 Editor y ficha de alojamiento (lo que se reutiliza)

- Widget del editor: `apps/web/src/components/host/editor/VideoSection.client.tsx` (188 líneas) + `use-video-section.ts`. El hook **está atado a alojamiento**: recibe `accommodationId` y llama `accommodationEditApi.update({ data: { media: { videos } } })` (`use-video-section.ts:168`). Valida en cliente `http(s)` y título 3-100.
- Bloque público: `apps/web/src/components/accommodation/VideoSection.astro`. Fachada diferida (póster + botón, el `<iframe>` recién al clic). La URL del dueño **nunca** va a un `src`: `resolveVideoEmbed` (`apps/web/src/lib/video-embed.ts:158`) extrae el id, lo valida y reconstruye la URL desde una plantilla fija. Es un borde de seguridad. Sus claves i18n son `accommodations.detail.videos.*`.
- Filtro de moderación: la transformación de alojamiento descarta todo video sin `moderationState === 'APPROVED'` (`apps/web/src/lib/api/transforms.ts:1044-1075`, HOS-1022).
- **No hay validación de proveedor en escritura.** El servidor sólo pide http/https; la lista de proveedores reconocidos se aplica al **renderizar**. Es el comportamiento actual de alojamiento y se mantiene.

### 5.4 Caminos por los que un video podría salir sin el entitlement (revisión para el criterio 4 del issue)

| Camino | Existe en local | Estado |
|---|---|---|
| Columna `videos` en el payload público | Sí | Hoy se filtra; la cubre el trait (6.1) |
| `media.videos` anidado | Sí | **No** lo cubre el proyector genérico: hay que extenderlo (6.2) |
| Descripción / `descriptionI18n` con un enlace de video | El texto existe, pero `VenueDescription.astro` no renderiza embeds (no hay `iframe` ni resolución de proveedor en esa ruta) | No es un camino de embed: sería texto plano. No se reescribe el texto del dueño. Se agrega un test que lo fije |
| "Similares" | No existe `similar` para local (sí para alojamiento, `accommodation/public/similar.ts`) | N/A |
| Brochure PDF | `brochure.ts` pasa por `projectPublicListings` y no menciona video | Cubierto por el trait |
| JSON-LD (`VenueJsonLd.astro`) | Sin referencias a video (búsqueda hecha) | Un test lo fija (T-2) |
| Contexto del chat de IA | Sin referencias a video en `apps/api/src/services/ai-context/` (búsqueda hecha) | Un test lo fija (T-2) |
| Admin (staff) | Escribe por rutas admin, sin gate de plan | Fuera de alcance |

### 5.5 La tabla de planes se genera del catálogo

`buildCatalogComparisonGroup({ vertical: 'venue' })` emite **una fila por cada trait con clave** (`apps/web/src/components/billing/plan-comparison-catalog-rows.ts:~200-240`). Agregar el trait `videos` crea automáticamente una fila nueva en la tabla de planes de local, con `status: 'available'` fijo (`buildRow`) y todas las celdas en "no incluido". Además `VENUE_CATALOG_PRESENTATION` es exhaustivo sobre **secciones**, no sobre traits, y la etiqueta cae a `billing.comparison.row.media.videos` si falta la presentación.

Efecto colateral real: sin más cambios, la página pública de planes de local mostraría "Videos: no incluido" en los tres planes. Es lo contrario de "queda oculta". Ver 6.4, que la oculta con `hideUntilGranted`.

## 6. Diseño

### 6.1 Catálogo (código, sin migración)

En `LISTING_SECTIONS.venue`, sección `media`, agregar:

```
traits: [{ id: 'videos', entitlementKey: K.CAN_EMBED_VIDEO, fields: ['videos'] }]
```

La sección sigue siendo `common: true` y sin `entitlementKey` propia: subir fotos no cambia. Sólo el trait se condiciona.

Esto **no** toca `entitlement-keys.ts`, ni `key-enums.ts`, ni genera SQL: la clave ya existe. No aplica G18 ni el procedimiento de migración de catálogo. Sí se corren los tests y guards que leen `LISTING_SECTIONS`: `packages/schemas/test/catalog/listing-catalog.guard.test.ts`, `listing-catalog.behavior.test.ts`, `sections-touched.test.ts`, `check-no-listing-dispatch`, y los de la tabla de planes (`plan-comparison-catalog-rows` tests). La épica dice que nada que toque el catálogo se mergea antes de la pasada final de HOS-1352; este cambio no toca **claves ni valores del catálogo**, sólo la estructura de secciones en código, pero se consulta con el owner (OQ-1).

### 6.2 API

1. `apps/api/src/routes/venue/protected/patch.ts`: agregar `sectionTraits: ({ body }) => sectionTraitsTouchedByBody({ vertical: 'venue', body })`, igual que experiencia. Un PATCH que toque `videos` sin la clave responde **403 `ENTITLEMENT_REQUIRED`** con `entitlementKey: 'can_embed_video'` (lo hace el pipeline; el error contract lo respeta). Un PATCH sin `videos` no cambia nada.
2. Proyección pública: extender `projectPublicListing` (o el paso posterior de venue en el mismo archivo, hoy `projectVenueMenuTraits`) para que, cuando un trait no está `available`, además de quitar `fields` vacíe `media.videos` si `media` es un objeto. Se hace **genérico por catálogo**, no con un `if (vertical === 'venue')`: el trait declara `fields: ['videos']` y el proyector ya sabe "quitar esos campos" a primer nivel; se le enseña el caso anidado `media.<field>`. Alojamiento mantiene su proyección propia sin cambios.
3. Schema HTTP de videos del local: extraer el `HttpVideoSchema` de alojamiento a `@repo/schemas/common` (`ListingVideoInputSchema`: `url` http/https, `caption` opcional 3-100, **sin** `moderationState` de entrada) y usarlo en `VenueOwnerUpdateInputSchema` para `videos`. El servidor fija `moderationState: APPROVED` al convertir (paridad con alojamiento: "los videos del dueño salen publicados"). La moderación posterior es del staff por la ruta admin; la ficha sólo muestra `APPROVED` (6.5). No se acepta `moderationState` del cliente.
4. Tope de cantidad: `.max(6)` en ese schema (sin clave de límite; ver OQ-4).
5. Lectura protegida del dueño (`GET /protected/venues/:id`): **no** se proyecta por trait. El dueño ve sus videos cargados aunque haya bajado de plan (decisión 6: "se respeta lo cargado"). El gate de lectura es público únicamente. Mismo criterio que `getEvents.ts` ("la lectura queda abierta, la escritura es donde se aplica el plan, la ficha donde se retiene la muestra").

### 6.3 Servicio

Sin cambios de `VenueService`. La conversión del body (`videos` con `moderationState` fijo) va en el mapeo del body de `updateOwn` o en un `transform` del schema (elegir el que ya usa el resto de campos del PATCH; ver T-3).

### 6.4 Tabla de planes (efecto colateral del trait)

Se agrega a `VENUE_CATALOG_PRESENTATION.media.traits.videos` una presentación con `rowId: 'venueVideos'`, `labelKey`, `descKey` e ícono, y se **extiende `CatalogRowPresentation` con `hideUntilGranted?: boolean`** que `buildRow` y la tabla respetan: la fila se omite mientras ninguna columna activa otorgue `can_embed_video`. La presentación de videos lo declara en `true`. Al aplicarse HOS-2280 la fila aparece sola, sin deploy de web ni cambio en esta presentación.

**Decidido (owner, 16/11/2026, decisión 28):** la fila se **oculta**; **no** se muestra como «Próximamente». Discrepancia anotada: el comentario de coordinación con la sesión de billing describía la fila de videos como «Próximamente» en los planes de venue. Esa redacción quedó superada por la decisión 28, posterior. El mecanismo general (ocultar toda fila sin grant) es de HOS-2262, sección 6.3; este issue sale primero (ventana de redeploy de billing) y por eso introduce el campo en el tipo compartido, y HOS-2262 lo reusa y lo extiende a sus filas curadas.

Los textos finales de la fila son de HOS-2262; aquí van los mínimos es/en/pt (`billing.comparison.row.venueVideos`, `billing.comparison.rowDesc.venueVideos`). El estado `upcoming` no se usa.

### 6.5 Web: editor

- Generalizar el widget en vez de copiarlo: `use-video-section.ts` recibe una función `save(videos)` en lugar de un `accommodationId` fijo. Alojamiento le pasa su `accommodationEditApi.update({ media: { videos } })`; el local le pasa un `PATCH` al endpoint del local con `{ videos: [...] }` **de primer nivel** (el local no usa `media` como entrada: `venue.crud.schema.ts:195-209`).
- `VideoSection.client.tsx` ya está en `host/editor/` y su copy es `host.properties.editor.video.*` ("tu propiedad"). Se **mueve a un componente compartido** `components/listing/editor/VideoSection.client.tsx`, con el copy parametrizado por prefijo de i18n (`host.properties...` para alojamiento, claves nuevas `listing.owner.editor.video.*` para local). No se mete dentro de `MediaSection.client.tsx`, que ya tiene 883 líneas (el tope del repo es 500).
- Montaje: `apps/web/src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar/fotos.astro` (hoy sólo `MediaSection`). Se renderiza el widget **sólo si la sección `media` del listado tiene el trait `videos`**, mirando `resolution.sectionStates` (ya expuesto, `resolve-listing-editor-page.ts`), no comparando la vertical con un literal (G-FAC-05 y G1). Estados:
  - trait `available`: el widget completo.
  - trait `locked`: un panel de bloqueo con upsell que nombra el plan, leído del catálogo con `resolveUnlockingPlanName` (patrón `section-upsell-plan.ts`; se agrega `videos` a `VenueUpsellPlans`). Si **ningún** plan la incluye (Fase 1), no se muestra nada: la función está oculta.
  - trait ausente (experiencia): no se monta nada.
  El panel reusa `VenueSectionLockedPanel.client.tsx`.
- El detalle del listado ya trae los videos para el dueño: ampliar `readListingMedia` (`apps/web/src/lib/listing/listing-editor-detail.ts:74`) con `videos`.

### 6.6 Web: ficha pública

- Mover/generalizar `VideoSection.astro` a `components/listing/ListingVideoSection.astro` con el prefijo de i18n como prop (hoy `accommodations.detail.videos.*`); la de alojamiento pasa su prefijo actual y no cambia de aspecto. Para local, claves nuevas `venue.detail.videos.title/play/playNamed/openExternal`.
- En `apps/web/src/pages/[lang]/comer-y-salir/[slug].astro`, justo debajo del bloque de galería (`:442-451`, `venue-detail__gallery`), no dentro del registro de secciones de cuerpo (`venue-detail-sections.ts:40` mantiene `media: false`: la galería es fija y el video va con ella).
- Los videos se leen de `raw.media.videos` (ya proyectado), se normalizan y se filtran por `moderationState === 'APPROVED'` con la misma función que usa alojamiento (se extrae `normalizeListingVideos` de `transforms.ts:1044` para no duplicarla). El componente se oculta solo si no queda ninguno.
- La CSP ya admite los `frame-src` de los proveedores (alojamiento los usa). Verificar que la ficha del local use el mismo layout/cabeceras.
- Dailymotion degrada a enlace externo si falta `PUBLIC_DAILYMOTION_PLAYER_ID` (HOS-1217), comportamiento heredado.

### 6.7 Baja de plan

Decisión 6: se respeta lo cargado, se frena lo nuevo, se oculta lo que el plan no incluye, no se borra. El mecanismo cubre las tres: la escritura da 403 (frena lo nuevo), la proyección pública vacía videos (oculta), y la lectura del dueño los sigue mostrando (no se borra). Al volver a un plan con la clave, reaparecen solos. No hace falta cron ni data-migration.

### 6.8 Coordinación con la sesión de billing (HOS-1352)

La sesión de la épica de billing dio OK a gatear el video en la fase 1 con estas condiciones, que son parte del alcance:

1. **Aviso al mergear.** Si este PR se mergea a `staging` antes del redeploy de la pasada final de HOS-1352, sale en ese redeploy. Al mergear hay que **avisar a la sesión de billing** para que sume a su re-smoke: (a) la tabla de planes de venue **no** muestra una fila de videos (oculta hasta HOS-2280; la coordinación original decía «Próximamente», superada por la decisión 28); (b) el PATCH y el payload público de videos del local quedan gateados por `can_embed_video`. El PR lleva `status-needs-smoke-staging`.
2. **Nota explícita en el PR.** La descripción debe decir que gatear `venues.videos` oculta los videos a los planes sin la clave, y que es **intencional, no una regresión**. Datos verificados por el owner: staging tiene 0 videos de venue, producción 0, y los seeds no cargan videos de venue; no hay contenido existente que se oculte.

## 7. Datos y migraciones

- Estructural: ninguna. La columna existe.
- Extras: ninguna.
- Seed / data-migration: ninguna.
- **Datos existentes (verificado, 16/11/2026):** staging 0 locales con videos, producción 0, y los seeds no cargan videos de venue. No hay nada que ocultar ni migrar. Antes del merge se repite la consulta read-only (`hops psql`) por si cambió algo; si apareciera una fila, se avisa al owner (OQ-3).

## 8. Criterios de aceptación

- AC-1. Dado un local cuyo dueño tiene `can_embed_video` en `VENUE`, cuando guarda tres enlaces de YouTube/Vimeo en el editor, entonces se guardan y la ficha pública los muestra en un bloque «Videos» bajo la galería, con fachada diferida (cero `<iframe>` hasta el clic).
- AC-2. Dado un dueño **sin** la clave, un `PATCH` con `videos` no vacío responde 403 `ENTITLEMENT_REQUIRED` con `entitlementKey: 'can_embed_video'` y no cambia nada. Un `PATCH` con `videos: []` también (cuenta como tocado). Un `PATCH` sin `videos` sigue funcionando.
- AC-3. Dado un local con videos guardados y un dueño sin la clave, la ficha pública responde sin `videos` **ni** `media.videos` en `getBySlug`, `getById`, `list`, `getByDestination` y el brochure.
- AC-4. Dado ese mismo dueño, `GET /protected/venues/:id` sigue devolviendo sus videos (no se pierden).
- AC-5. Dado un enlace que no es de un proveedor reconocido (por ejemplo `https://youtube.com.evil.com/...`), la ficha no lo renderiza ni como `<iframe>` ni como enlace. Un video con `moderationState` distinto de `APPROVED` no se muestra.
- AC-6. El cliente no puede fijar `moderationState`: un body con `videos[0].moderationState = 'REJECTED'` queda guardado como `APPROVED` o es rechazado por forma (decidir en T-3 y fijarlo con un test).
- AC-7. Un body con 7 videos responde 400 `VALIDATION_ERROR`.
- AC-8. En el editor, con el trait `locked` y algún plan de local que incluya la clave, aparece el panel de bloqueo nombrando ese plan; sin ningún plan que la incluya (hoy), el editor no muestra la sección ni el upsell. Con el trait `available`, el widget guarda sin tocar otras secciones.
- AC-9. El editor de experiencia no muestra la sección de videos y su PATCH no cambia.
- AC-10. Los tests y el comportamiento de alojamiento no cambian (bloque, editor, copy).
- AC-11. Mientras ningún plan de local otorgue `can_embed_video`, la tabla pública de planes de local **no muestra** la fila de videos (ni «No incluido» ni «Próximamente»); cuando un plan la otorga, la fila aparece sin cambiar código.
- AC-12. El texto de la descripción del dueño no se modifica en ninguna respuesta, y ninguna ruta del local arma un embed a partir de él.
- AC-13. `cacheable-pages-are-session-blind.guard.test.ts` y `check-no-listing-dispatch` siguen verdes.

## 9. Plan de pruebas

Unit
- `packages/schemas/test/catalog/*`: el trait nuevo aparece en `sections-touched` (`videos: []` cuenta como tocado, `null` no), en los estados de sección, y la guardia de catálogo sigue verde.
- `packages/schemas/test/common/listing-video-input.schema.test.ts`: forma, tope de 6, sin `moderationState` de entrada.
- `apps/api/test/utils/public-listing-projector.test.ts`: `media.videos` vaciado con el trait no disponible, conservado con el disponible; `media` ausente o no objeto no rompe (AC-3).
- `apps/web/test/components/listing/ListingVideoSection.test.ts` (lectura de fuente) y de alojamiento (regresión, AC-10).
- `apps/web/test/lib/video-embed.test.ts`: ya existe; se agrega el caso de dominio señuelo si falta (AC-5).
- `apps/web/test/components/listing/editor/VideoSection.test.tsx`: guardado, validación de URL y título, estados `locked`/ausente (AC-8, 9).

Integración / API
- `apps/api/test/routes/venue/protected/patch-videos.test.ts`: AC-2, 6, 7. Un test con clave y otro sin. Verificar que el 403 sale del pipeline y cuenta `evaluatedSteps`.
- `apps/api/test/routes/venue/public/*`: AC-3 sobre las cuatro rutas y el brochure.
- Un test que fije AC-12: descripción con una URL de YouTube sale idéntica y la ficha no resuelve embed.
- `apps/web/test/components/billing/plan-comparison-catalog-rows.test.ts`: la fila `venueVideos` sale con `hideUntilGranted` y no se renderiza sin grant; con un plan que la otorga, sí (AC-11).

E2E (Playwright): editor de local con un usuario con la clave sembrada por fixture, guardar, abrir la ficha, ver la fachada. Sin la clave: 403 visible en el editor.

Guards: `check:guards`, `check-no-listing-dispatch` (G-FAC-05), `check-catalog-key-usage` (G3, la clave ya está), `scripts/check-catalog-sql.ts` (G18, debe seguir sin diff).

## 10. Riesgos

- R-1. **Toca `LISTING_SECTIONS`.** Es el catálogo en código. Un trait nuevo cambia el esquema de estados de sección de local, la tabla de planes y el comportamiento de escritura de todos los dueños de local. Mitigado con los tests de 6.1 y la consulta al owner (OQ-1).
- R-2. **Los videos ya guardados desaparecen de la ficha al mergear**, porque ningún plan de local tiene la clave. Es intencional (condición 2 de 6.8). Riesgo bajo: staging, producción y seeds tienen 0 videos de venue.
- R-3. **Tabla de planes.** Sin ocultar la fila, la tabla muestra "Videos: no incluido". Cubierto en 6.4 con `hideUntilGranted`. Los textos finales son de HOS-2262.
- R-7. **Ventana de redeploy de billing.** Si este PR entra al redeploy de la pasada final de HOS-1352 sin que billing lo sepa, su re-smoke no lo cubre. Cubierto por la condición 1 de 6.8.
- R-4. **Proyección anidada.** Enseñar al proyector a vaciar `media.<campo>` afecta a toda sección con traits y campos anidados. Hoy sólo `media.videos`; el test de AC-3 lo fija.
- R-5. **Mover componentes compartidos** (`VideoSection` del editor y de la ficha) toca alojamiento. Cubierto por los tests de regresión de AC-10.
- R-6. `fotos.astro` es compartida con experiencia: el widget debe decidirse por el estado del trait, nunca por la vertical (G-FAC-05).

## 11. Preguntas abiertas para el owner

- OQ-1. **Decidido (owner, 16/11/2026): se acepta tocar `LISTING_SECTIONS` en la fase 1.** El trait `videos` no crea claves ni valores, solo estructura de código, y es lo que habilita el gate. Billing de la épica dio OK con las condiciones de 6.8. Se descartaron esperar a la pasada final y el gate solo por `enforceUserGate`.
- OQ-2. **Decidido (owner, 16/11/2026): fila de videos antes del grant.** Se **oculta** hasta que algún plan la otorgue (HOS-2280); no se muestra «Próximamente» ni «No incluido». Supera la redacción «Próximamente» de la coordinación con billing.
- OQ-3. **Decidido (owner, 16/11/2026): videos ya cargados.** No hay: staging 0, producción 0, seeds sin videos de venue. Sin acción; se repite la consulta antes del merge.
- OQ-4. **Tope de videos y proveedores.** **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #5): opción 1.** Máximo 6 videos, de YouTube, Vimeo o Dailymotion. Alojamiento no tiene tope y acepta tres proveedores.
  1. Tope de 6 por Zod, los mismos tres proveedores. Recomendada.
  2. Sin tope, igual que alojamiento. Pro: paridad. Contra: un local puede cargar cientos de fachadas.
  3. Sólo YouTube y Vimeo (como dice el issue), sin Dailymotion. Pro: menos superficie y sin la dependencia del Player ID. Contra: dos caminos de render distintos para dos verticales.
- OQ-5. **403 en lugar de recorte silencioso.** **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #6): opción 1.** Si el plan no incluye videos, guardar uno da un error claro (403) y no se guarda nada. Alojamiento neutralizaba lo no entitulado sin rechazar el PATCH entero (HOS-216). El pipeline de catálogo rechaza el PATCH con 403. Como el widget de videos guarda por separado, el 403 sólo afecta a quien manda `videos`.
  1. 403 (lo que hace experiencia con sus traits). Recomendada.
  2. Recortar `videos` y devolver 200. Contra: oculta al cliente que no se guardó nada.

## 12. Etiquetas de smoke y Novedades

- `status-needs-smoke-staging` (obligatoria, condición de billing): la ficha con una fachada real de YouTube/Vimeo, la CSP de `frame-src`, y el 403. Requiere un local de staging con el grant (después de HOS-2280); hasta entonces el smoke sólo cubre "oculto y sin romper": fila de videos ausente en la tabla de planes de venue, y PATCH y payload público gateados por `can_embed_video` (los dos puntos de re-smoke de 6.8).
- `status-needs-smoke-local`: sirve para el editor y el gate (fixture con clave).
- What's New: **sí aplica, pero se escribe con HOS-2280**, que es cuando la función se vuelve visible. Mientras está oculta no se anuncia.

## 13. Dependencias

- HOS-2280 la vuelve visible (asigna `can_embed_video` a locales pro/premium) y pasa la fila a `available`.
- HOS-2262 (textos de la tabla de planes y mecanismo general de ocultar filas sin grant; este issue introduce el campo `hideUntilGranted` en `CatalogRowPresentation`).
- Sesión de billing de HOS-1352: avisar al mergear (6.8).
- HOS-2284 (presentación y Novedades) la menciona.
- Relacionada con HOS-2191 (mismo criterio de "ningún camino").
- Coordinación con la pasada final de HOS-1352: condiciones de 6.8 (OQ-1 ya decidida).

## 14. Desglose en tareas

1. T-1. Repetir la consulta read-only de videos de venue en staging y producción antes del merge (esperado: 0); informar (0,1 día).
2. T-2. Trait `videos` en `LISTING_SECTIONS.venue.media`; correr tests y guards de catálogo; verificar JSON-LD, brochure y contexto de IA (0,75 día).
3. T-3. `ListingVideoInputSchema` compartido, uso en `VenueOwnerUpdateInputSchema`, `moderationState` fijado por servidor, tope de 6 + tests (0,75 día).
4. T-4. `sectionTraits` en el PATCH del local + tests AC-2/6/7 (0,5 día).
5. T-5. Proyector: vaciado de `media.<campo>` anidado + tests de las cuatro rutas y del brochure (0,75 día).
6. T-6. Tabla de planes: presentación `venueVideos` con `hideUntilGranted` (campo nuevo en `CatalogRowPresentation`), claves i18n mínimas es/en/pt, test (0,5 día).
7. T-7. Generalizar `use-video-section` y mover `VideoSection` del editor a `components/listing/editor/`, regresión de alojamiento (0,75 día).
8. T-8. Montaje en `fotos.astro` con estados del trait, upsell por catálogo, `readListingMedia` con `videos`, i18n del editor (0,75 día).
9. T-9. `ListingVideoSection.astro` compartido, `normalizeListingVideos`, montaje en la ficha del local, i18n `venue.detail.videos.*` (0,75 día).
10. T-10. Tests e2e y smoke (0,5 día).
11. T-11. En el PR: nota explícita de intencionalidad (6.8, condición 2), etiqueta `status-needs-smoke-staging`, y al mergear avisar a la sesión de billing con los dos puntos de re-smoke (0,1 día).

## 15. Linear

Canonical tracking:
HOS-2258
