# HOS-2410 inventory part D: account-wide

Generated 2026-11-20 from branch `spec/HOS-2410-docs` @ 7e71508cce (cut from origin/staging).

Paths are relative to the repo root. Abbreviations: P = `apps/web/src/pages/[lang]/mi-cuenta/`,
I18N = `packages/i18n/src/locales/es/`. Content rule: describe mechanics, never prices, plan names or
limit numbers (those are DB rows).

**155 rows in scope, 62 rows out of scope, 30 proposed articles.**

## 0. Counts

| Set | Count | Command |
|---|---|---|
| `.astro` under mi-cuenta | 77 | `fd -e astro . 'apps/web/src/pages/[lang]/mi-cuenta' \| wc -l` |
| in part D | 16 | `page:mi-cuenta/*` rows in §1.A |
| out of scope (tourist and editorial) | 15 | §2 |
| left to parts A–C | 46 | 77−16−15 |
| `SUBSCRIPTION_STATUSES` | 9 | `packages/db/src/schemas/vertical/subscription.dbschema.ts:22-32` |
| `TrialStatusEnum` | 3 | `packages/schemas/src/enums/trial-status.enum.ts:14-18` |
| MCP tools | 22 | `apps/api/src/mcp/tools/registry.ts:33-55` |
| `billing.*` outbox templates | 33 for owners + 7 for admins | `rg -n "'billing\.[a-z-]+'" packages/notifications/src/services/outbox` |
| crons | 57 (17 visible to owners) | `apps/api/src/cron/schedules.manifest.ts` |

## 1. Inventory (in scope)

Audiences: H=host, V=venue, E=experience, Pr=provider, Pa=partner.

### 1.A Pages and sections

| anchor | kind | aud | what the owner sees | source | article | exempt |
|---|---|---|---|---|---|---|
| page:mi-cuenta | page | H,V,E,Pr,Pa | «Mi Cuenta»: name, email, stats cards (the subscription card always shows) and nav cards by role. It opens the welcome tour and then the What's New highlights | P index.astro:48-54,85-164,218-222 | account-home | |
| page:mi-cuenta/suscripcion | page | H,V,E | «Suscripción»: «Tus suscripciones» cards, trial summary per vertical, promo redemption on an active trial, «Ver complementos disponibles» link, Mercado Pago return banner | P suscripcion/index.astro:96-130 | subscription-status | |
| file:apps/web/src/components/account/MySubscriptions.astro | section | H,V,E | Per-subscription card: plan, vertical, status, next charge, and Pausar / Cambiar de plan / Dar de baja / promo depending on the status | MySubscriptions.astro:38-85 | subscription-status | |
| file:apps/web/src/lib/billing/subscription-return.ts | section | H,V,E | Return from Mercado Pago: confirmed, processing (polls ~30 s), still processing, rejected (with retry), closed, unknown | subscription-return.ts:20-25,62-83; I18N billing.json:304 | how-subscription-works | |
| page:suscriptores/checkout (no gate) | page | H,V,E | «Confirmá tu suscripción»: plan summary and cycle, «¿Con qué email entrás a Mercado Pago?» (prefilled with the account email), «Ir a pagar con Mercado Pago». Notices for paused signups, tourist VIP and trial | suscriptores/checkout/index.astro:4-6; apps/web/src/lib/billing/signup-checkout.ts:200-213; I18N billing.json:232-303 | how-subscription-works | |
| page:suscriptores/planes (no gate) | page | H,V,E,Pa | Plans index by audience | suscriptores/planes/index.astro:4,73 | choose-plan | |
| page:planes/anfitriones (no gate) | page | H | Accommodation sales page | planes/anfitriones/index.astro:4-9 | choose-plan | |
| page:planes/anfitriones/precios (no gate) | page | H | Prices read from the DB catalog; the CTA depends on the user's situation | planes/anfitriones/precios/index.astro:4-9; apps/web/src/lib/billing/pricing-situation.ts:78-123 | choose-plan | |
| page:planes/comer-y-salir (no gate) | page | V | Venue sales page | planes/comer-y-salir/index.astro:4-9 | choose-plan | |
| page:planes/comer-y-salir/precios (no gate) | page | V | Venue prices | planes/comer-y-salir/precios/index.astro:4-9 | choose-plan | |
| page:planes/experiencias (no gate) | page | E | Experience sales page | planes/experiencias/index.astro:4-9 | choose-plan | |
| page:planes/experiencias/precios (no gate) | page | E | Experience prices | planes/experiencias/precios/index.astro:4-10 | choose-plan | |
| page:mi-cuenta/complementos | page | H,V,E | «Comprar complementos»: offers, a target listing or subscription, a summary («Gratis por tu beneficio» when covered), «Confirmar compra» / «Pagar con Mercado Pago», and «Tus destaques recurrentes» with «Dar de baja» | P complementos/index.astro:21-28; I18N billing.json:872 | addons | |
| file:apps/web/src/components/billing/recurring-addons/RecurringAddonWithdrawal.client.tsx | section | H,V,E | Withdrawing a recurring add-on stops the charge, and the featured status turns off the same day, with no refund | P complementos/index.astro:24-27 | addons | |
| file:apps/web/src/components/account/PlanChangeOffer.client.tsx | section | H,V,E | «Cambiar de plan»: options (plan, cycle, price), explanation, payer email, «Confirmar cambio»; blocking reasons shown as text | MySubscriptions.astro:60; I18N account.json:705-755 | change-plan | |
| file:apps/web/src/components/account/SubscriptionCancel.client.tsx | section | H,V,E | «Dar de baja»: preview of the consequences by status, optional reason, «Confirmar la baja» | SubscriptionCancel.client.tsx:51-118; apps/web/src/lib/billing/self-cancel.ts:16-33 | cancel-subscription | |
| file:apps/web/src/components/account/PauseOffer.client.tsx | section | H,V,E | «Pausar suscripción» (months; the listing leaves the site the same day), «Reanudar», and cancelling while paused | MySubscriptions.astro:58,65-67; I18N account.json:655-704 | pause-subscription | |
| file:apps/web/src/components/billing/PendingAttemptPanel.tsx | section | H,V,E | «Tenés un intento de alta pendiente»: resume or cancel, with the deadline | PendingAttemptPanel.tsx:11-60 | pending-authorization | |
| file:apps/web/src/components/account/PromoCodeRedeem.client.tsx | section | H,V,E | «¿Tenés un código promocional?» on an ACTIVE card subscription (not manual payers); «¿…para extender tu prueba?» on a running trial | PromoCodeRedeem.client.tsx:14-61; apps/web/src/lib/billing/promo-redeem.ts:15-24 | promo-codes | |
| file:apps/web/src/components/account/TrialSummary.astro | section | H,V,E | «Tu prueba gratis de {vertical}»: status, days with their origin (plan, promos, support gifts), dates, «Elegí tu plan» | suscripcion/index.astro:51-68,123; I18N account.json:626-650 | free-trial | |
| file:apps/web/src/lib/billing/my-subscription-notices.ts | section | H,V,E | Deferred courtesy («Te quedan N meses, que empiezan a correr cuando completes el pago»); courtesy lost on a cycle change | my-subscription-notices.ts:1-30; MySubscriptions.astro:80-85 | courtesy-and-grants | |
| page:mi-cuenta/promociones | page | H | «Mis promociones»: **listing** promotions for accommodations, which tourists see. Not billing promo codes | P promociones/index.astro:37-43; I18N host.json:866 | owner-promotions | |
| page:mi-cuenta/promociones/nueva | page | H | Title, type (porcentaje, monto fijo, noche gratis, oferta especial), value, dates, max uses, one or all properties, «Exclusiva para plan VIP» | P promociones/nueva.astro:37-43; apps/web/src/components/host/PromotionForm.client.tsx:59-95 | owner-promotions | |
| page:mi-cuenta/promociones/[id]/editar | page | H | Same form in edit mode; delete with confirmation | P promociones/[id]/editar.astro:51-57 | owner-promotions | |
| page:mi-cuenta/asistentes-ia | page | H,V,E,Pr,Pa | «Asistentes de IA»: MCP address with Copiar, steps, connected assistants with Desconectar, history link; paused / unavailable notices | P asistentes-ia/index.astro:37-48; apps/web/src/components/account/AiAssistantsPanel.client.tsx:168-285; I18N account.json:366 | ai-assistants | |
| page:mi-cuenta/asistentes-ia/historial | page | H,V,E,Pr,Pa | What each assistant did over the last 12 months, with filters and paging. Message text is never stored | P asistentes-ia/historial.astro:3-6 | ai-assistants-history | |
| page:mi-cuenta/novedades | page | H,V,E | «Novedades»: list, mark as read, mark all | P novedades/index.astro:3-9,40-52; I18N account.json:2-22 | whats-new | |
| page:mi-cuenta/editar | page | all | «Editar perfil»: name, photo, contact, location, social networks | P editar/index.astro:3-22 | edit-profile | |
| page:mi-cuenta/completar-perfil | page | all | After signup: name, optional phone, locale, newsletter, terms (required) | P completar-perfil/index.astro:3-16; I18N account.json:1160 | edit-profile | |
| page:mi-cuenta/cambiar-contrasena | page | all | Change the password; required on first login for venue/experience accounts created with a generated password | P cambiar-contrasena/index.astro:3-18 | password | |
| page:mi-cuenta/agregar-contrasena | page | all | Add a password after signing up with Google/Facebook, or skip | P agregar-contrasena/index.astro:3-14 | password | |
| page:mi-cuenta/preferencias | page | all | Theme, language, email/SMS/push, newsletter, weekly AI digest, «Repetir tour de bienvenida» | P preferencias/index.astro:13-14,35-43; apps/web/src/components/account/PreferenceToggles.client.tsx:425-520 | notification-preferences | |
| page:mi-cuenta/newsletter | page | all | Status (active, pending verification, not subscribed, invalid email, cancelled), subscribe/cancel, resend confirmation, topics | P newsletter.astro:3-36; I18N account.json:1122-1159 | newsletter | |
| page:mi-cuenta/publica | page | H,V,E | «Publicá en Hospeda»: doors for accommodation, venue and experience, with «Gestionar» when the user already has access | P publica/index.astro:3-9,28-34; apps/web/src/config/discovery-doors.ts:136-164 | publish-hub | |

### 1.B States, classes, situations

| anchor | kind | aud | what the owner sees | source | article |
|---|---|---|---|---|---|
| enum:SubscriptionStatus.PENDING_AUTHORIZATION | state | H,V,E | Waiting for authorization at Mercado Pago, with a deadline | subscription.dbschema.ts:23 | pending-authorization |
| enum:SubscriptionStatus.ABANDONED | state | H,V,E | The window expired; nothing was charged | subscription.dbschema.ts:24; expire-authorization-windows.service.ts:348 | pending-authorization |
| enum:SubscriptionStatus.ACTIVE | state | H,V,E | «Activa» | subscription.dbschema.ts:25; I18N account.json:756 | subscription-status |
| enum:SubscriptionStatus.GRACE_PERIOD | state | H,V,E | «Pago pendiente»: service continues until the grace ends. Changing the card retries the charge. Plan changes and promos are blocked | subscription.dbschema.ts:26; enter-grace.service.ts:122-131 | payment-declined |
| enum:SubscriptionStatus.PAUSED | state | H,V,E | «Pausada»: the listing is off the site and nothing is charged | subscription.dbschema.ts:27 | pause-subscription |
| enum:SubscriptionStatus.SUSPENDED | state | H,V,E | «Suspendida»: unpaid after grace, or a chargeback. To come back you subscribe again (card) or register the payment (manual) | subscription.dbschema.ts:28; arrears-suspension.tsx:7-24 | payment-declined |
| enum:SubscriptionStatus.CANCEL_SCHEDULED | state | H,V,E | «Baja pedida» or «No se renueva» | subscription.dbschema.ts:29; self-cancel.ts:34-78 | cancel-subscription |
| enum:SubscriptionStatus.CANCELLED | state | H,V,E | Final state; not listed | subscription.dbschema.ts:30; subscription-return.ts:77-79 | subscription-status |
| enum:SubscriptionStatus.CHARGE_DECLINED | state | H,V,E | The first charge was declined; nothing was charged; retry | subscription.dbschema.ts:31; suscripcion/index.astro:108-119 | payment-declined |
| file:packages/db/src/schemas/vertical/subscription.dbschema.ts | state | H,V,E | Classes PRINCIPAL / COMPLEMENTO / LAPIDA; only principal rows are listed | subscription.dbschema.ts:33; apps/api/src/routes/billing-subscription/read-mine.ts:8 | subscription-status |
| file:apps/web/src/components/account/SubscriptionCancel.client.tsx#reasons | state | H,V,E | 8 optional cancellation reasons | subscription.dbschema.ts:34-43; I18N account.json:780 | cancel-subscription |
| file:packages/service-core/src/services/billing/subscription/request-plan-change.service.ts | state | H,V,E | A plan change can end in: a succession checkout, a downgrade queued for the cycle end, or a regret. Rejections: NO_CHANGE, GRACE_PERIOD, SCHEDULED_CHANGE_EXISTS, NOT_ACTIVE, MIGRATION_CHANGE_QUEUED, CYCLE_END_PENDING, KEEP_SELECTION_INVALID, CHANGE_WINDOW_TOO_SHORT | request-plan-change.service.ts:44-80,137-175 | change-plan |
| enum:TrialStatus.TRIAL_ACTIVE | state | H,V,E | Days left and the end date | trial-status.enum.ts:15 | free-trial |
| enum:TrialStatus.TRIAL_EXPIRED | state | H,V,E | The listing stops being shown; «Elegí un plan» | trial-status.enum.ts:16; packages/verticals/src/trial/trial-expiry.ts:24-60 | trial-ending |
| enum:TrialStatus.TRIAL_CONVERTED | state | H,V,E | A paid plan took over; a trial is also born consumed if the first payment arrives before any trial | trial-status.enum.ts:17; trial-conversion.ts:18-45; trial-consume.ts:27-60 | free-trial |
| file:packages/verticals/src/trial/trial-extension.ts | state | H,V,E | Extending a trial with a promo; refusals NO_TRIAL, TRIAL_ENDED, CEILING_REACHED, REDEMPTION_KEY_CONFLICT | trial-extension.ts:24-30; promo-redeem.ts:26-42 | promo-codes |
| enum:PricingSituation.FIRST_USE | state | H,V,E | Has never published: the CTA leads to publishing (which starts the trial) | packages/schemas/src/api/billing/pricing-situation.schema.ts:9-13; pricing-situation.ts:98-111 | choose-plan |
| enum:PricingSituation.TRIAL | state | H,V,E | Running trial: the CTA leads to checkout | pricing-situation.schema.ts:15-19 | choose-plan |
| enum:PricingSituation.CHECKOUT | state | H,V,E | Checkout allowed | pricing-situation.schema.ts:21-24 | choose-plan |
| enum:PricingSituation.SUBSCRIBED | state | H,V,E | «Plan actual» badge; change options only when ACTIVE | pricing-situation.schema.ts:26-41 | choose-plan |
| enum:PricingSituation.COVERED | state | H,V,E | Covered by benefits; no CTA | pricing-situation.schema.ts:43-46 | choose-plan |
| enum:PricingSituation.NO_PLANS | state | H,V,E | No plan for sale | pricing-situation.schema.ts:47-51 | choose-plan |
| enum:PricingSituation.TOURIST_VIP_INHERITED | state | H,V,E | A paid plan elsewhere already gives the traveller benefits; buying them again is blocked | pricing-situation.schema.ts:52-55 | tourist-vip-included |
| activation:accommodation / venue / experience | activation | H,V,E | The trial starts on the first publish | packages/schemas/src/catalog/vertical-activation-event.ts:44-46 | free-trial |

### 1.C Account-wide entitlements and limits

| anchor | kind | aud | what the owner sees | source | article | exempt |
|---|---|---|---|---|---|---|
| entitlement:subscribe_to_plan | entitlement | H,V,E | Base capability (floor plan); never shown | key-enums.ts:60; plan-publication.validation.ts:96,171 | how-subscription-works | |
| entitlement:activate_trial | entitlement | H,V,E | Trial floor | key-enums.ts:61 | free-trial | UNVERIFIED: no runtime consumer |
| entitlement:recover_own_listing | entitlement | H,V,E | Export or reactivate a listing after the plan lapsed | key-enums.ts:59; packages/verticals/src/authorization/listing-operation.ts:91,110-112 | trial-ending | |
| entitlement:create_promotions | entitlement | H,V | Without it: «Tu plan no incluye promociones» | key-enums.ts:15; apps/api/src/routes/owner-promotion/protected/create.ts:45 | owner-promotions | |
| limit:max_active_promotions | limit | H,V | «Alcanzaste el límite de promociones activas» | key-enums.ts:71; create.ts:55 | owner-promotions | |
| entitlement:featured_listing | entitlement | H,V,E | Featured status, written only by the sync; there is no owner toggle (HOS-929) | key-enums.ts:13; packages/verticals/src/featured/sync-listing-featured.ts:61,83 | addons | |
| entitlement:priority_support / custom_branding / has_verification_badge | entitlement | H,V,E | Comparison rows only | key-enums.ts:12,14,22; plan-comparison-rows.ts:271,288,294 | plan-includes | UNVERIFIED: no gate |
| entitlement:view_basic_stats | entitlement | H,V,E | Dashboard and inquiry metrics | key-enums.ts:9; apps/api/src/routes/host/protected/dashboard.ts:7,200 | plan-includes | |
| entitlement:view_advanced_stats | entitlement | H | Market comparison, favorites breakdown, MCP stats | key-enums.ts:10; apps/api/src/mcp/tools/listing/stats-entitlement.ts:7 | plan-includes | |
| entitlement:multi_property_management / consolidated_analytics / centralized_booking / staff_management / ai_support | entitlement | H | Catalog only | key-enums.ts:33-36,53 | plan-includes | UNVERIFIED: no consumer |
| limit:max_staff_accounts | limit | H | Plan-card delta row only | key-enums.ts:76; plan-card-delta.ts:61 | plan-limit-reached | |
| limit:max_ai_support_per_month | limit | H,V,E | Catalog only | key-enums.ts:85 | plan-limit-reached | UNVERIFIED |

### 1.D MCP tools

All 22 are in `registry.ts:33-55`. Part D groups them in `ai-assistant-tools`; parts A–C propose per-feature homes. **The merge must pick one home per anchor (gap 7).**
`get_my_plan` (`apps/api/src/mcp/tools/plan/get-my-plan.ts:35-40`) is read-only and reports COURTESY, PERMANENT_GRANT and TRIAL. It cannot change the plan.
`AiAssistantsPanel.client.tsx:168-285` handles connecting, disconnecting and the notices (article `ai-assistants`).

### 1.E Emails visible to the owner

The `billing.*` entries are outbox template ids, not `NotificationType` values (gap 1). Registry: `packages/notifications/src/services/outbox/billing-signup-renderers.tsx:32-54`. Templates: `packages/notifications/src/templates/billing/*.tsx`.

| anchor | aud | subject / trigger | source | article |
|---|---|---|---|---|
| email:billing.signup-confirmed | H,V,E | «Tu suscripción está activa» | signup-confirmed.tsx:1-25 | how-subscription-works |
| email:billing.renewal-upcoming | H,V,E | «Tu suscripción se renueva pronto». Two notices before each charge (deadline key 13); "pagá antes" for manual payers | renewal-upcoming.tsx:15; billing-renewal-renderers.tsx:34,50; packages/schemas/src/catalog/billing-deadlines.schema.ts:21 | how-subscription-works |
| email:billing.payment-credited | H,V,E | «Recibimos tu pago»: amount, receipt number, «comprobante no fiscal, no es una factura» | payment-credited.tsx:6,32 | receipts-refunds |
| email:billing.late-payment-refunded | H,V,E | «Te devolvimos un pago que llegó tarde» | I18N notifications.json:50; billing-late-payment-refund-renderers.tsx:43 | receipts-refunds |
| email:billing.revocation-cancel | H,V,E | «Registramos la revocación de tu suscripción» | revocation-cancel.tsx:6 | receipts-refunds |
| email:billing.grace-started | H,V,E | «No pudimos cobrar tu suscripción» | grace-started.tsx:7-30 | payment-declined |
| email:billing.grace-reminder | H,V,E | «Tu suscripción sigue en período de gracia» (deadline key 20) | grace-reminder.tsx:7-30; grace-reminder-notice.ts:110 | payment-declined |
| email:billing.arrears-suspension | H,V,E | «Tu suscripción se suspendió»: recurring add-ons pause and the promo is lost | arrears-suspension.tsx:7-24 | payment-declined |
| email:billing.signup-declined | H,V,E | «No pudimos cobrar el primer pago de tu suscripción» | signup-declined.tsx:11-30 | payment-declined |
| email:billing.first-charge-declined-cancel | H,V,E | «Cancelamos la autorización de cobro de tu alta» | first-charge-declined-cancel.tsx:6 | payment-declined |
| email:billing.chargeback-suspension | H,V,E | «Suspendimos tu suscripción por un desconocimiento del cargo» | chargeback-suspension.tsx:7-40 | payment-declined |
| email:billing.before-cancel | H,V,E | «Tu autorización pendiente venció» | signup-before-cancel.tsx; billing-signup-renderers.tsx:108 | pending-authorization |
| email:billing.signup-incomplete | H,V,E | «Tu alta quedó sin completarse» | billing-signup-renderers.tsx:260 | pending-authorization |
| email:billing.attempt-replaced-cancel | H,V,E | «Reemplazamos tu intento anterior» | attempt-replaced-cancel.tsx; billing-signup-renderers.tsx:116 | pending-authorization |
| email:billing.attempt-cancelled-cancel | H,V,E | «Cancelamos tu intento pendiente» | attempt-cancelled-cancel.tsx; billing-signup-renderers.tsx:126 | pending-authorization |
| email:billing.closed-subscription-authorization-cancel | H,V,E | «Cancelamos una autorización de cobro que seguía activa» | closed-subscription-authorization-cancel.tsx:6 | pending-authorization |
| email:billing.scheduled-cancellation | H,V,E | «Cancelamos el cobro automático de tu suscripción» | scheduled-cancellation.tsx:6 | cancel-subscription |
| email:billing.direct-cancellation | H,V,E | «Tu suscripción quedó cancelada» | direct-cancellation.tsx:6 | cancel-subscription |
| email:billing.paid-after-cancellation | H,V,E | «Tu pago entró, pero tu suscripción no se renueva» | paid-after-cancellation.tsx:7-30 | cancel-subscription |
| email:billing.succession-predecessor-cancel | H,V,E | «Tu cambio de plan ya está activo» | succession-predecessor-cancel.tsx:6 | change-plan |
| email:billing.successor-cut-cancel | H,V,E | «Cortamos el cambio de plan que tenías en curso» | successor-cut-cancel.tsx:6 | change-plan |
| email:billing.promo-ending | H,V,E | «Tu promo termina» (key 14) | promo-ending.tsx:14; promo-ending-notice.ts:41 | promo-codes |
| email:billing.courtesy-revoked | H,V,E | «Tu cortesía terminó» | courtesy-revoked.tsx:7 | courtesy-and-grants |
| email:billing.permanent-grant-cancel | H,V,E | «Tu suscripción ya no se cobra» | permanent-grant-cancel.tsx:6 | courtesy-and-grants |
| email:billing.permanent-grant-addon-cancel | H,V,E | «Tu addon ya no se cobra» | permanent-grant-addon-cancel.tsx:6 | courtesy-and-grants |
| email:billing.addon-cancelled | H,V,E | «Cancelamos el cobro de tu addon» | addon-cancelled.tsx:6 | addons |
| email:billing.addon-authorization-expired-cancel | H,V,E | «Venció la autorización de tu addon» | addon-authorization-expired.tsx:6 | addons |
| email:billing.addon-listing-purged-cancel | H,V,E | «Cancelamos el cobro del addon de una ficha que borraste» | billing-addon-renderers.tsx:14,20 | addons |
| email:billing.tourist-vip-inherited-cancel | H,V,E | «Cancelamos tu suscripción a Turista VIP»; no refund | tourist-vip-inherited-cancel.tsx:6 | tourist-vip-included |
| email:billing.plan-migration-announced | H,V,E | «Tu plan deja de venderse» / «Cambia el precio de tu plan» (keys 11/12) | plan-migration-announced.tsx:23-26; billing-deadlines.schema.ts:13-20,36-53 | plan-retirement |
| email:billing.plan-migration-upcoming | H,V,E | «Se acerca el cambio de tu plan» | plan-migration-upcoming.tsx:23-25 | plan-retirement |
| email:billing.plan-migration-cancelled | H,V,E | «Cancelamos el cambio de tu plan» | plan-migration-cancelled.tsx:20 | plan-retirement |
| email:billing.manual-installment-opened | H,V,E,Pa | Manual installment opened | billing-manual-installment-opened-renderers.tsx:50-61 | billing-emails |
| email:trial_ending_10d / 5d / 2d / today | H,V,E | Trial series before the end | notification.types.ts:36,38; templates/trial/trial-ending-*.tsx | trial-ending |
| email:trial_win_back_1d / 5d / 15d / 30d / 60d | H,V,E | Win-back series; the last one says the listing stays saved | templates/trial/trial-win-back-*.tsx; trial-campaign-renderers.tsx:87-90; packages/verticals/src/trial/trial-deadlines.ts:18 | trial-ending |
| email:ai_questions_weekly_digest | H,V,E | Mondays; skipped on an empty week or when the owner opted out | apps/api/src/cron/jobs/ai-questions-weekly-digest.job.ts:1-18 | notification-preferences |
| email:newsletter_verification / welcome / campaign | all | Double opt-in (the verification email is transactional) | packages/notifications/src/config/notification-categories.ts:78,81,82 | newsletter |

### 1.F Crons visible to the owner

The cadences come from the manifest. Durations are DB values and are never written into an article.

| anchor | what the owner sees | source | article |
|---|---|---|---|
| cron:subscription-grace-reminder | Daily at 09:00: grace reminders | schedules.manifest.ts:52-56 | payment-declined |
| cron:subscription-renewal-notice | Daily at 09:00: renewal notices | schedules.manifest.ts:205-210 | how-subscription-works |
| cron:billing-promo-ending-notice | Daily at 09:00: notice before the promo ends | schedules.manifest.ts:197-202 | promo-codes |
| cron:trial-machine-expiry | Every 15 min: expires trials | schedules.manifest.ts:130-135 | trial-ending |
| cron:subscription-window-expiry | Every 15 min: PENDING_AUTHORIZATION → ABANDONED | schedules.manifest.ts:138-143 | pending-authorization |
| cron:payment-window-expiry | Hourly: one-time add-on payments that expired | schedules.manifest.ts:146-151 | addons |
| cron:subscription-service-end | Every 15 min: ends scheduled cancellations | schedules.manifest.ts:189-194 | cancel-subscription |
| cron:subscription-pause-end | Hourly: resumes pauses that are due | schedules.manifest.ts:168-173 | pause-subscription |
| cron:subscription-scheduled-change | Hourly: applies queued downgrades | schedules.manifest.ts:175-180 | change-plan |
| cron:subscription-succession-reevaluation | Hourly: retries cancelling the previous subscription | schedules.manifest.ts:182-187 | change-plan |
| cron:plan-migration-notice | Daily at 09:17: reminders | schedules.manifest.ts:213-218 | plan-retirement |
| cron:plan-migration-application | Hourly: applies migrations | schedules.manifest.ts:220-225 | plan-retirement |
| cron:manual-installment-open | Hourly | schedules.manifest.ts:154-158 | billing-emails |
| cron:manual-grace-expiry | Hourly | schedules.manifest.ts:161-165 | billing-emails |
| cron:ai-questions-weekly-digest | Mondays at 09:00 | schedules.manifest.ts:349-354 | notification-preferences |
| cron:mcp-audit-retention | Daily at 04:20: assistant history older than 12 months is deleted | apps/api/src/cron/jobs/mcp-audit-retention.job.ts:1-8 | ai-assistants-history |
| cron:archive-expired-promotions | Hourly: archives expired promotions | schedules.manifest.ts:259-263 | owner-promotions |

## 2. Out of scope

| anchor | reason | source |
|---|---|---|
| page:mi-cuenta/alertas, favoritos, favoritos/colecciones/[id], historial-busquedas, recomendaciones, resenas, ofertas-exclusivas | tourist | P (each index.astro, lines 3-17) |
| page:mi-cuenta/consultas, consultas/[conversationId] | guest inbox; the owner's is `consultas-propietario/` (part A) | P consultas/index.astro:3-6 |
| page:mi-cuenta/eventos, eventos/nuevo, eventos/[id]/editar | editorial, gated by EVENT_CREATE (not the venue "eventos" section) | P eventos/index.astro:3-30; apps/web/src/lib/nav-gating.ts:270 |
| page:mi-cuenta/publicaciones, publicaciones/nuevo, publicaciones/[id]/editar | editorial (POST_CREATE) | P publicaciones/index.astro:3-25; nav-gating.ts:249 |
| page:planes/turistas, planes/turistas/precios | tourist | apps/web/src/pages/[lang]/planes/turistas/** |
| activation:tourist | no-user-surface: `start_button_pressed` has no producer | vertical-activation-event.ts:47,51-90 |
| activation:partner | no-user-surface: null; partner signup is manual (`partnerManualOnly`) | vertical-activation-event.ts:48 |
| suscriptores/planes/* redirects | no-user-surface: 301s | suscriptores/propietarios/index.astro:39 |
| tourist keys (save_favorites, write_reviews, …, ai_search) and their limits | out-of-scope: tourist | key-enums.ts:37-49,52,73-75,77-78,81,84 |
| partner_public_page, partner_carousel_presence | part C | key-enums.ts:57-58 |
| vertical-specific editor keys | parts A–C | key-enums.ts (several) |
| admin emails | no-user-surface | notification-categories.ts:40-52 |
| ~22 legacy `NotificationType` values with no sender | no-user-surface: never sent; no article may promise them (gaps 2 and 3) | notification.types.ts:5-63,83-146 |
| owner emails from other parts | parts A–C | notification.types.ts:146-308 |
| internal crons and crons of other parts | no-user-surface / parts A–C | schedules.manifest.ts (several) |

## 8. Proposed articles (part D)

The ids marked † are existing ones.

| id | title | summary | audiences | public | covers | entryFor | related | key facts and "qué NO esperar" |
|---|---|---|---|---|---|---|---|---|
| how-subscription-works | Cómo se cobra tu suscripción | Pagás con Mercado Pago, con un correo que declarás vos, y te avisamos antes de cada renovación. | host, venue, experience | true | subscribe_to_plan, signup-confirmed, renewal-upcoming, renewal cron, subscription-return.ts | page:suscriptores/checkout | choose-plan, subscription-status, pending-authorization, payment-declined, receipts-refunds, change-plan, free-trial | Elegís plan y frecuencia, declarás tu correo de Mercado Pago y pagás en su checkout. NO esperar: que Hospeda confirme ese correo (si no coincide, el pago se rechaza sin cobrar) ni una prueba de Mercado Pago. |
| choose-plan | Elegir un plan y ver qué incluye | Las páginas de planes muestran los valores vigentes y adaptan el botón a tu situación. | host, venue, experience | true | PricingSituation.* (6) | planes/* (7 pages) | how-subscription-works, plan-includes, free-trial, change-plan, plan-limit-reached, tourist-vip-included | Los importes salen del catálogo en vivo. Si todavía no publicaste, el botón te lleva a publicar. |
| change-plan † | Cambiar de plan | Subir, bajar o cambiar la frecuencia: cuándo rige el cambio y por qué a veces no se puede. | host, venue, experience | false | request-plan-change, PlanChangeOffer, succession emails, scheduled-change and succession crons | — | subscription-status, how-subscription-works, pending-authorization, payment-declined, promo-codes, cancel-subscription, plan-limit-reached | Subir o cambiar la frecuencia pasa por un checkout nuevo. Bajar se programa para el cierre del ciclo y elegís qué fichas conservar. NO esperar: cambiar de plan con un pago pendiente, en pausa o con otro cambio programado. Al cambiar perdés la promo. |
| cancel-subscription | Dar de baja la suscripción | Cortás el cobro y seguís con el servicio hasta el final del período pago. | host, venue, experience | false | CANCEL_SCHEDULED, reasons, SubscriptionCancel, emails de baja, service-end cron | — | subscription-status, pause-subscription, payment-declined, addons, receipts-refunds, courtesy-and-grants | Con pago pendiente o suspendida, la baja rige hoy. NO esperar: reembolso, ni que los complementos recurrentes se reanuden solos. |
| payment-declined | Qué pasa si falla un cobro | Gracia, avisos y, si no se regulariza, suspensión. | host, venue, experience | false | GRACE_PERIOD, SUSPENDED, CHARGE_DECLINED, emails de gracia, suspensión y rechazo, grace-reminder cron | — | subscription-status, how-subscription-works, change-plan, cancel-subscription, pause-subscription, receipts-refunds | Si cambiás la tarjeta en Mercado Pago, el cobro se reintenta al instante. Si falla el primer cobro, no se cobró nada. NO esperar: cambiar de plan ni canjear una promo con un pago pendiente. |
| subscription-status | Qué ves en Suscripción y qué significa cada estado | Cada tarjeta muestra plan, estado, próximo cobro y acciones. | host, venue, experience | false | ACTIVE, CANCELLED, MySubscriptions, clases | page:mi-cuenta/suscripcion | pending-authorization, payment-declined, pause-subscription, cancel-subscription, change-plan, free-trial, courtesy-and-grants, how-subscription-works | Los nueve estados con el texto que muestra el sitio, cada uno con link a su guía. NO esperar: ver acá las cortesías en curso ni el acceso permanente. |
| pause-subscription | Pausar y reanudar la suscripción | Pausás por meses, tu ficha sale del sitio y volvés cuando quieras. | host, venue, experience | false | PAUSED, PauseOffer, pause-end cron | — | subscription-status, cancel-subscription, change-plan, addons, payment-declined | La ficha no se archiva. NO esperar: pausar si pagás de forma manual, en planes no mensuales o con una cortesía vigente. |
| pending-authorization | Completar un pago que quedó pendiente | Tenés un plazo para retomar el pago o cancelar el intento. | host, venue, experience | false | PENDING_AUTHORIZATION, ABANDONED, PendingAttemptPanel, 5 emails, window-expiry cron | — | subscription-status, how-subscription-works, payment-declined, change-plan, cancel-subscription | Si el plazo vence, no se cobra nada. Mercado Pago puede mandar su propio correo. |
| free-trial | Cómo funciona la prueba gratis | Empieza al publicar tu primera ficha, no pide tarjeta y es de Hospeda. | host, venue, experience | true | activations, TRIAL_ACTIVE, TRIAL_CONVERTED, activate_trial, TrialSummary | — | trial-ending, promo-codes, choose-plan, how-subscription-works, subscription-status, publish-requirements | Una prueba por persona y vertical, y una por correo. NO esperar: prueba para turistas ni para aliados. |
| trial-ending | Qué pasa cuando termina la prueba | La ficha deja de verse y recibís correos para volver. | host, venue, experience | true | TRIAL_EXPIRED, recover_own_listing, serie trial (9), trial-expiry cron | — | free-trial, choose-plan, how-subscription-works, notification-preferences, pause-resume, publish-requirements | NO esperar: un correo justo el día en que vence (la serie no lo incluye, ver gap 3). |
| promo-codes | Canjear un código promocional | Un descuento en tus cobros o una extensión de tu prueba. | host, venue, experience | false | promo-ending, promo cron, PromoCodeRedeem, trial-extension | — | free-trial, change-plan, subscription-status, payment-declined, how-subscription-works | NO esperar: canjearlo si pagás de forma manual, con un pago pendiente o con la baja pedida. Al cambiar de plan la promo se pierde. |
| courtesy-and-grants | Cortesías y acceso permanente | Meses regalados o acceso sin costo: cómo se ven y cómo terminan. | host, venue, experience | false | courtesy-revoked, permanent-grant emails, my-subscription-notices | — | subscription-status, pause-subscription, change-plan, cancel-subscription, addons | Los otorga el equipo. El acceso permanente hoy no aparece en la página de Suscripción. |
| addons † | Comprar o dar de baja un complemento | Elegís complemento y ficha, pagás y lo das de baja cuando quieras. | host, venue, experience | false | featured_listing, payment-window cron, addon emails, RecurringAddonWithdrawal | page:mi-cuenta/complementos | change-plan, cancel-subscription, pause-subscription, receipts-refunds, subscription-status, courtesy-and-grants | Pueden ser de pago único o recurrentes. NO esperar: reembolso, ni un botón para destacar la ficha. |
| billing-emails | Los correos de cobro que vas a recibir | El mapa de los avisos de tu suscripción. | host, venue, experience, partner | false | manual-installment, manual crons | — | subscription-status, payment-declined, receipts-refunds, cancel-subscription, pending-authorization, plan-retirement, notification-preferences | Son transaccionales: no se pueden silenciar. |
| receipts-refunds | Comprobantes y devoluciones | Comprobante no fiscal por correo; las devoluciones las gestiona el equipo. | host, venue, experience | false | payment-credited, late-payment-refunded, revocation-cancel | — | how-subscription-works, cancel-subscription, addons, payment-declined, billing-emails | NO esperar: una página de facturas, una factura fiscal ni un reembolso pedido desde el sitio. |
| plan-retirement | Si tu plan deja de venderse o cambia de precio | Te avisamos con anticipación y te decimos a qué plan pasás. | host, venue, experience | false | 3 migration emails, migration crons | — | change-plan, subscription-status, billing-emails, cancel-subscription, how-subscription-works | — |
| tourist-vip-included | Beneficios de viajero incluidos en tu plan | No hace falta comprarlos aparte. | host, venue, experience | true | TOURIST_VIP_INHERITED, tourist-vip-inherited-cancel | — | choose-plan, subscription-status, change-plan, how-subscription-works | NO esperar: reembolso de lo que ya pagaste. |
| plan-includes | Qué incluye tu plan | Las capacidades generales, con un link a los valores vigentes. | host, venue, experience | true | decorative and stats entitlements (10) | — | choose-plan, plan-limit-reached, change-plan, subscription-status, free-trial | Varias filas de la tabla comparativa todavía no tienen una función visible. |
| plan-limit-reached | Llegaste al tope de tu plan | Qué hacer: ver planes o liberar espacio. | host, venue, experience | true | max_staff_accounts, max_ai_support_per_month | — | choose-plan, change-plan, plan-includes, owner-promotions, addons | — |
| owner-promotions | Crear promociones para tus alojamientos | Ofertas con vigencia que ven los turistas. | host | false | create_promotions, max_active_promotions, archive cron | page:mi-cuenta/promociones, …/nueva, …/[id]/editar | plan-limit-reached, plan-includes, choose-plan, change-plan | No son códigos de descuento de la suscripción. Los comercios gestionan sus promociones desde su editor (venue-promotions). |
| ai-assistants † | Conectar o desconectar un asistente de IA | Claude, ChatGPT, Gemini u otro asistente, conectado con una dirección MCP. | all | true | AiAssistantsPanel | page:mi-cuenta/asistentes-ia | ai-assistant-tools, ai-assistants-history, password, notification-preferences, edit-profile | Si cambiás la contraseña, el sitio te ofrece desconectar los asistentes. |
| ai-assistants-history | Ver qué hicieron tus asistentes de IA | Historial de los últimos 12 meses. | all | false | mcp-audit-retention | page:mi-cuenta/asistentes-ia/historial | ai-assistants, ai-assistant-tools, notification-preferences | NO esperar: el texto de los mensajes. |
| ai-assistant-tools | Qué puede hacer un asistente de IA con tu cuenta | Las acciones disponibles y cuáles piden tu confirmación. | all | true | 22 tools (see gap 7) | — | ai-assistants, ai-assistants-history, create-listing, inquiries, benefit-usage, change-plan | NO esperar: que el asistente cambie tu plan o publique sin que se lo pidas. |
| edit-profile | Editar tu perfil y completar tus datos | Nombre, foto, contacto y ubicación. | all | false | — | page:mi-cuenta/editar, page:mi-cuenta/completar-perfil | password, notification-preferences, account-home, newsletter | UNVERIFIED: si el correo de acceso se puede cambiar desde acá. |
| password | Cambiar o agregar contraseña | También si entraste con Google o Facebook. | all | false | — | page:mi-cuenta/cambiar-contrasena, page:mi-cuenta/agregar-contrasena | edit-profile, ai-assistants, notification-preferences, account-home | Las cuentas de comercio creadas con una contraseña generada tienen que cambiarla en el primer ingreso. |
| notification-preferences | Elegir qué avisos recibís | Idioma, tema, canales y el resumen semanal de la IA. | all | false | ai digest email and cron | page:mi-cuenta/preferencias | newsletter, billing-emails, trial-ending, ai-assistants-history, account-home | NO esperar: poder silenciar los avisos de cobro. |
| newsletter | Suscribirte o darte de baja del boletín | Confirmación por correo y elección de temas. | all | false | 3 newsletter emails | page:mi-cuenta/newsletter | notification-preferences, whats-new, edit-profile, account-home | — |
| whats-new | Ver las novedades de Hospeda | Las mejoras de la plataforma, con marca de leído. | host, venue, experience | false | — | page:mi-cuenta/novedades | account-home, newsletter, notification-preferences | La ventana de novedades no aparece mientras el tour de bienvenida esté pendiente. |
| account-home | Tu panel de cuenta | Qué ves al entrar y cómo llegar a cada sección. | all | false | — | page:mi-cuenta | subscription-status, edit-profile, notification-preferences, whats-new, publish-hub, ai-assistants | — |
| publish-hub | Publicar en Hospeda desde tu cuenta | Una sola puerta para alojamiento, comercio y experiencia. | host, venue, experience | true | — | page:mi-cuenta/publica | create-listing, choose-plan, free-trial, publish-requirements, account-home | — |

## 9. Gaps and bugs

1. **The anchor grammar cannot name 33 emails.** `email:<NotificationType>` does not cover the `billing.*` outbox templates, so the spec has to accept `email:billing.<id>` or add an `outbox:` kind.
2. **About 22 `NotificationType` values have no sender.** Dynamic dispatch inside `notification.service.ts` was not traced, so confirm before deleting any.
3. **Three trial values are never sent:** `trial_ending_1d`, `trial_expired` and `trial_win_back_10d`. No email goes out on the day the trial expires.
4. **The web shows neither permanent grants nor courtesies in progress.** Only `get_my_plan` returns them. The keys at `account.json:534-625` look like leftovers.
5. **`PricingSituation` is not in the `enum:` vocabulary.** The same applies to cancellation reasons, plan-change outcomes and trial extensions, which use `file:` anchors.
6. **The dashboard's «Mis consultas» card points owners to the guest inbox** (`mi-cuenta/index.astro:133-145`). Same bug as gap A-1.
7. **Each tool needs exactly one home.** Part D groups them all; parts A–C propose per-feature articles.
8. **Several entitlements are decorative:** priority_support, custom_branding, has_verification_badge, multi_property_management, consolidated_analytics, centralized_booking, staff_management, ai_support and max_ai_support_per_month. The plans page promises things that have no behavior behind them.
9. **"Turista VIP" appears in emails and the checkout.** Decide whether that counts as a plan name the help must avoid.
10. **Operational pauses** (new signups, add-ons, first publish, assistants) are written as "si ves este aviso".
11. **Unverified:** the copy of `payerEmailConfirm.plusError`, and whether a promo can be entered during checkout.
12. **The root CLAUDE.md is out of date on one-time add-ons.** They are purchasable today (`apps/web/src/lib/billing/addon-purchase.ts:15-35`).
13. **`subscription-status` owns only ACTIVE and CANCELLED.** The other seven states are covered by their specific articles.
