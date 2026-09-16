# Relevamiento 02 — TRIAL, paridad entre verticales

Worktree: `/home/qazuor/projects/WEBS/hospeda-hos-1257-paridad-billing-verticales` @ `5c205fc70`
Método: sólo `Read` / `rg`. Sin codegraph. Sin ejecución de tests.

---

## 0. Mapa del carril (qué existe hoy)

| Pieza | Archivo | Alcance de dominio |
|---|---|---|
| Estado de trial de un cliente | `apps/api/src/services/trial.service.ts` (`getTrialStatus`, L258-552) | **NINGUNO** (deliberado, L320-337) |
| Paywall global 402 | `apps/api/src/middlewares/trial.ts` (L118-215) | **NINGUNO** (global, L140-181) |
| Elegibilidad | `apps/api/src/services/billing/trial-eligibility.service.ts` | **por dominio** (L305) |
| Creador de trial local | `apps/api/src/services/subscription-trial-create.service.ts` | genérico, valida dominio (L163-168) |
| Arranque alojamiento | `apps/api/src/services/accommodation-publish-deps.ts` (`startLocalTrial`, L197-273) | ACCOMMODATION (L67) |
| Arranque comercio | `apps/api/src/services/commerce-trial-start.service.ts` (`startCommerceListingTrial`, L296-380) | gastronomy/experience |
| Veredicto comercio | mismo archivo, `resolveCommerceTrialVerdict` (L217-262) | gastronomy/experience |
| Vencimiento local | `apps/api/src/services/billing/trial-local-expiry.service.ts` | ramifica por dominio (L143-178) |
| Reconciliación MP | `trial.service.ts` `reconcileExpiredTrials` (L641-987) | **NINGUNO** (sólo excluye addon, L708) |
| Serie de 9 mails | `trial-series-cohort.ts` + `cron/jobs/trial-series-dispatch.ts` | **NINGUNO** (sólo `mp_subscription_id IS NULL`) |
| Supersede al pagar | `trial-supersede-on-activation.ts` | **por dominio** (L146-152) |
| Upgrade en trial | `trialing-plan-upgrade.service.ts` | genérico; **exige** `mpSubscriptionId` (L209-214) |
| Planes de trial | `packages/billing/src/config/trial-plans.config.ts` | los 3, tabla `ALL_TRIAL_PLANS` (L273-298) |

---

## 1. `getTrialStatus` — ¿filtra por `productDomain`?

**NO.** Código real, `apps/api/src/services/trial.service.ts:348-355`:

```ts
const activeSubscription = subscriptions
    .filter((sub) => isEntitlementGrantingStatus(sub.status))
    .sort((a, b) =>
        (LIVE_STATUS_PRECEDENCE.get(a.status as string) ?? Number.MAX_SAFE_INTEGER) -
        (LIVE_STATUS_PRECEDENCE.get(b.status as string) ?? Number.MAX_SAFE_INTEGER))[0];
```

El único filtro previo (L293-295) es `!isAddonSubscription(sub)`. No hay
`subscriptionMatchesDomain` ni `isAccommodationSubscription` en toda la función.

El comentario L320-337 **es verdadero y lo admite explícitamente**: *"DELIBERATELY
NOT domain-filtered... Known consequence: a live commerce sub can mask an elapsed
accommodation trial"*. Verificado leyendo el cuerpo entero: el comentario no miente.

Consecuencias demostradas por el código, no por el comentario:

1. **Enmascaramiento.** `LIVE_STATUS_PRECEDENCE` (L169-173) pone `comp`=0,
   `active`=1, `trialing`=2. Un dueño con una gastronomía `active` y un
   alojamiento `trialing` vencido resuelve **la de gastronomía**
   (`active` gana determinísticamente), `isOnTrial=false`, `isExpired=false`
   (L481, L492). `trialMiddleware:162` no cobra el 402. El alojamiento vencido
   sigue escribiendo gratis.
2. **Regresión de display simétrica**: el mismo orden borra el contador de trial
   del alojamiento cuando hay una comercio `active`. El comentario L331-336 lo
   dice; el código lo confirma.
3. **El 402 le pega a la vertical equivocada.** `trialMiddleware` es global
   (`utils/create-app.ts`) y `HTTPException(402, ..., { upgradeAudience: 'host' })`
   (`middlewares/trial.ts:178`) está **hardcodeado a `'host'`**. Un dueño de
   restaurante con trial de gastronomía vencido recibe un 402 que dice
   "audiencia host". La única exención es un prefijo+sufijo literal para
   `start-subscription` de comercio (`middlewares/trial.ts:76-92`).

---

## 2. Comparaciones literales de status en el camino de trial

Vocabularios en juego: `SubscriptionStatusEnum` usa **británico**
`CANCELLED='cancelled'` (`packages/schemas/src/enums/subscription-status.enum.ts:15`);
qzpay-core escribe **americano** `'canceled'`
(`subscription-status-normalize.ts:53-54`: `canceled: SubscriptionStatusEnum.CANCELLED`).

| # | archivo:línea | literal | ¿normaliza? | veredicto |
|---|---|---|---|---|
| A | `trial.service.ts:386` | `sub.status === 'canceled'` | NO | **ciego a `'cancelled'` y a `'expired'`** |
| B | `trial.service.ts:1393` | `sub.status === 'canceled'` | NO | idem, en `reactivateSubscription` |
| C | `trial.service.ts:481` | `status === 'trialing'` | NO | ok (un solo spelling) |
| D | `trial.service.ts:1016` | `status !== 'trialing'` | NO | ok |
| E | `trial.service.ts:1159` | `status === 'trialing'` | NO | ok |
| F | `cron/jobs/trial-expiry.ts:103` | `status !== 'trialing'` | NO | ok (sólo dry-run) |
| G | `routes/billing/plan-change.ts:247` | `'active' \|\| 'trialing'` | NO | ok |
| H | `routes/billing/plan-change.ts:418` | `status === 'trialing'` | NO | ok |
| I | `routes/commerce/.../change-plan.ts:527` | `status === 'trialing'` | NO | ok |
| J | `subscription-cancel.service.ts:185` | `status === 'trialing'` | NO | ok |
| K | `subscription-downgrade.service.ts:309` | `status === 'trialing'` | NO | ok |
| L | `trial-eligibility.service.ts:186,190` | vía `normalizeStoredSubscriptionStatus` | **SÍ** | correcto |
| M | `admin/qzpay-admin-hooks.ts:161` | `'canceled' \|\| 'cancelled'` | ambos a mano | correcto pero duplicado |

**El caso A es el grave, y HOS-1012 lo empeoró.** El comentario L369-379 dice que
la rama "matches only the 1-L `'canceled'`... and it ignores `expired` entirely",
y que la rama "is NOT dead". Eso era cierto bajo card-first. Bajo HOS-1012:

- `expireLocalTrial` escribe `SubscriptionStatusEnum.EXPIRED` (`trial-local-expiry.service.ts:349`)
- `supersedeLocalTrialsOnActivation` escribe `EXPIRED` (`trial-supersede-on-activation.ts:71,187`)
- `'expired'` NO está en `ENTITLEMENT_GRANTING_STATUSES = ['active','trialing','comp','courtesy']`
  (`packages/billing/src/predicates/is-entitlement-granting-status.ts:44`)

Encadenado: un trial local vencido → `activeSubscription` undefined (L357) →
`historicalTrialSub` undefined porque el filtro exige `'canceled'` (L386) →
retorna los defaults "never had a trial" (L411-419) → `isExpired: false` →
`trialMiddleware:162` **nunca** dispara el 402. El paywall del trial local está
muerto en **las tres verticales**. Simétrico, y roto.

Escritores por spelling (grep sobre `.status` writes): qzpay-core → `'canceled'`;
todo escritor Hospeda directo (webhook, crons, `finalize-cancelled-subs`,
`subscription-cancel.service`) → `'cancelled'`. `expireLocalTrial` y el supersede
→ `'expired'`.

---

## 3. Arranque del trial — todos los caminos

| Vertical | Entrada | Servicio | Plan | Días | Adjunta listing |
|---|---|---|---|---|---|
| accommodation | `AccommodationService.publish` → `_publishDeps.startLocalTrial` (`accommodation.service.ts:2071`) | `accommodation-publish-deps.ts:197` | `owner-trial` vía `resolveTrialPlanSlug` (L91) | default `OWNER_TRIAL_DAYS=30`, NO pasa `trialDays` (L246-249) | no aplica (resuelve por `owner_id`) |
| gastronomy | `POST .../start-subscription` (`start-subscription.ts:476`) | `commerce-trial-start.service.ts:296` | `gastronomy-trial` | **lee `plan.metadata.trialDays` de la DB** (L158-171) | `attachListingToSubscription` (L349) |
| experience | idem | idem | `experience-trial` | idem | idem |
| tourist | — | **no existe camino de trial local** | — | `TOURIST_TRIAL_DAYS` sólo en config | — |
| partner | — | ausente a propósito (`trial-plans.config.ts:302-312`, `hasTrial:false`) | — | — | — |

Ambos convergen en `createTrialSubscription` (`subscription-trial-create.service.ts:131`),
que revalida `plan.product_domain === productDomain` (L163-168) y lanza si no coincide.

**Diferencias reales entre los dos caminos:**

1. **Transaccionalidad.** Alojamiento pasa `tx` del publish (`accommodation-publish-deps.ts:261`),
   así que el trial hace rollback con la publicación (HOS-1012 G-2), y difiere el
   `clearEntitlementCache` al callback `onTrialStarted` (L275-284). Comercio **no**
   pasa `tx` (`commerce-trial-start.service.ts:335-343`): abre su propia transacción,
   limpia caché adentro, y después hace el attach **fuera** (L349). Si el attach falla,
   queda una suscripción `trialing` viva con el listing PRIVATE. El docblock L349-352
   defiende esa decisión (no reconciliar desde una tx sin commitear) y es correcto,
   pero el resultado es que comercio no tiene la atomicidad que alojamiento sí tiene.
2. **De dónde salen los días.** Comercio lee `metadata.trialDays` de `billing_plans`
   (L158-171) y cae al default del creador si no sirve. Alojamiento **nunca** lee la
   fila: el comentario L246-249 dice que el override "lives on the plan row", pero
   el código no lo lee — usa el default `OWNER_TRIAL_DAYS`. **El comentario es falso
   para este call site.** Un operador que edite `owner-trial.metadata.trialDays` desde
   el admin (campo `commercial` por HOS-39, por lo tanto editable) cambia lo que la
   página promete y NO cambia lo que se concede. En gastronomía sí cambia ambos.
3. **Gate de elegibilidad dentro del que concede.** Comercio lo tiene
   (`commerce-trial-start.service.ts:314-325`, y el docblock L307-313 explica por qué).
   Alojamiento **no**: `startLocalTrial` (L197-273) no llama a `resolveTrialEligibility`;
   confía en que `checkEligibility` (L135-195) ya respondió `first_publish`.
4. **Veredicto expuesto al cliente.** Comercio tiene `GET .../trial-verdict`
   (`routes/commerce/protected/trial-verdict.ts`). Alojamiento no tiene endpoint
   equivalente; sólo `GET /billing/trial-eligibility`, que **pinea ACCOMMODATION**
   (`routes/billing/trial-eligibility.ts:100`) y cuyo query schema
   (`TrialEligibilityQuerySchema`, `packages/schemas/src/api/billing/trial.schema.ts:222-229`)
   **no admite `productDomain`**.

---

## 4. Vencimiento del trial

Un solo cron: `trial-reconcile`, `cron/jobs/trial-expiry.ts:36-189`, diario 02:00.
Llama `reconcileExpiredTrials`. La claim query (`trial.service.ts:695-711`) filtra
`status='trialing'` + `trial_end < now()` + `deleted_at IS NULL` + `excludeAddonDomainCondition()`.
**Sin predicado de dominio** → agarra las tres verticales. Correcto y simétrico.

Bifurcación en `trial.service.ts:820-828`: si `!subscription.mpSubscriptionId` →
`expireLocalTrial`; si tiene id → se le pregunta a MercadoPago.

`unpublishListingsForExpiredTrial` (`trial-local-expiry.service.ts:120-236`) **sí**
trata las tres, y de forma asimétrica por diseño:

- Re-lee `product_domain` de la fila (L143-147) en vez de confiar en el caller.
  El comentario L136-142 explica por qué (`isAccommodationSubscription` falla ABIERTO).
  Verificado: la lectura existe y es la que decide.
- **No-accommodation** (L149-178): llama `reconcileSubscriptionLinkedEntities` con
  `EXPIRED` y devuelve `{unpublished:0, failed:0}`. Es un **fail-open declarado**:
  el comentario L158-161 admite *"`failed: 0` here means 'nothing to report', not
  'verified down'"*. Verificado contra el código: no hay verificación de que el
  listing efectivamente bajó.
- **accommodation** (L180-235): resuelve `owner_id`, lista accommodations ACTIVE,
  llama `AccommodationService.unpublish` una por una, y **cuenta los fallos**.

Y el orden en `expireLocalTrial` (L322-340) hace que ese conteo importe: si
`failed > 0` **no** se sella el vencimiento (`outcome: 'unpublish-failed'`, L339) y
el próximo tick reintenta. **En comercio ese reintento nunca puede ocurrir**, porque
`failed` es siempre 0 por construcción. Un listing de gastronomía que se quede
publicado tras el vencimiento sólo lo corrige el cron de 6h
`entity-subscription-cache-reconcile`; en alojamiento lo corrige el propio cron
de trial al día siguiente.

---

## 5. Elegibilidad

`trial-eligibility.service.ts` **sí** discrimina por dominio. `TrialEligibilityInput.productDomain`
es **requerido** (L67), y el docblock L61-65 explica que un default habría dejado que un
call site de comercio consumiera el trial de alojamiento. `hasAnyPriorSubscription`
(L283-325) hidrata `productDomain` (L296, HOS-1104 — sin eso el scoping era un no-op)
y saltea toda fila que no matchee (L305-307).

**Respuesta directa: sí, un usuario que gastó su trial en gastronomía conserva el de
alojamiento**, y viceversa. Es la única pieza del carril que cumple la regla de
producto sin objeciones.

Dos asimetrías internas, ambas justificadas y documentadas:
- `subscriptionMatchesDomain` falla ABIERTO para accommodation y CERRADO para el resto.
- Una fila `cancelled` sin historial de eventos falla CERRADO desde HOS-1012 (L211-222).

**Docblocks caducos** (afirmación verificada como falsa):
- `trial-eligibility.service.ts:261-262`: *"one-per-lifetime free trial... any product
  domain"* — contradice el propio código de L305 y el docblock del módulo (L14-21).
- `routes/billing/trial-eligibility.ts:110-111,119`: *"one trial per customer, for life,
  any status, any product domain"*.
- `packages/schemas/src/api/billing/trial.schema.ts:237-244`: *"`eligible: true` means
  the authenticated user has NEVER had any prior `billing_subscriptions` row — any
  status, any product domain"*. Falso dos veces: no es cualquier dominio (L305) y no es
  cualquier status (`NEVER_AUTHORIZED_STATUSES`, L108-111).

---

## 6. Días de trial por vertical

`packages/billing/src/constants/billing.constants.ts`:
`OWNER_TRIAL_DAYS = 30` (L17), `COMMERCE_TRIAL_DAYS = 30` (L51). El comentario L43-51
dice que `COMMERCE_TRIAL_DAYS` se declara aparte en vez de aliasarse a `OWNER_TRIAL_DAYS`
a propósito. Hoy los tres valen **30**: paridad de número, no de mecanismo.

`trial-plans.config.ts:224-254` construye los 3 planes con `hasTrial:true` y su
`trialDays`. Todos con `isActive:false` (nunca vendibles) y fuera de `ALL_PLANS` (L272).

**¿Los planes de comercio tienen `hasTrial`/`trialDays`?** Sí, los seis tiers pagos:
`plans.config.ts:832,889,954,1038,1092,1133` — todos `hasTrial:true, trialDays: COMMERCE_TRIAL_DAYS`.

**¿Alguien los consulta?** Los comentarios en `plans.config.ts:935` y L1069-1072 dicen
que *"the checkout has not read it since HOS-1012 (literal `trialDays: 0`)"*. Verificado:
`resolveCheckoutFreeTrialDays` **ya no existe** — el grep sobre todo el repo devuelve
sólo menciones en comentarios (`subscription-checkout.service.ts:88,367,915`,
`trial-eligibility.service.ts:10,270`, `promo-codes.config.ts:121,132`, dos
data-migrations, y `PricingCardsGrid.astro:1411`). Los comentarios de
`promo-codes.config.ts:121-132` y de `PricingCardsGrid.astro:1411` describen una
función borrada como si estuviera viva: **caducos**.

Quien SÍ lee `metadata.trialDays` en runtime: `resolveCommerceTrialPlan`
(`commerce-trial-start.service.ts:158-171`), sólo comercio. Y las páginas públicas
(según el comentario L96-103, no verificado en `apps/web` en este carril).

---

## 7. Notificaciones / serie de trial

`TRIAL_SERIES_SENDS` — 9 envíos, `-10/-5/-1/0/+1/+5/+10/+30/+60`
(`trial-notification-offsets.ts:121-176`).

**Selección de cohorte: sin filtro de dominio.**
`findPreExpiryCohorts` (`trial-series-cohort.ts:130-139`) filtra `status='trialing'`,
`mp_subscription_id IS NULL`, `deleted_at IS NULL`, ventana de `trial_end`.
`findPostExpiryCohorts` (L211-217) filtra por el evento `TRIAL_EXPIRED` y
`mp_subscription_id IS NULL`. **Ni una comparación de `product_domain` en el archivo.**
→ Los trials de gastronomía y experiencias **entran a la serie de los 9 mails**.

Pero el contenido es de alojamiento:

- `buildTrialUpgradeUrl` (`trial.service.ts:145-153`) construye
  `siteUrl + TRIAL_UPGRADE_PATH`, y `TRIAL_UPGRADE_PATH = '/es/planes/anfitriones/precios/'`
  (L113), **hardcodeado y con locale `es` fijo**. Es el único URL que
  `trial-series-dispatch.ts:192-195` le pasa a los 9 mails. Un restaurante recibe
  "renová tu publicación" apuntando a la página de precios de **anfitriones**.
- El docblock de `TRIAL_UPGRADE_PATH` (L98-99) afirma: *"Every trial-eligible plan
  today is an owner plan (see DEFAULT_TRIAL_PLAN_SLUG), so the owner pricing page is
  the correct, single nudge target for every trial"*. **Esa afirmación es falsa desde
  HOS-1184**: hay tres planes de trial, dos de ellos comercio
  (`ALL_TRIAL_PLANS`, `trial-plans.config.ts:273-298`).
- `customerIsPaying` (`trial-series-cohort.ts:270-297`) lee cualquier suscripción
  entitlement-granting **de cualquier dominio** (el docblock L260-265 lo declara).
  Consecuencia: un dueño que paga gastronomía **corta la serie de su trial de
  alojamiento** — que va a vencer igual. El docblock justifica esto con el supersede
  (T-022), pero el supersede sí filtra por dominio
  (`trial-supersede-on-activation.ts:146-152`), así que la justificación no cubre el
  caso cruzado.

El toggle admin `remindersEnabled` (`trial-series-dispatch.ts:269-275`) gatea los 8
recordatorios y deja pasar el de vencimiento. Sin distinción por vertical.

---

## 8. Enums de veredicto — hay DOS

| | `PublishEligibility` | `CommerceTrialVerdict` |
|---|---|---|
| archivo | `packages/service-core/src/services/accommodation/accommodation.types.ts:5-50` | `apps/api/src/services/commerce-trial-start.service.ts:72-88` |
| valores | `'has_active_sub'`, `'first_publish'`, `'subscription_required'` | `'has_active_sub'`, `'trial_available'`, `'payment_required'` |
| helpers | `publishEligibilityAllowsPublish` (L103), `publishEligibilityStartsLocalTrial` (L138) | ninguno |
| extra | — | `trialDays?: number` (`CommerceTrialVerdictResult`, L91-104) |
| schema de API | no cruza el cable como enum propio | `CommerceTrialVerdictResponseSchema` (`packages/schemas/src/api/billing/commerce-trial-verdict.schema.ts`) |

Los tres estados son **isomorfos uno a uno**:
`has_active_sub`↔`has_active_sub`, `first_publish`↔`trial_available`,
`subscription_required`↔`payment_required`. Ninguna acción destino difiere: en ambos
casos el primero adjunta, el segundo concede trial, el tercero abre checkout.

**La diferencia es accidental**, salvo un detalle que sí es esencial y sólo comercio
tiene: `trialDays` en la respuesta, para que el botón prometa el mismo número que la
concesión va a escribir (docblock L95-103). Alojamiento no expone ese número por
ninguna vía equivalente.

El propio docblock de `CommerceTrialVerdict` (L60-70) dice que el lado de alojamiento
*"flattens them into a boolean that means only `has_active_sub` — so it hides the
publish button from precisely the owner who still has an intact trial (HOS-1183)"*.
No verifiqué la UI (`apps/web`) — fuera de este carril. **NO VERIFICADO.**

---

## 9. Hallazgos adicionales fuera de las 8 preguntas

### 9.1 `applyTrialingPlanUpgrade` es incompatible con el trial de HOS-1012 — en las dos verticales

`trialing-plan-upgrade.service.ts:209-214`:

```ts
if (!mpSubscriptionId) {
    const message = 'Trialing subscription has no linked MercadoPago preapproval — ...';
    apiLogger.error(...);
    throw new SubscriptionCheckoutError('MP_PREAPPROVAL_MUTATION_FAILED', message);
}
```

Los dos call sites pasan el id del proveedor tal cual:
- `routes/billing/plan-change.ts:435` → `mpSubscriptionId: activeSubscription.providerSubscriptionIds?.mercadopago`
- `routes/commerce/protected/change-plan.ts:538` → idéntico

Un trial local tiene `mp_subscription_id = NULL` por construcción
(`subscription-trial-create.service.ts:177-199`, el insert no nombra la columna).
→ Cualquier upgrade de plan durante un trial local termina en
`MP_PREAPPROVAL_MUTATION_FAILED` → HTTP 502. Idéntico en alojamiento y comercio.
El módulo entero está escrito para el mundo card-first (docblock L9-27, todavía
describe `free_trial` preservado). **Simétrico y roto.**

### 9.2 Mensaje de error caduco en `extendExistingSubscriptionTrial`

`packages/service-core/src/services/billing/promo-code/promo-code.trial-extension.ts`,
en la rama de status inválido:

```ts
const isAnnual = sub.mpSubscriptionId === null || sub.mpSubscriptionId === undefined;
const annualSuffix = isAnnual ? ' Annual subscriptions outside their trial period cannot be extended ...'
```

Bajo HOS-1012, `mpSubscriptionId === null` significa **trial local**, no anual
(y desde HOS-171 §7.2 el anual ES un preapproval recurrente, o sea que un anual
tiene id). El operador que intente extender un trial local ya vencido de gastronomía
recibe un mensaje que habla de suscripciones anuales.

### 9.3 `trialExpiryReminderDays` retirado — verificado

`trial-notification-offsets.ts:14-26` afirma que el setting se retiró junto con su UI.
No lo verifiqué en `packages/service-core/.../billing-settings` ni en admin.
**NO VERIFICADO.**

### 9.4 `DEFAULT_TRIAL_PLAN_SLUG` sigue importado y sin usar

`trial.service.ts:27` importa `DEFAULT_TRIAL_PLAN_SLUG` desde `@repo/service-core`.
En el cuerpo del archivo sólo aparece dentro del docblock L98. Residuo del diseño
pre-D5; es lo que hace verosímil la afirmación falsa de §7.
