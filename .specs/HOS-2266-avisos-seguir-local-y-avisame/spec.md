---
title: Avisos al turista - seguir un local y "Avisame" en un evento
linear: HOS-2266
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - db
  - api
  - web
---

# Avisos al turista: seguir un local y "Avisame" en un evento

> Es la base de los tres avisos. Los specs HOS-2267 (recordatorio), HOS-2268 (evento nuevo) y HOS-2269 (cambios) dependen de este. El diseño compartido (tablas, gate, categorías de notificación, topes anti-spam) vive acá y los otros tres lo citan.

## 1. Resumen

El turista logueado puede **seguir un local** (recibe avisos de eventos nuevos) y tocar **"Avisame"** en un evento puntual (recibe el recordatorio y los avisos de cambio de ese evento). Quien paga es el dueño del local: el botón solo existe si el plan del local incluye la clave nueva `venue_event_notifications` (pro y premium). Si el local baja de plan, las suscripciones se conservan pero no sale ningún aviso. El dueño ve cuántos seguidores tiene, sin datos personales.

## 2. Problema

Hoy un turista no tiene forma de enterarse de lo que pasa en un local de noche. Los favoritos existen pero no avisan nada, y las alertas y el digest son solo de alojamiento. El local que paga pro/premium no recibe ningún beneficio de "avisar a su gente".

## 3. Objetivos

- G-1: tabla propia de seguimiento de local y de suscripción a evento.
- G-2: endpoints protegidos para seguir, dejar de seguir, "Avisame" y consultar el estado propio.
- G-3: botones "Seguir" y "Avisame" en la ficha (island de cliente, la página sigue sin sesión).
- G-4: gate por `venue_event_notifications` del plan del dueño, evaluado también al enviar.
- G-5: gestión desde "Mi cuenta" (listar y dejar de seguir).
- G-6: contador de seguidores para el dueño, sin datos personales.
- G-7: ids estables de los eventos del local (prerequisito técnico, ver 6.1).

## 4. Fuera de alcance

- El envío de cualquier correo (HOS-2267, 2268, 2269).
- Push o in-app: hoy el único canal real es correo (ver 5.4).
- Seguir un local de alojamiento o experiencia. Solo `venue` (G1: nada de `vertical === 'venue'` en código compartido, ver 6.8).
- Estadísticas por evento para el dueño (HOS-2265 puede leer los conteos que acá se dejan listos).
- Crear la clave y asignarla a los planes: HOS-2259 (clave) y HOS-2281 (grant aditivo).

## 5. Estado actual del código (verificado en `origin/staging`)

### 5.1 Los favoritos NO sirven como "seguir"

- `user_bookmarks` (`packages/db/src/schemas/user/user_bookmark.dbschema.ts:14-54`) es polimórfica por `entity_type_enum`. El enum tiene `VENUE` y `EVENT` (`packages/schemas/src/enums/entity-type.enum.ts:40-54`), pero **`EVENT` es la tabla `events` de la plataforma** (agenda del destino, curada por staff), no `venue_events`. El propio comentario de `venue_event.dbschema.ts:44-60` lo aclara: son tres cosas distintas llamadas "evento". Favoritear un evento de local **no tiene tipo de entidad** hoy.
- Agregar un valor al pg enum rompe guards congelados (conteos, inventarios, mocks en 3 paquetes) y obliga a una migración de enum.
- El favorito tiene colecciones, nombre, descripción y alimenta el conteo público "más guardados" (`idx_user_bookmarks_entity_active`, línea 46-50). Mezclar "me interesa" con "mandame mails" infla ese conteo y hace que desfavoritear apague avisos sin que el turista lo sepa.

### 5.2 Precedente de tabla propia: alertas de precio

`tourist_price_alerts` (`packages/db/src/schemas/alert/tourist_price_alerts.dbschema.ts`): tabla propia, FK con CASCADE, `deleted_at`, índice único parcial `WHERE deleted_at IS NULL`. Rutas en `apps/api/src/routes/price-alert/protected/` (create con `enforceUserGate`, list, remove), servicio `AlertSubscriptionService` (`packages/service-core/src/services/alert/alert-subscription.service.ts`) y página `apps/web/src/pages/[lang]/mi-cuenta/alertas/index.astro` con el island `AlertsList`. Ese es el molde.

### 5.3 Los eventos del local no tienen id estable

- `replaceVenueEvents` borra y reinserta toda la agenda (`packages/service-core/src/services/venue/venue.events.ts:250-278`, cabecera 1-45: "Entry ids are not stable across a save ... a diff would be machinery with no consequence").
- El payload no lleva ids (`VenueEventInputSchema`, `packages/schemas/src/entities/venue/subtypes/venue.event.schema.ts:260-285`) y el draft del editor tampoco (`apps/web/src/lib/venue/venue-event-draft.ts:11-24`).
- `venue_events.venue_id` es `ON DELETE CASCADE` (`venue_event.dbschema.ts:100-102`).

**Consecuencia**: cualquier suscripción a un `venue_event.id` desaparecería en el primer guardado de la agenda. El propio comentario del servicio ya dice que el día que algo referencie un evento "this function grows a diff".

### 5.4 Canales y notificaciones

- Único canal real: correo (Brevo). `packages/notifications/src/transports/email` y `services/channels/email-alert.channel.tsx`. No hay push ni in-app para turistas.
- Preferencias: `PreferenceService` guarda `{ emailEnabled, disabledCategories, disabledTypes }` en `users.settings.notifications` (`packages/notifications/src/types/preferences.types.ts`). Hay UI en `mi-cuenta/preferencias` (`PreferenceToggles`).
- Baja con un clic: existe para newsletter (HMAC estable, `packages/service-core/src/services/newsletter/newsletter-token.helpers.ts:261-295`, ruta pública `GET /api/v1/public/newsletter/unsubscribe`, `apps/api/src/routes/newsletter/public/index.ts`). Para avisos de local no existe.

### 5.5 El gate por plan se puede leer fuera de un request

`readEffectiveKeys({ userId, vertical, keys, effectiveSetSnapshot? })` (`apps/api/src/utils/listing-access/user-gate.ts`, función final) lee el effective set del **dueño** y devuelve `{ [key]: boolean }`; ante falla devuelve todo `false` (falla cerrada). `readOwnerEffectiveSets` (`apps/api/src/utils/public-listing-projector.ts:165-190`) ya lo hace en lote, un set por dueño. Sirve tanto para la ficha pública como para los crons. Ninguna clave actual de venue sirve: `manage_venue_events` (`packages/schemas/src/catalog/entitlement-keys.ts:37`) es de la agenda, no de los avisos.

### 5.6 La ficha pública es sin sesión y cacheable

`apps/api/src/routes/venue/public/getBySlug.ts:96-140` arma el payload con `projectPublicListings`; `venueEvents` va "withheld" si el plan no tiene `manage_venue_events`. `apps/web/test/pages/cacheable-pages-are-session-blind.guard.test.ts` obliga a que `src/pages` no lea sesión: el estado del botón debe resolverse en un island (como `FavoriteButton.client.tsx`, `apps/web/src/components/shared/favorite/`).

`projectVenueReviewSectionStates` (`public-listing-projector.ts:~275-290`) documenta DEC-FAC-072: "la página pública cacheable no debe revelar el plan del dueño". Ver OQ-1.

### 5.7 Limpieza al purgar una ficha

`listingPurgeModel` (`packages/db/src/models/listing/listing-purge.model.ts`) borra las tablas de contenido y cierra alertas de precio por vertical (`CLOSE_PRICE_ALERTS`, venue = no-op). Las nuevas tablas con FK CASCADE al local se limpian solas en un borrado duro; en una purga (soft) hay que cerrarlas a mano (ver 6.6).

## 6. Diseño propuesto

### 6.1 Decisión: tabla nueva, no favoritos (recomendado)

| Opción | Qué hace | Pros | Contras | Impacto |
|---|---|---|---|---|
| A. Favorito con flag de avisos | Agrega `notify boolean` a `user_bookmarks` y un `entity_type` para evento de local | Reusa botón corazón y listado | Enum nuevo (guards congelados), `EVENT` ya significa otra cosa, infla "más guardados", sin lugar para estado por aviso | Alto en schemas, db, seed, guards |
| **B. Tablas nuevas (recomendada)** | `venue_follow` y `venue_event_subscription` | Estado propio, sin tocar enums ni conteos públicos, molde ya probado (alertas de precio) | Dos tablas y dos endpoints nuevos | Aditivo, sin tocar nada existente |

### 6.2 Modelo de datos (carril estructural: `pnpm db:generate`)

Tablas nuevas en singular (regla del repo), en `packages/db/src/schemas/venue/`:

`venue_follow`
- `id uuid pk`, `user_id uuid not null -> users ON DELETE CASCADE`, `venue_id uuid not null -> venues ON DELETE CASCADE`, `created_at`, `updated_at`, `deleted_at`.
- Único parcial `(user_id, venue_id) WHERE deleted_at IS NULL`. Índice por `venue_id` (conteo y digest) y por `user_id` (Mi cuenta).

`venue_event_subscription`
- `id uuid pk`, `user_id`, `venue_id` (desnormalizado para gate y conteo, FK CASCADE), `venue_event_id uuid not null -> venue_events ON DELETE CASCADE`, `created_at`, `updated_at`, `deleted_at`.
- `remind_for_date date null` y `reminded_at timestamptz null` (los usa HOS-2267; se crean acá para una sola migración).
- Único parcial `(user_id, venue_event_id) WHERE deleted_at IS NULL`. Índices por `venue_event_id`, `user_id`, y `(remind_for_date) WHERE reminded_at IS NULL AND deleted_at IS NULL`.

Sin `locale` ni email en las filas: el idioma y el correo se leen del usuario en el momento de encolar.

Cambio en `venue_events` (id estable, ver 6.3): ninguna columna nueva en este spec. Las columnas de los otros specs (`new_notice_at`, `suspended_for_date`, `notified_snapshot`, `change_touched_at`) las agregan HOS-2268 y HOS-2269. **Coordinar con los specs de eventos (HOS-2254, 2263, 2264, 2265), que también tocan `venue_events`: una sola migración por tanda si salen juntos.**

Constraint-violation: registrar los dos índices únicos en `apps/api/src/utils/constraint-violation.ts` (ver línea ~118 para el formato).

### 6.3 Prerequisito: ids estables en la agenda (tarea T-1, bloquea todo)

- `VenueEventInputSchema` suma `id: z.string().uuid().optional()`.
- `replaceVenueEvents` pasa de "borrar y reinsertar" a **diff dentro de la misma transacción**: ids presentes -> `UPDATE`; sin id -> `INSERT`; ids del local que no vienen -> `DELETE`. Un id que no pertenece a ese local es `VALIDATION_ERROR` (nunca se confía en un id ajeno).
- `displayOrder` sigue saliendo de la posición del array.
- `EventDraft` (`venue-event-draft.ts`) y los componentes del editor (`VenueEventsManager.client.tsx`, `VenueEventEntryCard.client.tsx`, equivalentes `ListingVenueEvents*`) llevan y reenvían el `id`.
- La lectura (`projectEvent`) ya devuelve `id`.
- Riesgo: un cliente que no mande ids borraría y recrearía todo, y las suscripciones caerían por CASCADE. Mitigación: el editor es el único cliente (verificar que admin no escribe agenda) y se publica en el mismo PR; test de regresión "guardar sin cambios conserva ids".
- Borrar un evento del editor **no avisa** a los suscriptos (el issue distingue "borrar" de "suspender", HOS-2269). El editor debe advertirlo con texto: "Si lo borrás, quienes se anotaron no reciben aviso. Para avisar, usá Suspender."
- Si HOS-2254/2263/2264 ya reescribieron `replaceVenueEvents` con diff, este punto se reduce a verificar que preserva ids.

### 6.4 Gate: `venue_event_notifications` del plan del dueño

Helper nuevo en `apps/api/src/utils/venue-notifications/gate.ts` (nombre sugerido):

```
readVenueNotificationGate({ venues: [{ id, ownerId, publicationStatus, deletedAt }] })
  -> Map<venueId, boolean>
```

Reglas: `true` solo si (a) `readEffectiveKeys({ vertical: VENUE, keys: ['venue_event_notifications'] })` del dueño da `true`, (b) `publication_status = 'PUBLISHED'`, (c) `deleted_at IS NULL`. Un set por dueño (mismo patrón que `readOwnerEffectiveSets`). Falla cerrada.

Se usa en **tres lugares**: el payload público (botón), los endpoints de seguir (rechazo), y **cada job de envío justo antes de encolar** (HOS-2267/2268/2269). Esto último es lo que hace que bajar de plan corte los avisos sin tocar filas.

No se agrega operación nueva al pipeline `resolveListingAccess`: seguir no es una operación del dueño sobre su ficha. Por lo tanto no aplican `OPERATION_STEP6_KEY` ni `check-step5-declared`. Sí aplican G3 (la clave tiene que estar en el catálogo, la crea HOS-2259) y G6 (no se decide por rol). El gate nunca mira roles.

### 6.5 API (tier protegido; el turista usa sesión)

Todas con `createProtectedRoute`, `customRateLimit` 60/min, sin `listingAccess` (no es una operación del dueño). Paso 2 del contrato: cuenta con email sin verificar recibe `EMAIL_NOT_VERIFIED` (correcto: sin email verificado no hay a dónde avisar).

| Método y ruta | Qué hace | Errores |
|---|---|---|
| `PUT /api/v1/protected/venues/:id/follow` | Idempotente. Crea o reactiva el seguimiento. 200 con `{ following: true }` | 404 local inexistente/no publicado; 422 `VALIDATION_ERROR` con `details.reason = 'NOTIFICATIONS_NOT_AVAILABLE'` si el gate da `false`; 403 `LIMIT_REACHED` al pasar el tope por usuario |
| `DELETE /api/v1/protected/venues/:id/follow` | Idempotente, no exige gate (siempre se puede dejar de seguir). 200 | 404 solo si el id no existe |
| `PUT /api/v1/protected/venues/:id/events/:eventId/subscription` | Idempotente "Avisame". Calcula `remind_for_date` (HOS-2267). 200 `{ subscribed: true }` | 404 si el evento no es de ese local o ya pasó; 422 `NOTIFICATIONS_NOT_AVAILABLE`; `LIMIT_REACHED` |
| `DELETE /api/v1/protected/venues/:id/events/:eventId/subscription` | Idempotente. 200 | 404 si no existe el evento |
| `GET /api/v1/protected/venues/:id/notification-state` | `{ following: boolean, subscribedEventIds: string[] }` del usuario. **Una sola llamada por ficha** | 404 |
| `GET /api/v1/protected/me/venue-notifications` | Para Mi cuenta: seguimientos y suscripciones propios con nombre del local, `eventTitle`, `date/weekday`, y `paused: boolean` (el local hoy no envía) | - |
| `GET /api/v1/protected/venues/:id/followers/summary` | Solo dueño del local. `{ followers: number, eventSubscribers: number }`, sin ids ni emails | 404 si no es suyo (nunca 403); 403 `ENTITLEMENT_REQUIRED` si su plan no tiene la clave |

Orden del contrato: 401 -> 403 email -> 400 forma (UUID) -> 404 existencia/propiedad -> 422/403 reglas de negocio. Un local ajeno "no publicado" responde 404, no 403.

Tope por usuario (constantes en código, no son precios, G7 no aplica): 100 seguimientos y 200 suscripciones a evento activos. Se responde `LIMIT_REACHED` con `limitKey` local (no es una clave del catálogo; documentar que es un tope técnico anti-abuso). Ver OQ-3.

### 6.6 Servicio

`VenueFollowService` y `VenueEventSubscriptionService` en `packages/service-core/src/services/venue/` (o uno solo, `VenueNotificationSubscriptionService`; molde `AlertSubscriptionService`). El permiso es "autenticado" (como `checkCanCreate` de alertas); el dueño no puede seguir su propio local (422, evita inflar el contador).

Limpieza:
- `CLOSE_PRICE_ALERTS` de `listing-purge.model.ts` suma una rama para `venue` que marca `deleted_at` en `venue_follow` y `venue_event_subscription` del local.
- Cierre de cuenta del turista: borrado/anonimización debe cubrir las dos tablas (verificar el flujo en `apps/api/test/integration/account-closure/close-on-request-writes.test.ts` y agregar las tablas).
- Cuando un evento pasa de fecha (`once`) las suscripciones quedan inertes; no hace falta job.

### 6.7 Web

- Payload público: `getBySlug` suma `notificationsEnabled: boolean` (resultado del gate) a `VenuePublicSchema` (`venue.access.schema.ts`). Los eventos ya vienen con `id`.
- Island `VenueFollowButton.client.tsx` en la cabecera de la ficha y `VenueEventNotifyButton.client.tsx` por evento dentro de `VenueEvents.astro`. Ambos solo se montan si `notificationsEnabled`. Al montar llaman **una vez** a `notification-state` (si no hay sesión, el botón muestra "Seguir" y al tocarlo lleva al login con retorno). Cache cliente de la respuesta compartida entre ambos islands (molde `user-collections-cache.ts`).
- `VenueEvents.astro` hoy es 100% presentacional; se le suma el slot del botón por entrada sin leer sesión (la página sigue pasando `cacheable-pages-are-session-blind`).
- Mi cuenta: nueva sección `mi-cuenta/avisos-de-locales/index.astro` + island (molde `alertas/index.astro` + `AlertsList`), registrada en `AccountLayout` (`activeSection`). Lista seguimientos y "Avisame", botón de dejar de seguir, y chip "En pausa" si `paused`.
- Dueño: tarjeta "Seguidores" en el editor del local (`mi-cuenta/comercio/[vertical]/[id]/editar/...`), con el número, y estado bloqueado (candado + CTA al plan, sin nombres de plan, ver `venue-editor-upsell-no-plan-names.guard.test.ts`) si su plan no tiene la clave.
- Estilos: CSS Modules (web). Íconos de `@repo/icons`. Formularios: HTML nativo.

### 6.8 i18n (es, en, pt) en `packages/i18n/src/locales/{es,en,pt}/venue.json` y `account.json`

`venue.detail.follow.{follow,following,unfollow,loginRequired,limitReached,unavailable}`, `venue.detail.venueEvents.notify.{cta,subscribed,cancel,loginRequired,past}`, `account.pages.venueNotifications.{title,description,empty,paused,unfollow,eventNotify}`, `account.venueFollowers.{title,count,locked}`. Sin textos hardcodeados; después `pnpm` generación de tipos de i18n del paquete.

### 6.9 Guards

G1: el helper de gate recibe `VerticalEnum.VENUE` por parámetro y las rutas viven bajo `routes/venue/`; no se escribe `vertical === 'venue'` en código compartido. G2: cada ruta nueva declara `VerticalEnum.VENUE` (revisar `scripts/check-vertical-context.ts`). G3/G18: dependen de HOS-2259. G7: nada de precios. `check-content-routes-declare-section` (`scripts/check-content-routes-declare-section.ts` menciona venue_events): confirmar si las rutas nuevas deben declarar sección.

## 7. Criterios de aceptación

- AC-1: Dado un local publicado cuyo dueño tiene la clave, cuando un turista logueado toca "Seguir", entonces existe una fila activa en `venue_follow` y el botón pasa a "Siguiendo". Si repite el PUT, no hay duplicado (200).
- AC-2: Dado un local cuyo plan NO tiene la clave, la ficha pública no trae `notificationsEnabled: true` y no se renderiza ningún botón; `PUT .../follow` responde 422 `NOTIFICATIONS_NOT_AVAILABLE`.
- AC-3: Dado un usuario sin sesión, el botón lleva al login con retorno a la ficha; ninguna ruta protegida responde algo distinto de 401.
- AC-4: Dado un evento de ese local, "Avisame" crea una fila en `venue_event_subscription` con `venue_id` correcto; sobre un evento de otro local o ya pasado responde 404.
- AC-5: El turista puede dejar de seguir / cancelar "Avisame" desde la ficha y desde Mi cuenta, y el gate no interviene (se puede aunque el local haya bajado de plan).
- AC-6: Si el local baja de plan, las filas se conservan, el botón desaparece de la ficha, Mi cuenta muestra "En pausa" y `GET /me/venue-notifications` devuelve `paused: true`. Si sube de nuevo, todo vuelve sin acción del turista.
- AC-7: El dueño ve `followers` y `eventSubscribers` como números; la respuesta no contiene ids de usuario ni emails. Otro usuario recibe 404.
- AC-8: Guardar la agenda sin cambios conserva los ids de los eventos y por lo tanto las suscripciones; borrar un evento elimina sus suscripciones (CASCADE).
- AC-9: Un usuario con email sin verificar recibe `EMAIL_NOT_VERIFIED` en las rutas de seguir.
- AC-10: El dueño no puede seguir su propio local.
- AC-11: Al purgar la ficha, las suscripciones de ese local quedan cerradas.
- AC-12: La página `/comer-y-salir/[slug]` sigue pasando `cacheable-pages-are-session-blind`.

## 8. Plan de pruebas

- Unit (service-core): servicios de seguir (idempotencia, tope, dueño no se sigue a sí mismo), `replaceVenueEvents` con diff (ids conservados, id ajeno rechazado, borrado, orden). Archivos: `packages/service-core/test/services/venue/venue.events.test.ts` (extender) y `.../venue-notification-subscription.service.test.ts` (nuevo).
- Unit (api utils): `readVenueNotificationGate` (clave sí/no, no publicado, dueño sin set, falla cerrada).
- Integración API: rutas (401, 403 email, 400 uuid, 404 ajeno, 422 gate, tope), summary del dueño, regresión "guardar PUT sin cambios no cambia ids" contra Postgres real (`apps/api/test/integration/`).
- Schemas: `venue.event.schema.test.ts` con `id` opcional.
- Web: `VenueFollowButton`/`VenueEventNotifyButton` (login, estado, error de límite), página de Mi cuenta, guard de páginas sin sesión, `VenueEventsManager` conserva `id`.
- Migración: `pnpm db:generate` limpio y drift guard.
- E2E (`apps/e2e`): turista sigue, ve el estado, deja de seguir (en staging con un local con la clave).

## 9. Riesgos

- R-1: perder suscripciones por un cliente que no mande ids (6.3). Mitigado con test y único cliente.
- R-2: la ficha pública revela, vía `notificationsEnabled`, que el dueño tiene un plan pro o superior. Ya pasa hoy con `venueEvents`/`menuSections` ("withheld"), pero choca con DEC-FAC-072. Ver OQ-1.
- R-3: cache de la ficha tras un cambio de plan: el botón puede quedar hasta el TTL. Mismo trade-off aceptado en `getBySlug.ts` (comentario del TTL). El gate de servidor lo corrige al tocar.
- R-4: conflicto de migraciones/`replaceVenueEvents` con los specs de eventos (HOS-2254/2263/2264). Coordinar orden.
- R-5: la clave y el grant no existen hasta HOS-2259/2281 (bloqueados por el cierre de HOS-1352). Todo el código puede escribirse y probarse con el catálogo en tests, pero **no mergea** antes.

## 10. Preguntas abiertas para el owner

- OQ-1: ¿Cómo mostramos el botón sin revelar el plan? Opciones: (1) `notificationsEnabled` booleano en el payload público, coherente con cómo ya se ocultan carta y agenda (recomendada: es el mismo grado de exposición que ya existe y no agrega ruta nueva); (2) el botón siempre se renderiza y el servidor responde `NOTIFICATIONS_NOT_AVAILABLE` (no revela plan pero muestra un botón que falla, mala UX); (3) leer el flag recién en el island vía `notification-state` (no toca el payload cacheable, pero el botón aparece tarde). Recomiendo 1.
- OQ-2: ¿"Seguir" y "Avisame" son independientes? Recomiendo sí: "Avisame" no implica seguir al local (evita que alguien que solo quiere un recordatorio reciba el digest de eventos nuevos).
- OQ-3: Topes por usuario (100 locales, 200 eventos): ¿los dejamos como constantes técnicas? Recomiendo sí, sin exponerlos como límite de plan.
- OQ-4: ¿El contador del dueño debe mostrarse con un piso (por ejemplo, "menos de 5" cuando hay pocos) para no permitir deducir quién sigue? Con una sola persona el dueño igual no ve datos personales. Recomiendo número exacto.

## 11. Dependencias

- Bloquea: HOS-2267, HOS-2268, HOS-2269.
- Depende de: HOS-2259 (clave `venue_event_notifications`), HOS-2281 (grant en planes pro/premium), cierre de HOS-1352 para mergear lo que toque catálogo.
- Coordinar con: HOS-2254, 2263, 2264, 2265 (mismas tablas/servicio de eventos), HOS-2284 (presentación y Novedades).

## 12. Smoke y Novedades

- Etiquetas: `status-needs-smoke-staging` (envío real a Brevo en los specs hermanos, y el flujo completo de seguir con un local con la clave). `status-needs-smoke-local` para el flujo de botones y Mi cuenta.
- What's New: se escribe una sola entrada para toda la serie de avisos, en el spec que cierre el bloque (HOS-2269 o HOS-2284). Este spec no cierra solo.
- Es billing-touching (usa catálogo/entitlements): seguir el checklist de staging de `docs/billing/smoke-checklist.md`.

## 13. Desglose de tareas (cada una <= 1 día)

1. T-1 Ids estables: schema `id?`, diff en `replaceVenueEvents`, tests de regresión.
2. T-2 Editor web lleva y reenvía `id` + aviso de "borrar no avisa".
3. T-3 Migración de `venue_follow` y `venue_event_subscription` + modelos Drizzle + registro de constraints.
4. T-4 Servicio(s) de seguimiento/suscripción + tests.
5. T-5 Helper `readVenueNotificationGate` + tests.
6. T-6 Rutas protegidas (follow, subscription, notification-state, me/venue-notifications, followers/summary) + tests de integración.
7. T-7 Payload público `notificationsEnabled` + schema.
8. T-8 Islands de la ficha (Seguir, Avisame) + i18n es/en/pt.
9. T-9 Página Mi cuenta + tarjeta de seguidores del dueño.
10. T-10 Limpieza en purga de ficha y cierre de cuenta + tests.
11. T-11 Guards (G1/G2) y revisión de `check-content-routes-declare-section`; e2e.

## 14. Linear

Canonical tracking: HOS-2266 (hijo de la épica HOS-2252).
