---
title: Card-first billing on MercadoPago preapproval_plan (share-link + PUT external_reference)
linear: HOS-191
statusSource: linear
created: 2026-07-16
updated: 2026-07-18
type: fix
areas:
  - billing
  - api
  - web
  - db
---

# Card-first billing on MercadoPago preapproval_plan (share-link + PUT external_reference)

> **Revisión 2026-07-18 — approach corregido.** La versión original de esta spec
> (y el PR #2354 ya mergeado) migró a `preapproval_plan` pero implementó el flujo
> **equivocado**: crear el `preapproval` **server-side** pasando `preapproval_plan_id`.
> MercadoPago rechaza ese request con `"card_token_id is required"` → **ningún
> checkout pago funciona en prod hoy**. La investigación empírica del 2026-07-18
> (28+ pruebas contra MP real) determinó el flujo correcto: **redirigir al share
> link del plan** + linkear con **`PUT external_reference`** en el back_url.
> Base técnica completa: [`docs/billing/mp-subscription-flow-research-2026-07-18.md`](../../docs/billing/mp-subscription-flow-research-2026-07-18.md).

## 1. Summary

El trial card-first debe crear una suscripción de MercadoPago que:

1. **Autorice la tarjeta** (el `free_trial` inline en un `POST /preapproval` directo
   rompe la autorización — confirmado A/B).
2. **Difiera el cobro** por el trial (día 1 sin cobro).
3. **Quede linkeada de forma confiable** al usuario local de Hospeda.

El único flujo de MP que cumple (1) es el **`preapproval_plan`**: se crea un plan con
`free_trial`, y el usuario se suscribe **entrando al share link hosted del plan**
(`.../subscriptions/checkout?preapproval_plan_id=<id>`), donde MP colecta la tarjeta.
**NO** se puede crear el `preapproval` server-side (MP exige `card_token_id`, que no
tokenizamos por diseño/PCI). El linking se resuelve con `PUT /preapproval/{id}`
seteando `external_reference` cuando el usuario vuelve al sitio.

## 2. Problem

### 2.1 Síntoma actual en prod (bug del approach shippeado)

Todo checkout pago falla: `POST /api/v1/protected/billing/subscriptions/start-paid` → 500,
`error: "Create subscription - card_token_id is required"`. El código
(`paid-subscription-create.ts` → qzpay `buildCreateBody`) hace `POST /preapproval` con
`preapproval_plan_id` y sin token → MP lo rechaza (los 3 shapes probados: con `status:pending`,
sin status, mínimo → todos 400).

### 2.2 Por qué falla el approach server-side

Con `preapproval_plan_id` seteado, MP **siempre** exige `card_token_id` + `status: authorized`
(confirmado por doc oficial + 3 pruebas). No hay init_point propio del preapproval por esta vía.
La **única** forma sin token es el **share link hosted del plan**.

### 2.3 El flujo inline (viejo) tampoco sirve

`POST /preapproval` inline (sin plan) con `free_trial` **crea** (201, init_point sin token) pero
**la tarjeta no autoriza** ("No pudimos procesar tu pago"; preapproval `cancelled`,
`payment_method_id: null`). Reproducido HOY con control (la misma tarjeta autorizó en el flujo
plan minutos antes). No es rate-block ni la tarjeta: es el flujo inline+trial.

## 3. Decisión: camino C (share link + PUT external_reference)

| Camino | Autoriza tarjeta | Trial | Linking |
|---|---|---|---|
| A · inline + free_trial | ❌ | ✅ | ✅ (moot) |
| B · inline + start_date | ❌ (= A) | ✅ | ✅ (moot) |
| **C · plan + share link** | ✅ | ✅ | ✅ vía `PUT external_reference` |

**Se adopta C.** Es el único que autoriza con trial, deja el trial en manos de MP (menos
lógica en Hospeda) y tiene linking robusto.

### 3.1 Comportamiento de MP confirmado (resumen — detalle en el MD de investigación)

- `POST /preapproval` + `preapproval_plan_id` → **siempre** pide `card_token_id`. La vía sin token = share link del plan.
- El share link **ignora** `external_reference` como query param → el preapproval nace con `external_reference: null`.
- **`PUT /preapproval/{id}` con `external_reference` funciona post-creación y persiste**, y es **libremente sobrescribible** (guard = Hospeda).
- `payer_id` inestable; `payer_email` estable pero frágil (BETA-183).
- El **back_url** devuelve `?preapproval_id=<id>`. El webhook `subscription_preapproval` (sobre fino, solo `data.id`) llega **server-to-server** aunque el user no vuelva.
- **Trial**: MP otorga 1 trial por `(payer + plan)`. NO alcanza para "1 trial por customer de por vida" → Hospeda mantiene su guard global.
- **Dunning nativo**: MP reintenta 4×/~10d y **auto-cancela** tras 3 cuotas fallidas (nunca pausa). No duplicar.
- **Cambio de precio del plan NO retro-propaga** a subs existentes → aumento = mutar por-sub.
- **address_pending** en la cuenta no bloquea cobros. Cadencia diaria/anual + trial: OK. `/preapproval/search` no filtra por `external_reference` ni muestra `free_trial` en list-view (usar GET individual).

## 4. Diseño técnico

### 4.1 Flujo de checkout — redirigir al share link (NO crear server-side)

`start-paid` (o el service de checkout) debe:

1. Resolver/provisionar el `preapproval_plan_id` correcto para `(commercialPlan × interval × trialDays)` — esto ya existe (`mp-plan-provisioning.service.ts`, con back_url por HOS-200).
2. Crear un registro local **pending-checkout**: `{ localUserId, planId, mpPreapprovalPlanId, timestamp, nonce }`.
3. **Devolver como `checkoutUrl` el share link** `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=<mpPreapprovalPlanId>` — construido desde `billing_mp_plans.mpPreapprovalPlanId`.
4. **Dejar de llamar** `billing.subscriptions.create` / `createPaidSubscription` para el path pago (es el `POST /preapproval` que falla). Eliminar también el guard `MISSING_PROVIDER_SUBSCRIPTION_ID` (no hay sub que crear aún).

### 4.2 Provisioning idempotente de planes

- Registro `billing_mp_plans` keyed por `(commercial_plan_id, billing_interval, trial_days)` (ya existe, HOS-191).
- **MP no deduplica** → el resolver debe buscar-o-crear (idempotente) y nunca crear dos planes iguales.
- Un plan por cada duración de trial (14/30/… para trial-extension por promo).

### 4.3 Handler del back_url (linking primario)

Nueva ruta de retorno (`apps/web` o `apps/api`) que recibe `?preapproval_id=X` con el user **logueado**:

1. `GET /preapproval/X` server-side (nunca confiar en la URL).
2. Verificar contra el pending-checkout del user (plan + timing) y/o `payer_email`.
3. Si `external_reference` está **vacío** → `PUT /preapproval/X { external_reference: localUserId }`.
4. Si ya tiene **otro** user → **rechazar + alertar** (guard anti-IDOR).
5. Persistir el `mp_subscription_id` (= preapproval_id) en `billing_subscriptions`.

### 4.4 Handler de webhook `subscription_preapproval` (confirmación + fallback)

- Validar `x-signature`.
- `GET /preapproval/{data.id}` → **ramificar por `status`** (NO por tipo de evento; create y cancel usan el mismo tipo): `authorized`/`trialing` → activar/derivar; `cancelled` → cancelar local; `paused` → pausar.
- **Caso "no vuelve"**: si al llegar el webhook la sub aún no está linkeada (no hubo back_url), reconciliar por pending-checkout (plan + timing) + `payer_email`. Ambiguos (multi-user o email distinto) → marcar para **reconciliación asistida**, nunca adivinar.
- `subscription_authorized_payment` → registrar en `billing_payments`, poblar `mp_customer_id`, derivar `trialing → active`.
- Idempotencia: webhook repetido no duplica.

### 4.5 Guard de trial — dos capas

- **MP** enforza por `(payer+plan)` (nativo, backstop).
- **Hospeda** DEBE mantener su guard **global por customer** (ya en código, HOS-110/171, en el call-site del checkout) — sin esto un user haría trial-hopping entre planes distintos. El checkout resuelve `freeTrialDays` (0 si no elegible → plan sin trial → share link del plan notrial; N si elegible → plan con trial).

### 4.6 Dunning — reconciliar con el nativo de MP

- **No implementar** un loop propio de reintentos: MP ya reintenta 4×/~10d y auto-cancela tras 3 cuotas.
- Reconciliar el grace de 7d (`past_due`) de Hospeda con la ventana de ~10d de MP para no producir estados contradictorios.
- El backstop de Hospeda debe reaccionar al webhook de cancelación de MP, no anticiparse.
- Rate-limits: honrar `Retry-After` + backoff con jitter (MP no publica ceiling).

### 4.7 Aumento de precio

- `PUT /preapproval_plan` cambia el precio **solo para nuevas subs**. Un aumento a suscriptores actuales = job que muta `transaction_amount` **por-sub** (`PUT /preapproval/{id}`), no solo el plan.

## 5. Cambios de código por área

1. **`apps/api/src/services/billing/paid-subscription-create.ts`** — dejar de llamar `billing.subscriptions.create` (el `POST /preapproval` que tira card_token). Devolver el share link. Quitar guard `MISSING_PROVIDER_SUBSCRIPTION_ID`. Crear pending-checkout local. (Revierte el core del approach de PR #2354.)
2. **`apps/api/src/services/billing/subscription-checkout.service.ts`** — el resolver de checkout construye/retorna el share link; ya tiene el `mpPreapprovalPlanId` de `resolveCheckoutMpPlanId`.
3. **`apps/api/src/services/billing/mp-plan-provisioning.service.ts`** — mantener (provisioning idempotente + back_url OK). Verificar que el share link se construya del `mpPreapprovalPlanId`.
4. **Nueva ruta back_url handler** (`apps/web` return route + `apps/api` linking endpoint) — GET + PUT external_reference + IDOR guard (§4.3).
5. **`apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts`** — ramificar por `status` del GET; reconciliación no-vuelve por pending-checkout + payer_email; fallback asistido (§4.4).
6. **`packages/db`** — tabla/registro **pending-checkout** (`{localUserId, planId, mpPreapprovalPlanId, timestamp, nonce}`); confirmar `billing_mp_plans` key `(plan, interval, trial_days)`.
7. **Guard de trial global** (`subscription-checkout` call-site) — mantener/verificar (§4.5). **Dunning cron** — reconciliar con MP nativo (§4.6). **Job de aumento de precio** por-sub (§4.7).
8. **qzpay** (`@qazuor/qzpay-mercadopago`) — el `buildCreateBody` server-side ya no se usa para el path pago; evaluar si hace falta un cambio de contrato o si el fix es 100% Hospeda-side (preferible). No bump si no es necesario.

## 6. Tasks (fases)

- **F1 · Checkout redirect**: share link en vez de `POST /preapproval` server-side; pending-checkout; quitar guard MISSING_PROVIDER. → desbloquea el checkout en prod.
- **F2 · Linking**: back_url handler (GET + PUT external_reference + IDOR guard) + persistir mp_subscription_id.
- **F3 · Webhook**: ramificar por status; reconciliación no-vuelve; authorized_payment → billing_payments + mp_customer_id; idempotencia; x-signature.
- **F4 · Trial guard global** (verificar) + **F5 · Dunning** (reconciliar con MP nativo) + **F6 · Aumento de precio por-sub**.
- **F7 · Tests** (unit + integration con stub MP alineado al flujo real) + smoke staging/prod.

## 7. Criterios de aceptación

**Validados en prod (2026-07-18):**

- ✅ Checkout autoriza la tarjeta (flujo plan).
- ✅ Trial difiere el cobro ($0 día 1).
- ✅ `PUT external_reference` linkea; webhook llega aunque el user no vuelva.
- ✅ Cancelación bidireccional (Hospeda→MP y MP→Hospeda).
- ✅ `subscription_authorized_payment` en un cobro real; `address_pending` no bloquea; refund OK.
- ✅ Regla de trial `(payer+plan)` + necesidad del guard global de Hospeda.

**A cumplir en la implementación:**

- Un owner elegible completa el trial y queda linkeado a su user local (back_url y también si NO vuelve).
- Un intento de IDOR (preapproval_id ajeno) es rechazado.
- El cobro día-N pasa a `active` + registra `billing_payments` + puebla `mp_customer_id`.
- El dunning de Hospeda no pelea con el nativo de MP.
- El aumento de precio afecta subs existentes solo vía mutación por-sub.

## 8. Riesgos y verificaciones empíricas pendientes (no bloqueantes)

- 🕐 **Cobro día-N**: canario `7a9e6a99` cobra 2026-07-19 ~16:13 → verificar el flujo trial→cobro completo.
- ⏳ **Status del preapproval tras rechazo de tarjeta** (T2.2) — necesita una tarjeta que falle. Best guess: queda `pending`.
- ⏳ **¿El dunning nativo (4 retries / 3 strikes) aplica igual a `preapproval_plan`?** — la doc es del flujo sin-plan; verificar en su momento.
- ⏳ **¿El descuento (mutación de amount) aplica al ciclo actual o al próximo?** (T9.2) — verificar con un cobro.
- **Caso residual de linking**: no-vuelve + email distinto (BETA-183) → reconciliación asistida (sin pérdida de plata).
- **Edge case**: botón "volver a suscribirme" en la UI de cancelación de MP (reactivación MP-side) → captar por webhook. Baja prioridad.

## 9. Referencias

- **Base técnica completa**: [`docs/billing/mp-subscription-flow-research-2026-07-18.md`](../../docs/billing/mp-subscription-flow-research-2026-07-18.md) (3 caminos, hallazgos MP, diseño de linking, checklist, objetos de prueba).
- Código actual: `paid-subscription-create.ts`, `subscription-checkout.service.ts`, `mp-plan-provisioning.service.ts`, `routes/webhooks/mercadopago/subscription-logic.ts`, `packages/db` `billing_mp_plan.dbschema.ts`.
- PRs previos de HOS-191: hospeda #2354 (approach a corregir), qzpay #49/#51.
