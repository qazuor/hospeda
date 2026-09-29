---
title: Master Spec 06 — Abstracción de proveedor y el contrato de Mercado Pago
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-25
status: CURRENT
fase: 2
capitulo: 6
cierra:
  - MP-01
  - M-MP-01
  - M-MP-02
  - M-MP-03
  - R-MP-01
  - S-MP-01
  - S-MP-02
  - S-MP-03
---

# 06 · Abstracción de proveedor y el contrato de Mercado Pago

El §57 pide que el dominio **no quede acoplado a Mercado Pago**, que soporte conceptualmente
MercadoPago, Manual y un proveedor futuro, y cierra con *«Sin sobrearquitectura»*.

Este capítulo dice **qué le pide el dominio a un proveedor**, **qué de eso tiene el que
usamos**, y **las reglas de trato que salen de haberlo medido** — ~~98~~ ~~**99**~~ ~~**104**~~ ~~**107**~~ ~~**111**~~ **112** filas, ~~92~~ ~~**94**~~ **95** medidas (recontadas
el ~~2026-09-25, con `EX-40`, `EX-41`, `PA-6`, `RC-8` y `RC-9`~~ ~~**2026-09-26, tras cerrar `RN-3` y `GR-1`**~~ ~~; quedan cuatro `UNKNOWN`: `PA-6`, `GR-2`, `RC-8` y `RF-3`~~ ~~**y abrir `EX-42` (owner 2026-09-26, `Y-1`); quedan cinco `UNKNOWN`: `PA-6`, `GR-2`, `RC-8`, `RF-3` y `EX-42`** — FASE 9 vuelta 1, `F-8V1D1-005`~~ ~~**2026-09-27, tras abrir `EX-43` a `EX-47` (FASE 9 vuelta 2, con OK del owner); quedan diez `UNKNOWN`: `PA-6`, `GR-2`, `RC-8`, `RF-3`, `EX-42` y `EX-43` a `EX-47`**~~ ~~**2026-09-28, tras abrir `EX-48` a `EX-50` (FASE 9 vuelta 2, verificación, con OK del owner, `V2-y`); quedan trece `UNKNOWN` y doce son de este capítulo: `PA-6`, `GR-2`, `RC-8`, `RF-3`, `EX-42`, `EX-43` a `EX-47`, `EX-48` y `EX-50`; `EX-49`, el seudónimo del correo, es de verticales**~~ ~~**2026-09-28, tras la revisión del owner (entraron `EX-51`, `VERIFIED`, y `EX-52`, `EX-53` y `WH-6`; `WH-5` y `EX-15` se reabrieron a `PARTIALLY_SUPPORTED`); quedan dieciséis `UNKNOWN` y quince son de este capítulo: `PA-6`, `GR-2`, `RC-8`, `RF-3`, `EX-42`, `EX-43` a `EX-47`, `EX-48`, `EX-50`, `EX-52`, `EX-53` y `WH-6`; `EX-49`, el seudónimo del correo, es de verticales**~~ ~~**2026-09-29, tras los casos vecinos de la revisión del owner (entró `EX-54`; revisión del owner, casos vecinos, 2026-09-29, caso 34); quedan diecisiete `UNKNOWN` y dieciséis son de este capítulo: `PA-6`, `GR-2`, `RC-8`, `RF-3`, `EX-42`, `EX-43` a `EX-47`, `EX-48`, `EX-50`, `EX-52`, `EX-53`, `EX-54` y `WH-6`; `EX-49`, el seudónimo del correo, es de verticales**~~ **2026-09-29, tras las mediciones de los dos canales (cerraron `WH-5`, `WH-6`, `EX-15`, `EX-52` y `EX-53`; entraron `EX-55` y `EX-56`, ya `VERIFIED`); quedan catorce `UNKNOWN` y trece son de este capítulo: `PA-6`, `GR-2`, `RC-8`, `RF-3`, `EX-42`, `EX-43` a `EX-47`, `EX-48`, `EX-50` y `EX-54`; `EX-49`, el seudónimo del correo, es de verticales**). **Y desde `DEC-MP-005` el proveedor que usamos es Mercado Pago, decidido**: lo que
este capítulo mide como faltante es, con esa decisión, **la lista de lo que suple nuestro lado**.

---

## 1. Qué es un proveedor para este dominio

La abstracción es **lo que el dominio necesita, no lo que Mercado Pago ofrece**. Si se define al
revés, el segundo proveedor no entra y el §57 queda incumplido sin que nadie lo note.

**Ocho capacidades, y ninguna más:**

| # | capacidad | qué significa |
|---|---|---|
| 1 | **autorizar** | conseguir permiso del cliente para cobrarle periódicamente |
| 2 | **cobrar** | ejecutar un cobro del ciclo |
| 3 | **cambiar el monto** | de una autorización vigente |
| 4 | **pausar y reanudar** | detener y retomar los cobros sin perder la autorización |
| 5 | **cancelar** | terminar la autorización |
| 6 | **reembolsar** | devolver dinero de un cobro |
| 7 | **leer** | el estado de una autorización y sus cobros |
| 8 | **avisar** | notificar que algo cambió |

**Lo que NO está en la lista, a propósito**: prorratear, agendar una baja, aplicar un descuento,
otorgar un trial, y ordenar los eventos. **Ninguna de esas cinco se le pide al proveedor**, y las
cinco se resolvieron de nuestro lado en las decisiones — no por desconfianza sino porque la
medición mostró que este proveedor no las tiene o las tiene de forma que no sirve.

**Un proveedor que soporte las ocho es suficiente.** «Manual» implementa 2, 5, 6 y 7 —el resto no
tiene sentido sin un tercero que autorice— y por eso el §30 puede decir *«Mismo motor de
Subscription. Payment method distinto.»*

---

## 2. Qué de eso tiene Mercado Pago

| # | capacidad | estado | la forma exacta |
|---|---|---|---|
| 1 | autorizar | ✅ | el cliente autoriza en el **checkout** del proveedor. Nosotros creamos el preapproval primero (§5.6) |
| 2 | cobrar | ✅ | lo ejecuta el proveedor por su cuenta, **con retraso variable y no predecible** |
| 3 | cambiar el monto | ✅ | `PC-1`/`PC-3`: muta sin pedirle consentimiento nuevo al cliente |
| 4 | pausar y reanudar | ⚠️ **a medias** | pausar y reanudar funcionan (`PS-1`, `PS-3`, `PS-5`), pero **no hay auto-reanudación** (`PS-4`): el reloj es nuestro |
| 5 | cancelar | ✅ | e **irreversible** (`PA-5`) |
| 6 | reembolsar | ✅ | total y parcial, acumulativos contra el saldo, idempotente (`RF-1`, `RF-2`, `RF-6`) |
| 7 | leer | ⚠️ **a medias** | **por id, confiable** (~~`RC-2`~~ `RC-1`, FASE 9 vuelta 2, `F-8V2C2-007`); **buscar, no** (`RC-1`) |
| 8 | avisar | ⚠️ **a medias** | avisa el alta, la pausa, la reanudación y la cancelación; **no avisa el cambio de monto** (`EX-15`). **Tampoco avisa la cancelación que hace él mismo tras un alta con el cobro rechazado, un cambio del `reason`, ni las órdenes de `/v1/orders` y sus reembolsos** (`WH-5`, `EX-15`, medidas con los dos canales escuchando); **la baja que da el pagador desde su cuenta sí llega, y ningún campo la distingue de una nuestra** (`EX-52`). **Y avisa por dos canales, de los que sólo Webhooks trae hechos de suscripción**: IPN entrega sólo `payment` (`WH-6`), y qué hace el receptor con eso está en *«lo que este capítulo NO cierra»* (mediciones del 2026-09-29, puntos 1, 2 y 7). **Y documenta un aviso propio de contracargo, `topic_chargebacks_wh`, que trae el `payment_id`** — **documental, no medido** (`RC-8`, `UNKNOWN`: no se puede fabricar un contracargo a voluntad). Entra como cualquier aviso: se relee el pago por id (`B/03` §10.2), y si no llega, lo ve el barrido (`B/09` §3) (FASE 8 completa, `F-8CB3-009`, `DEC-SUB-020`) |

**Las tres «a medias» son las que gobiernan el diseño**, y cada una ya tiene su respuesta en un
capítulo: el reloj de pausa es nuestro (cap. 03 §5), el inventario a conciliar es nuestro (cap.
09), y toda mutación se verifica releyendo (§4 de este capítulo).

---

## 3. Lo que no se le puede pedir, y qué se hace en cambio

| lo que el PDR pediría | medido | qué se hace en cambio |
|---|---|---|
| cambiar el ciclo de una suscripción viva (§19) | **`NOT_SUPPORTED`**, y **falla en silencio**: `200` y `frequency` intacta (`EX-4`) | cancelar y recrear, re-autorizando en el checkout (`DEC-SUB-006`) |
| mover una suscripción de un plan a otro | **`NOT_SUPPORTED`**, `200` y sigue en el plan viejo (`EX-21`) | ídem |
| correr la fecha de cobro de una viva (§26.4) | **`NOT_SUPPORTED`**, cuatro formas, cuatro `200`, nada escrito (`EX-34`) | la pausa se toma en meses enteros y la aritmética se compensa sola (`DEC-SUB-010`) |
| poner un trial a una suscripción viva (§34.2) | **`NOT_SUPPORTED`**, dos formas, `free_trial` sigue `null` (`EX-35`) | la cortesía se implementa **pausando** (`DEC-GRANT-003`) |
| agendar la baja a fin de período (§24) | **`PARTIALLY_SUPPORTED`**: existe, pero **sólo al crear** (`CN-1`) | cancelar ya y sostener el servicio de nuestro lado (`DEC-SUB-009`) |
| un addon como línea aparte del mismo cobro (§38) | **`NOT_SUPPORTED`**: el array da `400` y `items` se descarta en silencio (`EX-5`) | un preapproval aparte por addon (`DEC-ADDON-002`) |
| que la creación sea idempotente (§51) | **`NOT_SUPPORTED`** por ningún mecanismo (`EX-17`) | el candado es nuestro y va antes (`DEC-CONC-001`) |
| cobrar en otra moneda | **`NOT_SUPPORTED`**: sólo ARS (`EX-18`) | ver §5 |

**El patrón que hay que leer en esa columna del medio**: de las ocho, **cinco devuelven `2xx` y
no aplican nada**. No es un proveedor que rechaza lo que no soporta: es un proveedor que acepta y
descarta. De ahí sale la regla §4.1.

### 3.1 Lo que no se puede suplir: un reloj de cobro propio

Las ocho de arriba tienen un *«qué se hace en cambio»*. **Ésta no**, y va aparte por eso: el diseño
**no** tiene su propio reloj de cobro porque **los dos caminos para tenerlo están medidos y cerrados,
y los dos por permiso, no por diseño**:

| camino | medido |
|---|---|
| **cobrar de forma recurrente con la tarjeta guardada, sin `preapproval`** | **`NOT_SUPPORTED`** (`EX-31`): `403` en las cuatro formas de pedirlo, con la misma orden sin esos nodos entrando en `201` (`EX-30`) — el rechazo es del **permiso** de la aplicación |
| **cobrar desde la billetera del cliente (Wallet Connect)** | **`NOT_SUPPORTED`** (`EX-32`): el recurso existe, responde `403`, y la habilitación **no se puede pedir** |

Por eso **el reloj de cobro es del proveedor y el mandato es el modelo canónico** (`DEC-MP-006`). Es
el límite duro de la directriz de `DEC-MP-005`: **un permiso comercial no se compensa con código**. El
~~cargo puntual queda declarado como destino, con la habilitación de *«pagos automáticos»* pedida en
paralelo,~~ **el cargo puntual dejó de ser destino el 2026-09-26** (📌 de `DEC-MP-006`: la habilitación
se pidió, no hubo respuesta y no se espera más; el mandato es EL modelo, sin destino pendiente), y la
interfaz de este capítulo **igual no puede impedir una migración** — higiene de interfaz, no plan.

### 3.2 Lo que sí se usa sin preapproval: el cobro de ÚNICA VEZ por `/v1/orders`

> **Corrección de diseño, FASE 8 completa, `F-8CB1-008`.** Este capítulo sólo tenía contrato para
> `preapproval`, y el addon de cobro `UNA_VEZ` (`B/16` §1.2) no pasa por uno.

**El mismo endpoint que el §3.1 cierra para lo recurrente sirve para lo único.** La matriz lo deja
escrito en su cabecera —*«el cobro de ÚNICA VEZ por `/v1/orders` funciona sin ninguna habilitación
especial, así que un addon one-time no necesita pasar por `preapproval`»*— y `EX-30` lo midió: una
orden con tarjeta tokenizada y sin `customer` devolvió `201` y la relectura dijo
`processed/accredited`. **Es el camino del addon `UNA_VEZ`** (`B/16` §1.4), y su pago se registra
colgando de la instancia (`B/02` §2.3).

**Lo que NO está medido, y por eso no se afirma:**

- ~~**la idempotencia de `/v1/orders`**: ninguna fila la mide, y la regla del §4.6 punto 1 prohíbe
  razonarla desde otro endpoint —*«la idempotencia de este proveedor es POR ENDPOINT»*—. **Queda
  pendiente de sonda**;~~ **la idempotencia de `/v1/orders` está medida desde el 2026-09-25**
  (`EX-41`): por `X-Idempotency-Key`, y el `external_reference` no deduplica;
- **su comportamiento en producción**: `EX-30` es de sandbox.

**Y dos cosas medidas en sandbox el 2026-09-29 que el camino tiene que respetar** (mediciones del
2026-09-29, puntos 5 y 10): **una orden con la tarjeta rechazada devuelve `402` y queda creada
igual**, `failed`, con su id en el cuerpo del error (`EX-30`), así que un `402` no es *«no hay
orden»*: el id se guarda como el de cualquier orden; y **ni la orden ni su reembolso avisan por
ningún canal** (`EX-15`, `RF-7`), así que nada de este camino espera un aviso: la orden se confirma
con la respuesta y releyéndola, y el reembolso, releyendo el pago (`B/16` §1.4).

---

## 4. Las seis reglas duras de trato con este proveedor

Salen de la medición, no del criterio. Cada una tiene su caso que la produjo.

### 4.1 El código de estado no cierra ninguna mutación

**Toda mutación se verifica releyendo y comparando campo por campo cada campo que se mandó.**

No alcanza con releer «la» mutación: está medido que **un `PUT` con varios campos se aplica a
medias con un solo `200`** — `frequency: 6` + `transaction_amount: 99` juntos dejaron la
frecuencia intacta y el monto cambiado (`EX-20`). **El que falla no arrastra al que funciona.**

**Y vale también al revés: un error al crear no prueba que no se creó nada** (mediciones del
2026-09-29, punto 5). Un alta de preapproval con `card_token_id` que devuelve `400` sin id deja un
preapproval creado con nuestro `external_reference`, que el proveedor cancela segundos después y
cuyos avisos llegan con ids que nuestra base no conoce (`EX-55`, 3 de 3 en sandbox); y una orden
con la tarjeta rechazada devuelve `402` y queda creada, `failed`, con el id en el cuerpo del error
(`EX-30`). **El alta de este diseño no pasa por el primero**: va por checkout, sin token (§2, fila
1). Lo que sí vale: el id que venga en el cuerpo de un error se guarda como el de un éxito; sobre
un preapproval, la llave para asociar lo que llegue es el `external_reference`, que va en el cuerpo
de la creación con la clave ya persistida (`B/02` §2.2); y un aviso de un recurso desconocido sigue
el camino de la huérfana (`B/09` §2.4), no un error.

### 4.2 El `init_point` crudo no se muestra nunca

Está medido que **viene roto**: llega con `&activation=true` y esa URL abre *«Esta página no
existe»* (`EX-37`, bug abierto del proveedor desde el 2026-09-04, sin respuesta oficial).

Es el caso más caro de todos los medidos: **la API responde `201` y entrega un dato que parece
válido**, el cliente no se suscribe, y no hay ningún error de nuestro lado. Se sanea antes de
mostrarlo, **con un guard estático** — porque es un call site que cualquiera vuelve a escribir
«bien» copiando lo que la API devuelve.

Y con `DEC-ADDON-002` deja de ser un call site: **cada contratación de addon ~~necesita uno~~
recurrente necesita uno** —la de única vez no crea preapproval: va por `/v1/orders` (§3.2,
corrección de diseño, FASE 8 completa, `F-8CB1-008`)—.

### 4.3 Nunca se le pide un trial

Está medido que **una `start_date` futura se convierte en un free trial sola**: el request no
lleva `free_trial`, el objeto queda con uno, y al comprador se le anuncia *«Tu prueba gratis
comenzó»* (`EX-38`).

Como la fecha futura es la **precondición de seguridad** de todo cambio de plan y de ciclo
(`DEC-SUB-006`), esto no se puede evitar: al cliente que hace un upgrade a mitad de mes se le
anuncia una prueba gratis justo sobre días **que ya pagó**. Se anticipa, no se desmiente
(`DEC-MAIL-001`).

**Un guard que busque `free_trial` en el payload no ve nada**, porque el payload no lo nombra. El
guard tiene que mirar la relectura.

### 4.4 `live_mode` no distingue el entorno

Un evento de la cuenta de pruebas llega con **`live_mode: true`** (`EX-14`), y el token es
`APP_USR-` en los dos entornos. **Lo que sí distingue es `GET /users/me`**: la cuenta de pruebas
trae `tags: ["test_user"]`.

Todo lo que mute algo abre con ese guard. Un handler que filtre por `live_mode` trata los eventos
de sandbox como productivos.

### 4.5 La copy del proveedor no sostiene ninguna decisión

Tres textos suyos contradicen sus propios datos: el asunto *«Pagaste la suscripción»* de un alta
que no cobró nada —medido: el correo sale ~18 s después de autorizar y el cobro real llega ~26
min más tarde, y en dos sujetos **no llegó nunca**—, el *«Cobramos $15 para validar tu tarjeta»*
de un cargo que fue de **$0**, y el `2084` que dice que un pago no se puede reembolsar cuando sí
se puede (`EX-3`, `RF-8`).

**Regla para soporte, que sale directo de la medición: ante un reclamo, mirar el PAGO, nunca el
correo.**

### 4.6 Reembolsar tiene su propio contrato, y no se parece al del resto de la API

Escrita el **2026-09-24**. Es la mecánica que este capítulo le delegaba al 13, y vive acá porque
**es trato con el proveedor**: qué hay que mandarle, qué devuelve y cómo se lee lo que devuelve.
Lo que el dominio decide con eso —cuándo se reembolsa y quién lo confirma— es `DEC-RF-001` y
`DEC-RF-002`.

**Seis cosas medidas, y cada una rompe una suposición razonable:**

1. **`X-Idempotency-Key` es OBLIGATORIO** en `POST /v1/payments/{id}/refunds`: sin él, `400 code
   4292`, **antes** de cualquier validación de negocio (`RF-4`, medido dos veces en dos sondas).
   **Es la contracara exacta de `EX-17`**: el mismo header, en `/preapproval`, **se acepta y no hace
   nada**. ⚠️ **La idempotencia de este proveedor es POR ENDPOINT y no se razona de uno al otro** —
   suponer lo contrario da las dos formas del error: un doble reembolso, o un alta que se cree
   protegida y no lo está.
2. **Y se respeta de verdad**: la misma clave con el mismo cuerpo devuelve **`200` con cuerpo
   vacío** y **ningún reembolso nuevo** (`RF-6`, confirmado contra el movimiento de la cuenta).
   **Dos trampas para quien implemente**: el código es **`200` y no `201`**, así que un cliente que
   sólo acepte `201` lo lee como fallo; y **el cuerpo vacío no trae el refund original**, así que
   hay que releerlo si se lo necesita.
3. **El parcial valida contra el SALDO, no contra el monto original** (`RF-2`): pedir 15 sobre un
   pago de 5.000 con 10 de saldo da `400 code 2017`. **Y no hay monto mínimo** — ARS 5 entró sobre
   pagos de 5.000 y de 7.500, lo que mató la hipótesis anterior de *«hay un mínimo entre 5 y 50»*.
4. **El `message` NO alcanza para distinguir los errores** (`RF-5`): sobre un pago sin saldo, el
   total sin body da **`2063`** y un `amount` mayor al saldo da **`2017`** — **y `amount` igual al
   total ya devuelto da el mismo `2017`**, que son dos situaciones distintas compartiendo texto.
   **Se decide por `code`, nunca por el texto.**
5. **El `2084` no es una propiedad del pago** (`RF-8`): sobre **un mismo** pago de ARS 15,
   `amount: 5` dio `2084` y `amount: 14` dio `201` minutos después. Cuatro hipótesis murieron.
   **Consecuencia dura: un `2084` NO autoriza a marcar un pago como no reembolsable** — es lo que
   la copy del §4.5 sugiere y los datos desmienten.
6. **Un reembolso emite TRES entregas en DOS formatos** (`RF-7`): una de Webhooks
   (`data.id=<pago>&type=payment`) y dos de IPN (`topic=payment` y `topic=merchant_order`).
   **Deduplicar por tipo de evento no alcanza** — y esto se cruza con `WH-1` y `EX-2`: la clave es
   la `version`, que hoy **nuestra capa no guarda** (ver el inventario de compensación).

**Y una que no es del proveedor sino nuestra**: el **histórico de reembolsos es nuestro o no
existe**, porque **el buscador del proveedor cubre sólo doce meses**.

🚧 **Lo que esta sección NO cubre, por decisión y no por olvido**: **reembolsar un cobro más viejo
que el plazo del proveedor**. `DEC-RF-007` decidió que **esa operación no se implementa** — el
sistema no ofrece el botón, lo dice en vez de fallar, y la reparación es **manual y con rastro**.
`RF-3` sigue `UNKNOWN` y **ya no bloquea**, porque su respuesta no cambia el diseño: con el plazo
real por debajo o por encima de los 180 días, **los dos desenlaces caen al mismo camino manual** —que desde la FASE 9 completa tiene acto: la devolución hecha por fuera se asienta por `RF4` (`B/03` §6.1; owner 2026-09-25, decisión 5a)—.

---

## 5. Los cuatro ciclos, la moneda y los impuestos · cierra `MP-01` y `M-MP-01`

**Los cuatro ciclos del §19 están los cuatro verificados** (`FR-1` a `FR-4`): mensual,
trimestral, semestral y anual, como `frequency` 1, 3, 6 y 12 con `frequency_type: "months"`.

Dos precisiones medidas:

- **`"years"` no existe**: da `400`, y los únicos válidos son `days` y `months`. El anual es
  `frequency: 12, months`.
- **`frequency: 5` se acepta.** O sea que **los cuatro ciclos del §19 son una elección nuestra, no
  un límite del proveedor**. Si mañana hace falta un bimestral, el proveedor no es el obstáculo.

**La moneda: sólo ARS.** `USD` y `BRL` dan `400` al crear (`EX-18`). El capítulo 02 ya explicó por
qué la columna existe igual: el §57 pide que el dominio no quede acoplado, y agregar un valor a
una restricción es más barato que agregar una columna.

Con una asimetría medida que conviene conocer: **al crear, una moneda inválida da `400`; sobre
una autorizada, `200` y sigue en ARS** (`EX-20`). Es aceptar-y-descartar otra vez.

**Impuestos: el dominio no los modela.** El §53 difiere ARCA y el §54 ordena emitir un
comprobante **no fiscal** hasta entonces (`DEC-LEGAL-001`). Lo que el proveedor retiene —comisión
y lo que corresponda— **no es una obligación nuestra de cálculo**: se registra lo que el cobro
liquidó, no se deriva. El día que entre ARCA, eso es una capacidad nueva, no un cambio de ésta.

---

## 6. El checkout y su ventana · cierra `M-MP-02`

El §5.6 fija el modelo: creamos el preapproval por API y **recién después** mandamos al cliente a
autorizar. Esa ventana **existe siempre, por diseño**, y el capítulo 03 §3.4 ya le puso número
—**dos, y no uno: 72 h con tarjeta y 7 días corridos con pago manual** (`DEC-SUB-016`)—, limpieza
y regla de reintento. **Sobre el pagador manual esta § no tiene sujeto en el proveedor**: no hay
preapproval que crear ni que cancelar (§7), así que la ventana larga no le agrega a este capítulo
ningún recurso ajeno que vigilar.

Lo que este capítulo agrega es qué sabemos del lado del proveedor:

| | |
|---|---|
| **¿un `pending` vence solo?** | **NO, y está medido: `EX-1` cerró el 2026-09-23** como `PARTIALLY_SUPPORTED`. A los **8 días y 3 horas** el sujeto `bf9b6feba3…` seguía `pending`, con `last_modified` **congelado** un minuto después de crearse, `next_payment_date` **en la fecha original** y el `init_point` devolviéndose entero. **Lo único que quedó sin medir es si se puede reusar**, que exige completar el checkout. **La ventana de autorización es NUESTRA y no del proveedor** — y ahora no por prudencia sino porque **el proveedor no tiene ninguna**. Y por eso `DEC-SUB-016` la pudo partir en dos plazos sin preguntarle nada: la cifra es nuestra en los dos casos |
| **¿se puede cancelar un `pending`?** | **sí**, 11 de 11 verificado por relectura (`EX-17`) |
| **¿el checkout respeta una fecha de primer cobro futura?** | **sí**, `EX-33` `VERIFIED` en **producción con tarjeta real**, medido tres veces sobre el mismo pagador |
| **¿el enlace que devuelve la API sirve?** | **no**, viene roto (`EX-37`, §4.2) |

**La consecuencia, y la medición del 2026-09-23 la endureció.** Nuestro job de limpieza **cancela
explícitamente** el preapproval al vencer la ventana. Eso se había escrito como *«falla hacia el
lado seguro sin saber la respuesta»*, con la cancelación siendo **un no-op** si el proveedor
vencía solo. **Ya no es un no-op: es lo único que mata la autorización.** `EX-1` midió que un
`pending` **no vence nunca**, así que sin ese job quedaría **para siempre** un preapproval que
alguien puede autorizar meses después —con el `init_point` todavía entero— y empezar a cobrar
sobre un checkout que nadie recuerda haber abierto.

> 📌 **Vale como precedente de método**: la decisión tomada sin el dato resultó **la misma** que se
> habría tomado con él, pero **dejó de ser una precaución para volverse un requisito**. Lo que
> cambia no es el diseño: es qué pasa si alguien lo borra por parecerle redundante.

---

## 7. Capacidades por método de pago · cierra `S-MP-01`

El §17.2 pide que los métodos sean configurables **por plan desde la base**, y advierte
textualmente contra *«`if partner -> cash`»*.

**Y no todos los métodos soportan las ocho capacidades del §1.** Un pago manual no se puede
pausar; una tarjeta sí. Si eso se resuelve con un `if` por vertical o por plan, el §17.2 queda
incumplido en la práctica aunque el flag exista.

**Se resuelve componiendo, no preguntando.** La respuesta a *«¿este cliente puede hacer X?»* sale
de la intersección de tres cosas, en un solo lugar:

```text
capacidades(suscripción) =
      capacidades del PROVEEDOR de su método de pago
  ∩   lo que su VERSIÓN DE PLAN habilita
  ∩   lo que su BILLING OPTION admite
```

Es la misma forma que `puedePausar()` del capítulo 01 §3, generalizada: **ninguna superficie
pregunta por el método de pago; pregunta por la capacidad.**

**El caso concreto que esto resuelve**: el §26 exige ciclo mensual para pausar, el §17.2 permite
pago manual en Partner, y un pago manual mensual **no tiene nada que pausar** porque no hay
débito que detener. Con la composición, `puedePausar()` da `false` sin que nadie escriba una
excepción para Partner.

---

## 8. Cuándo caduca un resultado verificado · cierra `S-MP-02`

Una fila `VERIFIED` dice que algo era cierto **en una fecha, en un entorno**. El proveedor cambia
sin avisarnos, y este programa ya midió dos cosas que lo prueban: un bug abierto desde el
2026-09-04 que sigue sin respuesta (`EX-37`) y una API anunciada en discontinuación (§10).

**Las tres reglas:**

1. **Toda fila lleva fecha y entorno**, y una fila medida sólo en sandbox **no responde por
   producción**. Está documentado el caso: `PA-3` **diverge** — en sandbox autorizar cobra en el
   acto y en producción deja un `card_validation` de ARS 0 y el cobro llega ~26 minutos después.
   Es la única divergencia de **comportamiento** encontrada, y alcanza para que la regla exista.
2. **Una fila caduca cuando cambia lo que la sostiene**, no por antigüedad: una versión nueva de
   la API, un aviso del proveedor, o un comportamiento observado que la contradiga. **Un
   comportamiento que contradice una fila no se explica: se re-mide.**
3. **Antes de implementar una capacidad, su fila se re-verifica** si pasó tiempo desde la
   medición. No antes de escribir la spec — escribir sobre una fila vieja es barato de corregir;
   implementar sobre una fila falsa, no.

**Y desde la revisión del owner (2026-09-28, C13 y `L3-d`) la regla 2 tiene quien la dispare sin
esperar a que alguien note la contradicción**: la batería que vigila a Mercado Pago (`B/20` §4.1)
repite cada medición de las dos listas del falso, semanal en la cuenta de pruebas, mensual en
producción y a mano cuando se quiera, y avisa por correo sin ajustar nada.

---

## 9. Las sondas son parte del entregable · cierra `S-MP-03`

El §59 fija el procedimiento de doce pasos y el §58 dice que **no alcanza la documentación**. Eso
sólo se sostiene si las pruebas se pueden volver a correr.

| | |
|---|---|
| **dónde viven** | `docs/mp-probes/`, versionadas, marcadas como no productivas (§4 del PDR las permite como *«scripts experimentales descartables»*) |
| **qué registran** | request, response y webhook, con su fecha |
| **los ids de los sujetos** | en un **manifiesto versionado**, y **sin eso se pierde el experimento**: el buscador del proveedor ignora nuestra referencia (`RC-1`), así que un sujeto sin id no se vuelve a encontrar |
| **el guard de entorno** | toda sonda que mute abre con `GET /users/me` (§4.4) |
| **el guard de presupuesto** | toda sonda que mueva plata aborta si el máximo a cobrar no da **exactamente** el número autorizado — un orden de magnitud no alcanza |

**Esto no sobrevive a FASE 10 como código**: son descartables por definición. Lo que sobrevive es
la matriz, y la capacidad de volver a medir una fila cuando caduque. **Esa capacidad, desde la
revisión del owner (2026-09-28), sí es código**: la batería de `B/20` §4.1, que construye `B1` y
hereda los dos guards de esta tabla.

---

## 10. El riesgo de plataforma · cierra `R-MP-01`

**El panel del proveedor anuncia que la API de Payments se descontinúa** y su documentación no lo
formaliza: las docs de Suscripciones siguen indicando `/v1/payments`, y las de Orders la presentan
como opción paralela, **sin fecha**.

**Qué parte del diseño está expuesta, medido:**

| | |
|---|---|
| **la conciliación** | **no está expuesta.** `EX-16` midió que se puede hacer entera con `/authorized_payments`, que pertenece a la familia de **suscripciones** |
| **el cobro recurrente** | no está expuesto: lo ejecuta el proveedor por el preapproval |
| **los reembolsos** | **expuestos, y sin camino de migración**: la guía del proveedor **excluye explícitamente a las suscripciones** |

O sea: **la única capacidad del diseño que vive en una API anunciada como discontinuada es la 6,
reembolsar** — y es justamente la que `DEC-RF-001` necesita para el derecho de revocación.

**Tres preguntas para soporte del proveedor, que no se pueden medir porque son sobre su futuro**:
si alcanza también a las **lecturas** de `/v1/payments`; **cuándo**; y **cómo se reembolsa un
cobro originado por un `preapproval`** si se retira. Tardan días: conviene preguntarlas ya.

**Lo que la spec hace mientras tanto**: la capacidad 6 se declara como **la única con riesgo de
plataforma conocido**, y el capítulo 13 la trata como reemplazable — su interfaz no puede
filtrar el nombre de ningún endpoint hacia el dominio.

---

## 11. Lo que sigue `UNKNOWN`, y qué bloquea · cierra `M-MP-03`

~~**Cuatro filas de 93**, recontadas con el script y no a mano (2026-09-24).~~ ~~**Cinco filas de
96**~~ ~~**Seis filas de 98**~~ ~~**Cuatro filas de 98**~~ ~~**Cinco filas de 99**~~ ~~**Diez filas de 104**~~ ~~**Doce de las trece filas de 107**~~ ~~**Doce de las dieciséis filas de 111**~~ ~~**Doce de las diecisiete filas de 112**~~ **Doce de las catorce filas de 114** (2026-09-29, mediciones de los dos canales: salieron `EX-52`, `EX-53` y `WH-6`, que no tenían fila en esta tabla; 2026-09-29, casos vecinos de la revisión del owner, con el script: **entró `EX-54`** (revisión del owner, casos vecinos, 2026-09-29, caso 34), que tampoco tiene fila en esta tabla; 2026-09-28, revisión del owner, con el script: **entraron `EX-52`, `EX-53` y `WH-6`**, que todavía no tienen fila en esta tabla; antes, 2026-09-28, con el script: **entraron `EX-48` a `EX-50`**, FASE 9 vuelta 2, verificación, con OK del owner, `V2-y`; **`EX-49`**, el seudónimo del correo, **es de verticales** y no va en esta tabla; eran diez de 104 el 2026-09-27, con el script: **entraron `EX-43` a `EX-47`**, FASE 9 vuelta 2, con OK del owner; eran cinco de 99 el 2026-09-26, con el script: salieron `RN-3` el
25/09 noche, a `PARTIALLY_SUPPORTED`, y `GR-1` el 26/09, a `VERIFIED`; **entró `EX-42` el 26/09**, owner, `Y-1`); las seis se habían recontado
con el script el 2026-09-25, cuando entraron **`RC-8`**, el
contracargo (FASE 8 completa, `F-8CB3-009`), y **`PA-6`**, si el proveedor cancela ante cualquier
primer rechazo. El §61 es terminante:
*«No comenzar implementación de una **capability crítica** mientras siga `UNKNOWN`»* — y la palabra
que hace trabajo es **crítica**: una fila abierta sobre algo que **no se implementa** no bloquea
nada (ver `RF-3`, abajo).

| fila | qué falta saber | qué bloquea | cuándo se contesta |
|---|---|---|---|
| **`RN-3`** | si recupera solo después del fallo | ~~el diseño del grace~~ **nada** (FASE 9 completa, C11: `B/09` ~~§8~~ **, *«Lo que este capítulo NO cierra»*,** ya dice que ninguna bloquea; referencia corregida en FASE 9 vuelta 1, `F-8V1D1-007`) | ~~**EN CURSO**: se reactivó un sujeto el 2026-09-23 y se lee tras su cobro del **2026-09-24**~~ **leído el 2026-09-24: reactivar no reintenta lo adeudado**; ~~sigue `UNKNOWN` si vuelve a pausar~~ (tachado 2026-09-26) **`PARTIALLY_SUPPORTED` desde el 2026-09-25 (noche)**: reactivar retoma el ciclo siguiente, no recupera lo adeudado, y vuelve a pausar si el medio sigue fallando (`D/06`, fila `RN-3`; FASE 9 vuelta 1, `F-8V1B1-008`) |
| **`GR-1`** ✅ | si se puede pagar durante el grace | ~~ídem~~ ~~**la salida de `DEC-SUB-021` para el pagador con tarjeta —*«cambiá la tarjeta»*— queda condicionada a esta fila**, y la pantalla y los correos del grace no prometen que el reintento use la tarjeta nueva (owner 2026-09-25; FASE 9 completa, 3a). No bloquea implementar: bloquea prometer. **Se mide con el próximo rechazo mensual real**~~ (tachado 2026-09-26) **nada: `VERIFIED` el 2026-09-26** — un pago dentro de la ventana cierra el ciclo fallido sobre el mismo registro, y cambiar el medio dispara un reintento en el momento que cobra con el nuevo (sonda 49). `DEC-SUB-021` deja de estar condicionada y la pantalla puede decirlo | ~~necesita actuar sobre los dos controles pausados — **es plata y va con el OK del owner**~~ **cerrada**: la midió la sonda 49 con el cambio de medio del owner |
| **`GR-2`** | qué pasa con un pago tardío, después de suspender | el cap. 05 §3 lo diseñó **sin** esta fila. **En un pagador con tarjeta, `DEC-SUB-019` la contesta por diseño y no por medición**: `S6` cancela el preapproval en el mismo acto de suspender, así que un pago tardío del proveedor ya no tiene cómo llegar después de eso. Sigue `UNKNOWN` lo que queda afuera de ese diseño: el pagador manual y los bordes —un cobro ya en vuelo al momento de `S6`, un preapproval reactivado a mano— | ídem |
| **`RC-8`** ✚ | qué estado lee el pago en un contracargo, qué aviso llega y en qué lectura aparece | **no bloquea la decisión**: `DEC-SUB-020` fija qué hacemos al leer `charged_back`, no cómo se comporta el proveedor (`B/03` §3.2 y §6, `B/09` §3). Lo que queda sin medir es la detección | **no se puede fabricar**: exige una disputa real con el emisor. Se contesta cuando ocurra una |
| **`PA-6`** ✚ | si el proveedor cancela el preapproval ante **cualquier** primer rechazo, o sólo ante el antifraude | **no bloquea**: `S16` cancela el preapproval de nuestro lado ante el primer rechazo leído por id, y el barrido reintenta esa cancelación (FASE 8 completa, owner 2026-09-25) | **no se puede fabricar**: exige una tarjeta real sin saldo |
| **`EX-42`** ✚ | si el `expire` de qzpay vence una `Preference` de Checkout Pro en el proveedor, y la relectura lo confirma | **nada de esta épica**: condiciona el paso 1a del corte, que vence las `Preference` del cambio de plan del viejo (`16-fase-7-del-paraguas.md` §4.2; owner 2026-09-26, `Y-1`) | **en el paso 0 del corte**, sobre una preferencia propia sin pagar |
| **`EX-43`** ✚ | si reenviar una orden con la misma clave y el mismo cuerpo **horas después**, con el token de la tarjeta ya vencido, devuelve la misma orden si existía, y qué devuelve si nunca se creó | **no bloquea**: condiciona `A3` sobre el addon de única vez (`B/03` §8; `R4`), que es de **B10**. Si devuelve error con la orden existente, `A3` no la ve pagada y el caso cae en la comprobación de órdenes pagadas del barrido de **B11**, motivo 23 (FASE 9 vuelta 2, con OK del owner, `Q-UNKNOWN`) | pendiente de sonda; `EX-41` midió el reenvío inmediato |
| **`EX-44`** ✚ | si cancelar un preapproval **corta el reciclado** de un registro de cobro abierto (`scheduled`/`recycling`), o un cambio de medio posterior todavía lo cobra | **no bloquea**: da el tamaño de la población del cobro sobre la lápida del corte y condiciona la exención de las terminales (`B/21` §2.5, `B/09` §3; `R2`), que lee **B11**. No es condición del corte (FASE 9 vuelta 2, con OK del owner, `Q-UNKNOWN`) | **en el paso 0 del corte** (`16-fase-7…` §4.2), sobre una sonda propia con un registro abierto |
| **`EX-45`** ✚ | si una cancelación leída `cancelled` en el `PUT` y en un `GET` inmediato sigue `cancelled` releída **horas después** | **nada de esta épica**: condiciona el gate del paso 2 del corte y el cobro sobre su lápida (`F-8V2C2-004`). El código actual registra seis que no (`preapproval-recovery.service.ts:22`, HOS-937) (FASE 9 vuelta 2, con OK del owner, `Q-UNKNOWN`) | **en el paso 0 del corte**; `PA-5` midió la irreversibilidad en sandbox |
| **`EX-46`** ✚ | a qué URL va el **reintento** de una notificación emitida antes de cambiar la URL de notificación de la aplicación: a la de entonces o a la vigente | **nada de esta épica**: condiciona el paso 4b del corte (`F-8V2C2-002`). Si va a la vieja, el evento se pierde y su cobro cae en el punto (3) del «NO cierra» de `B/21` sobre `G3-1`, que ve el barrido de **B11** (FASE 9 vuelta 2, con OK del owner, `Q-UNKNOWN`) | ~~con el corte; `WH-4` midió los reintentos, no su destino~~ **no se mide, por decisión del owner**: si el día del corte se pierde un reintento, el barrido diario lo relee (mediciones del 2026-09-29, M-4) |
| **`EX-47`** ✚ | si un registro de cobro ya creado cobra el monto viejo o el nuevo cuando el monto del preapproval se muta **después** de creado (antes del lote, o durante sus reintentos) | **no bloquea**: condiciona el importe cobrado contra el esperado (`B/09` §3, `B/14` §2.4; `F-8V2B3-001`, `R20`), que compara **B11**. Si cobra el viejo, lo ve el motivo 24 (`B/02` §2.5) cuando la mutación bajó el monto, y la línea del resumen del cobro de menos (`NUCLEO/08` §4.1) cuando lo subió (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-f`) (FASE 9 vuelta 2, con OK del owner, `Q-UNKNOWN`) | **en el paso 0 del corte**, sobre una sonda propia; `PC-1` midió el monto vigente con la mutación mucho antes del cobro |
| **`EX-48`** ✚ | qué campo del pago que aprobó un registro de cobro en un **reintento** posterior a la creación del registro, leído por id, trae el instante de esa aprobación, distinto del `date_created` del registro | **no bloquea una unidad**: es el dato con el que la regla de la marca decide si un cobro sobre la lápida del corte es posterior al corte (`B/21` §2.5, `B/09` §3, `B/05` §3; `F-8V2B3-002`), que lee **B11**. **Y el paso 1b no arranca sin él**: si ningún campo es confiable, la ventana vuelve al owner antes del corte (FASE 9 vuelta 2, verificación, con OK del owner, `V2-a`, `V2-m` y `V2-y`) | **en el paso 0 del corte**, sobre una sonda propia con un registro que se rechaza y cobra en un reintento (`GR-1`, `RC-6`) |
| **`EX-50`** ✚ | cuántas suscripciones del sistema viejo con ciclo anual siguen vivas el día del corte | **no bloquea**: dice cuándo cae la segunda corrida del detector del cobro sobre la lápida (`B/21` §1.3 y «NO cierra»), que lee **B11**; no es condición del corte. Si hay alguna, el `expire_date` de su registro de cobro abierto se mide ahí, porque `RC-7` lo midió sólo sobre ciclos de 1 y 2 días (FASE 9 vuelta 2, verificación, con OK del owner, `V2-r`, `V2-z4` y `V2-y`) | **en el paso 0 del corte**, sobre el recorrido del proveedor del 1b |
| `RF-3` | reembolsar un pago de más de 180 días | ~~el caso viejo del cap. 13~~ **NADA, desde `DEC-RF-007`** | **el sujeto existe y es `167913214814`** (aprobado 2026-07-08, ARS 15, sin reembolsar): cumple 180 días el **2027-01-04**. **No se va a esperar**: `DEC-RF-007` decidió que esa operación **no se implementa** y la reparación es manual |

> 📌 **Las cuatro que salieron, y cómo**: **`RN-2`** y **`GR-3`** cerraron el 2026-09-22 cuando la
> tarjeta del owner empezó a rechazar sola —el cobro fallido que tres caminos deliberados no habían
> podido fabricar—; **`EX-1`** el 2026-09-23 (un `pending` **no vence**); y **`WH-5`** el 2026-09-23 (reabierta el 2026-09-28, cerrada el 2026-09-29),
> sin usar el interruptor: **la evidencia estaba sin leer en la corrida del 2026-09-15**, porque la
> 5ª entrega llegó a las 7 horas y la lectura se había cerrado antes.

~~**Tres de las cuatro, después cinco**~~ ~~**Cuatro de las seis siguen siendo el mismo hecho: un cobro que falla** —`RN-3`, `GR-1`, `GR-2` y `PA-6`; `RC-8` es un contracargo y `RF-3` un reembolso (recontado sobre la tabla en la FASE 9 completa, C11).~~ **Dos de las ~~cuatro~~ ~~cinco~~ ~~diez~~ doce siguen siendo el mismo hecho: un cobro que falla** —`GR-2` y `PA-6`; `RC-8` es un contracargo, `RF-3` un reembolso y **`EX-42` el vencimiento de una preferencia** (recontado el 2026-09-26: salieron `RN-3` y `GR-1`; entró `EX-42`, owner, `Y-1`), ~~**y `EX-43` a `EX-47` son cinco lecturas del proveedor que pidió la FASE 9 vuelta 2**, tres de ellas en el paso 0 del corte (recontado el 2026-09-27, `Q-UNKNOWN`)~~ **y `EX-43` a `EX-48` y `EX-50` son siete lecturas del proveedor que pidió la FASE 9 vuelta 2**, cinco de ellas en el paso 0 del corte (recontado el 2026-09-28, `V2-y`). ❌ **Y la previsión de que
se contestaban el 2026-09-17 no se cumplió**: los dos sujetos que esta sección nombraba fallaron —
`renov-falla3` **nunca estuvo armado** (la mutación al techo se había rechazado con `400` y nadie
releyó), y `apagon` se cayó cuando el home banking del owner avisó que **los débitos automáticos se
cobran igual** sobre una tarjeta pausada. **Lo destrabó el uso normal, cinco días después**: desde el
2026-09-19 la tarjeta real del owner empezó a rechazar sola, y eso cerró `RN-2` y `GR-3` el 09-22.

**Consecuencia para esta spec, declarada y no completada en silencio (§67):** el capítulo 12
puede escribir la **política** del grace —cuántos días, qué pasa durante, cómo se sale— porque
eso lo fijan el §20 y `DEC-SUB-002`. **Lo que no puede fijar hasta esa lectura es cómo se compone
nuestro grace con el del proveedor**: si él reintenta cuatro días y nosotros suspendemos a los
tres, suspendemos a alguien que iba a pagar bien.

> 📌 **Eso ya está medio contestado, y el resto se lee hoy.** `GR-3` midió la política entera:
> **cuatro intentos dentro de una ventana de 24 h**, y lo que decide el desenlace es **vencer la
> ventana**, no agotar los reintentos. Lo que falta es si esa ventana es **fija de 24 h** o es **el
> ciclo** — los cinco sujetos medidos eran de ciclo diario, así que las dos hipótesis son
> indistinguibles ahí. La [sonda 49](../../HOS-1352-billing-verticals-redesign/docs/mp-probes/probe-49-la-ventana-de-reintentos.mjs)
> las separa con un sujeto de `2 days` y **se lee el 2026-09-24**. De su veredicto depende si un
> `GRACE_PERIOD` de 7 días **lo sostiene alguien**: con ventana fija el proveedor se rinde al día
> siguiente sin importar el plan.
>
> **📌 Contestado el 2026-09-24 (registrado en la matriz el 2026-09-25, `GR-3`): la ventana es EL
> CICLO** —48,0 h sobre un ciclo de 2 días—, no 24 h fijas. Y el grace de tarjeta arranca en el
> primer rechazo y es siempre más corto que el ciclo (`B/12` §1.2, `DEC-SUB-019`), así que lo
> sostienen los reintentos del proveedor.

---

## Lo que este capítulo NO cierra

- ~~**La mecánica del reembolso** es del capítulo 13, y arrastra `RF-3` en `UNKNOWN`.~~ **Escrita
  acá el 2026-09-24, en el §4.6**, porque es **trato con el proveedor** y no otra cosa. Y ya no
  arrastra `RF-3`: `DEC-RF-007` sacó del alcance la operación que esa fila medía.
- **La conciliación** es del capítulo 09.
- **Los correos que el proveedor manda por su cuenta** son del capítulo 07.
- ~~**La idempotencia de `/v1/orders`**, el camino del addon de única vez (§3.2), **no está medida**
  y queda pendiente de sonda (corrección de diseño, FASE 8 completa, `F-8CB1-008`).~~ **Cerrado el
  2026-09-25 por `EX-41`** (sonda 51, sandbox): es idempotente por la clave. Queda sólo producción.
- ~~**Los dos canales de avisos del proveedor: pendiente de medición**~~ **Los dos canales de avisos
  del proveedor: medidos el 2026-09-29, y el canal IPN se escucha y se guarda sin actuar** (revisión
  del owner, 2026-09-28, N9 y `L3-g`; mediciones del 2026-09-29, M-2 y punto 2). El proveedor avisa por **dos canales**, Webhooks e IPN, y un mismo hecho
  puede llegar por los dos (`RF-7`: tres entregas por una devolución, una de Webhooks y dos de IPN).
  **El código de hoy descarta en silencio todo lo que llega por IPN**: el receptor de hospeda2
  contesta `200` a toda entrega sin el marcador `source_news=webhooks` que el propio sistema le
  agrega a la URL, con un log de nivel `debug` (HOS-159). No es de `qzpay`. ~~**Y eso contamina dos
  mediciones**: la mitad de producción de `WH-5` (las dos cancelaciones por antifraude que no
  produjeron aviso se leyeron **después** de ese descarte) y `EX-15`, que midió que mutar el monto
  no avisa **por el canal Webhooks**, con el receptor de pruebas escuchando sólo ese canal. **Qué
  hace el receptor nuevo con un aviso IPN no está decidido: se mide antes** (el owner, `L3-g`). El
  receptor nuevo no hereda el descarte por inercia: si lo tiene o no es parte de lo que se decide
  después de medir. **`WH-6` se mide antes de cerrar el diseño** (el paso 2 del handoff); **si no
  se llega a medir, el receptor nuevo registra los avisos IPN sin actuar**: los guarda con su
  canal, no escribe ni decide nada con ellos, y la regla se revisa cuando `WH-6` esté medida
  (revisión del owner, casos vecinos, 2026-09-29, caso 39). **Dónde los registra se decide después
  de medir `WH-6`**; **si no se llega a medir, en una tabla propia, sólo de altas, con el canal, el
  cuerpo y el instante, que ninguna transición lee**: así registrar no puede volverse actuar. El
  modelo de `B/02` no la tiene, porque es condicional; entra el día que se sepa que `WH-6` no se
  mide (revisión del owner, casos vecinos, 2026-09-29, caso G-D). Mientras tanto la M5 del falso (`B/20` §3.2) se lee
  como *«por el canal Webhooks»* hasta la remedición.~~ **Lo medido** (`WH-6`, `WH-5` y `EX-15`,
  2026-09-29, sandbox con los dos canales escuchando y producción por sus logs): **IPN entrega sólo
  `payment`**, sin firma que se pueda verificar con la clave de la aplicación (`EX-13`) y sin
  `version` (`EX-2`); **ningún hecho de suscripción llega por IPN que no llegue por Webhooks**; y
  **cada `payment` llega una vez por cada canal**, a milisegundos y sin canal que llegue primero. La
  contaminación que esta entrada temía no estaba: `WH-5` y `EX-15` se cerraron con los dos canales
  escuchando. La salvedad de `RF-7` sigue: en producción IPN trajo una vez un `merchant_order` tras
  un reembolso de `/v1/payments`. **Qué hace el receptor nuevo con IPN, decidido por el owner**
  (mediciones del 2026-09-29, M-2, que reemplaza a los casos 39 y G-D): **escucha el canal y guarda
  cada entrega, sin actuar**. La guarda entera en **`ipn_delivery`** (`B/02` §2.7), una tabla sólo
  de altas que **ninguna decisión lee** y que `G17` nombra (`B/20` §2), con **180 días de retención
  técnica, no configurable** (`NUCLEO/02` §1.5); y no hace nada más con ella: **las entregas
  `payment` llegan por los dos canales, y el receptor procesa sólo la de Webhooks**. **Se revisa
  tres meses después del corte** ([HOS-1399](https://linear.app/hospeda-beta/issue/HOS-1399)): lo
  guardado de IPN contra lo recibido por Webhooks, para decidir si se apaga. **El panel de la
  aplicación de producción queda con IPN activo**, y en el corte su URL se apunta también al receptor
  nuevo (`16-fase-7…` §4.2, paso 4b). **Cómo sabe el receptor por qué canal entró una entrega**: por
  la URL a la que llegó, que es una por canal en el panel, como hoy (`source_news=webhooks` en la de
  Webhooks); nunca por el cuerpo, que `G17` le prohíbe leer. **Y el requisito del owner sigue**,
  ahora sobre un solo canal procesado: **un aviso duplicado del mismo hecho no puede
  producir efecto doble**: ninguna escritura, ningún correo ni ningún aviso de cobertura dos veces.
  Con `D17` la relectura por id ya lo sostiene en el estado, pero no alcanza con decirlo: **lleva
  su prueba explícita**, ~~un mismo hecho entregado por Webhooks y por IPN, en los dos órdenes y en
  el mismo segundo, que deja exactamente una escritura y un correo~~ un mismo `payment` entregado
  dos veces por Webhooks a medio segundo (`WH-1`) y una por IPN en el mismo segundo, en cualquier
  orden, que deja exactamente una escritura y un correo, y la entrega de IPN guardada en
  `ipn_delivery` y en ningún otro lado (mediciones del 2026-09-29, punto 3). **Causa**: el filtro se
  agregó porque a veces llegaban dos avisos del mismo hecho, uno por cada canal (hecho del owner).
