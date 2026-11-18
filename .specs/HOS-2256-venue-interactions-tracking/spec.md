---
title: Ficha de local - registro de clics (WhatsApp, teléfono, mapa, web, Instagram, entradas)
linear: HOS-2256
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - db
  - api
  - web
---

# Ficha de local: registro de clics

## 1. Resumen

Hoy de un local sólo se cuentan las **vistas** de la ficha (`entity_views`). Para las métricas de pro y premium (HOS-2261) y para las estadísticas por evento (HOS-2265) hace falta medir también **qué hace el visitante**: a qué canal toca. Esta spec define el mecanismo de registro: tabla nueva `entity_interactions`, endpoint público de captura, beacon del lado cliente y limpieza por retención a 120 días con resumen mensual (rollup) desde el primer día.

Hija de la épica HOS-2252. Fase 1: no toca el catálogo, se puede hacer ya. Es la base de HOS-2261 (lectura y panel) y HOS-2265 (por evento). HOS-2255 (botón «Comprar entrada») es el primer consumidor de `TICKET_CLICK`.

Esta spec **sólo escribe** datos. Las consultas de agregación, las rutas del dueño y el panel son de HOS-2261.

## 2. Problema

- `entity_views` guarda una fila por vista. No tiene dónde poner "tipo de clic" ni "id de evento".
- El beacon actual (`EntityViewTracker.client.tsx`) sólo manda vistas. Los locales no mandan ningún evento a PostHog (decisión del owner en HOS-734, `EntityViewTracker.client.tsx:7-14`).
- Sin esto el panel de pro/premium sólo podría mostrar vistas, que ya ve el plan básico.

## 3. Objetivos

- G-1. Registrar un clic por canal en la ficha pública del local: teléfono, mapa o cómo llegar, web, Instagram, «Comprar entrada» (con el id del evento) y WhatsApp (botón nuevo, ver 7.8 y OQ-1).
- G-2. Anónimo, igual que las vistas: hash de visitante diario, sin IP ni datos personales.
- G-3. Mecanismo que no bloquea la navegación (`navigator.sendBeacon`).
- G-4. Modelo que soporta objetivos a nivel evento (columna `event_id`) para HOS-2265, sin otra migración.
- G-5. La ficha sigue "session-blind": todo el tracking es del lado del cliente.
- G-6. Mismo filtro de bots que las vistas. Retención de 120 días y rollup mensual desde el primer día (decidido por el owner, 16/11/2026).

## 4. No-objetivos

- NG-1. Lectura, agregación, rutas del dueño y panel: HOS-2261.
- NG-2. Medir la impresión de un evento en la ficha (vista del evento): decide HOS-2265. Esta spec sólo deja el valor `EVENT_IMPRESSION` en el enum para no obligar a otra migración (ver 7.1).
- NG-3. Eventos de PostHog para el local. No se agregan (OQ-4).
- NG-4. Otras entidades (alojamiento, experiencia, post). El modelo es genérico por `entity_type`, pero el Zod de captura sólo admite `VENUE` hoy.
- NG-5. (Eliminado el 18/11/2026.) El botón de WhatsApp **sí** entra en esta spec: ver 7.8 y OQ-1.

## 5. Estado actual del código (verificado en `origin/staging`)

### 5.1 Vistas

- Tabla `entity_views`: `packages/db/src/schemas/entity-view/entity_view.dbschema.ts:27`. Columnas: `entity_type` (enum `entity_type_enum`, que ya trae `VENUE`), `entity_id` (sin FK, polimórfico), `visitor_hash`, `is_authenticated`, `viewed_at`. Append-only, sin columnas de auditoría, purga a 95 días.
- Endpoint: `POST /api/v1/public/views`, `apps/api/src/routes/views/capture.ts:60`. Filtro de bots con `isBotUserAgent` (`@repo/utils`) antes de tocar la base, siempre responde 202 (también ante error de DB), `customRateLimit 30/60s`, hash con `computeVisitorHash` (`apps/api/src/utils/visitor-hash.ts`).
- Beacon web: `apps/web/src/lib/analytics/view-capture.ts`. `postBeacon` (línea 127) intenta `sendBeacon` con `Blob application/json` y cae a `fetch(keepalive)`. Nunca lanza.
- Montaje: `EntityViewTracker` con `client:idle` en `apps/web/src/pages/[lang]/comer-y-salir/[slug].astro:488`.
- Dedup al leer: `unique = COUNT(DISTINCT visitor_hash)`, `total = COUNT(DISTINCT (visitor_hash, bucket de 30 min))` (`packages/db/src/models/entity-view/entity-view.model.ts:349-420`).
- Retención: `ENTITY_VIEWS_RETENTION_DAYS = 95` (`apps/api/src/cron/jobs/entity-views-purge.job.ts:28`). Hay rollup mensual de `entity_views` (`entity_view_monthly_rollups`).
- Privacidad documentada en `docs/guides/view-tracking-privacy.md`: sin cookie, sin banner de consentimiento, sal diaria.

### 5.2 Precedente directo: `partner_logo_clicks` (HOS-1063)

El repo **ya resolvió este problema una vez** para los aliados y descartó explícitamente las dos opciones que el issue lista como alternativa:

- `packages/db/src/schemas/partner/partner_logo_click.dbschema.ts:1-34`: un clic escrito en `entity_views` "haría que la tarjeta de vistas sobre-informe" (OQ-2 opción 1, rechazada). Una columna `event_type` en `entity_views` (opción 2) se rechaza porque "falla abierta": toda consulta existente tendría que aprender un filtro nuevo y la que se olvide cuenta de más sin que nada parezca mal.
- Endpoint gemelo: `apps/api/src/routes/partner-logo-clicks/capture.ts:66` (mismos filtros, mismo 202 siempre, mismo hash). Beacon: `sendPartnerLogoClickBeacon` (`view-capture.ts:108`).
- Dedup al leer idéntico al de vistas, para que los dos números sean comparables (`packages/db/src/models/partner/partner-logo-click.model.ts`).
- Purga en el mismo cron que las vistas (`entity-views-purge.job.ts`) y rollup mensual (`view-monthly-rollup.job.ts`), porque "el rollup tiene que existir desde la primera migración o nunca".

Conclusión: la opción B del issue (columna de tipo en `entity_views`) ya fue evaluada y rechazada en este repo. Se sigue el mismo molde con una tabla propia, pero **genérica** en vez de una por entidad.

### 5.3 Dónde están los elementos a medir en la ficha del local

- Teléfonos (móvil y fijo) y web de `contactInfo`: `apps/web/src/components/venue/VenueContactBlock.astro` (`toTelHref`, línea 67; ancla de sitio web con `rel="noopener noreferrer"`).
- Redes sociales (Instagram, etc.): mismo archivo, lista `SOCIAL_LINKS`.
- Mapa: `apps/web/src/components/venue/VenueAddress.astro:52` ("Ver en el mapa", `buildVenueMapUrl`).
- **WhatsApp: no existe en la ficha del local.** `VenueContactBlock.astro` lo dice dos veces: `whatsapp` se sacó de `VenueSocialNetworks` (HOS-1076) y de `contactInfo` público (HOS-2042) porque el número se gatea por visitante en otro endpoint. `packages/schemas/src/entities/venue/venue.access.schema.ts:37-39` lo confirma. El criterio del issue pide medirlo y el owner decidió (18/11/2026) agregar el botón ahora: ver 7.8 y OQ-1.
- «Comprar entrada»: no existe todavía. Lo agrega HOS-2255 (`.specs/HOS-2255-venue-events-ticket-link/spec.md`).

### 5.4 Los eventos del local no tienen id estable

`replaceVenueEvents` borra y reinserta toda la agenda en cada guardado (`packages/service-core/src/services/venue/venue.events.ts:20-27`, `:243-275`). El propio archivo dice que cuando algo referencie un evento "this function grows a diff". Ese día es éste. Guardar `event_id` en cada clic sin ids estables deja los clics huérfanos en cada guardado de la agenda. Eso se extrajo a **HOS-2291** (ids estables de eventos, antes la tarea T-1 de HOS-2255). **HOS-2256 depende de HOS-2291 sólo para `event_id`**; la tabla, el endpoint y los demás canales no.

### 5.5 Reglas de página sin sesión

`apps/web/test/pages/cacheable-pages-are-session-blind.guard.test.ts` recorre `src/pages` y los `.astro` de componentes. Excluye las islas `.tsx`, que corren en el navegador. El tracking va entonces en una isla React (como `EntityViewTracker`), nunca en el frontmatter de la página.

## 6. Decisión de modelo

| Opción | Qué es | Pro | Contra |
|---|---|---|---|
| A (recomendada) | Tabla nueva `entity_interactions` (genérica por `entity_type`) | Falla cerrada: las consultas de vistas no cambian. Soporta `event_id`. Un solo lugar para HOS-2261, 2265 y futuras entidades. Mismo molde que `partner_logo_clicks`. | Una tabla más para purgar y respaldar |
| B | Columna `event_type` en `entity_views` | Una sola tabla | Rechazada en HOS-1063: falla abierta, infla vistas. Hay que tocar toda consulta de vistas (admin, accommodation, rollup) |
| C | Una tabla por tipo de clic | Máxima simplicidad por tabla | N tablas, N crons, N rollups. Sin ventaja |

Se elige A. El nombre sigue a la familia de telemetría vecina (`entity_views`, `partner_logo_clicks`: plural), no a la regla de "tablas nuevas en singular" que aplica a billing y verticals.

## 7. Diseño

### 7.1 Datos

**Enum pg nuevo** `entity_interaction_kind_enum` (en `packages/db/src/schemas/enums.dbschema.ts`, junto a `PartnerLogoClickDestinationPgEnum`, línea 448; enum TS y schema Zod en `packages/schemas/src/enums/`, mismo molde que `partner-logo-click-destination.*`). Valores, en mayúsculas como el resto de los enums del repo:

- `PHONE_CLICK`, `MAP_CLICK`, `WEBSITE_CLICK`, `INSTAGRAM_CLICK`, `TICKET_CLICK`, `WHATSAPP_CLICK`, `EVENT_IMPRESSION`.

`EVENT_IMPRESSION` entra ya aunque nadie lo emita todavía (`WHATSAPP_CLICK` lo emite el botón de 7.8): agregar un valor a un enum pg es barato pero obliga a coordinar migraciones entre hermanas, y la coordinación es lo caro. Un valor sin emisor no cambia ningún número.

Nota para HOS-2255: ellos asumieron `kind = 'ticket_click'` en minúsculas. El repo usa mayúsculas para enums pg; el valor es `TICKET_CLICK`.

**Tabla nueva** `entity_interactions` en `packages/db/src/schemas/entity-interaction/entity_interaction.dbschema.ts`. Lean y append-only, igual que `entity_views` (sin auditoría, sin soft delete, no extiende `BaseModelImpl`):

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK default random | |
| `entity_type` | `entity_type_enum` NOT NULL | Reusa el enum existente (ya tiene `VENUE`). El Zod de captura sólo admite `VENUE`. |
| `entity_id` | uuid NOT NULL | El local. Sin FK, polimórfico, como `entity_views.entity_id`. |
| `kind` | `entity_interaction_kind_enum` NOT NULL | |
| `event_id` | uuid NULL, FK a `venue_events(id)` **ON DELETE SET NULL** | Sólo para `TICKET_CLICK` y `EVENT_IMPRESSION`. Ver nota. |
| `visitor_hash` | text NOT NULL | Ver 7.5. |
| `occurred_at` | timestamptz NOT NULL default now() | |

Nota sobre el borrado del evento. Decidido (owner, 16/11/2026): `ON DELETE SET NULL`, no `CASCADE` (OQ-3). Con CASCADE, borrar un evento resta retroactivamente clics de «Comprar entrada» del total del local, y el total por canal deja de ser una medición del pasado. Con `SET NULL` el total del local se conserva y sólo se pierde el detalle por evento, que ya no tiene evento al que mostrarse.

Índices (en el schema Drizzle, que genera la migración estructural):

- `(entity_type, entity_id, kind, occurred_at)`: acceso principal del panel (HOS-2261).
- `(event_id, kind, occurred_at) WHERE event_id IS NOT NULL`: acceso por evento (HOS-2265).
- `(occurred_at)`: barrido de la purga.

**Carril de migración**

- Estructural (`pnpm db:generate`): enum, tabla, FK, índices. Último número al relevar: `0226_hos2192_location_exception_requests.sql`; el número real lo asigna `db:generate`.
- Extras (`packages/db/src/migrations/extras/`, idempotente, mismo molde que `034-host-trade-usage-review.constraints.sql`): `CHECK` de coherencia `event_id IS NULL` salvo que `kind IN ('TICKET_CLICK','EVENT_IMPRESSION')`. Drizzle no lo ve.
- Seed (data-migration): **ninguno**. No hay datos que sembrar. La regla de dual-write de seed no aplica.

### 7.2 Schemas Zod (`@repo/schemas`)

`packages/schemas/src/entities/entityInteraction/`:

- `EntityInteractionKindEnum` + schema (molde de `partner-logo-click-destination`).
- `TRACKABLE_INTERACTION_ENTITY_TYPES = [VENUE]` (distinto de `TRACKABLE_ENTITY_TYPES` de vistas, que admite seis).
- `INTERACTION_KINDS_BY_ENTITY_TYPE`: `VENUE` admite los siete valores.
- `EntityInteractionCaptureBodySchema`: `{ entityType, entityId (uuid), kind, eventId? (uuid) }` con `superRefine`: `kind` válido para el `entityType`; `eventId` obligatorio si `kind` es de evento; `eventId` prohibido si no.
- Claves de error `zodError.entityInteraction.*` en `packages/i18n/src/locales/{es,en,pt}/validation.json` (molde: `partnerLogoClick`, `validation.json:5165` en `es`).

### 7.3 Modelo y servicio

- `EntityInteractionModel` en `packages/db/src/models/entity-interaction/`, standalone como `EntityViewModel`. Métodos de esta spec: `insertInteraction` y `purgeOlderThan`. Las consultas de agregación las agrega HOS-2261 en el mismo archivo.
- `EntityInteractionService` en `packages/service-core/src/services/entityInteraction/`, método `capture`. Sin permiso (escritura pública anónima), igual que `EntityViewService.capture`. Pasos, todos silenciosos hacia afuera:
  1. Cargar el local por id; si no existe, no está publicado o está borrado: descartar.
  2. Si `eventId`: verificar que el evento pertenece a ese local (una consulta); si no: descartar. Esto impide que cualquiera siembre clics de un evento ajeno.
  3. Si el actor autenticado es el dueño del local: descartar (el dueño probando sus propios botones no es demanda). Ver OQ-5.
  4. Insertar.
  El servicio devuelve un resultado tipado (`recorded: boolean`, `reason`) para tests; el endpoint nunca lo expone.

El paso 1 agrega una lectura por beacon que el endpoint de vistas no hace. Es aceptable: el límite es 30 req/60 s por IP y los clics son raros frente a las vistas. Es lo que hace útil el dato: sin esa verificación, un script puede inflar el CTR de cualquier local.

### 7.4 API

`POST /api/v1/public/interactions`, `apps/api/src/routes/interactions/capture.ts` (+ `index.ts`, registro en `apps/api/src/routes/index.ts` junto a `partnerLogoClickRoutes`, línea ~428, y `route-manifest.json`). Tier público, `skipAuth: true`, `customRateLimit: { requests: 30, windowMs: 60000 }`.

Contrato (copia del de vistas, a propósito):

- Bot (`isBotUserAgent` de `@repo/utils`, no una regex nueva) o UA vacío: 202 `{ accepted: true }` sin insertar.
- JSON malformado o body inválido: 400 `VALIDATION_ERROR`, mensaje genérico, sin eco de detalles.
- Descartes del servicio (local inexistente, evento ajeno, dueño) y error de DB: 202 `{ accepted: true }`, log del lado servidor. Nunca oráculo de existencia.
- Actor oportunista: guest (UUID real, usar `isGuestActor`) o autenticado, igual que el endpoint de vistas.
- Error contract: el orden 401/403/400/404 no aplica (endpoint anónimo); lo único no-2xx es 400 de validación. Ningún 4xx sale con `INTERNAL_ERROR`.

### 7.5 Identidad del visitante

Hash con `computeVisitorHash` y `HOSPEDA_VIEWS_HASH_SECRET` (sin variable de entorno nueva). Una diferencia deliberada con vistas y con `partner_logo_clicks`: **no se pasa `userId`**, así que un visitante autenticado también se hashea por IP truncada y UA, con la sal diaria. Razón: `user:<uuid>` guarda el id de la persona. Para una vista es aceptable; para "tocó el teléfono de este local" identifica a una persona con una intención de contacto, un dato bastante más sensible. No se guarda `is_authenticated` en la tabla.

Consecuencia: el hash de clic y el de vista de un mismo usuario logueado no coinciden. Afecta sólo a "únicos"; HOS-2261 calcula la tasa de clics sobre totales deduplicados por bucket de 30 min, que no dependen de que coincidan (ver spec de HOS-2261, 6.3). Se deja como OQ-2.

### 7.6 Web

- `apps/web/src/lib/analytics/interaction-capture.ts` (nuevo): `sendInteractionBeacon({ entityId, kind, eventId? })` sobre `postBeacon`. Hoy `postBeacon` es una función privada de `view-capture.ts`; se la **exporta** (o se la mueve a un módulo común) en vez de copiarla, por la misma razón que dice su comentario: el escalón `sendBeacon` -> `fetch(keepalive)` y el "nunca lanza" son del transporte, no de quien llama.
- `apps/web/src/components/analytics/VenueInteractionTracker.client.tsx` (nuevo): isla sin render, `client:idle`, montada junto a `EntityViewTracker` (`[slug].astro:488`). Registra **un** listener delegado de `click` y `auxclick` (botón del medio) en `document`; sube con `closest('[data-interaction-kind]')`; lee `data-interaction-kind` y `data-interaction-event-id`; llama al beacon. Nunca `preventDefault`. Se desuscribe al desmontar (View Transitions remonta la isla).
- Atributos en el markup (los `.astro` quedan estáticos y cacheables):
  - `VenueContactBlock.astro`: `data-interaction-kind="PHONE_CLICK"` en los dos teléfonos; `WEBSITE_CLICK` en el sitio web de `contactInfo` y en `socialNetworks.website`; `INSTAGRAM_CLICK` en Instagram.
  - `VenueAddress.astro`: `MAP_CLICK` en "Ver en el mapa".
  - HOS-2255 pone `TICKET_CLICK` + `data-interaction-event-id` en su botón. **No hace falta un tracker aparte** (HOS-2255 planea `VenueEventTicketClickTracker.client.tsx` escuchando `[data-venue-event-ticket]`): basta que su botón lleve el atributo común. Avisar a esa spec.
- El `entityId` del local lo toma la isla de su prop (igual que `EntityViewTracker`).
- Por qué isla y no un `<script>` de Astro: la app ya hashea los scripts inline para la CSP (`csp-soft-nav-script-hashes.ts`) y una isla `.tsx` queda fuera del barrido de sesión, igual que `EntityViewTracker`. La pérdida de un clic antes de `client:idle` es despreciable (la isla hidrata en el primer idle del navegador).
- `WHATSAPP_CLICK`: lo emite el botón nuevo de 7.8, con `data-interaction-kind="WHATSAPP_CLICK"`.
- Limitación que se documenta en el panel de HOS-2261: copiar un teléfono sin tocarlo, o abrir el enlace con el menú contextual, no cuenta.

### 7.7 Retención y limpieza

- `entity-views-purge.job.ts`: agregar `entityInteractionModel.purgeOlderThan` junto al de `partnerLogoClickModel`. Mismo cron, misma horizonte; el comentario del job ya explica por qué no va un cron aparte.
- Decidido (owner, 16/11/2026): las interacciones se guardan **120 días** (el horizonte común de este cron sube de 95 a 120 para vistas, clics de aliados y esta tabla; ver OQ-2). HOS-2261 muestra hasta 90, lo que deja 30 días de margen para un cron caído.
- Rollup mensual `entity_interaction_monthly_rollups` desde el primer día, en esta misma spec: tarea T-7 (ver OQ-6). La purga destruye lo que el rollup resume, así que el rollup no puede llegar después.
- Documentación a actualizar: `docs/guides/view-tracking-privacy.md` (sección nueva de interacciones; "la ventana más ancha es 30 días" deja de ser cierto), `apps/api/docs/route-architecture.md` (View Tracking Routes), `packages/db/CLAUDE.md` (lista de tablas append-only lean).

### 7.8 Botón de WhatsApp (decidido por el owner, 18/11/2026, HOS-2252 ronda 1 #1)

Se agrega **ahora** un botón de WhatsApp en la ficha de Comer y salir, y se mide su clic (`WHATSAPP_CLICK`).

- **Quién lo ve lo elige el dueño**, con un ajuste **por ficha** con dos valores: «público» o «solo usuarios logueados».
- **Alcance de esta spec:** campo nuevo en el local (migración estructural), control en el editor del dueño, el botón en la ficha y su medición. Entran en el desglose (ver 14, T-10 a T-12).
- **Modo «solo logueados»:** las páginas son *session-blind* (5.5), así que el número **no puede ir en el HTML**. Una isla React lo pide a un endpoint **protegido** y recién entonces arma el enlace. El visitante sin sesión ve el botón y, al tocarlo, se le pide iniciar sesión (el detalle de la UX queda como OQ-7).
- **Modo «público»:** el número va en el HTML y **cualquier scraper puede leerlo**. El editor tiene que decírselo al dueño al elegir ese modo.
- **Encaje con HOS-1076 y HOS-2042:** hoy ocultan `whatsapp` de `VenueSocialNetworks` y del `contactInfo` público (`venue.access.schema.ts:37-39`; `VenueContactBlock.astro`). Hay que **reconciliarlos**: en el modo público el número vuelve a publicarse solo para las fichas que lo eligieron, y su schema público no puede volver a exponerlo por defecto (fail-closed). Cómo se modela en el schema público queda como OQ-8.
- **Medición:** `WHATSAPP_CLICK` se emite con el mismo beacon y atributo común. En el modo «solo logueados» el clic se mide cuando el visitante logueado toca el botón ya resuelto.
- **Clics del dueño:** no cuentan (decisión #1 de la ronda 2; ya cubierto por AC-8).

## 8. Criterios de aceptación

- AC-1. Dada una ficha publicada con teléfono, cuando un visitante toca el teléfono, entonces se inserta una fila `PHONE_CLICK` con `entity_type=VENUE` y el id del local, y la navegación al `tel:` no se demora.
- AC-2. Dado un visitante anónimo, la fila guarda `visitor_hash` (hex) y ningún IP ni UA en claro. Dado un visitante autenticado, el hash **no** es `user:<uuid>`.
- AC-3. Los clics en web, Instagram y "Ver en el mapa" insertan `WEBSITE_CLICK`, `INSTAGRAM_CLICK` y `MAP_CLICK`. Un clic en otra red social o en "Ver menú" no inserta nada.
- AC-4. Un clic con `kind=TICKET_CLICK` y `eventId` de un evento de ese local inserta la fila con `event_id`. Con `eventId` de otro local, inserta cero filas y responde 202.
- AC-5. `kind=TICKET_CLICK` sin `eventId`, o `kind=PHONE_CLICK` con `eventId`, responde 400.
- AC-6. Una petición con User-Agent de bot responde 202 y no inserta. La respuesta es idéntica a la de un clic real.
- AC-7. Un local no publicado, borrado o inexistente responde 202 y no inserta (sin oráculo).
- AC-8. Un clic hecho por la sesión del dueño del local responde 202 y no inserta.
- AC-9. Un fallo de DB responde 202 y queda registrado en el log del servidor.
- AC-10. Al borrar el evento, sus filas quedan con `event_id = NULL` (no se borran).
- AC-11. Un solo listener de clic existe por isla montada, y desmontar la isla lo quita.
- AC-12. El cron de purga borra filas de `entity_interactions` más viejas que 120 días y no toca las nuevas.
- AC-15. Antes de purgar, el rollup mensual ya resumió esas filas por local, canal y mes (y por evento cuando corresponde); el resumen sobrevive a la purga.
- AC-13. `cacheable-pages-are-session-blind.guard.test.ts` sigue verde: ningún `.astro` lee sesión.
- AC-14. La tabla no agrega filas a `entity_views`: un clic inserta 0 filas ahí (misma aserción que AC-13 de HOS-1063).
- AC-16. El editor del dueño ofrece, por ficha, el ajuste de visibilidad de WhatsApp («público» / «solo logueados») y lo persiste. Una ficha sin número de WhatsApp no muestra el botón.
- AC-17. Dada una ficha en modo «público», el botón de WhatsApp aparece con el enlace y el número en el HTML, y un clic inserta `WHATSAPP_CLICK`.
- AC-18. Dada una ficha en modo «solo logueados», el HTML de la ficha **no contiene el número** (test de fuente y de respuesta). Un visitante logueado lo obtiene de un endpoint protegido; sin sesión ese endpoint responde 401 y no filtra el número.
- AC-19. `cacheable-pages-are-session-blind.guard.test.ts` sigue verde con el botón (la página no lee sesión; lo hace la isla).
- AC-20. El esquema público del local (`VenuePublicContactInfoSchema`) no expone `whatsapp` fuera del modo «público» elegido por el dueño.
- AC-21. El editor advierte, al elegir «público», que el número puede ser copiado por terceros.

## 9. Plan de pruebas

Unit
- `packages/schemas/test/entities/entityInteraction/entityInteraction.schema.test.ts`: combinaciones kind/entityType/eventId (AC-5), enum y mensajes.
- `packages/service-core/test/services/entityInteraction/entityInteraction.service.test.ts`: descartes por local ajeno/no publicado/evento ajeno/dueño (AC-4, 7, 8), error de DB tipado.
- `apps/web/test/lib/analytics/interaction-capture.test.ts`: `sendBeacon` primero, `fetch(keepalive)` de respaldo, nunca lanza, no-op en SSR.
- `apps/web/test/components/analytics/VenueInteractionTracker.test.tsx`: clic sobre un elemento con atributo envía beacon; sobre uno sin atributo, no; `auxclick` del medio cuenta; desmontar quita el listener (AC-11); no hay `preventDefault`.
- `apps/web/test/components/venue/venue-interaction-attributes.test.ts` (lectura de fuente, patrón de `VenueCard.test.ts`): cada ancla trae el `kind` esperado (AC-3).

Integración
- `packages/db/test/integration/entity-interaction.model.integration.test.ts`: insert, CHECK de `event_id`, FK `SET NULL` al borrar el evento (AC-10), purga (AC-12). Usar la base de integración con el cuidado de siempre (nombre fijo, una sesión a la vez).
- `apps/api/test/routes/interactions/capture.test.ts`: AC-1, 2, 4-9, 14. Verificar **la fila**, no sólo el status: un 202 no prueba que se registró (nota del propio `capture.ts` de aliados).
- `apps/api/test/cron/entity-views-purge.job.test.ts`: agregar el caso de `entity_interactions` (AC-12).

Botón de WhatsApp (7.8): test de que el HTML en modo «solo logueados» no contiene el número, test de ruta del endpoint protegido (401 sin sesión, número con sesión), test del editor, test de que el schema público no filtra `whatsapp` (AC-16 a AC-21).

Guards a correr antes del PR: `pnpm check:guards`, `check-no-listing-dispatch`, el test de session-blind, `db:generate` sin diff pendiente.

E2E: no hace falta en Playwright; el beacon se cubre con el test de la isla. Se verifica a mano en staging.

## 10. Riesgos

- R-1. Falsos positivos de bot: la regex es la misma de las vistas; si deja pasar un crawler, infla clics igual que infla vistas. Mitigado por usar la **misma** función y por la verificación de existencia.
- R-2. CGNAT: muchos visitantes móviles comparten IP; el límite de 30/min por IP podría descartar clics legítimos en un pico. Igual que las vistas; no se cambia.
- R-3. El paso de verificación agrega una lectura de DB por beacon. Tasa baja; indexado por PK.
- R-4. Dependencia con HOS-2291 (ids estables de eventos) para `event_id`. Sin eso, los clics por evento se pierden en cada guardado. No bloquea el resto.
- R-5. Hash distinto entre vista y clic para el usuario logueado (7.5). Efecto acotado a "únicos".
- R-6. `postBeacon` pasa de privada a exportada: tocar `view-capture.ts` afecta a vistas y a aliados. Cubierto por los tests existentes de ambos.

## 11. Preguntas abiertas para el owner

- OQ-1. **WhatsApp en el local.** **Decidido (owner, 18/11/2026, HOS-2252 ronda 1, #1): opción 2, ampliada.** Se agrega ahora el botón de WhatsApp en la ficha y se mide su clic. La visibilidad la elige el dueño con un ajuste por ficha («público» o «solo usuarios logueados»); hace falta un campo nuevo, el control en el editor y una migración. En el modo «solo logueados» el número no va en el HTML (páginas *session-blind*): lo pide una isla a un endpoint protegido. El encaje con HOS-1076 y HOS-2042 se resuelve en 7.8. Las opciones 1 y 3 quedan descartadas.
- OQ-2. **Retención y ventana de 90 días.** Decidido (owner, 16/11/2026): las métricas se guardan 120 días; el horizonte común sube de 95 a 120 (vistas, clics de aliados y esta tabla). Da 30 días de margen para un cron caído frente a la ventana de 90 de HOS-2261. Costo asumido: los hashes pseudonimizados viven 25 días más.
- OQ-3. **Borrar un evento y sus clics.** Decidido (owner, 16/11/2026): FK `event_id` con `ON DELETE SET NULL`. El total del local se conserva y sólo se pierde el detalle por evento. No hay CASCADE.
- OQ-4. **PostHog.** No hay Umami en el repo; PostHog está pero el local no le manda eventos (decisión HOS-734).
  1. No mandar nada a PostHog; la tabla propia es la fuente. Recomendada (menos superficie, sin cookies).
  2. Duplicar cada clic como evento PostHog. Pro: embudos de marketing. Contra: consentimiento y un segundo número que puede no coincidir con el del panel.
- OQ-5. **Clics del propio dueño y de staff.** Se propone no contar al dueño. Las vistas **sí** cuentan al dueño hoy; no se cambia (afectaría las cifras ya publicadas de alojamientos). Recomendada: descartar sólo al dueño. Alternativa: contarlo todo, más simple pero el dueño que prueba su teléfono infla su propia tasa. **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #1):** los clics del propio dueño no cuentan (AC-8).
- OQ-6. **Rollup mensual de interacciones.** Decidido (owner, 16/11/2026): se incluye desde el primer día (`entity_interaction_monthly_rollups`, extensión de `view-monthly-rollup.job.ts`, tarea T-7, último PR de esta spec). Lección de HOS-1063: el rollup "existe desde la primera migración o nunca", porque la purga destruye lo que resume. Costo asumido: una tabla y un job más, y una clave única con `event_id` nulo que necesita índice por expresión.

- OQ-7. **UX del visitante sin sesión en el modo «solo logueados» (abierta, la abre la decisión #1 de la ronda 1).** ¿El botón se muestra siempre y al tocarlo pide iniciar sesión, o se oculta hasta tener sesión? Hay que decidirlo antes de implementar T-11. La spec no lo resuelve.
- OQ-8. **Modelado del número en el schema público (abierta).** ¿El modo «público» agrega `whatsapp` condicionado al ajuste en `VenuePublicContactInfoSchema`, o va por un campo aparte del payload público? Hay que respetar el diseño fail-closed de HOS-2042. También queda abierto el valor por defecto del ajuste en fichas existentes (se propone «solo logueados», el más conservador) y el nombre de la columna.

## 12. Etiquetas de smoke y Novedades

- `status-needs-smoke-staging`: CORS entre el web de staging y la API, `sendBeacon` real, filtro de bots con UA real, que la fila aparezca. No necesita `-prod` ni `-local`.
- What's New: **no aplica**. Es invisible para el turista y para el dueño. La novedad es de HOS-2261 / HOS-2280.

## 13. Dependencias

- Bloquea a: HOS-2261 (lectura y panel), HOS-2265 (por evento), HOS-2255 (el botón consume el atributo común).
- Depende de: HOS-2291 (ids estables de eventos) sólo para `event_id`.
- No toca el catálogo ni nada que espere a la pasada final de HOS-1352.

## 14. Desglose en tareas

1. T-1. Enum TS + Zod + enum pg y schema Drizzle de `entity_interactions`; `db:generate`; extras con el `CHECK` (0,75 día).
2. T-2. Schemas de captura y claves i18n `zodError.entityInteraction.*` es/en/pt (0,5 día).
3. T-3. `EntityInteractionModel` (insert, purga) + test de integración (0,5 día).
4. T-4. `EntityInteractionService.capture` + tests (0,75 día).
5. T-5. Endpoint `POST /public/interactions`, registro, manifest, tests de ruta (0,75 día).
6. T-6. Cron de purga con horizonte de 120 días + docs de privacidad y de rutas (0,5 día).
7. T-7. Rollup mensual de interacciones, `entity_interaction_monthly_rollups` + extensión de `view-monthly-rollup.job.ts` (0,75 día; decidido, va como último PR de esta spec).
8. T-8. Web: exportar `postBeacon`, `interaction-capture.ts`, isla `VenueInteractionTracker`, montaje en la ficha, atributos en `VenueContactBlock` y `VenueAddress`, tests (1 día).
9. T-9. Smoke en staging y sign-off (0,5 día).
10. T-10. Campo de visibilidad de WhatsApp en el local: enum + columna + migración estructural, schemas Zod y control en el editor del dueño con la advertencia de AC-21 (por estimar).
11. T-11. Endpoint protegido que devuelve el número a usuarios logueados e isla del botón; modo público en el HTML; reconciliación con HOS-1076 y HOS-2042 (por estimar).
12. T-12. Emisión de `WHATSAPP_CLICK`, tests de AC-16 a AC-21 y verificación en staging (por estimar).

## 15. Linear

Canonical tracking:
HOS-2256
