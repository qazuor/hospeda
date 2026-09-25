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
> escribe como un **conjunto de filas** —y en esta tabla hay **cinco**: `S13`, `S20` y las **tres**
> de la discontinuación, `S26`, `S27` y `S28`— tiene que decir si alcanza también a las de
> complemento, porque son filas de `subscription` como cualquier otra y **entran por pertenencia
> sin que nadie lo decida**. **Las cinco lo contestan, y no las cinco igual**: `S13` dice
> **«principal»** y no las alcanza; `S20` dice **«de complemento»** y **sólo** las alcanza; las
> tres de la discontinuación dicen **las dos clases**, porque `B/10` §4.3 ordena el acto también
> sobre *«cada suscripción de complemento viva en ella»* (§3.2). Que `S13` y `S20` sean dos filas y
> no un `desde` ampliado es deliberado: `S13` cancela **sin evaluar condición**, y `S20` **evalúa
> una** —compatibilidad y el flag— que es lo que el §41 exige para no cancelar a ciegas; que la
> discontinuación sean tres es por otra razón, y está abajo: **el destino cambia con lo que cada
> estado emite**. Toda transición futura que se escriba sobre un conjunto tiene que contestar lo
> mismo.

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
mismo § declaró el residuo y no lo resolvió: *«`ABANDONED` dice "nadie autorizó dentro de su ventana"; esto es
"intentó y lo rechazaron". Le decimos cosas distintas al cliente en cada caso, así que no pueden
compartir nombre»*. **Acá se cierra**, y no por prolijidad: es ese residuo el que rompía el
candado. Mandar el alta que nunca cobró a `SUSPENDED` hacía que `SUSPENDED` significara **dos
muertes distintas**, y bloqueaba el reintento que `B/12` §4.4 exige.

Con `CHARGE_DECLINED` afuera, **`SUSPENDED` vuelve a significar una sola cosa** —alguien que pagó
alguna vez y dejó de pagar, que es la política de retención del §20— y ahí bloquear **es lo
correcto**: su preapproval puede seguir vivo, y una segunda suscripción serían dos cobros. Sus
salidas no son el candado: son pagar (`S7`), que el proveedor la dé de baja y la espejemos (`B/12`
§1.4), que la cancele una persona (**`S23`**, §3.2) o que **se discontinúe la vertical entera**
(**`S27`**, §3.2) — **cuatro, y la cuarta no la decide ni el cliente ni el proveedor sino
`SUPER_ADMIN` sobre la cartera**.

> **Las tres primeras son ejecutables, y la tercera recién desde que tiene fila.** Hasta `S23` la baja de
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
> el estado que tenía, y sigue cubriendo a quien estaba cubierto (`B/02` §2.2) — **salvo la
> predecesora de una sucesión cuya sucesora ya está `ACTIVE`**: ésa deja de emitir fuente aunque
> su cancelación haya fallado y siga marcada (`12-contrato…` §2.6, rama posterior a la autorización;
> owner 2026-09-25).
>
> **Y la marca no es un booleano: es una fila con MOTIVO y con RELOJ** (`reconciliation_mark`,
> `B/02` §2.2 y §2.5). Este corpus escribe ~~**quince**~~ ~~**dieciséis**~~ ~~**diecinueve**~~ **veinte** marcas distintas sobre la misma casilla
> (el 16 desde `F-8CB1-013`; el 17, el 18 y el 19 desde `F-8CB3-009`, `DEC-SUB-020` y `F-8CB3-003`,
> FASE 8 completa, owner 2026-09-25; el 20, `COBRO_DUPLICADO`, desde la pendiente 6) y
> **~~seis~~ siete de ellas significan *«hay plata del cliente que devolver»***; sin el motivo llegaban
> todas iguales al listado accionable de `B/19` §6. `requiere_conciliación` pasa a nombrar el
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
| S1 | *(sin fila)* | la persona elige un plan | `PENDING_AUTHORIZATION` | no hay otro **origen** vivo para ese `user + vertical`, **o la fila declara una sucesión** (`sucede_a`). **Y si declara una sucesión sobre una predecesora `ACTIVE` de pagador con tarjeta, el preapproval de la predecesora se relee por id antes de aceptar el cambio y tiene que estar `authorized`**: si no lo está —p. ej. `paused` por una mora cuyo webhook no nos llegó—, **el cambio no se ofrece** (*«tu último cobro no entró, actualizá tu tarjeta»*, el camino de `DEC-SUB-021`; `B/19` §4 fila 17-ter) **y la relectura corre la transición que corresponda por la tabla del §10.1** —sobre `paused`, `S6` por su segundo evento— (FASE 8 completa, owner 2026-09-25). **Las otras dos predecesoras admitidas no pasan por esta relectura**: la `CANCEL_SCHEDULED` tiene el preapproval ya cancelado por `S11` o `S26`, y la `SUSPENDED` de tarjeta tiene su propia relectura, que exige `cancelled` (`G-R1-A`, `B/20` §2) | se acuña y **persiste** la clave de idempotencia **antes** de llamar al proveedor (`DEC-CONC-001`); si declara sucesión, **nace con fecha de primer cobro posterior al vencimiento de su ventana de autorización** (`B/12` §5.2). **Y si es de pagador manual, acá se abre su PRIMERA cuota** —la cláusula *(b)* de `MP5` (§7)—, que es el espejo del primer cobro que en un pagador con tarjeta ocurre antes de `S2`: tiene que estar registrada para que la fila llegue a `ACTIVE`, así que abrirla es parte del alta y no del reloj |
| S2 | `PENDING_AUTHORIZATION` | webhook de autorizada, confirmado por relectura | `ACTIVE` | — | arranca el período; la fila **pasa a emitir fuente** (`12-contrato…` §2.6) ~~y ese cambio de cobertura es lo que mueve el trial, si había uno (`V/03` §2, `T2`)~~ **con `cobrada: no`, así que todavía no mueve el trial: lo mueve el primer pago acreditado de la fila, que pasa `cobrada` a `sí` y lleva su propio aviso** (`12-contrato…` §2.1 y §3; `V/03` §2, `T2`; `DEC-TRIAL-010`, owner 2026-09-25) — esta tabla **no dispara** una transición de la otra épica **Y si la fila es un alta nueva de plan anual y su beneficiario tiene, en esa vertical, un saldo de cortesía diferido por `S25`, el saldo se CIERRA en el mismo acto** con `motivo_cierre = DESTINO_DE_PLAN_ANUAL` (`B/02` §2.4): sobre un anual no hay cortesía temporal, y la persona lo supo en el checkout (`B/19` §4 fila 13-quater) (FASE 8 completa, `F-8CB1-001`, owner 2026-09-25) |
| S3 | `PENDING_AUTHORIZATION` | vence la ventana | `ABANDONED` | **venció la ventana de autorización de esa fila, y no es una sola: son DOS plazos según el método de pago** — **72 h** para el pagador con tarjeta y **7 días corridos** para el pagador manual (`DEC-SUB-016`, §3.4 punto 1). La condición se lee **sobre el método de la fila**, nunca contra una cifra global. **Y, en un pagador con tarjeta, que la relectura del preapproval por id no lo vea `authorized`**: si lo ve, la persona autorizó mientras vencía el plazo y el webhook todavía no llegó, así que **`S3` no ocurre** y lo que corre es `S2`, por la tabla del §10.1. Nuestro reloj no decide solo sobre un estado que es del proveedor | se cancela el preapproval en el proveedor **con la regla de relectura de `S17`** —si la relectura ya lo ve `cancelled`, no se manda nada—, **y antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala; un pagador manual no tiene preapproval, y esta parte no le corre (`B/06` §7); la fila se conserva —**con su `sucede_a` puesto, si era una sucesora**, porque es el registro fiel y porque ningún predicado lo lee sin exigir que la fila esté viva—. **Y si la predecesora retenía un pago pendiente por `S19`, se reevalúa en el acto**: es la rama 2 de `B/12` §5.3 y el que hace que *«el tope es la ventana»* sea una condición y no una intención. **Y si la fila era de un pagador manual, su primera cuota —abierta acá y nunca registrada— se cierra en el mismo acto**, por la segunda cláusula de `MP3` (§7): sin eso quedaría un `AWAITING` colgando de una suscripción muerta. **Y si esta fila era la SUCESORA de una sucesión y la predecesora tenía una cortesía que `S18` DIFIRIÓ, el saldo se cierra acá**: se le escriben `saldo_cerrado_en` y `motivo_cierre = VENTANA_DE_AUTORIZACIÓN_VENCIDA` (`B/02` §2.4), con lo que la cortesía deja de ser *«diferida»* (`NUCLEO/01` §2.6) y **`S9` no la puede re-emitir nunca más** — quien vuelva a suscribirse **no recupera esos meses** (`DEC-GRANT-011`; el saldo es en meses desde la FASE 8 completa, `F-8CB1-001`). **Se le avisa en el mismo correo que le dice que la ventana venció** (`B/19` §4 fila 18, `NUCLEO/07` §6) |
| S4 | `ACTIVE` | un cobro falla — **y en un pagador manual eso es que `MP5` abrió la cuota del período y no hay pago acreditado contra ella** (§7.2): no hay débito que rebote, así que el evento se lee sobre la cuota y no sobre el proveedor. **Sobre la PRIMERA cuota de un pagador manual no corre**, y no hace falta una condición nueva para eso: esa cuota se abre en `PENDING_AUTHORIZATION` y el `desde` de esta fila es `ACTIVE` (§7.2, *«cómo entra el grace»*) | `GRACE_PERIOD` | ~~—~~ **la fila tiene al menos un pago acreditado** (`B/09` §4; en un pagador manual lo cumple toda fila `ACTIVE`, porque `S29` sólo llega ahí con la primera cuota registrada). **Sobre una autorización sin ningún pago acreditado manda `S16`**, no esta fila (abajo, *«el primer rechazo lo reclamaban tres filas»*; FASE 8 completa, `F-8CB2-006`, `F-8CB1-010`) | arranca el reloj del §4; el servicio **sigue entero** (§20) |
| S5 | `GRACE_PERIOD` | entra el pago, **o se reevalúa uno que quedó pendiente** por `S19` | `ACTIVE` | las cuatro condiciones del cap. 05 §3 — y la 3 incluye **que esta fila no sea la predecesora de una sucesión en curso** | se apaga el reloj. **Y cuando corre porque la relectura de `S6` mostró que el período cobró, asienta ese cobro en el mismo acto**: lo lee por id (`D17`) y corre `P1` sobre él (§6), **creando la fila de `payment` si no existe**; **si no puede asentarlo, `S5` no ocurre en esa corrida**. El aviso del cobro que llegue después lo descarta la deduplicación de `C6` (`B/05` §2), porque encuentra la fila ya `SUCCEEDED` (FASE 8 completa, pendiente 6, owner 2026-09-25) |
| S6 | `GRACE_PERIOD` — **o `ACTIVE`, sólo por el segundo ~~evento~~ o el tercer evento** — **o `PAUSED` con motivo `COURTESY`, sólo por el tercer evento**: la cortesía da servicio, así que un contracargo la corta (FASE 8 completa, pendiente 8, owner 2026-09-25). **La `PAUSED` con motivo `CUSTOMER_REQUEST` no entra**: sigue con sólo la marca (§6, `P6`) | se agota el reloj — **o se lee `paused` en el proveedor sin haberlo pedido nosotros**: el proveedor se rindió por mora, y nuestro grace también terminó (`DEC-MP-008`). El cliente no puede pausar desde el proveedor (`DEC-MAIL-001`), así que ese `paused` **es** mora; la fila puede estar todavía en `ACTIVE` si el webhook del cobro fallido se perdió — **o se lee `charged_back` en un pago acreditado de la fila, releído por id** (`D17`): **un contracargo**, que es el tercer evento y no pasa por el grace (`DEC-SUB-020`; FASE 8 completa, `F-8CB3-009`, owner 2026-09-25). Llega por el aviso de contracargo del proveedor o por la comprobación de pagos acreditados del barrido (`B/09` §3), y el pago pasa por `P6` (§6). **Sólo en un pagador con tarjeta**: un pagador manual no tiene un pago en el proveedor que el banco pueda revertir. Lo que el proveedor hace en un contracargo es **documental y no medido** (`RC-8`, `UNKNOWN`): esta fila fija qué hacemos al leer ese estado, no cómo se comporta él | `SUSPENDED` | **no hay un pago acreditado del período pendiente de resolución** por `S19` — **y, en un pagador con tarjeta, la relectura en el proveedor no muestra un cobro acreditado del período** (un pagador manual no tiene preapproval: su cobro es la cuota, y `MP2` ya lo resuelve un admin), hecha **con la lectura del `B/09` §4 y ninguna otra**. Si lo muestra, el webhook se perdió o llegó tarde: **`S6` no ocurre** y lo que corre es `S5`, con sus condiciones, **y `S5` asienta ese cobro en el mismo acto** (ver `S5`; FASE 8 completa, pendiente 6, owner 2026-09-25). **Si la lectura falla —o contesta *«todavía no se sabe»*, que es lo que el §4 del `B/09` devuelve cuando el inventario de intentos no está completo—, `S6` no ocurre en esta corrida** y se reintenta en la siguiente, como `S17` (`B/09` §3); **si en la corrida siguiente sigue sin saberse, se avisa** por el canal de `DEC-OBS-001`, sin abrir marca (`B/09` §6.2, owner 2026-09-24). **Y por cualquiera de los dos eventos, `S6` no ocurre mientras la fila sea la predecesora de una sucesión en curso** —una sucesora viva apuntándola— (owner, 2026-09-24): si la sucesión se consuma, `S17` la cancela como siempre, y si la sucesora muere, `S6` corre en la corrida siguiente; por el segundo evento, además, el preapproval pausado ya no cobra. ~~**Pero la protección dura una sola ventana**: si el reloj del grace ya venció mientras corría una sucesión, una sucesión declarada después **no lo vuelve a frenar**, y `S6` corre en la primera corrida (FASE 8 completa, `F-8CB1-005`; §4).~~ **La protección dura una sola ventana por construcción, y ya no hace falta un límite que lo diga**: la redeclaración que ese límite frenaba salía de una fila en `GRACE_PERIOD`, y desde `GRACE_PERIOD` ya no se declara una sucesión (`DEC-SUB-021`, owner 2026-09-25; `G-R1-A`). **Lo que sigue vigente** es la protección misma, para la sucesión declarada en `ACTIVE` cuya predecesora entra en el grace **durante** la ventana (`S4`, fila 11 del recorrido de abajo): `S6` no la suspende mientras la sucesión siga en curso, y si la sucesora muere, corre en la corrida siguiente — y como la fila ya está en `GRACE_PERIOD`, no hay una segunda sucesión que la vuelva a frenar (§4). ~~⚠️ **Por el segundo evento sobre una fila todavía `ACTIVE`** —el webhook del cobro fallido perdido— la fila **sí** admite una declaración nueva, y el límite tachado tampoco la alcanzaba: hablaba del reloj. Queda en *«lo que esta mitad NO cierra»*.~~ **Cerrado el 2026-09-25 (owner, FASE 8 completa)**: **por el segundo evento sobre una fila todavía `ACTIVE` la declaración nueva ya no se acepta**: `S1` relee por id el preapproval de una predecesora `ACTIVE` de tarjeta y exige `authorized`; sobre `paused` el cambio no se ofrece y la relectura corre este `S6` por su segundo evento (§3.2, `S1`). **Por el tercer evento no corren las guardas del impago** —*«¿cobró el período?»* y el pago retenido por `S19`—: el cobro existió y lo que se lee es que el banco lo revirtió, y `DEC-SUB-020` lo decidió *«en el acto, sin grace»*. ~~⚠️ **La guarda de la sucesión en curso está escrita para los dos primeros eventos y no para éste**: si un contracargo sobre la predecesora de una sucesión en curso espera o no, `DEC-SUB-020` no lo dice, y queda en *«lo que esta mitad NO cierra»*~~ **Cerrado el 2026-09-25 (owner)**: **por el tercer evento tampoco corre la guarda de la sucesión en curso**: si la fila es la predecesora de una sucesión en curso, **`S6` ocurre igual** —un contracargo es una disputa, no una mora que el cambio de plan resuelva— **y la sucesora también se corta** (`DEC-SUB-020`, su 📌; FASE 8 completa, pendiente 6, owner 2026-09-25). ~~⚠️ **Con qué transición se corta la sucesora no está escrito**: ninguna de las que hoy salen de `PENDING_AUTHORIZATION` o de `ACTIVE` lo hace sin arrastrar efectos atados a su propio evento, y queda en *«lo que esta mitad NO cierra»*~~ **Cerrado el 2026-09-25 (owner)**: **la sucesora la corta `S31`** (§3.2), una transición propia (FASE 8 completa, pendiente 8, owner 2026-09-25) | §21: sin listado público, sin edición, sin creación, sin entitlements comerciales; datos conservados y billing accesible. **Y en un pagador con tarjeta, se cancela el preapproval en el proveedor en el mismo acto**, con la regla de relectura de `S17` (`DEC-SUB-019`): la suspensión corta **el cobro**, no sólo el servicio, así que ningún reintento del proveedor cobra después un mes entero sobre una fila suspendida. **Si la cancelación falla, `S6` no ocurre en esta corrida** y la fila sigue donde estaba — `GRACE_PERIOD`, o `ACTIVE` por el segundo evento, **o `PAUSED` por el tercero sobre una cortesía** (pendiente 8). **Desde `PAUSED` con motivo `COURTESY` la cancelación sí se puede**: el proveedor rechaza toda modificación sobre una pausada **y sí deja cancelar** (`EX-11`). **Y ahí la cortesía se cierra con la fila**: termina hoy, como en `S22`, y se escribe `fin_real` en la `subscription_pause` con ese día (`B/02` §2.2), por la misma razón que en `S22` (FASE 8 completa, pendiente 8, owner 2026-09-25). **Y antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): si falla de forma transitoria, **entra por esta misma puerta** —la cancelación no se ejecuta, `S6` no ocurre en esta corrida y se reintenta en la siguiente—; si no hay destinatario, se cancela igual y el no-entregable se escala. Volver es re-autorizar por el checkout: una sucesión, y `S17` encuentra el preapproval ya `cancelled` (`D7`). **Y por el tercer evento, además, `S14` abre la marca con motivo `CONTRACARGO`** (`B/02` §2.5) **con el pago colgado**, para que una persona siga la disputa (`DEC-SUB-020`); el aviso a la persona es el de `B/19` §4 fila 10-ter, no el de la 10, que habla de mora (FASE 8 completa, `F-8CB3-009`, owner 2026-09-25), **y su correo es el de *«suspendido por contracargo»*** del catálogo de `NUCLEO/07` §6 (FASE 8 completa, pendiente 6, owner 2026-09-25) |
| S7 | `SUSPENDED` | regulariza, **o se reevalúa un pago que quedó pendiente** por `S19` — **«regulariza» es la cuota del pagador manual (`MP4`)**; un pagador con tarjeta **no vuelve por acá**: `S6` le canceló el preapproval (`DEC-SUB-019`), así que vuelve por el checkout como **sucesora** (`S1` → `S2` → `S17`) —la sucesión que `G-R1-A` le admite a una `SUSPENDED` sólo si es de pagador con tarjeta y su preapproval se relee por id como `cancelled` (`B/20` §2; FASE 8 completa, `F-8CB1-002`, owner 2026-09-25)—, y `S7` sólo lo alcanzan los bordes —un cobro en vuelo en el instante de `S6`, un preapproval reactivado a mano— | `ACTIVE` — **o `CANCEL_SCHEDULED`** si el cobro entró sobre un preapproval que `S6` ya canceló (la relectura lo da `cancelled`): la persona **recibe el período que pagó**, con fin de servicio en el fin de ese período, y `S12` la termina; para seguir, vuelve por el checkout. Así el espejo no la cancela antes de tiempo, porque `cancelled` × `CANCEL_SCHEDULED` es el par esperado (§10.1) (owner, 2026-09-25; FASE 8 completa, `F-8CB1-003`, `F-8CB2-004`, `F-8CD1-004`) | el cobro entró de verdad **y** las cuatro condiciones del cap. 05 §3 — y la 3 incluye **que esta fila no sea la predecesora de una sucesión en curso** | ~~se restituye la publicación~~ la fila **vuelve a emitir fuente** (`12-contrato…` §2.6), y ese cambio de cobertura es lo que restituye la publicación **por `PB3`/`PB7`, si el cupo alcanza** —el cupo cuenta sólo las fichas en `PUBLISHED`— (`V/03` §9); esta tabla **no dispara** una transición de la otra épica, igual que `S2` y `S29` (FASE 8 completa, `F-8CA2-016`, owner 2026-09-25) |
| S8 | `ACTIVE` | la persona pide pausar | `PAUSED` *(motivo `CUSTOMER_REQUEST`)* | `puedePausar()` (capítulo 01 (núcleo) §3) | se pausa en el proveedor; se elige en **meses enteros** (`DEC-SUB-010`) |
| S9 | `ACTIVE` | **tres disparadores, un mismo acto**: `SUPER_ADMIN` otorga cortesía; **una sucesora recién autorizada tiene una cortesía DIFERIDA esperándola** — una `courtesy_grant` con `saldo_meses` no nulo cuyo `subscription_id` apunta a una fila cuyo `sucedida_por` es esta (`B/02` §2.4 y §2.6, `DEC-GRANT-007`)—; **o una fila recién autorizada que NO es sucesora de nadie tiene una cortesía diferida del MISMO beneficiario y la MISMA vertical, cuya suscripción murió por `S25`** (`DEC-GRANT-010`, `B/14` §4.6). **Los dos últimos difieren sólo en cómo se llega a esta fila** —por `sucedida_por` el segundo, por beneficiario + vertical el tercero, porque ahí no hubo sucesión que declarar— y hacen exactamente lo mismo | `PAUSED` *(motivo `COURTESY`)* | no hay pausa vigente (`DEC-GRANT-004`) — **y ni una sucesora recién autorizada ni un alta nueva tienen ninguna**, así que el segundo y el tercer disparador corren sin tocar la condición. **Y, por el primer disparador, la fila es de un plan MENSUAL y la cortesía se firma en MESES ENTEROS** (FASE 8 completa, `F-8CB1-001`, owner 2026-09-25; `DEC-GRANT-003` impl. 6): es la validación de la pausa de `DEC-SUB-010` —el término `billingOption.ciclo == mensual` de `puedePausar()`, `NUCLEO/01` §3—, porque en pausa el proveedor se saltea las fechas de cobro enteras que caen adentro (`PS-6`) y al reanudar no corre la fecha (`PS-5`): una cortesía vale los cobros que cruza, no los días, y N meses saltean exactamente N cobros. **Sobre una fila de plan anual `S9` no ocurre**, y el admin recibe el motivo: la cortesía temporal no está disponible ahí, y le quedan la cortesía permanente o una promo sobre la renovación. **En el segundo y el tercer disparador este término no se evalúa porque no hace falta**: un saldo que iba a caer sobre una fila de plan anual ya se cerró antes —en `S18` o en el `S2` del alta— con `motivo_cierre = DESTINO_DE_PLAN_ANUAL` (`B/02` §2.4, `B/14` §4.7; owner 2026-09-25) | se pausa en el proveedor y **el servicio se sostiene de nuestro lado** (`DEC-GRANT-003`). **Por el segundo disparador —y por el tercero, con la misma escritura— se re-emite la cortesía diferida**: `subscription_id` pasa a esta fila, `inicio` es hoy, `fin` es hoy + ~~`saldo_días`~~ `saldo_meses`, y **`saldo_meses` vuelve a nulo** (el saldo pasó a meses: FASE 8 completa, `F-8CB1-001`, owner 2026-09-25, `B/02` §2.4). Es la misma fila de `courtesy_grant`, entera, con la firma de `SUPER_ADMIN` original — no una cortesía nueva, así que el §35.4 sigue auditando **por grant**. **Riesgo aceptado y declarado por `DEC-GRANT-007`, y vale igual por el tercer disparador**: entre `S2` y este acto el proveedor **puede cobrar** el primer pago, y ese cobro se devuelve **por el camino que ya existe** —la marca con motivo `COBRO_DURANTE_CORTESÍA` y la confirmación de una persona, `B/02` §2.5 y `DEC-RF-002`—, sin inventar un mecanismo para evitarlo |
| S10 | `PAUSED` | llega el fin, o la persona vuelve antes | `ACTIVE` | **el plan al que la fila está anclada se sigue prestando** —es la guarda que la separa de `S25`, ver abajo— **y el `PUT` se aplicó, confirmado por relectura** — la misma regla que `S17` | `PUT status=authorized`; al reanudar se le muestra **una sola cosa: qué día se le cobra** (`DEC-SUB-010`) — **y en un pagador manual ese día lo fija esta misma transición**, porque no hay proveedor que lo corra: la fecha del próximo cobro (`B/02` §2.2) avanza **tantos ciclos como hayan vencido durante la pausa, sin abrir cuota**, que es el espejo local de `PS-6` y lo que esa misma decisión ya eligió para el pagador con tarjeta —*«se le cobra normal en el ciclo siguiente»*—. Sin eso el reloj le abriría al volver la cuota de un período que transcurrió adentro de la cortesía (§7.2, *«qué mueve la fecha del próximo cobro»*). **Si la relectura sigue viendo `paused`, `S10` NO ocurre**: la fila se queda en `PAUSED` y **se pone la marca `requiere_conciliación` con motivo `REANUDACIÓN_NO_APLICADA`** (`S14`, `B/02` §2.5), porque una reanudación que no se aplicó le corta el servicio y el cobro a la vez — ver abajo |
| S11 | `ACTIVE` | pide la baja | `CANCEL_SCHEDULED` | — | **se cancela en el proveedor de inmediato** y se guarda **nuestra** fecha de fin de servicio (`DEC-SUB-009`). **La fecha sale de los cobros acreditados, nunca de la fecha del próximo cobro** (FASE 8 completa, `F-8CB1-012`): **`fin_de_servicio = inicio(P) + un ciclo de la billing option anclada`**, donde **`P` es el `covered_period` más reciente de la fila con `liberado_en` nulo** (`B/02` §2.3) — el período que el último cobro acreditado pagó, **sea `payment` o `manual_payment`**. La copia de la fecha del próximo cobro **no entra**: sobre una fila con un cobro en reintento esa fecha ya corrió un ciclo sin pago (`RN-3`), y usarla regalaba ese ciclo. **Si un cobro anterior a la baja se acredita después** (`B/05` C2, primera fila), escribe su `covered_period` y la misma fórmula, recalculada, es la extensión que ese § manda. ~~⚠️ **Una fila sin ningún `covered_period`** —una sucesora que todavía no cobró, `B/12` §5.2— **no tiene entrada para la fórmula**: queda en *«lo que esta mitad NO cierra»*.~~ **Cerrado el 2026-09-25 (owner)**: **una fila sin ningún `covered_period`** —una sucesora que todavía no cobró, `B/12` §5.2— no tiene entrada para la fórmula, **y ahí el fin de servicio es en el acto, como en `S24`**: `fin_de_servicio` es el instante de la baja y el preapproval se cancela, como en toda `S11` (FASE 8 completa, pendiente 6, owner 2026-09-25). Como `CANCEL_SCHEDULED` emite fuente sólo hasta esa fecha (`12-contrato…` §2.6), el servicio se corta ahí mismo y `S12` encuentra su fecha ya cumplida. **Antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala |
| S12 | `CANCEL_SCHEDULED` | llega la fecha de fin de servicio — **o se lee `charged_back` en un pago acreditado de la fila, releído por id** (`D17`, `P6`): un contracargo sobre una `CANCEL_SCHEDULED` la pasa a `CANCELLED` **ya, sin esperar su fecha de fin** (`DEC-SUB-020`, su 📌; FASE 8 completa, pendiente 6, owner 2026-09-25) | `CANCELLED` | — | se corta el servicio; proceso **idempotente**. **Por el segundo evento, además, `S14` abre la marca con motivo `CONTRACARGO`** (`B/02` §2.5) con el pago colgado, y **al proveedor no se manda nada nuevo**: el preapproval ya lo canceló `S11` o `S26`, y si esa cancelación no se confirmó la sigue el reintento del `B/09` §3. ~~⚠️ **Si la fila es la predecesora de una sucesión en curso, este `S12` dispara `S18`** como por el primer evento, y la sucesión se consuma: el 📌 que corta también a la sucesora está escrito sobre `S6`, y si alcanza a este caso no está dicho (*«lo que esta mitad NO cierra»*)~~ **Cerrado el 2026-09-25 (owner)**: **si la fila es la predecesora de una sucesión en curso, por el segundo evento corre `S31` sobre su sucesora**, igual que tras `S6` por el tercero (FASE 8 completa, pendiente 8, owner 2026-09-25). `S31` encuentra a la sucesora por su `sucede_a`, que `S18` limpia, así que corre antes de que `S18` evalúe; si la deja `ABANDONED`, `S18` no corre —su `desde` es una sucesora viva— y la sucesión se cae, como en `S3`. **Y el aviso a la persona es el mismo correo de contracargo** (`NUCLEO/07` §6, `B/19` §4 fila 10-ter; orquestador, FASE 8 completa, pendiente 8) |
| S13 | **toda fila viva PRINCIPAL** del beneficiario en **cada vertical que el acto ancla** (`B/02` §2.4, `permanent_grant_vertical`) — los seis estados, `PENDING_AUTHORIZATION` y `CANCEL_SCHEDULED` incluidos. **Las de complemento no entran** (ver abajo, *«y no alcanza a los complementos»*) | `SUPER_ADMIN` **otorga** un *Free Forever*, **o le ancla una vertical nueva a un grant vivo** (`12-contrato…` §2.8, `NUCLEO/01` §2.4) | `CANCELLED` | — | §35.3: se cancela toda obligación de pago, **sin reembolso** (`DEC-GRANT-001`); **se cancela el preapproval de cada una** en el proveedor —autorizado o esperando autorización— con la misma regla de `S17`: si la relectura dice que ya está `cancelled`, no se manda nada; **y antes de cada llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): si falla de forma transitoria, esa cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala; el acceso pasa a darlo el grant. **Y si alguna de las filas alcanzadas retenía un pago pendiente por `S19`, la bandera se apaga en el mismo acto, sin reembolso** — es la rama 4 de `B/12` §5.3, y apagarla es parte de la decisión: dejarla puesta sobre una `CANCELLED` deja un *«pendiente»* que ningún barrido alcanza y que todo conteo de pagos pendientes cuenta de más. **Y si el beneficiario tiene una cortesía DIFERIDA en alguna de las verticales que el acto ancla, su saldo se CIERRA acá**: `saldo_cerrado_en` y `motivo_cierre = GRANT_PERMANENTE_OTORGADO` (`B/02` §2.4). No es una cortesía **vigente** —ésa termina porque esta misma transición cancela la suscripción que la pausaba (`B/14` §4.3)—: es un saldo esperando una fila que después de este acto **ninguna de las dos rutas de re-emisión de `S9` vuelve a alcanzar**, así que dejarlo abierto lo dejaría sin dueño y sin vencimiento. **Escribir un cierre ya escrito no escribe nada**, como el resto de la fila. **Proceso idempotente y reanudable fila por fila**, con su detector en `B/09` §3 (ver abajo, *«la ejecución parcial»*) |
| S14 | cualquiera | divergencia que toca plata o estado | **el mismo estado** | — | **se abre una marca `requiere_conciliación`** y se emite el §22.1: evento crítico, correo a `SUPER_ADMIN`, alerta en Admin, **cero decisiones destructivas automáticas**. **`S14` es el ACTO y no el motivo**: el motivo lo trae el caso que lo disparó —son ~~**siete** de los quince, siete de los dieciséis~~ ~~**diez** de los **diecinueve**~~ **once** de los **veinte** de `B/02` §2.5 (FASE 8 completa, `F-8CB1-013`; y el 17, el 18 y el 19 con `F-8CB3-009`, `DEC-SUB-020` y `F-8CB3-003`; y el 20 con la pendiente 6, owner 2026-09-25; recontados sobre esa tabla)— exactamente como el motivo de una pausa lo traen `S8` o `S9`. Una marca sin motivo declarado no es escribible: `G-R1-F` (`B/20` §2) la rechaza. **Y abrir es ACUMULATIVO**: si la fila ya tiene una marca abierta con ese motivo, `S14` **no abre una segunda y tampoco descarta el hecho** — le cuelga a la abierta el pago que el caso trae (`reconciliation_mark_payment`, `B/02` §2.2) y vuelve a emitir el §22.1. Sin eso el `UNIQUE` rechazaba el `INSERT` y **la plata del segundo cobro en adelante quedaba sin ninguna fila que la nombrara** |
| S15 | cualquiera **con una marca abierta** | una persona resuelve | **el mismo estado** | intervención humana registrada, **y ningún pago colgado de esa marca sin resolver** | **se levanta UNA marca —la del motivo que esa persona resolvió—, no la fila**: se le escriben `levantada_en` y quién la levantó (`B/02` §2.2), y **las demás marcas abiertas siguen abiertas**. Con un booleano, resolver una divergencia de monto apagaba en el mismo gesto un `REEMBOLSO_POR_CONFIRMAR` que nadie había mirado. **Y la guarda es la mitad que faltaba**: una marca puede llevar **N** pagos colgados (`B/02` §2.2) y levantarla con alguno sin `resuelto_en` cierra el caso **con esa plata adentro**, que es exactamente lo que hacía la persona que resolvía bien el único pago que el listado le nombraba. Si además corresponde un cambio de estado, se ejecuta **la transición de esta misma tabla que lo permita** |
| S16 | `ACTIVE` | el **primer** cobro se rechaza | `CHARGE_DECLINED` | **es el primer cobro DE ESA autorización** —**la fila no tiene ningún pago acreditado** (`B/09` §4), que es la guarda complementaria de la de `S4` (FASE 8 completa, `F-8CB2-006`)—, y el proveedor la canceló al rechazarlo | no hay servicio, no hay autorización y no hay vuelta: el reintento **es un alta nueva**. **Lo que se le dice a la persona sale de POR QUÉ la rechazaron** —el `status_detail` de ese único intento, con un mapa y un genérico obligatorio (`DEC-MP-004`, `B/19` §4 fila 19)—: al rechazado por el antifraude del proveedor no se le pide que revise una tarjeta que funciona — **salvo que la fila fuera la predecesora de una sucesión**, y ahí el reintento es **terminar el checkout que ya está abierto**: `S18` cierra la sucesión en el acto y la sucesora ocupa el candado `A` (§3.3.1) |
| S17 | la **predecesora**, si **sigue siendo fila viva** — las cinco alcanzables: `ACTIVE`, `GRACE_PERIOD`, `CANCEL_SCHEDULED`, `PAUSED`, `SUSPENDED` | su sucesora quedó **autorizada**, confirmado por relectura | `CANCELLED` | la fila tiene una **sucesora viva** con `sucede_a` apuntándola | **se cancela en el proveedor si su preapproval sigue vivo** (es `D7`); si la relectura dice que ya está `cancelled`, `D7` **ya está cumplido y no se manda nada**. **Y antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): si falla de forma transitoria, la cancelación no se ejecuta y **`S17` no ocurre en esta corrida** —la misma puerta que la llamada fallida (`B/09` §3)— y su condición, que es sobre un estado, se vuelve a evaluar; si no hay destinatario, se cancela igual y el no-entregable se escala: es el caso por el que se precisó la regla, porque sin eso la predecesora no se cancelaba nunca y **cobraban las dos** |
| S18 | la **sucesora viva**: en `ACTIVE`, **o en `PENDING_AUTHORIZATION` cuando la predecesora se murió sola**, **o en `CANCEL_SCHEDULED` cuando las dos cayeron en la misma discontinuación** (`S26` sobre la sucesora, `S27` sobre la predecesora) | la misma autorización que disparó `S2`; **o la predecesora dejó de ser fila viva sin `S17` — por `S12`, por `S16`, por el espejo de la baja decidida por el proveedor (§10.1), o porque pidió la baja ella misma estando pausada (`S22`), suspendida (`S23`) o en el grace (`S24`)**, **o porque se discontinuó su vertical estando suspendida (`S27`; FASE 8 completa, `F-8CB1-002`)**; o una resolución de `S15` sobre la sucesión trabada | **el mismo estado** | la predecesora **ya no es fila viva** | **cierra la sucesión, y es el único acto que lo hace.** Son **cinco** escrituras ~~y la tercera alcanza **dos** entidades~~: se escribe **`sucedida_por`** en la predecesora; se **limpia `sucede_a`** en la sucesora; **lo que colgaba de la predecesora y se puede re-apuntar se re-apunta a la SUCESORA** —los **complementos** (`B/16` §4.2) ~~y la **redención de promo** (`B/14` §2.2)~~, con el inventario completo en `B/02` §2.6—; **la redención de promo NO se re-apunta: la promo se pierde con el cambio de plan** y se queda colgando de la predecesora, sin que se escriba nada (`B/14` §2.2; FASE 8 completa, pendiente 7, owner 2026-09-25); **si la predecesora tiene una cortesía vigente, NO se re-apunta: se CIERRA sobre ella y se le escribe el `saldo_meses`** que le quedaba (la fracción de mes se redondea **para arriba**, `B/02` §2.4; **y si la sucesora es de plan anual, el saldo no se escribe: se CIERRA con `motivo_cierre = DESTINO_DE_PLAN_ANUAL`**, porque ahí no hay cortesía temporal, y la persona lo supo antes de elegir el plan, `B/19` §4 fila 13-quater (FASE 8 completa, `F-8CB1-001`, owner 2026-09-25)), para que `S9` la re-emita sobre la sucesora cuando ésta llegue a `ACTIVE` (`DEC-GRANT-007`, `B/14` §4.4); y **si la predecesora retiene un pago pendiente por `S19`, se le abre a ELLA una marca `requiere_conciliación` con motivo `REEMBOLSO_POR_CONFIRMAR`**, con **el pago colgado de ella** (`B/02` §2.2 y §2.5; ramas 1, 5 y 6 de `B/12` §5.3, `DEC-RF-002`). La sucesora pasa a ser el origen |
| S19 | la **predecesora** de una sucesión en curso, en `GRACE_PERIOD` o `SUSPENDED` | **entra el pago del período impago, por cualquiera de sus DOS puertas**: la cuota que el proveedor sigue reciclando —**en un pagador con tarjeta, sólo mientras la fila sigue en `GRACE_PERIOD`: `S6` cierra esa puerta al cancelar el preapproval al pasar a `SUSPENDED`**, `DEC-SUB-019`—, **o** el pago que el admin registra a mano (`MP1` **o `MP4`**, §7), **que es la puerta del pagador manual**: un pagador con tarjeta no tiene cuotas. **Una `SUSPENDED` de tarjeta no tiene, entonces, ninguna puerta ordinaria**: sólo los bordes de un cobro en vuelo en el instante de `S6` o de un preapproval reactivado a mano | **el mismo estado** | la fila tiene una **sucesora viva** con `sucede_a` apuntándola | **el pago se registra y queda pendiente de resolución** —sea un `payment` o un `manual_payment` (`B/02` §2.3)—: no reactiva, no se reembolsa todavía y **no pone la marca todavía** — es un caso diseñado y no una divergencia, así que `S14` no aplica; **la marca la abre `S18` al cerrar, con motivo `REEMBOLSO_POR_CONFIRMAR`, y sólo en las ramas 1, 5 y 6**. Su destino lo decide **cómo termina la sucesión**, con las **seis** ramas de `B/12` §5.3. Mientras esté pendiente, `S6` no corre |
| S20 | **toda fila viva DE COMPLEMENTO** del beneficiario —los **seis** estados de la suscripción, no los dos de la instancia— cuya instancia esté en uno de sus **dos** estados vivos y cuyo `addon_product` declare compatible **la vertical que el acto ancla**; para los scopes con vertical propia —`VERTICAL_SUBSCRIPTION` y `LISTING`— **además su objetivo tiene que ser de esa vertical** (`B/16` §3.4). **Las principales no entran**: ésas son de `S13` | el mismo acto que dispara `S13`: `SUPER_ADMIN` **otorga** un *Free Forever*, **o le ancla una vertical nueva a un grant vivo** (`12-contrato…` §2.8, `NUCLEO/01` §2.4) | `CANCELLED` | **el grant lleva `includesAddons: true`** — con `false` no corre y el complemento sigue cobrando | §35.2: el addon pasa a **costo $0**, y son **dos escrituras sobre dos entidades, EN ESTE ORDEN** (ver abajo, *«el orden de las dos escrituras de `S20`»*). **Primero la instancia**: no cambia de estado —si estaba `ACTIVE` sigue `ACTIVE`— y pasa a colgar del **ancla** como su título (`B/02` §2.4); si estaba `PENDING_AUTHORIZATION` no se convierte —no hay nada comprado— y muere por `A3` al vencer su ventana, con la pantalla de *«esperando que completes el pago»* dejando de ofrecer el enlace en el acto. **Después el cobro**: se cancela el preapproval en el proveedor —autorizado o esperando autorización— con la misma regla de `S17` (si la relectura dice que ya está `cancelled`, no se manda nada), **antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*: si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala), y la fila de complemento llega a `CANCELLED`. **Sin reembolso del período ya cobrado** (`DEC-GRANT-001`, igual que `S13`). **No lleva la mitad de `S19` que `S13` sí lleva**, y no por olvido: `S19` sale de *«la predecesora de una sucesión en curso»* y una fila de complemento **nunca es una**, así que esa bandera sobre un complemento es población vacía. **Reanudable fila por fila BAJO ese orden**, con su detector en `B/09` §3 — y **no por la razón de `S13`**, que supone una escritura por fila |
| S21 | **toda fila viva DE COMPLEMENTO** —los **seis** estados de la suscripción— **de la que cuelga una instancia de addon**. **Las principales no entran, y acá no hace falta acotarlo**: de una principal no cuelga ninguna instancia, así que el conjunto ya es disjunto por el sujeto y no por un adjetivo | **su instancia llega a `CANCELLED`**: por cualquiera de las **tres** cláusulas del evento de `A5` —se da de baja, **queda huérfana** (la condición de `B/16` §4.2, con sus **tres** mitades) o **se revoca el grant del que cuelga el ancla que era su título**— **y también por `A6`**, el borrado de la ficha (§8) | `CANCELLED` | **la instancia está en `CANCELLED`**. Es una condición **sobre un estado y no sobre una entrega**, así que **se vuelve a evaluar** —igual que el disparador de `S17` y `S18`—, y por eso una corrida que muere entre `A5` y esta fila no deja el caso perdido | **no se manda nada al proveedor, y ésa es la mitad que no hay que duplicar**: un addon recurrente tiene **un** preapproval y es el de esta fila (`DEC-ADDON-002`, `B/02` §2.4), así que la cancelación que `A5` y `A6` ya declaran —con la regla de relectura de `S17`— **es ésta misma**. Volver a escribirla acá serían dos llamadas por el mismo recurso. **Sin período de gracia y sin fecha de fin de servicio**: no se pasa por `CANCEL_SCHEDULED` (ver abajo, *«el complemento que sobrevive a su instancia»*). **Sin reembolso automático del período ya cobrado**; si corresponde devolver, entra por la vía del reembolso, que **confirma una persona** (`DEC-RF-002`) — **y quien trae el caso es esta misma fila**: cuando el último cobro de la suscripción de complemento paga un período que **todavía no terminó**, `S21` abre la marca `requiere_conciliación` con ese pago colgado. **Y el motivo que escribe es UNO DE DOS, porque desde `DEC-RF-006` la propuesta va en el motivo y no en una rama**: **`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN_O_DISCONTINUACIÓN`** (`B/02` §2.5, motivo **15**, propuesta **`DEVOLVER`**) cuando la instancia llegó a `CANCELLED` por la **tercera** cláusula de `A5` —la revocación del grant que era su título— **o por la SEGUNDA con el título muerto por la discontinuación de su vertical** —`S25`, `S27` o `S28`—; y **`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_OTRA_CAUSA`** (motivo **14**, propuesta **`NO DEVOLVER`**) en el resto. **Los dos no conviven** y por qué está en `B/02` §2.2 (ver abajo, *«cuál de los dos motivos abre `S21`»*). **Idempotente**: sobre una fila que ya está `CANCELLED` no escribe nada y no manda nada |
| S22 | `PAUSED` — **con cualquiera de los dos motivos** | pide la baja | `CANCELLED` | — | **es el mismo acto de `S11`, no uno nuevo**: el catálogo de `NUCLEO/08` §3 lo nombra una sola vez y `B/19` §5 lo deja self-service. Lo que cambia es el desenlace: **no pasa por `CANCEL_SCHEDULED` y termina el servicio en el acto** (`B/12` §7.2). `DEC-SUB-010` ya se llevó los días no usados del ciclo **al pausar**, así que **no queda período pagado que sostener**, y la fecha de fin de servicio —*«un dato nuestro»*, `DEC-SUB-009`— **es el día de la cancelación**. El §3.3 ya lo imponía: de `PAUSED` no sale nada que no sea `ACTIVE` o `CANCELLED` (salvo `S6` por un contracargo sobre una cortesía, que va a `SUSPENDED`: pendiente 8, owner 2026-09-25). **Se cancela en el proveedor de inmediato**, con la regla de relectura de `S17` — está medido que sobre una pausada el proveedor **rechaza toda modificación y sí deja cancelar** (`EX-11`). **Antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala. **Se escribe `fin_real` en la `subscription_pause`** (`B/02` §2.2) con ese mismo día: los topes del §26.3 **sobreviven a cancelar y volver a suscribirse** (`DEC-SUB-004`), así que una pausa que se corta sin registrar su fin real le come al cliente meses que no usó. **Y si el motivo era `COURTESY` la cortesía termina con ella**: esa fila **sí emite fuente** (`12-contrato…` §2.6) y deja de emitirla hoy, así que la confirmación lo dice antes (`B/19` §4, fila 8). **Idempotente**, como `S12` |
| S23 | `SUSPENDED` | pide la baja — **la pide el cliente o la ejecuta un admin**: es la tercera salida que el §3.1 enumera | `CANCELLED` | — | el mismo acto otra vez, y acá **no hay servicio ni cobertura que retirar**: el §21 ya cortó el servicio y `SUSPENDED` **no emite ninguna fuente** (`12-contrato…` §2.6), así que tampoco hay período pagado que sostener y la fecha de fin de servicio **es el día de la cancelación**. **En el proveedor: si el preapproval sigue vivo se cancela**, con la regla de relectura de `S17` y **con nuestro correo antes de la llamada** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*: si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala); **sobre un pagador manual no hay nada que mandar**, porque no hay débito que detener (`B/06` §7). **Libera el candado `A`** (`B/02` §2.2), y ésa es la mitad que el §7.1 necesitaba: desde `CANCELLED` la condición 1 del `B/05` §3 rechaza la reapertura, así que este acto **cierra la ventana de `MP4`** y de paso le devuelve a la persona el alta nueva que el candado le bloqueaba. **Idempotente**, como `S12` |
| S24 | `GRACE_PERIOD` | pide la baja | `CANCELLED` | — | **el mismo acto de nuevo**, y su desenlace lo fija `DEC-SUB-014`: **corta en el acto**, con la fecha de fin de servicio en **el día de la cancelación** y **sin pasar por `CANCEL_SCHEDULED`**, por la misma razón que `S22` y `S23`. Acá esa razón es la más literal de las cuatro: **el grace existe porque el cobro del período en curso falló**, así que no hay período pagado que sostener — el último que se pagó ya se consumió, que es precisamente por lo que la fila está en este estado. **Y es la única de las tres bajas directas que corta servicio de verdad**: `GRACE_PERIOD` **sí emite fuente** (`12-contrato…` §2.6, *«el §20 da servicio entero»*), a diferencia de `PAUSED` por `CUSTOMER_REQUEST` y de `SUSPENDED`, así que la pantalla lo dice antes de confirmar (`B/19` §4, fila 8). **Se cancela en el proveedor de inmediato**, con la regla de relectura de `S17` y **con nuestro correo antes de la llamada** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*: si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala); **sobre un pagador manual no se manda nada**, como en `S23`, porque no hay débito que detener (`B/06` §7). **Apaga el reloj del §4**: sin esta fila el intento caía en la regla 1 del núcleo —marca con motivo `TRANSICIÓN_NO_DECLARADA`— mientras el reloj del grace seguía corriendo hacia `SUSPENDED` con una persona mirando el caso. **Y si la fila es la predecesora de una sucesión en curso, dispara `S18`**, igual que `S23`: `S19` retiene pagos desde `GRACE_PERIOD` y desde `SUSPENDED`, así que es la **misma** rama 6 de `B/12` §5.3 y no una séptima. **Idempotente**, como `S12` |
| S25 | `PAUSED` — **con cualquiera de los dos motivos** | **el mismo evento de `S10`**: llega el fin de la pausa, o la persona vuelve antes | `CANCELLED` | **el plan al que la fila está anclada ya NO se presta** — su vertical fue discontinuada (`B/10` §4.3) — **y es la guarda complementaria de la de `S10`**, no una condición aparte: las dos leen el mismo dato y no se pueden satisfacer a la vez | **`S10` no puede reanudar sobre un plan que no existe**, y ésta es la fila que ejecuta ese final (`DEC-SUB-015`). **No se manda `PUT status=authorized`**: se **cancela** el preapproval, con la regla de relectura de `S17` —`EX-11` mide que una pausada rechaza toda modificación **y sí deja cancelar**—, y por eso el preapproval no se cancela el día 0 del anuncio sino acá: mientras está pausada **no cobra** (`PS-2`), así que dejarla viva no cuesta plata. **Antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala. **Se escribe `fin_real` en la `subscription_pause`** con ese día, igual que `S22` y por la misma razón: los topes del §26.3 sobreviven a cancelar y volver a suscribirse (`DEC-SUB-004`). **Y corre igual si la persona no vuelve nunca**: el tope de la pausa es nuestro reloj (`PS-4`), así que el evento llega solo. **Libera el candado `A`**, con lo que el alta nueva entra por `S1` si en esa vertical queda algo que comprar. **Y si el motivo era `COURTESY` con ~~días~~ cortesía sin entregar, la cortesía NO se pierde: se DIFIERE** —se le escribe el `saldo_meses` (en meses desde la FASE 8 completa, `F-8CB1-001`; la fracción de mes se redondea **para arriba**, `B/02` §2.4 (FASE 8 completa, `F-8CB1-001`, owner 2026-09-25)) y `S9` la re-emite sobre la fila nueva cuando llegue a `ACTIVE`— por el mismo mecanismo de `DEC-GRANT-007` (`DEC-GRANT-010`, `B/14` §4.6). **Y si al sacar al título de las filas vivas deja huérfano un complemento con un período cobrado sin terminar, la marca que `S21` abre lleva el motivo 15 —el que propone `DEVOLVER`**: su guarda **es** la discontinuación —*«el plan ya no se presta»*—, así que la causa se escribe acá y nadie tiene que trazarla hacia atrás (`DEC-RF-006`; ver abajo, *«cuál de los dos motivos abre `S21`»*). **Idempotente**, como `S12` |
| S26 | **toda fila viva de la vertical —PRINCIPAL y DE COMPLEMENTO— en `ACTIVE` o `GRACE_PERIOD`**; la `PAUSED` **no entra** (`DEC-SUB-015`, §3.3) | `SUPER_ADMIN` **discontinúa la vertical** (`B/10` §4.3) | `CANCEL_SCHEDULED` | — | **se cancela el preapproval en el proveedor de inmediato**, con la regla de relectura de `S17` — es el día 0 del §4.3, y a partir de ahí *«el proveedor no emite un cobro más en la vertical»*—, **con nuestro correo antes de cada llamada** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*: si falla de forma transitoria, esa cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala); **sobre un pagador manual no se manda nada**, porque no hay débito que detener (`B/06` §7). **La fecha de fin de servicio NO es la de `DEC-SUB-009` fila por fila: es UNA sola para toda la vertical**, la fórmula del `B/10` §4.3 —`max(día 60 desde el anuncio, el último día ya pagado por cualquier compromiso vivo)`—, y es lo único que separa este acto de `S11`: allá la fecha sale del período de esa persona. El servicio **sigue entero** hasta ese día, porque `CANCEL_SCHEDULED` **sí emite fuente** (`12-contrato…` §2.6), y `S12` lo consuma. **Y el grace deja de correr hacia `SUSPENDED` sin ninguna cláusula nueva**: `S6` sale de `GRACE_PERIOD` y esta fila ya sacó a la suscripción de ahí, que es exactamente lo que el borde 3 del `B/10` §4.5 promete —*«lo que no pasa es que el reloj del grace la empuje a `SUSPENDED` por efecto de la discontinuación»*—. Lo adeudado **sigue su camino normal**: `S5` entra a esta fila desde `GRACE_PERIOD` y ya no puede, así que el pago que llegue se resuelve como el de cualquier `CANCEL_SCHEDULED`. **Idempotente**, como `S12` |
| S27 | **toda fila viva de la vertical —de las dos clases— en `SUSPENDED`** | **el mismo evento de `S26`** | `CANCELLED` | — | **acá no hay servicio ni cobertura que retirar, y por eso no pasa por `CANCEL_SCHEDULED`**: el §21 ya cortó el servicio y `SUSPENDED` **no emite ninguna fuente** (`12-contrato…` §2.6), así que mandarla al piso le **devolvería** hasta 60 días de servicio **gratis** a quien dejó de pagar — el piso del `B/10` §4.4 existe porque *«perder el servicio entero es estrictamente peor que un aumento»*, y acá no hay ninguno que perder. **Es la misma forma de `S23` y por la misma razón**, con la fecha de fin de servicio **en el día del anuncio**. **Se cancela el preapproval si seguía vivo**, con la regla de relectura de `S17` y **con nuestro correo antes de la llamada** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*: si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala); **sobre un pagador manual no se manda nada**. **Libera el candado `A`** y **cierra la ventana de `MP4`**, igual que `S23` — y acá eso no le quita nada, porque lo que la reapertura devolvería es un servicio que la vertical deja de prestar. La deuda por servicio **ya prestado** sigue su camino: no se perdona ni se persigue más fuerte (`B/10` §4.5, bordes 2 y 3). **Y si deja huérfano un complemento con un período cobrado sin terminar, la marca que `S21` abre lleva el motivo 15 —el que propone `DEVOLVER`**: esta fila **es** el acto del día 0 recorriendo las suyas, así que deja la causa al pasar y nadie la traza hacia atrás (`DEC-RF-006`; ver abajo, *«cuál de los dos motivos abre `S21`»*). **Es donde más importa**: acá la principal no recibe el piso de **60 días**, así que esa propuesta es lo único que la persona tiene delante. **Idempotente**, como `S12` |
| S28 | **toda fila viva de la vertical —de las dos clases— en `PENDING_AUTHORIZATION`** | **el mismo evento de `S26`** | `ABANDONED` | — | **el alta no se puede completar**: el día 0 la vertical *«deja de admitir altas»* (`B/10` §4.3), y terminar ese checkout sería un alta nueva sobre una vertical cerrada. **Tampoco pasa por `CANCEL_SCHEDULED`**, por la razón de `S27` llevada al extremo: `PENDING_AUTHORIZATION` **no emite fuente** y el contrato ya descartó emitirla llamándola *«la respuesta cara»* por lo que dure la ventana de `S3` —**72 h o 7 días corridos**, según el método de pago (§3.4 punto 1)— (`12-contrato…` §2.6) — por 60 días y sin que nadie haya autorizado ni pagado, no se discute. **Se cancela el preapproval en el proveedor**, por lo mismo que lo cancela `S3`: sin eso queda una autorización viva que puede cobrar. **Y como en `S3`, antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala. **Y si la fila era de un pagador manual, su primera cuota se cierra en el mismo acto**, por la segunda cláusula de `MP3` (§7), igual que en `S3`. ~~**Y si era una sucesora, su predecesora está en `CANCEL_SCHEDULED` por `S26`**, así que la sucesión la cierra `S18` cuando `S12` la consuma — no hace falta ningún evento nuevo.~~ **Y si era una sucesora, la sucesión no se cierra: se cae, como en `S3`.** La sucesora queda `ABANDONED` con su `sucede_a` puesto, que es el registro fiel, y ningún predicado lo lee sin exigir que la fila esté viva; `S18` no corre, porque su `desde` es una sucesora viva. La predecesora sigue su propio camino —`CANCEL_SCHEDULED` por `S26`, o `CANCELLED` por `S27` si estaba suspendida— (corregido en la FASE 8 completa: el texto anterior hacía correr `S18` sobre una sucesora ya muerta). **Y si la predecesora retenía un pago pendiente por `S19`, se reevalúa en el acto**, igual que en `S3` y por la **misma rama 2** de `B/12` §5.3 — con la precisión que ese § escribe: la predecesora está en `CANCEL_SCHEDULED` por `S26`, así que el pago **le queda** en vez de reactivar. **Lo que NO hace es cerrar un saldo de cortesía**: ver abajo. **Y si deja huérfano un complemento con un período cobrado sin terminar, la marca que `S21` abre lleva el motivo 15 —el que propone `DEVOLVER`**, por lo mismo que `S27` y con la misma razón para que importe: esta fila **es** el acto del día 0, y la principal tampoco pasa por el piso de **60 días** (`DEC-RF-006`; ver abajo, *«cuál de los dos motivos abre `S21`»*). **Idempotente**, como `S12` |
| **S29** ✚ | `PENDING_AUTHORIZATION` | **se registra la PRIMERA cuota de un pagador manual** — el acto es `MP1` (§7) | `ACTIVE` | la cuota que se registra es la **primera** de esta fila. Si no lo es, `MP1` sigue su camino normal y esta transición **no corre** | **Es la puerta a `ACTIVE` de un pagador manual, y existe porque `S2` no le sirve**: el evento de `S2` es *«webhook de autorizada, **confirmado por relectura**»* y acá **no hay preapproval que releer** — el pagador manual nunca pasó por el proveedor. **Cumple por construcción la condición que el §7.2 ató por adelantado** —*«esa fila no puede llegar a `ACTIVE` sin la primera cuota registrada»*— porque su evento **es** ese registro. **Hereda de `S2` los tres efectos del alta**: arranca el período, la fila **pasa a emitir fuente** (`12-contrato…` §2.6) —**ya con `cobrada: sí`**, porque su evento es el registro de la primera cuota (`DEC-TRIAL-010`); a diferencia de `S2`, acá no hay cobro que esperar—, y ese cambio de cobertura es lo que mueve el trial si había uno (`V/03` §2, `T2`) — esta tabla **no dispara** la transición de la otra épica. ⚠️ **Lo que NO hace, y hay que decirlo porque es un doble avance**: **no mueve la fecha del próximo cobro.** Eso ya lo hace `MP1` —*«avanza un ciclo la fecha del próximo cobro»*— y el acto es **uno solo**: si esta fila lo repitiera, el pagador manual arrancaría con **dos ciclos** de crédito. **Tampoco cierra ningún grace, porque no lo hubo**: `MP5`(b) abre la primera cuota en `PENDING_AUTHORIZATION` y **no dispara `S4`** (§7.2, *«cómo entra el grace»*), así que no hay reloj que apagar. **Y `G-R4` no gana ningún par duplicado**: comparte el `desde` con `S2` y con `S3`, pero *«compartir el `desde` no es compartir el par»* (`NUCLEO/03` §1 regla 7) — **ninguna otra fila de esta tabla declara este evento**, y no puede satisfacerse a la vez que `S2`, porque una fila de pagador manual **no tiene preapproval que emita ese webhook**. **El que cuenta es el pago acreditado y nunca la fecha** (§4.5 punto 2) |
| **S30** ✚ | `ACTIVE` | `P1` deja en 0 el `cobros_restantes` de la redención de promo que cuelga de la fila | el mismo estado | — | **se muta `transaction_amount` ~~al precio completo~~ al monto sin esa promo, recalculado con las que siguen vivas** —el monto esperado de `B/14` §2.4: precio de la versión de plan —**el vigente de la versión, con los aumentos de `DEC-MP-002` ya aplicados** (orquestador, FASE 8 completa, pendiente 8)— menos las promos vivas según su contador, con la regla de orden del §1.2— (`PC-1`) y se verifica releyendo (`D5`), porque la mutación no emite webhook (`EX-15`). **Si la mutación no se aplica, la retoma el barrido**: reintenta 3 días, contados desde esta transición, y después abre la marca con motivo `DIVERGENCIA_DE_MONTO` (`B/09` §3). **Y si el contador llega a 0 con la fila ya `PAUSED`**, esta fila no ocurre —su `desde` es `ACTIVE`— y la mutación tampoco se podría aplicar: sobre una pausada el proveedor rechaza toda modificación (`EX-11`). **Se acepta que ese mes salga con descuento: se declara, no se encola nada** (FASE 8 completa, pendiente 7, owner 2026-09-25). **Y el barrido no compara el monto de una fila `PAUSED`**; al reanudar, **`S10` es la transición desde la que corren los 3 días** del reintento (`B/09` §3; orquestador, FASE 8 completa, pendiente 8). Nuestro correo no bloquea: no es una cancelación (`DEC-MAIL-001` punto 1); el del proveedor (`CT-3`) ya se anticipó al canjear (punto 2, `B/19` §4 fila 7-bis) **y otra vez antes del último cobro con descuento, con *«tu promo termina»***, **7 días antes por default y configurable** (`NUCLEO/07` §6; pendiente 7; el plazo, pendiente 8, owner 2026-09-25). Lo que queda abierto está en `B/14` §2.4 y en *«lo que este capítulo NO cierra»* de `B/14` (corrección de diseño, FASE 8 completa, `F-8CB1-007`) |
| **S31** ✚ | la **sucesora viva** de una sucesión en curso —con `sucede_a` apuntando a la predecesora que un contracargo acaba de cortar—: en `PENDING_AUTHORIZATION`, **o en `ACTIVE`** si ya autorizó y `S17` todavía no se confirmó | **su predecesora se corta por un contracargo**: `S6` por su tercer evento, **o `S12` por su segundo** —la predecesora estaba en `CANCEL_SCHEDULED`— | **`ABANDONED`** desde `PENDING_AUTHORIZATION`; ~~**`SUSPENDED`** desde `ACTIVE`~~ **`CANCELLED`** desde `ACTIVE` (FASE 8 completa, owner 2026-09-25) | — | **Es la transición que el 📌 de `DEC-SUB-020` pedía y ninguna fila hacía** (FASE 8 completa, pendiente 8, owner 2026-09-25): un contracargo es una disputa, no una mora que el cambio de plan resuelva, así que **la sucesora también se corta**. **Por los dos destinos la sucesora deja de ser fila viva y la sucesión se cae como en `S3`, sin `S18`** (FASE 8 completa, owner 2026-09-25) —desde `ACTIVE` iba a `SUSPENDED`, que es fila viva, y la sucesión quedaba en curso sin nadie que la cerrara—. **La persona vuelve por la predecesora**: si quedó `SUSPENDED` por `S6`, por una sucesión desde `SUSPENDED` de tarjeta (`G-R1-A`, `B/20` §2). **Se cancela su preapproval en el proveedor con la regla de relectura de `S17`** —si la relectura ya lo ve `cancelled`, no se manda nada—, **y antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; ver abajo, *«el correo antes de cancelar»*): **si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y la reintenta el barrido** —`S31` llega a su destino pase lo que pase con la llamada, y es una de las filas de la salvedad 4 de `B/09` §3 (FASE 8 completa, owner 2026-09-25)—; si no hay destinatario, se cancela igual y el no-entregable se escala; un pagador manual no tiene preapproval, y esta parte no le corre (`B/06` §7). **Y si la sucesora era de un pagador manual en `PENDING_AUTHORIZATION`, su primera cuota —abierta en `S1` y nunca registrada— se cierra en el mismo acto** por la segunda cláusula de `MP3` (§7), como en `S3`. **Y si hay un saldo de cortesía diferido esperando a esta sucesora** (`NUCLEO/01` §2.6), **se cierra acá**: `saldo_cerrado_en` y `motivo_cierre = CONTRACARGO_DE_LA_PREDECESORA` (`B/02` §2.4) — ninguno de los tres valores que ya había describe este desenlace. **Y si la predecesora retenía un pago pendiente por `S19`, se reevalúa en el acto por la rama 2 de `B/12` §5.3**, como en `S3`. **No es `S3` ni `S28`**, aunque comparta con ellas el destino desde `PENDING_AUTHORIZATION`: `S3` avisa *«venció tu plazo»* y cierra el saldo con `VENTANA_DE_AUTORIZACIÓN_VENCIDA`, y `S28` es el acto de la discontinuación; acá no venció nada ni se cerró ninguna vertical. ⚠️ **Lo que esta fila deja abierto** está en *«lo que esta mitad NO cierra»*: ~~quién reintenta si la cancelación o el correo fallan de forma transitoria,~~ qué aviso recibe la persona por la sucesora~~, y **quién cierra la sucesión cuando la sucesora queda `SUSPENDED`**~~ (los otros dos, cerrados: FASE 8 completa, owner 2026-09-25) |

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

#### El primer rechazo lo reclamaban tres filas: manda `S16`, y el orden de llegada ya no decide

(FASE 8 completa, `F-8CB2-006`, `F-8CB1-010`.) Sobre un primer cobro rechazado **aplicaban tres
cosas a la vez**: `S4` —*«un cobro falla»*, sin condición—, `S16` —*«el primer cobro se rechaza»*— y
el espejo de la baja del proveedor (§10.1), si el aviso de la cancelación se procesaba antes que el
del pago. Según cuál llegara primero, la fila terminaba en `GRACE_PERIOD` —**los diez días gratis por
intento** que `B/12` §4.3 cerró—, en `CHARGE_DECLINED` o en `CANCELLED`, y en este último caso el
correo de `DEC-MP-004`, que distingue el antifraude de la tarjeta, no salía.

> **Sobre una autorización sin ningún pago acreditado manda `S16`** (`B/12` §4.4: *«es un alta que
> no ocurrió»*). **`S4` exige que la fila tenga al menos un pago acreditado**, y **el espejo de un
> `cancelled` sobre una fila `ACTIVE` sin ningún pago acreditado le cede el paso a `S16`** (§10.1).

**Las guardas de `S4` y `S16` son complementarias por un booleano** —*«la fila tiene al menos un
pago acreditado»*—, que es la forma que la regla 7 del núcleo exige (`NUCLEO/03` §1), y es el
mismo dato que el contrato transporta como `cobrada` (`12-contrato…` §2.1). **Y el trial no se entera del rechazo**: la fila nunca llegó a `cobrada: sí`, así que
tampoco lo había convertido (`12-contrato…` §2.1; `DEC-TRIAL-010`), y quien estaba en su trial
sigue ahí.

**Lo que esto no toca**: la fila 11 de la tabla de la predecesora (abajo), `S4` durante una
sucesión en curso, sigue valiendo para una predecesora que ya cobró; una que no cobró nunca —el alta
que cambió de plan el mismo día, `B/12` §4.4 punto 1— cae ahora en la fila 6, `S16`.

> ⚠️ **Lo que esto NO cierra, declarado por `DEC-METH-015`**:
>
> 1. **`G-R4` no cuenta a `S4`/`S16` como un par**, porque sus eventos están escritos distinto
>    —*«un cobro falla»* y *«el primer cobro se rechaza»*—, aunque el segundo sea un caso del
>    primero. La disyunción la sostienen las guardas escritas, no el guard; los cuatro pares que
>    `NUCLEO/03` §1 enumera no se mueven.
> 2. **Un primer rechazo sin cancelación del proveedor no lo toma ninguna fila** (`F-8CB1-010`).
>    Que el proveedor cancela al rechazar el primer cobro está medido sólo con rechazos del
>    antifraude (`B/12` §4.4). Si con otro motivo —fondos, por ejemplo— reintenta en vez de
>    cancelar, `S16` no se cumple y `S4` ya no corre: la fila **sigue `ACTIVE` sin cobrar** mientras
>    el proveedor reintenta. Si un reintento cobra, es un alta normal; si el proveedor termina
>    cancelando, el espejo le cede el paso a `S16`; si pausa, `S6` por su segundo evento, que la
>    deja en `SUSPENDED` sin haber pagado nunca. **Es servicio sin cobrar durante la ventana de
>    reintentos del proveedor —un ciclo (`GR-3`, `B/12` §1.5)—**, no un cobro indebido; antes de
>    este arreglo `S4` le daba en cambio el grace y `S6` la suspendía al agotarlo. **Este punto
>    NO es de borde**: si el supuesto no medido falla, alcanza a un alta con la tarjeta sin fondos,
>    y queda para el owner. Medir ese motivo es una fila de la matriz que este capítulo no escribe.

#### El correo antes de cancelar: una condición de toda fila que cancela en el proveedor

**Antes de toda cancelación que ejecutamos en el proveedor, nuestro correo tiene que salir**
(`DEC-MAIL-001` punto 1, precisado el 2026-09-25; FASE 8 completa, `F-8CB2-001`, `F-8CD1-006`).
Es el correo *«antes de cancelar»* del catálogo de `NUCLEO/07` §6, y tiene dos ramas:

- **si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta**
  — **y quién reintenta depende de la fila** (FASE 8 completa, `F-8CB1-013`, owner 2026-09-25):
  en las filas que llegan a su estado terminal *«pase lo que pase con la llamada»* —las ~~**once**~~
  **doce** de la salvedad 4 de `B/09` §3 (`S12`, `S3`, `S13`, `S20`, `S22`, `S23`, `S24`, `S25`, `S27`,
  `S28`, **`S31`** y la lápida; `S31` desde la FASE 8 completa, owner 2026-09-25) y, por la salvedad 1, la cancelación de `A5`/`A6` sobre la suscripción de
  complemento de `S21`— **reintenta el barrido** (`B/09` §3), con este mismo correo antes —**el
  que ya salió no se repite**: precisión 3, abajo— y la relectura después, **hasta 3 días después de la transición que decidió la cancelación**
  (tiempo, no corridas: owner 2026-09-25); recién ahí abre la marca con motivo `CANCELACIÓN_SIN_CONFIRMAR` (`B/02`
  §2.5) y avisa por `DEC-OBS-001`. **Abierta la marca, el barrido deja de reintentar**: el caso
  pasa a ser de una persona (owner 2026-09-25; FASE 8 completa, `F-8CB1-013`). En `S6` y `S17` la
  fila no llega a terminal y reintenta la propia transición (precisión 2, abajo). **En `S11` y
  `S26` la fila queda en `CANCEL_SCHEDULED`, viva**, ~~y el barrido la reintenta recién cuando
  `S12` la lleva a terminal: lo de antes está en *«lo que esta mitad NO cierra»*~~ **y entra en
  la misma regla de reintento, sin esperar a `S12`**: el barrido la reintenta ya en
  `CANCEL_SCHEDULED`, por el par `authorized`/`paused`/`pending` × `CANCEL_SCHEDULED` del §10.1
  (owner 2026-09-25; FASE 8 completa, `F-8CB1-013`);
- **si no hay destinatario** —rebote duro o cuenta borrada, que `NUCLEO/07` §4.2 suprime para
  siempre, incluso lo transaccional—, **el correo no bloquea**: se cancela igual, y el
  no-entregable se registra y se escala a una persona, como ya manda ese §. Sin esta rama, la
  predecesora de un cambio de plan de alguien con un rebote duro no se cancelaba nunca y
  **cobraban las dos**.

La regla vivía sólo en la decisión y ninguna transición la nombraba. Por eso la llevan escrita,
remitiendo acá, **las filas que cancelan en el proveedor**: `S3`, `S6`, `S11`, `S13`, `S17`,
`S20`, `S22`, `S23`, `S24`, `S25`, `S26`, `S27`, `S28` **y `S31`** (FASE 8 completa, pendiente 8,
owner 2026-09-25), y `A5` y `A6` del §8. ~~**`S31` no está en ninguno de los dos grupos de la rama
transitoria de arriba**: ni entre las once que reintenta el barrido ni entre las que reintentan su
propia transición; queda en *«lo que esta mitad NO cierra»*.~~ **`S31` está en el primero de los
dos grupos de la rama transitoria de arriba**: es una de las doce que reintenta el barrido (FASE 8
completa, owner 2026-09-25). **No la llevan las
que sólo espejan una cancelación que hizo el proveedor** —`S16` y el espejo del §10.1—, **ni
`S12`**, que no manda nada porque la llamada fue la de `S11`, **ni `S21`**, cuya llamada es la de
`A5` o `A6`.

~~Dos precisiones que salen de la tabla y no agregan política:~~ **Tres precisiones**: las dos
primeras salen de la tabla y no agregan política; la tercera la decidió el owner el 2026-09-25
(FASE 8 completa, `F-8CB1-013`):

1. **Bloquea la LLAMADA, no la relectura.** Las filas cancelan con la regla de relectura de
   `S17`: si la relectura ya ve el preapproval `cancelled` no se manda nada, y entonces no hay
   cancelación nuestra que el correo tenga que preceder. **Sobre un pagador manual tampoco**: no
   hay preapproval ni débito que detener (`B/06` §7), así que en `S3`, `S6`, `S23`, `S24`, `S27`,
   ~~y~~ `S28` **y `S31`** (pendiente 8) la condición corre sólo sobre el pagador con tarjeta.
2. **Donde la fila ya declara qué pasa si la cancelación no se ejecuta, el correo fallido entra
   por esa misma puerta**: en `S6` la fila no pasa a `SUSPENDED` en esta corrida y sigue donde
   estaba; en `S17` la predecesora no llega a `CANCELLED` en esta corrida (`B/09` §3: *«si falla,
   `S17` no ocurre»*) y su condición, que es sobre un estado, se vuelve a evaluar.
3. **El correo sale UNA vez por cancelación, antes del primer intento**, y los reintentos no lo
   repiten si ya se entregó. La ocurrencia de la clave de `NUCLEO/07` §2 es la de un correo de
   evento —*«el id del evento de dominio que lo causó»*—, y ese evento es **la transición que
   decidió la cancelación**, no la corrida que la reintenta: por eso un reintento no encola una
   fila nueva sino que **mira la que ya existe**. Si está `sent`, la llamada sale sin otro correo;
   si todavía no salió, es la rama transitoria de arriba y la llamada espera a esa misma fila. Sin
   esto la persona recibía hasta tres *«antes de cancelar»* por la misma baja.

#### El dominio, recorrido por el lado de la PREDECESORA

La versión anterior de este § recorrió el dominio sobre la sucesora —*«`sucede_a` nulo o no nulo,
no hay un tercer estado»*— y **puso la precondición sobre la predecesora**, que es el eje que no
recorrió. El tercer estado existía y era caro: `sucede_a` no nulo con la sucesión terminada y
nada que pudiera limpiarlo.

**Mientras la sucesora espera autorización —hasta que vence su ventana, §3.4 punto 1— la predecesora se sigue moviendo, y se
mueve sola.** Recorrí las salidas de los ~~tres~~ ~~**cuatro**~~ **tres** estados desde los que una fila **puede ser sucedida**
—`ACTIVE`, ~~`GRACE_PERIOD`,~~ `CANCEL_SCHEDULED` y **`SUSPENDED` de pagador con tarjeta con el
preapproval releído `cancelled`**, el conjunto que `G-R1-A` vigila (`B/20` §2; la `SUSPENDED`,
FASE 8 completa, `F-8CB1-002`, owner 2026-09-25; **`GRACE_PERIOD` salió del conjunto por
`DEC-SUB-021`**, owner 2026-09-25: desde el grace no se declara una sucesión, §3.3.1)— y son
~~**ocho**~~ ~~**diez**~~ **nueve** las transiciones de esta tabla que la sacan de ahí sin que nadie declare una sucesión
(recontadas con `DEC-SUB-021`: sale la 3 y la 8, entra la 11 — ver abajo, *«qué movió
`DEC-SUB-021`»*):

| # | desde | transición | hacia | ¿sigue siendo fila viva? |
|---|---|---|---|---|
| 1 | `ACTIVE` | `S8` — la persona pide pausar | `PAUSED` | **sí** |
| 2 | `ACTIVE` | `S9` — `SUPER_ADMIN` otorga cortesía | `PAUSED` | **sí** |
| ~~3~~ | ~~`GRACE_PERIOD` · `ACTIVE`~~ | ~~`S6` — se agota el reloj **o el proveedor pausó por mora** (`DEC-MP-008`), **salvo que haya un pago pendiente por `S19` o que la relectura en el proveedor muestre el cobro**. **Sólo saca del conjunto a una de pagador manual**: la de tarjeta llega a una `SUSPENDED` con el preapproval cancelado, que es el cuarto estado de declaración (`F-8CB1-002`)~~ **Ya no es una salida del conjunto** (`DEC-SUB-021`): desde `GRACE_PERIOD` sale de un estado alcanzable, no de uno de declaración; y desde `ACTIVE` —sus eventos segundo y tercero— sólo corre sobre un pagador con tarjeta y lo deja en una `SUSPENDED` con el preapproval cancelado, que está **adentro** | ~~`SUSPENDED`~~ | ~~**sí**~~ |
| 4 | `CANCEL_SCHEDULED` | `S12` — llega la fecha de fin de servicio | `CANCELLED` | **no** |
| 5 | cualquiera de los cinco | `S13` — *Free Forever* | `CANCELLED` | **no** |
| 6 | `ACTIVE` | `S16` — el primer cobro de esa autorización se rechaza | `CHARGE_DECLINED` | **no** |
| 7 | `ACTIVE` ~~· `GRACE_PERIOD`~~ | **el espejo de la baja decidida por el proveedor** (§10.1) — **ya no es la salida esperada del camino de mora**: desde `DEC-SUB-019` la corta `S6` antes; queda para la baja que igual llegue del proveedor (`B/12` §1.4). **Desde `GRACE_PERIOD` sigue ocurriendo**, pero ya como salida de un estado alcanzable y no de declaración (`DEC-SUB-021`) | `CANCELLED` | **no** |
| ~~8~~ | ~~`GRACE_PERIOD`~~ | ~~`S24` — **pide la baja en medio del grace** (`DEC-SUB-014`)~~ **Ya no es una salida del conjunto** (`DEC-SUB-021`): sale de `GRACE_PERIOD`, que es alcanzable y no de declaración — el mismo lugar que `S22` desde `PAUSED`. Sigue ocurriendo, y sigue disparando `S18` | ~~`CANCELLED`~~ | ~~**no**~~ |
| 9 | `SUSPENDED` *(tarjeta)* | `S23` — **pide la baja estando suspendida**, o la ejecuta un admin (FASE 8 completa, `F-8CB1-002`) | `CANCELLED` | **no** |
| 10 | `SUSPENDED` *(tarjeta)* | `S27` — `SUPER_ADMIN` **discontinúa la vertical** (`B/10` §4.3) (FASE 8 completa, `F-8CB1-002`) | `CANCELLED` | **no** |
| **11** ✚ | `ACTIVE` | `S4` — **un cobro falla** (§4): la predecesora entra en el grace **durante** la ventana. Con `GRACE_PERIOD` fuera del conjunto (`DEC-SUB-021`), es una salida | `GRACE_PERIOD` | **sí** |

**La séptima no tiene fila numerada en esta tabla, y no por eso deja de ser una transición de
ella**: el §10.1 declara que *«espejar un estado leído por id es una transición declarada de esta
tabla»*, y el par `cancelled` × *(cualquier estado vivo que no sea `CANCEL_SCHEDULED` ni
`SUSPENDED`)* manda espejar cuando no hay baja programada. Enumerar el dominio **sobre las filas numeradas** la deja
afuera, y es el error de método que costó una rama entera en `B/12` §5.3: la tabla numerada **no
es** la enumeración completa de esta tabla.

~~**La 3 y la 4 no necesitan que nadie toque un botón —las dos son relojes—**~~ **La 4 no necesita
que nadie toque un botón —es un reloj—, y la 11 tampoco**: llega con el cobro fallido de la
renovación o, en un pagador manual, con la cuota que `MP5` abre sin pago acreditado (`S4`, §7.2)
—la 3, el otro reloj, salió de la cuenta con `DEC-SUB-021`—, y la 6 llega con el
cobro real, que `PA-3` mide **entre 26 y 44 minutos** después de autorizar: en esa media hora un
cambio de plan es legal y la predecesora todavía está `ACTIVE`. **La 7 no la decide nadie de este
lado**: es una baja del proveedor. ~~`GR-3` *«sigue `UNKNOWN`»*~~ —`GR-3` está `VERIFIED` desde el
2026-09-22 y la ventana de reintentos dura un ciclo (`B/12` §1.5)—, pero por mora el proveedor
**pausa**, no da de baja, así que esta fila sólo llega por una cancelación desde su panel o un
preapproval tocado a mano, y **cuándo llega no se puede acotar**. ~~**La 8 es la única de las ocho que decide el propio cliente
sobre su propia fila**~~ ~~**La 8 y la 9 son las únicas de las diez que puede decidir el propio cliente
sobre su propia fila** —pide la baja en medio del grace (`DEC-SUB-014`), o estando suspendida (`S23`, que también
puede ejecutar un admin)—~~ **Entre las terminales, la 9 es la única que puede decidir el propio
cliente sobre su propia fila** —pide la baja estando suspendida (`S23`, que también puede ejecutar
un admin); la 8 (`S24`, la baja en medio del grace) lo era también y salió de la cuenta con
`DEC-SUB-021` sin dejar de ocurrir—, y por eso no cabe en
*«se mueve sola»*: lo que comparte con las otras terminales no es la causa sino el efecto.
~~**Las tres primeras siguen siendo filas vivas y son el dominio de
`S17`** —por eso su `desde` son cinco estados y no cuatro—; **las siete últimas ya no lo son, y ahí
`S17` simplemente no aplica: no hay nada que cancelar y no hay nada que matar.**~~
**Las tres filas vivas —la 1, la 2 y la 11— son el dominio de `S17`** junto con el conjunto de
declaración, y por eso su `desde` son **cinco** estados y no tres: los tres de declaración más
`PAUSED` (filas 1 y 2) y `GRACE_PERIOD` (fila 11); **las seis terminales —4, 5, 6, 7, 9 y 10— ya no
lo son, y ahí `S17` simplemente no aplica: no hay nada que cancelar y no hay nada que matar.**
(Recontado con `DEC-SUB-021`: eran tres vivas y siete terminales sobre diez.)

**Las salidas de `SUSPENDED`, recorridas contra la tabla** (FASE 8 completa, `F-8CB1-002`, owner
2026-09-25). Con la `SUSPENDED` de tarjeta como ~~cuarto~~ **tercer** estado de declaración
(tercero desde que `DEC-SUB-021` sacó a `GRACE_PERIOD`), sus salidas son
éstas, y sólo **dos** agregan una fila:

| transición | ¿agrega una fila? | por qué, según la tabla |
|---|---|---|
| `S7` | **no** | su condición exige que la fila **no** sea la predecesora de una sucesión en curso; mientras lo sea, el pago que entre queda retenido por `S19` y no la saca de ningún lado |
| `S13` | **no** | ya es la fila 5: su `desde` es *«toda fila viva PRINCIPAL»*, `SUSPENDED` incluida |
| `S14` · `S15` · `S19` | **no** | van a **el mismo estado** |
| `S17` | **no** | es la sucesión consumándose, no una salida sin ella |
| `S23` | **sí — fila 9** | `SUSPENDED` → `CANCELLED`, pedida por el cliente o ejecutada por un admin |
| `S27` | **sí — fila 10** | `SUSPENDED` → `CANCELLED`, por la discontinuación de la vertical |
| el espejo (§10.1) | **no** | `cancelled` × `SUSPENDED` es *«nada: es lo esperado»*; `authorized` × `SUSPENDED` es una marca —o el estado de `S19`— sin cambio de estado; `pending` × `SUSPENDED` es divergencia y marca; y `paused` × `SUSPENDED` no figura, así que también es marca. Ningún par la mueve |

**Y las ~~tres primeras~~ filas vivas tienen desde la FASE 9-bis-4 una SEGUNDA salida que no es `S17`, porque la
persona puede irse.** Una predecesora que quedó en `PAUSED` (filas 1 y 2) o en `SUSPENDED`
(fila 3, hasta que `DEC-SUB-021` la sacó de la cuenta) puede pedir la baja: `S22` y `S23` la mandan a `CANCELLED` **sin que la sucesora haya
autorizado**, o sea por el mismo camino de `S12`, `S16` y el espejo — se muere sola. Por eso las
dos están nombradas en el segundo evento de `S18`, que es lo que cierra la sucesión y evita que el
candado `A` quede vacío; y por eso `B/12` §5.3 tiene desde entonces una **sexta** rama, la de una
predecesora que pide la baja ella misma y además retenía un pago por `S19`. ~~**No entran como filas
9 y 10 de la tabla de arriba**: esa tabla recorre las salidas de los **tres** estados desde los
que una fila puede ser sucedida, y `PAUSED` y `SUSPENDED` no son ninguno de los tres — se llega a
ellos **por** esas filas.~~ **`S22` no entra en la tabla de arriba**: esa tabla recorre las salidas de
los estados desde los que una fila puede ser sucedida, y `PAUSED` no es ninguno — se llega a él
**por** esas filas. **`S23` sí entra desde la FASE 8 completa, como fila 9, pero sólo desde una
`SUSPENDED` de tarjeta**, que pasó a ser estado de declaración (`F-8CB1-002`); la `SUSPENDED` de
pagador manual a la que se llegaba por la fila 3 sigue sin serlo. Lo que cambia no es el dominio de la tabla sino que su columna de la
derecha —*«¿sigue siendo fila viva?»*— dejó de significar *«y de ahí sólo sale por `S17`»*.
**Y desde `DEC-SUB-021` la predecesora puede quedar también en `GRACE_PERIOD` (fila 11)**, y desde
ahí la baja es **`S24`**, que tampoco entra en la tabla, por la misma razón que `S22` (ver abajo).

~~**`S24` sí entra, y la diferencia con sus dos hermanas es de dominio y no de criterio**:
`GRACE_PERIOD` **es** uno de los estados desde los que una fila puede ser sucedida, así que
la baja que sale de ahí es una salida de esta tabla y se cuenta como la octava. Es la misma
razón por la que `S22` no se cuenta y `S23` se cuenta sólo desde la
`SUSPENDED` de tarjeta, leída al derecho.~~
**Qué movió `DEC-SUB-021`** (owner 2026-09-25). **`S24` entraba** porque `GRACE_PERIOD` **era** uno
de los estados desde los que una fila puede ser sucedida, **y ya no entra por la misma razón de
dominio**: desde el grace no se declara una sucesión (§3.3.1), así que `GRACE_PERIOD` pasó a ser lo
que `PAUSED` ya era —un estado al que la predecesora **llega** durante la ventana, por la fila 11—, y
su baja queda donde está `S22`. **La 3 sale por lo mismo** desde `GRACE_PERIOD`, y desde `ACTIVE`
no sacaba a nadie del conjunto: sus eventos segundo y tercero son de pagador con tarjeta y la dejan
en una `SUSPENDED` con el preapproval cancelado. **Y entra la 11**, `S4`, que antes movía a la
predecesora **dentro** del conjunto. Diez menos dos más una: **nueve**. **Ninguna transición dejó de
ocurrir**: cambió qué cuenta como salida del conjunto de declaración, no qué le puede pasar a la
predecesora durante la ventana — `S17` sigue saliendo de los mismos cinco estados, y `S18` sigue
nombrando a `S24` en su segundo evento.

~~**`S18` corre en SIETE de las ocho, y la que falta sigue siendo `S13`.**~~ ~~**`S18` corre en OCHO
de las diez: se suma `S23`, que su segundo evento ya nombraba. Las que faltan son `S13` y
`S27`** (FASE 8 completa, `F-8CB1-002`).~~ **`S18` corre en SIETE de las nueve** —las tres vivas y
`S12`, `S16`, el espejo y `S23`—; **las que faltan siguen siendo `S13` y `S27`** (FASE 8 completa,
`F-8CB1-002`; recontado con `DEC-SUB-021`: sale `S24` de la cuenta, no del segundo evento de
`S18`). En las tres filas vivas corre después
de `S17`, que es el que hace verdadera su condición. En `S12`, en `S16`, en **el espejo**, en
**`S24`** —fuera de la cuenta, no de este efecto— y en **`S23`** corre
**sin `S17` y sin esperar a que la sucesora autorice**, que es el segundo evento de su fila y el §
siguiente explica por qué tiene que ser así. **En `S27` el segundo evento de `S18` no la nombra**, y
el mismo acto alcanza a la sucesora por `S28` o por `S26` según su estado; este § no razona todavía
ese caso. En `S13` **no corre**, y no es una excepción olvidada:
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
vivo, y desde ahí el alta nueva entra sin pelear con nada— y el tope es la ventana de esa fila (§3.4 punto 1).

**Y no se cierra una sucesión que todavía podría no ocurrir: se cierra una que ya no tiene otro
final.** La predecesora está muerta por su propia cuenta, sin reversa (`CANCELLED` no revive,
`CHARGE_DECLINED` lo canceló el proveedor de forma terminal, y la baja que el espejo escribe **la
decidió el proveedor**), así que *«fue sucedida»* es el
registro fiel. Si después la sucesora abandona, la persona queda sin fila viva y puede dar de alta
de nuevo — **el mismo desenlace que tendría si nunca hubiera declarado la sucesión, con una sola
excepción y es la de abajo**: si la predecesora tenía una cortesía, declarar la sucesión la dejó
**diferida**, y el abandono la **cierra** (`DEC-GRANT-011`). Para todo lo demás —el candado, el
alta nueva, lo que puede comprar— la sucesión abandonada no deja rastro.

#### El saldo de una cortesía que nadie completó se CIERRA en `S3`

**`S18` deja la cortesía esperando y `S9` la re-emite cuando la sucesora llega a `ACTIVE`
(`DEC-GRANT-007`) — pero desde `PENDING_AUTHORIZATION` hay DOS salidas y la segunda no lleva a
`ACTIVE`.** `S3` manda la sucesora a `ABANDONED`, que es terminal, y ahí queda un `courtesy_grant`
con `saldo_meses` y **ninguna fila viva en esa vertical a la que volver**. `DEC-GRANT-011` decidió
el desenlace: **el saldo se cierra en el mismo acto**, con `saldo_cerrado_en` y su `motivo_cierre`
(`B/02` §2.4), y **quien vuelva a suscribirse no recupera ~~esos días~~ esos meses** (el saldo es
en meses: FASE 8 completa, `F-8CB1-001`, owner 2026-09-25). **Y desde la pendiente 8 hay otra
salida que tampoco lleva a `ACTIVE` y cierra el saldo**: **`S31`**, cuando un contracargo corta a la
predecesora, con `motivo_cierre = CONTRACARGO_DE_LA_PREDECESORA` (FASE 8 completa, pendiente 8,
owner 2026-09-25).

**Es el criterio que el programa viene aplicando, leído sobre este caso**: la persona **no puso
plata** y el acto que corta es **suyo** —abandonar el checkout—, así que se declara y no se repara.
Es el mismo desenlace que `DEC-TRIAL-009` (*«revocar un grant no devuelve el trial»*) y por las
mismas razones. **Lo que cuesta va dicho**: el abandono puede ser un error —una pestaña que se
cierra— y no una decisión, y quien firmó la cortesía **puede volver a otorgarla**, que es un acto
que ya existe —el **primer** disparador de `S9`— y no necesita mecanismo nuevo.

**Y no alcanza al saldo que difirió `S25`, que tiene su propio desenlace declarado.** Aquél espera
**un alta nueva** en la vertical que se discontinuó (`DEC-GRANT-010`, `B/14` §4.6), y una vertical
discontinuada **queda cerrada a altas para siempre** (`B/10` §4.5, borde 4): ahí **no llega a
existir ninguna fila en `PENDING_AUTHORIZATION`** que pueda vencer su ventana, así que esta regla
no tiene sujeto sobre esa población. Ese saldo **sigue diferido y sin emitir**, que es lo que
`DEC-GRANT-010` declaró y el owner eligió no cerrar. **Los dos saldos se escriben con la misma
columna y terminan distinto**, y por eso se dice acá en vez de dejarlo a la lectura.

**Las cinco escrituras de `S18` no corren todas por todos los caminos, y las dos últimas son las
que se reparten.** Las tres primeras —`sucedida_por`, limpiar `sucede_a` y el re-apunte de las
**dos** entidades re-apuntables— corren **siempre**. Las otras dos tienen dominio propio:

| escritura | por qué caminos corre | por qué |
|---|---|---|
| **4 · la cortesía se DIFIERE** (`saldo_meses`, `DEC-GRANT-007`) | el cierre normal con `S17`, y **el espejo** del §10.1 | una cortesía vigente deja la fila en `PAUSED` (`S9`), y `PAUSED` está entre los cinco `desde` de `S17` y entre los vivos del espejo. **No corre por `S12`** (`desde: CANCEL_SCHEDULED`) **ni por `S16`** (`desde: ACTIVE`), que son otros conjuntos; **ni por `S22`**, que sale de `PAUSED` pero **termina** la cortesía en vez de diferirla —la persona pidió irse, que es la elección de `DEC-GRANT-004` (1)—; **ni por `S23`, ni por `S24`**, porque ni una `SUSPENDED` ni una `GRACE_PERIOD` tienen cortesía vigente —una cortesía deja la fila en `PAUSED`— |
| **5 · la marca `REEMBOLSO_POR_CONFIRMAR`** sobre un pago pendiente por `S19` | **el espejo** (rama 5), **`S23` y `S24`** (las dos filas de la rama 6) y el cierre normal con `S17` (rama 1) | `S19` sólo existe sobre una predecesora en `GRACE_PERIOD` o `SUSPENDED`. **No puede aplicar por `S12` ni por `S16`**, y es aritmética de los `desde`: **ninguna fila puede estar en los dos conjuntos** |

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
| **sucesión muerta sin cerrarse** | una fila **no viva** con `sucede_a` no nulo, y la predecesora sin `sucedida_por` — la sucesora venció su ventana (`S3`), la mató `S13` o la cortó **`S28`** al discontinuarse la vertical | **ninguno de los dos**: los dos índices son parciales sobre los vivos, así que `B` queda libre y la persona puede volver a intentar el cambio de plan |

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

~~**La predecesora llega a la sucesión desde `GRACE_PERIOD`, y su cuota impaga sigue en `recycling`
del lado del proveedor**~~ **La predecesora ya no llega a la sucesión desde `GRACE_PERIOD`
—desde ahí no se declara, `DEC-SUB-021` (owner 2026-09-25)—: llega al grace DURANTE la ventana,
por `S4`, sobre una sucesión declarada en `ACTIVE`, y su cuota impaga sigue en `recycling` del lado
del proveedor**, que la reintenta solo (`B/12` §1.3, medido). **En un pagador con tarjeta
eso dura sólo hasta que `S6` la pasa a `SUSPENDED`: ese acto cancela el preapproval y cierra la
puerta del reciclado** (`DEC-SUB-019`), y como la puerta manual es del pagador manual, lo único que
puede seguir llegando ahí es un borde: un cobro en vuelo en el instante de `S6`, o una reactivación
a mano. Si entra durante la ventana
de autorización, `S5` la devolvía a `ACTIVE` —y `S7`, si `S6` ya la había pasado a `SUSPENDED`—: dos filas
vivas, el crédito de la sucesora ya computado ~~en cero~~ **sin ese pago** —en cero cuando se
declaraba desde el grace; declarada en `ACTIVE`, se computó antes de que ese período existiera—, y
un período pagado que `S17` se lleva puesto. Es el daño que `B/12` §5.3 describe entero.

**La regla que lo impide tiene que estar en esta tabla, no sólo en la prosa de otro capítulo**, y
ésa es la regla 1 del núcleo: lo que la tabla no declara, no pasa. Por eso son tres escrituras y no
una: la condición en `S5` y en `S7` —que es la que **no reactiva**— y `S19`, que es la que declara
**qué sí pasa**. Sin `S19`, el pago entrante sería una transición no declarada y la regla 1 lo
mandaría a la marca, convirtiendo ~~el camino normal del cambio de plan desde grace~~ el camino
normal de una sucesión cuya predecesora entra en el grace durante la ventana (`DEC-SUB-021`) en un
incidente.

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
(`B/12` §1.3) y el pago manual (§7). **Son una por método de pago, no dos para la misma persona**:
el reciclado es del pagador con tarjeta —y desde `DEC-SUB-019` dura sólo mientras la fila sigue en
`GRACE_PERIOD`, porque `S6` cancela el preapproval al suspender—, y el pago manual es del pagador
manual, que no tiene preapproval. **La puerta manual tiene DOS filas y sigue siendo una sola
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
período. El tope es la ventana de esa fila (§3.4 punto 1), y después el pago se resuelve por una de las seis ramas de
`B/12` §5.3.

**Y el tope está escrito como condición, no sólo como intención, porque hay QUIÉN lo hace
vencer.** *«Después de que venza la ventana»* no era ninguna condición de `S19`, `S5`, `S6` ni `S7`: las cuatro
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
| **la predecesora pide la baja ella misma** — estando `SUSPENDED` (`S23`) o **en el grace (`S24`)**, que son los dos únicos estados desde los que `S19` retiene un pago | **`S18`**, que corre sin `S17` y le abre la misma marca | ídem |

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
verticales **no se reinicia** —su único hecho aplicable acá es la cobertura comprobada verdadera
(`NUCLEO/01` §1.2, hecho 2), y acá se comprueba falsa— y sigue corriendo hacia el día 180, que borra el contenido
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

**El calificativo del título no es un matiz: `PAUSED` tiene otras ~~tres~~ cuatro salidas —la
cuarta, `S6`, desde la pendiente 8, abajo— y ninguna sostiene nada.** `S22` —la baja—, `S13` —el grant— y **`S25`** —el fin de la pausa sobre un plan que ya no
se presta (`DEC-SUB-015`)— **terminan la relación**, así que después de las tres no
queda ficha que republicar ni reanudación que esperar, y por eso el argumento de acá abajo es
sobre `S10` y no sobre *«salir de `PAUSED`»*: lo que la garantía de retención necesita es que la
persona que **pidió volver** vuelva. Las tres salidas terminales tampoco dejan colgada la quinta
comprobación de `B/09` §3 —que exige *«su suscripción sigue en `PAUSED`»*—, y `S22` y `S25`
además cierran la pausa escribiéndole `fin_real`. **Y desde la pendiente 8 hay una cuarta que no
es terminal y tampoco sostiene nada**: **`S6`**, por un contracargo sobre una cortesía, lleva la
fila a `SUSPENDED`, que no emite fuente; sale de `PAUSED`, así que tampoco deja colgada la quinta
comprobación, y cierra la pausa con su `fin_real` como `S22` (§3.2; FASE 8 completa, pendiente 8,
owner 2026-09-25).

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

#### La discontinuación de una vertical tiene TRES filas, y el destino cambia con lo que cada estado emite

**`B/10` §4.3 ORDENA el movimiento y hasta acá ninguna transición numerada lo ejecutaba.** *«Cada
suscripción viva que pueda llegar a `CANCEL_SCHEDULED` se cancela en el proveedor de inmediato y
pasa a ese estado»* es una instrucción de un capítulo sobre esta tabla, y **`S11` no la cumple**:
su evento es *«pide la baja»*, o sea un acto del cliente sobre su propia fila, y esto lo decide
`SUPER_ADMIN` sobre **la cartera entera de una vertical**. Por la regla 1 del núcleo, lo que la
tabla no declara **no pasa**: el movimiento caía en la marca `TRANSICIÓN_NO_DECLARADA` desde
`ACTIVE`, desde `GRACE_PERIOD`, desde `SUSPENDED` y desde `PENDING_AUTHORIZATION` — los cuatro, no
sólo el `PAUSED` que `DEC-SUB-015` ya había sacado del acto. **`S26`, `S27` y `S28` lo ejecutan.**

**Un acto, tres filas, y el precedente es la baja.** `S22`, `S23` y `S24` son *«el mismo acto de
`S11`»* escrito tres veces porque **el desenlace cambia con el estado**; acá pasa lo mismo y por
una razón que se puede leer en una tabla ya escrita —la de qué emite cada estado
(`12-contrato…` §2.6)—:

| `desde` | ¿emite fuente hoy? | `hacia` | qué pasaría con el destino de al lado |
|---|---|---|---|
| `ACTIVE` · `GRACE_PERIOD` | **sí**, las dos | `CANCEL_SCHEDULED` (`S26`) | cortar hoy le retiraría un servicio que está usando y que en el grace **paga el §20** |
| `SUSPENDED` | **no** | `CANCELLED` (`S27`) | `CANCEL_SCHEDULED` **emite**, así que le devolvería 60 días de servicio gratis a quien dejó de pagar |
| `PENDING_AUTHORIZATION` | **no** | `ABANDONED` (`S28`) | ídem, y sobre alguien que **nunca autorizó ni pagó nada** |
| `PAUSED` | irrelevante acá | **ninguno** — no entra al acto | `DEC-SUB-015`: el §3.3 prohíbe `PAUSED → CANCEL_SCHEDULED`, y su final es `S25` |

**Escribirlo como una sola fila con un `desde` de cuatro estados era la lectura obvia y es la que
regala servicio.** El `hacia` es uno por fila (la forma que el resto de la tabla usa), así que un
`desde` de cuatro obliga a un destino único, y el único que sirve para `ACTIVE` **emite**. La
diferencia no la decide una preferencia: la decide qué tiene hoy cada cliente, que es un dato del
contrato de cobertura y no de este capítulo.

**Y las tres NO agregan ningún par con dos filas**, así que el conteo de `NUCLEO/03` §1 regla 7
—**cuatro**, con `S10`/`S25` como el último— **no se mueve**: un par es `(desde, evento)`, y las
tres comparten el evento pero **no el `desde`**, que es disjunto por construcción entre ellas y
contra toda otra fila de la tabla, porque ninguna otra tiene este evento. `G-R4` no tiene nada que
dirimir acá.

**Las tres alcanzan a las filas DE COMPLEMENTO además de a las principales**, que es lo que el §3
de este capítulo obliga a contestar a toda transición con `desde` de conjunto — y acá la respuesta
la da el capítulo que ordena el acto: *«lo mismo con cada suscripción de complemento viva en ella»*
(`B/10` §4.3), **una por una, porque cada addon recurrente es su propia autorización**
(`DEC-ADDON-002`). La **instancia** no necesita nada nuevo: se apaga por el camino que `B/16` §4.2
ya declara cuando su suscripción deja de sostenerla, y `S21` **no escribe nada** sobre una fila que
ya está `CANCELLED`.

**Y `S28` NO cierra ningún saldo de cortesía, aunque se parezca a `S3`.** El cierre de
`DEC-GRANT-011` cuelga de un hecho que acá no ocurre —*«venció la ventana de autorización»*— y su
población es la del cambio de plan. Acá el saldo queda **diferido sobre una vertical que ya no
admite altas**, que es **exactamente** el desenlace que `DEC-GRANT-010` declaró y que el owner
eligió **no** cerrar, con su razón escrita: *«una vertical no la vamos a discontinuar nunca, y si
algún día decidimos eso, lo veremos en el momento»*. **Es el mismo saldo colgado por otra puerta**,
y la puerta de `S25` ya lo declara así en `B/14` §4.6. Cerrarlo acá sería resolver por la mitad
—y en silencio— la única pregunta que esa decisión dejó abierta a propósito.

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
condición es sobre el estado de la instancia, que `S21` no toca, así que no hay dos mitades que
puedan quedar separadas. **Y sus escrituras son dos desde que abre su marca** —la
columna de estado de la suscripción de complemento, y la marca con su pago colgado—, **y las dos
son idempotentes por separado**: sobre una fila que ya está `CANCELLED` la primera no escribe nada,
y la segunda la sostiene la base —`UNIQUE(subscription_id, motivo)` sobre las marcas abiertas y
`UNIQUE(marca, pago)` sobre lo que cuelga (`B/02` §2.2)—, así que una corrida repetida no abre una
segunda marca ni cuelga dos veces el mismo pago. **Y que los motivos de `S21` sean dos desde
`DEC-RF-006` no le agrega una tercera escritura ni le quita la idempotencia**: la corrida repetida
vuelve a resolver **el mismo** disparador, así que vuelve a escribir **el mismo** motivo y el
`UNIQUE` la rechaza igual que antes (`B/02` §2.2, donde está el argumento de por qué los dos no
pueden convivir).

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
ya tiene transición propia: es `S3`, la misma ventana —con sus **dos** plazos, §3.4 punto 1—, con su misma cancelación en el
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

**El período ya pagado no se reembolsa SOLO, y eso vale en los cuatro disparadores.** Lo que
`DEC-RF-004` partió y `DEC-RF-006` volvió a poner en el motivo es **lo que el listado propone**, no
quién decide: en los cuatro la decisión la toma una persona (`DEC-RF-002`), y lo que cambia es con
qué propuesta delante (ver abajo, *«cuál de los dos motivos abre `S21`»*). **Y que el período no se devuelva de oficio
va escrito y no implícito.** Es el mismo criterio con el
que `DEC-GRANT-001` lo dice para `S13` y `B/16` §3.4 para `S20`, apoyado acá en las tres reglas que
`DEC-RF-002` enumera: *«reembolsar»* es una acción que mueve dinero, con permiso propio y
confirmación explícita (`NUCLEO/08` §3); la línea del owner es *«toca plata o no toca plata»*
(`B/09` §2.4); y `S14` prohíbe **toda decisión destructiva automática**. Un reembolso automático acá
sería la primera operación automática sobre dinero del diseño, en un dominio que está vacío a
propósito.

**Pero *«no se reembolsa solo»* no es *«nadie lo mira»*, y ésa era la mitad que faltaba.** Este §
decía —y `B/16` §4.4 repite— que *«si en un caso concreto corresponde devolver, entra por esa
vía»*, y **ninguna transición ni comprobación del corpus abría ese caso**: la acción de reembolsar
está en el catálogo de `NUCLEO/08` §3 con permiso, auditoría y confirmación, y ese mismo § advierte
que *«una acción con permiso, auditoría y confirmación declarados no sirve de nada si nadie enruta
el caso»*. Desde que la enumeración de motivos es **cerrada** (`B/02` §2.5) eso dejó de ser una
omisión discutible: **bajo `G-R1-F` la vía no se podía escribir sin un motivo en esa tabla, y
ninguno de los trece era éste.**

**Así que `S21` abre la marca, y con una condición que acota la población a la que tiene plata
adentro.** El motivo es **uno de los dos que `DEC-RF-006` le dio** —el **14**,
`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_OTRA_CAUSA`, o el **15**,
`COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN_O_DISCONTINUACIÓN` (`B/02` §2.5)— y la condición,
que es **la misma para los dos**, es que
**el último cobro de esa suscripción de complemento pague un período que todavía no terminó**. Eso
deja afuera, sin nombrarlas una por una, las tres poblaciones donde no hay nada que decidir: el
addon convertido a $0 —no hay cobro—, el que muere justo al final de su ciclo, y el `A3` que nunca
llegó a cobrar. **Lo que la marca NO hace es decidir**: la decide una persona (`DEC-RF-002`), y lo
que el listado le pone delante es una propuesta (`B/19` §6). La marca es lo que pone el caso
delante de esa persona con el pago y el monto al lado, en vez de dejarlo esperando a que el cliente
reclame.

##### Cuál de los DOS motivos abre `S21` lo decide el disparador, y los disparadores son CUATRO

**`DEC-RF-006` partió el motivo en dos, y con eso la propuesta volvió a leerse por motivo.**
`DEC-RF-004` le había quitado el default único y lo había reemplazado por **dos ramas de un mismo
motivo**; lo que cambia acá es **dónde vive esa distinción**: pasa a ser **el `motivo` de la
marca**, que es una enumeración cerrada y **se escribe al abrir la marca, en el acto, cuando la
causa todavía existe** (`B/02` §2.2 y §2.5). El criterio de reparto **no se movió**: la regla de
`B/16` §4.4 —*«el período ya
pagado no se reembolsa»*— sigue valiendo donde el complemento se pierde **por un acto del propio
cliente**; **no** vale donde la pérdida la causa **un acto deliberado nuestro sobre alguien que
puso plata y ese acto puede decirlo sin mecanismo nuevo** — la segunda mitad de esa condición es lo
que deja **dos** caminos nuestros del lado de la regla, y abajo van nombrados. El evento de `S21` se
ata al estado de llegada de la instancia, y a `CANCELLED`
llegan **cuatro** disparadores y no tres — las **tres** cláusulas del evento de `A5` más `A6`
(§8, `B/16` §4.4). **Ninguno queda implícito**:

| # | disparador | qué pasó | motivo que escribe `S21` | propuesta |
|---|---|---|---|---|
| 1 | **`A5`, primera cláusula** — *«se da de baja»* | el cliente dio de baja el complemento | **14** · `…_POR_OTRA_CAUSA` | **NO DEVOLVER** |
| 2 | **`A5`, segunda cláusula** — *«queda huérfana»* (la condición de `B/16` §4.2, con sus **tres** mitades) | murió el **objetivo** del addon, y ni una sucesión ni un grant vivo lo relevan | **se PARTE**: el **15** si al objetivo lo mató la **discontinuación de su vertical** —`S25`, `S27` o `S28`—, el **14** en los demás caminos (abajo) | **DEVOLVER** o **NO DEVOLVER**, según cuál de los dos |
| 3 | **`A5`, tercera cláusula** — *«se revoca el grant del que cuelga el ancla que era su título»* | **el cliente no hizo nada** y pierde los días que pagó | **15** · `…_POR_REVOCACIÓN_O_DISCONTINUACIÓN` | **DEVOLVER** |
| 4 | **`A6`** — se borra la ficha destino | el cliente borró su propia ficha, y `DEC-ADDON-001` ya declara que el complemento *«se consume»* | **14** · `…_POR_OTRA_CAUSA` | **NO DEVOLVER** |

**El motivo 15 junta esos dos caminos y su nombre los dice, que es lo que lo vuelve clasificable
sin leer este §**: la **revocación** del grant y la **discontinuación** de la vertical. Un camino
que no sea ninguno de los dos no entra, aunque también sea nuestro — y **dos lo son**, nombrados más
abajo.

**El 3 cae ENTERO del otro lado —es el único que no se pregunta nada más—, y la razón ya estaba
escrita en el programa**: *si la pérdida la causa un acto deliberado NUESTRO y la persona no puso
plata nueva → se declara y no se repara; **si la persona PUSO PLATA → se le da salida***. En la
tercera cláusula **las dos mitades apuntan al mismo lado** —revocar es un acto nuestro, declarado,
del catálogo del `NUCLEO/08` §3, y el cliente pagó el período—, que es el mismo criterio con que se
resolvieron `DEC-TRIAL-009`, `DEC-ADDON-005` y `DEC-GRANT-011`. **El 2 apunta al mismo lado en
parte de su población**, y por eso es el único que se parte.

**Y el 2 no es homogéneo, porque medido contra `B/16` §4.2 decir *«acá actuó el cliente»* sería
falso.** La orfandad se resuelve contra la muerte del objetivo, y las transiciones que sacan a la
principal de las filas vivas son **doce**, recontadas sobre la enumeración de `B/16` §4.3: `S3`,
`S12`, `S13`, `S16`, `S17`, el espejo del §10.1, `S22`, `S23`, `S24`, `S25`, `S27` y `S28`.
**Cinco caminos no son un acto del cliente, y van nombrados uno por uno porque `DEC-RF-004` lo
exige**: `S17` es nuestra; `S12` puede venir de un `CANCEL_SCHEDULED` que puso `S26` al discontinuar
la vertical; y `S25`, `S27` y `S28` son **la discontinuación de la vertical** —el fin de una pausa
sobre un plan que ya no se presta y las dos terminales del acto del día 0 (`B/10` §4.3,
`DEC-SUB-015`, `DEC-SUB-018`)—. Son **cinco de doce** y no dos de seis.

**De esos cinco, la ampliación de `DEC-RF-004` del 2026-09-23 parte TRES y deja dos, y el reparto
va en una tabla para que no haya que deducirlo:**

| camino dentro del disparador 2 | quién lo causa | motivo | propuesta |
|---|---|---|---|
| **`S25`, `S27` y `S28`** — la discontinuación de la vertical | nuestra, **y la causa es legible en el acto mismo** | **15** | **DEVOLVER** |
| **`S17`**, y **`S12` cuando su `CANCEL_SCHEDULED` lo puso `S26`** | nuestra, **y la causa NO es legible en la transición que mata al título** | **14** | **NO DEVOLVER**, por mecanismo y dicho en voz alta (`B/19` §6) |
| las otras **siete** transiciones, y la mitad de `S12` que no viene de `S26` | el cliente actuó | **14** | **NO DEVOLVER** |

**Por qué se parte justo ahí, y el argumento es que la razón para NO partir es falsa en esos
tres.** Lo que sostenía el `NO DEVOLVER` de todo el 2 era de mecanismo: **`S21` conoce la cláusula
de `A5` que disparó, no cuál de las doce transiciones mató al título tres saltos antes**, y hacerle
llegar esa causa exigiría que la marca transportara algo que la transición no tiene — mecanismo
nuevo en producción, que es exactamente lo que `DEC-RF-004` dijo que **no** estaba comprando. **En
la discontinuación esa razón no se cumple, y no por una excepción sino porque ahí la causa se lee
sin trazar nada hacia atrás.** Son dos formas distintas de leerla y conviene no confundirlas:

- **`S27` y `S28` SON el acto.** El día 0 del `B/10` §4.3 es un acto masivo nuestro que **recorre
  las filas una por una** —y ese § dice, en la misma frase que las cancela, *«lo mismo con cada
  suscripción de complemento viva en ella»*—, así que **el acto ya toca la fila del complemento** y
  puede dejar la causa al pasar.
- **`S25` NO entra a ese acto** —la `PAUSED` queda deliberadamente afuera (`DEC-SUB-015`, §3.3, y
  `B/10` §4.3 la deja sin transición ahí)— **y no lo necesita, porque su propia guarda es la
  discontinuación**: `S25` se separa de `S10` exactamente por *«el plan al que la fila está anclada
  ya NO se presta — su vertical fue discontinuada»*. La transición que mata al título **sabe por
  qué lo mata**, en su propio acto y sin preguntarle a nadie.

**Y lo que NO se parte queda declarado con su razón, porque ahí el argumento del mecanismo sí
vale.** En `S12`-vía-`S26` la transición que mata al título es `S12`, cuyo evento es *«llega la
fecha de fin de servicio»* y **no dice quién puso el `CANCEL_SCHEDULED`**: separar un `S26` de un
`S11` pediría transportar la causa a través del estado intermedio, que es el mecanismo descartado.
En `S17` el evento es *«su sucesora quedó autorizada»*, que **no nombra ninguna discontinuación** y
no es un acto que recorra filas. Las dos siguen en **NO DEVOLVER** y **dependen de que quien
resuelve se aparte del default**, que es para lo que la fila de `B/19` §6 dice en voz alta que esos
dos caminos existen. **Y la propuesta no ejecuta nada** (`DEC-RF-002`): la persona la confirma o se
aparta de ella.

**Y la partición cae donde el costo humano es mayor, que es la otra mitad de por qué se hizo.** La
baja que `S17` ejecuta abre el motivo **1** con las **seis** ramas de `B/12` §5.3 y no éste; y la
discontinuación que llega por `S26` → `S12` trae el piso de **60 días** del `B/10` §4.3 y §4.4.
**`S27` y `S28` no traen ninguno de los dos**: `DEC-SUB-018` decidió que la suspendida **no entra
al piso** y va directo a `CANCELLED`, y `S28` tampoco pasa por él —*«sobre alguien que nunca
autorizó ni pagó nada»* (§3.2)—. **De los cinco caminos nuestros son los dos únicos** en que la
persona pierde el complemento que pagó **y no recibe absolutamente nada a cambio por ningún lado**,
y el default uniforme le proponía no devolverle nada. **Y lo que el piso y el motivo 1 compensan es
la PRINCIPAL, no el complemento**, que es otra fila y pudo haber cobrado su período: por eso esto
ordena el costo humano de los cinco y no vuelve entero a nadie.

**Y dónde vive la distinción ya NO queda abierto: es el `motivo`.** Hasta `DEC-RF-006` la propuesta
viajaba como una **rama** de un mismo motivo, y el corpus declaraba que la marca *«lleva de qué
disparador vino»* (`NUCLEO/08` §4.3) **sin que ninguna de las columnas de `reconciliation_mark`
fuera ésa** (`B/02` §2.2) — un hueco **anterior** a la partición del disparador 2, porque `S21` ya
tenía que distinguir cuatro disparadores desde que `DEC-RF-004` le quitó el default único. **La
partición en dos motivos lo cierra sin columna nueva**: `motivo` es una enumeración cerrada que
**ya existe** y que `S21` **ya escribe al abrir la marca**, en el acto y **con la causa todavía
viva** — que es exactamente lo que después no se puede, porque en la orfandad por discontinuación
la causa **no sobrevive en ningún lado** una vez que la fila llegó a `CANCELLED`. **Ninguna
transición nueva, ninguna llamada nueva, ninguna columna nueva y ningún dato que haya que trazar
hacia atrás.**

**Y lo único que la partición agrega va RESUELTO y no anotado.** El
`UNIQUE(subscription_id, motivo) WHERE levantada_en IS NULL` deja de excluir entre sí a las dos
marcas, porque **son dos motivos distintos**. **Igual no pueden convivir, y por construcción**: el
escritor de los dos es `S21`, su evento es la llegada de **su** instancia a `CANCELLED`, y ahí se
llega por **uno solo** de los cuatro disparadores de la tabla de arriba. El argumento entero, con
lo que el `UNIQUE` sí sigue haciendo y con lo que deja de hacer, está escrito **al lado de la
restricción** (`B/02` §2.2), y `G-R1-F` vigila lo que la base ya no vigila (`B/20` §2).

> **El lado del motivo 15 que llega POR REVOCACIÓN DEL GRANT no tiene población vacía, y conviene
> decir dónde vive**, porque el §
> siguiente demuestra que sobre un addon **convertido a $0** `S21` no encuentra fila viva. Son dos
> poblaciones y ésta es la otra: el addon que **nunca** fue gratis y sigue pagándose mientras un
> grant es el título — el §3.4 de `B/16` convierte a $0 **sólo los compatibles**, así que un addon
> incompatible sigue cobrando—. A ésa se le suma el caso con nombre del recuadro de abajo, la
> corrida de `S20` cortada entre sus dos escrituras.

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

**`S21` no agrega ningún par con dos filas, así que el conteo de `G-R4` no se mueve — y son cuatro
desde `S25`, no tres** (`NUCLEO/03` §1 regla 7). Comparte el
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
| `PAUSED` → cualquier cosa que no sea `ACTIVE` o `CANCELLED` **—salvo `SUSPENDED` por `S6` desde una cortesía (abajo)—** | **La excepción, del owner** (FASE 8 completa, pendiente 8, owner 2026-09-25): **`PAUSED` con motivo `COURTESY` → `SUSPENDED` por `S6`, sólo por su tercer evento —el contracargo—**, porque la cortesía da servicio y un contracargo corta a toda fila que da servicio (`DEC-SUB-020`, su 📌). **No choca con la razón de esta fila**: `S6` no modifica el preapproval pausado, **lo cancela**, que es justo lo que `EX-11` mide que sí se puede. Lo demás de la celda sigue igual: está medido que **estando pausada el proveedor rechaza toda modificación** (`EX-11`), y que **sí deja cancelar**. **Las dos que quedan afuera de la prohibición tienen fila**: `ACTIVE` es `S10`, y `CANCELLED` es **`S22`** —la baja—, `S13` —el grant— y **`S25`** —el fin de la pausa sobre un plan que ya no se presta (`DEC-SUB-015`)—. Esta celda decía qué no pasa y, hasta `S22`, una de las dos que sí pasan no estaba escrita. **Y es lo que obliga a que `S25` exista**: `B/10` §4.3 mandaba la pausada de una vertical discontinuada a `CANCEL_SCHEDULED`, que es justo lo que esta fila prohíbe |
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
puede apuntarla—, salvo desde `CANCEL_SCHEDULED` **o desde una `SUSPENDED` de pagador con tarjeta**
(FASE 8 completa, `F-8CB1-002`, owner 2026-09-25), y en los dos casos con la relectura que `B/02`
§2.2 exige. **Las
dos se enuncian sobre la columna y no sobre el verbo *«declarar»***, que en este corpus nombra a
la sucesora en `S1` y a la predecesora acá: la regla de vocabulario está en `B/02` §2.2 y la
escribió un doble cobro.

#### 3.3.1 ~~Dos~~ Tres estados desde los que el cambio de plan NO se ofrece

~~Los dos salieron de recorrer el dominio completo del candado y **ningún informe de FASE 8 los
tenía**. En los dos, **la operación no se ofrece, con el motivo explícito en pantalla**:~~
Los dos primeros salieron de recorrer el dominio completo del candado y **ningún informe de FASE 8
los tenía**; el tercero, `GRACE_PERIOD`, lo agregó `DEC-SUB-021` (owner 2026-09-25; FASE 8
completa, `F-8CD1-002`, `F-8CB1-009`). En los tres, **la operación no se ofrece, con el motivo
explícito en pantalla**:

| estado | qué había escrito | qué se le dice |
|---|---|---|
| `PENDING_AUTHORIZATION` | **nada**. Ningún capítulo lo nombra: el §3.4 punto 4 dice qué pasa si reintenta **el mismo** plan —*«no se crea otra, se reusa la vigente»*— y nada de cambiar a otro | *«terminá o cancelá el checkout que tenés abierto»* |
| `PAUSED` | una regla **cuyo destino no existe**: este mismo § prometía que el cambio *«se encola y se aplica al reanudar»*, y la cola de `B/12` §2.1 **es de entitlements, no de checkouts** | *«reanudá tu suscripción para cambiar de plan»* |
| `GRACE_PERIOD` ✚ | que se podía, con cobro inmediato del plan nuevo (`DEC-SUB-003`, superada por `DEC-SUB-021`) | **qué hacer para regularizar, según el método de pago**: con tarjeta, *«cambiá tu tarjeta»* —los reintentos del proveedor cobran con ella (`EX-36`, `GR-3`)—; con pago manual, *«pagá tu cuota»*. Y que **recién con la suscripción al día** puede cambiar de plan (`B/19` §4 fila 17-bis) |

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
**El tercero no es de superficie sino de decisión** (`DEC-SUB-021`), y tampoco bloquea: la persona
regulariza —cambia la tarjeta o paga la cuota—, vuelve a `ACTIVE` por `S5`, y ahí cambia de plan.

**Lo único que faltaba era decir el no en voz alta**, en vez de que alguien lo descubra
implementando.

### 3.4 Las tres precisiones que `M-SUB-01` pedía sobre `PENDING_AUTHORIZATION`

El §5.6 define el modelo actual —Hospeda crea el preapproval y después manda a autorizar—, así
que **esta ventana existe siempre, por diseño**, y es donde se pierde gente. `M-SUB-01` pedía
cuatro cosas y acá están las cuatro:

1. **Duración máxima: son DOS y no una, según el método de pago** (`DEC-SUB-016`). **72 horas para
   el pagador con tarjeta** y **7 días corridos para el pagador manual**. Las dos son
   configuración, no constante (§9), y viven en las opciones globales de billing. Las dos
   respetan las mismas dos restricciones: más largas que cualquier demora del proveedor —medida
   hasta ~33 min— y más cortas que el ciclo más corto que vendemos, para que una ventana abierta
   nunca se superponga con un cobro.

   **Y la de una sucesora con tarjeta puede ser más corta**: vence a lo que llegue primero entre sus
   72 h y el inicio del día del próximo cobro de su predecesora, y si queda menos que un mínimo el
   cambio de plan no se ofrece hasta después de ese cobro (`B/12` §5.4). Sobre el pagador manual no
   se acorta: su crédito corto se corrige (`DEC-SUB-017`).

   **Por qué el pagador manual no puede compartir las 72 h.** Esa cifra se eligió para el tiempo
   que tarda alguien en **completar un checkout**; lo que la ventana del pagador manual espera es
   otro hecho físico: **que se acredite una transferencia bancaria**, que en Argentina no ocurre
   en 72 h si el envío cae antes de un fin de semana largo. El costo de equivocarse es asimétrico
   —se pierde a alguien que **ya decidió pagar**, contra tener una fila pendiente unos días más—,
   y la fila pendiente no cuesta servicio: durante la ventana **no emite fuente**
   ([`12-contrato…`](../../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md)
   §2.6), que es lo que el §7.2 exige para que la regla se sostenga con cualquiera de las dos.

   **Y son días CORRIDOS, no hábiles.** Un plazo en días hábiles obliga a un calendario de
   feriados que el programa no tiene y que nadie va a mantener — el mismo criterio con que este
   diseño viene descartando mecanismo.

   **Consecuencia que hay que leer junto con el punto 3**: el vencimiento es **de esa fila**, así
   que ninguna superficie puede escribir el plazo a mano. Lo que se muestra y lo que se avisa es
   **la fecha** — el §3.4 punto 3 acá, `B/19` §4 fila 18 y `NUCLEO/07` §6.
2. **Limpieza**: un job recorre las vencidas, las lleva a `ABANDONED` y **cancela el preapproval
   en el proveedor**. Sin ese segundo paso queda una autorización viva que puede cobrar.

   **Y antes de cancelar, relee el preapproval por id** (`S3`, fila de la tabla del §3.2). El
   vencimiento lo decide nuestro reloj, pero si la persona autorizó lo decide el proveedor, y las
   dos cosas pueden pasar en el mismo minuto: autorizar en el último momento y que el webhook
   llegue tarde es una carrera real, no un caso teórico. Sin la relectura, el job le cancela la
   suscripción a alguien que acaba de autorizarla. Es la misma regla que ya llevaban las otras
   transiciones que cancelan en el proveedor (*«con la regla de relectura de `S17`»*); en `S3`
   faltaba, y no por decisión.

   **Y sobre una sucesora con tarjeta de ventana reducida, la relectura corre EN EL CORTE** —las
   00:00 `-04` del día del cobro de la predecesora— **y antes del primer lote en que ese cobro
   puede caer** (`B/12` §5.4; FASE 8 completa, `F-8CB1-004`): con el webhook de autorizada demorado,
   es lo único que hace correr `S2` y `S17` antes de que la predecesora cobre. Lo que eso no cierra
   está anotado en `B/12` §5.4.
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
`S19` y el reloj no vence sobre él (§3.2). **Y vale también para el segundo evento de `S6`** —la
pausa del proveedor por mora, que puede llegar con la fila todavía en `ACTIVE` (`DEC-MP-008`)—: a
quien está en medio de un cambio de plan no se lo suspende por eso (owner, 2026-09-24).
~~**La protección dura una sola ventana de autorización.** Si esa ventana vence sin que la sucesora
autorice y el reloj ya estaba vencido, una sucesión declarada después **no vuelve a frenarlo**:
`S6` corre en la primera corrida. Sin este límite, alcanzaba con redeclarar una sucesión cada 72 h
(o cada 7 días si paga a mano) para tener servicio completo sin pagar nunca (FASE 8 completa,
`F-8CB1-005`, `F-8CB2-008`). La fila `S6` de la tabla dice lo mismo.~~
**Desde `DEC-SUB-021` la redeclaración que ese límite frenaba no puede ocurrir** (owner
2026-09-25): el abuso —redeclarar una sucesión cada 72 h, o cada 7 días si paga a mano, para tener
servicio completo sin pagar nunca (FASE 8 completa, `F-8CB1-005`, `F-8CB2-008`)— necesitaba
**declarar desde `GRACE_PERIOD`**, y desde el grace ya no se declara (`G-R1-A`, `B/20` §2). **Lo que
sigue vigente es la protección**, y vale para la única sucesión que todavía puede tener a la fila
en el grace: **una declarada en `ACTIVE` cuya predecesora entra en el grace durante la ventana**
(`S4`). Esa sucesión sigue su curso, `S6` no la suspende mientras esté en curso, y si la sucesora
muere `S6` corre en la corrida siguiente — sin una segunda sucesión posible que lo vuelva a frenar,
porque la fila ya está en `GRACE_PERIOD`. La fila `S6` de la tabla dice lo mismo, con una salvedad
anotada sobre su segundo evento.

| | |
|---|---|
| **cuándo entra** | falla un cobro de una suscripción `ACTIVE` (§20). **En un pagador con tarjeta, es el primer rechazo de un cobro de renovación, leído por id** (`B/12` §1.2, `D17`), no el fin de los reintentos del proveedor, que no emite evento (`GR-3`) |
| **cuánto dura** | los días que declara **la versión de plan**, default **10** (`DEC-SUB-002`) — y **siempre menos que el ciclo de esa versión** (`DEC-SUB-019`): el proveedor reintenta durante **un ciclo** (sonda 49) y después pausa, así que un grace más largo dejaría la fila con servicio completo y sin nadie que vaya a cobrar. Es validación de la configuración |
| **qué pasa durante** | §20: servicio activo, fichas publicadas, edición activa, entitlements activos, advertencias y correos |
| **cómo sale bien** | entra el pago → `ACTIVE` |
| **cómo sale mal** | se agota el reloj → `SUSPENDED`, **y en un pagador con tarjeta se cancela el preapproval** (`S6`, `DEC-SUB-019`) |
| **qué se puede hacer adentro** | ~~**cambiar de plan está permitido, y es el camino de recuperación** (`DEC-SUB-003`): se intenta el cobro del plan nuevo de inmediato; si entra, vuelve a `ACTIVE` con el plan nuevo; si falla, **sigue en grace con el plan anterior y no cambia nada**~~ **regularizar, y recién después cambiar de plan** (`DEC-SUB-021`, owner 2026-09-25, que supera a `DEC-SUB-003`). **Con tarjeta, cambiar la tarjeta** del preapproval, que se puede sin recrearlo (`EX-36`): los reintentos del proveedor, que siguen durante un ciclo (`GR-3`), cobran con ella, y la fila vuelve a `ACTIVE` por `S5`. **Con pago manual, pagar la cuota**. **Recién en `ACTIVE` se cambia de plan**: desde `GRACE_PERIOD` no se declara una sucesión (`G-R1-A`), y la pantalla lo dice (§3.3.1, `B/19` §4 fila 17-bis). El motivo: `S17` cancela la predecesora al **autorizar** la sucesora y `D8` le difiere el primer cobro, así que si ese cobro falla —con la misma tarjeta que venía fallando— la persona se queda sin nada (FASE 8 completa, `F-8CD1-002`, `F-8CB1-009`) |

**Tres cosas que el reloj tiene que respetar:**

- **El reloj decide cuándo se pregunta, no qué pasó.** Si cobró o no lo sabe el proveedor, así
  que antes de suspender **se le pregunta** (`S6`). Sin eso, un webhook perdido suspende a alguien
  que pagó, y el barrido diario lo repara con hasta un día de atraso. La pregunta se hace **con la
  lectura del `B/09` §4**, que es el único lugar del diseño que decide *«cobró o no»*: `S6` no
  elige campo, así que cuando esa lectura se corrija, `S6` queda corregido sin tocarlo. Y si el
  proveedor no contesta, **no se suspende**: el costo de esperar una corrida es que un moroso
  conserve el servicio un poco más, y el de no esperar es suspender a un cliente al día.

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
sostiene lo que sigue es S10. **Y una pausa por cortesía se corta además por `S6`**, si un
contracargo cae sobre ella: la fila va a `SUSPENDED` y la pausa se cierra con su `fin_real` (§3.2;
FASE 8 completa, pendiente 8, owner 2026-09-25).

| | |
|---|---|
| **motivos** | `CUSTOMER_REQUEST` · `COURTESY`. Valor cerrado |
| **unidad** | **meses enteros** (`DEC-SUB-010`). No existe la pausa intra-ciclo |
| **cuándo empieza** | en el momento en que se pide, no al fin del ciclo |
| **quién la termina** | **la termina nuestro reloj, y del lado del proveedor no hay segunda vía**: está medido que **no tiene auto-reanudación** (`PS-4`). Por eso `S10` lleva **rama de fallo y detector** (§3.2, *«`S10` es la única salida de `PAUSED` que devuelve el servicio»*). **Que el reloj la termine no siempre es reanudarla**: si el plan al que la fila está anclada dejó de prestarse, el mismo evento lo ejecuta `S25` y la fila se cancela (`DEC-SUB-015`). **Y la persona tiene su propia vía, que tampoco reanuda: es irse** (`S22`) |
| **qué pasa al volver** | se cobra normal en el ciclo siguiente; reanudar cambia **sólo el estado** y no dispara cobro de recuperación ni deja deuda (`PS-5`) |
| **límites** | los del §26.3, reexpresados en meses: **4 pausas-mes** por pausa y **8** acumulados en 12 meses; máximo 3 pausas por ventana. Se cuentan por `user + vertical` y **sobreviven a cancelar y volver a suscribirse** (`DEC-SUB-004`) |

**Qué le pasa a la ficha mientras dura la pausa, porque esto no se puede escribir de un solo
lado.** Una `PAUSED` por `CUSTOMER_REQUEST` **no emite fuente** (`12-contrato…` §2.6), así que
`cubierto` pasa a falso y `PB2` baja la ficha el primer día (`V/03` §9) **y en ese acto arranca el
reloj de inactividad** —el hecho 5 del `NUCLEO/01` §1.2, FASE 8 completa, `F-8CA2-001`, owner
2026-09-25—, **en ella y en todas las demás fichas del dueño en la vertical**, que el recálculo del
aviso escribe sin pasar por `PB2` (owner 2026-09-25). **Y el reloj de inactividad de verticales no se detiene**: si la pausa cruza el día 90,
`PB4` la archiva.
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
suman ~~los días~~ los meses** y el aviso dice la fecha de fin nueva (FASE 8 completa,
`F-8CB1-001`, owner 2026-09-25: la cortesía temporal es en meses enteros y sólo sobre planes
mensuales, `DEC-GRANT-003` impl. 6 y `DEC-GRANT-004` punto 3).

---

## 6. Pago

La máquina tenía **cinco** estados y gana **un sexto**, `CHARGED_BACK`, con dos filas —`P6` y
`P7`— (FASE 8 completa, `F-8CB3-009`, `DEC-SUB-020`, owner 2026-09-25). El diagrama anterior, sin
él:

```text
  PENDING ──► SUCCEEDED ──► PARTIALLY_REFUNDED ──► REFUNDED
     │             │                                   ▲
     └──► FAILED   └───────────────────────────────────┘
```

El vigente:

```text
  PENDING ──► SUCCEEDED ──► PARTIALLY_REFUNDED ──► REFUNDED
     │          │   ▲ │                                 ▲
     └──► FAILED│   │ └─────────────────────────────────┘
                ▼   │
            CHARGED_BACK      P6 va, P7 vuelve si la disputa se gana
```

El diagrama no dibuja la segunda entrada: **`P6` sale también de `PARTIALLY_REFUNDED`**, y `P7`
vuelve a ese estado cuando el pago ya tenía reembolsos (FASE 8 completa, pendiente 6, owner 2026-09-25).

| # | desde | evento | hacia | nota |
|---|---|---|---|---|
| P1 | `PENDING` | el proveedor acredita | `SUCCEEDED` | si el pago es de una suscripción con una redención de promo cuyo `cobros_restantes` es mayor que 0, **lo decrementa en uno en el mismo acto** (`B/02` §2.4), y si llega a 0 corre `S30`; si cuelga de una instancia de addon, no escribe `covered_period` (`B/02` §2.3) (corrección de diseño, FASE 8 completa, `F-8CB1-007`, `F-8CB1-008`). **Corre también sobre una fila de `payment` que ya existe**: un reintento que se aprueba **dentro del mismo registro de cobro** llega con el mismo id del hecho, y `C6` ya no lo descarta — relee la fila existente y, si está `PENDING` y la lectura por id dice `approved`, corre este `P1` sobre ella (`B/05` C6, §10.2; FASE 8 completa, `F-8CB3-003`). **El período que escribe en `covered_period` sale de la fecha del propio registro de cobro**, no de la fecha del próximo cobro (`B/02` §2.3; FASE 8 completa, `F-8CB3-005`, `F-8CB1-011`). **Si esa escritura choca con el `UNIQUE`** —el período ya tiene un cobro acreditado—, **el pago pasa igual a `SUCCEEDED`**: la plata entró y el hecho se registra, porque rechazarlo dejaba plata sin fila; **no se escribe la cobertura**, y `S14` abre la marca con motivo ~~`COBRO_SIN_REGISTRAR`~~ **`COBRO_DUPLICADO`** (`B/02` §2.5, motivo 20; FASE 8 completa, pendiente 6, owner 2026-09-25) **con el pago colgado**: un período con dos cobros lo mira una persona, con el default de devolver (`B/19` §6) (`DEC-CONC-002` punto 4). **Y emite el comprobante** —el `receipt` de este cobro, `B/02` §2.3, `DEC-LEGAL-001`—, también sobre el pago de un addon de única vez (FASE 8 completa, `F-8CB3-006`). **Y si es el primer pago acreditado de una suscripción, emite el aviso de cobertura** (`12-contrato…` §3): su `cobrada` pasa de `no` a `sí`, que es lo que convierte el trial (`V/03` §2, `T2`; `DEC-TRIAL-010`, owner 2026-09-25) |
| P2 | `PENDING` | ~~el proveedor rechaza~~ **vence la ventana del proveedor sin cobro** | `FAILED` | ~~dispara S4 si era el cobro de una suscripción `ACTIVE`~~ **ya no dispara `S4`**: desde la FASE 8 completa (`R1`) lo dispara el **primer rechazo**, leído por id, con el pago todavía `PENDING` mientras el proveedor reintenta (`B/12` §1.2-§1.3) |
| P3 | `SUCCEEDED` | reembolso total | `REFUNDED` | |
| P4 | `SUCCEEDED` | reembolso parcial | `PARTIALLY_REFUNDED` | |
| P5 | `PARTIALLY_REFUNDED` | otro parcial | `PARTIALLY_REFUNDED` o `REFUNDED` | **los parciales se acumulan y validan contra el saldo, no contra el monto original**; al completarse, el pago pasa a reembolsado solo (`RF-1`, `RF-2`) |
| **P6** ✚ | `SUCCEEDED` — **o `PARTIALLY_REFUNDED`**, con el mismo tratamiento (FASE 8 completa, pendiente 6, owner 2026-09-25) | **se lee `charged_back` en el pago, releído por id** (`D17`) — por el aviso de contracargo del proveedor o por la comprobación de pagos acreditados del barrido (`B/09` §3) | `CHARGED_BACK` | **un contracargo**: el cliente desconoció el cargo ante su banco (`DEC-SUB-020`; FASE 8 completa, `F-8CB3-009`, owner 2026-09-25). **Si la suscripción del pago está en `ACTIVE` o `GRACE_PERIOD` —o en `PAUSED` con motivo `COURTESY` (pendiente 8, owner 2026-09-25)—, corre `S6` por su tercer evento** (§3.2): suspende sin grace y cancela el preapproval. **Esté en el estado que esté la fila, `S14` abre la marca con motivo `CONTRACARGO`** (`B/02` §2.5) con este pago colgado, para que una persona siga la disputa; ~~**desde cualquier otro estado `S6` no tiene fila y lo único que corre es la marca** — qué más corresponde ahí (una `CANCEL_SCHEDULED`, una `PAUSED`) `DEC-SUB-020` no lo dice, y queda en *«lo que esta mitad NO cierra»*.~~ **Cerrado el 2026-09-25 (owner)**: **la regla es una: si la fila da servicio, se corta en el acto; si no, sólo la marca** (`DEC-SUB-020`, su 📌; FASE 8 completa, pendiente 6, owner 2026-09-25). **Una `CANCEL_SCHEDULED` pasa a `CANCELLED` ya**, sin esperar su fecha de fin: es `S12` por su segundo evento (§3.2). **Una ~~`PAUSED`~~ `PAUSED` con motivo `CUSTOMER_REQUEST`, una `SUSPENDED` o una fila terminal sólo abren la marca.** **Y si la fila es la predecesora de una sucesión en curso, `S6` corre igual y la sucesora también se corta** (§3.2, `S6`) **—por `S31`, y también cuando la predecesora es la `CANCEL_SCHEDULED` que `S12` corta** (pendiente 8, owner 2026-09-25). ~~⚠️ **Una `PAUSED` con motivo `COURTESY` sí emite fuente** (`12-contrato…` §2.6), así que ahí *«da servicio»* y *«pausada: sólo la marca»* no dicen lo mismo; el 📌 nombra a la pausada entre las que sólo llevan la marca, y la tensión queda en *«lo que esta mitad NO cierra»*.~~ **Cerrado el 2026-09-25 (owner)**: **una `PAUSED` con motivo `COURTESY` da servicio, así que se corta**: `S6` la toma por su tercer evento, la cortesía se cierra y la fila pasa a `SUSPENDED` (FASE 8 completa, pendiente 8, owner 2026-09-25). **No toca `covered_period`**: ~~la fila queda suspendida,~~ la fila queda cortada o marcada, la vuelta es por una sucesora con su propia cobertura, y si la disputa se gana el pago vuelve ~~a `SUCCEEDED`~~ por `P7` con su período bien escrito. ⚠️ **Documental, no medido** (`RC-8`, `UNKNOWN`): qué campo muestra `charged_back` al releer —el pago embebido del registro de cobro o `/v1/payments/{id}`— no está medido |
| **P7** ✚ | `CHARGED_BACK` | **se lee `reimbursed`**, releído por id: la disputa se resolvió a nuestro favor | `SUCCEEDED` — **o `PARTIALLY_REFUNDED`** | **la plata volvió y el cobro vuelve a valer**. **A cuál de los dos vuelve lo dice el pago mismo**: `PARTIALLY_REFUNDED` si su monto reembolsado acumulado es mayor que cero, `SUCCEEDED` si no —la columna ya está en `payment` (`B/02` §2.3), así que no hace falta guardar de qué estado salió `P6`— (FASE 8 completa, pendiente 6, owner 2026-09-25). **No reactiva la suscripción**: la fila sigue ~~`SUSPENDED`~~ donde la dejó `P6` —`SUSPENDED`, `CANCELLED` o el estado que tenía— y, si la persona quiere, vuelve por el checkout como cualquier suspendido con tarjeta —la sucesión desde `SUSPENDED` que `G-R1-A` admite (`B/20` §2)— (`DEC-SUB-020`). **La marca `CONTRACARGO` se cierra por `S15`**, levantada por la persona que sigue el caso: no se levanta sola, porque `S15` exige una intervención humana registrada. **No emite un comprobante nuevo**: el del cobro ya existe |

**`settled` no es una fila, porque no mueve el estado**: la disputa se perdió, **el pago se queda en
`CHARGED_BACK`**, que pasa a ser su estado final, y la marca `CONTRACARGO` sigue abierta hasta que
la persona la levante por `S15` (`DEC-SUB-020`; `RC-8`, documental).

**Las dos resoluciones le avisan a la persona, con un correo transaccional cada una** (`NUCLEO/07`
§6, `B/19` §4 fila 10-ter; FASE 8 completa, pendiente 8, owner 2026-09-25): al leer `settled`,
*«la disputa se resolvió a tu favor; tu suscripción sigue ~~cancelada~~ **suspendida**; podés
volver cuando quieras»* cuando la fila está `SUSPENDED`, y *«sigue cancelada»* cuando está
`CANCELLED` (FASE 8 completa, owner 2026-09-25); al correr `P7` por `reimbursed`, *«la disputa se
resolvió; el cargo era correcto; podés volver a suscribirte desde acá»*. ~~⚠️ **Qué lectura ve
`settled` no está escrito** (*«lo que esta mitad NO cierra»*).~~ **Cerrado el 2026-09-25 (owner,
FASE 8 completa)**: **el barrido relee también los pagos en `CHARGED_BACK` hasta que su
`status_detail` se resuelva** —`settled` o `reimbursed`—, así que alguien lee el resultado de la
disputa aunque no llegue el aviso del proveedor, y esa lectura dispara el correo que corresponde
(`B/09` §3).

**Por qué hace falta un estado nuevo y ninguno de los cinco alcanza.** Se probó expresarlo con uno
existente y no cierra por ninguno de los dos lados:

- **Dejarlo en `SUCCEEDED` es el defecto**: la fila dice cobrado sobre una plata que el banco se
  llevó, y es exactamente lo que `F-8CB3-009` encontró — *«nadie lo compara»*.
- **`REFUNDED` y `PARTIALLY_REFUNDED` dicen otra cosa y no vuelven**: son el resultado de un
  **reembolso nuestro**, con su fila de `refund` y **quién lo confirmó** (`B/02` §2.3,
  `DEC-RF-002`); `P3` además **libera** el período (`B/02` §2.3). Un contracargo no tiene `refund`
  ni confirmación nuestra, y **se puede deshacer** —`reimbursed`—, mientras que ninguna fila sale de
  un estado de reembolso hacia `SUCCEEDED`. Meterlo ahí obligaba a una vuelta atrás que la máquina
  de reembolsos no tiene, o a inventar un `refund` que nadie confirmó.

~~⚠️ **Lo que `P6` no cubre y queda anotado**: un contracargo sobre un pago **ya
`PARTIALLY_REFUNDED`**. `P6` sale sólo de `SUCCEEDED`, y volver por `P7` a *«el estado que tenía»*
pediría guardar cuál era; no se agregó (*«lo que esta mitad NO cierra»*).~~ **Cerrado el
2026-09-25 (owner)**: un contracargo sobre un pago **ya `PARTIALLY_REFUNDED`** tiene el mismo
tratamiento que sobre `SUCCEEDED` (FASE 8 completa, pendiente 6, owner 2026-09-25). `P6` sale de los dos, y `P7` no necesita guardar
de cuál salió: lo lee en el monto reembolsado acumulado del pago.

**Un reembolso hecho desde el panel del proveedor, sin nuestro flujo, NO corre `P3` ni `P4` solo.**
La comprobación de pagos acreditados del barrido (`B/09` §3) lo ve —un pago nuestro `SUCCEEDED`
que el proveedor da reembolsado, o con más reembolsado que nuestros `refund`— y **`S14` abre la
marca con motivo `REEMBOLSO_FUERA_DEL_FLUJO`** (`B/02` §2.5) con el pago colgado, **sin suspender**:
fue un acto nuestro y no del cliente (`DEC-SUB-020`, *«lo que NO decide»*; `DEC-RF-007`, la
reparación es manual y con rastro). **El `refund` que falta lo asienta la persona al resolverla**,
con quién lo confirmó, y recién ahí corre `P3` o `P4`: escribirlo solo sería un `refund` sin nadie
que lo confirmara, que es lo que `DEC-RF-002` prohíbe.

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
| MP1 | `AWAITING` | el admin registra el pago | `REGISTERED` | la suscripción sale de `GRACE_PERIOD` por `S5` — **o, si la cuota es la PRIMERA y la fila está todavía en `PENDING_AUTHORIZATION`, es este registro el que la habilita a llegar a `ACTIVE`**, por **`S29`** (§3.2, escrita el 2026-09-24; antes decía *«la fila que el capítulo 13 todavía debe»*): ahí no hay grace del que salir, porque no lo hubo — **o queda pendiente por `S19`, si es la predecesora de una sucesión en curso**: el efecto de `MP1` es el de `S5` y hereda su condición, porque el daño no depende de por qué puerta entró el pago. **`S19` lo admite por su propio evento**, que nombra las dos puertas (§3.2): sin eso la derivación apuntaba a una fila que no podía recibirlo. **Y avanza un ciclo la fecha del próximo cobro** (`B/02` §2.2): registrada la cuota de este período, lo que queda por cobrar es el siguiente. Es **acá** y no en `S5`, cuya celda de efectos es *«se apaga el reloj»* y nada más (§7.2, *«qué mueve la fecha»*). **Y emite el comprobante** —el `receipt` de esta cuota, colgando del `manual_payment` (`B/02` §2.3, `DEC-LEGAL-001`; FASE 8 completa, `F-8CB3-006`)— |
| MP2 | `AWAITING` | el admin confirma que no se pagó | `DECLARED_UNPAID` | la suscripción va a `SUSPENDED` por `S6`, sin esperar el reloj |
| MP3 | `AWAITING` | se agota el grace sin que el admin haga nada — **o, sobre la PRIMERA cuota, se agota la ventana de autorización y `S3` se lleva la fila a `ABANDONED`** (§7.2, *«cómo entra el grace»*) | `DECLARED_UNPAID` | `S6` por la primera cláusula. **Por la segunda, ninguno**: la fila de suscripción ya la mató `S3`, y lo que esta transición hace es cerrar la cuota para que no quede un `AWAITING` colgando de una suscripción muerta |
| MP4 | `DECLARED_UNPAID` | el admin registra el pago, que llegó **después** | `REGISTERED` | la suscripción sale de `SUSPENDED` por `S7` — **o queda pendiente por `S19`, si es la predecesora de una sucesión en curso**: misma herencia y misma razón que `MP1`, porque **el daño no depende de por qué puerta entró el pago** ni de desde qué estado del pago manual se lo registre. **`S19` lo admite por su propio evento**, que nombra el hecho —entró el pago del período impago— y no el mecanismo (§3.2). **Y no es incondicional**, por partida doble: el cruce de `C5` vale igual que en `MP1`, y `S7` exige **las cuatro condiciones del `B/05` §3** — la **1** es el tope de la reapertura (ver abajo, *«el tope no es un día»*). **Y avanza un ciclo la fecha del próximo cobro, igual que `MP1`** — **y si el período que esa cuota cubre YA TERMINÓ**, o sea si la suspensión duró más que un período, **antes de registrarla la reimputa al período que arranca en la reactivación** (§7.2, *«al reabrir por `MP4`»*): el avance sale entonces de ese período nuevo y la fecha queda en **la reactivación más un ciclo**. Dejar la fecha **en** la reactivación era abrirle la cuota del período que arranca en la misma corrida del reloj, con `S4` devolviéndolo a `GRACE_PERIOD` el mismo día — dos períodos cobrados y ningún día comprado. Y avanzar siempre al día de la reactivación, sin mirar si el período terminó, le cobraba dos veces los días que le quedaban del período que acababa de pagar. **Y emite el comprobante**, igual que `MP1` (`B/02` §2.3, `DEC-LEGAL-001`; FASE 8 completa, `F-8CB3-006`) |
| MP5 | *(sin fila)* | **dos cláusulas, un mismo acto — abrir la cuota de un período**: *(a)* **un reloj abre el período** de una suscripción de pagador manual, porque **llegó la fecha del próximo cobro** (`B/02` §2.2), que es el instante en que el proveedor habría cobrado (§7.2); *(b)* **el alta de un pagador manual abre su PRIMERA cuota** — y el alta es **`S1`**, que ya existe (§3.2) —, que es el espejo del primer cobro que en un pagador con tarjeta ocurre antes de `S2` | `AWAITING` | **es la entrada de esta máquina, y la crea el sistema, no un admin.** La cláusula *(a)* **sólo corre con la suscripción en `ACTIVE`** —los otros cinco estados vivos están descartados uno por uno en el §7.2— y **en el mismo acto la suscripción entra en `GRACE_PERIOD` por `S4`**, que es lo que el §30 ya ordenaba abajo y lo que `MP1` y `MP2` ya presuponían en sus efectos. La cláusula *(b)* corre en **`PENDING_AUTHORIZATION`** y **no dispara `S4`**: el `desde` de `S4` es `ACTIVE`, así que la primera cuota **no abre grace** y la fila no da servicio hasta que se registre (§7.2, *«cómo entra el grace»*). **El par `(desde, evento)` sigue siendo uno solo** —*(sin fila)*, abrir una cuota— con sus dos cláusulas, igual que `S9` tiene tres y `A5` tres: `G-R4` no gana ningún par. **Idempotente por condición**: no crea si ya existe una fila de `manual_payment` para ese período, igual que `S13` y `S20` son *«idempotentes y reanudables fila por fila»* |

**Lo que el §30 agrega y la máquina tiene que cumplir**: si falta el pago, va a `GRACE_PERIOD`
**los mismos días configurables** que el resto (`DEC-SUB-002` vale igual acá) — **con una
excepción, y es la primera cuota**: ahí no hay grace, porque el grace no es un beneficio de entrada
(`B/12` §4.3) y la fila todavía no dio servicio; lo que corre ahí es la ventana de autorización
—que **sobre un pagador manual dura 7 días corridos y no 72 h** (`DEC-SUB-016`, §3.4 punto 1),
porque lo que espera es que se acredite una transferencia y no que alguien termine un checkout—
(§7.2, *«cómo entra el grace»*). **Y además se notifica al admin** — que es el único caso donde una
notificación es parte del flujo y no un efecto colateral, porque sin ella nadie va a registrar
nada. **Desde `MP5` eso tiene sujeto y momento**: el reloj crea la cuota y el aviso sale sobre
ella; hasta acá era una obligación sin fila de la que colgar.

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
alguien que está tratando de volver. ~~Es la misma elección que `DEC-SUB-003` ya hizo para el
cambio de plan en grace: que el camino de recuperación sea **una salida del problema en vez de un
muro**.~~ **El precedente que se citaba acá —`DEC-SUB-003`, el cambio de plan en grace como salida
del problema— se cayó**: lo superó `DEC-SUB-021` (owner 2026-09-25), que en el grace no deja cambiar
de plan y pide regularizar primero. **La razón de este § no dependía de él**: la persona puso plata,
y eso alcanza.

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
   la inactividad **cuatro hechos de reinicio** con lista cerrada (`NUCLEO/01` §1.2) —**hoy cinco**:
   el quinto, ~~*«la ficha deja de estar publicada porque perdió la cobertura»*~~ *«el dueño pierde la cobertura en la vertical»*, escrito en todas sus fichas en ella (FASE 8 completa, owner 2026-09-25), FASE 8 completa,
   `F-8CA2-001`, owner 2026-09-25—, y el primero
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

**Entonces `S7` sin escala**, con su efecto ya escrito —~~*«se restituye la publicación»*~~ *«la fila vuelve a emitir fuente»*, y la publicación la restituyen `PB3`/`PB7` si el cupo alcanza (`F-8CA2-016`)—: la fila
vuelve a emitir fuente con `hasta: SIN_FECHA_CONOCIDA` (`12-contrato…` §2.6), `cubierto` vuelve a
verdadero y la ficha que `PB4` hubiera archivado **vuelve sola por `PB7` si el cupo del plan le
alcanza** (`V/03` §9). No hace
falta un estado intermedio: el que lo necesitaría es el que tiene una autorización que confirmar,
y acá o no hay ninguna o la fila ya se murió.

#### Lo adeudado: no hay deuda vieja que perseguir, porque el pago que reabre ES la cuota

**`B/12` §5.3 decidió que *«la deuda vieja no se persigue por separado»*, y acá esa regla no se
aplica — no porque se la contradiga, sino porque su población no existe.** Allá el cliente cambia
de plan y **deja atrás** la cuota impaga, así que hay algo que decidir no perseguir. Acá el cliente
**la paga**: `MP4` actúa sobre **la misma fila de `manual_payment`** que `MP2` o `MP3` cerraron
—nunca crea una— y registrarla liquida lo que se debía.

**Qué período liquida depende de si el de esa cuota todavía corre, y son dos ramas.** Si **todavía
corre** —la reapertura cae adentro del período que se está pagando—, es ése: no queda remanente que
compensar ni que cobrar aparte. Si **ya terminó** —la suspensión duró más que un período—, la cuota
se **reimputa** al período que arranca en la reactivación y lo que el pago liquida es **ése**
(§7.2, *«al reabrir por `MP4`»*). **En ninguna de las dos ramas queda remanente**: los períodos que
transcurrieron enteros bajo la suspensión no se cobran ni quedan como deuda, que es la mitad (b) de
la decisión del owner del §7.2.

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
> declaraba la entrada a `AWAITING`. La contesta el **§7.2** con `MP5`: **las crea el sistema —un
> reloj de la segunda en adelante, el alta la primera— y no las crea durante la suspensión**. `MP4`
> sigue sin crear filas de `manual_payment`: sólo mueve la que `MP2` o `MP3` cerraron, y **desde
> esta pasada también la reimputa** cuando el período que cubría ya terminó (§7.2).

#### Es una fila nueva y no el `desde` de `MP1` ampliado

**Ampliar `MP1` a `{AWAITING, DECLARED_UNPAID}` habría sido una fila con dos efectos según de
dónde viene**, y este capítulo ya tiene escrito por qué eso no se hace: *«una transición cuyo
`desde` se escribe como un conjunto de filas tiene que decir si alcanza también a…»* (§3). Los dos
efectos difieren de verdad y no en el matiz: `MP1` saca de `GRACE_PERIOD` por **`S5`** y `MP4` saca
de `SUSPENDED` por **`S7`**, que son dos transiciones distintas de la tabla del §3.2 con dos
condiciones que se evalúan sobre estados distintos. Con una sola fila, la derivación habría
quedado escrita como *«`S5`, o `S7` si venía de `DECLARED_UNPAID`»*, que es la forma que la regla 1
del núcleo no puede verificar.

**Y `MP4` no agrega ningún par con dos filas, así que el conteo de `G-R4` no se mueve — y son
cuatro desde `S25`, no tres** (`NUCLEO/03` §1 regla 7; esta frase decía *«sigue contando tres»* y
caducó con `DEC-SUB-015`, que creó el cuarto par sin tocar este §). Comparte el
evento con `MP1` —*«el admin registra el pago»*— y **compartir el evento no es compartir el par**
(`NUCLEO/03` §1 regla 7): el `desde` de una es `AWAITING` y el de la otra `DECLARED_UNPAID`, y
ninguna otra fila de esta tabla sale de ninguno de los dos con ese evento. Del lado de la tabla del
§3.2 **tampoco agrega uno**, por el argumento que el §3.2 ya escribió para `MP1`: `MP4` no es un
evento de esa tabla sino un efecto que entra por *«entra el pago»*, que `S7` y `S19` ya compartían.

#### Lo que NO cambia, y hay que contarlo para que nadie lo recuente

- **El barrido de `B/09` §3 no gana ninguna puerta por `MP4`, y sigue con cuatro salvedades.** Sus
  puertas son ~~**quince**~~ **dieciséis**, recontadas sobre la tabla de `B/09` §3 —las agregaron `S22`, `S23`, `S24`, `S25`, `S27`, `S28` **y `S31`** (la última, FASE 8 completa, owner 2026-09-25), no `MP4`—, y todas son
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
  comprobante»* (`B/02` §2.3), que es lo que `MP4` escribe — **y el `período`, que también ya
  existe, cuando la reimputación del §7.2 corre**; los dos actos —declarar el impago y reabrirlo—
  quedan distinguibles en el registro de eventos de dominio, que la regla 4 del `NUCLEO/03` §1
  exige por cada transición, y ahí va también el período que la cuota tenía antes de reimputarse.

#### Qué premisa de otro arreglo vuelve falsa este, y dónde quedó resuelta

La obligación 2 de `DEC-METH-008`, contestada por escrito. **Es una y está corregida en su
lugar**, más cuatro apariciones que quedan como estaban con su razón:

| premisa | de quién era | qué pasa | dónde |
|---|---|---|---|
| *«por esta puerta `S7` es inalcanzable, y no es un hueco sino aritmética de los dos estados»* | el arreglo que le abrió a `S19` la segunda puerta (§3.2, familia del pago manual de la 9-bis-3) | **queda FALSA**: con `MP4` hay una transición que sale de `DECLARED_UNPAID`, así que el pago manual llega sobre una `SUSPENDED` y `S7` es su destino | corregida en §3.2, con la premisa vieja citada |
| *«`S19` admite las dos puertas»* | el mismo arreglo | **sigue verdadera**, y por eso `MP4` no necesita ampliarla: el evento se enuncia sobre el hecho y no sobre el mecanismo, que es lo que esa corrección dejó escrito | §3.2, con `MP4` nombrado en la celda de `S19` |
| *«la regla se ejecuta en tres lugares»* (`G-R1-D`) | el mismo arreglo, en `B/20` §2 | **queda incompleta**: son cuatro | corregida en `B/20` §2 |
| *«los estados terminales de una suscripción no se barren»* y sus puertas —**nueve** cuando se escribió esta fila, ~~**quince**~~ **dieciséis** hoy, con `S31` (FASE 8 completa, owner 2026-09-25)— | `B/09` §3, y `B/16` §4.4 que las contó | **sigue verdadera**: `DECLARED_UNPAID` es del `manual_payment` y nunca estuvo en esa tabla, cuyos sujetos son `CANCELLED`, `ABANDONED` y `CHARGE_DECLINED` | sin tocar |
| *«la tabla tiene DOCE filas»* (`NUCLEO/08` §3) y las cinco líneas que la cuantifican | el arreglo del anclaje de verticales | **sigue verdadera**: `MP4` es la fila *«registrar un pago manual»* ejecutada desde otro origen, no una acción nueva | sin tocar |
| *«el crédito de `DEC-SUB-006` se computa en cero en grace»* y las ramas de `B/12` §5.3 | el arreglo del pago tardío | **siguen verdaderas**: `MP4` hereda la condición de `S19`, así que no reactiva durante una sucesión y el pago se resuelve por las mismas ramas — que desde `S23` son **seis** y no cinco, y no las recontó este arreglo | `B/12` §5.3, con `MP4` nombrado en la puerta manual |

---

### 7.2 La cuota la crea el sistema —un reloj, salvo la primera— y no se crea durante la suspensión

**La máquina tenía cuatro salidas y ninguna entrada.** `MP1`, `MP2` y `MP3` salen de `AWAITING`,
`MP4` de `DECLARED_UNPAID`, y **nadie declaraba quién crea la fila `AWAITING` ni cuándo**: es
`F-8B2-018`, anterior a `MP4`. Por la regla 1 del `NUCLEO/03` una máquina sin transición de
entrada no se alcanza nunca, así que las cuatro salidas describían un trámite que no empezaba en
ningún lado — y con ellas se caían el grace del §30 y su aviso al admin, que cuelgan de una cuota
que nadie creaba.

> **Decisión del owner, 2026-09-21, y son dos mitades.**
> **(a)** La cuota **la crea el sistema**, al inicio de cada período, para toda suscripción de
> pagador manual — **el mismo instante en que el proveedor habría cobrado**. No la crea un admin
> a mano: una cuota que nadie crea es **servicio gratis en silencio**, y el §30 le pide al admin
> *«registrar»* un pago, no inventarle la obligación. **De la segunda en adelante la abre un
> reloj; la primera la abre el alta**, porque tiene que estar registrada antes de que la fila dé
> servicio (abajo, *«cómo entra el grace»*) — son las dos cláusulas de `MP5` y el mismo acto.
> **(b)** **No se crean mientras la suscripción está `SUSPENDED`.** El que vuelve paga el período
> que arranca, no los que pasó suspendido.
>
> Lo ejecuta **`MP5`** (§7).

**La razón de (b) ya estaba decidida dos veces, y esto no agrega criterio.** `B/12` §5.3 dice que
*«la deuda vieja no se persigue por separado»* y `DEC-SUB-012` dice que el que paga tarde **paga
esa cuota** y no un remanente (§7.1, *«lo adeudado»*). Acumular cuotas durante la suspensión
construiría exactamente el remanente que las dos descartaron, y sobre alguien que **no tuvo
servicio**: `S6` deja la fila *«sin listado público, sin edición, sin creación, sin entitlements
comerciales»* (§3.2). Cobrar meses de eso es cobrar nada. ~~Y es la misma elección de `DEC-SUB-003`:
que volver sea *«una salida del problema en vez de un muro»* — una deuda de seis meses esperando
en la puerta es el muro.~~ (La tercera razón que se citaba acá era `DEC-SUB-003`, superada por
`DEC-SUB-021`, owner 2026-09-25; las dos de arriba alcanzan solas.)

#### Desde qué estados de la suscripción se crea: el reloj sólo en `ACTIVE`, y los otros cinco uno por uno

Los estados vivos son **seis** (`B/02` §2.2). **El reloj —la cláusula *(a)* de `MP5`— corre sobre
uno**, y los otros cinco no quedan afuera por decisión sino porque en cada uno falta el sujeto o el
período no arranca. **La cláusula *(b)*, que abre la primera cuota, corre sobre otro**, y es la
única excepción de la tabla:

| estado | ¿se crea la cuota? | por qué |
|---|---|---|
| `ACTIVE` | **sí** | es el caso: el período arranca y hay una obligación de pago que constatar |
| `SUSPENDED` | **no** | es la mitad (b) de la decisión del owner |
| `PENDING_AUTHORIZATION` | **el reloj no**, `S1` **sí** | **el reloj no tiene qué leer**: todavía no hay fecha del próximo cobro —la estrena `S2` al arrancar el período (§3.2)—, así que la cláusula *(a)* de `MP5` no corre acá. La que corre es la **cláusula *(b)***, en el acto del alta: la **primera** cuota se abre en este estado, y no en `ACTIVE`, porque tiene que estar **registrada antes** de que la fila dé servicio — si se abriera desde `ACTIVE`, `S4` la mandaría a `GRACE_PERIOD` con servicio entero sin que nadie haya pagado, que es lo que `B/12` §4.3 prohíbe. **Su período es el instante del alta**, porque acá no hay fecha que copiar, y la fecha la estrena `MP1` al registrarla (abajo, *«cómo entra el grace»*) |
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

La primera cláusula de `MP3` sale de *«se agota el grace»* y el grace tenía el mismo problema que
`AWAITING`: **`S4`
describe *«un cobro falla»* y en el pago manual nadie cobra**. Con `MP5` el hecho queda nombrado
y **no hace falta una fila nueva**: para una suscripción sin débito, *«el cobro de este período
falló»* **es** que su cuota se abrió y no hay pago acreditado contra ella. Es lo que este § ya
ordenaba abajo de la tabla —*«si falta el pago, va a `GRACE_PERIOD` los mismos días
configurables»*— y lo que `MP1` y `MP2` ya presuponían: los dos declaran que la suscripción está
en `GRACE_PERIOD` cuando el admin actúa. Así que `S4` es la fila, con su `desde` en `ACTIVE`, que
es el único estado desde el que **el reloj** —la cláusula *(a)* de `MP5`— crea.

**Pero eso vale de la SEGUNDA cuota en adelante, y hay que decir por qué la primera es otra cosa.**
`B/12` §4.3 ordena que **el grace no sea un beneficio de entrada**, y esa regla **sí alcanza a un
pagador manual**: su sujeto es el grace, no la autorización. Lo que se lee *«por autorización»* es
el **predicado de `S16`**, que es el **remedio** —mandar a `CHARGE_DECLINED` al que autorizó y no
cobró—, y ese remedio acá no tiene sujeto: `S16` exige que sea el primer cobro de esa autorización
y que el proveedor la haya cancelado al rechazarlo, y un pagador manual **no tiene autorización en
el proveedor** (`B/06` §7), así que las dos mitades son falsas y `CHARGE_DECLINED` tiene acá
población vacía. **Que el remedio no tenga sujeto no vuelve inaplicable la regla: la deja sin
ejecutor**, y sin uno el §4.3 se viola en su forma más literal — quien contrata con pago manual
recibiría los días de `DEC-SUB-002` **con servicio entero sin haber transferido un peso**, y desde
que `S23` libera el candado `A` (§3.2) podría repetirlo **por intento**, que es la palabra con que
el §4.3 describe el daño que rechazó.

> **La regla, con su ejecutor sobre esta población.** **La primera cuota de un pagador manual no
> abre grace.** La abre la cláusula *(b)* de `MP5` **en el alta —`S1`, §3.2—**, o sea con la fila
> en `PENDING_AUTHORIZATION` y no en `ACTIVE`,
> así que `S4` —cuyo `desde` es `ACTIVE`— no corre sobre ella; mientras esa cuota no esté
> registrada la fila **no emite fuente** (`12-contrato…` §2.6) y no hay servicio que cosechar. Su
> ventana es la de la autorización, y su final ya está escrito: **`S3` la lleva a `ABANDONED`**,
> que **no es vivo**, con lo que el candado `A` queda libre y el reintento es un alta nueva —
> exactamente el desenlace que `CHARGE_DECLINED` le da al pagador con tarjeta.

**Qué período cubre esa primera cuota, que hay que decirlo porque al abrirse no hay fecha que
copiar.** El resto de las cuotas copian *«la fecha del próximo cobro»* vigente (`B/02` §2.3), y en
`PENDING_AUTHORIZATION` esa columna todavía no existe. **El período de la primera es el instante
del alta** —el de `S1`—, que es un valor que existe cuando la cuota se abre y deja el `período`
escrito de entrada, como esa entidad exige. **Y la fecha del próximo cobro la estrena `MP1` al
registrarla**, un ciclo más adelante, por la escritura 2 de arriba: sobre un pagador manual la
escritura 1 —*«la estrena `S2`»*— tiene **población vacía**, porque el evento de `S2` es un webhook
de autorizada y acá no hay preapproval que autorice. **Los días que van del alta al registro corren
adentro de ese período y no se reponen**, que es la misma regla de *«nada es retroactivo»* del §7.1
y lo que impide que abrir el alta y transferir al filo de la ventana corra el ciclo gratis.

**Y con eso la garantía de no-repetición del §4.5 punto 1 gana sujeto acá.** Esa garantía dice que
*«no hay diez días que cosechar por más veces que se repita»* porque **cada reintento muere sin
pasar por `GRACE_PERIOD`**; el pagador con tarjeta muere en `CHARGE_DECLINED` y el pagador manual
que nunca transfiere muere en `ABANDONED`, y en los dos casos lo que no hubo es grace. La cuota
queda cerrada por la segunda cláusula de `MP3`, para que no sobreviva un `AWAITING` colgando de una
suscripción muerta.

**Lo que falta y lo que no.** Abrir la primera cuota **no** falta: lo hace `S1`, que ya está
escrita, y por eso esta regla tiene ejecutor hoy y no el día que alguien escriba el capítulo 13.
Lo que falta es **la transición que lleva un pagador manual a `ACTIVE`** —el evento de `S2` es
*«webhook de autorizada»* y acá no hay preapproval que autorice, que es el hueco que el capítulo 13
tiene abierto—, y esta regla **la ata por adelantado**: **esa fila no puede llevar a `ACTIVE` sin
la primera cuota registrada**. Va escrito acá porque es acá donde alguien la escribiría sin verla.

> ✅ **Cerrado el 2026-09-24: la fila existe y es `S29`** (§3.2). La condición que este párrafo ató
> por adelantado **se cumple por construcción**, porque el evento de `S29` **es** el registro de la
> primera cuota. Y la jurisdicción quedó donde este párrafo la reclamaba: **la fila vive en esta
> tabla, no en el capítulo 13**, que desarrolla el flujo del pagador manual y la referencia. Lo
> único que hubo que agregarle y este párrafo no anticipaba: **`S29` NO mueve la fecha del próximo
> cobro**, porque ya la mueve `MP1` y repetirlo daría **dos ciclos** de crédito.
**El que cuenta es el pago acreditado y nunca la fecha**, que es el punto 2 del mismo §4.5.

**Y la duración de esa ventana ya está elegida, y no es la de `S3` para el pagador con tarjeta.**
Era la única declarada —**72 h**, escrita para el tiempo que tarda alguien en completar un
checkout, no para el que tarda una transferencia en acreditarse—, y `DEC-SUB-016` la partió: sobre
un pagador manual la ventana de `S3` dura **7 días corridos** (§3.4 punto 1). **La regla de este §
no cambia ni depende de la cifra**: lo que la sostiene es que la fila **no dé servicio** durante la
ventana, y eso vale igual con 72 h que con 7 días. Lo que la cifra cambia es a quién se pierde: con
las 72 h, el pagador manual que transfiere un viernes muere en `ABANDONED` y tiene que rehacer el
alta entera.

#### Qué mueve la fecha del próximo cobro: tres escrituras, y ninguna cuarta

La columna es la de `B/02` §2.2, y sobre un pagador manual **es la única copia que existe** —no
hay proveedor que la tenga—. **Son tres escrituras y no hay una cuarta. Lo que la reapertura larga
necesita no es otra escritura de esta columna: es una reimputación de la cuota, que se escribe
sobre el `período` del `manual_payment` y no sobre esta fecha** (abajo, *«al reabrir por `MP4`»*).

> **Y que sean TRES y no cero es lo que `G-R6` vigila desde la FASE 9-bis-4** (`B/20` §2,
> `DEC-TEST-001`). El defecto que este § arregló —`MP5` disparando sobre una columna que **ninguna
> transición avanzaba**, o sea el pagador manual que paga *una vez en la vida* y sigue cubierto
> para siempre— no lo detecta ninguna lectura de la fila ni ninguna comparación del barrido: los
> dos lados coinciden **porque el dato no se movió de ninguno de los dos**. Lo único que lo ve es
> **cruzar las columnas que las condiciones leen contra las que las transiciones escriben**, y eso
> es una propiedad del texto, no de una ejecución.

1. **La estrena `S2`**, con su efecto ya escrito: *«arranca el período»* (§3.2). La fila llega a
   `ACTIVE` y la fecha es ese instante. **Sobre un pagador manual esta escritura tiene población
   vacía** —el evento de `S2` es un webhook de autorizada y acá no hay preapproval que autorice—, y
   ahí la estrena **`MP1` al registrar la primera cuota**, que `S1` abrió con el instante del alta
   como período (abajo, *«cómo entra el grace»*). **No es una cuarta escritura**: es la 2, con su
   primera ocurrencia.
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

**Y una reimputación, que corre SÓLO en `MP4`**: si el período que la cuota cubre **ya terminó**
en el instante de la reactivación, esa cuota se reimputa al período que arranca ahí, y el avance
del punto 2 sale del período nuevo. Las otras dos vueltas a `ACTIVE` no la necesitan y no la
llevan, y conviene decir por qué cada una:

| vuelta a `ACTIVE` | qué hace con la fecha | por qué |
|---|---|---|
| `S7` por `MP4`, desde `SUSPENDED` | **avanza un ciclo desde el período que la cuota cubre, que la reimputación puede haber movido** | ahí no hubo servicio —`S6` deja la fila *«sin listado público, sin edición, sin creación, sin entitlements comerciales»* (§3.2)— y es la mitad (b): el que vuelve paga **el período que arranca**, no los que pasó suspendido. Es la reimputación la que lo cumple: sin ella el pago liquida un período que transcurrió entero suspendido y el reloj le abre el que arranca en la misma corrida |
| `S10`, desde `PAUSED` por cortesía | **avanza los ciclos vencidos, sin reimputar y sin cuota** | es el punto 3. Ahí no hay nada que reimputar: durante la cortesía **no se abrió ninguna cuota**, así que no existe una fila cuyo período haya quedado atrás, y el avance llega al primer vencimiento posterior a la vuelta sin dejar nunca una fecha pasada |
| `S5`, desde `GRACE_PERIOD` | **no escribe nada** | el avance ya lo escribió `MP1`, que es el pago que produjo esta vuelta. Y no hay nada que reimputar: en grace *«el servicio sigue entero»* (`S4`, §3.2), así que el período de esa cuota **sigue corriendo** y es exactamente el que el pago cubre |

**Ninguna de las tres puede colisionar, y conviene decirlo porque parece que sí**: las tres dejan
una fecha **estrictamente posterior** a la que había, y las cuotas que existen son las de períodos
que arrancaron antes. El `UNIQUE(subscription_id, período)` de `B/05` §C5 y la condición de
idempotencia de `MP5` siguen sin tener contra qué chocar (`B/02` §2.3). **Y la reimputación tampoco
colisiona**: el período al que mueve la cuota arranca en la reactivación, y bajo la mitad (b)
**durante la suspensión no se creó ninguna cuota**, así que no hay otra fila con ese período contra
la que chocar.

#### Al reabrir por `MP4`: el reloj vuelve a crear, y si el período viejo ya terminó la cuota se REIMPUTA

Si estuvo `SUSPENDED` no se crearon cuotas, así que hay que decir qué pasa cuando vuelve.

> **`MP4` lleva la fila a `ACTIVE` por `S7`, y desde ese instante el reloj vuelve a crear.** Lo
> que la persona paga es **un** período, y cuál es depende de si el de la cuota todavía corre:
>
> - **Todavía corre** —la reapertura cae adentro de él—: la cuota queda donde está y la fecha del
>   próximo cobro **avanza un ciclo** desde el inicio de ese período, igual que en `MP1`.
> - **Ya terminó** —la suspensión duró más que un período—: **antes de registrarla, `MP4`
>   reimputa la cuota al período que arranca en la reactivación** —le reescribe el `período`
>   (`B/02` §2.3), sobre la misma fila que `MP2` o `MP3` cerraron— y el avance de un ciclo sale de
>   ahí, así que la fecha queda en **la reactivación más un ciclo**.

**Dejar la fecha EN la reactivación era cobrarle dos períodos y no venderle ninguno.** El que se
atrasa, pasa tres meses `SUSPENDED` y transfiere el día 100 liquida con ese pago el período que
arrancó el día 0 —el que pasó **casi entero suspendido**—, y como la fecha del próximo cobro queda
en el día 100, **la primera corrida del reloj encuentra que la fecha ya llegó y que ese período no
tiene cuota**: `MP5` abre la del período que empieza hoy y `S4` lo devuelve a `GRACE_PERIOD` **en
el mismo acto**. El día que volvió debe dos períodos completos y lo que su plata compró son **cero
días**. La reimputación es lo que lo cierra: el pago compra el período que arranca, la fecha queda
un ciclo por delante y el reloj no encuentra nada que abrir hasta entonces.

**Y es literalmente la mitad (b), que hasta acá se cumplía a medias.** *«El que vuelve paga el
período que arranca, no los que pasó suspendido»*: sin reimputar, pagaba el que pasó suspendido
—`MP4`— **y** el que arranca —`MP5`, el mismo día—; con la reimputación paga **el que arranca y
nada más**, y los períodos que transcurrieron bajo la suspensión no se cobran ni quedan como deuda
(§7.1, *«lo adeudado»*).

**Re-anclar siempre a la reactivación era el otro doble cobro, y hay que decir sobre quién.** El
que se atrasa, transfiere **el día 20 de un período que arrancó el día 0** y paga el importe del
período entero (`B/05` §3, condición 2) tiene diez días por delante que ya pagó. Con el re-anclaje
incondicional esos diez días pasaban a ser el arranque del período **siguiente**: el reloj le abría
la cuota en el acto y `S4` lo devolvía a `GRACE_PERIOD` el mismo día. **Pagaba dos veces los días
20 a 30**, y ni el correo ni la pantalla lo decían. Como la reimputación **sólo corre cuando el
período ya terminó**, ese caso no la toca: la fecha queda en el día 30, el reloj no encuentra nada
que abrir hasta ese día, y los diez días son los que compró.

**Las cuatro condiciones del `B/05` §3 se evalúan igual, y hay que decir por qué la reimputación no
las mueve.** La **2** —*«el monto coincide con el esperado para el período que cubre»*— no depende
de cuál sea el período: el monto **no se guarda**, se resuelve de la versión de plan anclada
(`B/02` §2.3), que la reimputación no toca, así que evaluarla antes o después del cambio da la
misma respuesta. La **4** —*«no hay otro pago acreditado para el mismo período»*— se evalúa sobre
el período reimputado y no encuentra ninguno, porque durante la suspensión no se creó ninguna cuota
(la mitad (b)). Las condiciones **1** y **3** no nombran ningún período.

**Y la reimputación se asienta, porque una columna que se reescribe sin rastro no es auditable.**
Va en el evento de dominio de `MP4`, que la **regla 4** del `NUCLEO/03` §1 ya exige por cada
transición: ahí quedan el período que la cuota tenía y el que pasó a cubrir, que es lo que permite
contestar *«¿qué compró esta transferencia?»* sin reconstruirlo. **Es la única escritura del
`período` que no es la de su creación**, y `B/02` §2.3 la declara como tal.

**Lo que la reimputación NO le devuelve son los días que consumió en grace adentro del período que
ya no se le cobra.** Ese período se abrió, la persona tuvo servicio entero mientras corrió el grace
(`S4`, §3.2) y después `S6` se lo cortó; al reimputar la cuota, ese tramo queda **sin cobrar**. Es
el precio de la política de retención del §20, que el §21 acota cortando el servicio en cuanto el
grace se agota — y **no es un beneficio de entrada**, porque sobre un pagador manual el grace sólo
alcanza a una suscripción que **ya tiene al menos un pago acreditado** (abajo, *«cómo entra el
grace»*): nadie llega a ese tramo sin haber pagado antes.

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

**Y no le regala nada a nadie, en ninguna de las dos ramas.** Con el período todavía corriendo, lo
que `MP4` registra **es la cuota del período impago** —la misma fila que `MP2` o `MP3` cerraron,
por el importe esperado (§7.1, *«lo adeudado»*)—, y lo que **no** le devuelve son los días que pasó
en grace y suspendido adentro de ese período: *«nada es retroactivo»* (§7.1), y ésa es la
consecuencia de no haber pagado a término, no un cobro nuevo. Con el período ya terminado, lo que
registra es **un** período —el que arranca— por el mismo importe, y lo que no le devuelve son los
meses que pasó suspendido, que no se cobran y tampoco se prestaron.

**La reimputación es de esta puerta, y el avance no.** Sobre un pagador con tarjeta **no hay nada
que reimputar**: las fechas las tiene el proveedor y son inmutables (`EX-39`, `B/12` §5.4), y sobre
esa población la columna es una copia que ninguna regla lee para decidir (`B/02` §2.2) — además de
que ahí no hay cuota de `manual_payment` que mover. Sobre un pagador manual la reimputación corre
**sólo acá**, porque es la única vuelta a `ACTIVE` que puede encontrar una cuota cuyo período ya
terminó. El **avance**, en cambio, no es sólo de `MP4` —la vuelta de una cortesía lo necesita
igual—, y por eso está escrito arriba como la tercera escritura y no adentro de esta puerta.

#### La pausa: no contradice el `B/06` §7, y por dos razones distintas

`B/06` §7 dice que un pago manual mensual **no tiene nada que pausar porque no hay débito que
detener**, y de ahí que `puedePausar()` dé `false` sin excepción escrita. La regla de arriba **no
lo contradice**:

1. **Para `CUSTOMER_REQUEST` la población es vacía.** `S8` exige `puedePausar()` (§3.2) y sobre un
   pagador manual mensual eso es `false`, así que **no hay pausa pedida que pueda existir**. Decir
   que el reloj no crea ahí no le devuelve al método una capacidad que el §7 le negó: no hay a
   quién aplicárselo.
2. **Para `COURTESY` sí hay población, y no crear es lo que la cortesía significa.** `S9` no pasa
   por `puedePausar()`: su condición es *«no hay pausa vigente»* (`DEC-GRANT-004`) — **más, desde
   la FASE 8 completa (`F-8CB1-001`, owner 2026-09-25), el término del ciclo mensual y los meses
   enteros** (§3.2, `S9`), que un pagador manual mensual cumple. **`S9` toma SÓLO ese término** de `puedePausar()`: ni
   `permitePausa`, ni la cuota de pausa, ni la composición del `B/06` §7 (**decidido por el owner el 2026-09-25**: la cortesía es un regalo nuestro, no un pedido del cliente, así que no gasta su cuota de pausas, no depende de que el plan permita pausar, y alcanza al pagador manual, cuya fecha de cobro es nuestra). Ahí el
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
  momento** — sale cuando la cuota se abre sin pago contra ella, que **de la segunda cuota en
  adelante** es el mismo instante en que `S4` entra al grace. **Sobre la primera no hay `S4` que
  coincida** —se abre en el alta y no hay grace (abajo, *«cómo entra el grace»*)—, y el aviso sale
  igual, en el instante en que la cuota se abre: lo que lo dispara es la cuota sin pago, no el
  cambio de estado. Lo que `MP5` aporta no es un aviso más: es **el sujeto** que ese aviso no
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
  `(sin fila, se abre la cuota de un período)` y **ninguna otra fila de esta tabla sale de
  *(sin fila)***, así que tiene una sola. **Sus dos cláusulas no son dos pares**: son dos
  disparadores del mismo evento sobre el mismo `desde`, exactamente como los **tres** de `S9` y las
  **tres** de `A5`, que tampoco los suman. Del lado de la tabla del §3.2 tampoco agrega uno: el
  efecto de la cláusula *(a)* entra por `S4`, que ya existe y cuyo par `(ACTIVE, un cobro falla)`
  sigue teniendo una sola fila, y la *(b)* **no tiene efecto sobre esa tabla** — es precisamente lo
  que la hace no ser un beneficio de entrada.
- **El barrido de `B/09` §3 no gana nada por `MP5`: sigue con cuatro salvedades y las
  comprobaciones de cero llamadas que tenga —**seis** desde `DEC-GRANT-007`—, y sus puertas son
  ~~**quince**~~ **dieciséis**, recontadas sobre la tabla de `B/09` §3** (con `S31`, FASE 8 completa, owner 2026-09-25). `MP5` no lleva
  ninguna suscripción a un estado terminal y no toca ningún preapproval — no hay ninguno.
- **El catálogo de acciones administrativas sigue teniendo DOCE filas** (arriba).
- **`C5` no se toca.** Su `UNIQUE(subscription_id, período) WHERE el pago está acreditado`
  (`B/05` §C5) impide **dos pagos acreditados** del mismo período, y una cuota en `AWAITING` no
  está acreditada: la idempotencia de `MP5` es **la condición de su propia fila** —que no exista
  ya un `manual_payment` de ese período—, no esa restricción. Las dos conviven sin superponerse.
- **Las cuatro condiciones del `B/05` §3 valen igual.** `MP5` no registra un pago: abre la cuota
  contra la que después se lo registra. **Y la reimputación de `MP4` tampoco las mueve**, con el
  detalle condición por condición arriba, en *«al reabrir por `MP4`»*.
- **El avance y la reimputación no agregan ninguna fila, así que nada de lo de arriba se
  recuenta.** Son **efectos**, declarados en las celdas de `MP1`, `MP4` y `S10`, no transiciones
  nuevas: no hay un `MP6`, `G-R4` no gana ningún par por acá y la máquina sigue teniendo tres
  estados.
- **Y el barrido NO gana una sexta comprobación de cero llamadas.** La pregunta que faltaba
  —*«¿hay una suscripción de pagador manual a la que nadie le abre cuota?»*— dejó de tener
  población: no es un caso a detectar, es un estado que ya no se alcanza, porque la fecha que
  `MP5` lee tiene **tres** escrituras declaradas y ninguna la deja quieta. Las
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
| *«`MP4` no agrega ningún par, así que `G-R4` sigue contando tres»* | el arreglo de `MP4` (§7.1) | **verdadera en su primera mitad y CADUCA en la segunda**: `MP4` no agrega ningún par y `MP5` tampoco —sale de un `desde` que ninguna otra fila usa—, pero los pares dejaron de ser tres el día que `DEC-SUB-015` creó `S25`, que es de otro §. **Son cuatro**, recontados sobre la tabla de `NUCLEO/03` §1 regla 7 y no sumándole uno | corregida en §7.1, y en las otras tres apariciones del corpus |
| *«la máquina sigue teniendo tres estados»* y *«`B/02` §2.3 no necesita un estado nuevo»* | el arreglo de `MP4` (§7.1) y `B/02` §2.3 | **siguen verdaderas**: `MP5` agrega una arista desde *(sin fila)*, que no es un nodo de la columna | sin tocar |
| *«`manual_payment` guarda quién lo registró, cuándo, comprobante»* | `B/02` §2.3 | **queda INCOMPLETA**: una cuota en `AWAITING` existe **antes** de que nadie registre nada, así que esos tres no se pueden escribir todavía y falta **el período** que el `UNIQUE` de `B/05` §C5 ya presuponía | corregida en `B/02` §2.3 |
| *«un pago manual mensual no tiene nada que pausar»* | `B/06` §7 | **sigue verdadera**, y esta regla la usa en vez de contradecirla | arriba, *«la pausa»* |
| *«el grace no es un beneficio de entrada»* | `B/12` §4.3 | **sigue verdadera, y es la LECTURA que este § le daba la que queda FALSA**: lo que se lee por autorización es el predicado de `S16` —el **remedio**—, no la regla, así que sobre un pagador manual la regla se aplica entera y lo que faltaba era su ejecutor. Lo ejecuta la cláusula *(b)* de `MP5` abriendo la primera cuota en `PENDING_AUTHORIZATION`, donde `S4` no alcanza | corregida arriba, en *«cómo entra el grace»*, y en `B/12` §4.3 y §4.5 punto 1 |
| *«la deuda vieja no se persigue por separado»* y *«el que paga tarde paga esa cuota»* | `B/12` §5.3 y `DEC-SUB-012` | **siguen verdaderas**, y son la razón escrita de (b) | arriba |
| *«el período actual»* como columna de `subscription` | `B/02` §2.2 | **queda RENOMBRADA**: lo que la fila guarda es **una fecha** y no un período, y leerla como período es lo que dejó a `MP5` esperando que alguien *«avanzara»* algo. Pasa a ser *«la fecha del próximo cobro»*, la misma cifra que el barrido compara contra `next_payment_date` | corregida en `B/02` §2.2 |
| *«el período no avanza mientras el pago no entra: `S5` es lo que lo cierra»* | el arreglo de `MP5`, en la fila `GRACE_PERIOD` de la tabla de arriba | **queda FALSA en sus dos mitades**: `S5` no declara ese efecto —su celda es *«se apaga el reloj»*— y el período **sí** puede avanzar en grace si el grace configurado es más largo que un ciclo. Lo que impide abrir la cuota ahí es el `desde` de `MP5` | corregida arriba, en esa misma fila |
| *«el período nuevo arranca EN LA REACTIVACIÓN»*, sin condición | el arreglo de `MP5`, en *«al reabrir por `MP4`»* | **queda FALSA como regla general**: sobre una reapertura que cae **dentro** del período pagado, re-anclar le cobra dos veces los días que le quedaban | corregida arriba, en esa misma sección |
| *«la fecha pasa a ser el instante de la reactivación»* como remedio del caso largo (el **tope** de la FASE 9-bis-4) | el arreglo del tope de `MP4` (`rastro-8f9f31ac0.md`, §7.2 y `B/02` §2.2) | **queda FALSA**: esa fecha es exactamente la que hace disparar a `MP5` en el acto —su condición es *«ya llegó»*—, así que el que vuelve pagaba el período que pasó suspendido **y** el que arranca, y `S4` lo devolvía al grace el mismo día. El remedio no es una fecha: es **reimputar la cuota** al período que arranca | corregida arriba, en *«al reabrir por `MP4`»*, y en `B/02` §2.2 |
| *«el reloj crearía de golpe todas las cuotas»* | el arreglo de `MP5`, misma sección | **queda FALSA en el mecanismo y verdadera en el desenlace**: la condición de `MP5` nombra un período y es idempotente, así que crea **una** cuota por corrida; la deuda igual se acumula cuota a cuota. Era la parte falsa la que le agrandaba el alcance al remedio | corregida arriba, con el motivo reescrito |
| *«al reanudar se le muestra una sola cosa: qué día se le cobra»* y *«se le cobra normal en el ciclo siguiente: el `next_payment_date` que el proveedor ya tiene corrido»* | `DEC-SUB-010`, en la celda de `S10` | **siguen verdaderas, y recién ahora tienen respuesta sobre un pagador manual**: ahí no hay proveedor que corra nada, así que lo corre `S10` con los ciclos que vencieron durante la pausa. Lo que era una frase con sujeto sólo del lado de la tarjeta pasa a valer para los dos | `S10`, §3.2 |
| *«el ciclo que vence estando pausada avanza la fecha +1 ciclo sin cobrar»* (`PS-6`) | la matriz, citada por `DEC-SUB-010` y `B/12` §7.1 | **sigue verdadera y gana un consumidor**: es la medición que fija qué hace `S10` sobre un pagador manual, donde nadie la ejecuta por nosotros | arriba, punto 3 |
| *«la fecha del próximo cobro se registra»* del barrido | `B/09` §3 | **sigue verdadera y sin tocar**: es la escritura del régimen **con** proveedor, y sobre un pagador manual el barrido no tiene preapproval que leer | sin tocar |

---

## 8. Addon (instancia)

| # | desde | evento | hacia | nota |
|---|---|---|---|---|
| A1 | *(sin fila)* | se contrata | `PENDING_AUTHORIZATION` | exige una suscripción principal válida y compatible (§38). **Nunca durante un trial** (§10.5) — **leído como `V/11` §5.1–§5.2**: se prohíbe comprar teniendo **sólo** trials; y **con scope `LISTING`, el objetivo no puede ser una ficha de una vertical cuyo único título es un trial** —en `cobertura(user, vertical del objetivo)`, ninguna fuente de clase `TÍTULO` que no sea de `tipo: TRIAL`—, porque la ficha en trial **no es objetivo elegible** (FASE 8 completa, `F-8CA1-004`). **Un addon `USER` o `GLOBAL` se puede comprar igual**: lo que no hace es aportar en la vertical en trial, y eso lo corta el pliegue (`V/15` §2.6, `G-R2`), no esta fila |
| A2 | `PENDING_AUTHORIZATION` | se autoriza | `ACTIVE` | recurrente: su propio preapproval (`DEC-ADDON-002`). De única vez: su propio cobro **por `/v1/orders`, sin preapproval** (`EX-30`, medido sólo en sandbox; `B/16` §1.4, `B/06` §3.2); su `payment` cuelga de la instancia (`B/02` §2.3). ~~**La idempotencia de `/v1/orders` no está medida**~~ **`/v1/orders` es idempotente por la clave (`EX-41`, sonda 51): un reintento con la misma clave no cobra dos veces** (corrección de diseño, FASE 8 completa, `F-8CB1-008`) |
| A3 | `PENDING_AUTHORIZATION` | vence la ventana | `ABANDONED` | **la misma ventana que `S3`**, con sus **dos** plazos según el método de pago (§3.4 punto 1) |
| A4 | `ACTIVE` | llega su fecha de fin | `EXPIRED` | **el reloj no se congela** aunque la ficha esté despublicada (`DEC-ADDON-001`) |
| A5 | **toda instancia con una autorización que puede cobrar: `PENDING_AUTHORIZATION` y `ACTIVE`** (ver abajo, *«la instancia que autoriza después»*) | se da de baja, queda huérfano, **o se revoca el grant del que cuelga el ancla que era su título** | `CANCELLED` | **Son tres eventos y el tercero es nuevo** (ver abajo, *«el addon cuyo título era el ancla»*). **El tercero nombra la REVOCACIÓN y no *«el retiro del ancla»***, porque *«desanclar no está declarado»* (`12-contrato…` §2.8, `B/02` §2.4) y una transición no puede esperar un acto que ningún catálogo produce: revocar es el acto declarado —fila del grant permanente del `NUCLEO/08` §3— y **retira todas las anclas del instrumento de una vez**, que es lo que el ancla-título de esta instancia necesita. §41: **sólo** cuando queda efectivamente huérfano, no por cancelar la vertical. *«Huérfano»* es la condición de `B/16` §4.2 —el objetivo dejó de ser fila viva, **ninguna sucesión lo releva** y **ningún grant permanente lo releva**; **y para `LISTING`, además del borrado de la ficha, esa misma condición leída sobre la principal de la vertical de la ficha** (`B/16` §4.2; FASE 8 completa, `F-8CA2-003`, owner 2026-09-25)—, **nunca un estado de llegada concreto**: la pueden cumplir las **seis** transiciones que sacan a la principal de las filas vivas —`S3`, `S12`, `S13`, `S16`, `S17` y el espejo del §10.1—, y `S16` (`CHARGE_DECLINED`) es una de ellas. **Y se evalúa sobre los complementos de la fila que la transición sacó de las filas vivas y, si esa fila era una sucesora, también sobre los de su predecesora** (`B/16` §4.3); **y, si esa fila es principal, sobre las instancias `LISTING` cuyas fichas son del mismo `user + vertical`** (`B/16` §4.3 punto 3; `F-8CA2-003`). **Y la suscripción de complemento de la instancia que se apaga queda `CANCELLED` en el mismo acto, por `S21`** (§3.2): **el preapproval que este efecto cancela es el de esa fila**, así que la llamada es **una sola** y no se manda dos veces. **Y antes de esa llamada sale nuestro correo** (`DEC-MAIL-001`; §3.2, *«el correo antes de cancelar»*): si falla de forma transitoria, la cancelación no se ejecuta en esta corrida y se reintenta; si no hay destinatario, se cancela igual y el no-entregable se escala |
| A6 | `ACTIVE` | se borra la ficha destino | `CANCELLED` | **se consume**: no se libera ni se reasigna (`DEC-ADDON-001`), y el borrado **tiene que advertir qué addons se pierden y por cuánto**. **Su suscripción de complemento también queda `CANCELLED` en el acto, por `S21`** (§3.2) — misma regla y misma razón que en `A5`: el addon complementa algo que ya no está. **La cancelación de ese preapproval la manda este acto** (`S21` no manda nada), así que lleva la misma condición que `A5`: **antes de la llamada sale nuestro correo** (`DEC-MAIL-001`; §3.2, *«el correo antes de cancelar»*) |

**Cancelar el plan no cancela los addons**: como cada addon recurrente es una suscripción aparte,
esa orquestación es nuestra (`DEC-ADDON-002`), y es justamente lo que el §41 pide poder hacer al
revés.

#### La instancia que autoriza después de que su título murió: por qué `A5` no sale sólo de `ACTIVE`

**El `desde` de `A5` decía `ACTIVE` y nada más, y eso dejaba entera la ventana de autorización del
checkout del addon.** El camino, con todos sus pasos declarados: alguien `ACTIVE` —el único
estado desde el que se puede comprar (`B/16` §2.2)— contrata un addon recurrente, `A1` lo lleva a
`PENDING_AUTHORIZATION` con la misma ventana que `S3` —y sus **dos** plazos, §3.4 punto 1—, y **dentro de esa ventana su suscripción
principal deja de ser fila viva**. Cualquiera de las **doce** transiciones del `B/16` §4.3 sirve
—recontadas sobre la enumeración de ese §—, y
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
Son dos eventos distintos, así que **`A5` no agrega ninguna entrada** y la tabla de la regla 7
del núcleo sigue teniendo **cuatro** —la cuarta la agregó `S25`, no ésta—. **El tercer evento de `A5` tampoco agrega un par**:
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

El `version` **se usa**, y ~~para dos cosas concretas~~ **para una**: descartar un evento más viejo que el último
aplicado **sin gastar una relectura**, ~~y detectar que el recurso cambió sin que nos avisaran —
está medido que mutar el monto **salta el contador de 5 a 9 sin emitir una sola entrega**
(`EX-15`)~~. **La segunda ya no la hace el `version`**: detectar *«cambió sin avisarnos»* es del
barrido, que relee por id, y **la lectura por id no trae `version`** —viene en el cuerpo del
webhook (`EX-2`), no en el `GET` (`RC-9`, `NOT_SUPPORTED`, producción 2026-09-25)—. Lo que la
relectura trae es **`last_modified`**, y eso es lo que el barrido compara (`B/09` §3; FASE 8
completa, `F-8CB3-010`). Que mutar el monto salte el contador sigue medido (`EX-15`), pero **ese
salto sólo se ve en un webhook, y la mutación no emite ninguno**.

### 10.1 Un webhook no es un estado: es un aviso

**Nunca se escribe el estado que trae el evento.** Al recibirlo, si su `version` no es mayor que
la última aplicada para ese recurso se descarta ahí mismo; si lo es, se **relee el recurso por su
id** en el proveedor y se escribe lo leído, junto con la `version` ~~de esa lectura~~ **del evento
que la disparó** —la lectura por id no la trae (`RC-9`)— **y el `last_modified` de esa lectura**
(`B/02` §2.2; FASE 8 completa, `F-8CB3-010`).

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
| `pending` | cualquier otro — **salvo la fila terminal de una cancelación nuestra, ~~que tiene su par~~ y la `CANCEL_SCHEDULED` de `S11` o `S26`, que tienen sus pares al final de esta tabla** | **divergencia real** — el proveedor no puede retroceder a pendiente. Marca |
| `authorized` | `PENDING_AUTHORIZATION` | **`S2`**: espejar es la transición que ya existe |
| `authorized` | `PAUSED` | **`S10`**: el proveedor reanudó. Espejar — y acá la condición de `S10` ya está cumplida, porque **esta lectura ES la relectura** que la fila pide. **El caso ciego es el contrario**, `paused` contra `PAUSED`: ahí los dos lados coinciden, esta tabla no ve nada y lo levanta la **quinta comprobación de cero llamadas** de `B/09` §3 |
| `authorized` | `GRACE_PERIOD` · `SUSPENDED` | **divergencia real** — el preapproval está vivo y nuestro reloj dice que no cobró. Marca: es el caso que `B/12` §1.4 manda mirar. **Salvo que la fila sea la predecesora de una sucesión en curso —o sea con una sucesora VIVA apuntándola— y tenga un pago pendiente por `S19`**: ahí el cobro **sí** entró y está registrado, y el estado es el que `S19` declara — la premisa de esta fila (*«nuestro reloj dice que no cobró»*) es falsa para esa población, y marcarla sería un incidente sobre el camino normal. La salvedad **está acotada por la ventana**: muerta la sucesora, la fila deja de ser predecesora de una sucesión en curso y vuelve a esta fila con su premisa verdadera |
| `paused` | `ACTIVE` · `GRACE_PERIOD` | **`S6`**, por su segundo evento: el proveedor pausó por mora y nosotros no lo sabíamos (`DEC-MP-008`). **No es `S8`**: `S8` es la pausa que pide la persona, y leer esta como `CUSTOMER_REQUEST` sacaba al moroso del dunning, le gastaba una pausa que no pidió y lo devolvía a `ACTIVE` sin cobrar (`DEC-MP-003`). ~~**`S8`**: el proveedor pausó y nosotros no lo sabíamos. Espejar, con motivo `CUSTOMER_REQUEST`~~ |
| `cancelled` | `CANCEL_SCHEDULED` | nada: es lo esperado, `S11` ya lo canceló. El servicio sigue hasta la fecha nuestra (`DEC-SUB-009`) |
| `cancelled` | `SUSPENDED` | nada: es lo esperado, **`S6` ya lo canceló** al suspender (`DEC-SUB-019`). La fila sigue suspendida; volver es una sucesión |
| `cancelled` | cualquier estado vivo que no sea `CANCEL_SCHEDULED` ni `SUSPENDED` | **`S12`** si hay una baja programada; si no, **espejar la baja decidida por el proveedor** (`B/12` §1.4) — **salvo sobre una fila `ACTIVE` sin ningún pago acreditado cuyo primer cobro figura rechazado en la lectura de `B/09` §4: eso es `S16`**, llegue antes el aviso que llegue; con *«todavía no se sabe»* no se actúa en esa corrida (§3.2, *«el primer rechazo lo reclamaban tres filas»*; FASE 8 completa, `F-8CB2-006`) |
| `authorized` · `paused` · `pending` | una fila **terminal** —`CANCELLED` o `ABANDONED`— a la que llevó **una transición nuestra que manda cancelar el preapproval**: las ~~**once**~~ **doce** de la salvedad 4 de `B/09` §3 (`S12`, `S3`, `S13`, `S20`, `S22`, `S23`, `S24`, `S25`, `S27`, `S28`, **`S31`** y la lápida; `S31` desde la FASE 8 completa, owner 2026-09-25) y, por la salvedad 1, la suscripción de complemento que `S21` llevó a `CANCELLED` tras la cancelación de `A5`/`A6` | **reintentar la cancelación** —la del barrido, `B/09` §3, con el correo antes y la relectura después—; **la marca, con motivo `CANCELACIÓN_SIN_CONFIRMAR` (`B/02` §2.5), recién a los 3 días de la transición que decidió la cancelación**, y se avisa por `DEC-OBS-001`. **Abierta la marca, el barrido deja de reintentar**, y el correo de antes sale una sola vez por cancelación (§3.2, precisión 3; owner 2026-09-25). **No es divergencia**: la cancelación ya la decidió una transición declarada y sólo falta que la llamada llegue (`DEC-CONC-002` punto 4, su 📌; FASE 8 completa, `F-8CB1-013`, owner 2026-09-25). **Una fila terminal que no está en esa lista no entra en este par** —`S16` y el espejo de la fila anterior, que no mandaron ninguna cancelación, y `S17`, que llega a terminal sólo con la suya ya confirmada por relectura—: un preapproval vivo sobre ella sigue siendo divergencia real, y marca |
| `authorized` · `paused` · `pending` ✚ | `CANCEL_SCHEDULED` a la que llevó **`S11` o `S26`** —las dos mandan la cancelación en el acto y dejan la fila **viva** hasta `S12`— | **el mismo veredicto que el par de arriba**: **reintentar la cancelación** desde el barrido, con el correo antes —el que ya salió no se repite, §3.2 precisión 3— y la relectura después; **la marca `CANCELACIÓN_SIN_CONFIRMAR`, recién a los 3 días de la transición que decidió la cancelación**, y abierta la marca **el barrido deja de reintentar** (owner 2026-09-25; FASE 8 completa, `F-8CB1-013`). **No rompe el par `cancelled` × `CANCEL_SCHEDULED`**, que sigue siendo *«nada: es lo esperado»*: éste es el de la llamada que no llegó. **Y no alcanza a la `CANCEL_SCHEDULED` de `S7`**, que llega ahí justamente porque la relectura ya vio el preapproval `cancelled` (§3.2) |

> **Espejar un estado leído por id es una transición declarada de esta tabla, no un acto aparte.**
> Lo que **no** figura acá es divergencia real, y ahí la marca es la respuesta correcta — deja de
> ser un falso positivo y pasa a señalar lo que su nombre dice.
>
> **Y «de esta tabla» incluye el §3.2, con todo lo que eso arrastra.** La ~~última~~ fila
> `cancelled` × *«cualquier estado vivo…»* —espejar la baja que decidió el proveedor; era la última
> hasta que `F-8CB1-013` agregó debajo el par de la cancelación nuestra sin confirmar— **saca a una fila principal de las filas vivas**, así que es la
> séptima del dominio que el §3.2 recorre por el lado de la predecesora, la **sexta** de las que
> disparan la re-evaluación del addon huérfano (`B/16` §4.3), un tercer camino por el que la
> predecesora **se muere sola** y `S18` cierra la sucesión sin `S17`, y la **rama 5** de
> `B/12` §5.3. Que no tenga fila numerada en el §3.2 no la saca de ninguno de los cuatro
> lugares: **enumerar el dominio sobre las filas numeradas es el error, no la ausencia de número.**

**Por qué enumerar y no declarar que espejar es una excepción a la regla 1.** La excepción
resolvía el choque en una línea y abría un camino que **escribe estado sin transición declarada**,
que es exactamente lo que la regla 1 existe para impedir. Enumerar cuesta ~~ocho~~ ~~**diez**~~ **once** filas —recontadas sobre la tabla en la FASE 8 completa
(`F-8CB1-013`, owner 2026-09-25): ya eran nueve antes de sumar la de la cancelación nuestra sin
confirmar, diez con ella, y once con la de la misma cancelación sobre una `CANCEL_SCHEDULED`— y deja
escrito **por qué cada caso cayó donde cayó**.

### 10.2 Los hechos puntuales sí necesitan orden, y lo toman del hecho

Un cobro no es un estado: es algo que pasó en un instante, y la relectura del preapproval no lo
refleja campo a campo. Para esos:

- **el orden lo da la fecha del hecho**, nunca la de llegada;
- **se deduplica por el id del hecho**, no por el tipo de evento — está medido que un mismo
  reembolso emite tres notificaciones en dos formatos (`RF-7`);
- **pero el mismo id con OTRO estado no es un duplicado: es el mismo hecho que avanzó.** Los
  reintentos de un ciclo quedan **dentro del mismo registro de cobro** (`B/09` §4, `RC-5`), así que
  el reintento que se aprueba llega con el id que ya tenemos en `PENDING`. El choque con el
  `UNIQUE` no termina ahí: se relee la fila existente y, si la lectura por id dice `approved`,
  corre `P1` sobre ella (§6, `B/05` C6; FASE 8 completa, `F-8CB3-003`);
- **un hecho más viejo que el último aplicado se registra y no se aplica.**

**El aviso de contracargo entra por acá** (FASE 8 completa, `F-8CB3-009`, `DEC-SUB-020`). Según la
documentación del proveedor tiene un aviso propio, **`topic_chargebacks_wh`**, que trae el
`payment_id` (`RC-8`, `UNKNOWN`: documental, no medido). **Es un aviso como cualquier otro**
(§10.1): no se escribe lo que trae, se **relee el pago por id** y, si la lectura dice
`charged_back`, corre `P6`; si dice `reimbursed` sobre un pago en `CHARGED_BACK`, corre `P7` (§6).
**Y no es la única vía**: si el aviso no llega —o no existe como dice la documentación—, lo ve la
comprobación de pagos acreditados del barrido (`B/09` §3), **que relee también los pagos en
`CHARGED_BACK` hasta que su `status_detail` se resuelva** —`settled` o `reimbursed`— (FASE 8
completa, owner 2026-09-25).

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

- ~~**La cancelación de `S11` o `S26` que no llegó, mientras la fila sigue en `CANCEL_SCHEDULED`**
  (FASE 8 completa, `F-8CB1-013`). El reintento del barrido que decidió el owner es sobre filas
  **terminales** (`B/09` §3, salvedades 1 y 4), y ésta todavía no lo es: lo será por `S12`, que
  está entre las once. Hasta entonces la relectura ve `authorized` contra `CANCEL_SCHEDULED`, un
  par que la tabla del §10.1 no enumera y que por eso cae en *«divergencia real → marca»*. **No se
  escribió un par nuevo** porque la decisión no alcanza a filas vivas; queda para decidir si ese
  caso se reintenta igual o se marca.~~ **CERRADA** por el owner el 2026-09-25 (FASE 8 completa,
  `F-8CB1-013`): **entra en la misma regla de reintento**, con su par propio en el §10.1
  —`authorized`/`paused`/`pending` × `CANCEL_SCHEDULED`— y sin tocar el par `cancelled` ×
  `CANCEL_SCHEDULED`.
- ~~**Dónde se cuentan las «tres corridas seguidas»**~~ **Cerrado el 2026-09-25**: se mide tiempo
  —3 días desde la transición que decidió la cancelación, 1 día desde el registro de cobro para el
  `B/09` §6.2— (`B/09` §3 punto 2).
- ~~**Un contracargo sobre la predecesora de una sucesión en curso** (FASE 8 completa,
  `F-8CB3-009`). La guarda de la sucesión de `S6` está escrita para sus dos primeros eventos;
  `DEC-SUB-020` decidió *«en el acto, sin grace»* y no dice si esa guarda también lo frena.~~
  **Cerrado el 2026-09-25 (owner)**: la sucesión no lo frena; `S6` corre igual y la sucesora
  también se corta (§3.2, `S6`; FASE 8 completa, pendiente 6, owner 2026-09-25).
- ~~**Un contracargo sobre una fila que no está en `ACTIVE` ni `GRACE_PERIOD`** —`CANCEL_SCHEDULED`,
  `PAUSED`, o ya terminal—. `S6` no tiene fila desde ahí, así que corre sólo la marca `CONTRACARGO`
  (§6, `P6`); si corresponde algo más, `DEC-SUB-020` no lo dice.~~ **Cerrado el 2026-09-25
  (owner)**: si la fila da servicio se corta en el acto, si no sólo la marca; la `CANCEL_SCHEDULED`
  pasa a `CANCELLED` ya, por `S12` (§3.2, §6 `P6`; FASE 8 completa, pendiente 6, owner 2026-09-25).
- ~~**Un contracargo sobre un pago ya `PARTIALLY_REFUNDED`.** `P6` sale sólo de `SUCCEEDED`; cubrirlo
  pide guardar a qué estado vuelve `P7`, y no se agregó sin una decisión.~~ **Cerrado el
  2026-09-25 (owner)**: mismo tratamiento que sobre `SUCCEEDED` (§6).
- ~~**La fecha de fin de servicio de `S11` sobre una fila sin ningún `covered_period`** —una
  sucesora que todavía no cobró (`B/12` §5.2)—. La fórmula de `S11` no tiene entrada ahí (FASE 8
  completa, `F-8CB1-012`).~~ **Cerrado el 2026-09-25 (owner)**: fin de servicio en el acto y
  cancelación del preapproval, como `S24` (§3.2, `S11`; FASE 8 completa, pendiente 6, owner 2026-09-25).
- ~~**Con qué transición se corta la sucesora cuando `S6` corre por un contracargo sobre su
  predecesora** (FASE 8 completa, pendiente 6, owner 2026-09-25). El owner decidió que se corta; ninguna transición existente lo
  hace sin arrastrar efectos de su propio evento: `S3` y `S28` llevan una `PENDING_AUTHORIZATION` a
  `ABANDONED`, pero `S3` cierra el saldo de una cortesía diferida con
  `VENTANA_DE_AUTORIZACIÓN_VENCIDA` y avisa *«venció tu plazo»*, y `S28` es el acto de la
  discontinuación; y desde `ACTIVE` —la sucesora ya autorizada con `S17` todavía sin confirmar—
  no sale ninguna que corte a una sucesora por un hecho de su predecesora. Hasta que se escriba, la
  sucesora no tiene fila que la corte.~~ **Cerrado el 2026-09-25 (owner)**: es **`S31`** (§3.2),
  `ABANDONED` desde `PENDING_AUTHORIZATION` y ~~`SUSPENDED`~~ **`CANCELLED`** desde `ACTIVE`
  (FASE 8 completa, owner 2026-09-25); el saldo diferido se
  cierra con `CONTRACARGO_DE_LA_PREDECESORA` (`B/02` §2.4) y el pago retenido por `S19` se reevalúa
  por la rama 2 de `B/12` §5.3 (FASE 8 completa, pendiente 8, owner 2026-09-25).
- ~~**Un contracargo sobre una `CANCEL_SCHEDULED` que es predecesora de una sucesión en curso.**
  `S12` dispara `S18` y la sucesión se consuma; el 📌 que corta también a la sucesora está escrito
  sobre `S6`, y si alcanza a este caso no está dicho.~~ **Cerrado el 2026-09-25 (owner)**: corre
  `S31` sobre su sucesora (§3.2, `S12`; pendiente 8).
- ~~**Un contracargo sobre una `PAUSED` con motivo `COURTESY`**: esa fila emite fuente, así que *«da
  servicio»*, y el 📌 la nombra entre las que sólo llevan la marca (§6, `P6`).~~ **Cerrado el
  2026-09-25 (owner)**: se corta; `S6` la toma por su tercer evento, la cortesía se cierra y la
  fila pasa a `SUSPENDED` (§3.2, §3.3; pendiente 8). La pausada por `CUSTOMER_REQUEST` sigue con
  sólo la marca.
- ~~**Qué correo recibe una `CANCEL_SCHEDULED` que pasa a `CANCELLED` por un contracargo.** El de
  *«suspendido por contracargo»* (`NUCLEO/07` §6) está escrito para `S6`.~~ **Cerrado el
  2026-09-25 (orquestador, derivado de `DEC-SUB-020`)**: el mismo correo de contracargo (`NUCLEO/07`
  §6; pendiente 8).
- ⚠️ **Lo que `S31` deja abierto** (FASE 8 completa, pendiente 8):
  1. ~~**Quién cierra la sucesión cuando `S31` deja a la sucesora `SUSPENDED`.** Sigue viva, así que
     la sucesión sigue en curso; `S18` no sale de `SUSPENDED` —su `desde` es `ACTIVE`,
     `PENDING_AUTHORIZATION` o `CANCEL_SCHEDULED`—. Y mientras siga en curso, **la reevaluación del
     pago retenido por la rama 2** encuentra sin cumplir la condición 3 del `B/05` §3 (*«que esta
     fila no sea la predecesora de una sucesión en curso»*), así que no reactiva. La decisión del
     owner lo pide *«como en `S3`»*, donde la sucesora sí muere.~~ **Cerrado el 2026-09-25 (owner,
     FASE 8 completa)**: desde `ACTIVE`, `S31` lleva a la sucesora a **`CANCELLED`**, no a
     `SUSPENDED`. Deja de ser fila viva, la sucesión se cae como en `S3` —sin `S18`—, la
     reevaluación de la rama 2 encuentra cumplida la condición 3, y la persona vuelve por la
     predecesora `SUSPENDED` con una sucesión desde `SUSPENDED` de tarjeta (`G-R1-A`).
  2. ~~**Quién reintenta si la cancelación o el correo fallan de forma transitoria.** `S31` no está
     entre las once del reintento del barrido (`B/09` §3, salvedad 4) ni entre las que reintentan
     su propia transición (`S6`, `S17`); por forma se parece a `S3`/`S28` desde
     `PENDING_AUTHORIZATION` y a `S6` desde `ACTIVE`, y elegir no está decidido.~~ **Cerrado el
     2026-09-25 (owner, FASE 8 completa)**: el barrido; `S31` entra en la salvedad 4 de `B/09` §3,
     que pasa de once a doce filas.
  3. **Qué aviso recibe la persona por la sucesora cortada.** El de `S3` —*«venció tu plazo»*— no
     aplica; si el correo de contracargo de la predecesora lo cubre no está dicho.
- ~~⚠️ **Qué lectura ve `settled`** (FASE 8 completa, pendiente 8). El correo de la disputa perdida
  por nosotros cuelga de leerlo, `settled` no es fila (§6) y la comprobación de pagos acreditados
  del barrido relee sólo pagos `SUCCEEDED` (`B/09` §3), así que sin el aviso del proveedor
  (`topic_chargebacks_wh`, §10.2) no lo ve nadie. `P7` tiene el mismo límite sobre `reimbursed`.~~
  **Cerrado el 2026-09-25 (owner, FASE 8 completa)**: el barrido relee también los pagos en
  `CHARGED_BACK` hasta que su `status_detail` se resuelva —`settled` o `reimbursed`—, y esa
  lectura dispara el correo que corresponde de `NUCLEO/07` §6 (`B/09` §3).
- **`S31` no figura en las enumeraciones de `B/16` §4.3** (FASE 8 completa, declarado por
  `DEC-METH-015`). Saca a una fila principal de las filas vivas —a `ABANDONED` o a `CANCELLED`—,
  pero no está entre las doce transiciones del disparador de la orfandad del addon ni entre las que
  matan a *«la sucesora que relevaba»* (`S3`, `S13`, `S28`), que es el momento de re-evaluar los
  complementos de la predecesora. **Causa**: `S31` se escribió en la pendiente 8 sobre el lado del
  contracargo, y esas listas se recontaron antes. Es de borde —un contracargo en medio de una
  sucesión con addons— y no se abre como pendiente.
- **Los seis cruces del §52** son `E-CONC-01`, del capítulo 05. Acá quedan nombrados ~~dos~~ **uno** —el
  pago manual simultáneo al del proveedor ~~, y el cambio de plan en grace~~— sin resolverlos. **El
  cambio de plan en grace ya no es un cruce: no existe** desde `DEC-SUB-021` (owner 2026-09-25).
- ~~**Una sucesión redeclarada sobre una fila `ACTIVE` que el proveedor ya pausó por mora** —el
  segundo evento de `S6` con el webhook del cobro fallido perdido—. La guarda de la sucesión en
  curso frena a `S6` y la fila, por estar en `ACTIVE`, admite una declaración nueva. El límite de
  *«una sola ventana»* que `DEC-SUB-021` volvió innecesario hablaba del reloj del grace y nunca
  alcanzó este caso; si hace falta acotarlo, no está decidido.~~ **Cerrado el 2026-09-25 (owner,
  FASE 8 completa)**: antes de aceptar el cambio de plan de un pagador con tarjeta, `S1` relee por
  id el preapproval de la predecesora `ACTIVE` y exige `authorized`; si no lo está, el cambio no se
  ofrece —*«tu último cobro no entró, actualizá tu tarjeta»*, el camino de `DEC-SUB-021`— y la
  relectura corre la transición que corresponda por el §10.1, que sobre `paused` es `S6` por su
  segundo evento (§3.2, `S1` y `S6`; `B/20` §2, `G-R1-A`; `B/19` §4 fila 17-ter).
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
- ~~**Pero la otra mitad SIGUE ABIERTA: el acto de la discontinuación no tiene fila numerada para
  NINGÚN estado, no sólo para `PAUSED`.**~~ **CERRADA** por la FASE 9-bis-5 (defecto `F3` del
  censo), y **no era una pregunta al owner**: `B/10` §4.3 ordena el movimiento, `S11` no lo ejecuta
  —su evento es *«pide la baja»*, un acto del cliente sobre su propia fila, y esto lo decide
  `SUPER_ADMIN` sobre la cartera entera de una vertical— y lo único que faltaba eran las filas.
  **Son tres y no una** —`S26`, `S27` y `S28` (§3.2)—, porque el destino cambia con lo que cada
  estado emite: `ACTIVE` y `GRACE_PERIOD` al piso de `CANCEL_SCHEDULED`, `SUSPENDED` a `CANCELLED`
  y `PENDING_AUTHORIZATION` a `ABANDONED`. **`DEC-SUB-015` no resolvió esto y no pretendía
  hacerlo**: resolvió a quién alcanza el piso, no qué transición lo ejecuta.
