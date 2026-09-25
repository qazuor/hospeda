---
title: "FASE 8 completa · B2 — máquinas, idempotencia y carreras (lado billing)"
linear: HOS-1352
statusSource: linear
created: 2026-09-24
updated: 2026-09-24
status: CURRENT
fase: 8
---

# FASE 8 completa · B2 — máquinas, idempotencia y carreras (lado billing)

Ataqué las máquinas de billing (`B/03`), los cruces de concurrencia (`B/05`), el camino de mora y de
sucesión (`B/12`), la regla de no-retroceso (`B/03` §10) y el outbox (`NUCLEO/07`), buscando
transiciones que ningún evento dispara, pares que dos filas reclaman, efectos remotos que fallan sin
rama, disparadores que se pisan (webhook × reloj × admin × cliente) y afirmaciones sobre el proveedor
que la matriz no sostiene.

**Catorce hallazgos: 2 `CRITICA`, 5 `ALTA`, 5 `MEDIA`, 2 `BAJA`.** Los dos críticos son del mismo
tipo: una regla escrita en un capítulo que otro capítulo no ejecuta. El más grave en una línea:
**el correo que `DEC-MAIL-001` pone como condición antes de cancelar lo puede suprimir para siempre
la jerarquía del `NUCLEO/07` §4.2, y entonces la predecesora de un cambio de plan no se cancela nunca
y las dos suscripciones cobran**. El segundo: con la definición de `FAILED` de `B/12` §1.3, un
pagador con tarjeta **no entra nunca a `GRACE_PERIOD`**. El proveedor pausa en el mismo instante en
que se rinde, y eso dispara `S6`.

Regla de lectura: cada hallazgo se apoya en una cita textual. Donde una medición de la matriz
sostiene el ataque, va su id de fila.

---

## CRITICA

### F-8CB2-001 — Un rebote duro bloquea para siempre la cancelación de la predecesora, y las dos suscripciones cobran

**Qué se rompe.** Plata real cobrada dos veces por ciclo, sin que nada lo detecte. La cancelación
de la vieja depende de un correo. La jerarquía de supresión puede impedir ese correo para siempre, y
la tabla de transiciones que ejecuta la cancelación no sabe que depende de él.

**El camino.**

1. Tiempo atrás, un correo transaccional a Juan rebotó en duro: la casilla está llena o el dominio
   tiene un error de tipeo.
2. Juan pasa de mensual a anual. La sucesora nace con fecha de primer cobro posterior a su ventana
   (`D8`) y Juan la autoriza.
3. Llega el webhook de autorizada. Por `DEC-MAIL-001` la secuencia es *webhook → correo →
   cancelar*, y el correo *«que precede a una cancelación»* tiene que salir antes de `S17`.
4. `NUCLEO/07` §4.2 fila 1: el rebote duro suprime **todo, incluso lo transaccional**. El correo
   nunca sale y la cancelación *«no se ejecuta y se reintenta»*, indefinidamente.
5. La predecesora sigue `ACTIVE` con su preapproval `authorized`, y su renovación cobra como
   cualquier otra. Cuando llega la fecha del primer cobro de la sucesora, cobra la anual. Desde ahí,
   **dos cobros por el mismo `user + vertical`** (`EX-6`: el proveedor no frena la segunda).
6. Nada lo ve. El barrido compara `ACTIVE` contra `authorized` y le da igual (`B/09` §3). La
   comprobación `SUCESIÓN_ABIERTA_SOBRE_FILA_MUERTA` exige una predecesora muerta, y ésta está viva.
   La renovación de la predecesora no es un *«pago tardío»*, así que la condición 3 de `B/05` §3 no
   se evalúa.

**El segundo camino es el que cae si la regla no se lee sólo para el cambio de plan.**
`DEC-MAIL-001` dice *«antes de **cancelar**»* sin acotarlo a `S17`. `S6`, sobre un pagador con
tarjeta, cancela el preapproval (`DEC-SUB-019`), y si la cancelación no sale *«`S6` no ocurre»*. Así
que un moroso con rebote duro se queda en `GRACE_PERIOD` **para siempre y con servicio entero**.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:1496` (`DEC-MAIL-001`):

> **cancelar**, sí; antes de mutar un monto, no. Si el correo no sale, la cancelación no se

`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:1508`:

> webhook → correo → cancelar, y si el correo falla **no se cancela y se reintenta**. El estado

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:146` §4.2:

> | 1 | **rebote duro** | **todo**, incluso lo transaccional | la dirección no existe: no hay a quién mandarle |

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:190` §5.3:

> cancelación de la vieja ocurre cuando llega el webhook de que la nueva quedó autorizada, que

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:138`. La fila `S17` no
nombra ningún correo en su condición ni en sus efectos:

> | la fila tiene una **sucesora viva** con `sucede_a` apuntándola | **se cancela en el proveedor si su preapproval sigue vivo** (es `D7`)

Busqué la condición del correo en la épica de billing (`rg 'bloquea|antes de cancelar'` sobre
`HOS-1354…/docs`) y no aparece ni en la tabla ni en ningún capítulo. La compuerta vive sólo en
`NUCLEO/07` y en el log. Hay además un problema de modelo: el outbox *«se encola dentro de la
transacción de dominio, y se manda afuera»* (`NUCLEO/07` §1.1). Si `S17` encola el correo, ya
escribió `CANCELLED` antes de saber si sale. Ningún estado de la tabla representa *«autorizada, correo
pendiente, cancelación pendiente»*.

**Severidad**: `CRITICA`. Es doble cobro con dinero real, sin detector y sobre el mecanismo más caro
del sistema. Hay dos lecturas, y ninguna es segura: quien implementa `S17` como está escrita viola
`DEC-MAIL-001`, y quien implementa la compuerta produce el doble cobro.

**Necesita decisión del owner**: **sí**. Hay que decidir qué pasa cuando el correo *no puede* salir,
que es distinto de *no salió todavía*. Eso toca `DEC-MAIL-001` y la jerarquía de supresión, y es
política, no redacción.

---

### F-8CB2-002 — Con la definición de `FAILED` de `B/12`, un pagador con tarjeta nunca entra al grace: el proveedor pausa y `S6` suspende sin grace

**Qué se rompe.** La operación de retención del §20 (grace con servicio entero y avisos) no se
ejecuta nunca para el pagador con tarjeta. Según cómo se lea, pasa una de dos cosas: el cliente queda
`ACTIVE` sin pagar durante toda la ventana del proveedor, o queda suspendido y con el preapproval
cancelado sin haber pasado un solo día por `GRACE_PERIOD` ni recibido ningún aviso del grace.

**El camino.**

1. El 1/11 rebota la renovación de Juan (tarjeta). `B/12` §1.3 dice que, mientras el proveedor
   reintenta, el pago es `PENDING` y la suscripción *«sigue `ACTIVE`»*.
2. `FAILED` —el evento de `S4` vía `P2`— se define como *«el proveedor se dio por vencido»*. La
   matriz mide que ese instante (`scheduled → processed`) **no emite ningún evento** (`GR-3`).
3. La matriz también mide que el proveedor **pausa el preapproval 80-105 s antes** de que venza la
   ventana (`GR-3`), y que la pausa sí avisa (5 de 5).
4. Llega `subscription.updated`. Al releer, `paused` contra `ACTIVE` lleva a **`S6` por su segundo
   evento**: `SUSPENDED` y cancelación del preapproval (`B/03` §10.1).
5. `S4` no llegó a correr: su evento no tiene disparador, y cuando podría tenerlo la fila ya no está
   en `ACTIVE`. El grace de 10 días, sus correos *«relativos al vencimiento»* y la recuperación por
   `S5` quedan sin población.

La otra lectura —grace desde el primer rechazo, que es la que usa `DEC-SUB-019`— contradice
textualmente a `B/12` §1.2. Dos implementadores construyen dos productos de dunning distintos.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:42` §1.2:

> **El reloj del grace arranca cuando el proveedor deja de reintentar, no cuando falla un

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:62` §1.3:

> **`FAILED` significa «el proveedor se dio por vencido», no «un intento salió mal».** Con esa

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1370` §6:

> | P2 | `PENDING` | el proveedor rechaza | `FAILED` | dispara S4 si era el cobro de una suscripción `ACTIVE` |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2240` §10.1:

> | `paused` | `ACTIVE` · `GRACE_PERIOD` | **`S6`**, por su segundo evento: el proveedor pausó por mora y nosotros no lo sabíamos

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:197` (`GR-3`,
`VERIFIED`):

> la transición final del ciclo fallido —`scheduled` → `processed`, el instante en que el proveedor se rinde— **no emite ningún evento**

y, en la misma fila, *«la pausa cayó **entre 80 y 105 segundos ANTES** del `expire_date`»*.

La lectura opuesta, en el log
(`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:5028`, `DEC-SUB-019`):

> plata el día 15 ya no se le cobra solo: tiene que volver por el checkout. **Durante el grace nada

(continúa en :5029: *«cambia**: un reintento que entra ahí sigue devolviendo la fila a `ACTIVE` por
`S5`»*). Eso presupone un grace que corre **mientras** el proveedor todavía reintenta, que es
exactamente lo que `B/12` §1.2 prohíbe.

**Severidad**: `CRITICA`. En la lectura del capítulo dueño del tema (`B/12`), una operación
principal —el grace del §20 para toda la población con tarjeta— es inejecutable. Además, la
restricción de `DEC-SUB-019` (*«grace < ciclo»*) queda sin efecto, porque presupone que el grace
empieza en el primer rechazo.

**Necesita decisión del owner**: **no**. Es una corrección de diseño: `B/12` §1.2-1.3 no se
actualizó cuando `DEC-SUB-019` y `DEC-MP-008` cambiaron el modelo. Pero la corrección tiene que
nombrar cuál es el evento de `S4` para la tarjeta, porque hoy no hay ninguno medido que lo dispare.

---

## ALTA

### F-8CB2-003 — Una pausa que el proveedor aceptó y no aplicó se «espeja» como reanudación: la cortesía se corta sola y el cobro durante ella no se marca

**Qué se rompe.** `S8` y `S9` no tienen rama de fallo ni verificación por relectura (`D5`). La tabla
del §10.1 lee *«`authorized` contra `PAUSED`»* como *«el proveedor reanudó»* y ejecuta `S10`. El
cliente al que `SUPER_ADMIN` le regaló días termina pagándolos, y nadie abre un caso.

**El camino.**

1. `SUPER_ADMIN` le otorga a Juan una cortesía de 2 meses: `S9` lleva la fila a `PAUSED` (`COURTESY`)
   y *«se pausa en el proveedor»*.
2. El `PUT paused` devuelve `200` y no se aplica. Es la familia de fallas que `EX-20` y el §10.4
   documentan: aceptar y no aplicar.
3. `S9` no relee, así que la fila queda `PAUSED` y el preapproval `authorized`.
4. El proveedor cobra la renovación. Con el webhook del cobro (o en el barrido del día), la relectura
   da `authorized` contra `PAUSED`, y la tabla dice **`S10`**. La cortesía termina y la fila vuelve a
   `ACTIVE`.
5. El cobro entró sobre días regalados. El motivo `COBRO_DURANTE_CORTESÍA` existe sólo para el tramo
   *«entre `S2` y la re-emisión»*, así que **no se abre ninguna marca**. Con `CUSTOMER_REQUEST` el
   mismo camino le consume a Juan una pausa de sus topes (`DEC-SUB-004`), aunque la pausa nunca
   ocurrió.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:129`:

> | S8 | `ACTIVE` | la persona pide pausar | `PAUSED` *(motivo `CUSTOMER_REQUEST`)* | `puedePausar()` (capítulo 01 (núcleo) §3) | se pausa en el proveedor; se elige en **meses enteros** (`DEC-SUB-010`) |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2238`:

> | `authorized` | `PAUSED` | **`S10`**: el proveedor reanudó. Espejar — y acá la condición de `S10` ya está cumplida, porque **esta lectura ES la relectura** que la fila pide.

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:771`:

> | 12 | `COBRO_DURANTE_CORTESÍA` | `S14`, cuando el proveedor cobra **entre `S2` y la re-emisión de una cortesía diferida** (`S9`, `DEC-GRANT-007`) |

`D5` (`nucleo/04-invariantes.md:131`) exige que *«toda mutación en el proveedor se verifica
releyendo»*. `S10`, `S17` y `S6` tienen rama de fallo escrita; `S8` y `S9` no. El `rg` de `S8` en
`HOS-1354…/docs` no encuentra rama de fallo en ningún lado.

**Severidad**: `ALTA`. Es plata cobrada sobre días regalados, sin marca. Está acotado a las pausas
cuyo `PUT` no se aplicó, y la persona lo puede reclamar.

**Necesita decisión del owner**: **no**. Es corrección: rama de fallo en `S8`/`S9` como la de `S10`,
y que el par `authorized`/`PAUSED` distinga *«nunca se pausó»* de *«se reanudó»*.

---

### F-8CB2-004 — El cobro en vuelo que reactiva por `S7` cae sobre un preapproval que `S6` ya canceló, y el espejo lo cancela al día siguiente con la plata adentro

**Qué se rompe.** El diseño declara el borde y su destino (`S7`), pero no mira qué deja atrás:
queda una fila `ACTIVE` con preapproval `cancelled`. La tabla del §10.1 manda espejar eso como baja
del proveedor. Juan pagó un mes entero, recibe horas de servicio, y no queda ninguna marca de
reembolso.

**El camino.**

1. Juan (tarjeta) está en `GRACE_PERIOD`. Vence el reloj y `S6` consulta el `B/09` §4, que todavía
   no ve el cobro, cancela el preapproval y pasa la fila a `SUSPENDED`.
2. El reintento del proveedor ya estaba en vuelo y se acredita. Es el borde que `S7` nombra.
3. Las cuatro condiciones de `B/05` §3 se cumplen (`SUSPENDED`, monto correcto, sin otra fila viva,
   sin otro pago del período). `S7` lleva la fila a `ACTIVE` y *«se restituye la publicación»*.
4. En la próxima relectura —el webhook o el barrido diario— la tabla ve `cancelled` contra `ACTIVE`,
   sin baja programada, y ordena **espejar la baja decidida por el proveedor**: `CANCELLED`.
5. El período que Juan pagó queda sin servicio. El espejo es una transición declarada, no una
   divergencia, así que no pasa por `S14`. `COBRO_POSTERIOR_A_LA_BAJA` no aplica porque el cobro es
   **anterior** al espejo. Nadie propone devolver nada.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:128` (`S7`):

> un pagador con tarjeta **no vuelve por acá**: `S6` le canceló el preapproval (`DEC-SUB-019`), así que vuelve por el checkout como **sucesora** (`S1` → `S2` → `S17`), y `S7` sólo lo alcanzan los bordes —un cobro en vuelo en el instante de `S6`, un preapproval reactivado a mano—

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2243`:

> | `cancelled` | cualquier estado vivo que no sea `CANCEL_SCHEDULED` ni `SUSPENDED` | **`S12`** si hay una baja programada; si no, **espejar la baja decidida por el proveedor** (`B/12` §1.4) |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:226`. La
condición 1 no pregunta si queda una autorización que pueda cobrar:

> | 1 | la suscripción existe y está en `GRACE_PERIOD` o `SUSPENDED` | si está `CANCELLED`, `ABANDONED` o ya `ACTIVE`, el pago no la reactiva |

**Severidad**: `ALTA`. Es plata cobrada sin servicio y sin marca, pero sobre un borde que el propio
diseño acota: un cobro en vuelo en el instante de `S6`.

**Necesita decisión del owner**: **sí**, en parte. Qué recibe quien paga un período sobre una
autorización ya cancelada (reembolso por marca, o servicio hasta el fin del período pagado) es
política. Que no quede sin ningún destino es corrección.

---

### F-8CB2-005 — La cuota `AWAITING` de un pagador manual queda huérfana cuando la suscripción sale del grace por cualquier camino que no sea `S5`/`S6`

**Qué se rompe.** Queda un estado sin salida en la máquina del pago manual. Además, las acciones que
el admin tiene sobre esa cuota disparan transiciones no declaradas o escriben sobre una suscripción
muerta: avanzan la fecha del próximo cobro y el cliente cancelado recibe avisos de *«renovación por
venir»*.

**El camino.**

1. Juan, pagador manual, está en `GRACE_PERIOD` con su cuota del período en `AWAITING` (`MP5`
   cláusula *(a)* + `S4`).
2. Juan pide la baja. `S24` lo lleva a `CANCELLED` y *«apaga el reloj del §4»*. Lo mismo pasa si le
   cae un grant (`S13`), si se discontinúa la vertical (`S26` → `CANCEL_SCHEDULED`) o si era la
   predecesora de un cambio de plan que se consumó (`S17`).
3. Ninguna de esas filas cierra la cuota. La única salida automática de `AWAITING` es `MP3` por
   *«se agota el grace»*, y ese reloj ya no corre. La cuota queda `AWAITING` para siempre.
4. El admin, que recibió el aviso del §30 sobre esa cuota, actúa:
   - **`MP2`** declara el impago, y su efecto es *«la suscripción va a `SUSPENDED` por `S6`»*
     **desde `CANCELLED`**. Por la regla 1 no se ejecuta y va a la marca
     `TRANSICIÓN_NO_DECLARADA`.
   - **`MP1`** (Juan transfirió) registra, escribe `covered_period` y *«avanza un ciclo la fecha del
     próximo cobro»* de una fila `CANCELLED`. De esa fecha cuelga la campaña *«renovación por
     venir»* (`NUCLEO/07` §6), así que Juan, que se dio de baja, recibe dos avisos pidiéndole que
     transfiera.
5. Lo mismo pasa con la **primera** cuota: `S13` alcanza a filas en `PENDING_AUTHORIZATION` pero, a
   diferencia de `S3` y `S28`, no la cierra.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1398` (`MP3`):

> | MP3 | `AWAITING` | se agota el grace sin que el admin haga nada — **o, sobre la PRIMERA cuota, se agota la ventana de autorización y `S3` se lleva la fila a `ABANDONED`**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1397`:

> | MP2 | `AWAITING` | el admin confirma que no se pagó | `DECLARED_UNPAID` | la suscripción va a `SUSPENDED` por `S6`, sin esperar el reloj |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:145` (`S24`, efecto):

> **Apaga el reloj del §4**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1738`, que sólo cubre la
primera cuota y sólo por `S3`:

> queda cerrada por la segunda cláusula de `MP3`, para que no sobreviva un `AWAITING` colgando de una

Un `rg AWAITING` sobre `HOS-1354…/docs` no encuentra ningún cierre de la cuota en `S13`, `S17`,
`S24` ni `S26`.

**Severidad**: `ALTA`. Deja un estado huérfano, una transición no declarada en el camino normal del
admin, y avisos de cobro a un cliente dado de baja. Se recupera a mano.

**Necesita decisión del owner**: **no**. Es corrección: extender la segunda cláusula de `MP3` a toda
salida de la suscripción de las filas vivas.

---

### F-8CB2-006 — El primer cobro rechazado lo reclaman tres filas, y el orden de llegada decide entre `GRACE_PERIOD`, `CHARGE_DECLINED` y `CANCELLED`

**Qué se rompe.** Se rompe la regla 7 del núcleo (guardas disjuntas) y la promesa del §10.1 de que
*«dos webhooks que lleguen al revés producen el mismo resultado»*. Si gana `S4`, vuelve el abuso de
*«diez días por intento»* que `B/12` §4.3 cerró.

**El camino.**

1. Juan autoriza, y a los ~26 min su primer cobro se rechaza. El proveedor cancela el preapproval en
   el mismo milisegundo (`B/12` §4.4).
2. Tres filas de la tabla reclaman el hecho:
   - **`S4`** sale de `(ACTIVE, un cobro falla)` y su condición es **`—`**. Un primer cobro rechazado
     es un cobro que falla, así que Juan entra al grace con servicio entero.
   - **`S16`** sale de `(ACTIVE, el primer cobro se rechaza)` → `CHARGE_DECLINED`.
   - **El espejo**: si el `subscription.updated` de la cancelación se procesa antes que el evento del
     pago (`WH-2`: demoras de 0,6 s a días), la relectura da `cancelled` contra `ACTIVE` sin baja
     programada, y se espeja → `CANCELLED`.
3. Con `S4`, Juan tiene diez días gratis por intento. Con el espejo, la fila termina en `CANCELLED`
   en vez de `CHARGE_DECLINED`, y el correo de `DEC-MP-004` —el que distingue antifraude de tarjeta—
   no sale.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:125` (`S4`, cuya columna de
condición es `—`):

> | S4 | `ACTIVE` | un cobro falla

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:137`:

> | S16 | `ACTIVE` | el **primer** cobro se rechaza | `CHARGE_DECLINED` | **es el primer cobro DE ESA autorización**, y el proveedor la canceló al rechazarlo |

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:63`:

> 7. **Dos filas que comparten `(desde, evento)` tienen guardas disjuntas.**

y :88-89: *«**Que sean cuatro y no cinco no es una afirmación de este capítulo: es lo que `G-R4`
cuenta en cada PR**»*. Si `G-R4` compara el texto del evento, `S4`/`S16` pasan como pares distintos
porque tienen redacciones distintas, pero semánticamente se solapan. La fila `cancelled` del §10.1
(`B/03`:2243) tampoco excluye el caso *«primer cobro de esa autorización»*.

**Severidad**: `ALTA`. Rompe un camino real (el alta que no cobra) y reabre un abuso que se había
cerrado. Está acotado a la ventana del primer cobro.

**Necesita decisión del owner**: **no**. Es corrección: `S4` necesita *«no es el primer cobro de esa
autorización»*, y el par `cancelled`/`ACTIVE` necesita deferir a `S16`.

---

### F-8CB2-007 — La duración de la ventana del proveedor sobre la que se apoya el grace no está en la matriz, y la matriz dice que puede ser 24 h fijas

**Qué se rompe.** Si la ventana de reintentos es de 24 h y no *«un ciclo»*, el proveedor pausa a Juan
un día después del rechazo. `S6` suspende por el segundo evento, y el grace configurado (10 días)
dura, en la práctica, **un día**. La restricción *«grace < ciclo»* no protege nada.

**El camino.**

1. El plan mensual de Juan tiene grace de 10 días, validado contra el ciclo de 30 como pide
   `DEC-SUB-019`.
2. La renovación rebota. Si la ventana es de 24 h (lo único medido, sobre sujetos de `frequency: 1
   days`), el proveedor pausa a las ~24 h.
3. `paused` contra `GRACE_PERIOD` dispara `S6`: `SUSPENDED` más la cancelación del preapproval, a
   nueve días de lo que prometen el correo y la pantalla del grace.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1283` §4:

> y **siempre menos que el ciclo de esa versión** (`DEC-SUB-019`): el proveedor reintenta durante **un ciclo** (sonda 49) y después pausa

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:197` (`GR-3`):

> los cinco ciclos son de sujetos con **`frequency: 1 days`**, así que *«ventana de 24 h»* y *«ventana de un ciclo»* **son indistinguibles acá**. La [sonda 49](./mp-probes/probe-49-la-ventana-de-reintentos.mjs) existe para separarlas con un sujeto de `2 days` y **está bloqueada**

Ni `rg 'sonda 49|48,0 h'` ni `RC-7` registran en la matriz el resultado de 48 h que cita el log. El
log mismo lo declara extrapolación
(`.specs/HOS-1352-billing-verticals-redesign/docs/01-decision-log.md:5004`):

> misma regla.** Para un plan mensual es extrapolación —~30 días—, y para uno anual daría un año,

**Severidad**: `ALTA`. Toda la población con tarjeta depende de este número. Rompe la promesa del
grace, pero no hay pérdida de plata del cliente.

**Necesita decisión del owner**: **no**. Hay que llevar a la matriz la medición de la sonda 49 (o
volver la fila `UNKNOWN` para ciclos mensuales) y condicionar `S6`/segundo evento a ella.

---

## MEDIA

### F-8CB2-008 — `B/03` §4 dice que durante una sucesión `S6` no corre; la fila `S6` y `B/12` §5.3 dicen que sí

**Qué se rompe.** Dos implementadores deciden distinto si a una predecesora en grace, con el
checkout de su cambio de plan abierto, se la suspende por reloj. Si se la suspende, en tarjeta se le
cancela el preapproval (`DEC-SUB-019`), se cierra la puerta del reciclado de `S19` y pierde la
cobertura mientras la sucesora todavía no la emite.

**El camino.** Juan está en `GRACE_PERIOD` (día 8 de 10) y pide cambiar de plan. La sucesora queda en
`PENDING_AUTHORIZATION` por 72 h. El día 10 vence el reloj. No hay pago pendiente por `S19` y es el
primer evento, así que según la fila `S6` corre. Según `B/03` §4, no.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1274`:

> `S13`, si la fila es la predecesora de una sucesión que se consuma o le cae un grant. **Mientras
> esa sucesión esté en curso, ni `S5` ni `S6` se ejecutan**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:127` (`S6`). La condición
por sucesión se limita al segundo evento:

> **Y por el segundo evento, `S6` no ocurre mientras la fila sea la predecesora de una sucesión en curso**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:454`:

> la ventana dura hasta vencer —**72 h o 7 días corridos**, `B/03` §3.4 punto 1— y el reloj del grace la puede pasar a `SUSPENDED` por `S6` antes de que

**Severidad**: `MEDIA`. Es una contradicción directa entre dos lugares del mismo corpus.

**Necesita decisión del owner**: **sí**. La decisión del 2026-09-24 cubrió sólo el segundo evento, y
extenderla al reloj es política.

---

### F-8CB2-009 — `MP2` dispara `S6` con un evento que `S6` no declara

**Qué se rompe.** Por la regla 1, el acto del admin *«confirmo que no se pagó»* no suspende: abre una
marca `TRANSICIÓN_NO_DECLARADA` sobre el camino normal del pagador manual. La suscripción sigue con
servicio entero hasta que vence el reloj.

**El camino.** Un admin declara el impago de Juan (manual) el día 2 del grace. `MP2` ordena *«`S6`,
sin esperar el reloj»*. Los eventos de `S6` son dos: *«se agota el reloj»* y *«se lee `paused`»*.
Ninguno es el acto del admin.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:1397`:

> | MP2 | `AWAITING` | el admin confirma que no se pagó | `DECLARED_UNPAID` | la suscripción va a `SUSPENDED` por `S6`, sin esperar el reloj |

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:127` (`S6`, columna evento):

> se agota el reloj — **o se lee `paused` en el proveedor sin haberlo pedido nosotros**

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/03-maquinas-de-estado.md:34`:

> 1. **La tabla de transiciones es exhaustiva.** Lo que no está, no pasa.

**Severidad**: `MEDIA`. Un implementador lo resuelve agregando el evento y otro lo resuelve
respetando la regla 1. No hay plata en juego.

**Necesita decisión del owner**: **no**.

---

### F-8CB2-010 — La tabla de espejo omite los pares que coinciden, y su propia regla los convierte en divergencia

**Qué se rompe.** La tabla del §10.1 declara que *«lo que no figura acá es divergencia real»*, y no
lista `authorized`/`ACTIVE` ni ningún par sobre un estado terminal. Leída literalmente, cada
renovación normal marca, y cada cancelación directa (`S13`, `S22`–`S25`, `S27`, `S3`, `S28`, `S16`)
marca cuando llega su `subscription.updated` (`EX-15`: cancelar **sí** notifica). El canal donde
viven los seis motivos de devolución se inunda, que es el riesgo que el invariante 21 nombra.

**El camino.** Juan pide la baja estando pausado (`S22` → `CANCELLED`). Segundos después llega el
`subscription.updated` de la cancelación, con una `version` mayor a la última aplicada, porque `S22`
no confirma por relectura (`B/09` §3). Se relee: `cancelled` contra `CANCELLED`. El par no está en la
tabla, así que se marca.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2246`:

> > Lo que **no** figura acá es divergencia real, y ahí la marca es la respuesta correcta

La tabla (`B/03`:2235-2243) lista `pending`/`PENDING_AUTHORIZATION` como *«nada: coinciden»*, pero
no `authorized`/`ACTIVE`. La fila :2238 admite en prosa que `paused`/`PAUSED` coincide, sin fila
propia. Las filas `cancelled` cubren sólo `CANCEL_SCHEDULED`, `SUSPENDED` y los estados vivos.

**Severidad**: `MEDIA`. La intención se lee, pero la regla escrita dice lo contrario.

**Necesita decisión del owner**: **no**.

---

### F-8CB2-011 — El outbox promete «una sola vez» y sólo garantiza que no se encole dos veces

**Qué se rompe.** El envío es al menos una vez: la unicidad está en el encolado y no en el envío.
Un worker que manda el correo y muere antes de marcarlo `sent` pierde el `processing` por
vencimiento, y la fila vuelve a `pending` y sale de nuevo. En `F-8CB2-001` además no queda definido
qué estado del outbox cuenta como *«el correo salió»* para habilitar la cancelación.

**Dónde lo permite el diseño.**

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:56`:

> ## 2. Que se mande una sola vez · cierra `M-MAIL-02`

`.specs/HOS-1352-billing-verticals-redesign/docs/nucleo/07-outbox-y-notificaciones.md:45`:

> proceso que la tomó muere. Lleva **quién la tomó** y **hasta cuándo**; vencido ese plazo,

No se declara ninguna clave de idempotencia hacia el proveedor de correo (`rg` sin resultados).

**Severidad**: `MEDIA`. El daño es un duplicado de correo, no de plata. Dos implementadores
resuelven distinto qué significa `sent`.

**Necesita decisión del owner**: **no**.

---

### F-8CB2-012 — «Un hecho más viejo que el último aplicado no se aplica» no dice último de qué

**Qué se rompe.** Si el alcance es la suscripción y no el recurso, un cobro legítimo cuya
notificación llega después de un hecho posterior (un reembolso, otro cobro) queda *«registrado y no
aplicado»*. Queda en `PENDING`, sin `SUCCEEDED` y sin `covered_period`, así que el candado de `C5` y
la condición 4 de `B/05` §3 no lo ven.

**El camino.** El cobro de noviembre de Juan (hecho 1/11 10:00) llega con días de atraso (`WH-2`:
hasta 14,3 días medidos). Mientras tanto se aplicó el reembolso parcial del cobro de octubre (hecho
1/11 12:00). Con alcance por suscripción, el cobro de noviembre *«es más viejo»* y no se aplica.

**Dónde lo permite el diseño.**

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:2270`:

> - **un hecho más viejo que el último aplicado se registra y no se aplica.**

`.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:261` (`WH-2`): *«**tres
llegaron a los 10,3 y 14,3 días**»*.

**Severidad**: `MEDIA`. Es una ambigüedad de alcance.

**Necesita decisión del owner**: **no**.

---

## BAJA

### F-8CB2-013 — `B/12` y `B/03` dicen que `GR-3` sigue `UNKNOWN`; la matriz lo tiene `VERIFIED` desde el 2026-09-22

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:108`:

> `GR-3` —la política de reintentos del proveedor— **sigue `UNKNOWN`**. Hay documentación del

(también en :841 y en `.specs/HOS-1354-billing-cobro-y-proveedor/docs/03-maquinas-de-estado.md:207`)
contra `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:197`:
*«| **GR-3** | **Política de reintentos del proveedor** | **`VERIFIED`** | **2026-09-22**»*. Además
`B/12` §1.5 dice *«Esta sección no la usa»*, y la usa: ahí vive la raíz de `F-8CB2-002`.

**Severidad**: `BAJA` (registro). **Necesita decisión del owner**: **no**.

---

### F-8CB2-014 — La excepción de `D17` se apoya en que el `search` por correo y estado «filtra y se compone», y en producción devuelve un subconjunto

`.specs/HOS-1354-billing-cobro-y-proveedor/docs/05-idempotencia-y-concurrencia.md:58`:

> tenga registrada?»**, por correo del pagador y estado, que sí filtran y se componen.

contra `.specs/HOS-1352-billing-verticals-redesign/docs/06-mp-validation-matrix.md:270` (`RC-1`):
*«**En PRODUCCIÓN (2026-09-15, sonda 21) aparece un tercer defecto que el sandbox no tenía: el filtro
devuelve un SUBCONJUNTO.**»*. El barrido de creaciones sin respuesta (`B/09` §7, *«cada pocos
minutos»*) puede no ver lo que busca. Es `BAJA` porque, en el modelo del §5.6 (crear `pending` y
después autorizar por `init_point`), una creación sin respuesta no deja enlace con el que autorizar,
así que la población que cobra está casi vacía.

**Severidad**: `BAJA`. **Necesita decisión del owner**: **no**.

---

## Ataques que intenté y el diseño resistió

- **Dos instancias procesan el mismo webhook.** La segunda falla por `UNIQUE(proveedor,
  id_del_hecho)` (`B/05` C6) y, para el estado, por la `version` más la relectura (`B/03` §10.1).
  `WH-1` confirma que el duplicado conserva la `version`.
- **Webhooks perdidos por supersesión (`WH-5`).** Como el estado se relee y no se reconstruye desde
  la secuencia (§10.1), perder un estado intermedio no deja la fila atrás.
- **`S3` cancela a quien autorizó en el último minuto.** `S3` relee el preapproval por id antes de
  cancelar y, si lo ve `authorized`, corre `S2` (`B/03`:124). Queda una ventana de milisegundos entre
  la lectura y la cancelación, pero no hay cobro (`GT-1`).
- **`S6` suspende a quien pagó con el webhook perdido.** `S6` consulta el `B/09` §4 antes, y si la
  lectura falla o contesta *«todavía no se sabe»*, no corre (`B/03`:127).
- **`MP1` del admin y `MP3` del reloj sobre la misma cuota.** Los dos salen de `AWAITING`: la
  concurrencia optimista (§10.3) deja ganar a uno, y si pierde `MP1`, entra por `MP4`.
- **`MP5` corre dos veces o tarde.** Su condición es *«la fecha ya llegó y ese período no tiene
  cuota»*, idempotente por construcción (`B/03` §7.2).
- **La sucesora queda sin cerrar cuando la predecesora muere sola.** `S18` tiene segundo evento sobre
  un estado y el barrido tiene `SUCESIÓN_ABIERTA_SOBRE_FILA_MUERTA` (`B/09` §3).
- **Un doble cobro por `C5` en un pagador con tarjeta.** `MP5` sólo abre cuotas para pagadores
  manuales, así que no hay `AWAITING` sobre el que el admin registre un pago manual de tarjeta. El
  cruce de `C5` tiene población casi vacía, y `covered_period` lo cierra igual.
- **Cancelar el preapproval de `S17` dos veces.** La regla de relectura (`PA-5`: re-cancelar da
  `400`) está en `S17` y en todas las que la heredan.

## Fuera de mi vector

- `covered_period` deriva el período de un cobro del proveedor de `next_payment_date` leído al
  procesarlo (`B/02`:366-367), un campo que el proveedor corre incluso sobre cobros rechazados
  (`RN-3`/`EX-34`). Con demoras de días, dos cobros pueden resolver el mismo período. Le toca al
  vector de modelo de datos o de conciliación.
- La normalización actual de webhooks en producción descarta `version` (`EX-2`, matriz :309).
  Migrar sin ese campo deja vacía la *«última aplicada»* del §10.1 para las filas existentes. Le
  toca al vector de migración.
- `S1` de una alta nueva mientras `S13` recorre las verticales ancladas: ningún texto que vi impide
  crear una principal en una vertical que un grant vivo ya cubre. Le toca al vector de grants y
  autorización.

## Key Learnings

1. Las reglas que viven en el núcleo o en el log y que la tabla de transiciones no incorpora
   (compuerta de correo de `DEC-MAIL-001`, *«ni `S5` ni `S6` durante una sucesión»*) son la fuente
   principal de lecturas divergentes. La regla 1 del núcleo las vuelve inaplicables por
   construcción.
2. `B/12` §1.2-1.3 (grace desde que el proveedor se rinde) quedó desactualizado frente a
   `DEC-SUB-019` y `DEC-MP-008`: con `GR-3` medido, rendirse no emite evento y la pausa llega antes,
   así que `S4` no tiene disparador para la tarjeta.
3. La tabla de espejo del §10.1 trata como *«el proveedor reanudó»* un `authorized` sobre `PAUSED`,
   y eso convierte en reanudación silenciosa cualquier pausa que se aceptó sin aplicarse (`S8`/`S9`
   sin rama de fallo).
4. `S6` cancela el preapproval, pero `S7` sigue pudiendo reactivar por un cobro en vuelo. El
   resultado es una fila `ACTIVE` sin autorización, que el espejo cancela con la plata adentro.
5. La matriz no registra el resultado de la sonda 49 (48 h con ciclo de 2 días) que citan el log y
   `B/03` §4. Ante la ceguera, la matriz manda: la ventana de un ciclo mensual sigue sin medirse.
6. La máquina del pago manual sólo cierra la cuota `AWAITING` por `MP3`, que depende del reloj del
   grace. Toda salida del grace que apaga ese reloj deja la cuota huérfana.
