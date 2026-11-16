---
title: Eventos de local - botón «Comprar entrada» con link a la ticketera
linear: HOS-2255
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - api
  - web
  - db
---

# Eventos de local: botón «Comprar entrada»

Hija de la épica HOS-2252. Fase 1: no toca el catálogo, se puede hacer ya. Depende de **HOS-2291** (ids de evento estables), que antes era la tarea T-1 de esta spec y se extrajo a su propio issue (sección 6.1).

## 1. Summary

El dueño puede cargar a cada evento un link externo de entradas (Passline, Venti, la web del local). La ficha muestra el botón «Comprar entrada» que abre el link en pestaña nueva. Cada clic se registra para las métricas (HOS-2256 / HOS-2265).

## 2. Problem

- Hoy el evento no tiene forma de llevar al turista a comprar. El schema lo dice en voz alta: «No price, no capacity, no ticketing either» (`venue.event.schema.ts`, bloque de cabecera).
- Para medir cuántos clics tuvo cada evento hace falta que el evento tenga un id que sobreviva a los guardados. Hoy no lo tiene (ver 5.2); lo resuelve HOS-2291.

## 3. Goals

- G-1. Campo opcional `ticketUrl` por evento: cualquier link https, sin credenciales en la URL, validado en el schema compartido.
- G-2. Botón «Comprar entrada» en la ficha, para todos los planes que tienen eventos (sin entitlement propio).
- G-3. El botón abre en pestaña nueva con `rel="noopener nofollow"`.
- G-4. Cada clic se registra con el id del evento (si HOS-2256 está desplegado).

## 4. Non-goals

- NG-1. Vender entradas, precio, cupo o pasarela. Es sólo un link.
- NG-2. Lista blanca de ticketeras. Decidido (owner, 16/11/2026): cualquier https (OQ-1).
- NG-5. Ids estables de eventos y el diff en `replaceVenueEvents`: son de HOS-2291.
- NG-3. Página propia del evento (ver HOS-2265).
- NG-4. El mecanismo de registro de clics en sí: lo define HOS-2256. Esta spec sólo lo consume.

## 5. Current baseline (verificado en `origin/staging`)

### 5.1 Esquema y payload

- Tabla `venue_events` (`packages/db/src/schemas/venue/venue_event.dbschema.ts:44-80`): sin columna de link.
- `VenueEventInputSchema` (`packages/schemas/src/entities/venue/subtypes/venue.event.schema.ts:263-290`): `title`, `description`, `recurrence`, `date`, `weekday`, `startTime`, `endTime`, `isActive`. Sin `id`, sin `ticketUrl`. `VenueEventSchema` (líneas 131-157) sí tiene `id`, y `VenueEventPublicSchema` lo expone (`id` viaja al público; `VenueEvent` en `apps/web/src/data/types.ts:1213`).
- Hay precedente de URL https en el repo: `menuUrl` en `packages/schemas/src/entities/venue/venue.http.schema.ts:114-118` (`.url().startsWith('https://')`, mensajes `zodError.venue.menuUrl.*`).
- Existe `safeExternalUrlSchema`-style (`packages/schemas/src/common/safe-external-url.schema.ts`) que permite `http`/`https`; no sirve tal cual porque acá se exige sólo https.

### 5.2 Los ids NO son estables (resuelto en HOS-2291)

`replaceVenueEvents` (`packages/service-core/src/services/venue/venue.events.ts:243-275`) hace `eventModel.hardDelete({ venueId })` y reinserta todo con `create`. El propio archivo lo dice (líneas 20-27): "Entry ids are not stable across a save ... Nothing references an agenda entry today — no photo, no ticket, no metric — so a diff would be machinery with no consequence ... The day something DOES reference an entry, this function grows a diff". **Ese día es éste** y por eso existe HOS-2291: un clic con `eventId` y las estadísticas por evento (HOS-2265) quedarían huérfanos en cada guardado, aunque el dueño sólo corrija un typo en otro evento. El editor tampoco carga ids (`venue-event-draft.ts`, "Ids are not carried"; `VenueEventsManager.client.tsx` mapea sin `id`).

### 5.3 Ruta y editor

- `PUT .../events` (`apps/api/src/routes/venue/protected/putEvents.ts:75-101`): `listingAccess` con `operation: 'EDIT'` y `listingSection` `venueEvents`; el cuerpo es el documento completo.
- Render público: `VenueEvents.astro` muestra título, cuándo y descripción; sin acciones.
- `EntityViewTracker.client.tsx` es el beacon de vistas actual (`apps/web/src/components/analytics/EntityViewTracker.client.tsx`). El de clics lo define HOS-2256.

## 6. Proposed design

### 6.1 Ids estables (dependencia: HOS-2291)

Esta spec **depende de HOS-2291** (ids estables de eventos), que antes era su tarea T-1. Allí viven el `id?` en `VenueEventInputSchema`, el diff dentro de la transacción de `replaceVenueEvents` (update de ids propios, create de los nuevos o ajenos, `hardDelete` de los ausentes), el editor que carga y reenvía `id`, la compatibilidad con clientes viejos y sus tests de regresión. Esta spec asume que el `id` ya viaja y se conserva entre guardados; el botón lo expone como `data-event-id`.

### 6.2 Columna nueva

Migración **estructural** (carril 1, `pnpm db:generate`):

```sql
ALTER TABLE "venue_events" ADD COLUMN "ticket_url" text;
```

`ticketUrl: text('ticket_url')` en `venue_event.dbschema.ts`. Nullable, sin default. Sin CHECK (la validación es del schema Zod, igual que el resto del recurso; el archivo de schema ya explica que no hay CHECK cruzado porque hay un solo escritor). Última migración al relevar: `0226_hos2192_location_exception_requests.sql`; el número real lo asigna `db:generate`.

No es migración de catálogo ni de seed: no aplica la regla de dual-write del seed (el link es dato del dueño, no del catálogo).

### 6.3 Schema Zod

En `venue.event.schema.ts`:

```ts
export const VenueEventTicketUrlSchema = z
  .string().trim()
  .max(2048, { message: 'zodError.venue.event.ticketUrl.max' })
  .url({ message: 'zodError.venue.event.ticketUrl.invalid' })
  .startsWith('https://', { message: 'zodError.venue.event.ticketUrl.httpsRequired' })
  .refine((v) => { try { const u = new URL(v); return u.username === '' && u.password === ''; } catch { return false; } },
          { message: 'zodError.venue.event.ticketUrl.credentials' });
```

- `VenueEventSchema`: `ticketUrl: VenueEventTicketUrlSchema.nullable()`.
- `VenueEventInputSchema`: `ticketUrl: VenueEventTicketUrlSchema.nullish()`; `''` se normaliza a `null` en el servicio (mismo criterio que `description`).
- `VenueEventPublicSchema` lo incluye (es público a propósito: es lo que renderiza el botón).
- Se corrige el comentario "No ticketing" de la cabecera: ahora es "no price, no capacity; sólo un link externo de entradas".

### 6.4 Servicio

`replaceVenueEvents`: persiste `ticketUrl: event.ticketUrl || null`. `projectEvent` lo devuelve tal cual. Sin gate de plan (G-2): el campo viaja con la sección `venueEvents`, que ya está gateada por `manage_venue_events`.

### 6.5 Web: ficha

`VenueEvents.astro`: si `event.ticketUrl`, renderiza

```html
<a class="venue-venue-events__ticket" href={ticketUrl} target="_blank"
   rel="noopener nofollow" data-venue-event-ticket data-event-id={event.id}>
  Comprar entrada
</a>
```

Estilos en el bloque `<style>` del componente (Astro, vanilla CSS, nada de Tailwind en web). El texto sale de `t('venue.detail.venueEvents.buyTicket', ...)`.

Registro del clic: un island/script mínimo `VenueEventTicketClickTracker.client.tsx` (o un handler delegado en el script de la ficha) que escucha clics en `[data-venue-event-ticket]` y envía el beacon definido por HOS-2256 (`navigator.sendBeacon`, sin bloquear la navegación). Todo del lado cliente: la ficha sigue "session-blind" (`apps/web/test/pages/cacheable-pages-are-session-blind.guard.test.ts`). Si HOS-2256 todavía no está desplegado, el botón funciona igual y el tracker queda como no-op detrás de la función de HOS-2256 (ver 11, dependencias).

**Supuestos sobre HOS-2256** (a confirmar con su spec): una tabla `entity_interactions` con `entityType`, `entityId` (el local), `kind`, `eventId` nullable, `visitorHash`, `at`; `kind = 'TICKET_CLICK'` con `eventId` = id del evento (lo lista el propio issue de HOS-2256). `eventId` debería ser FK a `venue_events(id) ON DELETE SET NULL`. Si HOS-2256 prefiere extender `entity_views`, cambia sólo el destino del beacon, no esta spec.

### 6.6 Web: editor

`VenueEventEntryCard.client.tsx` suma un input «Link de entradas (opcional)» (`type="url"`, `inputMode="url"`, placeholder `https://`), con error inline si no es https (mismo schema importado de `@repo/schemas`). `EventDraft` suma `ticketUrl: string`. `saveEvents` manda `ticketUrl: entry.ticketUrl.trim() || null`.

### 6.7 i18n (es / en / pt)

- Público (`venue.json`, `venue.detail.venueEvents.*`): `buyTicket` («Comprar entrada», «Buy tickets», «Comprar ingresso»).
- Editor (`venue.owner.editor.venueEventsManager.*`): `ticketUrl`, `ticketUrlPlaceholder`, `ticketUrlHelp` («Si vendés entradas por Passline, Venti u otra, pegá el link acá»).
- Errores (`zodError.venue.event.ticketUrl.{max,invalid,httpsRequired,credentials}`).

## 7. Data model / contracts

- DB: `venue_events.ticket_url text NULL`.
- API protegida: `PUT /protected/venues/:id/events` item suma `ticketUrl?` (el `id?` lo suma HOS-2291); `GET` y la respuesta del PUT devuelven `ticketUrl`.
- API pública: `venueEvents[].ticketUrl` (nullable). El proyector no cambia (la sección ya se gatea entera).
- Error contract: 400 `VALIDATION_ERROR` por URL inválida o `id` repetido; sin códigos nuevos.
- Tier y permisos: sin cambio (protected, owner, `VENUE_EDIT_OWN`/`ALL` en el servicio; `manage_venue_events` en `listingAccess`).

## 8. UX / UI behavior

1. En el editor, cada evento tiene un campo opcional de link. Si el valor no empieza con `https://`, se marca el campo y se bloquea el guardado con el mensaje.
2. En la ficha, el evento con link muestra un botón secundario «Comprar entrada» a la derecha/abajo del cuándo (en mobile, abajo, ancho completo).
3. El link se abre en pestaña nueva; la ficha queda donde estaba.

## 9. Acceptance criteria

- AC-1. Dado un `PUT` con `ticketUrl: 'https://www.passline.com/e/x'`, la respuesta y un `GET` posterior devuelven el mismo valor.
- AC-2. `ticketUrl: 'http://...'`, `'javascript:...'`, `'https://user:pass@x.com'` o más de 2048 caracteres devuelven 400 `VALIDATION_ERROR`. Cualquier otro `https://` sin credenciales se acepta (no hay lista blanca).
- AC-3. `ticketUrl: ''` o ausente se guarda como `null`.
- AC-4. Dado un evento con link, la ficha pública renderiza un `<a target="_blank" rel="noopener nofollow">` (con ambos valores en `rel`) hacia ese link, con el texto del idioma activo (es/en/pt).
- AC-5. Dado un evento sin link, no hay botón.
- AC-6. Un plan con eventos pero sin ninguna clave nueva puede cargar el link (sin entitlement propio).
- AC-7. (Movido a HOS-2291: conservación de ids entre guardados, ids ajenos o repetidos, clientes sin ids.)
- AC-10. Un cliente que no manda `ticketUrl` sigue guardando correctamente.
- AC-11. Con HOS-2291 desplegado, el `id` del evento no cambia al editar otro evento y el clic sigue apuntando al mismo evento.
- AC-11b. El clic en el botón dispara el beacon de HOS-2256 con `kind='TICKET_CLICK'` y el `eventId` (verificable cuando HOS-2256 esté desplegado) y no demora la navegación.
- AC-12. La ficha sigue pasando `cacheable-pages-are-session-blind`.

## 10. Test plan

- Unit schema (`packages/schemas/test/entities/venue/venue.event.schema.test.ts`, existente): casos de `ticketUrl` (válido, http, credenciales, larguísimo, vacío).
- Unit servicio (`packages/service-core/test/services/venue/venue.events.test.ts`, existente): `ticketUrl` se persiste y `''` pasa a `null`. Los tests del diff de ids son de HOS-2291.
- Integración DB (`packages/db/test/integration/`, junto a `listing-purge.rows.integration.test.ts` que ya cubre la tabla): `ticket_url` persiste.
- Route (`apps/api/test/routes/venue/protected/content-routes-chain.test.ts`): payload con `ticketUrl`.
- Público (`apps/api/test/routes/venue/public/`): el payload trae `ticketUrl`.
- Web: `VenueEventEntryCard.weekdays.test.tsx` (existente) se extiende; nuevo `VenueEvents.ticket.test.ts` (render con/sin botón, atributos `rel`/`target`), y test del tracker con `sendBeacon` mockeado.
- Guard i18n de es/en/pt corre en CI.
- Mutación manual: sacar `rel="noopener nofollow"` y comprobar que el test falla; aceptar `http://` y comprobar que AC-2 falla.

## 11. Risks and open questions for the owner

- R-1. **Phishing/enlaces peligrosos**: un dueño podría poner cualquier https. Mitigación decidida por el owner: sólo https, sin credenciales, `rel="noopener nofollow"`, y el link lo ve cualquiera en la ficha pública (moderable por staff vía admin). Sin lista blanca (OQ-1).
- R-2. Dependencia de HOS-2291: sin ids estables, el `eventId` del clic queda huérfano en cada guardado. El botón y el campo funcionan igual; sólo se degrada la medición.
- R-3. Dependencia blanda de HOS-2256: si no está, el botón sale sin medición. Mitigado: el tracker es no-op hasta que exista.
- R-4. Al borrar un evento, sus clics se conservan sin el evento (FK `event_id` `ON DELETE SET NULL`, HOS-2256 / HOS-2265). Ver OQ-2.

**OQ-1. ¿Sólo ciertas ticketeras o cualquier https?** Decidido (owner, 16/11/2026): cualquier link https, sin credenciales en la URL, que se abre con `rel="noopener nofollow"`. Sin lista blanca ni reporte de abuso en esta etapa.

**OQ-2. Si se borra un evento, ¿se borran sus clics y estadísticas?** Decidido (owner, 16/11/2026): no. Los clics se conservan sin el evento: FK `event_id` con `ON DELETE SET NULL` (HOS-2256, HOS-2265). No hay estado "archivado" ni cascade.

## 12. Implementation notes

- El campo se agrega en `VenueEventInputSchema` **con `.nullish()`** y el servicio normaliza `''` a `null`, igual que `description`.
- `listing-purge.rows.integration.test.ts` ya recorre `venue_events`; confirmar que la columna nueva no rompe el conteo de filas.
- Orden: HOS-2291 (ids estables) va antes, porque HOS-2256/HOS-2265 lo necesitan para guardar `eventId` estable. Esta spec puede empezar la columna y el botón en paralelo.

### Task breakdown

1. T-1. Columna `ticket_url` + migración estructural + schema Zod (https, sin credenciales) + servicio (0,5 día).
2. T-2. Botón en `VenueEvents.astro` + estilos + i18n público (0,5 día).
3. T-3. Campo en el editor + i18n del editor (0,5 día).
4. T-4. Tracker de clics (consume HOS-2256) + test con `sendBeacon` (0,5 día; puede ir detrás de HOS-2256).

## 13. Linear

Canonical tracking: HOS-2255. Padre: HOS-2252.

- Dependencias: **HOS-2291** (ids estables de eventos, extraída de la antigua T-1 de esta spec) bloquea a HOS-2256 en lo que toca `eventId`, y a HOS-2263, HOS-2264 y HOS-2265. Registro de clics: HOS-2256.
- Smoke: `status-needs-smoke-staging` (el clic real y el beacon sólo se ven contra el entorno). Sin `smoke-prod`.
- What's New: sí («Ahora podés poner un link de entradas en tus eventos»).

## Nota de coordinación (16/11/2026)

Alineado con la spec de HOS-2256, que es la dueña de la tabla `entity_interactions`. Los kinds van en mayúsculas (`TICKET_CLICK`, `EVENT_IMPRESSION`). La FK `event_id` va con `ON DELETE SET NULL` por defecto, aunque queda a decisión del owner (OQ-3 de HOS-2256). El botón no necesita un tracker propio: lleva `data-interaction-kind` y `data-interaction-event-id`, que lee el tracker común de HOS-2256. La tarea de ids estables (antes T-1) pasó a ser su propio issue, **HOS-2291**, y la FK `ON DELETE SET NULL` quedó decidida por el owner el 16/11/2026.
