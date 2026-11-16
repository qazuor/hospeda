---
title: Add-on de Comer y salir, evento destacado por 7 días
linear: HOS-2288
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - billing
  - api
  - web
  - db
---

# Add-on de Comer y salir: evento destacado por 7 días

## 1. Resumen

Un local compra el destacado de **un evento** de su agenda por 7 días. El evento aparece
arriba en la agenda del local y con la marca «Destacado». Sirve para cualquier plan que tenga
eventos. El local elige qué evento destacar **al comprarlo**. Dura 7 días o hasta la fecha del
evento, lo que pase primero. El precio lo define el owner.

## 2. Hallazgos que cambian el plan

1. **El mecanismo de destacado ya no es un bloqueo.** HOS-929 y HOS-1357 están Done y el
   escritor del destacado existe desde HOS-1718 (ver
   `.specs/HOS-2290-verify-visibility-addons-deliver-featured/spec.md` §4). Pero ese mecanismo
   destaca **fichas**, no eventos. Este add-on necesita su propia lectura.
2. **`addon_version.scope_type` NO soporta evento.** Hay 4 valores: `LISTING`,
   `VERTICAL_SUBSCRIPTION`, `USER`, `GLOBAL`
   (`packages/db/src/schemas/vertical/addon-catalog.dbschema.ts:27`, con CHECK
   `ck_addon_version_scope_type` en L80-83). Agregar `EVENT` obliga a tocar:
   - el CHECK y el trigger `extras/044-hos1529-addon-instance-target-scope.trigger.sql`;
   - tres enums Zod duplicados (`packages/schemas/src/api/billing/addon-offers.schema.ts:17`,
     `addon-version-publication-admin.schema.ts:9`,
     `packages/billing-verticals-contract/src/inverse.schema.ts:101`);
   - el switch exhaustivo `placementOf`
     (`packages/service-core/src/services/billing/coverage/addon-sources.ts:99-124`) y
     `resolvePurchaseTarget` (`.../addon/purchase-addon-eligibility.ts:61-105`);
   - **el contrato billing-verticales**: la regla «el objetivo está presente exactamente cuando
     el scope es `LISTING`» (`packages/billing-verticals-contract/src/coverage.schema.ts:112-115`).
     Ese paquete es «el único lugar donde se encuentran» billing y verticales; cambiarlo cae bajo
     el pase final de HOS-1352 y el guard G14.
3. **Los eventos del local no tienen identidad estable.** `replaceVenueEvents` hace
   `hardDelete` de todo el agenda y re-inserta cada evento con id nuevo en cada guardado
   (`packages/service-core/src/services/venue/venue.events.ts:249-251, 252-276`; el input no trae
   `id`, `VenueEventInputSchema` en `venue.event.schema.ts:263`). Un add-on que apunte a un evento
   quedaría colgado al primer guardado de la agenda.
4. **Es de pago único (`UNA_VEZ`)** y por lo tanto **no se puede comprar desde la web hasta que
   se resuelva HOS-2094** (`apps/web/src/lib/billing/addon-purchase.ts:10-13`). Hoy los 6
   add-ons de visibilidad tienen el mismo bloqueo.
5. `addon_instance.target_id` es un `uuid` sin FK (`addon-product.dbschema.ts:101`, polimórfico),
   así que puede apuntar a cualquier tabla sin cambio estructural.

## 3. Alcance y fuera de alcance

Dentro: producto de catálogo, compra con elección de evento, lectura pública del destacado por
evento, orden y marca, expiración, tests, i18n, Novedades.

Fuera: habilitar el pago único en la web (HOS-2094), destacar un evento por plan (HOS-2279),
destacado en la página del destino, otros add-ons de Comer y salir de la épica.

## 4. Estado actual del código

- Agenda: tabla `venue_events` (`venue_event.dbschema.ts`), ids regenerados por guardado
  (hallazgo 3), tope 30 (`VENUE_EVENTS_MAX_ENTRIES`, `venue.event.schema.ts:54`).
- Lectura pública: `routes/venue/public/getBySlug.ts:122-142` (filtra `isActive`) y
  `components/venue/VenueEvents.astro` (211 líneas).
- Escritor de la agenda (web): `components/venue/VenueEventsManager.client.tsx`,
  `VenueEventEntryCard.client.tsx`, `lib/venue/venue-event-draft.ts`; API
  `routes/venue/protected/putEvents.ts` (gate `manage_venue_events`).
- Add-on: flujo de compra `routes/billing-addon/purchase.ts`; servicio
  `billing/addon/purchase-addon.service.ts:82-260`; activación del pago único
  `addon-instance-a2-one-time.ts` (emite aviso `ADDED`, L174-177); vencimiento
  `expire-addon-instances.service.ts` (job `subscription-window-expiry`, cada 15 min).
- Cobertura/sincronización de fichas: `sync-listing-featured.ts:81-85` solo mira la clave
  `featured_listing`, así que un add-on con otra clave **no** destaca la ficha.
- Revalidación: precedente `apps/api/src/utils/listing-access/partner-coverage-revalidation.ts:46`
  (un oyente de `onCoverageChanged` que invalida cache).
- Alta de productos: HOS-1595 / `addon-version-creation.service.ts` y el admin
  `apps/admin/src/features/billing-addon-catalog/` permiten crear versiones y productos como
  filas; las **claves** viven en código (`packages/schemas/src/catalog/entitlement-keys.ts`).
- Baseline de producción: `scripts/production-catalog/commercial-catalog.ts:144-165, 210-252`
  (helper `visibilityBoost`).

## 5. Diseño

### 5.1 Opciones de modelado (decisión del owner)

- **Opción A: alcance nuevo `EVENT`.** Limpio en el modelo, pero toca el contrato de HOS-1352,
  la base (CHECK + trigger), 3 enums, 2 switches y el panel admin. Contra: es un cambio de
  contrato que no puede entrar antes del pase final de HOS-1352.
- **Opción B (recomendada): alcance `LISTING` + elección de evento en la instancia.**
  - El producto es `scope_type = LISTING` sobre el **local**, con una clave de entitlement
    **nueva** `featured_event` (no `featured_listing`, así no destaca la ficha).
  - La instancia guarda el evento elegido en una columna nueva `addon_instance.event_id`.
  - La lectura pública decide por evento.
  - Pro: no toca el contrato ni los switches (`placementOf` sigue válido: scope `LISTING`,
    objetivo = el local), conserva el orfanato por baja de ficha (A5 cancela el add-on si
    la ficha se purga). Contra: `LISTING` pasa a significar «el local y, opcionalmente, un
    evento suyo»; se documenta y se guarda con un guard.
- **Opción C: tabla propia `venue_event_boost`** escrita por un enganche en la activación.
  Pro: aísla. Contra: la activación vive en service-core sin conocimiento de eventos; más piezas.

**Recomiendo B.** Lo que sigue la desarrolla.

### 5.2 Datos (carriles)

1. **Estructural** (`pnpm db:generate`): `addon_instance.event_id uuid NULL` con FK a
   `venue_events(id) ON DELETE SET NULL`, e índice único parcial
   `uq_addon_instance_active_event` sobre `(event_id)` donde `event_id IS NOT NULL AND status IN
   ('PENDING_AUTHORIZATION','ACTIVE')` (un solo destacado vivo por evento).
2. **Clave de catálogo**: `featured_event` (`vertical`, `MAX`, `NONE`, `COMMERCIAL`) en
   `packages/schemas/src/catalog/entitlement-keys.ts` y `key-enums.ts`. El SQL del catálogo se
   regenera (G18), y `check-catalog-key-usage` (G3) la ve usada en el código del public read.
3. **Producto**: slug `featured-event-venue-7d`, versión `FIXED_DAYS` 7 días, `scope_type LISTING`,
   entitlement `featured_event`, producto `UNA_VEZ`, `compatible_verticals = {venue}`, precio a
   definir. Carril de **seed data-migration** (`packages/seed/src/data-migrations/`, regla
   dual-write HOS-25) **y** el baseline en `commercial-catalog.ts` para bases nuevas. En un entorno
   vivo se puede alternativamente publicar desde el admin (HOS-1595) si el owner prefiere.
4. **Identidad estable de eventos** (prerrequisito, ver 5.3).
5. Sin cambios a `addon_version.scope_type`, sin cambios al contrato.

### 5.3 Prerrequisito: ids de evento estables

`replaceVenueEvents` pasa a **upsert por id**: el payload acepta `id` opcional por evento
(`VenueEventInputSchema`); los que traen id se actualizan, los nuevos se insertan, los que ya no
vienen se borran. La web (`VenueEventsManager` / `venue-event-draft.ts`) devuelve el `id` que
recibió. Esto lo necesitan también HOS-2254 (ocultar eventos únicos pasados), HOS-2255 (enlace de
entradas) y HOS-2263 (tope de activos) si algún día referencian eventos. **Se hace primero y se
mergea solo** (no toca catálogo, puede entrar antes del pase de HOS-1352).

### 5.4 Compra

- `AddonPurchaseRequestSchema` (`packages/schemas/src/api/billing/addon-purchase.schema.ts:4`) gana
  `eventId: z.uuid().optional()`. `purchaseAddon` lo exige **solo** si la versión tiene la clave
  `featured_event`, y valida (404 `ADDON_TARGET_NOT_FOUND` si algo no cierra, nunca 403):
  - el evento existe y pertenece al local `targetId`, que es del comprador;
  - está activo y **no es un evento único ya pasado**;
  - no tiene ya un destacado vivo (409 `ADDON_EVENT_ALREADY_FEATURED`, código nuevo en
    `purchase-rejections.ts:34-42`).
- Orden de chequeos del contrato de errores: auth 401, permiso 403, forma 400, existencia/propiedad
  404, reglas de negocio 409.
- Pago: igual que los otros `UNA_VEZ` (token de tarjeta hoy). **Depende de HOS-2094.**
- Elegibilidad de título: igual (`hasTitle`, un principal que paga; `NO_VALID_TITLE`).
  Un trial no compra.

### 5.5 Lectura pública

- Nueva función `resolvePublicEventIsFeatured` (`apps/api/src/utils/venue-event-featured.ts`):
  `localDestacado(HOS-2279) OR potenciado(evento)`.
- `potenciado(evento)` = existe `addon_instance` con `event_id = evento.id`,
  `status = 'ACTIVE'`, `ends_at > now()` y versión con la clave `featured_event`, **y** el evento
  no es un único ya pasado. «7 días o la fecha del evento, lo que pase primero» queda
  implementado **en la lectura**, sin tocar `ends_at` ni depender del cron (que corre cada
  15 min). Para un evento semanal, dura los 7 días completos.
- Puerto de lectura en el modelo de db (`AddonInstanceModel.findActiveEventBoosts({ eventIds, now })`),
  una consulta por ficha. Sin escritura ni sincronización: no hay estado derivado que se desincronice.
- `getBySlug.ts:122-142`: cada evento sale con `isFeatured` y la agenda sale **ordenada**:
  destacados primero, luego por próxima ocurrencia.

### 5.6 Cache

La ficha pública está en cache de borde. Al activar o vencer hay que revalidar el local:
un oyente de `onCoverageChanged` (patrón `partner-coverage-revalidation.ts`) que, ante un aviso
`ADDON` de venue, revalida la ficha de los locales del dueño. El vencimiento por tiempo se cubre
con el aviso de baja que ya emite el cron y, como red, con el TTL de la ficha. El destacado por
lectura es correcto aunque la revalidación falle (solo se ve tarde).

### 5.7 Web

- Compra (`AddonPurchase.client.tsx`): para ofertas con clave `featured_event`, tras elegir el
  local aparece un selector **de evento** (por título, fecha o día de la semana; no por UUID),
  con los eventos activos y vigentes del local. El resumen dice «7 días o hasta la fecha del evento».
- Sin evento elegible: mensaje «Cargá un evento para poder destacarlo» con enlace al editor de
  la agenda (`mi-cuenta/comercio/[vertical]/[id]/editar/eventos`).
- Ficha pública: `VenueEvents.astro` ordena y pinta la insignia (mismas claves de i18n que
  HOS-2279: `venue.events.featured`). Sin mencionar el plan ni el add-on.
- i18n del producto: `billing.addon.featured-event-venue-7d.{name,description}` en es/en/pt
  (`packages/i18n/src/locales/*/billing.json`, patrón de `:837-860`).

### 5.8 Qué pasa si…

- El evento se borra: `event_id` queda `NULL` (FK `SET NULL`), el add-on queda pagado y sin
  efecto. Ver pregunta 3.
- Baja de plan hasta uno **sin** `manage_venue_events`: los eventos se ocultan (decisión 6 de
  HOS-2253), el destacado queda sin efecto visible; el add-on sigue vivo hasta que venza.
- La ficha se purga: A5 cancela el add-on (el scope es `LISTING`), ya implementado.

## 6. Contratos

- `AddonPurchaseRequest.eventId?: uuid` (aditivo).
- `VenueEventPublic.isFeatured: boolean` (compartido con HOS-2279).
- Código de error nuevo `ADDON_EVENT_ALREADY_FEATURED` (409) y copy en
  `billing.addonPurchaseApi.*`. 404 `ADDON_TARGET_NOT_FOUND` para evento ajeno, inexistente,
  inactivo o pasado.
- Sin cambios en el contrato `@repo/billing-verticals-contract`.

## 7. Criterios de aceptación

- AC-1. Dado un local con plan que incluye eventos y un evento activo, cuando compra el add-on
  eligiendo ese evento, entonces la instancia queda `ACTIVE` con `event_id` y `ends_at = +7 días`.
- AC-2. Dado el add-on activo, cuando se abre la ficha pública, entonces ese evento aparece
  **primero** y con «Destacado» (es/en/pt); los demás no, salvo que el local esté destacado.
- AC-3. Dado un evento único cuya fecha cae a los 3 días, cuando pasa esa fecha, entonces el
  destacado deja de verse aunque queden 4 días de add-on.
- AC-4. Dado un evento semanal, entonces el destacado dura los 7 días completos.
- AC-5. Dado que pasaron 7 días, entonces deja de verse **aunque el cron no haya corrido**.
- AC-6. Dado un evento ajeno o inexistente, entonces 404 `ADDON_TARGET_NOT_FOUND` (no 403).
- AC-7. Dado un evento ya destacado, entonces 409 `ADDON_EVENT_ALREADY_FEATURED`.
- AC-8. Dado que el dueño guarda su agenda, entonces el id del evento destacado **no cambia** y el
  destacado sigue (prerrequisito 5.3).
- AC-9. Dado un local sin eventos elegibles, la oferta se muestra pero no permite avanzar, con el
  mensaje que lleva al editor.
- AC-10. Un local solo con trial no puede comprarlo (`NO_VALID_TITLE`).
- AC-11. G1, G2, G3, G6, G7, G18, `check-step5-declared` y `check-addon-compatible-verticals`
  pasan.
- AC-12. El texto del producto no menciona el plan, y el precio sale del catálogo (G7), no del código.

## 8. Plan de pruebas

- Unit: `resolvePublicEventIsFeatured`, regla «7 días o fecha del evento» con reloj inyectado
  (`@repo/test-clock`), upsert por id de `replaceVenueEvents`.
- Integración API: compra con `eventId` válido, ajeno, pasado, duplicado, sin título
  (`apps/api/test/integration/billing-addon/`); la ficha pública con evento potenciado.
- Integración db: índice único parcial y FK `SET NULL`.
- Web: componente del selector de evento (`apps/web/test/components/billing/addon-purchase/`),
  `VenueEvents` orden e insignia, guard de i18n.
- E2E: nuevo `apps/e2e/tests/verticals/featured-05-venue-event-boost.spec.ts` con el producto real
  del catálogo y el proveedor falso (el hueco que dejó HOS-2290, §4.6).
- Guards: `pnpm check:guards` completo.

## 9. Riesgos

- R-1. Depende de HOS-2094 para vender. Si el owner decide salir al corte sin pago único,
  este add-on **no se puede vender** y la presentación no puede listarlo como disponible.
- R-2. `LISTING` con evento opcional estira el significado de `scope_type`. Mitigación: comentario
  en `ADDON_SCOPE_TYPES`, y un test que falla si `event_id` aparece en una versión sin la clave.
- R-3. Cambio en `replaceVenueEvents` toca el flujo que usan HOS-2254, 2255, 2263, 2264, 2265.
  Coordinar para que lo haga **una sola** spec (esta lo define como tarea 1).
- R-4. Comprar para un evento que el plan después oculta (baja de plan).
- R-5. El destacado por lectura depende de la hora del servidor; usar `now()` de la base, no el
  reloj de la app, para no discrepar con `ends_at`.

## 10. Preguntas abiertas para el owner

1. **Modelado:** opciones A/B/C de §5.1. **Recomiendo B.**
2. **Precio.** Referencia: el destacado de ficha por 7 días cuesta $5.000.
   - A) $3.000 (un evento vale menos que toda la ficha).
   - B) $5.000 (igual al boost de ficha).
   - C) Otro. **Recomiendo A** como punto de partida; es decisión comercial.
3. **Si el dueño borra el evento ya destacado.**
   - A) El add-on se pierde (sin reembolso). Pro: simple. Contra: se siente injusto.
   - B) Permitir reasignar a otro evento mientras dure. Pro: justo. Contra: más código y UI.
   - C) Impedir borrar un evento con destacado vivo. Pro: evita el caso. Contra: fricción.
   - **Recomiendo B** en una segunda iteración; la primera acepta A y lo avisa en el resumen de compra.
4. **¿Puede comprarlo un local Premium (ya destacado por plan)?**
   - A) Sí, sin restricción. Contra: paga por algo que ya tiene.
   - B) No se ofrece. **Recomiendo B**: el selector lo esconde si el local está destacado por plan.
5. **¿Alcanza con un evento por compra, o se pueden destacar varios a la vez?**
   Recomiendo un evento por compra (el criterio de la issue) y varias compras en paralelo
   sobre eventos distintos.

## 11. Dependencias

- HOS-2279 (campo `isFeatured` por evento, insignia, orden) debe entrar antes o con esta.
- HOS-2094 (pago único en la web): sin ella no se vende.
- Pase final de HOS-1352 (clave de catálogo y producto no se mergean antes).
- Prerrequisito 5.3 (ids estables): sin dependencia de catálogo; entra primero.
- HOS-2280 / HOS-2263: coordinar migraciones de catálogo y el tope de eventos.

## 12. Smoke y Novedades

- `status-needs-smoke-staging` (MercadoPago sandbox, revalidación de Cloudflare, expiración).
- Novedades: sí, una entrada al habilitarse la venta («Destacá un evento por 7 días»).

## 13. Desglose de tareas (≤ 1 día cada una)

1. Ids estables en `replaceVenueEvents` + payload + web + tests. (1 d, entra solo)
2. Migración estructural `addon_instance.event_id` + índice parcial + modelo. (0,5 d)
3. Clave `featured_event` + producto (data-migration + baseline) + G18/G3. (0,75 d, después del pase)
4. `eventId` en el request, validaciones y código 409 en `purchaseAddon`. (1 d)
5. `findActiveEventBoosts` + `resolvePublicEventIsFeatured` + `getBySlug` (orden). (1 d)
6. Oyente de revalidación del local. (0,5 d)
7. Web: selector de evento, resumen, i18n es/en/pt. (1 d)
8. Web: insignia y orden en `VenueEvents` (compartida con HOS-2279). (0,25 d)
9. E2E con el producto real y smoke en staging. (1 d)
10. Novedades y Linear. (0,25 d)

## 14. Linear

Canonical tracking:
HOS-2288
