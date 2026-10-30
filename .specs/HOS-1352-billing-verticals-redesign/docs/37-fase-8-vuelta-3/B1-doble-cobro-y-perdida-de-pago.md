---
title: "FASE 8 vuelta 3 · B1 — doble cobro y pérdida de pago"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 8
---

# FASE 8 vuelta 3 · B1 — doble cobro y pérdida de pago

Ataqué todo camino donde Juan paga dos veces, paga y no recibe, recibe sin pagar, o un pago que
entró se pierde. Recorrí la tabla de transiciones de la suscripción, del pago, del reembolso, del
pago manual y del addon (`B/03` §3.2, §3.4, §6, §6.1, §7, §8 y §10), el candado y los cruces
(`B/05`), el contrato con el proveedor (`B/06`), la conciliación (`B/09` §2.4, §3 y §4), la
suscripción (`B/12`), los addons (`B/16` §1.4 y §2), el modelo de dinero (`B/02` §2.2 y §2.3), la
migración y la lápida (`B/21` §2.4 y §2.5), lo legal (`B/22` §2.2) y el orden del corte
(`16-fase-7…` §4.2), contrastando cada supuesto sobre Mercado Pago contra
`06-mp-validation-matrix.md`. Medí contra el HEAD `923b23586b` del worktree
`hospeda-spec-hos-1352-billing-redesign`.

Son **7 hallazgos**: **0 CRITICA, 4 ALTA, 2 MEDIA y 1 BAJA**. La idea más grave: el reenvío de
la orden del addon de única vez descansa en `EX-43`, que sigue `UNKNOWN`, y el diseño lo trata
como seguro por `EX-41`; según qué conteste el proveedor, Juan paga una orden que nadie ve o le
cobran 72 horas después una compra que ya había rehecho. En paralelo, el addon recurrente no tiene
ningún candado contra el doble clic, y el reembolso cita a `RF-6` diciendo lo contrario de lo que
`RF-6` midió.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

Ninguno.

## ALTA

### F-8V3B1-001 — La orden de única vez pagada con la respuesta perdida puede quedar sin detector

**Qué se rompe.** Si la respuesta de la orden se pierde, la instancia queda sin id de orden. `A3`
la reenvía horas después "con la misma clave y el mismo cuerpo" y reparte el resultado en tres
ramas: vuelve pagada, vuelve sin pago, o no hay respuesta. Pero un reenvío horas después, con el
token de la tarjeta ya vencido, puede volver con **un error** que no es ninguna de las tres, y eso
es exactamente lo que `EX-43` pregunta y no midió. Si el implementador lee ese error como
"sin pago aprobado", `A3` abandona la instancia **sin id de orden**, y la comprobación de órdenes
pagadas del barrido sólo mira instancias "con el id de su orden guardado". La plata de Juan entró
y nadie la ve. El diseño declara que ese caso "cae en la comprobación de órdenes pagadas", y en
este camino la comprobación no tiene con qué mirar. Si en cambio lo lee como "sin respuesta", `A3`
no ocurre nunca y la instancia queda en `PENDING_AUTHORIZATION` para siempre, reintentando el mismo
error cada día.

**El camino.**

1. Juan compra un destaque de única vez. `A1` persiste el pedido y la clave, y manda la orden.
2. Mercado Pago crea la orden y la cobra (`processed/accredited`), pero la respuesta se pierde por
   un timeout. La instancia queda en `PENDING_AUTHORIZATION`, con clave y sin id de orden.
3. Juan cierra la pestaña. Nadie reenvía durante la ventana: el segundo pedido sólo existe si
   vuelve con el mismo identificador.
4. A las 72 h corre `A3`: reenvía la orden con la misma clave y el mismo cuerpo, y el token de la
   tarjeta ya no sirve.
5. El proveedor contesta con un error y sin la orden (`EX-43`, sin medir).
6. `A3` lee "no vuelve con pago aprobado" y abandona. La instancia queda `ABANDONED` sin id.
7. El barrido recorre las `ABANDONED` "con el id de su orden guardado". Ésta no entra. Juan pagó,
   no recibió el destaque, y no existe ninguna marca que proponga devolverle la plata.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:120`
  — "si la respuesta de la orden se perdió, la instancia queda en `PENDING_AUTHORIZATION` con su clave y sin id de orden"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2526`
  — "Si la orden vuelve con el pago aprobado, `A3` no ocurre y corre `A2`; si vuelve sin un pago aprobado, `A3` ocurre"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:778`
  — "Por cada instancia de addon `UNA_VEZ` en `ABANDONED` con el id"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:790`
  — "así que toda `ABANDONED` tiene el id de su"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/06-proveedor.md:444`
  — "Si devuelve error con la orden existente, `A3` no la ve pagada y el caso cae en la comprobación de órdenes pagadas"
- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:400`
  — "devuelve la misma orden si existía, y qué devuelve si nunca se creó?"

La afirmación "toda `ABANDONED` tiene el id de su orden o no llegó a mandar ninguna" deja afuera un
tercer caso: la mandó, se perdió la respuesta y el reenvío devolvió un error. La declaración de
"no bloquea" de `EX-43` descansa en un detector que en ese caso no tiene sujeto.

**Qué haría falta decidir o escribir.** Cómo lee `A3` una respuesta de error del reenvío (ni orden
pagada, ni orden sin pago, ni silencio), y cómo encuentra el barrido una orden cuyo id nunca se
guardó. Mientras `EX-43` siga `UNKNOWN`, ¿puede una instancia `UNA_VEZ` sin id de orden llegar a
`ABANDONED`?

### F-8V3B1-002 — `A3` puede crear y cobrar la orden 72 horas después sobre una compra que Juan ya rehízo

**Qué se rompe.** El barrido tiene prohibido reenviar una orden, y el diseño da la razón: reenviar
con la clave "puede crear la orden si nunca existió". `A3` hace justamente eso al vencer la
ventana. Si el primer pedido nunca llegó al proveedor, el reenvío de `A3` **crea** la orden y la
cobra 72 horas después, y la instancia pasa a `ACTIVE` por `A2`. Mientras tanto, la pantalla de
compra acuña un identificador nuevo cada vez que se abre, así que el Juan que recargó la página
después del error ya compró de nuevo con otro pedido, otra instancia y otra clave. Resultado: dos
cobros por una sola compra que Juan quiso hacer, y el segundo llega tres días después, sin aviso.
Que el token de la tarjeta todavía cobre horas después es justamente lo que `EX-43` no midió; el
diseño no puede contar con que el vencimiento del token lo salve.

**El camino.**

1. Juan compra "+5 fichas" de única vez. `A1` persiste el pedido P1 y su clave, y manda la orden.
2. La conexión se cae antes de que el pedido llegue al proveedor. La instancia queda en
   `PENDING_AUTHORIZATION` sin id de orden. Juan ve un error.
3. Juan recarga la pantalla de compra. Se acuña un pedido P2, `A1` crea otra instancia con otra
   clave, la orden entra y se cobra. Juan tiene sus "+5 fichas".
4. A las 72 h corre `A3` sobre la instancia de P1: reenvía la orden con la clave y el cuerpo de P1.
5. Mercado Pago no la tenía, así que la crea y la cobra (si el token todavía sirve, que es lo que
   `EX-43` no midió).
6. `A3` ve la orden pagada, no ocurre, y corre `A2`: la instancia de P1 pasa a `ACTIVE`.
7. Juan pagó dos veces "+5 fichas" y se entera por el resumen de la tarjeta.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2526`
  — "`A3` reenvía la orden con la misma clave y el mismo cuerpo antes de abandonar"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:787`
  — "reenviar con la clave puede crear la orden si nunca"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:101`
  — "La pantalla de compra acuña un identificador de pedido al abrirse"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:104`
  — "una recompra es otro pedido, con otro identificador"
- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:400`
  — "devuelve la misma orden si existía, y qué devuelve si nunca se creó?"

`EX-41` midió el reenvío **inmediato** con la misma clave; lo que `A3` hace a las 72 horas es
`EX-43`, `UNKNOWN`, y el diseño lo usa como si fuera `EX-41`.

**Qué haría falta decidir o escribir.** Si `A3` puede crear una orden que nunca existió, o si
sólo puede confirmar una que existía; y qué pasa con la instancia vieja cuando la persona ya
completó la misma compra por otro pedido. La pregunta de fondo es si el reenvío tardío de `A3`
tiene que esperar a que `EX-43` se mida.

### F-8V3B1-003 — El addon recurrente no tiene candado contra el doble clic, y los dos checkouts quedan a la vista

**Qué se rompe.** El doble clic tiene defensa sólo en el addon de única vez: el identificador del
pedido y su `UNIQUE`. El addon recurrente usa la máquina de la suscripción "sin tope propio", y
los dos candados de la base (`A` y `B`) están escritos sobre `clase = principal`. El proveedor no
deduplica la creación (`EX-17`) y deja convivir dos autorizaciones del mismo pagador (`EX-6`). Un
doble clic en "contratar" crea dos instancias, dos filas de complemento y dos preapprovals
`pending`. La persona completa uno; el otro queda en "esperando que completes el pago, con el
enlace para retomar". Si lo completa, pensando que la compra no había entrado, paga el mismo addon
dos veces por mes, sobre el mismo objetivo, hasta que alguien lo note.

**El camino.**

1. Juan, con su plan `ACTIVE` y pagando, hace doble clic en "contratar destaque mensual" para su
   ficha.
2. Llegan dos pedidos. `A1` corre dos veces: dos instancias, dos filas de complemento, dos
   preapprovals `pending`. Ninguna restricción los frena.
3. El navegador sigue la segunda respuesta; Juan autoriza ese checkout. El proveedor cobra.
4. En Mi Suscripción ve la primera instancia en "esperando que completes el pago", con su enlace.
5. Juan cree que su compra no terminó y entra al enlace. Autoriza la segunda.
6. Mercado Pago cobra las dos cada mes (`EX-6`). Ningún `UNIQUE` de covered_period las cruza:
   cada una es su propia suscripción, con su propio período.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:25`
  — "complemento —una por addon recurrente, `DEC-ADDON-002`— usan esta misma máquina, sin tope"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:156`
  — "-- A · el compromiso: a lo sumo UNA fila principal de origen viva por user + vertical"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2524`
  — "Y el addon `UNA_VEZ` nace con el identificador del pedido del cliente"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1564`
  — "pago», con el enlace para retomar y la fecha en que vence."
- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:322`
  — "Dos autorizadas del mismo pagador conviven sin conflicto."
- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:332`
  — "Consecuencia: el candado es nuestro o no existe, y tiene que estar ANTES de llamar al proveedor."

**Qué haría falta decidir o escribir.** Qué impide un segundo complemento vivo del mismo producto
sobre el mismo objetivo (una restricción, el identificador de pedido extendido al recurrente, u
otra cosa), y qué ve la persona cuando tiene una instancia pendiente y otra activa del mismo addon.

### F-8V3B1-004 — El reembolso reenviado no devuelve el id, y el arreglo del motivo 18 depende de ese id

**Qué se rompe.** `RF2` dice que una llamada de devolución sin respuesta se reenvía con la misma
clave "y vuelve la misma devolución con su id", y cita `RF-6`. `RF-6` midió lo contrario: la
repetición devuelve `200` con cuerpo vacío y **no** devuelve el refund original, y `B/06` §4.6 lo
repite como trampa para quien implemente. Todo el arreglo que ata una fila de `refund` a sus
devoluciones descansa en guardar ese id: `RF3` corre sólo cuando la relectura muestra las
devoluciones "que nombran sus ids", y el barrido manda al motivo 18 toda devolución cuyo id no
está en ninguna fila. En el caso exacto del timeout, la fila nunca aprende su id: `RF3` no ocurre
nunca, la devolución hecha por nuestro flujo aparece como "fuera del flujo", y una persona la
asienta por `RF4`. Es el defecto que el propio `B/09` dice haber cerrado. Y quien implemente `RF2`
al pie de la letra espera un id en la respuesta del reenvío y trata el cuerpo vacío como fallo;
si reintenta con una clave nueva sobre un parcial con saldo, el proveedor devuelve dos veces.

**El camino.**

1. Juan revoca dentro de los 10 días; `S36` crea `RF1` y una persona lo confirma por `RF2`.
2. `RF2` manda `POST /v1/payments/{id}/refunds` con su clave. El proveedor devuelve, y la
   respuesta se pierde.
3. `RF2` reenvía con la misma clave y el mismo cuerpo: `200`, cuerpo vacío, ningún id (`RF-6`).
4. La fila queda en `CONFIRMED` sin id de devolución. `RF3` exige ver las devoluciones "que
   nombran sus ids": no ocurre.
5. El barrido relee el pago, ve una devolución cuyo id no está en ninguna fila y abre el motivo 18.
6. Una persona asienta un `RF4` por el mismo monto; la fila `CONFIRMED` sigue esperando para
   siempre. Si en cambio el implementador trató el cuerpo vacío como fallo y reintentó con otra
   clave sobre un parcial, Juan recibe la devolución dos veces.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1844`
  — "Una llamada sin respuesta se reenvía con la misma clave y el mismo cuerpo, y vuelve la misma devolución con su id"
- `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:313`
  — "y no devuelve el refund original en el cuerpo, así que hay que tenerlo guardado"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/06-proveedor.md:235`
  — "sólo acepte `201` lo lee como fallo; y el cuerpo vacío no trae el refund original, así que"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1845`
  — "la relectura por id del pago muestra acreditadas las devoluciones de ESTA fila —las que nombran sus ids— y suman el monto confirmado"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:770`
  — "Sin esto, la devolución hecha por nuestro flujo cuyo aviso se perdía terminaba en el motivo 18,"

**Qué haría falta decidir o escribir.** De dónde saca la fila el id de una devolución cuya
respuesta se perdió, si el reenvío no lo trae (`RF-6`); y cómo distingue el barrido esa devolución
de una hecha desde el panel mientras la fila no lo tenga.

## MEDIA

### F-8V3B1-005 — La transferencia del pagador manual que no se puede imputar no tiene dónde asentarse ni cómo devolverse

**Qué se rompe.** El pagador manual tiene **una** cuota por período (`MP5` no crea una segunda) y
esa cuota no guarda monto. La transferencia que no cae en una cuota abierta no tiene fila: la
segunda transferencia del mismo mes, la que llega de más, o la que llega tarde sobre una
suscripción ya `CANCELLED` ("el pago que llegue no reabre nada"). `C5` dice que el registro manual
que llega segundo "falla". Y la devolución tampoco tiene cómo asentarse, porque `RF1` y `RF4` nacen
colgados de un `payment` o de un `manual_payment`, y esa plata no tiene ninguno. Con tarjeta el
mismo hecho existe (`COBRO_DUPLICADO`, `COBRO_POSTERIOR_A_LA_BAJA`, con el pago colgado); con
transferencia el diseño no tiene fila, ni marca, ni devolución registrable. Lo pongo en MEDIA y no
en ALTA porque el admin tiene la plata a la vista y puede devolverla por fuera; lo que falta es el
rastro, y dos implementadores lo resolverían distinto.

**El camino.**

1. Juan, Partner con pago manual, transfiere la cuota de octubre. El admin la registra por `MP1`.
2. Días después, Juan transfiere otra vez por error (o su contador repite la orden).
3. El admin quiere registrarla: no hay cuota `AWAITING` para octubre, y `MP5` no abre otra.
   Registrarla contra octubre choca con el candado de covered_period.
4. No existe marca para "transferencia que no se pudo imputar", ni `refund` posible sin un pago del
   que colgar.
5. La plata queda en la cuenta de Hospeda sin ninguna fila que la nombre. Si alguien la devuelve
   por fuera, tampoco hay cómo asentarlo.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:224`
  — "registro manual que llega segundo falla, no compite."
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1868`
  — "Idempotente por condición: no crea si ya existe una fila de `manual_payment` para ese período"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1962`
  — "A partir de ahí el pago que llegue no reabre nada y lo que corresponde es un alta nueva."
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1843`
  — "nace con el pago que se devuelve —un `payment` o un `manual_payment`—, monto y motivo"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:376`
  — "El monto no se guarda: es el esperado para ese período"

El silencio, buscado así (sin resultados):

```text
rg -n -i "dos transferencias|transfiere dos|transferencia duplicada|pago manual duplicado|
  segunda transferencia|transfirió de más|de más.*transfer|transfer.*de más"
  .specs/HOS-1354-billing-cobro-y-proveedor
  .specs/HOS-1352-billing-verticals-redesign/docs/nucleo
```

**Qué haría falta decidir o escribir.** Dónde se asienta una transferencia que no cae en una
cuota abierta, qué marca la pone delante de una persona, y de qué cuelga su devolución.

### F-8V3B1-006 — La revocación devuelve el plan y los addons recurrentes, y se queda con el de única vez

**Qué se rompe.** `B/22` §2.2 extendió la revocación a los addons recurrentes con la razón de que
"son parte del mismo contrato". El addon de única vez comprado en la misma ventana queda afuera sin
que nadie lo decida: `S36` crea `RF1` sobre el último pago de la suscripción, y `S21` devuelve el
último cobro de un complemento, pero `S21` sólo alcanza a filas **de complemento**, y un `UNA_VEZ`
no tiene ninguna. Su instancia muere por la orfandad y su pago queda sin marca y sin propuesta. El
§ legal parte de "devolución de lo pagado".

**El camino.**

1. Juan se suscribe el día 1 y el día 2 compra "+5 fichas" de única vez, por `/v1/orders`.
2. El día 5 pide revocar por correo. Una persona la registra: corre `S36`.
3. `S36` devuelve por `RF1` el último pago de la suscripción, y la orfandad corre sobre los
   complementos recurrentes, que se devuelven por `RF1` dentro de sus 10 días.
4. La instancia de "+5 fichas" muere por la orfandad. No tiene fila de complemento, así que `S21`
   no la toma y no se abre `RF1` ni marca.
5. Juan recibe todo menos lo que pagó por "+5 fichas", tres días antes.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/22-lo-legal.md:123`
  — "Y los addons recurrentes son parte del mismo contrato: `S36` saca a la"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/22-lo-legal.md:97`
  — "pide *«derecho de revocación dentro de un plazo legal, sin costo ni justificación,"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:171`
  — "| S21 | toda fila viva DE COMPLEMENTO —los seis estados de la suscripción— de la que cuelga una instancia de addon."

El silencio, buscado así (sin resultados que junten revocación y `UNA_VEZ`):

```text
rg -n -i "revoc" .specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md
  | rg -i "UNA_VEZ|única vez"
```

**Qué haría falta decidir o escribir.** Si la revocación alcanza al addon de única vez comprado en
la ventana, y si sí, qué acto crea su `RF1` y por qué endpoint se devuelve una orden de
`/v1/orders` (el contrato de devolución de `B/06` §4.6 está medido sobre `/v1/payments`).

## BAJA

### F-8V3B1-007 — `S11` y `S12` todavía mandan al motivo 15 por una discontinuación que ya no existe

**Qué se rompe.** Las verticales no se discontinúan desde C8, y `S26` salió. Pero `S11` sigue
diciendo que los complementos de `S26` abren el motivo 15, y `S12` que `S21` abre el 15 si la
vertical tiene una fila en `vertical_discontinuation`. El motivo 15 es el que propone **devolver**
y el 14 el que propone **no devolver**, así que el texto vencido toca plata: quien implemente `S12`
leído así construye una lectura de una tabla retirada que decide qué propuesta de devolución ve la
persona.

**El camino.**

1. Juan se da de baja por `S11`; su complemento queda en `CANCEL_SCHEDULED`.
2. Llega la fecha: `S12` corre y `S21` tiene que elegir entre el 14 y el 15.
3. El implementador sigue la frase de `S12`: consulta `vertical_discontinuation`.
4. Esa tabla no debería existir; si quedó en el esquema con una fila de prueba, Juan recibe la
   propuesta de devolver en vez de la de no devolver.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:161`
  — "Lo mismo con los complementos de `S26`, salvo que ahí la marca es el motivo 15 y no el 14"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:162`
  — "o el 15 si la vertical de la principal tiene una fila en `vertical_discontinuation`"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:176`
  — "retirada (revisión del owner, 2026-09-28, C8): las verticales no se discontinúan. El número no se reusa"

Del mismo tipo: `B/02` §2.3 todavía dice que el pago del addon de única vez "no admite una marca
de conciliación", cuando el motivo 23 cuelga justamente de su instancia.

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:442`
  — "no admite una marca de conciliación, porque `reconciliation_mark` cuelga de una suscripción"

**Qué haría falta decidir o escribir.** Tachar las dos frases de `S11` y `S12` y la de `B/02`
§2.3, como se hizo con el resto de C8.

## Ataques que intenté y el diseño resistió

- **Doble alta de la principal por reintento o doble clic**: el candado `A` incluye
  `PENDING_AUTHORIZATION`, y `B/03` §3.4 punto 4 reusa la vigente; la creación perdida se busca por
  `payer_email` sin filtro de estado y se reusa sólo si su `external_reference` nombra la fila
  (`B/05` §1.2).
- **Un pending viejo autorizado meses después**: `S3` lo cancela con relectura, y un cobro sobre la
  `ABANDONED` va a `COBRO_POSTERIOR_A_LA_BAJA` con propuesta de devolver (`B/05` §3).
- **El `payment` de validación de ARS 0 al cambiar la tarjeta (`EX-36`)**: `B/03` §10.2 lo excluye
  como cobro, como rechazo y como disparador de `S4` o `S16`.
- **El mismo `payment` por IPN y por Webhooks**: sólo se procesa el de Webhooks, y la
  deduplicación por id del hecho relee ante el choque (`B/05` C6).
- **Upgrade con dos cobros del mismo período**: `D8`, la ventana reducida y la relectura en el
  corte; el borde de dos minutos y la `S17` fallida están declarados (`B/12`, NO cierra).
- **Pago tardío que reactiva a la predecesora**: `S19` lo retiene y el cierre de la sucesión decide
  su destino con seis ramas y un acto cada una.
- **Cobro en vuelo sobre la lápida del corte**: decidido por el owner (`G3-1`, precisado por `R2`),
  con la ventana leída en la fecha del pago y el 1b atado a `EX-48`.
- **Orden rechazada leída como "no hay orden"**: `A7` cierra con el id que viene en el `402`,
  releyendo la orden (`EX-30`).
- **Cobro por debajo del esperado tras un aumento (`EX-47`)**: declarado como costo aceptado y
  listado en el resumen (`NUCLEO/08` §4.1).
- **Baja desde la cuenta de Mercado Pago**: detectada y espejada; la pérdida de los días pagados
  está aceptada por el owner (`EX-52`, `B/12` §1.4).

## Fuera de mi vector

- **El aumento de `DEC-MP-002` sigue sin fila en `B/03` §3.2**: el reintento cuenta "desde su
  fecha efectiva", pero ninguna transición dice cuándo se muta el monto (a diferencia de `S37`, que
  corre siete días antes para esquivar `EX-47`). Le toca al vector de máquinas y carreras.
- **El pago chico del 4b del corte sale por `POST /v1/payments`**: la matriz mide escritura sobre
  esa API con la cuenta real, pero la entrega por Webhooks de ese pago cae como recurso desconocido
  en una lápida de recepción con propuesta de devolver, además de la devolución que hace la
  herramienta. Le toca al vector del corte.

## Key Learnings

1. Un reenvío idempotente medido "en el acto" (`EX-41`) no responde por el mismo reenvío horas
   después (`EX-43`); cuando el diseño lo usa como seguro, aparecen dos daños opuestos según qué
   conteste el proveedor.
2. Un detector que exige un id guardado no ve justo el caso de la respuesta perdida, que es el que
   lo motivó.
3. La defensa contra el doble clic se escribió sobre la clase que la necesitaba primero (única vez)
   y dejó sin nada al addon recurrente, que comparte la máquina de la suscripción pero no sus
   candados.
4. Citar una fila de la matriz para lo que no midió es tan peligroso como usar una `UNKNOWN`:
   `RF-6` dice que el reenvío NO trae el refund, y el diseño construyó el cierre del motivo 18 sobre
   que sí.
5. El pagador manual comparte la máquina pero no tiene un lugar para la plata que no calza en una
   cuota: la simetría con los motivos de tarjeta se rompe en el asiento.
