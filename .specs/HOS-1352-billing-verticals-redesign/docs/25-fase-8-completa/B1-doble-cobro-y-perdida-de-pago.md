---
title: "FASE 8 completa · B1 — doble cobro y pérdida de pago"
linear: HOS-1352
statusSource: linear
created: 2026-09-24
updated: 2026-09-24
status: CURRENT
fase: 8
---

# FASE 8 completa · B1 — doble cobro y pérdida de pago

Ataqué la épica de billing (`B/03`, `B/05`, `B/06`, `B/09`, `B/12`, `B/14`, `B/16`, con `B/02` y
`B/20` de apoyo) y el núcleo por el lado de la plata: dos preapprovals vivos, sucesión, cambio de
ciclo, vuelta del suspendido, reintentos del proveedor, el lote del minuto `:02`, cortesías y promos
que regalan o cobran de más, reembolsos sin fila y timeouts de creación. Cada afirmación sobre
Mercado Pago la contrasté contra `06-mp-validation-matrix.md`.

Son **18 hallazgos**: **1 CRITICA, 7 ALTA, 8 MEDIA y 2 BAJA**. La idea más grave en una línea: **la
cortesía se implementa pausando, y como el proveedor saltea CICLOS ENTEROS en la pausa (`PS-6`), su
valor no depende de los N días firmados sino de si la pausa cruza una fecha de cobro. Una cortesía
de 30 días sobre un plan anual puede regalar casi un año, y ningún detector lo ve.** Hay un segundo
patrón que atraviesa varios ALTA: el diseño garantiza cosas sobre el **instante en que ocurren del
lado del proveedor**, y las ejecuta en el **instante en que nos enteramos**. Entre los dos está la
demora de los webhooks, que `WH-2` midió en días.

Regla de lectura: cada hallazgo se apoya en una cita textual. Donde una medición de la matriz
sostiene el ataque, va su id de fila.

---

## CRITICA

### F-8CB1-001 — Una cortesía regala cero días o un ciclo entero según dónde caiga, y sobre un plan anual puede regalar casi un año

**Qué se rompe.** La cortesía temporal promete *«N días o meses de servicio sin cobrar»*. Se
implementa pausando el preapproval. Pero el proveedor, con la suscripción pausada, **no descuenta
días: saltea el cobro entero de cada fecha que cae adentro de la pausa y corre la fecha +1 ciclo**
(`PS-6`). Además, reanudar **no mueve la fecha** (`PS-5`). Entonces lo que vale la cortesía es la
cantidad de fechas de cobro que cruza multiplicada por el ciclo, y no N:

- si la pausa no cruza ninguna fecha, la cortesía vale **cero**: el cliente usó días que ya había
  pagado, y paga lo mismo que sin cortesía (se le cobra de más contra lo que se le prometió);
- si cruza una fecha por un día, vale **un ciclo entero**: en mensual son 30 días por un regalo de
  pocos días, y **en anual es un año**.

La restricción *«sólo los planes mensuales pueden pausarse»* no alcanza a la cortesía: `S9` no pasa
por `puedePausar()`.

**El camino.**

1. Juan tiene un plan **anual** en `ACTIVE`. Pagó el 1/ene y su próximo cobro es el 1/ene del año
   siguiente.
2. El 20/dic `SUPER_ADMIN` le firma **30 días** de cortesía por un inconveniente. Corre `S9`: la
   fila queda `PAUSED · COURTESY` y el preapproval, `paused`.
3. El 1/ene vence la fecha estando pausada. El proveedor **no cobra** y corre `next_payment_date` +1
   ciclo, o sea al 1/ene del año siguiente (`PS-6`, `PS-2`).
4. El 19/ene la cortesía termina: `S10` manda `PUT status=authorized`. Reanudar cambia sólo el
   estado (`PS-5`), así que el próximo cobro sigue en el año siguiente.
5. Juan tiene servicio completo desde el 19/ene hasta el 1/ene siguiente **sin pagar un peso**: casi
   11 meses por una cortesía de 30 días. El barrido no ve nada, porque `PAUSED`/`paused` coinciden,
   `ACTIVE`/`authorized` también, y la fecha del próximo cobro *«se registra; no es por sí sola una
   divergencia»* (`B/09` §3).
6. La variante mensual: una cortesía de 10 días del 5 al 15 no cruza el cobro del 30. Juan no
   ahorra nada y el regalo es nulo. La misma cortesía del 25 al 5 saltea el cobro del 30 y regala 30
   días.
7. Los mismos caminos se abren por el segundo y el tercer disparador de `S9` (re-emitir una
   cortesía diferida sobre una sucesora recién autorizada, que puede ser anual) y por la regla de
   promos del `B/14` §1.3 (un descuento que queda por debajo del piso se ejecuta pausando).

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:208` (`PS-6`):

> (2) el ciclo que vence **estando pausada** igual avanza `next_payment_date` +1 ciclo sin cobrar

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:207` (`PS-5`):

> **Reanudar cambia SÓLO el `status`.**

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:1722` (`DEC-GRANT-003`, implicación 6). La decisión descarta justo el efecto que produce el hallazgo:

> 6. Lo que `PS-6` mide —que el ciclo vencido en pausa se pierde— **acá no aplica**: durante la

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:1624` (`DEC-SUB-010`). La compensación de la pausa sólo cierra en ciclos enteros:

> la pausa dura ciclos enteros, porque vuelve **el mismo día del mes** en que pausó.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:130` (`S9`). La única condición es *«no hay pausa vigente»*. No mira el ciclo ni la duración contra la fecha de cobro:

> | `PAUSED` *(motivo `COURTESY`)* | no hay pausa vigente (`DEC-GRANT-004`)

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/04-invariantes.md:66`:

> | 23 | sólo los planes mensuales pueden pausarse | `puedePausar()`, un solo lugar (cap. 01 §3) |

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/01-glosario.md:657`. El ciclo mensual se exige en una función que `S9` no llama:

> AND billingOption.ciclo == mensual                    (§26)

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:67`:

> 2. **Si el resultado cae por debajo del piso, el descuento NO se aplica mutando el monto.** Se

**Severidad**: `CRITICA`. Se pierde plata de verdad: hasta un ciclo anual por cortesía. El camino es
ordinario (una firma de `SUPER_ADMIN`, o el re-emisor automático de `S9`) y no hay ningún detector.
En la dirección contraria, el cliente recibe una cortesía que no vale nada.

**Necesita decisión del owner**: **sí**. Hay que elegir qué significa *«N días»* contra un
proveedor que sólo saltea ciclos: pausar sólo en múltiplos del ciclo y alineado a la fecha,
restringir la cortesía a planes mensuales, o sostener los días de nuestro lado sin pausar. Cada
opción cambia una decisión firmada (`DEC-GRANT-003`).

---

## ALTA

### F-8CB1-002 — El suspendido con tarjeta no tiene por dónde volver a pagar: la vuelta que el diseño promete la prohíbe su propio guard

**Qué se rompe.** Desde `DEC-SUB-019`, `S6` cancela el preapproval al suspender, y el diseño dice
que para volver hay que **declarar una sucesión** por el checkout. Pero `G-R1-A` **prohíbe declarar
una sucesión desde `SUSPENDED`**. Tampoco puede dar de alta una suscripción nueva, porque
`SUSPENDED` ocupa el candado `A`. Y `S7` no le sirve: sólo lo alcanza el pago manual, que es de
otra población. El cliente que quiere pagar no puede. La única salida que queda es darse de baja
(`S23`) y volver a suscribirse, y ahí pierde **para siempre** la promo (`UNIQUE(promo_code_id,
user_id)`) y los addons de scope `VERTICAL_SUBSCRIPTION`, que quedan huérfanos porque sin sucesión
nada los re-apunta.

**El camino.**

1. Juan, que paga con tarjeta, cae en grace. A los 10 días corre `S6`: `SUSPENDED` y preapproval
   `cancelled`.
2. Juan quiere pagar. La pantalla le ofrece *«re-autorizar por el checkout»*.
3. El camino que declara la sucesión lo rechaza `G-R1-A`, porque la predecesora está `SUSPENDED`.
4. El alta nueva (`S1`) la rechaza la base, porque la `SUSPENDED` ocupa `A`.
5. Juan sólo puede darse de baja (`S23`) y hacer un alta nueva. Pierde su promo `forever` (la
   redención es única por usuario y código) y sus addons de ficha.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:127` (efectos de `S6`):

> Volver es re-autorizar por el checkout: una sucesión, y `S17` encuentra el preapproval ya `cancelled` (`D7`)

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:128` (`S7`):

> un pagador con tarjeta **no vuelve por acá**: `S6` le canceló el preapproval (`DEC-SUB-019`), así que vuelve por el checkout como **sucesora** (`S1` → `S2` → `S17`)

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:72`:

> `G-R1-A` impide **declarar** una sucesión desde una `SUSPENDED` —autorización de estado

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:81-82`:

> correcto**: su preapproval puede seguir vivo, y una segunda suscripción serían dos cobros.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:414`:

> **`UNIQUE(promo_code_id, user_id)`** — es el §31, «Cada user: máximo un uso de cada código»

**Severidad**: `ALTA`. La vuelta de un moroso es el camino principal del dunning, y tal como está
escrita no se puede ejecutar. Hay un rodeo (baja más alta nueva), pero destruye bienes pagados. No
es `CRITICA` porque el cliente termina pudiendo pagar.

**Necesita decisión del owner**: **no**. Es una corrección: o `G-R1-A` admite `SUSPENDED` cuando el
preapproval ya está confirmado `cancelled`, o se escribe otra vuelta.

---

### F-8CB1-003 — El cobro que estaba en vuelo cuando `S6` suspendió reactiva la fila sin preapproval, y al día siguiente el espejo la cancela con el período pagado adentro

**Qué se rompe.** El diseño reconoce que a `S7` sólo lo alcanzan los bordes, y nombra *«un cobro en
vuelo en el instante de `S6`»*. Pero no dice qué pasa después: `S7` devuelve la fila a `ACTIVE` y
restituye la publicación **sobre un preapproval que `S6` acaba de cancelar**. En la corrida
siguiente, el par `cancelled` × `ACTIVE` se espeja como *«baja decidida por el proveedor»* y la fila
pasa a `CANCELLED`. No abre ninguna marca, no pasa por `CANCEL_SCHEDULED` y no queda nada que
sostenga el período que el cliente acaba de pagar.

**El camino.**

1. Al cobro mensual de Juan lo rechazan el día 0. La fila entra en grace.
2. El día 10 corre `S6`. La lectura del `B/09` §4 da *«no cobró»* y se cancela el preapproval.
   Mientras tanto, un reintento del proveedor quedó en proceso en el lote de las `:02`.
3. Ese reintento se acredita después de la cancelación. Entra el pago sobre una `SUSPENDED`, se
   cumplen las cuatro condiciones del `B/05` §3 y corre `S7`: la fila vuelve a `ACTIVE`.
4. En la corrida siguiente, el barrido lee `cancelled` contra `ACTIVE`, espeja y pasa la fila a
   `CANCELLED`.
5. Juan pagó un mes entero, tuvo unos 11 días de servicio y quedó cancelado. Ninguna marca de
   devolución lo nombra.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:128` (`S7`):

> y `S7` sólo lo alcanzan los bordes —un cobro en vuelo en el instante de `S6`, un preapproval reactivado a mano—

y los efectos de esa misma fila: *«se restituye la publicación»*. No hay nada sobre el preapproval.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2243`:

> | `cancelled` | cualquier estado vivo que no sea `CANCEL_SCHEDULED` ni `SUSPENDED` | **`S12`** si hay una baja programada; si no, **espejar la baja decidida por el proveedor** (`B/12` §1.4) |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:231-234`. El diseño cuenta con esta población:

> **Y desde `DEC-SUB-019`, la mitad `SUSPENDED` de la condición 1 ya no la alcanza un webhook
> ordinario del proveedor en un pagador con tarjeta**: `S6` canceló el preapproval al suspender, así
> que lo que puede llegar ahí es sólo un borde —un cobro que ya estaba en vuelo en el instante de
> `S6`

**Severidad**: `ALTA`. Se cobra sin entregar y sin ningún registro que lo devuelva. La población es
un borde (una carrera contra el lote), y eso es lo que lo separa de `CRITICA`.

**Necesita decisión del owner**: **sí**. Hay que elegir el destino de ese pago: reactivar exige un
preapproval que ya no existe. Las opciones son una marca de devolución, o reactivar con una fecha
de fin de servicio al estilo `CANCEL_SCHEDULED`.

---

### F-8CB1-004 — La ventana reducida protege el instante en que el cliente autoriza, no el instante en que nos enteramos: sin webhook, predecesora y sucesora cobran el mismo período

**Qué se rompe.** `B/12` §5.4 corta la ventana de la sucesora a las 00:00 del día del cobro de la
predecesora, *«de modo que la autorización no pueda cruzar la fecha de cobro»*. Pero lo que evita
el doble cobro es `S17`, que cancela la predecesora, y `S17` corre cuando **nosotros** vemos la
autorización: por webhook, por la relectura de `S3` o por el barrido diario. Si el webhook se
demora, que `WH-2` midió en días, la predecesora cobra el período nuevo en su lote y la sucesora
cobra el suyo desde el vencimiento de la ventana. Ninguna regla marca ese cobro de la predecesora,
y además la fila queda exenta del barrido en cuanto `S17` la cancela con relectura.

**El camino.**

1. La predecesora de Juan cobra el día D a las 00:30 `-04`, así que su lote es a la 01:02. El 25
   del mes anterior Juan pide un upgrade. La ventana de la sucesora vence a las 00:00 de D.
2. Juan autoriza a las 23:58 de D-1. El webhook de autorizada se demora.
3. El job de `S3` recorre las vencidas con una cadencia que no está escrita, digamos cada hora a y
   media: todavía no relee.
4. A la 01:02 la predecesora, `ACTIVE` y con preapproval vivo, cobra el período D..D+30.
5. Después el job relee y ve `authorized`: corre `S2`, y `S17` cancela la predecesora.
6. La sucesora nació con fecha de primer cobro al vencer la ventana (D), con un crédito calculado
   sin ese pago, y cobra D..D+30 **otra vez**. El cobro de la predecesora quedó `SUCCEEDED` sobre
   una fila que `S17` cerró con relectura, que el barrido deja exenta.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:662-664`:

> **Entonces, sobre el pagador con tarjeta, la salida no es corregir: es no llegar a ese caso.**
> Cuando la renovación de la predecesora está cerca, el cambio de plan se ofrece con **ventana
> reducida**, de modo que la autorización no pueda cruzar la fecha de cobro.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:138` (`S17`):

> | su sucesora quedó **autorizada**, confirmado por relectura | `CANCELLED`

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1241`. Es la única vía de detección sin webhook, y no tiene cadencia:

> 2. **Limpieza**: un job recorre las vencidas, las lleva a `ABANDONED` y **cancela el preapproval

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:261` (`WH-2`):

> 8 pasan de 300 s y **tres llegaron a los 10,3 y 14,3 días**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:119` (exención de `S17`):

> | `S17` → `CANCELLED` | nuestra llamada, **pero con relectura**: si falla, `S17` **no ocurre** y la fila no llega a terminal (`B/03` §3.2) | **sí**, por construcción |

**Severidad**: `ALTA`. Es un doble cobro real y no tiene detector. Hace falta que se combinen un
webhook demorado y una hora de cobro temprana, y por eso no es `CRITICA`.

**Necesita decisión del owner**: **no**. Es una corrección: hay que atar la cadencia del job de
`S3` al corte de la ventana (una relectura por id antes del primer lote posterior), o marcar el
cobro de una predecesora que entra después de la autorización de su sucesora.

---

### F-8CB1-005 — Una lectura literal de `B/03` §4 deja el servicio completo sin cobrar para siempre: alcanza con redeclarar una sucesión cada 72 h

**Qué se rompe.** La prosa del §4 dice que *«mientras esa sucesión esté en curso, ni `S5` ni `S6` se
ejecutan»*. La fila `S6` de la tabla sólo bloquea el segundo evento (la pausa del proveedor) y el
caso de un pago retenido por `S19`. Quien implemente la prosa congela el reloj del grace mientras
haya una sucesora viva. Declarar una sucesión desde `GRACE_PERIOD` es gratis: no pide autorizar y
no tiene tope de veces. `GRACE_PERIOD` emite fuente con servicio completo.

**El camino.**

1. Juan cae en grace (servicio completo).
2. El día 9 pide un cambio de plan. Se crea la sucesora en `PENDING_AUTHORIZATION` y el reloj del
   grace queda bloqueado.
3. Juan no autoriza. A las 72 h (7 días si es pagador manual) corre `S3`: `ABANDONED`.
4. Antes de la corrida siguiente de `S6`, Juan pide otro cambio de plan. El candado `B` quedó libre
   y la predecesora sigue en `GRACE_PERIOD`, un estado desde el que `G-R1-A` deja declarar.
5. Repite. En un pagador con tarjeta, la pausa del proveedor al vencer su ventana también está
   bloqueada *«mientras la fila sea la predecesora de una sucesión en curso»*.
6. Resultado: servicio completo sin pagar, sin fecha de fin.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1274-1276`:

> **Mientras
> esa sucesión esté en curso, ni `S5` ni `S6` se ejecutan**: el pago que entre queda pendiente por
> `S19` y el reloj no vence sobre él (§3.2).

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:127` (condición de `S6`). El bloqueo por sucesión sólo alcanza al segundo evento:

> **Y por el segundo evento, `S6` no ocurre mientras la fila sea la predecesora de una sucesión en curso**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:377-379`:

> Mientras la sucesión está en curso la
> predecesora sigue en `GRACE_PERIOD`, que **emite fuente** con `hasta: SIN_FECHA_CONOCIDA`

**Severidad**: `ALTA`. Con la lectura de la prosa, se entrega servicio sin cobrar sin ningún
límite, y cualquier cliente lo puede hacer desde la superficie. Con la lectura de la tabla no pasa,
así que es una contradicción entre dos textos con una consecuencia de plata.

**Necesita decisión del owner**: **no**. Es una corrección de texto: hay que alinear el §4 con la
fila `S6`, y además acotar cuántas veces se puede declarar una sucesión desde grace.

---

### F-8CB1-006 — El grace del pagador con tarjeta tiene dos momentos de arranque incompatibles, y uno de ellos regala un ciclo entero (un año en el plan anual)

**Qué se rompe.** `B/12` §1.2-1.3 fija que el reloj del grace arranca **cuando el proveedor deja de
reintentar**, y que mientras reintenta el cobro es `PENDING` y la fila sigue `ACTIVE`. `GR-3` midió
que el proveedor se rinde **al vencer la ventana**, y lo hace **pausando**. `DEC-MP-008` convierte
esa pausa en `S6` inmediato. Con la regla del §1.2, entonces, el grace no existe nunca: la fila
queda `ACTIVE` con servicio completo durante toda la ventana del proveedor (un ciclo, según
`DEC-SUB-019`) y después se suspende de golpe. `B/03` `P2` y `DEC-SUB-019`, en cambio, suponen que
el grace arranca en el primer rechazo, y sobre eso construyen *«grace < ciclo»*. Dos
implementadores fieles hacen cosas opuestas. Sobre un plan anual, la lectura del §1.2 da **hasta un
año de servicio sin cobrar**. Encima, el dato en el que se apoya `DEC-SUB-019` (*«la sonda 49
midió»*) no está en la matriz, que declara esa sonda **bloqueada**.

**El camino.**

1. Juan tiene plan anual y su renovación se rechaza. El proveedor la manda a reintentos dentro de
   una ventana que, según `DEC-SUB-019`, dura un ciclo.
2. Implementación A (`B/12` §1.3): el pago queda `PENDING` y la fila `ACTIVE`, sin reloj. Durante
   toda la ventana, Juan tiene servicio completo sin haber pagado.
3. Al vencer la ventana el proveedor pausa. Por `DEC-MP-008` corre `S6` directo a `SUSPENDED`: el
   grace de 10 días nunca existió, y a cambio Juan tuvo la ventana entera.
4. Implementación B (`P2`): rechazo, `FAILED`, `S4` y 10 días de grace. Es lo que `DEC-SUB-019`
   presupone.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:42-43`:

> **El reloj del grace arranca cuando el proveedor deja de reintentar, no cuando falla un
> intento. Y eso se detecta releyendo el recurso, nunca contando días.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:59`:

> | el proveedor rechazó y **va a reintentar** | **`PENDING`** | sigue `ACTIVE` |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1370`:

> | P2 | `PENDING` | el proveedor rechaza | `FAILED` | dispara S4 si era el cobro de una suscripción `ACTIVE` |

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:197` (`GR-3`):

> La [sonda 49](./mp-probes/probe-49-la-ventana-de-reintentos.mjs) existe para separarlas con un sujeto de `2 days` y **está bloqueada**

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:5001-5004` (`DEC-SUB-019`):

> - **El hecho que la motiva**: la **sonda 49** (producción, 2026-09-24) midió que **la ventana de
> [...] Para un plan mensual es extrapolación —~30 días—, y para uno anual daría un año,

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:108`. El capítulo dice además que la fila de la que depende sigue sin medir, cuando la matriz la da `VERIFIED`:

> `GR-3` —la política de reintentos del proveedor— **sigue `UNKNOWN`**.

**Severidad**: `ALTA`. Con una de las dos lecturas se entrega servicio sin cobrar por un ciclo
entero en cada impago, y la matriz no sostiene la medición que ordena la otra lectura.

**Necesita decisión del owner**: **no** para alinear los textos (corrección). **Sí** si la sonda 49
no llega a la matriz: en ese caso `DEC-SUB-019` quedaría apoyada sobre un dato sin fila `VERIFIED`,
y por la regla 3 de la matriz eso es una decisión sobre una fila `UNKNOWN`.

---

### F-8CB1-007 — La promo de *«primer cobro»* y la de *«N cobros»* no terminan nunca, y la que se re-aplica en una sucesión puede no aplicarse sin que nadie lo vea

**Qué se rompe.** El PDR exige descuentos de *primer cobro* y de *N cobros*. El descuento se aplica
mutando el monto en el proveedor. Pero el modelo **no guarda duración ni contador** (`promo_code` y
`promo_redemption` no los tienen), y **ninguna transición restituye el precio** cuando se agotan los
cobros. Cada promo acotada se vuelve `forever`: se regala de más, siempre. En la otra dirección,
`S18` re-aplica la promo mutando el monto de la sucesora (*«nace con el precio de lista»*) sin rama
de fallo, y el propio capítulo admite que *«ningún detector del diseño mira eso»*. Si esa mutación
no se aplica, Juan paga precio de lista sin fecha de fin.

**El camino.**

1. Juan canjea *«20 % los primeros 3 cobros»*. El monto se muta a 800.
2. Pasan tres cobros. No hay columna que cuente cuántos quedan ni transición que vuelva a 1000: Juan
   paga 800 para siempre.
3. Otra rama: Juan, con *«20 % forever»*, hace un upgrade. `S18` re-apunta la redención y manda la
   mutación sobre la sucesora. La llamada da timeout. No hay rama de fallo ni reintento, y el
   barrido compara contra el monto vigente, que es el de lista: Juan paga de más todos los meses.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/00-PDR.md:1445-1446`:

> - primer cobro;
> - N cobros;

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:413-414`:

> | **`promo_code`** | código, tipo, valor, scope de verticales, **cupo total**, ventana de validez, stackable, usable con otra activa (§31, `DEC-PROMO-001`) | `UNIQUE(codigo)` |
> | **`promo_redemption`** | código, user, cuándo, sobre qué suscripción |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:105`. El capítulo habla de un contador que el modelo no tiene:

> | el contador de **N cobros** | **sigue donde estaba**: cambiar de plan no consume un cobro |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:125-132`:

> ese monto vive en el preapproval de la predecesora, que `S17` acaba de cancelar. La sucesora
> nace con el precio de lista.
> [...] **el barrido no lo ve** [...] La divergencia es contra lo pactado, no contra el proveedor, y ningún
> detector del diseño mira eso.

**Severidad**: `ALTA`. Toda promo acotada pierde plata de forma sistemática, y la re-aplicación que
falla cobra de más sin detector. No es `CRITICA` porque el hueco se vuelve evidente al implementar
el contador, cosa que la re-aplicación que falla no hace.

**Necesita decisión del owner**: **no**. Es una corrección: agregar una columna de cobros restantes
con su escritor (el cobro confirmado), una transición que restituya el precio, y una rama de fallo
con marca para la mutación de `S18`.

---

### F-8CB1-008 — El addon de única vez no tiene mecanismo de cobro, ni idempotencia medida, ni dónde registrar el pago

**Qué se rompe.** `A2` dice sólo *«De única vez: su propio cobro»*. En el capítulo del proveedor no
hay contrato para ese cobro: sólo `preapproval`. La única vía medida sin preapproval es
`/v1/orders` (`EX-30`), que se midió **sólo en sandbox**, pide una tarjeta tokenizada (`EX-12` es
de un solo uso, `EX-9` pide el CVV) y cuya **idempotencia nadie midió**. El propio diseño advierte
que la idempotencia de este proveedor *«es POR ENDPOINT y no se razona de uno al otro»*. Además,
`payment` cuelga de una **suscripción**, y el addon de única vez no tiene ninguna. La conciliación
arma su inventario a partir de suscripciones y detecta huérfanas por *«un preapproval
desconocido»*, así que un pago de orden no lo ve nadie.

**El camino.**

1. Juan compra *«Boost 7 días»*. Se crea la orden y la respuesta da timeout.
2. El candado propio evita reenviarla a ciegas, pero la recuperación del `B/05` §1.2 pregunta por
   suscripciones autorizadas, y esto no es una suscripción. No hay forma declarada de saber si la
   orden cobró.
3. Si se reintenta, pueden salir dos órdenes, y no está medido que el proveedor deduplique. Si no se
   reintenta, entró plata que el sistema no registra: `payment` exige una suscripción y el barrido
   no mira órdenes.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2039`:

> | A2 | `PENDING_AUTHORIZATION` | se autoriza | `ACTIVE` | recurrente: su propio preapproval (`DEC-ADDON-002`). De única vez: su propio cobro |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/06-proveedor.md:186-187`:

> ⚠️ **La idempotencia de este proveedor es POR ENDPOINT y no se razona de uno al otro**

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:380` (`EX-30`, sandbox):

> **Consecuencia útil hoy**: un cobro de **única vez** —un addon, por ejemplo— no necesita ninguna habilitación especial ni pasa por `preapproval`.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:307`:

> | **`payment`** | suscripción, monto, moneda, estado del cap. 03 §6, **id del hecho en el proveedor**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:57-58`:

> **toda suscripción que cobra emite un webhook**, así que uno que
> llegue de un preapproval desconocido **es** la detección.

**Severidad**: `ALTA`. Hay un camino de cobro principal sin contrato, sin idempotencia medida (la
regla 2 del §61 prohíbe implementarlo así) y sin registro ni conciliación. Si se implementa tal
cual, puede cobrar dos veces o perder el pago.

**Necesita decisión del owner**: **sí**. Hay que elegir el mecanismo de cobro de única vez
(`/v1/orders`, un checkout u otro) y medir su idempotencia en producción antes de implementarlo.

---

## MEDIA

### F-8CB1-009 — El cambio de plan en grace ya no puede cumplir lo que `DEC-SUB-003` prometía: si el primer cobro del plan nuevo falla, la persona se queda sin nada

**Qué se rompe.** `B/03` §4 repite `DEC-SUB-003`: *«se intenta el cobro del plan nuevo de
inmediato; si falla, sigue en grace con el plan anterior»*. Pero `B/12` §5.2 obliga a que toda
sucesora cobre **después** de su ventana. Y `S17` mata a la predecesora apenas la sucesora
**autoriza**, no cuando cobra. Si ese primer cobro, que llega días después, se rechaza, corre `S16`
(`CHARGE_DECLINED`) sobre la sucesora. La predecesora ya está `CANCELLED` y la deuda vieja quedó
perdonada (`B/12` §5.3). No se cobra lo nuevo ni lo viejo, y se le rompe la promesa al cliente.

**El camino.** Juan está en grace y pide un downgrade. Autoriza (la validación es de ARS 0), `S17`
cancela la predecesora, y 72 h después se rechaza el primer cobro de la sucesora: `CHARGE_DECLINED`.
Juan tuvo el grace más la ventana de servicio sin pagar ni el período viejo ni el nuevo.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1287`:

> se intenta el cobro del plan nuevo de inmediato; si entra, vuelve a `ACTIVE` con el plan nuevo; si falla, **sigue en grace con el plan anterior y no cambia nada**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:339-340`:

> **Toda sucesora nace con fecha de primer cobro POSTERIOR AL VENCIMIENTO DE SU VENTANA DE
> AUTORIZACIÓN.**

**Severidad**: `MEDIA`. Es una contradicción entre textos, con un costo acotado (un período viejo
perdonado más la ventana).

**Necesita decisión del owner**: **sí**. `DEC-SUB-003` justificaba el permiso diciendo que *«si
falla se queda con el plan viejo y su deuda»*, y el mecanismo actual ya no puede cumplir esa
condición.

---

### F-8CB1-010 — *«El primer cobro rechazado cancela el preapproval»* se midió sólo con rechazos del antifraude

**Qué se rompe.** `S16` y la exención del barrido suponen que el proveedor cancela el preapproval
cuando rechaza el primer cobro. La única evidencia es de rechazos `cc_rejected_high_risk`. Un primer
cobro rechazado por fondos no se midió. Si ahí el proveedor recicla y no cancela, la condición de
`S16` no se cumple y corre `S4`: la fila entra en grace con 10 días de servicio, que es justo el
agujero *«diez días por ciclo, repetible»* que el `B/12` §4 vino a cerrar.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:66-68`:

> la
> cuota `7032034055` quedó en `status: recycling` con su pago en
> `rejected / cc_rejected_high_risk`.

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:197`:

> dos intentos de alta murieron por antifraude del proveedor (`cc_rejected_high_risk`), que cancela el preapproval en ~83 s.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:125`. La condición de `S4` es *«—»* también sobre el primer cobro:

> | S4 | `ACTIVE` | un cobro falla

**Severidad**: `MEDIA`. Es una afirmación del proveedor que la matriz no sostiene para todos los
motivos de rechazo. El costo es servicio entregado sin cobrar, no un cobro indebido.

**Necesita decisión del owner**: **no**. Es corrección de método: agregar una fila a la matriz y,
mientras tanto, que `S4` excluya el primer cobro de la autorización.

---

### F-8CB1-011 — `covered_period` le asigna al cobro del proveedor el período siguiente, y no dice qué pasa cuando un cobro que ya ocurrió choca con el `UNIQUE`

**Qué se rompe.** El período de un cobro del proveedor se resuelve con *«la fecha del próximo cobro
que él tiene»*. En el instante de acreditar, esa fecha **ya avanzó**: avanza incluso sobre un cobro
rechazado. Y el `C5` sólo resuelve al que llega segundo *«manual»*: *«falla, no compite»*. Un cobro
del proveedor ya pasó. Si su `P1` choca con el `UNIQUE` (un duplicado del proveedor, o un reintento
que se resuelve al período equivocado), no hay regla: o el pago no se puede registrar (plata sin
fila), o un doble cobro real queda sin marca.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:366-368`:

> **Y el período de un cobro del proveedor se resuelve igual que el del manual: por su fecha de
> inicio**, que con `DEC-MP-006` —el reloj es del proveedor— es la fecha del próximo cobro que él
> tiene.

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:5009`:

> `next_payment_date` avanzando igual sobre un cobro rechazado — `RN-3`, 2026-09-24)

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:175`:

> El registro manual que llega segundo **falla**, no compite.

**Severidad**: `MEDIA`. Dos implementadores leerían distinto qué fecha se usa y qué pasa con el
choque, y en una de las lecturas el pago queda sin registro.

**Necesita decisión del owner**: **no**. Es una corrección: tomar el período del
`authorized_payment` (`debit_date`, `EX-16`) y declarar que un choque en `P1` abre una marca de
dinero.

---

### F-8CB1-012 — La fecha de fin de servicio de `S11` no tiene fórmula, y la copia que la sugiere avanza sobre cobros que nunca entraron

**Qué se rompe.** `S11` *«guarda nuestra fecha de fin de servicio»* = *«fin del período pagado»*,
pero ningún texto dice de qué columna sale. `B/02` afirma que la copia de la fecha del próximo cobro
de un pagador con tarjeta *«ninguna regla la lee para decidir»*. Si alguien la usa, y es lo único
que tiene a mano, sobre una fila `ACTIVE` con un cobro en reintento (`B/12` §1.3) la fecha ya corrió
un ciclo sin pago. Juan pide la baja con el cobro rechazado y recibe un ciclo entero de servicio.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:132`:

> | S11 | `ACTIVE` | pide la baja | `CANCEL_SCHEDULED` | — | **se cancela en el proveedor de inmediato** y se guarda **nuestra** fecha de fin de servicio (`DEC-SUB-009`) |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:290`:

> **Ninguna regla del diseño la lee para decidir**, porque la decisión de

(La afirmación además es falsa: `B/12` §5.4 corta la ventana con *«la próxima fecha de cobro de la
predecesora»* y `B/02` §2.3 resuelve el período de `covered_period` con esa misma fecha.)

**Severidad**: `MEDIA`. Es una ambigüedad con costo de plata en una de sus lecturas.

**Necesita decisión del owner**: **no**. Es una corrección: la fecha de fin tiene que salir de los
pagos acreditados, igual que la forma congelada del `B/12` §5.2.

---

### F-8CB1-013 — Una cancelación en el proveedor que falla no la reintenta nadie: la baja termina fallando hacia seguir cobrando

**Qué se rompe.** `DEC-SUB-009` eligió *«cancelar ya»* porque su falla *«regala unos días»*. Pero
`S11`, `S22`, `S24` y `S13` llegan a su destino **aunque la llamada falle**, y nada la reintenta. El
barrido sólo relee, y lo que abre es una marca sin motivo de plata (`TRANSICIÓN_NO_DECLARADA`) o,
después del cobro, `COBRO_POSTERIOR_A_LA_BAJA`. Cada ciclo que nadie atiende es un cobro a quien
pidió irse, y se devuelve con una confirmación humana. Es exactamente la falla que la decisión
descartó.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:1247`:

> - Con **(B)** el fallo **regala unos días de servicio**, y se corrige sin mover un peso.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:145-147`:

> *Free Forever* cuya cancelación en el proveedor no se aplicó deja al beneficiario *«pagando todos
> los meses algo declarado gratis»* — **un hecho por ciclo**, y ninguna transición reintenta la
> llamada sola.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:141`. La salvedad 4 relee y no reintenta:

> | hasta que la relectura lo vea `cancelled`

**Severidad**: `MEDIA`. Se detecta en el día, y hasta el cobro siguiente suele faltar un ciclo, así
que el daño depende de que una persona actúe a tiempo.

**Necesita decisión del owner**: **sí**. Reintentar solo una cancelación que pidió el cliente es una
operación automática sobre el proveedor, y hay que decidir si entra en lo que `DEC-RF-002` excluye.

---

### F-8CB1-014 — La recuperación tras un timeout busca con un buscador medido como incompleto, y busca el estado equivocado

**Qué se rompe.** `B/05` §1.2 y `DEC-CONC-001` p.2 recuperan una creación sin respuesta preguntando
*«¿este pagador tiene alguna suscripción **autorizada** que yo no tenga registrada?»*, por
`payer_email` + `status`. `RC-1` midió en producción que el filtro por estado devuelve **un
subconjunto** (15 de 69) sin ninguna señal. Además, en el modelo del checkout una creación deja el
preapproval en `pending`, no `authorized` (`PA-1`), y un `pending` **no vence nunca** (`EX-1`). La
recuperación puede no encontrar la creación y dejar un huérfano eterno que `S3` no puede cancelar,
porque no tiene su id.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:57-58`:

> La que sí la tiene es **«¿este pagador tiene alguna suscripción autorizada que yo no
> tenga registrada?»**, por correo del pagador y estado, que sí filtran y se componen.

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:270` (`RC-1`):

> **En PRODUCCIÓN (2026-09-15, sonda 21) aparece un tercer defecto que el sandbox no tenía: el filtro devuelve un SUBCONJUNTO.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/09-conciliacion.md:642`:

> | **barrido de creaciones sin respuesta** | **cada pocos minutos** | es el estado intermedio de `DEC-CONC-001`: una creación que quedó sin respuesta puede haber cobrado

**Severidad**: `MEDIA`. En el modelo del checkout el huérfano no cobra si nadie tiene su enlace, así
que el daño es acotado. Pero el mecanismo contradice la matriz y apunta a un riesgo (*«puede haber
cobrado»*) que ese camino ya no tiene.

**Necesita decisión del owner**: **no**. Es corrección: buscar `pending` y no dar por cerrada una
búsqueda vacía.

---

### F-8CB1-015 — El reembolso no tiene máquina de estados, y el *«camino manual»* no tiene fila

**Qué se rompe.** `refund` tiene una columna *«estado»* sin valores ni transiciones: `P3` y `P4` son
de `payment`. Hay dos devoluciones que ocurren **fuera** del proveedor y ninguna tiene un acto
declarado que escriba la fila: la de un `manual_payment` (una transferencia) y la de un cobro más
viejo que el plazo (`DEC-RF-007`, *«cae al camino manual»*). Por la regla 1 del núcleo, eso produce
reembolsos que salen sin fila, o filas de reembolso que nadie cierra.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:308`:

> | **`refund`** | **el pago que se devuelve —un `payment` o un `manual_payment`—**, monto, motivo, estado, quién lo confirmó |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/06-proveedor.md:216-217`:

> real por debajo o por encima de los 180 días, **los dos desenlaces caen al mismo camino manual**.

**Severidad**: `MEDIA`. Dos implementadores lo escribirían distinto, y está en juego plata que se
devuelve.

**Necesita decisión del owner**: **no**. Es corrección: declarar la máquina de `refund` y el acto
que registra una devolución hecha por fuera del proveedor.

---

### F-8CB1-016 — Un aumento de precio sobre una suscripción con promo no dice sobre qué monto se aplica

**Qué se rompe.** El descuento vive **mutado en el monto** del proveedor, y el aumento del
`DEC-MP-002` también se ejecuta mutando el monto. Ningún texto dice si el aumento parte del precio de
lista o del monto con descuento, ni si vuelve a aplicar la promo. Mutar al precio nuevo de lista
borra la promo sin avisar, y ahí se cobra de más.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:1327`:

> 2. **El precio vive en la suscripción, no sólo en el plan.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/14-promos-cortesias-y-grants.md:468`. Lo único que el capítulo deja abierto es el cruce con la mora, no con la promo:

> - **Qué pasa si la fecha de un aumento cae sobre una suscripción en mora o en grace** sigue

**Severidad**: `MEDIA`.

**Necesita decisión del owner**: **sí**. Si el aumento alcanza o no al precio con descuento es una
política comercial.

---

## BAJA

### F-8CB1-017 — La tabla de desempate de motivos del pago tardío no nombra `S21`, `S25` ni `S27`

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:261`
enumera las cancelaciones *«nuestras»* como *«`S11`/`S12`, `S17`, `S22`, `S23`, `S24` o el
espejo»*. Un cobro en vuelo que entra sobre una fila que cancelaron `S21`, `S25` o `S27` no cae en
ninguna fila. Los tres motivos devuelven plata, así que el cliente no pierde nada: lo que queda
indefinido es qué ve la persona que resuelve.

### F-8CB1-018 — Textos vencidos sobre `GR-3`

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:207` (*«`GR-3` … «sigue
`UNKNOWN`»»*) y `.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:108` y `:841`
dicen que `GR-3` está `UNKNOWN`. La matriz la da `VERIFIED` desde el 2026-09-22 (`GR-3`). Es sólo
de registro: el efecto de fondo va en F-8CB1-006.

---

## Ataques que intenté y el diseño resistió

- **Dos preapprovals por el alta nueva que `B/12` §4.4 ofrece tras un primer cobro rechazado con
  sucesión en curso.** Lo para el segundo evento de `S18`: la sucesora pasa a ocupar el candado
  `A` (`B/03` §3.2, *«Por qué `S18` también sale de `PENDING_AUTHORIZATION`»*).
- **Doble clic o reintento del alta.** El candado `A` incluye `PENDING_AUTHORIZATION`, así que el
  segundo `INSERT` lo rechaza la base (`B/03` §3.4 punto 4).
- **`S3` cancela a quien acaba de autorizar.** `S3` relee por id y, si ve `authorized`, corre `S2`
  (`B/03:124`, `:1244-1248`).
- **La fecha futura de la sucesora convertida en free trial se agota al segundo cambio de plan
  (patrón de `EX-29`).** `EX-33` lo midió tres veces sobre el mismo pagador y sin plan: no se
  agota.
- **El cobro reciclado de la predecesora durante la sucesión reactiva y deja dos vivas.** `S19` lo
  retiene, y las seis ramas del `B/12` §5.3 lo resuelven con una marca de devolución.
- **Doble reembolso por reintento.** `X-Idempotency-Key` es obligatorio y se respeta (`RF-4`,
  `RF-6`, `B/06` §4.6), y la clave se persiste antes (`DEC-CONC-001`).
- **Pago manual contra otro pago manual del mismo período.** Lo impide el `UNIQUE` de
  `covered_period` (`B/05` §C5). Lo que queda abierto es el caso del cobro del proveedor
  (F-8CB1-011).
- **La pausa pedida por el cliente regala días (mensual).** Se compensa sola en meses enteros
  (`DEC-SUB-010`), e `puedePausar()` exige ciclo mensual. La cortesía no pasa por ahí
  (F-8CB1-001).
- **Un *Free Forever* cuya cancelación falla y sigue cobrando sin que nadie lo vea.** La salvedad 4
  y la tercera comprobación del `B/09` §3 lo detectan. El reintento no existe (F-8CB1-013), pero
  la detección sí.

## Fuera de mi vector

- **B2 (carreras):** `S8`/`S9` mandan la pausa al proveedor fuera de la transacción (`NUCLEO/03`
  §1 regla 3), y el par `paused` × `ACTIVE` dispara `S6` sin mirar si la pausa la pedimos nosotros
  (`B/03:2240`). Si el webhook de la pausa se procesa antes de la escritura local de `PAUSED`, el
  cliente que pidió pausar termina `SUSPENDED` y con el preapproval cancelado. El texto de `S6`
  dice *«sin haberlo pedido nosotros»* (`B/03:127`), pero no hay columna ni orden que lo haga
  evaluable.
- **D1 (coherencia):** *«la sonda 49 midió»* (`01-decision-log.md:5001`, `B/03:1283`, `B/12:87`,
  `B/09:660`) contra *«está bloqueada»* (`06-mp-validation-matrix.md:197`). Es la matriz
  desactualizada o la decisión apoyada en algo que no está medido. Lo toqué en F-8CB1-006 sólo por
  su efecto de plata.

## Key Learnings

1. El proveedor saltea **ciclos enteros** estando en pausa (`PS-6`) y no mueve la fecha al reanudar
   (`PS-5`). Todo instrumento que se implemente pausando (cortesía, promo bajo el piso, cortesía
   diferida re-emitida) vale lo que valen las fechas que cruza, no los días que declara. Sobre
   ciclos no mensuales, eso es un año.
2. Varias garantías se escriben sobre el instante en que algo pasa **en el proveedor** (autorizar
   antes del corte, un cobro en vuelo en `S6`) y se ejecutan en el instante en que **nos
   enteramos**. Con `WH-2` midiendo demoras de días, toda garantía de este tipo necesita una
   relectura por id atada a la hora del lote `:02`, no a un job sin cadencia.
3. La vuelta del suspendido con tarjeta quedó sin camino ejecutable. `DEC-SUB-019` la define como
   sucesión y `G-R1-A` prohíbe declararla desde `SUSPENDED`. Cuando un arreglo cambia el camino de
   salida de un estado, hay que volver a pasar los guards del estado de origen.
4. El modelo de promos no tiene duración ni contador, aunque el PDR exige *primer cobro* y *N
   cobros*, y el capítulo habla de un contador que no existe en ninguna columna.
5. Prosa contra tabla: el §4 de `B/03` bloquea `S6` durante cualquier sucesión y la fila sólo
   bloquea el segundo evento. La lectura de la prosa habilita servicio infinito redeclarando
   sucesiones. El guard `G-R4` no ve contradicciones entre prosa y tabla.
6. El cobro de única vez (`A2`) es un camino de plata sin contrato, sin idempotencia medida sobre
   `/v1/orders` y sin entidad donde registrarse. Es el hueco más grande del lado de los addons.
