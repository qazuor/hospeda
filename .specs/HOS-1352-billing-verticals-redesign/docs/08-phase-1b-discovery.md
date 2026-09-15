---
title: FASE 1B — Discovery del sistema actual
linear: HOS-1352
statusSource: linear
created: 2026-09-15
status: CURRENT
phase: 1B
---

# FASE 1B — Discovery del sistema actual

**Ejecutado**: 2026-09-15, en tres frentes paralelos (motor de billing · entitlements y
limits · superficies, datos y tracking).

Todo lo que sigue es **lectura del sistema actual**, con `archivo:línea`. Acá no se propone
arquitectura (eso es FASE 2) **ni se clasifica nada como KEEP / ADAPT / REWRITE** — ese gate
está cerrado hasta definir el criterio (`DEC-METH-005`).

> Los números caducan. Medidos el 2026-09-15.

---

## 0. Los seis hallazgos que cambian el tamaño del problema

1. **El tracking es 15 veces más grande de lo que asumimos.** No son "~20 issues de billing":
   son **462** con label `area-billing` en el team `Hospeda`, de los cuales **308 están
   abiertos** (170 Backlog + 138 Started). FASE 3 tiene que dimensionarse contra ese número.
2. **Path C no fue abandonado.** El PDR §5.6 lo narra como superado, pero hoy es el camino de
   checkout real de **gastronomía, experiencia y partner** en producción.
3. **`commerce` no es un resto: es la columna vertebral de dos verticales.**
   `BaseCommerceListingService` es la clase de la que heredan Gastronomía y Experiencia, con
   **625 archivos** que nombran `commerce` en código activo.
4. **Son 8 motores de entitlements, no 7.**
5. **`PAST_DUE` es un estado fantasma**: tiene enum, middleware y documentación, y nadie lo
   escribe.
6. **25 de 41 tablas de billing en producción están vacías.** Abarata la migración
   (refuerza `DEC-MIG-001`), pero también significa que buena parte de esa infraestructura
   **nunca fue ejercitada**: su corrección es una suposición, no un hecho observado.

---

## 1. Checkout: no hay un motor, hay dos mecanismos y siete puertas

### 1.1 Dos mecanismos conviviendo detrás de un flag

`HOSPEDA_BILLING_OWN_PREAPPROVAL_ENABLED` decide **en runtime** cuál corre:

| Vertical | Mecanismo hoy en producción |
|---|---|
| Alojamiento | **Own-preapproval**: Hospeda lo crea por API (`apps/api/src/services/billing/paid-subscription-create.ts:30-113`) |
| Gastronomía · Experiencia | **Path C**: fila `pending_provider` sin `mp_subscription_id` + redirección al share link de MP (`subscription-checkout.service.ts:796-1050`) |
| Partner | **Path C**, iniciado por admin, sin sesión del pagador (`subscription-checkout.service.ts:1116+`) |

El docblock de `subscription-checkout.service.ts:756-768` lo dice con todas las letras:
*"HOS-191 fixed the two accommodation paths and left commerce and partner on the broken
hybrid; this is that same fix applied here."*

Path C sigue nombrado en rutas activas (`link-preapproval.ts`) y hasta en el nombre de un
índice de migración (`031-billing-subscriptions-mp-id-unique.index.sql`).

### 1.2 Siete puertas de entrada

`start-paid` · `commerce/start-subscription` (protected y admin) · `partners/send-link` ·
`trial/reactivate` · `plan-change` (`initiatePaidPlanUpgrade`) · `replace-payment-method` ·
`checkout-retry`. El issue **HOS-1289** ya lo tiene medido: *"cinco funciones con ~520 líneas
duplicadas"*.

### 1.3 `plan-change` no es genérico, y ya forzó una copia

`apps/api/src/routes/billing/plan-change.ts` elige la suscripción a modificar así:

```ts
subscriptions.find((sub) => sub.status === 'active' || sub.status === 'trialing')
```

**La primera suscripción viva, sin predicado de dominio.** Para un usuario multi-vertical eso
toma la que no es. Por eso existe una ruta paralela completa,
`apps/api/src/routes/commerce/protected/change-plan.ts`, cuya razón de ser está citada en su
propio código.

---

## 2. Estados: dos vocabularios, y uno fantasma

**Fuente de verdad**: `SubscriptionStatusEnum`
(`packages/schemas/src/enums/subscription-status.enum.ts:5-61`) — **10 valores**:
`active, trialing, past_due, paused, cancelled, expired, pending_provider, abandoned, comp,
courtesy`.

**Segunda constante, más angosta**: `SUBSCRIPTION_STATUSES`
(`packages/service-core/src/services/billing/subscription/subscription-status-constants.ts:18-24`)
declara **4 de 10**: `ACTIVE, TRIALING, CANCELLED, PAUSED`. Su propio comentario admite que le
faltan `PENDING_PROVIDER`, `ABANDONED`, `PAST_DUE` y `EXPIRED`.

Está **en uso activo en lógica de negocio**: los entitlements de destacado, de menú de
gastronomía y de direcciones de experiencia razonan sobre ese subconjunto, ignorando
`past_due`, `comp`, `courtesy` y `pending_provider` **por construcción de tipo**.

### `PAST_DUE` no existe end-to-end

Documentado por el propio equipo en `apps/api/src/cron/jobs/dunning.job.ts:36-58`: el único
código que escribe `past_due` (`enterGracePeriod`, llamado sólo desde `processRenewals()`)
**nunca se invoca en este codebase**, y el adaptador de MercadoPago sólo traduce
`pending/authorized/paused/cancelled`. Cita textual: *"disabling this cron's mutations did not
turn off live behavior, because the retry/cancel loop was already a structural no-op."*

Sin embargo existen `pastDueGraceMiddleware` y `docs/billing/grace-period-source-of-truth.md`
describiendo su comportamiento. **Es funcionalidad fantasma, no legacy.**

### Addons hablan otro idioma

`ADDON_PURCHASE_STATUSES` es una máquina separada de 4 valores y **otra ortografía**:
suscripciones usan `cancelled` (dos L), addons `canceled` (una). Está documentado como
decisión deliberada, no como error.

---

## 3. Entitlements: ocho motores independientes

Ninguno depende de otro; cada uno reimplementa la búsqueda `customer → subscription → plan`
con su propio fallback, su propio bypass de staff y su propia caché:

| # | Motor | Ubicación |
|---|---|---|
| 1 | `loadEntitlements` (viewer, caché 5 min) | `apps/api/src/middlewares/entitlement.ts:501-748` |
| 2 | `resolveOwnerEntitlementSet` (owner) | `apps/api/src/middlewares/owner-entitlement.ts:375-479` |
| 3 | `commerce-entitlement.ts` — se autodenomina *"a second loader"* | `apps/api/src/middlewares/commerce-entitlement.ts:4` |
| 4 | `resolveOwnerGastronomyPlanEntitlements` | `packages/service-core/src/services/gastronomy/gastronomy.menu-entitlement.ts:175-291` |
| 5 | `resolveOwnerGrantsExperienceDirections` | `packages/service-core/src/services/experience/experience.directions-entitlement.ts:73+` |
| 6 | `resolveOwnerPlanGrantsFeatured` | `packages/service-core/src/services/accommodation/featured-entitlement.resolver.ts:87-251` |
| 7 | `AddonEntitlementService` (escribe, no lee) | `apps/api/src/services/addon-entitlement.service.ts:70-260` |
| 8 | `resolveChatOwnerGrants` | `apps/api/src/services/ai-context/chat-owner-grants.ts:46+` |

Más dos middlewares de gating por vertical que duplican estructura sin resolver:
`accommodation-entitlements.ts` (566 líneas) y `tourist-entitlements.ts` (522).

### El catálogo vive en TypeScript, no en DB

`EntitlementKey` y `LimitKey` son **enums de código**
(`packages/billing/src/types/entitlement.types.ts`, `plan.types.ts:7-101`), y los planes
también (`plans.config.ts`). Se siembran hacia DB, pero la fuente es TS.

Y hay un tercer lugar: las tablas catálogo `billing_entitlements` (53 filas) y `billing_limits`
(20), que en teoría deberían ser la verdad y en la práctica se llenan desde el enum.

**Esto es exactamente `C-ARCH-01`**, ahora con evidencia: el §9 pide DB como fuente única y hoy
hay tres candidatos.

### Prueba directa de motores paralelos

`billing_customer_entitlements` y `billing_customer_limits` — las tablas **nativas de
QZPay-core** para esto — tienen **0 filas** y ningún modelo Drizzle en Hospeda
(`packages/db/src/billing/README.md:37-40`). Hospeda construyó su motor al lado del del
proveedor y nunca las usó.

### Hay un cuarto plano: qzpay es otro monorepo

Las tablas `billing_*` no están definidas acá: se re-exportan de `@qazuor/qzpay-drizzle`
(`packages/db/src/billing/schemas.ts:14`). El motor genérico vive en
`/home/qazuor/projects/PACKAGES/qzpay`. Ningún documento de 1A lo mencionaba como pieza
separada, y FASE 2 tiene que decidir explícitamente su relación con él.

---

## 4. Limits: no se recalculan, se congelan

`AddonEntitlementService.applyAddonEntitlements`
(`apps/api/src/services/addon-entitlement.service.ts:229-260`) calcula
`basePlanLimit + totalIncrement` **en código** y escribe el resultado absoluto con
`billing.limits.set()`.

No usa la acción nativa `increment` que QZPay ya soporta
(`qzpay/packages/core/src/types/addon.types.ts:48-52`).

**Consecuencia**: si el plan sube su límite base después de la compra del addon, el override
del cliente queda viejo. Contradice el "recalcular effective limit" del §37 — y roza
`DEC-ARCH-001`, porque un plan versionado necesita que los derivados se recalculen.

Además, en lectura los límites de cliente **sobrescriben** los de plan, no se suman
(`entitlement.ts:710-717`). Y el enforcement no tiene middleware único: `checkLimit`
(`apps/api/src/utils/limit-check.ts:173-219`) se cablea a mano en **19 call sites**.

El propio `commerce-entitlement.ts:20-30` documenta **cinco capas que interpretan "no sé" como
ilimitado** sin avisar.

---

## 5. Lo que no es simétrico entre verticales

| Capacidad | Estado |
|---|---|
| **Pausa** | **Sólo alojamiento.** `subscription-pause.service.ts:20,78-81` importa y actualiza la tabla `accommodations` directamente. No hay equivalente para las otras tres. HOS-1278 reporta que la web igual ofrece el botón a comercio |
| **Cancelación** | Genérica de verdad: opera por id + ownership, sin predicado de dominio. Gateada por `HOSPEDA_USER_CANCEL_ENABLED` (default `false`) |
| **Cambio de plan** | Ruta genérica rota para multi-vertical + ruta paralela de commerce (§1.3). Partner no tiene: el plan lo fija el admin |
| **Reembolso** | Existe, **admin-only**. No hay self-service — y `DEC-LEGAL-001` exige revocación a 10 días con devolución total |
| **Cortesía** | HOS-1160: `COMP` sólo funciona en alojamiento |
| **Entitlements de vertical** | Un archivo por vertical (`gastronomy.menu-entitlement.ts`, `experience.directions-entitlement.ts`), sin resolver genérico |

---

## 6. Verticales: dos ejes que no coinciden

1. **`ProductDomainEnum`** (`packages/schemas/src/enums/product-domain.enum.ts:36`) — 4 valores:
   `accommodation | gastronomy | experience | partner`. **No incluye `tourist`**.
2. **`PlanCategory`** (`packages/billing/src/types/plan.types.ts:106`) — 3 valores:
   `owner | complex | tourist`.

Son ejes distintos que no se corresponden 1:1. Los planes de Partner declaran
`category: 'owner'` con un comentario que admite el parche (`plans.config.ts:1210-1211`):
*"'owner' only satisfies the PlanCategory type; product_domain is the real discriminator"*.

Una de las dos representaciones **miente activamente** para encajar en el tipo. Es una causa
estructural plausible de los cruces de vertical que el §13 pide evitar.

`subscriptionMatchesDomain` es el único comparador de dominio, y es asimétrico a propósito:
`accommodation` falla abierto, todo lo demás falla cerrado.

---

## 7. `commerce`: 625 archivos, no una fila huérfana

El §55 pide que desaparezca. Lo que hay:

- **Un paquete de servicio entero y vigente**: `packages/service-core/src/services/commerce/`
  (`base-commerce-listing.service.ts`, `commerce-visibility.ts`, `commerce.junction-sync.ts`,
  `commerce.permissions.ts`, …), del que **`GastronomyService` y `ExperienceService`
  heredan**.
- Rutas activas (`apps/api/src/routes/commerce/*`), un middleware de entitlements dedicado,
  componentes web (`CommerceListingEditor.client.tsx`), un enum de schema
  (`commerce-entity-type.enum.ts`), y la constante `COMMERCE_TRIAL_DAYS`.
- Config viva y testeada: `packages/billing/src/config/commerce-entitlements.config.ts` y
  `commerce-limits.config.ts`, consumidas por el seeder y por 10+ data-migrations.
- **1 fila** en `billing_plans` con `product_domain='commerce'` en producción.
- `PartnerService` **no** hereda de ahí: son tres familias de implementación distintas.

**Tensión declarada**: hoy `commerce` es la abstracción que une gastronomía y experiencia. El
§55 pide borrarlo del código activo. Eso no es limpiar residuos: es rehacer la herencia de dos
verticales. FASE 2 tiene que decidirlo explícitamente.

---

## 8. Addons: el scope del PDR no existe

- El motor QZPay (`qzpay/packages/core/src/types/addon.types.ts:12-59`) define un addon como
  `entitlements[]` + `limits[]` + `compatiblePlanIds`. **No tiene ningún campo de scope** —
  nada equivalente a `LISTING | VERTICAL_SUBSCRIPTION | USER | GLOBAL` del §40.
- La aplicación en Hospeda trata cada addon como *"otorga un entitlement"* **o** *"afecta un
  limit"*: no puede hacer las dos cosas ni tocar más de una clave.
- La única instancia real de scope por ficha es `featured_listing_addon_grants`, una tabla
  **ad-hoc fuera de QZPay**, construida para un solo addon de una sola vertical.
- El modelo **Product vs Instance** del §39 tampoco existe: hay `billing_addon_purchases`
  (la instancia) y nada más.
- **HOS-847** (Urgent, In Progress): los addons recurrentes cobran una vez y no renuevan.

---

## 9. Webhooks, crons y la red que no atajaba

**Webhooks**: router único con handlers por evento, idempotencia sobre
`billing_webhook_events` (29 filas en producción), y clasificación de errores en `terminal` vs
`retryable` (`error-classification.ts`).

**El dead-letter queue estuvo vacío por diseño roto.** Cita del propio código
(`dead-letter.ts:1-24`): *"la tabla y el cron horario que la drena existen hace tiempo, pero
ningún código productivo insertaba una fila. El único writer era un test de integración que
ningún job de CI corre. El cron corrió cada hora contra una tabla permanentemente vacía y
reportó éxito — una red de recuperación que sólo existía en el papel."* Corregido en HOS-717.

**Crons**: 19 jobs relevantes a billing. Tres son **conversores load-bearing**, no backstops —
`trial-expiry`, `courtesy-expiry` y `preapproval-less-expiry` re-leen MP y reflejan su
veredicto; si se caen, el estado queda congelado para siempre.

**El dunning real está apagado desde 2026-07-18** por decisión del owner
(`DUNNING_MUTATIONS_ENABLED`), y al investigarlo se descubrió que el bucle de retry/cancel ya
era un no-op estructural. El mecanismo vivo es 100% pasivo: esperar que MP cancele y reaccionar
al webhook.

---

## 10. Superficies

### Web

- **Pricing**: hay página pública por cada una de las 5 verticales. La vista comparativa
  post-login existe **sólo** para anfitriones y turistas.
- **Mi Cuenta**: 25+ subsecciones. Alojamiento tiene tratamiento propio; gastronomía y
  experiencia comparten una ruta genérica `mi-cuenta/comercio/[vertical]`. El routing ya
  contradice el motor único del §7.
- **Mi Suscripción**: una sola página, y contra el §46 le falta casi todo. Issues abiertos:
  HOS-1237 (dice "2 suscripciones activas" sin decir de qué verticales), HOS-1093 ("Ver planes"
  de gastronomía manda al catálogo de alojamiento — **cruce de vertical en producción**,
  invariante 10), HOS-1321 (la web no sabe que existe una suscripción de turista).

### Admin

Hay más de lo esperado: cancelar, pausar, reanudar, cambiar plan, extender trial, **otorgar
cortesía**, reembolsar y resolver reconciliación tienen su diálogo y su ruta.

Dos faltantes reales: **pago manual/efectivo de partner** (HOS-1062, In Progress: *"el monto
vive en el plan y el efectivo no existe"*) y **Free Forever como grant propio** del §35 — no
hay evidencia de que exista separado de la cortesía temporal.

### Emails

**Hay una decisión escrita que contradice al PDR de frente.**
`apps/api/src/cron/jobs/trial-series-dispatch.ts:9-11`:

> *"The offsets are constants (`TRIAL_SERIES_SENDS`), not an admin setting. Each email's copy
> names its own distance, so an admin able to move the distance is an admin able to make the
> copy lie."*

No es deuda accidental: es un argumento deliberado para **no** sacar el schedule a DB, que es
justo lo que ordenan el §9 y el §42. Y los valores no coinciden con el PDR: pre-vencimiento
`[10,5,1]` (el PDR pide `10,5,2` + día del vencimiento), post `[1,5,10,30,60]` (el PDR pide
`15`, no `10`).

**El outbox no es un outbox.** `billing_notification_log` tiene `status`, `sentAt`,
`errorMessage` y `metadata`, pero **no** `attempts` / `retryCount` / `providerId` como pide el
§44. Es un log de intento único. 6 filas en producción.

Fallas activas de segmentación: HOS-1283 (*"un restaurante en prueba recibió nueve correos
escritos para un anfitrión"*) y HOS-676 (*"una sola compra disparó seis correos en el mismo
segundo"*).

---

## 11. Datos

**25 de 41 tablas tienen 0 filas.** Todo el bloque de pagos y facturas
(`billing_payments`, `billing_invoices`, `billing_invoice_lines`, `billing_invoice_payments`,
`billing_payment_methods`), refunds, orphans, dunning attempts, price changes, vendors y
payouts está vacío.

Distinción importante para no confundirse en FASE 5:

- **Vacías y sin consumidor** (candidatas a muertas): `billing_mp_addon_plans` — cero
  referencias fuera de migraciones, sin modelo Drizzle. `billing_customer_entitlements` y
  `billing_customer_limits` — nativas de QZPay, nunca usadas.
- **Vacías pero con consumidor real**: `billing_subscription_polling_jobs`, `billing_vendors`,
  `partner_subscriptions`. Están vacías porque nunca hubo pagos ni partners reales, no porque
  estén huérfanas.

**Migraciones**: 18 de 119 estructurales tocan billing; 17 de 41 extras. Hay dos archivos con
sufijo `.plan.sql` (`023-...ai-consumer-search-limits`, `024-...collections-limit`) viviendo en
`extras/` — candidatos a estar en el carril equivocado (configuración de planes en el carril de
objetos invisibles a Drizzle).

---

## 12. Tracking

### 462 issues, 308 abiertos

| Estado | Cantidad |
|---|---|
| Backlog | 170 |
| Started (In Progress + In Review) | 138 |
| Done | 136 |
| Canceled | 12 |
| Duplicate | 6 |
| **Total** | **462** |

Buckets grandes entre los abiertos: motores de entitlements duplicados (HOS-1291, HOS-1310,
HOS-1277, HOS-1303, HOS-702) · `commerce` vivo (HOS-1290, HOS-1305, HOS-695 **Canceled** — la
contracción que debía retirarlo **se abandonó**) · checkout duplicado (HOS-1289, HOS-1272,
HOS-1347) · pausa/cortesía sólo en alojamiento (HOS-1278, HOS-1160) · addons rotos (HOS-847
Urgent) · cambio de precio que no llega a MP (HOS-176).

### Tensión a resolver antes de FASE 2

**HOS-1012** está *In Progress* y se titula *"la prueba gratis vuelve a ser de Hospeda: trial
propio, **sin tarjeta**, con reloj propio"*. El PDR §5.6 asume que el modelo vigente es
card-first con preapproval creado por Hospeda. **Los dos no pueden ser ciertos a la vez.**
Hay que confirmar cuál describe el estado real.

### Specs con referencias rotas

`HOS-23`, `HOS-39` y `HOS-75` tienen `linear:` en su frontmatter que la API **no resuelve**.
`HOS-39` es citada como decisión de arquitectura activa ("Model C") en
`packages/billing/CLAUDE.md`. Antes de usar ese documento como fuente en FASE 2 hay que
confirmar qué pasó con el issue.

`HOS-54` figura **Canceled** en Linear mientras `.qtm/specs/SPEC-193-*/metadata.json` sigue
diciendo `"status": "draft"`.

### Documentación que miente

| Documento | Qué afirma | Realidad |
|---|---|---|
| `packages/billing/docs/guides/trial-system.md` | Trial arranca **"at Registration"**; grace "3-day + 7-day"; categorías "Owner/Complex" | `DEC-TRIAL-006` dice que arranca al quedar visible; `DEC-SUB-002` dice 10 días; el vocabulario es `commerce` residual |
| `packages/billing/CLAUDE.md` | "Trial: 14 days" | Un tercer número distinto, en el mismo paquete |
| `docs/billing/adding-an-entitlement.md` | Cómo propagar un grant | Ya marcado falso por su propio issue HOS-1151 |
| `packages/billing/CLAUDE.md` | "AFIP invoicing deferred to v2" | ARCA es el sucesor; `DEC-LEGAL-002` habla de comprobante no fiscal |

Tres fuentes del mismo paquete dan tres duraciones de trial distintas, y ninguna coincide con
las decisiones tomadas.

---

## 13. Nota de método

Uno de los tres frentes intentó abrir sub-agentes anidados y falló
(*"Fork is not available inside a forked worker"*): uno de sus tres sub-frentes devolvió sólo
un mensaje de estado, sin contenido. El informe se reconstruyó cruzando los dos que sí
entregaron.

**Para futuras delegaciones de discovery**: los forks no anidan. Hay que abrir todos los
frentes desde el mismo nivel.
