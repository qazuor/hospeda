---
linear: HOS-1257
statusSource: linear
title: Relevamiento de paridad de billing entre las 3 verticales
date: 2026-09-08
base: origin/staging @ 5c205fc70
method: lectura de código exclusivamente
---

# Relevamiento — paridad de billing entre alojamiento, gastronomía y experiencias

## Método

Ocho barridos paralelos e independientes sobre un worktree cortado de `origin/staging`
fresco (`5c205fc70`), con tres reglas:

1. **Los comentarios y docblocks son afirmaciones a verificar, no evidencia.** Un
   comentario falso o caduco cuenta como hallazgo propio.
2. **Evidencia = `archivo:línea` + el código.** Lo no leído va marcado `NO VERIFICADO`.
3. **Se reporta también lo simétrico.**

Prohibido `codegraph`: su índice sirve el clone principal, que estaba 820 commits
atrás de staging. Todo se leyó con `Read`/`rg` sobre el worktree.

A los carriles **no** se les pasó el inventario previo del issue, para que barrieran
sin sesgo de confirmación. El cruce contra ese inventario está en §6.

Reportes detallados por carril en [`carriles/`](./carriles/). El carril 06
(webhooks/crons) no dejó su archivo completo en disco; sus hallazgos están
transcriptos íntegros en §3 y §4.

---

## 1. Veredicto

La regla del dueño — «todo lo de billing debe funcionar EXACTAMENTE IGUAL entre las
3 verticales» — se rompe hoy en **más de cuarenta puntos verificados**, de los cuales
**nueve cuestan dinero o exponen datos ya**.

Pero el diagnóstico del issue original necesita una corrección de fondo:

> **La deuda NO apunta en una sola dirección.** No es «comercio está atrasado
> respecto de alojamiento». Cada migración sucesiva (HOS-191 Path C, HOS-937
> own-preapproval, HOS-1012 no-trial, SPEC-239 aislamiento) se aplicó primero a una
> vertical y a medias a la otra, **y no siempre a la misma primero**.

Ejemplos verificados de deuda en cada sentido:

| Capacidad | La tiene | Le falta a |
|---|---|---|
| Idempotencia de checkout por entidad | comercio, partner | **alojamiento** |
| `past_due` bloquea segundo checkout | comercio | **alojamiento** |
| Resolver de plan con guard de CI | comercio | **alojamiento** |
| Promo codes en el checkout | alojamiento, turista | comercio, partner |
| Plan anual | alojamiento, partner | comercio |
| `comp` | alojamiento, turista | comercio (rechazo duro) |
| Reconciliador de caché de estado | alojamiento | comercio |
| Entitlements customer-level en el gate | alojamiento, turista | comercio |

Esto cambia el plan: no alcanza con «llevar comercio al nivel de alojamiento».
Hay que **unificar**, que es distinto — y en dos casos el modelo bueno es el de comercio.

---

## 2. Hallazgos que cuestan dinero o exponen datos HOY

Los nueve, ordenados por daño. Todos verificados leyendo el código.

### 2.1 — Un dueño de comercio compra un addon, se le cobra, y no recibe nada

Los dos gates de la misma compra no dicen lo mismo:

| Etapa | Archivo | Predicado |
|---|---|---|
| Compra | `apps/api/src/services/addon.checkout.ts:463` | `subscriptionMatchesDomain(sub, addonProductDomain)` ✅ |
| Grant post-pago | `apps/api/src/services/addon-entitlement.service.ts:153` | `isAccommodationSubscription(sub)` ❌ |

El dueño de gastronomía pasa el gate de compra (correcto, HOS-1178), paga, y el grant
no encuentra ninguna suscripción de alojamiento suya. Devuelve `NO_ACTIVE_SUBSCRIPTION`,
no otorga, marca `needsEntitlementSync`, y el cron reintenta **el mismo camino roto**.

Mismo filtro en la **revocación** (`:458`) y en la **lectura de ajustes** (`:725`): un
addon de comercio tampoco se revoca al cancelar.

**Sub-caso peor (dueño dual):** el filtro sí encuentra la suscripción de *alojamiento*,
y `basePlanLimit` sale del plan de alojamiento, que no declara `max_gastronomies` → `0`.
El addon deja el cupo en `0 + increase` en vez de `base + increase`. Con packs mayores
**puede BAJAR el cupo** (`addon-entitlement.service.ts:246-256`, `:313`).

El gemelo de este servicio en `service-core` **ya se arregló** en HOS-688
(`addon-limit-recalculation.service.ts:280-288`), y su docblock describe este bug
palabra por palabra. Sólo corre en cambio de plan y cancelación, nunca en la compra.

> **Acción sugerida antes de planificar**: revisar en producción si algún
> `billing_customer_limits` de comercio ya quedó mal escrito por esto.

### 2.2 — `/start-paid` no valida el dominio del plan

`resolvePlanBySlug` (`subscription-checkout.service.ts:154`) hace `listAll()` y matchea
por nombre, sin filtro de dominio. La rama de alojamiento nunca setea `productDomain`
—sólo lo hacen comercio (`:887`) y partner (`:1329`)— y el creador cae al default:

```ts
// apps/api/src/services/billing/pending-provider-subscription-create.ts:273
const productDomain = input.productDomain ?? ProductDomainEnum.ACCOMMODATION;
```

Un `POST /start-paid` con `planSlug: 'gastronomy-pro'` crea una suscripción marcada
**alojamiento**. Y como `subscriptionMatchesDomain` falla ABIERTO para alojamiento, esa
fila envenenada después cuenta como suscripción de alojamiento válida en todo lo que
consulte entitlements.

El guard existe (`billing/plan-domain-guard.ts::assertAccommodationPlanSlug`) y tiene
tres consumidores: downgrade, upgrade-restoration y la ruta de cambio de plan. **El
checkout no es uno de ellos.**

### 2.3 — Doble click en el checkout de alojamiento = dos preapprovals pagables

La idempotencia por entidad existe en comercio (`subscription-checkout.service.ts:971-988`)
y partner (`:1279-1294`). **Ausente** en alojamiento mensual (`:397-780`) y anual
(`:1519-1729`).

El `idempotencyKeyMiddleware` de `/start-paid` **no cubre este caso**: cachea por un
header que el cliente regenera en cada click
(`apps/web/src/lib/commerce/owner-listings.ts:253,308` → `crypto.randomUUID()`).

El daño está descripto con precisión en `billing/checkout-reuse-decision.ts:7-19`,
un módulo que explica por qué el 409 no alcanza — y ese razonamiento **es literalmente
aplicable al camino que no cubre**.

### 2.4 — Un moroso de alojamiento puede abrir un segundo preapproval

Comercio bloquea un segundo checkout si hay una suscripción `past_due`
(`routes/commerce/protected/start-subscription.ts:136`, que usa
`ENTITLEMENT_GRANTING ∪ {past_due}`). Alojamiento sólo consulta
`isEntitlementGrantingStatus` (`routes/billing/start-paid.ts:212`), que **no incluye
`past_due`** (`packages/billing/src/predicates/is-entitlement-granting-status.ts:44`).

### 2.5 — La pausa: elige mal la suscripción y suspende la tabla equivocada

Tres capas fallando juntas:

- **Elige la suscripción con un `find` sin predicado de dominio**
  (`routes/billing/subscription-pause.ts:76-87`, `:225-234`). Es la forma exacta del bug
  que HOS-1213 arregló en `plan-change.ts:246` y que acá quedó. El endpoint **no recibe
  un id**, así que el cliente ni siquiera puede desambiguar.
- **Suspende sólo `accommodations`** (`services/subscription-pause.service.ts:65-111`).
  Ni el self-serve ni los hooks de admin llaman al puente.
- **La UI ofrece el botón a comercio**: `canPause` no lleva el gate
  `commerceVertical === null` que sí lleva `canChangePlan`, doce líneas más abajo en el
  mismo archivo (`SubscriptionDashboard.client.tsx:1029` vs `:1488`).

### 2.6 — Un `comp` de alojamiento hard-cancela el preapproval de gastronomía del mismo dueño

El supersede del comp lee **todas** las suscripciones del customer sin filtro de dominio
(`subscription-comp-grant.service.ts:362-374`, `WHERE` sólo por `customerId`).

Y el loop de supersede **no llama** `reconcileSubscriptionLinkedEntities` (`:420-530`);
sólo lo hace una vez, para la fila nueva del comp. Como el backstop es accommodation-only,
la fila de `entity_subscriptions` de esa gastronomía queda `active` con el preapproval
cancelado — **listado público, cobro muerto**.

### 2.7 — El hard-cancel de admin deja el listado de comercio público

`routes/billing/admin/qzpay-admin-hooks.ts:334-388` hace addons + auditoría + caché, y
**no llama al puente**. Contraste: `cron/jobs/finalize-cancelled-subs.ts:637,643` sí.

### 2.8 — Webhooks descartados en partner y admin-comercio

`routes/partners/admin/send-link.ts:29-31` y
`routes/commerce/admin/start-subscription.ts:65-67` arman el `notification_url` **sin**
`?source_news=webhooks`. El router descarta la entrega respondiendo 200
(`routes/webhooks/mercadopago/router.ts:209-229`), así que MercadoPago **no reintenta**
y ningún extremo registra error. Contraste correcto:
`routes/billing/checkout-return-urls.ts:178-180`.

Latente hasta que se encienda el flag correspondiente.

### 2.9 — El paywall del trial local no dispara en NINGUNA vertical

`expireLocalTrial` escribe `'expired'` (`trial-local-expiry.service.ts:349`), igual que
el supersede (`trial-supersede-on-activation.ts:71,187`). La rama de `getTrialStatus`
que busca al usuario con trial vencido pregunta por `'canceled'` (`trial.service.ts:386`).
Nunca se cruzan: al que se le venció el trial le responde *«nunca tuvo trial»*.

Es paridad perfecta: roto igual en las tres. El código **tiene un comentario que
documenta ese hueco con precisión** (`trial.service.ts:369-379`) y concluye que la rama
no está muerta. Era cierto cuando se escribió; HOS-1012 volvió `'expired'` el único
estado terminal de un trial local y el hueco pasó de parcial a total, sin que una línea
del comentario dejara de ser verdad.

---

## 3. Matriz de capacidades

`ALO`=alojamiento · `GAS`=gastronomía · `EXP`=experiencias · `TUR`=turista · `PAR`=partner

| # | Capacidad | ALO | GAS | EXP | TUR | PAR | Evidencia |
|---|---|:--:|:--:|:--:|:--:|:--:|---|
| 1 | Plan de trial dedicado | ✅ | ✅ | ✅ | ❌ | ❌ | `trial-plans.config.ts:224/235/246` |
| 2 | Composición de trial resuelta al GATEAR | ✅ | ❌ | ❌ | ✅ | ❌ | `entitlement.ts:435-477,722` |
| 3 | Promo en el CHECKOUT | ✅ | ❌ | ❌ | ✅ | ❌ | `start-paid.ts:112` vs `start-subscription.ts` |
| 4 | Canje de promo sobre sub existente | ✅ | ✅ | ✅ | ✅ | ✅ | `promo-codes.apply.ts:147,159` |
| 5 | Plan anual | ✅ | ❌ | ❌ | ◐ | ✅ | `plans.config.ts:678` (`annualPriceArs:null` ×6) |
| 6 | Addons en catálogo | 6 | 1 | 1+3 | — | — | `addons.config.ts:173,192,270` |
| 7 | **Aplicación del límite del addon** | ✅ | 🔴 | 🔴 | — | — | `addon-entitlement.service.ts:153,248` |
| 8 | Entitlement customer-level llega al gate | ✅ | ❌ | ❌ | ✅ | ❌ | `entitlement.ts:761` vs `commerce-entitlement.ts:416` |
| 9 | Destacado por entitlement | ✅ | ❌ | ❌ | — | ❌ | `featured-entitlement.resolver.ts` |
| 10 | Idempotencia de checkout por entidad | ❌ | ✅ | ✅ | ❌ | ✅ | `subscription-checkout.service.ts:971,1279` |
| 11 | `past_due` bloquea 2º checkout | ❌ | ✅ | ✅ | ❌ | ? | `start-paid.ts:212` vs `start-subscription.ts:136` |
| 12 | Guard de dominio del plan en checkout | ❌ | ✅ | ✅ | ❌ | ✅ | `plan-domain-guard.ts` (3 call sites, ninguno checkout) |
| 13 | Pausa / reanudación | ◐ | 🔴 | 🔴 | ◐ | ◐ | `subscription-pause.ts:76-87` |
| 14 | Cancelación soft | ✅ | ✅ | ✅ | ✅ | ✅ | `subscription-cancel.ts:171` |
| 15 | Cambio de plan | ✅ | ◐ | ◐ | ✅ | ❌ | sólo upgrades en comercio |
| 16 | Reactivación / uncancel | ◐ | ◐ | ◐ | ◐ | ❌ | `trial.service.ts:1355-1393` |
| 17 | `comp` | ✅ | 🔴 | 🔴 | ✅ | ❌ | `subscription-comp-create.service.ts:110-125` |
| 18 | Cortesía (`courtesy`) | ✅ | ✅ | ✅ | ✅ | ✅ | `courtesy-grant.service.ts:97,324` |
| 19 | Dunning | ✅ | ✅ | ✅ | ✅ | ✅ | `dunning.job.ts:163-166` |
| 20 | Cap de listings enforced | ✅ | ✅ | ✅ | — | — | `commerce-limit-enforcement.ts:172` |
| 21 | Cap AI-chat llega a `userLimits` | ✅ | ❌ | ❌ | ✅ | — | `commerce-entitlement.ts:487` |
| 22 | Endpoint «mis entitlements» | ✅ | ❌ | ❌ | ✅ | ❌ | `routes/user/protected/entitlements.ts:27` |
| 23 | Caché `entity_subscriptions` escrita | ✅ | ✅ | ✅ | — | ❌ | `entity-subscription-cache.service.ts:229` |
| 24 | **Cron que reconcilia esa caché** | ✅ | ❌ | ❌ | — | — | `entity-subscription-cache-reconcile.job.ts:194` |
| 25 | Checkout-retry | ✅ | ❌ | ❌ | ✅ | ❌ | `preapproval-recovery.service.ts:283` |
| 26 | Admin puede cambiar el plan | ✅ | ❌ | ❌ | ✅ | ❌ | `billing-subscriptions/utils.ts:158` |
| 27 | Aumento de precio masivo | ✅ | ❌ | ❌ | ✅ | ❌ | `apply-price-increase.service.ts:342-345` |
| 28 | Validación de config al arranque | ✅ | ❌ | ❌ | ✅ | ❌ | `config-validator.ts:273` |
| 29 | Trial anunciado en el form de alta | 52 | 0 | 0 | — | — | `[lang]/publicar/*/index.astro` |

Leyenda: ✅ presente · ❌ ausente · ◐ parcial · 🔴 presente pero roto

---

## 4. Asimetrías estructurales

### 4.1 — No hay un motor de entitlements: hay siete

Cinco son accommodation-only, dos mono-vertical. **SPEC-239 no separó un motor en tres:
dejó el original intacto en alojamiento y construyó uno paralelo, más pobre, para
comercio.** La asimetría no es de forma, es de **calidad**:

- el camino de comercio **no lee entitlements customer-level** (`entitlement.ts:761` vs
  `commerce-entitlement.ts:415-421`) — un grant de admin o el `grantsEntitlement` de un
  addon nunca llega a un gate de comercio;
- **no resuelve composición de trial** (`entitlement.ts:435-477`), así que un dueño en
  `gastronomy-trial` gatea contra el snapshot de la fila, que HOS-1012 declaró
  «para mostrar, no para gatear»;
- **reemplaza `userLimits` con un mapa de UNA clave** (`commerce-entitlement.ts:487,499`).
  Toda otra `LimitKey` cae en `-1` = ilimitado, incluidos los `TOURIST_VIP_LIMITS` que sus
  propios planes declaran. `aiChatCap` se calcula con cuidado y se descarta en la
  desestructuración.

### 4.2 — El gate de publicación de comercio no puede rechazar a nadie

`PUBLISH_GASTRONOMY`, `PUBLISH_EXPERIENCE` y `VIEW_BASIC_STATS` se otorgan
**incondicionalmente** a cualquier autenticado que llegue a la ruta — sin customer, con
el billing caído, con la suscripción cancelada
(`commerce-entitlement.ts:326-334`; piso en `commerce-entitlements.config.ts:73-86`).
`PUBLISH_ACCOMMODATIONS` sí es condicional (`entitlement.ts:576,736`).

La paridad acá es **nominal, no funcional**: el permiso existe con el mismo nombre y no
hace lo mismo.

### 4.3 — El puente único no es único, y su red de contención es asimétrica

`reconcileSubscriptionLinkedEntities` es efectivamente el único camino hacia
publicar/despublicar (se buscó específicamente mutaciones directas de visibilidad que lo
esquivaran y no aparecieron). Pero **tres sitios que mueven estado no lo llaman**:
hard-cancel de admin (§2.7), pausa y resume en ambas superficies (§2.5), y el loop de
supersede del comp (§2.6).

Y como el backstop de 6h está scopeado a alojamiento
(`entity-subscription-cache-reconcile.job.ts:194`), **el mismo olvido es auto-reparable
en alojamiento y permanente en comercio** — donde además esa fila decide la visibilidad
pública.

> Al auditar paridad hay que preguntar por la red de contención, no sólo por el camino feliz.

### 4.4 — Tres resoluciones de «la suscripción del cliente» sin dominio

| Sitio | Archivo | Consecuencia con dueño dual |
|---|---|---|
| Trial objetivo de la extensión | `promo-trial-extension-apply.service.ts:89-105` | extiende la vertical equivocada |
| Supersede del comp | `subscription-comp-grant.service.ts:362-374` | cancela el preapproval de la otra vertical |
| `basePlanLimit` del addon | `addon-entitlement.service.ts:246-256` | calcula el cupo contra el plan equivocado |
| Selección de pausa | `subscription-pause.ts:76-87` | pausa la vertical equivocada |
| Reactivación | `trial.service.ts:1374-1393` | hidrata el dominio y no lo lee |

Todas comparten la forma: un `.find()` o un `WHERE customerId` que asume que el cliente
tiene una sola suscripción relevante. El repo siembra `host-provider@local.test`
justamente porque eso no es cierto.

### 4.5 — Duplicación medida

| Qué | Cuánto | Dónde |
|---|---|---|
| Cuerpos de checkout | ~520 de ~1050 líneas (≈50%) | `subscription-checkout.service.ts` |
| — incluido un upsert duplicado **dentro de la misma función** | 41 líneas | `:1057-1079` y `:1119-1141` |
| Resolvers de entitlement por vertical | ~110 LOC, difieren en **2 tokens** | `featured-` / `menu-` / `directions-entitlement` |
| Reimplementaciones del juicio de idempotencia | 4, dos auto-declaradas «Adapted from» | `checkout-idempotency.ts` + 3 |
| Mappers de error del checkout | 3 (15 códigos vs 4 vs 3) | `subscription-checkout-error-http.ts` + 2 |

`checkout-idempotency.ts` exporta 4 funciones con 4 call sites, lo que **parece
cobertura completa** — hasta que se busca la *forma* y aparecen tres módulos más que
dicen «Adapted from `decideOwnPreapprovalReuse`» y uno que la necesita y no la tiene.

### 4.6 — El riesgo real del refactor: no hay tests de comercio

160 archivos de test de billing en la API. **13 tocan gastronomía, 5 experiencias,
5 partner.** Dunning, cancelación, promo codes y extensión de trial no tienen **ni un
test de comercio**.

El código puede comportarse igual hoy; **nada lo prueba fuera de alojamiento.**
Unificar los checkouts sin cerrar esto primero es refactorear a ciegas la mitad del
sistema que factura.

Agravante: `validateBillingConfigOrThrow()` (`config-validator.ts:273`, invocada en
`apps/api/src/index.ts:293`) sólo valida `ALL_PLANS`. **Un plan de comercio mal
configurado no falla el arranque de la API.**

---

## 5. Documentación que afirma cosas falsas

Alrededor de **veinte** docblocks. Los que pueden inducir un error al que los lea:

| Archivo:línea | Afirma | Realidad |
|---|---|---|
| `commerce-limit-enforcement.ts:9-21` | «no hay gate de entitlement antes de éste» | HOS-1074 los montó en las rutas que protege |
| `commerce-downgrade-remediation.service.ts:419-422` | enumera «las mismas tres reglas» del gemelo | implementa dos (`:442-449`) |
| `routes/commerce/protected/change-plan.ts:23-32` | justifica la ruta citando un `find` sin dominio en alojamiento | HOS-1213 ya lo reemplazó |
| `payer-email.ts:157-160` | «los cinco call sites… partner incluido» | son tres, y partner explica 20 líneas arriba por qué no llama |
| `addon.checkout.ts:569-578` | «a retry reuses the same UUID» | la línea siguiente es `randomUUID()` |
| `subscription-linked-entities.service.ts:12-23` | seis call sites | nueve, en ocho archivos |
| `trial.service.ts:98-99` | «todo plan con trial es de anfitrión» | `ALL_TRIAL_PLANS` tiene 3, dos de comercio |
| `trial-eligibility.service.ts:261` (+2) | elegibilidad «de por vida, cualquier dominio» | el código filtra por dominio |
| 5 archivos | describen `resolveCheckoutFreeTrialDays` como viva | **la función no existe** |
| `subscription-cancel.service.ts:141` | `@throws AUTHORIZATION_ERROR` | tira `FORBIDDEN` (`:198`) |

Y el `CLAUDE.md` del repo **también** miente sobre el número de call sites del puente
(«One reconciler, six sites»).

---

## 6. Cruce contra el inventario previo del issue

| Afirmación previa | Veredicto |
|---|---|
| Alojamiento sin idempotencia de checkout | ✅ **CONFIRMADO** (§2.3), y peor: el middleware tampoco lo cubre |
| Comercio sin promo codes en el checkout | ✅ **CONFIRMADO**, dos call sites, los dos de alojamiento |
| `getTrialStatus` no filtra por dominio | ✅ **CONFIRMADO** (`trial.service.ts:293-295`) |
| `commerce/admin/start-subscription.ts` sin consumidor | ✅ **CONFIRMADO** — ruta muerta, cero hits en `apps/admin` |
| Comercio sin UX de trial en el alta | ✅ **CONFIRMADO** — 52 menciones vs 0 |
| Tres resolvers de entitlement casi idénticos | ✅ **CONFIRMADO** — difieren en 2 tokens |
| `PUBLISH_GASTRONOMY` incondicional | ✅ **CONFIRMADO** (§4.2) |
| `/publicar/index.astro:113` llama «sin `?domain=`» | ⚠️ **IMPRECISO** — no hay `?domain=` que olvidar: `routes/billing/trial.ts` no menciona `domain` ni una vez, y el helper del cliente tampoco lo expone. El endpoint es ciego al dominio de punta a punta. El arreglo es más grande que un query param |
| Planes de comercio con `hasTrial`/`trialDays` «not consulted» = bug | ❌ **REFUTADO como asimetría** — el checkout pasa `trialDays: 0` literal en **todas** las ramas desde HOS-1012. Es simétrico. Lo asimétrico es el *arranque* del trial, que es otro camino: comercio lee `plan.metadata.trialDays`, alojamiento usa la constante |
| Comentario obsoleto sobre `product_domain='commerce'` | ⚠️ **MENOR** — el valor retirado sólo aparece en comentarios y migraciones históricas que lo buscan a propósito; cero comparaciones vivas |
| Cron de trial no despublica comercio (el falso positivo ya documentado) | ✅ sigue siendo falso positivo |

**No verificados en el issue, ahora cerrados**: rutas de cancelación (§S-01: una sola
ruta, correcta, **no existe** ruta de comercio paralela), pausa (§2.5: rota),
cambio de plan (§4.1, §C-11), `owner-entitlement` vs `tourist-entitlements` (§4.1),
idempotencia de anual y upgrade (§2.3: anual tampoco la tiene).

**Hallazgos nuevos que el issue no tenía**: §2.1, §2.2, §2.4, §2.5, §2.6, §2.7, §2.8,
§2.9, §4.2, §4.6, y las asimetrías de admin, validación de config y aumento de precio.

---

## 7. Lo que necesita decisión del dueño

Estas cinco no son bugs: son capacidades que **hoy no existen para comercio** y que la
regla convierte en trabajo. Ninguna se cierra sola con un refactor.

1. **`comp` para comercio** — hoy hay un rechazo explícito
   (`subscription-comp-create.service.ts:110-125`). ¿Se abre?
2. **Plan anual para comercio** — los 6 tiers tienen `annualPriceArs: null`. Es decisión
   de precio, no de código.
3. **Destacado por entitlement para comercio** — es un gap, no una imposibilidad: sólo
   requiere migrar la FK `featured_listing_addon_grants.accommodationId`.
4. **Checkout-retry para comercio** — el servicio se auto-declara «known limitation»
   (`preapproval-recovery.service.ts:283`). El dato que le falta ya está persistido y ya
   tiene lector (`readSubscriptionDomainMetadata`).
5. **Aumento de precio masivo para comercio** — hoy la herramienta filtra a alojamiento.

---

## 8. Tamaño

| Categoría | Cantidad |
|---|---|
| Hallazgos con evidencia `archivo:línea` | **~45** |
| — de los cuales cuestan dinero / exponen datos hoy | **9** |
| — decisiones de producto para el dueño | **5** |
| — asimetrías estructurales | **~15** |
| — docblocks falsos o caducos | **~20** |
| Duplicación mecánicamente extraíble | ~700 LOC |
| Cobertura de tests de comercio a construir | dunning, cancel, promo, trial, pausa, addons |

No es una limpieza. Es una spec con varias entregas, y la primera **no** es el refactor:
es la red de tests que hace seguro el refactor.
