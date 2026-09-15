---
title: Matriz de validación de Mercado Pago (FASE 1C)
linear: HOS-1352
statusSource: linear
created: 2026-09-15
status: CURRENT
phase: 1C
---

# Matriz de validación de Mercado Pago

**FASE 1C en curso.** Tras las [sondas 01 a 26](./mp-probes/RESULTS-2026-09-15.md) del
2026-09-15: **31 filas `VERIFIED`, 11 `PARTIALLY_SUPPORTED`, 7 `NOT_SUPPORTED`, 20 `UNKNOWN`**,
sobre **69**.

> **Diez comparaciones sandbox ↔ producción, y las diez coinciden.** Se re-midieron contra la
> cuenta real todas las filas de creación que no le cobran a nadie (`EX-17`, `EX-18`, `PC-2`,
> `FR-4`, `EX-5`, `CN-1`) y dieron idéntico resultado. O sea que la regla **no** es "el sandbox
> miente": es que **el vendedor de prueba no puede ESCRIBIR sobre `/v1/payments`** —ni crear un
> pago ni reembolsar—, y eso fue lo único que falseó (`RF-1`/`RF-2` estuvieron en `UNKNOWN` por
> un `401` que sólo existe ahí). La API de suscripciones se comporta igual en los dos entornos.

> Los conteos de este documento **no se suman a mano** — ya salieron mal una vez. Se
> recalculan leyendo las filas con
> [`contar-filas-de-la-matriz.py`](./contar-filas-de-la-matriz.py), que además avisa si
> quedó una fila sin estado o un identificador repetido.

> **De las 20 `UNKNOWN`, 16 sólo esperan que pase el tiempo** (`RN-1..3`, `GR-1..3`,
> `PS-2/4/5/6`, `DW-1/2`, `CT-1/3`, `GT-1`, `EX-1`): son las del reloj. Las otras cuatro son
> `WH-5` (se fuerza con el interruptor del receptor, **pero hacerlo ahora rompería la lectura
> del reloj**), `RC-3`, `RF-3` (necesita un pago de +180 días que no existe) y `EX-3`
> (**medida como inmedible en sandbox**, ver su fila).

> **El reloj está corriendo.** Siete suscripciones de **ciclo diario** quedaron vivas en el
> sandbox el 2026-09-15 a las 12:26–12:29 (manifiesto en `/tmp/mp-probe-05/manifiesto.json`).
> Las filas que dependen de que el proveedor ejecute un ciclo se leen con la
> [sonda 06](./mp-probes/probe-06-leer-el-reloj.sh) **a partir del 2026-09-16 ~11:30**.

> **El hallazgo que atraviesa todo lo demás**: Mercado Pago **acepta cambios que no aplica, y
> responde `2xx`**. **Siete** casos confirmados — el campo `items`, dos intentos aislados de
> cambiar `frequency`, un token de tarjeta guardada sin código de seguridad, una
> `notification_url` por suscripción, un `end_date` fijado sobre una suscripción ya
> autorizada, y —el séptimo, del 2026-09-15 a la tarde— el header **`X-Idempotency-Key` sobre
> `/preapproval`**, que se acepta y **no hace nada** (`EX-17`), mientras que en `/refunds` es
> **obligatorio** (`RF-4`). **Un `2xx` no significa que el cambio se haya aplicado**:
> toda mutación exige relectura y comparación campo por campo.
>
> **Y la regla vale en las dos direcciones.** Un error tampoco prueba que algo esté
> prohibido: prueba que no llegó a evaluarse. La sonda 18 lo volvió a mostrar —tres intentos
> murieron en un header faltante, antes de cualquier validación de negocio— y la 15 casi
> produce un `PARTIALLY_SUPPORTED` inventado para multi-moneda porque el proveedor **valida
> el monto antes que la moneda** y el mensaje del piso es ciego a la moneda.

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
| Agregadas por FASE 1C, segunda tanda | 4 — `RF-4`, `RF-5`, `EX-17`, `EX-18` |
| Agregadas por la tanda de producción | 4 — `RF-6`, `RF-7`, `RF-8`, `RC-4` |
| **Total** | **69** |

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
| FR-4 | Anual | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `frequency: 12, months`. **`"years"` NO existe**: `400`, válidos sólo `[days, months]`. Y `frequency: 5` se acepta: **los 4 ciclos del §19 son elección nuestra, no un límite del proveedor**. El rechazo de `"years"` **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 ([sonda 26](./mp-probes/probe-26-re-medir-en-produccion.mjs)) |

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
| CN-1 | Cancelación programada a fin de período | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sonda 12](./mp-probes/RESULTS-2026-09-15.md) | **Existe, pero sólo se puede fijar AL CREAR.** `auto_recurring.end_date` en la creación: `201` y **sobrevive a la relectura**. El mismo campo sobre una suscripción **ya autorizada**: `200` y **no aparece en la relectura** — sexto caso del §0. Consecuencia: una baja a fin de período **pedida después** hay que **emularla** con un cron, y un cron que se cae deja cobrando a quien pidió la baja. La mitad buena —`end_date` al crear— **RE-VERIFICADA EN PRODUCCIÓN** el 2026-09-15 ([sonda 26](./mp-probes/probe-26-re-medir-en-produccion.mjs)): se acepta y sobrevive a la relectura |
| CN-2 | Comportamiento inmediato del proveedor | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | Cancelación inmediata e **irreversible**, igual que `PA-5` |

## Cambios de precio — `BD-MP-03` (§29)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| PC-1 | Sobre una suscripción existente ya autorizada | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **El monto SÍ se muta sobre una autorizada**: 1500→2200→15→1500, todos `200`, verificado por relectura |
| PC-2 | Limitaciones: pisos, topes, magnitud del cambio | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02/05](./mp-probes/RESULTS-2026-09-15.md) | **Rango ARS 15 a ARS 2.000.000.** Piso: `400 "Cannot pay an amount lower than $ 15.00"`; cero y negativo, `400 "must be a positive number"`. Techo: `400 "Cannot pay an amount greater than $ 2000000.00"`. **Ninguna magnitud de cambio fue rechazada dentro del rango** (2000→15 y 2000→4000 pasaron). **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 ([sonda 26](./mp-probes/probe-26-re-medir-en-produccion.mjs)): 14 y 2.000.001 dan los mismos dos rechazos, palabra por palabra |
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
| RC-1 | Consultar el estado real de una suscripción | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) + [sonda 16](./mp-probes/probe-16-search-filtros.sh) | **`GET /preapproval/{id}` es confiable.** Del `search`, medido con control de basura sobre **153** suscripciones: **`payer_email` filtra** (basura → 0), **`status` filtra** (los 4 estados suman exactamente 153) y **los dos se componen**; **`external_reference` SE IGNORA** (basura → las 153). `/v1/payments/search` sí filtra por `external_reference`. **En PRODUCCIÓN (2026-09-15, sonda 21) aparece un tercer defecto que el sandbox no tenía: el filtro devuelve un SUBCONJUNTO.** `status=cancelled` trae **15** filas —paginadas y contadas, no es un `total` aproximado— y recorriendo las 76 sin filtro hay **69** canceladas. Faltan 54 y no hay ninguna señal de que falten. Los tres modos fallan en tres direcciones distintas: `external_reference` devuelve **TODO**, un `status` inválido devuelve **NADA**, y `status=cancelled` devuelve **ALGO PLAUSIBLE**. **El `search` no sirve como fuente de verdad de un barrido**: el estado se lee con `GET /preapproval/{id}` contra ids propios |
| RC-2 | Historial de pagos | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | Dos caminos funcionan: `/authorized_payments/search?preapproval_id=` y `/v1/payments/search?external_reference=` |
| RC-3 | Reparar el estado local desde el del proveedor | `UNKNOWN` | — | — | — | — |
| RC-4 ✚ | ¿El `search` devuelve los mismos campos que el `GET`? | **`NOT_SUPPORTED`** | 2026-09-15 | **producción** | [sonda 21](./mp-probes/probe-21-produccion-el-filtro-miente.mjs) | **No.** Sobre la misma suscripción y en el mismo momento, el `search` devuelve **`next_payment_date: null`** y **`summarized: {}`**, mientras el `GET` trae `next_payment_date` real y el `summarized` completo. `status`, `auto_recurring`, `payer_id` y `external_reference` sí coinciden. Un barrido que lea del `search` puede concluir que no hay próximo cobro cuando lo hay |

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
| RF-1 | Reembolso total de un cobro | **`VERIFIED`** | 2026-09-15 | **producción** | [sonda 11 + ejecución directa](./mp-probes/RESULTS-2026-09-15.md) | **Funciona.** `POST /v1/payments/{id}/refunds` **sin body** sobre un pago propio de ARS 15: `201`, refund `3269585727`, y **verificado por relectura** — el pago quedó `status: refunded`, `transaction_amount_refunded: 15`. **La variable era la CUENTA, no el código ni la API**: la misma llamada, con la misma forma, da `401` con la cuenta de prueba y entra con la real (`HOSPEDA_COM_AR`, `3497516165`, sin tag `test_user`) |

**Y ya no es hipótesis.** Se creó una **segunda app** con producto Checkout API / API de Payments, bajo el MISMO vendedor de prueba, cuyos scopes incluyen `urn:mp:online:payments:refunds/`**`read-write`**. Con ella: reembolsar → **`401`**, y **crear un pago** (`POST /v1/payments`) → **`401` también**. O sea que **el vendedor de prueba no puede escribir sobre la API de Payments en absoluto**, cualquiera sea la app o sus scopes. Las suscripciones funcionan porque **los pagos los crea el proveedor**, no nosotros. Para medir `RF-*` hace falta una cuenta que no sea de prueba, o que soporte de MP lo habilite |
| RF-2 | Reembolso parcial | **`VERIFIED`** | 2026-09-15 | **producción** | [sondas 22/23/24](./mp-probes/RESULTS-2026-09-15.md) | **Funciona en los DOS tipos de pago** y **NO hay monto mínimo**: la conclusión anterior (*"hay un mínimo entre 5 y 50"*) era un **diagnóstico equivocado** y lo mató el primer experimento — ARS **5** entró sobre un pago de 5.000, y también sobre uno de 7.500. Lo medido: (1) el parcial **valida contra el SALDO, no contra el monto original** — pedir 15 con 10 de saldo da `400 code 2017` aunque el pago valga 5.000; (2) los **parciales acumulativos completan el total** y el pago pasa a **`refunded/refunded` solo** (5 + 5 sobre un saldo de 10); (3) se reembolsó 4.875 dejando un resto de **10**, así que tampoco hay piso del resto. Ver **`RF-8`** para el rechazo que quedó sin explicar |
| RF-3 | Plazo máximo para reembolsar un cobro | `UNKNOWN` | — | — | — | Se reembolsó un pago de **65 días** sin problema, así que el plazo es **mayor que eso**. La documentación dice 180 días desde la aprobación, pero el §58 no acepta documentación para cerrar una fila, y forzar el borde exigiría un pago de más de 180 días que no existe todavía |
| RF-4 ✚ | ¿El reembolso exige clave de idempotencia? | **`VERIFIED`** | 2026-09-15 | **producción** | [sonda 18](./mp-probes/probe-18-errores-de-reembolso.mjs) | **`X-Idempotency-Key` es OBLIGATORIO en `POST /v1/payments/{id}/refunds`**: sin él, `400 code 4292 "Header X-Idempotency-Key can't be null"`, **antes** de cualquier validación de negocio. Es la **contracara exacta** de `EX-17`: el mismo header, en `/preapproval`, se acepta y no hace nada. **La idempotencia de este proveedor es POR ENDPOINT** y no se puede razonar de uno al otro. Medido **dos veces**, en dos sondas distintas. **La contradicción que se había registrado con `RF-1` no existe**: la sonda 11 **sí manda el header** (dos veces en su propio código), y como el header es obligatorio, cualquier `201` necesariamente lo llevaba. Era una suposición, no una medición |
| RF-5 ✚ | Forma del error cuando el reembolso NO corresponde | **`VERIFIED`** | 2026-09-15 | **producción** | [sonda 18](./mp-probes/probe-18-errores-de-reembolso.mjs) | Sobre un pago con saldo reembolsable **cero**, y verificado por relectura de que ningún intento entró: total sin body → `400` **`code 2063`** *"The action requested is not valid for the current payment state"*; `amount` mayor al saldo → `400` **`code 2017`** *"Invalid transaction_amount for update"*; `amount` igual al total ya devuelto → **el mismo `2017`**. **El `message` NO alcanza** (dos situaciones distintas comparten texto): el contrato se arma sobre **`cause[0].code`**. `2063` habla del ESTADO del pago y `2017` del MONTO — que es justo la distinción que un reintento necesita entre *"ya está hecho, seguí"* y *"el monto que tenía guardado está mal"*. **Hueco nombrado**: el rechazo por monto bajo el mínimo trae otro texto (*"This transaction does not support to be refunded"*) y **su código no quedó registrado** |

## ✚ Huecos estructurales

| # | Comportamiento | Para qué | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|---|
| RF-6 ✚ | ¿El reembolso es idempotente? | **`VERIFIED`** | 2026-09-15 | **producción** | [sonda 22](./mp-probes/probe-22-tanda-de-reembolsos.mjs) | **SÍ.** La misma `X-Idempotency-Key` con el mismo cuerpo, sobre un pago con saldo: el primero `201` (refund `3328707782`), el segundo **`200` con cuerpo vacío y NINGÚN reembolso nuevo** — la cuenta lo confirma, se movieron ARS 10 y no 15. **Cierra el círculo con `EX-17`**: el mismo header que en `/preapproval` no hace nada, acá es obligatorio Y se respeta. Dos trampas para quien implemente: la repetición devuelve **`200`, no `201`** (un cliente que sólo acepte `201` trata una reentrega correcta como fallo), y **no devuelve el refund original** en el cuerpo, así que hay que tenerlo guardado |
| RF-7 ✚ | ¿Un reembolso emite webhook? | **`VERIFIED`** | 2026-09-15 | **producción** | [logs de la API de producción](./mp-probes/RESULTS-2026-09-15.md) | **SÍ, tres entregas por reembolso**: `?data.id=<pago>&source_news=webhooks&type=payment` (Webhooks), `?id=<pago>&topic=payment` e `?id=…&topic=merchant_order` (los dos, **IPN**). Los tres `200`. **Esta fila estaba registrada como bloqueada** —*"el receptor está atado a la app de prueba"*— y el razonamiento tenía un agujero: **la API de producción ES un receptor y sus logs se leen**. **Los dos formatos NO son un hallazgo**: el owner confirma que Mercado Pago tiene IPN y Webhooks andando a la vez, y que el `source_news=webhooks` se agregó para **filtrar y descartar las de IPN**. Los tiempos del log lo sostienen sin mirar código: el de Webhooks tarda **446 ms** y deja la línea `Payment updated`; los dos IPN vuelven en **5 ms** y no dejan ninguna. O sea que el descarte **se ve funcionando en la medición**. Lo que aporta la fila es **la cuenta**: tres entregas por hecho, una sola procesada |
| RF-8 ✚ | El rechazo `code 2084`, sin explicación | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | **producción** | [sonda 24](./mp-probes/probe-24-el-pago-de-quince-pesos.mjs) | **Lo que está probado es negativo y alcanza para el contrato: `2084` NO es una propiedad del pago.** Sobre UN MISMO pago de ARS 15, `amount: 5` dio `400 code 2084` y `amount: 14` dio `201` minutos después; con 1 de saldo, tanto `amount: 1` como el total sin body volvieron a dar `2084`. Y el mismo `amount: 5` entra en pagos de 5.000 y 7.500. **Cuatro hipótesis murieron** (piso del monto, piso del resto, tipo de transacción, "un pago al mínimo no admite parciales") y **la regla real no se pudo determinar**. El mensaje —*"This transaction does not support to be refunded"*— afirma lo contrario de lo medido. **Consecuencia**: ante un `2084` el reconciliador NO puede dar de baja el intento; reintenta con otro monto o cae al total |
| EX-1 | Qué pasa con una autorización creada y **nunca completada**: ¿vence?, ¿cuándo?, ¿se puede reusar? | `M-SUB-01`, `M-MP-02` | `UNKNOWN` | — | — | — | ⏳ **sujeto vivo**: `sin-autorizar` (`bf9b6feb…`), `pending` desde el 2026-09-15 12:26 |
| EX-2 | ¿Los eventos del proveedor traen **orden confiable** (versión o timestamp)? | `M-CONC-02` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 08/09](./mp-probes/RESULTS-2026-09-15.md) | **SÍ: el cuerpo trae `version`, un contador monótono POR RECURSO.** Medido con receptor propio: el mismo preapproval llegó con `version` 4, 6, 7, 8 en el orden causal de las acciones. Es lo que `M-CONC-02` necesita y **es más fuerte que el id del evento**, que cambia en cada reentrega. Corrige por ampliación la lectura anterior, que se había hecho sobre la tabla ya normalizada de staging y no veía este campo |
| EX-3 | ¿Qué le comunica el proveedor **al cliente, por su cuenta**, al cancelar / pausar / modificar? | `M-MAIL-04` | `UNKNOWN` — **y medido por qué** | 2026-09-15 | sandbox | [sonda 17](./mp-probes/probe-17-casilla-del-comprador.sh) | **INMEDIBLE EN SANDBOX, y no por falta de un acceso.** El comprador de prueba es `…@testuser.com`, cuyo **único MX es `localhost`** —un agujero negro: ningún servidor de correo del mundo puede entregar ahí— y cuyo dominio ni siquiera es de Mercado Pago (está parqueado y en venta). El correo que esta fila quiere observar **no se puede haber enviado**. Tampoco hay vía por API: `/users/test_user` → `405`, `/messages/packs` → `404`. **Pedir la casilla ya no sirve**: la única vía que queda es observarlo en **producción** sobre un cliente real, y eso es una decisión del owner, no un experimento |
| EX-4 | Cambio de **frecuencia** sobre una suscripción ya autorizada | `BD-SUB-01`, `MP-01` | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **El ciclo NO se puede cambiar, y falla en silencio**: `200` en dos intentos aislados (12 y 3 meses) y `frequency` siguió en 1 |
| EX-5 | ¿Una autorización puede cubrir **más de un monto**? | `BD-MP-04` | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `auto_recurring` como array → `400`. Campo `items` → **`201` y se descarta en silencio**: no vuelve en la respuesta, queda un solo monto. **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 ([sonda 26](./mp-probes/probe-26-re-medir-en-produccion.mjs)): el array da `400 "Parameters passed are invalid"` y `items` se vuelve a descartar en silencio |
| EX-6 | N autorizaciones del mismo pagador conviviendo, ya autorizadas | `BD-MP-04` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | Dos autorizadas del mismo pagador conviven sin conflicto |
| EX-7 | Compensar días ya pagados corriendo la **primera fecha de cobro** | `BD-SUB-01` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `start_date` a +20 días → `next_payment_date` en esa fecha |
| EX-9 | ¿Se puede tokenizar una tarjeta **ya guardada**, server-side? | `DEC-SUB-005` | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02/03](./mp-probes/RESULTS-2026-09-15.md) | **Sí, pero exige el código de seguridad.** Con `card_id` solo, el token se genera (`201`) y **no sirve**: `400 "Card token was generated without cvv validation"`. Con `card_id` + `security_code`, funciona |
| EX-10 | ¿Ese token crea una suscripción autorizada real? | `DEC-SUB-005` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02/03](./mp-probes/RESULTS-2026-09-15.md) | `201` y **verificado por relectura independiente**: `authorized`, ciclo nuevo (3 meses), primer cobro corrido a +18 días, **cero cobro al crear** |
| EX-8 | ¿Se respeta esa primera fecha **después** de autorizar? | `BD-SUB-01` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **Sí se respeta tras autorizar.** Además **no cobra al crearse**. El proveedor lo modela como un `free_trial` de 20 días que nosotros no pedimos |
| EX-11 | ¿Qué se puede hacer sobre una suscripción **pausada**? | `BD-MP-01`, acota `DEC-MP-001` | **`VERIFIED`** | 2026-09-15 | sandbox | [sonda 07](./mp-probes/RESULTS-2026-09-15.md) | **Estando pausada NO se puede modificar nada**: cambiar el monto da `400 "You can not modify a paused preapproval."` y el monto no se mueve. **Con control**: el mismo payload, sobre la misma suscripción ya reanudada, entra (`200`, monto cambiado) — o sea que **bloquea el estado, no la operación**. **Cancelar SÍ funciona estando pausada** (`200` → `cancelled`): la pausa no atrapa al cliente |
| EX-12 | ¿Un `card_token` sirve para más de una suscripción? | `DEC-SUB-005`, reintentos | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sonda 05](./mp-probes/RESULTS-2026-09-15.md) | **Un solo uso.** Del segundo en adelante: `400 "Card token was used, please generate new"`. Todo reintento de creación tiene que **tokenizar de nuevo**, y el mensaje de error no se parece en nada a "reintentaste" |
| EX-13 | ¿Los eventos vienen **firmados**, y se puede verificar la firma? | §51, `M-CONC-01` | **`VERIFIED`** | 2026-09-15 | sandbox | [sonda 10](./mp-probes/RESULTS-2026-09-15.md) | **La firma se verifica.** `x-signature: ts=<epoch>,v1=<hex64>` + `x-request-id`, y el `v1` es **HMAC-SHA256** con la clave de la aplicación sobre el manifiesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` — **el punto y coma final incluido**: sin él no coincide. Reproducido sobre **tres** entregas reales de tipos distintos, con control de la propia herramienta (vector RFC 4231). La URL del receptor no es un agujero abierto |
| EX-14 | ¿Se puede distinguir **sandbox de producción** mirando el evento? | `M-MP-01`, riesgo operativo | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 08/09](./mp-probes/RESULTS-2026-09-15.md) | **No.** Un `payment.created` de la cuenta de prueba (`tags:["test_user"]`) llega con **`live_mode: true`**. Un handler que filtre por ese campo trata los eventos de sandbox como productivos |
| EX-16 | ¿Se puede conciliar una suscripción **SIN** la API de Payments? | `R-MP-01`, §23, §57 | **`VERIFIED`** | 2026-09-15 | sandbox | [sonda 13](./mp-probes/RESULTS-2026-09-15.md) | **Sí, entera.** `GET /authorized_payments/search?preapproval_id=` y `GET /authorized_payments/{id}` pertenecen a la familia de **suscripciones**, no a `/v1/payments`, y traen todo lo que la conciliación necesita: `status`, `transaction_amount`, `currency_id`, `debit_date`, `date_created`, `last_modified`, `payment_method_id`, **`retry_attempt`**, y el pago embebido (`payment.id`, `payment.status`, `payment.status_detail`). El `search` **exige** filtro y **filtra bien por `preapproval_id`** (1 con el real, 0 con basura); por `external_reference` **no filtra** — mismo defecto que `RC-1`, y da igual porque el id del proveedor ya se guarda. **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 ([sondas 20/21](./mp-probes/probe-21-produccion-el-filtro-miente.mjs)), pero con una trampa que casi lo tumba: contra las 4 suscripciones `authorized` de producción devuelve **0**, y eso parecía refutar la fila. No la refuta — **ninguna de las cuatro cobró todavía** (las cuatro están en `free_trial` de 30 o 90 días). Contra la suscripción que **sí** cobró trae los dos cobros completos. **El primer resultado era un falso negativo perfecto**, y lo que lo destapó fue preguntar por el SUJETO, no por el endpoint |
| EX-17 | ¿La **creación** de una suscripción es idempotente? | `M-CONC-01` | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox **+ producción** | [sonda 14](./mp-probes/probe-14-idempotencia-de-creacion.sh) | **No deduplica por ningún mecanismo.** Corrida dos veces, **diez sujetos, diez ids distintos**: (a) mismo `external_reference` sin header → dos `201` distintos; (b) misma `X-Idempotency-Key` con cuerpo idéntico → dos `201` distintos; (c) misma clave con **monto distinto** → un tercer `201` con el monto nuevo. El caso (c) es el que cierra la pregunta: el header **no tiene ningún efecto** sobre `/preapproval` — se acepta y no hace nada, otra forma del §0. **Consecuencia: el candado es nuestro o no existe**, y tiene que estar ANTES de llamar al proveedor. El daño no es simétrico: dos `pending` no cobran, pero una creación **con `card_token_id`** queda autorizada y **cobra en el acto** (`PA-3`), así que ahí un reintento son **dos cobros**. De yapa: **un `pending` SE PUEDE cancelar** (11 de 11, verificado por relectura). **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 ([sonda 26](./mp-probes/probe-26-re-medir-en-produccion.mjs)): los tres casos dan idéntico resultado que en sandbox.|
| EX-18 | ¿Se puede cobrar en una **moneda** que no sea ARS? | `M-MP-01` | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox **+ producción** | [sonda 15](./mp-probes/probe-15-moneda.sh) | **Sólo ARS** en esta cuenta (`site_id: MLA`). `USD 100` y `BRL 50` → `400 "Invalid field -> auto_recurring.currency_id"`. **El modelo de datos no necesita moneda por plan, por suscripción ni por cobro.** Y deja una regla para el contrato de errores que casi produce un `PARTIALLY_SUPPORTED` inventado: **el proveedor valida el MONTO antes que la MONEDA, y el mensaje del piso es ciego a la moneda** — `USD 10` devuelve *"Cannot pay an amount lower than $ 15.00"*, y también lo devuelve `BRL 10`, con `BRL` ya sabida inválida. **Un `400` de monto no dice nada sobre si la moneda era válida**. **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 ([sonda 26](./mp-probes/probe-26-re-medir-en-produccion.mjs)): `USD` y `BRL` dan el mismo `400`.|
| EX-15 | ¿Qué operaciones **NO** emiten webhook? | `DEC-MP-001`, §23, §51 | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 08/09](./mp-probes/RESULTS-2026-09-15.md) | **Mutar el monto NO emite ninguna entrega.** Medido con 90 s entre acciones: ventana de 91 s sin eventos, con la mutación aplicada — y la `version` del recurso saltó de 5 a 9, o sea que **el recurso cambió y el proveedor no avisó**. Crear, pausar, reanudar y cancelar **sí** notifican. Consecuencia: un cambio de precio **no tiene vía de confirmación asincrónica** y sólo se puede comprobar releyendo |

> `EX-7` y `EX-8` van separadas a propósito: que el proveedor **acepte** una fecha futura al
> crear no prueba que la **respete** una vez autorizada, y ésa es la que decide. Una fila que
> sólo se probó antes de autorizar no responde por el comportamiento después.

---

## Resumen

| Estado | Filas |
|---|---|
| `VERIFIED` | **31** |
| `PARTIALLY_SUPPORTED` | **11** — `PA-2`, `RC-1`, `PS-1`, `PS-3`, `CN-1`, `UP-1`, `UP-2`, `CT-2`, `WH-3`, `EX-9`, **`RF-8`** |
| `NOT_SUPPORTED` | **7** — `EX-4` (cambio de ciclo), `EX-5` (más de un monto), `EX-12` (reusar un token), `EX-14` (distinguir entorno), `EX-17` (creación idempotente), `EX-18` (otra moneda), **`RC-4`** (el `search` devuelve menos campos que el `GET`) |
| **`UNKNOWN`** | **20** — 16 esperan el reloj; las otras son `WH-5`, `RC-3`, `RF-3` y `EX-3` |

Recalculado con [`contar-filas-de-la-matriz.py`](./contar-filas-de-la-matriz.py) el
2026-09-15, sobre **69** filas.

**Lo más grave que dejó la tanda de producción**, y que en sandbox era invisible: el `search`
de suscripciones tiene **tres modos de falla en tres direcciones distintas** —devuelve TODO
(`external_reference` ignorado), devuelve NADA (`status` inválido → `200` con `total: 0`) y
devuelve **UN SUBCONJUNTO PLAUSIBLE** (`status=cancelled` trae 15 de 69)— y ninguno da error.
Ver `RC-1` y `RC-4`.

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
| `M-LEGAL-01` revocación con devolución | `RF-1` ✅, `RF-3`. `RF-4`/`RF-5` ✅ dan el contrato de errores |
| `M-CONC-01` nada se cobra dos veces | ✅ **`EX-17`**: el proveedor **no deduplica**, así que el candado es nuestro |
| `M-MP-01` moneda | ✅ **`EX-18`**: sólo ARS |
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
