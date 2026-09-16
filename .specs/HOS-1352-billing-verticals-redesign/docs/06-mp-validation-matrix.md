---
title: Matriz de validación de Mercado Pago (FASE 1C)
linear: HOS-1352
statusSource: linear
created: 2026-09-15
status: CURRENT
phase: 1C
---

# Matriz de validación de Mercado Pago

**FASE 1C en curso.** Tras las [sondas 01 a 41](./mp-probes/RESULTS-2026-09-15.md) del 2026-09-15
y 09-16: **44 filas `VERIFIED`, 14 `PARTIALLY_SUPPORTED`, 14 `NOT_SUPPORTED`, 12 `UNKNOWN`**,
sobre **84**.

> **La pregunta de fondo quedó contestada, y en contra: el ciclo de cobro NO puede ser nuestro.**
> El proveedor sí tiene un modelo donde el comercio decide cuándo cobrar —`/v1/orders` con
> `stored_credential`, y Wallet Connect— pero **está reservado a vendedores con más de 100.000
> usuarios** (`EX-32`). Hospeda tiene 3. Las tres filas nuevas (`EX-30` a `EX-32`) miden eso y
> dejan una capacidad aprovechable hoy: **el cobro de ÚNICA VEZ por `/v1/orders` funciona sin
> ninguna habilitación especial**, así que un addon one-time no necesita pasar por `preapproval`.

> **El modelo de PLANES (`/preapproval_plan`) entró a la matriz con nueve filas** (`EX-21` a
> `EX-29`). Las 71 anteriores se habían medido **todas** sobre suscripciones sueltas. Lo que
> decidía era `EX-21` —si una suscripción viva se puede mover de un plan a otro— y salió
> **`NOT_SUPPORTED` con un `200`**: el campo se descarta en silencio. **Los planes no resuelven
> el cambio de ciclo individual.** Lo que sí abrieron: **editar el monto de un plan alcanza a
> los ya suscriptos** (`EX-23`), que sería un cambio de precio masivo que `DEC-MP-001` no
> consideró — falta un cobro ejecutado para saber si propaga de verdad o la lectura miente, y
> hay dos sujetos puestos para eso.

> **El reloj de producción cobró a las 26 minutos y cerró siete filas de una** (`UP-1`, `UP-2`,
> `DW-1`, `DW-2`, `CT-3`, `PS-2`, `GT-1`), más media `RN-1` y media `CT-1`. El resultado que más
> pesa: **el proveedor cobra el monto VIGENTE al momento del cobro, no el del alta** — medido con
> dos sujetos que se movieron en direcciones opuestas, uno cobró 30 habiendo nacido en 15 y el
> otro cobró 15 habiendo nacido en 30.

> **Ya no falta ningún permiso, ninguna credencial ni ningún endpoint.** Con la tarjeta real
> del owner se cerró todo lo que se podía medir sin esperar — y **sin cobrar un peso**, creando
> las suscripciones con `start_date` a +30 días y cancelándolas minutos después.
>
> De las 20 `UNKNOWN`, **16 esperan que un ciclo SE EJECUTE** (`RN-1..3`, `GR-1..3`,
> `PS-2/4/5/6`, `DW-1/2`, `CT-1/3`, `GT-1`, `EX-1`). Las otras cuatro no, y cada una por su
> motivo: `WH-5` se fuerza con el interruptor del receptor **pero hacerlo rompería la lectura
> del reloj**, `RC-3` es una pregunta de diseño más que de proveedor y `RF-3` necesita un pago de
> más de 180 días **que todavía no existe**. **`EX-3` ya no está entre ellas**: era inmedible en
> sandbox, y el reloj de producción convirtió al propio owner en el cliente que había que
> observar — 43 correos del proveedor en un día.

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
> responde `2xx`**. **Nueve** casos confirmados — el campo `items`, dos intentos aislados de
> cambiar `frequency`, un token de tarjeta guardada sin código de seguridad, una
> `notification_url` por suscripción, un `end_date` fijado sobre una suscripción ya
> autorizada, y —el séptimo, del 2026-09-15 a la tarde— el header **`X-Idempotency-Key` sobre
> `/preapproval`**, que se acepta y **no hace nada** (`EX-17`), mientras que en `/refunds` es
> **obligatorio** (`RF-4`); el octavo, `currency_id` sobre una suscripción ya autorizada, que
> vuelve `200` y sigue en `ARS` —**asimétrico**, porque al crear la misma moneda da `400`—; y el
> noveno, que es el peor de todos: **un `PUT` con varios campos se aplica A MEDIAS** (`EX-20`),
> con un solo `200` para un campo que entró y otro que no.
> **Un `2xx` no significa que el cambio se haya aplicado**: toda mutación exige relectura y
> comparación **campo por campo de cada campo que se mandó** — releer "la mutación" no alcanza,
> porque el campo que falla no arrastra al que funciona.
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
| Agregadas con la tarjeta real | 2 — `EX-19`, `EX-20` |
| Agregadas por el modelo de **planes** (`/preapproval_plan`) | 9 — `EX-21` a `EX-29` |
| Agregadas por **cobrar sin suscripción** (`/v1/orders`, Wallet Connect) | 3 — `EX-30` a `EX-32` |
| Abierta por `DEC-SUB-006` | 1 — `EX-33` |
| **Total** | **84** |

Columnas: **Estado** · **Fecha** · **Entorno** · **Evidencia** (ruta de la sonda, con request,
response y webhook observado) · **Conclusión**.

---

# Matriz mínima del §60

## Preapproval

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| PA-1 | Creación por API | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `201`, `status: pending`, `init_point` presente, sin cobrar |
| PA-2 | Linking con nuestro dominio desde el inicio | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `external_reference` se acepta y vuelve en la respuesta y en el `GET`. **Pero el `search` no filtra por él** — ver `RC-1` |
| PA-3 | Autorización por el usuario | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **Se autoriza por API, sin navegador**: `card_token_id` + `status:"authorized"` → `201` autorizada. **Y cobra en el acto** si no se manda `start_date` — **pero eso es SANDBOX. En PRODUCCIÓN DIVERGE**: medido el 2026-09-15, autorizar deja un `card_validation` de ARS 0 y **el cobro llega ~26 minutos después** (creación 19:35, cobro 20:01, cuatro sujetos). Es la única divergencia de COMPORTAMIENTO —no de permisos— encontrada entre los dos entornos. **Consecuencia**: entre autorizar y cobrar hay una ventana de media hora con la suscripción `authorized` y sin pagar; cualquier lógica que pregunte "¿ya pagó?" justo después del alta lee que no |
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
| RN-1 | Cobro exitoso | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | **producción** | [sonda 29 · primer cobro del reloj de producción](./mp-probes/probe-29-el-reloj-de-produccion.mjs) | **El primer cobro funciona**: `renov-ok` cobró ARS 15 (`178259523769`, `approved/accredited`, `recurring_payment`), con comisión 1,20 y neto 13,80. **La parte que falta es la RENOVACIÓN**: que vuelva a cobrar en el ciclo siguiente. ⏳ se lee el 2026-09-16 ~20:40 |
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
| PS-1 | Pausar | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | La **transición** funciona (`PUT {status:"paused"}` → `200`). Los efectos sobre el cobro no se midieron: ver `PS-2`. **RE-VERIFICADO EN PRODUCCIÓN CON TARJETA REAL** el 2026-09-15 ([sonda 28](./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs)), sobre suscripciones autorizadas con `start_date` a +30 días — que no cobran: la corrida entera cerró con **cero cobros** |
| PS-2 | Que no cobre mientras está pausada | **`VERIFIED`** | 2026-09-15 | **producción** | [sonda 29 · primer cobro del reloj de producción](./mp-probes/probe-29-el-reloj-de-produccion.mjs) | **Pausada NO cobra.** `pausa-real` tenía su `next_payment_date` en el mismo instante que las cuatro que cobraron, se pausó ~26 minutos antes de que el proveedor ejecutara el ciclo, y **no cobró**. Lo que queda probado es la pregunta operativa: **pausar ANTES de que el cobro se ejecute lo evita**. ⚠️ Y un detalle que sorprende: **la pausa NO congela el calendario** — su `next_payment_date` igual se corrió +24 h sin haber cobrado |
| PS-3 | Reanudación anticipada por el usuario (§26.2) | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | La **transición** funciona (`PUT {status:"authorized"}` → `200`). **RE-VERIFICADO EN PRODUCCIÓN CON TARJETA REAL** el 2026-09-15 ([sonda 28](./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs)), sobre suscripciones autorizadas con `start_date` a +30 días — que no cobran: la corrida entera cerró con **cero cobros** |
| PS-4 | Reanudación automática al llegar la fecha (§26.2) | **`NOT_SUPPORTED`** | 2026-09-16 | sandbox | [foto de línea de base](./mp-probes/fotos-reloj-2026-09-16/pausa-real-linea-de-base.json) · [sonda 06](./mp-probes/probe-06-leer-el-reloj.sh) | **No existe la auto-reanudación.** `pausa-real` se pausó el 2026-09-15 ~12:29 y a las **24,5 h** (2026-09-16T12:54:45-03) seguía `paused`, con `last_modified` todavía en el instante de la pausa: nadie la movió, y el proveedor tampoco. Concuerda con la doc oficial, que sólo ofrece reactivar con un `PUT {status:"authorized"}` — **MP no tiene un `pauseUntil`**: la fecha de fin de pausa es un concepto NUESTRO y el reloj que la dispara tiene que ser nuestro |
| PS-5 | Qué pasa con las fechas al reanudar | **`VERIFIED`** | 2026-09-16 | sandbox | [antes](./mp-probes/fotos-reloj-2026-09-16/pausa-real-antes-de-reanudar.json) · [después](./mp-probes/fotos-reloj-2026-09-16/pausa-real-despues-de-reanudar.json) | **Reanudar cambia SÓLO el `status`.** Sobre una pausa **real de 24,5 h**, el `PUT {status:"authorized"}` (2026-09-16T12:56:15-03, confirmado por `last_modified`, no por el 200) dejó `next_payment_date` **clavado en 2026-09-17T11:28:03-04**, el mismo valor que ya tenía pausada. Ni se adelanta ni se corre. Re-leído a los 3 min: idéntico |
| PS-6 | Qué pasa con la fecha de cobro al reanudar (§26.4) | **`NOT_SUPPORTED`** | 2026-09-16 | sandbox + **producción** | [antes](./mp-probes/fotos-reloj-2026-09-16/pausa-real-antes-de-reanudar.json) · [después](./mp-probes/fotos-reloj-2026-09-16/pausa-real-despues-de-reanudar.json) · `PS-2` (prod) | **El período pagado durante la pausa se PIERDE, y el proveedor no ofrece nada para recuperarlo.** Tres hechos encadenados: (1) pausar **no** corre la fecha en el acto — cadena crear→pausar→reanudar de las [sondas 07/07b](./mp-probes/probe-07-que-se-puede-sobre-una-pausada.sh), segundos, `next` idéntico en los tres pasos; (2) el ciclo que vence **estando pausada** igual avanza `next_payment_date` +1 ciclo sin cobrar — `pausa-real` nació con `next`=2026-09-16T11:28:03-04 ([creacion.log](./mp-probes/fotos-reloj-2026-09-16/creacion-del-reloj-2026-09-15.log)) y al día siguiente leía **2026-09-17** ([línea de base](./mp-probes/fotos-reloj-2026-09-16/pausa-real-linea-de-base.json)), y lo mismo se había medido ya en **producción** (`PS-2`); (3) al reanudar no hay cobro de recuperación ni deuda acumulada (`cobros`=1, `charged_amount`=2000, sin `pending_charge_*`). **Conclusión: §26.4 NO es delegable a MP.** Si el usuario no debe perder días pagos, los sostenemos nosotros — mismo patrón que `DEC-SUB-009` |

## Cancelación (§24)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| CN-1 | Cancelación programada a fin de período | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sonda 12](./mp-probes/RESULTS-2026-09-15.md) | **Existe, pero sólo se puede fijar AL CREAR.** `auto_recurring.end_date` en la creación: `201` y **sobrevive a la relectura**. El mismo campo sobre una suscripción **ya autorizada**: `200` y **no aparece en la relectura** — sexto caso del §0. Consecuencia: una baja a fin de período **pedida después** hay que **emularla** con un cron, y un cron que se cae deja cobrando a quien pidió la baja. La mitad buena —`end_date` al crear— **RE-VERIFICADA EN PRODUCCIÓN** el 2026-09-15 ([sonda 26](./mp-probes/probe-26-re-medir-en-produccion.mjs)): se acepta y sobrevive a la relectura. Y la mala también: **RE-VERIFICADO EN PRODUCCIÓN CON TARJETA REAL** el 2026-09-15 ([sonda 28](./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs)), sobre suscripciones autorizadas con `start_date` a +30 días — que no cobran: la corrida entera cerró con **cero cobros**, el `end_date` sobre una autorizada vuelve a dar `200` sin aparecer en la relectura, solo y acompañado de un cambio de monto |
| CN-2 | Comportamiento inmediato del proveedor | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | Cancelación inmediata e **irreversible**, igual que `PA-5` |

## Cambios de precio — `BD-MP-03` (§29)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| PC-1 | Sobre una suscripción existente ya autorizada | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **El monto SÍ se muta sobre una autorizada**: 1500→2200→15→1500, todos `200`, verificado por relectura. **RE-VERIFICADO EN PRODUCCIÓN CON TARJETA REAL** el 2026-09-15 ([sonda 28](./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs)), sobre suscripciones autorizadas con `start_date` a +30 días — que no cobran: la corrida entera cerró con **cero cobros** |
| PC-2 | Limitaciones: pisos, topes, magnitud del cambio | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02/05](./mp-probes/RESULTS-2026-09-15.md) | **Rango ARS 15 a ARS 2.000.000.** Piso: `400 "Cannot pay an amount lower than $ 15.00"`; cero y negativo, `400 "must be a positive number"`. Techo: `400 "Cannot pay an amount greater than $ 2000000.00"`. **Ninguna magnitud de cambio fue rechazada dentro del rango** (2000→15 y 2000→4000 pasaron). **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 ([sonda 26](./mp-probes/probe-26-re-medir-en-produccion.mjs)): 14 y 2.000.001 dan los mismos dos rechazos, palabra por palabra |
| PC-3 | ¿Requiere nuevo consentimiento del usuario? | **`VERIFIED`** | 2026-09-15 | sandbox **+ producción** | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **Dos mitades, y el §60 pide las dos.** **Consentimiento**: NO requiere uno nuevo — la mutación se aplica sola y la suscripción sigue `authorized` con su medio de pago (re-verificado en producción con tarjeta real). **Notificación**: **el proveedor SÍ le avisa al cliente, por su cuenta y por correo**, diciendo *"El vendedor Hospeda cambió el monto"* (`EX-3`). Y como `EX-15` midió que mutar el monto **no emite webhook**, **el cliente se entera antes que nuestro propio sistema**. Un cambio de precio silencioso **no existe**, y nuestra comunicación sobre el tema llega segunda o es redundante |

> `PC-3` decide si se pueden actualizar precios sin perder la base instalada. `PC-2` también
> alimenta el piso de `A-PROMO-01` y la estrategia de bajar el monto de `BD-MP-02`.

## Upgrade (§27)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| UP-1 | Aplicación inmediata | **`VERIFIED`** | 2026-09-15 | sandbox **+ producción** | [sonda 29 · primer cobro del reloj de producción](./mp-probes/probe-29-el-reloj-de-produccion.mjs) | **El monto nuevo queda aplicado en el acto** (verificado por relectura) y **se cobra en el cobro siguiente**: `monto-sube` nació en 15, se subió a 30, y **cobró 30** (`178259807447`). `next_payment_date` no se mueve por la mutación |
| UP-2 | Efecto económico: prorrateo, cobro inmediato, o nada | **`VERIFIED`** | 2026-09-15 | sandbox **+ producción** | [sonda 29 · primer cobro del reloj de producción](./mp-probes/probe-29-el-reloj-de-produccion.mjs) | **NO hay prorrateo y NO hay cobro inmediato de la diferencia.** El efecto es simple: **se cobra el monto VIGENTE al momento del cobro**, no el del alta. Medido con dos sujetos en direcciones opuestas — `monto-sube` 15→30 cobró **30**, `monto-baja` 30→15 cobró **15**. ⚠️ Esto mide un cambio aplicado **antes del primer cobro**; que la regla se sostenga sobre una suscripción **que ya cobró** lo dice la lectura del 2026-09-16 |

## Downgrade (§28)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| DW-1 | Aplicación al ciclo siguiente | **`VERIFIED`** | 2026-09-15 | **producción** | [sonda 29 · primer cobro del reloj de producción](./mp-probes/probe-29-el-reloj-de-produccion.mjs) | **Se aplica al cobro siguiente, sin emular nada**: `monto-baja` nació en 30, se bajó a 15 y **cobró 15** (`178259931089`). Misma regla que `UP-2`, en la otra dirección |
| DW-2 | ¿Lo soporta el proveedor, o hay que emularlo? | **`VERIFIED`** | 2026-09-15 | **producción** | [sonda 29 · primer cobro del reloj de producción](./mp-probes/probe-29-el-reloj-de-produccion.mjs) | **Lo soporta el proveedor: no hay que emularlo.** Mutar el monto hacia abajo alcanza, y el cobro siguiente sale por el monto nuevo |

## Cortesía temporal — `BD-MP-02` (§34.2)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| CT-1 | N meses gratis sobre una suscripción viva | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | **producción** | [sonda 29 · primer cobro del reloj de producción](./mp-probes/probe-29-el-reloj-de-produccion.mjs) | **Funciona, pero "gratis" no existe.** Bajar al piso sobre una suscripción viva se aplica y **el cobro siguiente sale por el monto nuevo** (`monto-baja` cobró 15). **La cortesía más barata que permite el proveedor es ARS 15 por ciclo**, no cero (`PC-2`). Para cortesía REAL de N meses hay que pausar —y entonces no se puede modificar nada (`EX-11`)— o cancelar y recrear |
| CT-2 | Estrategias posibles: bajar monto / pausar / recrear / reembolsar | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01-12](./mp-probes/RESULTS-2026-09-15.md) | **Las cuatro medidas, y ninguna da "gratis" limpio.** (1) **Bajar el monto**: funciona sin re-consentimiento (`PC-1`/`PC-3`) pero el piso es **ARS 15** (`PC-2`), así que la cortesía máxima es ARS 15 por ciclo, no cero. (2) **Pausar**: la transición funciona (`PS-1`), pero estando pausada **no se puede modificar nada** (`EX-11`) — ni siquiera aplicar un cambio de precio — y si deja de cobrar lo dice el reloj (`PS-2`). (3) **Cancelar y recrear**: funciona (`EX-8`/`EX-10`) pero **le pide el código de seguridad al cliente** (`EX-9`). (4) **Cobrar y reembolsar**: **no se puede pedir** desde esta cuenta (`RF-1`) |
| CT-3 | Efectos colaterales de cada estrategia | **`VERIFIED`** | 2026-09-15 | **producción** | [sonda 29 · primer cobro del reloj de producción](./mp-probes/probe-29-el-reloj-de-produccion.mjs) | **El efecto colateral es que el cliente se entera, y por el proveedor.** Todo cambio de monto dispara un correo de Mercado Pago al pagador que dice **"El vendedor Hospeda cambió el monto"** (`EX-3`). Y como `EX-15` midió que mutar el monto **no emite webhook**, el proveedor **le avisa al cliente y no nos avisa a nosotros**. Una cortesía aplicada bajando el monto **no es silenciosa** |

## Grant permanente (§35.3)

| # | Comportamiento | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|
| GT-1 | Cancelación correcta de la suscripción del proveedor | **`VERIFIED`** | 2026-09-15 | **producción** | [sonda 29 · primer cobro del reloj de producción](./mp-probes/probe-29-el-reloj-de-produccion.mjs) | **Cancelar frena el cobro.** `cancelada` tenía su cobro agendado para el mismo instante que las otras y **no cobró**. Y a diferencia de la pausa, **la cancelación SÍ deja el calendario quieto**: su `next_payment_date` quedó congelado en la fecha vieja mientras las activas se corrían +24 h. Sigue valiendo que `next_payment_date` **no se limpia**, así que ese campo no sirve para saber si va a cobrar |

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
| RC-3 | Reparar el estado local desde el del proveedor | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | **producción** | [sonda 31](./mp-probes/probe-31-contrato-de-errores-de-lectura.mjs) + [sonda 28](./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs) | **Hay material para reparar, y tiene límites nombrados.** A favor: (1) **`external_reference` se puede REESCRIBIR** sobre una suscripción viva (`EX-19`), así que una suscripción huérfana se puede re-vincular sin tocar al cliente; (2) **el pago hereda la referencia de la suscripción** y **`/v1/payments/search` SÍ filtra por ella**, así que los cobros se encuentran por referencia propia; (3) **un id de otra cuenta se distingue**: `GET /preapproval/{id}` devuelve `400 "not valid for callerId"`, no un `404`. En contra: (a) el `search` de preapprovals **ignora** `external_reference`, así que la referencia sirve para **reconocer**, no para **encontrar**; (b) la vía por `/v1/payments` es justo la API que `R-MP-01` dice que se descontinúa; (c) **reparar no reescribe la historia** — medido: el cobro ya hecho conservó la referencia vieja. **Falta**: si un cobro FUTURO hereda la referencia reparada. Hay un sujeto puesto para eso (`monto-sube`, referencia reescrita el 2026-09-15 21:44), se lee el 2026-09-16 |
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
| EX-3 | ¿Qué le comunica el proveedor **al cliente, por su cuenta**, al cancelar / pausar / modificar? | `M-MAIL-04` | **`VERIFIED`** | 2026-09-15 | **producción** | [casilla real del owner](./mp-probes/RESULTS-2026-09-15.md), 43 correos de `info@mercadopago.com` en el día | **Le avisa TODO, y primero que a nosotros.** Cuatro correos al pagador: **alta** (monto, tarjeta terminada en, frecuencia, el vendedor con su mail, y *"Cobramos $15 solo para validar tu tarjeta y te lo devolvemos enseguida"*), **cambio de monto** (*"El vendedor Hospeda cambió el monto"* + *"Próximo cobro: no especificado"*), **pausa** y **cancelación**. Y uno al vendedor: *"¡Tenés un nuevo suscriptor!"*. **Seis consecuencias**: (1) el **`reason` ES la copy que ve el cliente** en asunto y encabezado —y `EX-19` lo hace reescribible, así que nunca va un slug interno ahí—; (2) **un cambio de precio no se puede hacer en silencio**, y como `EX-15` midió que no emite webhook, **el proveedor le avisa al cliente y NO nos avisa a nosotros**; (3) los cuatro correos mandan al cliente a **nuestra** puerta (*"contactá con el vendedor"`*): no hay autogestión, todo cae en soporte; (4) **`paused` y `cancelled` llegan AMBIGUOS** —los dos dicen *"por un pago no realizado o por opción del vendedor"*—, así que una pausa de cortesía y una por mora son idénticas para el cliente y **nuestra comunicación tiene que desambiguar**; (5) el proveedor afirma que una pausa **la levanta el vendedor**, contra el supuesto de reanudación automática del §26.2; (6) el asunto del alta dice **"Pagaste la suscripción"** y no se pagó nada. **Y no es prematuro: es FALSO.** Medido con reloj: el correo sale ~18 s después de autorizar, el cobro real llega ~26 min más tarde (`PA-3`) — y en `pausa-real` y `cancelada`, que recibieron el mismo correo, **el cobro no llegó NUNCA** (cero `authorized_payments` en las dos). Un cliente puede tener en su bandeja un correo del proveedor que dice que pagó una suscripción que jamás le cobró un peso. Tercer caso del patrón, con el `2084` de `RF-8` y el *"Cobramos $15"* de un cargo inexistente: **ninguna decisión de soporte puede apoyarse en la copy de Mercado Pago** |

| EX-4 | Cambio de **frecuencia** sobre una suscripción ya autorizada | `BD-SUB-01`, `MP-01` | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **El ciclo NO se puede cambiar, y falla en silencio**: `200` en dos intentos aislados (12 y 3 meses) y `frequency` siguió en 1. **RE-VERIFICADO EN PRODUCCIÓN CON TARJETA REAL** el 2026-09-15 ([sonda 28](./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs)), sobre suscripciones autorizadas con `start_date` a +30 días — que no cobran: la corrida entera cerró con **cero cobros**: cuatro intentos (3 meses, 12 meses, `days`, y frecuencia+monto en el mismo `PUT`), los cuatro `200`, `frequency` siempre en 1 |
| EX-5 | ¿Una autorización puede cubrir **más de un monto**? | `BD-MP-04` | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `auto_recurring` como array → `400`. Campo `items` → **`201` y se descarta en silencio**: no vuelve en la respuesta, queda un solo monto. **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 ([sonda 26](./mp-probes/probe-26-re-medir-en-produccion.mjs)): el array da `400 "Parameters passed are invalid"` y `items` se vuelve a descartar en silencio |
| EX-6 | N autorizaciones del mismo pagador conviviendo, ya autorizadas | `BD-MP-04` | **`VERIFIED`** | 2026-09-15 | sandbox **+ producción** | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) + [sonda 28](./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs) | Dos autorizadas del mismo pagador conviven sin conflicto. En **producción con tarjeta real** se llegó a **SEIS** conviviendo, todas `authorized`, mismo `payer_email` |
| EX-7 | Compensar días ya pagados corriendo la **primera fecha de cobro** | `BD-SUB-01` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | `start_date` a +20 días → `next_payment_date` en esa fecha |
| EX-9 | ¿Se puede tokenizar una tarjeta **ya guardada**, server-side? | `DEC-SUB-005` | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 01/02/03](./mp-probes/RESULTS-2026-09-15.md) | **Sí, pero exige el código de seguridad.** Con `card_id` solo, el token se genera (`201`) y **no sirve**: `400 "Card token was generated without cvv validation"`. Con `card_id` + `security_code`, funciona |
| EX-10 | ¿Ese token crea una suscripción autorizada real? | `DEC-SUB-005` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02/03](./mp-probes/RESULTS-2026-09-15.md) | `201` y **verificado por relectura independiente**: `authorized`, ciclo nuevo (3 meses), primer cobro corrido a +18 días, **cero cobro al crear** |
| EX-8 | ¿Se respeta esa primera fecha **después** de autorizar? | `BD-SUB-01` | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md) | **Sí se respeta tras autorizar.** Además **no cobra al crearse**. El proveedor lo modela como un `free_trial` de 20 días que nosotros no pedimos |
| EX-11 | ¿Qué se puede hacer sobre una suscripción **pausada**? | `BD-MP-01`, acota `DEC-MP-001` | **`VERIFIED`** | 2026-09-15 | sandbox | [sonda 07](./mp-probes/RESULTS-2026-09-15.md) | **Estando pausada NO se puede modificar nada**: cambiar el monto da `400 "You can not modify a paused preapproval."` y el monto no se mueve. **Con control**: el mismo payload, sobre la misma suscripción ya reanudada, entra (`200`, monto cambiado) — o sea que **bloquea el estado, no la operación**. **Cancelar SÍ funciona estando pausada** (`200` → `cancelled`): la pausa no atrapa al cliente. **RE-VERIFICADO EN PRODUCCIÓN CON TARJETA REAL** el 2026-09-15 ([sonda 28](./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs)), sobre suscripciones autorizadas con `start_date` a +30 días — que no cobran: la corrida entera cerró con **cero cobros**, y con más superficie: monto, frecuencia, `end_date` y hasta **volver a pausar** dan los cuatro `400 "You can not modify a paused preapproval."` |
| EX-12 | ¿Un `card_token` sirve para más de una suscripción? | `DEC-SUB-005`, reintentos | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sonda 05](./mp-probes/RESULTS-2026-09-15.md) | **Un solo uso.** Del segundo en adelante: `400 "Card token was used, please generate new"`. **RE-VERIFICADO EN PRODUCCIÓN CON TARJETA REAL** el 2026-09-15 ([sonda 28](./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs)), sobre suscripciones autorizadas con `start_date` a +30 días — que no cobran: la corrida entera cerró con **cero cobros**. Todo reintento de creación tiene que **tokenizar de nuevo**, y el mensaje de error no se parece en nada a "reintentaste" |
| EX-13 | ¿Los eventos vienen **firmados**, y se puede verificar la firma? | §51, `M-CONC-01` | **`VERIFIED`** | 2026-09-15 | sandbox | [sonda 10](./mp-probes/RESULTS-2026-09-15.md) | **La firma se verifica.** `x-signature: ts=<epoch>,v1=<hex64>` + `x-request-id`, y el `v1` es **HMAC-SHA256** con la clave de la aplicación sobre el manifiesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` — **el punto y coma final incluido**: sin él no coincide. Reproducido sobre **tres** entregas reales de tipos distintos, con control de la propia herramienta (vector RFC 4231). La URL del receptor no es un agujero abierto |
| EX-14 | ¿Se puede distinguir **sandbox de producción** mirando el evento? | `M-MP-01`, riesgo operativo | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 08/09](./mp-probes/RESULTS-2026-09-15.md) | **No.** Un `payment.created` de la cuenta de prueba (`tags:["test_user"]`) llega con **`live_mode: true`**. Un handler que filtre por ese campo trata los eventos de sandbox como productivos |
| EX-16 | ¿Se puede conciliar una suscripción **SIN** la API de Payments? | `R-MP-01`, §23, §57 | **`VERIFIED`** | 2026-09-15 | sandbox | [sonda 13](./mp-probes/RESULTS-2026-09-15.md) | **Sí, entera.** `GET /authorized_payments/search?preapproval_id=` y `GET /authorized_payments/{id}` pertenecen a la familia de **suscripciones**, no a `/v1/payments`, y traen todo lo que la conciliación necesita: `status`, `transaction_amount`, `currency_id`, `debit_date`, `date_created`, `last_modified`, `payment_method_id`, **`retry_attempt`**, y el pago embebido (`payment.id`, `payment.status`, `payment.status_detail`). El `search` **exige** filtro y **filtra bien por `preapproval_id`** (1 con el real, 0 con basura); por `external_reference` **no filtra** — mismo defecto que `RC-1`, y da igual porque el id del proveedor ya se guarda. **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 ([sondas 20/21](./mp-probes/probe-21-produccion-el-filtro-miente.mjs)), pero con una trampa que casi lo tumba: contra las 4 suscripciones `authorized` de producción devuelve **0**, y eso parecía refutar la fila. No la refuta — **ninguna de las cuatro cobró todavía** (las cuatro están en `free_trial` de 30 o 90 días). Contra la suscripción que **sí** cobró trae los dos cobros completos. **El primer resultado era un falso negativo perfecto**, y lo que lo destapó fue preguntar por el SUJETO, no por el endpoint. **Y hay un SEGUNDO modo de cero, medido el 2026-09-15 con el primer cobro del reloj de producción: LAG.** A las 21:33 el preapproval decía `charged_quantity: 1` y `/authorized_payments/search` devolvía **0**; minutos después devolvía **1**. **El contador del preapproval se actualiza ANTES que el endpoint de cobros**, así que un reconciliador que vea subir el contador y vaya a buscar el cobro no lo encuentra. **Dos causas distintas para el mismo cero** —no cobró nunca, y todavía no se indexó— **y ninguna se distingue mirando sólo ese endpoint** |
| EX-17 | ¿La **creación** de una suscripción es idempotente? | `M-CONC-01` | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox **+ producción** | [sonda 14](./mp-probes/probe-14-idempotencia-de-creacion.sh) | **No deduplica por ningún mecanismo.** Corrida dos veces, **diez sujetos, diez ids distintos**: (a) mismo `external_reference` sin header → dos `201` distintos; (b) misma `X-Idempotency-Key` con cuerpo idéntico → dos `201` distintos; (c) misma clave con **monto distinto** → un tercer `201` con el monto nuevo. El caso (c) es el que cierra la pregunta: el header **no tiene ningún efecto** sobre `/preapproval` — se acepta y no hace nada, otra forma del §0. **Consecuencia: el candado es nuestro o no existe**, y tiene que estar ANTES de llamar al proveedor. El daño no es simétrico: dos `pending` no cobran, pero una creación **con `card_token_id`** queda autorizada y **cobra en el acto** (`PA-3`), así que ahí un reintento son **dos cobros**. De yapa: **un `pending` SE PUEDE cancelar** (11 de 11, verificado por relectura). **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 ([sonda 26](./mp-probes/probe-26-re-medir-en-produccion.mjs)): los tres casos dan idéntico resultado que en sandbox.|
| EX-18 | ¿Se puede cobrar en una **moneda** que no sea ARS? | `M-MP-01` | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox **+ producción** | [sonda 15](./mp-probes/probe-15-moneda.sh) | **Sólo ARS** en esta cuenta (`site_id: MLA`). `USD 100` y `BRL 50` → `400 "Invalid field -> auto_recurring.currency_id"`. **El modelo de datos no necesita moneda por plan, por suscripción ni por cobro.** Y deja una regla para el contrato de errores que casi produce un `PARTIALLY_SUPPORTED` inventado: **el proveedor valida el MONTO antes que la MONEDA, y el mensaje del piso es ciego a la moneda** — `USD 10` devuelve *"Cannot pay an amount lower than $ 15.00"*, y también lo devuelve `BRL 10`, con `BRL` ya sabida inválida. **Un `400` de monto no dice nada sobre si la moneda era válida**. **RE-VERIFICADO EN PRODUCCIÓN** el 2026-09-15 ([sonda 26](./mp-probes/probe-26-re-medir-en-produccion.mjs)): `USD` y `BRL` dan el mismo `400`.|
| EX-19 | ¿Qué campos se pueden **reescribir** sobre una autorizada? | reparación de vínculo, §23 | **`VERIFIED`** | 2026-09-15 | **producción** | [sonda 28](./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs) | **`external_reference` SE PUEDE REESCRIBIR DESPUÉS** (`200` y aplica, verificado por relectura), igual que `reason` —lo que ve el cliente— y `back_url`. **`payer_email` NO**: `200` y no cambia, y el `GET` lo devuelve **vacío**, nunca el mail real. **Esto abre una vía de reparación** para el error vivo de producción (`SubscriptionNotResolvedError`, HOS-276): a una suscripción huérfana se le puede escribir nuestra referencia y re-vincularla sin tocar al cliente. Con la salvedad de `RC-1`: el `search` **ignora** `external_reference`, así que la referencia sirve para **reconocer** una suscripción que ya se tiene, no para **encontrarla**. Y ojo con los ids: el `payer_id` del preapproval (`1505978827`) **no es** el `payer.id` de los pagos de la misma tarjeta (`5860436`) |
| EX-20 | ¿Un `PUT` con varios campos se aplica entero? | §0, toda mutación | **`NOT_SUPPORTED`** | 2026-09-15 | **producción** | [sonda 28](./mp-probes/probe-28-suscripciones-autorizadas-sin-cobrar.mjs) | **NO: se aplica A MEDIAS, con un solo `200`.** `frequency: 6` + `transaction_amount: 99` en el mismo `PUT` → la frecuencia **no** cambió y el monto **sí**. `end_date` + `transaction_amount: 77` → el `end_date` **no** apareció y el monto **sí**. Es el §0 en su forma más cara: **no alcanza con releer \"la\" mutación**, hay que comparar **campo por campo cada campo que se mandó**, porque el que falla no arrastra al que funciona. Y hay un caso más de aceptar-y-descartar: `currency_id: \"USD\"` sobre una autorizada da `200` y sigue en `ARS` — **asimétrico**, porque al CREAR la misma moneda da `400` (`EX-18`) |
| EX-15 | ¿Qué operaciones **NO** emiten webhook? | `DEC-MP-001`, §23, §51 | **`VERIFIED`** | 2026-09-15 | sandbox | [sondas 08/09](./mp-probes/RESULTS-2026-09-15.md) | **Mutar el monto NO emite ninguna entrega.** Medido con 90 s entre acciones: ventana de 91 s sin eventos, con la mutación aplicada — y la `version` del recurso saltó de 5 a 9, o sea que **el recurso cambió y el proveedor no avisó**. Crear, pausar, reanudar y cancelar **sí** notifican. Consecuencia: un cambio de precio **no tiene vía de confirmación asincrónica** y sólo se puede comprobar releyendo |

> `EX-7` y `EX-8` van separadas a propósito: que el proveedor **acepte** una fecha futura al
> crear no prueba que la **respete** una vez autorizada, y ésa es la que decide. Una fila que
> sólo se probó antes de autorizar no responde por el comportamiento después.

---

## ✚ Planes — `/preapproval_plan`

Las 71 filas anteriores se midieron **todas** sobre `/preapproval`: suscripciones sueltas. El
proveedor tiene un **segundo modelo** que este programa no había tocado, y que expone campos que
la suscripción suelta no tiene (`repetitions`, `billing_day`, `billing_day_proportional`,
`free_trial`). Estas nueve filas lo miden, todas en sandbox el 2026-09-15, con las sondas
[33](./mp-probes/probe-33-planes-vs-suscripciones-sueltas.mjs),
[34](./mp-probes/probe-34-controles-de-la-33.mjs),
[35](./mp-probes/probe-35-el-ciclo-de-un-plan-es-editable.mjs),
[36](./mp-probes/probe-36-el-plan-propaga-o-solo-lo-parece.mjs) y
[37](./mp-probes/probe-37-el-free-trial-del-plan-se-da-una-sola-vez.mjs).

| # | Comportamiento | Para qué | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|---|
| EX-21 ✚ | ¿Se puede **mover** una suscripción viva de un plan a otro? | punto 1 / `DEC-SUB-005`, §27, §28 | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sonda 33](./mp-probes/probe-33-planes-vs-suscripciones-sueltas.mjs) | **NO, y en la peor de las formas: `200` con el campo descartado.** `PUT /preapproval/{id}` mandando `preapproval_plan_id` devuelve **`200`** y la relectura sigue mostrando el plan viejo. Medido en tres pasos, con **el control que distingue**: (a) el mismo `PUT` con sólo `back_url` → `200` **aplicado**, así que el `PUT` sobre ese sujeto funciona; (b) con sólo `preapproval_plan_id` → `200`, plan viejo; (c) **los dos juntos** → `200`, `back_url` aplicado y **plan ignorado**. Sin (a), un error en (b) no habría distinguido "prohibido" de "no llegó a evaluarse"; sin (c), el `200` de (b) no distinguía nada. Es **`EX-20` otra vez**, y esta vez el campo descartado es justo el que se preguntaba. **El modelo de planes NO resuelve el punto 1**: `DEC-SUB-005` —cancelar y recrear, con el código de seguridad al cliente— sigue siendo el único camino medido para un cambio de ciclo individual |
| EX-22 ✚ | Con plan, ¿puede la suscripción traer su propio `auto_recurring`? | §19, §29, catálogo de planes | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 33 y 34](./mp-probes/probe-34-controles-de-la-33.mjs) | **Manda el plan, y lo que sobra se descarta sin avisar.** Monto distinto → **`400`** *"The transaction_amount must be the same as preapproval_plan"*. Monto **igual** y frecuencia distinta (`2 months` contra `1 months` del plan) → **`201`** y la relectura dice `1 months`: **el proveedor valida el monto y no valida la frecuencia**, así que el único campo que protesta es el único que no hacía falta proteger. La suscripción además **heredó** el `billing_day: 10` del plan, que nunca pidió. El `reason` propio también se descarta: queda el del plan. **Consecuencia sobre `EX-3`**: está medido que el `reason` **es la copy que ve el cliente** en asunto y encabezado de los correos del proveedor, así que con planes **esa copy la fija el plan** — un catálogo de planes es también un catálogo de textos al cliente, uno por combinación vertical × tier × ciclo |
| EX-23 ✚ | Editar el **monto** de un plan, ¿alcanza a los ya suscriptos? | `BD-MP-03`, `DEC-MP-001`, §29 | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 33 a 36](./mp-probes/probe-36-el-plan-propaga-o-solo-lo-parece.mjs) | **La LECTURA de los suscriptos sigue al plan; falta saber si el COBRO también.** Un testigo que nadie tocó leyó 2000 al alta, **2500** tras subir el plan y **15** tras bajarlo: tres puntos, sobre dos suscriptos. Eso admite dos explicaciones que **ninguna lectura distingue**: que el proveedor **propague** —y entonces existe un cambio de precio **masivo** por plan, mucho más barato que mutar suscripción por suscripción, que es lo que decidió `DEC-MP-001`— o que la lectura sólo **refleje** el plan mientras el cobro sale de otro lado, **que sería peor que el hallazgo**, porque la relectura es la única herramienta con la que este programa verifica todo. Sólo un cobro ejecutado las separa: quedaron dos sujetos de ciclo diario puestos el 2026-09-15 23:32, uno con el plan subido a **ARS 3300** antes del primer cobro y otro **sin tocar** que lo hace legible ([manifiesto](./mp-probes/manifiesto-propaga-2026-09-15.json)). **Se lee el 2026-09-16.** El piso de `PC-2` también rige acá: ARS 1 → `400` *"Cannot pay an amount lower than $ 15.00"* |
| EX-24 ✚ | ¿El **ciclo** de un plan es editable? | §19, §29 | **`VERIFIED`** | 2026-09-15 | sandbox | [sonda 35](./mp-probes/probe-35-el-ciclo-de-un-plan-es-editable.mjs) | **SÍ**, verificado por relectura dos veces: `1 days → 2 days` sobre un plan sin free trial y `1 months → 2 months` sobre uno con free trial. **Y casi se registra un `NOT_SUPPORTED` inventado**: el primer intento devolvió `400`, pero el mensaje era *"The free trial property must be sent"* — si el plan tiene free trial, **todo `PUT` que toque `frequency` tiene que reenviarlo**, y el rechazo no tenía nada que ver con el ciclo. Tercer caso en este programa de un error que no prueba una prohibición sino que no se llegó a evaluar |
| EX-25 ✚ | El cambio de **ciclo** del plan, ¿alcanza a los ya suscriptos? | §19, §29 | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sonda 35](./mp-probes/probe-35-el-ciclo-de-un-plan-es-editable.mjs) | **NO.** Con el plan en `2 months`, sus dos suscriptos siguen leyéndose en `1 months`. **La asimetría con `EX-23` es el hallazgo**: sobre el mismo plan y los mismos suscriptos, el monto cambia y el ciclo no. Un plan puede quedar describiendo un ciclo que ninguno de sus suscriptos tiene, y nada avisa |
| EX-26 ✚ | ¿`free_trial` funciona **sin** plan? | §10, trial | **`VERIFIED`** | 2026-09-15 | sandbox | [sonda 33](./mp-probes/probe-33-planes-vs-suscripciones-sueltas.mjs) | **SÍ, y difiere el primer cobro.** Medido con un par en la misma corrida, con segundos de diferencia: el sujeto **con** `free_trial` quedó en `summarized.charged_quantity: null` y su gemelo **sin** trial en `1`. El proveedor agrega por su cuenta `first_invoice_offset`. No hizo falta esperar nada |
| EX-27 ✚ | ¿`repetitions` y `billing_day` funcionan **sin** plan? | §19, catálogo | **`NOT_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 33 y 34](./mp-probes/probe-34-controles-de-la-33.mjs) | **No: los dos se descartan en silencio.** `repetitions: 3` → `201` y **ausente** en la relectura. `billing_day` con ciclo diario → `400` *"Only monthly frequencies are able to receive billing day or proportional"*, **que no contestaba la pregunta** porque el rechazo era del ciclo; el control con ciclo **mensual** sí la contesta, y da **`201` con el campo ausente**. **Son exclusivos de planes**, y es lo único que el modelo de planes aporta sobre el suelto |
| EX-28 ✚ | ¿Los planes aceptan **ciclo diario**? | costo de medir sobre planes | **`VERIFIED`** | 2026-09-15 | sandbox | [sonda 34](./mp-probes/probe-34-controles-de-la-33.mjs) | **SÍ.** El primer intento dio `400` *"the only valid frequency is months"*, pero ese plan mandaba además `billing_day`, que exige mensual. **Sin `billing_day`, un plan de `1 days` entra y se relee correcto.** Importa por el costo: una batería completa sobre planes **se lee en 24 h, no en un mes** — salvo la parte que use `billing_day`, que es mensual por definición |
| EX-29 ✚ | El **free trial de un plan**, ¿lo decide el request? | §10, trial, UI de checkout | **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sonda 37](./mp-probes/probe-37-el-free-trial-del-plan-se-da-una-sola-vez.mjs) | **NO lo decide el request, el patrón es reproducible y el mecanismo NO está identificado.** Dos suscripciones del mismo pagador sobre el mismo plan, con requests **idénticos** y tres segundos de diferencia, salieron distintas: una con `free_trial` y la otra con `null`. Ninguna lo pidió — lo trae el plan. Reproducido **tres veces en frío**, sobre tres planes nuevos, siempre `✅ ✅ ❌`. **No es "una vez por plan"** (dos la reciben) **ni "una vez por pagador"** (la recibe en tres planes distintos), y el plan de la sonda 33 dio `✅ ❌ ❌`, que tampoco encaja con "dos por plan". **Se registra lo reproducible y no se elige la explicación más cómoda**: falta el experimento que las distinga, y el más barato es separar las altas en el tiempo. Lo que **sí** está cerrado y no depende del mecanismo: (1) dos altas idénticas dan resultados distintos; (2) **la relectura lo delata** —`free_trial: null` y `next_payment_date` en el instante del alta en vez de mañana—; (3) por lo tanto **no se le puede prometer al cliente la fecha del primer cobro desde lo que se mandó**: hay que releer antes de mostrarla, siempre |

---

## ✚ Cobrar SIN suscripción — Orders API y credencial guardada

El owner preguntó qué pasaría si dejáramos de usar el modelo de suscripciones y le pidiéramos al
proveedor **sólo que cobre**, manejando el ciclo de vida de nuestro lado. Estas tres filas lo
miden. Sondas [38](./mp-probes/probe-38-cobrar-sin-preapproval.mjs),
[39](./mp-probes/probe-39-descubrir-el-contrato-de-orders.mjs),
[40](./mp-probes/probe-40-que-dispara-el-403-de-pagos-automaticos.mjs) y
[41](./mp-probes/probe-41-wallet-connect.mjs), todas en sandbox el 2026-09-16 y a costo cero.

> **Un `403` de habilitación NO es lo mismo que un `NOT_SUPPORTED` del proveedor**, y las dos
> filas de abajo que lo llevan lo dicen en su conclusión. El proveedor **sí** hace esto; lo que
> está medido es que **a esta cuenta no se lo da**. Se registran como `NOT_SUPPORTED` porque para
> el §61 lo que decide es si se puede implementar, y no se puede — pero la razón es de
> elegibilidad comercial, no técnica, y confundirlas llevaría a reintentarlo creyendo que es un
> problema de cómo armamos el pedido.

| # | Comportamiento | Para qué | Estado | Fecha | Entorno | Evidencia | Conclusión |
|---|---|---|---|---|---|---|---|
| EX-30 ✚ | ¿Existe `/v1/orders`, y cobra? | alternativa a `preapproval`, `R-MP-01` | **`VERIFIED`** | 2026-09-16 | sandbox | [sonda 39](./mp-probes/probe-39-descubrir-el-contrato-de-orders.mjs) | **SÍ, y cobra de verdad.** Una orden con una tarjeta tokenizada y **sin `customer`** devolvió `201` y la relectura dice `processed/accredited` con ARS 20 acreditados. El contrato se descubrió **preguntándole al validador**, que nombra los campos que faltan (`missing properties: '$.external_reference'`…): cuerpo mínimo → `transactions` → `payments[0]` exige `amount` y `payment_method`. **Consecuencia útil hoy**: un cobro de **única vez** —un addon, por ejemplo— no necesita ninguna habilitación especial ni pasa por `preapproval`. De paso quedó medido que **`POST /v1/customers` da `401 "access denied"`** con la credencial de prueba, igual que `/v1/payments` (`RF-1`/`RF-2`): eso habla de la credencial, no de la capacidad, y resultó **no estar en el camino crítico** |
| EX-31 ✚ | ¿Se puede cobrar de forma **recurrente** sin `preapproval`, con credencial guardada? | «el ciclo de vida es nuestro» | **`NOT_SUPPORTED`** | 2026-09-16 | sandbox | [sondas 38 y 40](./mp-probes/probe-40-que-dispara-el-403-de-pagos-automaticos.mjs) | **No con esta aplicación, y el rechazo es del PERMISO, no del pedido.** El proveedor documenta el producto *«pagos automáticos»* en el dominio argentino —*"pagos recurrentes… **sin solicitar el CVV** para cada transacción"*, con MIT explícito y *"la lógica de recurrencia definida por el vendedor"*— y el contrato es `POST /v1/orders` con `automatic_payments.payment_profile_id` y `stored_credential`. **Medido con el control que distingue**: la misma orden **sin** esos nodos entra (`201`, ver `EX-30`); con **sólo `stored_credential`**, con **sólo `automatic_payments`**, con **los dos**, y con `payment_initiator: "merchant"` sin perfil → **los cuatro `403` con el mensaje idéntico** *"The application is not authorized to perform this type of payment"*. O sea que no hay forma de armar el pedido que lo evite. **Y la vía alternativa está cerrada por diseño del proveedor**: tokenizar una tarjeta guardada **exige volver a capturar el código de seguridad** (documentado), y un token de tarjeta es **de un solo uso** (`EX-12`), así que no sirve para cobrar el mes siguiente. Lo más plausible es que este `403` sea **el mismo portón comercial que `EX-32`** —el último paso de Wallet Connect es, campo por campo, este request— pero **eso no está medido**: son dos productos con nombres distintos |
| EX-32 ✚ | ¿Está disponible **Wallet Connect**? | «el ciclo de vida es nuestro», vía billetera | **`NOT_SUPPORTED`** | 2026-09-16 | sandbox **+ requisito publicado** | [sonda 41](./mp-probes/probe-41-wallet-connect.mjs) | **El recurso existe, no lo tenemos, y no lo podemos pedir.** `POST /v2/wallet_connect/agreements` devuelve **`403 Forbidden`** con y sin el header `x-platform-id`; un `GET` sobre la misma ruta devuelve **`405 Not Allowed`**, o sea que **la ruta está viva en el gateway** y no es un `404`. El control (`/v1/orders` con cuerpo incompleto → `400`) confirma que la cuenta sigue respondiendo normal. **Lo que lo cierra no es el `403` sino el requisito publicado**: la integración está disponible **sólo** para vendedores con **más de 100.000 usuarios** (dos variantes: ticket promedio < 15 USD con ≥2 transacciones mensuales por usuario, o suscripción mensual con ticket < 40 USD). Hospeda tiene **3** relaciones de cobro vivas: son más de tres órdenes de magnitud, así que **no es una negociación que se pueda intentar**. El mecanismo, para el registro: acuerdo → el comprador aprueba **en su app de Mercado Pago** → `payer_token` **persistente** de servidor (a diferencia del de tarjeta, que es de un solo uso) → `POST /v1/orders` con `payment_method: {type:'wallet'}` y `stored_credential`. **Trampa de método**: la página de *prerrequisitos* del producto **no menciona el umbral** —lo encontró el owner en la página de disponibilidad—, y este documento llegó a afirmar que no había mínimo de volumen. **Que una fuente no mencione algo no prueba que no exista** |
| EX-33 ✚ | Una suscripción creada **pendiente** con fecha de primer cobro futura y autorizada **por el cliente en el checkout**, ¿respeta esa fecha? | **`DEC-SUB-006`** | **`UNKNOWN`** | — | — | sin medir | **Es la condición de `DEC-SUB-006`, y no está medida.** `EX-8` verificó que una fecha futura se respeta sobre una suscripción autorizada **por API con `card_token_id`**; nadie probó el camino del checkout, donde **quien autoriza es otro**. Es exactamente la distinción que este documento ya marca entre `EX-7` y `EX-8`: que el proveedor acepte una fecha al crear no prueba que la respete después de autorizar. **Lo que está en juego**: si el checkout la resetea, la suscripción nueva cobra en el acto mientras la vieja sigue viva hasta que llegue el webhook de autorización, y **el cliente paga dos veces** — que es justo el riesgo que la fecha futura existe para evitar. **Cómo se mide**: crear un `preapproval` `pending` con `start_date` a +N días, abrir su `init_point`, completarlo a mano con el comprador de prueba, y releer. Sandbox, sin costo; lo único que no se automatiza es el clic del comprador |
| EX-34 ✚ | Correr la **fecha de cobro** de una suscripción **ya viva** | **`DEC-SUB-010`**, cierra `BD-MP-01` | **`NOT_SUPPORTED`** | 2026-09-16 | sandbox | [foto posterior](./mp-probes/fotos-reloj-2026-09-16/pausa-real-despues-de-reanudar.json) + los cuatro `PUT` de la corrida | **La fecha de una suscripción viva es inmutable, y falla en silencio.** Cuatro formas de pedirlo sobre el mismo sujeto `authorized`, una por vez para no caer en `EX-20`: (1) `auto_recurring` completo con `start_date` a +3 días, (2) `next_payment_date` suelto, (3) `auto_recurring.start_date` suelto, (4) `auto_recurring.billing_day`. **Los cuatro `200`; `start_date`, `next_payment_date` y `has_billing_day` sin moverse, y `last_modified` CONGELADO en los cuatro** — o sea el proveedor no escribió nada, ni siquiera un no-op. **Con el control que lo separa de "esta suscripción está rara"**: un `PUT` de `transaction_amount` sobre la MISMA suscripción, minutos después, entró (2000 → 2500) y **movió `last_modified`**. Lo bloqueado son las **fechas**, no el objeto. Consecuencia: `start_date` a futuro sirve **sólo al crear** (`EX-7`), así que compensar días corriendo la fecha de una suscripción existente **no se puede** — hay que recrearla (`DEC-SUB-006`) o no compensar (`DEC-SUB-010`) |

---

## Resumen

| Estado | Filas |
|---|---|
| `VERIFIED` | **45** — la nueva es **`PS-5`** (reanudar cambia sólo el `status`) |
| `PARTIALLY_SUPPORTED` | **14** — `PA-2`, `RC-1`, **`RC-3`**, `PS-1`, `PS-3`, `CN-1`, `CT-1`, `CT-2`, `WH-3`, `RN-1`, `EX-9`, `RF-8`, **`EX-23`** (el plan alcanza la lectura del suscripto; falta el cobro), **`EX-29`** (el free trial del plan no lo decide el request) |
| `NOT_SUPPORTED` | **17** — **`PS-4`** (no existe la auto-reanudación: MP no tiene `pauseUntil`), **`PS-6`** (el período pagado en pausa se pierde y no hay nada para recuperarlo), **`EX-34`** (la fecha de una suscripción viva es inmutable), `EX-4` (cambio de ciclo), `EX-5` (más de un monto), `EX-12` (reusar un token), `EX-14` (distinguir entorno), `EX-17` (creación idempotente), `EX-18` (otra moneda), `RC-4` (el `search` devuelve menos campos que el `GET`), **`EX-20`** (un `PUT` mixto se aplica a medias), **`EX-21`** (mover una suscripción de plan), **`EX-22`** (contradecir al plan), **`EX-25`** (el ciclo del plan no alcanza a los suscriptos), **`EX-27`** (`repetitions` y `billing_day` sin plan), **`EX-31`** (cobro recurrente sin `preapproval`) y **`EX-32`** (Wallet Connect) |
| | Las dos últimas son **de elegibilidad, no técnicas**: el proveedor las hace y no nos las da. Ver la advertencia de su sección |
| **`UNKNOWN`** | **9** — seis esperan **otra** lectura del reloj (`RN-2`, `RN-3`, `GR-1..3`, `EX-1`); `WH-5` y `RF-3` no dependen del tiempo; y **`EX-33`** es la condición de `DEC-SUB-006`, medible a mano en sandbox |
| | La primera lectura del reloj (2026-09-16) cerró tres: `PS-4`, `PS-5` y `PS-6`. Las otras seis siguen abiertas porque **el ciclo diario de sandbox no cobró en la fecha** — ver la nota de abajo |

Recalculado con [`contar-filas-de-la-matriz.py`](./contar-filas-de-la-matriz.py) el
2026-09-16 **13:30**, sobre **85** filas.

> ⚠️ **El reloj de sandbox no había cobrado al vencer, y eso todavía no se puede
> interpretar.** Los seis sujetos `authorized` tenían `next_payment_date` el
> 2026-09-16 a las 11:26–11:28 `-04`, y a las **11:59 `-04`** (31 min después)
> los seis seguían con `charged_quantity: 1` y `next_payment_date` **sin correr**.
> Son las dos explicaciones de siempre y no las distingue una sola lectura: puede
> ser **lag** del proveedor, o puede ser que **un ciclo `days` no cobre**. Lo que
> las separa es una relectura más tarde, no más razonamiento. Hasta entonces,
> `RN-2`, `RN-3`, `GR-1..3` y `EX-1` no se tocan (§61).
>
> Dato que **no** encaja con "lag de todo": la pausada **sí** tenía la fecha
> corrida (+1 ciclo) mientras las `authorized` **no**. Si fuera puro lag,
> deberían haberse corrido las siete.

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
