# Fotos HOS-1710 · 2026-10-19 · la ventana del cobro

Producción, sólo `GET`, autorizada por el owner. Sujeto: `renov-ok`
(`6b293a9499d946f6ac159da7f8f4804e`, `1 days`, ARS 15).

Redactado:

- datos de tarjeta y de contacto, nombres y números de identificación;
- `payer.id` y `collector_id`;
- los ids internos de Hospeda en `metadata` (pedido, usuario, cliente, ficha), salvo `metadata.preapproval_id`, que es el vínculo que se mide y queda intacto;
- la parte final de `idempotency_key`, que traía un correo;
- `subscription_sequence.number`.

| Archivo | Pedido |
|---|---|
| `01-authorized-payments.json` | `GET /authorized_payments/search?preapproval_id=6b293a…` (sin `limit`: pagina de a 12; con `limit=50` responde 400 «Invalid value for limit») |
| `02-payments-search.json` | `GET /v1/payments/search?external_reference=HOS-1352-relojprod-renov-ok` |
| `03a-payment-approved.json` | `GET /v1/payments/179941738878` |
| `03b-payment-rejected.json` | `GET /v1/payments/179087989627` |
| `04a-payment-refunded-full.json` | `GET /v1/payments/168470636028` |
| `04b-payment-refunded-partial.json` | `GET /v1/payments/174625958196` |

Lo que prueban:

1. Cada registro trae `expire_date` = `date_created` + 1 ciclo (`…000-04:00`), y `debit_date` = `date_created`.
2. Los ciclos aprobados nombran su pago: `payment.id` y `retry_attempt: 1`.
3. El ciclo FALLIDO (`7032113610`, `retry_attempt: 4`, `payment_method_not_ready`) NO nombra su
   pago: `payment` trae sólo `status` y `status_detail`. El pago existe (`179087989627`,
   `cc_rejected_high_risk`, creado 3 s después) y es el único del ciclo: hay 6 pagos para 6 registros.
4. Las ventanas se solapan hasta 10 s, así que un pago puede caer en dos. La regla que acierta en los 6 casos es: el
   registro que nombra al pago; si ninguno lo nombra, el más reciente con `date_created` ≤ el del pago.
5. El pago rechazado trae el vínculo por los dos caminos (`metadata.preapproval_id` y
   `point_of_interaction.transaction_data.subscription_id`). `date_of_expiration` es `null` en todos.
6. Search y GET por id devuelven el mismo pago, salvo `shipping_cost`, que sólo trae el search.
7. `174625958196` es un Checkout Pro devuelto entero en 7 partes, no un cobro de suscripción.
8. `listCharges` descarta el registro sin `payment.id`, pero `charged_quantity` cuenta registros (6):
   el inventario queda incompleto (HOS-1710 D-2).

Medición relacionada del mismo día (HOS-1402 D-1a, el owner a mano, sin crudos guardados):

- `POST /v1/payments` con el cuerpo exacto del paso 4b del corte: 201, pago `184995919950`, `approved`.
- La devolución: 201, refund `3395845463`, `approved`.
- La relectura por id `GET /v1/payments/{id}/refunds/{rid}`: 200, `approved`.
- El sistema viejo de producción recibió los avisos de ese pago, respondió 200 y sólo dejó un WARN.
