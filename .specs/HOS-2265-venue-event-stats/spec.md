---
title: Eventos de local - estadísticas por evento para premium
linear: HOS-2265
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - billing
  - api
  - web
  - db
---

# Eventos de local: estadísticas por evento para premium

Hija de la épica HOS-2252. **Fase 3**: depende de la clave nueva `venue_event_stats` (HOS-2259), del registro de clics (HOS-2256) y de los ids de evento estables (**HOS-2291**, extraído de la antigua T-1 de HOS-2255).

## 1. Summary

El local premium ve cómo le fue a cada evento y los compara en una tabla ordenable. Métricas: vistas del evento, clics en «Comprar entrada» y, cuando existan, «Avisame», anotados en la lista y escaneos del QR de ingreso. Gate con `venue_event_stats`.

## 2. Problem

- Hoy de un local sólo se cuentan vistas de la ficha (`entity_views`); de un evento no se cuenta nada.
- Un dueño de boliche quiere saber qué noche funcionó y cuál no. Es la palanca "vender más" de premium (épica).
- Los eventos no tienen página propia, así que "vista de un evento" no existe todavía como señal medible. Hay que definirla (decisión que pide el issue).

## 3. Goals

- G-1. Definir cómo se mide la **vista de un evento** (OQ-1) y registrarla.
- G-2. Endpoint protegido que devuelve, por evento, las métricas de una ventana (7d / 30d / 90d, decidido el 18/11/2026) y la tabla comparativa.
- G-3. Gate `venue_event_stats` (premium) con upsell para pro.
- G-4. Extensible: las métricas de avisos, listas y QR se suman cuando existan esos issues, sin rediseñar.
- G-5. Baja de plan: los datos se conservan; la vista se oculta (HOS-2263 6.4).

## 4. Non-goals

- NG-1. Crear el mecanismo de registro de clics: HOS-2256. Acá se **consume**.
- NG-2. Una página pública por evento. Es una opción de OQ-1 (no recomendada ahora).
- NG-3. Las métricas de «Avisame» (HOS-2266), lista (HOS-2274) y QR (HOS-2276): columnas reservadas, sin implementar.
- NG-4. «Métricas de la ficha» (HOS-2261, pro y premium): otra pantalla, otra clave.

## 5. Current baseline (verificado en `origin/staging`)

### 5.1 Vistas y clics hoy

- `entity_views` (`packages/db/src/schemas/entity-view/entity_view.dbschema.ts`): `entityType` (enum con `VENUE`, `EVENT`, ...; **sin** valor de "evento de local"), `entityId`, `visitorHash`, `isAuthenticated`, `viewedAt`. Sólo vistas, índice `(entityType, entityId, viewedAt)`.
- `entity_view_monthly_rollups` (mismo directorio): `total`, `uniqueVisitors` por mes; job `view-monthly-rollup.job.ts`. Retención de `entity_views`: **95 días** (`apps/api/src/cron/jobs/entity-views-purge.job.ts:28`), porque la ventana más ancha expuesta es 30d y se deja margen para el rollup.
- Beacon de vistas: `POST /views` (`apps/api/src/routes/views/capture.ts`, filtra bots, hash de visitante anónimo `computeVisitorHash`, responde siempre 202); cliente `apps/web/src/components/analytics/EntityViewTracker.client.tsx` y `lib/analytics/view-capture.ts`. `EntityViewTracker` ya soporta `VENUE`.
- Precedente de clics por destino: `partner_logo_clicks` (`packages/db/src/schemas/partner/partner_logo_click.dbschema.ts`: `partnerId`, `visitorHash`, `destination`, `clickedAt`, con rollup mensual y su ruta `partner-logo-clicks/capture.ts`).
- Venue no manda eventos a PostHog (HOS-2256).
- Ventana de consulta ya estandarizada: `EntityViewWindowSchema` (`7d | 30d`) usada por `experience/protected/viewStats.ts` y `views/protected/daily-series.ts`, ambas con `enforceUserGate({ keys: ['view_basic_stats'] })`.
- `view_advanced_stats` **no** se lee en ninguna ruta de venue (la épica ya lo advierte). Esta spec usa una clave propia nueva, `venue_event_stats`.

### 5.2 Eventos

- `venue_events` (`venue_event.dbschema.ts`): `id` uuid PK, FK `venueId` con `ON DELETE CASCADE`.
- **Los ids no sobreviven a un guardado** (`venue.events.ts:243-275`, delete-and-reinsert) -> HOS-2291 los hace estables. Sin eso, toda métrica por evento se pierde en cada guardado. Prerrequisito duro.
- Los eventos viajan en el payload público de la ficha (`getBySlug.ts:122-144`) con su `id`.

### 5.3 Gates

- Patrón para una ruta protegida con listing y una clave: `listingAccess: { vertical: VerticalEnum.VENUE, operation: 'READ_OWN', idParam: 'id' }` más `capabilities: ['<clave>']` (HOS-1643; `experience/protected/certificates.ts:152`). El `GET .../events` actual usa `operation: 'READ_OWN'` y `listingSection: { id: 'venueEvents', intent: 'read' }` (`getEvents.ts`).
- `useListingPlanGate` y `resolveUnlockingPlanName` (`apps/web/src/lib/venue/section-upsell-plan.ts`) para el upsell.
- Catálogo: la clave no existe (HOS-2259); versiones de plan inmutables, sólo additive grant.

## 6. Proposed design

### 6.1 Supuestos sobre HOS-2256 (a confirmar en su spec)

Se asume la opción "tabla nueva" que su propio issue sugiere:

```
entity_interactions(
  id uuid pk,
  entityType entity_type_enum,   -- 'VENUE'
  entityId uuid,                 -- el local
  kind text/enum,                -- 'whatsapp'|'phone'|'map'|'web'|'instagram'|'TICKET_CLICK'|'EVENT_IMPRESSION'
  eventId uuid NULL REFERENCES venue_events(id) ON DELETE SET NULL,
  visitorHash text, isAuthenticated boolean, at timestamptz
)
index (entityType, entityId, kind, at), index (eventId, kind, at) WHERE eventId IS NOT NULL
```

Lo que esta spec le pide a HOS-2256 (coordinar al escribir su spec):

1. `eventId` nullable con FK a `venue_events`, `ON DELETE SET NULL`. Decidido (owner, 16/11/2026): al borrar un evento sus clics se conservan sin el evento (OQ-3).
2. El `kind` **`EVENT_IMPRESSION`** (ya incluido en el enum de HOS-2256), con `eventId` obligatorio para ese kind.
3. Registro anónimo con `visitorHash`, sin datos personales, igual que `entity_views`.
4. Retención de 120 días con rollup mensual desde el primer día (decidido por el owner, 16/11/2026) y el job de purga de `entity_views`; ver 6.5.
5. Si HOS-2256 decide en cambio una **columna `kind` en `entity_views`**, esta spec cambia sólo la capa de consulta (6.3), no el modelo de producto.

### 6.2 Cómo se mide la «vista de un evento» (decidido, OQ-1)

**Decidido (owner, 18/11/2026, HOS-2252 ronda 1, #2):** una vista es una **impresión del evento en la ficha** del local (`kind = 'EVENT_IMPRESSION'`), no una página propia. En el panel se rotula **«veces que se mostró»**.

- Un island mínimo `VenueEventsImpressionTracker.client.tsx` en la sección de agenda de la ficha. Cuando la sección entra en el viewport (IntersectionObserver, una sola vez por carga de página), envía **un único beacon por página** con la lista de ids de eventos visibles (`eventIds: string[]`, máx. 30), no uno por evento. El backend expande a una fila por evento, deduplicadas por `(visitorHash, eventId, día)`.
- Todo del lado cliente: la ficha sigue "session-blind" (`cacheable-pages-are-session-blind.guard.test.ts`). Filtro de bots idéntico al de `POST /views`.
- Un evento `weekly` acumula vistas semana a semana; las métricas se ven por ventana (7d/30d/90d), no "por edición".
- Alternativa (página propia del evento, `/comer-y-salir/<local>/eventos/<id>`): ver OQ-1. Aporta compartir/avisos pero es una ruta nueva, SEO, cache, y rompería el alcance "base sin tocar mucho"; **fuera de esta spec**.

### 6.3 API de lectura

`GET /api/v1/protected/venues/:id/events/stats?window=7d|30d|90d`

**Ventanas (decidido, owner, 18/11/2026, HOS-2252 ronda 2, #12 ✱):** el panel ofrece 7, 30 y **90 días**. Como `EntityViewWindowSchema` es `7d | 30d` y las rutas básicas deben seguir rechazando `90d`, esta ruta usa un schema de ventana propio (patrón de `VenueStatsWindowSchema`, HOS-2261). La retención cruda de 120 días (HOS-2256) cubre los 90.

```ts
listingAccess: { vertical: VerticalEnum.VENUE, operation: 'READ_OWN', idParam: 'id',
                 capabilities: ['venue_event_stats'] }
```

- Tier **protected** (la web del dueño usa `/protected/`, nunca `/admin/`). Ownership: lo resuelve el pipeline (404 para un local ajeno, nunca 403 que confirme la existencia, contrato de errores). G2: `VerticalEnum.VENUE` en la ruta; G6: el rol no decide.
- Respuesta (schema nuevo `VenueEventStatsOutputSchema`, en `@repo/schemas`):

```ts
{ window: '7d'|'30d'|'90d',
  items: Array<{
    eventId, title, recurrence, date: string|null, weekday: number|null,
    isActive, isPast,
    metrics: {
      views: { total: number, unique: number },
      ticketClicks: { total: number, unique: number },
      notifyMe: number | null,      // HOS-2266 (null mientras no exista)
      guestList: number | null,     // HOS-2274
      doorQrScans: number | null    // HOS-2276
    } }> }
```

- Las métricas "futuras" viajan como `null` ("no medido"), no como `0`: un `0` diría "nadie se anotó" cuando en realidad la función no existe. El editor oculta la columna cuyo valor es `null` en todas las filas.
- Servicio: `getVenueEventStats` en `packages/service-core/src/services/venue/venue.event-stats.ts` (nuevo), con un registro de **proveedores de métrica** (`EventMetricProvider[]`) para que HOS-2266/2274/2276 se enchufen sin tocar el servicio. Reglas de negocio en `@repo/service-core`, la ruta es una envoltura fina.
- Queries: `COUNT(*)` y `COUNT(DISTINCT visitorHash)` agrupados por `eventId`, filtrados por `at >= now() - window`, sólo para los ids del local (resueltos por `venue_events.venueId`). Sin N+1: una consulta agregada por kind.
- Comparación y orden: el orden por columna se hace en el cliente (≤ 90 filas); el endpoint devuelve el orden de la agenda.
- Rate limit `customRateLimit: { requests: 60, windowMs: 60_000 }`, como `viewStats`.

### 6.4 Web

- Pantalla nueva en el editor del local: ruta `apps/web/src/pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar/eventos-estadisticas.astro` o, preferible, una pestaña dentro de `eventos.astro` («Agenda» / «Estadísticas»). Se recomienda la pestaña: evita sumar una sección más al registro del editor (`listing-editor-registry`, que hoy tiene `eventos` como una sola).
- Componente `VenueEventStatsTable.client.tsx` (React island): tabla ordenable por cada columna (TanStack Table no es obligatorio acá; el repo web usa HTML nativo + hooks simples y la tabla es pequeña: un `<table>` con `aria-sort` y botones en el `<th>`). Selector de ventana 7d/30d.
- Gate previo de UI: `useListingPlanGate({ vertical: 'venue', entitlementKey: 'venue_event_stats' })`. Sin la clave: panel bloqueado con upsell leído del catálogo (`resolveUnlockingPlanName`), nunca un nombre de plan fijo (guard `venue-editor-upsell-no-plan-names.guard.test.ts`). La clave debe sumarse a `section-upsell-plan.ts` leyendo del catálogo (trait o clave de ruta), no hardcodeada.
- Accesibilidad: encabezados con `scope="col"`, ordenamiento operable por teclado, valores `null` renderizados con guion y texto accesible.

### 6.5 Retención y rollups

La ventana máxima expuesta es 30 días, igual que las vistas. Decidido (owner, 16/11/2026): `entity_interactions` se guarda 120 días y HOS-2256 escribe un resumen mensual (rollup) desde el primer día, por canal y por evento, así que el histórico no se pierde al purgar. Esta spec **consume** ese rollup y no agrega tablas ni jobs propios. Si se quiere exponer una ventana más larga que 30 días en el panel, es decisión aparte (OQ-2).

### 6.6 Catálogo (declarado acá, ejecutado por HOS-2259/2280)

`['venue_event_stats', 'vertical', 'MAX', 'NONE', 'COMMERCIAL']` en `entitlement-keys.ts` + `key-enums.ts`. Asignación a premium: HOS-2280 (additive grant, un bloque "eventos, métricas y video"). Guards: G3, G18, G7. La pantalla de planes la lee del catálogo (HOS-1967); el texto de la fila lo pone HOS-2262.

### 6.7 i18n (es / en / pt)

`venue.owner.editor.venueEventStats.*`: `tabAgenda`, `tabStats`, `title`, `intro`, `window7d`, `window30d`, `colEvent`, `colWhen`, `colViews`, `colTicketClicks`, `colNotifyMe`, `colGuestList`, `colDoorQr`, `unique`, `empty`, `locked`, `lockedNoPlan`, `notMeasured`, `sortBy`. Cuadro de planes: HOS-2262.

## 7. Data model / contracts

- DB: **sin tablas propias**. Usa `entity_interactions` de HOS-2256 (o la columna de `entity_views`); esta spec no migra nada estructural salvo, si HOS-2256 no lo incluyó, el `kind='EVENT_IMPRESSION'` y el `eventId` (pedido allá, 6.1).
- Catálogo: 1 entitlement (HOS-2259) + grant a premium (HOS-2280).
- API: `GET /protected/venues/:id/events/stats` (nuevo). `POST` de beacon para `EVENT_IMPRESSION`: lo define HOS-2256 (extiende su endpoint de interacciones).
- Error contract: 401 sin sesión, 403 `ENTITLEMENT_REQUIRED { entitlementKey: 'venue_event_stats' }` sin la clave, 404 local ajeno o inexistente, 400 ventana inválida. Nunca `INTERNAL_ERROR` para un 4xx.

## 8. UX / UI behavior

1. Premium: en «Eventos» hay una pestaña «Estadísticas» con la tabla: evento, cuándo, vistas, clics en entradas (y las columnas futuras cuando existan). Clic en un encabezado ordena asc/desc. Selector 7/30 días.
2. Pro: la pestaña muestra el panel bloqueado con el upsell («Las estadísticas por evento están disponibles desde el plan {{plan}}»).
3. Sin eventos o sin datos: «Todavía no hay datos de tus eventos en este período».
4. Un evento recién creado aparece con ceros; uno pasado se ve mientras exista (los borra un cron a los 60 días, HOS-2254) y sus clics sobreviven sin el evento (SET NULL).

## 9. Acceptance criteria

- AC-1. Dado premium con 3 eventos y tráfico registrado, `GET .../events/stats?window=30d` devuelve 3 items con `views` y `ticketClicks` (`total` y `unique`) correctos.
- AC-2. Dado pro (sin `venue_event_stats`), la ruta devuelve 403 `ENTITLEMENT_REQUIRED` con `entitlementKey: 'venue_event_stats'`; la pestaña muestra el upsell.
- AC-3. Dado un local ajeno, la ruta devuelve 404 (no 403).
- AC-4. **Continuidad**: dado un evento con métricas, cuando el dueño guarda la agenda cambiando otro evento, las métricas del primero no cambian (mismo `eventId`, HOS-2291).
- AC-5. Dado un evento borrado, deja de listarse como item y sus filas de telemetría quedan con `event_id = NULL` (no se borran, FK `ON DELETE SET NULL`); los totales del local no bajan y no hay errores.
- AC-6. Las métricas de HOS-2266/2274/2276 devuelven `null` y la columna correspondiente no se muestra si todas son `null`.
- AC-7. La vista de evento se registra **una vez por visitante, evento y día**; un bot (UA de bot) no suma; el beacon no bloquea la navegación ni la carga.
- AC-8. La ficha pública sigue pasando `cacheable-pages-are-session-blind`.
- AC-9. La tabla se ordena por cada columna, con teclado y `aria-sort`.
- AC-10. Baja de plan premium a pro: la pestaña se bloquea, los datos siguen en BD (conteo de filas igual) y reaparecen al volver a premium.
- AC-11. Ventanas `7d`, `30d` y `90d` aceptadas; otra devuelve 400 `VALIDATION_ERROR`. `EntityViewWindowSchema` sigue rechazando `90d` en las rutas básicas.
- AC-13. La métrica de vistas se rotula «veces que se mostró» en el panel (es; en/pt equivalentes).
- AC-12. Textos es/en/pt, guard de i18n verde. Guards G1, G2, G3, G6, G7, G18 verdes.

## 10. Test plan

- Unit servicio (`packages/service-core/test/services/venue/venue.event-stats.test.ts`, nuevo): agregación con `total`/`unique`, proveedores `null`, filtro por local, ventana.
- Integración BD real (`packages/db/test/integration/`): inserta interacciones, guarda la agenda dos veces con distinto contenido y comprueba que los conteos por `eventId` se conservan (AC-4, el test de regresión más importante) y que borrar el evento deja `event_id` en `NULL` sin borrar filas (AC-5).
- Route (`apps/api/test/routes/venue/protected/venue-event-stats.test.ts`, nuevo, patrón de `content-gates.venue-experience.test.ts`): AC-1 a AC-3, AC-11, orden de errores.
- Beacon `EVENT_IMPRESSION`: test de dedupe y filtro de bots (en la suite de HOS-2256, con un caso propio de esta spec).
- Web: `VenueEventStatsTable.test.tsx` (ordenamiento, `null`, accesibilidad), `VenueEventsStatsTab.locked.test.tsx` (upsell leído del catálogo), guard `venue-editor-upsell-no-plan-names`.
- Mutación manual: quitar el `WHERE eventId IN (ids del local)` y comprobar que un test con dos locales falla (fuga entre locales); romper el dedupe diario y comprobar AC-7.
- Smoke manual en staging con tráfico real (ver 13).

## 11. Risks and open questions for the owner

- R-1. **Dependencia triple** (HOS-2291, HOS-2256, HOS-2259). Sin ids estables toda la spec es inválida; está marcado como prerrequisito.
- R-2. Volumen: una fila por evento por visitante y día, sobre la ficha más vista. Mitigación: un beacon por página con lista de ids, dedupe diario, retención de 120 días con rollup mensual, índice parcial por `eventId`.
- R-3. Privacidad: igual que `entity_views` (hash anónimo, sin PII). Revisar con HOS-2256 que el hash de usuarios autenticados no incluya IP (precedente `computeVisitorHash`).
- R-4. "Vista" como impresión sobrestima el interés (la sección entra en pantalla, no se leyó). Se rotula «veces que se mostró» (decidido el 18/11/2026), no «Vistas» ni «Interesados».
- R-5. Las columnas futuras pueden cambiar de nombre cuando las specs de reservas/avisos se escriban. Se reservan como `null`.

**OQ-1. ¿Cómo se mide la vista de un evento? (la decisión que pide el issue)**

**Decidido (owner, 18/11/2026, HOS-2252 ronda 1, #2): opción 1**, impresión del evento en la ficha, rotulada «veces que se mostró». Las opciones 2 y 3 quedan fuera de esta spec.

1. Impresión del evento en la ficha del local, un beacon por página (recomendada). Pro: sin ruta nueva, sin SEO ni cache extras; entrega métricas ya. Contra: mide "se mostró", no "lo abrió"; los eventos de arriba reciben más vistas que los de abajo.
2. Página propia del evento (`/comer-y-salir/<local>/eventos/<id>` + `EntityViewTracker` con un nuevo `entityType`). Pro: vista real, URL compartible, sirve para los avisos (HOS-2266..2269) y el SEO. Contra: ruta, plantilla, cache, `sitemap`, i18n y moderación nuevos; mucho más alcance; sumar un valor a `entity_type_enum` rompe 5+ guards congelados (patrón ya medido: "un valor nuevo de enum rompe guards").
3. Ambas: impresión ahora, página propia cuando se haga la épica de avisos. Pro: no bloquea hoy y deja la puerta abierta. Contra: dos definiciones de "vista" conviviendo, hay que rotular bien cuál es cuál.

**OQ-2. ¿Histórico más allá de 30 días?** Parcialmente decidido (owner, 16/11/2026): retención de 120 días y rollup mensual desde el primer día (HOS-2256), así que el dato existe. **Decidido (owner, 18/11/2026, HOS-2252 ronda 2, #12 ✱):** el panel ofrece ventanas de 7, 30 y 90 días. El rollup mensual sigue sin pantalla propia.

**OQ-3. ¿Qué pasa con las métricas de un evento que el dueño borra?** Decidido (owner, 16/11/2026): los clics se conservan sin el evento (FK `event_id` `ON DELETE SET NULL`). El evento deja de listarse en la tabla y los totales del local se conservan. No hay snapshot del título ni cascade.

## 12. Implementation notes

- No leer `view_advanced_stats`: sin ruta de venue que lo use y con semántica de alojamiento (la épica pide verificarlo antes de reusarlo).
- Mantener el endpoint tolerante a `eventIds` ajenos: el servicio siempre parte de las filas del local, nunca de ids recibidos.
- Si HOS-2256 se mergea antes, el beacon `EVENT_IMPRESSION` y el campo `eventId` ya están; si no, esta spec queda bloqueada en su T-2.

### Task breakdown

1. T-1. Confirmar con HOS-2256: `eventId` con `SET NULL`, kind `EVENT_IMPRESSION`, retención de 120 días y rollup (0,25 día; ya alineado, queda como chequeo).
2. T-2. Island de impresiones + beacon batch + dedupe en el endpoint de HOS-2256 (1 día; depende de HOS-2256 y de HOS-2291).
3. T-3. Servicio `getVenueEventStats` con proveedores + tests unit e integración (1 día).
4. T-4. Ruta `GET .../events/stats` con `capabilities: ['venue_event_stats']` + tests (0,5 día; **bloqueada por HOS-2259**).
5. T-5. Pestaña/tabla ordenable + gate de UI + upsell desde catálogo (1 día).
6. T-6. i18n es/en/pt + guards (0,5 día).

## 13. Linear

Canonical tracking: HOS-2265. Padre: HOS-2252. Decisiones: HOS-2253 (6: baja de plan).

- Dependencias: **HOS-2291** (ids estables de eventos), **HOS-2256** (registro de clics, kind `EVENT_IMPRESSION`), **HOS-2259** (clave), HOS-2262 (texto), HOS-2280 (grant a premium). Métricas futuras: HOS-2266, HOS-2274, HOS-2276.
- Smoke: `status-needs-smoke-staging` (entitlements + tráfico real de beacons). Sin `smoke-prod`.
- What's New: sí, en la entrega conjunta de HOS-2284.

## Nota de coordinación (16/11/2026)

Alineado con la spec de HOS-2256: el kind de la impresión de un evento es `EVENT_IMPRESSION` (ya incluido allá) y la FK `event_id` va con `ON DELETE SET NULL`, ahora decidido por el owner (16/11/2026). Al borrar un evento sus métricas por evento dejan de mostrarse, pero los clics y los totales del local se conservan. Los ids estables (antes T-1 de HOS-2255) son **HOS-2291**.
