---
title: "FASE 8 vuelta 1 · B2 — máquinas, idempotencia y carreras"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 1 · B2 — máquinas, idempotencia y carreras

Ataqué las máquinas de billing del `B/03` (Suscripción `S1`–`S35`, Grace, Pausa, Pago con
`P1`–`P7`, Reembolso `RF1`–`RF5`, Pago manual `MP1`–`MP5`, Addon `A1`–`A6` y la regla de
no-retroceso del §10) contra el `B/05` (idempotencia y los seis cruces), buscando pares
`(estado, evento)` sin transición o con dos, guardas que se contradicen, eventos duplicados o
fuera de orden, escrituras que compiten sin nada que las serialice, y conteos cerrados que no
cierran. Usé el `B/02` §2.2–§2.5 y el `B/09` §2–§4 y §7 como consulta de lo que las
transiciones leen y escriben, y la matriz para lo que el proveedor hace. Dejé afuera lo que el
propio `B/03` ya declara en *«lo que esta mitad NO cierra»* (el contracargo sobre una
`SUSPENDED`, el correo sin plazo de `S6`/`S17`, el grace de la sucesora de 3c, el cobro en vuelo
tras un `S6` por contracargo).

Son **11 hallazgos**: **0 CRITICA, 3 ALTA, 5 MEDIA y 3 BAJA**. Lo más grave: la plata de un
cliente que hay que devolver puede quedar colgada de una marca ya levantada, o entrar a la
bandeja con la propuesta de quedársela, según cuál de dos procesos llegue primero.

Regla de lectura: cada hallazgo se apoya en una cita textual, copiada literal de una sola línea
del archivo que se nombra con `archivo:línea`. Abrevio las rutas: `B/…` es
`.specs/HOS-1354-billing-cobro-y-proveedor/docs/…`, `N/…` es
`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/…` y `MATRIZ` es
`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md`.

## ALTA

### F-8V1B2-001 — Levantar una marca y colgarle un pago no se serializan: el pago queda en una marca cerrada

**Qué se rompe.** `S15` levanta una marca si ningún pago colgado está sin resolver, y `S14`,
cuando llega otro hecho con el mismo motivo, **cuelga el pago de la marca abierta** en vez de
abrir otra. Son dos escrituras en dos tablas distintas (`reconciliation_mark` y
`reconciliation_mark_payment`), y el diseño no dice qué las serializa: no hay locks, y la
concurrencia optimista se describe por fila con estado, no por la relación entre una marca y
sus pagos. Es el write skew de manual: `S15` lee *«cero pagos sin resolver»*, `S14` lee
*«marca abierta»*, las dos escriben, y queda un pago con plata a devolver colgado de una marca
con `levantada_en` puesto. El listado accionable muestra sólo marcas abiertas y el barrido
vuelve a mirar sólo las terminales con la marca puesta, así que ese pago **no lo ve nadie**.

**El camino.**

1. Juan tiene un *Free Forever* cuya cancelación en el proveedor no se aplicó (`C3`); cada mes
   entra un cobro y `S14` lo cuelga de la marca `COBRO_POSTERIOR_AL_GRANT`.
2. Una operadora confirma y ejecuta los reembolsos de los tres cobros colgados y aprieta
   «levantar»: `S15` lee los pagos colgados, los tres tienen `resuelto_en`, la guarda se cumple.
3. En ese mismo instante entra el cuarto cobro. `S14` lee la marca, todavía abierta, e inserta
   la fila en `reconciliation_mark_payment`.
4. `S15` escribe `levantada_en`. El cuarto cobro queda colgado de una marca cerrada, sin
   `resuelto_en`, fuera del listado y fuera del barrido. Juan pagó un mes de algo declarado
   gratis y nadie lo va a devolver.

**La evidencia.**

| dónde | qué muestra | cita |
|---|---|---|
| `B/03-maquinas-de-estado.md:157` | la guarda de `S15` | «y ningún pago colgado de esa marca sin resolver» |
| `B/03-maquinas-de-estado.md:156` | `S14` sobre una marca ya abierta | «le cuelga a la abierta el pago que el caso trae» |
| `B/02-modelo-de-datos.md:49` | la relación es otra tabla, con su propio único | «el mismo pago no se cuelga dos veces de la misma marca» |
| `B/05-idempotencia-y-concurrencia.md:35` | sin locks | «Cada caso de abajo se resuelve con una restricción» |
| `B/03-maquinas-de-estado.md:2747` | la optimista es por fila | «Entre la relectura y la escritura puede entrar otra. Cada fila con estado lleva una» |
| `B/19-superficies.md:207` | lo que se muestra | «el **listado accionable** de las marcas `requiere_conciliación` **abiertas**» |
| `N/08-auditoria-y-observabilidad.md:193` | lo que el barrido revisita | «que devuelve al recorrido las suscripciones terminales con la marca puesta o con un pago pendiente» |

**Qué haría falta decidir o escribir.** Qué serializa colgar un pago y levantar la marca: que
colgar incremente la versión de la marca (y `S15` escriba contra esa versión), o una
restricción, o un detector de pagos sin resolver sobre marcas levantadas. Ninguna de las tres
está escrita hoy.

### F-8V1B2-002 — Un cobro sobre una `CANCEL_SCHEDULED` tiene tres destinos, y uno recorta el piso de la discontinuación

**Qué se rompe.** El par `(CANCEL_SCHEDULED, entra un cobro)` lo contestan tres textos distintos.
El `B/05` §2 `C2` dice que un cobro anterior a la baja **extiende** la fecha de fin de servicio.
La fila `S11` dice cómo: **recalcular su fórmula** (`inicio(P) + un ciclo`). La fila `S26` manda
el pago de una fila discontinuada a *«como el de cualquier `CANCEL_SCHEDULED`»*, pero su fecha
de fin no sale de esa fórmula sino del piso de la vertical (`max(día 60, último día pagado)`), y
recalcular con la de `S11` la **acorta**. Y el `B/05` §3 —«si falla cualquiera», marca— tiene
una condición 1 que no clasifica `CANCEL_SCHEDULED` en ningún lado, y su tabla de desempate
tampoco: un implementador que corra el §3 sobre todo pago que entra a una fila no `ACTIVE` pone
`PAGO_TARDÍO_RECHAZADO`, con default de devolver, sobre un cobro que `C2` declara legítimo.

**El camino.**

1. Juan está en `GRACE_PERIOD`; el proveedor recicla su cuota de octubre.
2. El día 0, `SUPER_ADMIN` discontinúa la vertical: `S26` cancela el preapproval y deja la fila
   en `CANCEL_SCHEDULED` con fin de servicio el 1 de diciembre (día 60).
3. El reintento de octubre ya había cobrado y el aviso llega después (demora de `WH-2`). Es
   anterior a la baja.
4. Implementador A aplica `C2` + la fórmula de `S11`: `covered_period` de octubre, fin de
   servicio = 1 de noviembre. Juan pagó y **pierde un mes del piso** que el resto de la vertical
   recibe. Implementador B corre el §3: condición 1 falla, marca `PAGO_TARDÍO_RECHAZADO`,
   propuesta de devolver un cobro legítimo. Implementador C deja el 1 de diciembre.

**La evidencia.**

| dónde | qué muestra | cita |
|---|---|---|
| `B/05-idempotencia-y-concurrencia.md:113` | `C2`, primera fila | «Se extiende la fecha de fin de servicio** hasta cubrirlo» |
| `B/03-maquinas-de-estado.md:153` | `S11` | «escribe su `covered_period` y la misma fórmula, recalculada, es la extensión que ese § manda» |
| `B/03-maquinas-de-estado.md:168` | `S26` | «el pago que llegue se resuelve como el de cualquier `CANCEL_SCHEDULED`» |
| `B/03-maquinas-de-estado.md:168` | la fecha de `S26` es otra | «es UNA sola para toda la vertical**, la fórmula del `B/10` §4.3» |
| `B/05-idempotencia-y-concurrencia.md:268` | condición 1 | «si está `CANCELLED`, `ABANDONED` o ya `ACTIVE`, el pago no la reactiva» |
| `B/05-idempotencia-y-concurrencia.md:309` | el comodín del desempate | «la **1** sobre una fila `ABANDONED` o ya `ACTIVE`, y las condiciones **2**, **3** y **4** enteras» |
| `B/05-idempotencia-y-concurrencia.md:122` | `C2` cuenta cuatro bajas y no `S26` | «eso vale para `S11` y no para las otras tres» |

**Qué haría falta decidir o escribir.** Si el §3 corre sobre una `CANCEL_SCHEDULED` (y sobre
`PAUSED`, `PENDING_AUTHORIZATION` y `CHARGE_DECLINED`, que su condición 1 tampoco nombra), y qué
recálculo de fin de servicio vale sobre una fila de `S26`: la extensión tiene que ser un
`max` con la fecha vigente, no una reescritura. Es una línea en `S11`/`S26` y una fila más en la
tabla de desempate.

### F-8V1B2-003 — El mismo cobro tardío sale como «hay que devolver» o como «sólo falta asentarlo» según quién lo vea primero

**Qué se rompe.** Un cobro aprobado que entra sobre una fila ya terminal —la baja de `S24`, por
ejemplo, cuya cancelación en el proveedor todavía no se confirmó— es, por el `B/05` §3 y su
desempate, un `COBRO_POSTERIOR_A_LA_BAJA` con **SÍ** en la última columna. Pero si el aviso se
pierde y lo ve primero el barrido, `C6` manda abrir `COBRO_SIN_REGISTRAR`, cuyo default es
**no hay nada que devolver: asentarlo**. El barrido sí recorre esas terminales (las salvedades
del `B/09` §3 las devuelven al recorrido justamente mientras la cancelación no se confirma), y la
comparación de cobros del período corre sobre ellas sin mirar el estado de la fila. La persona
que sigue el default asienta el cobro con `P1`: escribe `covered_period` y emite comprobante
sobre una fila `CANCELLED`, y la plata se queda.

**El camino.**

1. Juan está en `GRACE_PERIOD` y pide la baja: `S24` lo lleva a `CANCELLED` y corta el servicio
   en el acto. La cancelación en el proveedor falla de forma transitoria; el barrido la reintenta.
2. Antes de que se confirme, el reintento del proveedor sobre la cuota cobra.
3. El aviso del cobro se pierde (`WH-5`: el proveedor abandona reintentos de estados
   intermedios).
4. El barrido del día siguiente ve un registro `approved` sin fila de `payment` y abre
   `COBRO_SIN_REGISTRAR`. El listado le propone a la operadora asentarlo, no devolverlo. Juan
   pagó un mes sin servicio y la bandeja dice que no se le debe nada.

**La evidencia.**

| dónde | qué muestra | cita |
|---|---|---|
| `B/05-idempotencia-y-concurrencia.md:241` |  | «Y si el cobro aprobado lo ve primero el barrido y no un evento» |
| `B/05-idempotencia-y-concurrencia.md:242` |  | «escribe él: abre la marca `COBRO_SIN_REGISTRAR` (`B/02` §2.5, `B/09` §3)» |
| `B/02-modelo-de-datos.md:983` | el default del 19 | «la plata entró bien y lo que falta es asentarla. Con eso la última columna» |
| `B/09-conciliacion.md:115` | el recorrido incluye terminales | «que no esté en un estado terminal, **más las terminales que las cuatro» |
| `B/09-conciliacion.md:123` | la comparación no mira el estado de la fila | «ve un registro con `payment.status` = `approved` que nosotros no tenemos acreditado» |
| `B/05-idempotencia-y-concurrencia.md:307` | por el evento, el mismo hecho sobre `S24` es el motivo 2 | «`S11`/`S12`, `S17`, `S21`, `S22`, `S23`, `S24`, `S25`, `S27`, `S31` o el espejo» |
| `MATRIZ:269` |  | «el proveedor abandona el reintento de un estado intermedio en cuanto emite uno más nuevo del mismo recurso» |

**Qué haría falta decidir o escribir.** Que el motivo 19 aplique sólo sobre una fila que puede
recibir el cobro, y que sobre una terminal el barrido derive al motivo que el desempate del §3
asigna. Es la misma regla de desempate, extendida al segundo productor.

## MEDIA

### F-8V1B2-004 — `S6` escribe después de la llamada, y el aviso de su propia cancelación lo gana por el espejo

**Qué se rompe.** En `S6` la transición se escribe **después** de que el proveedor confirma la
cancelación. Esa cancelación genera un evento del preapproval (el `version` avanza con cada
acción), y si el handler lo procesa antes de que `S6` confirme su escritura —o si el proceso de
`S6` muere entre la llamada y la escritura— la relectura ve `cancelled` contra una fila todavía
en `GRACE_PERIOD` o `ACTIVE`, y el §10.1 manda **espejar la baja decidida por el proveedor**:
`CANCELLED`. `S6` después choca con la versión, reevalúa, y desde `CANCELLED` ya no corresponde.
El par tiene excepciones escritas para `S16` y para la sucesora de 3c; para `S6`, no.

**El camino.**

1. Se agota el grace de Juan (tarjeta). `S6` manda el correo, cancela el preapproval, y antes de
   escribir `SUSPENDED` el contenedor se reinicia (despliegue con dos contenedores,
   `DEC-CONC-001`).
2. Llega el aviso de la cancelación; el handler relee `cancelled` contra `GRACE_PERIOD` y
   espeja: `CANCELLED`, sin el correo de suspensión con *«volvé a suscribirte»*.
3. Si el `S6` era por contracargo sobre la predecesora de una sucesión, la cosa empeora: el
   espejo dispara `S18`, que cierra la sucesión, y `S31` —cuyo evento es `S6`— nunca corre. La
   sucesora de Juan queda `ACTIVE`, contra lo que el 📌 de `DEC-SUB-020` decidió.

**La evidencia.**

| dónde | qué muestra | cita |
|---|---|---|
| `B/03-maquinas-de-estado.md:346` |  | «la transición se escribe después de la llamada (precisión 2), así que el» |
| `B/03-maquinas-de-estado.md:2694` | el par | «si hay una baja programada; si no, **espejar la baja decidida por el proveedor**» |
| `B/03-maquinas-de-estado.md:2694` | la única excepción de `ACTIVE` | «salvo sobre una fila `ACTIVE` sin ningún pago acreditado cuyo primer cobro figura rechazado» |
| `B/03-maquinas-de-estado.md:2749` |  | «transición contra la tabla. Si la transición ya no corresponde, no se ejecuta.» |
| `MATRIZ:316` |  | «el mismo preapproval llegó con `version` 4, 6, 7, 8 en el orden causal de las acciones» |

**Qué haría falta decidir o escribir.** Que el par `cancelled` × fila viva ceda el paso a una
transición nuestra que ya mandó esa cancelación (lo que ya se hizo para `S16`), o que `S6` deje
una huella persistida antes de la llamada que el espejo lea. Mueve estado y correo, no plata,
salvo por el caso de la sucesión.

### F-8V1B2-005 — Un pago de monto distinto sobre la predecesora de una sucesión en curso tiene dos filas

**Qué se rompe.** `S19` retiene **todo** pago del período impago que entra a la predecesora de
una sucesión en curso, sin marca, porque *«es un caso diseñado»*. El `B/05` §3 exime de la marca
sólo la falla de la condición 3 por la sucesora; si falla la 2 (monto) o la 4 (período ya
pagado), manda la marca `PAGO_TARDÍO_RECHAZADO`. El par `(GRACE_PERIOD predecesora, entra un
pago con otro monto)` tiene entonces dos filas: retener sin marca, o marcar. Y el mismo § dice
que marcar esa fila **rompe cosas** porque una fila marcada no puede ser sucedida y ya hay un
`sucede_a` apuntándola; el `B/02` lo escribe como invariante. Ninguna regla dice qué pasa con una
sucesión en curso cuando a su predecesora se le abre una marca por cualquier otra vía
(`COBRO_DUPLICADO` desde `P1`, `DIVERGENCIA_DE_MONTO`, `TRANSICIÓN_NO_DECLARADA`).

**El camino.**

1. Juan, `ACTIVE`, declara un cambio de plan; en la ventana le falla la renovación y entra en el
   grace (fila 11 del recorrido de la predecesora).
2. Entra la cuota reciclada con un monto viejo (un aumento no propagado).
3. Implementador A corre `S19`: retiene sin marca y la sucesión sigue. Implementador B corre el
   §3: marca `PAGO_TARDÍO_RECHAZADO`; si además hace cumplir el invariante del `B/02`, o rechaza
   el alta de la marca —el pago queda sin fila que lo nombre— o tiene que matar la sucesión.

**La evidencia.**

| dónde | qué muestra | cita |
|---|---|---|
| `B/03-maquinas-de-estado.md:161` | `S19` | «es un caso diseñado y no una divergencia, así que `S14` no aplica» |
| `B/05-idempotencia-y-concurrencia.md:329` |  | «Con una excepción, y es la única: la condición 3 falla porque la otra fila viva es la sucesora de» |
| `B/05-idempotencia-y-concurrencia.md:334` |  | «como un incidente — y además rompería cosas: una fila marcada» |
| `B/05-idempotencia-y-concurrencia.md:335` |  | «(`B/03` §3.3) y acá ya hay un `sucede_a` apuntándola.» |
| `B/02-modelo-de-datos.md:241` |  | «o sea que esa fila no puede ser sucedida. Cancelar y recrear con una divergencia» |

**Qué haría falta decidir o escribir.** Si la regla de la marca vale sólo al declarar (`S1`) o
como invariante, y en el segundo caso qué le pasa a la sucesión; y cuál de `S19` y el §3 gana
cuando fallan la 2 o la 4. Es decisión de diseño con un solo implementador leyendo mal.

### F-8V1B2-006 — `S31` corre por evento y `S17` por estado: si gana `S17`, la sucesora del contracargo sobrevive

**Qué se rompe.** `S31` corta a la sucesora cuando su predecesora «se corta por un contracargo»:
su disparador es **el evento** de `S6` (tercero) o de `S12` (segundo), no una condición que se
vuelva a evaluar. `S17` es lo contrario: su condición es sobre un estado y se reevalúa en cada
corrida, y su `desde` incluye `SUSPENDED`. Si la sucesora ya autorizó, entre el commit de `S6` y
la ejecución de `S31` puede correr `S17` (cancela a la predecesora `SUSPENDED`), después `S18`
limpia `sucede_a`, y `S31` busca a la sucesora por un puntero que ya no está. La fila `S12` se
ocupa del orden contra `S18`; contra `S17`, nadie.

**El camino.**

1. Juan, `ACTIVE`, cambia de plan y autoriza el checkout: `S2` pone la sucesora en `ACTIVE`;
   `S17` todavía no confirmó (su correo reintenta).
2. Llega el contracargo de un pago viejo: `S6` por el tercer evento lleva la predecesora a
   `SUSPENDED`.
3. Antes de que corra `S31`, la corrida de `S17` encuentra predecesora viva y sucesora viva: la
   cancela, y `S18` cierra la sucesión.
4. `S31` no encuentra a quién cortar. Juan desconoció un cargo y conserva un plan nuevo `ACTIVE`.

**La evidencia.**

| dónde | qué muestra | cita |
|---|---|---|
| `B/03-maquinas-de-estado.md:173` | el evento de `S31` | «su predecesora se corta por un contracargo» |
| `B/03-maquinas-de-estado.md:159` | `S17` | «y su condición, que es sobre un estado, se vuelve a evaluar» |
| `B/03-maquinas-de-estado.md:159` | el `desde` de `S17` | «las cinco alcanzables: `ACTIVE`, `GRACE_PERIOD`, `CANCEL_SCHEDULED`, `PAUSED`, `SUSPENDED`» |
| `B/03-maquinas-de-estado.md:154` | el orden se escribió sólo contra `S18` | «encuentra a la sucesora por su `sucede_a`, que `S18` limpia, así que corre antes de que `S18` evalúe» |

**Qué haría falta decidir o escribir.** Que `S31` y `S6` (y `S12`) vayan en la misma
transacción, o que `S17` no corra sobre una predecesora con una marca `CONTRACARGO` abierta, o
que `S31` sea una condición reevaluable. La marca `CONTRACARGO` queda abierta y es detector, por
eso no la subo.

### F-8V1B2-007 — Reusar el `pending` que encuentra el barrido no exige que sea de esta fila

**Qué se rompe.** El barrido de creaciones sin respuesta busca **sólo por `payer_email`** y, si
encuentra un preapproval `pending` que no tenemos registrado, **lo reusa**. No pide que su
`external_reference` nombre la fila que quedó sin respuesta, ni que el monto coincida, ni dice
qué hacer si hay dos. La re-vinculación por webhook del mismo capítulo sí tiene esa precondición,
y se escribió justamente porque sin ella un preapproval ajeno se imputaba *«al candidato
plausible»*. Una persona puede tener a la vez varias creaciones sin respuesta de su mismo correo
—una principal y la suscripción de complemento de un addon recurrente, o dos verticales—, y el
proveedor acepta la misma clave con montos distintos.

**El camino.**

1. Juan contrata su plan de alojamiento y, en la misma sesión, un addon recurrente. Las dos
   creaciones en `/preapproval` quedan sin respuesta; las dos filas guardaron su clave y no tienen
   id del proveedor.
2. El barrido corre para la fila del plan y trae dos `pending` del correo de Juan. Toma el del
   addon.
3. Juan autoriza el checkout que le mostramos y el plan queda cobrando el monto del addon. Lo
   detecta la comparación de monto del barrido, pero después del primer cobro.

**La evidencia.**

| dónde | qué muestra | cita |
|---|---|---|
| `B/09-conciliacion.md:803` |  | «Busca filtrando en el proveedor SÓLO por `payer_email`» |
| `B/09-conciliacion.md:803` |  | «Si encuentra un preapproval `pending`, se reusa en vez de crear otro» |
| `B/09-conciliacion.md:72` | la otra vía sí lo exige | «se re-vincula sólo si el `external_reference` del preapproval nombra una fila nuestra que no» |
| `MATRIZ:331` |  | «(c) misma clave con **monto distinto** → un tercer `201` con el monto nuevo» |

**Qué haría falta decidir o escribir.** La misma precondición de §2.4 para el reuso (el
`external_reference` nombra esta fila), y qué hacer con un `pending` que no la cumple.

### F-8V1B2-008 — Qué pasa entre persistir la clave y llamar no está escrito para `/preapproval`

**Qué se rompe.** El `B/05` §1.1 exige acuñar y persistir la clave antes de la primera llamada, y
el §1.2 resuelve el timeout preguntándole al proveedor. Pero una fila con clave persistida y sin
id del proveedor tiene **tres** orígenes indistinguibles: el proceso murió antes de llamar, la
llamada salió y la respuesta se perdió, o la llamada todavía está en vuelo. Para `/preapproval`
la clave no hace nada, y la búsqueda vacía **no prueba** que no exista. Ni el §1 ni el `B/09` §7
dicen cuándo, tras una búsqueda vacía, se crea de nuevo: si es en la corrida siguiente (minutos),
una llamada en vuelo o no indexada todavía produce un segundo `pending` para la misma fila, que
nunca se registra y no vence nunca.

**El camino.**

1. La fila de Juan persiste su clave y llama. La respuesta tarda; el proceso corta por timeout.
2. El barrido de creaciones sin respuesta, minutos después, busca por el correo de Juan y no
   encuentra nada (el preapproval todavía no está indexado).
3. Si crea otro, Juan tiene dos `pending` con enlace; autoriza el que le mostramos y el otro
   queda vivo. Un enlace viejo reenviado autoriza un preapproval que no está en nuestro
   inventario: lo detecta recién su primer cobro, como huérfano.

**La evidencia.**

| dónde | qué muestra | cita |
|---|---|---|
| `B/05-idempotencia-y-concurrencia.md:46` |  | «Entonces: la clave se acuña y **se persiste antes de la primera llamada**, nunca al reintentar» |
| `B/05-idempotencia-y-concurrencia.md:65` |  | «se midió sobre el de estado—, así que **una búsqueda vacía no prueba que la suscripción no» |
| `B/03-maquinas-de-estado.md:2481` |  | «Un preapproval `pending` no vence (`EX-1`), así que sin esto el enlace viejo se podía autorizar más tarde» |
| `B/09-conciliacion.md:54` | la red es tardía | «Las huérfanas se detectan por webhook, no por barrido» |

**Qué haría falta decidir o escribir.** La regla de decisión tras una búsqueda vacía (cuántas
búsquedas o cuánto tiempo antes de volver a crear, o no volver a crear nunca y abandonar la
fila), y si se guarda algo del intento que distinga «nunca salió» de «salió».

## BAJA

### F-8V1B2-009 — `S6` sobre una fila `ACTIVE` remite a `S5`, que no sale de `ACTIVE`

**Qué se rompe.** Por el segundo evento `S6` corre sobre una fila todavía `ACTIVE`, y su guarda
dice que si la relectura muestra el cobro del período, `S6` no ocurre y **corre `S5`**. Pero el
`desde` de `S5` es sólo `GRACE_PERIOD`. El par queda sin transición y el cobro sin el asiento que
`S5` iba a hacer. Es de borde: exige un `paused` por mora con el período cobrado.

**El camino.** Juan está `ACTIVE`, la relectura ve `paused` y además un cobro aprobado del
período. `S6` no ocurre, `S5` no aplica, y la corrida siguiente repite lo mismo hasta que el
período cambie.

**La evidencia.**

| dónde | qué muestra | cita |
|---|---|---|
| `B/05-idempotencia-y-concurrencia.md:280` | `S5` sólo desde el grace | «entra `GRACE_PERIOD → ACTIVE` (`S5`) o `SUSPENDED → ACTIVE` (`S7`)» |
| `B/03-maquinas-de-estado.md:148` | la guarda de `S6` | «el webhook se perdió o llegó tarde: **`S6` no ocurre** y lo que corre es `S5`, con sus condiciones» |

**Qué haría falta decidir o escribir.** Una línea: sobre `ACTIVE` no hay grace que apagar, sólo
asentar el cobro por `P1`.

### F-8V1B2-010 — Dos filas del catálogo de marcas omiten a uno de sus escritores

**Qué se rompe.** La columna *«quién abre la marca»* de `B/02` §2.5 es la que `G-R1-F` cruza. El
motivo 8 nombra sólo a `S10` y a la quinta comprobación, pero `S33` también lo abre; el motivo 22
sí se actualizó para `S32`. El motivo 6 nombra la comparación de estado y la regla 1, y omite la
re-vinculación rechazada del `B/09` §2.4, que lo abre. Los conteos (doce de `S14`, diez de otros
actos) no se mueven porque `S33` abre por `S14`.

**El camino.** Juan tiene un addon pausado por `S32`; al reanudar, la relectura de `S33` sigue en
`paused` y se abre `REANUDACIÓN_NO_APLICADA` desde un escritor que la tabla no lista.

**La evidencia.**

| dónde | qué muestra | cita |
|---|---|---|
| `B/02-modelo-de-datos.md:926` |  | «`S14`, desde la rama de fallo de `S10`; **y la quinta comprobación** del `B/09` §3» |
| `B/03-maquinas-de-estado.md:175` |  | «**Si la relectura sigue viendo `paused`, `S33` no ocurre**: la fila se queda `PAUSED`» |
| `B/09-conciliacion.md:75` |  | «`TRANSICIÓN_NO_DECLARADA`** (`B/02` §2.5, motivo 6) y lo mira una persona» |

**Qué haría falta decidir o escribir.** Agregar `S33` al 8 y el `B/09` §2.4 al 6.

### F-8V1B2-011 — La lista de salidas del grace omite el espejo del proveedor

**Qué se rompe.** El §4 enumera las salidas de `GRACE_PERIOD` y no nombra el espejo de la baja
decidida por el proveedor, que desde el grace sigue ocurriendo (la tabla de la predecesora lo
dice, y el §10.1 le escribe incluso una excepción para la sucesora de 3c). El §5 sí lo nombra
entre las terminales de la pausa. Sin consecuencia de plata; es la misma omisión que ya se
corrigió en la pausa.

**El camino.** Juan está en el grace y cancela su tarjeta desde el panel del proveedor; el
espejo lo lleva a `CANCELLED`, una salida que el §4 no enumera.

**La evidencia.**

| dónde | qué muestra | cita |
|---|---|---|
| `B/03-maquinas-de-estado.md:1557` |  | «Sub-estado de Suscripción con reloj propio. Entra por `S4` y sale por `S5`, por `S6` o por» |
| `B/03-maquinas-de-estado.md:378` |  | «**Desde `GRACE_PERIOD` sigue ocurriendo**, pero ya como salida de un estado alcanzable» |

**Qué haría falta decidir o escribir.** Agregar el espejo a la enumeración del §4.

## Ataques que intenté y el diseño resistió

- **Conteos cerrados.** `S1`–`S35` son 35 filas; los 22 motivos de `B/02` §2.5 cierran, con 12
  de `S14` y 10 de otros actos, y 7 con SÍ; las 14 acciones de `N/08` §3 cierran; las 10
  máquinas cierran; los 6 hechos del reloj cierran; las 15 filas que cancelan en el proveedor,
  las 13 de la salvedad 4, las 9 salidas de la predecesora, las 14 filas del §10.1 y las 10
  salidas del dominio de `MP3` cierran contra sus listas.
- **Webhook duplicado.** El descarte por `version` antes de releer más `UNIQUE(proveedor,
  id_del_hecho)` más la relectura de la fila existente en `C6` cubren el duplicado a 0,5 s de
  `WH-1` y el reintento aprobado dentro del mismo registro.
- **Evento fuera de orden sobre el preapproval.** Releer por id y escribir lo leído hace que el
  orden de llegada no importe; el `version` sólo ahorra relecturas.
- **Proceso que muere entre llamar y escribir, en las filas del barrido.** Las trece filas que
  llegan a su destino «pase lo que pase con la llamada» dejan el reintento a cargo del par del
  §10.1, con plazo de 3 días y marca.
- **Reembolso con timeout.** `RF-4` y `RF-6` hacen que la misma clave no reembolse dos veces, y
  un `2084` es un rechazo, no un timeout.
- **`C5`, pago manual contra pago del proveedor.** `covered_period` con su `UNIQUE` parcial
  cruza las dos tablas; el choque en `P1` va a `COBRO_DUPLICADO` en vez de perder el hecho.
- **Dos `S14` concurrentes con el mismo motivo.** El `UNIQUE` parcial rechaza la segunda marca y
  `S14` la enruta a la abierta; el problema está contra `S15`, no entre dos `S14`.

## Fuera de mi vector

- El saldo de cortesía que `S25` difiere en una vertical discontinuada no se re-emite nunca
  (`S1` exige `admiteAltas`): ya está declarado en `B/14` §4.6 como pregunta al owner.
- `N/01` §1.2 dice que el hecho 2 tiene cuatro ejecutores; no lo verifiqué, es de verticales.
- La guarda de `A1` (*«`ACTIVE` y cobrada»*) y la re-evaluación de la orfandad en `A2` merecen un
  revisor de addons: no encontré el hueco, pero no recorrí `B/16` §4.3 entero.

## Key Learnings

1. Cuando una marca y los pagos que cuelga viven en dos tablas, la guarda de `S15` y el colgado
   de `S14` son un write skew clásico: la concurrencia optimista por fila no lo ve.
2. Una misma plata tiene dos productores de marca (evento y barrido) con defaults opuestos; el
   desempate del `B/05` §3 se escribió para un productor solo.
3. La tabla de desempate y la condición 1 del §3 no clasifican `CANCEL_SCHEDULED`, `PAUSED`,
   `PENDING_AUTHORIZATION` ni `CHARGE_DECLINED`: cada estado nuevo que llega al corpus se lista
   en la prosa y no en esa tabla.
4. Toda transición que escribe después de su llamada al proveedor compite con el espejo de su
   propio aviso; el corpus lo resolvió para `S16` y no para `S6`.
5. Un disparador por evento (`S31`) y uno por estado (`S17`) sobre la misma sucesión no se
   ordenan solos; el orden escrito sólo cubre `S18`.
