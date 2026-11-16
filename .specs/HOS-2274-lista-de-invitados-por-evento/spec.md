---
title: Lista de invitados por evento
linear: HOS-2274
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - db
  - api
  - web
---

# Lista de invitados por evento

## 1. Resumen

El local de noche activa una lista de invitados en uno de sus eventos, con cupo y hora
de cierre. El turista (con cuenta) se anota. El local ve la lista, la exporta a CSV y
puede marcar quién entró o faltó. Pro tiene cupo hasta 100 por evento; premium sin tope.
Solo para locales con el rubro **noche**.

Esta spec asume las opciones recomendadas de HOS-2260 (modelo común, OQ-1 a OQ-12).

## 2. Problema

Un boliche vive de la lista: la gente se anota para entrar sin cola o gratis hasta
cierta hora. Hoy lo hacen por Instagram y WhatsApp, sin cupo ni registro. La plataforma
no tiene nada de esto.

## 3. Goals

- G-1: el local activa la lista por evento, con cupo (en personas) y cierre.
- G-2: el turista se anota con un toque, ve su anotación en "Mi cuenta" y recibe correo.
- G-3: el local ve la lista y la exporta a CSV.
- G-4: gate `venue_guest_list` y límite `max_venue_guest_list_size` (pro 100, premium sin tope).
- G-5: funciona para eventos únicos **y semanales** (la lista es por fecha).

## 4. Non-goals

- NG-1: QR de ingreso (HOS-2276). Acá la anotación se muestra con un código corto de texto.
- NG-2: lista de espera, listas por promotor ("lista de Juan"), precios o entrada paga.
- NG-3: lista para gastronomía. La decisión 4 del owner la limita al rubro noche.
- NG-4: avisos por correo al local por cada anotado (solo panel y CSV).

## 5. Estado actual del código

- `venue_events` (`packages/db/src/schemas/venue/venue_event.dbschema.ts:97`): evento
  único (`date`) o semanal (`weekday`, 0 a 6, domingo = 0), `startTime`, `endTime`,
  `isActive`. **Sin capacidad ni ids estables.**
- `replaceVenueEvents` (`packages/service-core/src/services/venue/venue.events.ts:218`)
  **borra y reinserta todo**; el comentario de la línea 22 advierte que ningún ente
  referencia aún un evento. Esta spec es el primero que lo hace.
- Payload sin ids: `VenueEventsReplacePayloadSchema`
  (`packages/schemas/src/entities/venue/subtypes/venue.event.schema.ts:~300`), tope 30.
- Ruta de escritura: `apps/api/src/routes/venue/protected/putEvents.ts` (gate
  `manage_venue_events` por la sección `venueEvents`, `listing-sections.ts:108`).
- Editor web: `apps/web/src/components/venue/VenueEventsManager.client.tsx`.
- Rubro noche: `business-lines.ts:35-38`, `sections: ['nightInfo']`. Una sección nueva
  que figure solo en `nightlife` queda ausente (`SECTION_ABSENT`, 409) para un local de
  solo comida, sin código extra. Es "el mismo mecanismo" que pidió el owner.
- Límite por ruta: `listingAccess.limit` en `apps/api/src/middlewares/listing-access.ts:208`
  (precedente `routes/user-bookmark/protected/create.ts:89`: `{ key, requested }`).
- Clave de límite y de entitlement: **no existen**; las declara HOS-2259.
- Mi cuenta: `apps/web/src/pages/[lang]/mi-cuenta/` (sin sección de reservas).

## 6. Diseño propuesto

### 6.1 Prerrequisito: ids estables de eventos (tarea 1)

`replaceVenueEvents` pasa a **diff por id**:

- El payload admite `id?: uuid` por evento. Con id: update. Sin id: insert. Los ids
  de la base que el payload no menciona: delete.
- Borrar un evento que tiene anotados activos (`CONFIRMED`) responde 409
  `ALREADY_EXISTS`, `details.reason = EVENT_HAS_ACTIVE_ENTRIES`. Para sacarlo, el local
  primero lo da de baja con `isActive = false` y cancela la lista (ver 6.5). Es la
  decisión 6 del owner: nunca se borra lo ya confirmado.
- Mantener compatibilidad: un payload sin ids sigue funcionando para el editor viejo
  mientras no haya listas (se resuelve con id nuevo por evento). Una vez que existe
  alguna lista, el cliente debe mandar ids.
- Puede ya venir resuelto en HOS-2254/2255 (imagen, entrada). Coordinar para no hacerlo
  dos veces.

### 6.2 Modelo de datos

`venue_event_guest_list` (1 a 1 con `venue_events`):

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `event_id` | uuid fk `venue_events` ON DELETE RESTRICT, único | RESTRICT: nunca cascada sobre anotados |
| `is_open` | boolean default true | el local puede cerrarla antes |
| `capacity` | integer not null | personas por fecha; `2147483647` = sin tope |
| `closes_before_start_minutes` | integer not null default 0 | 0 = cierra al empezar el evento |
| `max_companions` | smallint not null default 3 | 0 a 10 por anotación |
| auditoría + soft delete | | |

CHECK en extras: `capacity > 0`, `max_companions between 0 and 10`,
`closes_before_start_minutes between 0 and 1440`.

`venue_guest_list_entry`:

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `guest_list_id` | uuid fk | RESTRICT |
| `occurrence_date` | date not null | la fecha concreta (en un semanal, la del próximo) |
| `user_id` | uuid fk `users` | |
| `display_name` | varchar(120) not null | copia del perfil al anotarse (PII) |
| `party_size` | smallint not null | 1 + acompañantes |
| `status` | enum `venue_guest_entry_status` | `CONFIRMED`, `CANCELLED_BY_GUEST`, `CANCELLED_BY_VENUE`, `CHECKED_IN`, `NO_SHOW` |
| `short_code` | varchar(8) | código legible para la puerta hasta HOS-2276; alfabeto sin ambiguos (`generateShortId` de `@repo/utils`) |
| `checked_in_at`, `cancelled_at` | timestamptz null | |
| `anonymized_at` | timestamptz null | lo pone la cron de retención |
| auditoría + soft delete | | |

Índices: único parcial `(guest_list_id, occurrence_date, user_id)
WHERE status IN ('CONFIRMED','CHECKED_IN') AND deleted_at IS NULL` (patrón del índice
parcial de `host_trade_benefit_usage`, línea 111; va en extras si Drizzle no lo expresa);
`(guest_list_id, occurrence_date, status)` para el conteo de cupo; `(user_id, status)`
para "Mi cuenta".

### 6.3 Cupo y concurrencia

El alta corre en **una transacción**: `SELECT ... FOR UPDATE` sobre la fila de
`venue_event_guest_list`; suma `party_size` de las filas activas de esa fecha; si
`suma + nuevo > capacity` responde 409 `LIST_FULL`. Sin el bloqueo, dos anotaciones
simultáneas pasan el control.

Reglas de cierre, en este orden (ver OQ-7): lista cerrada manualmente, o la fecha de
la ocurrencia ya empezó menos `closes_before_start_minutes`, o fecha pasada: 409
`LIST_CLOSED`. Una fecha de un evento semanal solo se admite dentro de los próximos
14 días.

### 6.4 Gates

- Sección nueva `guestList` en `listing-sections.ts` (vertical venue, `common: false`,
  `entitlementKey: K.VENUE_GUEST_LIST`) y en `BUSINESS_LINES.venue[nightlife].sections`.
- Configurar la lista: `listingAccess` `{ vertical: VENUE, operation: 'EDIT',
  listingSection: guestList, capabilities: [venue_guest_list], limit: () => ({ key:
  'max_venue_guest_list_size', requested: body.capacity }) }`. El límite compara el
  **cupo configurado** con el tope del plan, no la suma de anotados.
- Leer y exportar: operación `READ_OWN_COMMERCIAL` con `capabilities: [venue_guest_list]`.
- **No se gatea** (decisión 6): anotarse en una lista ya abierta, cancelar, y que el
  local marque asistencia. Tras una baja de plan el local ve la lista en solo lectura
  hasta la última fecha confirmada y no puede abrir listas nuevas ni subir el cupo.
- Premium sin tope: valor `2147483647` (`UNLIMITED_LIMIT_VALUE`). El campo `capacity`
  es `integer` (int4, máx. 2147483647), así que **cabe sin desborde**. Ojo con
  add-ons: la suma de plan + add-on sobre `2147483647` desborda int4; el límite
  se calcula en memoria con `bigint`/`number` y se trunca al máximo antes de persistir.
  Es la verificación que pidió el owner en HOS-2259; acá se confirma que **ninguna
  columna de esta feature guarda un valor ya sumado** (se guarda el cupo elegido por el
  local, que el gate acota).

### 6.5 Rutas

Todas con `createProtectedRoute` / `createPublicRoute`, esquemas Zod en `@repo/schemas`.

| Método y ruta | Tier | Quién | Respuesta |
|---|---|---|---|
| `PUT /protected/venues/:id/events/:eventId/guest-list` | protected | dueño (gate) | config creada o actualizada; 409 `SECTION_ABSENT` si no es rubro noche |
| `DELETE /protected/venues/:id/events/:eventId/guest-list` | protected | dueño | cierra y cancela anotados activos (avisa) |
| `GET /protected/venues/:id/events/:eventId/guest-list?date=` | protected | dueño (gate) | filas con nombre, personas, estado, hora de entrada |
| `GET /protected/venues/:id/events/:eventId/guest-list.csv?date=` | protected | dueño (gate) | CSV: nombre, personas, estado, anotado a las |
| `PATCH /protected/venues/:id/guest-list-entries/:entryId` | protected | dueño | `{ action: 'check_in' \| 'no_show' \| 'cancel' }` |
| `GET /public/venues/:id/events/:eventId/guest-list-status?date=` | public | todos | `{ open, full, closesAt }`. **No** devuelve cantidades |
| `POST /protected/guest-list-entries` | protected | turista | `{ eventId, date, companions }` crea; 201 |
| `GET /protected/me/guest-list-entries` | protected | turista | las propias |
| `POST /protected/me/guest-list-entries/:id/cancel` | protected | turista | 404 si no es suya |

- CSV: encabezados fijos, escapar `=`, `+`, `-`, `@` iniciales (inyección de fórmulas),
  UTF-8 con BOM. Sin email ni teléfono.
- Rate limit del `POST`: 10 por hora por usuario.
- `GET` público: `Cache-Control` corto; la isla lo pide, la página no lleva sesión.

### 6.6 Servicio

`VenueGuestListService` en `packages/service-core/src/services/venue/`: `configure`,
`register`, `cancelByGuest`, `markByVenue`, `listForDate`, `exportCsv`, `closeList`.
Devuelve `Result<T>`. Las transiciones son funciones puras probadas con tabla.

### 6.7 Notificaciones (HOS-2260, 6.6)

- `VENUE_GUEST_LIST_CONFIRMED` al anotarse (con evento, fecha, hora de cierre, código).
- `VENUE_GUEST_LIST_CANCELLED_BY_VENUE` cuando el local cancela.
- Plantilla React Email y textos es/en/pt. Se manda por la outbox (`email-outbox`).

## 7. UX / UI

- **Ficha pública del evento:** botón "Anotate en la lista" (island, `client:visible`).
  Estados: abierta, "Lista llena", "Lista cerrada", "Ingresá para anotarte". Para un
  semanal, selector de las próximas fechas.
- **Formulario:** solo cantidad de acompañantes (el nombre sale del perfil). Texto de
  privacidad con el plazo de retención (90 días, OQ-3).
- **Panel del local** (junto a `VenueEventsManager`): toggle "Lista de invitados" por
  evento (solo visible si el rubro es noche; si el plan no la incluye, candado y upsell
  con `VenueSectionLockedPanel`), cupo, cierre, acompañantes; tabla por fecha con
  acciones y botón "Exportar CSV".
- **Mi cuenta → Reservas:** tarjeta con evento, fecha, personas, código y "Cancelar".

## 8. i18n

Claves nuevas bajo `venue.guestList.*` (public, panel) y `account.reservations.*`,
en es, en y pt. Sin textos fijos en componentes.

## 9. Criterios de aceptación

- AC-1: dado un local de rubro noche en plan pro, cuando activa la lista con cupo 100,
  queda configurada; con cupo 101 responde 403 `LIMIT_REACHED`.
- AC-2: dado un local de solo comida, cuando configura la lista, responde 409
  `SECTION_ABSENT` y la UI no muestra el control.
- AC-3: dado un plan premium, el cupo `2147483647` se acepta y no desborda.
- AC-4: dada una lista abierta con 2 lugares libres, cuando un turista se anota con 2
  acompañantes (3 personas), responde 409 `LIST_FULL`.
- AC-5: dado cupo 10 y 20 anotaciones simultáneas de 1 persona, quedan exactamente 10.
- AC-6: dado un turista ya anotado a esa fecha, cuando se anota de nuevo, 409
  `ALREADY_REGISTERED`.
- AC-7: dada una lista cerrada por hora, anotarse responde 409 `LIST_CLOSED`.
- AC-8: dado un evento semanal, cada fecha tiene su propio cupo.
- AC-9: sin sesión, anotarse responde 401; con email sin verificar, 403
  `EMAIL_NOT_VERIFIED`.
- AC-10: el turista cancela su anotación hasta la hora de cierre; la de otro usuario
  responde 404.
- AC-11: el CSV exporta las filas de la fecha, sin email, con escape de fórmulas.
- AC-12: guardar el editor de eventos **no cambia los ids** de eventos existentes y
  conserva las anotaciones.
- AC-13: borrar un evento con anotados activos responde 409 `EVENT_HAS_ACTIVE_ENTRIES`.
- AC-14: tras bajar a básico, lo anotado sigue visible en solo lectura hasta su fecha y
  no se pueden abrir listas nuevas; el turista puede cancelar igual.
- AC-15: el turista recibe el correo en su idioma; el idioma sale de su perfil.

## 10. Plan de pruebas

- Unit (`packages/service-core/test/services/venue/venue-guest-list.test.ts`): tabla de
  transiciones, cálculo de cierre, cupo en personas, fecha de semanal.
- Unit (`packages/schemas/test/...`): esquemas, `capacity` y `max_companions`.
- Integración con base (`packages/service-core/test/integration/...`): concurrencia (AC-5),
  índice único parcial, RESTRICT, diff de eventos con ids (AC-12/13).
- Rutas (`apps/api/test/routes/venue/protected/guest-list.test.ts`, `.../public/`):
  orden del contrato de errores, 404 de ajenos, gate de plan, límite, SECTION_ABSENT.
- Guard: `check-purged-closed-list` (tablas nuevas), page-session-blind (la isla).
- Web (`apps/web/test/components/venue/VenueGuestListManager.test.tsx`, isla de
  anotación): estados y upsell.
- E2E (`apps/e2e`): anotarse, ver en Mi cuenta, panel del local, CSV.

## 11. Riesgos

- R-1: diff de eventos (6.1). Si sale mal, borra anotados. Cubierto con RESTRICT y AC-12/13.
- R-2: sobreventa. Cubierto con bloqueo de fila (AC-5).
- R-3: inyección de fórmulas en CSV. Cubierto con escape.
- R-4: la lista expone nombres. Solo los ve el dueño o staff con `venueReservation.viewAll`.
- R-5: depende de claves del catálogo que no existen hasta HOS-2259.

## 12. Preguntas abiertas para el owner

Las generales están en HOS-2260 (OQ-1, OQ-3, OQ-4, OQ-7, OQ-8, OQ-9). Específicas:

- OQ-A: **¿el cupo cuenta personas o anotaciones?** Recomendada: personas (un cupo de
  100 es 100 que entran). Alternativa: anotaciones, que es más simple pero deja pasar
  300 personas con acompañantes.
- OQ-B: **máximo de acompañantes.** Recomendada: 3 por defecto, configurable de 0 a 10.

## 13. Dependencias

- Bloqueado por: HOS-2260 (decisiones), HOS-2259 (claves), HOS-2262 (textos de la
  tabla), HOS-2254/2255 o issue propio (diff de eventos con ids).
- Habilita: HOS-2276 (QR), HOS-2283 (asignar a planes), HOS-2286 (+100 lugares).
- La lista de espera, si se pide, es otra spec.

## 14. Smoke y What's New

`status-needs-smoke-staging` (correo real, concurrencia, CSV en Excel). What's New: sí,
en la entrada de "Listas y reservas".

## 15. Desglose de tareas

1. T-1: ids estables en `replaceVenueEvents` + esquema + editor web + tests (1 día).
2. T-2: enums y tablas (`venue_event_guest_list`, `venue_guest_list_entry`), migración,
   extras (CHECK, índice parcial), filas PURGED y test congelado (1 día).
3. T-3: esquemas Zod y servicio con transiciones, cupo y bloqueo (1 día).
4. T-4: sección `guestList`, rubro noche y rutas del local con gate y límite (1 día).
5. T-5: rutas del turista, público, rate limit (1 día).
6. T-6: CSV (0,5 día).
7. T-7: notificaciones y plantillas es/en/pt (1 día).
8. T-8: isla de anotación y Mi cuenta (1 día).
9. T-9: panel del local (1 día).
10. T-10: cron de retención de PII (0,5 día; compartida con HOS-2275).
11. T-11: pruebas de integración, E2E y guards (1 día).

## 16. Linear

Canonical tracking:
HOS-2274
