# Sonda 51: idempotencia de `/v1/orders` (2026-09-25, sandbox)

Script: [`probe-51-idempotencia-de-orders.mjs`](./probe-51-idempotencia-de-orders.mjs). Credenciales
de prueba, tarjeta APRO, ARS 20. Sin costo.

| caso | qué se mandó | resultado |
|---|---|---|
| A | dos `POST` con la **misma** `X-Idempotency-Key` y el **mismo** cuerpo | `201` y `201`, **la misma orden** `ORDTST01M3CKPXTXH709N0TVB7D88KQF`; relectura: `processed/accredited`, **1 pago** |
| B | la **misma** clave con **otro** cuerpo (ARS 30) | `409` — `idempotency_key_already_used`: *«X-Idempotency-Key already used. Please retry with a different value.»* |
| C | dos claves **distintas**, el **mismo** `external_reference` | `201` y `201`, **dos órdenes y dos cobros** (`…Q0ZXX1…` y `…Q3095Z…`) |

**Conclusión**: el reintento de un cobro de única vez es seguro **si usa la misma clave**. El
`external_reference` no protege nada: la clave tiene que acuñarse y persistirse antes de la
primera llamada (`D4`). No medido en producción.
