# Relevamiento 03 — Cancelación, pausa, reactivación, cambio de plan, downgrade

Worktree: `/home/qazuor/projects/WEBS/hospeda-hos-1257-paridad-billing-verticales` @ `5c205fc70`
Método: sólo `Read` / `rg` / `Glob`. Sin codegraph. Read-only.
Regla de producto: los 3 verticales (accommodation / gastronomy / experience) deben comportarse IGUAL.
La separación es lo que hay que justificar.

---

## Q1 — Todos los caminos de cancelación

| # | Camino | Entrada | Verticales | Llama al puente `reconcileSubscriptionLinkedEntities`? | Evidencia |
|---|---|---|---|---|---|
| 1 | Soft-cancel de usuario | `POST /protected/billing/subscriptions/:id/cancel` | TODOS (id explícito) | No (correcto: el acceso sigue hasta fin de período; finaliza el cron #4) | `routes/billing/subscription-cancel.ts:252-266`, `services/subscription-cancel.service.ts:147` |
| 2 | Un-cancel de usuario | `POST /protected/billing/subscriptions/:id/uncancel` | TODOS (id explícito) | No (revierte el flag) | `routes/billing/subscription-cancel.ts:361-374`, `services/subscription-uncancel.service.ts:114` |
| 3 | Hard-cancel de admin | qzpay `DELETE /subscriptions/:id` + hooks | TODOS | **NO — hueco (C-04)** | `routes/billing/admin/qzpay-admin-hooks.ts:334-388` |
| 4 | Cron de finalización | `finalize-cancelled-subs` | TODOS (escanea por `cancelAtPeriodEnd`) | **Sí** + partner | `cron/jobs/finalize-cancelled-subs.ts:637,643` |
| 5 | Retiro de plan (fan-out) | `disablePlanLifecycle` → `cancelAtPeriodEnd=true` | TODOS (agnóstico de dominio) | Indirecto, vía #4 | `services/plan-disable-lifecycle.service.ts:70,86-109` |
| 6 | Dunning | `dunning.job` (ambas ramas) | TODOS | **Sí** (×2) + partner | `cron/jobs/dunning.job.ts:444,523` |
| 7 | Checkouts abandonados | `abandoned-pending-subs.job` | TODOS | **Sí** + partner | `cron/jobs/abandoned-pending-subs.job.ts:162,317,322` |
| 8 | Expiración sin preapproval | `preapproval-less-expiry.job` | TODOS | **Sí** | `cron/jobs/preapproval-less-expiry.job.ts:289` |
| 9 | Webhook MercadoPago | `subscription-logic.ts` | TODOS | **Sí** + partner | `routes/webhooks/mercadopago/subscription-logic.ts:1341,1347` |
| 10 | Supersesión de reactivación | `reactivation-supersession-complete.ts` | TODOS | NO VERIFICADO en profundidad | `services/billing/reactivation-supersession-complete.ts:320` |
| 11 | Refund | `refund-lifecycle.service.ts` | TODOS | NO VERIFICADO en profundidad | `services/refund-lifecycle.service.ts:525` |
| 12 | Otorgar comp | `subscription-comp-grant.service.ts` | TODOS | **Sí** | `services/subscription-comp-grant.service.ts:424,616` |
| 13 | Expiraciones varias | `courtesy-expiry`, `addon-expiry`, `partner-expiry`, `partner-unpaid-reaper`, `trial-expiry` | según job | NO VERIFICADO en profundidad | `cron/jobs/*.ts` |
| 14 | Reaper de duplicados | `reconcileDuplicateSubscriptions` | TODOS — **peligroso (C-08)** | No | `services/trial.service.ts:1710,1755-1786` |

## Q2 — ¿Hay ruta de cancelación separada para comercio?

**NO.** `apps/api/src/routes/commerce/protected/` contiene exactamente:
`change-plan.ts`, `create.ts`, `delete-draft.ts`, `downgrade-preview.ts`, `index.ts`,
`start-subscription.ts`, `trial-verdict.ts`. No hay `cancel`, `pause` ni `reactivate`.

La ruta genérica ES segura para cancelar: `handleUserCancelSubscription`
(`routes/billing/subscription-cancel.ts:114-237`) toma el `:id` de la suscripción del path y
`softCancelSubscription` (`services/subscription-cancel.service.ts:192-201`) valida
`existingRow.customerId !== customerId` → `FORBIDDEN`. **No hay ninguna resolución que asuma
alojamiento**: no llama a `getByCustomerId`, no llama a `selectAccommodationSubscription`, no lee
`productDomain`. `SOFT_CANCELLABLE_STATUSES` (`:120`) es `active|trialing|courtesy`, sin dominio.
Lo mismo para uncancel (`UNCANCELLABLE_STATUSES` en `subscription-uncancel.service.ts:92`).

**La ruta que SÍ asume alojamiento es la de PAUSA** (ver Q3 / C-01 / C-02).

## Q3 — Pausa

Existe UNA sola pausa self-serve para los 3 verticales:
`POST /protected/billing/me/subscription-pause` y `/me/subscription-resume`
(`routes/billing/subscription-pause.ts:290-313`), montada en la raíz de billing
(`routes/billing/index.ts:293`). No hay pausa por vertical.

Dos problemas encadenados:

**C-01 — la pausa elige la suscripción SIN filtro de dominio.**
```ts
// routes/billing/subscription-pause.ts:76-87
const subscriptions = await billing.subscriptions.getByCustomerId(billingCustomerId);
const activeSubscriptions = subscriptions.filter(
    (sub) => sub.status === 'active' || sub.status === 'trialing'
);
const target = activeSubscriptions.find((sub) => sub.cancelAtPeriodEnd !== true);
```
Es exactamente el `find` sin predicado de dominio que HOS-1213 arregló en plan-change
(`routes/billing/plan-change.ts:246` → `selectAccommodationSubscription`) y que el comercio evita
con `findOwnerVerticalSubscription` (`routes/commerce/protected/change-plan.ts:427`). Desde HOS-688
un customer sostiene legítimamente hasta 3 suscripciones vivas, así que "pausá mi suscripción" cae
sobre la que el adaptador devuelva primero. Idéntico en resume (`:225-234`).
El endpoint **no recibe id de suscripción**: `pauseSubscription()` en
`apps/web/src/lib/api/endpoints-protected.ts:838-847` postea sin body ni path param, así que el
cliente ni siquiera puede desambiguar.

**C-02 — el efecto de suspensión de servicio es sólo alojamiento.**
```ts
// services/subscription-pause.service.ts:65-111
await db.update(users).set({ serviceSuspended: input.suspended, ... })
const updated = await db.update(accommodations)
    .set({ ownerSuspended: input.suspended, ... })
    .where(eq(accommodations.ownerId, input.userId))
```
No hay equivalente para `gastronomies` / `experiences` / `partners`, y **ni la pausa self-serve ni
los hooks de admin llaman a `reconcileSubscriptionLinkedEntities`**
(`routes/billing/subscription-pause.ts:183-197`; `routes/billing/admin/qzpay-admin-hooks.ts:924-969`
y `:1000-1035`). Consecuencia: pausar una suscripción de gastronomía esconde los ALOJAMIENTOS del
dueño y deja el listado gastronómico público y cobrando cero.

**Guards por dominio que rechacen pausar: NINGUNO.** Los únicos guards son de estado:
`cancelAtPeriodEnd` (409, `:87-98`) y ausencia de preapproval de MP (400, `:132-138`).

**C-03 — la UI ofrece Pausar en un dashboard de comercio.**
```ts
// apps/web/src/components/account/SubscriptionDashboard.client.tsx:1029
const canPause = (status === 'active' || status === 'trial') && !isCancelScheduled && !isComplimentary;
```
Sin `commerceVertical === null`, a diferencia del flujo de cambio de plan que sí lo lleva (`:1488`).
El botón se renderiza en `:1337`. O sea C-01+C-02 son alcanzables desde la UI, no teóricos.

## Q4 — Cambio de plan: diferencia por diferencia

`routes/billing/plan-change.ts` (866 líneas) vs `routes/commerce/protected/change-plan.ts` (684).

| Aspecto | Alojamiento | Comercio | Clasificación |
|---|---|---|---|
| Selección de suscripción | `selectAccommodationSubscription` sobre `active\|trialing` (`:246`) | `findOwnerVerticalSubscription({vertical})` (`:427`) | ESENCIAL |
| Guard de dominio del target | `assertAccommodationPlanChangeTarget(targetPlan.name)` (`:305`) | `resolveCommercePlanSlug({entityType, requestedPlanSlug})` (`:392`) — más fuerte, por vertical | ESENCIAL |
| Permiso | ninguno propio; hereda `billingPermMiddleware()` (`BILLING_VIEW_OWN`, `routes/billing/index.ts:156`) | `protectedAuthMiddleware([COMMERCE_EDIT_OWN])` (`:672-675`) | COMPORTAMIENTO-DISTINTO |
| Idempotencia | `idempotencyKeyMiddleware({operation:'hospeda.change_plan'})` (`:859-862`) | `…'hospeda.commerce_change_plan'` (`:677-680`) | SIMÉTRICO-OK |
| Guard "gana la cancelación" | `ServiceError(ALREADY_EXISTS, 'SUBSCRIPTION_CANCEL_PENDING')` (`:262-269`) | `HTTPException(409)` (`:449-454`) | SIMÉTRICO-OK (mismo status) |
| Plan retirado | `ServiceError(PLAN_DISABLED)` → 410 (`:284-291`) | `HTTPException(410)` (`:464-468`) | SIMÉTRICO-OK |
| Intervalos | monthly/annual/quarterly/semi_annual (`:152,163-179`) | `'month'`/`1` hardcodeado (`:243-245,584-585`) | ESENCIAL (todos los tiers de comercio son mensuales: `annualPriceArs: null`) |
| Rank cross-categoría | `resolvePlanCategory` + `compareCategoryRank` → `applyImmediatePaidPlanSwap` para rank-up igual o más barato (`:386-399,554`) | inexistente; precio igual → 422 (`:497-503`) | ESENCIAL declarado (`:486-487`: los planes de comercio llevan `category:'owner'` como placeholder) |
| Upgrade en trial | `applyTrialingPlanUpgrade` (`:420`) | `applyTrialingPlanUpgrade` (`:529`) — mismo servicio | SIMÉTRICO-OK |
| Upgrade pago | `initiatePaidPlanUpgrade` (`:495`) | `initiatePaidPlanUpgrade` (`:580`) — mismo servicio | SIMÉTRICO-OK |
| Downgrade | `scheduleSubscriptionDowngrade` (`:612`) | `scheduleSubscriptionDowngrade` (`:238`) — mismo servicio | SIMÉTRICO-OK |
| Prorrateo | delegado a `initiatePaidPlanUpgrade` | idem | SIMÉTRICO-OK |
| Remediación de excedentes | `computeDowngradeExcess` → alojamientos + promociones + fotos (`:665`) | `computeCommerceDowngradeExcess` → listados (`:278`) | ESENCIAL (modelos distintos) |
| Preview de restricción | campo `restrictionPreview` (`:766`) | campo `commerceRestrictionPreview` (`:338-340`) | SIMÉTRICO-OK |
| Notificación | `PLAN_DOWNGRADE_LIMIT_WARNING` una por dimensión con excedente (acc + promos) (`:714-748`) | una sola, `LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical]` (`:298-313`) | ESENCIAL |
| Auditoría | `auditLog(BILLING_MUTATION)` en las 3 ramas (`:449,577,642`) | idem en las 3 (`:268,551,610`) | SIMÉTRICO-OK |
| Mapeo de error de upgrade | `mapUpgradeErrorToHttp` (`:70-108`) | `mapCommerceUpgradeErrorToHttp` (`:144-164`) — copia declarada; **`MISSING_INIT_POINT` 500 en ambos, `MISSING_PROVIDER_SUBSCRIPTION_ID` 502 en ambos** | SIMÉTRICO-OK |
| Mapeo de error de downgrade | `SAME_PLAN`/`NOT_A_DOWNGRADE` → **422** (`:121-123`) | los mismos → **409** (`:178-183`) | COMPORTAMIENTO-DISTINTO (justificado en el docblock `:170-176`: acá son carreras, no input inválido) |
| Errores de proveedor | `isBillingProviderError` → `mapProviderErrorToServiceError` + `captureBillingError` (`:792-808`) | **ausente**: sólo `SubscriptionCheckoutError`, todo lo demás re-lanzado crudo (`:626-631`) | COMPORTAMIENTO-DISTINTO |
| `keepSelections` | `KeepSelections` (accommodationIds/promotionIds/photoKeepMap) (`:225`) | `CommerceKeepSelections` (listingIds) (`:518`) | ESENCIAL |

**Lo que uno tiene y el otro no**
- Alojamiento tiene: multi-intervalo, swap inmediato cross-categoría, mapeo de errores de proveedor
  a 502/503/504 + Sentry, notificación multi-dimensión.
- Comercio tiene: permiso propio (`COMMERCE_EDIT_OWN`), resolución de slug por vertical (más
  restrictiva que la aserción de dominio del otro lado), 409 en vez de 422 para carreras.

**C-14 — docblock CADUCO.** `routes/commerce/protected/change-plan.ts:23-32` afirma que el handler
de alojamiento selecciona con
`subscriptions.find((sub) => sub.status === 'active' || sub.status === 'trialing')`
— "the FIRST live subscription the customer has, with no domain predicate at all". Eso dejó de ser
cierto con HOS-1213: hoy es `selectAccommodationSubscription(...)` en `plan-change.ts:246`. El
docblock usa esa afirmación como justificación central de por qué la ruta de comercio existe.
(La justificación sigue siendo válida por otras razones — permiso, slug por vertical — pero la
evidencia que cita ya no existe.)

## Q5 — Catálogo de planes ofrecidos

Dos endpoints, con posturas OPUESTAS:

- **`GET /api/v1/public/plans`** — SÍ filtra por dominio.
  `routes/billing/public/listPlans.ts:44-59` (`getPlanSlugsOutsideDomain`, `ne(billingPlans.productDomain, domain)`),
  `:74-89` (`?domain=`, default `accommodation`), aplicado en `:252-271`. Falla ABIERTO sólo para
  accommodation y CERRADO para el resto (`:265`).
- **`GET /api/v1/protected/billing/plans`** — **NO filtra por dominio.**
  `routes/billing/protected-plans-list.ts:98-102`:
  ```ts
  return plans.filter((plan) => !isTestPlan(plan) && isPubliclyListedStoragePlan(plan));
  ```
  Sólo `metadata.testPlan` y `metadata.publicListing`. Devuelve tiers de gastronomía, experiencias
  y partner a cualquier usuario autenticado, en ambas ramas (`?active=true` en `:193` y paginada en
  `:211`).

**Consumidores** (`rg` sobre `apps/web/src` y `apps/admin/src`): ningún consumidor del selector de
cambio de plan usa el endpoint protegido. La web arma los planes desde el público, ya scopeado:
`apps/web/src/lib/billing/fetch-plans.ts:88-89` (`?domain=` opcional),
`apps/web/src/lib/billing/commerce-landing-plan.ts:5`, `audience-plans.ts:307-310`. El dashboard
recibe `commercePlans` como prop separada (`SubscriptionDashboard.client.tsx:90-99`, HOS-1213). El
admin usa `/admin/billing/plans` (`apps/admin/src/features/billing-plans/hooks.ts:138`).

→ El impacto de C-13 hoy es **exposición** (un turista autenticado ve precios de tiers de otro
vertical), no un flujo de plan equivocado. Pero es la única lista de planes del repo sin noción de
dominio, y basta un consumidor nuevo para volverla un bug.

## Q6 — Las dos remediaciones de downgrade

`plan-downgrade-remediation.service.ts` (727) vs `commerce-downgrade-remediation.service.ts` (771).

**Lo que se solapa (el mecanismo, 5 pasos idénticos):** recomputar el excedente fresco → mezclar la
selección del dueño con el orden por defecto → restringir → revalidar → resumen idempotente.

**Diferencias ESENCIALES (modelo de datos distinto):**
- Dimensiones: alojamiento restringe 3 (alojamientos, promociones, fotos:
  `plan-downgrade-remediation.service.ts:507-570`); comercio restringe 1 (listados:
  `commerce-downgrade-remediation.service.ts:512-519`).
- Mecanismo de restricción: `accommodations.planRestricted` vía `restrictAccommodations` vs
  `entity_subscriptions.plan_restricted` + reconciliador de visibilidad (`:304-311`).
- Lectura del cap: `?? -1` (ilimitado) en alojamiento vs `CommerceListingCapMissingError` explícito
  en comercio (`:331-344`) — el comercio es MÁS estricto y está bien argumentado en `:29-42`.
- Recuento de destinos: sólo alojamiento (`triggerDestinationRecounts`, `:385-420`).
- Revalidación: alojamiento resuelve slugs y degrada a variante sin slug (`:594-653`); comercio
  emite eventos sólo por id (`:218-227,748-771`).

**Diferencias ACCIDENTALES (los hallazgos):**

**C-09 — la truncación de la selección difiere, y el docblock afirma que no.**
`commerce-downgrade-remediation.service.ts:419-422` dice literalmente:
> "Same three rules `plan-downgrade-remediation`'s `resolveKeepIds` applies — drop unknown ids,
> truncate an over-cap selection through the default band, fall back to the default band when
> nothing valid remains — so a downgrade behaves the same way whichever vertical it is in."

El código no hace eso. Alojamiento (`plan-downgrade-remediation.service.ts:273-299`):
```ts
if (valid.length > cap) {
    const defaultBand = new Set(defaultKeep.slice(0, cap));
    const truncated = valid.filter((id) => defaultBand.has(id)).slice(0, cap);
    if (truncated.length === 0) { /* fallback COMPLETO al default */ }
```
Comercio (`commerce-downgrade-remediation.service.ts:442-449`):
```ts
const chosen = valid.slice(0, cap);
const keepIds = new Set(chosen);
for (const id of defaultKeep) { if (keepIds.size >= cap) break; keepIds.add(id); }
```
Sin intersección con la banda por defecto y sin fallback. Caso que las separa: cap 3, el dueño
elige 5 listados y ninguno está entre los 3 más recientes. Alojamiento **descarta la selección
entera** y conserva la banda por defecto; comercio **conserva las 3 primeras elecciones del dueño**.
Resultados distintos para el mismo input, bajo un comentario que promete paridad.
Además comercio no devuelve `fromDefault` (`:428`) mientras alojamiento sí (`:249-253`).

**C-10 — comercio no es transaccional.**
Alojamiento envuelve todas las primitivas en `withTransaction` (`:530-571`), documentado como INV-5
("Partial failure inside the tx rolls back the entire operation", `:22-23`). Comercio hace
`setPlanRestricted` suelto (`:514-519`) y después un bucle por listado con el error tragado
(`:525-544`). Un fallo a mitad deja unos listados restringidos y otros no.

## Q7 — Reactivación / uncancel

- **Uncancel** (`POST /subscriptions/:id/uncancel`): id explícito, ownership, sin dominio.
  Funciona igual en los 3. `services/subscription-uncancel.service.ts:114-298`. SIMÉTRICO-OK.
- **Reactivación** (`POST /billing/trial/reactivate` y `/reactivate-subscription`,
  `routes/billing/trial.ts:220,417`): una sola ruta genérica, sin equivalente en comercio.

**C-07 — la reactivación hidrata el dominio y después lo ignora.**
```ts
// services/trial.service.ts:1355-1358
const rawSubscriptions = await this.billing.subscriptions.getByCustomerId(customerId);
const subscriptions = (
    await hydrateSubscriptionProductDomains(rawSubscriptions ?? [])
).filter((sub) => !isAddonSubscription(sub));
```
`awk 'NR>=1322 && NR<=1560'` + `rg` sobre `productDomain|domain|vertical|accommodation` en ese rango
devuelve **una sola línea: la 1357**, la hidratación. El valor nunca se lee. Contraste directo:
en `getTrialStatus` la misma hidratación (`:294`) va seguida de una discusión explícita de dominio
(`:320-336`), y en `plan-change.ts` alimenta `selectAccommodationSubscription`.

Dos consecuencias medidas en el código:
1. `:1374-1390` — `subscriptions.find((sub) => isEntitlementGrantingStatus(sub.status))` sobre TODOS
   los dominios → 409 `ACTIVE_SUBSCRIPTION_EXISTS` con el mensaje "Use plan-change instead". Un host
   con gastronomía ACTIVA y alojamiento CANCELADO no puede reactivar su alojamiento; y plan-change
   tampoco lo salva, porque exige `active|trialing` (`plan-change.ts:247`).
2. `:1393` — `subscriptions.find((sub) => sub.status === 'canceled')`: elige la primera cancelada de
   cualquier dominio.
   Y `resolveReactivationPlan` (`services/billing/reactivation-plan-guard.ts:193-246`) valida
   catálogo, precio activo y precio ≠ 0, pero **no valida dominio**: acepta cualquier `plan.id` de
   `listAll()`, incluido un tier de gastronomía sobre una suscripción de alojamiento.

**Camino que sólo existe para alojamiento:** el anual. `reactivation-plan-guard.ts:103` acepta
`'monthly' | 'annual'` y `trial.service.ts:1163-1194` lo implementa; ningún tier de comercio tiene
precio anual (`commerceVerticalTier` fija `annualPriceArs: null` para los 6 —
`routes/commerce/protected/change-plan.ts:485-487`). ESENCIAL, no un hueco.

## Q8 — Idempotencia (guard de doble click)

**`services/billing/checkout-idempotency.ts` no participa de estos caminos.** Sus 4 exports
(`resolveReusableCommerceCheckout:246`, `resolveReusablePartnerCheckout:276`,
`resolveReusableCommerceOwnPreapprovalCheckout:422`, `resolveReusablePartnerOwnPreapprovalCheckout:460`)
tienen **un solo importador**: `services/subscription-checkout.service.ts:103`, usado en `:946`
(idempotencia por LISTING) y `:1268` (por PARTNER). Es el guard del **checkout inicial** de
comercio/partner, no de cambio de plan ni de reactivación. Su propio docblock lo dice (`:1-2`).

Lo que sí protege estos caminos es `idempotencyKeyMiddleware`. Inventario completo
(`rg "idempotencyKeyMiddleware\("`):

| Ruta | Operación | Tiene |
|---|---|---|
| `billing/plan-change.ts:861` | `hospeda.change_plan` | ✅ |
| `commerce/protected/change-plan.ts:679` | `hospeda.commerce_change_plan` | ✅ |
| `billing/start-paid.ts:546` | `hospeda.start_paid` | ✅ |
| `commerce/protected/start-subscription.ts:674` | `hospeda.commerce_start_subscription` | ✅ |
| `billing/addons.ts:524,526` | purchase / cancel | ✅ |
| `billing/replace-payment-method.ts:158` | `hospeda.replace_payment_method` | ✅ |
| **`billing/subscription-cancel.ts`** (cancel Y uncancel) | — | ❌ |
| **`billing/subscription-pause.ts`** (pause Y resume) | — | ❌ |
| **`billing/trial.ts`** (reactivate, reactivate-subscription) | — | ❌ |

→ Cambio de plan: **simétrico y protegido en ambos verticales**. Cancelación, pausa y reactivación:
**sin guard de idempotencia, simétricamente para los 3 verticales**. Cancel y uncancel mitigan con
short-circuit idempotente bajo `FOR UPDATE` (`subscription-cancel.service.ts:206-217`,
`subscription-uncancel.service.ts:153-159`); pausa y reactivación no tienen ni eso.

## Q9 — Efectos posteriores: quién despublica cada vertical

Hay UN puente declarado, `reconcileSubscriptionLinkedEntities`
(`services/subscription-linked-entities.service.ts:57-71`), que hace dos mitades independientes:
comercio (`reconcileCommerceListingForSubscription`) y caché de alojamiento
(`syncAccommodationSubscriptionCacheForSubscription`).

**Sitios que lo llaman (9 llamadas / 8 archivos, verificado por `rg`):**
`webhooks/mercadopago/subscription-logic.ts:1341` · `cron/jobs/dunning.job.ts:444` y `:523` ·
`cron/jobs/finalize-cancelled-subs.ts:637` · `cron/jobs/abandoned-pending-subs.job.ts:317` ·
`cron/jobs/preapproval-less-expiry.job.ts:289` · `services/commerce-subscription-attach.service.ts:194` ·
`services/billing/trial-local-expiry.service.ts:162` · `services/subscription-comp-grant.service.ts:616`.

**C-15 — el docblock lista SEIS** (`subscription-linked-entities.service.ts:12-23`) y omite
`trial-local-expiry` y `subscription-comp-grant`. Caduco, no peligroso.

**Sitios que NO lo llaman y mueven el estado de la suscripción:**

**C-04 — hard-cancel de admin.** `routes/billing/admin/qzpay-admin-hooks.ts:334-388`
(`onAfterSubscriptionCancel`) hace: marcar addons `canceled`, escribir el evento de auditoría,
`clearEntitlementCache(subscription.customerId)`. Nada más. Un admin que cancela una suscripción de
gastronomía deja el listado PÚBLICO. Compárese con `finalize-cancelled-subs.ts:637-647`, que sí
llama al puente Y a `reconcilePartnerForSubscription`.

**C-02 (bis) — pausa/resume, admin y self-serve.** Ninguno de los cuatro handlers llama al puente
(`subscription-pause.ts:183,253`; `qzpay-admin-hooks.ts:935,1009`). Sólo `setOwnerServiceSuspension`.

**C-05 — no hay red de contención para comercio.** El backstop de 6 horas está scopeado a
alojamiento:
```ts
// cron/jobs/entity-subscription-cache-reconcile.job.ts:194
.where(eq(entitySubscriptions.entityType, ACCOMMODATION_ENTITY_TYPE));
```
(su propio docblock `:4` dice "The backstop for the accommodation half of `entity_subscriptions`").
`ls cron/jobs/` no muestra ningún reconciliador de visibilidad de comercio equivalente. Consecuencia
asimétrica: cuando un sitio de escritura se olvida del puente, **alojamiento se auto-corrige en ≤6h
y comercio queda mal para siempre**. Eso convierte a C-04 en un bug permanente sólo del lado
comercio.

`apply-scheduled-plan-changes.ts` no llama al puente, pero no es un hueco: despacha por dominio
(`:530-620`) y la rama de comercio llega a la visibilidad vía
`applyCommerceDowngradeRestrictions` → `deps.reconcileListing` (`commerce-downgrade-remediation.service.ts:527`).

---

## Hallazgos adicionales fuera de las 9 preguntas

**C-06 — `replacePastDuePaymentMethod` acuña una suscripción sin dominio.**
La ruta acepta cualquier suscripción `past_due` del customer, sin guard de dominio
(`routes/billing/replace-payment-method.ts:73-106`: id + ownership + status + `billingInterval !== 'year'`).
El servicio acuña con `createPaidSubscription` (`services/billing/past-due-payment-method-replacement.service.ts:249-268`)
pasando `metadata` pero **ningún `productDomain`** — `rg productDomain` sobre
`services/billing/paid-subscription-create.ts` no devuelve nada. Y
`billing_subscriptions.product_domain` es
`DEFAULT 'accommodation' NOT NULL` (`packages/db/src/migrations/0044_adorable_longshot.sql:21`).
Tampoco escribe fila puente: el servicio no llama a `writeDomainLinkRow` ni pasa `domainMetadata`
(el módulo lo admite en `:104` y `:153`: "this flow has none").
→ Un dueño de gastronomía en `past_due` que arregla su tarjeta obtiene una suscripción marcada
`accommodation`, sin `entity_subscriptions` apuntándole. Paga, y su listado no vuelve a publicarse.

Contraste directo con el camino hermano: `services/billing/preapproval-recovery.service.ts:283`
```ts
const RETRY_SUPPORTED_PRODUCT_DOMAINS: ReadonlySet<string> = new Set(['accommodation']);
```
que **tira un error explícito** (`:337-341`) para cualquier otro dominio. Dos rutas de recuperación
hermanas, misma amenaza, posturas opuestas: una falla cerrada y ruidosa, la otra sigue en silencio.

**C-08 — el reaper de duplicados cancelaría suscripciones legítimas de otros verticales.**
`services/trial.service.ts:1730-1786`: hidrata dominios (`:1731`), filtra addons y estados vivos, y
si quedan ≥2 **cancela todas menos la más nueva** (`:1785 await this.billing.subscriptions.cancel(dup.id)`).
Desde HOS-688 tener 2-3 suscripciones vivas es el diseño, no un duplicado. El docblock (`:1690-1700`)
razona sobre trial-upgrades parciales y addons, nunca sobre verticales.
**Latente**: `rg reconcileDuplicateSubscriptions` fuera de `trial.service.ts` sólo encuentra menciones
en comentarios (`addon-recurring-activation.service.ts:142`,
`billing/trial-supersede-on-activation.ts:29`, que además lo llama "a backstop and NOT the design").
Sin call site de producción. Riesgo si alguien lo cablea.

**C-16 — docblock contra código en soft-cancel.** `services/subscription-cancel.service.ts:141`
declara `@throws {ServiceError} AUTHORIZATION_ERROR`; el código tira
`ServiceErrorCode.FORBIDDEN` (`:198`). Cosmético.

**C-17 / C-18 — huecos deliberados y declarados, sin paridad.**
- `services/billing/apply-price-increase.service.ts:342-345`: `isAccommodationSubscription(row)`
  filtra comercio/partner. No existe herramienta de aumento de precio para comercio.
- `services/billing/preapproval-recovery.service.ts:283,337-341`: checkout-retry rechaza
  comercio/partner con error explícito.

## Lo simétrico (para que no se toque)

- Cancel / uncancel de usuario: una ruta, id explícito, ownership en el servicio, sin lógica de
  dominio, mismos estados. `routes/billing/subscription-cancel.ts` + los dos servicios.
- `finalize-cancelled-subs`: agnóstico de dominio, llama a AMBOS reconciliadores.
- `plan-disable-lifecycle.service.ts`: agnóstico (opera sobre `planId`, cualquier dominio).
- `subscription-status-transitions.ts` / `-normalize.ts` / `-constants.ts`: cero ramas por dominio
  (`rg` sin resultados sobre `accommodation|commerce|productDomain`).
- `GET /subscriptions/:id/status` y `POST /subscriptions/:id/replace-payment-method`: id-keyed +
  ownership (`subscription-status.ts:139`; `replace-payment-method.ts:87`). El problema de C-06 está
  en el servicio, no en la ruta.
- `apply-scheduled-plan-changes.ts:530-620`: despacho por dominio del plan target, con las dos ramas
  realmente paralelas y el porqué escrito (`:523-531`).
- Idempotencia de cambio de plan: presente en ambos verticales.
- `applyTrialingPlanUpgrade`, `initiatePaidPlanUpgrade`, `scheduleSubscriptionDowngrade`: un solo
  servicio, compartido por los dos verticales. No hay tercer mecanismo.
