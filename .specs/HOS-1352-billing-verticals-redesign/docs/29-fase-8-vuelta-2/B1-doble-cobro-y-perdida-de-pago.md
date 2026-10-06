---
title: "FASE 8 vuelta 2 · B1 — doble cobro y pérdida de pago"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 2 · B1 — doble cobro y pérdida de pago

Ataqué todo camino donde Juan paga dos veces, paga y no recibe, recibe sin pagar o un pago que
entró se pierde. Recorrí la épica de billing entera (`B/spec.md` y `B/docs/02`, `03`, `05`, `06`,
`09`, `10`, `12`, `14`, `16`, `19`, `21`, `22`), el núcleo (`04`, `07`), el corte
(`16-fase-7-del-paraguas.md`) y el contrato, contrastando cada supuesto sobre el proveedor contra
`06-mp-validation-matrix.md`. Seguí en detalle el alta y su ventana, la sucesión (upgrade, ciclo,
arrepentimiento), la baja desde los cuatro estados, pausa y cortesía, mora y grace, los addons de
única vez y recurrentes, la revocación, las lápidas y el cobro en vuelo del corte. Medido contra el
HEAD `1cccd9119d` del worktree `hospeda-spec-hos-1352-billing-redesign`.

Son **6 hallazgos**: **1 CRITICA, 2 ALTA, 3 MEDIA y 0 BAJA**. La idea más grave: la baja de la
principal (`S11`) no toca los addons recurrentes, así que en el camino normal de «me doy de baja»
el complemento **vuelve a cobrar un mes entero** dentro de la ventana `CANCEL_SCHEDULED`, lo
cortan días después y la marca que abre `S21` propone **no devolverlo**.

Regla de lectura: cada hallazgo se apoya en una cita textual copiada literal de una sola línea del
archivo, con su `archivo:línea` (rutas relativas a la raíz del worktree).

## CRITICA

### F-8V2B1-001 — Después de la baja, el addon recurrente cobra otro mes y la marca propone quedárselo

**Qué se rompe.** `DEC-SUB-009` corta el cobro de la **principal** en el acto de la baja, pero
`S11` no hace nada con sus suscripciones de complemento: siguen `ACTIVE` con su preapproval
`authorized`. La principal queda en `CANCEL_SCHEDULED`, que es fila viva, así que el addon no
queda huérfano hasta `S12`. Como el complemento tiene su propio aniversario de cobro, en una baja
pedida al principio del período la renovación del addon cae casi seguro adentro de la ventana:
Juan paga un mes entero **después** de haber pedido irse, recibe unos días, y en `S12` el addon
muere por orfandad. La marca que abre `S21` va al motivo 14, cuya propuesta es **no devolver**,
porque la regla lo lee como pérdida «por un acto del propio cliente». Para la principal, el mismo
hecho (un cobro posterior a la baja) va a `COBRO_POSTERIOR_A_LA_BAJA` con propuesta **devolver**.
La superficie de la baja sólo avisa para `LISTING`, y dice que el cobro «se corta», que es
justamente lo que no pasa hasta `S12`. Es plata cobrada de más en el camino principal de la baja
de cualquier cliente con un addon recurrente.

**El camino.**

1. Juan paga su plan mensual el día 1 y tiene un destaque recurrente cuyo aniversario es el día 20.
2. El día 3 pide la baja. `S11` cancela el preapproval de la principal y fija fin de servicio el
   día 31. La fila queda `CANCEL_SCHEDULED`, viva; el complemento sigue `ACTIVE` y `authorized`.
3. El día 20 Mercado Pago cobra el mes entero del destaque (el preapproval del complemento nunca
   se canceló). `P1` lo acredita como un cobro normal.
4. El día 31 `S12` lleva la principal a `CANCELLED`; la condición de orfandad se cumple, `A5`
   apaga la instancia y `S21` cancela el complemento sin sostener servicio.
5. Como el último cobro paga un período que no terminó, `S21` abre la marca 14, y el listado le
   propone a la persona **no devolver**. Juan pagó 30 días de destaque el día 20 y recibió 11.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:711`
  — "`CANCEL_SCHEDULED`, que sigue siendo fila viva. Lo que se evalúa en cada una es"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:898`
  — "último cobro del complemento paga un período que todavía no terminó, `S21` abre la marca"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:902`
  — "`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_OTRA_CAUSA` —el 14— en el resto, que es la regla del"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/16-addons.md:878`
  — "se pierde por un acto del propio cliente;"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:109`
  — "que según el estado desde el que se pide es al fin del servicio o hoy (fila 8)— y su cobro se corta"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:114`
  — "no debería existir. Se pone la marca `requiere_conciliación` con motivo `COBRO_POSTERIOR_A_LA_BAJA`"
- El silencio: la fila `S11` no nombra complementos. Corrí
  `rg -n "^\| S11 " .specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md | rg -c "complemento|S32|S21"`
  y no devolvió nada (cero coincidencias).

**Qué haría falta decidir o escribir.** Qué le pasa a cada complemento recurrente en el acto de
`S11`: si se cancela su preapproval en ese momento sosteniendo el servicio hasta el fin de la
principal (la forma de `DEC-SUB-009`), o si un cobro del complemento posterior a la baja de su
principal va a un motivo con propuesta «devolver» y no al 14. Y que la fila 3-bis de `B/19` §4 no
prometa que «su cobro se corta» mientras el complemento pueda cobrar dentro de la ventana, y que
alcance a los cuatro scopes, no sólo a `LISTING`.

## ALTA

### F-8V2B1-002 — Una baja durante el crédito de una sucesora corta el servicio en el acto y el crédito pagado se pierde

**Qué se rompe.** `DEC-SUB-006` convierte lo pagado sin usar de la predecesora en días de la
sucesora, corriendo su primer cobro; mientras dura ese crédito la sucesora no tiene ningún
`covered_period`. Para esa fila, `S11` fija el fin de servicio **en el acto**. El texto decidido
nombra a esa población como «una sucesora que todavía no cobró» del `B/12` §5.2 (la de la ventana
de 72 h), pero el crédito puede durar semanas o meses: en un cambio de anual a mensual, o en el
arrepentimiento. Y `B/03` §3.3 promete, para el arrepentimiento, que «lo pagado sin usar no se
pierde» precisamente por ese crédito. La baja desde esa fila borra plata que Juan pagó, contra lo
que la pantalla de baja promete (servicio hasta el fin del período pagado).

**El camino.**

1. Juan paga su plan el día 1 (ARS 30.000, mensual). El día 2 pide la baja: `S11` lo deja
   `CANCEL_SCHEDULED` hasta el día 31.
2. El día 3 se arrepiente y vuelve por el checkout: es una sucesión desde `CANCEL_SCHEDULED`. El
   crédito (28 días pagados sin usar) corre el primer cobro de la sucesora al día 31.
3. Autoriza; `S17` cierra la predecesora y la sucesora queda `ACTIVE`, sin ningún `covered_period`.
4. El día 5 Juan vuelve a pedir la baja. `S11` no tiene período del que tomar la fórmula y fija
   fin de servicio en el acto. El servicio se corta ese día.
5. Juan pagó hasta el 31 y recibió hasta el 5. Ninguna marca ni aviso lo recoge: `S11` hizo
   exactamente lo que dice.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:157`
  — "—una sucesora que todavía no cobró, `B/12` §5.2— no tiene entrada para la fórmula,"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:157`
  — "y ahí el fin de servicio es en el acto, como en `S24`"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1477`
  — "cobertura la da la sucesora, que está `ACTIVE`. Y lo pagado sin usar no se pierde: la"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1478`
  — "sucesión del arrepentimiento computa el crédito de `DEC-SUB-006` como cualquier otra"
- `.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:1062`
  — "usar, y los días que cubre salen de dividirlo por el precio diario del plan nuevo;"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:175`
  — "inmediato y el servicio sigue hasta el fin del período pagado (`DEC-SUB-009`), con esa fecha a"

**Qué haría falta decidir o escribir.** Qué fin de servicio tiene la baja de una sucesora cuyo
crédito todavía corre (el crédito es lo pagado, así que la pregunta es si cuenta como período
pagado para `S11`), o si esa baja se avisa como pérdida antes de confirmar. La decisión vigente
parece tomada pensando sólo en la ventana de 72 h.

### F-8V2B1-003 — Un addon de única vez cobrado sin respuesta queda `ABANDONED`, sin conciliación y sin camino de devolución

**Qué se rompe.** El addon `UNA_VEZ` se cobra por `/v1/orders`. El diseño dice que una orden sin
respuesta «se reenvía con la misma clave», pero ningún proceso tiene ese deber: el barrido de
creaciones sin respuesta busca preapprovals por `payer_email`, y la conciliación no ve órdenes.
Si nadie reenvía, al vencer la ventana `A3` lleva la instancia a `ABANDONED`, y para el de única
vez el efecto que relee antes de abandonar **no corre**. El pago no admite marca, así que tampoco
se puede abrir `RF1` desde una marca, y `S36` sólo alcanza suscripciones. Resultado: Juan pagó, no
tiene el addon, nadie lo ve y no hay ningún acto que le devuelva la plata. La declaración de
`B/09` («cómo se concilia una orden no está escrito») nombra la divergencia, no este desenlace:
esconde un «paga y no recibe» sin detector ni reparación.

**El camino.**

1. Juan compra «Boost 7 días». `A1` crea la instancia en `PENDING_AUTHORIZATION`; se acuña y
   persiste la clave y se manda la orden.
2. Mercado Pago cobra, pero la respuesta se pierde (timeout) o el proceso muere antes de escribir.
3. Nadie reenvía la orden: no hay job que recorra claves persistidas sin resultado.
4. A las 72 h, `A3` pasa la instancia a `ABANDONED`; al ser de única vez, no relee nada.
5. El pago nunca se asienta, no hay marca posible ni `RF1` que lo devuelva. Juan ve el débito en
   su resumen y ningún boost.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2534`
  — "De única vez no hay preapproval y esta parte no corre"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:75`
  — "`X-Idempotency-Key`, acuñada y persistida antes de la primera llamada, y si la orden ya existía"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:935`
  — "lee `authorized_payments`, así que ninguna de las tres partes lo alcanza. Cómo se concilia una"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:408`
  — "(§2.2) — una divergencia sobre este pago no tiene hoy dónde anotarse, y no se resuelve acá;"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1854`
  — "o una persona propone devolver desde una marca cuyo motivo lo pide"
- El silencio sobre quién reenvía: `rg -n -i "reenv" .specs/HOS-1354-billing-cobro-y-proveedor
  .specs/HOS-1352-billing-verticals-redesign/docs/nucleo
  .specs/HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md` devuelve sólo
  `B/16:94-98`, `B/16:963` y `B/05:74`, que afirman que se reenvía y no nombran ningún ejecutor.

**Qué haría falta decidir o escribir.** Quién reenvía una orden con clave persistida y sin
resultado, y cuándo; que `A3` sobre un `UNA_VEZ` reenvíe con la misma clave antes de abandonar
(`EX-41` lo vuelve seguro, en sandbox); y qué acto devuelve el pago de un addon de única vez cuando
corresponde (revocación o divergencia), ya que hoy no hay marca ni `S36` que lo alcance.

## MEDIA

### F-8V2B1-004 — La cortesía re-emitida sobre una sucesora con crédito corre encima del crédito

**Qué se rompe.** Cuando la predecesora tenía cortesía, `S18` la difiere y `S9` la re-emite sobre
la sucesora **en el acto de autorizar**, pausándola ya. Pero esa sucesora no cobra todavía: su
primer cobro está corrido por el crédito de `DEC-SUB-006`. La pausa consume días que Juan ya pagó
como crédito. La regla de `S9` («N meses saltean exactamente N cobros») sólo vale si hay cobros
dentro de la pausa: con un crédito de 40 días y 2 meses de cortesía, la pausa saltea un solo cobro;
con un crédito mayor que la cortesía, no saltea ninguno y la cortesía no entrega nada. Además, que
el primer cobro diferido (que el proveedor convirtió en `free_trial`) avance como un ciclo estando
pausado es extrapolación de `PS-6`, medido sobre suscripciones que ya cobraban. Es un residuo sobre
una población fina (cortesía otorgada dentro de la ventana de la sucesión), por eso MEDIA.

**El camino.**

1. Juan, mensual, declara un upgrade; durante la ventana `SUPER_ADMIN` le otorga 2 meses de
   cortesía sobre la predecesora.
2. La sucesora nace con primer cobro a +40 días por el crédito. Juan autoriza: `S17` y `S18`
   difieren la cortesía y `S9` pausa la sucesora hoy, hasta +60 días.
3. El cobro del día 40 cae en la pausa y el proveedor corre la fecha al día 70. Al día 60 `S10`
   reanuda; el día 70 cobra.
4. Juan tenía derecho a 40 días de crédito más 60 de cortesía (100 días) y recibió 70 sin cobro.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:155`
  — "una cortesía vale los cobros que cruza, no los días, y N meses saltean exactamente N cobros"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:482`
  — "ésta autoriza —o sea cuando llega a `ACTIVE`, que es exactamente el `desde` que `S9` ya tiene—,"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:573`
  — "Acá sí queda: la sucesora cobra, y es exactamente lo que la"
- `.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:1065`
  — "se compensan por valor, corriendo la fecha del primer cobro de la suscripción nueva."
- El silencio: `rg -c "crédito" .specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md`
  no encuentra ninguna coincidencia (sale con código 1): el § de la cortesía en la sucesión no
  nombra el crédito.

**Qué haría falta decidir o escribir.** Si la cortesía diferida se re-emite al autorizar o al
agotarse el crédito (cuando la sucesora iba a cobrar por primera vez), y qué dice la matriz sobre
pausar un preapproval cuyo primer cobro es un `free_trial` que el proveedor fabricó (`EX-38`).

### F-8V2B1-005 — La revocación de quien hizo un upgrade dentro de los 10 días no tiene pago que devolver

**Qué se rompe.** `S36` sale de la fila viva, exige estar dentro de los 10 días «del cobro que se
revoca» y crea `RF1` «por el total del último pago acreditado». Si Juan hizo un upgrade dentro de
esos 10 días, el cobro está en la predecesora, que `S17` ya llevó a `CANCELLED` (fuera del `desde`
de `S36`), y la sucesora no tiene ningún pago acreditado: corre sobre el crédito. Registrar la
revocación sobre la sucesora corta el servicio en el acto y crea un `RF1` sin pago del que colgar.
No está escrito sobre qué fila ni qué pago se revoca, y la lectura literal le devuelve cero.

**El camino.**

1. Juan se da de alta el día 0 y el primer cobro entra a los ~30 minutos.
2. El día 3 hace un upgrade; autoriza; `S17` cancela la fila vieja y la sucesora queda `ACTIVE`
   con el primer cobro corrido por el crédito.
3. El día 5 pide por correo la revocación. Una persona registra `S36` sobre la sucesora (la única
   viva): se corta el servicio.
4. «El último pago acreditado» de esa fila no existe; el del día 0 cuelga de una `CANCELLED`. Juan
   se queda sin servicio y sin reembolso.

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:182`
  — "dentro de los 10 días corridos del cobro que se revoca"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:182`
  — "crea `RF1` por el total del último pago acreditado"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/22-lo-legal.md:111`
  — "Sale desde `ACTIVE`, `GRACE_PERIOD`, `CANCEL_SCHEDULED` o `PAUSED` (este último, owner"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1478`
  — "sucesión del arrepentimiento computa el crédito de `DEC-SUB-006` como cualquier otra"

**Qué haría falta decidir o escribir.** Qué pago devuelve `S36` cuando la fila viva es una
sucesora sin pagos (el de la predecesora, siguiendo `sucedida_por`), y si el crédito corta en el
acto o se devuelve junto.

### F-8V2B1-006 — La población del cobro en vuelo del corte que no se devuelve está subcontada

**Qué se rompe.** El cobro en vuelo sobre una lápida del corte se asienta sin marca y no se
devuelve (`G3-1`); eso es dato. Pero la declaración acota su daño con una población falsa: «a lo
sumo los tres de la cartera». Desde `DEC-MIG-002` se siguen tomando altas en el sistema viejo, y
el propio capítulo pone el umbral de reconsideración en unas veinte. Todo cliente del viejo con un
cobro en vuelo al momento del 1b entra en el caso, y ninguno aparece en un listado. La declaración
esconde un daño mayor que el que dice, sobre una población de borde: MEDIA.

**El camino.**

1. Entre hoy y el corte el sistema viejo suma diez clientes pagos más (altas permitidas).
2. En el paso 1b, varios preapprovals se cancelan con un cobro de renovación ya en proceso.
3. Esos cobros entran después, se asientan sobre sus lápidas sin marca y ningún listado los
   muestra; la llamada del owner está dimensionada para «tres».

**La evidencia.**

- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:398`
  — "Población: los clientes con un cobro en vuelo en la ventana de minutos del paso 1b —a lo sumo"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:399`
  — "los tres de la cartera—. Detector: el `payment` asentado sobre la lápida, que una consulta"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:393`
  — "no se lo pone delante a nadie: la lápida del corte queda fuera del desempate (cap. 05 §3) y de"
- `.specs/HOS-1354-billing-cobro-y-proveedor/docs/21-migracion.md:317`
  — "hoy son 8 y el umbral medido está en unas 20"

**Qué haría falta decidir o escribir.** Que la población se lea de la re-verificación del §1.3 el
día del corte y no de un número fijo, y que la consulta de lápidas con `payment` sea un paso
explícito del corte (con fecha) y no sólo un detector disponible.

## BAJA

Ninguno.

## Ataques que intenté y el diseño resistió

- **Doble cobro por timeout en el alta**: la creación del preapproval deja un `pending` que no
  cobra, y el barrido de creaciones sin respuesta reusa o cancela los `pending` que nombran la
  fila (`B/09` §7); el candado `A` rechaza la segunda fila.
- **Dos autorizaciones en un upgrade**: `D8` corre el primer cobro de la sucesora y `S17` cancela
  la predecesora al autorizar; el cruce con la renovación está acotado por la ventana reducida y
  declarado como borde (`B/12` §5.4, R8-b).
- **Pago tardío tras suspender, o reintento del reciclado sobre un preapproval cancelado**: `C1`
  lo lleva a `CANCEL_SCHEDULED` con el período pagado, y sobre una `CANCELLED` va a
  `COBRO_POSTERIOR_A_LA_BAJA` con propuesta devolver (`B/05` §2 y §3).
- **Doble cobro manual contra proveedor**: `covered_period` con `UNIQUE` y `COBRO_DUPLICADO`.
- **Reembolso duplicado**: clave persistida antes (`RF-4`, `RF-6` `VERIFIED`) y `2084` sin pasar
  del monto confirmado (`RF2`).
- **Complemento cobrando durante pausa o suspensión**: `S32`/`S33` lo pausan y reanudan.
- **Addon huérfano cobrando**: `A5`/`S21` más las salvedades 1 y 4 del barrido.
- **Supuestos `UNKNOWN` usados como `VERIFIED`**: `PA-6`, `GR-2`, `RC-8`, `RF-3` y `EX-42`
  aparecen tratados como no medidos; `GR-1` se usa sólo desde que es `VERIFIED`.

## Fuera de mi vector

- **Legal**: si la revocación alcanza a los addons comprados en la ventana (hoy van al motivo 14,
  no devolver) es pregunta del pliego de `B/22`, no de este vector.
- **Superficies**: la fila 3-bis de `B/19` §4 avisa sólo para `LISTING`; qué dice la baja para
  `USER`/`GLOBAL` y `VERTICAL_SUBSCRIPTION` es del revisor de comunicación.

## Key Learnings

1. Un complemento con preapproval propio no hereda ninguna protección de la principal: todo acto
   que corta el cobro de la principal hay que recorrerlo también sobre sus complementos.
2. «Una fila sin `covered_period`» no es sólo la ventana de 72 h: una sucesora con crédito vive
   semanas sin período propio, y toda fórmula que lea `covered_period` le corta lo pagado.
3. El camino de única vez por `/v1/orders` tiene idempotencia medida pero ningún ejecutor de la
   recuperación ni camino de devolución: medir la capacidad no alcanza si nadie la invoca.
4. Una declaración de «no cierra» con una población fija caduca en silencio cuando otra decisión
   (seguir tomando altas) hace crecer esa población.
