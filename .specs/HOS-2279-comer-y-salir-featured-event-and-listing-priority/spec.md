---
title: Comer y salir, evento destacado y prioridad en el listado para premium
linear: HOS-2279
statusSource: linear
created: 2026-11-16
type: feature
areas:
  - billing
  - api
  - web
---

# Comer y salir: evento destacado y prioridad en el listado para premium

## 1. Resumen

El local con plan **Premium** de Comer y salir aparece primero en `/comer-y-salir/` y en
cada rubro, y sus eventos llevan la marca «Destacado» en la ficha. El destacado dura solo
mientras dura el plan. Se muestra con la palabra «Destacado», sin nombrar el plan.

## 2. Hallazgo que cambia el plan: ya no está bloqueada por HOS-929 ni por HOS-1357

La issue dice «bloqueado: `featuredByEntitlement` no tiene quién lo escriba». **Eso venció.**

- HOS-929 está **Done** (2026-09-08, PR #3217).
- HOS-1357 está **Done** (2026-10-10).
- El escritor existe desde HOS-1718 (2026-11-12): `syncListingFeatured`
  (`packages/verticals/src/featured/sync-listing-featured.ts:28-113`), cableado al aviso de
  cobertura (`apps/api/src/utils/listing-featured/featured-sync-listener.ts:25-46`,
  `apps/api/src/index.ts:360`) y al reconciliador diario de las 05:00
  (`apps/api/src/cron/schedules.manifest.ts:61-64`). Detalle completo y citas en
  `.specs/HOS-2290-verify-visibility-addons-deliver-featured/spec.md` §4.
- Lo que **falta de verdad** es una sola cosa: **ningún plan de venue otorga
  `featured_listing`**. Solo `owner-pro` y `owner-premium` lo otorgan
  (`scripts/production-catalog/catalog.ts:272`, `:456`). La lógica del plan ya está escrita:
  si el set efectivo trae `featured_listing > 0`, destaca **todas** las fichas del dueño en esa
  vertical (`sync-listing-featured.ts:60-62`).

Por eso el trabajo se reduce a: (a) una concesión aditiva de catálogo, (b) la marca en el
evento, (c) tests y verificación. La etiqueta `status-blocked` y las relaciones «bloqueada por
HOS-929 / HOS-1357» en Linear están vencidas. El bloqueo real es la **regla del owner: nada que
toque catálogo se mergea antes del pase final de HOS-1352**.

## 3. Alcance y fuera de alcance

Dentro:
- Conceder `featured_listing` a las versiones de plan `venue-premium` (por concesión aditiva).
- Marca «Destacado» en los eventos de un local destacado, en la ficha pública.
- Orden de la agenda: eventos destacados primero.
- Tests, i18n es/en/pt, verificación en staging.

Fuera:
- El add-on de destacar un evento por 7 días (HOS-2288).
- Experiencias (su plan premium no entra acá; ver pregunta 3).
- Reordenar el listado con otra regla que no sea «destacados primero» (ya existe).
- Habilitar la compra web del add-on de visibilidad (HOS-2094).

## 4. Estado actual del código (verificado en `origin/staging`)

- **Orden del listado.** `venue.model.ts:39` define `featuredFirstColumn = 'featuredByEntitlement'`.
  `/comer-y-salir/` usa `featured` como orden por defecto
  (`apps/web/src/pages/[lang]/comer-y-salir/index.astro:121-128`, `:130`) y
  `comer-y-salir/rubro/[rubro]/index.astro:119-127` hace lo mismo. Ambos llaman al mismo
  `GET /api/v1/public/venues` (`apps/api/src/routes/venue/public/list.ts:65`).
- **`isFeatured` público.** `resolvePublicIsFeatured` (`apps/api/src/utils/accommodation-featured.ts:97-98`);
  aplicado en `getBySlug.ts:133`, `list.ts:65`, `getById.ts:55`, `getByDestination.ts:56`.
- **Marca de la tarjeta.** `apps/web/src/components/venue/VenueCard.astro:58,118-120`
  usa `venue.card.featured` («Destacado» / «Featured» / «Destaque»:
  `packages/i18n/src/locales/{es,en,pt}/venue.json:48`).
- **Agenda del local.** Tabla `venue_events` (`packages/db/src/schemas/venue/venue_event.dbschema.ts`),
  gate `manage_venue_events` (pro y premium). La ficha pública arma `venueEvents` filtrando
  `isActive` en `apps/api/src/routes/venue/public/getBySlug.ts:122-142` y la pinta
  `apps/web/src/components/venue/VenueEvents.astro` (211 líneas). Hoy **no hay `isFeatured` por evento**.
- **Concesión aditiva, precedente.** `packages/db/src/migrations/0202_hos_2105_faq_draft_catalog.sql`
  (función del trigger + `set_config('hospeda.catalog_additive_grant', ...)` + INSERT en
  `plan_version_entitlement`) y la data-migration
  `packages/seed/src/data-migrations/0168-hos-2105-faq-draft-plan-version-grant.ts` (cubre las
  versiones publicadas por el admin con ids distintos por entorno, con `join plan`).
- **La clave ya existe.** `featured_listing` está en el catálogo
  (`packages/schemas/src/catalog/entitlement-keys.ts:23`, scope `vertical`, `MAX`). No hace
  falta clave nueva: no se toca G3 ni G18 por una clave.
- **Trial.** El trial nunca destaca (PM-627, `sync-listing-featured.ts:42-47`). La prueba
  gratis de 30 días de venue no da prioridad. Hay que decirlo en la copy de planes (ver HOS-2284).
- **E2E existentes.** `apps/e2e/tests/verticals/featured-04-venue-experience-order.spec.ts`,
  `featured-03-plan-grant-courtesy.spec.ts`.

## 5. Diseño

### 5.1 Catálogo (carril: migración estructural + data-migration del seed)

Una **concesión aditiva** de `featured_listing` a las versiones de plan de `venue-premium`.
Los planes son inmutables salvo por el carril aditivo del trigger de `extras 041`; no se
publica versión nueva (las suscripciones están ancladas a `plan_version_id` + `billing_option_id`).

1. `packages/db/src/migrations/02xx_hos_2279_venue_premium_featured_grant.sql`
   (misma forma que 0202): redefine la función del trigger (idéntica), hace
   `set_config('hospeda.catalog_additive_grant', 'HOS-2279', true)` e inserta
   `plan_version_entitlement(plan_version_id, 'featured_listing', NULL, NULL)` para el id fijo de
   la versión premium de venue de la línea base (`8e4b0c4e-702f-5203-85e3-e9c06365eb87`,
   `0144_production_plan_catalog.sql`, tiene `manage_venue_events`, `menu_qr_scan_metrics`).
   Un INSERT por sentencia (el restaurador del catálogo los reproduce).
2. `packages/seed/src/data-migrations/0xxx-hos-2279-venue-premium-featured-grant.ts`
   (misma forma que `0168`): para **todas** las versiones `venue-premium` (incluidas las
   publicadas desde el admin con id distinto) que no tengan ya la clave. `group: 'required'`,
   `destructive: false`. Reporta cuántas versiones tocó.
3. Dual-write del seed (regla HOS-25): ajustar el baseline que genera el catálogo
   (`scripts/production-catalog/catalog.ts`, bloque `venue-premium`, ~L813-960) para que una
   base fresca nazca correcta, y regenerar el SQL con el generador (`G18 check-catalog-sql`
   falla si hay deriva).
4. **No mergea antes del pase final de HOS-1352** (regla del owner, HOS-2253). La spec queda
   lista; el PR se abre después.

### 5.2 Efecto en los locales premium ya existentes

La concesión aditiva **no emite avisos de cobertura**. Los locales premium actuales se destacan
cuando corre el reconciliador diario (05:00) o la sincronización de su próximo aviso. Para
«inmediato» (precedente HOS-2105: «grant to existing subscribers immediately») hay dos caminos:

- A) Esperar al reconciliador de las 05:00. Pro: cero código. Contra: hasta ~24 h sin marca.
- B) Que la data-migration, tras insertar, llame `syncListingFeatured` por cada par
  (usuario, `venue`) afectado. Pro: inmediato. Contra: una data-migration no debería depender
  de los puertos de la API (rompe el aislamiento del carril de seed).
- C) Disparar el reconciliador a mano (`cron` admin) una vez, tras el deploy. Pro: sin código nuevo
  y sin tocar el carril. Contra: paso manual en el runbook.
- **Recomiendo C**, anotado en el runbook de despliegue.

### 5.3 Marca «Destacado» en el evento

El evento no tiene identidad de destacado propia en este issue: **hereda del local**.

- API: en `getBySlug.ts:122-142` cada evento sale con `isFeatured`. Fuente única: la proyección
  pública. El valor es `resolvePublicIsFeatured(venue)` (la misma regla que la ficha). El
  esquema público del evento (`packages/schemas/src/entities/venue/subtypes/venue.event.schema.ts`,
  `VenueEventPublicSchema` o equivalente) gana `isFeatured: z.boolean()`. HOS-2288 reutiliza el
  campo y lo calcula como `local destacado OR evento potenciado` (ver spec de HOS-2288).
  **Un solo campo, dos fuentes, una sola función**: `resolvePublicEventIsFeatured`
  en `apps/api/src/utils/venue-event-featured.ts` (nuevo, junto a `accommodation-featured.ts`).
- Web: `VenueEvents.astro` recibe `isFeatured` por evento y pinta una insignia con
  `venue.events.featured` (es «Destacado», en «Featured», pt «Destaque»), con el mismo estilo
  de insignia que `VenueCard`. **Nunca** nombra el plan.
- Orden de la agenda: destacados primero, luego por próxima ocurrencia
  (la lógica de «próxima ocurrencia» ya está en `VenueEvents.astro`, ~L66-76). Cuando el local
  entero está destacado todos lo son y el orden no cambia.
- Cache: la revalidación post-commit del sincronizador (`sync-listing-featured.ts:109-111`)
  ya invalida la ficha del local. No hace falta tag nuevo.

### 5.4 Qué NO hace este issue

- No agrega toggle (decisión del owner 2026-08-29, HOS-929: «el destacado no lleva interruptor»).
- No crea un campo por evento en la base (eso es de HOS-2288).

## 6. Contratos

- `VenueEventPublic.isFeatured: boolean` (nuevo, obligatorio en la respuesta pública).
  No es un cambio rompiente: es un campo aditivo en una respuesta que ya se valida con
  `stripWithSchema`. Verificar que el cliente web (`apps/web/src/data/types.ts`, `VenueEvent`)
  y `transforms.ts` lo incluyan.
- Sin cambios en rutas ni en errores. El contrato de errores no cambia.
- Sin variables de entorno nuevas.

## 7. Criterios de aceptación

- AC-1. Dado un local con plan Premium **pago** y publicado, cuando corre la sincronización,
  entonces `venues.featured_by_entitlement = true` y `GET /api/v1/public/venues` lo devuelve con
  `isFeatured: true`.
- AC-2. Dados un local Premium y uno Pro en el mismo rubro, cuando se abre `/comer-y-salir/` y
  `/comer-y-salir/rubro/<rubro>/` con el orden por defecto, entonces el Premium aparece antes
  que el Pro.
- AC-3. Dado un local Premium con eventos activos, cuando se abre su ficha, entonces **cada**
  evento muestra «Destacado» (es), «Featured» (en), «Destaque» (pt), y ningún texto menciona
  «Premium» ni el plan.
- AC-4. Dado un local Premium que baja a Pro o deja de pagar, cuando el aviso de cobertura se
  procesa, entonces pierde `featured_by_entitlement`, sus eventos pierden la marca y vuelve a su
  posición normal (no se borra ningún evento).
- AC-5. Dado un local en **trial** (aunque el trial sea de venue), cuando se evalúa, entonces
  **no** se destaca (PM-627).
- AC-6. Dados dos locales Premium, el orden entre ellos es estable (sin parpadeo entre cargas).
- AC-7. La migración es aditiva: no modifica ni borra ninguna fila de `plan_version_entitlement`
  existente, y es idempotente (correrla dos veces no duplica).
- AC-8. `check-catalog-sql` (G18), `check-catalog-key-usage` (G3), `check-commercial-values-in-code`
  (G7) y `check-step5-declared` pasan. G6 (un rol nunca decide) no se ve afectado.
- AC-9. Para locales de **experiencia** y **alojamiento** no cambia nada.

## 8. Plan de pruebas

- Unit `packages/verticals/test/featured/sync-listing-featured-plan.test.ts`: caso venue con
  plan premium otorgando la clave; caso trial no destaca (ya existe, ampliar a venue).
- Unit `apps/api/test/utils/venue-event-featured.test.ts` (nuevo): la función con
  `featuredByEntitlement` true/false/null.
- Integración `apps/api/test/routes/venue/public/get-by-slug-events-featured.test.ts` (nuevo):
  la respuesta trae `isFeatured` por evento.
- Test de la data-migration (patrón `packages/seed/test/data-migrations/`): inserta en versión
  publicada sin la clave, no duplica, cubre versión con id de admin.
- Componente `apps/web/test/components/venue/VenueEvents.test.ts` (nuevo): insignia visible solo
  con `isFeatured`, y el texto no contiene el nombre del plan. Guard de i18n con las tres lenguas.
- E2E: ampliar `featured-04-venue-experience-order.spec.ts` con un local Premium con evento y
  verificar insignia + orden.
- Guards de catálogo: correr `pnpm check:guards` antes del PR.

## 9. Riesgos

- R-1. **Efecto lateral en suscriptores existentes:** conceder la clave destaca **todas** las
  fichas del dueño en venue (hasta 5 en Premium). Es lo correcto según `sync-listing-featured.ts:95`,
  pero conviene avisarlo. Novedades lo cubre.
- R-2. **Un local Pro con add-on de visibilidad (HOS-2290) también tiene `featured_by_entitlement`
  verdadero**, y sus eventos mostrarían la marca por herencia. Ver pregunta 1.
- R-3. **Dos migraciones sobre las mismas versiones.** HOS-2280 («habilitar eventos, métricas y
  video») y los límites de HOS-2253 también hacen concesiones aditivas a `venue-premium`. Conviene
  **una sola migración por tanda** para no multiplicar los números y los riesgos de orden.
- R-4. **Versiones publicadas desde el admin con id distinto:** la migración fija solo cubre la
  versión de la línea base; la data-migration cubre el resto (mismo problema que HOS-2105).

## 10. Preguntas abiertas para el owner

1. **¿Un evento hereda la marca cuando el local está destacado por un add-on de visibilidad
   (no por el plan)?**
   - A) Sí, hereda siempre del local. Pro: una sola regla, cero campos. Contra: un local Pro que
     compra el boost de 7 días ve todos sus eventos con la marca 7 días.
   - B) Solo hereda del plan Premium. Pro: el add-on de evento (HOS-2288) conserva su valor.
     Contra: hace falta distinguir el origen (plan vs add-on) en la API, más código.
   - **Recomiendo A.** Simple, coherente con «destacado = destacado», y el add-on de evento
     sigue sirviendo a los planes que no tienen la marca.
2. **¿Cómo llega «inmediato» a los premium existentes?** Opciones A/B/C de §5.2.
   **Recomiendo C.**
3. **¿Experiencia Premium también recibe `featured_listing`?** La issue habla solo de Comer y
   salir.
   - A) No, solo venue ahora. Pro: respeta el alcance. Contra: asimetría con el rubro hermano.
   - B) Sí, venue y experiencia en la misma migración. Pro: coherencia.
     Contra: fuera del épico, necesita decisión de producto.
   - **Recomiendo A** y abrir una issue aparte si el owner lo quiere.
4. **¿Se corrige la etiqueta `status-blocked` y las relaciones de Linear de HOS-2279 / HOS-2288?**
   Recomiendo sí: reemplazar HOS-929/HOS-1357 (Done) por «pase final de HOS-1352».

## 11. Dependencias

- Pase final de HOS-1352 (bloquea el merge de la migración de catálogo).
- HOS-2290 (informe: el mecanismo funciona).
- HOS-2280 (habilita eventos, métricas y video): coordinar migración única (R-3).
- HOS-2288 depende de esta (campo `isFeatured` por evento y orden de agenda).
- HOS-2263 (tope de eventos activos) y HOS-2264 (recurrencia por plan): leen las mismas versiones.

## 12. Smoke y Novedades

- Etiquetas: `status-needs-smoke-staging` (necesita un local Premium pago real y el
  reconciliador; Cloudflare para la revalidación del listado).
- Novedades: **sí**, una entrada («Los locales Premium aparecen primero y sus eventos se ven
  destacados»), por el flujo del smoke (`smoke-tanda`, fase 2b), audiencia: dueños de venue.

## 13. Desglose de tareas

1. Migración SQL aditiva + baseline del catálogo + regenerar (G18). (0,5 d)
2. Data-migration del seed + su test. (0,5 d)
3. `resolvePublicEventIsFeatured` + campo `isFeatured` en el esquema público + proyección en
   `getBySlug`. (0,5 d)
4. Web: `VenueEvents.astro` insignia, orden, i18n es/en/pt, tests. (0,5 d)
5. E2E y smoke en staging; runbook del reconciliador. (0,5 d)
6. Linear: etiquetas, relaciones, Novedades. (0,25 d)

## 14. Linear

Canonical tracking:
HOS-2279
