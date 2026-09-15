---
title: Matriz de validación de Mercado Pago (FASE 1C)
linear: HOS-1352
statusSource: linear
created: 2026-09-15
status: CURRENT
phase: 1C
---

# Matriz de validación de Mercado Pago

**FASE 1C en curso.** Tras las [sondas 01 a 07](./mp-probes/RESULTS-2026-09-15.md) del
2026-09-15: **25 filas `VERIFIED`, 10 `PARTIALLY_SUPPORTED`, 4 `NOT_SUPPORTED`, 22 `UNKNOWN`**.

> **El reloj está corriendo.** Siete suscripciones de **ciclo diario** quedaron vivas en el
> sandbox el 2026-09-15 a las 12:26–12:29 (manifiesto en `/tmp/mp-probe-05/manifiesto.json`).
> Las filas que dependen de que el proveedor ejecute un ciclo se leen con la
> [sonda 06](./mp-probes/probe-06-leer-el-reloj.sh) **a partir del 2026-09-16 ~11:30**.

> **El hallazgo que atraviesa todo lo demás**: Mercado Pago **acepta cambios que no aplica, y
> responde `2xx`**. **Seis** casos confirmados — el campo `items`, dos intentos aislados de
> cambiar `frequency`, un token de tarjeta guardada sin código de seguridad, una
> `notification_url` por suscripción, y un `end_date` fijado sobre una suscripción ya
> autorizada. **Un `2xx` no significa que el cambio se haya aplicado**:
> toda mutación exige relectura y comparación campo por campo.

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
| Agregadas por FASE 1C al medir | 8 — `EX-9` a `EX-16` |
| **Total** | **61** |

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
| PA-4 | Rechazo | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 05/07](./mp-probes/RESULTS-2026-09-15.md) | **Una tarjeta que va a rechazar NO llega a crear la suscripción**: la validación ocurre antes. Titular `FUND` y titular `OTHE`, los dos → `400 CC_VAL_433 Credit card validation has failed`. El rechazo se manifiesta como creación fallida, no como suscripción autorizada que después no cobra — y por eso **no sirve para fabricar un cobro fallido** (ver `RN-2`) |
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
| RN-1 | Cobro exitoso | `UNKNOWN` | — | — | — | ⏳ **sujeto vivo**: `renov-ok` (`930a7596…`), ciclo diario, cobra el 2026-09-16 ~11:26 |
| RN-2 | Cobro fallido | `UNKNOWN` | — | — | — | ⏳ **sujeto vivo**: `renov-falla3` (`0e678ead…`). **No se puede fabricar con una tarjeta mala** (`PA-4`): el camino que queda es subirle el monto a algo impagable |
| RN-3 | Recuperación tras el fallo | `UNKNOWN` | — | — | — | depende de `RN-2` |

## Grace (§20)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| GR-1 | Recuperación durante el grace | `UNKNOWN` | — | — | — | depende de `RN-2` |
| GR-2 | Pago tardío, después de suspender (§22) | `UNKNOWN` | — | — | — | depende de `RN-2` |
| GR-3 | Política de reintentos del proveedor | `UNKNOWN` | — | — | — | depende de `RN-2` |

## Pausa — `BD-MP-01`

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| PS-1 | Pausar | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | La **transición** funciona (`PUT {status:"paused"}` → `200`). Los efectos sobre el cobro no se midieron: ver `PS-2` |
| PS-2 | Que no cobre mientras está pausada | `UNKNOWN` | — | — | — | ⏳ **sujeto vivo**: `pausa-real` (`747cc456…`), pausado desde el 2026-09-15 12:28, con un cobro que le tocaría el 16 a las 11:28 |
| PS-3 | Reanudación anticipada por el usuario (§26.2) | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | La **transición** funciona (`PUT {status:"authorized"}` → `200`) |
| PS-4 | Reanudación automática al llegar la fecha (§26.2) | `UNKNOWN` | — | — | — | ⏳ lo dice el mismo sujeto: si aparece `authorized` sin que nadie lo tocara |
| PS-5 | Qué pasa con las fechas al reanudar | `UNKNOWN` | — | — | — | **de una pausa de 1,3 s no se puede concluir nada.** `next_payment_date` no se movió, pero eso no dice nada sobre una pausa real |
| PS-6 | Qué pasa con la fecha de cobro al reanudar (§26.4) | `UNKNOWN` | — | — | — | ídem `PS-5`. Es la que decide si §26.4 es implementable |

## Cancelación (§24)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| CN-1 | Cancelación programada a fin de período | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sonda 12](./mp-probes/RESULTS-2026-09-15.md) | **Existe, pero sólo se puede fijar AL CREAR.** `auto_recurring.end_date` en la creación: `201` y **sobrevive a la relectura**. El mismo campo sobre una suscripción **ya autorizada**: `200` y **no aparece en la relectura** — sexto caso del §0. Consecuencia: una baja a fin de período **pedida después** hay que **emularla** con un cron, y un cron que se cae deja cobrando a quien pidió la baja |
| CN-2 | Comportamiento inmediato del proveedor | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | Cancelación inmediata e **irreversible**, igual que `PA-5` |

## Cambios de precio — `BD-MP-03` (§29)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| PC-1 | Sobre una suscripción existente ya autorizada | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **El monto SÍ se muta sobre una autorizada**: 1500→2200→15→1500, todos `200`, verificado por relectura |
| PC-2 | Limitaciones: pisos, topes, magnitud del cambio | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02/05](./mp-probes/RESULTS-2026-09-15.md) | **Rango ARS 15 a ARS 2.000.000.** Piso: `400 "Cannot pay an amount lower than $ 15.00"`; cero y negativo, `400 "must be a positive number"`. Techo: `400 "Cannot pay an amount greater than $ 2000000.00"`. **Ninguna magnitud de cambio fue rechazada dentro del rango** (2000→15 y 2000→4000 pasaron) |
| PC-3 | ¿Requiere nuevo consentimiento del usuario? | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **NO requiere nuevo consentimiento.** La mutación se aplica sola y la suscripción sigue `authorized` con su medio de pago |

> `PC-3` decide si se pueden actualizar precios sin perder la base instalada. `PC-2` también
> alimenta el piso de `A-PROMO-01` y la estrategia de bajar el monto de `BD-MP-02`.

## Upgrade (§27)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| UP-1 | Aplicación inmediata | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sonda 05](./mp-probes/RESULTS-2026-09-15.md) | **El monto nuevo queda aplicado en el acto** (2000→4000, verificado por relectura) y `next_payment_date` **no se mueve**. Falta ver qué monto cobra el proveedor en el ciclo siguiente |
| UP-2 | Efecto económico: prorrateo, cobro inmediato, o nada | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sonda 05](./mp-probes/RESULTS-2026-09-15.md) | **NO cobra la diferencia en el acto**: `charged_quantity` siguió en 1 tras subir el monto. Si hay prorrateo o no se ve el 2026-09-16 (`monto-sube`, `4f60c31c…`) |

## Downgrade (§28)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| DW-1 | Aplicación al ciclo siguiente | `UNKNOWN` | — | — | — | ⏳ **sujeto vivo**: `monto-baja` (`5e4c5e5c…`), bajado a ARS 1000 el 15 |
| DW-2 | ¿Lo soporta el proveedor, o hay que emularlo? | `UNKNOWN` | — | — | — | ⏳ ídem. El monto **ya bajó** sobre la vigente; falta ver desde qué ciclo cobra el nuevo |

## Cortesía temporal — `BD-MP-02` (§34.2)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| CT-1 | N meses gratis sobre una suscripción viva | `UNKNOWN` | — | — | — | ⏳ **sujeto vivo**: `cortesia-piso` (`30c03cca…`), llevado al piso de ARS 15 |
| CT-2 | Estrategias posibles: bajar monto / pausar / recrear / reembolsar | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01-12](./mp-probes/RESULTS-2026-09-15.md) | **Las cuatro medidas, y ninguna da "gratis" limpio.** (1) **Bajar el monto**: funciona sin re-consentimiento (`PC-1`/`PC-3`) pero el piso es **ARS 15** (`PC-2`), así que la cortesía máxima es ARS 15 por ciclo, no cero. (2) **Pausar**: la transición funciona (`PS-1`), pero estando pausada **no se puede modificar nada** (`EX-11`) — ni siquiera aplicar un cambio de precio — y si deja de cobrar lo dice el reloj (`PS-2`). (3) **Cancelar y recrear**: funciona (`EX-8`/`EX-10`) pero **le pide el código de seguridad al cliente** (`EX-9`). (4) **Cobrar y reembolsar**: **no se puede pedir** desde esta cuenta (`RF-1`) |
| CT-3 | Efectos colaterales de cada estrategia | `UNKNOWN` | — | — | — | — |

## Grant permanente (§35.3)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| GT-1 | Cancelación correcta de la suscripción del proveedor | `UNKNOWN` | — | — | — | La **transición** ya está medida (`PA-5`/`CN-2`: inmediata e irreversible). Lo que falta es lo que importa para un grant permanente: **que efectivamente deje de cobrar**. ⏳ **sujeto vivo**: `cancelada-no-cobra` (`6738c7fb…`), cancelada el 2026-09-15 con un cobro que le tocaría el 16 a las 14:42. **Ojo**: `next_payment_date` **NO se limpia al cancelar** —sigue diciendo el 16— así que ese campo no sirve para saber si va a cobrar |

## Webhooks (§51)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| WH-1 | Duplicados | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 08/09](./mp-probes/RESULTS-2026-09-15.md) | **Ocurren, y no en el camino feliz.** Con entregas exitosas: cero duplicados en tres corridas. Con el receptor en `mode=fail`: el **mismo evento** —misma `version`— llegó **dos veces a ~0,5 s**, con **ids de notificación distintos**. Eso cierra el círculo con `EX-2`: el id del evento no sirve para deduplicar y **la `version` sí**, porque en el duplicado es la misma |
| WH-2 | Demorados | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 08/09](./mp-probes/RESULTS-2026-09-15.md) | **Sí, y la demora es muy variable**: medida entre **0,6 s y 32 s** sobre la misma secuencia de acciones, con receptor propio. Consecuencia de método: cualquier experimento que atribuya un evento a una acción necesita espaciarlas **más que la demora máxima** — con 20 s la atribución quedaba ambigua |
| WH-3 | Fuera de orden | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 08/09](./mp-probes/RESULTS-2026-09-15.md) | **No se observó desorden** en tres corridas contra una secuencia de orden conocido: las entregas llegaron en el orden causal. No prueba que no pueda pasar — las demoras van de 0,6 s a 32 s (`WH-2`), así que dos acciones juntas podrían invertirse. **Pero ya no importa tanto**: `EX-2` da un `version` monótono que permite detectar y descartar el desorden |
| WH-4 | Reintentos | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 08/09](./mp-probes/RESULTS-2026-09-15.md) | **Reintenta ante un `500`, con backoff creciente**, ahora medido con receptor propio y no a través de la tabla normalizada de staging: duplicado inmediato a **+0,5 s**, y reintentos a **+18,8 min** y **+35,1 min** (medidos desde la entrega anterior): el backoff aproximadamente **duplica** el intervalo, y **reproduce** una observación indirecta previa. **Cuántos reintentos hace en total NO se midió**: suponer que reintenta indefinidamente sería apostar. **Y en el reintento cambian el id de notificación Y el `ts` de la firma —el proveedor RE-FIRMA— mientras la `version` del recurso se mantiene.** O sea que ni el id ni la marca de tiempo sirven para detectar una reentrega: **la `version` es lo único estable** |
| WH-5 | Faltantes: un evento que nunca llega | `UNKNOWN` | — | — | — | Distinto de `EX-15`, que es un evento que **nunca existe**. Acá se mide una entrega que se pierde. Se fuerza con el interruptor `mode=fail` de la sonda 08 |

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
| RF-1 | Reembolso total de un cobro | `UNKNOWN` | 2026-09-15 | sandbox | [sonda 11](./mp-probes/RESULTS-2026-09-15.md) | **No es un problema de reembolsos: la aplicación NO PUEDE ESCRIBIR sobre `payments`, punto.** Medido en una sola corrida: `GET /v1/payments/{id}` **200**, `GET .../refunds` **200**, `POST /preapproval` **201**, `PUT /preapproval/{id}` **200** … y **todo** `write` sobre un pago da `401 "Unauthorized use of live credentials"`, incluso un `PUT {"description":"x"}` inocuo. **La causa está medida y la declara el proveedor**: `GET /applications/{id}` lista `urn:mp:online:payments:refunds/**read-only**` y `urn:mp:online:payments/**read-only**`, contra `urn:mp:online:subs-recurring:pre-approval/**read-write**`. **No es el permiso `write` genérico** —los tres del panel están tildados—: es el **scope por recurso**, y viene dado por el producto de la app (**Suscripciones**). El `test_access_token` tampoco sirve: lee el pago (`200`) y el reembolso da `404 "Payment not found"`. Se cierra con una **segunda app de producto Checkout API**; cambiarle el producto a ésta invalidaría las 38 filas ya medidas y arriesgaría las 8 suscripciones del reloj |
| RF-2 | Reembolso parcial | `UNKNOWN` | 2026-09-15 | sandbox | [sonda 11](./mp-probes/RESULTS-2026-09-15.md) | Ídem `RF-1`, con `{"amount":100}` y también con el header de contingencia `X-Render-In-Process-Refunds`: `401` en los dos casos. La capacidad sigue **sin medir** |
| RF-3 | Plazo máximo para reembolsar un cobro | `UNKNOWN` | — | — | — | — |

## ✚ Huecos estructurales

| # | Comportamiento | Para qué | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|---|
| EX-1 | Qué pasa con una autorización creada y **nunca completada**: ¿vence?, ¿cuándo?, ¿se puede reusar? | `M-SUB-01`, `M-MP-02` | `UNKNOWN` | — | — | — | ⏳ **sujeto vivo**: `sin-autorizar` (`bf9b6feb…`), `pending` desde el 2026-09-15 12:26 |
| EX-2 | ¿Los eventos del proveedor traen **orden confiable** (versión o timestamp)? | `M-CONC-02` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 08/09](./mp-probes/RESULTS-2026-09-15.md) | **SÍ: el cuerpo trae `version`, un contador monótono POR RECURSO.** Medido con receptor propio: el mismo preapproval llegó con `version` 4, 6, 7, 8 en el orden causal de las acciones. Es lo que `M-CONC-02` necesita y **es más fuerte que el id del evento**, que cambia en cada reentrega. Corrige por ampliación la lectura anterior, que se había hecho sobre la tabla ya normalizada de staging y no veía este campo |
| EX-3 | ¿Qué le comunica el proveedor **al cliente, por su cuenta**, al cancelar / pausar / modificar? | `M-MAIL-04` | `UNKNOWN` | — | — | — | requiere observar la casilla del comprador de prueba |
| EX-4 | Cambio de **frecuencia** sobre una suscripción ya autorizada | `BD-SUB-01`, `MP-01` | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **El ciclo NO se puede cambiar, y falla en silencio**: `200` en dos intentos aislados (12 y 3 meses) y `frequency` siguió en 1 |
| EX-5 | ¿Una autorización puede cubrir **más de un monto**? | `BD-MP-04` | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `auto_recurring` como array → `400`. Campo `items` → **`201` y se descarta en silencio**: no vuelve en la respuesta, queda un solo monto |
| EX-6 | N autorizaciones del mismo pagador conviviendo, ya autorizadas | `BD-MP-04` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | Dos autorizadas del mismo pagador conviven sin conflicto |
| EX-7 | Compensar días ya pagados corriendo la **primera fecha de cobro** | `BD-SUB-01` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `start_date` a +20 días → `next_payment_date` en esa fecha |
| EX-9 | ¿Se puede tokenizar una tarjeta **ya guardada**, server-side? | `DEC-SUB-005` | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02/03](./mp-probes/RESULTS-2026-09-15.md) | **Sí, pero exige el código de seguridad.** Con `card_id` solo, el token se genera (`201`) y **no sirve**: `400 "Card token was generated without cvv validation"`. Con `card_id` + `security_code`, funciona |
| EX-10 | ¿Ese token crea una suscripción autorizada real? | `DEC-SUB-005` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02/03](./mp-probes/RESULTS-2026-09-15.md) | `201` y **verificado por relectura independiente**: `authorized`, ciclo nuevo (3 meses), primer cobro corrido a +18 días, **cero cobro al crear** |
| EX-8 | ¿Se respeta esa primera fecha **después** de autorizar? | `BD-SUB-01` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **Sí se respeta tras autorizar.** Además **no cobra al crearse**. El proveedor lo modela como un `free_trial` de 20 días que nosotros no pedimos |
| EX-11 | ¿Qué se puede hacer sobre una suscripción **pausada**? | `BD-MP-01`, acota `DEC-MP-001` | **`VERIFIED`** | 2026-09-15 | sandbox | [sonda 07](./mp-probes/RESULTS-2026-09-15.md) | **Estando pausada NO se puede modificar nada**: cambiar el monto da `400 "You can not modify a paused preapproval."` y el monto no se mueve. **Con control**: el mismo payload, sobre la misma suscripción ya reanudada, entra (`200`, monto cambiado) — o sea que **bloquea el estado, no la operación**. **Cancelar SÍ funciona estando pausada** (`200` → `cancelled`): la pausa no atrapa al cliente |
| EX-12 | ¿Un `card_token` sirve para más de una suscripción? | `DEC-SUB-005`, reintentos | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sonda 05](./mp-probes/RESULTS-2026-09-15.md) | **Un solo uso.** Del segundo en adelante: `400 "Card token was used, please generate new"`. Todo reintento de creación tiene que **tokenizar de nuevo**, y el mensaje de error no se parece en nada a "reintentaste" |
| EX-13 | ¿Los eventos vienen **firmados**, y se puede verificar la firma? | §51, `M-CONC-01` | **`VERIFIED`** | 2026-09-15 | sandbox | [sonda 10](./mp-probes/RESULTS-2026-09-15.md) | **La firma se verifica.** `x-signature: ts=<epoch>,v1=<hex64>` + `x-request-id`, y el `v1` es **HMAC-SHA256** con la clave de la aplicación sobre el manifiesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` — **el punto y coma final incluido**: sin él no coincide. Reproducido sobre **tres** entregas reales de tipos distintos, con control de la propia herramienta (vector RFC 4231). La URL del receptor no es un agujero abierto |
| EX-14 | ¿Se puede distinguir **sandbox de producción** mirando el evento? | `M-MP-01`, riesgo operativo | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 08/09](./mp-probes/RESULTS-2026-09-15.md) | **No.** Un `payment.created` de la cuenta de prueba (`tags:["test_user"]`) llega con **`live_mode: true`**. Un handler que filtre por ese campo trata los eventos de sandbox como productivos |
| EX-16 | ¿Se puede conciliar una suscripción **SIN** la API de Payments? | `R-MP-01`, §23, §57 | **`VERIFIED`** | 2026-09-15 | sandbox | [sonda 13](./mp-probes/RESULTS-2026-09-15.md) | **Sí, entera.** `GET /authorized_payments/search?preapproval_id=` y `GET /authorized_payments/{id}` pertenecen a la familia de **suscripciones**, no a `/v1/payments`, y traen todo lo que la conciliación necesita: `status`, `transaction_amount`, `currency_id`, `debit_date`, `date_created`, `last_modified`, `payment_method_id`, **`retry_attempt`**, y el pago embebido (`payment.id`, `payment.status`, `payment.status_detail`). El `search` **exige** filtro y **filtra bien por `preapproval_id`** (1 con el real, 0 con basura); por `external_reference` **no filtra** — mismo defecto que `RC-1`, y da igual porque el id del proveedor ya se guarda |
| EX-15 | ¿Qué operaciones **NO** emiten webhook? | `DEC-MP-001`, §23, §51 | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 08/09](./mp-probes/RESULTS-2026-09-15.md) | **Mutar el monto NO emite ninguna entrega.** Medido con 90 s entre acciones: ventana de 91 s sin eventos, con la mutación aplicada — y la `version` del recurso saltó de 5 a 9, o sea que **el recurso cambió y el proveedor no avisó**. Crear, pausar, reanudar y cancelar **sí** notifican. Consecuencia: un cambio de precio **no tiene vía de confirmación asincrónica** y sólo se puede comprobar releyendo |

> `EX-7` y `EX-8` van separadas a propósito: que el proveedor **acepte** una fecha futura al
> crear no prueba que la **respete** una vez autorizada, y ésa es la que decide. Una fila que
> sólo se probó antes de autorizar no responde por el comportamiento después.

---

## Resumen

| Estado | Filas |
|---|---|
| `VERIFIED` | **25** |
| `PARTIALLY_SUPPORTED` | **10** — `PA-2`, `RC-1`, `PS-1`, `PS-3`, `CN-1`, `UP-1`, `UP-2`, `CT-2`, `WH-3`, `EX-9` |
| `NOT_SUPPORTED` | **4** — `EX-4` (cambio de ciclo), `EX-5` (más de un monto), `EX-12` (reusar un token), `EX-14` (distinguir entorno) |
| **`UNKNOWN`** | **22** |

Lo que falta se agrupa en cuatro bloques, y cada uno necesita algo que hoy no hay:

| Bloque | Qué hace falta |
|---|---|
| Renovaciones, grace y efectos reales de la pausa | **Que pase tiempo** — pero **un día, no un mes**: `days` es un `frequency_type` válido (medido en `FR-4`), así que un ciclo diario pone un ciclo real a 24 h. Es lo que arma la [sonda 05](./mp-probes/probe-05-arrancar-el-reloj.sh) y lo que lee la [06](./mp-probes/probe-06-leer-el-reloj.sh). **Que el ciclo diario se autorice y se ejecute no está medido**: es lo primero que comprueba la sonda 05, por relectura |
| Webhooks y orden de eventos | **Un endpoint público** que reciba los POST, **y poder cambiar la URL de webhook** — que es **de sólo lectura por API** (`403` en PUT/POST/PATCH sobre `/applications/{id}`) y sólo se cambia desde el panel de desarrolladores. Y como el webhook es **por aplicación**, apuntarlo a un banco de pruebas deja al staging sin los suyos: hace falta una **aplicación de sandbox aparte** |
| Reembolsos | **Se intentaron y el endpoint devolvió `401 "Unauthorized use of live credentials"`.** Hace falta aclarar qué credenciales habilitan reembolsos en sandbox |
| Correos del proveedor (`EX-3`) | Observar la casilla del comprador de prueba |

## Qué espera cada decisión

| Decisión abierta | Filas que la desbloquean |
|---|---|
| `BD-MP-01` mecanismo de pausa | `PS-1`…`PS-6` + **`EX-11`**, que ya midió una restricción dura: **estando pausada no se puede modificar nada**, pero **sí cancelar** |
| `BD-MP-02` cortesía sobre una suscripción viva | `CT-1`…`CT-3`, `PC-2` ✅, `RF-1`. ⏳ `cortesia-piso` está vivo en ARS 15 |
| `BD-MP-03` cambio de precio sobre vigentes | ✅ `PC-1`, `PC-2`, `PC-3` cerradas → **decidida: `DEC-MP-001`** |
| `BD-MP-04` addons recurrentes | ✅ `EX-5`, `EX-6` cerradas, **pero le sobrevivió una elección de diseño**: con un solo monto por autorización y varias autorizaciones conviviendo, hay dos mecanismos y los dos funcionan. Volvió al owner |
| `BD-SUB-01` matriz de cambio de plan | ⚠️ `EX-4` salió `NOT_SUPPORTED` y `EX-8` `VERIFIED`: **el mecanismo de `DEC-SUB-001` no es implementable como está escrito**. Faltan `UP-1`, `UP-2`, `DW-1`, `DW-2` |
| `MP-01` los cuatro ciclos del §19 | `FR-1`…`FR-4`, `EX-4` |
| `M-LEGAL-01` revocación con devolución | `RF-1`, `RF-3` |
| `M-CONC-02` no-retroceso de estado | `WH-3`, `EX-2` |
| `M-SUB-01` estado de autorización pendiente | `PA-3`, `PA-4`, `EX-1` |
| `M-MAIL-04` correos del proveedor | `EX-3` |
| `A-PROMO-01` piso del descuento apilado | `PC-2` |

**Dos de las cuatro bloqueantes de FASE 2 ya tienen sus filas cerradas** (`BD-MP-03` y
`BD-MP-04`). La primera se decidió: `DEC-MP-001`. La segunda **no la cerró la medición** — le
sobrevivió una elección de diseño y volvió al owner. Las otras dos (`BD-MP-01` pausa,
`BD-MP-02` cortesía) siguen bloqueadas por el §61.

Una lección de método que deja esto: *"la decide el experimento"* fue una clasificación
**optimista**. Medir qué permite el proveedor cierra la pregunta técnica, y a veces deja dos
caminos abiertos en vez de uno. Cuando pasa, la salida es devolver la elección, no forzar una
decisión que la medición no tomó.

Y **`DEC-SUB-001` quedó sin mecanismo** y fue reemplazada por **`DEC-SUB-005`**: el cambio de
ciclo se hace **cancelando y recreando** con la primera fecha corrida, no mutando. La política
de la matriz tier × ciclo no cambió.
