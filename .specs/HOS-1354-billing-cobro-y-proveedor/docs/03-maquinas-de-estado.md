---
title: Master Spec 03 — Las máquinas de estado
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-21
status: CURRENT
fase: 2
capitulo: 3
cierra:
  - M-SUB-01
  - M-CONC-02
---

# 03 · Las máquinas de estado

La mitad de billing del capítulo 03 del programa: Suscripción, Grace, Pausa, Pago, Pago manual, Addon y la regla de no-retroceso. Las reglas de lectura comunes viven en el núcleo; Trial, Publicación y Postulación de Partner viven en la épica de verticales.

---

## 3. Suscripción

**Alcance**: la principal es **un compromiso** por `user + vertical` (§11) — hasta **dos filas**
durante la ventana de una sucesión, un origen y su única sucesora (cap. 02 §2.2). Las de
complemento —una por addon recurrente, `DEC-ADDON-002`— usan **esta misma máquina**, sin tope
propio.

> **Usar la misma máquina no es entrar en el mismo dominio.** Una transición cuyo `desde` se
> escribe como un **conjunto de filas** —y en esta tabla hay **dos**, `S13` y `S20`— tiene que
> decir si alcanza también a las de complemento, porque son filas de `subscription` como
> cualquier otra y **entran por pertenencia sin que nadie lo decida**. Las dos lo contestan, y al
> revés una de la otra: `S13` dice **«principal»** y no las alcanza; `S20` dice **«de
> complemento»** y **sólo** las alcanza (§3.2). Que sean dos filas y no un `desde` ampliado es
> deliberado: `S13` cancela **sin evaluar condición**, y `S20` **evalúa una** —compatibilidad y
> el flag— que es lo que el §41 exige para no cancelar a ciegas. Toda transición futura que se
> escriba sobre un conjunto tiene que contestar lo mismo.

### 3.1 Los nueve estados

| estado | qué significa |
|---|---|
| *(sin fila)* | **el estado inicial es la ausencia de fila.** El §14 dice que el estado base no requiere suscripción real, así que no se crea una fila para representar «no tiene» |
| `PENDING_AUTHORIZATION` | creada de nuestro lado, esperando que la persona autorice en el checkout del proveedor |
| `ABANDONED` | nunca se autorizó y se agotó su ventana |
| `ACTIVE` | vigente y al día |
| `GRACE_PERIOD` | un cobro falló y corre el reloj del §20 |
| `PAUSED` | detenida, **con motivo obligatorio** |
| `SUSPENDED` | el grace se agotó sin pago (§20, §21) |
| `CANCEL_SCHEDULED` | dada de baja en el proveedor, con servicio sostenido hasta el fin del período pagado |
| `CANCELLED` | terminada |
| `CHARGE_DECLINED` | autorizó y **el primer cobro de esa autorización** se rechazó. **Terminal**: el proveedor la canceló al rechazarlo |

**`CHARGE_DECLINED` entra y `RECONCILIATION_REQUIRED` sale, así que siguen siendo nueve.**

**Y su condición es POR AUTORIZACIÓN, no por la historia de la persona.** Decía *«ningún pago
acreditado antes para ese `user + vertical`»*, mirando toda la vida del cliente — pero **el
proveedor cancela por el primer cobro DE ESE preapproval**, no por la historia. Con la condición
histórica, al cliente que ya pagó alguna vez, vuelve y le rebota la tarjeta se le daba
`GRACE_PERIOD` con **diez días de servicio completo sobre una autorización que el proveedor ya
canceló de forma terminal**: un plazo que **no puede terminar en pago**, y un aviso que le pide
regularizar algo que no tiene con qué. Leída por autorización, cae donde corresponde y su reintento
es un alta nueva — **con la salvedad del §3.3.1**: si esa fila era la predecesora de una sucesión,
el reintento no es un alta nueva sino el checkout que ya tiene abierto, porque la sucesora pasa a
ocupar el candado `A` y la base rechaza la segunda.

**Por qué entra.** `B/12` §4.4, medido en producción el 2026-09-17, encontró que ante un primer
cobro rechazado el proveedor **cancela la suscripción en el mismo instante** en que manda la cuota
a `recycling` —los dos hechos comparten el milisegundo— y que esa cancelación es **terminal**:
`PUT {status:"authorized"}` devuelve `400 "Invalid transition from cancelled to authorized"`. Ese
mismo § declaró el residuo y no lo resolvió: *«`ABANDONED` dice "nadie autorizó en 72 h"; esto es
"intentó y lo rechazaron". Le decimos cosas distintas al cliente en cada caso, así que no pueden
compartir nombre»*. **Acá se cierra**, y no por prolijidad: es ese residuo el que rompía el
candado. Mandar el alta que nunca cobró a `SUSPENDED` hacía que `SUSPENDED` significara **dos
muertes distintas**, y bloqueaba el reintento que `B/12` §4.4 exige.

Con `CHARGE_DECLINED` afuera, **`SUSPENDED` vuelve a significar una sola cosa** —alguien que pagó
alguna vez y dejó de pagar, que es la política de retención del §20— y ahí bloquear **es lo
correcto**: su preapproval puede seguir vivo, y una segunda suscripción serían dos cobros. Su
salida no es el candado: es pagar (`S7`), que el proveedor la dé de baja y la espejemos (`B/12`
§1.4), o que la cancele una persona (**`S23`**, §3.2).

> **Las tres son ejecutables, y la tercera recién desde que tiene fila.** Hasta `S23` la baja de
> la tabla salía sólo de `ACTIVE`, así que esta enumeración prometía una salida que la máquina no
> declaraba — y sobre un **pagador manual** era la única de las tres que podía existir, porque no
> hay preapproval que el proveedor dé de baja por mora (`B/06` §7) y el espejo del §10.1 no lo
> alcanza. El resultado era una fila encerrada para siempre, con el candado `A` ocupado.

**Por qué sale `RECONCILIATION_REQUIRED`.** Lo que describe no es una situación de la suscripción:
es una situación **nuestra** —*«el sistema no puede decidir solo (§22.1)»*—, y escribirla en la
columna de estado **pisa el estado real de la fila**. Eso producía tres cosas, y las tres eran
defectos vivos: el estado anterior se perdía y `S15` tenía que adivinarlo; convertir una `ACTIVE`
en `RECONCILIATION_REQUIRED` es **textualmente una decisión destructiva automática**, que el mismo
§22.1 prohíbe; y el candado dejaba de ver una autorización que seguía viva.

> **`requiere_conciliación` es una marca sobre la fila, no un estado.** La fila conserva
> el estado que tenía, y sigue cubriendo a quien estaba cubierto (`B/02` §2.2).
>
> **Y la marca no es un booleano: es una fila con MOTIVO y con RELOJ** (`reconciliation_mark`,
> `B/02` §2.2 y §2.5). Este corpus escribe **trece** marcas distintas sobre la misma casilla y
> **cuatro de ellas significan *«hay plata del cliente que devolver»***; sin el motivo llegaban
> todas iguales al listado accionable de `B/19` §4. `requiere_conciliación` pasa a nombrar el
> **predicado** —*«la fila tiene al menos una marca abierta»*, `NUCLEO/01` §2.5—, así que cada
> frase de este capítulo que dice *«se pone la marca `requiere_conciliación`»* sigue diciendo lo
> mismo y ahora dice además **con qué motivo**.

Y una nota de registro que sigue valiendo:

> `ABANDONED` no estaba en el capítulo 01 (núcleo) y se agrega acá: `M-SUB-01` exige nombrar la ventana
> del preapproval sin autorizar **con su duración máxima y su limpieza**, y sin un estado de
> salida esa ventana no vence nunca. El capítulo 01 (núcleo) queda corregido en el mismo commit.

### 3.2 Las transiciones

| # | desde | evento | hacia | condición | efectos |
|---|---|---|---|---|---|
| S1 | *(sin fila)* | la persona elige un plan | `PENDING_AUTHORIZATION` | no hay otro **origen** vivo para ese `user + vertical`, **o la fila declara una sucesión** (`sucede_a`) | se acuña y **persiste** la clave de idempotencia **antes** de llamar al proveedor (`DEC-CONC-001`); si declara sucesión, **nace con fecha de primer cobro posterior al vencimiento de su ventana de autorización** (`B/12` §5.2) |
| S2 | `PENDING_AUTHORIZATION` | webhook de autorizada, confirmado por relectura | `ACTIVE` | — | arranca el período; la fila **pasa a emitir fuente** (`12-contrato…` §2.6) y ese cambio de cobertura es lo que mueve el trial, si había uno (`V/03` §2, `T2`) — esta tabla **no dispara** una transición de la otra épica |
| S3 | `PENDING_AUTHORIZATION` | vence la ventana | `ABANDONED` | pasaron **72 h** sin autorizar | se cancela el preapproval en el proveedor; la fila se conserva —**con su `sucede_a` puesto, si era una sucesora**, porque es el registro fiel y porque ningún predicado lo lee sin exigir que la fila esté viva—. **Y si la predecesora retenía un pago pendiente por `S19`, se reevalúa en el acto**: es la rama 2 de `B/12` §5.3 y el que hace que *«el tope es la ventana»* sea una condición y no una intención |
| S4 | `ACTIVE` | un cobro falla — **y en un pagador manual eso es que `MP5` abrió la cuota del período y no hay pago acreditado contra ella** (§7.2): no hay débito que rebote, así que el evento se lee sobre la cuota y no sobre el proveedor | `GRACE_PERIOD` | — | arranca el reloj del §4; el servicio **sigue entero** (§20) |
| S5 | `GRACE_PERIOD` | entra el pago, **o se reevalúa uno que quedó pendiente** por `S19` | `ACTIVE` | las cuatro condiciones del cap. 05 §3 — y la 3 incluye **que esta fila no sea la predecesora de una sucesión en curso** | se apaga el reloj |
| S6 | `GRACE_PERIOD` | se agota el reloj | `SUSPENDED` | **no hay un pago acreditado del período pendiente de resolución** por `S19` | §21: sin listado público, sin edición, sin creación, sin entitlements comerciales; datos conservados y billing accesible |
| S7 | `SUSPENDED` | regulariza, **o se reevalúa un pago que quedó pendiente** por `S19` | `ACTIVE` | el cobro entró de verdad **y** las cuatro condiciones del cap. 05 §3 — y la 3 incluye **que esta fila no sea la predecesora de una sucesión en curso** | se restituye la publicación |
| S8 | `ACTIVE` | la persona pide pausar | `PAUSED` *(motivo `CUSTOMER_REQUEST`)* | `puedePausar()` (capítulo 01 (núcleo) §3) | se pausa en el proveedor; se elige en **meses enteros** (`DEC-SUB-010`) |
| S9 | `ACTIVE` | **dos disparadores, un mismo acto**: `SUPER_ADMIN` otorga cortesía, **o una sucesora recién autorizada tiene una cortesía DIFERIDA esperándola** — una `courtesy_grant` con `saldo_días` no nulo cuyo `subscription_id` apunta a una fila cuyo `sucedida_por` es esta (`B/02` §2.4 y §2.6, `DEC-GRANT-007`) | `PAUSED` *(motivo `COURTESY`)* | no hay pausa vigente (`DEC-GRANT-004`) — **y una sucesora recién autorizada no tiene ninguna**, así que el segundo disparador corre sin tocar la condición | se pausa en el proveedor y **el servicio se sostiene de nuestro lado** (`DEC-GRANT-003`). **Por el segundo disparador se re-emite la cortesía diferida**: `subscription_id` pasa a esta fila, `inicio` es hoy, `fin` es hoy + `saldo_días`, y **`saldo_días` vuelve a nulo**. Es la misma fila de `courtesy_grant`, entera, con la firma de `SUPER_ADMIN` original — no una cortesía nueva, así que el §35.4 sigue auditando **por grant**. **Riesgo aceptado y declarado por `DEC-GRANT-007`**: entre `S2` y este acto el proveedor **puede cobrar** el primer pago, y ese cobro se devuelve **por el camino que ya existe** —la marca con motivo `COBRO_DURANTE_CORTESÍA` y la confirmación de una persona, `B/02` §2.5 y `DEC-RF-002`—, sin inventar un mecanismo para evitarlo |
| S10 | `PAUSED` | llega el fin, o la persona vuelve antes | `ACTIVE` | **el plan al que la fila está anclada se sigue prestando** —es la guarda que la separa de `S25`, ver abajo— **y el `PUT` se aplicó, confirmado por relectura** — la misma regla que `S17` | `PUT status=authorized`; al reanudar se le muestra **una sola cosa: qué día se le cobra** (`DEC-SUB-010`) — **y en un pagador manual ese día lo fija esta misma transición**, porque no hay proveedor que lo corra: la fecha del próximo cobro (`B/02` §2.2) avanza **tantos ciclos como hayan vencido durante la pausa, sin abrir cuota**, que es el espejo local de `PS-6` y lo que esa misma decisión ya eligió para el pagador con tarjeta —*«se le cobra normal en el ciclo siguiente»*—. Sin eso el reloj le abriría al volver la cuota de un período que transcurrió adentro de la cortesía (§7.2, *«qué mueve la fecha del próximo cobro»*). **Si la relectura sigue viendo `paused`, `S10` NO ocurre**: la fila se queda en `PAUSED` y **se pone la marca `requiere_conciliación` con motivo `REANUDACIÓN_NO_APLICADA`** (`S14`, `B/02` §2.5), porque una reanudación que no se aplicó le corta el servicio y el cobro a la vez — ver abajo |
| S11 | `ACTIVE` | pide la baja | `CANCEL_SCHEDULED` | — | **se cancela en el proveedor de inmediato** y se guarda **nuestra** fecha de fin de servicio (`DEC-SUB-009`) |
| S12 | `CANCEL_SCHEDULED` | llega la fecha de fin de servicio | `CANCELLED` | — | se corta el servicio; proceso **idempotente** |
| S13 | **toda fila viva PRINCIPAL** del beneficiario en **cada vertical que el acto ancla** (`B/02` §2.4, `permanent_grant_vertical`) — los seis estados, `PENDING_AUTHORIZATION` y `CANCEL_SCHEDULED` incluidos. **Las de complemento no entran** (ver abajo, *«y no alcanza a los complementos»*) | `SUPER_ADMIN` **otorga** un *Free Forever*, **o le ancla una vertical nueva a un grant vivo** (`12-contrato…` §2.8, `NUCLEO/01` §2.4) | `CANCELLED` | — | §35.3: se cancela toda obligación de pago, **sin reembolso** (`DEC-GRANT-001`); **se cancela el preapproval de cada una** en el proveedor —autorizado o esperando autorización— con la misma regla de `S17`: si la relectura dice que ya está `cancelled`, no se manda nada; el acceso pasa a darlo el grant. **Y si alguna de las filas alcanzadas retenía un pago pendiente por `S19`, la bandera se apaga en el mismo acto, sin reembolso** — es la rama 4 de `B/12` §5.3, y apagarla es parte de la decisión: dejarla puesta sobre una `CANCELLED` deja un *«pendiente»* que ningún barrido alcanza y que todo conteo de pagos pendientes cuenta de más. **Proceso idempotente y reanudable fila por fila**, con su detector en `B/09` §3 (ver abajo, *«la ejecución parcial»*) |
| S14 | cualquiera | divergencia que toca plata o estado | **el mismo estado** | — | **se abre una marca `requiere_conciliación`** y se emite el §22.1: evento crítico, correo a `SUPER_ADMIN`, alerta en Admin, **cero decisiones destructivas automáticas**. **`S14` es el ACTO y no el motivo**: el motivo lo trae el caso que lo disparó —son **siete** de los trece de `B/02` §2.5— exactamente como el motivo de una pausa lo traen `S8` o `S9`. Una marca sin motivo declarado no es escribible: `G-R1-F` (`B/20` §2) la rechaza |
| S15 | cualquiera **con una marca abierta** | una persona resuelve | **el mismo estado** | intervención humana registrada | **se levanta UNA marca —la del motivo que esa persona resolvió—, no la fila**: se le escriben `levantada_en` y quién la levantó (`B/02` §2.2), y **las demás marcas abiertas siguen abiertas**. Con un booleano, resolver una divergencia de monto apagaba en el mismo gesto un `REEMBOLSO_POR_CONFIRMAR` que nadie había mirado. Si además corresponde un cambio de estado, se ejecuta **la transición de esta misma tabla que lo permita** |
| S16 | `ACTIVE` | el **primer** cobro se rechaza | `CHARGE_DECLINED` | **es el primer cobro DE ESA autorización**, y el proveedor la canceló al rechazarlo | no hay servicio, no hay autorización y no hay vuelta: el reintento **es un alta nueva** — **salvo que la fila fuera la predecesora de una sucesión**, y ahí el reintento es **terminar el checkout que ya está abierto**: `S18` cierra la sucesión en el acto y la sucesora ocupa el candado `A` (§3.3.1) |
| S17 | la **predecesora**, si **sigue siendo fila viva** — las cinco alcanzables: `ACTIVE`, `GRACE_PERIOD`, `CANCEL_SCHEDULED`, `PAUSED`, `SUSPENDED` | su sucesora quedó **autorizada**, confirmado por relectura | `CANCELLED` | la fila tiene una **sucesora viva** con `sucede_a` apuntándola | **se cancela en el proveedor si su preapproval sigue vivo** (es `D7`); si la relectura dice que ya está `cancelled`, `D7` **ya está cumplido y no se manda nada** |
| S18 | la **sucesora viva**: en `ACTIVE`, **o en `PENDING_AUTHORIZATION` cuando la predecesora se murió sola** | la misma autorización que disparó `S2`; **o la predecesora dejó de ser fila viva sin `S17` — por `S12`, por `S16`, por el espejo de la baja decidida por el proveedor (§10.1), o porque pidió la baja ella misma estando pausada (`S22`), suspendida (`S23`) o en el grace (`S24`)**; o una resolución de `S15` sobre la sucesión trabada | **el mismo estado** | la predecesora **ya no es fila viva** | **cierra la sucesión, y es el único acto que lo hace.** Son **cinco** escrituras y la tercera alcanza **dos** entidades: se escribe **`sucedida_por`** en la predecesora; se **limpia `sucede_a`** en la sucesora; **lo que colgaba de la predecesora y se puede re-apuntar se re-apunta a la SUCESORA** —los **complementos** (`B/16` §4.2) y la **redención de promo** (`B/14` §2.2), con el inventario completo en `B/02` §2.6—; **si la predecesora tiene una cortesía vigente, NO se re-apunta: se CIERRA sobre ella y se le escribe el `saldo_días`** que le quedaba, para que `S9` la re-emita sobre la sucesora cuando ésta llegue a `ACTIVE` (`DEC-GRANT-007`, `B/14` §4.4); y **si la predecesora retiene un pago pendiente por `S19`, se le abre a ELLA una marca `requiere_conciliación` con motivo `REEMBOLSO_POR_CONFIRMAR`**, que **lleva la referencia al pago** que hay que devolver (`B/02` §2.5; ramas 1, 5 y 6 de `B/12` §5.3, `DEC-RF-002`). La sucesora pasa a ser el origen |
| S19 | la **predecesora** de una sucesión en curso, en `GRACE_PERIOD` o `SUSPENDED` | **entra el pago del período impago, por cualquiera de sus DOS puertas**: la cuota que el proveedor sigue reciclando, **o** el pago que el admin registra a mano (`MP1` **o `MP4`**, §7) | **el mismo estado** | la fila tiene una **sucesora viva** con `sucede_a` apuntándola | **el pago se registra y queda pendiente de resolución** —sea un `payment` o un `manual_payment` (`B/02` §2.3)—: no reactiva, no se reembolsa todavía y **no pone la marca todavía** — es un caso diseñado y no una divergencia, así que `S14` no aplica; **la marca la abre `S18` al cerrar, con motivo `REEMBOLSO_POR_CONFIRMAR`, y sólo en las ramas 1, 5 y 6**. Su destino lo decide **cómo termina la sucesión**, con las **seis** ramas de `B/12` §5.3. Mientras esté pendiente, `S6` no corre |
| S20 | **toda fila viva DE COMPLEMENTO** del beneficiario —los **seis** estados de la suscripción, no los dos de la instancia— cuya instancia esté en uno de sus **dos** estados vivos y cuyo `addon_product` declare compatible **la vertical que el acto ancla**; para los scopes con vertical propia —`VERTICAL_SUBSCRIPTION` y `LISTING`— **además su objetivo tiene que ser de esa vertical** (`B/16` §3.4). **Las principales no entran**: ésas son de `S13` | el mismo acto que dispara `S13`: `SUPER_ADMIN` **otorga** un *Free Forever*, **o le ancla una vertical nueva a un grant vivo** (`12-contrato…` §2.8, `NUCLEO/01` §2.4) | `CANCELLED` | **el grant lleva `includesAddons: true`** — con `false` no corre y el complemento sigue cobrando | §35.2: el addon pasa a **costo $0**, y son **dos escrituras sobre dos entidades, EN ESTE ORDEN** (ver abajo, *«el orden de las dos escrituras de `S20`»*). **Primero la instancia**: no cambia de estado —si estaba `ACTIVE` sigue `ACTIVE`— y pasa a colgar del **ancla** como su título (`B/02` §2.4); si estaba `PENDING_AUTHORIZATION` no se convierte —no hay nada comprado— y muere por `A3` al vencer su ventana, con la pantalla de *«esperando que completes el pago»* dejando de ofrecer el enlace en el acto. **Después el cobro**: se cancela el preapproval en el proveedor —autorizado o esperando autorización— con la misma regla de `S17` (si la relectura dice que ya está `cancelled`, no se manda nada) y la fila de complemento llega a `CANCELLED`. **Sin reembolso del período ya cobrado** (`DEC-GRANT-001`, igual que `S13`). **No lleva la mitad de `S19` que `S13` sí lleva**, y no por olvido: `S19` sale de *«la predecesora de una sucesión en curso»* y una fila de complemento **nunca es una**, así que esa bandera sobre un complemento es población vacía. **Reanudable fila por fila BAJO ese orden**, con su detector en `B/09` §3 — y **no por la razón de `S13`**, que supone una escritura por fila |
| S21 | **toda fila viva DE COMPLEMENTO** —los **seis** estados de la suscripción— **de la que cuelga una instancia de addon**. **Las principales no entran, y acá no hace falta acotarlo**: de una principal no cuelga ninguna instancia, así que el conjunto ya es disjunto por el sujeto y no por un adjetivo | **su instancia llega a `CANCELLED`**: por cualquiera de las **tres** cláusulas del evento de `A5` —se da de baja, **queda huérfana** (la condición de `B/16` §4.2, con sus **tres** mitades) o **se revoca el grant del que cuelga el ancla que era su título**— **y también por `A6`**, el borrado de la ficha (§8) | `CANCELLED` | **la instancia está en `CANCELLED`**. Es una condición **sobre un estado y no sobre una entrega**, así que **se vuelve a evaluar** —igual que el disparador de `S17` y `S18`—, y por eso una corrida que muere entre `A5` y esta fila no deja el caso perdido | **no se manda nada al proveedor, y ésa es la mitad que no hay que duplicar**: un addon recurrente tiene **un** preapproval y es el de esta fila (`DEC-ADDON-002`, `B/02` §2.4), así que la cancelación que `A5` y `A6` ya declaran —con la regla de relectura de `S17`— **es ésta misma**. Volver a escribirla acá serían dos llamadas por el mismo recurso. **Sin período de gracia y sin fecha de fin de servicio**: no se pasa por `CANCEL_SCHEDULED` (ver abajo, *«el complemento que sobrevive a su instancia»*). **Sin reembolso del período ya cobrado**; si corresponde devolver, entra por la vía del reembolso, que **confirma una persona** (`DEC-RF-002`). **Idempotente**: sobre una fila que ya está `CANCELLED` no escribe nada y no manda nada |
| S22 | `PAUSED` — **con cualquiera de los dos motivos** | pide la baja | `CANCELLED` | — | **es el mismo acto de `S11`, no uno nuevo**: el catálogo de `NUCLEO/08` §3 lo nombra una sola vez y `B/19` §5 lo deja self-service. Lo que cambia es el desenlace: **no pasa por `CANCEL_SCHEDULED` y termina el servicio en el acto** (`B/12` §7.2). `DEC-SUB-010` ya se llevó los días no usados del ciclo **al pausar**, así que **no queda período pagado que sostener**, y la fecha de fin de servicio —*«un dato nuestro»*, `DEC-SUB-009`— **es el día de la cancelación**. El §3.3 ya lo imponía: de `PAUSED` no sale nada que no sea `ACTIVE` o `CANCELLED`. **Se cancela en el proveedor de inmediato**, con la regla de relectura de `S17` — está medido que sobre una pausada el proveedor **rechaza toda modificación y sí deja cancelar** (`EX-11`). **Se escribe `fin_real` en la `subscription_pause`** (`B/02` §2.2) con ese mismo día: los topes del §26.3 **sobreviven a cancelar y volver a suscribirse** (`DEC-SUB-004`), así que una pausa que se corta sin registrar su fin real le come al cliente meses que no usó. **Y si el motivo era `COURTESY` la cortesía termina con ella**: esa fila **sí emite fuente** (`12-contrato…` §2.6) y deja de emitirla hoy, así que la confirmación lo dice antes (`B/19` §4, fila 8). **Idempotente**, como `S12` |
| S23 | `SUSPENDED` | pide la baja — **la pide el cliente o la ejecuta un admin**: es la tercera salida que el §3.1 enumera | `CANCELLED` | — | el mismo acto otra vez, y acá **no hay servicio ni cobertura que retirar**: el §21 ya cortó el servicio y `SUSPENDED` **no emite ninguna fuente** (`12-contrato…` §2.6), así que tampoco hay período pagado que sostener y la fecha de fin de servicio **es el día de la cancelación**. **En el proveedor: si el preapproval sigue vivo se cancela**, con la regla de relectura de `S17`; **sobre un pagador manual no hay nada que mandar**, porque no hay débito que detener (`B/06` §7). **Libera el candado `A`** (`B/02` §2.2), y ésa es la mitad que el §7.1 necesitaba: desde `CANCELLED` la condición 1 del `B/05` §3 rechaza la reapertura, así que este acto **cierra la ventana de `MP4`** y de paso le devuelve a la persona el alta nueva que el candado le bloqueaba. **Idempotente**, como `S12` |
| S24 | `GRACE_PERIOD` | pide la baja | `CANCELLED` | — | **el mismo acto de nuevo**, y su desenlace lo fija `DEC-SUB-014`: **corta en el acto**, con la fecha de fin de servicio en **el día de la cancelación** y **sin pasar por `CANCEL_SCHEDULED`**, por la misma razón que `S22` y `S23`. Acá esa razón es la más literal de las cuatro: **el grace existe porque el cobro del período en curso falló**, así que no hay período pagado que sostener — el último que se pagó ya se consumió, que es precisamente por lo que la fila está en este estado. **Y es la única de las tres bajas directas que corta servicio de verdad**: `GRACE_PERIOD` **sí emite fuente** (`12-contrato…` §2.6, *«el §20 da servicio entero»*), a diferencia de `PAUSED` por `CUSTOMER_REQUEST` y de `SUSPENDED`, así que la pantalla lo dice antes de confirmar (`B/19` §4, fila 8). **Se cancela en el proveedor de inmediato**, con la regla de relectura de `S17`; **sobre un pagador manual no se manda nada**, como en `S23`, porque no hay débito que detener (`B/06` §7). **Apaga el reloj del §4**: sin esta fila el intento caía en la regla 1 del núcleo —marca con motivo `TRANSICIÓN_NO_DECLARADA`— mientras el reloj del grace seguía corriendo hacia `SUSPENDED` con una persona mirando el caso. **Y si la fila es la predecesora de una sucesión en curso, dispara `S18`**, igual que `S23`: `S19` retiene pagos desde `GRACE_PERIOD` y desde `SUSPENDED`, así que es la **misma** rama 6 de `B/12` §5.3 y no una séptima. **Idempotente**, como `S12` |
| S25 | `PAUSED` — **con cualquiera de los dos motivos** | **el mismo evento de `S10`**: llega el fin de la pausa, o la persona vuelve antes | `CANCELLED` | **el plan al que la fila está anclada ya NO se presta** — su vertical fue discontinuada (`B/10` §4.3) — **y es la guarda complementaria de la de `S10`**, no una condición aparte: las dos leen el mismo dato y no se pueden satisfacer a la vez | **`S10` no puede reanudar sobre un plan que no existe**, y ésta es la fila que ejecuta ese final (`DEC-SUB-015`). **No se manda `PUT status=authorized`**: se **cancela** el preapproval, con la regla de relectura de `S17` —`EX-11` mide que una pausada rechaza toda modificación **y sí deja cancelar**—, y por eso el preapproval no se cancela el día 0 del anuncio sino acá: mientras está pausada **no cobra** (`PS-2`), así que dejarla viva no cuesta plata. **Se escribe `fin_real` en la `subscription_pause`** con ese día, igual que `S22` y por la misma razón: los topes del §26.3 sobreviven a cancelar y volver a suscribirse (`DEC-SUB-004`). **Y corre igual si la persona no vuelve nunca**: el tope de la pausa es nuestro reloj (`PS-4`), así que el evento llega solo. **Libera el candado `A`**, con lo que el alta nueva entra por `S1` si en esa vertical queda algo que comprar. **Y si el motivo era `COURTESY` con días sin entregar, la cortesía NO se pierde: se DIFIERE** —se le escribe el `saldo_días` y `S9` la re-emite sobre la fila nueva cuando llegue a `ACTIVE`— por el mismo mecanismo de `DEC-GRANT-007` (`DEC-GRANT-010`, `B/14` §4.6). **Idempotente**, como `S12` |

**La muerte de la predecesora y el cierre de la sucesión son DOS actos, y por eso son dos
filas.** `S17` mata a la predecesora; `S18` cierra la sucesión. Escribirlos como uno solo es lo
que rompía el candado, porque ataba el cierre —que siempre tiene que ocurrir— a una precondición
que la predecesora puede dejar de cumplir **sola**, y a una llamada al proveedor que puede
fallar.

`D7` declara obligatorio cancelar la vieja al recibir el webhook de que la nueva quedó
autorizada, y **ninguna fila de esta tabla lo ejecutaba** — así que, por la regla 1 del núcleo, el
acto normal del mecanismo más caro del sistema terminaba **en un incidente y una fila sin
cancelar**, con dos preapprovals vivos cobrando. Eso lo cierra `S17`.

**Y `sucede_a` no se limpiaba nunca**, que es la otra mitad y produce dos daños opuestos:

| qué quedaba | qué pasaba |
|---|---|
| el candado `A` **vacío** —ninguna fila viva con `sucede_a IS NULL`— | todo cliente que alguna vez cambió de plan quedaba **permanentemente fuera del §11**: un alta nueva entraba sin que nada la rechazara, y `EX-6` mide que el proveedor no frena la segunda |
| el candado `B` **consumido** —la sucesora viva lo ocupa para siempre— | **nadie podía cambiar de plan dos veces** en la vida de la relación |

Los dos los cierra `S18`: **terminada la sucesión, la sucesora vuelve a ser un origen**. `A` vuelve
a estar ocupado y `B` vuelve a estar libre, que es el estado en el que la persona estaba antes de
empezar.

#### El dominio, recorrido por el lado de la PREDECESORA

La versión anterior de este § recorrió el dominio sobre la sucesora —*«`sucede_a` nulo o no nulo,
no hay un tercer estado»*— y **puso la precondición sobre la predecesora**, que es el eje que no
recorrió. El tercer estado existía y era caro: `sucede_a` no nulo con la sucesión terminada y
nada que pudiera limpiarlo.

**Mientras la sucesora espera autorización —hasta 72 h— la predecesora se sigue moviendo, y se
mueve sola.** Recorrí las salidas de los tres estados desde los que una fila **puede ser sucedida**
—`ACTIVE`, `GRACE_PERIOD`, `CANCEL_SCHEDULED`, el conjunto que `G-R1-A` vigila— y son
**ocho** las transiciones de esta tabla que la sacan de ahí sin que nadie declare una sucesión:

| # | desde | transición | hacia | ¿sigue siendo fila viva? |
|---|---|---|---|---|
| 1 | `ACTIVE` | `S8` — la persona pide pausar | `PAUSED` | **sí** |
| 2 | `ACTIVE` | `S9` — `SUPER_ADMIN` otorga cortesía | `PAUSED` | **sí** |
| 3 | `GRACE_PERIOD` | `S6` — se agota el reloj, **salvo que haya un pago pendiente por `S19`** | `SUSPENDED` | **sí** |
| 4 | `CANCEL_SCHEDULED` | `S12` — llega la fecha de fin de servicio | `CANCELLED` | **no** |
| 5 | cualquiera de los cinco | `S13` — *Free Forever* | `CANCELLED` | **no** |
| 6 | `ACTIVE` | `S16` — el primer cobro de esa autorización se rechaza | `CHARGE_DECLINED` | **no** |
| 7 | `ACTIVE` · `GRACE_PERIOD` | **el espejo de la baja decidida por el proveedor** (§10.1) — es la salida esperada del camino de mora (`B/12` §1.4) | `CANCELLED` | **no** |
| 8 | `GRACE_PERIOD` | `S24` — **pide la baja en medio del grace** (`DEC-SUB-014`) | `CANCELLED` | **no** |

**La séptima no tiene fila numerada en esta tabla, y no por eso deja de ser una transición de
ella**: el §10.1 declara que *«espejar un estado leído por id es una transición declarada de esta
tabla»*, y el par `cancelled` × *(cualquier estado vivo que no sea `CANCEL_SCHEDULED`)* manda
espejar cuando no hay baja programada. Enumerar el dominio **sobre las filas numeradas** la deja
afuera, y es el error de método que costó una rama entera en `B/12` §5.3: la tabla numerada **no
es** la enumeración completa de esta tabla.

**La 3 y la 4 no necesitan que nadie toque un botón —las dos son relojes—**, y la 6 llega con el
cobro real, que `PA-3` mide **entre 26 y 44 minutos** después de autorizar: en esa media hora un
cambio de plan es legal y la predecesora todavía está `ACTIVE`. **La 7 no la decide nadie de este
lado**: `GR-3` —la política de reintentos del proveedor— *«sigue `UNKNOWN`»* (`B/12` §1.5), así que
cuándo llega no se puede acotar. **La 8 es la única de las ocho que decide el propio cliente
sobre su propia fila** —pide la baja en medio del grace (`DEC-SUB-014`)—, y por eso no cabe en
*«se mueve sola»*: lo que comparte con las otras cuatro terminales no es la causa sino el efecto.
**Las tres primeras siguen siendo filas vivas y son el dominio de
`S17`** —por eso su `desde` son cinco estados y no tres—; **las cinco últimas ya no lo son, y ahí
`S17` simplemente no aplica: no hay nada que cancelar y no hay nada que matar.**

**Y las tres primeras tienen desde la FASE 9-bis-4 una SEGUNDA salida que no es `S17`, porque la
persona puede irse.** Una predecesora que quedó en `PAUSED` (filas 1 y 2) o en `SUSPENDED`
(fila 3) puede pedir la baja: `S22` y `S23` la mandan a `CANCELLED` **sin que la sucesora haya
autorizado**, o sea por el mismo camino de `S12`, `S16` y el espejo — se muere sola. Por eso las
dos están nombradas en el segundo evento de `S18`, que es lo que cierra la sucesión y evita que el
candado `A` quede vacío; y por eso `B/12` §5.3 tiene desde entonces una **sexta** rama, la de una
predecesora que pide la baja ella misma y además retenía un pago por `S19`. **No entran como filas
9 y 10 de la tabla de arriba**: esa tabla recorre las salidas de los **tres** estados desde los
que una fila puede ser sucedida, y `PAUSED` y `SUSPENDED` no son ninguno de los tres — se llega a
ellos **por** esas filas. Lo que cambia no es el dominio de la tabla sino que su columna de la
derecha —*«¿sigue siendo fila viva?»*— dejó de significar *«y de ahí sólo sale por `S17`»*.

**`S24` sí entra, y la diferencia con sus dos hermanas es de dominio y no de criterio**:
`GRACE_PERIOD` **es** uno de los tres estados desde los que una fila puede ser sucedida, así que
la baja que sale de ahí es una salida de esta tabla y se cuenta como la octava. Es la misma
razón por la que `S22` y `S23` no se cuentan, leída al derecho.

**`S18` corre en SIETE de las ocho, y la que falta sigue siendo `S13`.** En las tres primeras corre después
de `S17`, que es el que hace verdadera su condición. En `S12`, en `S16`, en **el espejo** y en
**`S24`** corre
**sin `S17` y sin esperar a que la sucesora autorice**, que es el segundo evento de su fila y el §
siguiente explica por qué tiene que ser así. En `S13` **no corre**, y no es una excepción olvidada:
`S13` alcanza a **toda fila viva principal** del beneficiario, o sea también a la sucesora, así que
no queda ninguna sucesora viva a la que pasarle el origen (ver más abajo, *«`S13` alcanza a toda
fila viva PRINCIPAL»*).

#### Por qué `S18` también sale de `PENDING_AUTHORIZATION`: el candado `A` no se puede quedar vacío

**Cuando la predecesora se muere sola —por `S12`, por `S16`, por el espejo del §10.1, o porque ella
misma pidió la baja estando pausada (`S22`), suspendida (`S23`) o en el grace (`S24`)—, el candado
`A` queda VACÍO y la sucesora no lo ocupa.** Es aritmética de los índices parciales de `B/02` §2.2: `A` es
`UNIQUE (user_id, vertical) WHERE clase = principal AND sucede_a IS NULL AND estado ∈ {vivos}`, la
predecesora ya no está entre los vivos, y la sucesora tiene `sucede_a` **no nulo**, así que cae en
`B`. **Ninguna fila ocupa `A`, y la base deja entrar un alta nueva** — que es exactamente lo que
`B/12` §4.4 le pedía al cliente hacer después de un primer cobro rechazado. Ahí hay **dos
preapprovals que pueden autorizar y cobrar**, y `EX-6` mide que el proveedor no frena la segunda.
Y el daño se vuelve permanente dentro de la misma ventana: cuando la sucesora autoriza, `S18`
tiene que limpiar `sucede_a`, y esa escritura **la rechaza la base** porque la sucesora pasaría a
competir por `A` con el alta nueva. La sucesión no se cerraría nunca.

**Por eso el cierre no espera a la autorización cuando no hay nada que esperar.** Muerta la
predecesora por cualquiera de esos **cinco** caminos, la sucesora **ya es el único compromiso** de ese
`user + vertical`: el cierre la vuelve origen en el acto, ocupa `A` con ella —`PENDING_AUTHORIZATION`
está entre los vivos— y el segundo `INSERT` lo rechaza la base, que es la premisa que el §3.4
punto 4 necesita para ser verdadera. Lo que el cliente ve entonces **no es *«empezar de nuevo»***:
es el aviso del §3.3.1, *«terminá o cancelá el checkout que tenés abierto»*, con su enlace para
retomar y su fecha de vencimiento. No queda bloqueado —abandonar lo deja en `ABANDONED`, que no es
vivo, y desde ahí el alta nueva entra sin pelear con nada— y el tope es la ventana: 72 h.

**Y no se cierra una sucesión que todavía podría no ocurrir: se cierra una que ya no tiene otro
final.** La predecesora está muerta por su propia cuenta, sin reversa (`CANCELLED` no revive,
`CHARGE_DECLINED` lo canceló el proveedor de forma terminal, y la baja que el espejo escribe **la
decidió el proveedor**), así que *«fue sucedida»* es el
registro fiel. Si después la sucesora abandona, la persona queda sin fila viva y puede dar de alta
de nuevo — el mismo desenlace que tendría si nunca hubiera declarado la sucesión.

**Las cinco escrituras de `S18` no corren todas por todos los caminos, y las dos últimas son las
que se reparten.** Las tres primeras —`sucedida_por`, limpiar `sucede_a` y el re-apunte de las
**dos** entidades re-apuntables— corren **siempre**. Las otras dos tienen dominio propio:

| escritura | por qué caminos corre | por qué |
|---|---|---|
| **4 · la cortesía se DIFIERE** (`saldo_días`, `DEC-GRANT-007`) | el cierre normal con `S17`, y **el espejo** del §10.1 | una cortesía vigente deja la fila en `PAUSED` (`S9`), y `PAUSED` está entre los cinco `desde` de `S17` y entre los vivos del espejo. **No corre por `S12`** (`desde: CANCEL_SCHEDULED`) **ni por `S16`** (`desde: ACTIVE`), que son otros conjuntos; **ni por `S22`**, que sale de `PAUSED` pero **termina** la cortesía en vez de diferirla —la persona pidió irse, que es la elección de `DEC-GRANT-004` (1)—; **ni por `S23`**, porque una `SUSPENDED` no tiene cortesía vigente |
| **5 · la marca `REEMBOLSO_POR_CONFIRMAR`** sobre un pago pendiente por `S19` | **el espejo** (rama 5), **`S23`** (rama 6) y el cierre normal con `S17` (rama 1) | `S19` sólo existe sobre una predecesora en `GRACE_PERIOD` o `SUSPENDED`. **No puede aplicar por `S12` ni por `S16`**, y es aritmética de los `desde`: **ninguna fila puede estar en los dos conjuntos** |

> **Por el espejo del §10.1 corren las cinco, y hay que decirlo porque la versión
> anterior de este párrafo afirmaba lo contrario sobre un dominio de dos.** El `desde` del espejo
> es *«cualquier estado vivo que no sea `CANCEL_SCHEDULED`»*, o sea que **incluye `GRACE_PERIOD`,
> `SUSPENDED` y `PAUSED`**: los dos primeros son exactamente la población de `S19` —y no por
> casualidad: la baja que decide
> el proveedor llega **por mora acumulada** (`B/12` §1.4), así que la predecesora que la recibe es
> justamente la que venía en grace— y el tercero es el de la cortesía. El pago pendiente se
> resuelve por la **rama 5** de `B/12` §5.3 — la misma marca y el
> mismo motivo de la rama 1, con otro acto adelante. El enunciado *«la cuarta
> no puede aplicar cuando la predecesora se murió sola»* era verdadero sobre los dos caminos que
> entonces existían y es **falso sobre el tercero**.
>
> **Y la frase que decía que la cortesía *«tampoco puede coexistir con estos dos caminos»* era
> falsa por el mismo lado.** Se apoyaba en `B/14` §4.4, que enumeraba **dos** caminos de `S18` sin
> `S17` cuando ya eran tres, y de ahí concluía que *«no hay caso en que haya que pausar un
> preapproval que todavía no autorizó»*. El espejo sale de `PAUSED` y `S17` también, así que el
> caso existe por **dos** puertas, no por una. Es el defecto que `DEC-GRANT-007` cierra, y la
> corrección entera está en `B/14` §4.4.

Con eso, el dominio queda recorrido en los dos ejes y la relación tiene **cuatro** estados, no
dos ni tres. El tercero es el que la versión anterior de este § agregó; **el cuarto es el que ella
misma dejaba afuera**, y es el único en que la columna `sucede_a` sobrevive a la sucesión:

| estado de la relación | cómo se lee | qué candado ocupa |
|---|---|---|
| **no hay sucesión** | `sucede_a` nulo y `sucedida_por` nulo | `A` la fila, `B` libre |
| **sucesión en curso** | una **fila viva** con `sucede_a` no nulo — la sucesora | `A` la predecesora, `B` la sucesora |
| **sucesión terminada** | la predecesora con `sucedida_por` no nulo, la sucesora con `sucede_a` nulo | `A` la sucesora, `B` libre |
| **sucesión muerta sin cerrarse** | una fila **no viva** con `sucede_a` no nulo, y la predecesora sin `sucedida_por` — la sucesora venció su ventana (`S3`) o la mató `S13` | **ninguno de los dos**: los dos índices son parciales sobre los vivos, así que `B` queda libre y la persona puede volver a intentar el cambio de plan |

**El cuarto es por qué los predicados dicen «sucesora VIVA» y no «sucesora».** El puntero se
conserva a propósito —`S13` lo declara: *«la sucesora queda `CANCELLED` con su `sucede_a` escrito,
que es el registro fiel de lo que pasó»*— y nadie lo limpia, así que un predicado que sólo
pregunte *«¿hay una fila con `sucede_a` apuntándome?»* contesta **que sí para siempre**. Sobre
`S19`, `S5`, `S6` y `S7` eso congelaba la fila en `GRACE_PERIOD` con el reloj apagado y el pago
retenido de por vida. **La condición es sobre un estado, así que se vuelve a evaluar** — es la
misma lectura, y por la misma razón, que `B/16` §4.2 ya hacía para el addon huérfano. El
inventario completo de los predicados que leen el término está en `NUCLEO/01` §2.4.

**Son dos filas y un solo acto, y el acto que no puede faltar es `S18`.** Partirlas es lo que hace
que el cierre sea alcanzable —`S18` no depende de que `S17` tenga sujeto—, y la asimetría entre
las dos mitades es real, no retórica:

- **`S17` sin `S18` es siempre un defecto**: deja el candado `A` **vacío** y un alta nueva entra
  sin que nada la rechace. Lo vigila `G-R1-C` (`B/20` §2).
- **`S18` sin `S17` es lo CORRECTO en los CINCO caminos por los que la predecesora se muere sola
  —`S12`, `S16`, el espejo del §10.1, `S22` y `S23`—**, y en ninguno de
  los tres deja viva una autorización: en `S12` el preapproval de la predecesora lo canceló `S11`
  *«de inmediato»* (`DEC-SUB-009`), en `S16` **lo canceló el proveedor en el mismo milisegundo del
  rechazo** (`B/12` §4.4, medido el 2026-09-17) y en el espejo **lo canceló el proveedor por su
  cuenta**, que es el hecho que el espejo copia.
  En `S13` no corre ninguna de las dos y tampoco queda autorización viva, porque el efecto del
  propio `S13` cancela el preapproval de **cada** fila que alcanza. Prohibir la combinación —*«o
  corren las dos o no corre ninguna»*, que es lo que este § decía— bloqueaba `S18` justo en los
  dos casos que dejan el candado `A` vacío, y su advertencia (*«`S18` sin `S17` deja viva una
  autorización que el `D7` manda cancelar»*) es falsa en los tres.

**Y el disparador de las dos es un ESTADO, no una entrega.** *«Su sucesora quedó autorizada,
confirmado por relectura»* se puede volver a evaluar mañana; *«llegó el webhook»* no, porque un
webhook no se vuelve a emitir. Es lo que hace que la salida que `S15` promete —*«se ejecuta la
transición de esta misma tabla que lo permita»*— exista de verdad para una sucesión trabada.

**La única rama en la que la sucesión NO se cierra es que la cancelación en el proveedor falle
sobre un preapproval que la relectura vio vivo.** Ahí `S17` no ocurre, `S18` tampoco —su condición
no se cumple—, la marca se pone y una persona lo mira. **Y es lo correcto, no un hueco**: en esa
rama hay de verdad dos autorizaciones que pueden cobrar, y limpiar `sucede_a` ahí sería, además de
mentira, **imposible** — la sucesora pasaría a competir por el candado `A` con una predecesora que
lo sigue ocupando, y la base rechaza la escritura. Lo que la rama le cuesta a la cobertura está
escrito en `12-contrato-de-cobertura.md` §2.6.

**Lo que ya NO es esa rama, y antes lo era**: un preapproval que la relectura encuentra ya
`cancelled` —el arrepentimiento del §3.3, donde `S11` lo canceló *«de inmediato»*— no es una
cancelación fallida. `PA-5` mide que re-cancelar da `400`, así que mandarlo otra vez convertía el
camino normal en un incidente garantizado. `D7` pide que la vieja **no se cancele antes**; sobre
una ya cancelada por decisión de la persona, `D7` está cumplido y no hay nada que mandar.

#### `S19`: el pago que entra en plena sucesión no reactiva, y tampoco se pierde

**La predecesora llega a la sucesión desde `GRACE_PERIOD`, y su cuota impaga sigue en `recycling`
del lado del proveedor**, que la reintenta solo (`B/12` §1.3, medido). Si entra durante la ventana
de 72 h, `S5` la devolvía a `ACTIVE` —y `S7`, si `S6` ya la había pasado a `SUSPENDED`—: dos filas
vivas, el crédito de la sucesora ya computado en cero, y un período pagado que `S17` se lleva
puesto. Es el daño que `B/12` §5.3 describe entero.

**La regla que lo impide tiene que estar en esta tabla, no sólo en la prosa de otro capítulo**, y
ésa es la regla 1 del núcleo: lo que la tabla no declara, no pasa. Por eso son tres escrituras y no
una: la condición en `S5` y en `S7` —que es la que **no reactiva**— y `S19`, que es la que declara
**qué sí pasa**. Sin `S19`, el pago entrante sería una transición no declarada y la regla 1 lo
mandaría a la marca, convirtiendo el camino normal del cambio de plan desde grace en un incidente.

**El evento son DOS puertas y no una, y escribirlo con una sola suspendía a quien había
pagado.** La versión anterior decía *«entra el pago de la cuota que sigue en `recycling`»*, y
`recycling` es un estado **del proveedor** (`B/12` §1.3, medido). Pero el pago del período impago
tiene una segunda puerta declarada en este mismo capítulo: **el pago manual (§7)**, cuya primera
fila es `MP1` —la segunda, `MP4`, entra por lo mismo y está abajo— y que
*«queda pendiente por `S19`, si es la predecesora de una sucesión en curso»* y cuyo principio
escrito es que **el daño no depende de por qué puerta entró el pago**. Con el evento atado al
reciclado, el pago manual **no matcheaba ninguna fila**: por la regla 1 del núcleo el intento no
se ejecutaba y se iba a la marca —el desenlace que este § existe para impedir—, y peor,
**`S6` seguía corriendo**. Su condición no pregunta si entró plata: pregunta si hay *«un pago
acreditado del período pendiente de resolución **por `S19`**»*, y si `S19` no corrió no hay nada
pendiente por `S19`, así que el reloj vencía y mandaba a `SUSPENDED` —que no emite fuente
(`12-contrato…` §2.6)— a alguien que había transferido la plata y tenía comprobante. **El evento
se enuncia sobre el hecho —entró el pago del período impago— y no sobre el mecanismo que lo
trajo.**

**Y no hay una tercera puerta que el evento deje afuera.** Las formas de que entre plata del
período impago son exactamente dos, y las dos están declaradas: el reciclado del proveedor
(`B/12` §1.3) y el pago manual (§7). **La puerta manual tiene DOS filas y sigue siendo una sola
puerta**: `MP1`, desde `AWAITING`, y `MP4`, desde `DECLARED_UNPAID`. El evento de `S19` las cubre
a las dos sin nombrarlas porque **se enuncia sobre el hecho —entró el pago del período impago— y
no sobre el mecanismo que lo trajo**, que es la misma razón por la que dejó de estar atado al
reciclado.

**Y por esa segunda fila `S7` SÍ es alcanzable desde la puerta manual, que es lo contrario de lo
que este párrafo decía.** Decía que un pago manual sobre una `SUSPENDED` no era una tercera puerta
porque *«`MP1` sale de `AWAITING`, y la única forma de que la suscripción de un pagador manual
llegue a `SUSPENDED` es `MP2` o `MP3`, que sacan al `manual_payment` de `AWAITING` en el mismo
acto — así que por esta puerta `S7` es inalcanzable»*. La aritmética era correcta y la premisa
caducó: desde `MP4` hay una transición que **sale** de `DECLARED_UNPAID`, así que el pago que el
admin registra tarde llega sobre una fila `SUSPENDED` y `S7` es exactamente su destino. La
conclusión que **no** cambia es la de este §: si esa fila es la predecesora de una sucesión en
curso, `S7` **no** corre y el pago queda pendiente por `S19`, con su condición 3 del `B/05` §3 sin
cumplir. `MP4` hereda esa condición igual que `MP1`, y por el mismo motivo escrito — *«el daño no
depende de por qué puerta entró el pago»*.

**Lo que este § dejaba declarado abierto ya está resuelto, y no acá.** Decía que qué pasa con un
pago manual que llega **después** de `DECLARED_UNPAID` *«es una decisión de producto que no es de
`S19`»*, y tenía razón en las dos mitades: la decisión la tomó el owner el 2026-09-21 —**se puede
reabrir**— y la ejecuta `MP4`, en el §7.1, que es donde vive la máquina del pago manual. Lo que
`S19` aporta es lo de siempre: que esa reapertura **no ocurra** mientras haya una sucesión en
curso.

**`S19` y `S5` comparten `(GRACE_PERIOD, entra el pago)`, y `S19` y `S7` comparten el par sobre
`SUSPENDED`: las guardas son disjuntas por construcción**, porque una pregunta si la fila es la
predecesora de una sucesión en curso y la otra si no lo es. Es la regla 7 del núcleo, y lo vigila
`G-R4`. **Abrir la segunda puerta no agrega un par, y su segunda fila tampoco**: ni `MP1` ni
`MP4` son eventos de esta tabla, sino efectos que entran por el evento *«entra el pago»* que
`S5`/`S19` y `S7`/`S19` ya compartían, así que los pares con dos filas **no crecen por acá** — hoy
son **cuatro** y el cuarto lo agregó `S25`, no esta puerta (`NUCLEO/03` §1 regla 7).

**Y `S6` lleva su condición por el mismo motivo**: con el pago acreditado y pendiente, el reloj del
grace mandaría a `SUSPENDED` —que no emite fuente (`12-contrato…` §2.6)— a alguien que pagó el
período. El tope es la ventana: 72 h, y después el pago se resuelve por una de las seis ramas de
`B/12` §5.3.

**Y el tope está escrito como condición, no sólo como intención, porque hay QUIÉN lo hace
vencer.** *«Después de 72 h»* no era ninguna condición de `S19`, `S5`, `S6` ni `S7`: las cuatro
cuelgan de dos booleanos —*«¿hay una sucesora viva apuntándome?»* y *«¿hay un pago pendiente por
`S19`?»*— y ninguno se apaga por el paso del tiempo. Los apagan **cuatro** actos declarados, uno
por rama. **Las ramas son SEIS desde la FASE 9-bis-4 y los actos distintos siguen siendo cuatro**,
porque `S18` cubre tres de ellas:

| cómo termina la sucesión | quién apaga el pago pendiente | cómo queda la fila |
|---|---|---|
| la sucesora autoriza | **`S18`**, que le abre a la predecesora la marca con motivo `REEMBOLSO_POR_CONFIRMAR` (`B/02` §2.5) | `CANCELLED` con esa marca abierta, en el canal de conciliación |
| la sucesora vence su ventana | **`S3`**, que lo reevalúa en el acto | reactivada por `S5` o `S7` |
| **la sucesión trabada** | **una persona**, sobre la marca que `S14` ya abrió — es la única cuyo reloj es humano | viva, con dos marcas abiertas cuando `S15` resuelve y `S18` cierra |
| cae un grant *Free Forever* | **`S13`**, que apaga la bandera sin reembolso | `CANCELLED`, sin nada pendiente |
| **el proveedor da de baja a la predecesora** (el espejo del §10.1, por mora acumulada) | **`S18`**, que corre sin `S17` y le abre la misma marca | `CANCELLED` con esa marca abierta, en el canal de conciliación |
| **la predecesora pide la baja estando `SUSPENDED`** (`S23`) | **`S18`**, que corre sin `S17` y le abre la misma marca | ídem |

**La tabla enumeraba cuatro filas y dejaba la quinta en prosa; hoy son las seis, y la de `S23`
—la sexta rama que la FASE 9-bis-4 agregó— no estaba en ninguna de las dos formas.** **Y el
backstop de `B/09` §3 sigue haciendo falta igual**, porque cubre el
caso en que alguno de los cuatro actos no se ejecutó.

#### `S10` es la única salida de `PAUSED` que devuelve el servicio, y su rama de fallo es lo que sostiene la garantía de retención

**`S10` tenía la columna de condición vacía y ningún desenlace escrito para la llamada que
falla**, y eso valía mientras la ausencia no sostuviera nada. Desde `DEC-DATA-002` sostiene la
mitad más cara de una garantía: el contenido publicable de la ficha de quien pausó.

**El desenlace que la ausencia dejaba, recorrido:** el día 120 nuestro reloj manda el `PUT` y no
se aplica. La fila se queda `PAUSED`, `cubierto` sigue falso, el reloj de inactividad de
verticales **no se reinicia** —su único hecho aplicable acá es `cubierto` pasando a verdadero
(`NUCLEO/01` §1.2, hecho 2)— y sigue corriendo hacia el día 180, que borra el contenido
(`V/02` §4.1). **El cliente queda sin servicio y sin cobro desde el día 120**, y a nadie le llega
nada que lo nombre.

**Y era invisible por construcción, con las tres redes apagadas a la vez:**

1. **El barrido compara y los dos lados coinciden**: nuestro estado dice `PAUSED` y el del
   proveedor dice `paused` —`PS-4` mide que **no** se reanuda solo—, así que ninguna de las cinco
   comparaciones de `B/09` §3 lo ve. Es la forma que ese § ya describe dos veces con otras
   palabras: *«la fila está `ACTIVE`, el proveedor dice `authorized`, y para el barrido eso
   coincide»*.
2. **`D16` y `G-R5` siguen en verde**, porque comparan **el tope que declara el catálogo** contra
   el día del hard delete (cap. 04 §3, núcleo). **El tiempo que una fila concreta lleva en
   `PAUSED` no es ninguna de las dos cifras**, y nada lo comparaba contra nada.
3. **Verticales no se entera ni puede**: no sabe que detrás de la pérdida de cobertura hay una
   pausa (`12-contrato…` §4, `DEC-TRIAL-008`).

**Por eso son dos escrituras y no una, y cada una tapa un agujero distinto:**

- **La rama de fallo**, en la fila: la reanudación se confirma **por relectura**, igual que la
  cancelación de `S17`, y si el proveedor sigue diciendo `paused` **`S10` no ocurre** y se pone la
  marca. Es lo que convierte una llamada perdida en un caso que una persona mira.
- **El detector**, en el barrido: la **quinta** comprobación de cero llamadas de `B/09` §3 —una
  pausa cuyo `fin_previsto` ya pasó y que sigue sin `fin_real`, con su suscripción en `PAUSED`—.
  Hace falta **además** de la rama porque la rama sólo corre **si el job corrió**: el modo que
  deja la fila colgada para siempre es el del job que no se ejecutó nunca, y ése no produce
  ninguna relectura que falle.

**El calificativo del título no es un matiz: `PAUSED` tiene otras tres salidas y ninguna sostiene
nada.** `S22` —la baja—, `S13` —el grant— y **`S25`** —el fin de la pausa sobre un plan que ya no
se presta (`DEC-SUB-015`)— **terminan la relación**, así que después de las tres no
queda ficha que republicar ni reanudación que esperar, y por eso el argumento de acá abajo es
sobre `S10` y no sobre *«salir de `PAUSED`»*: lo que la garantía de retención necesita es que la
persona que **pidió volver** vuelva. Las tres salidas terminales tampoco dejan colgada la quinta
comprobación de `B/09` §3 —que exige *«su suscripción sigue en `PAUSED`»*—, y `S22` y `S25`
además cierran la pausa escribiéndole `fin_real`.

**Y `S25` es el caso en que la persona SÍ pidió volver y no se la puede hacer volver**, así que
conviene decir qué le queda: la garantía de retención **no se pierde por su lado**. La fila muere,
pero `PB3`/`PB7` republican sus fichas en cuanto vuelva a estar cubierta (`V/03` §9), y la
cobertura vuelve con el alta nueva de `S1`. Lo que no vuelve es **el plan que tenía**, que es lo
que `DEC-SUB-015` declara perdido y avisa el día del anuncio, no el día de la vuelta.

**La asimetría con sus dos gemelas es lo que lo volvía un defecto y no una omisión pareja.**
`S17` **sí** tenía rama escrita —*«la única rama en la que la sucesión NO se cierra…»*, arriba— y
`S13` tiene su propio párrafo explicando por qué **no** la necesita (*«tiene que ocurrir igual»*,
con la salvedad 4 del barrido detrás). `S10` no tenía ni lo uno ni lo otro, y **es la única de las
tres cuyo desenlace silencioso termina en un borrado irreversible**.

**Y no se elige *«tiene que ocurrir igual»*, que es el patrón de `S13`.** Escribir la fila como
`ACTIVE` con el proveedor todavía en `paused` deja una suscripción que **cubre y no cobra** por
tiempo indefinido: le devuelve la ficha al cliente y nos come el ingreso, con `EX-15` midiendo que
mutar o cancelar **no emite webhook**, así que el primer aviso sería que el cobro no llega. En
`S13` cortar la obligación de pago *«pase lo que pase»* es lo que el §35.3 ordena y el acceso ya
lo da el grant; acá no hay ninguna otra fuente que sostenga nada.

#### La baja tiene CUATRO filas y no una: qué significa cancelar desde cada estado

**El acto es UNO** —*«cancelar una suscripción»*, una de las **doce** del `NUCLEO/08` §3, con un
permiso y una confirmación—, y `B/19` §5 lo deja self-service. **Lo que cambia por estado de
origen es qué queda por terminar**, y eso son cuatro desenlaces distintos que antes estaban
escritos en un solo renglón:

| desde | fila | a dónde va | qué queda por terminar |
|---|---|---|---|
| `ACTIVE` | `S11` | `CANCEL_SCHEDULED` | **el período que ya pagó**: se cancela allá de inmediato y lo sostenemos nosotros hasta esa fecha (`DEC-SUB-009`), que después ejecuta `S12` |
| `PAUSED` | **`S22`** | `CANCELLED` | **nada**: `DEC-SUB-010` ya se llevó los días no usados del ciclo al pausar. La fecha de fin de servicio es hoy (`B/12` §7.2) |
| `SUSPENDED` | **`S23`** | `CANCELLED` | **nada**: el §21 ya cortó el servicio y el estado no emite fuente. La fecha de fin de servicio es hoy |
| `GRACE_PERIOD` | **`S24`** | `CANCELLED` | **nada que esté pagado, y sí servicio que cortar**: el cobro del período en curso falló —por eso la fila está en el grace— y el último período pagado ya se consumió, así que la fecha de fin de servicio es hoy (`DEC-SUB-014`). Es la única de las cuatro en que la baja **retira cobertura que estaba corriendo** (§20) |

**Los cuatro estados vivos desde los que alguien puede pedir irse están cubiertos, y son cuatro y
no seis.** Los otros dos vivos no admiten el acto por razones que no son de esta tabla:
`PENDING_AUTHORIZATION` no tiene suscripción que dar de baja sino un checkout que terminar o
abandonar (§3.3.1), y `CANCEL_SCHEDULED` **ya está dada de baja** — pedirla otra vez no es una
transición, es un acto idempotente sobre el que `S12` ya está ejecutando.

**Por qué las tres nuevas no pasan por `CANCEL_SCHEDULED`, y no es una elección de estilo.** Ese
estado significa, textual, *«dada de baja en el proveedor, con servicio sostenido hasta el fin del
período pagado»* (§3.1). En las tres no hay período pagado que sostener, así que entrar ahí sería
**prometer un servicio que ninguna de las tres tiene**: desde `PAUSED` porque los días ya se
perdieron, desde `SUSPENDED` porque el §21 los cortó hace rato —y ahí además lo
**resucitaría**, que es peor— y desde `GRACE_PERIOD` porque **el período en curso no está
pagado**: su cobro es justamente el que falló. El §3.3 ya lo impedía para `PAUSED` (*«cualquier
cosa que no sea `ACTIVE` o `CANCELLED`»*) y acá se escribe la razón para las tres. **`S13` es el
precedente exacto**: alcanza a las filas en `PAUSED`, en `SUSPENDED` y en `GRACE_PERIOD`, cancela
el preapproval y las manda directo a `CANCELLED`, sin escala y sin fecha de fin de servicio.

**Y el servicio que `S24` corta no se le regala hasta el fin del grace**, que era la otra
respuesta posible. El reloj del §4 existe para acotar el servicio que se le presta a quien no
pagó (`B/12` §4.3, *«el grace no es un beneficio de entrada»*); dejarlo correr sobre alguien que
**ya decidió irse** alarga ese regalo sin que nadie lo haya elegido, y **deja el candado `A`
ocupado** mientras tanto — el mismo encierro que `S23` vino a romper (`DEC-SUB-014`).

**No compiten con ninguna fila, y se verifica por pares** (`NUCLEO/03` §1, regla 7). `S22`
comparte `desde` con `S10`, cuyo evento es *«llega el fin, o la persona vuelve antes»*; `S23` lo
comparte con `S7` y con `S19`, cuyo evento es *«entra el pago»*; `S24` lo comparte con `S5` y con
`S19` —*«entra el pago»*— y con `S6`, cuyo evento es *«se agota el reloj»*. **Ninguna otra fila de
esta tabla declara el evento de la baja**, así que los tres pares nuevos tienen una sola fila cada
uno. **La tabla de pares con dos filas no crece por la baja** — pero sí crece por `S25`, que es
otra fila y otro caso: ver abajo, *«`S25` comparte el par de `S10`»*.

**Y ninguna de las tres es consumidora de *«fila viva»***, así que el inventario de `NUCLEO/01`
§2.4 no gana filas: su `desde` es **un estado concreto** y no el conjunto. Lo contrario habría
sido escribirlas como `S13` —*«toda fila viva…»*—, y sobre este acto eso sería falso: la baja la
pide una persona sobre **su** fila, no un barrido sobre un conjunto.

#### `S25` comparte el par de `S10`, y es el CUARTO par con dos filas del programa

**`S25` no tiene evento propio: tiene el de `S10`.** Las dos salen de `PAUSED` y las dos se
disparan con *«llega el fin de la pausa, o la persona vuelve antes»*. Lo que las separa es una
guarda, y **es un booleano**: si el plan al que la fila está anclada **se sigue prestando**, la
pausa termina reanudando (`S10`); si **no** —su vertical fue discontinuada (`B/10` §4.3)—, la
pausa termina cancelando (`S25`).

**Escribirlo como un par con dos filas es lo correcto y no un accidente de redacción.** La
alternativa era meter la rama adentro de `S10` como un segundo `hacia`, y eso rompe la forma que
el resto de la tabla usa: **una fila, un `hacia`**. Las dos ramas de `PB2`, las dos de `PB3` y las
dos de `PB7` (`V/03` §9) son dos eventos con **el mismo** destino, que es el caso en que una sola
fila alcanza; acá los destinos son **opuestos** —`ACTIVE` y `CANCELLED`— y el cliente ve cosas
distintas en cada uno.

**Y es disjunto por construcción, no por acuerdo**, que es lo único que `NUCLEO/03` §1 regla 7
pide: las dos guardas leen **el mismo dato** —si el plan anclado se sigue prestando— y **una es la
negación de la otra**, así que no hay orden de recorrido que dirimir y no hace falta una
precedencia. Es la misma forma que los otros tres pares con dos filas: `T1`/`T6` difieren en
`cubierto`, y `S5`/`S19` y `S7`/`S19` en *«es la predecesora de una sucesión en curso»*. **Con
éste son cuatro**, y el conteo se recalculó sobre la tabla del `NUCLEO/03` §1, no se le sumó uno.

**El dato que las dos leen ya existe y no hay que inventarlo.** La suscripción está anclada a una
versión de plan (`DEC-ARCH-001`), el plan pertenece a **una** vertical (`V/02` §2.1) y la
discontinuación **deja la fila de `vertical` con su fecha de fin de servicio cumplida y no la
borra nunca** (`B/10` §4.5, borde 4). O sea que *«el plan se sigue prestando»* se contesta contra
el estado de esa vertical, no contra el flag de vendible: un plan **retirado** del catálogo
(`B/10` §3) se sigue prestando —*«las suscripciones vivas no se mueven»*— y esta guarda lo deja
del lado de `S10`, que es lo correcto.

#### `S13` alcanza a toda fila viva PRINCIPAL, no a una — y no alcanza a los complementos

El §35.3 ordena *«cancelar toda obligación de pago cubierta»*, en plural, y el origen de `S13`
enumeraba **cuatro** estados y una sola fila. *«Cubierta»* se lee contra el scope del grant, que
desde `B/02` §2.4 **no es una columna sino sus anclas**: una por vertical. Los dos estados que
faltaban no son bordes:

- **`PENDING_AUTHORIZATION` es el caro.** Una sucesora esperando autorización **es una obligación
  de pago**: su preapproval está creado y la persona puede completar el checkout en cualquier
  momento —no tiene por qué saber que el grant llegó—, y entonces `S2` la lleva a `ACTIVE` con una
  fecha de primer cobro que `B/12` §5.2 puso **días después** del grant. El beneficiario de *Free
  Forever* terminaba pagando todos los meses una suscripción que el grant le regaló, y nada lo
  detectaba: la fila está `ACTIVE`, el proveedor dice `authorized`, y para el barrido eso
  **coincide**. Por eso el efecto de `S13` cancela el preapproval **esté autorizado o esperando
  autorización**, y por eso la pantalla de *«esperando que completes el pago»* del §3.4 punto 3
  —con su enlace para retomar— tiene que dejar de ofrecer ese enlace en el mismo acto.
- **`CANCEL_SCHEDULED` entra por completitud**: no tiene obligación de pago viva —`S11` ya canceló
  su preapproval— pero dejarla afuera obligaba a leer la ausencia como una excepción. Entra, y la
  regla de *«ya está `cancelled`, no se manda nada»* hace que no cueste una llamada.

**Y son DOS los eventos que disparan `S13`, no uno, porque son dos las escrituras que hacen que un
grant cubra.** El origen escribía sólo *«`SUPER_ADMIN` otorga *Free Forever*»*, que era exacto
mientras el scope era **una columna del instrumento**: cambiarlo era editar el grant. Desde que el
scope **es el conjunto de anclas** (`B/02` §2.4), **anclarle una vertical nueva a un grant vivo es
un acto propio** —así lo declaran `12-contrato…` §2.8 y `B/02` §2.4— y **hace cubrir exactamente
igual que el otorgamiento**: emite en esa vertical una fuente `GRANT` de clase `TÍTULO` con
`hasta: NO_VENCE` (`12-contrato…` §2.7 y §2.4). Sin el segundo evento, el beneficiario de un grant
extendido a Gastronomía **sigue pagando todos los meses la suscripción de Gastronomía que el grant
le acaba de regalar**, y —otra vez— nada lo detecta: la fila está `ACTIVE`, el proveedor dice
`authorized`, y para el barrido eso **coincide**. Es el mismo daño que este § vino a cerrar,
entrando por la puerta que el acto nuevo abrió.

**El alcance se lee contra el acto, no contra el grant entero:**

| el evento es | `S13` alcanza |
|---|---|
| **otorgar** un *Free Forever* | toda fila viva **principal** del beneficiario en **cada** vertical que el grant ancla ese día |
| **anclarle una vertical nueva** a un grant vivo | toda fila viva **principal** del beneficiario **en esa vertical**, y en ninguna otra |

Las verticales que el grant ya anclaba **no se vuelven a recorrer**: sus filas vivas ya las cerró
el otorgamiento, y volver a pasar por ellas no haría daño —`S13` es idempotente, ver más abajo—
pero gastaría una llamada al proveedor por fila para no cambiar nada. La consecuencia queda dicha
en voz alta: **el acto nuevo le agrega a `S13` un segundo disparador, así que la ejecución parcial
de `S13` tiene dos orígenes y no uno**, y el detector del final de este § tiene que cubrir los dos.

**Si el grant cae en medio de una sucesión, `S13` alcanza a las dos filas y la sucesión no se
cierra: se cancela.** No corre `S18` —no queda ninguna sucesora viva a la que pasarle el origen, y
su `desde` pide una— y la sucesora queda `CANCELLED` con su `sucede_a` escrito, que es el registro
fiel de lo que pasó: es el **cuarto** estado de la relación de la tabla de arriba, *«sucesión
muerta sin cerrarse»*, y es la razón por la que los predicados que leen ese puntero exigen que
quien lo escribió **siga vivo**.
No ocupa ningún candado, porque los dos índices son parciales sobre las filas vivas, y no dispara
`G-R1-A`, que desde `B/20` §2 mira **el acto de declarar** y no una propiedad permanente de la
fila.

**Esto vuelve verdadera una afirmación de `B/14` §4.3** —*«sobre un grant no se otorga cortesía
… porque no queda nada que no cobrar»*—, que con `S13` alcanzando una sola fila era falsa
exactamente en este camino.

##### Y no alcanza a los complementos: el `desde` dice «principal» y eso es una acotación, no un matiz

**Una suscripción de complemento es una fila de `subscription` como cualquier otra** —con su
`clase`, su `vertical` y su propio preapproval (`B/02` §2.2, `DEC-ADDON-002`)—, y el §3 declara
que *«usan esta misma máquina»*. Con el `desde` escrito como *«toda fila viva del beneficiario en
cada vertical que el acto ancla»*, **entraban por pertenencia al conjunto**, y el resultado era
malo en las dos direcciones:

- **hacia perder lo pagado**: el *«Boost 30 días»* que el beneficiario compró ayer quedaba con su
  preapproval cancelado de forma irreversible (`PA-5`) y **sin reembolso** (`DEC-GRANT-001`), en el
  mismo acto en que se le regala el plan;
- **hacia regalar lo que nadie paga**: para un addon de scope `USER` o `GLOBAL` el objetivo es la
  cuenta, que no se borró, así que **no queda huérfano** (`B/16` §4.2) — pero su cobro ya estaba
  cancelado, y **ninguna transición de la máquina de addon tiene por evento *«mi suscripción de
  complemento fue cancelada»*** (`A4` es su fecha de fin, `A5` la baja, la orfandad o la
  revocación de su grant-título, y `A6` el borrado de la ficha, §8). La instancia se quedaba `ACTIVE` y gratis para
  siempre.

  > **`S20` deja a esa instancia exactamente así —`ACTIVE` y gratis— y no es el mismo desenlace**,
  > aunque la foto coincida. Acá el addon quedaba gratis **porque nadie decidió nada** y sin
  > ninguna forma de apagarse: el grant se revocaba y seguía encendido para siempre. Con `S20` es
  > gratis **porque el §35.2 lo declara gratis** mientras el grant dure, la instancia **cuelga del
  > ancla** y **tiene apagado declarado**: la tercera cláusula del evento de `A5` la corta cuando
  > se revoca el grant (§8, `B/16` §3.3). Lo que hacía inadmisible este camino no era que el addon
  > quedara gratis: era que **nada lo volvía a apagar**.

**Las tres reglas que lo prohíben ya estaban escritas, y ninguna es de acá**: el §41 ordena *«no
cancelar ciegamente»* y cancelar *«sólo cuando queda efectivamente huérfano»*; `DEC-ADDON-002`
implicación 6 dice que **cancelar el plan NO cancela los addons**; y
[`12-contrato-de-cobertura.md`](../../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md)
§2.4 lo dice del caso exacto —*«quien tiene *Free Forever* y un addon **conserva los dos**»*—.
`S13` cancelaba **por pertenecer al conjunto**, sin evaluar ninguna condición, que es literalmente
lo que el §41 prohíbe.

**Qué le pasa entonces a la instancia del addon, dicho para que no quede en la inferencia:**

| scope del addon (§40) | qué pasa cuando `S13` mata la principal de esa vertical |
|---|---|
| `VERTICAL_SUBSCRIPTION` | **no queda huérfano**: el grant que acaba de caer **vale como título en esa vertical** (`B/16` §2.4), y ésa es la tercera salvedad de la condición de `B/16` §4.2. Sin ella, `A5` lo cancelaría de inmediato por la otra puerta y *«conserva los dos»* sería falso igual |
| `USER` · `GLOBAL` | **no queda huérfano**: el objetivo es la cuenta y la cuenta no se borró. Ya era así; lo que cambia es que ahora `S13` tampoco le cancela el cobro |
| `LISTING` | **no lo toca nadie**: su objetivo es la ficha (`B/16` §4.2) |

**Y `S13` no le apaga el cobro a ninguno de los tres, que es lo que esta acotación garantiza.** Es
la regla 1 del núcleo leída en la dirección que menos se lee: lo que la tabla no declara **no
pasa**, así que un grant que no alcanza al complemento tampoco lo deja gratis por accidente.

**Lo que SÍ se lo apaga es `S20`, y es otra fila con otra condición.** Que la instancia sobreviva
al grant no decidía de dónde sale la plata, y **durante toda una tanda nadie lo escribió**: el
beneficiario de un *Free Forever* con `includesAddons: true` seguía pagando todos los meses un
addon que su propio flag le declaraba gratis. Eso lo cierra `S20` (arriba, y el caso entero en
`B/16` §3.4), que **evalúa una condición** —el flag, la compatibilidad del producto con la
vertical anclada y, en los scopes con vertical propia, el objetivo— en vez de alcanzar por
pertenencia. Las dos afirmaciones conviven sin contradecirse porque **hablan de conjuntos
distintos**: `S13` de las principales, `S20` de las de complemento que cumplen su condición. Un
complemento **no compatible**, o cualquiera si el flag es `false`, **sigue cobrando** — y sigue
siendo lo correcto, por la misma razón por la que `S13` no lo alcanza.

**`S13` y `S20` comparten el evento y NO comparten el par, así que `G-R4` no tiene nada que
mirar.** El evento es el mismo —otorgar, o anclar una vertical nueva—, pero el `desde` de una es
*«toda fila viva **principal**»* y el de la otra *«toda fila viva **de complemento**»*, y la
partición por `clase` (`B/02` §2.2) hace que los dos conjuntos sean **disjuntos por
construcción**: ninguna fila puede satisfacer los dos. La regla 7 del núcleo pide guardas
disjuntas cuando el par coincide; acá **el par no coincide**, y **los pares con dos filas de
esta tabla no crecen por `S20`/`S21`** — hoy son **cuatro**, y el cuarto lo agregó `S25`
(`NUCLEO/03` §1 regla 7).

##### La ejecución parcial: `S13` es idempotente, y su detector cuesta cero llamadas

**`S13` es un fan-out**, y desde que el scope son anclas es un fan-out de N verticales × hasta seis
estados, **con una llamada al proveedor por fila** y con **dos disparadores** que lo pueden lanzar.
Su vecina `S12` cierra su efecto con *«proceso idempotente»* y `S13` no decía nada, así que nada
declaraba qué pasa si la corrida muere entre la vertical 2 y la 3.

> **`S13` es idempotente y reanudable fila por fila.** Volver a correrlo sobre una fila que ya
> cerró no escribe nada y no manda nada —la regla de `S17` ya dice que si la relectura ve el
> preapproval `cancelled` no se manda nada—, así que **reanudar es volver a correr el acto
> entero**, no llevar un cursor.

**Y la idempotencia sola no alcanza, porque el estado que deja una corrida cortada es
indetectable.** Lo dice este mismo § al justificar por qué `PENDING_AUTHORIZATION` entró en el
alcance: *«la fila está `ACTIVE`, el proveedor dice `authorized`, y para el barrido eso
**coincide**»*. Esa frase describe el defecto que el alcance vino a cerrar **y sigue siendo
verdadera** para la vertical que la corrida no alcanzó. Por eso el detector va aparte y es la
**tercera comprobación de cero llamadas** de `B/09` §3: *«un beneficiario con un ancla viva en la
vertical V no debería tener una fila viva principal en V»*. Las dos filas están en nuestra base,
igual que las de las otras cinco comprobaciones.

**Y `S20` corre en el mismo acto, con el mismo fan-out y el mismo modo de falla, así que la
tercera comprobación lo cubre a él también.** No es una comprobación nueva: es la misma
pregunta sobre el otro conjunto —*«…ni una fila viva de complemento de un addon compatible en
V»*—, y hace falta por la razón de siempre, escrita con las mismas palabras: la fila de
complemento dice `ACTIVE`, el proveedor dice `authorized`, **y para el barrido eso coincide**.
Una corrida que muere después de cerrar las principales y antes de llegar a los complementos deja
al beneficiario **pagando un addon que el flag le declaró gratis**, que es exactamente el defecto
que `S20` vino a cerrar, entrando por la puerta de la ejecución parcial.

**`S14` y `S15` quedan en la tabla y ya no son transiciones de estado.** Se listan acá porque son
los dos eventos que el §22.1 gobierna y nadie los debe buscar en otro lado, pero **ninguna de las
dos mueve la columna de estado**: la primera **abre** una marca con su motivo, la segunda levanta
**una** de las abiertas (`B/02` §2.5). Si al resolver
corresponde además un cambio de estado, ése se ejecuta **con la transición de esta misma tabla que
lo permita** — y eso es justamente lo que se ganó, porque antes `S15` tenía que adivinar a dónde
volver.

##### El orden de las dos escrituras de `S20`, que es lo que lo vuelve reanudable

**La frase de `S13` no se podía copiar, y se había copiado.** `S13` es reanudable *«porque volver
a correrlo sobre una fila que ya cerró no escribe nada»*, y ese argumento **supone un efecto por
fila**: el estado, más una llamada idempotente por la regla de relectura. **`S20` tiene dos
escrituras sobre dos entidades distintas**, y la segunda no tiene guarda propia: se ejecuta
porque la corrida llegó hasta ahí, no porque un predicado la pida.

**Y una de las dos saca la fila de su propio `desde`.** El `desde` de `S20` es *«toda fila viva de
complemento … cuya instancia esté en uno de sus dos estados vivos»*, así que **en cuanto la
suscripción de complemento llega a `CANCELLED` la fila deja de estar alcanzada**: volver a correr
el acto entero ya no la encuentra. Cuál de las dos escrituras es ésa **lo decide el orden**, y de
ahí que el orden sea normativo y no una nota de implementación:

| orden | qué deja una corrida cortada entre las dos | ¿se puede reanudar? | ¿lo ve alguna comprobación? |
|---|---|---|---|
| **cancelar el cobro y después anclar** ❌ | instancia `ACTIVE`, **sin cobro**, y con el ancla-título **en nulo** | **no**: la fila salió del `desde` | **no, en 3 de los 4 scopes** |
| **anclar y después cancelar el cobro** ✅ | instancia `ACTIVE` **ya colgando del ancla**, con su complemento **todavía vivo** | **sí**: la fila sigue en el `desde` | **sí**: es la segunda fila de la tercera comprobación |

**Lo que hace inadmisible el primero es lo mismo que hacía inadmisible el camino viejo.** El
ancla-título es *«el consumidor de la tercera cláusula del evento de `A5`»* (`B/02` §2.4): con la
columna en nulo, **el día que se revoque el grant nada apaga ese addon** —y en `LISTING`, `USER` y
`GLOBAL` el objetivo nunca muere, así que la orfandad tampoco lo alcanza jamás (§8, `B/16` §4.2)—.
Es, con las palabras del recuadro de más arriba, *«el addon funcionando gratis para siempre y sin
suscripción»*: el desenlace que este § ya declaró inadmisible, reintroducido por la puerta de una
corrida cortada.

**Y en ese estado el barrido está ciego por construcción.** La tercera comprobación busca **una
fila viva de complemento** y ahí ya no hay ninguna; la cuarta pregunta por *«el ancla que era su
título»* y la columna quedó nula, así que no hay ancla que comparar. Las dos que podrían verlo
**miran cosas que en ese estado están sanas** (`B/09` §3).

**El orden correcto falla hacia el lado recuperable, y conviene decir hacia dónde.** Entre las dos
escrituras el beneficiario **sigue pagando un addon ya declarado gratis** — que es el estado
anterior a `S20`, dura lo que tarde la reanudación, y es exactamente la población que la tercera
comprobación levanta al día siguiente. El costo del orden inverso no se paga en días: se paga en
una capacidad que sigue encendida gratis para siempre después de revocado el único instrumento
que la sostenía.

**La llamada al proveedor queda ENTRE las dos escrituras, y eso no abre un tercer estado.** Si la
corrida muere después de cancelar el preapproval y antes de escribir `CANCELLED`, la fila local
dice viva y el proveedor dice `cancelled`: **es una divergencia de estado que las cinco
comparaciones del `B/09` §3 sí ven**, y reanudar el acto entero la cierra sin mandar nada, por la
regla de relectura de `S17`. Es el único de los tres cortes que no necesita una comprobación de
cero llamadas, porque los dos lados **dejan de decir lo mismo**.

**Y hay un segundo efecto del orden que conviene decir, porque es el que cierra el caso peor.**
Si el grant se revoca **mientras la corrida está cortada**, la instancia ya tiene su ancla-título
escrita, así que **la tercera cláusula del evento de `A5` la encuentra y la apaga** (§8); y como
su suscripción de complemento todavía está viva, `S21` la lleva a `CANCELLED` detrás. Con el orden
inverso, ese mismo escenario dejaba la instancia sin ancla, `A5` sin sujeto y el addon **encendido
gratis después de revocado el único instrumento que lo sostenía**. El orden no sólo hace reanudable
la corrida: hace que **el camino del final también funcione sobre una corrida que nunca se
reanudó**.

**Nada de esto alcanza a `S21`, y por eso `S21` sí puede decir *«idempotente»* a secas.** Su
efecto es **una** escritura sobre **una** entidad —la columna de estado de la suscripción de
complemento—, y su condición es sobre el estado de la instancia, que `S21` no toca. No hay dos
mitades que puedan quedar separadas.

#### El complemento que sobrevive a su instancia: por qué `S21` es una fila de ESTA tabla

**`A5` apaga la instancia y nadie apagaba su cobro.** `B/09` §3 lo tenía declarado abierto con
todas sus letras —*«lo que sigue sin estar declarado es en qué estado queda esa suscripción de
complemento cuando su instancia muere por orfandad»*—, y el agravante estaba medido: **el barrido
selecciona esa fila por el estado terminal de su INSTANCIA** (salvedad 1), así que el único
proceso que la vigila la encontraba por un lado mientras ella misma no tenía estado declarado por
el otro. La decisión del owner del 2026-09-21 (`DEC-ADDON-004`) es **`CANCELLED` en el acto, junto con la
instancia**, y esta fila es la que lo ejecuta.

**Por qué es una fila de esta tabla y no un efecto declarado de `A5`.** La escritura es sobre la
columna de estado de una **suscripción**, y una suscripción de complemento *«usa esta misma
máquina»* (§3): un efecto de la tabla de addon que moviera esa columna es exactamente lo que la
regla 1 del núcleo no admite —*«lo que la tabla no declara, no pasa»*, leída sobre la tabla del
sujeto que se escribe—. Y el precedente es del mismo día: `S20` también lo dispara un acto de otra
entidad —el grant— y también es una fila propia acá, por la razón que `DEC-ADDON-003` deja escrita.
**`A5` conserva su efecto sobre el proveedor y no gana uno sobre esta columna.**

**Cubre las DOS puertas y las cuatro cláusulas, no una.** La orfandad mira el **objetivo** —la
condición de `B/16` §4.2, con sus **tres** mitades: el objetivo dejó de ser fila viva, ninguna
sucesión lo releva y ningún grant permanente lo releva— y el corte del `B/16` §3.3 mira el
**título** —la tercera cláusula del evento de `A5`, *«se revoca el grant del que cuelga el ancla
que era su título»*, que es la única que alcanza a los scopes `LISTING`, `USER` y `GLOBAL`—. Escribir el evento de `S21` contra una sola de
las dos habría dejado vivo el cobro de tres de los cuatro scopes, que es el mismo agujero que la
tercera cláusula vino a cerrar en la otra máquina. Por eso el evento **no reescribe ningún
predicado: se ata al estado de llegada de la instancia**, que es donde las tres cláusulas de `A5`
—más `A6`— ya confluyen.

**`A3` no entra, y no por olvido.** Lleva la instancia a `ABANDONED`, y ahí la fila de complemento
ya tiene transición propia: es `S3`, la misma ventana de 72 h, con su misma cancelación en el
proveedor. **`A4` tampoco**, y su población es vacía: un preapproval propio existe sólo si el cobro
es `PERIÓDICO`, y `PERIÓDICO` + `DÍAS_FIJOS` **no existe** (`B/16` §1.2 y §1.3).

**Por qué no se aplica el patrón de `DEC-SUB-009`, que es la alternativa que había que descartar.**
Esa decisión cancela en el proveedor de inmediato y **sostiene el servicio de nuestro lado** hasta
el fin del período pagado, y su motivo es la dirección en la que falla: *«el fallo regala unos días
de servicio, y se corrige sin mover un peso»*. Acá ese motivo **no tiene de qué agarrarse**, y son
tres razones que no se pisan:

1. **No hay servicio que sostener.** La capacidad ya la apagó `A5` sobre la instancia, en el mismo
   acto. Lo que un `CANCEL_SCHEDULED` sostendría no es un destaque: es **la fila de un cobro**
   —sostener un destaque sobre una ficha despublicada, o sobre una vertical que el cliente ya no
   tiene, **no le da nada a nadie**—.
2. **El addon COMPLEMENTA algo que ya no está**, y ésa es la diferencia con la baja del §24: ahí
   el cliente pide irse de algo que sigue funcionando y quiere usar hasta el día que pagó; acá el
   objetivo o el título desaparecieron **sin que el cliente lo pidiera necesariamente**, y el
   contrato ya descarta las fuentes de clase `COMPLEMENTO` cuando no queda ninguna de clase
   `TÍTULO` viva (`12-contrato…` §2.4).
3. **El costo de la alternativa es una fila viva que el barrido tiene que seguir mirando**, con su
   reloj, su fecha de fin de servicio como dato nuestro (`DEC-SUB-009` implicación 3) y una entrada
   más en cada predicado que enumera los seis estados — todo para sostener un estado vacío. Y si de
   verdad hubiera que devolver plata, eso **se resuelve por la vía del reembolso**, que ya tiene su
   regla y su confirmación humana (`DEC-RF-002`): no se fuerza a la máquina a sostener un estado
   vacío para emular una devolución.

**El período ya pagado no se reembolsa, y va escrito y no implícito.** Es el mismo criterio con el
que `DEC-GRANT-001` lo dice para `S13` y `B/16` §3.4 para `S20`, apoyado acá en las tres reglas que
`DEC-RF-002` enumera: *«reembolsar»* es una acción que mueve dinero, con permiso propio y
confirmación explícita (`NUCLEO/08` §3); la línea del owner es *«toca plata o no toca plata»*
(`B/09` §2.4); y `S14` prohíbe **toda decisión destructiva automática**. Un reembolso automático acá
sería la primera operación automática sobre dinero del diseño, en un dominio que está vacío a
propósito.

**Y para el addon convertido a $0 la población de `S21` es vacía, que es la comprobación de que las
dos filas no se pisan.** Ahí la suscripción de complemento ya la mató `S20` en el acto del
otorgamiento, así que cuando se revoca el grant y `A5` corta la instancia por su tercera cláusula,
`S21` no encuentra ninguna **fila viva** de complemento — es, con otras palabras, el *«normalmente
no queda ninguno vivo»* del §8. `S21` es lo que cierra el cobro del addon que **nunca** fue
gratis y llegó a `A5` por cualquiera de las otras puertas.

> **El *«normalmente»* tiene un caso con nombre, y no es un borde sin dueño: una corrida de `S20`
> cortada entre sus dos escrituras.** Ahí la instancia ya cuelga del ancla y **su complemento
> sigue vivo**, así que si el grant se revoca antes de que la corrida se reanude, `A5` la apaga
> —tiene sujeto, que es todo el punto del orden— y **`S21` sí encuentra una fila viva de
> complemento y la lleva a `CANCELLED`**. Las dos filas siguen sin pisarse: `S20` no llegó a
> cancelarla y `S21` sí, cada una por su evento. Es el único camino por el que la población de
> `S21` sobre un addon convertido no es vacía, y es exactamente el que no puede quedar sin
> cerrar.

**`S21` no agrega ningún par con dos filas, así que `G-R4` sigue contando tres.** Comparte el
`desde` con `S20` —las dos salen de *«toda fila viva de complemento»*— y **compartir el `desde` no
es compartir el par** (`NUCLEO/03` §1 regla 7): el evento de `S20` es otorgar o anclar un grant y
el de `S21` es que su instancia llegó a `CANCELLED`, y ninguna otra fila de esta tabla declara
ninguno de los dos. **Y tampoco se pueden satisfacer a la vez**: `S20` declara explícitamente que
**la instancia no cambia de estado**, así que en ese acto no hay ninguna instancia llegando a
`CANCELLED`.

### 3.3 Las transiciones que NO existen, y por qué

Tan importantes como las que existen, porque cada una es un error que alguien va a intentar
escribir:

| lo que no existe | por qué |
|---|---|
| `CANCEL_SCHEDULED` → `ACTIVE` | arrepentirse **no es una transición: es una sucesión**. `DEC-SUB-009` cancela en el proveedor de inmediato y cancelar allá es irreversible (`PA-5`), así que volver exige recrear y volver a autorizar — y eso entra por el candado `B` igual que un upgrade, **no** por un `INSERT` que el §11 rechace. No hay riesgo de doble cobro: `S11` ya canceló el preapproval de la predecesora *«de inmediato»*, así que la única autorización que puede cobrar es la de la sucesora. **Y por eso mismo `S17` no manda nada acá**: su relectura encuentra el preapproval ya `cancelled`, `D7` está cumplido, y la sucesión la cierra `S18` (§3.2) |
| `CANCELLED` → cualquier cosa | ídem. Una suscripción terminada no revive |
| `TRIAL_*` → `SUSPENDED` | el trial vencido es `TRIAL_EXPIRED`, que es otra máquina y otro estado (`DEC-ARCH-003`) |
| `PAUSED` → cualquier cosa que no sea `ACTIVE` o `CANCELLED` | está medido que **estando pausada el proveedor rechaza toda modificación** (`EX-11`), y que **sí deja cancelar**. **Las dos que quedan afuera de la prohibición tienen fila**: `ACTIVE` es `S10`, y `CANCELLED` es **`S22`** —la baja—, `S13` —el grant— y **`S25`** —el fin de la pausa sobre un plan que ya no se presta (`DEC-SUB-015`)—. Esta celda decía qué no pasa y, hasta `S22`, una de las dos que sí pasan no estaba escrita. **Y es lo que obliga a que `S25` exista**: `B/10` §4.3 mandaba la pausada de una vertical discontinuada a `CANCEL_SCHEDULED`, que es justo lo que esta fila prohíbe |
| `ABANDONED` → `ACTIVE` | la ventana venció y el preapproval se canceló. Volver a intentar crea una fila nueva, con clave de idempotencia nueva |
| dos vivas para el mismo `user + vertical`, **salvo una sucesión declarada** | es el §11, y su excepción está acotada por la base, no por una convención: **un origen y su única sucesora**, impuesto por los dos índices parciales de `B/02` §2.2. La condición está en `S1` y el capítulo 05 la hace cumplir con restricciones de unicidad, no con un chequeo. El invariante cuenta **compromisos, no filas** |

**El arrepentimiento no le quema al cliente el período que ya pagó, y hay que decirlo porque
`S17` lo pasa a `CANCELLED` antes de su fecha de fin de servicio.** Lo que esa fecha sostenía era
**la emisión de cobertura** de la predecesora (`12-contrato…` §2.6), y a partir de `S18` la
cobertura la da la sucesora, que está `ACTIVE`. Y lo pagado sin usar **no se pierde**: la
sucesión del arrepentimiento computa el crédito de `DEC-SUB-006` como cualquier otra, *«al crear
la sucesora»* (`B/12` §5.4), corriendo la fecha de su primer cobro. Es la misma uniformidad que
`B/12` §5.2 defiende para la precondición de `D8` —*«vale para toda sucesión, venga de donde
venga»*—: una sucesión con una regla de compensación propia según de dónde viene es una regla que
alguien va a leer mal.

**Dos cosas que el §11 sigue prohibiendo y conviene no confundir con la excepción**: una sucesora
**no puede ser sucedida mientras viva** (el candado `B` la rechaza sin ninguna regla extra), y una
fila **con una marca `requiere_conciliación` abierta no puede ser sucedida** —cualquiera sea su motivo, y ningún `sucede_a`
puede apuntarla—, salvo desde `CANCEL_SCHEDULED` y con la relectura que `B/02` §2.2 exige. **Las
dos se enuncian sobre la columna y no sobre el verbo *«declarar»***, que en este corpus nombra a
la sucesora en `S1` y a la predecesora acá: la regla de vocabulario está en `B/02` §2.2 y la
escribió un doble cobro.

#### 3.3.1 Dos estados desde los que el cambio de plan NO se ofrece

Los dos salieron de recorrer el dominio completo del candado y **ningún informe de FASE 8 los
tenía**. En los dos, **la operación no se ofrece, con el motivo explícito en pantalla**:

| estado | qué había escrito | qué se le dice |
|---|---|---|
| `PENDING_AUTHORIZATION` | **nada**. Ningún capítulo lo nombra: el §3.4 punto 4 dice qué pasa si reintenta **el mismo** plan —*«no se crea otra, se reusa la vigente»*— y nada de cambiar a otro | *«terminá o cancelá el checkout que tenés abierto»* |

| `PAUSED` | una regla **cuyo destino no existe**: este mismo § prometía que el cambio *«se encola y se aplica al reanudar»*, y la cola de `B/12` §2.1 **es de entitlements, no de checkouts** | *«reanudá tu suscripción para cambiar de plan»* |

**Y el primero alcanza también al alta NUEVA, no sólo al cambio de plan.** El caso es el del
cliente cuya suscripción murió sola —`S12`, `S16` o el espejo del §10.1— teniendo una sucesora
esperando autorización:
`S18` cierra la sucesión en el acto y esa sucesora pasa a ocupar el candado `A` (§3.2), así que el
alta nueva que `B/12` §4.4 le ofrecería **la rechaza la base**. Lo que la superficie tiene que
ofrecer ahí es lo mismo de la primera fila: terminar o abandonar el checkout abierto, con su
enlace y su fecha de vencimiento. **Es la única forma de que no queden dos preapprovals
cobrando**, y no lo deja bloqueado: abandonar lo lleva a `ABANDONED`, que no es vivo, y desde ahí
el alta nueva entra sin pelear con nada.

**Por qué no se construye el mecanismo, y no es por costo**: los dos son de **superficie, no de
modelo**, y en ninguno el cliente queda bloqueado. En el primero tiene un checkout abierto que
puede terminar o abandonar —y abandonarlo lo deja en `ABANDONED`, desde donde sí puede elegir
otro—; en el segundo puede reanudar y cambiar. Construir la cola del segundo además exige pelear
contra `EX-11`, que mide que **el proveedor rechaza toda modificación sobre una pausada**.

**Lo único que faltaba era decir el no en voz alta**, en vez de que alguien lo descubra
implementando.

### 3.4 Las tres precisiones que `M-SUB-01` pedía sobre `PENDING_AUTHORIZATION`

El §5.6 define el modelo actual —Hospeda crea el preapproval y después manda a autorizar—, así
que **esta ventana existe siempre, por diseño**, y es donde se pierde gente. `M-SUB-01` pedía
cuatro cosas y acá están las cuatro:

1. **Duración máxima: 72 horas.** Es configuración, no constante (§9), y vive en las opciones
   globales de billing. El valor sale de dos restricciones: tiene que ser más largo que
   cualquier demora del proveedor —medida hasta ~33 min— y más corto que el ciclo más corto que
   vendemos, para que una ventana abierta nunca se superponga con un cobro.
2. **Limpieza**: un job recorre las vencidas, las lleva a `ABANDONED` y **cancela el preapproval
   en el proveedor**. Sin ese segundo paso queda una autorización viva que puede cobrar.
3. **Qué ve la persona mientras tanto**: su vertical en estado «esperando que completes el
   pago», con el enlace para retomar y la fecha en que vence. El enlace **nunca es el que
   devuelve la API crudo**: está medido que viene roto (`EX-37`), y el capítulo 06 fija que se
   sanea con un guard estático.
4. **Qué pasa si vuelve a intentar**: **no** se crea otra. Se reusa la vigente si le queda
   ventana. Está medido que el proveedor **no deduplica por ningún mecanismo** (`EX-17`: diez
   intentos, diez ids) y que su buscador **ignora nuestra referencia** (`RC-1`), así que el
   candado es nuestro o no existe (`DEC-CONC-001`). **Y ya no depende de que el camino se acuerde
   de reusarla**: el candado `A` de `B/02` §2.2 incluye `PENDING_AUTHORIZATION` entre los vivos, así
   que el segundo `INSERT` lo rechaza la base. El reuso pasó de ser una regla del servicio a ser
   una consecuencia de la restricción.

   **La afirmación exige que la fila pendiente ocupe `A`, y una sucesora ocupa `B`** — por eso el
   cierre no espera la autorización cuando la predecesora se murió sola (§3.2). Sin ese segundo
   evento de `S18` esta frase era falsa exactamente para la población que más la necesita: el
   cliente al que le rechazaron el primer cobro (`S16`) con un cambio de plan en curso.

---

## 4. Grace

Sub-estado de Suscripción con reloj propio. Entra por `S4` y sale por `S5`, por `S6` o por
**`S24`**, la baja que la persona pide en el medio (`DEC-SUB-014`) — y por `S17` o
`S13`, si la fila es la predecesora de una sucesión que se consuma o le cae un grant. **Mientras
esa sucesión esté en curso, ni `S5` ni `S6` se ejecutan**: el pago que entre queda pendiente por
`S19` y el reloj no vence sobre él (§3.2).

| | |
|---|---|
| **cuándo entra** | falla un cobro de una suscripción `ACTIVE` (§20) |
| **cuánto dura** | los días que declara **la versión de plan**, default **10** (`DEC-SUB-002`) |
| **qué pasa durante** | §20: servicio activo, fichas publicadas, edición activa, entitlements activos, advertencias y correos |
| **cómo sale bien** | entra el pago → `ACTIVE` |
| **cómo sale mal** | se agota el reloj → `SUSPENDED` |
| **qué se puede hacer adentro** | **cambiar de plan está permitido, y es el camino de recuperación** (`DEC-SUB-003`): se intenta el cobro del plan nuevo de inmediato; si entra, vuelve a `ACTIVE` con el plan nuevo; si falla, **sigue en grace con el plan anterior y no cambia nada** |

**Dos cosas que el reloj tiene que respetar:**

- **Los correos del §42.3 son relativos al vencimiento, no absolutos.** Si la ventana es
  configurable, un schedule con días fijos se cae fuera de la ventana en los planes con grace
  más corto (`DEC-SUB-002`).
- **El reloj no puede preguntar «¿ya cobró?» a una hora exacta.** Está medido que el cobro del
  proveedor llega tarde y que el retraso es variable —33 minutos en una renovación de sandbox,
  ~26 en producción, ~100 segundos en un alta—. Toda comparación contra el reloj lleva margen.

---

## 5. Pausa

Sub-estado de Suscripción con reloj propio **y motivo obligatorio**. Entra por S8 o S9, sale
por S10 — **o termina, sin reanudar, por `S22` (la persona pide la baja) o por `S13` (le cae un
grant)**. Las dos terminales mandan la fila a `CANCELLED` y **cierran la pausa**, así que la que
sostiene lo que sigue es S10.

| | |
|---|---|
| **motivos** | `CUSTOMER_REQUEST` · `COURTESY`. Valor cerrado |
| **unidad** | **meses enteros** (`DEC-SUB-010`). No existe la pausa intra-ciclo |
| **cuándo empieza** | en el momento en que se pide, no al fin del ciclo |
| **quién la termina** | **la reanuda nuestro reloj, y no hay segunda vía**: está medido que el proveedor **no tiene auto-reanudación** (`PS-4`). Por eso `S10` lleva **rama de fallo y detector** (§3.2, *«`S10` es la única salida de `PAUSED` que devuelve el servicio»*). **La persona sí tiene una segunda vía, y no reanuda: es irse** (`S22`) |
| **qué pasa al volver** | se cobra normal en el ciclo siguiente; reanudar cambia **sólo el estado** y no dispara cobro de recuperación ni deja deuda (`PS-5`) |
| **límites** | los del §26.3, reexpresados en meses: **4 pausas-mes** por pausa y **8** acumulados en 12 meses; máximo 3 pausas por ventana. Se cuentan por `user + vertical` y **sobreviven a cancelar y volver a suscribirse** (`DEC-SUB-004`) |

**Qué le pasa a la ficha mientras dura la pausa, porque esto no se puede escribir de un solo
lado.** Una `PAUSED` por `CUSTOMER_REQUEST` **no emite fuente** (`12-contrato…` §2.6), así que
`cubierto` pasa a falso y `PB2` baja la ficha el primer día (`V/03` §9). **Y el reloj de
inactividad de verticales no se detiene**: si la pausa cruza el día 90, `PB4` la archiva.
Verticales no sabe que detrás de esa pérdida de cobertura hay una pausa, y `DEC-TRIAL-008`
decidió que no lo sepa, así que lo que protege al cliente no es una excepción sino **tres** cosas:
**`PB7` republica la ficha sola** cuando la cobertura vuelve al reanudar; **el tope de una
pausa es menor que el día del hard delete** —4 pausas-mes, unos 120 días, contra 180 (`V/02`
§4.1)—; y **que la reanudación efectivamente ocurra**, que es la premisa de las otras dos.

Esa desigualdad es el invariante `D16` y la vigila **`G-R5`, sobre el número que declara la fila
de arriba**: subir el tope de pausa acá sin mirar el otro lado es lo que le borraría el contenido
a un cliente que está al día. El aviso que se lo dice antes de confirmar es `B/19` §4, fila 5-bis.

**La tercera es la única que depende de que un job corra, y por eso es la que lleva las dos
escrituras nuevas.** `D16` y `G-R5` comparan **dos cifras de configuración** y no miran el tiempo
que una fila concreta lleva en `PAUSED`: con la reanudación sin ejecutar, las dos siguen en verde
y el reloj de verticales igual llega al día 180. Lo que la vigila es la **rama de fallo de `S10`**
—la relectura que, si el proveedor sigue diciendo `paused`, deja la fila donde está y pone la
marca— y la **quinta comprobación de cero llamadas** de `B/09` §3, que encuentra la pausa cuyo
`fin_previsto` pasó y sigue sin `fin_real`. Sin las dos, la premisa con la que `DEC-DATA-002`
declaró *«el daño residual es cero»* no la sostenía nada.

**El motivo no es un adorno, y ésta es la razón exacta**: en el proveedor una cortesía y una
pausa pedida por el cliente **se ven idénticas** —el mismo `paused`, sin ningún campo que las
distinga—, así que un reloj que leyera el estado del proveedor reanudaría la cortesía de quien
había pedido pausa, o al revés (`DEC-GRANT-004`). **El reloj lee el motivo, nunca al proveedor.**

**Los tres cruces entre pausa y cortesía** ya están decididos (`DEC-GRANT-004`) y la máquina los
ejecuta así: en cortesía pide pausar → **se permite**, avisando que pierde la cortesía que le
quedaba; en pausa se intenta otorgar cortesía → **se bloquea**; cortesía sobre cortesía → **se
suman los días** y el aviso dice la fecha de fin nueva.

---

## 6. Pago

```text
  PENDING ──► SUCCEEDED ──► PARTIALLY_REFUNDED ──► REFUNDED
     │             │                                   ▲
     └──► FAILED   └───────────────────────────────────┘
```

| # | desde | evento | hacia | nota |
|---|---|---|---|---|
| P1 | `PENDING` | el proveedor acredita | `SUCCEEDED` | |
| P2 | `PENDING` | el proveedor rechaza | `FAILED` | dispara S4 si era el cobro de una suscripción `ACTIVE` |
| P3 | `SUCCEEDED` | reembolso total | `REFUNDED` | |
| P4 | `SUCCEEDED` | reembolso parcial | `PARTIALLY_REFUNDED` | |
| P5 | `PARTIALLY_REFUNDED` | otro parcial | `PARTIALLY_REFUNDED` o `REFUNDED` | **los parciales se acumulan y validan contra el saldo, no contra el monto original**; al completarse, el pago pasa a reembolsado solo (`RF-1`, `RF-2`) |

**Tres reglas que salen de la medición y no de la forma de la máquina:**

- **Reembolsar no da de baja nada.** Está medido sobre una suscripción viva. Por eso la
  revocación del derecho de arrepentimiento es **una sola operación: reembolso + cancelación**,
  y un reembolso por otra causa —un duplicado, un error nuestro— **no cancela** (`DEC-RF-001`).
- **Ante el rechazo `2084`, el sistema nunca concluye que el pago no se puede reembolsar.**
  Está medido que ese mensaje miente: sobre el mismo pago, ARS 5 se rechazó y ARS 14 entró
  (`RF-8`). Reintenta con otro monto o cae al total.
- **Un reembolso emite tres notificaciones en dos formatos para el mismo hecho** (`RF-7`), así
  que deduplicar por tipo de evento no alcanza.

---

## 7. Pago manual

El §30 lo dice en una línea —*«Mismo motor de Subscription. Payment method distinto.»*—, y eso
es exactamente lo que la máquina refleja: **no hay una máquina de suscripción para pagos
manuales**. Lo único propio es cómo se constata el pago.

| # | desde | evento | hacia | efectos |
|---|---|---|---|---|
| MP1 | `AWAITING` | el admin registra el pago | `REGISTERED` | la suscripción sale de `GRACE_PERIOD` por `S5` — **o queda pendiente por `S19`, si es la predecesora de una sucesión en curso**: el efecto de `MP1` es el de `S5` y hereda su condición, porque el daño no depende de por qué puerta entró el pago. **`S19` lo admite por su propio evento**, que nombra las dos puertas (§3.2): sin eso la derivación apuntaba a una fila que no podía recibirlo. **Y avanza un ciclo la fecha del próximo cobro** (`B/02` §2.2): registrada la cuota de este período, lo que queda por cobrar es el siguiente. Es **acá** y no en `S5`, cuya celda de efectos es *«se apaga el reloj»* y nada más (§7.2, *«qué mueve la fecha»*) |
| MP2 | `AWAITING` | el admin confirma que no se pagó | `DECLARED_UNPAID` | la suscripción va a `SUSPENDED` por `S6`, sin esperar el reloj |
| MP3 | `AWAITING` | se agota el grace sin que el admin haga nada | `DECLARED_UNPAID` | `S6` |
| MP4 | `DECLARED_UNPAID` | el admin registra el pago, que llegó **después** | `REGISTERED` | la suscripción sale de `SUSPENDED` por `S7` — **o queda pendiente por `S19`, si es la predecesora de una sucesión en curso**: misma herencia y misma razón que `MP1`, porque **el daño no depende de por qué puerta entró el pago** ni de desde qué estado del pago manual se lo registre. **`S19` lo admite por su propio evento**, que nombra el hecho —entró el pago del período impago— y no el mecanismo (§3.2). **Y no es incondicional**, por partida doble: el cruce de `C5` vale igual que en `MP1`, y `S7` exige **las cuatro condiciones del `B/05` §3** — la **1** es el tope de la reapertura (ver abajo, *«el tope no es un día»*). **Y avanza un ciclo la fecha del próximo cobro, igual que `MP1`, con un tope y no con un re-anclaje**: sólo **si ese avance cae en el pasado** —o sea si la suspensión duró más que un período— la fecha pasa a ser el instante de la reactivación (§7.2). Avanzar siempre al día de la reactivación le cobraba dos veces los días que le quedaban del período que acababa de pagar |
| MP5 | *(sin fila)* | **un reloj abre el período** de una suscripción de pagador manual: **llegó la fecha del próximo cobro** (`B/02` §2.2), que es el instante en que el proveedor habría cobrado (§7.2) | `AWAITING` | **es la entrada de esta máquina, y la crea el sistema, no un admin.** Sólo corre con la suscripción en **`ACTIVE`** —los otros cinco estados vivos están descartados uno por uno en el §7.2—, y **en el mismo acto la suscripción entra en `GRACE_PERIOD` por `S4`**, que es lo que el §30 ya ordenaba abajo y lo que `MP1` y `MP2` ya presuponían en sus efectos. **Idempotente por condición**: no crea si ya existe una fila de `manual_payment` para ese período, igual que `S13` y `S20` son *«idempotentes y reanudables fila por fila»* |

**Lo que el §30 agrega y la máquina tiene que cumplir**: si falta el pago, va a `GRACE_PERIOD`
**los mismos días configurables** que el resto (`DEC-SUB-002` vale igual acá), y **además se
notifica al admin** — que es el único caso donde una notificación es parte del flujo y no un
efecto colateral, porque sin ella nadie va a registrar nada. **Desde `MP5` eso tiene sujeto y
momento**: el reloj crea la cuota y el aviso sale sobre ella; hasta acá era una obligación sin
fila de la que colgar.

**Y el cruce peligroso queda nombrado**: un admin registrando un pago manual mientras la persona
paga por el proveedor es **doble cobro con dinero real** (`E-CONC-01`). Lo resuelve el capítulo
05; acá queda dicho que las transiciones MP1 y MP4 **no** son incondicionales.

**Devolver un pago registrado no es una transición de esta máquina, y `MP4` no lo cambia: la
devolución se asienta en un `refund` sobre el pago manual.** `MP4` revierte **la declaración de
impago**, que es otra cosa —mueve la columna de estado de `DECLARED_UNPAID` a `REGISTERED`—; lo
que sigue sin mover esa columna es devolver la plata. El §6 da `P3` y `P4` sobre la máquina de
`payment`, y de acá salía la lectura de que un pago manual **no se puede devolver** — que es falso
y era caro, porque las ramas 1, 5 y 6 de `B/12` §5.3 mandan devolver el pago que `S19` retuvo **sin
distinguir por qué puerta entró**. Lo que se devuelve es *«el pago»*, y desde `B/02` §2.3 un
`refund` cuelga del pago que se devuelve, sea `payment` o `manual_payment`. El estado del
`manual_payment` **no se mueve**: quedó `REGISTERED` porque el pago existió, y la devolución es un
hecho posterior con su propia fila — exactamente la relación que `payment` y `refund` ya tienen. Y
la devolución no es automática en ninguno de los dos casos: la confirma una persona
(`DEC-RF-002`), sobre la marca que `S18` puso.

### 7.1 `DECLARED_UNPAID` deja de ser el final: el pago que llega tarde reabre

**El §30 le da al admin el acto de *«confirmar que no se pagó»* y esta máquina no tenía cómo
deshacerlo.** `MP2` y `MP3` dejaban el pago manual en `DECLARED_UNPAID` y la suscripción en
`SUSPENDED`, y ninguna fila salía de ahí: el cliente que transfería **después** ponía plata en
nuestra cuenta y el sistema no tenía qué hacer con ella — por la regla 1 del núcleo el intento no
se ejecutaba, se iba a la marca, y lo que el cliente veía era que pagar no servía de nada. **No es
un borde de sucesión**: es el camino normal del que se atrasa y después paga, y el §3.2 lo dejaba
nombrado abierto con esas palabras.

> **La decisión del owner del 2026-09-21 es que se puede reabrir: el pago manual lo saca de
> `DECLARED_UNPAID` y reactiva la suscripción.** Lo ejecuta `MP4`.

**Y conviene decir por qué acá se reabre y en los dos casos vecinos de la misma semana no.** Al
revocar un grant el trial **no vuelve** (`DEC-TRIAL-009`) y el addon que el grant había pasado a
$0 **se apaga y no vuelve solo** (`DEC-ADDON-003`, `B/16` §3.3): en los dos **nosotros** terminamos
algo deliberadamente y la persona **no puso plata nueva**, así que reparar sería devolverle gratis
lo que se le retiró. Acá la persona **puso plata**, y hacerle repetir el trámite es fricción sobre
alguien que está tratando de volver. Es la misma elección que `DEC-SUB-003` ya hizo para el
cambio de plan en grace: que el camino de recuperación sea **una salida del problema en vez de un
muro**.

#### El tope no es un día: es que la fila siga viva, y la condición ya está escrita

**El tope evidente —*«mientras la ficha no se haya borrado»*, o sea el día 180 de la retención
(`V/02` §4.1)— no cierra, y hay que decir por qué antes de que alguien lo vuelva a proponer.** Son
tres razones y ninguna es de matiz:

1. **Ese reloj es de la ficha y el sujeto acá es la suscripción, y no hay una correspondencia.**
   Una suscripción principal cubre **todas las fichas de esa vertical** (`NUCLEO/01` §5), así que
   un anfitrión con cartera tiene tantos relojes como fichas y ninguno es *«el»* de su
   suscripción; y el pagador manual es el que menos lo tiene — el §17.2 lo admite en **Partner**,
   cuya presencia *«no es una ficha»* por orden del §17.1. Sobre esa población el tope propuesto
   **no existe**, que es peor que ser largo.
2. **Ya no es monótono, y un tope que se reinicia solo no es un tope.** `DEC-DATA-002` le puso a
   la inactividad **cuatro hechos de reinicio** con lista cerrada (`NUCLEO/01` §1.2), y el primero
   es *«un acto del dueño sobre la ficha»*: el suspendido que entra a editar su borrador corre su
   propio vencimiento hacia adelante, indefinidamente. Lo que se retiró en esa decisión fue,
   textual, *«que el reloj fuera monótono»*.
3. **Crearía una segunda dependencia sobre una cifra que el guard no vigila con ese sentido.**
   `D16` dice *«el tope de una pausa, en días, es menor que el día del hard delete»* y `G-R5`
   compara **esas dos** cifras y nada más (`B/20` §2). Atarle la reapertura al mismo número le
   agrega un consumidor que el guard no mira: bajar el día del hard delete acortaría la ventana de
   reapertura sin que nada se ponga en rojo, que es exactamente el modo de falla que `DEC-DATA-002`
   escribió `D16` para cerrar.

**Y no hace falta inventar otro número, porque el tope ya está escrito y es una condición y no un
reloj:**

> **Se puede reabrir mientras la suscripción siga siendo la fila que el pago puede reactivar.** Es
> la **condición 1 del `B/05` §3** —*«la suscripción existe y está en `GRACE_PERIOD` o
> `SUSPENDED`»*—, que `S7` ya exige y que rechaza `CANCELLED`, `ABANDONED` y `ACTIVE`.

Eso cierra la ventana **con actos que ya existen**, no con un plazo: cuando una persona cancela la
suscripción (**`S23`**, §3.2 — §3.1 enumera esa salida, y es una de las doce acciones del
`NUCLEO/08` §3) o cuando le cae un grant (`S13`), la fila pasa a `CANCELLED`, de donde el §3.3 ya
declara que **no se vuelve**. A partir de ahí el pago que llegue no reabre nada y lo que corresponde es un alta nueva.
**Y las otras tres condiciones acotan el resto**: la **3** rechaza la reapertura si la persona ya
volvió por otra puerta —tendría dos filas vivas y dos cobros—, y la **4**, con la restricción
`UNIQUE(subscription_id, período)` de `B/05` §C5 detrás, rechaza que el mismo período quede
pagado dos veces. Ninguna de las cuatro es nueva: `MP4` no las agrega, las alcanza.

**Lo que este tope NO acota, dicho en voz alta**: una `SUSPENDED` de pagador manual que nadie
cancela se puede reabrir indefinidamente, porque **no hay preapproval que el proveedor dé de baja
por mora** (`B/06` §7: un pago manual *«no tiene nada que pausar porque no hay débito que
detener»*) y el espejo del §10.1 nunca la alcanza. **Y *«que nadie cancela»* nombra un subconjunto
recién desde `S23`**: hasta esa fila las otras dos salidas estaban descartadas por lo que dice
este mismo párrafo y la tercera no tenía transición, así que **la población entera era la que
nadie podía cancelar** y el tope se cerraba por un solo camino —el grant— en vez de por dos. Se
acepta: el acto lo ejecuta un admin con la
plata a la vista, las condiciones 3 y 4 impiden los dos daños de plata, y **nada es retroactivo**
—lo que la reapertura devuelve es servicio de acá en adelante, no el contenido que el día 180 ya
borró—, que es justamente lo que el aviso del `B/19` §4 fila 10-bis está obligado a decir.

#### A qué estado va: `ACTIVE` directo, y por qué no deja una fila que no puede cobrar

**La objeción correcta es que reactivar el estado local sobre una autorización cancelada deja una
fila que el mes que viene no cobra** —`PA-5` mide que cancelar en el proveedor es irreversible, y
`B/12` §1.4 manda espejar la baja que el proveedor decide—. **Sobre esta población esa fila no
puede existir, y no por una regla nueva:**

- **En el caso central no hay autorización que contradecir.** El pagador manual no tiene débito en
  el proveedor (`B/06` §7), así que `PA-5` no tiene sujeto: no hay preapproval cancelado que
  reactivar.
- **Y si lo hubiera, la fila ya no estaría en `SUSPENDED`.** `SUSPENDED` **no es terminal**, así
  que el barrido diario la recorre entera (`B/09` §3); leído el preapproval `cancelled` contra un
  estado vivo que no es `CANCEL_SCHEDULED`, el §10.1 manda **espejar la baja** y la fila termina en
  `CANCELLED`. Ahí la condición 1 del `B/05` §3 rechaza la reapertura por su cuenta.

**Entonces `S7` sin escala**, con su efecto ya escrito —*«se restituye la publicación»*—: la fila
vuelve a emitir fuente con `hasta: SIN_FECHA_CONOCIDA` (`12-contrato…` §2.6), `cubierto` vuelve a
verdadero y la ficha que `PB4` hubiera archivado **vuelve sola por `PB7` si el cupo del plan le
alcanza** (`V/03` §9). No hace
falta un estado intermedio: el que lo necesitaría es el que tiene una autorización que confirmar,
y acá o no hay ninguna o la fila ya se murió.

#### Lo adeudado: no hay deuda vieja que perseguir, porque el pago que reabre ES la cuota

**`B/12` §5.3 decidió que *«la deuda vieja no se persigue por separado»*, y acá esa regla no se
aplica — no porque se la contradiga, sino porque su población no existe.** Allá el cliente cambia
de plan y **deja atrás** la cuota impaga, así que hay algo que decidir no perseguir. Acá el cliente
**la paga**: `MP4` actúa sobre **la misma fila de `manual_payment`** que `MP2` o `MP3` cerraron, o
sea sobre el mismo período, y registrarla es liquidar exactamente lo que se debía. No queda
remanente que compensar ni que cobrar aparte.

**Y tampoco se cobra nada por encima.** Ningún capítulo del programa tiene recargo, interés ni
punitorio, y crear uno acá sería una decisión de producto que esta fila no toma. Lo que la
reapertura mueve es un estado, no un monto: el importe que se registra es el esperado para ese
período, que es la **condición 2** del `B/05` §3.

**Lo que sí se hereda entero de `B/12` §5.3 es su otra mitad**: si la fila es la predecesora de una
sucesión en curso, el pago **no reactiva** — queda pendiente por `S19` y su destino lo decide el
cierre de la sucesión, con las seis ramas de ese §. Es la misma condición que `MP1` hereda, por la
misma razón, y es la que impide que la reapertura le devuelva dos filas vivas a alguien que está
cambiando de plan.

> **Lo que esta fila dejó abierto ya está cerrado, y no acá**: **quién crea las cuotas de un
> pagador manual y cuándo** —o sea qué pasa con los períodos que transcurren mientras la
> suscripción está `SUSPENDED`— era una pregunta **anterior** a `MP4`, porque la máquina tampoco
> declaraba la entrada a `AWAITING`. La contesta el **§7.2** con `MP5`: **las crea un reloj, y no
> las crea durante la suspensión**. `MP4` sigue sin crear filas de `manual_payment`: sólo mueve la
> que `MP2` o `MP3` cerraron.

#### Es una fila nueva y no el `desde` de `MP1` ampliado

**Ampliar `MP1` a `{AWAITING, DECLARED_UNPAID}` habría sido una fila con dos efectos según de
dónde viene**, y este capítulo ya tiene escrito por qué eso no se hace: *«una transición cuyo
`desde` se escribe como un conjunto de filas tiene que decir si alcanza también a…»* (§3). Los dos
efectos difieren de verdad y no en el matiz: `MP1` saca de `GRACE_PERIOD` por **`S5`** y `MP4` saca
de `SUSPENDED` por **`S7`**, que son dos transiciones distintas de la tabla del §3.2 con dos
condiciones que se evalúan sobre estados distintos. Con una sola fila, la derivación habría
quedado escrita como *«`S5`, o `S7` si venía de `DECLARED_UNPAID`»*, que es la forma que la regla 1
del núcleo no puede verificar.

**Y `MP4` no agrega ningún par con dos filas, así que `G-R4` sigue contando tres.** Comparte el
evento con `MP1` —*«el admin registra el pago»*— y **compartir el evento no es compartir el par**
(`NUCLEO/03` §1 regla 7): el `desde` de una es `AWAITING` y el de la otra `DECLARED_UNPAID`, y
ninguna otra fila de esta tabla sale de ninguno de los dos con ese evento. Del lado de la tabla del
§3.2 **tampoco agrega uno**, por el argumento que el §3.2 ya escribió para `MP1`: `MP4` no es un
evento de esa tabla sino un efecto que entra por *«entra el pago»*, que `S7` y `S19` ya compartían.

#### Lo que NO cambia, y hay que contarlo para que nadie lo recuente

- **El barrido de `B/09` §3 no gana ninguna puerta por `MP4`, y sigue con cuatro salvedades.** Sus
  puertas son **doce** desde que `S22`, `S23` y `S24` le agregaron tres —no las agregó `MP4`—, y todas son
  puertas a
  un estado terminal **de una suscripción**, y ese § enumera los tres que tiene: `CANCELLED`,
  `ABANDONED` y `CHARGE_DECLINED`. **`DECLARED_UNPAID` es un estado del `manual_payment`**, nunca
  estuvo en esa tabla y retirarle la condición de final no le agrega ni le saca una fila. Lo que sí
  conviene saber es que la fila que `MP4` reabre **estaba siendo barrida** todo el tiempo, porque
  `SUSPENDED` no es terminal — y es esa lectura diaria la que hace segura la reactivación directa
  (arriba).
- **El catálogo de acciones administrativas sigue teniendo DOCE filas.** `MP4` es *«registrar un
  pago manual»* (§30), la fila que ya está, ejecutada desde otro estado de origen: mismo permiso,
  misma auditoría, misma confirmación de que mueve dinero. Las cinco líneas que cuantifican sobre
  esa tabla —`V/17` §3.2 reglas 1 y 3, §3.3, §3.4 y `B/19` §6— siguen diciendo doce y siguen siendo
  exactas.
- **La máquina sigue teniendo tres estados.** `AWAITING`, `REGISTERED` y `DECLARED_UNPAID`
  (`NUCLEO/01` §2.2): `MP4` agrega una arista, no un nodo, y por eso `B/02` §2.3 sigue sin
  necesitar *«un estado nuevo en la máquina del pago manual»*.
- **No agrega una columna.** `manual_payment` guarda ya *«quién lo registró, cuándo,
  comprobante»* (`B/02` §2.3), que es lo que `MP4` escribe; los dos actos —declarar el impago y
  reabrirlo— quedan distinguibles en el registro de eventos de dominio, que la regla 4 del
  `NUCLEO/03` §1 exige por cada transición.

#### Qué premisa de otro arreglo vuelve falsa este, y dónde quedó resuelta

La obligación 2 de `DEC-METH-008`, contestada por escrito. **Es una y está corregida en su
lugar**, más cuatro apariciones que quedan como estaban con su razón:

| premisa | de quién era | qué pasa | dónde |
|---|---|---|---|
| *«por esta puerta `S7` es inalcanzable, y no es un hueco sino aritmética de los dos estados»* | el arreglo que le abrió a `S19` la segunda puerta (§3.2, familia del pago manual de la 9-bis-3) | **queda FALSA**: con `MP4` hay una transición que sale de `DECLARED_UNPAID`, así que el pago manual llega sobre una `SUSPENDED` y `S7` es su destino | corregida en §3.2, con la premisa vieja citada |
| *«`S19` admite las dos puertas»* | el mismo arreglo | **sigue verdadera**, y por eso `MP4` no necesita ampliarla: el evento se enuncia sobre el hecho y no sobre el mecanismo, que es lo que esa corrección dejó escrito | §3.2, con `MP4` nombrado en la celda de `S19` |
| *«la regla se ejecuta en tres lugares»* (`G-R1-D`) | el mismo arreglo, en `B/20` §2 | **queda incompleta**: son cuatro | corregida en `B/20` §2 |
| *«los estados terminales de una suscripción no se barren»* y sus **nueve** puertas | `B/09` §3, y `B/16` §4.4 que las contó | **sigue verdadera**: `DECLARED_UNPAID` es del `manual_payment` y nunca estuvo en esa tabla, cuyos sujetos son `CANCELLED`, `ABANDONED` y `CHARGE_DECLINED` | sin tocar |
| *«la tabla tiene DOCE filas»* (`NUCLEO/08` §3) y las cinco líneas que la cuantifican | el arreglo del anclaje de verticales | **sigue verdadera**: `MP4` es la fila *«registrar un pago manual»* ejecutada desde otro origen, no una acción nueva | sin tocar |
| *«el crédito de `DEC-SUB-006` se computa en cero en grace»* y las ramas de `B/12` §5.3 | el arreglo del pago tardío | **siguen verdaderas**: `MP4` hereda la condición de `S19`, así que no reactiva durante una sucesión y el pago se resuelve por las mismas ramas — que desde `S23` son **seis** y no cinco, y no las recontó este arreglo | `B/12` §5.3, con `MP4` nombrado en la puerta manual |

---

### 7.2 La cuota la crea un reloj, y no se crea durante la suspensión

**La máquina tenía cuatro salidas y ninguna entrada.** `MP1`, `MP2` y `MP3` salen de `AWAITING`,
`MP4` de `DECLARED_UNPAID`, y **nadie declaraba quién crea la fila `AWAITING` ni cuándo**: es
`F-8B2-018`, anterior a `MP4`. Por la regla 1 del `NUCLEO/03` una máquina sin transición de
entrada no se alcanza nunca, así que las cuatro salidas describían un trámite que no empezaba en
ningún lado — y con ellas se caían el grace del §30 y su aviso al admin, que cuelgan de una cuota
que nadie creaba.

> **Decisión del owner, 2026-09-21, y son dos mitades.**
> **(a)** La cuota **la crea un reloj**, al inicio de cada período, para toda suscripción de
> pagador manual — **el mismo instante en que el proveedor habría cobrado**. No la crea un admin
> a mano: una cuota que nadie crea es **servicio gratis en silencio**, y el §30 le pide al admin
> *«registrar»* un pago, no inventarle la obligación.
> **(b)** **No se crean mientras la suscripción está `SUSPENDED`.** El que vuelve paga el período
> que arranca, no los que pasó suspendido.
>
> Lo ejecuta **`MP5`** (§7).

**La razón de (b) ya estaba decidida dos veces, y esto no agrega criterio.** `B/12` §5.3 dice que
*«la deuda vieja no se persigue por separado»* y `DEC-SUB-012` dice que el que paga tarde **paga
esa cuota** y no un remanente (§7.1, *«lo adeudado»*). Acumular cuotas durante la suspensión
construiría exactamente el remanente que las dos descartaron, y sobre alguien que **no tuvo
servicio**: `S6` deja la fila *«sin listado público, sin edición, sin creación, sin entitlements
comerciales»* (§3.2). Cobrar meses de eso es cobrar nada. Y es la misma elección de `DEC-SUB-003`:
que volver sea *«una salida del problema en vez de un muro»* — una deuda de seis meses esperando
en la puerta es el muro.

#### Desde qué estados de la suscripción se crea: sólo `ACTIVE`, y los otros cinco uno por uno

Los estados vivos son **seis** (`B/02` §2.2). El reloj corre sobre **uno**, y los otros cinco no
quedan afuera por decisión sino porque en cada uno falta el sujeto o el período no arranca:

| estado | ¿se crea la cuota? | por qué |
|---|---|---|
| `ACTIVE` | **sí** | es el caso: el período arranca y hay una obligación de pago que constatar |
| `SUSPENDED` | **no** | es la mitad (b) de la decisión del owner |
| `PENDING_AUTHORIZATION` | **no** | **todavía no hay fecha del próximo cobro**: la estrena `S2` al arrancar el período (§3.2), así que el reloj no tiene qué leer. La primera cuota es la del primer período, y ése empieza cuando la fila llega a `ACTIVE` |
| `GRACE_PERIOD` | **no** | un pagador manual llega a grace **porque su cuota de este período no se pagó**, así que esa cuota **ya existe** —es la que `MP1` registra— y el grace es su reloj: su desenlace son `S5` o `S6`, no una segunda cuota. **Lo que NO se puede decir es que el período no avance**: si el grace configurado es más largo que un ciclo, la fecha del próximo cobro llega estando la fila acá, y lo que impide abrir la cuota es que el `desde` de `MP5` es `ACTIVE`, no que no haya qué abrir. Esa cuota se abre **cuando y si** `S5` la devuelve a `ACTIVE`, y ahí el cliente paga dos períodos con días de diferencia — que es lo que corresponde, porque en grace *«el servicio sigue entero»* (`S4`, §3.2) |
| `CANCEL_SCHEDULED` | **no** | el servicio está sostenido *«hasta el fin del período pagado»* (§3.1) y `S12` llega ese día, que en un pagador manual **es** la fecha del próximo cobro que `MP1` dejó al registrar la última cuota: la fila llega a `CANCELLED` el mismo día en que el reloj habría mirado, y además el `desde` de `MP5` es `ACTIVE`. **Ningún período nuevo empieza** antes de `CANCELLED`, y crear una cuota acá sería cobrarle un período a quien ya se dio de baja |
| `PAUSED` | **no** | ver abajo, *«la pausa»* |

**El horario del reloj y su idempotencia, que es lo que el `NUCLEO/03` le pide a cada
subdominio.** La cadencia **sale de la base como todos los schedules** (§42) y no se fija acá; lo
que sí se fija es que **correr tarde no pierde un período**, porque la condición no es *«es hoy»*
sino *«la fecha del próximo cobro ya llegó y ese período no tiene cuota»* — una corrida que se
saltea un día crea la cuota al día siguiente, con su período correcto, y el atraso lo absorbe la
ventana del grace, que es configurable por plan (`DEC-SUB-002`). Y **correr dos veces no crea dos
cuotas**, por la misma condición.

**Esa condición lee una columna, así que hay que decir quién la mueve — y es el punto siguiente.**
Enunciada sobre *«el período actual»*, la condición pedía que alguien avanzara un período y
**ninguna transición lo declaraba**: pagada la primera cuota el reloj no volvía a encontrar nada,
no se abría ninguna otra, nadie le pedía nada al cliente y —porque `ACTIVE` emite fuente con
`hasta: SIN_FECHA_CONOCIDA` (`12-contrato…` §2.6)— **seguía cubierto para siempre**. O sea el
*«servicio gratis en silencio»* que la mitad (a) de la decisión declaró inadmisible, entrando por
la puerta del mecanismo que iba a cerrarlo.

**Y el reloj es un acto de sistema, así que no toca el catálogo de `NUCLEO/08` §3.** Ahí van las
acciones **del admin**, y crear la cuota no es ninguna: la tabla **sigue teniendo doce filas** y
las cinco líneas que cuantifican sobre ella —`V/17` §3.2 reglas 1 y 3, §3.3, §3.4 y `B/19` §6—
siguen siendo exactas. Es el mismo argumento con el que el barrido y `S18` no suman filas ahí.

#### Cómo entra el grace, que era la otra mitad de `F-8B2-018`

`MP3` sale de *«se agota el grace»* y el grace tenía el mismo problema que `AWAITING`: **`S4`
describe *«un cobro falla»* y en el pago manual nadie cobra**. Con `MP5` el hecho queda nombrado
y **no hace falta una fila nueva**: para una suscripción sin débito, *«el cobro de este período
falló»* **es** que su cuota se abrió y no hay pago acreditado contra ella. Es lo que este § ya
ordenaba abajo de la tabla —*«si falta el pago, va a `GRACE_PERIOD` los mismos días
configurables»*— y lo que `MP1` y `MP2` ya presuponían: los dos declaran que la suscripción está
en `GRACE_PERIOD` cuando el admin actúa. Así que `S4` es la fila, con su `desde` en `ACTIVE`, que
es el único estado desde el que `MP5` crea.

**Y no cae en el §4.3 de `B/12` —*«el grace no es un beneficio de entrada»*—, por el predicado de
`S16` y no por una excepción.** `S16` exige que sea **el primer cobro de esa autorización** y que
**el proveedor la haya cancelado al rechazarlo**; un pagador manual **no tiene autorización en el
proveedor** (`B/06` §7), así que las dos mitades son falsas y `CHARGE_DECLINED` tiene acá
población vacía. `B/12` §4.3 ya dice que la condición *«se lee POR AUTORIZACIÓN»*: sin
autorización no hay sujeto.

#### Qué mueve la fecha del próximo cobro: tres escrituras, y la tercera es un tope

La columna es la de `B/02` §2.2, y sobre un pagador manual **es la única copia que existe** —no
hay proveedor que la tenga—. **Son tres escrituras y un tope, y no hay una cuarta escritura:**

1. **La estrena `S2`**, con su efecto ya escrito: *«arranca el período»* (§3.2). La fila llega a
   `ACTIVE` y la fecha es ese instante, así que la primera corrida del reloj abre la primera
   cuota.
2. **La avanzan `MP1` y `MP4`, un ciclo del `billing_option` anclado** (`B/02` §2.1), **al quedar
   registrada la cuota de ese período**. Es la transición que constata que el período quedó
   pagado la que declara que lo que sigue por cobrar es el siguiente. **No lo hace `S5`**: su
   celda de efectos, entera, es *«se apaga el reloj»* (§3.2), y atribuirle el avance era pedirle
   a la tabla algo que la tabla no dice — la regla 1 del `NUCLEO/03` aplicada al § que la invoca
   cinco veces.
3. **La avanza `S10` al volver de una pausa, tantos ciclos como hayan vencido durante ella y sin
   abrir ninguna cuota.** No es criterio nuevo: es **el espejo local de `PS-6`** —medido: *«el
   ciclo que vence estando pausada avanza la fecha +1 ciclo **sin cobrar**»*— y de lo que
   `DEC-SUB-010` ya eligió para el pagador con tarjeta, *«al volver se le cobra normal en el
   ciclo siguiente: el `next_payment_date` que el proveedor ya tiene corrido»*. Sobre un pagador
   manual **no hay proveedor que lo corra**, así que lo corre esta transición o no lo corre nadie
   — y sin eso el reloj le abre al volver la cuota de un período que transcurrió adentro de la
   cortesía. **Se computa al volver y no pide un reloj propio**: son los ciclos que caben entre la
   fecha vigente y el instante de la vuelta.

   > **Y esta mitad cuelga de una medición que sigue abierta, así que va dicho.** `DEC-SUB-010`
   > quedó *«condicionada a FASE 1C, a la segunda lectura del reloj: ¿la fecha corre +1 ciclo por
   > vencimiento **indefinidamente**, o sólo la primera vez?»*. Lo de arriba es la primera
   > lectura: **tantos ciclos como hayan vencido**. Si la segunda lectura dice que el proveedor
   > corre la fecha **una sola vez**, el pagador con tarjeta vuelve con la fecha en el pasado y el
   > cobro en el acto, y entonces esta regla deja de ser el espejo de nada y hay que volver a
   > elegir para el pagador manual. **No se elige a ciegas y no se deja sin escribir**: sin una
   > regla acá, `MP5` vuelve a leer una fecha que nadie movió, que es el defecto que este § existe
   > para cerrar.

**Y un tope, que corre SÓLO en `MP4`**: si el avance del punto 2 cae en el pasado —la suspensión
duró más que un período— la fecha pasa a ser **el instante de la reactivación**. Las otras dos
vueltas a `ACTIVE` no lo necesitan y no lo llevan, y conviene decir por qué cada una:

| vuelta a `ACTIVE` | qué hace con la fecha | por qué |
|---|---|---|
| `S7` por `MP4`, desde `SUSPENDED` | **avanza un ciclo, con el tope** | ahí no hubo servicio —`S6` deja la fila *«sin listado público, sin edición, sin creación, sin entitlements comerciales»* (§3.2)— y es la mitad (b): el que vuelve paga **el período que arranca**, no los que pasó suspendido. Un avance a una fecha pasada le abriría la cuota de un período que pasó entero suspendido |
| `S10`, desde `PAUSED` por cortesía | **avanza los ciclos vencidos, sin tope y sin cuota** | es el punto 3. El tope sobraría: ese avance **nunca** deja una fecha pasada, porque llega al primer vencimiento posterior a la vuelta. Y aplicarlo igual le cobraría el resto del ciclo que `PS-6` le deja libre al pagador con tarjeta, que es el `if` por método que `B/06` §7 existe para impedir |
| `S5`, desde `GRACE_PERIOD` | **no escribe nada** | el avance ya lo escribió `MP1`, que es el pago que produjo esta vuelta. Y el tope no corre: en grace *«el servicio sigue entero»* (`S4`, §3.2), así que esos días son exactamente los que cubre la cuota que se está pagando y correr la fecha se los regalaría |

**Ninguna de las tres puede colisionar, y conviene decirlo porque parece que sí**: las tres dejan
una fecha **estrictamente posterior** a la que había, y las cuotas que existen son las de períodos
que arrancaron antes. El `UNIQUE(subscription_id, período)` de `B/05` §C5 y la condición de
idempotencia de `MP5` siguen sin tener contra qué chocar (`B/02` §2.3).

#### Al reabrir por `MP4`: el reloj vuelve a crear, y sólo se re-ancla si el período viejo ya terminó

Si estuvo `SUSPENDED` no se crearon cuotas, así que hay que decir qué pasa cuando vuelve.

> **`MP4` lleva la fila a `ACTIVE` por `S7`, y desde ese instante el reloj vuelve a crear.** La
> fecha del próximo cobro **avanza un ciclo** desde la del período que `MP4` acaba de registrar,
> igual que en `MP1`; y **sólo si ese avance cae en el pasado** —o sea si la suspensión duró más
> que un período— la fecha pasa a ser **el instante de la reactivación**.

**Re-anclar siempre a la reactivación era un doble cobro, y hay que decir sobre quién.** El que se
atrasa, transfiere **el día 20 de un período que arrancó el día 0** y paga el importe del período
entero (`B/05` §3, condición 2) tiene diez días por delante que ya pagó. Con el re-anclaje
incondicional esos diez días pasaban a ser el arranque del período **siguiente**: el reloj le abría
la cuota en el acto y `S4` lo devolvía a `GRACE_PERIOD` el mismo día. **Pagaba dos veces los días
20 a 30**, y ni el correo ni la pantalla lo decían. Con el tope, la fecha queda en el día 30, el
reloj no encuentra nada que abrir hasta ese día, y los diez días son los que compró.

**Y el argumento que justificaba el re-anclaje era verdadero en su conclusión y falso en su
mecanismo, que es lo que le agrandó el alcance.** Decía que con el ancla vieja *«el reloj, en su
primera corrida, crearía **de golpe** todas las cuotas que (b) mandó no crear»*. **De golpe no**:
la condición de `MP5` nombra **un** período —el de la fecha vigente— y es idempotente, así que
crea **una** cuota por corrida. El daño verdadero es otro y sigue siendo real: esa única cuota
sería la de un período que **transcurrió entero durante la suspensión**, o sea días sin servicio,
que es exactamente lo que la mitad (b) mandó no cobrar; y al registrarse, la fecha avanzaría a otro
pasado, y así hasta ponerse al día. No una avalancha sino una cola, con la misma deuda al final.
**El remedio era correcto y su alcance estaba mal escrito**: se aplicaba también a la población
donde el avance cae en el futuro, y ahí su propio motivo no existe.

**Y no le regala nada a nadie**: lo que `MP4` acaba de registrar **es la cuota del período impago**
—la misma fila que `MP2` o `MP3` cerraron, por el importe esperado de ese período (§7.1, *«lo
adeudado»*)—, así que el cliente pagó lo que debía. Lo que **no** le devuelve son los días que pasó
en grace y suspendido adentro de ese período: *«nada es retroactivo»* (§7.1), y ésa es la
consecuencia de no haber pagado a término, no un cobro nuevo.

**El tope es de esta puerta en un sentido y no en el otro.** Sobre un pagador con tarjeta **no hay
nada que topar**: las fechas las tiene el proveedor y son inmutables (`EX-39`, `B/12` §5.4), y
sobre esa población la columna es una copia que ninguna regla lee para decidir (`B/02` §2.2).
Sobre un pagador manual, en cambio, el tope **no** es sólo de `MP4` —la vuelta de una cortesía lo
necesita igual—, y por eso está escrito arriba como la tercera escritura y no adentro de esta
puerta.

#### La pausa: no contradice el `B/06` §7, y por dos razones distintas

`B/06` §7 dice que un pago manual mensual **no tiene nada que pausar porque no hay débito que
detener**, y de ahí que `puedePausar()` dé `false` sin excepción escrita. La regla de arriba **no
lo contradice**:

1. **Para `CUSTOMER_REQUEST` la población es vacía.** `S8` exige `puedePausar()` (§3.2) y sobre un
   pagador manual mensual eso es `false`, así que **no hay pausa pedida que pueda existir**. Decir
   que el reloj no crea ahí no le devuelve al método una capacidad que el §7 le negó: no hay a
   quién aplicárselo.
2. **Para `COURTESY` sí hay población, y no crear es lo que la cortesía significa.** `S9` no pasa
   por `puedePausar()`: su condición es *«no hay pausa vigente»* (`DEC-GRANT-004`). Ahí el
   mecanismo de la cortesía es *«pausar en el proveedor y sostener el servicio de nuestro lado»*
   (`DEC-GRANT-003`), y sobre un pagador manual **la primera mitad no tiene sujeto** —es
   exactamente lo que el `B/06` §7 constata— **así que lo único que queda de la cortesía es la
   segunda: no pedirle la plata**. Abrir una cuota durante una cortesía sería cobrarle la cortesía,
   que la vacía de contenido. **Y no alcanza con no abrirla durante**: si al volver por `S10` la
   fecha del próximo cobro quedó adentro de la cortesía, el reloj le abre en el acto la cuota de un
   período que transcurrió regalado — la misma cuenta, cobrada más tarde. Por eso `S10` avanza esa
   fecha los ciclos que vencieron, que es lo que el proveedor hace solo sobre un pagador con
   tarjeta (`PS-6`, `DEC-SUB-010`) y acá no hace nadie (arriba, *«qué mueve la fecha del próximo
   cobro»*).

**Y el §7 de `B/06` gana un consumidor, no una excepción**: la respuesta sigue saliendo de componer
capacidades y no de un `if` por vertical ni por método, que es lo que ese § existe para impedir.

#### El aviso: no hace falta uno nuevo, y el que el §30 pide recién ahora tiene de qué colgar

El §30 exige notificar al admin cuando falta el pago —*«el único caso donde una notificación es
parte del flujo»*—. **Crear la cuota no pide un aviso propio**, y son dos destinatarios con dos
respuestas:

- **Al admin**: el aviso que el §30 ordena es el de la falta del pago, y ése **no cambia de
  momento** — sale cuando la cuota se abre sin pago contra ella, que es el mismo instante en que
  `S4` entra al grace. Lo que `MP5` aporta no es un aviso más: es **el sujeto** que ese aviso no
  tenía. El catálogo del `NUCLEO/07` §6 ya lo lleva en la fila *«cobro fallido / grace»*, con su
  schedule *«relativo al vencimiento»* (`DEC-SUB-002`) — que acá es el instante en que `MP5`
  creó la cuota.
- **Al cliente**: ya está cubierto por *«renovación por venir»* (transaccional, 5 y 1 día antes,
  §42.2), que es literalmente el aviso de que se acerca el momento de pagar. Para el pagador
  manual es el que le dice cuándo transferir, y no necesita otra redacción.

**Así que el catálogo del `NUCLEO/07` §6 no gana una fila.** Agregar un correo *«se abrió tu
cuota»* dos días después de *«renovación por venir»* sería el segundo contacto por el mismo hecho,
que es lo que la jerarquía de supresión de ese capítulo (§4.2) existe para evitar.

#### Lo que NO cambia, y hay que contarlo para que nadie lo recuente

- **La máquina sigue teniendo TRES estados** — `AWAITING`, `REGISTERED` y `DECLARED_UNPAID`
  (`NUCLEO/01` §2.2). `MP5` sale de *(sin fila)*, que por la **regla 2** del `NUCLEO/03` §1 es un
  estado que **vive afuera de la columna**: la máquina de suscripción cuenta **nueve** con el
  mismo criterio, dejando su *(sin fila)* fuera de la cuenta. `MP5` agrega una arista, no un nodo.
- **`G-R4` no gana ningún par por `MP5`** —los pares con dos filas son **cuatro** desde `S25`,
  y `MP5` no es ninguno de ellos—. El par de `MP5` es
  `(sin fila, el reloj abre el período)` y **ninguna otra fila de esta tabla sale de *(sin fila)***,
  así que tiene una sola. Del lado de la tabla del §3.2 tampoco agrega uno: su efecto entra por
  `S4`, que ya existe y cuyo par `(ACTIVE, un cobro falla)` sigue teniendo una sola fila.
- **El barrido de `B/09` §3 no gana nada por `MP5`: sigue con cuatro salvedades y las
  comprobaciones de cero llamadas que tenga —**seis** desde `DEC-GRANT-007`—, y sus puertas son
  doce desde `S22`, `S23` y `S24`.** `MP5` no lleva
  ninguna suscripción a un estado terminal y no toca ningún preapproval — no hay ninguno.
- **El catálogo de acciones administrativas sigue teniendo DOCE filas** (arriba).
- **`C5` no se toca.** Su `UNIQUE(subscription_id, período) WHERE el pago está acreditado`
  (`B/05` §C5) impide **dos pagos acreditados** del mismo período, y una cuota en `AWAITING` no
  está acreditada: la idempotencia de `MP5` es **la condición de su propia fila** —que no exista
  ya un `manual_payment` de ese período—, no esa restricción. Las dos conviven sin superponerse.
- **Las cuatro condiciones del `B/05` §3 valen igual.** `MP5` no registra un pago: abre la cuota
  contra la que después se lo registra.
- **El avance y el tope no agregan ninguna fila, así que nada de lo de arriba se recuenta.** Son
  **efectos**, declarados en las celdas de `MP1`, `MP4` y `S10`, no transiciones nuevas: no hay un
  `MP6`, `G-R4` no gana ningún par por acá y la máquina sigue teniendo tres estados.
- **Y el barrido NO gana una sexta comprobación de cero llamadas.** La pregunta que faltaba
  —*«¿hay una suscripción de pagador manual a la que nadie le abre cuota?»*— dejó de tener
  población: no es un caso a detectar, es un estado que ya no se alcanza, porque la fecha que
  `MP5` lee tiene **tres** escrituras declaradas y un tope, y ninguna la deja quieta. Las
  **seis** de `B/09` §3 —seis desde `DEC-GRANT-007`— quedan como estaban, contadas sobre su
  texto vigente.
- **Y `PS-6` no gana una excepción, gana un consumidor.** Lo que `S10` hace sobre un pagador
  manual es lo que el proveedor ya hace sobre un pagador con tarjeta, medido y adoptado por
  `DEC-SUB-010`; lo único propio es **quién** lo escribe, porque de un lado hay proveedor y del
  otro no.

#### Qué premisa de otro arreglo vuelve falsa este, y dónde quedó resuelta

La obligación 2 de `DEC-METH-008`, contestada por escrito:

| premisa | de quién era | qué pasa | dónde |
|---|---|---|---|
| *«quién crea las cuotas de un pagador manual y cuándo queda abierto»* | el arreglo de `MP4` (`DEC-SUB-012`, §7.1) | **queda FALSA**: lo cierra `MP5`, y su respuesta —no crear durante la suspensión— es además la que ese § dejaba pedida en su misma frase | corregida en §7.1, en el recuadro que la declaraba abierta |
| *«la máquina de pago manual no tiene entrada, y su grace no tiene quién lo abra»* (`F-8B2-018`) | la FASE 8 adversarial | **queda FALSA en sus dos mitades**: la entrada es `MP5` y el grace entra por `S4`, con el hecho nombrado acá arriba | este § |
| *«`MP4` no agrega ningún par, así que `G-R4` sigue contando tres»* | el arreglo de `MP4` (§7.1) | **sigue verdadera**, y `MP5` tampoco agrega uno: sale de un `desde` que ninguna otra fila usa | arriba, *«lo que NO cambia»* |
| *«la máquina sigue teniendo tres estados»* y *«`B/02` §2.3 no necesita un estado nuevo»* | el arreglo de `MP4` (§7.1) y `B/02` §2.3 | **siguen verdaderas**: `MP5` agrega una arista desde *(sin fila)*, que no es un nodo de la columna | sin tocar |
| *«`manual_payment` guarda quién lo registró, cuándo, comprobante»* | `B/02` §2.3 | **queda INCOMPLETA**: una cuota en `AWAITING` existe **antes** de que nadie registre nada, así que esos tres no se pueden escribir todavía y falta **el período** que el `UNIQUE` de `B/05` §C5 ya presuponía | corregida en `B/02` §2.3 |
| *«un pago manual mensual no tiene nada que pausar»* | `B/06` §7 | **sigue verdadera**, y esta regla la usa en vez de contradecirla | arriba, *«la pausa»* |
| *«el grace no es un beneficio de entrada»* | `B/12` §4.3 | **sigue verdadera**: su condición se lee por autorización y un pagador manual no tiene ninguna, así que `S16` tiene población vacía acá | arriba, *«cómo entra el grace»* |
| *«la deuda vieja no se persigue por separado»* y *«el que paga tarde paga esa cuota»* | `B/12` §5.3 y `DEC-SUB-012` | **siguen verdaderas**, y son la razón escrita de (b) | arriba |
| *«el período actual»* como columna de `subscription` | `B/02` §2.2 | **queda RENOMBRADA**: lo que la fila guarda es **una fecha** y no un período, y leerla como período es lo que dejó a `MP5` esperando que alguien *«avanzara»* algo. Pasa a ser *«la fecha del próximo cobro»*, la misma cifra que el barrido compara contra `next_payment_date` | corregida en `B/02` §2.2 |
| *«el período no avanza mientras el pago no entra: `S5` es lo que lo cierra»* | el arreglo de `MP5`, en la fila `GRACE_PERIOD` de la tabla de arriba | **queda FALSA en sus dos mitades**: `S5` no declara ese efecto —su celda es *«se apaga el reloj»*— y el período **sí** puede avanzar en grace si el grace configurado es más largo que un ciclo. Lo que impide abrir la cuota ahí es el `desde` de `MP5` | corregida arriba, en esa misma fila |
| *«el período nuevo arranca EN LA REACTIVACIÓN»*, sin condición | el arreglo de `MP5`, en *«al reabrir por `MP4`»* | **queda FALSA como regla general**: sobre una reapertura que cae **dentro** del período pagado, re-anclar le cobra dos veces los días que le quedaban. Pasa a ser un **tope** que corre sólo cuando el avance de un ciclo cae en el pasado | corregida arriba, en esa misma sección |
| *«el reloj crearía de golpe todas las cuotas»* | el arreglo de `MP5`, misma sección | **queda FALSA en el mecanismo y verdadera en el desenlace**: la condición de `MP5` nombra un período y es idempotente, así que crea **una** cuota por corrida; la deuda igual se acumula cuota a cuota. Era la parte falsa la que le agrandaba el alcance al remedio | corregida arriba, con el motivo reescrito |
| *«al reanudar se le muestra una sola cosa: qué día se le cobra»* y *«se le cobra normal en el ciclo siguiente: el `next_payment_date` que el proveedor ya tiene corrido»* | `DEC-SUB-010`, en la celda de `S10` | **siguen verdaderas, y recién ahora tienen respuesta sobre un pagador manual**: ahí no hay proveedor que corra nada, así que lo corre `S10` con los ciclos que vencieron durante la pausa. Lo que era una frase con sujeto sólo del lado de la tarjeta pasa a valer para los dos | `S10`, §3.2 |
| *«el ciclo que vence estando pausada avanza la fecha +1 ciclo sin cobrar»* (`PS-6`) | la matriz, citada por `DEC-SUB-010` y `B/12` §7.1 | **sigue verdadera y gana un consumidor**: es la medición que fija qué hace `S10` sobre un pagador manual, donde nadie la ejecuta por nosotros | arriba, punto 3 |
| *«la fecha del próximo cobro se registra»* del barrido | `B/09` §3 | **sigue verdadera y sin tocar**: es la escritura del régimen **con** proveedor, y sobre un pagador manual el barrido no tiene preapproval que leer | sin tocar |

---

## 8. Addon (instancia)

| # | desde | evento | hacia | nota |
|---|---|---|---|---|
| A1 | *(sin fila)* | se contrata | `PENDING_AUTHORIZATION` | exige una suscripción principal válida y compatible (§38). **Nunca durante un trial** (§10.5) |
| A2 | `PENDING_AUTHORIZATION` | se autoriza | `ACTIVE` | recurrente: su propio preapproval (`DEC-ADDON-002`). De única vez: su propio cobro |
| A3 | `PENDING_AUTHORIZATION` | vence la ventana | `ABANDONED` | mismas 72 h que S3 |
| A4 | `ACTIVE` | llega su fecha de fin | `EXPIRED` | **el reloj no se congela** aunque la ficha esté despublicada (`DEC-ADDON-001`) |
| A5 | **toda instancia con una autorización que puede cobrar: `PENDING_AUTHORIZATION` y `ACTIVE`** (ver abajo, *«la instancia que autoriza después»*) | se da de baja, queda huérfano, **o se revoca el grant del que cuelga el ancla que era su título** | `CANCELLED` | **Son tres eventos y el tercero es nuevo** (ver abajo, *«el addon cuyo título era el ancla»*). **El tercero nombra la REVOCACIÓN y no *«el retiro del ancla»***, porque *«desanclar no está declarado»* (`12-contrato…` §2.8, `B/02` §2.4) y una transición no puede esperar un acto que ningún catálogo produce: revocar es el acto declarado —fila del grant permanente del `NUCLEO/08` §3— y **retira todas las anclas del instrumento de una vez**, que es lo que el ancla-título de esta instancia necesita. §41: **sólo** cuando queda efectivamente huérfano, no por cancelar la vertical. *«Huérfano»* es la condición de `B/16` §4.2 —el objetivo dejó de ser fila viva, **ninguna sucesión lo releva** y **ningún grant permanente lo releva**—, **nunca un estado de llegada concreto**: la pueden cumplir las **seis** transiciones que sacan a la principal de las filas vivas —`S3`, `S12`, `S13`, `S16`, `S17` y el espejo del §10.1—, y `S16` (`CHARGE_DECLINED`) es una de ellas. **Y se evalúa sobre los complementos de la fila que la transición sacó de las filas vivas y, si esa fila era una sucesora, también sobre los de su predecesora** (`B/16` §4.3). **Y la suscripción de complemento de la instancia que se apaga queda `CANCELLED` en el mismo acto, por `S21`** (§3.2): **el preapproval que este efecto cancela es el de esa fila**, así que la llamada es **una sola** y no se manda dos veces |
| A6 | `ACTIVE` | se borra la ficha destino | `CANCELLED` | **se consume**: no se libera ni se reasigna (`DEC-ADDON-001`), y el borrado **tiene que advertir qué addons se pierden y por cuánto**. **Su suscripción de complemento también queda `CANCELLED` en el acto, por `S21`** (§3.2) — misma regla y misma razón que en `A5`: el addon complementa algo que ya no está |

**Cancelar el plan no cancela los addons**: como cada addon recurrente es una suscripción aparte,
esa orquestación es nuestra (`DEC-ADDON-002`), y es justamente lo que el §41 pide poder hacer al
revés.

#### La instancia que autoriza después de que su título murió: por qué `A5` no sale sólo de `ACTIVE`

**El `desde` de `A5` decía `ACTIVE` y nada más, y eso dejaba entera la ventana de 72 h del
checkout del addon.** El camino, con todos sus pasos declarados: alguien `ACTIVE` —el único
estado desde el que se puede comprar (`B/16` §2.2)— contrata un addon recurrente, `A1` lo lleva a
`PENDING_AUTHORIZATION` con las mismas 72 h que `S3`, y **dentro de esa ventana su suscripción
principal deja de ser fila viva**. Cualquiera de las seis transiciones del `B/16` §4.3 sirve, y
dos no necesitan que nadie toque un botón: `S12` es un reloj y `S16` llega con el cobro real, que
`PA-3` mide **entre 26 y 44 minutos** después de autorizar. El disparador de la orfandad se
disparaba ahí y **no encontraba a quién aplicarle**: la instancia estaba en
`PENDING_AUTHORIZATION` y `A5` no salía de ahí. Después la persona completaba el checkout, `A2` la
llevaba a `ACTIVE` **con su propio preapproval** (`DEC-ADDON-002`) y ninguna condición de `A2`
mira el título — la validez se evalúa al comprar (`B/16` §2.2). Quedaba **cobrando todos los
meses sin otorgar nada**, porque sin ninguna fuente de clase `TÍTULO` el pliegue **descarta** las
de clase `COMPLEMENTO` (`12-contrato…` §2.4). Es, con esas palabras, *«el que no puede fallar»*
del `B/16` §4.3: **un preapproval huérfano sin cancelar es un débito mensual a alguien que ya no
es cliente**.

**Es el mismo argumento que metió `PENDING_AUTHORIZATION` en el alcance de `S13`, aplicado a la
otra máquina.** Una instancia esperando autorización **es una obligación de pago**: su preapproval
está creado y la persona puede completar el checkout en cualquier momento, sin tener por qué
saber que su título murió. Por eso el `desde` de `A5` son **los dos estados de la instancia en
los que existe una autorización que puede cobrar** —`PENDING_AUTHORIZATION` y `ACTIVE`—, su
efecto cancela el preapproval **esté autorizado o esperando autorización**, con la misma regla de
relectura de `S17` (si ya está `cancelled`, no se manda nada), y la pantalla de *«esperando que
completes el pago»* **deja de ofrecer el enlace en el mismo acto**, igual que en `S13` (§3.4
punto 3).

**`A5` desde `PENDING_AUTHORIZATION` no colisiona con `A3`**: el par es
`(PENDING_AUTHORIZATION, queda huérfano)` y `A3` es `(PENDING_AUTHORIZATION, vence la ventana)`.
Son dos eventos distintos, así que **no hay un cuarto par con dos filas** y la tabla de la regla 7
del núcleo sigue teniendo **tres** entradas. **El tercer evento de `A5` tampoco agrega un par**:
*«se revoca el grant»* no lo comparte ninguna otra fila de esta tabla, ni desde `ACTIVE` —donde
están `A4` y `A6`, con sus propios eventos— ni desde `PENDING_AUTHORIZATION`. Los estados de llegada difieren —`CANCELLED` y
`ABANDONED`— y los dos son terminales de la instancia, así que **los dos caen bajo la salvedad 1
de `B/09` §3**, que devuelve al barrido la suscripción de complemento hasta que la relectura vea
el preapproval `cancelled`.

> **Y desde `S21` esa salvedad puede nombrar su sujeto de las DOS maneras, no de una.** Cuando la
> instancia llega a `CANCELLED` la fila de complemento llega **ella misma** a terminal en el mismo
> acto, así que el barrido la puede seleccionar **por su propio estado** — y con eso la
> discrepancia pasa a ser una de las cinco comparaciones de campo (`CANCELLED` nuestro contra
> `authorized` del proveedor) en vez de una lectura cruzada entre dos entidades. **La selección
> por el estado terminal de la instancia no sobra por eso, y hay que decirlo**: es la única que ve
> la corrida en que `A5` corrió y `S21` todavía no, donde la fila de complemento sigue diciendo
> `ACTIVE` y para las cinco comparaciones eso **coincide**.

**Y el orden inverso también tiene evento declarado, que era la otra mitad del hueco.** Si por lo
que sea `A5` no corrió cuando el título murió —la condición del `B/16` §4.2 no se cumplía en ese
instante porque una sucesión lo relevaba, y se cumplió después—, la condición **se vuelve a
evaluar cuando la instancia llega a `ACTIVE` por `A2`**: es uno de los momentos que `B/16` §4.3
enumera, y sin esa enumeración *«se re-evalúa»* era una promesa sin transición, que es lo que la
regla 1 de este capítulo no admite.

#### El addon cuyo título era el ancla: por qué `A5` gana un tercer evento

`B/16` §3.3 decide desde hace tiempo que **al revocar un grant el addon se corta** —*«la fuente
era el grant y el grant se fue»*—, y **ninguna fila de esta tabla lo ejecutaba**. La orfandad no
sirve para eso y la razón es exacta: **el predicado de `B/16` §4.2 pregunta por el OBJETIVO**, y
el objetivo de un addon de scope `LISTING`, `USER` o `GLOBAL` es una ficha o una cuenta que
siguen existiendo. Sólo el scope `VERTICAL_SUBSCRIPTION` volvía a *«huérfano»* al caerse el
grant, porque ahí el objetivo **sí** estaba muerto y era el grant lo único que lo relevaba
(tercera mitad del §4.2). Para los otros tres, *«se corta»* era una frase sin transición — y por
la regla 1 de este capítulo, una frase sin transición **no pasa**.

**El evento se enuncia sobre la REVOCACIÓN del grant, y esa redacción es la decisión del owner
del 2026-09-21 — no un matiz.** La primera versión decía *«se retira el ancla que era su
título»*, y **retirar un ancla no existe**: el `NUCLEO/08` §3 declara para el grant exactamente
**tres** escrituras —otorgar, anclarle una vertical nueva, revocar—, el `12-contrato…` §2.8 y el
`B/02` §2.4 dicen los dos, con esas palabras, que *«desanclar no está declarado»*, y la palabra
**no aparece en ninguna otra parte del corpus**. Una transición cuyo evento espera un acto que
ningún catálogo puede producir es una transición inalcanzable, que es la misma regla 1 por la
otra punta. Se eligió **reescribir la cláusula, no declarar un acto nuevo**: declararlo habría
abierto *«reducir el scope de un grant»*, que el `12-contrato…` §2.8 manda entrar por el catálogo
con su propia fila, su confirmación y su transición.

**La cláusula NO se borra, y ésa es la razón por la que esto no fue una supresión.** Es lo único
que apaga el addon cuando se revoca el grant en **tres de los cuatro** scopes: en `LISTING`,
`USER` y `GLOBAL` el objetivo **nunca muere** —la ficha sigue ahí, la cuenta sigue ahí—, así que
la condición de huérfano **no se cumple jamás** y sin esta cláusula la revocación dejaría al
addon convertido **funcionando gratis para siempre y sin suscripción**, porque `S20` se la
canceló (`B/16` §3.3).

**Con el enunciado nuevo los tres scopes siguen cubiertos, y no queda camino sin transición.**
Revocar es el único acto declarado que retira un ancla, y **retira todas las del instrumento a la
vez** —*«un grant es UN instrumento con UN ANCLA POR CADA VERTICAL … una revocación»*
(`12-contrato…` §2.8)—, así que alcanza a la instancia sea cual sea el ancla de la que cuelgue y
sin importar su scope.

> **«Retira todas las anclas» es retirarlas como TÍTULO, no como FILAS, y la diferencia decide si
> la cuarta comprobación del barrido tiene sujeto.** Revocar escribe `revocado_en` en el
> **instrumento** (`B/02` §2.4) y con eso las N anclas dejan de ser **anclas vivas** en el mismo
> instante; **las filas de `permanent_grant_vertical` no se borran**. Tienen que quedarse porque
> `addon_instance` apunta ahí y la segunda mitad de la cuarta comprobación —*«el ancla que era su
> título ya no es la de un grant vivo»*, `B/09` §3— **se lee DESPUÉS de la revocación**: con la
> fila borrada, el predicado se queda sin el dato en el único momento en que lo necesita. Y
> borrarlas sería además *«un efecto lateral de borrar una fila»*, que es el mecanismo que el
> `12-contrato…` §2.8 rechaza con esas palabras. Las otras dos escrituras del catálogo **no retiran nada**: otorgar crea el
instrumento y anclar **agrega** una vertical. **Y para `VERTICAL_SUBSCRIPTION` las dos cláusulas
—la orfandad y ésta— se cumplen en el mismo acto**, lo cual no es un solapamiento de la regla 7
del `NUCLEO/03` —son dos eventos, no un par con dos filas, y llegan al mismo `CANCELLED`— y no
duplica nada: la segunda encuentra la instancia ya fuera del `desde`, que son los dos estados con
autorización que puede cobrar.

**Y sigue siendo la revocación de SU grant, no la ausencia de título**, que es la distinción que
la redacción vieja acertaba y ésta conserva. Si el predicado fuera *«no le queda ninguna fuente
de clase `TÍTULO`»*, alguien que vuelve a suscribirse el mismo día que le revocan el grant
conservaría el addon gratis: tendría título de nuevo y nadie pagaría el complemento. Lo que se
cayó es **el título concreto del que ese addon colgaba**, y la instancia lo dice porque lo
guarda: `addon_instance` apunta al ancla (`B/02` §2.4), y el ancla dice de qué grant es. Si
después quiere el addon, lo contrata — que es la mitad de la decisión del owner que dice que
**revocar no repara** (`B/16` §3.3, `DEC-GRANT-001`, `DEC-TRIAL-009`).

> **La columna sigue apuntando al ANCLA y no al grant, y eso no cambia con este enunciado.** El
> evento es del grant; **el sujeto es el ancla**, porque el título es por vertical (`B/16` §2.4)
> y es el ancla la que dice en cuál. Lo que el `B/02` §2.4 pierde con *«desanclar no está
> declarado»* es sólo **una** de las dos razones que dio para preferir el ancla —la de que
> *«retirar una vertical cortaría los addons de las otras»*, que describe un acto inexistente—;
> la otra sigue entera y alcanza sola: sin el ancla no se sabe **en qué vertical** ese addon es
> gratis, y ésa es la pregunta que el pliegue hace.

**Cubre los dos orígenes del addon gratuito con una sola regla**: el que el beneficiario eligió
gratis (`B/16` §3.2) y el que `S20` convirtió desde uno que venía pagando (`B/16` §3.4). El
primero ya tenía este agujero y nadie lo había nombrado; el segundo lo habría heredado.

**Y el efecto es el mismo que el de los otros dos eventos**: `CANCELLED`, con la cancelación del
preapproval si quedaba alguno vivo y con la regla de relectura de `S17`. En el addon convertido
por `S20` **normalmente no queda ninguno** —su suscripción de complemento ya se canceló al
otorgar—, así que ahí el acto es sólo local; la llamada existe para el addon que nunca fue
gratis y llegó acá por otro camino. **Y el *«normalmente»* tiene un caso con nombre**: una corrida
de `S20` cortada entre sus dos escrituras deja el ancla escrita y el complemento vivo (§3.2), así
que ahí `A5` **sí** manda la cancelación y `S21` cierra la fila detrás. Es el escenario para el
que el orden de `S20` está declarado. **Y en ese addon la fila de complemento la cierra `S21`**
(§3.2), que es la que le pone estado terminal al cobro: en el convertido su población es vacía,
porque `S20` ya la sacó de las filas vivas.

---

## 10. La regla de no-retroceso · cierra `M-CONC-02`

El §51 nombra *«out-of-order»* entre los escenarios a cubrir y el §64.18 dice que *«MP gobierna
hechos ocurridos en MP»*.

**El orden existe y está medido**: el cuerpo de cada evento trae un campo **`version`, un
contador monótono por recurso** — el mismo preapproval llegó con `version` 4, 6, 7 y 8 en el
orden causal de las acciones (`EX-2`, `VERIFIED`). Es más fuerte que el id del evento, que
cambia en cada reentrega.

**Y aun así la regla no se apoya en ordenarlos, sino en no necesitar el orden.** El motivo no es
que falte el contador: es que un evento ordenado sigue sin decir el estado actual. Entre que el
proveedor emite y nosotros procesamos pueden haber pasado más cosas, y el `version` permite
saber que un evento es viejo pero no qué hay ahora. La relectura sí.

El `version` **se usa**, y para dos cosas concretas: descartar un evento más viejo que el último
aplicado **sin gastar una relectura**, y detectar que el recurso cambió sin que nos avisaran —
está medido que mutar el monto **salta el contador de 5 a 9 sin emitir una sola entrega**
(`EX-15`).

### 10.1 Un webhook no es un estado: es un aviso

**Nunca se escribe el estado que trae el evento.** Al recibirlo, si su `version` no es mayor que
la última aplicada para ese recurso se descarta ahí mismo; si lo es, se **relee el recurso por su
id** en el proveedor y se escribe lo leído, junto con la `version` de esa lectura.

Está medido que ese camino es el confiable: leer por id es `VERIFIED` (`RC-2`), mientras que
**buscar no lo es** y falla en tres direcciones sin avisar en ninguna (`RC-1`) — ignora nuestra
referencia y devuelve todo, con un estado inválido devuelve cero con `200`, y con uno válido
devuelve un subconjunto plausible.

Con esto, dos webhooks que lleguen al revés producen **el mismo resultado**: los dos releen y los
dos escriben el estado actual. No hay retroceso posible porque el evento nunca es la fuente.

#### Qué se escribe, par por par — espejar es una transición declarada

*«Se escribe lo leído»* y *«lo que la tabla no declara no se escribe, se marca»* (`NUCLEO/03` §1,
regla 1) **gobiernan el mismo acto y daban resultados opuestos**. Como la tabla del §3.2 sólo
cubría dos de los mapeos que el proveedor puede devolver, **la defensa central contra el desorden
de webhooks terminaba emitiendo un incidente en vez de espejar un hecho**, y la fila se quedaba en
un estado que el proveedor ya había abandonado — **con servicio completo**.

Se resuelve enumerando. El proveedor devuelve **cuatro** estados de preapproval; cruzados con lo
que tengamos nosotros, éstos son los pares y su veredicto:

| leído en el proveedor | lo nuestro | qué se hace |
|---|---|---|
| `pending` | `PENDING_AUTHORIZATION` | nada: coinciden |
| `pending` | cualquier otro | **divergencia real** — el proveedor no puede retroceder a pendiente. Marca |
| `authorized` | `PENDING_AUTHORIZATION` | **`S2`**: espejar es la transición que ya existe |
| `authorized` | `PAUSED` | **`S10`**: el proveedor reanudó. Espejar — y acá la condición de `S10` ya está cumplida, porque **esta lectura ES la relectura** que la fila pide. **El caso ciego es el contrario**, `paused` contra `PAUSED`: ahí los dos lados coinciden, esta tabla no ve nada y lo levanta la **quinta comprobación de cero llamadas** de `B/09` §3 |
| `authorized` | `GRACE_PERIOD` · `SUSPENDED` | **divergencia real** — el preapproval está vivo y nuestro reloj dice que no cobró. Marca: es el caso que `B/12` §1.4 manda mirar. **Salvo que la fila sea la predecesora de una sucesión en curso —o sea con una sucesora VIVA apuntándola— y tenga un pago pendiente por `S19`**: ahí el cobro **sí** entró y está registrado, y el estado es el que `S19` declara — la premisa de esta fila (*«nuestro reloj dice que no cobró»*) es falsa para esa población, y marcarla sería un incidente sobre el camino normal. La salvedad **está acotada por la ventana**: muerta la sucesora, la fila deja de ser predecesora de una sucesión en curso y vuelve a esta fila con su premisa verdadera |
| `paused` | `ACTIVE` | **`S8`**: el proveedor pausó y nosotros no lo sabíamos. Espejar, con motivo `CUSTOMER_REQUEST` |
| `cancelled` | `CANCEL_SCHEDULED` | nada: es lo esperado, `S11` ya lo canceló. El servicio sigue hasta la fecha nuestra (`DEC-SUB-009`) |
| `cancelled` | cualquier estado vivo que no sea `CANCEL_SCHEDULED` | **`S12`** si hay una baja programada; si no, **espejar la baja decidida por el proveedor** (`B/12` §1.4) |

> **Espejar un estado leído por id es una transición declarada de esta tabla, no un acto aparte.**
> Lo que **no** figura acá es divergencia real, y ahí la marca es la respuesta correcta — deja de
> ser un falso positivo y pasa a señalar lo que su nombre dice.
>
> **Y «de esta tabla» incluye el §3.2, con todo lo que eso arrastra.** La última fila —espejar la
> baja que decidió el proveedor— **saca a una fila principal de las filas vivas**, así que es la
> séptima del dominio que el §3.2 recorre por el lado de la predecesora, la **sexta** de las que
> disparan la re-evaluación del addon huérfano (`B/16` §4.3), un tercer camino por el que la
> predecesora **se muere sola** y `S18` cierra la sucesión sin `S17`, y la **rama 5** de
> `B/12` §5.3. Que no tenga fila numerada en el §3.2 no la saca de ninguno de los cuatro
> lugares: **enumerar el dominio sobre las filas numeradas es el error, no la ausencia de número.**

**Por qué enumerar y no declarar que espejar es una excepción a la regla 1.** La excepción
resolvía el choque en una línea y abría un camino que **escribe estado sin transición declarada**,
que es exactamente lo que la regla 1 existe para impedir. Enumerar cuesta ocho filas y deja
escrito **por qué cada caso cayó donde cayó**.

### 10.2 Los hechos puntuales sí necesitan orden, y lo toman del hecho

Un cobro no es un estado: es algo que pasó en un instante, y la relectura del preapproval no lo
refleja campo a campo. Para esos:

- **el orden lo da la fecha del hecho**, nunca la de llegada;
- **se deduplica por el id del hecho**, no por el tipo de evento — está medido que un mismo
  reembolso emite tres notificaciones en dos formatos (`RF-7`);
- **un hecho más viejo que el último aplicado se registra y no se aplica.**

### 10.3 La escritura local usa concurrencia optimista

Entre la relectura y la escritura puede entrar otra. Cada fila con estado lleva una **versión**,
y una escritura que no coincide **no reintenta a ciegas**: vuelve a leer y reevalúa la
transición contra la tabla. Si la transición ya no corresponde, no se ejecuta.

### 10.4 Lo que esta regla NO cubre

**Un cambio que el proveedor acepta y no aplica.** Está medido nueve veces, y el caso más caro es
la mutación de monto: **no emite webhook** (`EX-15`), así que no hay nada que releer porque nada
avisa. La defensa no es esta regla sino la del capítulo 06: **toda mutación se verifica
releyendo y comparando campo por campo cada campo que se mandó**, porque está medido que un
`PUT` con varios campos **se aplica a medias con un solo `200`** (`EX-20`).

---

## Lo que esta mitad NO cierra

- **Los seis cruces del §52** son `E-CONC-01`, del capítulo 05. Acá quedan nombrados dos —el
  pago manual simultáneo al del proveedor, y el cambio de plan en grace— sin resolverlos.
- ~~**La baja desde `GRACE_PERIOD` sigue sin fila.**~~ **CERRADA** por `DEC-SUB-014` (owner,
  2026-09-21): corta en el acto, con la fecha de fin de servicio en el día de la cancelación, y
  la ejecuta **`S24`** (§3.2). De las dos respuestas posibles que este § declaraba abiertas
  —cortar hoy o dejar correr el reloj del grace— el owner eligió la primera, por el criterio que
  ya gobierna `S22` y `S23`: *«no queda período pagado que sostener»*.
- ~~**La baja que `B/10` §4.3 ejecuta al discontinuar una vertical tampoco tiene fila.**~~
  **CERRADA LA MITAD DEL CHOQUE**, por `DEC-SUB-015` (owner, 2026-09-21), y **no dándole a la
  pausada la fila que le faltaba sino sacándola del acto**: la pausada **no entra al piso**, se
  queda `PAUSED` sobre una vertical que ya tiene fecha de cierre —eso es legal y está escrito en
  `B/10` §4.3—, se le avisa **el día del anuncio** (`NUCLEO/07` §6, `B/19` §4 fila 14-bis) y su
  fila termina cuando la pausa termina, por **`S25`** (§3.2). **El §3.3 no cede**: sigue sin
  existir `PAUSED → CANCEL_SCHEDULED`, y la contradicción se resolvió corrigiendo la instrucción
  que lo pedía, no la prohibición.
- **Pero la otra mitad SIGUE ABIERTA: el acto de la discontinuación no tiene fila numerada para
  NINGÚN estado, no sólo para `PAUSED`.** `B/10` §4.3 manda las demás vivas a `CANCEL_SCHEDULED`
  y **`S11` no lo ejecuta**: su evento es *«pide la baja»*, o sea un acto del cliente sobre su
  propia fila, y esto lo decide `SUPER_ADMIN` sobre la cartera entera de una vertical. Por la
  regla 1 del núcleo, hoy ese movimiento cae en la marca desde `ACTIVE`, desde `GRACE_PERIOD`,
  desde `SUSPENDED` y desde `PENDING_AUTHORIZATION` igual que caía desde `PAUSED`. **`DEC-SUB-015`
  no resolvió esto y no pretendía hacerlo**: resolvió a quién alcanza el piso, no qué transición
  lo ejecuta. Queda declarado, y va como pregunta al owner.
