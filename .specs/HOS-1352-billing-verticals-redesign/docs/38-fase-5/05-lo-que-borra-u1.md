---
title: "FASE 5 · 05 · Lo que borra U1"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
status: CURRENT
fase: 5
---

# FASE 5 · 05 · Lo que borra `U1`

- **Área**: la lista de lo que `U1` borra (regla 1 del criterio, DEC-METH-017), lo que sobrevive y lo
  que el borrado rompe fuera del billing viejo.
- **Código**: `origin/staging` en `35e2d63e819d087cb871392ec923158b91630f30`, leído como una foto
  extraída con `git archive` (16 962 archivos versionados, igual que `git ls-tree -r`).
- **Diseño leído**: `16-fase-7-del-paraguas.md` §4.6 (y §4.2 pasos 3 y 6), `30-revision-del-owner/32-`
  (lotes N, O y P), `V/docs/21-migracion.md` §2.4 y §4, `B/docs/21-migracion.md` §4, `V/docs/20-testing.md`
  §2 (fila `G8`).
- **Fecha**: 2026-09-30.

## Resumen

Conteo por categoría, hecho con `rg -c` sobre la columna «categoría» de las tablas de este informe
(ver *«búsquedas de ausencia»*, B-0):

| categoría | piezas |
|---|---|
| DELETE | 21 |
| CONFIRMA | 4 |
| CONTRADICE | 6 |
| ADAPTAR | 9 |
| FALTA | 3 |

**Tamaño de lo que borra `U1`** (sección 1): **1482 archivos y 515 353 líneas**, de los cuales 740 son
tests. **Lo que el borrado rompe fuera del billing viejo** (sección 3): **311 archivos de fuente**
(53 de ellos migraciones de datos del seed) y **169 archivos de test** que importan algo de esa lista.

**Las ALTA**:

- `F5-U1-040` · CONTRADICE · los gates de entitlement y limits los importan **145 archivos de fuente
  fuera del billing**, 77 de ellos rutas de las tres verticales: `U1` no puede borrarlos sin reescribir
  la autorización de esas rutas, y el diseño dice «ningún código nuevo».
- `F5-U1-042` · CONTRADICE · `billing_notification_log` es el log de **todas** las notificaciones de la
  plataforma, no sólo del cobro: el diseño lo borra con «`billing_*` entero».
- `F5-U1-044` · CONTRADICE · `partners` tiene claves foráneas a `billing_plans` y `billing_subscriptions`,
  y `partner.model.ts` usa `partner_subscriptions`: el diseño borra las tablas y no dice qué pasa con
  las columnas de `partners`.
- `F5-U1-048` · CONTRADICE · no son 11 las migraciones de datos del seed que dejan de compilar: son
  **53** (51 numeradas y 2 helpers). Congelar los valores alcanza para 13; las otras 40 importan
  **tablas** de billing de `@repo/db`.
- `F5-U1-030` · CONTRADICE · las tres columnas que sobreviven **no** «sólo las usa el cobro viejo»: las
  leen la lectura pública de alojamientos, sus permisos y los destinos, y nadie tiene asignado
  desengancharlas antes de la migración que las borra.

## Método

1. **Qué es «billing viejo»**, en este orden, todo contado con `sets.mjs` sobre la foto:
   (a) las carpetas que el diseño nombra o que son del cobro por nombre (`packages/billing/**`,
   `routes/billing/**`, `routes/webhooks/mercadopago/**`, `services/billing/**` de `apps/api` y de
   `service-core`, `packages/db/src/{billing,schemas/billing,models/billing}/**`, `schemas/src/api/billing/**`,
   las plantillas de `addon`, `billing`, `subscription` y `trial`, `features/billing-*` y
   `routes/_authed/billing` de admin, `components/billing` y `lib/billing` de web, `docs/billing/**`);
   (b) todo archivo que **importa** `@qazuor/qzpay*` y tiene nombre del cobro; (c) los archivos de
   `apps/`, `packages/` y `scripts/` cuyo nombre es del cobro (`billing`, `subscription`, `addon`,
   `promo`, `courtesy`, `dunning`, `entitlement`, `checkout`, `preapproval`, `mercadopago`, `plan`,
   `trial`, `payment`, `refund`, `invoice`…), podados a mano de lo que no es del cobro (tipo de cambio,
   íconos, `alert-subscription`, tests de i18n); (d) una lista explícita de 30 archivos que la regla
   de nombre no veía (seis crons, `past-due-grace`, `usage-tracking`, `customer-lookup`,
   `idempotency-key`, las rutas `webhooks/admin` y `webhooks/health`, los guards de CI del cobro, dos
   seeders, `partner_subscription.dbschema.ts`); y (e) los **18 archivos de extras** que tocan una
   tabla del cobro.
2. **Excluido a propósito**: la historia de migraciones (`packages/db/src/migrations/0*`, `meta/`) y
   `packages/seed/src/data-migrations/**`, que sale en el paso 6 del corte y no en `U1`
   (`16-` §4.2, paso 6); y `packages/db/test/schemas/plan-restricted.dbschema.test.ts`, que prueba una
   columna que sobrevive.
3. **Quién importa lo que se borra**: un grafo de imports a nivel de símbolo (`graph.mjs`), que
   resuelve rutas relativas, `@/`, `@repo/*` y los barrels (`export *`, `export {…} from`) hasta el
   archivo que define cada símbolo. El grafo **no** ve lo que `@repo/db` re-exporta desde
   `@qazuor/qzpay-drizzle` (las tablas `billing_plans`, `billing_subscriptions`, etc.), así que eso se
   buscó aparte por nombre de import (`out-dbtables.tsv`).
4. **Límite honesto**: la frontera de «billing viejo» por nombre es una heurística. Lo que quedó en
   duda está en *«lo que no pude cerrar»*.

## 1. Lo que `U1` borra (DELETE)

Todas estas piezas son `DELETE` por el **lote N-A** (`30-revision-del-owner/32-`, lote N, fila A:
*«la primera unidad de la épica borra todo el cobro viejo (`qzpay`, rutas, crons, adaptador)»*) y
por `16-` §4.6 punto 1, que se lo asigna a `U1` (lote O-A). Columnas: archivos y líneas de fuente,
de test y totales.

| id | grupo | fuente | líneas | test | líneas | total | líneas |
|---|---|---|---|---|---|---|---|
| `F5-U1-001` | `packages/billing` entero | 54 | 9917 | 42 | 10 767 | 96 | 20 684 |
| `F5-U1-002` | rutas de `apps/api` (46 en `routes/billing`, 22 en `routes/webhooks`, 4 de commerce, 3 de partners, 2 de user, 1 de test) | 77 | 26 495 | 1 | 112 | 78 | 26 607 |
| `F5-U1-003` | crons de `apps/api` | 20 | 14 242 | 0 | 0 | 20 | 14 242 |
| `F5-U1-004` | middlewares de `apps/api` | 16 | 6875 | 0 | 0 | 16 | 6875 |
| `F5-U1-005` | servicios, utils, lib y schemas de `apps/api` | 130 | 47 194 | 0 | 0 | 130 | 47 194 |
| `F5-U1-006` | docs de `apps/api` | 8 | 3084 | 0 | 0 | 8 | 3084 |
| `F5-U1-007` | tests de `apps/api` | 0 | 0 | 420 | 226 277 | 420 | 226 277 |
| `F5-U1-008` | `service-core` (54 en `services/billing`) | 60 | 16 054 | 64 | 26 336 | 124 | 42 390 |
| `F5-U1-009` | `db`: esquema y modelos (`billing/`, `schemas/billing/`, `models/billing/`, `partner_subscription`) | 29 | 4242 | 0 | 0 | 29 | 4242 |
| `F5-U1-010` | `db`: extras que tocan tablas del cobro | 18 | 1865 | 0 | 0 | 18 | 1865 |
| `F5-U1-011` | `db`: resto (util `billing-subscription-conditions` y tests) | 1 | 89 | 13 | 2301 | 14 | 2390 |
| `F5-U1-012` | `seed`: seeders `required/` del cobro y sus tests | 11 | 2512 | 4 | 2043 | 15 | 4555 |
| `F5-U1-013` | `schemas`: `api/billing` y 14 enums del cobro | 39 | 5212 | 14 | 4193 | 53 | 9405 |
| `F5-U1-014` | `notifications`: plantillas `addon`, `billing`, `subscription`, `trial` | 43 | 4572 | 17 | 3421 | 60 | 7993 |
| `F5-U1-015` | `apps/admin` | 109 | 21 426 | 48 | 9331 | 157 | 30 757 |
| `F5-U1-016` | `apps/web` | 97 | 22 642 | 101 | 29 866 | 198 | 52 508 |
| `F5-U1-017` | `apps/e2e` | 1 | 153 | 10 | 1473 | 11 | 1626 |
| `F5-U1-018` | `scripts` (guards de CI del cobro y `server-tools billing-test-*`) | 13 | 4271 | 5 | 2000 | 18 | 6271 |
| `F5-U1-019` | `docs/billing` | 16 | 5771 | 0 | 0 | 16 | 5771 |
| `F5-U1-020` | `ai-core` (un test de entitlements) | 0 | 0 | 1 | 617 | 1 | 617 |
| | **total** | **742** | | **740** | | **1482** | **515 353** |

### Detalle que cada grupo necesita

- **`F5-U1-003`, los 20 crons**: `addon-expiry`, `addon-subscription-reconcile`,
  `apply-scheduled-plan-changes`, `dunning`, `entity-subscription-cache-reconcile`,
  `featured-by-entitlement-reconcile`, `partner-payment-review`, `preapproval-less-expiry`,
  `propagate-plan-price-changes`, `subscription-drift-reconcile`, `subscription-poll`, `trial-expiry`,
  `trial-series-dispatch`, `webhook-retry`, `abandoned-pending-subs`, `finalize-cancelled-subs`,
  `reactivation-supersession-reconcile`, `courtesy-expiry`, `notification-schedule` y
  `notification-schedule-renewal-window` (todos en `apps/api/src/cron/jobs/`).
- **`F5-U1-004`, los 16 middlewares**: `billing`, `billing-customer`, `billing-auth`,
  `billing-admin-auth`, `billing-admin-guard`, `billing-ownership`, `billing-perm`, `entitlement`,
  `commerce-entitlement`, `owner-entitlement`, `accommodation-entitlements`, `tourist-entitlements`,
  `require-live-subscription`, `trial`, `past-due-grace` e `idempotency-key` (éste lee
  `billing_idempotency_keys`, una tabla de `qzpay`, `apps/api/src/middlewares/idempotency-key.ts:43`).
  **Los ocho de entitlement y suscripción son los que rompen afuera: `F5-U1-040`.**
- **`F5-U1-009`, las tablas**. Las de `qzpay` (`billing_subscriptions`, `billing_customers`,
  `billing_plans`, `billing_prices`, `billing_payments`, `billing_idempotency_keys`,
  `billing_webhook_events`, …) **no están en el esquema del repo**: entran por
  `import { qzpaySchema } from '@qazuor/qzpay-drizzle'` (`packages/db/src/client.ts:1`, `:16-18`) y
  por `packages/db/src/billing/schemas.ts`. Las del repo son 15 (`pgTable` en `schemas/billing/*` y
  `schemas/partner/partner_subscription.dbschema.ts`): `billing_addon_purchases`,
  `billing_dunning_attempts`, `billing_mp_addon_plans`, `billing_mp_plans`, `billing_notification_log`
  (ver `F5-U1-042`), `billing_orphan_payments`, `billing_pending_checkouts`, las tres de
  `billing_plan_price_change*`, `billing_settings`, `billing_subscription_events`,
  `entity_subscriptions`, `featured_listing_addon_grants` y `partner_subscriptions`.
- **`F5-U1-010`, los 18 extras**: `004`, `010`, `014`, `015`, `020`, `023`, `024`, `025`, `028`, `029`,
  `030`, `031`, `035`, `036`, `037`, los dos `038` y `041`. Todos escriben o indexan sólo tablas del cobro
  (`rg -o "(UPDATE|INSERT INTO|ALTER TABLE|ON|FROM) <tabla>"` sobre cada uno). Ver `F5-U1-054`.
- **`F5-U1-012`**: `billingPlans`, `billingPromoCodes`, `billingAddons`, `billingEntitlements`,
  `billingLimits`, `commercePlan`, `partnerPlan`, `testDailyPlan`, `trialPlans` (seed y writer) y
  `scripts/plan-pricing-tiers.ts`.
- **`F5-U1-018`**: los seis guards que importan o nombran `qzpay` (`check-no-plan-id-to-own-preapproval`,
  `check-no-price-trial-days`, `check-no-trial-to-mercadopago`, `check-product-domain-on-writes`,
  `check-qzpay-wave-convergence`, `check-subscription-domain-hydration`), cuatro del cobro por nombre
  (`check-addon-product-domain`, `check-addon-webhook-routing`, `check-commerce-plan-resolution`,
  `check-unlisted-plan-filter`), sus tests, y `server-tools/src/commands/billing-test-*`. Su cableado
  en `package.json` y en CI es `F5-U1-052`.
- **`F5-U1-021`, variables de entorno que sólo usa el viejo** (DELETE, mismo lote), en
  `packages/config/src/env-registry.hospeda.ts`: `HOSPEDA_COMMERCE_PLAN_SLUGS` (`:555`),
  `HOSPEDA_ADDON_LIFECYCLE_ENABLED` (`:868`), `HOSPEDA_USER_CANCEL_ENABLED` (`:890`),
  `HOSPEDA_BILLING_POLLING_ENABLED` (`:912`), `HOSPEDA_BILLING_PRICE_INCREASE_ENABLED` (`:934`),
  `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` (`:956`), `HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED`
  (`:978`), `HOSPEDA_TRIAL_DAYS_OVERRIDE` (`:1667`), `HOSPEDA_SHOW_TEST_BILLING_PLAN` (`:1684`) y
  `HOSPEDA_QZPAY_TEST_CONTROL_ENABLED` (`:2421`). Diez. Las siete de Mercado Pago no van acá: ver
  `F5-U1-053`.

## 2. Lo que el diseño dice que sobrevive

| id | categoría | sev. | diseño | código | argumento | unidad |
|---|---|---|---|---|---|---|
| `F5-U1-030` | CONTRADICE | ALTA | `V/21` §2.4 (líneas 218-224): las tres columnas *«son columnas de `accommodations` que sólo usa el cobro viejo»*; `16-` §4.6 punto 1, igual | existen: `packages/db/src/schemas/accommodation/accommodation.dbschema.ts:110` (`owner_suspended`), `:117` (`plan_restricted`), `:133` (`billing_unpublished_at`). **Y las leen fuera del cobro**: `packages/service-core/src/services/accommodation/accommodation.permissions.ts:66`, `:170`, `:185`; `packages/db/src/models/accommodation/accommodation.model.ts:636`, `:641`, `:793`; `packages/service-core/src/services/destination/destination.service.ts:627-628`, `:1337-1338`; `apps/api/src/routes/accommodation/public/similar.ts:183-184`; `packages/service-core/src/services/alert/promo-offer-evaluator.service.ts:368`; `accommodation.service.ts:2099`, `:2289` | la premisa es falsa: esconder una ficha suspendida o fuera de cupo de la lectura pública vive en el código de alojamientos, no en el cobro. Sobrevivir a `U1` los mantiene compilando hasta el corte, pero la migración que las borra después de la clasificación de `V6` (`16-` §4.2 paso 3, lote S) exige que la imagen del paso 3 ya no las lea, y **ninguna unidad tiene asignado sacar esas lecturas**. Hay que corregir el diseño: nombrar qué unidad reemplaza esos filtros (la visibilidad por estado de publicación de verticales) y que lo haga antes del corte | `V6`, `V5` o la que el owner nombre |
| `F5-U1-031` | CONFIRMA | BAJA | `16-` §4.2 paso 3: el receptor nuevo sirve la misma ruta, `/api/v1/webhooks/mercadopago` (lote O-B) | la monta hoy `apps/api/src/routes/index.ts:779-784`, **con condición**: sólo si `createMercadoPagoWebhookRoutes()` devuelve algo (billing configurado); `:785` monta aparte `webhookHealthRoutes` en `/api/v1/webhooks`, y `routes/webhooks/index.ts:15` exporta además `brevoWebhookRoutes`, que no es del cobro | la ruta existe donde el diseño dice. `U1` borra el receptor y su montaje; lo que sobrevive es el **camino**, que queda sin dueño hasta la unidad que monta el receptor nuevo. El borde de Brevo sigue en la misma carpeta y no se toca | `U1` (desmonta), la unidad de `B` que monta el receptor |
| `F5-U1-032` | FALTA | MEDIA | `16-` §4.6 punto 1 nombra sólo las tres columnas de `accommodations` como excepción; `B/21` §4 retira *«las columnas denormalizadas que el código de hoy lee, como `featured_by_entitlement` y `is_featured`»* (un «como», no una lista) | columnas del cobro en tablas que no son del cobro y que ningún texto del diseño nombra: `users.service_suspended` (`user.dbschema.ts:138`, la fuente de verdad de `owner_suspended`, según su comentario `:130-137`), `owner_promotions.plan_restricted` (`owner_promotion.dbschema.ts:37`), `experiences.has_active_subscription` (lo nombra `V/21` §2.4 sólo para decir que no se traduce), y en `partners`: `plan_id`, `subscription_id`, `payment_confirmed_through` y los estados de suscripción y de revisión de pago (`partner.dbschema.ts:60`, `:63`) | el diseño no dice si `U1` las borra, las deja o las renombra. Sin lista, `U1` decide a ojo cuáles son «del cobro», que es justo lo que el lote N-A pide no hacer (*«100 % seguros»*). Hay que escribir la lista cerrada | `U1` |

## 3. Lo que `U1` borraría y algo de fuera del billing viejo todavía importa o lee

Recuento con script (`b-all-src.txt`, 311 archivos de fuente, y 169 de test), por clúster:

| clúster | archivos de fuente |
|---|---|
| K1 · importan un gate de entitlement o limit (`middlewares/entitlement`, `commerce-entitlement`, `require-live-subscription`, `tourist-entitlements`, `owner-entitlement`, `utils/entitlement-filter`, `EntitlementKey`, `LimitKey`, `commerce-limits.config`, `publish-verticals.config`, `useMyEntitlements`) | 145 |
| K2 · ensambladores y archivos centrales | 16 |
| K3 · leen una tabla o un enum del cobro | 17 |
| K4 · UI de web y admin fuera de las carpetas del cobro | 51 |
| K5 · migraciones de datos del seed | 53 |
| K6 · resto (rutas con `buildAccommodationPublishDeps`, `qrSheet`, stats, docs) | 29 |

| id | categoría | sev. | diseño | código | argumento | unidad |
|---|---|---|---|---|---|---|
| `F5-U1-040` | CONTRADICE | ALTA | `16-` §4.6: `U1` borra *«todo lo que sólo el sistema viejo usa»*, *«la rama sigue compilando: typecheck y lint verdes»* y *«ningún código nuevo»* (fila de `U1`) | los gates que borra (`F5-U1-001`, `F5-U1-004`) los importan **145 archivos de fuente fuera del billing**: 39 rutas de `routes/accommodation`, 23 de `routes/gastronomy`, 15 de `routes/experience`, 7 de `user-bookmark-collection`, 4 de `ai`, 4 de `owner-promotion` y 18 de otras rutas, más 14 de `apps/api/src` (p. ej. `middlewares/ai-quota.ts`, `limit-enforcement.ts`, `commerce-limit-enforcement.ts`, `utils/limit-check.ts`), 12 de admin y 9 de web. Ejemplos: `apps/api/src/routes/accommodation/protected/create.ts:66` (`requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS)`), `routes/gastronomy/protected/removeMedia.ts:21-23`, `:81` (los tres gates juntos); `08-phase-1b-code-discovery.md` `F-1B-036` los contó en 79 + 50 + 34 ocurrencias | los gates no son «sólo del sistema viejo»: son la autorización de las rutas de las verticales, que el diseño reemplaza con los siete pasos de `V5`. Para que la rama compile, `U1` tiene que editar esos 145 archivos, y editar la cadena de middlewares de una ruta **es** cambiar su autorización: o las deja sin gate (una ruta de escritura abierta en la rama hasta `V5`) o escribe un gate provisorio (código nuevo). Ninguna de las dos está escrita. Lo tiene que decidir el owner: acotar `U1` (los gates quedan hasta `V5`, que los reemplaza) o aceptar las rutas sin gate en la rama y decirlo | `U1`, `V5` |
| `F5-U1-041` | ADAPTAR | MEDIA | `16-` §4.6 punto 1 nombra *«sus rutas, sus crons, su adaptador»* y los cinco `package.json`; no nombra los ensambladores | 16 archivos centrales que no se borran y hay que editar: `apps/api/src/types.ts:2-3`, `:88` (`AppBindings` declara `qzpay?: QZPayBilling` y usa `EntitlementKey`/`LimitKey`; lo importan 333 archivos fuera de la lista), `apps/api/src/utils/create-app.ts:6-21`, `:180-190` (cuatro middlewares globales del cobro), `apps/api/src/routes/index.ts:11`, `:440`, `:776-785`, `apps/api/src/cron/registry.ts`, `apps/api/src/lib/auth.ts` (`getQZPayBilling`, `BillingCustomerSyncService`), `apps/api/src/index.ts` (`validateBillingConfigOrThrow`, `ensureDefaultPromoCodes`), `apps/api/src/utils/env.ts`, `packages/db/src/client.ts:1`, `:16-18`, `packages/db/src/schema.ts`, `packages/db/src/schemas/index.ts:1-2`, `:10`, `packages/db/drizzle.config.ts`, `packages/db/src/schemas/enums.dbschema.ts` (los `pgEnum` del cobro, p. ej. `billing_interval_enum`, `:297`), `apps/admin/src/routes/__root.tsx` (adaptador y tema de `qzpay`), `apps/admin/src/lib/csp-helpers.ts`, `packages/seed/src/required/index.ts`, `scripts/server-tools/src/index.ts` | es trabajo mecánico y cabe en `U1`, pero el diseño no lo lista y es donde un borrado a medias deja el build rojo | `U1` |
| `F5-U1-042` | CONTRADICE | ALTA | `B/21` §4: *«no se conserva nada […] Eso abarca `billing_*` entero»*; `16-` §4.6 punto 1: el esquema de las tablas viejas de billing | `billing_notification_log` (`packages/db/src/schemas/billing/billing_notification_log.dbschema.ts`) es el log de **toda** notificación de la plataforma: `NotificationService.logNotification` inserta ahí cada envío, sea del tipo que sea (`packages/notifications/src/services/notification.service.ts:3`, `:1063`); lo leen `apps/api/src/services/ai-cost-alert.service.ts:31`, `:74-80` (dedup de la alerta de costo de IA), `notification-retry.service.ts:16`, `:129`, el cron `notification-log-purge.job.ts:14` y la pantalla `apps/admin/src/routes/_authed/platform/email/logs.tsx` | borrar la tabla con el cobro rompe el registro, el reintento y el dedup de las notificaciones de conversaciones, IA y todo lo demás. Hay que corregir el diseño: sacar esta tabla de «`billing_*` entero» (y decidir si se renombra, porque su nombre dice billing) o nombrar el log que la reemplaza y quién lo construye | `U1`; el owner decide si es de `B13` o de nadie |
| `F5-U1-043` | ADAPTAR | MEDIA | `16-` §4.6 punto 1 borra `@repo/billing` con el cobro | `packages/billing/src/types/money.ts` (`Major`, `asMajor`) lo usan las notificaciones: `packages/notifications/src/templates/utils/format-helpers.ts:8` y `notification.service.ts:1`; y `@repo/billing` lo declaran **siete** `package.json`, no cinco: además de los del diseño, `apps/web/package.json:35`, `packages/notifications/package.json:27` y `packages/seed/package.json:41` | un tipo de dinero genérico vive en el package que se borra; `U1` lo tiene que mover (a `@repo/utils` o a `schemas`) antes de borrar el package | `U1` |
| `F5-U1-044` | CONTRADICE | ALTA | `B/21` §4 borra `partner_subscriptions`; `V` descomposición, `V7`, rehace Partner (la presencia como entitlement) | `packages/db/src/schemas/partner/partner.dbschema.ts:4` importa `billingPlans` y `billingSubscriptions`, y `:60`, `:63`, `:264-268` declara claves foráneas y relaciones hacia ellas; `packages/db/src/models/partner/partner.model.ts:28`, `:223-226`, `:412-424`, `:536-567` lee y escribe `partner_subscriptions`; `packages/service-core/src/services/partner/partner.service.ts` y tres schemas de `packages/schemas/src/entities/partner/` usan `PartnerSubscriptionStatusEnum` y `PartnerPaymentReviewStateEnum`, que son de la lista de `F5-U1-013`; lo usan también `apps/api/src/cron/jobs/partner-expiry.job.ts`, `routes/partners/admin/send-link.ts` y `apps/admin/src/features/partners/components/PartnerForm.tsx` | sacar las tablas de `qzpay` del esquema deja a `partners` con dos claves foráneas a tablas que ya no existen: no compila y la migración generada no es la que el diseño supone. El diseño no dice qué pasa con las columnas del cobro de `partners` (`F5-U1-032`) ni con los crons de Partner que no son del cobro puro (`partner-expiry`, `partner-unpaid-reaper`). Hay que escribirlo | `U1`, `V7` |
| `F5-U1-045` | ADAPTAR | MEDIA | `B/21` §4: `featured_by_entitlement` e `is_featured` *«se retiran con el código que las lee […] en la limpieza del principio»*; *«ninguna ficha nace destacada»* (R1) | `featured_by_entitlement` existe en tres tablas (`accommodation.dbschema.ts:92`, `gastronomy.dbschema.ts`, `experiences.dbschema.ts`) y la leen fuera del cobro seis rutas públicas de alojamiento (`getById`, `getBySlug`, `list`, `similar`, `getByDestination`, `getTopRatedByDestination`), `apps/api/src/utils/accommodation-featured.ts`, `packages/db/src/models/accommodation/accommodation.model.ts:198` (ordena por `isFeatured OR featuredByEntitlement`), `apps/web/src/components/sections/FeaturedAccommodationsSection.astro` y nueve schemas de `packages/schemas/src/entities/{accommodation,gastronomy,experience}`. `is_featured` de `accommodations` es **la curada por el admin** (`accommodation.dbschema.ts:83-88`), no una columna del cobro, y la misma columna existe en `gastronomies` y `experiences` | la decisión de retirar el destaque está escrita; lo que falta es que `U1` sepa que retirar estas columnas es editar la lectura pública, y que el `is_featured` de las otras dos verticales no está nombrado | `U1` |
| `F5-U1-046` | ADAPTAR | MEDIA | `16-` §4.6: la app de la rama queda rota en comportamiento, no en build | `apps/api/src/services/accommodation-publish-deps.ts:34-60` (importa `@qazuor/qzpay-core`, `@repo/billing`, `services/billing/*`, `subscription-trial-create`) la construyen `routes/accommodation/admin/update.ts:24`, `admin/patch.ts:24` y `protected/patch.ts:35`, y la consume `AccommodationService` (`packages/service-core/src/services/accommodation/accommodation.service.ts:189`, `:380`, `:444`, donde es opcional: `publishDeps?: … \| null`) | como el parámetro es opcional, `U1` puede pasar `null` y el build sigue verde; publicar queda roto hasta que `V4`/`V6` pongan la prueba nueva. Coherente con el diseño, pero no está escrito que ése es el corte limpio | `U1`, `V4` |
| `F5-U1-047` | ADAPTAR | MEDIA | `B/21` §4 retira `entity_subscriptions` | la leen fuera del cobro `packages/service-core/src/services/commerce/commerce-visibility.ts:34-36`, `:416-424` (la visibilidad pública de gastronomía y experiencia), `apps/api/src/services/commerce-reconcile.service.ts:32`, `commerce-downgrade-remediation.service.ts:69` y el seed de ejemplo `packages/seed/src/example/gastronomies.seed.ts:3` | `U1` tiene que desenganchar la visibilidad comercial; con cero filas de Gastronomía y Experiencia (`V/21` §4) no se pierde nada visible, pero es código a tocar | `U1` |
| `F5-U1-048` | CONTRADICE | ALTA | `B/21` §4 y `16-` §4.6: *«Las 11 migraciones de datos del seed que importan `@repo/billing` […] se congelan con sus valores adentro»*, y *«compilan sin él (caso 9)»* | en `packages/seed/src/data-migrations/` (122 `.ts`): **13** importan `@repo/billing` (11 numeradas —`0004`, `0005`, `0045`, `0061`, `0073`, `0074`, `0075`, `0092`, `0103`, `0105`, `0106`— y dos helpers, `helpers/billingCleanupGuards.ts` y `helpers/trialPlanMigration.ts`); **49** importan de `@repo/db` una tabla del cobro (`billingPlans`, `billingSubscriptions`, `entitySubscriptions`, …; p. ej. `0001-billing-plans-ai-consumer-search-limits.ts:62`); la unión son **53** | el recuento de 11 está bien para lo que mide, pero el caso 9 resuelve otra cosa: inlinear valores no le devuelve a una migración la **tabla** que usa. Cuando `qzpay-drizzle` sale de `@repo/db`, 40 migraciones más dejan de compilar, y «la rama sigue compilando» no se cumple. Además, en desarrollo y en CI el runner las corre sobre una base donde esas tablas ya no están. Hay que corregir el diseño: o se congelan como SQL crudo (sin importar tablas), o salen de la rama en `U1` y no en el paso 6 (con el ledger que eso toca) | `U1`; decide el owner |
| `F5-U1-049` | ADAPTAR | MEDIA | no lo nombra | `packages/seed/src/test-users/testUsers.seed.ts:9`, `:11` arma los 18 usuarios de prueba por rol y plan (`CLAUDE.md` raíz, SPEC-143) con `ALL_PLANS`, `OWNER_TRIAL_DAYS`, `billingSubscriptions`, `billingAddonPurchases` | sin el cobro, `db:fresh-dev` no puede crear esos usuarios como están. `U1` tiene que reducirlos a usuarios sin plan; la matriz rol × plan vuelve cuando el catálogo nuevo exista | `U1`, `V2` |
| `F5-U1-050` | ADAPTAR | MEDIA | no lo nombra | 51 archivos de UI fuera de las carpetas del cobro: 23 componentes de web usan `PRICING_PAGE_PATH_BY_AUDIENCE` de `apps/web/src/lib/pricing-plans.ts` (comparador, favoritos, alertas, menú de usuario); `apps/web/src/lib/api/endpoints-protected.ts` importa 5 schemas de `api/billing`; en admin, los `*QualityScore.tsx`, las secciones de alojamiento y `$id_.faqs`/`$id_.reviews`/`new.tsx` usan `useMyEntitlements`, `PlanEntitlementGate` y `PlanLimitGate`; `platform/email/logs.tsx` y `platform/ops/webhooks.tsx` usan `features/billing-notification-logs` y `features/billing-webhook-events` | cada uno hay que editarlo para que el build siga verde; el de `logs.tsx` depende de `F5-U1-042` | `U1` |
| `F5-U1-051` | ADAPTAR | BAJA | no lo nombra | 169 archivos de test fuera de la lista importan algo de ella (`cut -f1 OUT.tsv`, filtrado a tests) | tests de módulos que sobreviven y mockean el cobro: se editan o se borran con su sujeto | `U1` |
| `F5-U1-052` | CONFIRMA | BAJA | `16-` §4.6, *«qué deja demostrado»*: sale la rama del archivo de planes en `scripts/check-seed-dual-write.sh` y la mención en el `CLAUDE.md` raíz (caso 42) | la rama existe en `scripts/check-seed-dual-write.sh:272`, `:278` y la regla en `CLAUDE.md` (sección *Common Gotchas*, «Seed dual-write rule»). Además, y sin nombrar en el diseño, el cableado de los guards de `F5-U1-018`: `package.json:50`, `:54`, `:55`, `:59`, `:68`, `:69`, `:71` y `.github/workflows/ci.yml:305`, `:313`, `:319`; y la allowlist de `qzpay` en `pnpm-workspace.yaml:395-399` | lo nombrado existe como el diseño dice; lo no nombrado es mecánico | `U1` |
| `F5-U1-053` | FALTA | MEDIA | `16-` §4.6 no nombra variables de entorno (búsqueda A1) | 7 de Mercado Pago en `packages/config/src/env-registry.hospeda.ts:445-539` (`ACCESS_TOKEN`, `WEBHOOK_SECRET`, `SANDBOX`, `TIMEOUT`, `PLATFORM_ID`, `INTEGRATOR_ID`, `STATEMENT_DESCRIPTOR`) y 4 de rate limit del cobro en `env-registry.api-config.ts:974-1020` | las de `F5-U1-021` son sólo del viejo; éstas once no: el adaptador nuevo (`B1`) usa el mismo proveedor, y la de `STATEMENT_DESCRIPTOR` no tiene sujeto en preapprovals (`CLAUDE.md` raíz, HOS-171). El diseño no dice cuáles borra `U1` y cuáles hereda `B1`; y cada cambio del registro pide la acción en Coolify (`CLAUDE.md` raíz). Hay que escribirlo | `U1`, `B1` |
| `F5-U1-054` | FALTA | MEDIA | `16-` §4.6 habla de *«el esquema de las tablas viejas»*; el paso 6 deja el carril de extras fuera del reemplazo (FASE 9 vuelta 3, F-8V3A3-003); §4.6 no menciona extras (búsqueda A4) | los 18 extras de `F5-U1-010` se re-aplican en cada despliegue con `db:apply-extras`; `004-billing.constraints.sql` y los índices (`031`, `036`, `041`, …) hacen `ALTER TABLE`/`CREATE INDEX` sobre tablas que el paso 3 borra | si `U1` no los borra, el `db:apply-extras` del paso 3 falla contra tablas que ya no existen, después del `db:migrate`. El diseño tiene que nombrarlos en la limpieza | `U1` |
| `F5-U1-055` | CONTRADICE | MEDIA | `V/20` §2 (`G8`): la lista de pendientes tiene la historia de migraciones como `packages/db/src/migrations/**`, y el paso 6 la saca; `16-` §4.2 paso 6: el carril de extras queda **fuera** del reemplazo | dos extras que no son del cobro nombran la palabra de `G8`: `packages/db/src/migrations/extras/032-commerce-media.constraints.sql` (en el nombre del archivo y en `:2`, `:21-22`) y `033-content-media.constraints.sql:10`; sólo en comentarios y en el nombre, ningún objeto de la base | el glob de la lista cubre `extras/`, así que `G8` no los ve hasta el paso 6; el paso 6 saca la entrada y deja los extras, y desde ahí un build de producción falla por ellos. `U1` los puede reescribir sin riesgo (el nombre del archivo no es un objeto de la base) y la lista tendría que excluir `extras/` | `U1` y `V/20` §2 |
| `F5-U1-056` | CONFIRMA | BAJA | `16-` §4.6 punto 2: *«unos 1229 archivos versionados y 326 rutas con la palabra en el nombre»* | sobre `35e2d63e81`, sin distinguir mayúsculas: **1502** archivos la nombran en el contenido, **332** rutas en el nombre, **1507** en la unión; 17 895 apariciones. Fuera de las dos historias (166) y de lo que ya borra la sección 1 (323), **`U1` tiene que reescribir 1018 archivos**: 285 de `apps/web`, 264 de `apps/api`, 92 de `service-core`, 84 de `schemas`, 68 de `.specs`, 66 de admin, 52 de `seed`, 32 de `i18n`, el `CLAUDE.md` raíz (23 veces) y el resto | el orden de magnitud confirma; la diferencia con 1229 es de alcance (esa medición contó otro conjunto) y no cambia la unidad | `U1` |
| `F5-U1-057` | CONFIRMA | BAJA | `16-` §4.6 punto 1: `qzpay` en los cinco `package.json` de `apps/api`, `apps/admin`, `packages/billing`, `packages/db` y `packages/service-core`; y el borrado del esquema genera la migración que saca las tablas (lo derivé del guard de drift) | los cinco y sólo esos: `apps/admin/package.json:34-35` (`-core`, `-react`), `apps/api/package.json:37-39` (`-core`, `-hono`, `-mercadopago`), `packages/billing/package.json:25-26`, `packages/db/package.json:56-57` (`-core`, `-drizzle`), `packages/service-core/package.json:34`; las tablas de `qzpay` entran al esquema de Drizzle sólo por `qzpaySchema` (`packages/db/src/client.ts:16-18`) | sacar la dependencia saca las tablas del esquema, y `db:generate` produce el `DROP` que el diseño espera | `U1` |
| `F5-U1-058` | ADAPTAR | MEDIA | `16-` §4.6 punto 1: *«todo lo que sólo el sistema viejo usa»* | los 14 enums del cobro de `packages/schemas/src/enums/` (`subscription-status`, `payment-status`, `refund-status`, `invoice-status`, `billing-interval`, `partner-subscription-status`, `partner-payment-review-state`, con su `.schema.ts`) los usan fuera: `apps/web/src/lib/commerce/listing-card-state.ts`, `packages/schemas/src/common/commerce-owner-listing.schema.ts`, `packages/db/scripts/generate-enum-migrations.ts`, `packages/db/src/schemas/enums.dbschema.ts` (que además declara los `pgEnum` de la base) y los de Partner (`F5-U1-044`) | un enum de la base que se borra es también un `DROP TYPE` en la migración; va en el mismo cambio | `U1` |

## Búsquedas de ausencia

- **B-0 · el conteo del resumen**: `rg -o '^\| .F5-U1-0[0-9]+. \| (DELETE|CONFIRMA|CONTRADICE|ADAPTAR|FALTA)' 05-lo-que-borra-u1.md | awk '{print $4}' | sort | uniq -c`
  → 9 ADAPTAR, 4 CONFIRMA, 6 CONTRADICE, 3 FALTA (secciones 2 y 3); más las filas `DELETE` de la
  sección 1, que no llevan columna de categoría: `rg -c '^\| .F5-U1-0(0[0-9]|1[0-9]|20). \|'` → 20
  grupos, y `F5-U1-021` (variables) aparte, 21. Las sumas de la tabla de la sección 1 (742 + 740 =
  1482) salen de `awk -F'|'` sobre sus columnas.
- **A1 · el diseño no nombra variables de entorno del cobro**:
  `rg -c "HOSPEDA_MERCADO_PAGO|HOSPEDA_BILLING_|QZPAY_TEST_CONTROL" 16-fase-7-del-paraguas.md HOS-1354-… HOS-1353-…`
  → 0 archivos. Control positivo: `rg -l "HOSPEDA_" .specs` → 84 archivos (el patrón encuentra
  variables cuando están). Y `rg -n -i "variables? de entorno" 16-fase-7-del-paraguas.md` → una sola
  línea (`:516`), que no es de `U1`.
- **A2 · el diseño no nombra las otras columnas del cobro**:
  `rg -l "service_suspended|owner_promotions|has_active_subscription|payment_confirmed_through|subscription_status"`
  sobre `16-`, el núcleo, `V` y `B` → dos archivos: `V/02:749` (`owner_promotions` como contenido que
  se borra con la ficha, no como columna) y `V/21:209` (`has_active_subscription`, para decir que no se
  traduce). Control positivo: `owner_suspended` aparece en los mismos dos archivos.
- **A3 · `billing_notification_log` como log general**: `rg -l "billing_notification_log|notification_log"`
  sobre las tres carpetas del programa → sólo `08-phase-1b-code-discovery.md` (`:399`, `:3230`,
  `:5556`), que la describe y no la excluye. Control positivo: `billing_*` aparece en `B/21` §4.
- **A4 · §4.6 no menciona los extras**: `sed -n '594,640p' 16-fase-7-del-paraguas.md | rg -c extras` → 0;
  control: `rg -c extras 16-fase-7-del-paraguas.md` → 1 (el paso 6).
- **A5 · las carpetas del programa no están en `origin/staging`**: `rg '^\.specs/HOS-135[234]' commerce-any.txt`
  → 0; control: la misma lista tiene 68 archivos de otras carpetas de `.specs/`.
- **A6 · ninguna unidad de `V` reemplaza los gates por nombre**:
  `rg -n "requireEntitlement|requireLiveSubscription|entitlementMiddleware|commerceVerticalEntitlementMiddleware" HOS-1352… HOS-1353… HOS-1354…`
  → sólo `08-phase-1b-code-discovery.md` y un par de menciones en `30-revision-del-owner/01-` y en
  `25-fase-8-completa/C2-…`; ninguna en `V/descomposicion.md` ni en `16-` §4.6. Control positivo: el
  patrón encuentra las 79 ocurrencias en el código.
- **A7 · el grafo encuentra a los importadores de `@repo/billing` fuera del cobro**: control positivo,
  `apps/web/src/components/host/PropertyCard.astro` importa `OWNER_TRIAL_DAYS` de `@repo/billing` y el
  grafo lo resuelve a `packages/billing/src/constants/billing.constants.ts`.

Los scripts (`graph.mjs`, `sets.mjs`, `groups.mjs`) y las listas (`DEL.txt`, `OUT.tsv`,
`out-dbtables.tsv`, `b-all-src.txt`, `commerce-any.txt`) quedaron en el scratchpad de la sesión,
fuera del repositorio.

## Lo que no pude cerrar

- **El tipo de cambio** (`exchange-rate-fetch`, `services/exchange-rate/**`, sus tablas y dos
  variables): el `CLAUDE.md` raíz lo lista entre los crons del cobro, pero no importa `qzpay` ni
  `@repo/billing`. No lo clasifiqué; si el cobro nuevo cobra sólo en ARS, es del viejo.
- **Los crons de Partner** `partner-expiry` y `partner-unpaid-reaper`: no son del cobro puro, dependen
  de columnas de pago de `partners`. Quedan con `F5-U1-044`.
- **Las rutas de rate limit del cobro** (`API_RATE_LIMIT_BILLING_*`): si las rutas nuevas de billing
  las reusan o no, no está escrito.
- **`apps/api/src/services/admin-billing-view.service.ts`** y **`admin-billing-view.status.ts`**
  quedaron fuera de la lista de la sección 1 por la regla de nombre y dentro de K6; son del cobro y
  suman 2 archivos al DELETE.
- **La frontera por nombre**: la sección 1 es una heurística con poda a mano. Una unidad que la
  ejecute debería partir de `DEL.txt` y del grafo, no de las carpetas.
- **Si la palabra de `G8` aparece en valores de la base fuera de lo que `V/21` §4 lista** (rol, siete
  permisos, tabla de contactos, tipo de partner): en el esquema no hay tablas, columnas, enums ni
  índices con la palabra en el nombre (`rg "pgTable\('…commerce…'"` y equivalentes → 0), y
  `permission.enum.ts:1004-1022` confirma los siete permisos más la categoría `COMMERCE` (`:77`).
  Los valores guardados en filas no los leí.
