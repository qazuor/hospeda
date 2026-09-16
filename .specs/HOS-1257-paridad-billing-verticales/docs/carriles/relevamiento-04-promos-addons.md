# Relevamiento 04 — Promo codes, cortesías/comp y addons, paridad entre verticales

Worktree: `/home/qazuor/projects/WEBS/hospeda-hos-1257-paridad-billing-verticales`
HEAD: `5c205fc70` (Merge PR #3288, `spec/HOS-1233-docs`)
Método: sólo `Read` / `rg` / `Glob`. Sin codegraph. Read-only.
Fecha: 2026-09-08

---

## Q1 — ¿El motor de promo codes filtra por `productDomain` en algún lado?

**Respuesta: NO. En NINGÚN lado. Cero referencias de dominio en todo el motor de promos.**

Grep ejecutado sobre los 8 archivos del motor en `packages/service-core/src/services/billing/promo-code/`
con el patrón `productDomain|product_domain|gastronomy|experience|accommodation|commerce|domain` (case-insensitive):

```
packages/service-core/src/services/billing/promo-code/promo-code.renewal.ts:51:
    import { loadSubscriptionDiscountState } from '../subscription/subscription-product-domain.js';
```

**Ese es el ÚNICO hit, y es un falso positivo**: `loadSubscriptionDiscountState`
vive en un archivo llamado `subscription-product-domain.ts` pero NO lee ni filtra
`product_domain`. Verificado leyendo la función completa
(`packages/service-core/src/services/billing/subscription/subscription-product-domain.ts:398-418`):
selecciona `id, status, planId, customerId, mpSubscriptionId, promoCodeId,
promoEffectRemainingCycles` — no incluye `productDomain` en el SELECT ni en el WHERE.

Segundo grep, sobre los archivos API del carril de promos
(`promo-code.trial-extension.ts`, `promo-code.redemption.ts`, `promo-code.renewal.ts`,
`effect-reducer.ts`, `promo-code.service.ts`, `promo-code-defaults.ts`,
`apps/api/src/routes/billing/promo-codes.ts`, `apps/api/src/services/promo-renewal-mp.service.ts`,
`apps/api/src/services/subscription-discount-signup.service.ts`) con el patrón
`productDomain|accommodation|gastronomy|experience|commerce|isAccommodationSubscription|subscriptionMatchesDomain`:
**salida vacía (0 hits)**.

### Sitios donde SÍ hay filtro de dominio en el perímetro (no en el motor)

| Sitio | Archivo:línea | Qué filtra |
|---|---|---|
| Creación de comp | `apps/api/src/services/subscription-comp-create.service.ts:120-127` | RECHAZA todo plan cuyo `product_domain` no sea `accommodation` (NULL = accommodation) |
| Gate de compra de addon | `apps/api/src/services/addon.checkout.ts:445-475` | `subscriptionMatchesDomain(sub, addon.productDomain)` |
| Grant de entitlement/límite de addon | `apps/api/src/services/addon-entitlement.service.ts:153, 458, 725` | `isAccommodationSubscription(sub)` — **accommodation-only** |
| Recálculo de límites de addon | `packages/service-core/src/services/billing/addon/addon-limit-recalculation.service.ts:17,22-23` | `productDomainForLimitKey` + `subscriptionMatchesDomain` (correcto por vertical) |
| Cron reconcile de addon-sub | `apps/api/src/cron/jobs/addon-subscription-reconcile.job.ts:242` | `eq(billingSubscriptions.productDomain, ProductDomainEnum.ADDON)` |
| Catálogo de addons | `packages/billing/src/config/addons.config.ts` | `productDomain` declarado por addon |
| Gate del catálogo en web | `apps/web/src/lib/billing/addon-domain.ts` | lee `AddonResponse.productDomain` |

### Restricciones que el motor SÍ evalúa (todas domain-blind)

`packages/service-core/src/services/billing/promo-code/promo-code.validation.ts:97-232`:
`active` (117), `expiresAt` (125), `maxUses` vs `timesRedeemed` (133),
`maxPerCustomer` (143-157 → `checkUserRedemptionLimitExceeded`, 414-468),
`validPlans` (159-167 — lista de **planId**, no de dominio),
`newCustomersOnly` (169-185 → `checkUserHasExistingPlanSubscription`, 350-387),
`metadata.minAmount` (187-196).

`validPlans` es el único vector con el que un operador podría restringir un
código a una vertical: enumerando a mano los UUIDs de los planes de esa vertical.
No hay columna de dominio en `billing_promo_codes`
(`promo-code.crud.ts:142-143, 259-260` mapea sólo `validPlans` / `newCustomersOnly`).

---

## Q2 — Canje post-alta: ¿puede un dueño de gastronomía/experiencia canjear un promo sobre su suscripción?

**Sí, sin ningún filtro de dominio explícito NI implícito.** No hay resolución por
`accommodations.owner_id` en ningún punto del camino.

`apps/api/src/routes/billing/promo-codes.apply.ts` (428 líneas, leído completo).
Cadena exacta:

1. **`billingCustomerId`** del contexto (122). 422 si falta.
2. **Guard de propiedad del customer** (140-142): si el body trae `customerId`
   distinto del propio y el actor no tiene `ACCESS_API_ADMIN` → 403.
3. **`assertSubscriptionOwnership`** (159-172 → `promo-code.validation.ts:508-551`):
   compara `billing_subscriptions.customer_id` contra el `billingCustomerId` del
   llamador. **Compara CUSTOMER, no dominio ni entidad.** No toca `accommodations`.
4. **Peek del efecto** (192-193): `service.getByCode(code)`.
5. **Gate de comp** (202): `assertPromoCodeIsNotComp` — refuse para todos.
6. Rama `discount` con `subscriptionId` (205-255) → `applyMultiCycleDiscountToExistingSubscription`.
7. Rama `trial_extension` (280-331) → `applyTrialExtensionToRunningTrial`.
8. Fallback `service.apply` (339).

Ninguno de esos pasos lee `product_domain`, `accommodations`, `gastronomies` ni
`experiences`. Un dueño de gastronomía con `subscriptionId` de su suscripción de
gastronomía pasa los 3 guards y aplica el descuento.

**Confirmado en el seam de descuento**: `apps/api/src/services/promo-discount-apply.service.ts:107`
llama `loadSubscriptionDiscountState({subscriptionId, tx})` — el SELECT domain-blind
verificado arriba. Requiere sólo `mp_subscription_id` no nulo (117-126). Las
suscripciones de comercio SÍ tienen preapproval (`initiateCommerceMonthlySubscription`
crea un preapproval mensual), así que la rama es alcanzable.

**Salvedad de la UI**: la web no expone el campo. `apps/web/src/components/commerce/CommerceListingActions.client.tsx:10`:
> "(HOS-151), stripped down to what commerce actually needs: **no promo codes**"

Así que el canje existe por API y no por producto.

---

## Q3 — Promo en el checkout: TODOS los call sites

Grep `resolveCheckoutPromoPlan|CheckoutPromoPlan` sobre `apps packages scripts`.
Call sites NO-test: **exactamente dos**, ambos en `apps/api/src/services/subscription-checkout.service.ts`.

| Función de checkout | Línea de definición | ¿Llama `resolveCheckoutPromoPlan`? | Vertical |
|---|---|---|---|
| `initiatePaidMonthlySubscription` | 397 | **SÍ** — línea 457 | accommodation + turista |
| `initiateCommerceMonthlySubscription` | 876 | **NO** | gastronomía + experiencia |
| `initiatePartnerMonthlySubscription` | 1219 | **NO** | partner |
| `initiatePaidAnnualSubscription` | 1519 | **SÍ** — línea 1550 (pero rechaza `discount`, ver abajo) | accommodation |
| `initiatePaidPlanUpgrade` | 1813 | **NO** | (cambio de plan, no alta) |

El comercio no sólo no lo llama: lo declara.
`subscription-checkout.service.ts:~1030`, en la construcción del preapproval propio:
> "// No `providerUnitAmountOverride`: **commerce checkout resolves no promo code**, so there is no cycle-1 discount to override with."

**Superficie HTTP**, coherente con lo anterior:
- `apps/api/src/routes/billing/start-paid.ts:112` acepta `promoCode?: string`
  y lo reenvía a ambos initiators (354, 369). Schema:
  `packages/schemas/src/api/billing/start-paid.schema.ts:51-54`.
- `apps/api/src/routes/commerce/protected/start-subscription.ts` y
  `apps/api/src/routes/commerce/admin/start-subscription.ts`: grep de `promo`
  → **0 hits**. No hay campo en el body, no se pasa nada.
- `apps/api/src/routes/partners/admin/send-link.ts`: grep de `promo` → **0 hits**.

**Además, anual ≠ mensual dentro de accommodation** (asimetría interna, no entre verticales):
`subscription-checkout.service.ts:1587-1595` (HOS-244) rechaza explícitamente
`promoPlan.kind === 'discount'` en el checkout anual con `INVALID_PROMO_CODE`.
Trial-extension y comp no se ven afectados ahí.

---

## Q4 — Los 3 `effect_kind` a través de las 3 verticales

### `discount`
| Camino | Accommodation | Gastronomía / Experiencia |
|---|---|---|
| Alta (checkout mensual) | **SÍ** — `resolveCheckoutPromoPlan` → `{kind:'discount'}` → `providerUnitAmountOverride` en el preapproval | **NO** — no hay resolución de promo |
| Alta (checkout anual) | **NO** — rechazado por HOS-244 (`:1587`) | N/A (no hay anual de comercio) |
| Post-alta (`/apply` con `subscriptionId`) | **SÍ** | **SÍ** — domain-blind, verificado arriba |
| Renovación (decremento de ciclos) | **SÍ** — `resolveRenewalPromoEffect` desde `subscription-payment-handler.ts:726` | **SÍ** — el handler no filtra dominio; `loadSubscriptionDiscountState` tampoco |
| Restore-full en MP | **SÍ** — `restoreFullPriceMutation` (`subscription-payment-handler.ts:80,765`) | **SÍ** — mismo handler |

Fila de DB: `billing_subscriptions.promo_effect_remaining_cycles` +
`promo_code_id`, ambas domain-blind.

### `trial_extension`
| Camino | Accommodation | Gastronomía / Experiencia |
|---|---|---|
| Alta | validado pero **no aplica en ninguna** — HOS-1012 T-021 sacó el trial de MP de todos los checkouts | ni siquiera validado (no hay resolución) |
| Post-alta (`/apply`) | **SÍ** | **SÍ** (ver Q5) |

### `comp`
| Camino | Accommodation | Gastronomía / Experiencia |
|---|---|---|
| Alta | **NO** — `subscription-checkout-promo.service.ts:182-217` responde `invalid` (HOS-1171) | **NO** |
| `/apply` | **NO** — `assertPromoCodeIsNotComp` (`promo-codes.apply.ts:202`) | **NO** |
| Admin grant-comp | **SÍ** | **NO** — rechazado por dominio (ver Q6) |

---

## Q5 — Trial extension sobre una suscripción de comercio: traza completa

**Resultado: FUNCIONA, y además puede aplicar sobre la vertical EQUIVOCADA.**

Traza:

1. `promo-codes.apply.ts:280` — rama `TRIAL_EXTENSION`, sin filtro de dominio.
2. `apps/api/src/services/promo-trial-extension-apply.service.ts:140`
   `applyTrialExtensionToRunningTrial`.
3. Si no vino `subscriptionId`, resuelve el objetivo con
   `findRunningTrialSubscriptionId` (:89-105):
   ```ts
   .where(and(
       eq(billingSubscriptions.customerId, input.billingCustomerId),
       eq(billingSubscriptions.status, SubscriptionStatusEnum.TRIALING)
   ))
   .orderBy(desc(billingSubscriptions.createdAt))
   .limit(1)
   ```
   **Sin `productDomain` en el WHERE.** Toma el trial más reciente del customer,
   sea de la vertical que sea.
4. `extendExistingSubscriptionTrial`
   (`packages/service-core/src/services/billing/promo-code/promo-code.trial-extension.ts:196`)
   — verificado sin ninguna referencia de dominio (grep vacío). Empuja `trial_end`
   en la fila y escribe la usage row en una transacción.

**Los trials de comercio existen**: `apps/api/src/services/commerce-trial-start.service.ts:296`
`startCommerceListingTrial` inserta `status: 'trialing'` (:352) con
`productDomain` de la vertical (:305, :338, :371), y lo llama
`apps/api/src/routes/commerce/protected/start-subscription.ts`.

Conclusión: **no rompe y no es no-op — funciona.** Pero con un dueño dual
(host + gastronomía, `host-provider@local.test` está sembrado justamente para
probar esa combinación) el código extiende el trial más nuevo, que puede ser el
de otra vertical que la que el dueño creía estar extendiendo. No hay forma de
apuntarlo salvo pasando `subscriptionId` explícito, dato que la web no expone.

---

## Q6 — Cortesías y comp

### `comp` — DISCRIMINA POR DOMINIO, duro

`apps/api/src/services/subscription-comp-create.service.ts:109-127`:
```ts
const [planRow] = await db
    .select({ productDomain: billingPlans.productDomain })
    .from(billingPlans).where(eq(billingPlans.id, planId)).limit(1);
if (!planRow) throw new Error(`createCompSubscription: plan '${planId}' not found`);
if (planRow.productDomain !== null &&
    planRow.productDomain !== ProductDomainEnum.ACCOMMODATION) {
    throw new Error(
      `createCompSubscription: plan '${planId}' is domain '${planRow.productDomain}' — only accommodation plans can be comped`);
}
```
Y la fila insertada se estampa `productDomain: ProductDomainEnum.ACCOMMODATION`
por UPDATE explícito (:166-172).

El error se mapea a `INVALID_PLAN` en
`apps/api/src/services/subscription-comp-grant.service.ts:~592` (`message.includes('only accommodation plans can be comped')`),
y la descripción OpenAPI lo declara:
`apps/api/src/routes/billing/admin/subscription-comp.ts:143`
> "Only accommodation-domain plans can be comped."

**Un dueño de gastronomía o experiencia NO puede recibir un comp. No hay camino alternativo.**

### `comp` — efecto colateral cross-vertical del supersede

`subscription-comp-grant.service.ts:362-374`: lee **todas** las suscripciones del
customer (`eq(customerId), isNull(deletedAt)`), sin filtro de dominio.
`:396` `const supersedable = allRows.filter(isSupersedableStatus)` — y
`NO_ACTION_STATUSES` (:151-156) sólo excluye `cancelled/expired/abandoned/comp`.

Entonces, otorgar un comp de alojamiento a un dueño que también tiene una
suscripción de gastronomía **hard-cancela el preapproval de gastronomía**
(`hardCancelPreapprovalBestEffort`) y marca la fila `cancelled` — mientras el
comp resultante sólo restituye entitlements de accommodation.

Peor: el loop de supersede (verificado en :420-530) escribe SÓLO
`billing_subscriptions.status` + un evento de auditoría. **No llama
`reconcileSubscriptionLinkedEntities` para las filas superseded.** Sólo se lo
llama una vez, para la fila nueva de comp (:617-621). Y el backstop
`entity-subscription-cache-reconcile.job.ts:36` declara:
> "Only the ACCOMMODATION rows are touched. Commerce rows are a link table, not..."
(confirmado en el código: `:194, :221-222, :259` filtran por `ACCOMMODATION_ENTITY_TYPE`).

Resultado: `entity_subscriptions` de esa gastronomía queda con `status='active'`
mientras el preapproval está cancelado — el listing sigue público sin cobro, y
ningún cron lo corrige.

### `courtesy` — DOMAIN-BLIND, simétrica

Grep de `productDomain|accommodation|gastronomy|experience|commerce` sobre
`apps/api/src/services/courtesy-grant.service.ts`,
`packages/service-core/src/services/billing/subscription/courtesy-fields.ts`,
`courtesy-grant.calc.ts` y `apps/api/src/cron/jobs/courtesy-expiry.job.ts`:
**cero hits de filtro** (el único hit en `courtesy-fields.ts:125` es un comentario
que menciona `productDomain` de otro módulo).

- Gate de estado: `courtesy-grant.service.ts:97`
  `GRANTABLE_STATUSES = new Set([SubscriptionStatusEnum.ACTIVE])` — sin dominio.
- Ruta: `apps/api/src/routes/billing/admin/subscription-courtesy.ts` — sólo
  `BILLING_MANAGE` (:96) + `assertSubscriptionOwnership` (:133) para no-admin.
  Ninguna mención de dominio.
- Efecto: `status = SubscriptionStatusEnum.COURTESY` (:324).

Y `courtesy` **sí** está en el set canónico de estados que otorgan:
`packages/billing/src/predicates/is-entitlement-granting-status.ts:44`
```ts
export const ENTITLEMENT_GRANTING_STATUSES = ['active','trialing','comp','courtesy'] as const;
```
que es el que consume `packages/service-core/src/services/commerce/commerce-visibility.ts:30,221`.
Así que una cortesía sobre una suscripción de gastronomía mantiene el listing
público. **Simétrico y correcto.**

Comp está en el mismo set — pero como comp nunca se puede crear para comercio,
esa mitad del set es inalcanzable en las verticales de comercio.

---

## Q7 — Addons

### Catálogo y dominio (`packages/billing/src/config/addons.config.ts`)

| Slug | `productDomain` | `affectsLimitKey` / `grantsEntitlement` | `isActive` |
|---|---|---|---|
| `visibility-boost-7d` | `ACCOMMODATION` (:22) | grants `FEATURED_LISTING` | true |
| `visibility-boost-30d` | `ACCOMMODATION` (:41) | grants `FEATURED_LISTING` | true |
| `extra-photos-20` | `ACCOMMODATION` (:64) | `MAX_PHOTOS_PER_ACCOMMODATION` +20 | true |
| `extra-accommodations-5` | `ACCOMMODATION` (:83) | `MAX_ACCOMMODATIONS` +5 | true |
| `extra-properties-5` | `ACCOMMODATION` (:100) | `MAX_PROPERTIES` +5 | true |
| `ai-support-monthly` | `ACCOMMODATION` (:127) | `MAX_AI_SUPPORT_PER_MONTH` +100 / `AI_SUPPORT` | **false** |
| `extra-gastronomies-1` | `GASTRONOMY` (:~172) | `MAX_GASTRONOMIES` +1 | true |
| `extra-experiences-1` | `EXPERIENCE` (:~190) | `MAX_EXPERIENCES` +1 | true |
| `private-galleries-5/10/20` | `EXPERIENCE` (factory) | `MAX_ACTIVE_PRIVATE_GALLERIES` / `MANAGE_EXPERIENCE_PRIVATE_GALLERIES` | **false** (los 3) |

Recuento vivo: **5 accommodation, 1 gastronomía, 1 experiencia.** Los 3 packs de
galería son de experiencia pero están apagados a propósito (el feature no existe).

`ALL_ADDONS` los reúne y `productDomainForAddonSlug(slug)` devuelve `undefined`
para slugs desconocidos (fail-closed declarado).

### Gate de compra — CORRECTO por vertical

`apps/api/src/services/addon.checkout.ts:445-475`:
```ts
const addonProductDomain = addon.productDomain;
if (!addonProductDomain) return { error: { code: 'ADDON_DOMAIN_UNKNOWN', ... } };
const activeSubscription = grantingSubscriptions.find((sub) =>
    subscriptionMatchesDomain(sub, addonProductDomain));
if (!activeSubscription) return { error: { code: 'ADDON_NOT_AVAILABLE_FOR_DOMAIN', ... } };
```
Un dueño de gastronomía con suscripción de gastronomía **pasa** este gate para
`extra-gastronomies-1`.

### Grant post-pago — ACCOMMODATION-ONLY (rompe comercio)

`confirmAddonPurchase` (`addon.checkout.ts:946`) resuelve la suscripción con
`!isAddonSubscription(sub)` (:977, :1029) — domain-blind, elige la de gastronomía.
Inserta la fila en `billing_addon_purchases`. Después, `:1293`:
```ts
const grantResult = await entitlementService.applyAddonEntitlements({...});
```

`apps/api/src/services/addon-entitlement.service.ts:97` `applyAddonEntitlements`,
líneas 143-166:
```ts
const subscriptions = await hydrateSubscriptionProductDomains(rawSubscriptions);
// SPEC-239 T-034: filter to accommodation-domain subscriptions only.
const activeSubscription = subscriptions.find(
    (sub) => isEntitlementGrantingStatus(sub.status) && isAccommodationSubscription(sub));
if (!activeSubscription) {
    return { success: false, error: { code: 'NO_ACTIVE_SUBSCRIPTION', ... } };
}
```
Y es esta función la ÚNICA que escribe el override de límite
(`this.billing.limits.set(...)`, :315-321) y el grant de entitlement
(`this.billing.entitlements.grant(...)`, :176-182).

`addon.checkout.ts:1299-1330` trata el fallo como no fatal: warn + marca
`needsEntitlementSync: true` para que el barrido del cron reintente… el mismo
camino accommodation-only.

**El cobro se consuma y el cupo nunca sube.** Y es exactamente ahí donde el
comercio lee su cupo: `apps/api/src/middlewares/commerce-entitlement.ts:416-419`
```ts
const customerLimits = await billing.limits.getByCustomerId(customerId);
for (const cl of customerLimits) { if (isLimitKey(cl.limitKey) && cl.limitKey === limitKey) ... }
```
con el comentario en :261-263 que declara la intención:
> "a customer-level limit override — this is how a purchased [add-on] ... (AC-15)"

Sub-caso dual (host + gastronomía): el filtro SÍ encuentra una suscripción — la
de **alojamiento** — y computa `basePlanLimit = planLimits['max_gastronomies'] ?? 0`
(:246-256) del plan de alojamiento, que no declara esa clave → `0`. Luego
`newMaxValue = 0 + 1 = 1` (:313) y lo escribe. Si el plan de gastronomía tenía
base 1, el addon deja el cupo en 1 en vez de 2 — y con packs mayores, lo puede
BAJAR respecto de la base del plan.

Otros consumidores con el mismo filtro accommodation-only:
`addon-entitlement.service.ts:458` (`removeAddonEntitlements`) y `:725`
(`getCustomerAddonAdjustments`). Por simetría: un addon de comercio tampoco se
revoca al cancelar.

En contraste, `recalculateAddonLimitsForCustomer`
(`packages/service-core/src/services/billing/addon/addon-limit-recalculation.service.ts:17,22-23`)
SÍ usa `productDomainForLimitKey` + `subscriptionMatchesDomain`, es decir, resuelve
bien por vertical — pero sólo corre en cambio de plan y en cancelación individual,
nunca en la compra.

### Idempotencia del checkout de addon — comentario FALSO

`addon.checkout.ts:569-578`:
```
// SPEC-109 fix #5/#6: use a UUID as the idempotency key. A retry from
// the same logical checkout reuses the same UUID, so the provider
// returns the existing session instead of creating a duplicate.
const checkoutUuid = randomUUID();
```
`randomUUID()` se ejecuta en cada invocación. **No hay reuso de nada.** Cada click
en "comprar addon" mina una Preference nueva de MP. El comentario afirma lo
contrario de lo que hace la línea que le sigue.

Comparación con el checkout de suscripción, que sí tiene idempotencia real:
`subscription-checkout.service.ts:~970-995` — `resolveReusableCommerceCheckout` /
`resolveReusableCommerceOwnPreapprovalCheckout`, con clave por LISTING, y devuelve
el mismo `init_point`. Igual en el camino de alojamiento.
Afecta a las 3 verticales por igual.

### Promo en el addon

`addon.checkout.ts:541-568`: si viene `input.promoCode`, valida con
`promoService.validate(code, { userId, amount: addon.priceArs })` — **sin `planId`**,
así que la restricción `validPlans` no se evalúa (`validation.ts:159` requiere
`context.planId`). Aplica sólo `discountAmount` (el campo legacy `type`+`value`),
ignorando `effect_kind` — un código `trial_extension` o `comp` pasa la validación
y produce `discountAmount = undefined` → precio completo cobrado con el código
"aceptado". El schema lo acepta: `packages/schemas/src/api/billing/addon.schema.ts:41-44`.

En el camino recurrente sí hay refusal explícito y honesto:
`addon.checkout.ts:526-535` → `RECURRING_ADDON_PROMO_UNSUPPORTED`.
Como los dos addons de comercio vivos son `billingType: 'recurring'`, si
`HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED` se enciende, promo sobre addon de
comercio queda rechazado mientras que sobre los one-time de alojamiento
(`visibility-boost-*`) sigue aceptado.

---

## Q8 — Límites de canje por vertical

**Nada se evalúa distinto por vertical.** Todo vive en
`promo-code.validation.ts:97-232` y es domain-blind:

| Límite | Línea | Alcance |
|---|---|---|
| `maxUses` global | 133-139 | `timesRedeemed >= maxUses`, sin partición |
| `maxPerCustomer` | 143-157, 414-468 | cuenta filas de `billing_promo_code_usage` por `customer_id`, mapeando `externalId` → customers |
| `expiresAt` | 125-131 | fecha |
| `validPlans` | 159-167 | lista de planId |
| `newCustomersOnly` | 169-185, 350-387 | "¿ya tiene suscripción a ESTE plan?" — scoped por plan, no por dominio |
| `minAmount` | 187-196 | monto |

Consecuencia: un código con `maxUses: 100` se agota indistintamente entre
alojamiento, gastronomía y experiencia; no hay cupo por vertical.

Dos `catch` fallan ABIERTO (`return false`, :385 y :465), así que un error de DB
deja pasar el canje. Idéntico en las 3 verticales.

---

## Notas de método

- Los comentarios/docblocks se trataron como afirmaciones a verificar. Dos
  resultaron falsos y se reportan como hallazgo: la idempotencia del addon
  (F-11) y el nombre del archivo `subscription-product-domain.ts` que aloja una
  función domain-blind (no es un bug, pero invalida el único hit del grep de Q1).
- No se corrieron tests ni builds. No se editó nada.
- No verificado: comportamiento de `initiatePaidPlanUpgrade` frente a promos
  (no lo llama, pero no se leyó su cuerpo completo); el barrido de
  grant-reconciliation del `addon-expiry.job.ts` Phase 7 se infirió de
  `applyAddonEntitlements` en `:1936` sin leer la selección de filas.
