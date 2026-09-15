---
title: Matriz de validación de Mercado Pago (FASE 1C)
linear: HOS-1352
statusSource: linear
created: 2026-09-15
status: CURRENT
phase: 1C
---

# Matriz de validación de Mercado Pago

**FASE 1C en curso.** Tras las [sondas 01, 02 y 03](./mp-probes/RESULTS-2026-09-15.md) del
2026-09-15: **16 filas `VERIFIED`, 5 `PARTIALLY_SUPPORTED`, 2 `NOT_SUPPORTED`, 32 `UNKNOWN`**.

> **El hallazgo que atraviesa todo lo demás**: Mercado Pago **acepta cambios que no aplica, y
> responde `200`**. Tres casos confirmados — el campo `items`, y dos intentos aislados de
> cambiar `frequency`. **Un `200` no significa que el cambio se haya aplicado**: toda mutación
> exige relectura y comparación campo por campo.

## Reglas

1. **Ninguna fila se completa desde documentación, memoria, código existente ni "parece que lo
   soporta"** (§58: *"NO alcanza documentación. NO alcanza código legacy. NO alcanza memoria.
   NO alcanza 'parece soportarlo'."*). Una fila se llena **sólo** con un experimento
   ejecutado.
2. **No se implementa una capability crítica mientras su fila diga `UNKNOWN`** (§61).
3. **Ninguna decisión sobre Mercado Pago se toma mientras su fila diga `UNKNOWN`**
   (regla 3 de [`01-decision-log.md`](./01-decision-log.md)).
4. Cada fila lleva **fecha y entorno**. Una fila sin fecha se lee como `UNKNOWN` (`S-MP-02`):
   un proveedor externo cambia su comportamiento sin avisarnos, y un resultado viejo no es un
   resultado.
5. Las pruebas quedan como **sondas versionadas y ejecutables** en `docs/mp-probes/`, marcadas
   como no productivas y excluidas de todo build (`S-MP-03`). Un experimento que vive sólo en
   su conclusión no se puede volver a correr.
6. Un `PARTIALLY_SUPPORTED` **tiene que nombrar qué parte**. "Casi" no es un resultado.
7. Antes de FASE 10 **todas las filas se re-verifican** (`S-MP-02`).

## Estados (§61)

| Estado | Significa |
|---|---|
| `VERIFIED` | Se ejecutó y funciona como lo necesitamos. Con evidencia. |
| `NOT_SUPPORTED` | Se ejecutó y el proveedor no lo permite. Con evidencia. |
| `PARTIALLY_SUPPORTED` | Funciona con una restricción **nombrada**. |
| `UNKNOWN` | No se probó, o se probó hace demasiado. |

## Procedimiento por fila (§59)

Leer la documentación oficial **actual** → revisar limitaciones → preparar la prueba →
ejecutar contra la API o el sandbox → happy path → error paths → estados ambiguos → retries →
registrar request → registrar response → observar el webhook → documentar la conclusión.

## Composición

| Origen | Filas |
|---|---|
| Matriz mínima obligatoria del **§60** | 42 |
| Agregadas por FASE 1A (`M-MP-03`), marcadas ✚ | 11 |
| Agregadas por FASE 1C al medir | 2 — `EX-9`, `EX-10` |
| **Total** | **55** |

Columnas: **Estado** · **Fecha** · **Entorno** · **Evidencia** (ruta de la sonda, con request,
response y webhook observado) · **Conclusión**.

---

# Matriz mínima del §60

## Preapproval

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| PA-1 | Creación por API | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `201`, `status: pending`, `init_point` presente, sin cobrar |
| PA-2 | Linking con nuestro dominio desde el inicio | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `external_reference` se acepta y vuelve en la respuesta y en el `GET`. **Pero el `search` no filtra por él** — ver `RC-1` |
| PA-3 | Autorización por el usuario | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **Se autoriza por API, sin navegador**: `card_token_id` + `status:"authorized"` → `201` autorizada. **Y cobra en el acto** si no se manda `start_date` |
| PA-4 | Rechazo | `UNKNOWN` | — | — | — | requiere forzar un rechazo con una tarjeta de prueba que lo provoque |
| PA-5 | Cancelación | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `PUT {status:"cancelled"}`. **Irreversible**: reintentar da `400`; sobre una autorizada, `400 "Invalid transition from cancelled to authorized"` |

## Frecuencias de facturación (§19)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| FR-1 | Mensual | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `frequency: 1, frequency_type: "months"` |
| FR-2 | Trimestral | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `frequency: 3, months` |
| FR-3 | Semestral | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `frequency: 6, months` |
| FR-4 | Anual | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `frequency: 12, months`. **`"years"` NO existe**: `400`, válidos sólo `[days, months]`. Y `frequency: 5` se acepta: **los 4 ciclos del §19 son elección nuestra, no un límite del proveedor** |

## Renovaciones

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| RN-1 | Cobro exitoso | `UNKNOWN` | — | — | — | — |
| RN-2 | Cobro fallido | `UNKNOWN` | — | — | — | — |
| RN-3 | Recuperación tras el fallo | `UNKNOWN` | — | — | — | — |

## Grace (§20)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| GR-1 | Recuperación durante el grace | `UNKNOWN` | — | — | — | — |
| GR-2 | Pago tardío, después de suspender (§22) | `UNKNOWN` | — | — | — | — |
| GR-3 | Política de reintentos del proveedor | `UNKNOWN` | — | — | — | — |

## Pausa — `BD-MP-01`

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| PS-1 | Pausar | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | La **transición** funciona (`PUT {status:"paused"}` → `200`). Los efectos sobre el cobro no se midieron: ver `PS-2` |
| PS-2 | Que no cobre mientras está pausada | `UNKNOWN` | — | — | — | requiere una pausa de duración real; la de la sonda duró 1,3 s |
| PS-3 | Reanudación anticipada por el usuario (§26.2) | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | La **transición** funciona (`PUT {status:"authorized"}` → `200`) |
| PS-4 | Reanudación automática al llegar la fecha (§26.2) | `UNKNOWN` | — | — | — | — |
| PS-5 | Qué pasa con las fechas al reanudar | `UNKNOWN` | — | — | — | **de una pausa de 1,3 s no se puede concluir nada.** `next_payment_date` no se movió, pero eso no dice nada sobre una pausa real |
| PS-6 | Qué pasa con la fecha de cobro al reanudar (§26.4) | `UNKNOWN` | — | — | — | ídem `PS-5`. Es la que decide si §26.4 es implementable |

## Cancelación (§24)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| CN-1 | Cancelación programada a fin de período | `UNKNOWN` | — | — | — | — |
| CN-2 | Comportamiento inmediato del proveedor | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | Cancelación inmediata e **irreversible**, igual que `PA-5` |

## Cambios de precio — `BD-MP-03` (§29)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| PC-1 | Sobre una suscripción existente ya autorizada | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **El monto SÍ se muta sobre una autorizada**: 1500→2200→15→1500, todos `200`, verificado por relectura |
| PC-2 | Limitaciones: pisos, topes, magnitud del cambio | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **Piso de ARS 15**: `400 "Cannot pay an amount lower than $ 15.00"`. Cero y negativo: `400 "must be a positive number"` |
| PC-3 | ¿Requiere nuevo consentimiento del usuario? | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **NO requiere nuevo consentimiento.** La mutación se aplica sola y la suscripción sigue `authorized` con su medio de pago |

> `PC-3` decide si se pueden actualizar precios sin perder la base instalada. `PC-2` también
> alimenta el piso de `A-PROMO-01` y la estrategia de bajar el monto de `BD-MP-02`.

## Upgrade (§27)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| UP-1 | Aplicación inmediata | `UNKNOWN` | — | — | — | — |
| UP-2 | Efecto económico: prorrateo, cobro inmediato, o nada | `UNKNOWN` | — | — | — | — |

## Downgrade (§28)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| DW-1 | Aplicación al ciclo siguiente | `UNKNOWN` | — | — | — | — |
| DW-2 | ¿Lo soporta el proveedor, o hay que emularlo? | `UNKNOWN` | — | — | — | — |

## Cortesía temporal — `BD-MP-02` (§34.2)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| CT-1 | N meses gratis sobre una suscripción viva | `UNKNOWN` | — | — | — | — |
| CT-2 | Estrategias posibles: bajar monto / pausar / recrear / reembolsar | `UNKNOWN` | — | — | — | — |
| CT-3 | Efectos colaterales de cada estrategia | `UNKNOWN` | — | — | — | — |

## Grant permanente (§35.3)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| GT-1 | Cancelación correcta de la suscripción del proveedor | `UNKNOWN` | — | — | — | — |

## Webhooks (§51)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| WH-1 | Duplicados | `UNKNOWN` | — | — | — | — |
| WH-2 | Demorados | `UNKNOWN` | — | — | — | — |
| WH-3 | Fuera de orden | `UNKNOWN` | — | — | — | — |
| WH-4 | Reintentos | `UNKNOWN` | — | — | — | — |
| WH-5 | Faltantes: un evento que nunca llega | `UNKNOWN` | — | — | — | — |

## Reconciliación (§23)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| RC-1 | Consultar el estado real de una suscripción | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **`GET /preapproval/{id}` es confiable.** El `search` **ignora `external_reference` en silencio**: 111 resultados con un valor válido, con basura y con el nuestro. `status` sí filtra. `/v1/payments/search` sí filtra por `external_reference` |
| RC-2 | Historial de pagos | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | Dos caminos funcionan: `/authorized_payments/search?preapproval_id=` y `/v1/payments/search?external_reference=` |
| RC-3 | Reparar el estado local desde el del proveedor | `UNKNOWN` | — | — | — | — |

---

# ✚ Filas agregadas por FASE 1A

No están en la matriz mínima del §60. §60 dice *"matriz mínima"*, así que ampliarla es lo
esperado; se marcan para que quede claro qué exige el PDR y qué agregó el análisis
(`M-MP-03`).

## ✚ Reembolsos — `M-LEGAL-01`

> El derecho de revocación con devolución total necesita poder reembolsar. También es una de
> las cuatro estrategias posibles de `BD-MP-02`.

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| RF-1 | Reembolso total de un cobro | `UNKNOWN` | 2026-09-15 | sandbox | [sondas 01/02/03/05](./mp-probes/RESULTS-2026-09-15.md) | **Bloqueado por credenciales, no por el proveedor**: `POST /v1/payments/{id}/refunds` → `401 "Unauthorized use of live credentials"`. **No se midió si MP soporta el reembolso**: se midió que estas credenciales no pueden pedirlo |
| RF-2 | Reembolso parcial | `UNKNOWN` | 2026-09-15 | sandbox | [sondas 01/02/03/05](./mp-probes/RESULTS-2026-09-15.md) | Ídem `RF-1`: `401` por credenciales. La capacidad sigue **sin medir** |
| RF-3 | Plazo máximo para reembolsar un cobro | `UNKNOWN` | — | — | — | — |

## ✚ Huecos estructurales

| # | Comportamiento | Para qué | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|---|
| EX-1 | Qué pasa con una autorización creada y **nunca completada**: ¿vence?, ¿cuándo?, ¿se puede reusar? | `M-SUB-01`, `M-MP-02` | `UNKNOWN` | — | — | — | requiere dejar una sin autorizar y esperar |
| EX-2 | ¿Los eventos del proveedor traen **orden confiable** (versión o timestamp)? | `M-CONC-02` | `UNKNOWN` | — | — | — | requiere recibir webhooks; hace falta un endpoint público |
| EX-3 | ¿Qué le comunica el proveedor **al cliente, por su cuenta**, al cancelar / pausar / modificar? | `M-MAIL-04` | `UNKNOWN` | — | — | — | requiere observar la casilla del comprador de prueba |
| EX-4 | Cambio de **frecuencia** sobre una suscripción ya autorizada | `BD-SUB-01`, `MP-01` | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **El ciclo NO se puede cambiar, y falla en silencio**: `200` en dos intentos aislados (12 y 3 meses) y `frequency` siguió en 1 |
| EX-5 | ¿Una autorización puede cubrir **más de un monto**? | `BD-MP-04` | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `auto_recurring` como array → `400`. Campo `items` → **`201` y se descarta en silencio**: no vuelve en la respuesta, queda un solo monto |
| EX-6 | N autorizaciones del mismo pagador conviviendo, ya autorizadas | `BD-MP-04` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | Dos autorizadas del mismo pagador conviven sin conflicto |
| EX-7 | Compensar días ya pagados corriendo la **primera fecha de cobro** | `BD-SUB-01` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `start_date` a +20 días → `next_payment_date` en esa fecha |
| EX-9 | ¿Se puede tokenizar una tarjeta **ya guardada**, server-side? | `DEC-SUB-005` | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02/03](./mp-probes/RESULTS-2026-09-15.md) | **Sí, pero exige el código de seguridad.** Con `card_id` solo, el token se genera (`201`) y **no sirve**: `400 "Card token was generated without cvv validation"`. Con `card_id` + `security_code`, funciona |
| EX-10 | ¿Ese token crea una suscripción autorizada real? | `DEC-SUB-005` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02/03](./mp-probes/RESULTS-2026-09-15.md) | `201` y **verificado por relectura independiente**: `authorized`, ciclo nuevo (3 meses), primer cobro corrido a +18 días, **cero cobro al crear** |
| EX-8 | ¿Se respeta esa primera fecha **después** de autorizar? | `BD-SUB-01` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **Sí se respeta tras autorizar.** Además **no cobra al crearse**. El proveedor lo modela como un `free_trial` de 20 días que nosotros no pedimos |

> `EX-7` y `EX-8` van separadas a propósito: que el proveedor **acepte** una fecha futura al
> crear no prueba que la **respete** una vez autorizada, y ésa es la que decide. Una fila que
> sólo se probó antes de autorizar no responde por el comportamiento después.

---

## Resumen

| Estado | Filas |
|---|---|
| `VERIFIED` | **16** |
| `PARTIALLY_SUPPORTED` | **5** — `PA-2`, `RC-1`, `PS-1`, `PS-3`, `EX-9` |
| `NOT_SUPPORTED` | **2** — `EX-4` (cambio de ciclo), `EX-5` (más de un monto) |
| **`UNKNOWN`** | **32** |

Lo que falta se agrupa en cuatro bloques, y cada uno necesita algo que hoy no hay:

| Bloque | Qué hace falta |
|---|---|
| Renovaciones, grace y efectos reales de la pausa | **Que pase tiempo.** La pausa de la sonda duró 1,3 s: alcanzó para las transiciones, no para las fechas |
| Webhooks y orden de eventos | **Un endpoint público** que reciba los POST, **y poder cambiar la URL de webhook** — que es **de sólo lectura por API** (`403` en PUT/POST/PATCH sobre `/applications/{id}`) y sólo se cambia desde el panel de desarrolladores |
| Reembolsos | **Se intentaron y el endpoint devolvió `401 "Unauthorized use of live credentials"`.** Hace falta aclarar qué credenciales habilitan reembolsos en sandbox |
| Correos del proveedor (`EX-3`) | Observar la casilla del comprador de prueba |

## Qué espera cada decisión

| Decisión abierta | Filas que la desbloquean |
|---|---|
| `BD-MP-01` mecanismo de pausa | `PS-1`…`PS-6` |
| `BD-MP-02` cortesía sobre una suscripción viva | `CT-1`…`CT-3`, `PC-2`, `RF-1` |
| `BD-MP-03` cambio de precio sobre vigentes | ✅ `PC-1`, `PC-2`, `PC-3` — **las tres cerradas** |
| `BD-MP-04` addons recurrentes | ✅ `EX-5`, `EX-6` — **las dos cerradas** |
| `BD-SUB-01` matriz de cambio de plan | ⚠️ `EX-4` salió `NOT_SUPPORTED` y `EX-8` `VERIFIED`: **el mecanismo de `DEC-SUB-001` no es implementable como está escrito**. Faltan `UP-1`, `UP-2`, `DW-1`, `DW-2` |
| `MP-01` los cuatro ciclos del §19 | `FR-1`…`FR-4`, `EX-4` |
| `M-LEGAL-01` revocación con devolución | `RF-1`, `RF-3` |
| `M-CONC-02` no-retroceso de estado | `WH-3`, `EX-2` |
| `M-SUB-01` estado de autorización pendiente | `PA-3`, `PA-4`, `EX-1` |
| `M-MAIL-04` correos del proveedor | `EX-3` |
| `A-PROMO-01` piso del descuento apilado | `PC-2` |

**Dos de las cuatro bloqueantes de FASE 2 ya tienen sus filas cerradas** (`BD-MP-03` y
`BD-MP-04`) y se pueden decidir. Las otras dos (`BD-MP-01` pausa, `BD-MP-02` cortesía) siguen
bloqueadas por el §61.

Y **`DEC-SUB-001` quedó sin mecanismo** y fue reemplazada por **`DEC-SUB-005`**: el cambio de
ciclo se hace **cancelando y recreando** con la primera fecha corrida, no mutando. La política
de la matriz tier × ciclo no cambió.
