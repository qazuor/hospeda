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

Hija de la épica HOS-2252. Fase 1: no toca el catálogo, se puede hacer ya. Incluye un prerrequisito técnico que cambia el plan de varias hermanas: **ids de evento estables** (sección 6.1).

## 1. Summary

El dueño puede cargar a cada evento un link externo de entradas (Passline, Venti, la web del local). La ficha muestra el botón «Comprar entrada» que abre el link en pestaña nueva. Cada clic se registra para las métricas (HOS-2256 / HOS-2265).

## 2. Problem

- Hoy el evento no tiene forma de llevar al turista a comprar. El schema lo dice en voz alta: «No price, no capacity, no ticketing either» (`venue.event.schema.ts`, bloque de cabecera).
- Para medir cuántos clics tuvo cada evento hace falta que el evento tenga un id que sobreviva a los guardados. Hoy no lo tiene (ver 5.2).

## 3. Goals

- G-1. Campo opcional `ticketUrl` por evento, https, validado en el schema compartido.
- G-2. Botón «Comprar entrada» en la ficha, para todos los planes que tienen eventos (sin entitlement propio).
- G-3. El botón abre en pestaña nueva con `rel="noopener nofollow"`.
- G-4. Cada clic se registra con el id del evento (si HOS-2256 está desplegado).
- G-5. `PUT /protected/venues/:id/events` conserva los ids de los eventos que no cambian de identidad (diff en vez de delete-and-reinsert).

## 4. Non-goals

- NG-1. Vender entradas, precio, cupo o pasarela. Es sólo un link.
- NG-2. Lista blanca de ticketeras. Ver OQ-1.
- NG-3. Página propia del evento (ver HOS-2265).
- NG-4. El mecanismo de registro de clics en sí: lo define HOS-2256. Esta spec sólo lo consume.

## 5. Current baseline (verificado en `origin/staging`)

### 5.1 Esquema y payload

- Tabla `venue_events` (`packages/db/src/schemas/venue/venue_event.dbschema.ts:44-80`): sin columna de link.
- `VenueEventInputSchema` (`packages/schemas/src/entities/venue/subtypes/venue.event.schema.ts:263-290`): `title`, `description`, `recurrence`, `date`, `weekday`, `startTime`, `endTime`, `isActive`. Sin `id`, sin `ticketUrl`. `VenueEventSchema` (líneas 131-157) sí tiene `id`, y `VenueEventPublicSchema` lo expone (`id` viaja al público; `VenueEvent` en `apps/web/src/data/types.ts:1213`).
- Hay precedente de URL https en el repo: `menuUrl` en `packages/schemas/src/entities/venue/venue.http.schema.ts:114-118` (`.url().startsWith('https://')`, mensajes `zodError.venue.menuUrl.*`).
- Existe `safeExternalUrlSchema`-style (`packages/schemas/src/common/safe-external-url.schema.ts`) que permite `http`/`https`; no sirve tal cual porque acá se exige sólo https.

### 5.2 Los ids NO son estables (hallazgo que cambia el plan)

`replaceVenueEvents` (`packages/service-core/src/services/venue/venue.events.ts:243-275`) hace `eventModel.hardDelete({ venueId })` y reinserta todo con `create`. El propio archivo lo dice (líneas 20-27): "Entry ids are not stable across a save ... Nothing references an agenda entry today — no photo, no ticket, no metric — so a diff would be machinery with no consequence ... The day something DOES reference an entry, this function grows a diff". **Ese día es éste**: un clic con `eventId` y las estadísticas por evento (HOS-2265) quedarían huérfanos en cada guardado, aunque el dueño sólo corrija un typo en otro evento. El editor tampoco carga ids (`venue-event-draft.ts`, "Ids are not carried"; `VenueEventsManager.client.tsx` mapea sin `id`).

### 5.3 Ruta y editor

- `PUT .../events` (`apps/api/src/routes/venue/protected/putEvents.ts:75-101`): `listingAccess` con `operation: 'EDIT'` y `listingSection` `venueEvents`; el cuerpo es el documento completo.
- Render público: `VenueEvents.astro` muestra título, cuándo y descripción; sin acciones.
- `EntityViewTracker.client.tsx` es el beacon de vistas actual (`apps/web/src/components/analytics/EntityViewTracker.client.tsx`). El de clics lo define HOS-2256.

## 6. Proposed design

### 6.1 Ids estables (prerrequisito, tarea T-1)

Cambios:

1. `VenueEventInputSchema` suma `id: z.string().uuid().optional()`. Ausente = evento nuevo.
2. `replaceVenueEvents` pasa de "borrar todo y reinsertar" a un diff dentro de la misma transacción:
   - carga las filas actuales del local (`findAll({ venueId })`);
   - por cada entrada del payload con `id` que **pertenece a las filas de ese local**: `update` (conserva `createdAt` y `createdById`, escribe `updatedById`);
   - entrada sin `id`, o con un `id` que no pertenece al local: `create` con id nuevo. Un id ajeno nunca se confía ni se rechaza con un error distinto (no filtra la existencia del id): se trata como nuevo;
   - filas existentes ausentes del payload: `hardDelete` por id;
   - `displayOrder` sigue saliendo de la posición del array.
   - un `id` repetido dos veces en el mismo payload es `VALIDATION_ERROR` 400.
3. El editor carga y reenvía `id` (`EventDraft` suma `id?: string`); un borrador nuevo o duplicado no lo lleva.
4. Se actualiza el comentario de cabecera de `venue.events.ts` (ya no es "delete-and-reinsert").

Compatibilidad: un cliente viejo que no manda ids sigue funcionando (todo se interpreta como borrar y crear, como hoy). Sólo pierde la continuidad de métricas.

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
- API protegida: `PUT /protected/venues/:id/events` item suma `id?` y `ticketUrl?`; `GET` y la respuesta del PUT devuelven ambos.
- API pública: `venueEvents[].ticketUrl` (nullable). El proyector no cambia (la sección ya se gatea entera).
- Error contract: 400 `VALIDATION_ERROR` por URL inválida o `id` repetido; sin códigos nuevos.
- Tier y permisos: sin cambio (protected, owner, `VENUE_EDIT_OWN`/`ALL` en el servicio; `manage_venue_events` en `listingAccess`).

## 8. UX / UI behavior

1. En el editor, cada evento tiene un campo opcional de link. Si el valor no empieza con `https://`, se marca el campo y se bloquea el guardado con el mensaje.
2. En la ficha, el evento con link muestra un botón secundario «Comprar entrada» a la derecha/abajo del cuándo (en mobile, abajo, ancho completo).
3. El link se abre en pestaña nueva; la ficha queda donde estaba.

## 9. Acceptance criteria

- AC-1. Dado un `PUT` con `ticketUrl: 'https://www.passline.com/e/x'`, la respuesta y un `GET` posterior devuelven el mismo valor.
- AC-2. `ticketUrl: 'http://...'`, `'javascript:...'`, `'https://user:pass@x.com'` o más de 2048 caracteres devuelven 400 `VALIDATION_ERROR`.
- AC-3. `ticketUrl: ''` o ausente se guarda como `null`.
- AC-4. Dado un evento con link, la ficha pública renderiza un `<a target="_blank" rel="noopener nofollow">` hacia ese link, con el texto del idioma activo (es/en/pt).
- AC-5. Dado un evento sin link, no hay botón.
- AC-6. Un plan con eventos pero sin ninguna clave nueva puede cargar el link (sin entitlement propio).
- AC-7. Dado un agenda de 3 eventos, cuando el dueño cambia sólo el título del 2.º y guarda, los 3 conservan su `id` y `createdAt`.
- AC-8. Dado un evento borrado en el editor, su fila se elimina; dado uno agregado, recibe `id` nuevo.
- AC-9. Un `id` de otro local en el payload se trata como evento nuevo y no modifica filas ajenas. Un `id` repetido en el mismo payload devuelve 400.
- AC-10. Un cliente que no manda ids (comportamiento anterior) sigue guardando correctamente.
- AC-11. El clic en el botón dispara el beacon de HOS-2256 con `kind='TICKET_CLICK'` y el `eventId` (verificable cuando HOS-2256 esté desplegado) y no demora la navegación.
- AC-12. La ficha sigue pasando `cacheable-pages-are-session-blind`.

## 10. Test plan

- Unit schema (`packages/schemas/test/entities/venue/venue.event.schema.test.ts`, existente): casos de `ticketUrl` (válido, http, credenciales, larguísimo, vacío), `id` opcional.
- Unit servicio (`packages/service-core/test/services/venue/venue.events.test.ts`, existente): diff con ids (conserva, actualiza, borra, crea, id ajeno, id duplicado). **Test de regresión del diff antes del código** (regla del repo para el reemplazo de comportamiento).
- Integración DB (`packages/db/test/integration/`, junto a `listing-purge.rows.integration.test.ts` que ya cubre la tabla): ids estables entre dos guardados reales y `ticket_url` persiste.
- Route (`apps/api/test/routes/venue/protected/content-routes-chain.test.ts`): payload con `ticketUrl` e `id`.
- Público (`apps/api/test/routes/venue/public/`): el payload trae `ticketUrl`.
- Web: `VenueEventEntryCard.weekdays.test.tsx` (existente) se extiende; nuevo `VenueEvents.ticket.test.ts` (render con/sin botón, atributos `rel`/`target`), y test del tracker con `sendBeacon` mockeado.
- Guard i18n de es/en/pt corre en CI.
- Mutación manual: sacar `rel="noopener nofollow"` y comprobar que el test falla; romper el chequeo de pertenencia del `id` al local y comprobar que el test AC-9 falla.

## 11. Risks and open questions for the owner

- R-1. **Phishing/enlaces peligrosos**: un dueño podría poner cualquier https. Mitigación: sólo https, sin credenciales, `rel="noopener nofollow"`, y el link lo ve cualquiera en la ficha pública (moderable por staff vía admin). Sin lista blanca (OQ-1).
- R-2. El diff de ids cambia un comportamiento del servicio que otros no esperan. Mitigado: compatible hacia atrás y cubierto por tests de regresión.
- R-3. Dependencia blanda de HOS-2256: si no está, el botón sale sin medición. Mitigado: el tracker es no-op hasta que exista.
- R-4. `ON DELETE CASCADE` desde HOS-2256 borra los clics de un evento borrado. Ver OQ-2.

**OQ-1. ¿Sólo ciertas ticketeras o cualquier https?**

1. Cualquier https (recomendada). Pro: el dueño pone la web propia, Instagram, Passline, lo que sea; cero mantenimiento. Contra: un enlace malicioso queda a un clic.
2. Lista blanca (Passline, Venti, Eventbrite, Entradaweb, web del propio local). Pro: seguro. Contra: mantenimiento y fricción; locales chicos usan WhatsApp o links raros.
3. Cualquier https pero con reporte de abuso en la ficha. Pro: equilibrio. Contra: hay que construir el reporte.

**OQ-2. Si se borra un evento, ¿se borran sus clics y estadísticas?**

1. Sí, cascade (recomendada). Pro: simple y minimiza datos personales/telemetría. Contra: el dueño pierde el histórico de ese evento (ya lo borró él).
2. No: el evento pasa a "archivado" y las estadísticas quedan. Pro: histórico completo. Contra: agrega un estado nuevo y rompe "borrar" tal cual hoy.

## 12. Implementation notes

- El campo se agrega en `VenueEventInputSchema` **con `.nullish()`** y el servicio normaliza `''` a `null`, igual que `description`.
- `listing-purge.rows.integration.test.ts` ya recorre `venue_events`; confirmar que la columna nueva no rompe el conteo de filas.
- Orden: T-1 (ids) antes que el resto, porque HOS-2256/HOS-2265 lo necesitan para guardar `eventId` estable.

### Task breakdown

1. T-1. Ids estables: schema `id?`, diff en `replaceVenueEvents`, editor carga/reenvía `id`, tests de regresión (1 día).
2. T-2. Columna `ticket_url` + migración estructural + schema Zod + servicio (0,5 día).
3. T-3. Botón en `VenueEvents.astro` + estilos + i18n público (0,5 día).
4. T-4. Campo en el editor + i18n del editor (0,5 día).
5. T-5. Tracker de clics (consume HOS-2256) + test con `sendBeacon` (0,5 día; puede ir detrás de HOS-2256).

## 13. Linear

Canonical tracking: HOS-2255. Padre: HOS-2252.

- Dependencias: ids estables (T-1) bloquea a HOS-2256 en lo que toca `eventId`, a HOS-2263, HOS-2264 y HOS-2265. Registro de clics: HOS-2256.
- Smoke: `status-needs-smoke-staging` (el clic real y el beacon sólo se ven contra el entorno). Sin `smoke-prod`.
- What's New: sí («Ahora podés poner un link de entradas en tus eventos»).

## Nota de coordinación (16/11/2026)

Alineado con la spec de HOS-2256, que es la dueña de la tabla `entity_interactions`. Los kinds van en mayúsculas (`TICKET_CLICK`, `EVENT_IMPRESSION`). La FK `event_id` va con `ON DELETE SET NULL` por defecto, aunque queda a decisión del owner (OQ-3 de HOS-2256). El botón no necesita un tracker propio: lleva `data-interaction-kind` y `data-interaction-event-id`, que lee el tracker común de HOS-2256. La tarea T-1 de ids estables pasó a ser su propio issue, **HOS-2291**.
