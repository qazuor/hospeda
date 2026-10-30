---
title: "Revisión del owner · lote de la matriz con las mediciones del 2026-09-29 (los dos canales)"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · lote de la matriz con las mediciones del 2026-09-29

**Es una propuesta: no se editó la matriz, ni el log, ni ningún informe.** Junta en un lote lo que
proponen [`RESULTS-2026-09-29.md`](../mp-probes/RESULTS-2026-09-29.md) (la madrugada y su *Anexo: con
los dos canales escuchando*) y [`RESULTS-2026-09-29-bateria-ipn.md`](../mp-probes/RESULTS-2026-09-29-bateria-ipn.md)
(inventario, corrida 3 de la sonda 52, sondas 55 a 57), más una lectura de producción que hizo el
orquestador y que todavía no está escrita en ningún informe (§ 0). Se aplica con el OK del owner,
con la forma de [`24-`](./24-aplicacion-casos-log-y-matriz.md). Leído sobre el HEAD `66f27781c3` del
worktree `hospeda-spec-hos-1352-billing-redesign`. `D/06` es la matriz, `B/` es
`HOS-1354…/docs`, `$B/` y `$D/` las raíces.

**Antes de proponer grepeé cada ID.** Existen todas las filas que se tocan. `EX-55` y `EX-56` **no
existen** en la matriz (la última `EX` es `EX-54`): son los siguientes libres, y son los mismos que
usan los dos informes.

**Cuando un informe y la batería proponían dos textos para la misma celda** (`WH-6`, `EX-15`,
`WH-5`), los junté en uno solo: pegarlos por separado repite el mismo hecho dos veces con dos
cifras distintas (*«4 de 4»* a la mañana, *«12 de 12»* a la tarde). Cada texto dice de qué
informe sale cada parte. Los que la batería da como definitivos (`WH-1`, `WH-4`, `EX-2`, `EX-13`,
`EX-14`, `EX-36`, `RF-7`) van casi como vienen; lo que cambié está dicho en su *Razón*.

## 0. Antes de aplicar: dos cosas que el lote necesita

1. **La lectura de producción no tiene informe.** `WH-5` y `WH-6` la citan. La matriz exige
   evidencia en un archivo (regla 5), y `RF-7` es el precedente: cita *«[logs de la API de
   producción](./mp-probes/RESULTS-2026-09-15.md)»*. Propongo escribirla como sección al final de
   `RESULTS-2026-09-29.md`, titulada `## Anexo: producción, logs de la API (29/09, tarde)`, con lo
   que sigue, y los textos de abajo ya la citan con ese ancla. Lo que dice, tal como lo trajo el
   orquestador (producción, sólo lectura, 2026-09-29 ~15:30 `-03`):
   - `hops logs api --since 216h` en el VPS devuelve logs **desde 2026-09-25 10:33** y no antes:
     la entrega de `792eb0064a…` del 2026-09-21 **no es recuperable**; no es que no llegó.
   - En esos ~4 días el receptor de hospeda2 registró **8 entregas IPN** (`?id=…&topic=payment`),
     **las 8 `topic=payment`**, y por Webhooks `type=payment` **8**,
     `type=subscription_authorized_payment` **65** y `type=subscription_preapproval` **5**.
   - **2026-09-28 11:02:32**: un webhook de `subscription_authorized_payment` (`invoice.updated` en
     la capa legacy) sobre el preapproval `80a633bec9b04942996f6826b95e0cc8` dio `ERROR` *«no local
     subscription found for preapproval ID even after the HOS-276 linking fallback — payment NOT
     recorded, forcing a retry»*, y un `WARN` HOS-191 link-preapproval: *could not resolve
     preapproval_plan_id*.
   - Lo que no consta y conviene anotar en el anexo: si las 8 IPN y los 8 `payment` de Webhooks se
     cruzaron por id (el conteo coincide; el cruce no me llegó).
2. **El script de conteo no ignora el tachado, y dos celdas de este lote lo harían mentir.**
   `contar-filas-de-la-matriz.py` busca en cada celda los estados **por prioridad**
   (`PARTIALLY_SUPPORTED`, `NOT_SUPPORTED`, `VERIFIED`, `UNKNOWN`), no por posición, y no descarta lo
   que está entre `~~`. Una celda `` ~~**`PARTIALLY_SUPPORTED`**~~ **`VERIFIED`** `` cuenta
   **`PARTIALLY_SUPPORTED`**: lo probé sobre una copia de la matriz (la `WH-6` así escrita dio 55 ·
   18 · 23 · 16). Hoy no hace daño por casualidad: `WH-5` y `EX-15` tienen `VERIFIED` tachado y
   `PARTIALLY_SUPPORTED` vivo, y gana el vivo por prioridad. Pero `WH-5` y `EX-15` **vuelven** a
   `VERIFIED` en este lote. Por eso propongo que su celda de estado quede **`VERIFIED` a secas** y
   que la historia (reabierta el 28/09, cerrada el 29/09) vaya en la conclusión. La otra salida es
   arreglar el script para que descarte lo tachado, pero eso es otro cambio y pide su propio OK. Las
   celdas `` ~~`UNKNOWN`~~ **`X`** `` no tienen el problema, porque `UNKNOWN` es la última prioridad,
   así que para `WH-6`, `EX-52` y `EX-53` se usa esa forma, como en `GR-1`.

## 1. Tabla resumen

| ID | estado hoy → propuesto | qué cambia |
|---|---|---|
| `WH-6` | `UNKNOWN` → **`VERIFIED`** | IPN entrega sólo `payment` (sandbox 12/12, producción 8/8); un pago llega una vez por canal, sin orden fijo; IPN no verifica la firma |
| `EX-15` | `PARTIALLY_SUPPORTED` → **`VERIFIED`** | IPN no cubre ningún hueco; se suman el `reason`, el cambio de tarjeta (sí avisa), la cancelación del proveedor, las órdenes y sus reembolsos |
| `WH-5` | `PARTIALLY_SUPPORTED` → **`VERIFIED`** *(recomendado; ver su razón)* | la hipótesis «llegó por IPN y se descartó» queda descartada por el canal en sandbox **y en producción**; la cancelación por antifraude no se notifica (3 de 3 en sandbox); la entrega del 21/09 no es recuperable; un dato lateral de producción |
| `EX-52` | `UNKNOWN` → **`VERIFIED`** | la baja del pagador llega sólo por Webhooks y no se distingue de una nuestra |
| `EX-53` | `UNKNOWN` → **`NOT_SUPPORTED`** | el pagador no puede pausar desde su cuenta (falta confirmar si se miraron web y app) |
| `EX-55` ✚ | nueva → **`VERIFIED`** | un alta que devuelve `400` deja un preapproval creado (3 de 3) |
| `EX-56` ✚ | nueva → **`VERIFIED`** | el alta por API con token queda a nombre de un pagador invitado que no la ve |
| `EX-54` | `UNKNOWN` → `UNKNOWN` | 🚧 no medible en sandbox; sonda 54 lista para el owner |
| `WH-1` | `VERIFIED` → `VERIFIED` | el duplicado a ~0,5 s también por IPN; IPN no trae `version` |
| `WH-4` | `VERIFIED` → `VERIFIED` | IPN reintenta como Webhooks; el primer reintento no es un intervalo fijo |
| `EX-2` | `VERIFIED` → `VERIFIED` | `version` existe sólo en Webhooks |
| `EX-13` | `VERIFIED` → `VERIFIED` | Webhooks 29/29; IPN 0/12: por IPN no hay firma verificable |
| `EX-14` | `NOT_SUPPORTED` → `NOT_SUPPORTED` | IPN tampoco trae el entorno |
| `EX-16` | `VERIFIED` → `VERIFIED` | un registro de cobro que se encuentra por búsqueda da `404` por id |
| `EX-30` | `VERIFIED` → `VERIFIED` | una orden con tarjeta rechazada devuelve `402` y queda creada, `failed` |
| `EX-36` | `VERIFIED` → `VERIFIED` | qué avisa el cambio de tarjeta, y la trampa del `payment` de ARS 0 |
| `EX-44` | `UNKNOWN` → `UNKNOWN` | 🔎 indicio de producción (el dato lateral de `80a633be…`), no medición |
| `EX-46` | `UNKNOWN` → `UNKNOWN` | 🔎 indicio de la corrida 2, no medición |
| `PA-6` | `UNKNOWN` → `UNKNOWN` | 🔎 en sandbox el proveedor canceló con `cc_rejected_other_reason`, 3 de 3 |
| `RC-4` | `NOT_SUPPORTED` → `NOT_SUPPORTED` | el `search` muestra el estado atrasado minutos respecto del `GET` |
| `RF-7` | `VERIFIED` → `VERIFIED` | los reembolsos por la Orders API no avisan en sandbox (remite a `EX-15`) |

**Sin cambio y sin texto**: `WH-2` y `WH-3` (la muestra del día no mueve sus cifras; el orden
entre canales va en `WH-6`), `GR-3` y `RC-8` (no re-medibles hoy), y `PC-3`, `CT-3` y `EX-3`, que
citan a `EX-15` para *«mutar el monto no emite»*: con `EX-15` cerrada en los dos canales esa cita
vale tal como está.

## 2. Por fila, el texto exacto

**Forma.** Las marcas son las que la matriz ya usa en sus celdas: ✅ para un cierre, 📌 para una
ampliación, 🔎 para un indicio que no es medición, 🚧 para lo que no se pudo medir y ⛔ para un
`NOT_SUPPORTED`. Cada una lleva la fecha y el informe con link, como el 📌 de `WH-1` del
2026-09-23. Todos los links son relativos a `$D/`, porque es desde donde los lee la matriz. Lo que
se tacha va dicho aparte. El texto a agregar va en un bloque de código para que se copie tal cual,
y se pega **al final de la celda de conclusión**, separado con un espacio.

### 2.1 `WH-6` — `UNKNOWN` → `VERIFIED`

Celdas de estado, fecha, entorno y evidencia (hoy `` `UNKNOWN` | — | — | — ``):

```text
~~`UNKNOWN`~~ **`VERIFIED`** | **2026-09-29** | **sandbox (los dos canales) + producción (logs, sólo lectura)** | [mediciones del 29/09, anexo](./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana) · [batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md) · sondas 52 (corridas 2 y 3), 55, 56 y 57 · [logs de la API de producción](./mp-probes/RESULTS-2026-09-29.md#anexo-producción-logs-de-la-api-2909-tarde)
```

Conclusión: se tacha el primer *«Sin medir.»* (queda `~~Sin medir.~~ Secuencia de la sonda 09…`) y
se agrega:

```text
✅ **Medida el 2026-09-29 con los dos canales escuchando** ([anexo del 29/09](./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana), sonda 52 corrida 2 y `EX-52`; [batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sondas 52 corrida 3, 56 y 57; [logs de producción](./mp-probes/RESULTS-2026-09-29.md#anexo-producción-logs-de-la-api-2909-tarde)). **IPN entrega sólo `payment`**: 12 de 12 entregas del día en sandbox (cuerpo `{"resource","topic"}`, `user-agent: MercadoPago Feed v2.0`, sin `action`, `date` ni `version`), incluidos los `payment` de ARS 0 de validación de tarjeta; y **8 de 8 en producción** entre el 2026-09-25 y el 2026-09-29, contra 8 `payment`, 65 `subscription_authorized_payment` y 5 `subscription_preapproval` por Webhooks. **Webhooks entrega `payment`, `subscription_authorized_payment` y `subscription_preapproval`**. Un pago produce **exactamente dos entregas**, una por canal, a 2-334 ms entre sí y **sin canal que llegue primero** (IPN primero en 1 de 4 pares a la mañana y en 3 de 6 a la tarde); un hecho del preapproval o del `authorized_payment` produce **una**, sólo por Webhooks. **IPN no avisa** la subida de monto, la pausa, la cancelación del comprador ni la del proveedor tras un rechazo. **IPN también reintenta** (`WH-4`) y **no verifica la firma** con la clave de la aplicación (`EX-13`). Órdenes de `/v1/orders` y sus reembolsos: **cero entregas por ningún canal** en sandbox, con *Order* tildado (la API sigue leyendo `notifications_topics: []`, que no refleja el panel). ⚠️ **«Sólo `payment`» vale para lo medido acá (suscripciones, órdenes y cambios de tarjeta)**: `RF-7` midió en producción un `topic=merchant_order` por IPN tras un reembolso de `/v1/payments`. Consecuencia: **descartar IPN no pierde ningún hecho de suscripción**, y escuchar los dos obliga a deduplicar `payment` por el id del recurso entre canales
```

**Razón.** El veredicto del anexo (`VERIFIED`: la pregunta es la comparación entre canales, y IPN
quedó medido limpio), sostenido por la corrida 3 y la batería, y ahora también por producción. Le
agregué dos cosas que ningún informe dice juntas: los números de producción, y la salvedad de
`RF-7`. Sin ella, *«IPN entrega sólo `payment`»* contradice una fila `VERIFIED` de la misma matriz,
que en producción vio un `merchant_order` por IPN.

### 2.2 `EX-15` — `PARTIALLY_SUPPORTED` → `VERIFIED`

Celdas de estado, fecha, entorno y evidencia. Hoy:

```text
~~**`VERIFIED`**~~ **`PARTIALLY_SUPPORTED`** | 2026-09-15 | sandbox | [sondas 08/09](./mp-probes/RESULTS-2026-09-15.md)
```

Se propone (estado **sin** tachado, por § 0.2):

```text
**`VERIFIED`** | ~~2026-09-15~~ **2026-09-29** | sandbox (**los dos canales** desde el 2026-09-29) | [sondas 08/09](./mp-probes/RESULTS-2026-09-15.md) · [mediciones del 29/09](./mp-probes/RESULTS-2026-09-29.md) · [batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sondas 52 (corridas 1 a 3) y 56
```

Conclusión, agregar:

```text
✅ **Cerrada el 2026-09-29 con los dos canales escuchando** (reabierta a `PARTIALLY_SUPPORTED` el 2026-09-28; [mediciones del 29/09](./mp-probes/RESULTS-2026-09-29.md), sonda 52 corridas 1 y 2; [batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sondas 52 corrida 3 y 56). **IPN no emite nada de preapproval ni de `authorized_payment`**, sólo `payment`, así que **no cubre ningún hueco** de Webhooks (`WH-6`). **Sin aviso por ningún canal**: mutar el monto en las dos direcciones (subir: `version` 2 → 7 y 4 → 6 sin entrega), **reescribir el `reason`** (`last_modified` movido, cero entregas), **la cancelación que hace el proveedor tras un alta con cobro rechazado** (3 de 3: `715371d2…`, `7eb2a11b…` y `1bd4f015…`, mientras su `payment` y su `authorized_payment` sí llegaron; ver `WH-5`), y **las órdenes de `/v1/orders` y sus reembolsos**, total y parcial (5 órdenes y 2 reembolsos, cero entregas en 23-43 min). **Sí avisan**: crear, pausar, reanudar y cancelar por `PUT` (una vez cada uno), la cancelación **del comprador**, sólo por Webhooks (`EX-52`), y **cambiar la tarjeta**: un `subscription_preapproval` por Webhooks (+28 s) y el `payment` de validación de ARS 0 por los dos canales (`EX-36`); un cambio de tarjeta rechazado (`402`) avisa sólo ese `payment`. El alta llega como `updated`, nunca como `created`. ⚠️ **La `version` salta sin aviso** (entre v5 y v8 del mismo preapproval hubo dos versiones sin aviso, y sólo una se pudo atribuir, al `reason`): **un hueco de `version` no prueba un aviso perdido**
```

**Razón.** El anexo proponía `VERIFIED` (el motivo de la reapertura, IPN sin medir, quedó cerrado)
y la batería ampliaba sin cambiar la pregunta. Junté los dos para que la celda no diga dos veces
lo del monto. La última oración es mía, sale de la bitácora de la sonda 56 (dos versiones sin
aviso entre v5 y v8, una sola atribuible): la agrego porque es lo que un receptor que razone por
*«falta la `version` N, se perdió un aviso»* haría mal, y `WH-5` ya pide releer en vez de
reconstruir.

### 2.3 `WH-5` — `PARTIALLY_SUPPORTED` → `VERIFIED` (recomendado)

Celdas de estado, fecha, entorno y evidencia. Hoy:

```text
~~**`VERIFIED`**~~ **`PARTIALLY_SUPPORTED`** | **2026-09-23** | **sandbox (el mecanismo) + producción (el alcance)** | [mediciones del 23/09](./mp-probes/RESULTS-2026-09-23.md) · 532 eventos del receptor propio + `billing_webhook_events` de producción
```

Se propone:

```text
**`VERIFIED`** | ~~**2026-09-23**~~ **2026-09-29** | **sandbox (el mecanismo) + producción (el alcance y el canal)** | [mediciones del 23/09](./mp-probes/RESULTS-2026-09-23.md) · 532 eventos del receptor propio + `billing_webhook_events` de producción · [mediciones del 29/09](./mp-probes/RESULTS-2026-09-29.md) · [batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sondas 52 y 57 · [logs de la API de producción](./mp-probes/RESULTS-2026-09-29.md#anexo-producción-logs-de-la-api-2909-tarde)
```

Conclusión, agregar:

```text
✅ **Cerrada el 2026-09-29** (reabierta a `PARTIALLY_SUPPORTED` el 2026-09-28; [mediciones del 29/09](./mp-probes/RESULTS-2026-09-29.md), [batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), [logs de producción](./mp-probes/RESULTS-2026-09-29.md#anexo-producción-logs-de-la-api-2909-tarde)). **La tercera explicación, «llegó por IPN y se descartó», queda descartada por el canal, en los dos entornos**: IPN entrega sólo `payment` (sandbox 12 de 12; producción 8 de 8 entre el 2026-09-25 y el 2026-09-29), así que el filtro `source_news=webhooks` (HOS-159) sólo pudo haber descartado el `payment` gemelo, que también llega por Webhooks. **Y la no notificación se reprodujo a propósito 3 de 3 en sandbox**: un alta `authorized` con tarjeta rechazada (`400` sin id, `EX-55`) que el proveedor cancela a los 11 s, 1,95 s y 1 s, con el receptor contestando `200` a todo, trae su `payment` y su `authorized_payment` y **ningún `subscription_preapproval` por ningún canal**. Sin una entrega fallida no hay reintento que la supersesión pueda abandonar: **esa transición no se notifica**, no se pierde. **La supersesión, re-medida con los dos canales**: 2 de 2 versiones viejas abandonadas (`authorized_payment 7032364572` v0 y preapproval `08e69374…` v2) y sus sucesoras reintentadas a +1004 s y +1224 s; IPN no la compensa porque no entrega esos tópicos. 🚧 **Lo que no se recupera**: la entrega de `792eb006…` del 2026-09-21, porque los logs de producción empiezan el 2026-09-25 10:33; eso es «no recuperable», no «no llegó». 🔎 **Dato lateral de producción, sin interpretar**: el 2026-09-28 11:02:32 llegó por Webhooks un `subscription_authorized_payment` sobre `80a633be…` (la otra cancelación por antifraude, ya `cancelled` en la lectura del 2026-09-23), y el receptor de hospeda2 lo rechazó para forzar un reintento (`ERROR` *«no local subscription found for preapproval ID even after the HOS-276 linking fallback — payment NOT recorded, forcing a retry»*; `WARN` HOS-191 *«could not resolve preapproval_plan_id»*). El log no dice si es un reciclado del cobro rechazado o un registro de un ciclo nuevo (ver `EX-44`)
```

**Razón.** El anexo dejaba una condición: *«si ahí [en los logs de producción] no hay entregas IPN
de preapproval para `792eb006…` ni `80a633be…`, pasa a `VERIFIED`»*. **Literalmente no se
cumple**, porque los logs no llegan al 21/09. Lo que llegó es más fuerte que la condición: en
producción **ninguna** entrega IPN de cuatro días es de preapproval, así que la hipótesis cae por el
canal y no por el id. Lo que queda sin medir es la entrega de un día puntual. **Alternativa**, si
el owner prefiere no cerrar sobre un día sin logs: dejar `PARTIALLY_SUPPORTED`, con la restricción
nombrada *«la entrega de `792eb006…` del 21/09 no es recuperable»*, y el mismo texto sin el
*«Cerrada»*. Las cifras de § 3 dan las dos. Sobre el dato lateral: va como 🔎 en esta fila y en
`EX-44`, **no como fila nueva**. No contesta ninguna pregunta que la matriz no tenga ya:
*«¿cancelar corta el reciclado?»* es `EX-44`, y el estado `recycling` sobre altas canceladas por
el proveedor ya está en `RC-6`. Tampoco se puede medir a voluntad. Lo que sí pide es un ítem para
el diseño del receptor (§ 4, punto 9).

### 2.4 `EX-52` — `UNKNOWN` → `VERIFIED`

Celdas de estado, fecha, entorno y evidencia (hoy `` `UNKNOWN` | — | — | — ``):

```text
~~`UNKNOWN`~~ **`VERIFIED`** | **2026-09-29** | **sandbox, cuenta real del comprador de prueba** | [mediciones del 29/09, anexo](./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana) · `06fed561…` cancelado por el owner desde la cuenta del comprador (11:48 `-03`)
```

Conclusión: se tacha *«Sin medir.»* (queda `~~Sin medir.~~ Con un comprador de prueba…`) y se
agrega:

```text
✅ **2026-09-29, el owner desde la cuenta del comprador** ([anexo del 29/09](./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana)): cancelar deja el preapproval `cancelled` y llega **un** `subscription_preapproval` `updated` **sólo por Webhooks**, a +2,6 s; **nada por IPN**, ningún pago ni `authorized_payment`. **Ningún campo de la relectura ni del aviso la distingue de una cancelación nuestra por `PUT`**: mismo cuerpo, mismo `status`, sin actor ni motivo. La del proveedor tras un rechazo sí se reconoce, pero sólo porque nunca cobró (`card_id` ausente, `summarized` en `null`, `next_payment_date` igual a `date_created`). Consecuencia para `DEC-MP-008`/`DEC-SUB-009`: **la autoría de una baja sólo se conoce por nuestro propio registro** (si no la pedimos, vino de afuera). Sólo se puede medir, y sólo existe, con un alta por checkout con el comprador logueado (`EX-56`)
```

**Razón.** El texto del anexo. Le agregué `next_payment_date` a lo que reconoce la baja del
proveedor, que el anexo enumera en su diff pero no en el texto propuesto, y cambié el cierre
*«Ojo: sólo se puede medir»* por *«sólo se puede medir, y sólo existe»*. Según `EX-56`, un pagador
invitado no ve la suscripción, así que tampoco puede darla de baja: el caso **no existe** para
esas altas, además de no poder medirse.

### 2.5 `EX-53` — `UNKNOWN` → `NOT_SUPPORTED`

Celdas de estado, fecha, entorno y evidencia (hoy `` `UNKNOWN` | — | — | — ``):

```text
~~`UNKNOWN`~~ **`NOT_SUPPORTED`** | **2026-09-29** | **sandbox, cuenta real del comprador de prueba** | [mediciones del 29/09, anexo](./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana) · `a459aa50…`, relectura sin cambios
```

Conclusión: se tacha *«Sin medir»* y se agrega:

```text
⛔ **2026-09-29, el owner desde la cuenta del comprador** ([anexo del 29/09](./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana)): **el pagador no puede pausar**. La opción no aparece sobre una suscripción `authorized` (`a459aa50…`) que la misma cuenta sí puede cancelar (`EX-52`); la relectura no cambió (`last_modified` de la autorización) y no llegó ningún aviso. Mirado en **[web / app / las dos: a completar por el owner]**. Consecuencia: **toda pausa es nuestra** (`PUT`) **o de mora** (`GR-3`), así que una `paused` sin `PUT` nuestro y sin intentos rechazados en el ciclo sería una anomalía, no una pausa voluntaria
```

**Razón.** El veredicto del anexo, que lo condiciona a que el owner confirme si miró la web **y**
la app. El informe no lo dice, así que el texto deja el hueco marcado entre corchetes y **no se
aplica hasta que el owner lo llene**. Si miró una sola, queda igual `NOT_SUPPORTED` con esa
salvedad escrita (*«mirado sólo en la web; la app no se miró»*), como propone el anexo.

### 2.6 `EX-55` ✚ — fila nueva, `VERIFIED`

Va debajo de `EX-54`, al final de la misma tabla, como entró `EX-54` (`24-` § 4.3). Ocho columnas:

```text
| **EX-55** ✚ | ¿Un alta de preapproval que devuelve `400` deja un preapproval creado? | el contrato de errores de todo alta con `card_token_id`: un `400` al crear no prueba que no se creó nada, y las entregas de lo que sí se creó llegan con ids que nuestra base no conoce (`EX-17`, `PA-4`; hallazgo lateral de la sonda 52, 2026-09-29) | **`VERIFIED`** | 2026-09-29 | sandbox | [mediciones del 29/09](./mp-probes/RESULTS-2026-09-29.md) · [batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sonda 52 paso 10 en las corridas 1, 2 y 3 | **Sí, 3 de 3.** Un alta `authorized` con tarjeta rechazada (titular `OTHE`) devuelve `400 CC_VAL_433` **sin id** (`{"message":"CC_VAL_433 Credit card validation has failed","code":"rejected","status":400}`), pero el proveedor **crea** el preapproval con nuestro `external_reference` (`715371d2…`, `7eb2a11b…`, `1bd4f015…`), intenta el cobro (`cc_rejected_other_reason`), deja un `authorized_payment` `scheduled` con `rejection_code`, lo **cancela** a los 11 s, 1,95 s y 1 s, y **no avisa esa cancelación por ningún canal** (`WH-5`). Llegan su `payment` (por los dos canales) y su `authorized_payment` (por Webhooks). **Sólo se encuentra** ordenando `/preapproval/search` por fecha (el filtro `external_reference` se ignora, `RC-1`), y **el `search` muestra el estado atrasado minutos**: `pending` a +2 y +5 min cuando el `GET` por id ya daba `cancelled` (`RC-4`). Su `authorized_payment` aparece en `/authorized_payments/search` y da `404` por id (`EX-16`). Consecuencia: un `400` al crear **no prueba que no se creó nada**; la llave para asociar lo que llega es el `external_reference`, que viaja en el `payment`. Contraste: una **orden** con tarjeta rechazada también queda creada, pero ahí el id **sí** viene en el cuerpo del `402` (`EX-30`). Producción no medida |
```

**Razón.** El texto del anexo, pasado de 2 de 2 a **3 de 3** con la corrida 3 de la batería, y con
un *Para qué* que nombra a qué contrato le importa. El anexo decía *«hallazgo lateral»*, que dice
de dónde salió la fila pero no para qué sirve, y las demás filas `EX` llevan ahí su porqué. Sumé
también dos hechos del mismo caso que el anexo había dejado fuera del texto: el `404` por id de la
madrugada y el contraste con la orden. **La orden `failed` con `402` no va como fila propia.** Es
la misma pregunta (*«un error al crear ¿deja algo creado?»*) sobre otra API, con la diferencia que
la vuelve inofensiva: el id viene en la respuesta. Va como 📌 de `EX-30` (§ 2.13) y como contraste
acá.

### 2.7 `EX-56` ✚ — fila nueva, `VERIFIED`

Debajo de `EX-55`:

```text
| **EX-56** ✚ | Un preapproval creado por API con `card_token_id` + `status: authorized` + `payer_email` de un usuario con cuenta, ¿a nombre de quién queda, y lo ve el pagador en su cuenta? | todo lo que dependa del autoservicio del pagador en Mercado Pago (`EX-52`, `EX-53`, cambiar la tarjeta desde su cuenta) y la identidad del pagador (`EX-19`); hallazgo de la sonda 53 al medir `EX-52`/`EX-53` (2026-09-29) | **`VERIFIED`** | 2026-09-29 | sandbox | [mediciones del 29/09, anexo](./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana) · `GET /users/3694588836` y `GET /users/3499760966` | **A nombre de un pagador INVITADO que el proveedor crea** (`3694588836`, `nickname "@3694588836"`, `site_status: guest`), no de la cuenta del mail (`3499760966`, `site_status: active`), aunque los pagos de los dos traen el mismo mail y la tarjeta tampoco es la guardada (`card_id 9884019412` contra `9813074735`). **El pagador no la ve ni la gestiona desde su cuenta.** Con checkout (`pending` + `init_point`) y el pagador logueado, queda a nombre de su cuenta y sí la gestiona (`EX-52`). Consecuencias: (1) todo autoservicio del pagador en Mercado Pago **exige el alta por checkout**, y con el alta por API no existe; (2) **`payer_id` no es una identidad estable por mail**: el mismo mail tiene dos `payer_id` (y `EX-19` ya había visto que el `payer_id` del preapproval no es el `payer.id` del pago). Producción no medida: puede que allá el mail se vincule a la cuenta existente |
```

**Razón.** El texto del anexo. En el *Para qué* sumé `EX-19`, que ya había medido en producción que
el `payer_id` del preapproval difiere del `payer.id` de los pagos, y es la misma familia de
hallazgo. En la conclusión agregué *«y con el alta por API no existe»*, que es lo que la vuelve
relevante para `B/12` (§ 4, punto 1).

### 2.8 `EX-54` — sigue `UNKNOWN`

Conclusión, agregar:

```text
🚧 **2026-09-29, no medido** ([mediciones del 29/09](./mp-probes/RESULTS-2026-09-29.md)): la mutación hacia arriba se aplica sola y al instante en sandbox (`2500 → 3500`, `HTTP 200`, sin aviso al vendedor; `EX-15`), pero el correo sólo se ve en una casilla real (la del comprador de prueba es `@testuser.com` y nadie la lee). Exige subir el monto de un preapproval de producción del owner: [sonda 54](./mp-probes/probe-54-subir-el-monto-en-produccion.mjs) lista, con guardas, para que la corra él. Revertirlo dispara otro correo (`EX-3`)
```

### 2.9 `WH-1` — sigue `VERIFIED`

```text
📌 **2026-09-29, con los dos canales escuchando** ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sonda 57): con el receptor en `500` el duplicado a ~0,5 s aparece **también por IPN** (`payment 180446362745`, +0,554 s). Con el receptor en `200`, cero claves repetidas dentro de un canal en 3 corridas. Un pago llega **una vez por canal** (dos entregas por hecho, `WH-6`); un hecho del preapproval o del `authorized_payment`, una sola vez (sólo Webhooks). IPN no trae `version` (`EX-2`): por ese canal se deduplica por el id del recurso y releyendo
```

### 2.10 `WH-4` — sigue `VERIFIED`

```text
📌 **2026-09-29, la escalera inicial en los dos canales** ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sonda 57): **IPN también reintenta** (`payment 180446362745`: duplicado a +0,554 s, reintento a +1030 s). Por Webhooks el primer reintento cayó a **994 s, 1004 s y 1224 s** del duplicado (contra los 1127 s del 2026-09-15): **no es un intervalo fijo**. Cada reentrega trae otro `x-request-id` y otro `ts` de firma en **los dos** canales, y en Webhooks también otro `id` de cuerpo; sólo la `version` se mantiene. La escalera completa no se re-midió (exige horas con el receptor compartido en `fail`)
```

**Razón de `WH-1` y `WH-4`.** Los textos de la batería. En `WH-4` sumé que en Webhooks también
cambia el `id` del cuerpo, que la batería mide (tres ids distintos para una misma clave) y deja
fuera de su texto.

### 2.11 `EX-2`, `EX-13` y `EX-14` — sin cambio de estado

`EX-2`:

```text
📌 **2026-09-29** ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md)): `version` existe **sólo en Webhooks**. El cuerpo IPN es `{"resource","topic"}`, sin `version`, sin `date` y sin `action`
```

`EX-13`:

```text
📌 **2026-09-29, con los dos canales** ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sonda 55): Webhooks verifica **29 de 29** con el manifiesto de esta fila. **IPN trae `x-signature` pero no verifica: 0 de 12** con la clave de la aplicación (el manifiesto documentado y 21 variantes, con control RFC 4231 en cada lectura). No prueba que IPN sea inverificable (puede tener otra clave): prueba que **con la clave que tenemos no se puede**. Consecuencia: por IPN no hay forma de rechazar un `POST` inventado, así que un receptor que lo acepte lo trata sólo como disparador de una relectura, nunca como dato. La fila sigue `VERIFIED` porque lo que el receptor necesita verificar llega por Webhooks; **si el diseño decide actuar sobre IPN, esta fila pasa a `PARTIALLY_SUPPORTED`**
```

`EX-14`:

```text
📌 **2026-09-29** ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md)): por IPN tampoco: el cuerpo no trae `live_mode` ni ningún otro campo de entorno
```

**Razón de `EX-13`.** La batería propone *«sigue `VERIFIED`, con una restricción nueva nombrada
para IPN»*. Pero una restricción nombrada es, por la tabla de estados, `PARTIALLY_SUPPORTED`. Lo
dejo `VERIFIED` por la definición de la matriz (*«funciona como lo necesitamos»*): hoy el receptor
no necesita IPN (`WH-6`). La última oración deja escrito qué lo cambiaría, y ata la fila a la
decisión pendiente de § 4, punto 2.

### 2.12 `EX-16` — sigue `VERIFIED`

```text
📌 **2026-09-29** ([mediciones del 29/09](./mp-probes/RESULTS-2026-09-29.md), sonda 52 paso 10): **un registro de cobro puede existir por búsqueda y no por id**. El `authorized_payment` `7032360740` del alta rechazada `715371d2…` aparece en `/authorized_payments/search?preapproval_id=` (`scheduled`, `rejection_code cc_rejected_other_reason`, `retry_attempt 1`) y `GET /authorized_payments/7032360740` da **`404`**. Medido sobre un preapproval que el proveedor creó tras un `400` y canceló (`EX-55`); sobre los registros de suscripciones vivas el `GET` por id sigue funcionando
```

**Razón.** No la propone ningún informe como texto, pero está en la evidencia de la madrugada y
contradice una frase de esta fila (*«`GET /authorized_payments/{id}` [...] trae todo lo que la
conciliación necesita»*) para un caso que la conciliación sí va a ver: las altas con `400` de
`EX-55`. La acoto a lo medido, que es un registro y un solo caso.

### 2.13 `EX-30` — sigue `VERIFIED`

```text
📌 **2026-09-29** ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sonda 56 paso 06): **una orden con tarjeta rechazada devuelve `402` y queda creada igual**: `ORDTST01M3PW176PM2VSH08ESW6WRZSS`, `failed`, pago `rejected_by_issuer`, devuelta en `data` del error (cuyo cuerpo dice además `total_paid_amount: "100.00"`, que no es lo cobrado). A diferencia de `EX-55` (preapproval), **el id viene en la respuesta**. Y **ni las órdenes ni sus reembolsos avisan por ningún canal** en sandbox (`EX-15`): el cobro de única vez se confirma releyendo la orden. No medido: qué devuelve un reintento con la misma clave sobre una orden `failed` (`EX-41` midió sólo la aprobada)
```

**Razón.** El hallazgo lateral de la batería *«para `EX-30`/`EX-41`»*. Va a `EX-30`, que es la fila
del contrato del cobro de única vez, y no a `EX-41`, porque lo medido no es idempotencia. La
última oración nombra lo que sí sería de `EX-41` y nadie midió.

### 2.14 `EX-36` — sigue `VERIFIED`

```text
📌 **2026-09-29, qué avisa** ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sonda 56): el cambio llega como `subscription_preapproval` (Webhooks, +28 s) y como un `payment` de **ARS 0 con `operation_type: card_validation`** por **IPN y por Webhooks** (+2 s). El rechazado (`402`) llega sólo como ese `payment`, `rejected / cc_rejected_other_reason`, sin tocar la tarjeta ni `last_modified`. **Trampa para el receptor**: ese `payment` no trae `external_reference` ni nada que nombre al preapproval (`point_of_interaction UNSPECIFIED`; el único vínculo es `payer.id`), y por IPN es indistinguible de un cobro hasta releerlo: un handler de `payment` que no mire `operation_type` registra un «cobro» de cero pesos, o un «cobro rechazado» que no es de ningún ciclo
```

**Razón.** El `card_validation` de ARS 0 **no va como fila nueva**. `EX-36` ya afirma que *«el
cambio COBRA una validación de ARS 0 (`operation_type: card_validation`)»*, y `PA-3` lo vio en
producción al autorizar. Lo nuevo es qué **avisa** y la trampa que eso le deja al receptor, que es
ampliación de la misma pregunta.

### 2.15 `EX-44`, `EX-46` y `PA-6` — siguen `UNKNOWN`, con un indicio

`EX-44`:

```text
🔎 **Indicio, no medición** (2026-09-29, [logs de producción](./mp-probes/RESULTS-2026-09-29.md#anexo-producción-logs-de-la-api-2909-tarde)): el 2026-09-28 11:02:32 llegó un `subscription_authorized_payment` sobre `80a633be…`, un preapproval que el proveedor había cancelado por antifraude (ya `cancelled` en la lectura del 2026-09-23). El log no dice si es el reciclado del cobro rechazado o un registro nuevo, y el preapproval no lo canceló Hospeda: no contesta esta fila, pero dice que un preapproval cancelado **sigue produciendo avisos de su registro de cobro** días después
```

`EX-46`:

```text
🔎 **Indicio, no medición** (2026-09-29, [anexo del 29/09](./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana)): mientras el owner cambiaba la URL de Webhooks de `/` a `/webhooks`, dos avisos fechados `14:34:27Z` en su propio cuerpo llegaron a la URL **nueva** a las 14:40:10Z, y no quedó ningún intento a la vieja (el receptor contestaba `200` a todo). Compatible con «sale a la URL vigente al momento de entregar», pero no es esta pregunta, que es sobre un **reintento** tras un `500`, y la ventana estaba contaminada (también cambió la selección de eventos)
```

`PA-6`:

```text
🔎 **Indicio de sandbox, no medición de producción** (2026-09-29, [mediciones del 29/09](./mp-probes/RESULTS-2026-09-29.md) y [batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sonda 52 paso 10): tres primeros cobros rechazados por **`cc_rejected_other_reason`**, no por antifraude, y el proveedor canceló el preapproval las tres veces (a los 11 s, 1,95 s y 1 s). Es un rechazo simulado por la tarjeta de prueba al alta, no un ciclo, y el sandbox no responde por producción (`B/06`, regla 1)
```

**Razón.** El de `PA-6` es el *«dato lateral para `PA-6`»* de la madrugada, que no traía texto;
va como 🔎 porque el sandbox no responde por producción y un titular `OTHE` no es *«fondos
insuficientes»*. El de `EX-46` lo describen los dos informes, que no proponen cambio de estado;
lo escribo como indicio para que no se pierda. Si el owner prefiere no anotar indicios en filas
`UNKNOWN`, estos tres se caen sin tocar ninguna cifra. El precedente de anotarlos es `EX-45`
(*«El código actual registra seis que no»*).

### 2.16 `RC-4` — sigue `NOT_SUPPORTED`

```text
📌 **2026-09-29** ([mediciones del 29/09, anexo](./mp-probes/RESULTS-2026-09-29.md#anexo-con-los-dos-canales-escuchando-2909-mañana), sandbox): **el `search` tampoco devuelve el mismo ESTADO que el `GET`**. `7eb2a11b…` se leyó `pending` con `last_modified 10:48:13` en `/preapproval/search` a +2 y a +5 min, cuando el `GET` por id ya daba `cancelled` desde las 10:48:14.950. El `search` sirve para encontrar un id, no para leer su estado
```

**Razón.** El anexo lo registra en `EX-55` como hallazgo nuevo. Además de citarlo allá, su lugar
propio es esta fila, que es la de *«el `search` no es el `GET`»*.

### 2.17 `RF-7` — sigue `VERIFIED`

```text
📌 **2026-09-29, la Orders API en sandbox** ([batería IPN](./mp-probes/RESULTS-2026-09-29-bateria-ipn.md), sonda 56): un reembolso **total** y uno **parcial** de órdenes (`POST /v1/orders/{id}/refund`, `201`, releídos `refunded` y `partially_refunded`) **no produjeron ninguna entrega por ningún canal** en 23-27 min, con todos los eventos tildados (ver `EX-15`). Lo medido acá (3 entregas por un reembolso de `/v1/payments`, 2 de ellas por IPN y una `topic=merchant_order`) no cambia: es otra API, y en sandbox la de Payments da `401`. **Si el addon de única vez va por `/v1/orders` (`EX-30`), su reembolso no tiene aviso**, y se confirma releyendo la orden
```

**Razón.** El texto de la batería, acortado donde repite `EX-15`, y con la mención explícita del
`merchant_order` por IPN, que es la excepción de producción a *«IPN sólo entrega `payment`»*
(§ 2.1).

## 3. Espejos y cifras

### 3.1 Las cifras

Simulado sobre una copia en el scratchpad (`lote25/matriz-lote25.md`, con el script sin tocar):
estados cambiados en `WH-5`, `WH-6`, `EX-15`, `EX-52` y `EX-53` con las celdas exactas de § 2, y
`EX-55` y `EX-56` agregadas debajo de `EX-54`.

| qué | hoy | con el lote (recomendado) | con `WH-5` en `PARTIALLY_SUPPORTED` |
|---|---|---|---|
| filas | 112 | **114** | 114 |
| `VERIFIED` | 55 | **61** | 60 |
| `PARTIALLY_SUPPORTED` | 17 | **15** | 16 |
| `NOT_SUPPORTED` | 23 | **24** | 24 |
| `UNKNOWN` | 17 | **14** | 14 |
| cerradas | 95 | **100** | 100 |

Las `UNKNOWN` que quedan, según el script: `PA-6`, `GR-2`, `RC-8`, `RF-3`, `EX-42` a `EX-50` y
`EX-54`. De ellas, `EX-49` es de verticales, así que **trece son del capítulo del proveedor**.
Doce tienen fila en la tabla de `B/06` §11 (`EX-54` no), y las trece tienen unidad en
`$B/descomposicion.md` §2.7.

### 3.2 En la matriz

- **Frontmatter**: `updated: 2026-09-28` → `2026-09-29` (tampoco lo movió `24-`).
- **Encabezado** (`D/06:17`): se tacha el recuento del 2026-09-29 y se agrega **«Recontado el
  2026-09-29 tras las mediciones de los dos canales (sondas 52 a 57: cerrar `WH-5`, `WH-6`,
  `EX-15`, `EX-52` y `EX-53`; abrir `EX-55` y `EX-56`, ya medidas): 61 `VERIFIED`, 15
  `PARTIALLY_SUPPORTED`, 24 `NOT_SUPPORTED`, 14 `UNKNOWN`, sobre 114»**.
- **Resumen, `VERIFIED`** (`D/06:441`): ~~**55**~~ **61**, con al frente **«el 2026-09-29
  (mediciones de los dos canales, sondas 52 a 57) entraron `WH-6` (qué entrega cada canal),
  `EX-52` (la baja del pagador no se distingue de la nuestra), `EX-55` (un `400` al crear deja un
  preapproval) y `EX-56` (el alta por API queda a nombre de un invitado), y volvieron `WH-5` y
  `EX-15`, cerradas con los dos canales escuchando»**. En la entrada del 2026-09-23, detrás de
  *«`WH-5` *(salió el 2026-09-28)*»*, va *«*(volvió el 2026-09-29)*»*.
- **Resumen, `PARTIALLY_SUPPORTED`** (`D/06:442`): ~~**17**~~ **15**, con al frente **«salieron
  las dos el 2026-09-29: `WH-5` y `EX-15` vuelven a `VERIFIED` con los dos canales escuchando»**.
- **Resumen, `NOT_SUPPORTED`** (`D/06:443`): ~~**23**~~ **24**, con al frente **«la del
  2026-09-29: `EX-53` (el pagador no puede pausar desde su cuenta)»**.
- **Resumen, `UNKNOWN`** (`D/06:445`): ~~**17**~~ **14**, con al frente **«salieron tres el
  2026-09-29 (mediciones de los dos canales): `WH-6` y `EX-52`, a `VERIFIED`, y `EX-53`, a
  `NOT_SUPPORTED`»**.
- **Pie** (`D/06:450`): ~~tras los casos vecinos de la revisión del owner: 55 · 17 · 23 · 17~~
  **tras las mediciones de los dos canales: 61 · 15 · 24 · 14**, sobre ~~**112**~~ **114** filas,
  y a la lista de las sumadas se le agrega *«y **`EX-55`** y **`EX-56`** (mediciones del 29/09,
  sondas 52 y 53)»*.

### 3.3 Fuera de la matriz

Los espejos que listan `15-` § 3 y `24-` § 3. Las cifras del log no se mueven, porque el lote no
toca decisiones.

| espejo | hoy | propuesto |
|---|---|---|
| `spec.md` del paraguas, `:85` (tabla de documentos) | «~~111~~ 112 filas, ~~94~~ 95 cerradas, ~~16~~ 17 `UNKNOWN`» | «~~112~~ 114 filas, ~~95~~ 100 cerradas, ~~17~~ 14 `UNKNOWN`», y al paréntesis *«; 29/09, mediciones de los dos canales (sondas 52 a 57): cerraron `WH-5`, `WH-6`, `EX-15` y `EX-52` (`VERIFIED`) y `EX-53` (`NOT_SUPPORTED`), y entraron `EX-55` y `EX-56`, ya `VERIFIED`»* |
| `spec.md` del paraguas, `:137` (FASE 1C) | «112 filas · 95 cerradas · 17 `UNKNOWN`» | las mismas tres cifras que `:85`, y al frente del paréntesis *«29/09, recontado con el script tras las mediciones de los dos canales: …»* |
| `$B/spec.md:256-257` | «112 filas — 55 · 17 · 23 · 17» y *«De las diecisiete, […] acá se listan doce, y las tres del 28/09 (`EX-52`, `EX-53` y `WH-6`) todavía no tienen fila en ella, ni `EX-54`»* | «~~112~~ 114 filas — ~~55~~ 61 `VERIFIED`, ~~17~~ 15, ~~23~~ 24, ~~17~~ 14 `UNKNOWN`», la entrada *«**el 29/09 cerraron `WH-5`, `WH-6`, `EX-15`, `EX-52` y `EX-53` y entraron `EX-55` y `EX-56`** (mediciones de los dos canales), recontado ese día»*, y *«De las ~~diecisiete~~ catorce, […] acá se listan doce; `EX-52`, `EX-53` y `WH-6` salieron el 29/09, y `EX-54` no tiene fila»* |
| `B/06:28` (el capítulo del proveedor) | «**112** filas, **95** medidas […] quedan diecisiete `UNKNOWN` y dieciséis son de este capítulo» | «~~112~~ **114** filas, ~~95~~ **100** medidas», y una entrada nueva que tacha la anterior: *«2026-09-29, tras las mediciones de los dos canales (cerraron `WH-5`, `WH-6`, `EX-15`, `EX-52` y `EX-53`; entraron `EX-55` y `EX-56`, ya `VERIFIED`); quedan catorce `UNKNOWN` y trece son de este capítulo: `PA-6`, `GR-2`, `RC-8`, `RF-3`, `EX-42`, `EX-43` a `EX-47`, `EX-48`, `EX-50` y `EX-54`; `EX-49`, el seudónimo del correo, es de verticales»* |
| `B/06:408` (§ 11) | «**Doce de las diecisiete filas de 112**» | «~~Doce de las diecisiete filas de 112~~ **Doce de las catorce filas de 114**», con *«2026-09-29, mediciones de los dos canales: salieron `EX-52`, `EX-53` y `WH-6`, que no tenían fila en esta tabla»* |
| `$B/descomposicion.md:401` (encabezado de §2.7) | «~~doce~~ trece filas `UNKNOWN` (más tres del 2026-09-28 sin unidad)» | «trece filas `UNKNOWN`», con ~~(más tres del 2026-09-28 sin unidad)~~ tachado |
| `$B/descomposicion.md:404-407` (cifras de §2.7) | «112 filas […] 55 · 23 · 17 · 17 […] Las tres `UNKNOWN` del 28/09 todavía no tienen unidad en esta tabla» | «~~112~~ 114 filas […] ~~55~~ 61 `VERIFIED`, ~~23~~ 24 `NOT_SUPPORTED`, ~~17~~ 15 `PARTIALLY_SUPPORTED`, ~~17~~ 14 `UNKNOWN`», la entrada del 29/09, y ~~Las tres `UNKNOWN` del 28/09 todavía no tienen unidad en esta tabla~~ con *«salieron el 29/09»* |

**Dos espejos que no son cifra, pero dicen algo que el lote vuelve falso**, para que el owner
decida si entran:

- `$B/descomposicion.md:416`, la fila tachada de `WH-5`: dice *«`VERIFIED` desde el 2026-09-23»*
  y no registra la reapertura del 28/09. Con el lote vuelve a ser cierta, y bastaría agregar
  *«(reabierta el 2026-09-28, cerrada el 2026-09-29)»*.
- `B/06`, el 📌 *«Las cuatro que salieron, y cómo»* de § 11 dice lo mismo de `WH-5`. Mismo arreglo.

**No son espejos de este lote**: `03-handoff.md` (lo actualiza el owner, `15-` § 3), la tabla
`## Composición` de la matriz (congelada en 84 desde el 16/09; no la movió ninguna tanda) y
`## Qué espera cada decisión` (§ 4, punto 1).

## 4. Impacto en el diseño (para una tanda posterior, sin decidir)

1. **N8 en `B/12` (*«Cancelar o pausar desde la cuenta de Mercado Pago: pendiente de
   medición»*, `B/12:1150`) queda medido, y cambia de forma.** El hueco (2), *«una pausa del
   pagador se leería como mora»*, **desaparece**: el pagador no puede pausar (`EX-53`), así que un
   `paused` sin `PUT` nuestro es mora o anomalía. El hueco (1), cortar el servicio en el acto y
   perder lo pagado, **sigue**, y ahora se sabe que la baja no trae autor (`EX-52`): la única forma
   de distinguirla es **que nosotros no la pedimos**. Eso exige que toda cancelación nuestra quede
   registrada **antes** de llamar, como `D4` para la creación. Pero `EX-56` le cambia el alcance
   al hueco entero: **con el alta por API y token, el pagador ni ve la suscripción** y el
   autoservicio no existe. Qué camino de alta usa el diseño decide si N8 es un caso real o
   ninguno. Tocan `DEC-MP-008`, `DEC-SUB-009` y `## Qué espera cada decisión` de la matriz, que
   no nombra `EX-52` ni `EX-53`.
2. **`L3-g` y N9 en `B/06` (*«Los dos canales de avisos: pendiente de medición»*, `B/06:479`)
   quedan medidos.** Hay que decidir qué hace el receptor nuevo con IPN. Los hechos para decidir:
   IPN no trae ningún hecho de suscripción que Webhooks no traiga; no verifica firma (`EX-13`); no
   trae `version`; y en producción trae `merchant_order` tras un reembolso de `/v1/payments`
   (`RF-7`). Las salidas condicionales del caso 39 y del caso G-D (*«registra los avisos IPN sin
   actuar»*, *«una tabla propia, sólo de altas»*) estaban escritas para *«si `WH-6` no se llega a
   medir»*: con la fila medida, esa rama **no corre**, y la decisión sobre IPN se toma entera. La
   M5 del falso (`B/20` §3.2), que se leía *«por el canal Webhooks»* hasta la remedición, se
   revisa con el mismo resultado.
3. **La deduplicación de `payment` entre canales.** Si se escuchan los dos, un pago son dos
   entregas a 2-334 ms y sin orden fijo, así que las dos pueden procesarse **a la vez**. El
   requisito de `B/06` (*«ningún efecto doble»*) necesita un candado o una unicidad por id del
   pago, no un *«¿ya lo vi?»* (`B/05`). Si se descarta IPN, el requisito vale igual para los
   duplicados dentro de Webhooks (`WH-1`).
4. **El `payment` de ARS 0 `card_validation`** (`EX-36`). Llega por los dos canales, sin
   `external_reference` y sin nombrar al preapproval. Un handler de `payment` que no mire
   `operation_type` lo registra como un cobro de cero, o, si fue rechazado, como un cobro fallido
   que puede disparar la lógica del primer rechazo (`S16`, `PA-6`) o el grace sobre una
   suscripción que no debe nada. Tocan `B/09` (conciliación, *«¿cobró?»* por `payment.status`) y
   `B/12` (el grace).
5. **Un error al crear no prueba que no se creó** (`EX-55`, y la orden `failed` de `EX-30`). El
   alta con `card_token_id` que vuelve `400` deja un preapproval cancelado, con un `payment` y un
   `authorized_payment` que avisan con ids desconocidos, y sólo se asocian por el
   `external_reference`. Eso pide acuñar y persistir el `external_reference` antes de llamar (lo
   que `D4` y `EX-17` ya piden para el candado) y decidir qué hace el receptor con un aviso cuyo
   recurso no existe localmente. Hoy hospeda2 contesta con error y fuerza el reintento (punto 9).
   Del lado de las órdenes: tratar un `402` como *«no hay orden»* es falso, porque la orden existe
   `failed` con id.
6. **`payer_id` no es identidad** (`EX-56`, `EX-19`). Ningún vínculo cliente↔pagador del modelo
   (`B/02`) puede apoyarse en `payer_id` por mail. Y el único vínculo del `payment` de validación
   es `payer.id` (punto 4), que depende de ese mismo supuesto.
7. **La cancelación del proveedor tras un rechazo no se notifica** (`WH-5` cerrada). Su detección
   depende de que el aviso del `payment` rechazado (que sí llega) dispare la relectura del
   preapproval, o del barrido diario (`B/09` §3). Hay que verificar que el diseño relee el
   **preapproval** desde un aviso de `payment`, y no sólo el pago.
8. **Los saltos de `version` sin aviso** (`EX-15`: el `reason` y una versión sin atribuir). Ningún
   componente puede leer un hueco de `version` como aviso perdido. Refuerza el *«el evento dispara
   y el estado se relee»* de `M-CONC-02`, y lo toca si alguna regla compara versiones contiguas.
9. **El dato lateral de producción, que es código de hoy.** hospeda2 rechaza el aviso de un
   `authorized_payment` de un preapproval que no encuentra localmente (`80a633be…`) **para forzar
   un reintento**. Sobre un preapproval cancelado por el proveedor ese reintento nunca va a
   encontrar la suscripción, y cada entrega fallida alimenta la escalera de `WH-4` y la supersesión
   de `WH-5`. Para el diseño: qué hace el receptor nuevo con un aviso de un recurso desconocido o
   ya terminal (`B/03` §10.1). Para hoy: si merece un issue en Linear sobre el receptor actual, lo
   decide el owner; este lote no lo abre.
10. **La confirmación del cobro de única vez** (`EX-30`, `B/16`). Órdenes y reembolsos de órdenes
    no avisan en sandbox, así que el diseño no puede esperar un aviso para confirmarlos: respuesta
    síncrona más relectura (y la comprobación de órdenes pagadas del barrido, `EX-43`).
    Producción no medida.

## 5. Lo que sigue abierto, y quién lo cierra

| qué | fila | quién / qué lo cierra |
|---|---|---|
| si IPN tiene una clave de firma propia | `EX-13` | **owner, en el panel** de `Hospeda Test`: si hay otra clave, correr la sonda 55 con `SECRET_FILE` apuntando a ella |
| a qué URL va un reintento tras cambiar la URL | `EX-46` | **owner en el panel, con el agente**: `mode=fail`, un alta, cambiar la URL de Webhooks a `/webhooks-b`, `mode=ok`, ver dónde cae el reintento de ~17 min |
| el correo al subir el monto | `EX-54` | **owner, producción**: la sonda 54 sobre un preapproval suyo (cuesta `DELTA` si no se revierte) |
| en qué interfaces se buscó la pausa | `EX-53` | **owner**: decir si miró web, app o las dos; sin eso § 2.5 no se aplica |
| `WH-5` en `VERIFIED` o en `PARTIALLY_SUPPORTED` | `WH-5` | **owner**, en el OK de este lote (§ 2.3) |
| la escalera completa de reintentos (¿termina en la 5ª, a +6 h?), en los dos canales | `WH-4` | **días**: una tarde con receptor propio o una ruta `…-fail` en el Worker (cambiar las URL exige panel), leer a +7 h |
| la cola de demoras de días y el desorden a volumen | `WH-2`, `WH-3` | **días**: el receptor escuchando y la lectura del 23/09 re-corrida con el lector de la sonda 55 |
| la pausa por mora con IPN escuchando | `GR-3` | **producción + días**: el próximo ciclo rechazado real, leído en los logs de la API; con `WH-6` se espera nada nuevo, pero es inferencia |
| el contracargo | `RC-8` | **producción**, cuando ocurra |
| `EX-55`, `EX-56`, las órdenes sin aviso y el `402` que crea la orden, en producción | `EX-55`, `EX-56`, `EX-15`, `EX-30` | **producción**: sin sonda propuesta; `EX-55` se ve la próxima vez que un alta real vuelva `400` |
| si cancelar corta el reciclado | `EX-44` | **paso 0 del corte**, como ya estaba; el indicio de `80a633be…` no lo cierra |
| el registro de la lectura de producción | `WH-5`, `WH-6` | **orquestador**, antes de aplicar (§ 0, punto 1) |
| los sujetos de sandbox vivos: `a459aa50…` (cuenta real), `b12af185…` y `e6766650…` (invitado), `authorized`, próximo cobro 2026-10-29 | — | **owner**: cancelarlos cuando lo decida |
| las dos URL del panel de `Hospeda Test` apuntadas al Worker de la sonda 08 | — | **owner**: dejarlas (las necesitan `EX-46` y `WH-4`) o volverlas atrás en el panel |

## Key Learnings

1. `contar-filas-de-la-matriz.py` elige el estado de una celda **por prioridad y no por
   posición**, y no ignora lo tachado. Una fila que **vuelve** de `PARTIALLY_SUPPORTED` a
   `VERIFIED` con la historia tachada en la celda se cuenta mal. La prueba es simular sobre una
   copia antes de escribir.
2. *«IPN entrega sólo `payment`»* es verdad sobre lo medido el 29/09 y falso sobre la matriz
   entera: `RF-7` vio un `merchant_order` por IPN en producción. Un veredicto nuevo se contrasta
   contra las filas `VERIFIED` que ya hablan del mismo canal.
3. Una condición de cierre escrita de antemano (*«si en los logs no hay entregas IPN para esos
   ids»*) puede quedar sin poder cumplirse (los logs no llegan) y a la vez superada por evidencia
   más fuerte (ninguna IPN de preapproval en días). Eso se le presenta al owner como elección, no
   se resuelve en silencio.
4. Un hallazgo sobre *quién puede hacer algo* (`EX-56`) puede cambiar el alcance de un hueco de
   diseño entero (N8): antes de decidir cómo tratar un acto del pagador, hay que saber si el
   pagador puede hacerlo con el camino de alta elegido.
