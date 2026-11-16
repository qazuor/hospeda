---
title: Excepciones de dirección pedidas por el dueño, con aprobar/rechazar/quitar y auditoría
linear: HOS-2192
statusSource: linear
created: 2026-11-15
status: final
type: feature
areas:
  - api
  - web
  - admin
  - db
smokeGates:
  - status-needs-smoke-staging
---

# HOS-2192 · Excepciones de dirección pedidas por el dueño

> Continúa HOS-1810 («una ficha = un local = una dirección», `.specs/HOS-1810-una-ficha-un-local-una-direccion/spec.md`, PRs #4373 y #4374). Verificada contra `origin/staging` (2026-11-15).

## Estado de partida (ya en `staging`)

- Una ficha de alojamiento o venue cuya clave de dirección (`location_key`) choca con otra ficha **PUBLICADA del mismo dueño** recibe el aviso de borrador `locationDuplicate`; publicarla, o mover una publicada a esa dirección, responde 409 `ALREADY_EXISTS` con `details.reason = 'DUPLICATE_LOCATION'`.
- Un admin concede una excepción atada a la clave (`location_exception_by/_reason/_at/_key`) con `POST /api/v1/admin/{accommodations,venues}/:id/location-exception` y la quita con `DELETE` de la misma ruta (`apps/api/src/routes/listing-location/admin-location-routes.ts`, modelo `packages/db/src/models/listing/listing-location.model.ts`). Permiso `listing.locationException.manage`.
- Existe la pantalla admin «Direcciones repetidas» (`apps/admin/src/features/location-duplicates/`).

**Lo que falta**: el dueño no puede pedir la excepción; quitarla no tiene UI; y el `clearException` **borra** las cuatro columnas, de modo que de una excepción retirada no queda registro de quién la concedió, ni quién la quitó, ni cuándo.

## Decisiones del owner (15/11/2026)

Finales. Esta spec no deja decisiones abiertas.

**Lado dueño (web, CSS Modules, i18n es/en/pt)**

1. Donde se muestra el aviso de duplicado (sección «Ubicación» del editor, en borrador) y cuando el publicar falla con `DUPLICATE_LOCATION`, aparece un botón **«Pedir una excepción»**.
2. Abre un formulario corto con un motivo (mínimo 10 caracteres).
3. La ficha muestra el estado del pedido: pendiente, aprobado (ya puede publicar) o rechazado (con el motivo del admin).
4. A lo sumo **UN pedido pendiente** por ficha. Tras un rechazo el dueño puede volver a pedir.
5. El dueño recibe el resultado por **email y en la app**: dos tipos de notificación nuevos (aprobada, rechazada), con plantillas de email es/en/pt, siguiendo los patrones existentes.

**Lado admin (Tailwind v4 + Shadcn, TanStack Table/Form)**

6. Pantalla **«Pedidos de excepción»** con los pedidos pendientes: ficha, dueño, dirección, ficha(s) que chocan y el motivo del dueño.
7. **Aprobar** concede la excepción exactamente como la concesión existente (atada a la clave; registra admin, motivo y fecha). El motivo de aprobación **por defecto es el del dueño**, editable.
8. **Rechazar** exige un motivo, que le llega al dueño.
9. Botón **«Quitar excepción»** en las excepciones concedidas (bloque del formulario de la ficha y/o pantalla de duplicados). Si quitarla dejaría **dos fichas PUBLICADAS del mismo dueño con la misma clave**, se rechaza con 409 hasta que una se despublique.
10. **No hay email a los admins**: ven la cola en pantalla.

**Ambos lados**

11. Todo queda **auditado**: pedido, aprobación, rechazo y retiro, cada uno con actor y fecha, y motivo cuando corresponde. El retiro se guarda con la misma calidad que la concesión, no sólo como línea de log.
12. Toda acción admin usa el permiso existente `listing.locationException.manage`.
13. Las rutas del dueño autorizan por **propiedad de la fila**: la ficha ajena responde **404, nunca 403** (`apps/api/docs/error-contract.md`).

## 1. Hallazgos que condicionan el diseño

1. **El permiso ya existe** y ya está asignado a `SUPER_ADMIN` y `ADMIN` (migración 0205, data-migration 0173). No hace falta permiso ni data-migration de permisos nueva.
2. **No existe un centro de notificaciones en la app.** `NotificationType` (`packages/notifications/src/types/notification.types.ts`) entrega por email; el único otro canal es el de alertas de precio. La decisión 5 pide «en la app»: ver D-3.
3. **El modelo de la excepción borra su rastro.** `setException`/`clearException` sólo escriben/anulan columnas de la propia ficha. Para auditar el retiro con la calidad de la concesión hace falta un registro que sobreviva a la anulación (ver §2.2).
4. **La excepción es por clave**, no por ficha: vigente sólo mientras `location_key = location_exception_key`. Un pedido hereda esa atadura: se pide para la clave que la ficha tiene **hoy**.
5. **Precedente de «un lado declara, el otro resuelve»**: los usos de beneficio de HOS-376 (rutas por propiedad de fila sin `requiredPermissions`, 404 para lo ajeno, un guard estático que impide declarar permisos). Las rutas del dueño de esta spec siguen esa forma.
6. Las plantillas con es/en/pt viven en el camino `NotificationType` (referencia: `HOST_TRADE_USAGE_REJECTED`: tipo, categoría `TRANSACTIONAL` en `notification-categories.ts`, asunto en `subject-builder.ts`, plantilla y `notification.service.ts`). El camino `email_outbox` (`verticals.*`) es sólo en español y **no** sirve para esta spec.

## 2. Modelo de datos (carril estructural)

Dos tablas nuevas, **en singular** (convención de las tablas nuevas del repo), una migración generada con `pnpm db:generate`. Número: se re-chequea contra `origin/staging` justo antes de pushear (a la fecha de esta spec `0225` ya está tomada por `0225_hos2222_partner_claim_email.sql`; el siguiente libre fue `0226`, a confirmar).

### 2.1 `location_exception_request` (estado del pedido)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `vertical` | text, CHECK in (`accommodation`, `venue`) | misma restricción que `LocationKeyVertical` |
| `listing_id` | uuid | sin FK (polimórfica por vertical); índice `(vertical, listing_id)` |
| `requested_by` | uuid FK `users.id` ON DELETE SET NULL | el dueño |
| `location_key` | text NOT NULL | la clave de la ficha **al pedir** |
| `reason` | text NOT NULL | motivo del dueño |
| `status` | text CHECK in (`PENDING`, `APPROVED`, `REJECTED`, `SUPERSEDED`) | |
| `requested_at` | timestamptz NOT NULL | |
| `decided_by` | uuid NULL FK `users.id` ON DELETE SET NULL | |
| `decided_at` | timestamptz NULL | |
| `decision_reason` | text NULL | obligatorio al rechazar; al aprobar es el motivo de la concesión |

- **Un solo pendiente por ficha**: índice único parcial `(vertical, listing_id) WHERE status = 'PENDING'`. Lo hace cumplir la base (concurrencia), el servicio lo pre-chequea y mapea el `23505` a 409.
- `SUPERSEDED`: el pedido pendiente que quedó obsoleto (la ficha cambió de clave, o un admin concedió la excepción directamente). No es un resultado que el dueño vea como rechazo.
- Expand-only, tabla nueva, sin tocar `accommodations`/`venues`.

### 2.2 `location_exception_event` (auditoría append-only)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `vertical`, `listing_id` | igual que arriba | índice `(vertical, listing_id, created_at)` |
| `action` | text CHECK in (`REQUESTED`, `APPROVED`, `REJECTED`, `GRANTED`, `REVOKED`) | |
| `actor_id` | uuid NULL FK `users.id` ON DELETE SET NULL | |
| `reason` | text NULL | |
| `location_key` | text NULL | clave vigente al momento |
| `request_id` | uuid NULL FK a la tabla de pedidos | |
| `created_at` | timestamptz NOT NULL default now() | |

- **Una fila por acción, nunca se actualiza ni se borra** (sin ruta ni método de modelo que lo haga; un test estático lo fija).
- `GRANTED` es la concesión directa del admin (la ruta que ya existe); `APPROVED` es la resolución de un pedido y **además** concede; una aprobación escribe `APPROVED` y concede sobre la ficha, sin fila `GRANTED` duplicada (D-2).
- `REVOKED` guarda actor, fecha, motivo (si vino) y la clave: es el registro que hoy se pierde.
- Cada escritura de evento ocurre **en la misma transacción** que el cambio de estado que audita (nunca «después»).

### 2.3 Seed y data-migrations

Sin cambios de seed: el permiso y sus asignaciones ya existen, y las dos tablas arrancan vacías. **No se usa un número de data-migration.** Si el generador de migraciones revelara un enum de Postgres para `NotificationType` o un catálogo de tipos, se aplica la regla de dual-write (baseline + data-migration, último número conocido `0176`).

## 3. Servicio

`packages/service-core/src/services/listing/` (junto a `listing-location-key.ts`), RO-RO, devolviendo `Result`/errores tipados, **todo en una transacción**:

- `requestLocationException({ vertical, listingId, actor, reason })`
- `approveLocationExceptionRequest({ requestId, vertical, admin, reason? })`
- `rejectLocationExceptionRequest({ requestId, vertical, admin, reason })`
- `revokeLocationException({ vertical, listingId, admin, reason? })`
- `grantLocationException` (la concesión directa existente, ahora también escribe `GRANTED` y supersede el pedido pendiente).

Reglas:

- **Pedir**: la ficha existe y es del actor (si no, 404); tiene clave (si no, 409 `LOCATION_EXCEPTION_NEEDS_KEY`); no tiene ya una excepción vigente (409 `LOCATION_EXCEPTION_ALREADY_GRANTED`); **hoy** comparte clave con otra ficha publicada y viva **del mismo dueño** (si no, 409 `LOCATION_EXCEPTION_NOT_NEEDED`: pedir sin choque no tiene sentido y la cola admin quedaría con pedidos sin ficha que choque); no tiene otro pedido pendiente vigente (409 `LOCATION_EXCEPTION_REQUEST_PENDING`). Un pendiente **obsoleto** (su `location_key` ya no es la de la ficha) se marca `SUPERSEDED` en la misma transacción y no bloquea. Motivo ≥ 10 y ≤ 500 caracteres (mismo schema base que la concesión).
- **Aprobar**: sólo sobre un pedido `PENDING` (si no, 409 `LOCATION_EXCEPTION_REQUEST_NOT_PENDING`); la clave del pedido debe seguir siendo la de la ficha (si no, el pedido pasa a `SUPERSEDED` y responde 409 `LOCATION_EXCEPTION_REQUEST_STALE`). Concede con `setException` (la misma operación que la concesión directa) y deja `status = APPROVED`, `decided_*` y `decision_reason` (por defecto el motivo del dueño; el admin puede editarlo, ≥ 10).
- **Rechazar**: sólo `PENDING`; motivo del admin ≥ 10; `status = REJECTED`. La ficha no cambia.
- **Quitar**: `clearException` **más** el evento `REVOKED`. Si la ficha está `PUBLISHED` y existe otra ficha del mismo dueño, publicada, viva y sin excepción vigente con la misma clave (`findOwnOccupant`), responde 409 `LOCATION_EXCEPTION_REVOKE_CONFLICT` con `details.existingListingId` (id del propio dueño, por lo tanto no filtra nada a un tercero) y **no cambia nada**. Una ficha en borrador o sin choque se quita sin más. El índice único parcial es la red de seguridad contra la carrera: su `23505` se mapea al mismo 409.
- Quitar sobre una ficha **sin excepción vigente** responde 200 idempotente sin escribir evento (no hay nada que auditar).
- Concesión directa con un pedido pendiente de la misma ficha y clave: el pedido pasa a `APPROVED` con el admin y el motivo de la concesión (se escribe un solo evento, `APPROVED`, ver D-2).

## 4. API

Se mantiene el orden del contrato de errores (401 → 403 → 400 → 404 → reglas 409). Toda ruta nueva respeta `page`+`pageSize` (nunca `limit`).

### 4.1 Dueño (tier `protected`, autoriza por propiedad de fila, sin `requiredPermissions`)

| Ruta | Efecto |
|---|---|
| `POST /api/v1/protected/{accommodations,venues}/:id/location-exception-request` body `{ reason }` | Crea el pedido. 201 `{ id, status: 'PENDING', requestedAt }`. Ficha ajena o inexistente: **404**. UUID inválido: 400 |
| `GET /api/v1/protected/{accommodations,venues}/:id` (proyección existente) | Suma `locationException: { hasException: boolean, request: { status, reason, decisionReason, requestedAt, decidedAt } \| null }`. `request` es el **último** pedido de la ficha para la clave vigente. Nunca incluye ids ajenos |

Un guard estático (copia del de HOS-376) verifica que estas rutas **no** declaren `requiredPermissions` y que el 404 de lo ajeno no se pueda convertir en 403.

### 4.2 Admin (tier `admin`, `requiredPermissions: [LISTING_LOCATION_EXCEPTION_MANAGE]`)

| Ruta | Efecto |
|---|---|
| `GET /api/v1/admin/{accommodations,venues}/location-exception-requests?status=&page=&pageSize=` | Cola. Por defecto `status=PENDING`. Cada fila: `requestId`, `listing { id, name }`, `owner { id, name, email }`, `address` (calle, número, piso, depto, destino), `collidingListings [{ id, name }]` (publicadas del mismo dueño con la misma clave), `reason`, `requestedAt`. Se monta **antes** de `/{id}` |
| `POST /api/v1/admin/{accommodations,venues}/location-exception-requests/:requestId/approve` body `{ reason? }` | Aprueba y concede (§3) |
| `POST /api/v1/admin/{accommodations,venues}/location-exception-requests/:requestId/reject` body `{ reason }` | Rechaza (§3) |
| `GET /api/v1/admin/{accommodations,venues}/:id/location-exception` | Estado vigente (`hasException`, `by`, `reason`, `at`) + historial de eventos de la ficha (más nuevo primero) |
| `DELETE /api/v1/admin/{accommodations,venues}/:id/location-exception` body `{ reason? }` opcional | Quita la excepción (§3). Ya existe; suma auditoría y el 409 |
| `POST …/:id/location-exception` | Ya existe; suma el evento `GRANTED` |

### 4.3 Códigos de error nuevos

Todos son **409 `ALREADY_EXISTS`** con `details.reason` (conflicto de estado, paso 6 del contrato), salvo los 404/400 habituales.

| `details.reason` | Cuándo |
|---|---|
| `LOCATION_EXCEPTION_REQUEST_PENDING` | ya hay un pedido pendiente vigente |
| `LOCATION_EXCEPTION_ALREADY_GRANTED` | la ficha ya tiene la excepción vigente |
| `LOCATION_EXCEPTION_NOT_NEEDED` | la ficha no choca con otra del mismo dueño |
| `LOCATION_EXCEPTION_REQUEST_NOT_PENDING` | aprobar/rechazar un pedido ya resuelto |
| `LOCATION_EXCEPTION_REQUEST_STALE` | la ficha cambió de clave desde el pedido |
| `LOCATION_EXCEPTION_REVOKE_CONFLICT` | quitar dejaría dos publicadas del mismo dueño con la misma clave (`details.existingListingId`) |

Existente: `LOCATION_EXCEPTION_NEEDS_KEY`. Las razones que el cliente debe leer entran en `PUBLIC_DETAILS_ERROR_CODES` (`apps/api/src/utils/response-helpers.ts`) **y** en la tabla de `apps/api/docs/error-contract.md` en el mismo PR. Un 4xx nunca es `INTERNAL_ERROR`.

## 5. Notificaciones

- Dos `NotificationType` nuevos: `LISTING_LOCATION_EXCEPTION_APPROVED = 'listing_location_exception_approved'` y `LISTING_LOCATION_EXCEPTION_REJECTED = 'listing_location_exception_rejected'`, categoría `TRANSACTIONAL` (llegan aunque el usuario haya bajado los opcionales), con su payload tipado, asunto en `subject-builder.ts`, plantilla de email en **es, en y pt** y rama en `notification.service.ts`, siguiendo `HOST_TRADE_USAGE_REJECTED`.
- Payload: nombre de la ficha, vertical, motivo del admin (en el rechazo), enlace al editor de la ficha. **Nunca** incluye la dirección completa ni ids de otras fichas.
- Se emiten **después de commitear** la transacción de aprobar/rechazar, fire-and-forget con `trySendNotification` (el patrón de `apps/api/src/lib/host-trade-notifications.ts`): un fallo del transporte no deshace la decisión.
- **En la app** (D-3): el resultado vive en la ficha. La proyección protegida lleva el estado y, en el rechazo, el motivo; el editor muestra el aviso de resultado hasta que el dueño vuelve a pedir o la ficha cambia de clave.

## 6. UI

### 6.1 Web (CSS Modules, sin Tailwind, formularios nativos + hook propio)

- En `LocationDuplicateNotice.astro` (aviso de borrador) y en el mapeo del 409 `DUPLICATE_LOCATION` de `PublishButton.client.tsx`: botón **«Pedir una excepción»** que abre un formulario corto (motivo, contador, mínimo 10). Enviar → `POST …/location-exception-request`; los 409 nuevos se mapean a mensajes claros, nunca a un error genérico.
- Bloque de estado en la sección «Ubicación» de alojamiento (`mi-cuenta/propiedades/[id]/editar/ubicacion.astro`) y de venue (`mi-cuenta/comercio/[vertical]/[id]/editar/ubicacion.astro`):
  - pendiente: «Tu pedido está en revisión» (sin botón de pedir);
  - aprobado: «Ya podés publicar» (y el aviso de duplicado se oculta porque la excepción está vigente);
  - rechazado: motivo del admin + botón para volver a pedir.
- i18n es/en/pt en `@repo/i18n` (`listing.json`), sin literales; **los valores en/pt no pueden ser iguales al español** (guard de español sin traducir de HOS-1317, si #4397 ya aterrizó).
- Las páginas siguen session-blind: el estado llega por la isla cliente, no por el HTML cacheable.

### 6.2 Admin (Tailwind v4 + Shadcn, TanStack Table + TanStack Form + schemas de `@repo/schemas`)

- Pantalla **«Pedidos de excepción»** (`apps/admin/src/features/location-exception-requests/`), entrada en el sidebar junto a «Direcciones repetidas», con selector de vertical (alojamiento/venue) como la pantalla existente. TanStack Table con: ficha (enlace), dueño, dirección, fichas que chocan, motivo, fecha. Acciones **Aprobar** (diálogo con el motivo del dueño precargado y editable) y **Rechazar** (diálogo con motivo obligatorio).
- Bloque **«Excepción de ubicación»** en el formulario de alojamiento y de venue: estado vigente (quién, cuándo, motivo), botón **Quitar excepción** (diálogo; motivo opcional en el API, sugerido en la UI) y el historial de eventos. El 409 `LOCATION_EXCEPTION_REVOKE_CONFLICT` se muestra con enlace a la ficha que choca.
- «Direcciones repetidas» no cambia (sólo lista grupos **sin** excepción).
- i18n es/en/pt en `admin-pages.json`/`admin-entities.json`; permiso por `PermissionEnum`, nunca por rol.

## 7. Criterios de aceptación

1. Un dueño con una ficha en borrador que comparte dirección con otra publicada suya ve «Pedir una excepción» junto al aviso; enviar con un motivo de 10+ caracteres crea el pedido y la ficha muestra «en revisión».
2. El mismo botón aparece cuando publicar responde `DUPLICATE_LOCATION`.
3. Un motivo de menos de 10 caracteres responde 400 con clave `zodError.*`; sin sesión 401; ficha ajena o inexistente **404** (nunca 403/409); UUID inválido 400.
4. Un segundo pedido con uno pendiente vigente responde 409 `LOCATION_EXCEPTION_REQUEST_PENDING`. Tras un rechazo, pedir de nuevo funciona.
5. Pedir sin choque responde 409 `LOCATION_EXCEPTION_NOT_NEEDED`; con la excepción ya vigente, `LOCATION_EXCEPTION_ALREADY_GRANTED`; sin clave, `LOCATION_EXCEPTION_NEEDS_KEY`.
6. El admin ve el pedido en la cola con ficha, dueño, dirección, fichas que chocan y motivo; sin permiso 403; sin sesión 401.
7. Aprobar concede la excepción (columnas `location_exception_*` con admin, motivo y fecha), deja el pedido `APPROVED`, el dueño recibe el email aprobado y **puede publicar** (200 en el `publish` que antes daba 409).
8. Aprobar con el motivo editado guarda el editado; sin editar guarda el del dueño.
9. Rechazar exige motivo (sin él, 400); deja el pedido `REJECTED`; el dueño recibe el email con el motivo y lo ve en la ficha; la ficha sigue sin poder publicar.
10. Aprobar/rechazar un pedido ya resuelto responde 409 `LOCATION_EXCEPTION_REQUEST_NOT_PENDING`; si la ficha cambió de clave, 409 `LOCATION_EXCEPTION_REQUEST_STALE` y el pedido queda `SUPERSEDED`.
11. Quitar una excepción con la ficha publicada y otra publicada del mismo dueño con la misma clave responde 409 `LOCATION_EXCEPTION_REVOKE_CONFLICT` y **no cambia nada**; tras despublicar una, quitar funciona.
12. **Auditoría**: pedido, aprobación, rechazo, concesión directa y retiro dejan cada uno una fila en `location_exception_event` con actor, fecha, y motivo cuando corresponde; el retiro conserva la clave y el actor aunque las columnas de la ficha queden en NULL. `GET …/location-exception` devuelve el historial.
13. Las filas de evento no se pueden modificar ni borrar por ninguna ruta.
14. Los emails aprobada/rechazada existen en es, en y pt y no filtran dirección ni ids de otras fichas.
15. Experiencias no cambian de comportamiento; las fichas de otro dueño no aparecen en las colisiones del pedido.

## 8. Tests

- **Modelo/servicio** (`packages/db`, `packages/service-core`): matriz de estados del pedido (crear/aprobar/rechazar/supersedido), un-solo-pendiente (incluido el `23505` por carrera), `revoke` con y sin choque, atomicidad pedido+evento, eventos append-only.
- **Integración API** (`apps/api/test/integration/`, bajo `flock /home/qazuor/projects/WEBS/.hos1352-integration.lock`): AC 1-5, 7-12; 401/403/400/404 del contrato; **test de claves exactas** de cada 409 nuevo y de la ausencia de ids ajenos; el dueño A nunca ve ni toca el pedido del dueño B.
- **Guards**: conteos de rutas/permisos congelados (recontar, no sumar a ciegas), guard estático de rutas de dueño sin `requiredPermissions`, guard de i18n (claves en los 3 idiomas; en/pt ≠ es), error-contract, `permission-naming-convention`, `pnpm check:guards`.
- **Notificaciones**: plantilla es/en/pt de cada tipo, payload sin dirección, asunto, categoría `TRANSACTIONAL`.
- **Web/Admin**: formulario de pedido (validación de 10 caracteres), mapeo de los 409, estados pendiente/aprobado/rechazado, cola admin, diálogo de aprobar con motivo precargado, bloque de excepción y refusal del retiro, sin literales.
- **Mutación**: se mutan los guards clave (un-solo-pendiente, 404-nunca-403, bloqueo del retiro con choque, evento en la misma transacción) y se verifica que algún test los atrape.

## 9. Plan de PRs

1. **Docs PR** `[HOS-2192] docs(spec): owner-requested location exceptions` (este archivo), label `whats-new-none`, sin palabra mágica.
2. **PR (a)** `[HOS-2192] feat(api): …`: migración, esquemas Zod, modelo, servicio, rutas de dueño y admin, notificaciones (tipos, plantillas, emisión), contrato de errores. Tests de integración. Sin palabra mágica. `whats-new-none`.
3. **PR (b)** `[HOS-2192] feat(web): …`: UI del dueño (botón, formulario, estados, i18n). Sin palabra mágica. Etiqueta What's New: la decide el orquestador.
4. **PR (c)** `[HOS-2192] feat(admin): …`: pantalla de pedidos, bloque en el formulario de la ficha, quitar excepción. Cuerpo `Closes HOS-2192`.

(b) y (c) se apilan sobre (a) mientras (a) no esté mergeada; el contrato de rutas queda fijo en (a).

## 10. Smoke (`status-needs-smoke-staging`)

1. Con un dueño, tener dos fichas en la misma dirección (una publicada, otra en borrador) y ver «Pedir una excepción».
2. Pedir con un motivo corto: error; con 10+ caracteres: queda «en revisión».
3. Intentar publicar: 409 con el botón de pedir; con el pedido pendiente no se puede volver a pedir.
4. Como admin, abrir «Pedidos de excepción», ver el pedido y **rechazarlo** con motivo: el dueño recibe el email y ve el motivo en la ficha.
5. El dueño pide de nuevo; el admin **aprueba** (motivo editado): el dueño recibe el email y publica.
6. Como admin, **quitar** la excepción con ambas publicadas: 409; despublicar una y volver a quitar: OK.
7. Revisar en el historial de la ficha que pedido, rechazo, pedido, aprobación y retiro quedaron con actor y fecha.
8. Con otra cuenta, confirmar que no puede ver ni pedir sobre la ficha de otro dueño (404).

## Decisiones tomadas en la implementación

> Las decisiones del owner de arriba son finales. Lo que sigue son huecos que no cubrían, resueltos del modo más consistente con la spec HOS-1810. Se completan al implementar.

- **D-1 (retiro sin motivo obligatorio)**: `DELETE …/location-exception` conserva su forma (sin cuerpo exigido) para no romper a sus consumidores; el motivo es opcional en el API y se guarda en el evento `REVOKED` cuando viene. La UI lo pide. Alternativa descartada: motivo obligatorio vía una ruta nueva `POST …/revoke` (duplica la ruta existente sin que lo pida el owner).
- **D-2 (un evento por acción)**: aprobar un pedido escribe **un** evento `APPROVED` (con `request_id`) y concede sobre la ficha; no escribe además un `GRANTED`. `GRANTED` es sólo la concesión directa. Así «qué pasó» se lee sin duplicados y `GRANTED`/`APPROVED` distinguen el origen.
- **D-3 («en la app»)**: el repo no tiene un centro de notificaciones ni un canal in-app (verificado: `NotificationType` entrega por email; el otro canal es de alertas de precio). Se interpreta «en la app» como el **estado persistente del pedido en la propia ficha** (aviso de resultado en la sección «Ubicación», con el motivo del rechazo), que es lo que el dueño ve al volver a su cuenta. Crear un centro de notificaciones queda fuera de alcance y se propone como issue aparte si el owner lo quiere.
- **D-4 (pedidos obsoletos)**: un pedido es válido sólo para la clave con que se hizo; si la clave cambia queda `SUPERSEDED` y no bloquea uno nuevo.
- **D-5 (pedir exige choque)**: sólo se puede pedir cuando hoy existe una ficha propia publicada con la misma clave. Consecuencia aceptada: el 409 de mover una publicada a una dirección ocupada (PATCH) no ofrece el botón, porque la ubicación guardada no cambia; el dueño debe despublicar o cambiar la dirección.
