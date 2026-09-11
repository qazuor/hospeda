# HOS-847 — Cobro recurrente real para add-ons

**Estado**: plan de implementación para aprobación del dueño. **No hay código de producción escrito.**
**Rama**: `feat/hos-847-addons-recurrentes` (cortada de `origin/staging` `36b821e0a`).
**Decisión del dueño (2026-09-04)**: construir el cobro recurrente de verdad. Se descartó retirar
`billingType: 'recurring'`. Va en PRs chicos y encadenados.

---

## 0. Resumen ejecutivo

Tres cosas que cambian el planteo antes de escribir una línea:

1. **El arreglo de una línea no existe.** Cambiar `mode: 'payment'` por `mode: 'subscription'` en
   `apps/api/src/services/addon.checkout.ts:469` **no crea una suscripción**. En el adaptador de
   MercadoPago de qzpay, los tres modos de `checkout.create()` terminan en la API de **Preference**
   (pago único). El modo `'subscription'` sólo lee el `preapproval_plan` para mostrar el precio.
   El preapproval real lo crea *otro* camino: `billing.subscriptions.create({ mode: 'paid' })`.
   Si alguien "arregla" la línea 469, el cobro sigue siendo único y el bug queda igual, con la
   diferencia de que ahora parece arreglado.

2. **Un preapproval de MercadoPago no tiene ítems.** Confirmado contra los tipos del adaptador:
   un preapproval lleva exactamente **un** `auto_recurring.transaction_amount`. No hay array de
   ítems, ni forma de adjuntarle uno a un preapproval existente. La única vía es **un preapproval
   por add-on**, lo que multiplica filas de `billing_subscriptions` por cliente.

3. **Esas filas nuevas caen en el radar de todo el subsistema de billing** — dunning, poll,
   finalize-cancelled, preapproval-less-expiry, el motor de entitlements — y ninguno de ellos sabe
   qué es un add-on. Peor: `subscriptionMatchesDomain` **falla abierto** para `accommodation`, así
   que una fila de add-on con el `product_domain` por default se cuenta como la suscripción de
   alojamiento del dueño. Ese aislamiento es el trabajo real de esta issue, no el checkout.

El plan pone el aislamiento **primero** (PR 2, en oscuro, cuando todavía no existe ninguna fila de
add-on que pueda romperse) y deja el encendido para el final.

---

## 1. Qué permite y qué NO permite MercadoPago acá

Todo lo de esta sección está verificado contra código o contra mediciones previas del repo, no
contra la doc. Donde la fuente es la doc, se dice.

### 1.1 `checkout.create()` NO crea preapprovals

`@qazuor/qzpay-core` define tres modos
(`packages/core/src/constants/checkout-mode.ts`):

```ts
export const QZPAY_CHECKOUT_MODE = {
    PAYMENT: 'payment',
    SUBSCRIPTION: 'subscription',
    SETUP: 'setup'
} as const;
```

y `checkout.service.ts:211-217` valida que el modo `'subscription'` traiga **exactamente un**
line item. Pero `packages/core/src/billing.ts:2049` siempre llama
`paymentAdapter.checkout.create(providerInput)`, y el adaptador de MP
(`packages/mercadopago/src/adapters/checkout.adapter.ts`) lo implementa con `new Preference(client)`

+ `preferenceApi.create(...)`. Cuando hay `providerPriceId` (modo subscription) hace
`planApi.get({ preApprovalPlanId })` **sólo para leer `transaction_amount`/`currency_id` y mostrar
el precio** (líneas 123-138). Nunca toca `/preapproval`.

**El preapproval se crea únicamente vía `billing.subscriptions.create({ mode: 'paid' })`**
(`packages/core/src/billing.ts:1569` → `packages/mercadopago/src/adapters/subscription.adapter.ts`).

> **Consecuencia de diseño**: el checkout de un add-on recurrente NO puede pasar por
> `billing.checkout.create`. Tiene que pasar por el mismo camino que hoy usa el checkout de planes:
> `createPaidSubscription` / `createOwnPreapprovalSubscription`
> (`apps/api/src/services/billing/paid-subscription-create.ts`,
> `own-preapproval-subscription-create.ts`).

### 1.2 Un preapproval lleva UN monto y ningún ítem — CONFIRMADO

`subscription.adapter.ts:63-73`:

```ts
type PreApprovalUpdateBody = {
    status?: string;
    reason?: string;
    external_reference?: string;
    auto_recurring?: {
        transaction_amount?: number;
        frequency?: number;
        frequency_type?: 'days' | 'months';
        currency_id?: string;
    };
};
```

`update()` (líneas 129-158) hace `PUT /preapproval/{id}` sólo con esos campos. **No hay array de
ítems en ninguna parte del tipo**, en contraste con `Preference`, que sí tiene `items[]`
(`checkout.adapter.ts:116-156`). La doc oficial de MP concuerda: el body de `/preapproval` es
`{ reason, external_reference, payer_email, back_url, card_token_id, status, auto_recurring: {...} }`
— un solo monto, sin ítems.

**Veredicto**: la hipótesis se confirma. *No se le pueden adjuntar ítems a un preapproval
existente.* Un segundo cobro recurrente exige un segundo preapproval independiente.

### 1.3 Qué SÍ se puede mutar en un preapproval vivo (medido, no leído)

Medido con curl contra la API real de MP el 27/08/2026 (preapproval de staging `658bf09b…`,
`status: authorized`), y confirmado independientemente en HOS-191 SP-3:

| Campo | `PUT /preapproval/{id}` |
|---|---|
| `auto_recurring.transaction_amount` | **MUTABLE** (piso ARS $15) |
| `auto_recurring.start_date` | **INMUTABLE** |
| `auto_recurring.free_trial` | **INMUTABLE** |
| `status` (`paused` / `cancelled`) | mutable |

**El modo de falla es silencioso**: un `PUT` con `start_date` o `free_trial` devuelve **HTTP 200 con
el body completo del preapproval** y no cambia nada; `last_modified` queda congelado y esa es la
única señal. Tres intentos distintos dieron 200 y cero efecto. Un 200 acá no prueba nada:
hay que verificar con un `GET` posterior comparando `last_modified`.

Pisos del monto (mensajes textuales de MP): `0` → 400 *"Invalid value for transaction amount, must
be a positive number"*; `1` → 400 *"Cannot pay an amount lower than $ 15.00"*; `100` → 200.

### 1.4 Otras restricciones

+ **`frequency_type` sólo admite `'days' | 'months'`** (`subscription.adapter.ts:56`).
  `toMercadoPagoInterval` (líneas 301-316) convierte `year` → `months × 12` antes de llegar a MP,
  así que `'years'` no es "rechazado": es estructuralmente inalcanzable. **Un add-on anual es un
  preapproval de `frequency: 12, frequency_type: 'months'`**, exactamente como los planes anuales.
+ **No hay `statement_descriptor` en preapprovals** — murió con el checkout hosteado. El
  `HOSPEDA_MERCADO_PAGO_STATEMENT_DESCRIPTOR` que hoy viaja en el checkout del add-on
  (`addon.checkout.ts:520-522`) **desaparece** en el camino recurrente. El resumen de tarjeta del
  cliente va a decir lo que MP quiera. Vale avisarle al dueño: es un cambio visible para el comprador.
+ **Los preapprovals basados en plan y los ad-hoc son excluyentes**: `buildCreateBody`
  (`subscription.adapter.ts:227-279`) manda `preapproval_plan_id` **o** un `auto_recurring` inline,
  nunca los dos (MP rechaza el combo).
+ **MP le avisa por mail al pagador ante cualquier cambio de monto o estado** de su suscripción
  (doc oficial, "Manage subscribers"). Esto pesa en la evaluación de la alternativa C (§5.3).
+ **Cancelar ≠ pausar**: `cancel(id, true)` mapea a `PUT { status: 'paused' }` (reversible);
  `cancel(id, false)` a `PUT { status: 'cancelled' }` (irreversible). La implementación canónica
  del cancel duro ya existe: `apps/api/src/services/billing/preapproval-hard-cancel.ts`.
+ **La correlación del webhook es por id de preapproval** (`data.id` →
  `billing_subscriptions.mp_subscription_id`), no por ítem ni por `external_reference` en la capa
  de extracción de qzpay (`webhook.adapter.ts:568-606`). No existe forma de saber "qué ítem del
  preapproval se cobró": el preapproval *es* el ítem.

### 1.5 Dimensionar "un preapproval por add-on"

Hay un tope duro que acota el problema. `packages/db/src/migrations/0000_baseline.sql:1698`:

```sql
CREATE UNIQUE INDEX "idx_addon_purchases_active_unique"
  ON "billing_addon_purchases" ("customer_id","addon_slug")
  WHERE status = 'active' AND deleted_at IS NULL;
```

Una compra activa por `(cliente, add-on)`. Con 5 add-ons recurrentes activos hoy
(`ai-support-monthly` está `isActive: false`), el techo teórico es **1 preapproval de plan + 5 de
add-ons = 6 por cliente**. El caso realista que planteó el coordinador — un cliente con 3 add-ons —
son **4 preapprovals**.

Ese índice también define la semántica de la renovación: **una renovación NO inserta una fila
nueva** (el índice la rechazaría). La fila de compra *es* la suscripción del add-on; la renovación
sólo mueve su `current_period_end` y agrega una fila en `billing_payments`.

#### Qué implica para cada subsistema

| Subsistema | Archivo | Qué pasa hoy con una fila de add-on |
|---|---|---|
| **Dunning** | `cron/jobs/dunning.job.ts:573` | Selecciona **todas** las suscripciones `past_due` vía `billing.subscriptions.listAll`, sin filtrar por dominio. Hoy su rama mutante está prácticamente muerta: su propio módulo (líneas 36-55) documenta que `past_due` es inalcanzable localmente porque no hay camino que lo escriba. **Un preapproval de add-on rechazado sería lo primero en volverlo alcanzable — y sobre el sujeto equivocado**: mails de "tu suscripción está vencida" por un add-on de ARS 5.000, y a los 7 días una cancelación que dispara `handleSubscriptionCancellationAddons` y revoca **todos** los add-ons de esa suscripción. |
| **Poll** | `cron/jobs/subscription-poll.job.ts:550` | No barre todas las suscripciones: trabaja sobre jobs de polling por sesión de checkout, más un bucle acotado de reconciliación de promos (`status=ACTIVE AND promoCodeId IS NOT NULL AND mpSubscriptionId IS NOT NULL`). El riesgo acá es menor, pero cada checkout de add-on va a encolar su propio job de polling. |
| **preapproval-less-expiry** | `cron/jobs/preapproval-less-expiry.job.ts` | Cosecha filas `active` con `mp_subscription_id IS NULL`. Una fila de add-on creada antes de que se linkee su preapproval entra en esa población. |
| **finalize-cancelled-subs / abandoned-pending-subs / trial-reconcile** | `cron/jobs/*` | Barren `billing_subscriptions` por estado. Ninguno sabe distinguir un add-on. |
| **Motor de entitlements** | `packages/service-core/.../subscription-product-domain.ts:127` | `subscriptionMatchesDomain` **falla abierto** para `accommodation`: `null`/`undefined`/`'accommodation'` cuentan como alojamiento. La columna tiene default `'accommodation'`. Una fila de add-on sin `product_domain` explícito **se cuenta como la suscripción de alojamiento del dueño**. |
| **El propio checkout de add-ons** | `addon.checkout.ts:367` y `:950` | `subscriptions.find(sub => isEntitlementGrantingStatus(sub.status))` toma la **primera** suscripción que otorgue entitlements. Si esa es una fila de add-on, `activeSubscription.planId` resuelve al "plan" del add-on y el chequeo de `targetCategories` decide sobre el objeto equivocado. |
| **Cancelación de add-on** | `addon.user-addons.ts:95` (`cancelUserAddon`) | Hace **cero** llamadas a MercadoPago. Hoy es correcto (no hay nada que cancelar). Con un preapproval detrás es exactamente el modo de falla de HOS-751: estado local terminal + proveedor vivo cobrando. |
| **Cambio de plan** | `addon-plan-change.service.ts:19-21` | Su propio doc lo dice: *"It does NOT update `billing_addon_purchases` rows. It does NOT modify the subscription in QZPay."* Sólo recalcula el límite combinado y avisa el downgrade. Sigue siendo correcto, pero no cancela ni reajusta ningún preapproval. |
| **Vencimiento de add-ons** | `addon-expiration.queries.ts:192,273` | `findExpiredAddons` / `findExpiringAddons` filtran duro por `isNotNull(expires_at)`. Como los recurrentes salen con `expires_at = null`, **son categóricamente invisibles al cron de vencimiento**. Es la otra mitad del bug de HOS-847: no sólo no se re-cobran, tampoco se vencen. |
| **Lectura de entitlements** | `middlewares/entitlement.ts:501-748` | `loadEntitlements` **no lee `billing_addon_purchases` en absoluto**. Lee las tablas propias de QZPay (`billing_customer_entitlements` / `billing_customer_limits`), que `AddonEntitlementService` sincroniza al otorgar/revocar. Y el `grant` de un add-on recurrente también sale con `expiresAt: undefined` — el mismo bug espejado en la capa de QZPay. Consecuencia: revocar un add-on es llamar a `revokeBySource`, no tocar la fila de compra. |

### 1.6 El repo ya sabía que esto faltaba, y dejó escrito cómo hacerlo

`apps/api/src/routes/webhooks/mercadopago/subscription-logic.ts:1825-1841` lleva el comentario
`GAP-043-53`, que dice literalmente que no hay despacho de renovación de add-on **y** bosqueja la
forma prevista:

```
// MercadoPago handles add-on recurring billing externally and does not emit a
// distinct webhook event per add-on renewal. The `subscription_preapproval.updated`
// event only signals changes to the subscription's overall status ... it carries
// no per-addon granularity.
//
// To implement ADDON_RENEWAL_CONFIRMATION in the future:
//   1. Create a dedicated webhook handler for add-on payment events ...
```

Ese comentario tiene una premisa **equivocada** ("MercadoPago handles add-on recurring billing
externally"): MercadoPago no maneja nada, porque nunca se le pidió un preapproval. Pero la
conclusión operativa que saca es la correcta y es la que adopta este plan: **un handler dedicado**.

El molde ya existe y funciona en producción:
`apps/api/src/routes/webhooks/mercadopago/subscription-payment-handler.ts` (SPEC-141 D4) atiende
`subscription_authorized_payment.{created,updated}` para la suscripción del plan — resuelve la fila
local por `preapproval_id`, inserta en `billing_payments` con idempotencia por id de pago de MP, y
es el disparador primario de la conversión de trial de HOS-171. **El handler de renovación de
add-ons se calca de ese archivo, no se inventa.**

---

## 2. El terreno minado

Lecturas obligatorias antes de tocar nada: el bloque *«Card-first trials, one charging mechanism
(HOS-171)»* de `CLAUDE.md` en la raíz, y el header entero de
`scripts/check-no-trial-to-mercadopago.sh`.

### 2.1 El guard G-1 restringe el diseño de forma concreta

`scripts/check-no-trial-to-mercadopago.sh` falla el build si alguno de estos nombres aparece en
**posición de literal de objeto** en cualquier archivo de producción que importe `@qazuor/qzpay-*`:

```
freeTrialDays | freeTrial | free_trial | start_date
```

`start_date` está prohibido **junto con** `free_trial` porque HOS-171 midió que son el mismo
mecanismo de proveedor para diferir el primer cobro.

**Qué me prohíbe, en concreto:**

+ **No puedo alinear el primer cobro del add-on al aniversario del plan.** La forma natural
  (`auto_recurring.start_date = <próximo aniversario>`) está prohibida por el guard **y** sería
  inútil igual: §1.3 midió que `start_date` es inmutable y que el `PUT` miente con un 200.
+ **No puedo darle al add-on un período de gracia ni un prorrateo del proveedor.** El primer cobro
  ocurre al autorizar, a precio completo.
+ **Si hace falta prorratear**, la única palanca es bajar el `transaction_amount` del **primer
  ciclo** — y para eso el repo ya tiene el mecanismo de "monto horneado" de HOS-244
  (`billing_mp_plans.discount_cycle1_amount_centavos`), no una mutación reactiva post-autorización.
  **Recomendación: no prorratear en v1.** Es alcance nuevo con una superficie de error cara.

### 2.2 Una fuga del guard que este trabajo puede pisar sin querer

El guard **no** prohíbe `trialDays`, que es el nombre del campo en el input de *precio* de qzpay
(`QZPayCreatePriceInput.trialDays`). `mp-plan-provisioning.service.ts:255` lo usa legítimamente, y
su propio JSDoc dice que el adaptador *"bakes the `free_trial` into the plan when `trialDays > 0`"*.
O sea: **se puede mandar un trial a MercadoPago sin que G-1 se entere**, escribiéndolo `trialDays`.

Los cuatro checkouts de plan pasan `trialDays: 0` desde HOS-1012
(`subscription-checkout.service.ts:575, 859, 1159, 1530`). **El camino del add-on tiene que hacer lo
mismo, y hay que fijarlo con un test, no con una convención**: en el provisioning de planes MP para
add-ons, `trialDays` debe ser una constante `0` en el módulo, no un parámetro. Ver PR 3.

*(No propongo ensanchar G-1 a `trialDays` a secas: rompería el call site legítimo de
`mp-plan-provisioning.service.ts` y un guard que llora lobo termina con una escape hatch atornillada,
que es el modo de falla que el propio header del guard explica.)*

### 2.3 Lo que NO hay que "arreglar"

+ **`deriveTrialingStatus`** y el insert `mode:'paid' → incomplete` de qzpay son deliberados. Para
  add-ons la traducción es directa y no negociable: **la fila de compra nace `pending` y el
  límite/entitlement se otorga en el webhook, nunca en la creación del checkout.** Si se otorgara al
  crear el checkout, cualquiera que abandone la pantalla de autorización de MP se lleva el aumento
  de límite gratis — el mismo agujero que ese guard tapa para los planes.
+ **No preguntarle a MercadoPago qué va a cobrar ni cuándo.** HOS-522: MP prometió 14 días gratis y
  cobró ARS 18.000 **118 segundos después**, porque `free_trial` y `first_invoice_offset` describen
  los términos del *plan*, no lo que va a pasar con *este* pagador. HOS-936 intentó leer el campo
  honesto; HOS-1012 decidió dejar de preguntar. Traducción para add-ons: **el
  `current_period_end` de un add-on es un valor NUESTRO**, calculado desde el cobro confirmado
  (`subscription_authorized_payment.created`), nunca copiado de `next_payment_date`.
+ **No construir un reconciliador que derive estado desde el proveedor.** El patrón correcto ya está
  en el cron `trial-reconcile`: convierte ante evidencia de un cobro, no ante una promesa.
+ **HOS-751 / HOS-753**: un estado local terminal con un preapproval vivo es el peor modo de falla
  del subsistema. El preapproval `275b27a37f6f4e94bc1ab7543c6bd092` quedó autorizado y volvió a
  cobrar. La implementación canónica del cierre está en
  `apps/api/src/services/billing/preapproval-hard-cancel.ts` — **usarla, no escribir otra**.

### 2.4 `ProductDomainEnum` está congelado por tres guards

Tiene exactamente 4 miembros (`accommodation`, `gastronomy`, `experience`, `partner`) y su propio
JSDoc avisa que **nada en el sistema de tipos lo defiende**. Lo vigilan:

+ `packages/schemas/test/enums/product-domain.enum.test.ts` (conteo congelado),
+ `scripts/check-product-domain-vocabulary.sh`,
+ `scripts/check-product-domain-raw-sql.sh`.

Agregar un quinto miembro (`addon`) es un cambio deliberado que toca los tres. **Hay que decidirlo en
el PR 1, no descubrirlo en el PR 5.** Ver la pregunta abierta OQ-1.

### 2.5 Dos guards más que este trabajo puede despertar

+ **`scripts/check-qzpay-wave-convergence.sh`** (HOS-232) exige que los cinco paquetes
  `@qazuor/qzpay-*` estén pineados contra la misma versión de `core`. Si algún PR necesita subir
  `qzpay-drizzle` o `qzpay-mercadopago`, hay que subirlos **en ola**, en un PR propio, antes.
+ **Ningún test fija hoy el comportamiento actual.** Buscando en toda la suite de add-ons no hay un
  solo test que afirme "una compra `recurring` sale con `expires_at = null` y por eso queda fuera de
  `findExpiredAddons`". Hay fixtures que usan `billingType: 'recurring'`
  (`addon.checkout.test.ts:445,1157,1645,…`) pero ninguno asevera sobre el `expiresAt` resultante.
  Eso corta para los dos lados: el arreglo no va a hacer fallar nada existente (bueno), pero tampoco
  hay nada que documente el estado actual como intencional (peligroso: alguien podría haberlo
  "arreglado" a medias sin que nadie se entere). **El PR 4 debería agregar el test que falta**, para
  que el cambio de comportamiento quede visible en un diff de tests y no sólo en el de código.

---

## 3. El plan en PRs encadenados

Regla de la cadena: **cada PR mergea verde por sí solo y, si la cadena se corta ahí, el sistema no
queda peor que hoy.** El feature flag es lo que lo hace cierto: `HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED`
queda apagado hasta el PR 8.

Precedente exacto del flag: `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED`
(`apps/api/src/utils/env-schema.ts:512-515` + `packages/config/src/env-registry.hospeda.ts:956-971`),
un booleano oscuro por default:

```ts
HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
```

Sólo el string literal `'true'` lo enciende. Sus cinco suites `-flag-on` / `-flag-off` son el molde
de test a copiar.

> **Advertencia al implementador**: la documentación de ese flag (el JSDoc en `env-schema.ts:508-510`
> y la `description` del registry) está **desactualizada** — dice *"accommodation monthly only"*
> cuando el código lo consulta en cuatro puntos de entrada (monthly, annual, commerce, partner:
> `subscription-checkout.service.ts:622, 938, 1206, 1570`). No copiar ese texto; verificar contra el
> código.

### PR 1 — Cimientos: flag, columnas y registro de planes MP (todo en oscuro)

**Qué hace**:

+ Registra `HOSPEDA_BILLING_RECURRING_ADDONS_ENABLED` en los 4 lugares obligatorios: Zod
  (`apps/api/src/utils/env-schema.ts`), registry (`packages/config/src/env-registry.hospeda.ts`),
  `apps/api/.env.example`, y los generadores/conteos congelados que arrastra
  (`gen:env-examples`, `gen:env-registry-json`).
+ Migración estructural sobre `billing_addon_purchases`:
  `mp_subscription_id varchar(255) NULL`, `current_period_start timestamptz NULL`,
  `current_period_end timestamptz NULL`, `cancel_at_period_end boolean NOT NULL DEFAULT false`,
  `billing_interval varchar(20) NULL` (snapshot `monthly|annual` al comprar).
+ Tabla nueva `billing_mp_addon_plans (id, addon_id FK→billing_addons, billing_interval,
  mp_preapproval_plan_id, amount_ars, created_at, updated_at)` con `UNIQUE(addon_id, billing_interval)`.
+ `pnpm db:generate` + archivo de migración commiteado (el drift guard bloquea el CI si falta).
+ **Carril 2 (extras)**: si se agrega algún estado nuevo a `billing_addon_purchases.status`, hay que
  tocar el CHECK que hoy lo limita a `('active','expired','canceled','pending')` en
  `packages/db/src/migrations/extras/004-billing.constraints.sql:16-89`. **Recomendación: no agregar
  estados.** `pending` ya sirve para "preapproval creado, no autorizado" y `canceled` para el final;
  el resto del ciclo vive en `cancel_at_period_end` + `current_period_end`.

**Archivos**: `apps/api/src/utils/env-schema.ts`, `packages/config/src/env-registry.hospeda.ts`,
`apps/api/.env.example`, `packages/db/src/schemas/billing/*.ts`, `packages/db/src/migrations/*`.
**Tamaño**: ~300 líneas (mayoría generadas).

> Estas columnas también tapan un bug que existe **hoy, independientemente de HOS-847**: la ruta
> `POST /addons/{id}/cancel` promete *"remains active until the end of the current billing period"*
> y `cancelUserAddon` (`addon.user-addons.ts:213-229`) revoca en el acto, porque no hay ni
> `current_period_end` ni `cancel_at_period_end` en la tabla. Con cobro único eso significa que el
> cliente pierde el mes que pagó; con cobro recurrente pasa a ser una pregunta de reembolso.

**Qué se verifica**: la migración aplica sobre una DB fresca y sobre una copia de staging;
`pnpm env:check:registry` verde; typecheck/lint verdes; el flag existe y está apagado.

**Si la cadena se corta acá**: comportamiento idéntico a hoy más columnas muertas. Riesgo cero.

> **No reutilizar `billing_mp_plans`.** Su `commercial_plan_id` es `NOT NULL` con FK a `billing_plans`;
> volverlo nullable debilita el invariante de un registro que hoy es correcto. Una tabla hermana
> cuesta menos que un `NULL` con significado.

---

### PR 2 — Aislamiento de dominio (el PR más importante, y va en oscuro)

**Qué hace**: decide el `product_domain` de una fila de `billing_subscriptions` que respalda un
add-on, y **agrega el filtro correspondiente en todos los barridos que hoy asumen que cada fila es
la suscripción de un cliente**. Con cero filas de add-on en la base, es un no-op verificable.

Sitios a tocar (la lista es el entregable; que se olvide uno es exactamente cómo se rompe esto):
`cron/jobs/dunning.job.ts`, `subscription-poll.job.ts`, `preapproval-less-expiry.job.ts`,
`finalize-cancelled-subs.ts`, `abandoned-pending-subs.job.ts`, `trial-expiry.ts`,
`entity-subscription-cache-reconcile.job.ts`, `packages/service-core/.../owner-entitlement.ts`, y
los dos `subscriptions.find(...)` de `addon.checkout.ts:367` y `:950`.

**Archivos**: ~10 archivos, cambios chicos y mecánicos en cada uno.
**Tamaño**: ~250 líneas + ~10 tests (uno por sitio, afirmando que una fila de add-on sintética queda
excluida).

**Qué se verifica**: por cada sitio, un test que le pasa una fila de add-on y afirma que no la
procesa. Ese test es el guard: sin él el filtro se pierde en el primer refactor.

**Si la cadena se corta acá**: no-op absoluto (no existen filas de add-on). Riesgo cero, y el
sistema queda mejor preparado.

> **OQ-1 (decisión del dueño, necesaria antes de este PR)**: ¿`product_domain = 'addon'` (quinto
> miembro del enum, toca los 3 guards congelados) o una marca fuera del enum
> (`metadata.isAddonSubscription = true` / una columna booleana propia)?
> **Recomendado: el quinto miembro del enum.** El `metadata` no se puede indexar bien ni filtrar en
> SQL con confianza, y el fallo-abierto de `accommodation` castiga justamente a lo que no tiene un
> valor explícito. Un miembro de enum es caro una vez (3 guards) y barato para siempre.

---

### PR 3 — Provisioning de `preapproval_plan` para add-ons (en oscuro)

**Qué hace**: `apps/api/src/services/billing/mp-addon-plan-provisioning.service.ts`, calcado de
`mp-plan-provisioning.service.ts` (idempotente, re-provisiona ante drift de precio, archiva el plan
viejo), pero con dos diferencias deliberadas:

+ **`trialDays` es una constante `0` del módulo, no un parámetro.** No hay variante con trial que
  provisionar; ver §2.2.
+ El registro va a `billing_mp_addon_plans`, con clave `(addon_id, billing_interval)` — sin la
  dimensión `trial_days` que `billing_mp_plans` necesita.

Nadie lo llama todavía.

**Archivos**: 1 archivo nuevo + su test.
**Tamaño**: ~350 líneas + ~200 de test.

**Qué se verifica**: idempotencia (segunda llamada, cero llamadas a MP); re-provisioning ante drift
de precio; y **un test que afirma que el `QZPayCreatePriceInput` construido lleva `trialDays: 0`** —
la mitad conductual de la fuga descrita en §2.2.

**Si la cadena se corta acá**: código muerto. Riesgo cero.

---

### PR 4 — Checkout recurrente detrás del flag (flag APAGADO en prod)

**Qué hace**: en `createAddonCheckout`, una rama nueva:

```
flag ON  &&  addon.billingType === 'recurring'
    → resolver/provisionar el preapproval_plan del add-on (PR 3)
    → crear el preapproval vía createPaidSubscription / createOwnPreapprovalSubscription
    → escribir la fila de billing_subscriptions con el product_domain de PR 2
      y metadata.addonSlug
    → escribir billing_addon_purchases en status='pending' con mp_subscription_id
    → devolver el init_point

en cualquier otro caso
    → el camino de hoy, byte por byte
```

**Nada se otorga acá.** Ni límites, ni entitlements, ni `status='active'`. Eso lo hace el PR 5.

**Archivos**: `apps/api/src/services/addon.checkout.ts` (se va a pasar de 500 líneas — hay que
extraer la rama recurrente a `addon.checkout.recurring.ts`), `apps/api/src/routes/billing/addons.ts`
(la respuesta ahora puede traer un `appliedEffect`/intervalo).
**Tamaño**: ~400 líneas + ~300 de test.

**Qué se verifica**: el par flag-on/flag-off calcado de
`apps/api/test/services/subscription-checkout-own-preapproval-flag-{on,off}.test.ts`. El test
flag-off tiene que afirmar que el payload sigue teniendo `mode: 'payment'` y no cambió nada más —
es la prueba de que el camino viejo no se movió. **Ya existe un test que lo fija**:
`apps/api/test/services/addon.service.test.ts:801` afirma
`expect.objectContaining({ mode: 'payment', ... })`. Ese test **tiene que seguir pasando sin
modificarse** con el flag apagado; si hay que tocarlo, el flag se filtró donde no debía.

**Si la cadena se corta acá (flag apagado)**: comportamiento idéntico a hoy.
**Si alguien enciende el flag sin el PR 5**: el cliente autoriza un cobro recurrente y **nunca
recibe el add-on** (la fila queda en `pending` para siempre). Por eso los PRs 4 y 5 se encienden
juntos y el flag no se toca hasta el PR 8. La `description` del registry tiene que decirlo con esas
palabras.

---

### PR 5 — Activación y renovación por webhook

**Molde**: `apps/api/src/routes/webhooks/mercadopago/subscription-payment-handler.ts` (§1.6). El
archivo nuevo es su hermano para add-ons; además hay que **borrar o corregir el comentario
`GAP-043-53`** de `subscription-logic.ts:1825-1841`, cuya premisa ("MercadoPago handles add-on
recurring billing externally") es falsa y va a confundir al próximo que lo lea.

**Qué hace**:

+ **Ruteo primero**: en el handler de webhooks, resolver `data.id` (id de preapproval) contra
  `billing_addon_purchases.mp_subscription_id` **antes** que contra el handler de suscripciones de
  plan. Un cobro de add-on nunca se debe contabilizar como una renovación de plan.
+ `preapproval.updated` → `authorized`: `pending → active`, aplicar límites/entitlements reusando el
  seam de `confirmAddonPurchase` (refactorizado para aceptar una compra ya conocida), fijar
  `current_period_start/end` **calculado por nosotros** (§2.3).
+ `subscription_authorized_payment.created`: registrar el cobro en `billing_payments` con
  `metadata.flow = 'addon-recurring'` (hoy existe `'addon-purchase'`), avanzar
  `current_period_end`. **Nunca insertar una segunda fila de compra** (el índice único la
  rechazaría, y no es lo que queremos).
+ Dedupe: reusar la búsqueda por `provider_payment_ids->>'mercadopago'` que ya usa
  `recordAddonPayment` (`addon.checkout.ts:812-826`).

**Archivos**: el handler de webhooks de MP, `addon.checkout.ts` (extracción del seam de
confirmación), `apps/api/src/services/addon-recurring-renewal.service.ts` (nuevo).
**Tamaño**: ~450 líneas + ~400 de test.

**Qué se verifica**: activación desde payload sintético; renovación que avanza el período;
**redelivery del mismo evento que no duplica el cobro ni la fila**; un pago de add-on que **no**
aparece como renovación de plan.

**Si la cadena se corta acá**: flag apagado → sin efecto.

---

### PR 6 — Cancelación: cerrar el agujero de HOS-751

**Qué hace**:

+ `cancelUserAddon` (`addon.user-addons.ts:95`): si la compra tiene `mp_subscription_id`,
  **hard-cancelar el preapproval con `preapproval-hard-cancel.ts` ANTES de tocar la fila local**, y
  **fallar cerrado** si MP rechaza. Nunca dejar estado local terminal con proveedor vivo.
+ `handleSubscriptionCancellationAddons` (`addon-lifecycle-cancellation.service.ts`): cuando se
  cancela el plan, cancelar también cada preapproval de add-on del cliente.
+ Cancelación de plan por dunning / refund / finalize: mismo tratamiento, por el mismo módulo.
+ **Ojo con `HOSPEDA_ADDON_LIFECYCLE_ENABLED`**: `handleSubscriptionCancellationAddons` ya está
  detrás de ese flag preexistente. Si está apagado en algún entorno, cancelar el plan **no revoca los
  add-ons** — hoy eso deja un entitlement colgado; con preapprovals vivos dejaría además un cobro
  colgado. Verificar su valor en prod y staging (`hops --target=prod env-list api --reveal --match
  "ADDON_LIFECYCLE"`) **antes** de este PR, y decidir si el hard-cancel del preapproval queda
  también detrás de él (recomendado: **no** — el cierre del proveedor no debe ser opcional).
+ Ajustar la copy de la ruta `POST /addons/{id}/cancel`, que hoy promete *"remains active until the
  end of the current billing period"* mientras el servicio revoca inmediatamente. Con cobro real esa
  diferencia pasa de cosmética a una pregunta de reembolso.

**Archivos**: `addon.user-addons.ts`, `addon-lifecycle-cancellation.service.ts`,
`apps/api/src/routes/billing/addons.ts`, `apps/api/src/services/refund-lifecycle.service.ts`.
**Tamaño**: ~350 líneas + ~300 de test.

**Qué se verifica**: cancelación local con preapproval vivo que **falla** si MP rechaza; cancelación
de plan que cierra los N preapprovals de add-on; un test de regresión que afirma que ninguna fila de
compra puede quedar `canceled` con `mp_subscription_id` apuntando a un preapproval `authorized`.

**Si la cadena se corta acá**: flag apagado → sin efecto. **Este es el PR que hace que el flag sea
seguro de encender.**

> **OQ-2 (decisión del dueño)**: si el cliente baja a un plan cuyo `targetCategories` excluye el
> add-on, ¿se le sigue cobrando el add-on o se le cancela solo? **Recomendado: seguir cobrando y
> mantener el límite** — cancelarle solo un cobro que autorizó es una sorpresa cara en la otra
> dirección, y `addon-plan-change.service.ts` ya notifica el downgrade.

---

### PR 7 — Reconciliador + observabilidad + admin

**Qué hace**:

+ Cron nuevo `addon-subscription-reconcile` (6-horario, calcado de
  `entity-subscription-cache-reconcile`): para cada compra `active` con `mp_subscription_id`,
  releer el preapproval y espejar el veredicto del proveedor (`paused`/`cancelled` → revocar;
  `authorized` con período vencido → esperar el cobro / marcar). Este cron es lo que detecta
  "dejamos de cobrar y nadie se enteró".
+ Reusar la bandera `needs_entitlement_sync` que ya existe en la tabla, y la **fase 7** del cron
  `addon-expiry` (barrido de reconciliación de grants) como patrón: reclama las filas dentro del lock
  y hace las llamadas HTTP **después** del commit, porque el advisory lock (`43001`) no debe
  sostenerse durante latencia externa (ADR-019).
+ **Revocar es llamar a `revokeBySource` de QZPay**, no marcar la fila: la lectura por request va a
  `billing_customer_entitlements` / `billing_customer_limits`, no a `billing_addon_purchases`
  (§1.5). Una fila marcada `canceled` sin la revocación de QZPay deja el beneficio vivo.
+ Alertas a Sentry y una vista en el admin (`routes/billing/admin/customer-addons.ts` ya existe,
  con `POST /{id}/expire` y `POST /{id}/activate` como palancas manuales).

**Archivos**: 1 cron nuevo + registro en `cron/jobs/index.ts`, extensión del admin.
**Tamaño**: ~400 líneas + ~250 de test.

**Si la cadena se corta acá**: flag apagado → sin efecto.

---

### PR 8 — Encendido

**Qué hace**: flag ON en staging → smoke completo contra el sandbox de MP (checkout de un add-on
recurrente, autorización, primer cobro, renovación forzada con el plan diario de QA, cancelación,
cancelación del plan con add-ons vivos) → sign-off en el checklist de SPEC-143 → flag ON en prod.
Además: copy/UI del add-on que diga "se renueva mensualmente y se te va a cobrar" en vez de la copy
de compra única, y el tratamiento de lo ya vendido decidido en §4.

**Tamaño**: chico en código, grande en verificación manual. Etiquetas
`status-needs-smoke-staging` + `status-needs-smoke-prod` (esto es billing CORE).

---

### Tabla resumen

| PR | Qué hace | Tamaño aprox. | Qué verifica al terminar | Si la cadena se corta ahí |
|---|---|---|---|---|
| 1 | Flag + columnas + `billing_mp_addon_plans` | ~300 | migración aplica; `env:check:registry` verde | idéntico a hoy + columnas muertas |
| 2 | Aislamiento de dominio en ~10 barridos | ~250 + 10 tests | cada barrido excluye una fila de add-on | no-op; el sistema queda mejor |
| 3 | Provisioning de `preapproval_plan` de add-on | ~350 + 200 | idempotencia, drift, `trialDays: 0` | código muerto |
| 4 | Checkout recurrente (flag OFF) | ~400 + 300 | par flag-on/flag-off; el camino viejo intacto | idéntico a hoy |
| 5 | Activación + renovación por webhook | ~450 + 400 | activa, renueva, dedupea redeliveries | idéntico a hoy |
| 6 | Cancelación → hard-cancel del preapproval | ~350 + 300 | falla cerrado; ninguna fila terminal con proveedor vivo | idéntico a hoy |
| 7 | Cron reconciliador + admin | ~400 + 250 | detecta divergencia local↔MP | idéntico a hoy |
| 8 | Encendido + copy + lo ya vendido | chico | smoke staging + prod | — |

---

## 4. Qué pasa con lo ya vendido

### 4.1 Cómo averiguarlo (query lista para pegar)

Dos advertencias que cuestan una ronda cada una:

+ **`hops psql` devuelve salida vacía, sin error, ante cualquier query que contenga la palabra
  `slug`** (medido el 28/08/2026 contra staging). La columna se llama `addon_slug` y la del catálogo
  vive en `metadata->>'slug'`, así que hay que rodearla. Abajo se hace con concatenación
  (`'addon_' || 'sl' || 'ug'`), que no deja esa palabra en el texto de la query.
+ **Una salida vacía es un error tragado, no «cero filas»**. Por eso el bloque arranca con un
  `count(*)` de control: si ese no imprime un número, la query no corrió y no hay nada que concluir.

```bash
ssh -o BatchMode=yes -p 2222 qazuor@216.238.103.219 \
  '~/.local/bin/hops --target=prod psql --stdin' <<'SQL'
-- 0) CONTROL. Si esto no imprime un número, la conexión/query falló:
--    NO interpretar los bloques siguientes.
SELECT count(*) AS control_total_compras FROM billing_addon_purchases;

-- 1) EL NÚMERO QUE IMPORTA.
--    `expires_at` sólo se setea para add-ons one_time con durationDays
--    (addon.checkout.ts:1004-1006), y los dos one_time del catálogo lo tienen.
--    Entonces `expires_at IS NULL` == compra de un add-on recurrente.
SELECT
    status,
    count(*)                                   AS compras,
    count(*) FILTER (WHERE expires_at IS NULL) AS recurrentes,
    min(purchased_at)                          AS primera,
    max(purchased_at)                          AS ultima
FROM billing_addon_purchases
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY status;

-- 2) DESGLOSE POR ADD-ON, sin escribir la palabra prohibida.
--    to_jsonb(p) expone la columna por nombre construido en tiempo de ejecución.
SELECT
    to_jsonb(p) ->> ('addon_' || 'sl' || 'ug') AS addon,
    p.status,
    count(*)                                   AS compras,
    count(DISTINCT p.customer_id)              AS clientes,
    count(*) FILTER (WHERE p.expires_at IS NULL) AS sin_vencimiento
FROM billing_addon_purchases p
WHERE p.deleted_at IS NULL
GROUP BY 1, 2
ORDER BY 1, 2;

-- 3) CONTRASTE CONTRA EL CATÁLOGO (billing_addons.billing_interval es el
--    discriminador de verdad: 'one_time' vs cualquier otra cosa == recurring,
--    ver addon-catalog.mapper.ts:61). LEFT JOIN a propósito: `addon_id` no se
--    escribía antes de HOS-595, así que un INNER JOIN descartaría en silencio
--    las compras viejas — que son justamente las que estoy buscando.
SELECT
    coalesce(a.billing_interval, '(sin addon_id)') AS intervalo_catalogo,
    a.name                                         AS addon_nombre,
    p.status,
    count(*)                                       AS compras
FROM billing_addon_purchases p
LEFT JOIN billing_addons a ON a.id = p.addon_id
WHERE p.deleted_at IS NULL
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- 4) PLATA REALMENTE COBRADA por esas compras (para dimensionar el costo de
--    cualquier decisión de reembolso o de grandfathering).
SELECT count(*) AS cobros, sum(amount) AS total_centavos, min(created_at), max(created_at)
FROM billing_payments
WHERE metadata->>'flow' = 'addon-purchase';
SQL
```

Correr lo mismo con `--target=staging` para tener el contraste.

### 4.2 Qué hacer con esas compras

**Recomendación: respetarlas como pago único (grandfathering), NO migrarlas al cobro recurrente.**

Tres razones, en orden de peso:

1. **No se pueden migrar aunque quisiéramos.** Un preapproval exige que el pagador autorice una
   tarjeta en la pantalla de MercadoPago. No existe forma de crearle uno a alguien que compró hace
   meses. Cualquier "migración" es, necesariamente, un checkout nuevo que el cliente tiene que
   completar a mano.
2. **Cobrarle un recurrente a alguien que autorizó un pago único es el error más caro disponible
   acá.** No es un bug técnico: es un cargo no autorizado.
3. El volumen probablemente sea chico (la query lo dice). Si son pocas decenas, el costo de
   respetarlas para siempre es despreciable frente al costo de equivocarse.

**Implementación del grandfathering** (va en el PR 8): marcar cada compra recurrente preexistente con
`metadata.grandfatheredOneTime = true` + `metadata.grandfatheredAt`, mediante una data-migration
numerada en `packages/seed/src/data-migrations/` (carril 3), y hacer que el reconciliador del PR 7
las ignore explícitamente. Sin la marca, el reconciliador va a verlas como "compra activa sin
preapproval" y no va a saber si es un bug o un derecho adquirido.

**Opción B, si el dueño quiere recuperar ese ingreso**: mail de opt-in a esos clientes con un link al
checkout recurrente, y una fecha a partir de la cual el beneficio grandfathered caduca. Es una
decisión comercial, no técnica; el plan la soporta sin cambios (es una compra nueva por el camino
normal). **Requiere decisión explícita del dueño; no se hace por default.**

---

## 5. Lo que NO haría falta construir

### 5.1 Ya existe (no reescribirlo)

| Necesidad | Ya está en | Nota |
|---|---|---|
| Ruta de cancelación de add-on | `routes/billing/addons.ts:320` `POST /{id}/cancel` | falta sólo el hard-cancel de MP (PR 6) |
| Vencimiento + avisos (3 días, 1 día, vencido) | `cron/jobs/addon-expiry.job.ts` | ya idempotente y chunked |
| Revocación de entitlements/límites | `addon-lifecycle.service.ts`, `addon-entitlement.service.ts` | versión estricta y versión resiliente, ambas |
| Recálculo de límites al cambiar de plan | `addon-plan-change.service.ts`, `addon-limit-recalculation` | ya suma add-ons al límite base |
| Detección de downgrade + notificación | `addon-downgrade-detection.service.ts` | |
| Libro mayor del cobro (`billing_payments`) + dedupe | `addon.checkout.ts:787-901` | reusar tal cual para la renovación |
| Cola de pagos huérfanos | `billing/orphan-payment-queue.service.ts` | ya cubre "cobramos y no lo pudimos aplicar" |
| Cancel duro de preapproval | `billing/preapproval-hard-cancel.ts` | **usarlo, no escribir otro** |
| Provisioning de planes MP + registro + drift | `billing/mp-plan-provisioning.service.ts` + `billing_mp_plans` | calcar, no reinventar |
| Idempotencia en las rutas mutantes | `idempotencyKeyMiddleware` ya montado en purchase y cancel | |
| Molde de feature flag + tests on/off | `HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` + 5 suites | |
| **Molde del handler de cobro recurrente** | `webhooks/mercadopago/subscription-payment-handler.ts` | SPEC-141 D4; idempotencia por id de pago de MP ya resuelta |
| Palancas manuales de admin sobre una compra | `routes/billing/admin/customer-addons.ts` | `POST /{id}/expire`, `POST /{id}/activate` |
| Patrón de reconciliación bajo advisory lock | `cron/jobs/addon-expiry.job.ts` fase 7 | reclama en la tx, HTTP después del commit |

Esto reduce el alcance real bastante: los PRs 1-8 son sobre todo **plomería y aislamiento**, no
lógica de negocio nueva.

### 5.2 Un atajo legítimo que vale considerar

**`ai-support-monthly` está `isActive: false` y su precio es TBD** (comentario propio del catálogo:
*"owner to confirm final price at implementation"*). No hace falta que entre en el alcance. **Y
`extra-photos-20`, `extra-gastronomies-1` y `extra-experiences-1` podrían salir del alcance de la v1
también**: si el dueño elige encender el flag por add-on en vez de global, el PR 8 puede arrancar con
uno solo (`extra-accommodations-5`, el de mayor valor y menor ambigüedad) y sumar el resto después de
un mes de datos reales. Recomiendo hacerlo así: el flag booleano se vuelve una lista de slugs
habilitados. Cuesta ~20 líneas más en el PR 1 y reduce la superficie del primer encendido en un 80%.

### 5.3 Dónde el diseño elegido puede ser PEOR que las alternativas

Me pidieron ser honesto acá, así que van las tres, con evidencia.

**Alternativa A — retirar `billingType: 'recurring'` (descartada por el dueño).**
Costo de ingeniería: ~0. Modos de falla nuevos: 0. Lo que se pierde: el ingreso recurrente de 5
add-ons. **Sigo pensando que es la opción de menor riesgo**, y el plan de arriba no la vuelve
irrelevante: si después del PR 2 el dueño mira el tamaño real de los PRs 5-7 y prefiere frenar, A
sigue disponible sin haber roto nada. Lo digo porque es cierto, no para relitigar la decisión.

**Alternativa C — plegar el add-on al preapproval del PLAN, subiéndole el `transaction_amount`.**
Es técnicamente viable: §1.3 midió que ese campo **sí** es mutable en un preapproval vivo, y el repo
ya tiene la maquinaria (`promo-renewal-mp.service.ts:109` hace exactamente ese `PUT`). Sería **un
solo preapproval por cliente**, cero contaminación de dominio, cero superficie nueva de crons — o
sea, resuelve de un saque el problema más caro del diseño elegido.

**Y aun así no la recomiendo, por una razón concreta y verificable**: ese campo **ya tiene otro
escritor**. El motor de descuentos multi-ciclo baja el `transaction_amount` y después lo **restaura
al precio completo del plan** (`promo-renewal-mp.service.ts:135-186`, "Restore a MercadoPago
preapproval's `transaction_amount` to the full plan price"). Esa restauración **borraría el
componente del add-on en silencio** — el cliente deja de pagar el add-on y lo sigue teniendo, o peor,
un orden de escritura distinto le cobra dos veces el descuento. Dos escritores sobre un único campo
mutable es la definición del riesgo que esta issue tiene que evitar. Sumado: MP le manda un mail al
pagador ante cada cambio de monto (doc oficial), el cliente nunca vuelve a autorizar nada (un
aumento de precio silencioso a mitad de ciclo), no hay fecha de cancelación independiente por add-on,
y un reembolso no se puede atribuir a un componente.

**Alternativa D — usar el primitivo nativo de qzpay, `billing_subscription_addons`.**
qzpay-drizzle ya trae una tabla propia para add-ons sobre una suscripción
(`/home/qazuor/projects/PACKAGES/qzpay/packages/drizzle/src/schema/addons.schema.ts:77-104`, con
`status`, `addedAt`, `canceledAt`, `expiresAt`), y **Hospeda no la usa en absoluto**:
`billing_addon_purchases` es un modelo paralelo hecho a mano. Vale nombrarla para que nadie la
"descubra" a mitad del PR 5 y proponga migrar.

**No resuelve el problema.** Es almacenamiento, no cobro: un link table con estado no le dice nada a
MercadoPago, y §1.2 ya cerró la puerta de meterle ítems a un preapproval. Adoptarla significaría
migrar todas las compras existentes, los grants, los 20+ archivos de test y las dos rutas de admin a
un segundo modelo — un costo grande a cambio de cero avance sobre el cobro. Si en algún momento
qzpay implementa cobro real de add-ons contra un proveedor que lo soporte (Stripe sí tiene ítems de
suscripción), esto se reevalúa. Hoy, no.

**Variante C' — un segundo preapproval único que agrupe TODOS los add-ons** (monto = suma).
Evita el choque con el motor de promos (es otro preapproval) y baja el techo a 2 preapprovals por
cliente. Pero cada alta/baja de add-on muta el monto → mail de MP al cliente cada vez, prorrateo
imposible (no hay `start_date`, §1.3 + §2.1), y todas las bajas comparten una única fecha. **No la
recomiendo, pero es la que elegiría si el dueño decide que 6 preapprovals por cliente es
inaceptable.**

---

## 6. Riesgos, ordenados por qué tan caro sale equivocarse

### R1 — Seguir cobrando después de la cancelación (el más caro)

Estado local terminal + preapproval vivo. **Ya pasó en este repo**: HOS-751, preapproval
`275b27a37f6f4e94bc1ab7543c6bd092` quedó `authorized` tras un refund y volvió a cobrar; el módulo
`preapproval-hard-cancel.ts` (HOS-753) nació de ahí. Hoy `cancelUserAddon` hace **cero** llamadas a
MercadoPago, y ese código no cambia solo cuando aparezca un preapproval detrás.

*Mitigación*: PR 6 hard-cancela **antes** de tocar la fila local y **falla cerrado** si MP rechaza;
PR 7 lo reconcilia cada 6 horas; un test de regresión afirma que ninguna fila `canceled` puede tener
un `mp_subscription_id` apuntando a un preapproval `authorized`.

### R2 — Contaminar el motor de entitlements y cobrar/limitar con el objeto equivocado

`subscriptionMatchesDomain` **falla abierto** para `accommodation`, y la columna tiene ese default.
Una fila de add-on sin dominio explícito se cuenta como la suscripción de alojamiento del dueño.
Peor todavía: `addon.checkout.ts:367` y `:950` toman la **primera** suscripción que otorgue
entitlements — puede ser la del add-on, y entonces el chequeo de `targetCategories` decide sobre un
"plan" que no existe.

*Mitigación*: PR 2 va **antes** que cualquier PR que pueda crear una de esas filas, con un test por
sitio. Es la razón de que el aislamiento sea el segundo PR y no el séptimo.

### R3 — Doble cobro

Dos formas: (a) el webhook de un cobro de add-on se contabiliza también como renovación del plan,
avanzando dos períodos; (b) una redelivery de MercadoPago inserta el cobro dos veces.

*Mitigación*: PR 5 rutea por `mp_subscription_id` **antes** que al handler de planes; el dedupe por
`provider_payment_ids->>'mercadopago'` ya existe y se reusa tal cual; el índice único
`idx_addon_purchases_active_unique` impide una segunda fila de compra activa.

### R4 — Fuego cruzado del dunning, sobre un camino que hoy está dormido

`dunning.job.ts:573` selecciona **todas** las suscripciones `past_due` sin filtro de dominio. Su
propio módulo (líneas 36-55) documenta que hoy `past_due` es prácticamente inalcanzable: nada lo
escribe, así que la rama mutante nunca corre. **Los preapprovals de add-on serían lo primero en
despertarla, y lo harían sobre el sujeto equivocado**: el rechazo del cobro de un add-on de ARS
5.000 dispararía mails de "tu suscripción está vencida" y, a los 7 días, una cancelación que llama a
`handleSubscriptionCancellationAddons` y revoca **todos** los add-ons del cliente. Un add-on barato
tumbando la cartera entera, por un camino que nunca se ejercitó en producción.

*Mitigación*: PR 2 lo filtra. **OQ-3**: ¿los add-ons entran al dunning con copy propia, o quedan
fuera y simplemente se revocan al primer rechazo? **Recomendado para v1: fuera del dunning.** Un
add-on no es la suscripción del cliente; siete días de reintentos y mails por ARS 5.000 no valen el
riesgo de confundirlo sobre el estado de su plan.

### R5 — Dejar de cobrar sin que nadie se entere

Un preapproval de add-on que MP pausa o cancela por su cuenta mientras la compra local sigue
`active` → beneficio gratis para siempre. Es **el bug de hoy**, movido de lugar: sin el PR 7 no lo
arreglamos, sólo lo disfrazamos.

Y hoy el sistema es **estructuralmente ciego** a esa condición por partida doble:
`findExpiredAddons`/`findExpiringAddons` filtran por `isNotNull(expires_at)` y los recurrentes lo
tienen en `null`; y el grant de QZPay para un add-on recurrente también sale con `expiresAt:
undefined`, así que tampoco vence del otro lado. Nada mira a estas compras.

*Mitigación*: PR 7 (reconciliador 6-horario), reusando `needs_entitlement_sync` y revocando por
`revokeBySource` en QZPay (no basta con marcar la fila). Sin el PR 7 el flag no se enciende.

### R6 — Un trial que nunca pedimos

El guard G-1 no ve la grafía `trialDays` (§2.2). Un provisioning de plan de add-on con
`trialDays > 0` mandaría un `free_trial` a MercadoPago sin que el CI diga nada — y HOS-522 es lo que
pasa después.

*Mitigación*: PR 3 lo hace constante `0` a nivel módulo y lo fija con un test conductual sobre el
payload construido.

### R7 — El resumen de tarjeta cambia

Los preapprovals no tienen `statement_descriptor` (§1.4). El comprador de un add-on va a ver en su
resumen algo distinto de lo que ve hoy. No es un bug, pero sí una consulta de soporte previsible.

*Mitigación*: avisarlo en la copy del PR 8.

---

## 7. Preguntas abiertas para el dueño

| # | Pregunta | Bloquea | Recomendación |
|---|---|---|---|
| **OQ-1** | ¿`ProductDomainEnum.ADDON` (quinto miembro, toca 3 guards congelados) o una marca fuera del enum? | PR 2 | El miembro del enum. Caro una vez, barato para siempre. |
| **OQ-2** | Si el cliente baja a un plan que no admite el add-on, ¿se le sigue cobrando? | PR 6 | Sí, seguir cobrando y mantener el límite. Cancelarle solo lo que autorizó es una sorpresa en la otra dirección. |
| **OQ-3** | ¿Los add-ons entran al dunning con copy propia o quedan fuera? | PR 2 / PR 6 | Fuera, en la v1. |
| **OQ-4** | ¿Encendemos los 5 add-ons juntos o arrancamos con `extra-accommodations-5`? | PR 1 / PR 8 | Arrancar con uno. El flag pasa de booleano a lista de slugs habilitados (~20 líneas más). |
| **OQ-5** | Compras recurrentes ya vendidas: ¿grandfathering permanente o mail de opt-in con fecha de corte? | PR 8 | Grandfathering permanente. La opción de opt-in queda disponible después, sin cambios en el plan. |
| **OQ-6** | ¿`ai-support-monthly` entra al alcance? | ninguno | No. Sigue `isActive: false` con precio TBD por decisión previa. |

---

## 8. Verificación previa obligatoria antes del PR 8

Nada de esto se enciende sin:

1. Correr las queries de §4.1 contra **prod y staging**, y anotar los números en la issue de Linear.
2. El smoke de las secciones relevantes de
   `.qtm/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md` contra el sandbox
   de MP, incluyendo **una renovación real** (usar el plan diario oculto de QA, `TEST_DAILY_PLAN`,
   como referencia de cómo se fuerza el timing).
3. El smoke de producción (`prod-smoke-checklist.md`) — esto es billing CORE.
4. Etiquetas `status-needs-smoke-staging` y `status-needs-smoke-prod` en la issue, retiradas sólo con
   sign-off vía `/smoke HOS-847`.

**Recordatorio operativo**: `hops --target=staging health` smokea **producción** (el flag se
descarta); la forma correcta es `hops health staging`. Y ningún redeploy sin consultar primero.
