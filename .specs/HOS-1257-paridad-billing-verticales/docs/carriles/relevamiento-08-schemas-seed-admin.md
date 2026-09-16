# Relevamiento 08 — Schemas, enums, config de planes, seed, admin y tests

Worktree: /home/qazuor/projects/WEBS/hospeda-hos-1257-paridad-billing-verticales
Carril: schemas / enums / plan config / DB schema billing / seed / admin / tests

## 1. ProductDomainEnum

`packages/schemas/src/enums/product-domain.enum.ts:45-51`: valores actuales
`ACCOMMODATION | GASTRONOMY | EXPERIENCE | PARTNER | ADDON`. `'commerce'` está
retirado (HOS-695 release C). Grep de literales `'commerce'` en todo el repo
(excluyendo tests): TODOS los hits vivos son comentarios/JSDoc que EXPLICAN
que el valor está retirado, o archivos de `data-migrations/006x-*` que
comparan contra el literal `'commerce'` a propósito (para encontrar filas
legacy que aún no fueron migradas) — código histórico, correcto por diseño,
no un hallazgo. `PartnerTypeEnum.COMMERCE='commerce'` (enum distinto, tipo de
partner, no dominio) y el nav-item `id:'commerce'` en `apps/web/src/config/
navigation.ts` son colisiones de nombre inofensivas, no comparaciones contra
`ProductDomainEnum`. `subscriptionMatchesDomain` (`packages/service-core/src/
services/billing/subscription/subscription-product-domain.ts:205-225`) es el
ÚNICO lugar que compara `productDomain`; fail-open solo para accommodation,
fail-closed para el resto (`'commerce'` legacy no matchea nada — dark listing
intencional).

## 2. Catálogo de planes (`packages/billing/src/config/plans.config.ts`)

| plan | vertical | precio mensual (ARS) | trial? | trialDays | anual? | límites propios |
|---|---|---|---|---|---|---|
| owner-basico/pro/premium | accommodation | 18.000/35.000/65.000 | sí | OWNER_TRIAL_DAYS | sí (×10) | MAX_ACCOMMODATIONS, fotos, promos, IA (4 claves) |
| complex-basico/pro/premium | accommodation (complex) | 50k/100k/200k | sí | COMPLEX_TRIAL_DAYS | sí | `isActive:false` — vertical no implementada, oculta pero reversible |
| tourist-free/vip | tourist | 0 / 15.000 | no / sí | — / TOURIST_TRIAL_DAYS | no / sí | favoritos, alertas, IA consumer |
| gastronomy-basico/pro/premium | gastronomy | 30k/65k/80k | sí | COMMERCE_TRIAL_DAYS | NO (`annualPriceArs:null`) | MAX_GASTRONOMIES 1/3/5, AI chat 0/0/1250, privateGalleries 0/0/0 |
| experience-basico/pro/premium | experience | 15k/35k/50k | sí | COMMERCE_TRIAL_DAYS | NO | MAX_EXPERIENCES 1/5/10, AI chat 0/0/1250, privateGalleries 0/0/20 |
| partner-listing/silver/gold | partner | 5k/15k/30k | NO | 0 | listing:no, silver/gold:sí | sin entitlements/limits (binario) |

Todos los tiers de gastronomy/experience (HOS-975 D-A) heredan
`TOURIST_VIP_ENTITLEMENTS` + `TOURIST_VIP_LIMITS` completos, igual que los 6
planes de accommodation — simétrico y deliberado. Capacidades que
accommodation tiene y comercio NO: fotos por alojamiento, promociones activas,
AI_TEXT_IMPROVE/AI_TRANSLATE/AI_ACCOMMODATION_IMPORT, VIEW_BASIC/ADVANCED_STATS,
CUSTOM_BRANDING, FEATURED_LISTING — todas ausentes en gastronomy/experience por
diseño (son capacidades específicas de alojamiento). Partner no tiene NINGÚN
entitlement/limit — es puramente un gate de visibilidad binario
(`entitlements:[]`, `limits:[]` en las 3 filas, `plans.config.ts:1276,1325,1344`).

## 3. Metadata de trial en planes de comercio

`hasTrial`/`trialDays` SÍ están declarados en las 6 filas gastronomy/
experience (`commerceVerticalTier`, HOS-590). Quién los lee (grep
`.hasTrial`):
- `apps/web/src/components/billing/PricingCardsGrid.astro:457` y
  `apps/web/src/lib/billing/generic-trial-days.ts:91` — UI pública, genérico
  por audiencia (no accommodation-only, ver §comentario del archivo).
- `packages/seed/src/required/{commercePlan,billingPlans,testDailyPlan,
  partnerPlan}.seed.ts` y `trialPlans.writer.ts` — el seed usa el valor para
  fijar `billing_prices.trialDays` (que es lo que realmente arma el trial del
  lado de MercadoPago desde HOS-1012, vía `preapproval_plan.auto_recurring.
  free_trial`).
- `apps/admin/.../PlanDialog.tsx` — editable por operador.
- El **checkout** (`apps/api/src/services/subscription-checkout.service.ts`)
  NO lee `plan.trialDays`: pasa `trialDays: 0` literal en TODAS las ramas
  (accommodation, gastronomy, experience, partner) desde HOS-1012 —
  confirmado por grep, es simétrico entre verticales, no es una asimetría de
  comercio. El propio archivo `plans.config.ts:816-820` documenta esto
  correctamente («the commerce CHECKOUT no longer reads it»); el dato es
  cierto y el comentario NO está caduco. **No es un hallazgo** — el campo SÍ
  se lee (seed + UI), solo no en el checkout, y eso es igual para las 3
  verticales.

## 4. Schemas de API duplicados (verdicts)

`packages/schemas/src/api/billing/publish-eligibility.schema.ts` (accommodation,
HOS-1183) vs `commerce-trial-verdict.schema.ts` (gastronomy/experience,
HOS-1184): mismo problema («¿qué pasa si publico ahora?»), mismo patrón de
fix (3 estados con nombres propios en vez de un booleano que colapsaba
`has_active_sub`), pero DOS schemas independientes con:
- Estados con nombres distintos por diseño documentado (`first_publish/
  has_active_sub/subscription_required` vs `trial_available/has_active_sub/
  payment_required`) — justificado (mecanismos distintos: trial local vs
  checkout MP).
- Accommodation expone `canPublish` (bypass de staff) y `startsTrial`;
  commerce NO tiene ningún campo equivalente a bypass de staff — no se
  encontró concepto de «staff puede publicar aunque no tenga plan» en
  `commerce-trial-start.service.ts` (grep sin hits). No verificado si esto es
  producto (staff no publica por terceros en comercio) o un gap real.

## 5. DB — `entity_subscriptions` vs `billing_subscriptions`

`packages/db/src/schemas/billing/entity_subscription.dbschema.ts` es UNA
tabla compartida por las 3 verticales desde HOS-1084 (antes
`commerce_listing_subscriptions`, solo gastronomy/experience). Simetría real:
mismo `UNIQUE(entity_type, entity_id)`, mismos índices, mismo reconciler
(`reconcileSubscriptionLinkedEntities`, 6 call sites). Asimetría
DOCUMENTADA y VERIFICADA: `planRestricted` (línea 167) vive en esta tabla
para gastronomy/experience pero SIEMPRE `false` para accommodation, que
tiene su PROPIA columna `accommodations.plan_restricted`
(`packages/db/src/schemas/accommodation/accommodation.dbschema.ts:117`,
confirmado por grep — el comentario no es falso). Justificación dada:
accommodation deriva sus listings de `owner_id` sin tabla de enlace,
gastronomy/experience sí tienen la tabla de enlace. ESENCIAL-JUSTIFICADO.

## 6. Seed / fixtures — matriz de usuarios de prueba (`packages/seed/CLAUDE.md` §Test Users)

| estado | accommodation | gastronomy | experience |
|---|---|---|---|
| activo, tier básico | host-basico | commerce-gastronomy | commerce-experience |
| activo, tier pro | host-pro | — (no existe) | — (no existe) |
| activo, tier premium | host-premium | — (no existe) | — (no existe) |
| activo + addon | host-pro-plus-addon (extra-photos-20) | — (no existe) | — (no existe) |
| trialing | host-trial (`subStatus:'trialing'`, 30d) | — (no existe) | — (no existe) |
| at-cap (límite de listings alcanzado) | — (no aplica igual) | commerce-gastronomy-at-cap | — (no existe, falta) |
| past_due / mora | — no existe para NINGUNA vertical | — | — |
| cancelled | — no existe para NINGUNA vertical | — | — |
| dual-role | host-provider, host-commerce | — | — |
| complex (3 tiers) | complex-basico/pro/premium | n/a | n/a |
| partner (silver/gold) | — no hay fixture de partner en la matriz de test-users | | |

Fuente: `packages/seed/src/test-users/testUsers.seed.ts:185-242` (grep
`subStatus`, default `'active'` — confirmado que `commerce-gastronomy`/
`commerce-experience` NO tienen `subStatus:'trialing'`). Gaps: gastronomy y
experience solo tienen fixture de tier básico y activo; no hay trial, no hay
pro/premium, no hay experience-at-cap (gastronomy sí), no hay addon commerce.
past_due/cancelled falta para TODAS las verticales (no es asimetría entre
verticales, es un gap general). No se encontró fixture de partner-silver/gold
en la matriz de test-users (sí existen en `ALL_PARTNER_PLANS` pero sin dueño
de prueba local).

## 7. Admin

- `apps/admin/src/features/billing-subscriptions/utils.ts:158`
  `getChangePlanOptions`: `if (currentProductDomain && currentProductDomain
  !== 'accommodation') return [];` — el diálogo de cambio de plan del admin
  SOLO ofrece destinos para suscripciones de accommodation. Gastronomy/
  experience/partner devuelven lista vacía (sin opciones de cambio de plan
  desde el panel admin). Ver el propio JSDoc: `ALL_PLANS` es
  "accommodation-only by design". Existe un endpoint self-service de cambio
  de plan por vertical (`POST /protected/commerce/subscriptions/{vertical}/
  change-plan`, solo upgrades, iniciado por el owner) pero NO hay ruta admin
  equivalente (`apps/api/src/routes/billing/admin/` no tiene archivo de
  change-plan aparte de los hooks de qzpay-admin, accommodation-only).
- `apps/admin/src/features/billing-subscriptions/SubscriptionFilters.tsx`:
  el filtro de `productDomain` en la TABLA de suscripciones SÍ es simétrico
  — deriva de `Object.values(ProductDomainEnum)`, cubre las 5 verticales
  (HOS-331 fix documentado).
- `subscription-comp.ts`, `subscription-courtesy.ts`,
  `subscription-promo-effect.ts`, `subscription-trial-extension.ts` (rutas
  admin): CERO menciones de `productDomain`/vertical — operan sobre
  cualquier `billing_subscriptions` row sin distinción. SIMÉTRICO.
- `apps/api/src/services/billing-metrics.service.ts` (dashboard de métricas
  admin): TODAS las queries SQL crudas (`activeSubsResult`, `mrrResult`,
  `churnResult`, `conversionResult`, líneas 188-245) leen `billing_subscriptions`
  SIN NINGÚN filtro de `product_domain`. El MRR/churn/conversión mostrado en
  el dashboard mezcla accommodation + gastronomy + experience + partner +
  addon sin desglose ni etiqueta. No hay forma de ver métricas por vertical
  en el admin.

## 8. Cobertura de tests

Conteo de archivos de test de billing en `apps/api/test/**billing**`: 160
archivos totales. Solo 13 mencionan `gastronomy`, 5 mencionan `experience`,
5 mencionan `partner`. Caminos críticos SIN cobertura de gastronomy/
experience en absoluto (grep dirigido por nombre de archivo):
`dunning` (1 archivo, 0 commerce), `subscription-cancel` (2 archivos, 0
commerce), `promo-code` (3 archivos, 0 commerce), `trial-extension` (1
archivo, 0 commerce), `subscription-pause` (1 archivo, 0 commerce), `webhook`
(4 archivos, 0 commerce). `plan-change` tiene 13 archivos, solo 1 toca
gastronomy, ninguno experience. En `packages/service-core/test/billing/`
(53 archivos): solo 2 mencionan gastronomy, 2 experience — prácticamente
todo `subscription-product-domain.test.ts`, el resto de la suite de
promo-codes/dunning/trial a nivel de servicio no ejercita verticales de
comercio. Esto es el riesgo real para un refactor de unificación: dunning,
cancelación, extensión de trial y promo-codes están probados casi
exclusivamente contra accommodation.

## 9. Config validation — asimetría de arranque (hallazgo nuevo, no pedido explícitamente pero relevante)

`packages/billing/src/validation/config-validator.ts:273` —
`validateBillingConfig()` valida SOLO `ALL_PLANS` (accommodation + tourist +
complex). Se invoca en `apps/api/src/index.ts:293` vía
`validateBillingConfigOrThrow()` al arrancar la API — si un plan de
`ALL_PLANS` tiene un error de config (trialDays negativo, slug duplicado,
etc.) la API no arranca. `ALL_GASTRONOMY_PLANS`, `ALL_EXPERIENCE_PLANS`,
`ALL_PARTNER_PLANS` NUNCA pasan por este validador (grep de callers:
ningún otro sitio lo invoca). Un error de config en un plan de comercio o
partner no se detecta al arrancar, solo fallaría en runtime en el checkout.

## Comentarios caducos encontrados

Ninguno. Todos los comentarios/docblocks revisados en este carril (product-domain
enum, subscription-product-domain.ts, entity_subscription.dbschema.ts,
plans.config.ts trial-checkout claim, publish-eligibility vs commerce-trial-verdict)
se verificaron contra el código real y resultaron ciertos — el equipo mantiene
esta zona con documentación inline inusualmente precisa y auto-referencial
(cita archivos/líneas que se corroboraron).
