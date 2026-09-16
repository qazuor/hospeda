# Relevamiento 01 — CHECKOUT / ALTA DE SUSCRIPCIÓN

**Worktree**: `/home/qazuor/projects/WEBS/hospeda-hos-1257-paridad-billing-verticales`
**HEAD**: `5c205fc70` (Merge PR #3288 — spec/HOS-1233-docs)
**Método**: `Read` + `rg` + `Glob` únicamente. Sin codegraph. Read-only.
**Fecha**: 2026-09-08

---

## 0. Resumen ejecutivo

El checkout NO es un flujo con un parámetro `vertical`. Son **cinco funciones de
entrada** en `subscription-checkout.service.ts` (2003 líneas) que reimplementan la
misma secuencia (resolver plan → resolver precio → guard de precio 0 → resolver plan
MP → resolver customer → bifurcar por flag → crear fila local → devolver URL) con
subconjuntos distintos de capacidades. La duplicación literal es de **~520-560
líneas sobre ~1050** de cuerpo efectivo (≈50%).

Cuatro asimetrías tienen consecuencia de dinero medible en el código leído:

1. **Idempotencia anti-doble-click existe SOLO para commerce y partner.**
   Alojamiento (mensual y anual) no la tiene: dos clicks = dos preapprovals
   pagables. El propio `checkout-reuse-decision.ts` documenta ese daño para
   commerce y no cubre alojamiento.
2. **`past_due` bloquea un segundo checkout en commerce y NO en alojamiento.**
3. **`notification_url` sin el marcador `?source_news=webhooks` en partner y en
   commerce/admin** → el router de webhooks DESCARTA la entrega (200 sin procesar).
4. **`/start-paid` no valida el dominio del plan**: acepta `gastronomy-pro` y crea
   una suscripción `product_domain='accommodation'`. El guard existe
   (`assertAccommodationPlanChangeTarget`) y solo se usa en plan-change.

Y hay **tres mappers de error distintos** para el mismo tipo de error.

---

## 1. Funciones de entrada de checkout (Q1)

### 1.a — Las cinco iniciadoras del servicio

| # | Función | Líneas | Verticales que cubre | Llamador(es) |
|---|---|---|---|---|
| 1 | `initiatePaidMonthlySubscription` | `subscription-checkout.service.ts:397-780` (384 líneas) | **accommodation** (host `owner-*` y tourist `tourist-*`; product_domain default `'accommodation'`) | `routes/billing/start-paid.ts:359` |
| 2 | `initiateCommerceMonthlySubscription` | `:876-1153` (278) | **gastronomy** + **experience** | `routes/commerce/protected/start-subscription.ts:509` y `routes/commerce/admin/start-subscription.ts:206` |
| 3 | `initiatePartnerMonthlySubscription` | `:1219-1401` (183) | **partner** | `routes/partners/admin/send-link.ts:148` |
| 4 | `initiatePaidAnnualSubscription` | `:1519-1729` (211) | **accommodation** SOLO | `routes/billing/start-paid.ts:339` |
| 5 | `initiatePaidPlanUpgrade` | `:1813-1992` (180) | **accommodation + gastronomy + experience** (es la única compartida) | `routes/billing/plan-change.ts:495` y `routes/commerce/protected/change-plan.ts:580` |

**No son cinco caminos de creación de preapproval, son ocho.** Además de las
cinco de arriba, mintean/crean suscripción de pago:

| # | Sitio | Alcance de dominio | Evidencia |
|---|---|---|---|
| 6 | `services/addon.checkout.recurring.ts:335` → `createOwnPreapprovalSubscription` | add-on recurrente (cualquier dominio) | grep `createOwnPreapprovalSubscription\(` |
| 7 | `services/billing/preapproval-recovery.service.ts:330` `mintRetryPreapprovalAttempt` | **ACCOMMODATION ÚNICAMENTE** — `RETRY_SUPPORTED_PRODUCT_DOMAINS = new Set(['accommodation'])` (`:283`), y `:338-342` tira `Error` para cualquier otro | leído |
| 8 | `services/billing/past-due-payment-method-replacement.service.ts:249` → `createPaidSubscription` | reemplazo de medio de pago en dunning | leído (parcial) |
| — | `services/trial.service.ts:1181,1235,1435,1492` → `createPaidSubscription` | reactivación (4 call sites) | grep |

Con `env.HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` **encendido** todos convergen en
`createOwnPreapprovalSubscription` → `createPaidSubscription` → `billing.subscriptions.create`.
Con el flag **apagado** (producción hoy, ver §3.g) las cuatro de plan usan
`createPendingProviderSubscription` (Path C, share link hosteado).

### 1.b — Rutas HTTP de entrada

| Ruta | Archivo | Auth | Idempotency-key middleware | Vertical |
|---|---|---|---|---|
| `POST /api/v1/protected/billing/subscriptions/start-paid` | `routes/billing/start-paid.ts:513-530` | sesión (sin `requiredPermissions`) | **SÍ** (`:546`) | accommodation mensual + anual |
| `POST /api/v1/protected/commerce/listings/{entityType}/{entityId}/start-subscription` | `routes/commerce/protected/start-subscription.ts:621-645` | `COMMERCE_EDIT_OWN` (`:667-670`) | **SÍ** (`:672-675`, después del auth a propósito) | gastronomy, experience |
| `POST /api/v1/admin/commerce/listings/:entityType/:entityId/start-subscription` | `routes/commerce/admin/start-subscription.ts:157-251` | `COMMERCE_EDIT_ALL` | **NO** | gastronomy, experience |
| `POST /api/v1/admin/partners/{id}/send-link` | `routes/partners/admin/send-link.ts:188-201` | `PARTNER_MANAGE` | **NO** | partner |
| `POST /api/v1/protected/billing/subscriptions/{localId}/checkout-retry` | `routes/billing/checkout-retry.ts:223-234` | sesión | NO | **accommodation SOLO** de facto (§2.k) |
| `POST /api/v1/protected/billing/subscriptions/link-preapproval` | `routes/billing/link-preapproval.ts:164-179` | sesión | NO | agnóstico de dominio |
| `GET /api/v1/public/billing/checkout-config` | `routes/billing/public/getCheckoutConfig.ts:62-78` | pública | n/a | agnóstico |

---

## 2. Matriz de capacidades (Q2)

Leyenda: ✅ presente · ❌ ausente · ⚠️ presente pero distinto

| Capacidad | `initiatePaidMonthly` (accom) | `initiatePaidAnnual` (accom) | `initiateCommerceMonthly` (gastro/exp) | `initiatePartnerMonthly` (partner) | `initiatePaidPlanUpgrade` (accom+commerce) |
|---|---|---|---|---|---|
| **a. Idempotencia anti-doble-click (por entidad)** | ❌ | ❌ | ✅ `:971-988` | ✅ `:1279-1294` | ⚠️ `idempotencyKey` a MP `:1966` |
| **b. Promo codes en checkout** | ✅ `:457-465`, `:519-544` | ⚠️ valida pero **rechaza `discount`** `:1581-1586` | ❌ | ❌ | ❌ |
| **c. Trial (`hasTrial`/`trialDays` del plan)** | ❌ literal `trialDays: 0` `:589`, `:688` | ❌ `:1609`, `:1673` | ❌ `:939`, `:1038` | ❌ `:1262`, `:1324` | ❌ (no aplica) |
| **d. Guard de plan gratuito (`unitAmount === 0`)** | ✅ `:438-443` | ✅ `:1541-1546` | ✅ `:907-912` | ✅ `:1242-1247` | ❌ **ausente** |
| **e. Resolución del email del pagador** | ✅ `:609-613` | ✅ `:1633-1637` | ✅ `:1010-1014` | ❌ **deliberadamente** (JSDoc `:1193-1212`) | ⚠️ `sanitizeEmailForMercadoPago(customer.email)` `:1960` |
| **f. Reuso de checkout pendiente** | ❌ | ❌ | ✅ `:971-988` | ✅ `:1279-1294` | ❌ |
| **g. Rama por `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED`** | ✅ `:671` | ✅ `:1649` | ✅ `:971` y `:1018` | ✅ `:1279` y `:1309` | ❌ (usa `billing.checkout.create` mode `payment`) |
| **h. Mapeo de errores de MercadoPago** | ✅ mapper compartido `subscription-checkout-error-http.ts` (15 códigos) vía `start-paid.ts:449` | ✅ ídem | ⚠️ protected: mapper compartido `start-subscription.ts:536`; **admin: mapper local de 4 casos** `commerce/admin/start-subscription.ts:135-150` | ❌ mapper local de 3 casos `partners/admin/send-link.ts:52-66` | ✅ compartido `plan-change.ts` |
| **i. Metadata de dominio en la suscripción** | ❌ (default DB `'accommodation'`) | ❌ (ídem) | ✅ `productDomain` + `domainMetadata` `:1050-1054`, `:1109-1115` | ✅ `:1329-1330`, `:1366-1370` | ❌ |
| **j. Escritura de bridge row (`writeDomainLinkRow`)** | ❌ | ❌ | ✅ `:1057-1079` y `:1119-1141` (duplicado) | ✅ `:1331-1348` y `:1373-1390` (duplicado) | ❌ |
| **k. Locale / URLs de retorno** | ✅ `resolveReturnUrlLocale(c)` `start-paid.ts:177` | ✅ ídem | ⚠️ protected: sí `start-subscription.ts:372`; **admin: hardcoded `${HOSPEDA_ADMIN_URL}/commerce/listings`** `commerce/admin/start-subscription.ts:76` | ⚠️ `DEFAULT_RETURN_URL_LOCALE` fijo `send-link.ts:41` (justificado: comprador sin cuenta) | ✅ `plan-change.ts` |
| **l. `notification_url` con marcador `?source_news=webhooks`** | ✅ `checkout-return-urls.ts:179` | ✅ ídem | ⚠️ protected ✅ (importa el shared); **admin ❌** `commerce/admin/start-subscription.ts:66` | ❌ `send-link.ts:30` | ✅ |
| **m. Guard "ya suscripto"** | ✅ 409 `{active,trialing,comp,courtesy}` `start-paid.ts:202-221` | ✅ ídem | ✅ 409 `{...ENTITLEMENT_GRANTING} ∪ {past_due}` `start-subscription.ts:136`, `:330-334` | ❌ ninguno | n/a |
| **n. Guard de dominio del plan solicitado** | ❌ **ninguno** | ❌ **ninguno** | ✅ `resolveCommercePlanSlug` rechaza slug de otra vertical `commerce-plan-resolver.ts:197-200` | n/a (plan viene de `partners.planId`) | ✅ `assertAccommodationPlanChangeTarget` `plan-change.ts:305` |
| **o. Rama trial local (primer publish)** | ✅ fuera del checkout: `accommodation-publish-deps.ts:197` `startLocalTrial` | n/a | ✅ **dentro del checkout**: `start-subscription.ts:476-504` → `commerce-trial-start.service.ts:296` | ❌ (esencial) | n/a |
| **p. Rama "attach a suscripción existente del dueño"** | ❌ (alojamiento resuelve por `accommodations.owner_id`) | ❌ | ✅ `start-subscription.ts:392-461` | ❌ | n/a |
| **q. Gate de completitud del listado** | ❌ | ❌ | ⚠️ protected ✅ `start-subscription.ts:298-319`; **admin ❌** | ❌ | n/a |

### Detalle por capacidad

#### a/f. Idempotencia anti-doble-click
Ver §3 completo. Resumen: `checkout-idempotency.ts` es consumido **solo** por
`initiateCommerceMonthlySubscription` (`:979`, `:972`) e
`initiatePartnerMonthlySubscription` (`:1286`, `:1280`).

El middleware `idempotencyKeyMiddleware` que sí tiene `/start-paid` NO cubre el
doble click: cachea por header suministrado por el cliente, y el cliente genera uno
nuevo por click. Evidencia: `apps/web/src/lib/commerce/owner-listings.ts:253` y
`:308` usan `crypto.randomUUID()` por llamada;
`apps/web/src/components/account/AddonsPurchasePanel.client.tsx:171` idem. La
afirmación está además documentada en
`services/addon.checkout.recurring-idempotency.ts:14-16`:
> "`idempotencyKeyMiddleware` deduplicates on a header the client REGENERATES per
> user action (its own JSDoc says so), so two clicks are two keys."

#### b. Promo codes
- Alojamiento mensual: `resolveCheckoutPromoPlan` con validación completa
  (`:457-462`), `INVALID_PROMO_CODE` → 422 (`:463-465`), y la rama `discount`
  materializa `pendingDiscount` + `discountCycle1AmountCentavos` (`:519-544`).
- Alojamiento anual: valida igual pero **rechaza explícitamente `discount`**
  (`:1581-1586`, mensaje "not available on annual plans yet", HOS-244).
- Commerce y partner: **cero**. Ni siquiera aceptan el campo —
  `CommerceStartSubscriptionRequestSchema` solo tiene `payerEmail` y `planSlug`
  (`routes/commerce/protected/start-subscription.ts:607`).
- Consecuencia documentada como fence: `checkout-reuse-decision.ts:138`
  ("commerce and partner checkouts accept no promo code today, so this cannot fire
  yet"). **Verificado como verdadero hoy.**
- Detalle silencioso: un código `trial_extension` en `/start-paid` se **valida** pero
  no aplica nada, no se redime, y `promoCodeIgnored` **nunca se emite**
  (`:366-376` lo documenta: "NOT currently produced by any branch"). El usuario que
  tipea `FREEMONTH` en el checkout no recibe señal alguna.

#### c. Trial
Ninguna de las cinco consulta `hasTrial`/`trialDays` del plan. Las cuatro de plan
pasan un **literal `0`** a `resolveCheckoutMpPlanId` y a
`createOwnPreapprovalSubscription`. El guard G-1
(`scripts/check-no-trial-to-mercadopago.sh`) lo congela. Esto es **simétrico y
correcto** (HOS-1012).

El trial vive fuera del checkout, y **ahí sí es simétrico**:
- accommodation: `services/accommodation-publish-deps.ts:197` `startLocalTrial`
- gastronomy/experience: `services/commerce-trial-start.service.ts:296`
  `startCommerceListingTrial` (HOS-1184)
- ambos usan `resolveTrialEligibility` keyed en `(customerId, productDomain)` y
  `createTrialSubscription` (dominio-genérico).
- partner: sin trial (esencial — marca externa, link generado por admin).

Diferencia estructural real: en commerce el trial se otorga **dentro de la ruta de
checkout** (`start-subscription.ts:476-504`, branch 1a, antes de abrir MP); en
alojamiento se otorga en el flujo de publish. Misma política, dos puntos de entrada.

#### d. Guard de plan gratuito
Cuatro copias verbatim del mismo bloque (HOS-917). `initiatePaidPlanUpgrade` NO lo
tiene — pero ahí el guard equivalente es `deltaCentavos <= 0 → NOT_AN_UPGRADE`
(`:1915-1920`), que cubre el caso.

#### e. Email del pagador
Tres call sites de `resolvePayerEmail` en el servicio (`:609`, `:1010`, `:1633`).
El JSDoc de `getMpPayerEmail` (`billing/payer-email.ts:157-160`) afirma:
> "all five checkout call sites in `subscription-checkout.service.ts` invoke this
> BEFORE their `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` check, a throw here
> answered 500 on every checkout path — accommodation monthly, annual, commerce and
> **partner alike**"

**FALSO en dos puntos**, verificado por grep exhaustivo (`rg -n "getMpPayerEmail|resolvePayerEmail" apps/api/src`):
son **tres**, no cinco, y **partner NO lo llama** — el propio JSDoc de
`initiatePartnerMonthlySubscription` (`:1193-1212`) explica por qué no debe
llamarlo (email sintético `partner-<id>@partners.hospeda.invalid` vetaría todo
link por webhook). El comentario contradice al código de al lado.

`initiatePaidPlanUpgrade` usa un mecanismo **distinto**:
`sanitizeEmailForMercadoPago(customer.email)` (`:1960`), que reescribe `+` → `.`
en vez de tirar `PAYER_EMAIL_UNSUPPORTED_CHARACTER`. El comentario `:1952-1959` lo
justifica ("THE boundary"), pero el resultado es que el mismo email produce 400 en
un checkout y una dirección reescrita (posiblemente buzón muerto, según el JSDoc
de `resolvePayerEmail:113-119`) en el otro.

#### g. Flag `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED`
Nombre real confirmado: `env.HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED`, leído en
`subscription-checkout.service.ts:671`, `:971`, `:1018`, `:1279`, `:1309`, `:1649`
y expuesto públicamente en `routes/billing/public/getCheckoutConfig.ts:71`.
Es **UN solo flag para las cuatro**, simétrico. Default OFF ("dark-by-default",
`getCheckoutConfig.ts:14-16`).

El docblock de `getCheckoutConfig.ts:11-13` afirma:
> "With that flag on, ALL FOUR checkouts (accommodation monthly and annual,
> commerce, partner) create their own `POST /preapproval` and bind `payer_email`
> server-side"

**Medio falso**: las cuatro crean su propio preapproval, pero **partner NO bindea
`payer_email`** (no lo pasa: `:1310-1348` no incluye `payerEmail`). El endpoint
público le dice al front que muestre el diálogo de email para las cuatro.

#### l. `notification_url` — el hallazgo con consecuencia
Tres builders distintos:
- `routes/billing/checkout-return-urls.ts:178-180` → `.../mercadopago?source_news=webhooks` ✅
- `routes/commerce/admin/start-subscription.ts:65-67` → `.../mercadopago` ❌
- `routes/partners/admin/send-link.ts:29-31` → `.../mercadopago` ❌

El router de webhooks descarta toda entrega sin el marcador:
`routes/webhooks/mercadopago/router.ts:209-229` —
`if (sourceNews !== V2_SOURCE_NEWS_MARKER) { ...; return c.json({received:true, dropped:'legacy-ipn-duplicate'}, 200); }`
El JSDoc de `checkout-return-urls.ts:170-176` describe exactamente el daño
(HOS-159): "every subscription webhook MP posts to this notification_url was
silently dropped — no `billing_webhook_events`, no `billing_payments`, and
activation fell back entirely to the polling cron".

**Alcance real**: el `notificationUrl` por-preapproval sólo llega a MercadoPago en
la rama own-preapproval (`createPaidSubscription` → `billing.subscriptions.create({notificationUrl})`,
`paid-subscription-create.ts:243`). Con el flag OFF (producción hoy) es inerte en
Path C. Es **latente hasta que el flag se encienda**, y entonces afecta a partner y
a admin-commerce.

#### m. Guard "ya suscripto" — `past_due`
- Alojamiento: `start-paid.ts:212` usa `isEntitlementGrantingStatus(sub.status)`
  = `['active','trialing','comp','courtesy']`
  (`packages/billing/src/predicates/is-entitlement-granting-status.ts:44`).
  **`past_due` NO está** → un host en dunning puede abrir un segundo checkout.
- Commerce: `start-subscription.ts:136`
  `LIVE_SUBSCRIPTION_STATUSES = new Set([...ENTITLEMENT_GRANTING_STATUSES, 'past_due'])`
  con el porqué escrito en `:121-135`: "a dunning subscription is still a real
  MercadoPago preapproval mid-retry... letting the owner start a SECOND checkout
  here would create a second concurrent preapproval for the same listing".
  El razonamiento aplica idéntico a alojamiento y no está aplicado ahí.
- Partner: **ningún guard**. `send-link.ts` chequea aprobación de contenido
  (`:96-98`) y `planId` (`:100-105`), nada más. Un admin puede reenviar el link
  sobre un partner con suscripción activa. Lo único que lo frena es la idempotencia
  por-partner (§3), que solo cubre `pending_provider`.

#### n. Guard de dominio del plan — hueco alcanzable por el cliente
`initiatePaidMonthlySubscription` resuelve el plan con `resolvePlanBySlug`
(`:154-162`), que hace `billing.plans.listAll()` **sin filtro de dominio**. Los
planes de commerce (`gastronomy-basico/pro`, `experience-*`) son filas reales de
`billing_plans` (fuera de `ALL_PLANS` pero presentes en la tabla). `start-paid.ts`
solo verifica `targetPlan.active === false → PLAN_DISABLED` (`:277-288`), y
`gastronomy-pro` está activo (HOS-1119).

Resultado: `POST /start-paid {planSlug:'gastronomy-pro', billingInterval:'monthly'}`
crea una suscripción con `product_domain` = default `'accommodation'`
(`pending-provider-subscription-create.ts:273`
`input.productDomain ?? ProductDomainEnum.ACCOMMODATION`), que `loadEntitlements`
cuenta como alojamiento.

El guard existe y no se usa acá: `assertAccommodationPlanChangeTarget`
(`billing/plan-domain-guard.ts:287-299`) tiene **un solo call site**,
`routes/billing/plan-change.ts:305` (verificado por grep).

---

## 3. Idempotencia — `checkout-idempotency.ts` completo (Q3)

### 3.a Exportaciones (4 funciones + 3 tipos)

| Export | Líneas | Tipo | Call sites REALES (producción) |
|---|---|---|---|
| `ReusableCheckout` (interface) | `:51-58` | tipo | interno + retorno de las 4 |
| `ResolveReusableCommerceCheckoutInput` | `:73-78` | tipo | — |
| `ResolveReusablePartnerCheckoutInput` | `:81-84` | tipo | — |
| `resolveReusableCommerceCheckout` | `:246-267` | fn | **1**: `subscription-checkout.service.ts:979` |
| `resolveReusablePartnerCheckout` | `:276-296` | fn | **1**: `subscription-checkout.service.ts:1286` |
| `resolveReusableCommerceOwnPreapprovalCheckout` | `:422-449` | fn | **1**: `subscription-checkout.service.ts:972` (+ test `own-preapproval-reuse-drift.test.ts`) |
| `resolveReusablePartnerOwnPreapprovalCheckout` | `:460-482` | fn | **1**: `subscription-checkout.service.ts:1280` |

Internas (no exportadas): `loadCommerceBridge` `:93`, `loadPartnerBridge` `:126`,
`loadCorrelationRow` `:153`, `finalize` `:195`, `readOwnPreapprovalMetadata` `:317`,
`decideOwnPreapprovalReuse` `:342`, `loadOwnPreapprovalSubscriptionRow` `:391`,
constante `OWN_PREAPPROVAL_REUSE_WINDOW_MS = 3h` `:308`.

Grep completo ejecutado:
`rg -n "resolveReusableCommerceCheckout|resolveReusablePartnerCheckout|resolveReusableCommerceOwnPreapprovalCheckout|resolveReusablePartnerOwnPreapprovalCheckout|checkout-idempotency" apps packages scripts docs .specs`
→ fuera de tests, specs y comentarios, **los únicos consumidores son las dos
funciones commerce/partner del servicio de checkout**.

### 3.b Cobertura por camino

| Camino | Idempotencia por entidad | Evidencia |
|---|---|---|
| accommodation **mensual** | ❌ | ningún import ni llamada en `:397-780` |
| accommodation **anual** | ❌ | ningún import ni llamada en `:1519-1729` |
| **gastronomy / experience** mensual | ✅ | `:971-988` |
| **partner** mensual | ✅ | `:1279-1294` |
| **upgrade** (accom + commerce) | ⚠️ solo `idempotencyKey` de proveedor `${currentSubscriptionId}:upgrade:${newPlanId}` `:1966` — es determinista, así que ahí sí dedupica en MP | leído |
| **addon** recurrente | ✅ pero **reimplementado aparte**: `services/addon.checkout.recurring-idempotency.ts` (mismo shape, misma ventana de 3 h, código separado) | leído `:1-70` |
| **checkout-retry** (mint fresco) | ✅ vía claim exclusivo `recoverCancelledPreapproval` — pero solo accommodation (§2.k) | `checkout-retry.ts:165-210` |
| **past-due payment method replacement** | ✅ pero **tercera reimplementación**: `past-due-payment-method-replacement.service.ts:101` y `:151` dicen textualmente "reused verbatim" / "Adapted from `decideOwnPreapprovalReuse`" | leído (grep) |

### 3.c El daño que documenta y no cubre

`checkout-reuse-decision.ts:7-19` describe el bug en primera persona:
> "every click minted a fresh subscription and a fresh, independently payable link.
> Two clicks, two live links, and a buyer who pays both is charged twice for one
> listing. The route-level 409 cannot close this: it keys on
> `{active, trialing, past_due}` and an in-flight checkout sits at
> `pending_provider`, deliberately outside that set."

Ese razonamiento es **literalmente aplicable a `/start-paid`**: su 409 keyea en
`{active,trialing,comp,courtesy}` y un checkout en vuelo está en
`pending_provider`, también fuera del set. La única diferencia es que alojamiento
no tiene bridge row — pero la rama own-preapproval **no necesita bridge row**:
`decideOwnPreapprovalReuse` (`:342-388`) juzga sobre la fila de
`billing_subscriptions` directamente; lo único que la ata a commerce/partner es
cómo se **encuentra** esa fila (`loadCommerceBridge`/`loadPartnerBridge`). Para
alojamiento bastaría un lookup por `(customerId, planId, status='pending_provider')`.
**Esto es evidencia de que la asimetría es ACCIDENTAL, no esencial.**

`checkout-idempotency.ts:15-17` además afirma:
> "Lives in the SERVICE layer on purpose. The owner self-checkout route has a 409
> guard and the two admin routes have none; putting idempotency here covers all
> three at once and keeps a fourth entry point from being born unguarded."

Verificado: "the two admin routes" = `commerce/admin/start-subscription.ts` y
`partners/admin/send-link.ts`; ninguna tiene 409. Correcto. Pero el "fourth entry
point born unguarded" ya nació: `/start-paid` (mensual y anual) nunca estuvo
cubierto.

### 3.d Condiciones de reuso (Path C) — `decideCheckoutReuse` `:148-181`
8 condiciones, todas con refusal tipado (`CheckoutReuseRefusal` `:80-89`):
`no-bridge-row`, `bridge-not-pending-provider`, `no-correlation-row`,
`correlation-not-pending`, `correlation-expired`, `customer-changed`,
`plan-changed`, `mp-plan-changed`, `promo-snapshot-present`.

### 3.e Condiciones de reuso (own-preapproval) — `decideOwnPreapprovalReuse` `:362-381`
Un solo `if` con 9 términos, sin refusal tipado (devuelve `null`). Incluye el
guard fail-closed de HOS-1221 `:368-377`: ambos lados del `mpPreapprovalPlanId`
deben estar presentes, no solo ser iguales. Ventana: 3 h desde `createdAt`.
**Asimetría interna**: la versión Path C es testeable por razón de rechazo, la
own-preapproval no.

---

## 4. Duplicación literal (Q4)

| Bloque | Ubicaciones | Líneas ≈ por copia | Total dup. |
|---|---|---|---|
| Resolver plan + `PLAN_NOT_FOUND` + `NO_*_PRICE` + guard `unitAmount === 0` | `:405-443`, `:889-912`, `:1224-1247`, `:1526-1546` | 20 | ~60 (3 copias redundantes) |
| Llamada `resolveCheckoutMpPlanId({commercialPlanId, customerId, planName, amountCentavos, currency, billingInterval, trialDays: 0, backUrl})` | `:567-594`, `:928-944`, `:1254-1266`, `:1600-1614` | 15 | ~45 |
| `billing.customers.get` + `CUSTOMER_NOT_FOUND` | `:596-602`, `:990-996`, `:1296-1302`, `:1620-1626` | 7 | ~21 |
| Rama own-preapproval (`createOwnPreapprovalSubscription` + return con `expiresAt` sintetizado) | `:671-737`, `:1018-1087`, `:1309-1356`, `:1649-1699` | 55 (≈35 idénticas) | ~105 idénticas / ~165 near-verbatim |
| Rama Path C (`createPendingProviderSubscription` + `buildPreapprovalPlanShareLink` + return) | `:739-779`, `:1089-1152`, `:1358-1400`, `:1701-1728` | 35 | ~105 |
| **Upsert `entitySubscriptions` — duplicado DENTRO de la misma función** | `:1057-1079` **y** `:1119-1141` | 23 | 23 |
| **Upsert `partnerSubscriptions` — duplicado DENTRO de la misma función** | `:1331-1348` **y** `:1373-1390` | 18 | 18 |
| Bloque comentario `trialDays: 0` ("ZERO, stated") | `:583-589`, `:936-939`, `:1321-1324`, `:1669-1673` | 5-10 | ~25 |
| Mapper `SubscriptionCheckoutError` → HTTP | `subscription-checkout-error-http.ts:33-123` (15 casos), `commerce/admin/start-subscription.ts:135-150` (4 casos), `partners/admin/send-link.ts:52-66` (3 casos) | — | 2 reimplementaciones parciales |
| Builder `buildNotificationUrl` | `checkout-return-urls.ts:178`, `commerce/admin/start-subscription.ts:65`, `partners/admin/send-link.ts:29` | 3 | 2 copias divergentes (§2.l) |
| Idempotencia own-preapproval | `checkout-idempotency.ts:342-388`, `addon.checkout.recurring-idempotency.ts`, `past-due-payment-method-replacement.service.ts:151` | ~45 | 2 reimplementaciones declaradas ("Adapted from") |

**Total estimado: ~520-560 líneas duplicadas** sobre ~1050 líneas de cuerpo
efectivo de las cuatro iniciadoras de plan (≈50%). El upsert duplicado *dentro*
de la misma función (41 líneas entre commerce y partner) es el más barato de
eliminar y el que más claramente indica copy-paste entre ramas del flag.

---

## 5. Esenciales vs. accidentales (Q5)

### ACCIDENTALES (parametrizables — la separación no se justifica)

| Diferencia | Por qué es accidental |
|---|---|
| **Idempotencia solo en commerce/partner** | El mecanismo own-preapproval (`decideOwnPreapprovalReuse`) no depende del bridge row; solo el *lookup* lo hace. Un lookup por `(customerId, planId, pending_provider)` cubre alojamiento. Path C sí depende de `billing_pending_checkouts`, que alojamiento **también** escribe (`:739`). Ambas ramas son extensibles sin cambio de modelo. |
| **`past_due` en el 409 de commerce y no en el de alojamiento** | El razonamiento escrito (`start-subscription.ts:121-135`) es sobre el preapproval de MP, idéntico en las dos verticales. |
| **`notification_url` sin marcador en partner/admin-commerce** | Es un builder copiado antes de HOS-159. Un import del compartido lo arregla. |
| **Tres mappers de error** | El compartido (`subscription-checkout-error-http.ts`) es exhaustivo (`never` check `:118`). Los locales son subconjuntos: `PLAN_NOT_PURCHASABLE` da 500 en partner y admin-commerce en vez de 422; `CUSTOMER_NOT_FOUND` da 500 en partner en vez de 404. |
| **Sin guard de dominio en `/start-paid`** | `assertAccommodationPlanChangeTarget` ya existe y ya se usa en plan-change. |
| **Promo codes solo en alojamiento** | El resolver (`resolveCheckoutPromoPlan`) es agnóstico de dominio (`subscription-checkout-promo.service.ts:98-144` toma `promoCode/userId/planId/amount`). Nada en él impide un plan de gastronomía. La restricción `validPlans` del propio código de promo ya cubre el scoping. Es un campo que las rutas no exponen, no una imposibilidad. |
| **`discount` bloqueado en anual** | Declarado explícitamente como temporal: "until annual is migrated to the born-discounted design" (`:1571-1580`). |
| **Locale hardcodeado en admin-commerce** (`${HOSPEDA_ADMIN_URL}/commerce/listings`) | El comentario dice "the exact landing page is not load-bearing" (`:71-74`), pero el checkout protected sí resuelve locale. Parametrizable. |
| **Gate de completitud solo en la ruta protected de commerce** | La ruta admin salta el gate H-154/AC-5 entero. |
| **`sanitizeEmailForMercadoPago` en upgrade vs. throw en checkout** | Dos políticas para el mismo carácter `+`. `resolvePayerEmail:113-119` argumenta que reescribir produce un buzón muerto; ese argumento aplica igual al upgrade. |
| **`checkout-retry` solo accommodation** | `RETRY_SUPPORTED_PRODUCT_DOMAINS` (`preapproval-recovery.service.ts:283`) se auto-declara como limitación conocida: "deliberately out of scope for this change (reported as a known limitation, not silently unsupported)". Necesita re-resolver el puntero de entidad — que **está en `metadata.commerceEntityType/commerceEntityId`** (`subscription-domain-metadata.ts:78-108`, `readSubscriptionDomainMetadata`). El dato existe; falta cablearlo. |
| **Upsert de bridge row duplicado dentro de cada función** | Copy-paste puro entre las dos ramas del flag. |

### ESENCIALES (justificadas por modelo de datos/producto)

| Diferencia | Justificación verificada |
|---|---|
| **Partner no resuelve payer email** | `:1193-1212` + `pending-provider-subscription-create.ts:130-142`: el customer partner lleva `partner-<id>@partners.hospeda.invalid`; `verifyPreapprovalOwnership` trata el snapshot como VETO, y un valor que nunca puede coincidir convierte todo link por webhook en rechazo permanente. Un snapshot ausente nunca bloquea. **Correcto.** |
| **Partner sin trial** | Marca externa que paga por link generado por admin; no hay cuenta a la que otorgarle un trial local. |
| **Partner con return URL pública sin locale del comprador** | `checkout-return-urls.ts:152-158`: no hay cuenta de la cual leer preferencia, y la del admin no es la del comprador. |
| **Partner sin `link-preapproval` (F2)** | `:1196-1203`: el back_url es session-authenticated y apunta al admin; el comprador no tiene sesión. Linkeo solo por webhook (Tier 2 nonce / Tier 3 heurística). |
| **Commerce escribe `entity_subscriptions` y alojamiento no** | `CLAUDE.md` + `commerce-trial-start.service.ts:275-283`: alojamiento resuelve sus listados desde `accommodations.owner_id`; commerce necesita el mapeo explícito. |
| **Commerce tiene rama "attach"** (`start-subscription.ts:392-461`) | Modelo per-owner (HOS-688): una suscripción cubre N listados de la vertical. Alojamiento no tiene análogo porque la suscripción cubre al dueño entero. |
| **Anual solo para alojamiento** | Los planes de commerce/partner no tienen fila de precio `'year'` (`findAnnualPrice` devolvería `null` → `NO_ANNUAL_PRICE`). Es una decisión de catálogo, no de código. |
| **`initiatePaidPlanUpgrade` usa `billing.checkout.create` mode `payment`** | Es un cobro one-time del prorrateo, no una suscripción; no le corresponde ni preapproval ni share link. |

### ZONA GRIS
- **`product_domain` implícito para alojamiento** (default de columna) vs. explícito
  para commerce/partner. Documentado como intencional
  (`own-preapproval-subscription-create.ts:160-165`: "matching the paso-1 behavior
  byte for byte"). Funciona por el fail-open de `subscriptionMatchesDomain`, pero
  es exactamente lo que hace explotable el hueco de §2.n.

---

## 6. ¿Tiene consumidor `commerce/admin/start-subscription.ts`? (Q6)

**NO.**

Evidencia:
- `rg -n "start-subscription" apps/admin` → **cero resultados**.
- `rg -n "commerce/listings" apps/admin/src` → **cero resultados**.
- `rg -ln "commerce" apps/admin/src` → 20 archivos, ninguno de billing/commerce
  listings (son `gastronomy/config/*`, `content-media`, `billing-subscriptions`,
  `media-alt.utils`).
- Las únicas menciones repo-wide de la ruta están en documentación y tests:
  - `docs/decisions/ADR-035-...:125`
  - `docs/billing/endpoint-gate-matrix.md:926`
  - `apps/api/docs/route-architecture.md:719`
  - `apps/api/src/middlewares/past-due-grace.middleware.ts:97` (comentario)
  - `apps/api/src/middlewares/trial.ts:74` (comentario)
  - `apps/api/test/commerce/start-subscription.test.ts` (test del gate)
  - `apps/api/test/middlewares/trial.test.ts:353`
- La ruta se monta: `apps/api/src/routes/commerce/admin/index.ts:13,18`.

Está montada, viva, sin gate de completitud, sin 409, sin idempotency-key
middleware, con mapper de errores truncado y con `notification_url` sin marcador —
y **nadie la llama**. Candidata clara a retiro (con la salvedad de que sea usada
manualmente por curl/Postman por operaciones; eso no es verificable desde el repo).

---

## 7. Comentarios y docblocks FALSOS o CADUCOS encontrados

Cada uno verificado contra el código que describe.

| # | Ubicación | Afirmación | Realidad |
|---|---|---|---|
| C1 | `billing/paid-subscription-create.ts:104` | "Omit it to keep the inherited behavior (**all four plan checkouts do**)" sobre `trialDays` | **Falso.** Las cuatro pasan `trialDays: 0` EXPLÍCITO (`:688`, `:1038`, `:1324`, `:1673`), y `CreateOwnPreapprovalSubscriptionInput` lo declara **required** (`own-preapproval-subscription-create.ts:137`). El comentario describe el mundo pre-HOS-1221. |
| C2 | `billing/payer-email.ts:157-160` | "**all five** checkout call sites in `subscription-checkout.service.ts`... accommodation monthly, annual, commerce and **partner alike**" | **Falso.** Son **tres** (`:611`, `:1012`, `:1635`), y partner **no llama** — con razón documentada en `:1193-1212`. |
| C3 | `routes/billing/public/getCheckoutConfig.ts:11-13` | "ALL FOUR checkouts... create their own `POST /preapproval` **and bind `payer_email` server-side**" | **Medio falso.** Partner crea el preapproval pero NO pasa `payerEmail` (`:1310-1348`). |
| C4 | `routes/billing/start-paid.ts:20-28` (docblock de módulo) | "`trial_extension` -> extra `freeTrialDays` on the preapproval's `free_trial`" y "`comp` -> a `status='comp'` subscription... the response carries `appliedEffect: 'comp'`" | **Ambas falsas.** HOS-1012 eliminó todo trial hacia MP (guard G-1); HOS-1171 eliminó la rama comp (`:467-485` la documenta como borrada, y `subscription-checkout-promo.service.ts:182-217` devuelve `invalid` para comp). |
| C5 | `subscription-checkout.service.ts:789` | "No promo support — **commerce listings have no trial promos**" | La conclusión (sin promo) es correcta hoy, pero la RAZÓN es caduca: ningún checkout tiene trial promos ya. La razón real es que las rutas de commerce no exponen el campo. |
| C6 | `routes/commerce/protected/start-subscription.ts:453-455` | "An in-app sentinel, **exactly as the `comp` branch of the accommodation checkout does**" | **Falso.** Esa rama fue borrada por HOS-1171. |
| C7 | `apps/web/src/lib/commerce/owner-listings.ts:269-271` | "a fresh `X-Idempotency-Key` per call, **so a retried click cannot open two changes**" | **Falso como causalidad.** Una key fresca por click es exactamente lo que hace que dos clicks NO se dedupliquen; lo que protege a commerce es la idempotencia de servicio, no el header. Contradicho por `addon.checkout.recurring-idempotency.ts:14-16`. |
| C8 | `subscription-checkout.service.ts:11-15` (docblock de módulo) | "**All four** entry points — accommodation monthly, accommodation annual, commerce and partner — carry BOTH flows" | Correcto respecto del flag, pero el módulo exporta **cinco** iniciadoras; `initiatePaidPlanUpgrade` no lleva ninguna de las dos ramas y el docblock no lo menciona. |
| C9 | `subscription-checkout.service.ts:1502-1513` (JSDoc de `initiatePaidAnnualSubscription`) | "Initiate a paid annual subscription via qzpay-core's `billing.checkout.create({ mode: 'payment' })` one-time flow" y "the local row is inserted directly into `billing_subscriptions`" | **Caduco.** El propio input JSDoc de arriba (`:1406-1417`) dice que esas descripciones "are obsolete" desde HOS-171/HOS-191, y el cuerpo usa Path C / own-preapproval. Dos docblocks contiguos que se contradicen. |
| C10 | `subscription-checkout.service.ts:1449-1459` | "`comp` → a `status='comp'` subscription, NO MercadoPago charge. Wins outright over a trial." | **Falso.** HOS-1171 eliminó comp del checkout. |

---

## 8. Lo que SÍ es simétrico (mapa positivo)

| Aspecto | Estado |
|---|---|
| `resolveCheckoutMpPlanId` / `resolveOrProvisionMpPlan` | **Simétrico.** Agnóstico de dominio; keyed por `(commercialPlanId, billingInterval, trialDays, amount, discount)`. `mp-plan-provisioning.service.ts:451-505`. Las cuatro lo llaman con la misma forma. |
| `trialDays: 0` literal hacia MP | **Simétrico** en las cuatro (`:589`, `:939`, `:1262`, `:1609`), congelado por guard G-1. |
| Guard de plan gratuito `unitAmount === 0` → `PLAN_NOT_PURCHASABLE` | **Simétrico** en las cuatro. |
| Flag `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` | **Un solo flag**, las cuatro lo leen, expuesto una sola vez al front. |
| `createOwnPreapprovalSubscription` / `createPaidSubscription` | **Simétrico.** Una sola implementación del payload de preapproval; cancel compensatorio (Hueco A) igual para todas (`own-preapproval-subscription-create.ts:389-412`). |
| `createPendingProviderSubscription` (Path C) | **Simétrico.** Transacción única con bridge row opcional (`writeDomainLinkRow`), supersede HOS-276 igual para todas. |
| Ventana TTL: `PENDING_PROVIDER_TTL_MS` 30 min (cron) + `PENDING_CHECKOUT_TTL_MS` 3 h (correlación) | **Simétrico.** Un solo par de constantes. |
| `link-preapproval` (F2) | **Agnóstico de dominio** — keyea por `(customerId, localSubscriptionId)`. Funciona para commerce; inaplicable a partner por falta de sesión (esencial). |
| `resolveTrialEligibility` + `createTrialSubscription` | **Simétrico** — keyed en `(customerId, productDomain)`; `createTrialSubscription` re-lee el `product_domain` del plan y rechaza cross-vertical (`subscription-trial-create.service.ts:166`). |
| `resolveCommercePlanSlug` | **Único punto** vertical→slug, con guard de CI (`scripts/check-commerce-plan-resolution.sh`) y validación de la vertical del slug pedido. Mejor que el lado alojamiento, que no tiene equivalente. |
| `readSubscriptionDomainMetadata` / `isPublishingSubscriptionStatus` | **Simétrico** — un solo lector de coordenadas de dominio para commerce y partner. |
| `resolveReturnUrlLocale` + builders de `checkout-return-urls.ts` | **Simétrico** entre alojamiento y commerce-protected; las dos divergencias son admin-commerce (hardcoded) y partner (default, justificado). |
| `isEntitlementGrantingStatus` | **Simétrico** — un solo set canónico derivado de una constante. |
| `subscriptionMatchesDomain` | **Simétrico** — único comparador de dominio en todo el repo. |

---

## 9. Preguntas abiertas / NO VERIFICADO

1. **NO VERIFICADO**: si `commerce/admin/start-subscription.ts` es usado
   manualmente por operaciones (curl/Postman). Desde el repo no hay consumidor.
2. **NO VERIFICADO**: si el `notification_url` a nivel dashboard de MercadoPago
   compensa el marcador faltante en partner/admin-commerce (requiere leer la config
   de MP, fuera del repo). El comentario de `checkout-return-urls.ts:172-176` sugiere
   que MP usa el del preapproval cuando está seteado.
3. **VERIFICADO — divergencia real de unions.**
   `packages/schemas/src/api/billing/start-paid.schema.ts:190` declara
   `appliedEffect: z.enum(['comp','discount','attached','trial'])` (4 variantes),
   mientras el tipo del servicio `CheckoutAppliedEffect`
   (`subscription-checkout.service.ts:343`) declara solo `'comp' | 'discount'`.
   Quién produce qué:
   - `'discount'` → alojamiento mensual (`:734`, `:777`). ✅
   - `'comp'` → **nadie** (borrado por HOS-1171; el propio comentario `:482-485`
     lo dice: "Nothing produces the value any more").
   - `'attached'` → solo la ruta de commerce (`start-subscription.ts:459`).
   - `'trial'` → solo la ruta de commerce (`start-subscription.ts:502`).
   Las dos variantes de commerce nunca pasan por el tipo del servicio (la ruta
   arma el objeto a mano y tipa contra el schema). Resultado: el union del
   servicio y el del cable describen dominios distintos, y una variante muerta
   (`'comp'`) convive con dos que el servicio no conoce.
   Además, `trialGranted: z.literal(true)` (`start-paid.schema.ts:207`) sigue en
   el schema y **nadie lo produce** — `start-paid.ts:417` emite la constante
   `trial_granted: false` a analytics y el servicio no devuelve el campo.
4. **NO VERIFICADO**: si algún cliente envía `promoCode` a las rutas de commerce
   (el schema no lo acepta, así que sería descartado).
5. **NO VERIFICADO**: si `commerce/protected/change-plan.ts` (que llama
   `initiatePaidPlanUpgrade`) replica los guards de `plan-change.ts`. Fuera del
   carril de checkout/alta; corresponde al carril de plan-change.
