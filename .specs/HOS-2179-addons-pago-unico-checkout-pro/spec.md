---
title: Complementos de pago único por Checkout Pro de Mercado Pago
linear: HOS-2179
statusSource: linear
created: 2026-11-18
type: feature
areas:
  - billing
  - api
  - web
  - admin
  - db
smokeLabels:
  - status-needs-smoke-staging
  - status-needs-smoke-prod
---

# Complementos de pago único por Checkout Pro de Mercado Pago

> Fase 1 (sólo docs, sin implementación). Cada `path:line` se midió sobre `origin/staging` en
> `d0bff6cad5` (2026-11-18). Las decisiones del owner del 2026-11-18 están en los comentarios de
> HOS-2179 en Linear y se resumen en §1. Lo que este documento dice del proveedor que **no** está
> en la matriz (`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md`) es
> **documentado, no medido**, y la Fase 0 (§9) lo mide antes de escribir código.

## 1. Resumen

Hoy los complementos de pago único (`UNA_VEZ`) se cobran por `/v1/orders` con un token de tarjeta
que la web no genera, así que **nadie puede comprarlos desde la web**. Los seis destacados del
catálogo de producción son `UNA_VEZ` (HOS-1883 §2: 4 recurrentes y 6 de pago único). Esta spec
mueve ese cobro a **Checkout Pro**: creamos una página de pago en Mercado Pago, mandamos a la
persona ahí y confirmamos el pago leyéndolo por id.

Decidido por el owner (2026-11-18):

- D-1. Los `UNA_VEZ` se pagan por **Checkout Pro**: preferencia + redirección. **Hospeda nunca pide
  ni toca datos de tarjeta.**
- D-2. El camino `/v1/orders` + token **se retira entero**: la ruta de compra con `payment`, el
  envío de la orden, confirmar/rechazar la orden, la devolución de la orden y el cobro por orden
  del adaptador.
- D-3. **Se excluyen los medios en efectivo** (Rapipago, Pago Fácil y todo ticket o cajero que
  queda pendiente días). Sólo medios instantáneos: **tarjeta y dinero en cuenta de Mercado Pago**.
- D-4. **La tienda web vende los `UNA_VEZ`.** Es el alcance original de HOS-2179.
- D-5. Sale a producción **junto con el resto de HOS-1352**, en la próxima promoción.
- D-6. Los complementos recurrentes (un preapproval aparte cada uno, `DEC-ADDON-002`) **no cambian**.

## 2. Hallazgos que cambian el plan

1. **La lectura de un pago de Checkout Pro ya existe.** `readMercadoPagoCharge` lee
   `/v1/payments/{id}` y devuelve `reference` = `external_reference` y `authorizationId: null` cuando
   el pago no cuelga de un preapproval
   (`packages/payments/src/adapters/mercadopago/mercadopago-charge-read.ts:74`, `:115`). La búsqueda
   por referencia también existe (`mercadopago-payment-search.ts:29`). No hace falta una lectura
   nueva del pago: hace falta **exponer** la búsqueda en la interfaz.
2. **La devolución de un pago también existe.** `refund` manda `POST /v1/payments/{id}/refunds` con
   `X-Idempotency-Key` (`mercadopago-mutations.ts:61`), medido en producción (`RF-1`, `RF-2`, `RF-4`,
   `RF-6`). Al retirar la orden, la devolución de un `UNA_VEZ` deja de ser un caso aparte
   (`execute-refund.service.ts:111` la desvía hoy a `executeOrderRefund`).
3. **El aviso `payment` ya se decodifica**, pero muere sin efecto: `decodeNotice` lo traduce a
   `charge` (`mercadopago-notice.ts:19-24`, `:32`), `recordChargeFact` devuelve `NO_SUBSCRIPTION` con
   `authorizationId: null` (`record-charge-fact.service.ts:135-136`) y el receptor contesta
   `UNKNOWN_RESOURCE` (`process-provider-notice.service.ts:235-251`). El ruteo hacia la instancia del
   complemento es nuevo.
4. **Crear una preferencia no mueve plata.** Es la diferencia de fondo con `/v1/orders`, que cobra al
   crearse (`EX-30`). Una respuesta perdida en la creación deja una página que **nadie tiene**: el
   enlace sólo le llega a la persona por nuestra respuesta. Por eso la recuperación de una creación
   perdida puede ser crear otra (§5.6), cosa que con la orden era un doble cobro.
5. **Una preferencia se puede pagar más de una vez** hasta que vence (documentado, no medido;
   §9, `EX-67`). Una tarjeta rechazada **no cierra la compra**: la persona reintenta en la misma
   página. `A7` (`addon-instance-a7.ts:12`), que cerraba la compra con el `402` de la orden, pierde su
   evento y se retira (§6.4).
6. **El sandbox no deja reembolsar.** `RF-1` midió `401` en `/v1/payments/{id}/refunds` con el
   vendedor de prueba, cualquiera sea la app y sus scopes; la matriz lo repite en su tabla de límites
   (`06-mp-validation-matrix.md:303-305`, `:536`). El reembolso de un pago de Checkout Pro **sólo se
   mide en producción** o con habilitación de soporte de MP (§9, `EX-69`).
7. **`EX-42` (vencer una preferencia por API) sigue `UNKNOWN`** (`06-mp-validation-matrix.md:401`).
   Este diseño lo necesita para cerrar la página después del primer pago aprobado, así que vuelve a
   la Fase 0.
8. **`HOS-2094` parece ser esta misma spec.** HOS-2290 la describe como «medir Checkout Pro como
   redirect y habilitar la compra» (`.specs/HOS-2290-…/spec.md:160`), y HOS-2284, HOS-2285 a
   HOS-2289 y HOS-2290 la citan como el bloqueo de la venta web. Ver P-9.

## 3. Alcance y fuera de alcance

Dentro:

- Compra `UNA_VEZ` por Checkout Pro (creación, redirección, espera, confirmación, vencimiento,
  idempotencia, pago tardío, segundo pago, devolución, conciliación).
- Cambios en `@repo/payments` (interfaz, adaptador, fake, fake HTTP server, listas del fake).
- Retiro del camino orden + token, con su guard.
- Tienda web de complementos, vistas admin afectadas, i18n (es/en/pt).
- Plan de medición en sandbox (Fase 0) antes de implementar.

Fuera:

- Los complementos recurrentes (D-6).
- El `paymentToken` del alta directa de suscripciones (`start-subscription.service.ts:95`,
  `payment-provider.ts:60`). No es de este camino; ver R-5.
- La batería de vigilancia del proveedor (`packages/payments/src/battery/**`), que cambia en
  HOS-1512. Esta spec **sólo pide** que la batería sume después una medición de crear, leer y vencer
  una preferencia. No se especifica ninguna edición de esos archivos.
- La analítica de complementos (HOS-1883). Sus puntos de emisión se mueven (§11).

## 4. Estado actual del código

| Pieza | Dónde | Qué hace hoy |
|---|---|---|
| Ruta de compra | `apps/api/src/routes/billing-addon/purchase.ts:48-56`, `:124-144` | exige `payment` (token, marca, tipo) para `UNA_VEZ`; manda la orden, la confirma o la rechaza en el mismo pedido |
| A1 | `packages/service-core/src/services/billing/addon/purchase-addon.service.ts:196-202` | inserta la instancia `PENDING_AUTHORIZATION` y la clave `order:<orderRequestId>` (`ORDER_CREATE`) |
| Envío de la orden | `send-one-time-order.service.ts:69-77` | `chargeOnce` con el token; guarda `providerOrderId` |
| A2 único | `addon-instance-a2-one-time.ts:26` (`confirmOneTimeOrder`) | relee la orden, inserta el `payment` colgado de la instancia y lo acredita |
| A7 | `addon-instance-a7.ts:12` (`rejectOneTimeOrder`) | orden `failed` → `ABANDONED` |
| A3 único | `expire-addon-authorization-windows-one-time.ts:65`; ventana en `expire-addon-authorization-windows.service.ts:131` | a las `deadlines['10'].cardHours` relee la orden por id o abandona |
| Conciliación | `reconciliation/sweep/paid-orders-check.ts:14`, `:65` | instancia `ABANDONED` con orden pagada → marca 23 `ORDEN_PAGADA_SIN_INSTANCIA` |
| Devolución | `refund/execute-refund-order.ts`, `refund-order-call.ts`, `refund-order-reread.ts`, `send-held-order-refund.service.ts`, `confirm-refund.service.ts:143-232` | devolución de la orden, serializada por orden |
| Interfaz | `packages/payments/src/provider/payment-provider.ts:83-98`, `:129-151`, `:256-302`, `:335`, `:347`, `:372`, `:378` | `chargeOnce`, `refundOrder`, `readOrder`, `searchOrders` y sus tipos |
| Adaptador | `mercadopago-order-charge.ts`, `mercadopago-orders.ts`, `mercadopago-order-refund.ts` | `/v1/orders`, `/v1/orders/{id}`, `/v1/orders/{id}/refund` |
| Fake | `fake/fake-order-charge.ts`, `fake-orders.ts`, `fake-order-refund.ts`; `fake-server/orders-route.ts`; reglas `RP13`–`RP16` | órdenes en memoria y su servidor HTTP |
| Esquema API | `packages/schemas/src/api/billing/addon-purchase.schema.ts:4-17`, `:25-38` | `payment` opcional en el pedido; resultados de orden en la respuesta |
| Web | `apps/web/src/lib/billing/addon-purchase.ts:10-15` | `purchasableOffers` esconde los `UNA_VEZ`; `purchaseStateFrom` ya conoce `REDIRECT` y `checkoutUrl` |
| Retorno | `apps/api/src/routes/billing-addon/purchase-return-url.ts:6-14`; `purchase-read.ts` | vuelve a `/mi-cuenta/complementos/?compra=<id>` y la pantalla relee la compra |
| Modelo | `packages/db/src/schemas/vertical/addon-product.dbschema.ts:120-122` | `order_request_id` y `provider_order_id`, únicos |

Lo que se reutiliza sin cambio: la identidad de la compra `(dueño, producto, objetivo)`
(`uq_addon_instance_purchase_identity`), el `orderRequestId` acuñado por la pantalla, el `payment`
colgado de la instancia, `creditPayment`, la redirección y la relectura del retorno que ya usa el
recurrente, y el freno operativo `addonPurchasesFreeze` (`purchase-addon.service.ts:181-183`).

## 5. El flujo

### 5.1 Compra (A1)

1. La pantalla acuña `orderRequestId` (como hoy) y manda el pedido **sin datos de pago**.
2. A1 corre como hoy (elegibilidad, identidad, instancia `PENDING_AUTHORIZATION`) y persiste, en la
   misma transacción, la clave `page:<orderRequestId>` con una operación nueva `PAYMENT_PAGE_CREATE`.
   La clave se persiste **antes** de la llamada (`DEC-CONC-001`, implicación 2).
3. Después del commit, la ruta pide la página al proveedor con:
   - `external_reference` = `orderRequestId` (la misma referencia que ya usa el barrido, `EX-57`);
   - un único ítem con el precio del producto, en centavos convertidos a la unidad del proveedor
     sólo en el adaptador;
   - `payment_methods.excluded_payment_types` con **todo tipo que no sea tarjeta ni dinero en cuenta**
     (la lista exacta sale de `EX-62`; candidatos: `ticket`, `atm`, `bank_transfer`,
     `digital_currency`; P-5);
   - `expires: true`, `expiration_date_from` = ahora, `expiration_date_to` = ahora + duración de la
     página (P-2);
   - `back_urls` (approved, pending, failure) apuntando al retorno de hoy, y `auto_return: approved`;
   - `binary_mode` según P-6;
   - `X-Idempotency-Key` = la clave persistida (que el endpoint lo respete es `EX-61`).
4. Se guarda el id de la página y su vencimiento en la instancia (§7.1) y el enlace en el resultado
   de la clave, igual que el `checkoutUrl` del recurrente (`purchase-addon.service.ts:44-63`).
5. La respuesta trae `checkoutUrl`, el enlace saneado por `sanitizeApprovalUrl` (G10). La pantalla
   redirige con `window.location.assign`, como ya hace con el recurrente.

### 5.2 Espera

- La instancia queda `PENDING_AUTHORIZATION` («esperando el pago») hasta el primero de: un pago
  aprobado leído por id (A2), el vencimiento de su ventana (A3) o una orfandad (A5/A6, sin cambios).
- La ventana del `UNA_VEZ` deja de ser `deadlines['10'].cardHours` (72 h, pensada para la orden) y
  pasa a ser **la duración de la página más un margen**, los dos valores del catálogo de plazos
  (`billing-deadlines.schema.ts:9`), nunca constantes en código (P-2).
- Mientras espera, la identidad de la compra sigue ocupada: otra pantalla ve «tu compra se está
  procesando» y el enlace para volver a la página mientras no venza (`PENDING_ELSEWHERE`, como hoy).

### 5.3 Confirmación (A2 único)

Un pago se confirma **sólo** releyéndolo por id (`readCharge`, `ProviderRead`, `assertFreshForAct`,
G17). Nunca con el `back_url`: los parámetros del retorno (`payment_id`, `status`,
`external_reference`) los escribe el navegador y se ignoran. Hay tres caminos al mismo A2, todos
idempotentes por `payment.provider_fact_id`:

1. **El aviso `payment`**: `decodeNotice` → `charge` → `readCharge`. Si `authorizationId` es nulo y
   `reference` coincide con el `orderRequestId` de una instancia `UNA_VEZ`, se rutea al A2 único en
   lugar de terminar en `UNKNOWN_RESOURCE`.
2. **El retorno**: la pantalla relee la compra (`GET /purchases/{orderRequestId}`); si sigue
   pendiente, la API busca por referencia y relee por id antes de contestar. El retorno sólo dispara
   la lectura; no aporta estado.
3. **A3** (§5.4) antes de abandonar.

A2 exige: estado `approved`, `reference` igual al `orderRequestId`, importe y moneda iguales al
precio de la versión anclada. Si el importe no coincide, no activa y abre `DIVERGENCIA_DE_MONTO`.
Activa la instancia (`startsAt`, `endsAt` según `DÍAS_FIJOS`), inserta el `payment` colgado de la
instancia y lo acredita, como `confirmOneTimeOrder` hoy (`addon-instance-a2-one-time.ts:69-170`).
Después del commit **cierra la página** (§5.7) para que no se pueda pagar dos veces.

El aviso `merchant_order` (IPN, y quizás Webhooks: `EX-63`) no se procesa: el pago trae todo lo que
A2 necesita. Si `EX-63` mide que el aviso `payment` no llega para Checkout Pro, este punto vuelve a
abrirse antes de implementar.

### 5.4 Abandono o vencimiento (A3 único)

Al vencer la ventana, A3 **sólo confirma, nunca crea** (como hoy): busca pagos por referencia
(`searchCharges`, que no es `ProviderRead`) y relee cada id. Con un pago aprobado corre A2. Si no
hay ninguno, la instancia pasa a `ABANDONED` y se cierra la página. Si la búsqueda o la relectura no
responden, A3 no ocurre en esa corrida.

Un pago rechazado en la página **no** cierra la compra: la persona puede reintentar ahí mismo con
otro medio. Por eso A7 se retira (§6.4).

### 5.5 Doble clic e idempotencia

- Mismo `orderRequestId`: A1 devuelve `EXISTING` y la ruta contesta el enlace guardado. No se crea
  otra página.
- Otra pantalla, mismo `(dueño, producto, objetivo)` pendiente: `PENDING_ELSEWHERE` (sin cambios).
- Recompra legítima después de `ACTIVE`, `ABANDONED` o `EXPIRED`: otro pedido, otra instancia, otra
  página.

### 5.6 Respuesta perdida al crear la página

La clave existe y la instancia no tiene id de página. El segundo pedido del mismo `orderRequestId`:

1. Si `EX-61` mide que `X-Idempotency-Key` se respeta en `/checkout/preferences`, reenvía con la
   misma clave y el mismo cuerpo y recibe la misma página.
2. Si no se respeta, **crea otra**. Es seguro por el hallazgo 4: la página perdida no la tiene
   nadie. Las dos llevan la misma referencia, así que un pago en cualquiera se encuentra igual.

Si nadie vuelve, A3 abandona la instancia sin id de página; el barrido sigue viendo cualquier pago
por referencia (§5.10).

### 5.7 Cerrar la página

Después del primer pago aprobado y al abandonar, se vence la página (`expiration_date_to` = ahora)
y se confirma releyéndola (INV:D5: aceptado no es aplicado). Depende de `EX-66` (que es `EX-42`
reformulada). Si el proveedor no vence la página o la vencida se sigue pagando, cerrar no protege
nada y el diseño se apoya sólo en §5.8 y en una duración corta de la página.

### 5.8 Segundo pago sobre la misma página

Si llega un segundo pago aprobado con la misma referencia sobre una instancia ya `ACTIVE`, A2 no
corre otra vez. Se abre `COBRO_DUPLICADO` sobre la instancia con propuesta de devolver, y la
devolución la confirma una persona (`DEC-CONC-001`, parte 3). P-4.

### 5.9 Pago que llega después del vencimiento

Un pago aprobado sobre una instancia `ABANDONED` (la persona pagó en el último minuto y el aviso
llegó tarde, o un pago quedó en revisión): lo ven el aviso y el barrido. Abre la marca 23
(`ORDEN_PAGADA_SIN_INSTANCIA`, se conserva el valor guardado y se cambia la etiqueta a «pago único
cobrado sin complemento activo»). Qué se hace con esa plata es P-3. Por construcción la población es
casi cero: la ventana termina después que la página.

### 5.10 Conciliación

El chequeo de órdenes pagadas (`paid-orders-check.ts`) se reescribe sobre pagos:

- **pagado sin instancia viva**: toda instancia `UNA_VEZ` `ABANDONED` dentro de la ventana del
  barrido (PLAZO:18) cuyo `searchCharges` por referencia trae un id que, releído, está `approved`
  → marca 23;
- **instancia esperando sin pago**: toda instancia `PENDING_AUTHORIZATION` con la ventana vencida
  que A3 no cerró (A3 caído o diferido) → la cierra A3 en la corrida siguiente; si sigue abierta
  pasada una segunda ventana, se registra como falla del barrido (no se inventa una marca nueva);
- **pago duplicado**: dos pagos `approved` con la misma referencia → `COBRO_DUPLICADO`.

La búsqueda nunca decide (INV:D6): sólo entrega ids que se releen por id.

### 5.11 Devolución

Una devolución de `UNA_VEZ` va por la capacidad `refund` existente
(`POST /v1/payments/{id}/refunds`, `X-Idempotency-Key` = la referencia de la fila de devolución) y
se confirma releyendo el pago (`readCharge().refunds`), igual que la devolución de un pago de
suscripción. La acción administrativa 14 y la confirmación humana de las marcas no cambian. Las
piezas de devolución de orden se retiran (§6.2). Lo que no está medido es la devolución de un pago
de Checkout Pro en sí (R-1, `EX-69`).

## 6. Retiro del camino orden + token

### 6.1 Qué se borra

| Capa | Se borra |
|---|---|
| `@repo/payments` interfaz | `chargeOnce`, `refundOrder`, `readOrder`, `searchOrders`; `OneTimeChargeInput`, `OneTimeChargeResult`, `OrderRef`, `OrderSnapshot`, `OrderSearchInput`, `OrderSummary`, `OrderSearchResult`, `OrderRefund`, `OrderRefundScope`, `OrderRefundInput`, `OrderRefundResult` |
| adaptador | `mercadopago-order-charge.ts`, `mercadopago-orders.ts`, `mercadopago-order-refund.ts` y su cableado |
| fake | `fake-order-charge.ts`, `fake-orders.ts`, `fake-order-refund.ts`, el handle `placeOrder`, `fake-server/orders-route.ts`; reglas `RP13`, `RP14`, `RP15`, `RP16` (se retiran de `fake-lists.json` con su razón, G15) |
| service-core | `send-one-time-order.service.ts`, `send-one-time-order-types.ts`, `addon-instance-a7.ts`, la rama de orden de `addon-instance-a2-one-time.ts` y de `expire-addon-authorization-windows-one-time.ts`, `execute-refund-order.ts`, `refund-order-call.ts`, `refund-order-reread.ts`, `send-held-order-refund.service.ts`, la rama de orden de `confirm-refund.service.ts` y `execute-refund.service.ts:111-121`, `paid-orders-check.ts` (reemplazado) |
| API | `payment` del pedido y los resultados de orden de la respuesta; la rama de orden de `purchase.ts` |
| tests | los de orden en `packages/payments/test`, `packages/service-core/test/integration/services` (`one-time-order-send`, `addon-a7-declined`, `refund-order-*`, `reconciliation-paid-orders`), `apps/api/test/integration/billing-addon/purchase-declined.test.ts`, y los e2e que pagan con orden (`billing-33-addon-no-double-charge`, `featured-01-listing-boost`, `featured-04-venue-experience-order`), que se reescriben sobre la página |
| guard | `apps/api/test/cron/one-time-charge-no-clock.guard.test.ts` se reescribe: ya no hay `chargeOnce`; lo que afirma pasa a ser «ningún cron ni servicio llama a `charge`» |

Las columnas `provider_order_id` y el índice que serializa las devoluciones de una orden **no se
borran en esta spec**: borrar una columna va en una release posterior a dejar de leerla
(`check-drop-column-release-gap.sh`). Queda un issue de seguimiento (§14).

### 6.2 Qué asegura que nada toque datos de tarjeta

1. **El esquema lo rechaza.** `AddonPurchaseRequestSchema` es `strictObject` y pierde `payment`: un
   pedido con `payment`, `token` o cualquier campo de tarjeta contesta `400`. Test de esquema.
2. **La interfaz no lo admite.** El pedido de página no tiene campo de token, y
   `PROVIDER_CONCEPT_TERMS` ya prohíbe `card_token` (`provider-concepts.ts:81-82`). Se suman
   `preference`, `merchant_order`, `excluded_payment`, `expiration_date` y `date_of_expiration`, para
   que la interfaz nombre todo en términos de dominio.
3. **Guard estático nuevo** (`scripts/check-one-time-addon-no-card-data.ts`, en el job `Guards` de
   CI **y** en `pnpm check:guards`): falla si aparece `/v1/orders` en `packages/payments/src`, si
   aparece `card_token`, `cardToken`, `paymentToken` o `sdk.mercadopago.com` en
   `apps/web/src`, `apps/admin/src`, `apps/api/src/routes/billing-addon/**` o
   `packages/service-core/src/services/billing/addon/**`. Su cabecera declara lo que no ve: el alta
   directa de suscripciones (fuera de alcance, R-5) y cualquier otro nombre de campo.
4. **CSP**: sin cambio. La redirección a una página del proveedor no carga scripts suyos (HOS-30
   ya lo verificó para el checkout de suscripciones).

### 6.3 A7 se retira

Su evento («la orden vuelve rechazada») no existe con Checkout Pro. La tabla de `B/03` §8 y
`scripts/guards/transition-tables.json` pierden la fila; A3 sigue siendo la salida de una compra
sin pago. El PR que retira (T-7) actualiza también `03-maquinas-de-estado.md` §8 y `16-addons.md`
§1.4 con la referencia a esta spec.

## 7. Contratos

### 7.1 Datos (carril estructural, aditivo)

- `addon_instance.payment_page_id varchar(64)` nulo, único, y `addon_instance.payment_page_expires_at
  timestamptz` nulo. Nombres de dominio, no del proveedor. Alternativa descartada: reusar
  `provider_order_id` (cambia el significado de una columna con datos de staging).
- `idempotency_keys.operation` suma `PAYMENT_PAGE_CREATE` (si hay CHECK, migración).
- Catálogo de plazos: duración de la página y margen de la ventana del `UNA_VEZ` (claves nuevas del
  esquema de plazos y data-migration con dual-write si el catálogo vive en el seed). Valores: P-2.
- Marcas: ninguna razón nueva. Se reusan 23 y `COBRO_DUPLICADO`; cambia la etiqueta de 23.

### 7.2 `PaymentProvider`

La interfaz sigue con **ocho capacidades**. Los nombres no pueden llevar `checkout` (término
prohibido, `provider-concepts.ts:38`). Propuesta (P-7 decide la forma):

| Capacidad | Método | Entrada → salida |
|---|---|---|
| 2 · charge | `requestOneTimePayment` (reemplaza `chargeOnce`) | `{ reference, idempotencyKey, amount, reason, returnUrl, expiresAt }` → `{ paymentPageId, approvalUrl, expiresAt }`. Sin token. El adaptador excluye siempre los medios no instantáneos: no es un parámetro, así que no se puede pedir efectivo |
| 5 · cancel | `closeOneTimePayment` | `{ paymentPageId }` → `MutationAcknowledgement`; se confirma releyendo |
| 7 · read | `readOneTimePayment` | `{ paymentPageId }` → `ProviderRead<{ paymentPageId, reference, expiresAt, createdAt }>` |
| 7 · read | `searchCharges` | `{ reference, createdFrom, createdTo }` → `{ chargeIds }`; no es `ProviderRead` (INV:D6). Expone `mercadopago-payment-search.ts`, que hoy sólo usa el adaptador |
| 6 · refund | `refund` (existente) | sin cambio |
| 8 · notify | `decodeNotice` (existente) | sin cambio, salvo lo que mida `EX-63` |

`approvalUrl` se llama así a propósito: G10 obliga a pasarlo por `sanitizeApprovalUrl` fuera del
paquete. `capabilitySupport` declara las brechas medidas en la Fase 0. `CAPABILITY_METHODS`
(`capability-methods.ts:13-28`) se actualiza y su prueba de compilación lo exige.

### 7.3 Fake y fake HTTP server

- El fake suma la página: crearla, leerla, vencerla, y un handle de test `payOnPage({ paymentPageId,
  outcome: 'approved' | 'rejected' })` que crea un pago con la referencia de la página y encola el
  aviso `payment`. Una página vencida rechaza el pago si `EX-66` lo mide así.
- Las reglas y mentiras nuevas salen **sólo** de la Fase 0 (DEC-TEST-003): candidatas «una página se
  paga más de una vez» (`EX-67`) y «el aviso llega tarde o no llega» (ya es `M6`).
- El servidor HTTP suma `POST /checkout/preferences`, `GET` y `PUT /checkout/preferences/{id}`, y
  una página falsa `GET /fake-checkout/{id}` con dos botones (aprobar, rechazar) que redirige al
  `back_url`. Esa página es lo que permite un e2e de Playwright sin el sandbox real.
- `payments-search-route.ts` ya sirve `/v1/payments/search`; se verifica que encuentre los pagos de
  página.

### 7.4 Contrato billing-verticales y guards de frontera

`@repo/billing-verticals-contract` no cambia: `políticaDeAddon` ya da el cobro y la vigencia. G14,
G16 y G12 no cambian. G17 aplica a las tres entradas de A2. G15 cubre las listas del fake. G10 cubre
el enlace nuevo. G7 prohíbe precios en código: el precio sale del producto.

### 7.5 API

- `AddonPurchaseRequestSchema`: sin `payment`. `payerEmail` queda sólo para el recurrente (P-8).
- `AddonPurchaseResponseSchema`: sin `order`; el `UNA_VEZ` contesta como el recurrente
  (`checkoutUrl`, `processing`).
- `AddonPurchaseReadResponseSchema`: sin cambio de forma; la lectura relee el proveedor si la
  instancia está pendiente (§5.3, camino 2).
- `apps/api/docs/error-contract.md` y `route-manifest.json`: se actualizan los códigos de la ruta.

## 8. Superficies

### 8.1 Web (tienda de complementos)

- `purchasableOffers` deja pasar los `UNA_VEZ` (`addon-purchase.ts:10-15`).
- El resumen muestra precio, duración («7 días», `days_*`) y que se paga en Mercado Pago con tarjeta
  o dinero en cuenta.
- `hiddenListingNoticeKind` suma un aviso para `UNA_VEZ` sobre ficha no publicada: «el destaque
  corre igual aunque la ficha no se vea» (HOS-2290 AC-5, `DEC-ADDON-001`).
- Confirmar → `REDIRECT` → Mercado Pago → retorno a `/mi-cuenta/complementos/?compra=<id>` → la
  pantalla relee hasta `ACTIVE`, `CLOSED` o un tope; qué se muestra mientras tanto es P-1.
- Estilos con CSS Modules; textos por `@repo/i18n`. Ninguna página de `src/pages` lee sesión (el
  guard de páginas ciegas a la sesión sigue igual: todo esto vive en la isla).

### 8.2 Admin

- Etiqueta de la marca 23 y de `COBRO_DUPLICADO` sobre una instancia `UNA_VEZ`
  (`apps/admin/src/features/billing-reconciliation/reconciliation-labels.ts`).
- La confirmación de devoluciones pierde los resultados de orden (`ORDER_REFUND_HELD`,
  `ORDER_NOT_REFUNDABLE_KEPT_CONFIRMED`, en `packages/schemas/src/api/billing/refund-confirmation.schema.ts`
  y `apps/api/docs/error-contract.md`; ninguna pantalla admin los nombra hoy) y trata la devolución
  de un `UNA_VEZ` como la de cualquier pago.
- Donde se muestre una instancia, el id de la página y el del pago en lugar del de la orden.

### 8.3 i18n (es/en/pt)

`packages/i18n/src/locales/*/billing.json` → `billing.addonPurchase`: `oneTimeSummary`,
`payWithMercadoPago`, `instantMethodsOnly`, `waitingPayment`, `waitingPaymentLong`,
`paymentNotConfirmed`, `hiddenListingOneTime`, `pageExpired`. `admin-billing.json`: la etiqueta
nueva de la marca 23. `readAddonPurchaseCopy` pierde `oneTimePaymentRequired`. El guard de
cobertura de claves exige las tres lenguas.

## 9. Fase 0: medición en sandbox, antes de implementar

Reglas:

- Los agentes usan **sólo credenciales de sandbox**. Nunca de producción.
- Los pasos **[HUMANO]** necesitan a alguien pagando en la página de sandbox de Mercado Pago con el
  comprador de prueba. Los hace el owner o, si resulta viable, el trabajo de Playwright de HOS-2364.
- Cada medición entra a la matriz como fila nueva (propuestas `EX-61` a `EX-72`, la última es
  `EX-60`) con fecha, entorno, sonda y resultado, y su sonda queda en `mp-probes/`.
- Un resultado que contradiga §5 vuelve al owner antes de implementar.

| Id | Qué medir | Endpoints | Quién |
|---|---|---|---|
| `EX-61` | Crear y leer una preferencia con el cuerpo de §5.1. ¿Respeta `X-Idempotency-Key` (misma clave y mismo cuerpo → mismo id; otro cuerpo → ¿409?)? ¿La búsqueda por `external_reference` la encuentra? ¿El aviso del pago llega con la configuración de Webhooks de la app sin `notification_url`? | `POST /checkout/preferences`, `GET /checkout/preferences/{id}`, `GET /checkout/preferences/search?external_reference=` | agente |
| `EX-62` | Qué tipos de pago existen en AR y cuáles hay que excluir para dejar sólo tarjeta y dinero en cuenta; **y que la página efectivamente los esconda** | `GET /v1/payment_methods` (agente); abrir `init_point` y mirar qué ofrece (**[HUMANO]**) | agente + **[HUMANO]** |
| `EX-63` | Forma de los avisos de un pago de Checkout Pro: cuántas entregas, por qué canal (Webhooks `type=payment`, IPN `topic=payment`, `topic=merchant_order`, ¿Webhooks `merchant_order`?), qué `data.id`, con qué demora | receptor de staging; `GET /merchant_orders/{id}` para leer lo que llegue | **[HUMANO]** paga con `APRO`; agente lee los logs |
| `EX-64` | El pago leído por id: `external_reference` igual al de la preferencia, `order.id`, `payment_type_id`, `status_detail`, importe; y que `GET /v1/payments/search?external_reference=` lo encuentre | `GET /v1/payments/{id}`, `GET /v1/payments/search` | agente, sobre el pago de `EX-63` |
| `EX-65` | Pago rechazado (`OTHE`) y reintento aprobado (`APRO`) en la misma página: dos pagos, uno `rejected` y uno `approved`, misma referencia | `GET /v1/payments/search` | **[HUMANO]** |
| `EX-66` | Vencimiento: una preferencia con `expiration_date_to` a 5 min ¿rechaza pagar pasado ese momento? Un `PUT expiration_date_to = ahora` ¿entra, la relectura lo devuelve y la página deja de cobrar? ¿Qué hace `date_of_expiration` con efectivo excluido? (reformula `EX-42`) | `PUT /checkout/preferences/{id}`, `GET /checkout/preferences/{id}` | agente crea y vence; **[HUMANO]** intenta pagar |
| `EX-67` | Segundo pago aprobado sobre la misma preferencia (dos pestañas, o volver atrás): ¿lo acepta? | `GET /v1/payments/search` | **[HUMANO]** |
| `EX-68` | Parámetros del `back_url` en aprobado, rechazado y pendiente; comportamiento de `auto_return` | — | **[HUMANO]** anota la URL de retorno |
| `EX-69` | Devolución de un pago de Checkout Pro y su relectura. En sandbox se espera `401` (`RF-1`). Si da `401`: o soporte de MP lo habilita, o **el owner** corre la sonda en producción con un pago propio del monto mínimo (ARS 15) y su devolución total. Requiere OK explícito del owner: es plata real | `POST /v1/payments/{id}/refunds`, `GET /v1/payments/{id}` | agente (sandbox); **owner** (producción) |
| `EX-70` | Pago con dinero en cuenta del comprador de prueba: aprobación instantánea y `payment_type_id: account_money` | `GET /v1/payments/{id}` | **[HUMANO]** |
| `EX-71` | Estados pendientes: con `binary_mode` en falso y en verdadero, la tarjeta `CONT` ¿queda `in_process`? | `GET /v1/payments/{id}` | **[HUMANO]** |
| `EX-72` | Credenciales y cuentas: con qué credencial del vendedor de prueba la página de sandbox funciona (la matriz vio `401 "Unauthorized use of live credentials"`, `:536`), comprador de prueba logueado o invitado, y las tarjetas de prueba vigentes (`APRO`, `OTHE`, `CONT`) | panel de cuentas de prueba | **[HUMANO]** owner |

Además, de sólo lectura y por un agente:

- `M-DB-1`: en producción y en staging, cuántas instancias `UNA_VEZ` tienen `provider_order_id` y
  cuántas claves `ORDER_CREATE` hay (`hops psql`, sólo `SELECT`). Si producción tiene alguna viva, el
  retiro necesita un paso de transición y vuelve al owner.

Coordinación con HOS-1512: la batería de vigilancia debería sumar más adelante una medición de
crear, leer y vencer una preferencia. No se especifica nada más sobre esos archivos.

## 10. Criterios de aceptación

- AC-1. Dado un dueño elegible y un producto `UNA_VEZ`, cuando confirma la compra, entonces se crea
  una instancia `PENDING_AUTHORIZATION`, una página con `external_reference` = `orderRequestId` y los
  medios no instantáneos excluidos, y la respuesta trae un `checkoutUrl` saneado.
- AC-2. Dado un pedido con `payment` o cualquier campo de tarjeta, cuando llega a la ruta, entonces
  contesta `400` y no crea nada.
- AC-3. Dado el mismo `orderRequestId` dos veces, cuando llega el segundo pedido, entonces no se crea
  otra página y se devuelve el mismo enlace.
- AC-4. Dada una instancia pendiente del mismo dueño, producto y objetivo, cuando otra pantalla
  compra, entonces contesta `PENDING_ELSEWHERE` y no crea instancia ni página.
- AC-5. Dada una creación de página cuya respuesta se perdió, cuando llega el mismo pedido, entonces
  queda una sola instancia con un id de página, y cualquier pago con esa referencia la activa.
- AC-6. Dado un pago aprobado, cuando llega su aviso, entonces la instancia pasa a `ACTIVE` sólo
  después de releer el pago por id, con un `payment` acreditado y `endsAt` según la vigencia.
- AC-7. Dado un retorno con `status=approved` en la URL y ningún pago aprobado en el proveedor,
  cuando la pantalla relee, entonces la instancia sigue pendiente.
- AC-8. Dado un pago con importe distinto del precio anclado, cuando se relee, entonces no se activa
  y se abre `DIVERGENCIA_DE_MONTO`.
- AC-9. Dado un pago rechazado en la página, cuando se relee, entonces la instancia sigue pendiente
  y la persona puede reintentar en la misma página.
- AC-10. Dada una instancia pendiente sin pago aprobado, cuando vence su ventana, entonces A3 la
  pasa a `ABANDONED` y cierra la página; con un pago aprobado encontrado por referencia, corre A2.
- AC-11. Dada una instancia `ACTIVE`, cuando llega un segundo pago aprobado con su referencia,
  entonces no se reactiva nada y se abre `COBRO_DUPLICADO` con propuesta de devolver.
- AC-12. Dada una instancia `ABANDONED`, cuando aparece un pago aprobado con su referencia (aviso o
  barrido), entonces se abre la marca 23 y se aplica lo que decida P-3.
- AC-13. Dada una devolución confirmada de un `UNA_VEZ`, cuando se ejecuta, entonces va por
  `POST /v1/payments/{id}/refunds` con clave estable y se confirma releyendo el pago.
- AC-14. Dado el repo después del retiro, cuando corre el guard nuevo, entonces no hay `/v1/orders`
  en `packages/payments/src` ni campos de tarjeta en las superficies de §6.2.
- AC-15. Dada la tienda web, cuando un dueño la abre, entonces ve y puede comprar los seis
  destacados `UNA_VEZ`, con el aviso de ficha no publicada cuando corresponde, en es/en/pt.

## 11. Pruebas

- Unitarias: adaptador (cuerpo exacto de la preferencia, exclusiones, clave, saneo), decodificación,
  esquemas, lógica pura de la pantalla (`purchasableOffers`, `purchaseStateFrom`).
- Integración (service-core, con el fake mintiendo por defecto): A1, A2 por las tres entradas, A3,
  doble clic, respuesta perdida (`lostResponse`), aviso tardío o repetido (`M6`), segundo pago, pago
  tardío, devolución, barrido. Cada test que apague una mentira lo dice con `honestAbout`.
- API: ruta de compra y lectura (`apps/api/test/integration/billing-addon/`).
- E2E (Playwright, fake HTTP server y su página falsa): compra completa aprobada, rechazo y
  reintento, abandono. Reemplazan a los tres e2e de orden.
- Guards: el nuevo de §6.2, G15 con las reglas retiradas, el de tablas de transición sin A7.
- HOS-1883: `addon_activated` y `addon_checkout_abandoned` se emiten desde los puntos nuevos (A2 único
  por página, A3 único); su `reason` `ORDER_DECLINED` desaparece. Coordinar con quien implemente
  HOS-1883 según cuál mergee primero.

## 12. Smoke

Labels: `status-needs-smoke-staging` y `status-needs-smoke-prod` (billing core).

- Staging (sandbox real): compra aprobada con tarjeta, compra con dinero en cuenta, rechazo y
  reintento, abandono por vencimiento, medios en efectivo ausentes en la página, marca de segundo
  pago. Lo ejecuta el owner (pasos con pago humano) y se firma en
  `docs/billing/smoke-checklist.md`.
- Producción: una compra real del destacado más barato, su activación, y la devolución por la acción
  administrativa con relectura. Plata real: sólo el owner.

## 13. Desglose en PRs

Cada PR se mergea a `staging` solo y deja una promoción posible en cualquier punto: hasta T-6 la web
no vende `UNA_VEZ` y el camino viejo sigue entero; desde T-6 el nuevo está entero y el viejo queda
muerto hasta T-7.

| PR | Contenido | Depende de |
|---|---|---|
| T-0 | Fase 0: sondas en `mp-probes/`, filas `EX-61`…`EX-72` en la matriz, `M-DB-1`. Sin código de producción | — |
| T-1 | `@repo/payments`: métodos nuevos (§7.2) en interfaz, adaptador, fake y fake HTTP server, términos prohibidos nuevos, reglas del fake medidas en T-0. **Aditivo**: los de orden siguen | T-0 |
| T-2 | DB: columnas de página, operación de clave, claves del catálogo de plazos (con data-migration si corresponde). Aditivo | T-0 |
| T-3 | service-core: A1 con página, A2 único por pago, A3 único por búsqueda, cerrar página. Convive con la rama de orden y no se llama todavía desde la ruta | T-1, T-2 |
| T-4 | Aviso `payment` ruteado al A2 único; barrido reescrito para pagos (pagado sin instancia, duplicado), conservando el de órdenes hasta T-7 | T-3 |
| T-5 | Devolución de `UNA_VEZ` por `refund` de pago, conservando la de orden para instancias viejas | T-3 |
| T-6 | **Activación**: ruta y esquemas API, tienda web, i18n, e2e nuevos con la página falsa, admin (etiquetas) | T-4, T-5 |
| **T-7** | **Retiro del camino viejo** (§6.1), A7, reglas `RP13`–`RP16`, guard nuevo de §6.2, guard de cron reescrito, docs del programa (`03-maquinas` §8, `16-addons` §1.4) | T-6, `M-DB-1` sin instancias vivas |

Freno: si algo falla después de T-6, `addonPurchasesFreeze` pausa todas las compras sin revertir
código.

## 14. Preguntas abiertas

Cada una con opciones y la recomendada. Ninguna está decidida.

- **P-1. Qué ve la persona mientras el pago se confirma.**
  (a) Vuelve a «Complementos» con «Estamos confirmando tu pago», la pantalla relee unos segundos y,
  si no se resuelve, dice «Te avisamos por correo cuando se acredite» y deja el estado en la lista.
  (b) Una página de retorno propia con el estado. (c) Sólo el estado en la lista, sin mensaje.
  **Recomendada: (a)**. Reusa el retorno y la relectura que ya existen, y no deja a nadie mirando un
  spinner.
- **P-2. Duración de la página y ventana de espera.** (a) Página 30 min, ventana +1 h. (b) Página
  60 min, ventana +1 h. (c) Página 24 h, ventana +24 h. **Recomendada: (b)**. Alcanza para pagar con
  calma, y la identidad de la compra queda ocupada poco tiempo si la persona se va.
- **P-3. Pago aprobado sobre una compra ya abandonada.** (a) Marca 23 con propuesta de devolver que
  confirma una persona, y correo a la persona. (b) Activar tarde si sigue siendo elegible (una
  instancia nueva, porque `ABANDONED` es terminal). (c) Marca 23 y una persona elige entre activar y
  devolver. **Recomendada: (a)**. Por construcción la población es casi cero, `ABANDONED` sigue siendo
  terminal, y es la misma regla de `DEC-CONC-001`.
- **P-4. Segundo pago aprobado sobre la misma página.** (a) `COBRO_DUPLICADO` con devolución que
  confirma una persona. (b) Devolución automática. **Recomendada: (a)**: `DEC-CONC-001` parte 3
  automatiza lo reversible y confirma la devolución.
- **P-5. Qué cuenta como «instantáneo».** (a) Sólo tarjeta de crédito, débito y prepaga, y dinero en
  cuenta; se excluye todo lo demás, incluido Mercado Crédito (`digital_currency`). (b) Incluir
  Mercado Crédito, que también aprueba en el acto. **Recomendada: (a)**: es la lectura literal de D-3,
  y se revisa con lo que mida `EX-62`.
- **P-6. `binary_mode`.** (a) Verdadero: el pago se aprueba o se rechaza en el acto, sin revisión
  manual. Algunos pagos que la revisión aprobaría se rechazan. (b) Falso: puede quedar `in_process`
  horas o días. **Recomendada: (a)**: es lo que hace real «sólo instantáneos», y la persona puede
  reintentar en la misma página.
- **P-7. Forma del cambio de interfaz.** (a) Los métodos de §7.2 dentro de las ocho capacidades.
  (b) Una novena capacidad «pago en página del proveedor». **Recomendada: (a)**: un pago único es un
  cobro (capacidad 2), y vencer la página es cerrar algo vivo (capacidad 5). No agranda el contrato
  que el README describe como cerrado.
- **P-8. Correo del pagador en el `UNA_VEZ`.** (a) No pedirlo ni mandarlo: la referencia identifica la
  compra. (b) Pedirlo y mandarlo como `payer.email` para precargar. **Recomendada: (a)**: un campo
  menos, y el correo declarado nunca es identidad (CLAUDE.md, `declared_payer_email`).
- **P-9. HOS-2094.** (a) Cerrarla como duplicada de HOS-2179 y apuntar a HOS-2179 las specs que la
  citan (HOS-2284, HOS-2285 a HOS-2290) en un PR de docs aparte. (b) Dejarla como el issue de
  «habilitar la venta web» y esta spec como el del cobro. **Recomendada: (a)**: D-4 dice que la venta
  web es el alcance original de esta spec.
- **P-10. Cuotas.** (a) Una sola cuota (`installments: 1`). (b) Las cuotas que ofrezca Mercado Pago.
  **Recomendada: (a)**. Los montos son chicos, y unas cuotas sin interés le cuestan al vendedor. Es
  una decisión de plata, la toma el owner.

## 15. Riesgos

- R-1. La devolución de un pago de Checkout Pro no se puede medir en sandbox (`RF-1`). Mitigación:
  `EX-69` en producción con el owner, y la misma llamada ya está medida en producción para pagos
  de suscripción.
- R-2. `R-MP-01`: la API de Payments, donde se leen y devuelven estos pagos, está anunciada en
  discontinuación. Este diseño suma dependencia sobre ella. Mitigación: la interfaz es de dominio, y
  cambiar de API cambia el adaptador.
- R-3. Si `EX-66` mide que la página no se vence por API, el segundo pago (§5.8) queda como única
  defensa. Mitigación: página corta (P-2) y marca.
- R-4. Si `EX-63` mide que el aviso `payment` no llega para Checkout Pro, la confirmación depende del
  retorno y de A3. Mitigación: la lectura en el retorno (§5.3, camino 2) y un A3 corto.
- R-5. El alta directa de suscripciones sigue aceptando `paymentToken`. Está fuera de D-1, que habla
  de los complementos. Si el owner quiere la misma regla ahí, es otro issue.
- R-7. La devolución de pagos se escribió para pagos de suscripción. `refund-source.ts` y
  `refund-window.ts` pueden suponer una `subscriptionId`, que el `payment` de un `UNA_VEZ` no tiene
  (CHECK de exactamente una de las dos). T-5 lo verifica antes de reusar el camino.
- R-6. Los e2e de orden se borran en T-7 y los nuevos llegan en T-6. Si T-6 se atrasa, no se borra
  nada: T-7 depende de T-6.

## 16. Dependencias

- HOS-1352 (programa) y su próxima promoción (D-5).
- HOS-2364 (Playwright sobre el sandbox de MP) para los pasos **[HUMANO]**, si resulta viable.
- HOS-1512 (batería): sólo la nota de §9.
- HOS-1883 (analítica): puntos de emisión (§11).
- HOS-2288, HOS-2290 y los packs de Comer y salir: se vuelven vendibles con T-6.

## 17. Seguimiento

- Issue nuevo: borrar `provider_order_id` y el índice de devoluciones de orden en la release
  siguiente a T-7.
- P-9, si el owner elige (a): PR de docs que repunta las specs de HOS-2094 a HOS-2179.
