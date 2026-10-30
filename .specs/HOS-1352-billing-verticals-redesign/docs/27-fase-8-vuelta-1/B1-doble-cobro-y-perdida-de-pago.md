---
title: "FASE 8 vuelta 1 · B1 — doble cobro y pérdida de pago"
linear: HOS-1352
statusSource: linear
created: 2026-09-26
updated: 2026-09-26
status: CURRENT
fase: 8
---

# FASE 8 vuelta 1 · B1 — doble cobro y pérdida de pago

Ataqué el diseño vigente buscando todo camino donde a Juan se le cobra dos veces el mismo
período, se le cobra de más o de menos contra lo prometido, se le regala servicio, o un pago
entra y se pierde. Recorrí la máquina de suscripción entera (`S1`–`S35`), la de pago y la de
reembolso (`B/03` §6 y §6.1), el pago manual (`B/03` §7), idempotencia y los seis cruces
(`B/05`), la conciliación (`B/09`), el grace y la sucesión (`B/12`), promos y cortesías
(`B/14`), addons (`B/16`), el contrato del proveedor (`B/06`), lo legal (`B/22`), la migración
(`B/21`) y el corte (`D/16`), y contrasté cada afirmación sobre Mercado Pago contra la matriz
(`D/06`), incluidas las filas cerradas hoy (`GR-1` `VERIFIED`, `RN-3` `PARTIALLY_SUPPORTED`).

Son **8 hallazgos**: **0 CRITICA, 4 ALTA, 3 MEDIA y 1 BAJA**. La idea más grave: la pausa se
pide en meses enteros pero se puede terminar cuando uno quiere, y como el proveedor corre la fecha
de cobro sin cobrar y no la mueve al reanudar, pausar el día antes del cobro y volver al día
siguiente regala un ciclo entero, repetible tres veces por año, sin ningún detector.

Regla de lectura: cada hallazgo se apoya en una cita textual, copiada literal de una sola línea del
archivo, con su `archivo:línea`; `$D`, `$V` y `$B` son las carpetas del paraguas, de verticales y
de billing, como las define la base de esta fase.

## ALTA

### F-8V1B1-001 — La pausa con vuelta anticipada regala un ciclo, o cobra uno sin servicio

**Qué se rompe.** `DEC-SUB-010` justifica que la pausa no necesita compensación porque *«la
aritmética se compensa sola»*: el cliente vuelve el mismo día del mes en que pausó. Pero la misma
decisión le deja volver **cuando quiera**, y el día de arranque también lo elige él. La cuenta
«pierde lo mismo que gana» sólo vale si la pausa dura ciclos enteros exactos, y nada lo impone.
Con los tres hechos medidos del proveedor —pausada no cobra, el vencimiento en pausa corre la fecha
un ciclo sin cobrar, y reanudar no la toca— el día de arranque y el de vuelta deciden cuánto paga.

**El camino.**

1. Juan paga Alojamiento mensual; su cobro es el día 1 y el 1/oct cobró.
2. El 30/oct pide pausar un mes (`S8`: `ACTIVE`, mensual, con cupo). La relectura confirma
   `paused`.
3. El 1/nov el proveedor no cobra y corre la fecha al 1/dic (`PS-2`, `PS-6`).
4. El 2/nov Juan vuelve antes (`S10`). Reanudar deja la fecha en el 1/dic (`PS-5`).
5. Del 2/nov al 1/dic tiene servicio entero sin pagar: perdió dos días y ganó veintinueve. `S10`
   escribe `fin_real`, así que los meses no usados no gastan cupo, y el tope que queda es el de
   tres pausas por ventana de doce meses: **tres ciclos gratis por año, un 25 %**.
6. Nadie lo ve: nuestro estado y el del proveedor coinciden en cada paso, no hay divergencia que
   el barrido pueda comparar.
7. Al revés, el mismo mecanismo cobra de más: si Juan pausa el 5 y vuelve el 25, recibe once días
   de los treinta que pagó y el 1 le cobran el mes completo — **el caso que la decisión declara
   inexistente**.

**La evidencia.**

- `$D/01-decision-log.md:1697`:
  «**volver cuando quiera** (§26.2 se cumple entero), y al volver **se le cobra normal en el ciclo»
- `$D/01-decision-log.md:1702`:
  «la pausa dura ciclos enteros, porque vuelve **el mismo día del mes** en que pausó.»
- `$D/01-decision-log.md:1715`:
  «que no pausar**—. Con el mínimo de un mes, esa pausa no existe.»
- `$D/01-decision-log.md:1719`:
  «servicio que no recibe, sólo le da los días que van de la reanudación al próximo cobro»
- `$B/docs/03-maquinas-de-estado.md:152`:
  «si la persona vuelve antes, los meses no usados no cuentan contra `DEC-SUB-004`»
- `$D/01-decision-log.md:711`:
  «§26.3 define tres límites con precisión — 3 pausas por ventana móvil de 12»
- Matriz, `PS-2` (`$D/06-mp-validation-matrix.md:209`):
  «**pausar ANTES de que el cobro se ejecute lo evita**»
- Matriz, `PS-6` (`$D/06-mp-validation-matrix.md:213`):
  «el ciclo que vence **estando pausada** igual avanza `next_payment_date` +1 ciclo sin cobrar»
- Matriz, `PS-5` (`$D/06-mp-validation-matrix.md:212`):
  «el mismo valor que ya tenía pausada. Ni se adelanta ni se corre.»

**Qué haría falta decidir o escribir.** Es una decisión del owner: el motivo de `DEC-SUB-010` se
apoya en una premisa —vuelta el mismo día del mes— que su propia implicación 1 deja de exigir. Hay
que decidir si la vuelta anticipada sigue siendo libre, y si lo es, qué se hace con el ciclo que el
proveedor salteó (cobrarlo al volver, no dejar reanudar antes del próximo vencimiento, u otra
forma). Hoy ninguna de las dos direcciones del daño tiene dueño.

### F-8V1B1-002 — El addon recurrente sigue cobrando sin fin durante la suspensión

**Qué se rompe.** Al suspender, `S6` cancela sólo el preapproval **principal**. Cada addon
recurrente tiene el suyo (`DEC-ADDON-002`), y ninguna transición lo toca: `SUSPENDED` es fila viva,
así que el addon no queda huérfano, y la pausa de complementos de `S32` se decidió **sólo** para la
pausa del cliente. El addon no da nada —el pliegue descarta un `COMPLEMENTO` sin título— y
`SUSPENDED` de tarjeta **no tiene salida por reloj**: dura hasta que Juan vuelva, pida la baja o se
discontinúe la vertical. Y nuestro propio aviso de suspensión le dice que ya no se le cobra.

**El camino.**

1. Juan tiene Alojamiento (ARS 18.000) y un addon recurrente de destaque (ARS 3.000), dos
   preapprovals con la misma tarjeta.
2. Se queda corto de fondos: el cobro de 18.000 rechaza y el de 3.000 entra.
3. Pasan los diez días de grace y corre `S6`: la principal queda `SUSPENDED` y se cancela su
   preapproval. El correo dice «ya no se te va a cobrar».
4. El complemento sigue `ACTIVE` con su preapproval `authorized`, y cobra 3.000 cada mes.
5. Juan no recibe nada por ese cobro, y nada detecta el caso: el barrido compara `ACTIVE` contra
   `authorized` —coinciden— y la comprobación de huérfanos no aplica porque la principal está viva.
6. Sigue así hasta que Juan lo descubre en el resumen de la tarjeta.

**La evidencia.**

- `$B/docs/19-superficies.md:116`:
  «tu suscripción se suspendió y ya no se te va a cobrar; para reactivarla, volvé a suscribirte»
- `$B/docs/16-addons.md:671`:
  «`DEC-ADDON-002` implicación 6: **cancelar el plan NO cancela los addons.** Cada addon recurrente»
- `$B/docs/16-addons.md:652`:
  «Ya no hace falta declararlo aparte —`PAUSED` y `SUSPENDED` son **filas vivas**, así que la»
- `$B/docs/16-addons.md:666`:
  «vendemos y no a una mora. **La suspensión no entra**: sigue como dice el párrafo de arriba.»
- `$B/docs/16-addons.md:660`:
  «emite fuente y el pliegue descarta todo `COMPLEMENTO` sin título, así que el addon recurrente»
- `$D/12-contrato-de-cobertura.md:289`:
  «**El pliegue del conjunto efectivo DESCARTA las fuentes de clase `COMPLEMENTO` cuando no hay»
- `$B/docs/03-maquinas-de-estado.md:95`:
  «salidas no son el candado: son pagar (`S7`), que el proveedor la dé de baja y la espejemos»
- `$B/docs/16-addons.md:655`:
  «registrada de que un suspendido dos meses pierde dos meses de algo que pagó, y con la obligación»

**Qué haría falta decidir o escribir.** Es una decisión del owner (la 4a excluyó la suspensión).
Pesan dos cosas que la decisión no tuvo delante: la pérdida no es *«dos meses de algo que pagó»*
—el argumento de `DEC-ADDON-001`, escrito para un addon con fecha de fin— sino un débito mensual sin
tope, y el aviso de la fila 10 promete lo contrario. O el complemento corre la suerte de su
principal al suspender (pausa o cancelación), o el aviso deja de prometer y el caso gana detector.

### F-8V1B1-003 — `S16` deja entrar el alta nueva con el preapproval viejo todavía vivo

**Qué se rompe.** Ante el primer cobro rechazado de un alta, `S16` lleva la fila a
`CHARGE_DECLINED` **pase lo que pase con la llamada** que cancela el preapproval, y si el correo
previo falla de forma transitoria la cancelación ni siquiera sale: la retoma el barrido, que tiene
**tres días** antes de marcar. Pero `CHARGE_DECLINED` es terminal y no viva, así que el candado del
§11 deja pasar el alta nueva que la superficie ofrece en el acto. Durante esa ventana hay dos
autorizaciones que pueden cobrar el primer período. El diseño vio este mismo riesgo para el
checkout abierto de una sucesión y lo cerró con el candado; para la cancelación sin confirmar, no.

**El camino.**

1. Juan se da de alta y autoriza. A los ~30 minutos el primer cobro rechaza por fondos
   insuficientes —no por antifraude, así que el proveedor puede seguir reciclándolo (`PA-6`)—.
2. `S16` lee el rechazo: la fila pasa a `CHARGE_DECLINED`; el correo *«antes de cancelar»* falla
   de forma transitoria y el preapproval queda `authorized`.
3. La pantalla le ofrece empezar de nuevo. Juan carga saldo, se da de alta otra vez y el
   preapproval nuevo cobra su primer ciclo.
4. Como el aviso fue *«el cobro no entró»*, Juan también actualiza el medio de pago en su cuenta de
   Mercado Pago. `GR-1` midió que eso dispara un reintento inmediato del registro viejo, y cobra.
5. Dos cobros del mismo primer período, en dos suscripciones distintas: el `UNIQUE` de
   `covered_period` es por suscripción y no los ve, y el cobro viejo cae sobre una fila terminal que
   no da servicio ni tiene motivo de marca nombrado (F-8V1B1-007).

**La evidencia.**

- `$B/docs/03-maquinas-de-estado.md:158`:
  «**La fila llega a `CHARGE_DECLINED` pase lo que pase con la llamada**»
- `$B/docs/03-maquinas-de-estado.md:158`:
  «la cancelación no se ejecuta en esta corrida y **la reintenta el barrido**»
- `$B/docs/09-conciliacion.md:199`:
  «Si los 3 días de la transición que decidió la cancelación la relectura todavía no la ve»
- `$B/docs/12-suscripcion.md:328`:
  «cuenta a `SUSPENDED` entre los vivos. `CHARGE_DECLINED` es terminal y **no vivo**: el reintento»
- `$B/docs/12-suscripcion.md:377`:
  «1. **El reintento del cliente es una suscripción NUEVA, con id nuevo.**»
- `$B/docs/12-suscripcion.md:386`:
  «un alta nueva quedan **dos preapprovals autorizados cobrando** sobre el mismo»
- `$B/docs/12-suscripcion.md:108`:
  «que **un rechazo no es un veredicto**: el proveedor sigue intentando después de él.»
- `$B/docs/02-modelo-de-datos.md:329`:
  «**`UNIQUE(subscription_id, período) WHERE liberado_en IS NULL`** — es el candado de `C5`»
- Matriz, `PA-6` (`$D/06-mp-validation-matrix.md:177`):
  «no se sabe si el proveedor cancela o reintenta durante la ventana de un ciclo (`GR-3`)»
- Matriz, `GR-1` (`$D/06-mp-validation-matrix.md:200`):
  «**El cambio de medio dispara un reintento inmediato**: el owner informa el cambio»

**Qué haría falta decidir o escribir.** Que el alta nueva no se ofrezca —o que `S1` no la admita—
mientras la fila `CHARGE_DECLINED` del mismo `user + vertical` siga en la salvedad 4 sin relectura
`cancelled`, o una condición equivalente; y qué motivo abre el cobro que igual entre sobre esa
fila. Es diseño, no decisión del owner, salvo que se elija aceptar el riesgo por escrito.

### F-8V1B1-004 — La revocación tiene fila para el reembolso y ninguna para la cancelación

**Qué se rompe.** `DEC-RF-001` define la revocación como **una sola operación: reembolso total más
cancelación**, justamente porque reembolsar no da de baja. La máquina tiene el reembolso (`RF1`,
cuyo evento nombra la revocación) y declara que **no mueve la suscripción**; ninguna fila de
`S1`–`S35` ejecuta la cancelación de una revocación. Por la regla 1 del núcleo, lo que la tabla no
declara no pasa, y quien implemente `RF1` en `B5` tiene dos lecturas, las dos con plata.

**El camino.**

1. Juan paga el 1/oct y el 4/oct revoca dentro de los diez días.
2. `RF1` crea el pedido; una persona lo confirma (`RF2`) y el proveedor devuelve el total (`RF3`).
3. Implementador A hace sólo eso: el preapproval sigue `authorized` y el 1/nov **le vuelve a
   cobrar** — el final que `DEC-RF-001` llama el peor posible.
4. Implementador B usa la baja que existe, `S11`: la fila pasa a `CANCEL_SCHEDULED` con fin de
   servicio calculado sobre el `covered_period` todavía sin liberar (el reembolso espera la
   confirmación), así que Juan **conserva el mes entero y recibe la devolución total**. Nada
   recalcula esa fecha cuando el reembolso libera el período.

**La evidencia.**

- `$D/01-decision-log.md:1634`:
  «1. **La revocación es UNA sola operación: reembolso total + cancelación.** No dos cosas que»
- `$D/01-decision-log.md:1638`:
  «El acceso al servicio se corta enseguida si el cliente lo pide; la plata sale»
- `$D/01-decision-log.md:1646`:
  «y sólo le devolvemos la plata, **le vuelven a cobrar el mes siguiente** — el peor final posible»
- `$B/docs/03-maquinas-de-estado.md:1801`:
  «monto y motivo (`B/02` §2.3). **No mueve el pago ni la suscripción**»
- `$B/docs/03-maquinas-de-estado.md:153`:
  «**`fin_de_servicio = inicio(P) + un ciclo de la billing option anclada`**»
- `$B/descomposicion.md:769`:
  «reembolso en sí es de **B5** (`RF1`/`RF4`, owner 2026-09-25, decisión 10d); si el owner mete el»

**Qué haría falta escribir.** La fila que ejecuta la mitad «cancelación» de la revocación —desde qué
estados, con qué fin de servicio y en qué orden respecto del reembolso—, o la decisión explícita de
que la revocación no se construye hasta que el botón entre en alcance. La parte 2 de `DEC-RF-001`
(*«si el cliente lo pide»*) deja además abierto si el corte de servicio es opcional.

## MEDIA

### F-8V1B1-005 — Ante un `2084`, caer al total devuelve más de lo que una persona confirmó

**Qué se rompe.** `RF2` manda, ante un `2084`, reintentar *«con otro monto o con el total»*. El
monto del reembolso lo confirmó una persona (`D11`), y hay reembolsos parciales por diseño: el cobro
que entra sobre una fila que Juan dio de baja en medio del grace se devuelve en la parte que la
persona decida. Caer al total sin una confirmación nueva devuelve lo que nadie aprobó, y *«otro
monto»* no dice cuál ni con qué clave: lo medido es la misma clave con el **mismo** cuerpo.

**El camino.** Juan pide la baja en el grace (`S24`); entra un cobro en vuelo; la persona confirma
devolver el 40 %. El proveedor responde `2084`. El sistema reintenta con el total y Hospeda
devuelve el 100 % de un período que Juan usó en parte.

**La evidencia.**

- `$B/docs/03-maquinas-de-estado.md:1802`:
  «**ante un `2084` la fila se queda en `CONFIRMED` y se reintenta con otro monto o con el total**»
- `$D/nucleo/04-invariantes.md:138`:
  «**Lo que toca plata lo confirma una persona**»
- `$B/docs/05-idempotencia-y-concurrencia.md:152`:
  «enteramente en vano. Cuánto de él corresponde devolver **no lo fija esta tabla**: es»
- Matriz, `RF-6` (`$D/06-mp-validation-matrix.md:312`):
  «La misma `X-Idempotency-Key` con el mismo cuerpo, sobre un pago con saldo»

**Qué haría falta escribir.** Si el reintento automático puede cambiar el monto confirmado; si
puede, en qué dirección y con qué tope; y con qué clave sale un cuerpo distinto (el comportamiento
de `/refunds` ante misma clave y otro cuerpo no está medido).

### F-8V1B1-006 — `S30` sale sólo de `ACTIVE` y el último cobro con descuento puede entrar en grace

**Qué se rompe.** El último cobro con descuento de una promo acotada puede acreditarse como
reintento del proveedor con la fila en `GRACE_PERIOD`. En ese acto corren `P1` —que baja el
contador a 0— y `S5`, y el orden entre los dos no está escrito. Si `P1` va primero, el evento de
`S30` ocurre con la fila fuera de su `desde`: el diseño escribió qué pasa en ese caso para
`PAUSED` y no para el grace. Y como `S30` no ocurrió, la divergencia de monto no la abrió una
mutación nuestra: el barrido marca en el acto en vez de reintentar.

**El camino.** Juan tiene una promo de tres cobros; el tercero rechaza (`S4`), el reintento se
aprueba dentro del mismo registro (`C6`), `P1` deja el contador en 0 con la fila en grace y el
monto no se restituye. Si la marca no se atiende en el mes, el cobro siguiente sale con descuento.

**La evidencia.**

- `$B/docs/03-maquinas-de-estado.md:172`:
  «`P1` deja en 0 el `cobros_restantes` de la redención de promo que cuelga de la fila»
- `$B/docs/03-maquinas-de-estado.md:172`:
  «**Y si el contador llega a 0 con la fila ya `PAUSED`**, esta fila no ocurre»
- `$B/docs/03-maquinas-de-estado.md:1721`:
  «**lo decrementa en uno en el mismo acto** (`B/02` §2.4), y si llega a 0 corre `S30`»
- `$B/docs/05-idempotencia-y-concurrencia.md:237`:
  «que **ante el choque se relee la fila existente**: si está `PENDING` y la lectura por id dice»
- `$B/docs/09-conciliacion.md:121`:
  «**cualquier otra divergencia de monto abre `DIVERGENCIA_DE_MONTO` en el acto**»

**Qué haría falta escribir.** El orden de `P1` y `S5` en ese acto, o que el `desde` de `S30` admita
la fila que sale del grace en el mismo acto.

### F-8V1B1-007 — El desempate de motivos no nombra `CHARGE_DECLINED` ni la lápida

**Qué se rompe.** El desempate de `B/05` §3 reparte un pago que entra sobre una fila que no puede
recibirlo entre tres motivos. La primera fila exige `CANCELLED` por una transición de su lista; la
tercera nombra sólo `ABANDONED` y `ACTIVE`. `CHARGE_DECLINED` —que desde la FASE 8 completa se
alcanza por **nuestra** llamada de cancelación— no está en ninguna, y la lápida del corte es
`CANCELLED` pero no la produce ninguna transición. Dos implementadores eligen distinto motivo, o
ninguno, y sin motivo el pago queda sin marca: plata de Juan sin nadie que la devuelva.

**El camino.** El cobro viejo de F-8V1B1-003 entra sobre la fila `CHARGE_DECLINED`; o un cobro en
vuelo del sistema viejo entra sobre una lápida después del corte. En los dos casos el criterio del
desempate —qué acto nuestro dejó cobrando un preapproval— apunta a `COBRO_POSTERIOR_A_LA_BAJA`, y el
texto no lo dice.

**La evidencia.**

- `$B/docs/05-idempotencia-y-concurrencia.md:307`:
  «`S11`/`S12`, `S17`, `S21`, `S22`, `S23`, `S24`, `S25`, `S27`, `S31` o el espejo del `B/03` §10.1»
- `$B/docs/05-idempotencia-y-concurrencia.md:309`:
  «la **1** sobre una fila `ABANDONED` o ya `ACTIVE`, y las condiciones **2**, **3**»
- `$B/docs/05-idempotencia-y-concurrencia.md:312`:
  «eso ordena así: los dos primeros le dicen **qué acto nuestro dejó cobrando un preapproval que»
- `$B/docs/09-conciliacion.md:155`:
  «**nuestra llamada**, con la relectura de `S17`: `S16` cancela el preapproval de nuestro lado»
- `$B/docs/21-migracion.md:177`:
  «**La lápida es la única fila `CANCELLED` de todo el sistema que ninguna transición produce**»

**Qué haría falta escribir.** Dos celdas en la tabla del desempate: el motivo para `CHARGE_DECLINED`
y el motivo para la lápida.

## BAJA

### F-8V1B1-008 — La tabla del grace sigue condicionando la salida a `GR-1` `UNKNOWN`

**Qué se rompe.** `GR-1` quedó `VERIFIED` el 2026-09-26 y `B/12` §1.5 y `B/03` §3.3.1 ya dicen que
la pantalla puede prometer el reintento con la tarjeta nueva. La fila *«qué se puede hacer
adentro»* de la tabla del grace (`B/03` §4) sigue diciendo lo contrario, y `B/06` §11 sigue dando
`RN-3` como `UNKNOWN` cuando la matriz lo cerró `PARTIALLY_SUPPORTED`. Quien lea `B/03` §4 para
armar la pantalla de Juan en grace no le dice que cambiar la tarjeta reintenta el cobro.

**El camino.** Juan entra en grace; la pantalla, escrita desde `B/03` §4, no le promete nada; Juan
no cambia la tarjeta y termina suspendido por un cobro que se habría recuperado en dos minutos.

**La evidencia.**

- `$B/docs/03-maquinas-de-estado.md:1598`:
  «condicionado a `GR-1`** (`UNKNOWN`): que el reintento de un registro ya abierto»
- `$B/docs/12-suscripcion.md:166`:
  «eso la pantalla y los correos del grace **pueden decir que al cambiar la tarjeta se reintenta el»
- `$B/docs/06-proveedor.md:412`:
  «**leído el 2026-09-24: reactivar no reintenta lo adeudado; sigue `UNKNOWN` si vuelve a pausar**»

**Qué haría falta escribir.** Tachar la condición en `B/03` §4 y la mención de `RN-3` en `B/06`
§11, como ya se hizo en los otros lugares.

## Ataques que intenté y el diseño resistió

- **Timeout en el alta por `/preapproval`**: el alta deja un `pending` que no cobra, y el barrido
  de creaciones lo reusa (`B/05` §1.2, `B/09` §7).
- **Timeout en el addon de única vez**: `/v1/orders` deduplica por clave persistida antes
  (`EX-41`, medido en sandbox; la regla 7 de la matriz lo re-verifica antes de FASE 10).
- **Reembolso duplicado por reintento**: misma clave, mismo cuerpo, ningún reembolso nuevo
  (`RF-6`).
- **Pago tardío que reactiva a la predecesora de una sucesión**: `S19` lo retiene y el cierre
  decide (`B/12` §5.3).
- **Grace más largo que la ventana del proveedor**: `DEC-SUB-019` cancela el preapproval en `S6`
  y la configuración exige grace menor que el ciclo.
- **Pausa del proveedor por mora con el webhook perdido**: `S1` relee antes de aceptar una
  sucesión y `S6` corre por su segundo evento.
- **Primer rechazo cuyo aviso se pierde**: el barrido corre `S4` (`B/09` §3).
- **Suspender a quien pagó por un webhook demorado**: `S6` pregunta al proveedor antes, con la
  lectura del `B/09` §4.
- **Cortesía otorgada a mitad de ciclo**: con meses enteros sobre mensual, N meses saltean N
  cobros y el servicio lo sostenemos nosotros; la cuenta cierra en cualquier día de arranque.
- **Predecesora que renueva dentro de la ventana de la sucesión**: la ventana reducida y la
  relectura en el corte lo cubren; el residuo de dos minutos y de `S17` fallida está declarado.
- **Cruce manual contra proveedor en `covered_period`**: declarado con población casi vacía
  (`B/02` §2.3, `B/09` *«lo que este capítulo NO cierra»*).

## Fuera de mi vector

- `B/03` §3.3: toda marca abierta, de cualquier motivo, impide que Juan cambie de plan hasta que
  una persona la resuelva; con veintidós motivos, es un bloqueo de producto frecuente.
- `B/21` §4 y `D/16` §4.2: los pagos que el sistema viejo cobre antes del corte no se conservan;
  el reclamo posterior no tiene comprobante del lado de Hospeda (declarado).
- `B/09` §7.1: el vigía del barrido depende de un plan de Sentry no verificado.

## Key Learnings

1. Una compensación «que se cancela sola» por aritmética de calendario tiene que fijar **los dos
   extremos** del intervalo; si el cliente elige cualquiera de los dos, deja de compensar.
2. «Terminal pase lo que pase con la llamada» saca a la fila del candado del §11 antes de que su
   autorización deje de poder cobrar: todo estado terminal alcanzado por una llamada nuestra sin
   confirmar reabre la puerta del doble preapproval.
3. `GR-1` cambia el peso de los bordes: cambiar la tarjeta dispara un cobro en minutos, así que
   cualquier preapproval que «debería estar cancelado» es ahora un cobro inminente, no latente.
4. Un addon con preapproval propio no sigue a su título salvo donde una fila lo dice; cada
   estado del título sin servicio (pausa, suspensión) necesita su fila o su declaración.
5. Una operación «de un solo acto» que la máquina parte en dos tiene que tener **las dos** mitades
   en la tabla; si falta una, la regla 1 del núcleo la borra.
6. Los desempates escritos como lista de transiciones dejan afuera las filas que no nacen de una
   transición (la lápida) y los estados terminales que no son `CANCELLED`.
