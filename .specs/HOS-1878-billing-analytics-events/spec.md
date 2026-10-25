---
title: Analytics de billing y verticales rediseñados para el modelo HOS-1352
linear: HOS-1878
statusSource: linear
created: 2026-10-25
type: feature
areas:
  - billing
  - api
---

# Analytics de billing y verticales rediseñados para el modelo HOS-1352

> Fase 1 (solo docs). Todas las referencias `path:line` se midieron sobre `origin/staging` (2026-10-25).

## 1. Problema y objetivo

`packages/analytics/src/catalog.ts:29-33` declara cinco eventos (`subscription_checkout_started`, `subscription_created`, `subscription_payment_succeeded`, `subscription_payment_failed`, `trial_converted_to_paid`) con schemas en `:181-227`. Ningún código de producción los emite desde que HOS-1352 borró `start-paid.ts`, `payment-logic.ts` y `reactivation-supersession-complete.ts`. `docs/analytics/event-catalog.md` los sigue listando con "Trigger location: none today".

**Decisión del owner (25/10):** no se adaptan. Se rediseñan desde cero para el modelo nuevo (vertical, `billing_option`, estados `PENDING_AUTHORIZATION … CHARGE_DECLINED`, trial propio de Hospeda). Los dashboards se rehacen y se acepta cortar la continuidad.

Los schemas viejos ya no calzan con el modelo: `billing_period` acepta 2 valores (`catalog.ts:183`) pero `billing_option.cycle` tiene 4 (`billing-option.dbschema.ts:21-23`: monthly, quarterly, semiannual, annual); `checkout_outcome` (`:191`), `promotion_code*`, `payment_method`, `failure_category` y los ids de suscripción reemplazada no existen; `plan_slug` es `plan_version_id`.

**Preguntas de negocio que el catálogo nuevo tiene que poder responder, por vertical:**

1. Embudo trial → pago: ¿cuántos trials arrancan, cuántos convierten (y por qué transición), cuántos vencen sin convertir?
2. Abandono de checkout: de los checkouts iniciados, ¿cuántos terminan activos y cuántos mueren por ventana vencida o cancelación del usuario?
3. Tasa de falla de pago: primer cobro vs renovación; intentos rechazados.
4. Grace: ¿cuántos entran, cuántos se recuperan y cuántos terminan suspendidos?
5. Churn: cancelaciones programadas y efectivas, quién las pidió (usuario, admin, sistema) y, si se captura, por qué.
6. MRR aproximado por plan y ciclo: cobros acreditados en `amount_minor` agrupados por `plan_version_id` y `cycle`.

## 2. Principios

- **P-1 Solo `apps/api`, post-commit.** Solo `apps/api` depende de `@repo/analytics`; la única puerta es `captureServerAnalyticsEvent` (`apps/api/src/lib/posthog.ts:137`), fire-and-forget que nunca tira (`packages/analytics/src/server.ts:12-49`). Nada se emite dentro de una transacción.
- **P-2 La fuente de verdad es la transición, nunca el webhook.** Se emite desde la función que escribió el estado y solo cuando escribió (no en `NOT_APPLICABLE`, `LOST_RACE`, `ALREADY_*`). Recibir un webhook (`apps/api/src/routes/webhooks/mercadopago.ts:48`) no es un hecho; el hecho es lo que `recordChargeFact` y sus transiciones comprometieron.
- **P-3 Idempotente por hecho.** Cada evento tiene una clave de dedupe (sección 4). El `uuid` del evento PostHog se deriva de forma determinista de esa clave (UUIDv5), así un reintento, un webhook repetido o un barrido que reprocesa el mismo hecho no duplica. Requiere pasar `uuid` por `ServerAnalyticsClient.capture` (`server.ts:5-9` hoy no lo expone); se valida en implementación contra `posthog-node`.
- **P-4 Todo evento lleva `vertical`** (valores de `VerticalEnum`: accommodation, gastronomy, experience, tourist, partner) y `subscription_class` cuando aplica.
- **P-5 Dinero en unidades menores + moneda:** `amount_minor` (entero, igual que `payments.amount`) y `currency` (hoy solo `'ARS'`, `billing-option.dbschema.ts:25`). Nunca `amount` flotante.
- **P-6 Sin PII más allá del `distinct_id`** (id de usuario). `shared.ts:8-9` ya rechaza claves con `email|phone|message|token|address|card…`; los nombres nuevos no pueden chocar con esa regex (por eso no hay `payment_method_card`). `declared_payer_email` no se emite jamás (`subscription.dbschema.ts:78-84`).
- **P-7 Timestamp = momento del hecho**, no de la emisión, cuando ambos difieren (cron, barrido).
- **P-8 Guard del catálogo:** todo evento declarado debe tener emisor de producción (sección 5).
- **P-9 La pérdida es aceptada y declarada.** La emisión es post-commit sin entrega durable, igual que el aviso de cobertura (`coverage-notice-registry.ts:5-9`). Un crash entre commit y emisión pierde el evento. No hay outbox de analytics ni backfill (fuera de alcance).

## 3. Modelo de referencia (verificado)

- Estados: `SUBSCRIPTION_STATUSES` (`subscription.dbschema.ts:21`) = PENDING_AUTHORIZATION, ABANDONED, ACTIVE, GRACE_PERIOD, PAUSED, SUSPENDED, CANCEL_SCHEDULED, CANCELLED, CHARGE_DECLINED. Clases: PRINCIPAL, COMPLEMENTO, LAPIDA (`:33`). LAPIDA no tiene `user_id` (`ck_subscription_identity_not_null`): sin usuario no hay `distinct_id`, no se emite.
- Trial propio, transiciones T1..T8 en `packages/verticals/src/trial/`. Evento de activación por vertical en `vertical-activation-event.ts` (partner = `null`, sin trial).
- Hoy el único canal post-commit hacia afuera es el aviso de cobertura (`CoverageNotices`, `payment-ports.ts:55-69`, registro en `coverage-notice-registry.ts:54`). No sirve para analytics: no es creíble por diseño ("no se cree", `forward.schema.ts` doc), puede perderse y no distingue hechos (un `CHANGED` de cobertura no dice si fue pago, plan o grace).

## 4. Propuesta de catálogo

Convenciones: `snake_case`, prefijo de dominio `billing_` / `trial_`. Propiedades comunes a TODOS los eventos de la tabla: `vertical`, `subscription_id` (salvo trial), `subscription_class`, `actor_kind` (`USER|ADMIN|SYSTEM`). Por brevedad las columnas listan solo las propiedades propias. `plan_version_id`, `billing_option_id` y `cycle` se leen del row de suscripción (principales: `ck_subscription_principal_anchor`); en COMPLEMENTO son opcionales.

| Evento | Cuándo exactamente (función `path:line`) | Requeridas | Opcionales | Dedupe | Fase |
|---|---|---|---|---|---|
| `billing_checkout_started` | S1: `startSubscription` devuelve, en la ruta `apps/api/src/routes/billing-subscription/index.ts:53`. Fila `PENDING_AUTHORIZATION` ya comprometida (impl. `start-subscription.service.ts:282`) | `plan_version_id`, `billing_option_id`, `cycle`, `amount_minor`, `currency` | `is_succession` (si hay predecesor) | `subscription_id` | MVP |
| `billing_checkout_abandoned` | Fila pasa a `ABANDONED`: (a) S3 vencimiento de ventana, `expireAuthorizationWindows` `expire-authorization-windows.service.ts:224` (rama `wrote.wrote`); (b) S40 el usuario la abandona, `cancelPendingAttempt` `cancel-pending-attempt.service.ts:24` (retorno `ABANDONED` `:113`) | `reason` (`WINDOW_EXPIRED\|USER_CANCELLED`) | `seconds_in_pending` | `subscription_id` | MVP |
| `billing_subscription_activated` | S2: `afterSubscriptionActivated` `after-activation-commit.ts:23`. Tres llamadores: `activate-subscription.service.ts:75`, `expire-authorization-windows.service.ts:79`, `process-provider-notice.service.ts:328` | `plan_version_id`, `billing_option_id`, `cycle`, `amount_minor`, `currency` | `trial_active_at_activation` (hay trial vivo en ese vertical) | `subscription_id` | MVP |
| `billing_plan_changed` | Mismo S2 cuando `succeedsId != null` (`after-activation-commit.ts:42`, `change: 'CHANGED'`): el sucesor entró y reemplaza al predecesor. El alta del sucesor es `startSuccession` (`start-succession.service.ts:57`; hoy sin llamador en `apps/api/src`) | `from_plan_version_id`, `to_plan_version_id`, `from_cycle`, `to_cycle`, `direction` (`UPGRADE\|DOWNGRADE\|LATERAL`, de `planPolicy.changeDirection`) | `from_amount_minor`, `to_amount_minor` | `subscription_id` (del sucesor) | MVP (va gratis con S2) |
| `billing_charge_succeeded` | `creditPayment` `credit-payment.service.ts:61`, solo `outcome: 'CREDITED'`, después del commit (`:304`, bloque post-commit `:306`). Primer cobro = `firstPayment` (`:100-106`) | `payment_id`, `amount_minor`, `currency`, `is_first_charge`, `cycle` | `plan_version_id`, `promo_applied` | `payment_id` | MVP |
| `billing_charge_declined` | `recordChargeFact` rama rechazada `record-charge-fact.service.ts:299-322` (resultado `GRACE` o `DECLINED`), **uno por intento rechazado** (D-1) | `payment_id`, `amount_minor`, `currency`, `is_first_charge`, `next_state` (`GRACE_PERIOD\|CHARGE_DECLINED\|UNCHANGED`) | `has_retry_window` (inverso de `isRejectedWithoutRetryWindow`, `rejected-charge-terminal.ts`) | `payment_id` | MVP |
| `billing_grace_entered` | S4: `enterGraceOnRejectedCharge` retorna `GRACE_STARTED` (`enter-grace.service.ts:58`, retorno `:156`) | `grace_ends_at` | `days_of_grace` | `subscription_id` + `grace_started_at` | MVP |
| `billing_subscription_suspended` | S6: `suspendForArrears` retorna `SUSPENDED` (`suspend-for-arrears.service.ts:274`, retorno `:467`); llamadores: `grace-expiry-check.ts:207`, `successor-grace-check.ts:60/78`, `provider-notice-delegates.ts:114` | `trigger` (`GRACE_EXPIRED\|PROVIDER_PAUSE_OBSERVED\|SUCCESSOR_PROVIDER_CANCELLED`, `SUSPEND_FOR_ARREARS_EVENTS` `:37`) | `days_in_grace` | `subscription_id` + `occurrenceId` (ya existe en el input de S6) | MVP |
| `billing_subscription_recovered` | S5: `exitGraceOnCreditedPayment` retorna `REACTIVATED` (`exit-grace.service.ts:172`, `:271`); S7: `reactivateSuspendedOnCreditedPayment` retorna `REACTIVATED` (`reactivate-suspended.service.ts:171`, `:462`) | `recovered_from` (`GRACE_PERIOD\|SUSPENDED`), `payment_id` | `days_in_state` | `subscription_id` + `payment_id` | MVP |
| `billing_cancel_scheduled` | `cancelActiveSubscription` retorna `SCHEDULED` (`cancel-active-subscription.service.ts:160`, `:312`). Usuario: `routes/billing-subscription/cancellation.ts:128`; admin: `routes/billing-subscription/admin/cancellation.ts:200` | `service_ends_at`, `basis` (`PAID_PERIOD\|CREDIT\|NOW`) | `reason` (enum de la sección 7b, D-3) | `subscription_id` + `service_ends_at` | MVP |
| `billing_subscription_cancelled` | Estado `CANCELLED` efectivo: S12 fin de servicio (`end-scheduled-services.service.ts:177` → `service-end-s12.ts:181`, cron `subscription-service-end.job.ts`); S23/S24 cancelación directa (`cancel-direct-subscription.service.ts:167`, `CANCELLED` `:318`, desde SUSPENDED/GRACE_PERIOD); revocación admin (`revoke-subscription.service.ts:287`) | `cancelled_by`, `path` (`SERVICE_END\|DIRECT_FROM_GRACE\|DIRECT_FROM_SUSPENDED\|REVOKED`), `was_scheduled` | `lifetime_days`, `reason` | `subscription_id` | MVP |
| `trial_started` | T1 dentro de `publishListing` (`publish-listing.ts:117`, retorno `{ trialStarted }` en `:147`). Se emite en `apps/api/src/services/listing-publication/listing-publication.service.ts:122`, después de `result.published` | `activation_event` (`listing_published\|start_button_pressed`) | `trial_days` | `trial.id` o `user+vertical+'T1'` | MVP (D-2) |
| `trial_converted` | T2/T5: `convertTrialOnTitle` `trial-conversion.ts:46` (retorno `{ converted: true, transition }` `:73`); T8: `consumeTrialOnFirstPayment` `trial-first-payment.ts:32` (retorno `:69`). Hoy los dispara el listener `apps/api/src/utils/trial/trial-coverage-listener.ts:37/:52` | `transition` (`T2\|T5\|T8`), `trial_state_before` (`ACTIVE\|EXPIRED\|NONE`) | `days_into_trial`, `days_since_expiry` | `trial.id` (T8: `user+vertical+'T8'`) | MVP |
| `trial_expired` | T3: `expireTrial` `trial-expiry.ts:19` (retorno `{ expired: true }`), llamado por `expireDueTrials` (`:60`) desde el cron `apps/api/src/cron/jobs/trial-machine-expiry.job.ts:27` | `trial_days` | `had_paid_intent` (hubo checkout iniciado durante el trial) | `trial.id` | MVP |

Notas:

- **Primer cobro vs renovación** es una propiedad, no dos eventos: `is_first_charge` sale de la misma lectura que ya hace `creditPayment` (`:100-106`, solo PRINCIPAL). Para COMPLEMENTO queda `false` (ver D-4).
- **Rechazo del primer cobro.** El camino `declineFirstCharge` (`decline-first-charge.service.ts:73`, `DECLINED` `:276`, estado `CHARGE_DECLINED`) cubre el embudo de checkout que muere en el primer cobro. Se expresa con `billing_charge_declined { is_first_charge: true, next_state: 'CHARGE_DECLINED' }`; no hay evento aparte.
- **Eventos sin emisor posible hoy:** `billing_plan_changed` por la vía de cambio programado (S38, `scheduled-change-on-return.ts:33`) queda para después; `startSuccession` no tiene ruta en `apps/api/src`.
- **Qué NO se emite:** `partner` (sin trial, activación manual), LAPIDA, pagos de add-on (D-4, HOS-1883), recibos, reembolsos, chargebacks (otra spec).

## 5. Mecanismo: cómo llegan los hechos a `apps/api`

Restricciones verificadas: service-core, verticals y payments no pueden depender de `@repo/analytics`; `scripts/check-billing-verticals-boundary.ts` impide que billing y verticals se importen entre sí fuera de `@repo/billing-verticals-contract`. Los hechos nacen en muchos lugares y no todos pasan por una ruta: S4/S6 se invocan desde cron/barridos (`lost-rejection-check.ts:44`, `grace-expiry-check.ts:207`) y desde el receptor de avisos; T3 desde un cron que devuelve solo contadores (`trial-machine-expiry.job.ts:27-34`).

**Opción A. Resultados devueltos.** Cada servicio devuelve el hecho y el borde (`ruta`, `cron`, `webhook`) lo emite.
- Pros: cero puertos nuevos; el tipo del resultado ya existe (`RecordChargeFactResult`, `EnterGraceResult`).
- Contras: los resultados hay que ensancharlos con datos que hoy no devuelven (`creditPayment` no devuelve monto ni `firstPayment`); la cadena `processProviderNotice → recordChargeFact → exit/reactivation/crossing` y los 4 barridos tendrían que propagar y re-interpretar el mismo resultado en cada borde (riesgo de emitir dos veces o ninguna); `expireDueTrials` devuelve conteos, habría que cambiar su contrato.

**Opción B. Puerto inyectado (`BillingFactSink`).** Un puerto de solo escritura, tipado por hecho, en `ports` de cada servicio, con implementación en la composition root de `apps/api` que traduce a `captureServerAnalyticsEvent`. Precedente directo: `CoverageNotices`/`unwiredCoverageNotices` (`payment-ports.ts:55-69`) y `TrialAfterCommit` (`trial-machine-types.ts:98`).
- Pros: se emite una sola vez, en la función dueña de la transición, con todos los datos a mano y sin importar quién la llame; testeable con un sink espía en service-core/verticals; respeta los guards de frontera (el tipo del puerto vive en cada paquete y los hechos son datos planos sin dependencia cruzada).
- Contras: hay que cablear el puerto en cada composition root (webhook, crons, rutas); un default silencioso "unwired" repetiría el problema que originó esta spec, por eso el default debe ser ruidoso como `unwiredCoverageNotices` (log de error) y el guard de la sección 6 debe verlo; dos definiciones de puerto (billing y verticals).

**Recomendación: B**, con un solo tipo de hecho por cada transición MVP, `emit` que nunca tira (try/catch en el adaptador, como `server.ts:34-39`) y default ruidoso. La composition root del webhook es `buildMercadoPagoNoticePorts()` (invocado en `routes/webhooks/mercadopago.ts:50`). Para los eventos de trial el puerto se agrega a `TrialAfterCommit` (`trial-machine-types.ts:98`).

## 6. Guard: todo evento del catálogo tiene emisor

`scripts/check-analytics-catalog-emitters.ts` (nuevo, mismo estilo que `check-no-provider-trial.ts`: `run({ root, minScannedFiles })`, encabezado con lo que NO ve).

- **Predicado:** para cada clave de `AnalyticsEvents` (`catalog.ts:11`), existe al menos una aparición de `AnalyticsEvents.<clave>` o del literal snake_case en código de producción (`apps/*/src`, `packages/*/src`, sin `test/`, sin `catalog.ts`, sin `docs/`), ignorando comentarios. Los eventos de frontend se cuentan por los aliases de `apps/web/src/lib/analytics/events.ts`.
- **Allowlist:** `scripts/analytics-emitter-allowlist.json` con `{ event, reason, issue }` obligatorios. Una entrada cuyo evento ya tiene emisor, o que no existe en el catálogo, también falla (la allowlist no se pudre).
- **Control positivo:** falla si escanea menos de N archivos o si el catálogo trae menos de N claves (raíz equivocada no es árbol limpio).
- **Ceguera declarada:** ve el nombre, no el flujo; un emisor en código muerto cuenta. Por eso además cada evento MVP tiene un test de emisión (sección 9).
- **CI:** paso propio en `.github/workflows/ci.yml` junto a los demás guards de billing (cerca de `:290-300`) y entrada en `check:guards` (`package.json:58`); estar en `check:guards` NO alcanza para que corra en ese job.
- **Alta inicial:** al implementar se mide qué eventos del catálogo hoy no tienen emisor; los que no sean los cinco retirados entran a la allowlist con motivo, no se silencian.

## 7. Retiro de los cinco eventos y dashboards

- `catalog.ts`: borrar las cinco claves (`:29-33`) y sus schemas (`:181-227`). Agregar las claves y schemas nuevos con enums cerrados (`cycle` con 4 valores, `reason`, `trigger`, `cancelled_by`).
- `docs/analytics/event-catalog.md`: borrar las cinco filas de `subscription_*` / `trial_converted_to_paid` y agregar las nuevas con Trigger location real (no "none today"). El archivo dice que la fuente de verdad es `catalog.ts`; el guard de la sección 6 compara ambos.
- **Dashboards de PostHog a rehacer** (columna Dashboard del catálogo actual): **Suscripciones** (los cinco eventos entran ahí; se reconstruye entero), **Resumen** (los tiles de checkout, suscripción creada y pago exitoso) y **Calidad** (el panel de pago fallido). Los dashboards Descubrimiento, Adquisición y Owners no se tocan.
- No se aliasan ni dual-emiten los nombres viejos. Los datos históricos de PostHog se conservan pero no se continúan; la query debe etiquetar el corte con la fecha de deploy.

## 7b. Motivo de cancelación (lista cerrada, D-3)

El owner decidió capturar el motivo **ya**, como lista cerrada (sin texto libre, por P-6). Esto agrega un cambio de contrato de API y UI a esta spec.

- **Schema:** `CancellationReasonEnum` nuevo en `@repo/schemas` (`packages/schemas/src/enums/`), exportado y reusado por la API, la web y el admin. **Valores propuestos (D-6, confirmar con el owner antes de implementar):** `TOO_EXPENSIVE`, `NOT_ENOUGH_RESULTS` (pocas reservas o contactos), `MISSING_FEATURES`, `SEASONAL_PAUSE`, `CLOSING_BUSINESS`, `SWITCHING_PLATFORM`, `TECHNICAL_PROBLEMS`, `OTHER`.
- **API:**
  - La cancelación del usuario (`apps/api/src/routes/billing-subscription/cancellation.ts:100-110`) hoy no recibe cuerpo. Pasa a aceptar un cuerpo opcional `{ reason?: CancellationReason }`, estricto (`z.strictObject`). Sin cuerpo sigue funcionando igual: compatible hacia atrás.
  - La cancelación de admin (`AdminSubscriptionCancellationRequestSchema`, `packages/schemas/src/api/billing/subscription-admin-cancel.schema.ts:15`) suma el mismo `reason?` opcional.
- **Persistencia:** columna nullable `cancellation_reason` en `subscription`, escrita por `cancelActiveSubscription` y `cancelDirectSubscription` en la misma transacción que el cambio de estado. Requiere una migración estructural (carril drizzle) con número reservado al implementar. No se emite por analytics algo que no quedó guardado: el evento lee el motivo del row.
- **UI web:** `apps/web/src/components/account/SubscriptionCancel.client.tsx` muestra un selector opcional con los motivos (i18n es/en/pt, `billing.json`, solo claves nuevas). No es obligatorio: un usuario que no elige igual cancela.
- **UI admin:** `apps/admin/src/features/billing-cancellation/components/SubscriptionCancellationScreen.tsx` suma el mismo selector opcional. No confundir con `cancellation-reasons.ts`, que mapea motivos de **rechazo** de la cancelación, no de baja.
- **Eventos:** `billing_cancel_scheduled.reason` y `billing_subscription_cancelled.reason` llevan el valor del row (o se omiten si es null).

## 8. Decisiones (25/10/2026)

| # | Pregunta | Decisión | Quién |
|---|---|---|---|
| D-1 | Rechazo de cobro: ¿por intento o solo terminal? | **Por intento.** El resultado terminal lo cubren `billing_grace_entered`, `billing_subscription_recovered` y `billing_subscription_suspended` | Owner |
| D-2 | ¿`trial_started` entra al MVP? | **Sí.** Se emite desde el borde (`listing-publication.service.ts:122`) con el `trialStarted` que devuelve `publishListing`, sin tocar `packages/verticals` | Owner |
| D-3 | ¿Se captura el motivo de cancelación? | **Sí, lista cerrada, en esta spec** (sección 7b) | Owner |
| D-4 | ¿COMPLEMENTO y add-ons? | **Solo PRINCIPAL ahora.** El resto va en HOS-1883 (hijo de HOS-1352, bloqueado por esta spec). `subscription_class` queda en los schemas para ampliar sin migrar | Owner |
| D-5 | `distinct_id` de eventos de cron o sistema | El `user_id` dueño de la suscripción; `actor_kind` distingue quién actuó. LAPIDA no emite | Coordinador (no cambia el diseño) |
| D-6 | Valores del enum de motivos | Lista propuesta en 7b; **pendiente de confirmación del owner** antes de implementar | Pendiente |
| D-7 | ¿`$set` de propiedades de persona? | No. El plan vigente se deriva de los eventos | Coordinador (no cambia el diseño) |

## 9. Criterios de aceptación

| # | Criterio (Dado / Cuando / Entonces) | Tipo de test |
|---|---|---|
| AC-1 | Dado un `billingOptionId` válido, cuando `POST /api/v1/protected/billing/subscriptions` crea la fila pendiente, entonces sale un `billing_checkout_started` con `vertical`, `plan_version_id`, `cycle`, `amount_minor`, `currency='ARS'` y `uuid` determinista; y si el proveedor rechaza la autorización (422) no sale | Integración (ruta, sink espía) |
| AC-2 | Dado un reintento del mismo checkout que reusa la fila, cuando se repite el POST, entonces el `uuid` del evento es el mismo | Unit (dedupe) |
| AC-3 | Dada una fila `PENDING_AUTHORIZATION` con ventana vencida, cuando corre `expireAuthorizationWindows`, entonces sale `billing_checkout_abandoned {reason:'WINDOW_EXPIRED'}` una sola vez y no sale si la fila ya estaba activa o `skipped` | Integración (servicio + DB) |
| AC-4 | Cuando el usuario abandona su intento (S40), entonces sale `reason:'USER_CANCELLED'`; con `ALREADY_ABANDONED` no sale | Unit/integración |
| AC-5 | Cuando S2 activa por cualquiera de sus tres llamadores, entonces sale exactamente un `billing_subscription_activated`; con `succeedsId` además sale `billing_plan_changed` con `from_*`/`to_*` y `direction` | Integración (los 3 llamadores) |
| AC-6 | Dado un pago `PENDING`, cuando `creditPayment` devuelve `CREDITED`, entonces sale `billing_charge_succeeded` con `amount_minor` del `payments.amount` y `is_first_charge` correcto; con `ALREADY_CREDITED` o `NOT_PENDING` no sale; si la transacción falla (rollback) no sale | Integración + test de rollback |
| AC-7 | Dado un webhook de cobro repetido, cuando `processProviderNotice` lo procesa dos veces, entonces el `payment_id` produce un solo evento (mismo `uuid`) y recibir el webhook sin transición nueva no emite nada | Integración (webhook, fake provider) |
| AC-8 | Dado un cobro rechazado de un ACTIVE con pago previo, cuando corre `recordChargeFact`, entonces salen `billing_charge_declined {next_state:'GRACE_PERIOD'}` y `billing_grace_entered`; de uno sin pago previo sale `{next_state:'CHARGE_DECLINED', is_first_charge:true}` y ningún `grace_entered` | Integración |
| AC-9 | Cuando S6 devuelve `SUSPENDED` por `GRACE_EXPIRED` desde el barrido, entonces sale `billing_subscription_suspended {trigger}` con el `distinct_id` del dueño y `actor_kind:'SYSTEM'`; con `NOT_APPLICABLE` no sale | Integración (barrido) |
| AC-10 | Cuando S5/S7 devuelven `REACTIVATED`, entonces sale `billing_subscription_recovered` con `recovered_from` correcto; con `CONDITION_FAILED` o `RETAINED_FOR_S19` no sale | Unit/integración |
| AC-11 | Cuando el usuario o un admin programa la cancelación, entonces sale `billing_cancel_scheduled` con `actor_kind` `USER` o `ADMIN` según la ruta; `ALREADY_SCHEDULED` no emite | Integración (2 rutas) |
| AC-12 | Cuando una suscripción llega a `CANCELLED` por S12, S23/S24 o revocación, entonces sale `billing_subscription_cancelled` con `path` y `cancelled_by` correctos y `was_scheduled` | Integración (3 caminos) |
| AC-13 | Cuando un trial convierte por T2, T5 o T8, entonces sale `trial_converted` con `transition` y `trial_state_before`; con `NO_CONVERTING_TITLE`/`ALREADY_CONVERTED` no sale | Unit (verticals) + integración (listener) |
| AC-14 | Cuando el cron vence un trial (T3), entonces sale `trial_expired` por trial vencido, también si la emisión falla para otro (aislamiento por fila) | Integración (cron) |
| AC-15 | Dado un `emit` que tira o PostHog caído, cuando ocurre cualquier hecho, entonces la transición sigue comprometida y el error solo se loguea | Unit (adaptador) |
| AC-16 | Ningún evento de la sección 4 contiene claves que `shared.ts:8` prohíbe ni emails | Unit (schemas con propiedades de ejemplo) |
| AC-17 | Dado un evento agregado a `catalog.ts` sin emisor ni allowlist, cuando corre `check:guards`, entonces falla con el nombre del evento; con una entrada de allowlist obsoleta también falla | Unit del guard (mutación) + CI |
| AC-18 | Tras el retiro, `rg` de las cinco claves viejas en `apps/`, `packages/` y `docs/analytics/` no devuelve nada fuera del changelog | Guard/CI |
| AC-19 | Cuando se emite un evento con puerto sin cablear, entonces queda un log de error (no silencio) | Unit |
| AC-20 | Dada una publicación que arranca un trial (T1), cuando `publishListing` devuelve `trialStarted`, entonces sale `trial_started` con `activation_event`; una publicación sin trial nuevo no emite | Integración (servicio de publicación) |
| AC-21 | Dado un usuario que cancela eligiendo un motivo, cuando la ruta responde, entonces `subscription.cancellation_reason` queda guardado y `billing_cancel_scheduled.reason` lo lleva; sin cuerpo, la cancelación funciona igual y el evento no trae `reason` | Integración (ruta + DB) |
| AC-22 | Dado un `reason` fuera del enum o una clave extra en el cuerpo, cuando se cancela, entonces la ruta responde 400 sin cambiar el estado | Integración |
| AC-23 | La cancelación del admin acepta y guarda el mismo `reason` opcional | Integración |
| AC-24 | El selector de motivo aparece en la web y en el admin, es opcional, y sus textos existen en es/en/pt | Unit de componente + guard i18n |

## 10. Fuera de alcance

- Dashboards de PostHog (se rehacen aparte, con esta spec como contrato de datos).
- Backfill o reemplazo de los datos históricos; cualquier outbox o entrega durable de analytics.
- Emisión de COMPLEMENTO y add-ons (HOS-1883). Reembolsos, chargebacks, promos, grants permanentes y cortesías: spec propia si el owner lo pide.
- Eventos de frontend de billing (vistas de planes, clics de "Empezar"): son de `apps/web`.
- Cambios de pricing, de `billing_option` o del modelo de trial.
- Conectar `startSuccession` a una ruta o aplicar cambios programados S38 (solo se emite si existen).

## 11. Linear

HOS-1878. Decisiones del owner del 25/10 en la sección 8 y en los comentarios del issue. Ampliación a COMPLEMENTO y add-ons: HOS-1883. Etiqueta pasa de `kind-needs-spec` a `kind-spec` al mergear este documento.
