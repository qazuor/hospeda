---
title: "FASE 8 vuelta 3 · B2 — máquinas, idempotencia y carreras"
linear: HOS-1352
statusSource: linear
created: 2026-09-30
updated: 2026-09-30
status: CURRENT
fase: 8
---

# FASE 8 vuelta 3 · B2 — máquinas, idempotencia y carreras

Recorrí las máquinas de billing de `B/03` (suscripción §3.2, pago §6, reembolso §6.1, pago manual
§7, instancia de addon §8 y la regla de no-retroceso §10), los seis cruces y el pago tardío de
`B/05`, la conciliación de `B/09` (comprobaciones que releen pagos, reembolsos y órdenes, y el
barrido de creaciones), la cola de `B/12` §5.4, el cobro de única vez de `B/16` §1.4, las
entidades de `B/02` (`covered_period`, `refund`, `addon_instance`, los motivos de §2.5), el
listado de `B/19` §6, el outbox de `NUCLEO/07` y el aviso del contrato (`12-contrato…` §3).
Recontré con script las filas de la tabla del §3.2 y la columna de plata de los motivos. Medí
contra `923b23586b`.

Son **4 hallazgos**: **0 CRITICA, 3 ALTA, 1 MEDIA y 0 BAJA**. La idea más grave: las tres
claves de idempotencia que el diseño cuida (la del pedido de addon, la del reembolso y la marca
que propone devolver) se apoyan en un dato que se pierde justo en el caso que vienen a cubrir, y en
los tres el resultado es plata cobrada o devuelta dos veces sin ningún detector.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

Ninguno.

## ALTA

### F-8V3B2-001 — Una orden de addon sin respuesta más una pantalla recargada cobran dos veces

**Qué se rompe.** La idempotencia del addon `UNA_VEZ` vive en el identificador del pedido, que la
pantalla acuña **al abrirse**. Cubre el doble clic y el reintento del navegador, que reusan la
misma pantalla. No cubre el caso que el propio §1.4 describe como recuperable: la respuesta de la
orden se pierde, la persona ve un error y **vuelve a abrir la pantalla**, que acuña otro
identificador. `A1` crea otra instancia (el único `UNIQUE` es el del pedido), con otra clave, y
el proveedor cobra otra orden. La primera instancia queda en `PENDING_AUTHORIZATION` con su orden
aprobada hasta que `A3`, al vencer la ventana, la reenvía, encuentra el pago y corre `A2`. Quedan
dos instancias `ACTIVE` sobre la misma ficha y dos cobros, y ninguna comprobación mira eso: la de
órdenes pagadas sólo lee instancias `ABANDONED`, y el pago de una instancia que llegó a `ACTIVE` no
se relee. Además, Juan pagó la primera y no la tuvo durante toda la ventana.

**El camino.**

1. Juan compra un destaque de 7 días para su ficha, con tarjeta. La pantalla acuña el pedido
   `P1`; `A1` crea la instancia `I1` y persiste la clave.
2. Hospeda manda `/v1/orders`; Mercado Pago aprueba y cobra. La respuesta se pierde (un
   contenedor que se recicla en un despliegue, un timeout). `I1` queda sin id de orden.
3. Juan ve un error. Recarga la página de compra y vuelve a tocar «comprar». La pantalla acuña
   `P2`, que no choca con `P1`: `A1` crea `I2` con otra clave.
4. Mercado Pago cobra la segunda orden. `I2` pasa a `ACTIVE` por `A2`.
5. A las 72 h, `A3` sobre `I1` reenvía la orden con la clave de `P1`; vuelve aprobada, así que
   `A3` no ocurre y corre `A2`: `I1` también queda `ACTIVE`.
6. Juan pagó dos destaques por la misma ficha y el mismo lapso. Ninguna marca se abre: ni `I1` ni
   `I2` están `ABANDONED`.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:101`
  — "La pantalla de compra acuña un identificador de pedido al abrirse"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:104`
  — "una recompra es otro pedido, con otro identificador"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:120`
  — "El segundo pedido que la encuentra así reenvía la orden con la misma clave y el mismo cuerpo"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:560`
  — "el doble clic trae el mismo identificador y encuentra la instancia que ya existe en vez de crear otra con otra orden"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2526`
  — "si el reenvío tampoco tiene respuesta, `A3` no ocurre en esa corrida"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:778`
  — "Por cada instancia de addon `UNA_VEZ` en `ABANDONED` con el id"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:1049`
  — "`ACTIVE` no se relee —un contracargo o un reembolso desde el panel sobre él no lo ve nadie—."

La cita de la línea 120 de `B/16` presupone que «el segundo pedido» es el mismo pedido (mismo
identificador), y sólo eso le permite encontrar `I1`. Nada dice qué hace la pantalla cuando se
reabre con una instancia del mismo producto y el mismo objetivo en `PENDING_AUTHORIZATION` sin id
de orden.

**Qué haría falta decidir o escribir.** Si una pantalla nueva debe encontrar la instancia viva sin
orden del mismo `(dueño, producto, objetivo)` y reenviarla en vez de acuñar otro pedido, o si la
recuperación de `I1` no debe esperar a la ventana de `A3`; y qué comprobación ve dos instancias
`ACTIVE` pagadas del mismo producto sobre el mismo objetivo.

### F-8V3B2-002 — Un pago contracargado sigue proponiéndose para devolver, y se devuelve dos veces

**Qué se rompe.** Los nueve motivos que proponen devolver son, casi por definición, cobros que el
cliente no esperaba, y un cobro inesperado es exactamente el que se desconoce ante el banco. Cuando
eso pasa, `P6` lleva el pago a `CHARGED_BACK` y abre la marca `CONTRACARGO`, cuya columna de plata
dice que el dinero ya volvió al cliente. Pero el mismo pago sigue colgado de la otra marca, que
propone devolver **todos** sus pagos, y `S15` no la deja levantar mientras a alguno le falte su
resolución. Ninguna fila de `refund` mira el estado del pago: `RF1` y `RF2` no lo leen, y el
diseño no escribe qué pasa con una devolución pedida o confirmada sobre un pago en `CHARGED_BACK`
(ni `RF3` tiene adónde llevarlo: `P3` y `P4` no salen de ese estado). Y en el orden inverso, un
contracargo sobre un pago que ya devolvimos no lo lee nadie: la comprobación sólo relee pagos
`SUCCEEDED` o `PARTIALLY_REFUNDED`.

**El camino.**

1. Juan se da de baja (`S11`). Un cobro de ARS 18.000 que estaba en vuelo entra después de la
   baja: `S14` abre `COBRO_POSTERIOR_A_LA_BAJA` con el pago colgado y el listado propone devolver.
2. Juan ve el cargo en el resumen y lo desconoce ante su banco ese mismo día.
3. El aviso de contracargo (o el barrido) relee el pago: `charged_back`. Corre `P6` y se abre
   `CONTRACARGO`.
4. Al día siguiente, la persona de soporte abre el listado. Adelante está la marca de la baja,
   con su default «devolver» y el pago colgado. Crea `RF1`, lo confirma (`RF2`) y Hospeda manda
   `POST /v1/payments/{id}/refunds`.
5. Si el proveedor acepta la devolución, Juan recibe los ARS 18.000 por el banco y otra vez por
   Hospeda. Si la disputa se pierde (`settled`), la plata sale dos veces.
6. Orden inverso: la devolución se ejecuta primero (`P3`, pago `REFUNDED`) y el banco igual
   procesa el desconocimiento. El barrido no relee pagos `REFUNDED`, así que nadie ve el segundo
   débito.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1009`
  — "confirmar el reembolso de un cobro que llegó después de cancelar"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:242`
  — "significa devolverlos todos; `S15` no la puede levantar mientras a alguno le falte su"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1765`
  — "Esté en el estado que esté la fila, `S14` abre la marca con motivo `CONTRACARGO`"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1843`
  — "No mueve el pago ni la suscripción"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1845`
  — "corre `P3` o `P4` sobre el pago, según el acumulado (§6)"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:715`
  — "Por cada `payment` en `SUCCEEDED` —o `PARTIALLY_REFUNDED`"

La columna de plata del motivo 17 dice textual *«la plata ya volvió al cliente por su banco»*
(`B/02` §2.5, fila 17), y nada la conecta con las otras marcas del mismo pago. El silencio lo
muestra esta búsqueda, que sólo devuelve definiciones de `CHARGED_BACK`, `P6`, `P7` y la tabla del
barrido, ninguna regla que frene o cancele un `refund`:

```text
rg -n "CHARGED_BACK" $B $D/nucleo | rg -i "refund|reembols|devol|RF[0-9]"
```

**Qué haría falta decidir o escribir.** Si `P6` cancela (`RF5`) los `refund` en `REQUESTED` o
`CONFIRMED` del pago y resuelve sin devolver su lugar en las otras marcas, o si `RF2` debe releer
el pago y negarse sobre `CHARGED_BACK`; y si la comprobación de pagos acreditados debe releer
también los `REFUNDED` de la ventana.

### F-8V3B2-003 — Una devolución sin respuesta no tiene quién la reenvíe, y el barrido la toma por ajena

**Qué se rompe.** `RF2` persiste la clave antes de llamar y guarda el id de la devolución **con
la respuesta**. Si la respuesta se pierde (o el proceso muere entre la llamada y la escritura), la
fila queda `CONFIRMED` con la clave y sin id. El texto dice que esa llamada «se reenvía» con la
misma clave, pero no dice quién ni cuándo: `RF2` es un acto de una persona, el barrido de `B/09`
sólo compara y no reenvía, y ninguna otra fila lo toma. Entonces el barrido relee el pago, ve una
devolución cuyo id no está en ninguna fila y la clasifica como hecha desde el panel (motivo 18).
La persona que la resuelve asienta un `RF4` por el mismo monto, que corre `P3` o `P4`. La fila
`CONFIRMED` sigue ahí: si alguien después hace el reenvío que el texto promete, vuelve la misma
devolución, `RF3` la suma otra vez al acumulado y choca con el `UNIQUE` del id que ya tomó el
`RF4`; y si la persona que ve la fila trabada «reintenta» como manda la regla de `2084` (parciales
con claves nuevas), sale una segunda devolución real. Es exactamente el doble asiento que `B/09`
dice haber cerrado guardando los ids, reabierto por el caso en que el id nunca llegó.

**El camino.**

1. Juan tiene una marca `COBRO_DUPLICADO` por ARS 18.000. Soporte confirma la devolución (`RF2`);
   la clave `K1` queda persistida.
2. Hospeda manda la devolución; Mercado Pago la ejecuta y devuelve el id `D1`, pero la respuesta
   se pierde. La fila sigue `CONFIRMED`, sin id.
3. Nadie reenvía `K1`. El barrido relee el pago y encuentra `D1`, que no nombra ninguna fila:
   abre `REEMBOLSO_FUERA_DEL_FLUJO`.
4. Otra persona resuelve esa marca con la acción 14: `RF4` asienta ARS 18.000 y corre `P3`.
5. La fila del paso 1 sigue `CONFIRMED` en la bandeja. Quien la mira ve una devolución confirmada
   que «no entró» y la reintenta con una clave nueva: Mercado Pago devuelve ARS 18.000 otra vez
   si queda saldo (un pago con más de un cobro devuelto, un parcial), o rechaza; en los dos casos
   el asiento de Hospeda ya no coincide con lo que pasó.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1844`
  — "Una llamada sin respuesta se reenvía con la misma clave y el mismo cuerpo"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:768`
  — "es la del panel, fuera del flujo: el motivo 18, como decía la fila de arriba."
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:771`
  — "la persona asentaba un `RF4` por el mismo monto y la fila `CONFIRMED` seguía esperando un `RF3`"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:48`
  — "proceso: en un despliegue conviven dos contenedores sirviendo tráfico (`DEC-CONC-001`)."

El silencio sobre quién reenvía: la única mención de un reenvío de devolución en las máquinas, la
conciliación y el proveedor es la propia celda de `RF2` (la de órdenes, `B/09` §3, dice que el
barrido **no** reenvía, y habla de `A3`):

```text
rg -n "reenv" $B/docs/03-maquinas-de-estado.md $B/docs/09-conciliacion.md $B/docs/06-proveedor.md \
  | rg -i "refund|devoluci|reembols"
```

**Qué haría falta decidir o escribir.** Quién hace el reenvío con la clave guardada de una fila
`CONFIRMED` sin id (y en qué plazo, antes de que el barrido la lea como ajena), y cómo clasifica el
barrido una devolución sin fila cuando existe una fila `CONFIRMED` del mismo pago con una llamada
sin respuesta.

## MEDIA

### F-8V3B2-004 — El espejo reconoce «nuestra cancelación perdida» por un correo que no prueba la llamada

**Qué se rompe.** Para distinguir la baja que dio el proveedor (o el cliente desde su cuenta, que
corta en el acto) de una cancelación de `S6` o `S3` que salió y perdió su escritura (que da el
período pagado por `CANCEL_SCHEDULED`), el espejo busca el correo «antes de cancelar» sobre la
fila. Pero en `S6` ese correo se encola en una transacción propia **anterior** a la relectura, así
que existe también cuando la relectura vio el pago y la llamada nunca salió; y sobre un
destinatario suprimido (rebote duro, cuenta borrada) la cancelación sale igual y no está escrito
que quede una fila de correo que el espejo pueda encontrar. Los dos errores van en direcciones
opuestas y dos implementadores los resuelven distinto.

**El camino.**

1. A Juan se le agota el grace. `S6` encola el «antes de cancelar» y el correo sale.
2. Antes de la llamada, Juan cambia la tarjeta; el cobro entra y `S5` lo lleva a `ACTIVE`. `S6`
   relee, no corresponde y no llama. El preapproval sigue vivo.
3. Meses después Juan cancela desde su cuenta de Mercado Pago. El espejo lee `cancelled` sobre
   `ACTIVE`, encuentra el correo del paso 1 y lo trata como cancelación nuestra perdida: le da
   `CANCEL_SCHEDULED` en vez de cortar, contra lo que el owner decidió para esa baja.
4. Al revés: si el correo de Juan tiene rebote duro, `S6` cancela sin correo; si `S5` gana la
   carrera y `S6` pierde la escritura, el espejo no encuentra correo y corta en el acto a quien
   acaba de pagar el período, que es el daño que `R18` vino a cerrar.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2761`
  — "el §10.3 les hizo releer y no escribieron, pero la llamada ya había salido."
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2761`
  — "sobre la fila (§3.2, precisión 3), que se encola antes de la llamada."
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2761`
  — "corta igual, por decisión del owner, con la pérdida de los días pagados aceptada"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:366`
  — "correo se encola en una transacción propia, anterior, y su ocurrencia es el hecho que la"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:310`
  — "no-entregable se registra y se escala a una persona, como ya manda ese §. Sin esta rama, la"
- `.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:161`
  — "| 1 | rebote duro | todo, incluso lo transaccional | la dirección no existe: no hay a quién mandarle |"

**Qué haría falta decidir o escribir.** Qué registro prueba que la llamada de cancelación salió
(la llamada misma, persistida antes de mandarla, y no el correo), y si el no-entregable suprimido
deja una fila que el espejo pueda leer. Es residuo de borde del arreglo `R18`: por eso MEDIA.

## BAJA

Ninguno.

## Ataques que intenté y el diseño resistió

- **El mismo id del hecho con otro estado (`C6`)**: el choque con el `UNIQUE` relee la fila y
  corre `P1` si pasó a `approved`; dos instancias paralelas se separan por la concurrencia
  optimista del §10.3 y la segunda encuentra `SUCCEEDED`.
- **Dos marcas del mismo motivo abiertas a la vez por el evento y el barrido**: el `UNIQUE`
  parcial enruta el cobro a la marca abierta en vez de rechazarlo (`B/05` `C2`, `C3`).
- **Webhooks fuera de orden**: el `version` descarta lo viejo sin relectura y lo nuevo se relee
  por id; dos órdenes distintos escriben el mismo estado (§10.1).
- **Pago que entra mientras `S6` suspende**: releído dentro de la transacción; si la llamada ya
  salió, el espejo lleva la fila a `CANCEL_SCHEDULED` y la persona recibe el período (`R18`), salvo
  el borde del F-8V3B2-004.
- **Correo encolado dos veces por un job repetido**: la clave `(destinatario, plantilla,
  ocurrencia)` con fecha objetivo lo impide; el doble envío está declarado (al menos una vez).
- **Creación de preapproval sin respuesta y búsqueda incompleta**: el duplicado `pending` lo
  cancela el barrido mientras la fila siga en `PENDING_AUTHORIZATION`; el que aparece después de
  `S2` está declarado en el NO cierra de `B/09`.
- **`C5` entre cuota manual y cobro del proveedor con fechas de período distintas**: declarado en
  `B/02` §2.3 con población casi vacía.
- **Predecesora que renueva mientras `S17` espera su correo o su llamada**: declarado como borde
  `R8-b` en el NO cierra de `B/12`.
- **Recuento de la columna de plata de `B/02` §2.5**: nueve `SÍ` (1, 2, 3, 7, 12, 15, 20, 23 y
  24), coincide con `B/05` `C2` y con `B/03` §3.1.

## Fuera de mi vector

- **El aviso de `cobrada: sí` de `P1` no tiene transporte durable ni red para la máquina de
  trial**: si el proceso muere entre el commit y la emisión, `T2` no dispara y el trial sigue
  hasta `T3` con la persona ya pagando. Está declarado en el contrato (§3) y en `V/03` §9; si la
  declaración alcanza, es del vector de trial y contrato.

## Key Learnings

1. Una clave de idempotencia protege lo que comparte su origen: la del pedido cubre el doble clic
   de la misma pantalla, no la pantalla recargada tras un error, que es el caso de la respuesta
   perdida.
2. Guardar el id que devuelve el proveedor sólo ata la fila a su efecto si la respuesta llega; el
   caso sin respuesta necesita un actor que reenvíe antes de que la conciliación clasifique el
   efecto como ajeno.
3. Las marcas que proponen devolver y el contracargo recaen sobre la misma población (cobros
   inesperados), así que toda devolución debe leer el estado del pago antes de salir.
4. Reconocer un acto propio por un efecto colateral (el correo) en vez de por el acto (la llamada)
   falla en las dos direcciones cuando el efecto se escribe antes de decidir o se suprime.
