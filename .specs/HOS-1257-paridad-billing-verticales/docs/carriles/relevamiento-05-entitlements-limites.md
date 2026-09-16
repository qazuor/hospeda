# Relevamiento 05 — Entitlements, límites y gates de permiso

Worktree: `/home/qazuor/projects/WEBS/hospeda-hos-1257-paridad-billing-verticales` @ `5c205fc70`
Método: sólo `Read` / `rg` / `Glob`. Sin codegraph. Sin tests ni builds.

---

## 1. El motor de entitlements: CUÁNTOS CAMINOS HAY

Hay **SIETE caminos distintos** para resolver "qué puede hacer este usuario según lo que paga".
No es un motor: son siete, y cada uno decide por su cuenta qué suscripción mirar.

| # | Camino | Archivo | Verticales que sirve | Lee custom-level? | Lee caché `entity_subscriptions`? |
|---|---|---|---|---|---|
| 1 | `loadEntitlements` (+ `entitlementMiddleware`) | `apps/api/src/middlewares/entitlement.ts:551-806` | **SÓLO alojamiento** (`isAccommodationSubscription`, :603) + turista (planes tourist viven en dominio accommodation) | **SÍ** (`billing.entitlements.getByCustomerId`, :761) | NO |
| 2 | `resolveCommerceVerticalGrants` (+ `commerceVerticalEntitlementMiddleware`) | `apps/api/src/middlewares/commerce-entitlement.ts:316-433` / `465-504` | gastronomía + experiencia | **NO** (sólo `billing.limits.getByCustomerId`, :416) | NO |
| 3 | `loadCustomerEntitlements` / `resolveOwnerEntitlementSet` (owner-side) | `apps/api/src/middlewares/owner-entitlement.ts:202-267`, `331-369` | **SÓLO alojamiento** (:240) | **NO** (documentado en :135) | **SÍ** (:344-353) |
| 4 | `loadCustomerLimits` / `resolveOwnerLimitsForOwnerId` (owner-limits) | `apps/api/src/middlewares/owner-entitlement.ts:633-824` | **SÓLO alojamiento** (:655) | SÍ, sólo límites (:688) | NO |
| 5 | `resolveOwnerPlanGrantsFeatured` | `packages/service-core/.../accommodation/featured-entitlement.resolver.ts:87-144` | **SÓLO alojamiento** (:121) | NO | NO |
| 6 | `resolveOwnerGastronomyPlanEntitlements` | `packages/service-core/.../gastronomy/gastronomy.menu-entitlement.ts:96-148` | **SÓLO gastronomía** (:128) | NO | NO |
| 7 | `resolveOwnerGrantsExperienceDirections` | `packages/service-core/.../experience/experience.directions-entitlement.ts:97-151` | **SÓLO experiencia** (:131) | NO | NO |

Más un **octavo** de sólo-lectura para el cliente: `GET /protected/users/me/entitlements`
(`apps/api/src/routes/user/protected/entitlements.ts:27`) que vuelve a resolver a mano,
otra vez **sólo alojamiento** (`isAccommodationSubscription`).

### ¿`owner-entitlement.ts` y `tourist-entitlements.ts` se solapan?

**No se solapan: no son comparables.** `tourist-entitlements.ts` NO es un resolutor —
es un archivo de **gates** (7 middlewares: `gateFavorites`, `gateAlerts`, `gateComparator`,
`gateReviewPhotos`, `gateSearchHistory`, `gateCollections`, `gateRecommendations`,
`gateExclusiveDeals`) que leen `hasEntitlement(c, …)` del contexto que pobló
`entitlementMiddleware` (camino 1). Cero consultas a billing.
`owner-entitlement.ts` sí es un resolutor (caminos 3 y 4): resuelve al **DUEÑO del recurso**,
no al solicitante.

Lo que **sí** se solapa es **camino 1 vs camino 3/4**: ambos resuelven "el plan
de un cliente de alojamiento" y **divergen**:
- 1 aplica el descarte HOS-217 (`isOwnerCategorySubscription`) — 3 y 4 no.
- 1 mergea entitlements customer-level — 3 no (`owner-entitlement.ts:135` lo documenta:
  "an admin-granted customer-level entitlement is NOT visible on owner-gated surfaces").
- 3 lee la caché `entity_subscriptions` — 1 no.
- 1 resuelve composición de planes trial (`resolveComposedTrialGrants`, :435) — 3 y 4 no,
  así que un host en TRIAL resuelve entitlements DISTINTOS según quién pregunte.

---

## 2. Los tres resolvers por vertical: comparación línea a línea

`featured-entitlement.resolver.ts:87-144` (alojamiento) ·
`gastronomy.menu-entitlement.ts:96-148` (gastronomía) ·
`experience.directions-entitlement.ts:97-151` (experiencia)

Estructura de los tres, idéntica:

```
const db = getDb();
1. SELECT billingCustomers.id WHERE externalId = ownerId AND deletedAt IS NULL LIMIT 1
   → if (!customer) return <falso>
2. SELECT id, planId, status, productDomain FROM billingSubscriptions
   WHERE customerId = customer.id AND deletedAt IS NULL
     AND status IN ACTIVE_PLAN_SUBSCRIPTION_STATUSES (= ENTITLEMENT_GRANTING_STATUSES)
   → .find(row => <predicado de dominio>)
   → if (!sub) return <falso>
3. SELECT entitlements FROM billingPlans WHERE id = sub.planId AND deletedAt IS NULL LIMIT 1
   → if (!plan || !Array.isArray(plan.entitlements)) return <falso>
4. return (plan.entitlements as string[]).includes(<CLAVE>)
```

**Difieren en exactamente DOS tokens** por archivo:
- el predicado: `isAccommodationSubscription(row)` vs
  `subscriptionMatchesDomain(row, ProductDomainEnum.GASTRONOMY)` vs
  `…EXPERIENCE`;
- la clave: `FEATURED_LISTING` vs `MANAGE_GASTRONOMY_MENU` (parametrizada) vs
  `MANAGE_EXPERIENCE_DIRECTIONS`.

**LOC duplicadas: ~55 líneas de cuerpo × 3 = ~110 LOC, ~165 con imports y constantes.**
El gastronómico ya se generalizó por clave (`resolveOwnerGrantsGastronomyEntitlement`,
:202) y devuelve además set completo (:175) y par de booleans (:237). El de experiencia
**no** se generalizó: sigue con la clave inlineada (:150) — que es exactamente lo que
HOS-1041 declaró como error en gastronomía ("copiar el lookup para una segunda clave
produce un resolver que deriva del primero", :71-77).

### ¿La diferencia es esencial o accidental?

**Accidental.** El docblock de `experience.directions-entitlement.ts:33-42` da la
justificación explícita para no compartir:

> "A shared helper parameterised by domain would invite an accommodation caller, and
> the first one would silently get the open direction on a gate written for the closed one."

Es una razón **real pero desproporcionada**: el fail-open de accommodation se puede
encapsular con un tipo (`CommerceDomain = GASTRONOMY | EXPERIENCE`) o con un guard
estático. El costo elegido son 110 LOC triplicadas y un resolver de experiencia que ya
quedó una generación atrás del de gastronomía.

---

## 3. `subscriptionMatchesDomain`: semántica REAL

`packages/service-core/src/services/billing/subscription/subscription-product-domain.ts:205-225`

```ts
export function subscriptionMatchesDomain(sub: unknown, domain: ProductDomainValue): boolean {
    const wantsAccommodation = domain === ProductDomainEnum.ACCOMMODATION;
    if (sub === null || sub === undefined || typeof sub !== 'object') return wantsAccommodation;
    const value = (sub as Record<string, unknown>).productDomain;
    if (value === null || value === undefined) return wantsAccommodation;
    if (typeof value !== 'string') return false;
    return value === domain;
}
```

Semántica **leída del código** (coincide con su docblock, verificado):
- `sub` no-objeto (null/undefined/primitivo) → devuelve `true` si se pide accommodation.
  **Nota**: el docblock (:180-183) dice "a missing object … counts as accommodation" — cierto.
- `productDomain` `null`/`undefined` → `true` sólo para accommodation.
- Cualquier otro string → igualdad exacta. `'commerce'` (retirado) no satisface
  `'gastronomy'` ni `'experience'`.
- Valor no-string → `false` siempre (ni siquiera para accommodation). Asimetría no documentada.

**`isCommerceSubscription()` NO EXISTE.** Fue borrado por HOS-1081 (`ebfd413e0`) por cero
callers — documentado en `packages/billing/src/config/commerce-entitlements.config.ts:92-96`.
El `CLAUDE.md` raíz sigue recomendándolo ("To test membership across all commerce verticals
at once use `isCommerceSubscription()`"): **afirmación falsa en la doc del proyecto**.
`isAccommodationSubscription` sí existe (:100).

### Call sites y si el fail-open puede dar resultado incorrecto

| Call site | Dominio pedido | ¿Fail-open puede errar? |
|---|---|---|
| `middlewares/entitlement.ts:603` | accommodation | **SÍ, mitigado**: `hydrateSubscriptionProductDomains` (:589) rellena la columna antes. Sin esa hidratación (HOS-1104) TODA suscripción caía en accommodation. Si la hidratación falla (throw), el catch externo (:796) devuelve `null` → `billingLoadFailed` → 503. Correcto. |
| `middlewares/owner-entitlement.ts:240, 655` | accommodation | Hidrata (:238, :653). Igual que arriba. |
| `middlewares/commerce-entitlement.ts:350` | gastronomy/experience | **NO puede errar hacia arriba**: fail-CLOSED. Pero si la hidratación falla, cae al `catch` (:408) que **conserva `baseCap` y el piso de entitlements** → el owner pierde su add-on pero conserva el piso. Seguro. |
| `services/addon-entitlement.service.ts:153, 458, 725` | accommodation (**HARDCODEADO**) | **SÍ Y ES UN BUG REAL** — ver hallazgo E-01. |
| `services/addon.checkout.ts:463` | `addon.productDomain` (correcto) | fail-closed para commerce. OK. |
| `services/entity-subscription-cache.service.ts:172` | accommodation | Query directa a DB → la columna viene real. Fail-open sólo aplica a filas legacy `NULL`. Correcto. |
| `cron/entity-subscription-cache-reconcile.job.ts` | accommodation | ídem. |
| `services/billing/plan-domain-guard.ts:isAccommodationDomainSubscription` | accommodation | fail-open **deliberado y documentado** (:"It fails OPEN toward accommodation, twice over"). Un blip de DB en un upgrade de gastronomía → se tratan las accommodations del owner con caps de un plan de gastronomía. Mitigado por `assertAccommodationPlanSlug`, que sí throwea. |
| `plan-domain-guard.ts:selectAccommodationSubscription` | accommodation | fail-open si falla hidratación. Riesgo acotado (HOS-1213). |
| `service-core/.../addon-limit-recalculation.service.ts:~300` | `productDomainForLimitKey(key)` | correcto por clave. |
| `gastronomy.menu-entitlement.ts:128`, `experience.directions-entitlement.ts:131` | gastronomy/experience | fail-CLOSED. Query directa. Correcto. |
| `cron/dunning.job.ts:166`, `finalize-cancelled-subs.ts:284/349`, `subscription-poll.job.ts:568`, `preapproval-less-expiry.job.ts:196`, `abandoned-pending-subs.job.ts:57` | sólo `!isAddonSubscription` / `excludeAddonDomainCondition` | **NO filtran por vertical**: barren las 3 verticales + partner. Esto es la SIMETRÍA correcta. |

---

## 4. Permisos de publicación

**Los nombres reales del enum**: `PUBLISH_ACCOMMODATIONS`, `PUBLISH_GASTRONOMY`,
`PUBLISH_EXPERIENCE` son **`EntitlementKey`**, NO `PermissionEnum`
(`packages/billing/src/types/entitlement.types.ts:7, 42, 44`).
En `PermissionEnum` existe `ACCOMMODATION_PUBLISH = 'accommodation.publish'`
(`packages/schemas/src/enums/permission.enum.ts:154`) pero **NO hay equivalente
commerce**: `COMMERCE_*` sólo tiene `CREATE/EDIT_OWN/EDIT_ALL/VIEW_ALL/DELETE/
MODERATE_REVIEW/MODERATION_CHANGE` (:1001-1022). Asimetría de vocabulario.

### Dónde se otorga cada entitlement y bajo qué condición

**`PUBLISH_ACCOMMODATIONS`** — sale de la fila `billing_plans.entitlements` de la
suscripción activa de dominio accommodation (`entitlement.ts:736`), o del plan
`owner-basico` leído de DB cuando el actor lleva rol HOST y no tiene suscripción
(`buildHostDraftDefaultsResult`, :280-348; seleccionado por `holdsHostRole`, :490).
Un autenticado SIN rol HOST cae a `buildDefaultEntitlementsResult()` (tourist-free)
que **no** lo incluye. → **Condicional. Correcto.**

**`PUBLISH_GASTRONOMY` / `PUBLISH_EXPERIENCE`** — salen del **piso de CÓDIGO**:

```ts
// commerce-entitlement.ts:326
const entitlements = new Set<EntitlementKey>(ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL[vertical]);
if (!customerId) {
    return { cap: baseCap, aiChatCap: AI_CHAT_CAP_WITHOUT_PLAN, entitlements };  // :329
}
const billing = getQZPayBilling();
if (!billing) {
    return { cap: baseCap, aiChatCap: AI_CHAT_CAP_WITHOUT_PLAN, entitlements };  // :334
}
```

y `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` (`commerce-entitlements.config.ts:73-86`)
contiene `EDIT_*_INFO`, `PUBLISH_*` y `VIEW_BASIC_STATS` para ambas verticales.
El plan **sólo puede AGREGAR** (:402-406, "ADD ONLY").

> **SÍ: `PUBLISH_GASTRONOMY` y `PUBLISH_EXPERIENCE` se otorgan INCONDICIONALMENTE a
> cualquier autenticado que llegue a una ruta commerce.** Sin suscripción, sin
> customer, con billing caído, con la suscripción cancelada — el piso siempre se
> devuelve. `requireEntitlement(PUBLISH_GASTRONOMY)` no puede rechazar a nadie.

Está **documentado y es deliberado** (`commerce-entitlement.ts:66-87`: los tres estados
"ordinarios" que si no dejarían afuera al owner mid-funnel). Pero significa que la
supuesta paridad "cada vertical gatea igual que accommodation" es **nominal**: el gate
de alojamiento sí refusa (un USER sin rol HOST no publica), el de commerce no refusa nunca.
Lo que realmente limita a commerce es el CAP (`enforceGastronomyLimit`), no el gate.

`VIEW_BASIC_STATS` cae en el mismo saco: piso incondicional en commerce, mientras en
alojamiento sale del plan.

---

## 5. Límites por vertical

**Motor de decisión: UNO SOLO.** `checkLimit()` (`apps/api/src/utils/limit-check.ts:178-224`)
→ `getRemainingLimit()` (`middlewares/entitlement.ts:1259-1279`) → `c.get('userLimits')`.

**Poblador de `userLimits`: DOS caminos mutuamente excluyentes.**

| Camino | Qué mete en `userLimits` |
|---|---|
| `entitlementMiddleware` (global, `create-app.ts`) | TODO el mapa de límites del plan **accommodation** + overrides customer-level |
| `commerceVerticalEntitlementMiddleware(vertical)` (por ruta) | **UNA SOLA entrada**: `new Map([[limitKey, cap]])` (`commerce-entitlement.ts:499`) — REEMPLAZA el mapa entero |

**Consecuencia medible**: en una ruta commerce, `userLimits` tiene exactamente 1 clave.
Cualquier otro `LimitKey` consultado en esa request devuelve `-1` = **ILIMITADO**
(`getRemainingLimit`, :1273-1275). Los planes commerce SÍ declaran `TOURIST_VIP_LIMITS`
+ AI-chat + galerías (`plans.config.ts:727-753`), pero **el middleware los tira**.
`aiChatCap` se calcula (`commerce-entitlement.ts:381-394`) y **se descarta**: la
desestructuración de :487 es `const { cap, entitlements }`. Sólo se recupera por el
camino aparte `services/ai-context/chat-owner-grants.ts:197-208`.

### ¿Falla abierto o cerrado? Y ¿igual para las tres?

**No falla igual.**

| Middleware | Fallo al CONTAR | Archivo |
|---|---|---|
| `enforceAccommodationLimit` | **503 CERRADO** | `limit-enforcement.ts:234, 291` |
| `enforceGastronomyLimit` / `enforceExperienceLimit` | **503 CERRADO** | `commerce-limit-enforcement.ts:113` |
| `enforcePhotoLimit` | **`next()` ABIERTO** | `limit-enforcement.ts:337, 347, 402, 413` |
| `enforcePromotionLimit` | **`next()` ABIERTO** | `limit-enforcement.ts:448, 480, 523, 544` |
| `enforceFavoritesLimit` | **`next()` ABIERTO** | `limit-enforcement.ts:690, 697, 708` |
| `enforcePropertiesLimit` | **`next()` ABIERTO** | `limit-enforcement.ts:746, 756, 812, 823` |
| `enforceStaffAccountsLimit` | **`next()` ABIERTO** | `limit-enforcement.ts:861, 918, 929` |

La dirección de falla es coherente **entre las tres verticales para el cap de listings**
(las tres cierran). Es **incoherente dentro de alojamiento**: 5 de 7 gates de límite
siguen fallando abiertos. HOS-1078 cerró sólo el de accommodations.

Además, **cap base commerce vs alojamiento difieren de origen**:
- commerce: `loadVerticalBaseLimit` lee `billing_plans` por slug y cae a
  `FALLBACK_VERTICAL_CAP = 1` (`commerce-entitlement.ts:131`) — siempre un NÚMERO.
- alojamiento: si el plan no declara `MAX_ACCOMMODATIONS`, la clave falta →
  `getRemainingLimit` → `-1` → ilimitado. **No hay `FALLBACK_ACCOMMODATION_CAP`.**

---

## 6. `entity_subscriptions`: quién escribe y quién reconcilia

Tabla: `UNIQUE(entity_type, entity_id)`, `entity_type ∈ {'accommodation','gastronomy','experience'}`.

| Vertical | Escritor | Puente único? | Cron backstop |
|---|---|---|---|
| accommodation | `syncAccommodationSubscriptionCacheForOwner` (`entity-subscription-cache.service.ts:200-260`) | SÍ, vía `reconcileSubscriptionLinkedEntities` (`subscription-linked-entities.service.ts:70`) | **SÍ** — `entity-subscription-cache-reconcile.job.ts` |
| gastronomy | `commerce-reconcile.service.ts:258-290` (+ `commerce-subscription-attach.service.ts`, `commerce-downgrade-remediation.service.ts:289`) | SÍ, vía `reconcileSubscriptionLinkedEntities` (:64) | **NO** |
| experience | ídem gastronomy (mismo módulo, `switch(entityType)` en :49-61) | SÍ | **NO** |
| partner | — no participa | — | — |

El puente **sí es único** para las tres (`reconcileSubscriptionLinkedEntities` llama a las
dos mitades, independientes, :64 y :70), y los seis sitios del ciclo de vida lo llaman.
**Pero el reconciliador NO cubre las tres**: el cron dice explícitamente
(`entity-subscription-cache-reconcile.job.ts:35-39`):

> "Only the ACCOMMODATION rows are touched. Commerce rows are a link table, not a derivable
> projection… They keep their existing write-through path."

La razón es real (el `entity_id` de commerce registra en qué listing gastó el owner su slot,
no se re-deriva de billing), pero el resultado es que **un webhook perdido deja una fila
commerce mal para siempre**, mientras la de alojamiento se auto-cura cada 6h. Y en commerce
la fila SÍ decide visibilidad pública del listing.

Además `planRestricted` (HOS-1122) sólo lo escribe commerce
(`commerce-downgrade-remediation.service.ts:289`); en alojamiento la restricción vive en
`accommodations.planRestricted` vía `plan-restriction.service.ts` — **dos mecanismos
distintos para el mismo concepto**.

---

## 7. MATRIZ DE CAPACIDADES DE BILLING POR VERTICAL

Leyenda: **SÍ** / **NO** / **PARC** (parcial) / **?** (no verificado).
ALO = alojamiento · GAS = gastronomía · EXP = experiencia · TUR = turista · PAR = partner

| # | Capacidad | ALO | GAS | EXP | TUR | PAR | Evidencia |
|---|---|---|---|---|---|---|---|
| 1 | Plan trial dedicado (composición) | SÍ | SÍ | SÍ | NO | ? | `trial-plans.config.ts:224` (`owner-trial`), `:235` (`gastronomy-trial`), `:246` (`experience-trial`); tourist-free `plans.config.ts:430 hasTrial:false` |
| 2 | `hasTrial` en el catálogo | SÍ | SÍ | SÍ | PARC | ? | `plans.config.ts:121/164/213/271/315/370` (ALO); `:832/889/954` (GAS) y los 3 EXP vía `commerceVerticalTier`; `:430` free NO / `:480` vip SÍ |
| 3 | Composición de trial resuelta EN VIVO al gatear | SÍ | **NO** | **NO** | SÍ | NO | `resolveComposedTrialGrants` sólo existe en `entitlement.ts:435-477`, que es accommodation-only. `commerce-entitlement.ts` nunca lee `trialComposition` |
| 4 | Promo code en el CHECKOUT | SÍ | **NO** | **NO** | SÍ | ? | `start-paid.ts:112,354,369,527` (`promoCode`); `commerce/protected/start-subscription.ts` — cero ocurrencias de `promo` |
| 5 | Promo code canjeado sobre suscripción existente | SÍ | SÍ | SÍ | SÍ | SÍ | `promo-codes.apply.ts:147,159,204` — toma `subscriptionId`, verifica propiedad, **sin guard de dominio** |
| 6 | Plan anual | SÍ | **NO** | **NO** | PARC | SÍ | `plans.config.ts:119/162/211/269/313/368` (ALO); `:678 annualPriceArs: null` en `commerceVerticalTier` (los 6 commerce); `:428 null` free / `:478` vip; `:1315/1337` partner |
| 7 | Checkout con `billingInterval` | SÍ | NO | NO | SÍ | ? | `start-paid.ts:111,297,338`; `start-subscription.ts` no lo acepta |
| 8 | Add-ons en el catálogo | SÍ (6) | SÍ (1) | SÍ (1+3 inactivos) | NO | NO | `addons.config.ts:22,41,65,83,101,126` (ALO); `:173` gas; `:192,270` exp |
| 9 | **Aplicación de límite del add-on correcta** | SÍ | **NO — ROTO** | **NO — ROTO** | n/a | n/a | `addon-entitlement.service.ts:153` hardcodea `isAccommodationSubscription`; ver E-01 |
| 10 | Recálculo de límites por add-on (service-core) | SÍ | SÍ | SÍ | n/a | n/a | `addon-limit-recalculation.service.ts:17,23` usa `productDomainForLimitKey` + `subscriptionMatchesDomain` (arreglado por HOS-688) |
| 11 | Entitlement customer-level (grant de admin / add-on) llega al gate | SÍ | **NO** | **NO** | SÍ | NO | `entitlement.ts:761` lo mergea; `commerce-entitlement.ts` sólo lee `billing.limits.getByCustomerId` (:416), nunca `entitlements.getByCustomerId` |
| 12 | Destacado por entitlement (`featuredByEntitlement`) | SÍ | **NO** | **NO** | n/a | NO | `featured-entitlement.resolver.ts`, `accommodation.sync-featured-by-entitlement.ts`, columna en `accommodations`. Ningún equivalente commerce |
| 13 | Add-on de destacado por listing | SÍ | NO | NO | n/a | NO | `featured_listing_addon_grants` sólo referencia `accommodationId` (`featured-entitlement.resolver.ts:184, 240`) |
| 14 | Idempotencia en el checkout | SÍ | SÍ | SÍ | SÍ | ? | `start-paid.ts:546`; `start-subscription.ts:674` |
| 15 | Pausa / reanudación | PARC | PARC | PARC | PARC | PARC | `subscription-pause.ts:87,234` — `.find()` sobre TODAS las suscripciones activas, **sin filtro de dominio ni exclusión de add-on**. Ver E-02 |
| 16 | Cancelación (soft) | SÍ | SÍ | SÍ | SÍ | SÍ | `subscription-cancel.ts:171` toma `subscriptionId` explícito con verificación de propiedad — agnóstico de dominio, correcto |
| 17 | Cambio de plan | SÍ | PARC | PARC | SÍ | NO | ALO: `plan-change.ts:246` `selectAccommodationSubscription` (up+down). GAS/EXP: `commerce/protected/change-plan.ts` **sólo upgrades** |
| 18 | Cortesía (`courtesy_*`) | ? | ? | ? | ? | ? | `courtesy-fields.ts` — no leído entero. NO VERIFICADO |
| 19 | **Comp (`status='comp'`)** | SÍ | **NO — RECHAZO EXPLÍCITO** | **NO — RECHAZO EXPLÍCITO** | SÍ | NO | `subscription-comp-create.service.ts:110-125`: lee `billingPlans.productDomain` y **throwea** si no es accommodation; inserta `productDomain: ACCOMMODATION` fijo (:169) |
| 20 | Dunning | SÍ | SÍ | SÍ | SÍ | SÍ | `dunning.job.ts:163-166` barre `status='past_due'` global, sólo excluye `isAddonSubscription`. Idem `finalize-cancelled-subs.ts:284`, `preapproval-less-expiry.job.ts:196`, `abandoned-pending-subs.job.ts:57`, `subscription-poll.job.ts:568` |
| 21 | Cap de listings enforced | SÍ | SÍ | SÍ | n/a | n/a | `limit-enforcement.ts:201`; `commerce-limit-enforcement.ts:172,181` |
| 22 | Cap falla CERRADO | SÍ | SÍ | SÍ | **NO** | n/a | `limit-enforcement.ts:234`; `commerce-limit-enforcement.ts:113`; favoritos/fotos/promos/propiedades/staff fallan ABIERTO (`:690,337,448,746,861`) |
| 23 | Endpoint "mis entitlements" para el front | SÍ | **NO** | **NO** | SÍ | NO | `routes/user/protected/entitlements.ts:27` usa `isAccommodationSubscription` |
| 24 | Caché `entity_subscriptions` escrita | SÍ | SÍ | SÍ | n/a | NO | `entity-subscription-cache.service.ts:229`; `commerce-reconcile.service.ts:273` |
| 25 | Cron de reconciliación de esa caché | SÍ | **NO** | **NO** | n/a | n/a | `entity-subscription-cache-reconcile.job.ts:194` filtra `entityType = 'accommodation'` |
| 26 | Restricción por downgrade | SÍ | SÍ | SÍ | n/a | NO | ALO: `plan-restriction.service.ts` (columna `accommodations.planRestricted`). GAS/EXP: `commerce-downgrade-remediation.service.ts:289` (columna `entity_subscriptions.planRestricted`) — **dos mecanismos** |
| 27 | Guard de dominio cruzado en remediación | SÍ | SÍ | SÍ | SÍ | SÍ | `plan-domain-guard.ts:assertAccommodationPlanSlug`, `assertAccommodationPlanChangeTarget`, `selectAccommodationSubscription` |
| 28 | AI-chat cap publicado en `userLimits` | SÍ | **NO** | **NO** | SÍ | n/a | `commerce-entitlement.ts:487` desestructura `{cap, entitlements}` y descarta `aiChatCap`; sólo llega vía `chat-owner-grants.ts:208` |

---

## 8. Destacado y anual: ¿gap o imposibilidad del modelo?

**Destacado — GAP, no imposibilidad.** `accommodations.featuredByEntitlement` es una
columna denormalizada; `gastronomies` / `experiences` podrían tener la suya. El add-on
`visibility-boost-*` está atado a `featured_listing_addon_grants.accommodationId`
(FK a `accommodations`, `featured-entitlement.resolver.ts:184`), así que extenderlo
requiere migración — pero nada del modelo lo impide. `FEATURED_LISTING` sólo aparece en
4 planes accommodation (`plans.config.ts:177,227,329,384`) y en ningún plan commerce.

**Anual — GAP de catálogo, no de mecanismo.** `commerceVerticalTier` fija
`annualPriceArs: null` para las 6 tiers (`plans.config.ts:678`). El mecanismo anual
(preapproval MP con `frequency: 12`) es agnóstico de vertical desde HOS-171. Además el
checkout commerce ni siquiera acepta `billingInterval`. Los add-ons commerce **SÍ**
declaran `annualPriceArs` (`addons.config.ts:161, 186`), lo que hace la ausencia en los
planes más claramente un olvido de catálogo que una decisión.

---

## 9. Tabla de hallazgos

| ID | Qué difiere | Evidencia | Verticales | Clasificación | Confianza |
|---|---|---|---|---|---|
| E-01 | `applyAddonEntitlements` resuelve el plan BASE del add-on desde la suscripción de **alojamiento**, siempre. Para `extra-gastronomies-1`/`extra-experiences-1`: owner commerce-only → `NO_ACTIVE_SUBSCRIPTION` y el cap no sube nunca; owner con ambas → el plan accommodation no declara `max_gastronomies` → `basePlanLimit=0` → `newMaxValue = 0 + increase`, borrando el cap base de la vertical. Es EXACTAMENTE el bug que HOS-688 arregló en el gemelo de service-core, con la descripción textual en `addon-limit-recalculation.service.ts:280-288` | `addon-entitlement.service.ts:153` (`isAccommodationSubscription`), `:248-256` (`activeSubscription.planId` → base), `:316-322` (`limits.set`); llamado desde `addon.checkout.ts:1293`, `addon-expiry.job.ts:1936`, `addon.admin.ts:419`; add-ons en `addons.config.ts:163-173, 186-192` | GAS, EXP | COMPORTAMIENTO-DISTINTO | ALTA |
| E-02 | Pausa/reanudación eligen `.find()` sobre TODAS las suscripciones activas/pausadas del customer sin filtro de dominio ni exclusión de add-on. Un owner con alojamiento + gastronomía pausa la que devuelva primero el adaptador; una fila `product_domain='addon'` activa también es candidata. Es la forma exacta del bug HOS-1213, que se cerró en `plan-change` (`selectAccommodationSubscription`) y no acá | `subscription-pause.ts:76-87` (pausa), `:225-234` (resume); contraste `plan-change.ts:246`; `plan-domain-guard.ts:selectAccommodationSubscription` | ALO, GAS, EXP, TUR, PAR | COMPORTAMIENTO-DISTINTO | ALTA |
| E-03 | `PUBLISH_GASTRONOMY`/`PUBLISH_EXPERIENCE`/`VIEW_BASIC_STATS` se otorgan incondicionalmente desde el piso de código a cualquier autenticado que llegue a la ruta, incluso sin customer y con billing caído. `requireEntitlement(PUBLISH_GASTRONOMY)` no puede refusar. `PUBLISH_ACCOMMODATIONS` sí es condicional (plan, o rol HOST → `owner-basico`) | `commerce-entitlement.ts:326,329,334`; `commerce-entitlements.config.ts:73-86`; contraste `entitlement.ts:576-579, 736, 490` | GAS, EXP vs ALO | COMPORTAMIENTO-DISTINTO | ALTA |
| E-04 | `commerceVerticalEntitlementMiddleware` REEMPLAZA `userLimits` con un mapa de UNA clave. Todo otro `LimitKey` de la request devuelve `-1` = ilimitado, incluidos los `TOURIST_VIP_LIMITS`, la cuota AI-chat y las galerías que los propios planes commerce declaran. `aiChatCap` se calcula y se descarta | `commerce-entitlement.ts:487,499`; `entitlement.ts:1273-1275`; límites declarados en `plans.config.ts:727-753` | GAS, EXP | COMPORTAMIENTO-DISTINTO | ALTA |
| E-05 | `comp` (cortesía permanente) rechaza explícitamente planes no-accommodation. No hay forma de comper una suscripción de gastronomía o experiencia | `subscription-comp-create.service.ts:110-125, 169` | GAS, EXP | COMPORTAMIENTO-DISTINTO | ALTA |
| E-06 | Los entitlements customer-level (`billing.entitlements.getByCustomerId`) nunca llegan a un gate commerce. Un grant de admin o de add-on con `grantsEntitlement` (p.ej. `MANAGE_EXPERIENCE_PRIVATE_GALLERIES` de los packs) no se ve en la ruta | `entitlement.ts:761-766` (sí mergea); `commerce-entitlement.ts:415-421` (sólo `limits`); addon en `addons.config.ts:264` | GAS, EXP | COMPORTAMIENTO-DISTINTO | ALTA |
| E-07 | Promo code en checkout: sólo alojamiento/turista. Ningún plan commerce puede venderse con descuento, extensión de trial ni comp de entrada | `start-paid.ts:112,354,369`; `start-subscription.ts` (cero `promo`) | GAS, EXP | COMPORTAMIENTO-DISTINTO | ALTA |
| E-08 | Plan anual: `annualPriceArs: null` para las 6 tiers commerce y el checkout commerce no acepta `billingInterval`. Los add-ons commerce sí tienen precio anual | `plans.config.ts:678`; `start-paid.ts:111,297`; `addons.config.ts:161,186` | GAS, EXP | COMPORTAMIENTO-DISTINTO | ALTA |
| E-09 | `featuredByEntitlement` y el add-on `visibility-boost-*` son exclusivamente de alojamiento. `FEATURED_LISTING` no está en ningún plan commerce | `featured-entitlement.resolver.ts:184,240`; `accommodation.sync-featured-by-entitlement.ts`; `plans.config.ts:177,227,329,384` | GAS, EXP | COMPORTAMIENTO-DISTINTO | ALTA |
| E-10 | El cron `entity-subscription-cache-reconcile` sólo re-deriva filas `entity_type='accommodation'`. Commerce depende 100% del write-through; un webhook perdido deja el listing mal indefinidamente, y ahí la fila decide visibilidad pública | `entity-subscription-cache-reconcile.job.ts:35-39, 194` | GAS, EXP | COMPORTAMIENTO-DISTINTO | ALTA |
| E-11 | La composición de planes trial (`trialComposition`) se resuelve en vivo sólo en `loadEntitlements`. Un owner de gastronomía en `gastronomy-trial` gatea contra el snapshot de la fila del plan, no contra la composición — que es justo lo que HOS-1012 declaró "para mostrar, no para gatear" | `entitlement.ts:435-477, 722-730`; `trial-plans.config.ts:235,246`; `commerce-entitlement.ts` no menciona `trialComposition` | GAS, EXP | COMPORTAMIENTO-DISTINTO | ALTA |
| E-12 | `GET /protected/users/me/entitlements` es accommodation-only. Un owner commerce no tiene endpoint para saber qué tiene | `routes/user/protected/entitlements.ts:27` | GAS, EXP | COMPORTAMIENTO-DISTINTO | ALTA |
| E-13 | Los tres resolvers por vertical (featured / menu / directions) son ~55 LOC idénticas cada uno, difiriendo en 2 tokens. ~110 LOC duplicadas. El de experiencia quedó una generación atrás (clave inlineada) del de gastronomía (ya parametrizado por clave y con lookup compartido) | `featured-entitlement.resolver.ts:87-144`; `gastronomy.menu-entitlement.ts:96-148`; `experience.directions-entitlement.ts:97-151` | ALO, GAS, EXP | MISMO-COMPORTAMIENTO-DOS-CAMINOS | ALTA |
| E-14 | Camino 1 (`loadEntitlements`) y camino 3 (`loadCustomerEntitlements`) resuelven el mismo plan de alojamiento con reglas distintas: el descarte HOS-217, el merge customer-level, la lectura de caché y la composición de trial están en uno y no en el otro | `entitlement.ts:629-636, 722, 761`; `owner-entitlement.ts:135, 239-241, 344-353` | ALO (interno) | MISMO-COMPORTAMIENTO-DOS-CAMINOS | ALTA |
| E-15 | Dirección de falla del cap incoherente dentro de alojamiento: `enforceAccommodationLimit` cierra (503) pero fotos, promociones, favoritos, propiedades y cuentas de staff siguen llamando `next()` ante un fallo de conteo | `limit-enforcement.ts:234,291` vs `:337,347,402,413,448,480,523,544,690,697,708,746,756,812,823,861,918,929` | ALO, TUR | COMPORTAMIENTO-DISTINTO | ALTA |
| E-16 | Cap base ante "no sé": commerce siempre aterriza en un número (`FALLBACK_VERTICAL_CAP = 1`); alojamiento no tiene equivalente — clave ausente → `-1` = ilimitado | `commerce-entitlement.ts:131, 196-249`; `entitlement.ts:1273-1275` | ALO vs GAS/EXP | COMPORTAMIENTO-DISTINTO | MEDIA |
| E-17 | `planRestricted` vive en dos columnas y dos servicios: `accommodations.planRestricted` (`plan-restriction.service.ts`) para alojamiento, `entity_subscriptions.planRestricted` (`commerce-downgrade-remediation.service.ts`) para commerce | `plan-restriction.service.ts:84-89, 133-138`; `commerce-downgrade-remediation.service.ts:289-294`; `entity-subscription-cache.service.ts:241` | ALO vs GAS/EXP | MISMO-COMPORTAMIENTO-DOS-CAMINOS | ALTA |
| E-18 | Cambio de plan commerce es sólo upgrades; alojamiento tiene upgrade y downgrade programado | `commerce/protected/change-plan.ts`; `plan-change.ts:246`, `apply-scheduled-plan-changes` | GAS, EXP | COMPORTAMIENTO-DISTINTO | MEDIA |
| E-19 | **Docblock falso**: `commerce-limit-enforcement.ts:9-21` afirma "There is no entitlement gate ahead of this one … §6.8 records that neither commerce vertical grants any entitlement today". HOS-1074 lo revirtió y las rutas SÍ montan `requireEntitlement(PUBLISH_*)` antes | `commerce-limit-enforcement.ts:9-21` vs `commerce/protected/create.ts:178, 265` y `commerce-entitlement.ts:41-51` | GAS, EXP | COMPORTAMIENTO-DISTINTO (doc) | ALTA |
| E-20 | **Afirmación falsa en `CLAUDE.md` raíz**: recomienda `isCommerceSubscription()` como la forma de testear membresía commerce. La función fue **borrada** por HOS-1081 por cero callers | `CLAUDE.md` (sección "Commerce subscription isolation") vs `commerce-entitlements.config.ts:92-96` y ausencia en `subscription-product-domain.ts` | GAS, EXP | COMPORTAMIENTO-DISTINTO (doc) | ALTA |
| E-21 | `PermissionEnum` no tiene contraparte commerce de `ACCOMMODATION_PUBLISH`. La publicación commerce se autoriza sólo por entitlement + propiedad | `permission.enum.ts:154` vs `:1001-1022` | GAS, EXP | ESENCIAL-JUSTIFICADO (probable) | MEDIA |
| E-22 | Los crons de billing (dunning, finalize-cancelled, poll, preapproval-less-expiry, abandoned-pending) NO filtran por vertical: sólo excluyen `product_domain='addon'`. Las tres verticales reciben el mismo tratamiento | `dunning.job.ts:163-166`; `finalize-cancelled-subs.ts:284,349`; `subscription-poll.job.ts:568`; `preapproval-less-expiry.job.ts:196`; `abandoned-pending-subs.job.ts:57` | ALO, GAS, EXP, PAR | SIMÉTRICO-OK | ALTA |
| E-23 | Cancelación soft toma `subscriptionId` explícito con verificación de propiedad — agnóstico de dominio y correcto para las tres | `subscription-cancel.ts:171-173` + `softCancelSubscription({subscriptionId, customerId})` | ALO, GAS, EXP | SIMÉTRICO-OK | ALTA |
| E-24 | El puente `reconcileSubscriptionLinkedEntities` sí es único y cubre las dos mitades; la mitad de alojamiento re-deriva del DB en vez de creerle al status recibido | `subscription-linked-entities.service.ts:57-71`; `entity-subscription-cache.service.ts:150-190, 299-320` | ALO, GAS, EXP | SIMÉTRICO-OK | ALTA |
| E-25 | Trial: las tres verticales tienen plan de trial dedicado con composición declarada, e `isEntitlementGrantingStatus` (active/trialing/comp) es la única fuente para las tres | `trial-plans.config.ts:224,235,246,273`; `predicates/is-entitlement-granting-status.ts` usado por los 3 resolvers | ALO, GAS, EXP | SIMÉTRICO-OK | ALTA |
| E-26 | `productDomainForLimitKey` / `productDomainForPlanSlug` / `commerceVerticalToProductDomain` son mapas exhaustivos sin default: un `LimitKey` o slug nuevo es error de compilación, y lo desconocido devuelve `undefined` para que el caller falle cerrado | `commerce-limits.config.ts:135-193, 232-268`; `plan-domains.config.ts:106-113` | todas | SIMÉTRICO-OK | ALTA |
| E-27 | Cortesía (`courtesy_starts_at`/`courtesy_ends_at`) por vertical | `courtesy-fields.ts` — no leído entero | ? | NO-VERIFICADO | — |
| E-28 | Capacidades de billing de PARTNER (trial, promo, addons, pausa) | `partner-tier-plans.config.ts` leído sólo parcialmente; sin rutas de checkout partner revisadas | PAR | NO-VERIFICADO | — |
