---
title: "Revisión del owner · lo medido el 2026-09-29, llevado al diseño"
linear: HOS-1352
statusSource: linear
created: 2026-09-29
updated: 2026-09-29
status: CURRENT
fase: 9
---

# Revisión del owner · lo medido el 2026-09-29, llevado al diseño

Las decisiones **M-1 a M-5** de [`27-decisiones-sobre-las-mediciones.md`](./27-decisiones-sobre-las-mediciones.md)
(con OK del owner), los **diez puntos de impacto** de
[`25-lote-matriz-mediciones-2026-09-29.md`](./25-lote-matriz-mediciones-2026-09-29.md) § 4 y los dos
huecos que el diseño declaraba *«pendiente de medición»*: **N8** (`B/12`, cancelar o pausar desde la
cuenta de Mercado Pago) y **`L3-g`** (`B/06`, los dos canales de avisos). Evidencia:
[`RESULTS-2026-09-29.md`](../mp-probes/RESULTS-2026-09-29.md) con sus anexos,
[`RESULTS-2026-09-29-bateria-ipn.md`](../mp-probes/RESULTS-2026-09-29-bateria-ipn.md) y la matriz ya
actualizada por [`26-`](./26-aplicacion-lote-matriz-mediciones.md) (114 filas).

Editado en el worktree `hospeda-spec-hos-1352-billing-redesign` sobre el HEAD `cbc7dbd503`, sin
commits. **El log, la matriz, el PDR y los informes no se tocaron**: lo que necesitan va en § 4,
para el OK del owner. Leídos antes `16-` entero y los registros `18-`, `20-`, `24-` y `26-` en lo que
tocan a IPN, `WH-6` y N8. Abreviaturas: `B/` es `HOS-1354…/docs`, `D/16` la FASE 7 del paraguas,
`nucleo/` el núcleo, `$B/` y `$D/` las raíces. Cada cambio lleva la marca *(mediciones del
2026-09-29, M-n)* o *(…, punto n)*, con el número del punto de `25-` § 4.

**Lo que se aplicó es lo que se deriva sin elección**; lo que pedía elegir está en § 3, sin
aplicar. Una sola cosa la elegí yo y la marco para que el owner la vea: **el nombre de la tabla,
`ipn_delivery`**, en inglés y en singular como las demás del modelo (`payment`, `provider_link`,
`domain_event`). M-2 pide nombrarla y no la nombra; si prefiere otro, es un reemplazo en siete
lugares. Y si elige la opción 1 de la decisión 2 (§ 3), el nombre tiene que cambiar igual.

## 1. Qué se aplicó

### M-2 · IPN se escucha y se guarda, sin actuar (reemplaza a los casos 39 y G-D)

El «NO cierra» de `B/06` deja de estar *«pendiente de medición»*: se tacha la rama condicional de
los casos 39 y G-D y queda lo medido y lo decidido. El receptor guarda cada entrega IPN en
`ipn_delivery` y procesa sólo la entrega `payment` de Webhooks; la tabla entra al modelo, que la
dejaba afuera por condicional; `G17` la nombra con un tercer predicado; y el corte apunta también la
URL de IPN al receptor nuevo, porque sin eso M-2 no guarda nada.

- `B/06:498` «medidos el 2026-09-29, y el canal IPN se escucha y se guarda sin actuar»
- `B/06:524` «Qué hace el receptor nuevo con IPN, decidido por el owner»
- `B/06:528` «las entregas `payment` llegan por los dos canales, y el receptor procesa sólo la de Webhooks»
- `B/06:533` «Cómo sabe el receptor por qué canal entró una entrega»
- El modelo: `B/02:1219` «2.7 Los avisos IPN guardados, que nadie lee»
- `B/02:1226` «cada entrega que llega por el canal IPN, tal cual»
- La retención: `B/02:1234` «Retención: 180 días desde la llegada»
- `B/02:1247` «Se borra a los 180 días»
- `B/02:1249` «primera fila habla del modelo nuevo»
- El plazo técnico: `nucleo/02:170` «los 180 días que se guarda un aviso»
- `G17`: `B/20:68` «algo lee `ipn_delivery`»
- Su criterio en `B1`: `$B/descomposicion.md:776` «una consulta a `ipn_delivery`»
- La unidad que la construye: `$B/descomposicion.md:129` «y el receptor guarda cada entrega del canal IPN»
- El receptor: `B/03:2713` «Todo esto es del canal Webhooks. Una entrega que llega por IPN no entra acá»
- El corte: `D/16:141` «Y la URL del canal IPN, que queda activo»
- La batería: `B/20:675` «está decidido desde el 2026-09-29: IPN se guarda sin actuar»

**Por qué por la URL y no por el cuerpo**: `G17` (a) le prohíbe al receptor leer del cuerpo otra
cosa que el tipo, el id y la `version`, y en producción las dos URL del panel ya son distintas (la
de Webhooks lleva `source_news=webhooks`, anexo de producción de `RESULTS-2026-09-29.md`). Es la
única forma de las dos que no rompe un guard.

### M-1, M-3, M-4 y M-5 · lo que no se mide

- **M-1** (`WH-2`, `WH-3`, `WH-4`): **el diseño ya decía lo que M-1 supone**, así que no cambió
  texto. `B/12` §1.2 cuenta con avisos de días (`WH-2`), `B/20` §3.2 simula el desorden sin haberlo
  observado (`WH-3`), y nada depende de cuántos reintentos hay (`WH-4`): lo no recibido lo relee el
  barrido.
- **M-3** (`EX-13`): nada del diseño actúa sobre IPN, así que nada cambió. La marca va a la matriz
  (§ 4).
- **M-4** (`EX-46`), en los cuatro lugares que la nombraban:
  - `B/06:446` «no se mide, por decisión del owner»
  - `$B/descomposicion.md:421` «si el día del corte se pierde un reintento»
  - `$B/spec.md:273` «si el día del corte se pierde un reintento»
  - `D/16:141` «y no se mide, por decisión del owner»
- **M-5** (`EX-54`): el tercer correo de la migración lo dice en general.
  - `nucleo/07:239` «y el tercero dice, en general»
  - `B/10:187` «se mide, por decisión del owner»
  - `$B/descomposicion.md:425` «sin citar su texto»

### Punto 1 · N8, cancelar o pausar desde Mercado Pago

**Medido y derivado**: el pagador puede cancelar y no puede pausar; la baja no trae autor; y el
autoservicio existe porque el alta de este diseño va por checkout (`EX-56`). **El hueco (2), la
pausa leída como mora, se cierra**: sin pausa del pagador, un `paused` sin `PUT` nuestro es la mora
de `DEC-MP-008`. **El hueco (1), la baja que corta el servicio y pierde lo pagado, sigue**: cómo
tratarla es elección, y va a § 3, decisión 1. Hasta entonces el diseño se queda como está.

- `B/12:1151` «medido el 2026-09-29; queda un hueco, y lo decide el owner»
- `B/12:1154` «el pagador puede cancelar desde su cuenta y no puede pausar»
- `B/12:1165` «Sigue, y cómo se trata lo decide el owner»
- `B/12:1170` «el pagador no puede pausar»
- Lo que avisa el proveedor: `B/06:73` «la baja que da el pagador desde su cuenta sí llega»

### Punto 2 · `L3-g` y N9, los dos canales

Aplicado con M-2 (arriba). La M5 del falso deja de leerse *«por el canal Webhooks»*: `EX-15` quedó
medida con los dos canales.

- `B/20:500` «con los dos canales escuchando»
- `B/06:73` «Y avisa por dos canales, de los que sólo Webhooks trae hechos de suscripción»

### Punto 3 · la deduplicación de `payment` entre canales

Con M-2 el `payment` de IPN no se procesa, así que no hay carrera entre canales. Queda la de
Webhooks, a medio segundo (`WH-1`), que el diseño ya resuelve con la unicidad de la base y no con una
consulta previa: lo escribí para que nadie la reemplace por un *«¿ya lo tengo?»*. La prueba
explícita que pedía `L3-g` se reescribe sobre lo que el receptor procesa, y la mentira M6 suma
`WH-6` como fuente.

- `B/06:540` «un mismo `payment` entregado dos veces por Webhooks a medio segundo»
- `B/05:272` «tres advertencias medidas»
- `B/05:282` «El de IPN no entra a este cruce»
- `B/20:501` «un mismo `payment` llega una vez por cada canal, y el de IPN lo guarda el receptor sin procesarlo»

### Punto 4 · el `payment` de ARS 0 `card_validation`

Un `payment` releído con `operation_type: card_validation` no escribe nada, no corre ninguna
transición y no cuenta como rechazo. Para poder probarlo el falso tiene que emitirlo, y por la regla
del caso 28 (comportamiento medido que el código necesita reproducido) entra a la segunda lista como
`RP12`.

- `B/03:2796` «un `payment` que la relectura muestra con `operation_type: card_validation` no es un cobro»
- `B/20:537` «RP12 ✚»
- `B/20:540` «Son doce, recontadas sobre la tabla»
- `B/20:521` «que necesita el receptor»
- `B/20:650` «doce reglas propias y comportamientos medidos»
- `$B/descomposicion.md:219` «doce reglas propias»
- `$B/descomposicion.md:776` «veinte mediciones»

### Punto 5 · un error al crear no prueba que no se creó

Regla general en `B/06` §4.1, sin sumar una séptima regla (la lista es *«seis reglas duras»*): el
alta de este diseño va por checkout y no pasa por el `400` con token de `EX-55`, pero el principio
vale, y en las órdenes sí aplica: el `402` deja la orden `failed` con su id, que se guarda. Qué pasa
cuando la persona reintenta con otra tarjeta es elección: § 3, decisión 3.

- `B/06:157` «un error al crear no prueba que no se creó nada»
- `B/06:162` «El alta de este diseño no pasa por el primero»
- `B/06:136` «Y dos cosas medidas en sandbox el 2026-09-29 que el camino tiene que respetar»
- `B/16:119` «Qué pasa cuando la persona reintenta con otra tarjeta»

### Punto 6 · `payer_id` no es identidad

El modelo no guardaba `payer_id`; ahora dice por qué, para que nadie lo agregue como vínculo.

- `B/02:60` «Y no guarda al pagador del proveedor, a propósito»

### Punto 7 · la cancelación del proveedor tras un rechazo no avisa

El diseño ya la ve: si es el primer cobro, `S16` relee el preapproval antes de cancelar; si no, la
comparación de estado del barrido, a más tardar al día siguiente. No hacía falta un mecanismo
nuevo, sí decirlo donde se lee la detección.

- `B/09:61` «Y lo que el proveedor NO avisa de un preapproval que ya conocemos lo ve la relectura»
- `B/06:73` «Tampoco avisa la cancelación que hace él mismo»

### Punto 8 · los saltos de `version` sin aviso

- `B/02:74` «Y un hueco en la `version` no prueba un aviso perdido»

Ninguna regla del diseño compara versiones contiguas: la `version` sólo descarta el aviso más
viejo (`B/03` §10.1). Ningún texto tenía que corregirse, sólo decirlo.

### Punto 9 · el aviso de un recurso desconocido o terminal

El receptor nuevo contesta `200` a lo que procesó: la huérfana tiene su lápida y su marca, y el
terminal, su par en la tabla del §10.1. Sólo contesta error si no pudo procesar. El `B/09` §5
registra el caso de producción. **Si merece un issue sobre el receptor de hoy** es elección: § 3,
decisión 4.

- `B/03:2716` «Y el receptor contesta `200` a una entrega que ya procesó»
- `B/09:895` «Y se volvió a ver en producción el 2026-09-28»
- `B/09:899` «En el diseño nuevo el disparador no es un error»

### Punto 10 · la confirmación del cobro de única vez

El camino ya se confirmaba con la respuesta, la relectura, `A3` y el barrido. Lo nuevo es escribir
que nada espera un aviso, porque se midió que no llega.

- `B/16:111` «Ni la orden ni su reembolso avisan por ningún canal»

## 2. Conteos que cambiaron

| qué | antes | después | cómo se contó | espejos |
|---|---|---|---|---|
| reglas y comportamientos de la segunda lista del falso | 11 | **12** (`RP12`) | leída la tabla de `B/20` §3.2 | `B/20` (tres lugares), `$B/descomposicion.md` §2 |
| mediciones que la batería repite en una pasada | 19 (13 · 6) | **20** (13 · 7, con `RP12`) | ver § 5, punto 2 | `$B/descomposicion.md`, criterio de `B1` |
| predicados de `G17` | 2 | **3** | leída la fila | ninguno cuantificaba |
| advertencias medidas de `C6` | 2 | **3** | leídas | ninguno |
| entidades del modelo de billing | sin esta tabla | **+1**, `ipn_delivery` (§2.7 nueva) | por construcción | ninguno cuantificaba |
| filas de la lista de retención de `B/02` §4.1 | 1 | **2** | leída | la frase *«la fila de arriba»*, corregida |

**Lo que no se movió**: los 33 guards (`G17` suma un predicado, no un guard), las transiciones, los
24 motivos, las acciones administrativas, los 15 plazos configurables de `nucleo/02` §1.5 (los 180
días son técnicos, fuera de la lista), las 13 mentiras del falso, y las cifras de la matriz y del
log, que no se editaron. **La matriz, recontada con el script sobre el archivo real: 114 filas, 61 ·
15 · 24 · 14**, igual que `26-`.

## 3. Decisiones para el owner

### Decisión 1 · la baja que el cliente da desde la app de Mercado Pago (N8, `EX-52`)

**Qué pasa.** Si un cliente se da de baja desde la app de Mercado Pago, el diseño la trata como si
la hubiera dado Mercado Pago: le corta el servicio en el acto. Medimos que lo que manda Mercado Pago
no dice quién dio la baja; sólo lo sabemos porque nosotros no la pedimos.

**Ejemplo.** Juan paga el mes el día 1. El 10 entra a la app de Mercado Pago y cancela. A más tardar
el 11 su suscripción queda cancelada y sus fichas dejan de verse: pierde veinte días que pagó. Si
hubiera cancelado desde Hospeda, los conservaba hasta el día 1.

1. **Tratarla como una baja pedida desde Hospeda**: si no la pedimos nosotros y en el ciclo no hubo
   un cobro rechazado, el servicio sigue hasta el fin del período pagado y sale nuestro correo de
   baja. *Costo*: una regla más en la tabla que decide qué hacer al leer una cancelación (`B/03`
   §10.1), y que toda cancelación nuestra quede anotada antes de pedírsela a Mercado Pago (hoy está
   así sólo para algunas, `R18`). *Riesgo*: si Mercado Pago cancela por su cuenta sin ningún cobro
   rechazado, caso que no medimos, esa persona recibe los días que ya pagó. No se pierde plata.
2. **Dejarla como está**: corta en el acto. *Costo*: ninguno. *Riesgo*: el cliente pierde días
   pagados y lo reclama, y la misma baja tiene dos resultados según dónde la dio.
3. **Cortar en el acto, pero avisarle por correo** que la baja desde Mercado Pago corta ya y que
   puede volver a suscribirse. *Costo*: un correo nuevo. *Riesgo*: sigue perdiendo los días; sólo se
   entera.

**Recomiendo la 1**: los días pagados son suyos, que es lo que el owner ya decidió para la baja
desde Hospeda (`DEC-SUB-009`), y distinguirla pide un dato que el diseño casi tiene.

### Decisión 2 · qué guardamos de Webhooks para poder comparar con IPN (M-2, HOS-1399)

**Qué pasa.** La revisión de dentro de tres meses compara lo que llegó por IPN con lo que llegó por
Webhooks. De IPN guardamos cada entrega tal cual. De Webhooks el diseño no guarda las entregas:
guarda lo que hizo con ellas (el pago, la última versión). Y los registros del servidor duran unos
cuatro días (medido el 29/09).

**Ejemplo.** En enero querés saber si en diciembre llegó por IPN algún pago de Juan que no llegó por
Webhooks. Encontrás la entrega de IPN; del otro lado encontrás el pago de Juan en la base, pero no
sabés si lo trajo Webhooks o lo encontró el barrido diario.

1. **Guardar también cada entrega de Webhooks en la misma tabla**, con el canal, los mismos 180
   días, y que nadie la lea. *Costo*: una columna y una fila más por entrega (hoy unas 20 por día en
   producción); la tabla cambia de nombre, a uno que diga los dos canales. *Riesgo*: casi ninguno:
   el guard que prohíbe leerla ya existe.
2. **Comparar contra lo que ya se guarda** (los pagos de la base). *Costo*: nada. *Riesgo*: la
   revisión no puede contestar si Webhooks perdió algo, que es su pregunta.
3. **Alargar lo que duran los registros del servidor.** *Costo*: disco y configuración, fuera de
   esta épica. *Riesgo*: se pierden con cualquier cambio de infraestructura.

**Recomiendo la 1**: es la única que deja contestar la pregunta de la revisión, y cuesta una
columna.

### Decisión 3 · reintentar con otra tarjeta la compra de un complemento de pago único (`EX-30`, `EX-41`)

**Qué pasa.** Si en la compra de un complemento de pago único la tarjeta se rechaza, Mercado Pago
igual crea la orden (rechazada) y nos da su número. Si la persona prueba otra tarjeta en la misma
pantalla, el diseño reusa esa orden rechazada, porque el pedido es el mismo; y si mandara una orden
nueva con la misma clave y otra tarjeta, Mercado Pago la rechaza por ser otro contenido.

**Ejemplo.** Juan compra «destacar 7 días», su tarjeta se rechaza, carga la otra y aprieta «pagar»:
no pasa nada nuevo, porque el sistema cree que ese pedido ya tiene su orden. La compra queda
pendiente hasta que vence su ventana (72 horas) y Juan no puede comprar en ese momento.

1. **Un rechazo cierra la compra**: pasa a abandonada en el acto, y la pantalla arranca un pedido
   nuevo para el segundo intento. *Costo*: una transición nueva de la compra, con sus espejos.
   *Riesgo*: bajo.
2. **Tras un rechazo, la pantalla arranca un pedido nuevo**, y la compra vieja queda pendiente hasta
   que la cierra el vencimiento de su ventana. *Costo*: una regla en la pantalla. *Riesgo*: una
   compra pendiente colgada hasta 72 horas; no revisé si choca con alguna regla de compra sobre el
   mismo destino.
3. **Una misma compra admite varios intentos**, cada uno con su clave, y guarda todas sus órdenes.
   *Costo*: cambio del modelo y del barrido. *Riesgo*: más superficie para un caso chico.

**Recomiendo la 1**: deja la compra en un estado que dice la verdad y no depende de un vencimiento.

### Decisión 4 · el receptor de hoy fuerza reintentos que nunca se resuelven (punto 9)

**Qué pasa.** El receptor actual, cuando le llega un aviso del cobro de una suscripción que no
encuentra, contesta error a propósito para que Mercado Pago lo reintente. Sobre una suscripción que
Mercado Pago ya canceló, eso no se resuelve nunca. Pasó el 28/09.

**Ejemplo.** La suscripción de un cliente que Mercado Pago canceló por antifraude hace días sigue
mandando avisos de su cobro. Cada uno se reintenta varias veces y queda como error en los registros,
sin que nadie tenga nada que hacer.

1. **No abrir nada**: el receptor nuevo ya contesta bien, y el viejo desaparece en el corte.
   *Costo*: ninguno. *Riesgo*: errores de más en los registros hasta el corte.
2. **Abrir un issue en Linear** para que el receptor de hoy conteste OK sobre suscripciones
   terminadas. *Costo*: tocar código de cobro que se va a borrar. *Riesgo*: un cambio en producción
   por un problema que sólo es ruido.

**Recomiendo la 1.**

## 4. Para el log y la matriz (pide OK del owner)

Grepeé cada ID antes de proponer: `DEC-MP-009` **no existe** (la última `MP` es `DEC-MP-008`);
existen `DEC-MP-008`, `DEC-SUB-009`, `DEC-TEST-003`, `DEC-DATA-008` y las siete filas que se tocan
(`WH-2`, `WH-3`, `WH-4`, `WH-6`, `EX-13`, `EX-46`, `EX-54`). Los textos están en
`aplic-28/propuestas.py` y `aplic-28/propuestas_log.py` del scratchpad de la sesión, y se simularon
sobre copias con `simular.py` y `simular_log.py`; abajo van tal cual.

### 4.1 La matriz: cómo se escribe *«no se mide, por decisión»*

**La matriz no tiene hoy una forma para esto**, y el script tampoco: sus cuatro estados son del
§61 y la regla 1 no deja llenar una fila sin experimento. El precedente más cercano es `RF-3`, que
sigue `UNKNOWN` aunque `DEC-RF-007` decidió no esperarla. **Propongo que no sea un quinto estado**:
la fila conserva el suyo, lleva en la conclusión una marca nueva, 🚫 (la matriz ya usa ✅, 📌, 🔎,
🚧 y ⛔), y el script lista esas filas aparte, para que *«faltan N mediciones»* no cuente las que
nadie va a hacer. Se agrega al final de la celda de conclusión, separado por un espacio, como
`25-` § 2.

**`WH-2`**:

```text
🚫 **No se mide, por decisión del owner** (2026-09-29, [decisiones sobre las mediciones](./30-revision-del-owner/27-decisiones-sobre-las-mediciones.md), M-1): la cola de demoras largas no se re-mide. El diseño ya asume demoras de días (`B/12` §1.2) y se defiende releyendo por id y con el barrido diario (`B/09` §3), así que la cifra exacta no cambia nada
```

**`WH-3`**:

```text
🚫 **No se mide, por decisión del owner** (2026-09-29, [decisiones sobre las mediciones](./30-revision-del-owner/27-decisiones-sobre-las-mediciones.md), M-1): el desorden a volumen no se mide. El diseño lo resiste sin haberlo observado: el falso lo simula aparte de las mentiras (`B/20` §3.2) y el estado se relee, no se reconstruye (`B/03` §10.1). La fila queda `PARTIALLY_SUPPORTED` con la restricción que ya nombra
```

**`WH-4`**:

```text
🚫 **No se mide, por decisión del owner** (2026-09-29, [decisiones sobre las mediciones](./30-revision-del-owner/27-decisiones-sobre-las-mediciones.md), M-1): la escalera completa no se mide. El diseño no depende de cuántos reintentos hay ni de cuándo terminan: una entrega que no llega la ve el barrido diario (`B/09` §3)
```

**`EX-13`**:

```text
🚫 **No se mide, por decisión del owner** (2026-09-29, [decisiones sobre las mediciones](./30-revision-del-owner/27-decisiones-sobre-las-mediciones.md), M-3): la firma de las entregas IPN no se mide. Con `M-2` el receptor guarda IPN sin actuar (`B/06`, «NO cierra»), así que la condición de la última oración del 📌 anterior no se cumple y la fila sigue `VERIFIED`
```

**`EX-46`**:

```text
🚫 **No se mide, por decisión del owner** (2026-09-29, [decisiones sobre las mediciones](./30-revision-del-owner/27-decisiones-sobre-las-mediciones.md), M-4): si el día del corte se pierde un reintento, el barrido diario lo relee (`B/21`, «NO cierra», punto (3)). Queda `UNKNOWN`, sin bloquear nada
```

**`EX-54`**:

```text
🚫 **No se mide, por decisión del owner** (2026-09-29, [decisiones sobre las mediciones](./30-revision-del-owner/27-decisiones-sobre-las-mediciones.md), M-5): el tercer correo de la migración dice en general que Mercado Pago también va a mandar un aviso del cambio de monto, sin citar su texto (`B/10` §3.7 punto 4, `NUCLEO/07` §6). Queda `UNKNOWN`, sin bloquear nada; la sonda 54 no se corre
```

**El 📌 de `WH-6`**: se tacha el de los casos 39 y G-D y se agrega otro. Reemplaza, en la
conclusión, este texto:

```text
📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 39 y G-D)**: Se mide antes de cerrar el diseño (paso 2 del handoff). Si no se llega a medir, el receptor nuevo registra los avisos IPN sin actuar hasta que esta fila esté medida (`B/06`, "lo que este capítulo NO cierra"). Dónde los registra se decide después de medirla; si no se llega a medir, en una tabla propia, sólo de altas, con el canal, el cuerpo y el instante, que ninguna transición lee.
```

por este:

```text
📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 39 y G-D)**: ~~Se mide antes de cerrar el diseño (paso 2 del handoff). Si no se llega a medir, el receptor nuevo registra los avisos IPN sin actuar hasta que esta fila esté medida (`B/06`, "lo que este capítulo NO cierra"). Dónde los registra se decide después de medirla; si no se llega a medir, en una tabla propia, sólo de altas, con el canal, el cuerpo y el instante, que ninguna transición lee.~~ 📌 **Precisada otra vez el 2026-09-29, con OK del owner ([decisiones sobre las mediciones](./30-revision-del-owner/27-decisiones-sobre-las-mediciones.md), M-2, que reemplaza a los casos 39 y G-D)**: medida la fila, el receptor nuevo igual escucha IPN y guarda cada entrega sin actuar, en `ipn_delivery`, una tabla sólo de altas que ninguna decisión lee y que `G17` nombra, con 180 días de retención técnica (`B/02` §2.7). Procesa sólo la entrega `payment` de Webhooks. El panel de producción queda con IPN activo, y se revisa tres meses después del corte ([HOS-1399](https://linear.app/hospeda-beta/issue/HOS-1399)).
```

**`## Qué espera cada decisión`**, dos filas nuevas al pie de la tabla (hoy no nombra `EX-52`,
`EX-53` ni `WH-6`; lo había notado `25-` § 4, punto 1):

```text
| N8, cancelar o pausar desde la cuenta de Mercado Pago (`DEC-SUB-009`, `DEC-MP-008`) | ✅ **`EX-52`** (la baja del pagador llega y no se distingue de la nuestra), ✅ **`EX-53`** (`NOT_SUPPORTED`: no puede pausar) y ✅ **`EX-56`** (sólo con alta por checkout existe el autoservicio): **medidas el 2026-09-29**. Queda una elección del owner sobre la baja (`30-revision-del-owner/28-…`, decisión 1) |
| El canal IPN (`L3-g`, N9) | ✅ **`WH-6`**, **`EX-15`** y **`WH-5`**, cerradas el 2026-09-29 con los dos canales. **Decidido** por el owner: se escucha y se guarda sin actuar ([decisiones sobre las mediciones](./30-revision-del-owner/27-decisiones-sobre-las-mediciones.md), M-2) |
```

**El script** (`contar-filas-de-la-matriz.py`), 17 líneas de diff: no cambia cómo cuenta los
estados; detecta la marca en la fila y agrega dos listas al final. Está en
`aplic-28/contar-propuesto.py`. Es un cambio de script y pide su propio OK, como lo pidió `25-` § 0.2
para lo tachado.

**Las cifras, simuladas** sobre `matriz-propuesta.md` con los dos scripts:

| qué | hoy | con § 4.1 |
|---|---|---|
| filas | 114 | **114** |
| `VERIFIED` · `PARTIALLY_SUPPORTED` · `NOT_SUPPORTED` · `UNKNOWN` | 61 · 15 · 24 · 14 | **61 · 15 · 24 · 14** (el script actual da la misma salida en los dos archivos) |
| `UNKNOWN` que esperan medición | 14 | **12** (salen `EX-46` y `EX-54`) |
| no se miden, por decisión | 0 | **6**: `WH-2`, `WH-3`, `WH-4`, `EX-13` (con su estado) y `EX-46`, `EX-54` (`UNKNOWN`) |

Ninguna cifra de la matriz ni de sus espejos cambia, así que no hay espejos que mover. **Si el
owner quiere que `RF-3` lleve la misma marca** (`DEC-RF-007` decidió no esperarla), son siete y
once; no lo propongo porque no es de M-1 a M-5.

### 4.2 El log

**Una decisión nueva**, al final de las funcionales, antes de `## Resumen`, con la raya larga del encabezado que el formato del log exige (M-2 es una decisión de
diseño del receptor, y *«ninguna decisión vive en otro lado»*; M-1, M-3, M-4 y M-5 son sobre qué se
mide, y van sólo a la matriz):

```text
### DEC-MP-009 — El canal IPN se escucha y se guarda, sin actuar

- **Fecha**: 2026-09-29 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema** (revisión del owner, N9 y `L3-g`): el proveedor avisa por dos canales, Webhooks e
  IPN, y el receptor de hoy descarta IPN en silencio (HOS-159). `L3-g` pidió medir antes de decidir
  qué hace el receptor nuevo con IPN; los casos 39 y G-D dejaron una salida para si `WH-6` no se
  llegaba a medir.
- **Contexto medido**: `WH-6` (2026-09-29, sandbox con los dos canales escuchando, y producción por
  sus logs): IPN entrega sólo `payment` (12 de 12 en sandbox, 8 de 8 en producción), cada pago llega
  una vez por canal, IPN no trae `version` (`EX-2`) ni se verifica con la clave de la aplicación
  (`EX-13`), y ningún hecho de suscripción llega por IPN. `RF-7` vio una vez en producción un
  `merchant_order` por IPN tras un reembolso. `WH-5` y `EX-15` se cerraron con los dos canales.
- **Alternativas**: (1) apagar IPN en el panel el día del corte y descartarlo en el receptor; (2)
  escucharlo y guardarlo sin actuar; (3) procesarlo como a Webhooks.
- **Decisión**: (2), a propuesta del owner. El receptor nuevo guarda cada entrega de IPN entera en
  `ipn_delivery` (`B/02` §2.7), una tabla sólo de altas que ninguna decisión lee y que `G17` nombra,
  con una retención técnica, no configurable, de 180 días; procesa sólo la entrega `payment` de
  Webhooks. El panel de la aplicación de producción queda con IPN activo, y en el corte su URL se
  apunta al receptor nuevo. Tres meses después del corte se revisa lo guardado de IPN contra lo
  recibido por Webhooks, y con ese dato se decide si se apaga
  ([HOS-1399](https://linear.app/hospeda-beta/issue/HOS-1399)).
- **Motivo**: el owner: *«lo escuchamos y lo guardamos, pero sin hacer nada más; en el futuro
  podemos revisar esa data y ver si realmente no nos sirve de nada, o nos estamos perdiendo de
  algo»*. **Contra la recomendación**, que era la (1).
- **Implicaciones**: (1) `G17` suma un tercer predicado, *«algo lee `ipn_delivery`»* (`B/20` §2);
  (2) el requisito de `L3-g` (ningún efecto doble) se prueba con el duplicado de Webhooks y la copia
  de IPN en el mismo segundo (`B/06`, «NO cierra»); (3) `EX-13` no se mide para IPN (M-3); (4) qué
  se guarda de Webhooks para poder comparar en HOS-1399 queda como decisión del owner
  (`30-revision-del-owner/28-aplicacion-mediciones-al-diseno.md`, decisión 2).
- **Reemplaza a**: la salida condicional de los casos 39 y G-D (`30-revision-del-owner/16-`, lote D
  letra J y lote G letra D), que no tenía `DEC` propio.
- **Origen**: `30-revision-del-owner/27-decisiones-sobre-las-mediciones.md` (M-2); aplicada en
  `30-revision-del-owner/28-aplicacion-mediciones-al-diseno.md`.
```

**Cuatro 📌**, al final de cada entrada, con la cabecera *«Precisada el 2026-09-29, con OK del owner
(mediciones del 2026-09-29, …)»*, y en su *Estado* *«y precisada el 2026-09-29, con OK del owner
(mediciones del 2026-09-29, …; ver su último 📌)»*:

**`DEC-MP-008`**:

```text
- 📌 **Precisada el 2026-09-29, con OK del owner (mediciones del 2026-09-29, punto 1)**: Medido el 2026-09-29 (`EX-53`, el owner desde la cuenta del comprador, en la web y en la app): el pagador no puede pausar desde su cuenta de Mercado Pago. Un `paused` sin un `PUT` nuestro es, entonces, la mora que esta decisión espeja, y la pausa deja de estar pendiente en el 📌 anterior (N8).
```

**`DEC-SUB-009`**:

```text
- 📌 **Precisada el 2026-09-29, con OK del owner (mediciones del 2026-09-29, punto 1)**: Medido el 2026-09-29 (`EX-52`, `EX-56`): el pagador puede darse de baja desde su cuenta de Mercado Pago cuando el alta fue por checkout, llega un aviso sólo por Webhooks, y ningún campo lo distingue de una baja nuestra: la autoría sólo la da nuestro propio registro. Qué hace esta decisión con esa baja lo decide el owner (`30-revision-del-owner/28-…`, decisión 1); hasta entonces se espeja como una baja del proveedor (`B/12`, lo que no cierra).
```

**`DEC-TEST-003`**:

```text
- 📌 **Precisada el 2026-09-29, con OK del owner (mediciones del 2026-09-29, puntos 3 y 4)**: La segunda lista del falso suma `RP12`, comportamiento medido: cambiar la tarjeta emite un `payment` de ARS 0 con `operation_type: card_validation`, por los dos canales y sin nombrar al preapproval (`EX-36`, `PA-3`), que el receptor tiene que ignorar; son doce. Y la mentira M6 suma como fuente `WH-6`: un mismo `payment` llega una vez por cada canal.
```

**`DEC-DATA-008`**:

```text
- 📌 **Precisada el 2026-09-29, con OK del owner (mediciones del 2026-09-29, M-2)**: Los 180 días que se guarda un aviso IPN (`DEC-MP-009`, `B/02` §2.7) son un plazo técnico más, no configurable, como los que esta decisión nombra.
```

**El 📌 de `DEC-SUB-009` cambia con la decisión 1** de § 3: si el owner elige la 1, la última
oración pasa a decir que esa baja lleva la fila a `CANCEL_SCHEDULED` con fin en el fin del período
pagado, y la entrada del 📌 cita la decisión en vez de dejarla pendiente.

**`## Resumen`**: *Decisiones tomadas* ~~134~~ **135**, con *«el 2026-09-29 (mediciones), `DEC-MP-009`
(el canal IPN se escucha y se guarda sin actuar)»*; *Funcionales* ~~119~~ **120**; y una fila nueva
al pie: *«Mediciones del 2026-09-29 | **1 nueva, 4 📌, 0 `SUPERSEDED`**, sobre M-1 a M-5
(`30-revision-del-owner/27-`) y los diez puntos de `25-` § 4. Registro:
`30-revision-del-owner/28-aplicacion-mediciones-al-diseno.md`»*. Frontmatter `updated:` a
2026-09-29.

**Las cifras, simuladas** sobre `log-propuesto.md`:

| qué | hoy | con § 4.2 | comando |
|---|---|---|---|
| decisiones | 134 | **135** | `rg -o "^### DEC-[A-Z]+-\d+" … \| sort -u \| wc -l` |
| precisadas sin `SUPERSEDED` | 66 | **66**: las cuatro ya estaban precisadas | `contar-precisadas.py` (el de `24-`) |
| `SUPERSEDED` | 11 | **11** | `rg -c "\*\*Estado\*\*.*SUPERSEDED"` |

Cada 📌 simulado quedó debajo del encabezado de su decisión (verificado por línea: `DEC-SUB-009`
1361, `DEC-MP-008` 5660, `DEC-TEST-003` 6563, `DEC-DATA-008` 6704, en la copia). **Espejo de las 134
decisiones**: `24-` § 3 dice que están en la `spec.md` del paraguas y en `nucleo/00`; si el owner
aprueba, pasan a 135 ahí.

## 5. Lo que queda afuera

1. **`03-handoff.md`** sigue diciendo que con los resultados se deciden N8 y `L3-g`
   (`$D/03-handoff.md:67`): lo actualiza el owner (`15-` § 3).
2. **La cifra de la batería ya estaba corrida antes de esta tanda.** El criterio de `B1` decía
   *«diecinueve mediciones»* (13 mentiras y 6 reglas) y el caso 28 sumó `RP7` a `RP11` sin moverla.
   La dejé en veinte con la cuenta escrita (las que se repiten en una pasada; `RP7` a `RP11` se
   releen sin mutar), que es lo que `B/20` §4.1 punto 1 dice. Si el owner la lee como *todas*, son
   veinticinco.
3. **La pausa como anomalía.** `25-` § 2.5 proponía que una `paused` sin `PUT` nuestro y sin rechazos
   sería una anomalía. El diseño ya la lee como mora (`DEC-MP-008`) y el proveedor sólo pausa por
   mora (`GR-3`): no le di un camino propio, porque sería un motivo nuevo sin un caso medido.
4. **Si el alta sin iniciar sesión en el checkout** deja la suscripción a nombre de un invitado,
   como el alta por API (`EX-56`), no está medido. Si pasara, esa persona no podría darse de baja
   desde Mercado Pago, y la decisión 1 no la alcanza. No lo abro como fila: es una pregunta nueva, y
   M-1 a M-5 cerraron las mediciones.

## Key Learnings

1. Una decisión de *«guardar sin actuar»* arrastra tres cosas que nadie nombra: dónde se ve el
   canal sin leer el cuerpo (la URL, porque `G17` prohíbe el cuerpo), que la URL del canal se
   apunte al sistema nuevo en el corte, y contra qué se va a comparar lo guardado.
2. Una marca de *«no se mide, por decisión»* no puede ser un quinto estado de la matriz: la regla 1
   no deja escribir un resultado sin experimento. Se representa como marca en la conclusión y se
   lista aparte, y la simulación muestra que no mueve ninguna cifra.
3. Antes de aplicar un hallazgo de alta con token (`EX-55`, `EX-56`) hay que ver qué camino de alta
   usa el diseño: acá es checkout, así que la regla vale como principio y el autoservicio del
   pagador existe.
