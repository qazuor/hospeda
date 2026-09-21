---
title: Master Spec 03 — Las máquinas de estado
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-19
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
> escribe como un **conjunto de filas** —y en esta tabla hay una sola, `S13`— tiene que decir si
> alcanza también a las de complemento, porque son filas de `subscription` como cualquier otra y
> **entran por pertenencia sin que nadie lo decida**. `S13` dice **«principal»** y no las alcanza
> (§3.2); toda transición futura que se escriba sobre un conjunto tiene que contestar lo mismo.

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
§1.4), o que la cancele una persona.

**Por qué sale `RECONCILIATION_REQUIRED`.** Lo que describe no es una situación de la suscripción:
es una situación **nuestra** —*«el sistema no puede decidir solo (§22.1)»*—, y escribirla en la
columna de estado **pisa el estado real de la fila**. Eso producía tres cosas, y las tres eran
defectos vivos: el estado anterior se perdía y `S15` tenía que adivinarlo; convertir una `ACTIVE`
en `RECONCILIATION_REQUIRED` es **textualmente una decisión destructiva automática**, que el mismo
§22.1 prohíbe; y el candado dejaba de ver una autorización que seguía viva.

> **`requiere_conciliación` es una marca booleana sobre la fila, no un estado.** La fila conserva
> el estado que tenía, y sigue cubriendo a quien estaba cubierto (`B/02` §2.2).

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
| S4 | `ACTIVE` | un cobro falla | `GRACE_PERIOD` | — | arranca el reloj del §4; el servicio **sigue entero** (§20) |
| S5 | `GRACE_PERIOD` | entra el pago, **o se reevalúa uno que quedó pendiente** por `S19` | `ACTIVE` | las cuatro condiciones del cap. 05 §3 — y la 3 incluye **que esta fila no sea la predecesora de una sucesión en curso** | se apaga el reloj |
| S6 | `GRACE_PERIOD` | se agota el reloj | `SUSPENDED` | **no hay un pago acreditado del período pendiente de resolución** por `S19` | §21: sin listado público, sin edición, sin creación, sin entitlements comerciales; datos conservados y billing accesible |
| S7 | `SUSPENDED` | regulariza, **o se reevalúa un pago que quedó pendiente** por `S19` | `ACTIVE` | el cobro entró de verdad **y** las cuatro condiciones del cap. 05 §3 — y la 3 incluye **que esta fila no sea la predecesora de una sucesión en curso** | se restituye la publicación |
| S8 | `ACTIVE` | la persona pide pausar | `PAUSED` *(motivo `CUSTOMER_REQUEST`)* | `puedePausar()` (capítulo 01 (núcleo) §3) | se pausa en el proveedor; se elige en **meses enteros** (`DEC-SUB-010`) |
| S9 | `ACTIVE` | `SUPER_ADMIN` otorga cortesía | `PAUSED` *(motivo `COURTESY`)* | no hay pausa vigente (`DEC-GRANT-004`) | se pausa en el proveedor y **el servicio se sostiene de nuestro lado** (`DEC-GRANT-003`) |
| S10 | `PAUSED` | llega el fin, o la persona vuelve antes | `ACTIVE` | — | `PUT status=authorized`; al reanudar se le muestra **una sola cosa: qué día se le cobra** (`DEC-SUB-010`) |
| S11 | `ACTIVE` | pide la baja | `CANCEL_SCHEDULED` | — | **se cancela en el proveedor de inmediato** y se guarda **nuestra** fecha de fin de servicio (`DEC-SUB-009`) |
| S12 | `CANCEL_SCHEDULED` | llega la fecha de fin de servicio | `CANCELLED` | — | se corta el servicio; proceso **idempotente** |
| S13 | **toda fila viva PRINCIPAL** del beneficiario en **cada vertical que el acto ancla** (`B/02` §2.4, `permanent_grant_vertical`) — los seis estados, `PENDING_AUTHORIZATION` y `CANCEL_SCHEDULED` incluidos. **Las de complemento no entran** (ver abajo, *«y no alcanza a los complementos»*) | `SUPER_ADMIN` **otorga** un *Free Forever*, **o le ancla una vertical nueva a uno vivo** (`12-contrato…` §2.8) | `CANCELLED` | — | §35.3: se cancela toda obligación de pago, **sin reembolso** (`DEC-GRANT-001`); **se cancela el preapproval de cada una** en el proveedor —autorizado o esperando autorización— con la misma regla de `S17`: si la relectura dice que ya está `cancelled`, no se manda nada; el acceso pasa a darlo el grant. **Y si alguna de las filas alcanzadas retenía un pago pendiente por `S19`, la bandera se apaga en el mismo acto, sin reembolso** — es la rama 4 de `B/12` §5.3, y apagarla es parte de la decisión: dejarla puesta sobre una `CANCELLED` deja un *«pendiente»* que ningún barrido alcanza y que todo conteo de pagos pendientes cuenta de más. **Proceso idempotente y reanudable fila por fila**, con su detector en `B/09` §3 (ver abajo, *«la ejecución parcial»*) |
| S14 | cualquiera | divergencia que toca plata o estado | **el mismo estado** | — | **se pone la marca `requiere_conciliación`** y se emite el §22.1: evento crítico, correo a `SUPER_ADMIN`, alerta en Admin, **cero decisiones destructivas automáticas** |
| S15 | cualquiera **con la marca puesta** | una persona resuelve | **el mismo estado** | intervención humana registrada | **se levanta la marca**; si además corresponde un cambio de estado, se ejecuta **la transición de esta misma tabla que lo permita** |
| S16 | `ACTIVE` | el **primer** cobro se rechaza | `CHARGE_DECLINED` | **es el primer cobro DE ESA autorización**, y el proveedor la canceló al rechazarlo | no hay servicio, no hay autorización y no hay vuelta: el reintento **es un alta nueva** — **salvo que la fila fuera la predecesora de una sucesión**, y ahí el reintento es **terminar el checkout que ya está abierto**: `S18` cierra la sucesión en el acto y la sucesora ocupa el candado `A` (§3.3.1) |
| S17 | la **predecesora**, si **sigue siendo fila viva** — las cinco alcanzables: `ACTIVE`, `GRACE_PERIOD`, `CANCEL_SCHEDULED`, `PAUSED`, `SUSPENDED` | su sucesora quedó **autorizada**, confirmado por relectura | `CANCELLED` | la fila tiene una **sucesora viva** con `sucede_a` apuntándola | **se cancela en el proveedor si su preapproval sigue vivo** (es `D7`); si la relectura dice que ya está `cancelled`, `D7` **ya está cumplido y no se manda nada** |
| S18 | la **sucesora viva**: en `ACTIVE`, **o en `PENDING_AUTHORIZATION` cuando la predecesora se murió sola** | la misma autorización que disparó `S2`; **o la predecesora dejó de ser fila viva sin `S17` — por `S12`, por `S16` o por el espejo de la baja decidida por el proveedor (§10.1)**; o una resolución de `S15` sobre la sucesión trabada | **el mismo estado** | la predecesora **ya no es fila viva** | **cierra la sucesión, y es el único acto que lo hace.** Son **cuatro** escrituras y la tercera alcanza **tres** entidades: se escribe **`sucedida_por`** en la predecesora; se **limpia `sucede_a`** en la sucesora; **todo lo que colgaba de la predecesora se re-apunta a la SUCESORA** —los **complementos** (`B/16` §4.2), la **redención de promo** (`B/14` §2.2) y la **cortesía vigente** (`B/14` §4.4), con el inventario completo en `B/02` §2.6—; y **si la predecesora retiene un pago pendiente por `S19`, se le pone a ELLA la marca `requiere_conciliación`** con motivo *«reembolso por confirmar»* (rama 1 de `B/12` §5.3, `DEC-RF-002`). La sucesora pasa a ser el origen |
| S19 | la **predecesora** de una sucesión en curso, en `GRACE_PERIOD` o `SUSPENDED` | **entra el pago del período impago, por cualquiera de sus DOS puertas**: la cuota que el proveedor sigue reciclando, **o** el pago que el admin registra a mano (`MP1`, §7) | **el mismo estado** | la fila tiene una **sucesora viva** con `sucede_a` apuntándola | **el pago se registra y queda pendiente de resolución** —sea un `payment` o un `manual_payment` (`B/02` §2.3)—: no reactiva, no se reembolsa todavía y **no pone la marca todavía** — es un caso diseñado y no una divergencia, así que `S14` no aplica; **la marca la pone `S18` al cerrar, y sólo en las ramas 1 y 5**. Su destino lo decide **cómo termina la sucesión**, con las cinco ramas de `B/12` §5.3. Mientras esté pendiente, `S6` no corre |

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
**siete** las transiciones de esta tabla que la sacan de ahí sin que nadie declare nada:

| # | desde | transición | hacia | ¿sigue siendo fila viva? |
|---|---|---|---|---|
| 1 | `ACTIVE` | `S8` — la persona pide pausar | `PAUSED` | **sí** |
| 2 | `ACTIVE` | `S9` — `SUPER_ADMIN` otorga cortesía | `PAUSED` | **sí** |
| 3 | `GRACE_PERIOD` | `S6` — se agota el reloj, **salvo que haya un pago pendiente por `S19`** | `SUSPENDED` | **sí** |
| 4 | `CANCEL_SCHEDULED` | `S12` — llega la fecha de fin de servicio | `CANCELLED` | **no** |
| 5 | cualquiera de los cinco | `S13` — *Free Forever* | `CANCELLED` | **no** |
| 6 | `ACTIVE` | `S16` — el primer cobro de esa autorización se rechaza | `CHARGE_DECLINED` | **no** |
| 7 | `ACTIVE` · `GRACE_PERIOD` | **el espejo de la baja decidida por el proveedor** (§10.1) — es la salida esperada del camino de mora (`B/12` §1.4) | `CANCELLED` | **no** |

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
cuándo llega no se puede acotar. **Las tres primeras siguen siendo filas vivas y son el dominio de
`S17`** —por eso su `desde` son cinco estados y no tres—; **las cuatro últimas ya no lo son, y ahí
`S17` simplemente no aplica: no hay nada que cancelar y no hay nada que matar.**

**`S18` corre en SEIS de las siete, y la que falta es `S13`.** En las tres primeras corre después
de `S17`, que es el que hace verdadera su condición. En `S12`, en `S16` y en **el espejo** corre
**sin `S17` y sin esperar a que la sucesora autorice**, que es el segundo evento de su fila y el §
siguiente explica por qué tiene que ser así. En `S13` **no corre**, y no es una excepción olvidada:
`S13` alcanza a **toda fila viva principal** del beneficiario, o sea también a la sucesora, así que
no queda ninguna sucesora viva a la que pasarle el origen (ver más abajo, *«`S13` alcanza a toda
fila viva PRINCIPAL»*).

#### Por qué `S18` también sale de `PENDING_AUTHORIZATION`: el candado `A` no se puede quedar vacío

**Cuando la predecesora se muere sola —por `S12`, por `S16` o por el espejo del §10.1—, el candado
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
predecesora por `S12`, por `S16` o por el espejo, la sucesora **ya es el único compromiso** de ese
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

**De las cuatro escrituras de `S18`, por dos de los tres caminos corren tres, y por el tercero
corren las cuatro.** Por `S12` y por `S16` la cuarta —la marca sobre un pago pendiente por `S19`—
**no puede aplicar**, y es aritmética de los `desde`: `S19` sólo existe sobre una predecesora en
`GRACE_PERIOD` o `SUSPENDED`, y esos dos caminos salen de `S12` (`desde: CANCEL_SCHEDULED`) y de
`S16` (`desde: ACTIVE`). **Ninguna fila puede estar en los dos conjuntos.** Las otras tres
—`sucedida_por`, limpiar `sucede_a` y el re-apunte— corren igual, y el re-apunte alcanza sus tres
entidades salvo la cortesía, que tampoco puede coexistir con estos dos caminos (`B/14` §4.4).

> **Por el espejo del §10.1 la aritmética se da vuelta, y hay que decirlo porque la versión
> anterior de este párrafo afirmaba lo contrario sobre un dominio de dos.** El `desde` del espejo
> es *«cualquier estado vivo que no sea `CANCEL_SCHEDULED`»*, o sea que **incluye `GRACE_PERIOD` y
> `SUSPENDED`**, que es exactamente la población de `S19` — y no por casualidad: la baja que decide
> el proveedor llega **por mora acumulada** (`B/12` §1.4), así que la predecesora que la recibe es
> justamente la que venía en grace. Por este camino **las cuatro escrituras corren**, la cuarta
> incluida, y el pago pendiente se resuelve por la **rama 5** de `B/12` §5.3 — la misma marca y el
> mismo *«reembolso por confirmar»* de la rama 1, con otro acto adelante. El enunciado *«la cuarta
> no puede aplicar cuando la predecesora se murió sola»* era verdadero sobre los dos caminos que
> entonces existían y es **falso sobre el tercero**.

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
- **`S18` sin `S17` es lo CORRECTO en `S12`, en `S16` y en el espejo del §10.1**, y en ninguno de
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
tiene una segunda puerta declarada en este mismo capítulo: **`MP1` (§7), el pago manual**, que
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
(`B/12` §1.3) y `MP1` (§7). Un pago manual sobre una fila **`SUSPENDED`** no es una tercera:
`MP1` sale de `AWAITING`, y la única forma de que la suscripción de un pagador manual llegue a
`SUSPENDED` es `MP2` o `MP3`, que sacan al `manual_payment` de `AWAITING` en el mismo acto — así
que por esta puerta `S7` es inalcanzable, y no es un hueco sino aritmética de los dos estados.
**Lo que sí queda nombrado y NO se resuelve acá** es qué pasa con un pago manual que llega
**después** de `DECLARED_UNPAID`: el §7 no tiene salida de ese estado, el caso es idéntico dentro
y fuera de una sucesión, y decidir si un admin puede reabrirlo es una decisión de producto que no
es de `S19`.

**`S19` y `S5` comparten `(GRACE_PERIOD, entra el pago)`, y `S19` y `S7` comparten el par sobre
`SUSPENDED`: las guardas son disjuntas por construcción**, porque una pregunta si la fila es la
predecesora de una sucesión en curso y la otra si no lo es. Es la regla 7 del núcleo, y lo vigila
`G-R4`. **Abrir la segunda puerta no agrega un par**: `MP1` no es un evento de esta tabla sino un
efecto que entra por el evento *«entra el pago»* que `S5` y `S19` ya compartían, así que los pares
con dos filas siguen siendo los **tres** que `NUCLEO/03` §1 regla 7 enumera.

**Y `S6` lleva su condición por el mismo motivo**: con el pago acreditado y pendiente, el reloj del
grace mandaría a `SUSPENDED` —que no emite fuente (`12-contrato…` §2.6)— a alguien que pagó el
período. El tope es la ventana: 72 h, y después el pago se resuelve por una de las cinco ramas de
`B/12` §5.3.

**Y el tope está escrito como condición, no sólo como intención, porque hay QUIÉN lo hace
vencer.** *«Después de 72 h»* no era ninguna condición de `S19`, `S5`, `S6` ni `S7`: las cuatro
cuelgan de dos booleanos —*«¿hay una sucesora viva apuntándome?»* y *«¿hay un pago pendiente por
`S19`?»*— y ninguno se apaga por el paso del tiempo. Los apagan **cuatro** actos declarados, uno
por rama:

| cómo termina la sucesión | quién apaga el pago pendiente | cómo queda la fila |
|---|---|---|
| la sucesora autoriza | **`S18`**, que le pone la marca a la predecesora | `CANCELLED` con la marca, en el canal de conciliación |
| la sucesora vence su ventana | **`S3`**, que lo reevalúa en el acto | reactivada por `S5` o `S7` |
| cae un grant *Free Forever* | **`S13`**, que apaga la bandera sin reembolso | `CANCELLED`, sin nada pendiente |
| **el proveedor da de baja a la predecesora** (el espejo del §10.1, por mora acumulada) | **`S18`**, que corre sin `S17` y le pone la marca a la predecesora | `CANCELLED` con la marca, en el canal de conciliación |

La quinta —la sucesión trabada— ya tiene una persona mirándola con la marca puesta, y es la única
cuyo reloj es humano. **Y el backstop de `B/09` §3 sigue haciendo falta igual**, porque cubre el
caso en que alguno de los cuatro actos no se ejecutó.

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
  complemento fue cancelada»*** (`A4` es su fecha de fin, `A5` la orfandad y `A6` el borrado de la
  ficha, §8). La instancia se quedaba `ACTIVE` y gratis para siempre.

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
| `USER` · `GLOBAL` | **no queda huérfano**: el objetivo es la cuenta y la cuenta no se borró. Ya era así; lo que cambia es que ahora su cobro tampoco se cancela |
| `LISTING` | **no lo toca nadie**: su objetivo es la ficha (`B/16` §4.2) |

**Y su suscripción de complemento sigue cobrando, porque ningún acto la apaga.** Es la regla 1 del
núcleo leída en la dirección que menos se lee: lo que la tabla no declara **no pasa**, así que un
grant que no alcanza al complemento tampoco lo deja gratis. **Lo que NO decide este § es si un
grant con `includesAddons: true` tiene que convertir a costo $0 un addon que el beneficiario ya
venía pagando**: el §35.2 habla de addons que *«pueden utilizarse a costo $0»* y `B/16` §3.2 dice
que el grant *«habilita; no enciende»* y que la persona los elige uno por uno, las dos frases
escritas sobre addons que **todavía no existen**. Para uno ya comprado no hay acto declarado en
ningún capítulo, y **no se inventa acá**: queda abierto y nombrado.

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
igual que las de las otras tres comprobaciones.

**`S14` y `S15` quedan en la tabla y ya no son transiciones de estado.** Se listan acá porque son
los dos eventos que el §22.1 gobierna y nadie los debe buscar en otro lado, pero **ninguna de las
dos mueve la columna de estado**: la primera pone la marca, la segunda la levanta. Si al resolver
corresponde además un cambio de estado, ése se ejecuta **con la transición de esta misma tabla que
lo permita** — y eso es justamente lo que se ganó, porque antes `S15` tenía que adivinar a dónde
volver.

### 3.3 Las transiciones que NO existen, y por qué

Tan importantes como las que existen, porque cada una es un error que alguien va a intentar
escribir:

| lo que no existe | por qué |
|---|---|
| `CANCEL_SCHEDULED` → `ACTIVE` | arrepentirse **no es una transición: es una sucesión**. `DEC-SUB-009` cancela en el proveedor de inmediato y cancelar allá es irreversible (`PA-5`), así que volver exige recrear y volver a autorizar — y eso entra por el candado `B` igual que un upgrade, **no** por un `INSERT` que el §11 rechace. No hay riesgo de doble cobro: `S11` ya canceló el preapproval de la predecesora *«de inmediato»*, así que la única autorización que puede cobrar es la de la sucesora. **Y por eso mismo `S17` no manda nada acá**: su relectura encuentra el preapproval ya `cancelled`, `D7` está cumplido, y la sucesión la cierra `S18` (§3.2) |
| `CANCELLED` → cualquier cosa | ídem. Una suscripción terminada no revive |
| `TRIAL_*` → `SUSPENDED` | el trial vencido es `TRIAL_EXPIRED`, que es otra máquina y otro estado (`DEC-ARCH-003`) |
| `PAUSED` → cualquier cosa que no sea `ACTIVE` o `CANCELLED` | está medido que **estando pausada el proveedor rechaza toda modificación** (`EX-11`), y que **sí deja cancelar** |
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
fila **con la marca `requiere_conciliación` puesta no puede ser sucedida** —ningún `sucede_a`
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

Sub-estado de Suscripción con reloj propio. Entra por `S4` y sale por `S5` o `S6` — y por `S17` o
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
por S10.

| | |
|---|---|
| **motivos** | `CUSTOMER_REQUEST` · `COURTESY`. Valor cerrado |
| **unidad** | **meses enteros** (`DEC-SUB-010`). No existe la pausa intra-ciclo |
| **cuándo empieza** | en el momento en que se pide, no al fin del ciclo |
| **quién la termina** | **nuestro reloj**. Está medido que el proveedor **no tiene auto-reanudación** (`PS-4`) |
| **qué pasa al volver** | se cobra normal en el ciclo siguiente; reanudar cambia **sólo el estado** y no dispara cobro de recuperación ni deja deuda (`PS-5`) |
| **límites** | los del §26.3, reexpresados en meses: **4 pausas-mes** por pausa y **8** acumulados en 12 meses; máximo 3 pausas por ventana. Se cuentan por `user + vertical` y **sobreviven a cancelar y volver a suscribirse** (`DEC-SUB-004`) |

**Qué le pasa a la ficha mientras dura la pausa, porque esto no se puede escribir de un solo
lado.** Una `PAUSED` por `CUSTOMER_REQUEST` **no emite fuente** (`12-contrato…` §2.6), así que
`cubierto` pasa a falso y `PB2` baja la ficha el primer día (`V/03` §9). **Y el reloj de
inactividad de verticales no se detiene**: si la pausa cruza el día 90, `PB4` la archiva.
Verticales no sabe que detrás de esa pérdida de cobertura hay una pausa, y `DEC-TRIAL-008`
decidió que no lo sepa, así que lo que protege al cliente no es una excepción sino dos cosas:
**`PB7` republica la ficha sola** cuando la cobertura vuelve al reanudar, y **el tope de una
pausa es menor que el día del hard delete** —4 pausas-mes, unos 120 días, contra 180 (`V/02`
§4.1)—. Esa desigualdad es el invariante `D16` y la vigila **`G-R5`, sobre el número que declara
la fila de arriba**: subir el tope de pausa acá sin mirar el otro lado es lo que le borraría el
contenido a un cliente que está al día. El aviso que se lo dice antes de confirmar es `B/19` §4,
fila 5-bis.

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
| MP1 | `AWAITING` | el admin registra el pago | `REGISTERED` | la suscripción sale de `GRACE_PERIOD` por `S5` — **o queda pendiente por `S19`, si es la predecesora de una sucesión en curso**: el efecto de `MP1` es el de `S5` y hereda su condición, porque el daño no depende de por qué puerta entró el pago. **`S19` lo admite por su propio evento**, que nombra las dos puertas (§3.2): sin eso la derivación apuntaba a una fila que no podía recibirlo |
| MP2 | `AWAITING` | el admin confirma que no se pagó | `DECLARED_UNPAID` | la suscripción va a `SUSPENDED` por `S6`, sin esperar el reloj |
| MP3 | `AWAITING` | se agota el grace sin que el admin haga nada | `DECLARED_UNPAID` | `S6` |

**Lo que el §30 agrega y la máquina tiene que cumplir**: si falta el pago, va a `GRACE_PERIOD`
**los mismos días configurables** que el resto (`DEC-SUB-002` vale igual acá), y **además se
notifica al admin** — que es el único caso donde una notificación es parte del flujo y no un
efecto colateral, porque sin ella nadie va a registrar nada.

**Y el cruce peligroso queda nombrado**: un admin registrando un pago manual mientras la persona
paga por el proveedor es **doble cobro con dinero real** (`E-CONC-01`). Lo resuelve el capítulo
05; acá queda dicho que la transición MP1 **no** es incondicional.

**Esta máquina no tiene transición de reversa, y no la necesita: la devolución se asienta en un
`refund` sobre el pago manual.** El §6 da `P3` y `P4` sobre la máquina de `payment`, y de acá
salía la lectura de que un pago manual **no se puede devolver** — que es falso y era caro,
porque las ramas 1 y 5 de `B/12` §5.3 mandan devolver el pago que `S19` retuvo **sin distinguir
por qué puerta entró**. Lo que se devuelve es *«el pago»*, y desde `B/02` §2.3 un `refund` cuelga
del pago que se devuelve, sea `payment` o `manual_payment`. El estado del `manual_payment` **no
se mueve**: quedó `REGISTERED` porque el pago existió, y la devolución es un hecho posterior con
su propia fila — exactamente la relación que `payment` y `refund` ya tienen. Y la devolución no
es automática en ninguno de los dos casos: la confirma una persona (`DEC-RF-002`), sobre la marca
que `S18` puso.

---

## 8. Addon (instancia)

| # | desde | evento | hacia | nota |
|---|---|---|---|---|
| A1 | *(sin fila)* | se contrata | `PENDING_AUTHORIZATION` | exige una suscripción principal válida y compatible (§38). **Nunca durante un trial** (§10.5) |
| A2 | `PENDING_AUTHORIZATION` | se autoriza | `ACTIVE` | recurrente: su propio preapproval (`DEC-ADDON-002`). De única vez: su propio cobro |
| A3 | `PENDING_AUTHORIZATION` | vence la ventana | `ABANDONED` | mismas 72 h que S3 |
| A4 | `ACTIVE` | llega su fecha de fin | `EXPIRED` | **el reloj no se congela** aunque la ficha esté despublicada (`DEC-ADDON-001`) |
| A5 | **toda instancia con una autorización que puede cobrar: `PENDING_AUTHORIZATION` y `ACTIVE`** (ver abajo, *«la instancia que autoriza después»*) | se da de baja, o queda huérfano | `CANCELLED` | §41: **sólo** cuando queda efectivamente huérfano, no por cancelar la vertical. *«Huérfano»* es la condición de `B/16` §4.2 —el objetivo dejó de ser fila viva, **ninguna sucesión lo releva** y **ningún grant permanente lo releva**—, **nunca un estado de llegada concreto**: la pueden cumplir las **seis** transiciones que sacan a la principal de las filas vivas —`S3`, `S12`, `S13`, `S16`, `S17` y el espejo del §10.1—, y `S16` (`CHARGE_DECLINED`) es una de ellas. **Y se evalúa sobre los complementos de la fila que la transición sacó de las filas vivas y, si esa fila era una sucesora, también sobre los de su predecesora** (`B/16` §4.3) |
| A6 | `ACTIVE` | se borra la ficha destino | `CANCELLED` | **se consume**: no se libera ni se reasigna (`DEC-ADDON-001`), y el borrado **tiene que advertir qué addons se pierden y por cuánto** |

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
del núcleo sigue teniendo **tres** entradas. Los estados de llegada difieren —`CANCELLED` y
`ABANDONED`— y los dos son terminales de la instancia, así que **los dos caen bajo la salvedad 1
de `B/09` §3**, que devuelve al barrido la suscripción de complemento hasta que la relectura vea
el preapproval `cancelled`.

**Y el orden inverso también tiene evento declarado, que era la otra mitad del hueco.** Si por lo
que sea `A5` no corrió cuando el título murió —la condición del `B/16` §4.2 no se cumplía en ese
instante porque una sucesión lo relevaba, y se cumplió después—, la condición **se vuelve a
evaluar cuando la instancia llega a `ACTIVE` por `A2`**: es uno de los momentos que `B/16` §4.3
enumera, y sin esa enumeración *«se re-evalúa»* era una promesa sin transición, que es lo que la
regla 1 de este capítulo no admite.

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
| `authorized` | `PAUSED` | **`S10`**: el proveedor reanudó. Espejar |
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
