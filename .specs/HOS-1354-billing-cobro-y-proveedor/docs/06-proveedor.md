---
title: Master Spec 06 — Abstracción de proveedor y el contrato de Mercado Pago
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-17
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
usamos**, y **las reglas de trato que salen de haberlo medido** — 93 filas, 89 medidas (recontadas
el 2026-09-24). **Y desde `DEC-MP-005` el proveedor que usamos es Mercado Pago, decidido**: lo que
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
| 7 | leer | ⚠️ **a medias** | **por id, confiable** (`RC-2`); **buscar, no** (`RC-1`) |
| 8 | avisar | ⚠️ **a medias** | avisa el alta, la pausa, la reanudación y la cancelación; **no avisa el cambio de monto** (`EX-15`) |

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

---

## 4. Las cinco reglas duras de trato con este proveedor

Salen de la medición, no del criterio. Cada una tiene su caso que la produjo.

### 4.1 El código de estado no cierra ninguna mutación

**Toda mutación se verifica releyendo y comparando campo por campo cada campo que se mandó.**

No alcanza con releer «la» mutación: está medido que **un `PUT` con varios campos se aplica a
medias con un solo `200`** — `frequency: 6` + `transaction_amount: 99` juntos dejaron la
frecuencia intacta y el monto cambiado (`EX-20`). **El que falla no arrastra al que funciona.**

### 4.2 El `init_point` crudo no se muestra nunca

Está medido que **viene roto**: llega con `&activation=true` y esa URL abre *«Esta página no
existe»* (`EX-37`, bug abierto del proveedor desde el 2026-09-04, sin respuesta oficial).

Es el caso más caro de todos los medidos: **la API responde `201` y entrega un dato que parece
válido**, el cliente no se suscribe, y no hay ningún error de nuestro lado. Se sanea antes de
mostrarlo, **con un guard estático** — porque es un call site que cualquiera vuelve a escribir
«bien» copiando lo que la API devuelve.

Y con `DEC-ADDON-002` deja de ser un call site: **cada contratación de addon necesita uno**.

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
real por debajo o por encima de los 180 días, **los dos desenlaces caen al mismo camino manual**.

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
| **¿un `pending` vence solo?** | **`EX-1` sigue `UNKNOWN`.** Hay un sujeto vivo desde el 2026-09-15 esperando respuesta. **Por eso la ventana de autorización es NUESTRA y no del proveedor**: no se puede depender de un vencimiento que no está medido. **Y por eso `DEC-SUB-016` la pudo partir en dos plazos sin preguntarle nada al proveedor**: la cifra es nuestra en los dos casos |
| **¿se puede cancelar un `pending`?** | **sí**, 11 de 11 verificado por relectura (`EX-17`) |
| **¿el checkout respeta una fecha de primer cobro futura?** | **sí**, `EX-33` `VERIFIED` en **producción con tarjeta real**, medido tres veces sobre el mismo pagador |
| **¿el enlace que devuelve la API sirve?** | **no**, viene roto (`EX-37`, §4.2) |

**La consecuencia de que `EX-1` siga abierto**: nuestro job de limpieza **cancela explícitamente**
el preapproval al vencer la ventana. Si además el proveedor lo vence solo, la cancelación es un
no-op; si no lo vence, es lo único que impide una autorización viva que puede cobrar. **Falla
hacia el lado seguro sin saber la respuesta.**

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
la matriz, y la capacidad de volver a medir una fila cuando caduque.

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

**Cuatro filas de 93**, recontadas con el script y no a mano (2026-09-24). El §61 es terminante:
*«No comenzar implementación de una **capability crítica** mientras siga `UNKNOWN`»* — y la palabra
que hace trabajo es **crítica**: una fila abierta sobre algo que **no se implementa** no bloquea
nada (ver `RF-3`, abajo).

| fila | qué falta saber | qué bloquea | cuándo se contesta |
|---|---|---|---|
| **`RN-3`** | si recupera solo después del fallo | el diseño del grace | **EN CURSO**: se reactivó un sujeto el 2026-09-23 y se lee tras su cobro del **2026-09-24** |
| **`GR-1`** | si se puede pagar durante el grace | ídem | necesita actuar sobre los dos controles pausados — **es plata y va con el OK del owner** |
| **`GR-2`** | qué pasa con un pago tardío, después de suspender | el cap. 05 §3 lo diseñó **sin** esta fila | ídem |
| `RF-3` | reembolsar un pago de más de 180 días | ~~el caso viejo del cap. 13~~ **NADA, desde `DEC-RF-007`** | **el sujeto existe y es `167913214814`** (aprobado 2026-07-08, ARS 15, sin reembolsar): cumple 180 días el **2027-01-04**. **No se va a esperar**: `DEC-RF-007` decidió que esa operación **no se implementa** y la reparación es manual |

> 📌 **Las cuatro que salieron, y cómo**: **`RN-2`** y **`GR-3`** cerraron el 2026-09-22 cuando la
> tarjeta del owner empezó a rechazar sola —el cobro fallido que tres caminos deliberados no habían
> podido fabricar—; **`EX-1`** el 2026-09-23 (un `pending` **no vence**); y **`WH-5`** el 2026-09-23,
> sin usar el interruptor: **la evidencia estaba sin leer en la corrida del 2026-09-15**, porque la
> 5ª entrega llegó a las 7 horas y la lectura se había cerrado antes.

**Tres de las cuatro siguen siendo el mismo hecho: un cobro que falla.** ❌ **Y la previsión de que
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

---

## Lo que este capítulo NO cierra

- ~~**La mecánica del reembolso** es del capítulo 13, y arrastra `RF-3` en `UNKNOWN`.~~ **Escrita
  acá el 2026-09-24, en el §4.6**, porque es **trato con el proveedor** y no otra cosa. Y ya no
  arrastra `RF-3`: `DEC-RF-007` sacó del alcance la operación que esa fila medía.
- **La conciliación** es del capítulo 09.
- **Los correos que el proveedor manda por su cuenta** son del capítulo 07.
