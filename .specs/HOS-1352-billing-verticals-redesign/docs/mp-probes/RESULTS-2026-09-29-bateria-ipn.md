# Batería IPN del 2026-09-29 — re-medir lo que depende de qué avisos llegan

> Programa HOS-1352, FASE 1C. Escrito el 29/09 a la tarde, con las dos URL de la aplicación de
> pruebas apuntadas al receptor (IPN → `/ipn`, Webhooks → `/webhooks`, todos los eventos, desde
> ~14:40Z). **No se editó la matriz** ni [`RESULTS-2026-09-29.md`](./RESULTS-2026-09-29.md) (su
> anexo lo escribe otro agente con la corrida 2 de la sonda 52, `EX-52`, `EX-53`, `EX-55` y `EX-56`):
> cada fila trae un veredicto y un texto propuestos, que aplica el orquestador con OK del owner.
> **Todo en sandbox. Producción: nada leído ni tocado. Panel: sin tocar.**

## Resumen

1. **El canal IPN entrega sólo `payment`**, siempre, en las tres corridas del día: 12 de 12
   entregas IPN del proveedor (8 de esta batería, 4 de la corrida 2) son `topic=payment`. Nunca `preapproval`, `authorized_payment`,
   `merchant_order` ni `order`. Todo lo que no es un pago llega **sólo** por Webhooks.
2. **La firma de IPN no verifica** con la clave de la aplicación (0 de 8 hoy; 0 de 12 en el día), mientras la de Webhooks
   verifica 29 de 29 con el manifiesto de `EX-13`. IPN trae `x-signature`, pero con otro `v1`.
3. **IPN también reintenta**, con la misma escalera inicial que Webhooks: duplicado a +0,55 s y
   primer reintento a +17,2 min. Y la **supersesión de `WH-5` se reprodujo 2 de 2** con el canal IPN
   escuchando: la `version` vieja se abandona y la nueva insiste.
4. **Cambiar la tarjeta de una viva SÍ avisa, y por los dos canales**: un `subscription_preapproval`
   por Webhooks y un `payment` de ARS 0 (`operation_type: card_validation`) por **IPN y Webhooks**.
   Un cambio **rechazado** (`402`) avisa sólo el `payment` rechazado. **Reescribir el `reason` no avisa
   por ningún canal.**
5. **Las órdenes y sus reembolsos no avisan por ningún canal**: 5 órdenes (aprobadas, una fallida)
   y 2 reembolsos (total y parcial, que **sí funcionan en sandbox** por la Orders API) produjeron
   **cero** entregas en 23 a 43 min, con todos los eventos tildados en el panel.

## Método, receptor y ventanas

- **Receptor**: el Worker de la sonda 08, sin cambios. Guarda cada `POST` crudo con su instante de
  llegada. **El canal sale del path**: `/ipn` o `/webhooks`. No se borró el dump.
- **Lector nuevo**: [`probe-55-leer-los-dos-canales.py`](./probe-55-leer-los-dos-canales.py). Sólo lee:
  separa canales, verifica la firma con control RFC 4231 y lista las claves `(canal, tipo, recurso,
  version)` repetidas. Ojo: el borde de Cloudflare contesta `403` al user-agent por defecto de
  `urllib`, así que el lector manda uno propio.
- **Sondas nuevas**:
  - [`probe-56-lo-que-la-52-no-cubre.sh`](./probe-56-lo-que-la-52-no-cubre.sh): cambio de tarjeta,
    cambio de `reason`, cambio de tarjeta rechazado, órdenes aprobada y rechazada, reembolsos total
    y parcial. Receptor en `ok`, 90 s entre acciones.
  - [`probe-57-reintentos-en-los-dos-canales.sh`](./probe-57-reintentos-en-los-dos-canales.sh):
    escalera inicial y supersesión, con el receptor en `fail` durante el mínimo posible.
- **Ventanas exactas (UTC)**, para no mezclar corridas:

| qué | desde | hasta | modo del receptor |
|---|---|---|---|
| sonda 52, **corrida 3** (`run=20260929T145251Z`) | 14:52:51Z | 15:06:48Z (+ entregas tardías hasta 15:07:30Z) | `ok` |
| sonda 57, **ventana en `fail`** | **15:09:31,764Z** | **15:12:23,993Z** | **`fail`** (2 min 52 s) |
| sonda 56 (`run=20260929T151232Z`) | 15:12:32Z | 15:26:28Z | `ok` |
| lectura final del receptor | — | 15:48Z | `ok` |
| cancelación de cierre del sujeto de la 57 | 15:49:00Z | — | `ok` |

- **La ventana en `fail` no pisó a nadie**: entre 15:09:31Z y 15:12:24Z las únicas entregas del
  receptor son las de la sonda 57. La primera entrega posterior (15:12:35Z, sonda 56) llegó **una
  sola vez**, o sea que el `ok` ya regía. El receptor queda en **`ok`** (leído a las 15:49Z).
- **Método de lectura**: el listado de KV es eventualmente consistente. Ninguna ausencia se
  concluye antes de +20 min; la lectura final es de 15:48Z.

## Inventario: las filas que dependen de qué avisos llegan

«Canal escuchando» dice qué canal estaba apuntado a quien midió. Hasta el 29/09 a la mañana,
**ninguna** medición tuvo IPN escuchando en sandbox (776 entregas del receptor, ninguna IPN), y las
de producción leyeron `billing_webhook_events`, que está **después** del filtro que descarta IPN
(HOS-159). La única que vio IPN fue `RF-7`, en los logs de la API.

| fila | qué afirma sobre avisos | cómo se midió, y con qué canal | re-medible | hoy |
|---|---|---|---|---|
| `WH-1` | el duplicado existe sólo al fallar la entrega; `version` deduplica | sandbox, `mode=fail`, sólo Webhooks; + un duplicado en producción (tabla, sólo Webhooks) | **pasada** | ✅ re-medido, dos canales |
| `WH-2` | demora p50 1,7 s, cola de días | sandbox, 471 primeras entregas, sólo Webhooks | pasada (muestra); la cola, **días** | ✅ muestra de hoy |
| `WH-3` | sin desorden observado | sandbox, 530 eventos, sólo Webhooks | pasada (muestra); volumen, **días** | ✅ muestra, más el orden entre canales |
| `WH-4` | reintenta: +0,5 s, +18,8 min, +35,1 min, +6,07 h | sandbox, `mode=fail` 54 min, sólo Webhooks | escalera inicial: **pasada**; completa: **horas** con el receptor en `fail` | ✅ escalera inicial, dos canales |
| `WH-5` | supersesión; el alta rechazada no avisa su cancelación | mecanismo: sandbox, sólo Webhooks; alcance: producción (tabla) | mecanismo: **pasada**; alcance: **producción** (logs del VPS, owner) | ✅ supersesión 2/2; alta rechazada repetida (3er caso) |
| `WH-6` | qué entrega cada canal y cuántas entre los dos | anexo del 29/09 (corrida 2) | **pasada** | ✅ corrida 3 limpia (sección propia) |
| `EX-2` | el cuerpo trae `version` monótona | sandbox, sólo Webhooks | pasada | ✅ Webhooks sí; **IPN no trae `version`** |
| `EX-13` | la firma se verifica | sandbox, sólo Webhooks | pasada | ✅ Webhooks 29/29; **IPN 0/8** |
| `EX-14` | no se distingue sandbox de producción mirando el evento | sandbox, sólo Webhooks | pasada | ✅ IPN tampoco (no trae `live_mode`) |
| `EX-15` | qué NO emite entrega | sandbox, sólo Webhooks; IPN en el anexo | pasada | ✅ corrida 3 + tarjeta, `reason`, tarjeta rechazada |
| `RF-7` | un reembolso emite 3 entregas (1 Webhooks + 2 IPN) | **producción**, logs de la API, reembolso por `/v1/payments` | por `/v1/payments`: **sólo producción** (sandbox da `401`); por Orders: **pasada** | ✅ Orders API en sandbox: **cero** entregas |
| `GR-3` | la pausa por mora avisa 5/5; `scheduled → processed` no emite | **producción**, `billing_webhook_events` (sólo Webhooks) | **producción + días** (la mora no se fabrica en sandbox: `PA-4`, reconfirmado hoy con `402`) | ❌ no re-medible hoy |
| `PC-3`, `CT-3`, `EX-3` | «mutar el monto no emite webhook» (citan `EX-15`) | derivadas de `EX-15` | pasada (vía `EX-15`) | ✅ la corrida 3 lo reconfirma con los dos canales |
| `RC-8` | el contracargo avisa por `topic_chargebacks_wh` | **documentación**, sin medir | **sólo producción** (disputa real) | ❌ |
| `RC-9` | `version` sólo viene en el cuerpo del aviso | producción (lectura) + `EX-2` | pasada | ✅ derivada: IPN no la trae |
| `EX-36` | cambiar la tarjeta cobra una validación de ARS 0 | sandbox, sin mirar avisos | pasada | ✅ ahora también **qué avisa** |
| `EX-46` | a qué URL va el reintento tras cambiar la URL | sin medir | **pasada, pero con panel** (owner) | ❌ panel; hay un indicio (abajo) |
| `EX-52`, `EX-53` | qué avisa la baja / pausa del comprador | anexo del 29/09 (owner) | owner | — (no re-medido: lo cubre el anexo) |
| `EX-55` (propuesta del anexo) | un alta con `400` deja un preapproval | anexo del 29/09, 2 casos | pasada | ✅ tercer caso (corrida 3) |

Filas revisadas y **excluidas** por no concluir nada sobre avisos: `PA-4`, `PA-6`, `RN-2`, `RN-3`,
`GR-1` (sus menciones de «firma»/«reintento» son de cobros, no de entregas), `RF-6`, `RF-8`, `EX-1`
y `EX-49` (correos, no avisos al vendedor).

## La corrida 3 de la sonda 52 (limpia)

**Por qué existe.** En la corrida 2 el owner cambió la URL y los eventos de Webhooks a mitad (≈14:34Z
a 14:40Z) y faltaron los avisos de crear, pausar y reanudar de `f988256…`. La corrida 3 se hizo con la
configuración estable y el receptor en `ok`, **antes** de cualquier `mode=fail`.

**Bitácora** (`run=20260929T145251Z`; envíos en UTC):

| paso | envío | acción | HTTP | recurso |
|---|---|---|---|---|
| 01 | 14:52:52,252 | crear preapproval | 201 | `0f226f7ee11f46d097c0b4ad30ce7926` (`notification_url` releída `null`) |
| 02 | 14:54:25,178 | subir monto 2500 → 3500 | 200 | ídem, `authorized/3500.00` |
| 03 | 14:55:56,512 | pausar | 200 | ídem, `paused` |
| 04 | 14:57:27,855 | reanudar | 200 | ídem, `authorized` |
| 05 | 14:59:04,188 | cancelar | 200 | ídem, `cancelled` |
| 06–08 | 15:00:37 → 15:03:40 | pagos `/v1/payments` | 401 | — (igual que las corridas 1 y 2) |
| 09 | 15:05:11,982 | orden con `notification_url` | 400 | `unsupported_properties` (igual) |
| 09b | 15:05:13,329 | orden sin `notification_url` | 201 | `ORDTST01M3PV5KW7T084ZMHWWZDXRD1Y`, `processed/accredited` |
| 10 | 15:06:46,197 | alta `authorized` con tarjeta `OTHE` | **400** | sin id devuelto; **existe `1bd4f015b50542cc8457c9b711dd0128`**, creado 11:06:47 y `cancelled` 11:06:48 (`-04`) |

**Lo que llegó** (11 entregas; todas las de Webhooks verifican la firma, las 2 IPN no):

| llegada (UTC) | canal | tópico · id | cuerpo | atribución, latencia desde el envío |
|---|---|---|---|---|
| 14:52:54.506 | IPN | `payment` · `180442729951` | `{"resource","topic"}` | alta (01), +2,25 s |
| 14:52:54.588 | Webhooks | `payment` · `180442729951` | `payment.created` | alta, +2,34 s |
| 14:52:54.729 | Webhooks | `subscription_authorized_payment` · `7032364271` | `created v0` | alta, +2,48 s |
| 14:53:02.653 | Webhooks | `subscription_authorized_payment` · `7032364271` | `updated v1` | alta, +10,40 s |
| 14:53:02.657 | Webhooks | `subscription_preapproval` · `0f226f7e…` | `updated v4` | alta, +10,41 s |
| — | — | — | — | **subir monto (02): nada**, y la `version` salta de 4 a 6 |
| 14:55:58.684 | Webhooks | `subscription_preapproval` · `0f226f7e…` | `updated v6` | pausar (03), +2,17 s |
| 14:57:37.050 | Webhooks | `subscription_preapproval` · `0f226f7e…` | `updated v7` | reanudar (04), +9,20 s |
| 14:59:32.670 | Webhooks | `subscription_preapproval` · `0f226f7e…` | `updated v8` | cancelar (05), +28,48 s |
| — | — | — | — | **orden (09b): nada en 43 min, por ningún canal** |
| 15:06:48.933 | Webhooks | `payment` · `181448378844` | `payment.created` | alta rechazada (10), +2,74 s |
| 15:06:49.006 | IPN | `payment` · `181448378844` | `{"resource","topic"}` | ídem, +2,81 s |
| 15:07:29.551 | Webhooks | `subscription_authorized_payment` · `7032364467` | `updated v2` | ídem, +43,4 s |
| — | — | — | — | **cancelación del proveedor de `1bd4f015…`: nada en 41 min, por ningún canal** |

Relecturas que sostienen la atribución (sólo `GET`): `/v1/payments/181448378844` → `rejected /
cc_rejected_other_reason`, `external_reference HOS-1352-s52-20260929T145251Z-10`;
`/authorized_payments/search?preapproval_id=1bd4f015…` → `7032364467`, `scheduled`,
`cc_rejected_other_reason`, `retry_attempt 1`.

**Qué dice la corrida 3.**

- **Confirma la corrida 1 por Webhooks, ahora con IPN escuchando**: crear, pausar, reanudar y
  cancelar llegan **una vez cada uno**; subir el monto no llega por **ningún** canal.
- **Cierra el hueco de la corrida 2**: los avisos de crear, pausar y reanudar que faltaron en
  `f988256…` sí llegan con la configuración estable. Su ausencia en la corrida 2 era la ventana
  contaminada, no el proveedor.
- **El alta rechazada, tercer caso**: `400` sin id, preapproval creado y cancelado por el proveedor
  en **1 s** (en las corridas 1 y 2: 11 s y 2 s), y **ningún `subscription_preapproval` por ningún
  canal**. Llegan el `payment` (los dos canales) y un `authorized_payment` (sólo Webhooks).
- **La orden no avisa**, igual que en las corridas 1 y 2.

## `WH-1` y `WH-4` — la escalera inicial, en los dos canales (sonda 57)

**Qué se hizo.** Con el receptor en `fail` (15:09:31,764Z → 15:12:23,993Z): crear el preapproval
`08e6937447324dc68949601d78e6032d` (Q), pausarlo 60 s después y crear una orden 60 s después
(`ORDTST01M3PVH9S7688Z0QN6MRHD1NTN`). Al volver a `ok` se leyó el receptor hasta 15:48Z, y a las
15:49Z se canceló Q.

**Evidencia** (cada clave es `(canal, tipo, recurso, version)`; «dup» es la segunda entrega):

| clave | 1ª entrega (500) | dup (500) | 1er reintento (200) | intervalo dup → reintento |
|---|---|---|---|---|
| Webhooks · `payment` · `180446362745` | 15:09:34.738 | +0,495 s | 15:26:09.411 | **994,2 s** (16 min 34 s) |
| **IPN** · `payment` · `180446362745` | 15:09:34.757 | +0,554 s | **15:26:45.332** | **1030,0 s** (17 min 10 s) |
| Webhooks · `subscription_authorized_payment` · `7032364572` **v0** | 15:09:34.464 | +0,541 s | **nunca** (hasta 15:48Z) | — |
| Webhooks · `subscription_authorized_payment` · `7032364572` **v1** | 15:09:36.810 | +0,781 s | 15:26:21.240 | 1003,6 s (16 min 44 s) |
| Webhooks · `subscription_preapproval` · Q **v2** | 15:09:36.142 | +0,867 s | **nunca** (hasta 15:48Z) | — |
| Webhooks · `subscription_preapproval` · Q **v5** | 15:10:39.411 | +0,524 s | 15:31:03.546 | 1223,6 s (20 min 24 s) |
| la orden | — | — | — | **ninguna entrega**, ni en `fail` ni después |

- **IPN reintenta como Webhooks**: duplicado inmediato y primer reintento del mismo orden. Con el
  receptor en `ok` al llegar el reintento, la escalera termina en la 3ª entrega en los dos canales.
- **Cada reentrega se re-identifica y se re-firma**, en los dos canales: `x-request-id` distinto en
  las 16 entregas, `ts` de la firma distinto entre la 1ª y el reintento, y en Webhooks el `id` del
  cuerpo también cambia (`39374405683408155` → `39374406488742463` → `39376074009751575`). Sólo la
  `version` (Webhooks) se mantiene. **IPN no trae nada estable salvo el id del recurso**.
- **El primer reintento cayó entre 16,6 y 20,4 min**, contra los 18,8 min de `WH-4`: no es un
  número fijo.

**Veredicto propuesto: `WH-1` sigue `VERIFIED`; `WH-4` sigue `VERIFIED`**, ampliadas a IPN. La
escalera completa (4º reintento a +6 h, y si hay un 5º) **no se re-midió**: exige horas con el
receptor en `fail`, y el receptor es compartido.

**Texto propuesto para la matriz, `WH-1` (agregar):**

> 📌 **2026-09-29, con los dos canales escuchando ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sonda 57)**: con el receptor en `500` el duplicado a ~0,5 s aparece **también por IPN** (`payment 180446362745`, +0,554 s). Con el receptor en `200`, cero claves repetidas dentro de un canal en 3 corridas. Un pago llega **una vez por canal** (dos entregas por hecho); un hecho del preapproval o del `authorized_payment`, una sola vez (sólo Webhooks). IPN no trae `version`: por ese canal se deduplica por el id del recurso y releyendo.

**Texto propuesto para la matriz, `WH-4` (agregar):**

> 📌 **2026-09-29 ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sonda 57), escalera inicial en los dos canales**: **IPN también reintenta** (`payment 180446362745`: dup a +0,554 s, reintento a +1030 s). Por Webhooks el primer reintento cayó a **994 s, 1004 s y 1224 s** del duplicado (contra los 1127 s del 15/09): no es un intervalo fijo. Cada reentrega trae otro `x-request-id` y otro `ts` de firma en **los dos** canales. La escalera completa no se re-midió (exige horas con el receptor compartido en `fail`).

## `WH-5` — la supersesión, con IPN escuchando

**Evidencia.** Tabla de arriba: **2 de 2** versiones viejas abandonadas (`authorized_payment
7032364572 v0` y `preapproval Q v2`), **2 de 2** nuevas reintentadas (`v1` a +1004 s, `v5` a +1224 s),
en una ventana de lectura que cubre el primer reintento de las abandonadas con margen (≥ 36 min). Es
el mismo corte que midió el 23/09 sobre 12 claves, ahora en la misma corrida en que IPN sí
reintentaba: **el canal IPN no rescata la versión abandonada**, porque ni siquiera entrega ese
tópico (sólo `payment`, que no tiene versiones que superseder).

Y el alta rechazada repetida en la corrida 3 (ver arriba): tercer caso, **sin `subscription_preapproval`
por ningún canal** con el receptor en `200`.

**Veredicto propuesto: sigue `PARTIALLY_SUPPORTED`** (el mecanismo, re-medido con los dos canales;
el alcance de producción sigue en los logs del VPS, owner).

**Texto propuesto para la matriz (agregar):**

> 📌 **2026-09-29 ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sondas 57 y 52 corrida 3), el mecanismo con los dos canales escuchando**: la supersesión se reprodujo **2 de 2** (`authorized_payment 7032364572` v0 y preapproval `08e69374…` v2 abandonadas; sus sucesoras v1 y v5 reintentadas a +1004 s y +1224 s). IPN no la compensa: ese canal sólo entrega `payment`. Y un tercer alta rechazada (`1bd4f015…`, cancelada por el proveedor en 1 s) tampoco avisó su cancelación **por ningún canal**. Sigue abierto el alcance de producción (`792eb006…`, `80a633be…`): logs del VPS, owner.

## `EX-13`, `EX-2` y `EX-14` — qué trae cada canal

**Evidencia** (todas las entregas del proveedor desde 14:52Z hasta 15:48Z, 37 en total):

| | Webhooks (`/webhooks`) | IPN (`/ipn`) |
|---|---|---|
| entregas | 29 | 8 (12 en el día, con la corrida 2) |
| tópicos | `payment`, `subscription_authorized_payment`, `subscription_preapproval` | **sólo `payment`** |
| `user-agent` | `MercadoPago WebHook v1.0 <tipo>` | `MercadoPago Feed v2.0 <tópico>` |
| query | `data.id` + `type` | `id` + `topic` |
| cuerpo | `action`, `data.id`, `id`, `date`/`date_created`, `version` (suscripciones), `live_mode` (pagos) | `{"resource","topic"}` y nada más |
| `x-signature` | presente, **verifica 29/29** con `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` | presente, **verifica 0/8** (y 0/12 contando la corrida 2; manifiesto documentado y 21 variantes más: sin `request-id`, con `topic`, con `resource`, sobre el cuerpo, sobre el path) |
| `version` | sí, monótona por recurso | **no existe** |
| `live_mode` | `true` en sandbox (igual que `EX-14`) | **no existe** |

Control de la herramienta: vector RFC 4231 caso 2, OK en cada lectura. La firma de IPN y la de
Webhooks del mismo pago comparten `ts` y difieren en `v1` y en `x-request-id`.

**Veredictos propuestos: `EX-13` sigue `VERIFIED` para Webhooks, con una restricción nueva
nombrada para IPN; `EX-2` sigue `VERIFIED`; `EX-14` sigue `NOT_SUPPORTED`.** Que IPN no verifique
**no prueba** que no sea verificable (puede ser otra clave o otro manifiesto): prueba que con la
clave que tenemos no se puede.

**Texto propuesto, `EX-13` (agregar):**

> 📌 **2026-09-29 ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sonda 55), con los dos canales**: Webhooks verifica **29 de 29** con el manifiesto de esta fila. **IPN trae `x-signature` pero no verifica: 0 de 12** con la clave de la aplicación (manifiesto documentado y 21 variantes). Consecuencia: por IPN no hay forma de rechazar un `POST` inventado; un receptor que lo acepte tiene que tratarlo sólo como disparador de una relectura, nunca como dato.

**Texto propuesto, `EX-2` (agregar):**

> 📌 **2026-09-29 ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md))**: `version` existe sólo en Webhooks. El cuerpo IPN es `{"resource","topic"}`, sin `version`, sin `date` y sin `action`.

**Texto propuesto, `EX-14` (agregar):**

> 📌 **2026-09-29 ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md))**: por IPN tampoco: el cuerpo no trae `live_mode` ni ningún otro campo de entorno.

## `EX-15` y `EX-36` — cambio de tarjeta, `reason` y tarjeta rechazada (sonda 56)

**Bitácora** (`run=20260929T151232Z`, sujeto P = `190630a44d2f4850b70906dc4316a476`; envíos UTC):

| paso | envío | acción | HTTP | relectura |
|---|---|---|---|---|
| 01 | 15:12:33,121 | crear P (master `APRO`) | 201 | `authorized`, `master` |
| 02 | 15:14:06,725 | `PUT card_token_id` → Visa `APRO` | 200 | `card_id 9884174028`, `visa`, `last_modified 11:14:08.474` |
| 03 | 15:15:39,161 | `PUT reason` | 200 | `reason` nuevo, `last_modified 11:15:39.801` |
| 04 | 15:17:11,806 | `PUT card_token_id` → master `OTHE` | **402** `Unknown error` | tarjeta **sin cambiar** (`visa`), `last_modified` sin tocar |
| 10 | 15:26:27,417 | cancelar | 200 | `cancelled`, `last_modified 11:26:28.046` |

**Lo que llegó de P:**

| llegada (UTC) | canal | tópico · id | atribución, latencia |
|---|---|---|---|
| 15:12:35.333 / .638 | Webhooks / IPN | `payment` · `181449764282` (ARS 2500, `regular_payment`) | alta, +2,21 s / +2,52 s |
| 15:13:05.763 | Webhooks | `subscription_authorized_payment` · `7032364686` `updated v1` | alta, +32,6 s |
| 15:13:05.892 | Webhooks | `subscription_preapproval` · P `updated v4` | alta, +32,8 s |
| 15:14:08.435 / .712 | **IPN** / Webhooks | `payment` · `181449227740` | **cambio de tarjeta (02)**, +1,71 s / +1,99 s |
| 15:14:35.051 | Webhooks | `subscription_preapproval` · P `updated v5` | **cambio de tarjeta (02)**, +28,3 s |
| — | — | — | **`reason` (03): nada, por ningún canal** |
| 15:17:13.689 / .741 | **IPN** / Webhooks | `payment` · `181450382740` | **cambio rechazado (04)**, +1,88 s / +1,94 s; ningún `subscription_preapproval` |
| 15:27:24.832 | Webhooks | `subscription_preapproval` · P `updated v8` | cancelar (10), +57,4 s |

Relecturas: `181449227740` → `approved/accredited`, **`operation_type: card_validation`,
`transaction_amount: 0`**, `visa`, `external_reference null`, `point_of_interaction UNSPECIFIED`.
`181450382740` → **`rejected/cc_rejected_other_reason`**, `card_validation`, ARS 0,
`external_reference null`. **Ninguno de los dos pagos nombra al preapproval**: el único vínculo es
el `payer.id` (`3694588836`). Entre v5 y v8 de P hay dos versiones sin aviso (v6 y v7): una es el
`reason`; la otra no se pudo atribuir (el cambio rechazado no movió `last_modified`).

**Veredicto propuesto: `EX-15` sigue en el que proponga el anexo** (esta batería no cambia la
pregunta, la amplía); **`EX-36` sigue `VERIFIED`**, ampliada.

**Texto propuesto, `EX-15` (agregar):**

> 📌 **2026-09-29 ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sondas 52 corrida 3 y 56), con los dos canales**: subir el monto no llega por **ningún** canal (`version` 4 → 6). **Reescribir el `reason` tampoco** (`last_modified` movido, cero entregas en 92 s y después). **Cambiar la tarjeta SÍ avisa**: `subscription_preapproval` por Webhooks (+28 s) y el `payment` de validación de ARS 0 por **los dos** canales (+2 s). Un cambio de tarjeta **rechazado** (`402`) avisa sólo ese `payment` rechazado. Las órdenes y sus reembolsos no avisan (ver `RF-7`).

**Texto propuesto, `EX-36` (agregar):**

> 📌 **2026-09-29 ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sonda 56), qué avisa**: el cambio llega como `subscription_preapproval` (Webhooks, +28 s) y como un `payment` de **ARS 0 con `operation_type: card_validation`** por IPN y por Webhooks (+2 s). El rechazado (`402`) llega sólo como ese `payment`, `rejected`. **Trampa para el receptor**: ese `payment` no trae `external_reference` ni nada que nombre al preapproval (sólo `payer.id`), y por IPN es indistinguible de un cobro hasta releerlo: un handler de `payment` que no mire `operation_type` registra un «cobro» de cero pesos o un «cobro rechazado» que no es de ningún ciclo.

## `RF-7` — reembolsos por la Orders API, en sandbox

**Qué se hizo.** Por la Orders API, que en sandbox sí reembolsa (la de Payments da `401` a la cuenta
de pruebas, 15/09). Cuatro órdenes más la de la corrida 3:

| paso | envío (UTC) | acción | HTTP | resultado releído |
|---|---|---|---|---|
| 52·09b | 15:05:13,329 | orden aprobada | 201 | `ORDTST01M3PV5KW7T084ZMHWWZDXRD1Y` `processed/accredited` |
| 57·03 | 15:11:38 | orden aprobada (en `fail`) | 201 | `ORDTST01M3PVH9S7688Z0QN6MRHD1NTN` `processed/accredited` |
| 56·05 | 15:18:44,961 | orden aprobada O1 | 201 | `ORDTST01M3PVYCGN9A1X6VEY3Y41WK38` |
| 56·06 | 15:20:17,805 | orden con tarjeta `OTHE` | **402** | **igual creó la orden**: `ORDTST01M3PW176PM2VSH08ESW6WRZSS`, `failed`, pago `rejected_by_issuer` (y el cuerpo del `402` dice `total_paid_amount: "100.00"`) |
| 56·07 | 15:21:50,355 | **reembolso total** de O1 (`POST /v1/orders/{id}/refund`, sin cuerpo) | 201 | O1 `refunded/refunded`, `REF01M3PW41KDQFR3ZGH3J7MC5YDK` 100,00 `processed` |
| 56·08 | 15:23:23,092 | orden aprobada O2 | 201 | `ORDTST01M3PW6W4H3PRJ40AEW1YD8T1K` |
| 56·09 | 15:24:55,372 | **reembolso parcial** 40 de O2 | 201 | O2 `processed/partially_refunded`, `REF01M3PW9P8KM4JMTZFRR6374KCN` 40,00, `refunded_amount 40.00` |

**Evidencia.** **Cero entregas** de cualquiera de las cinco órdenes, de la fallida y de los dos
reembolsos, **por ningún canal**, leyendo hasta 15:48Z (entre 23 y 43 min después). En la misma
ventana (15:05:13Z → 15:48Z) el receptor recibió 29 entregas de otros hechos, así que no es el receptor.

**Veredicto propuesto: `RF-7` sigue `VERIFIED`** (lo medido en producción es el reembolso de un
pago de `/v1/payments`, y eso no se puede re-medir en sandbox). Lo de hoy es otra API, y se propone
anotarlo aparte.

**Texto propuesto, `RF-7` (agregar):**

> 📌 **2026-09-29 ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sonda 56), la Orders API en sandbox**: un reembolso **total** y uno **parcial** de órdenes (`POST /v1/orders/{id}/refund`, `201`, releídos `refunded` y `partially_refunded`) **no produjeron ninguna entrega por ningún canal** en 23-27 min, con todos los eventos tildados. Tampoco ninguna de las 5 órdenes (4 aprobadas, 1 `failed`). Lo medido en producción (3 entregas por reembolso de `/v1/payments`) no cambia: es otra API, y en sandbox la de Payments da `401`. **Si el addon one-time va por `/v1/orders` (`EX-30`), su cobro y su reembolso no tienen aviso en sandbox**: se confirman releyendo la orden.

**Hallazgo lateral para `EX-30`/`EX-41` (no pedido):** una orden con tarjeta rechazada devuelve
`402`, **crea la orden igual** (`failed`, con id) y la devuelve en `data` del error. Es el mismo
patrón de `EX-55` para preapprovals, con la diferencia de que acá el id **sí** viene en la respuesta.

## `WH-2` y `WH-3` — latencia y orden, muestra del día

- **Latencia desde el envío** (receptor en `ok`), por Webhooks: pagos 1,99-2,74 s; primer aviso del
  preapproval en el alta 10,4 s y 32,8 s; pausa 2,17 s; reanudar 9,20 s; cancelar 28,5 s y 57,4 s;
  cambio de tarjeta 28,3 s; `authorized_payment` del alta rechazada 43,4 s. Por IPN, pagos 1,71-2,81 s.
  Todo dentro de la distribución de `WH-2` (p90 20,4 s ya dejaba afuera los de 28-57 s).
- **Orden entre canales para el mismo pago**: 6 pares con el receptor en `ok` o en `fail`: IPN primero
  3 veces, Webhooks primero 3 veces, con diferencias de 19 a 305 ms. **No hay canal que llegue
  primero de forma fija.**
- **Dentro de Webhooks**: cero inversiones de `version` por recurso en las tres corridas.
- **Un alta no siempre trae `created v0` del `authorized_payment`**: en P (sonda 56) sólo llegó
  `updated v1` (+32,6 s), mientras que en `0f226f7e…` y en Q llegaron las dos. Muestra chica: se anota,
  no se concluye.

**Veredictos propuestos: `WH-2` sigue `VERIFIED`; `WH-3` sigue `PARTIALLY_SUPPORTED`.** No se
propone texto nuevo: la muestra del día no mueve los números de las filas (salvo el orden entre
canales, que va en `WH-6`).

## `WH-6` — lo que agrega esta batería

**Veredicto:** el que proponga el anexo (`VERIFIED`). Esta batería lo sostiene con dos corridas
más y le suma tres cosas:

**Texto propuesto, `WH-6` (agregar, además del del anexo):**

> 📌 **2026-09-29, tarde ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sondas 52 corrida 3, 56 y 57)**: con la configuración ya estable, **IPN entrega sólo `payment` (12 de 12 en el día)**, incluidos los `payment` de ARS 0 de validación de tarjeta; Webhooks entrega además los de preapproval y `authorized_payment`. Un pago llega **una vez por canal**, sin canal que gane siempre (3 y 3, 19-305 ms). **IPN reintenta como Webhooks** (dup +0,55 s, reintento +17,2 min) y **no verifica la firma** con la clave de la aplicación (0/12). Órdenes y reembolsos de órdenes: **cero entregas por ningún canal**.

## Un indicio para `EX-46` (no una medición)

Durante el cambio de URL que hizo el owner en la corrida 2, el `authorized_payment 7032364102 v2` y el
`preapproval f988256… v7`, fechados `14:34:27Z` en su propio cuerpo, llegaron a **`/webhooks`** a las
**14:40:10Z** (5 min 43 s tarde), mientras el `payment` del mismo instante llegó a la **raíz `/`** a
14:34:27Z. Si hubo un primer intento a la raíz, **no quedó registrado** (el receptor contestaba `200`
a todo, así que lo habría guardado). Es compatible con «el aviso sale a la URL vigente al momento de
entregar», pero **no es la pregunta de `EX-46`**, que es sobre un **reintento** tras un `500`. No se
propone cambio de estado.

## Lo que queda, y cómo se haría

| qué | fila | por qué no hoy | cómo |
|---|---|---|---|
| la escalera completa de reintentos (¿termina en la 5ª, a +6 h?) en los dos canales | `WH-4` | exige el receptor en `fail` horas, y es compartido | **una tarde**: receptor propio o una ruta `/ipn-fail`/`/webhooks-fail` en el Worker (cambiar las URL de la app exige panel, owner), un hecho, leer a +7 h |
| a qué URL va un reintento tras cambiar la URL | `EX-46` | exige cambiar la URL en el **panel** | **pasada con el owner**: `mode=fail`, un alta, cambiar la URL de Webhooks a `/webhooks-b`, `mode=ok`, ver en qué path cae el reintento de +17 min |
| la firma de IPN | `EX-13` | no hay otra clave para probar | **owner**: mirar en el panel si IPN tiene una clave propia; si la hay, correr la sonda 55 con `SECRET_FILE` apuntando a ella |
| alcance de producción de la cancelación por antifraude | `WH-5` | producción | **owner**: `hops logs api --since 9d` por `792eb006…` / `80a633be…` y `topic=` (paso 5 del informe de la madrugada) |
| la pausa por mora y el cierre `scheduled → processed` con IPN escuchando | `GR-3` | la mora no se fabrica en sandbox (`PA-4`; hoy el cambio a `OTHE` volvió a dar `402`) | **producción + días**: leer los logs de la API (que sí ven IPN) en el próximo ciclo rechazado real. Dado que IPN sólo entrega `payment`, se espera nada nuevo; hoy es inferencia, no medición |
| el reembolso de `/v1/payments` con los dos canales | `RF-7` | sandbox da `401` | **producción**: ya medido por logs; re-medir sólo si cambia el receptor |
| contracargo | `RC-8` | exige una disputa real | **sólo producción**, cuando ocurra; leer `topic_chargebacks_wh` en los logs |
| la cola de demoras de días y el desorden a volumen | `WH-2`, `WH-3` | necesitan semanas de tráfico | **días**: dejar el receptor escuchando y re-correr la lectura del 23/09 con el lector de la sonda 55 |
| los correos al pagador | `EX-54`, `EX-3` | casilla real | **owner** (sonda 54, informe de la madrugada) |

## Estado en que quedan las cosas

- Receptor de la sonda 08: arriba, en **`ok`** (leído a las 15:49Z). Estuvo en `fail` **sólo** de
  15:09:31,764Z a 15:12:23,993Z. Dump sin borrar.
- Sujetos de sandbox creados hoy por esta batería, **todos cancelados**: `0f226f7e…` (52 corrida 3),
  `1bd4f015…` (cancelado por el proveedor), `08e69374…` (Q, cancelado a las 15:49Z), `190630a4…` (P).
  Las órdenes O1 y O2 quedaron `refunded` y `partially_refunded`; las otras tres, `processed` o `failed`.
- No se tocaron `b12af185…` ni `e6766650…` (sujetos de `EX-52`/`EX-53`), ni `a459aa50…`, ni
  `7eb2a11b…` (que figura `pending` en el `search`; es de la corrida 2, no de esta batería).
- Producción: **no se leyó ni se tocó**. Panel: **sin cambios**. Matriz y `RESULTS-2026-09-29.md`:
  **sin cambios**.
