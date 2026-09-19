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
es un alta nueva.

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
| S2 | `PENDING_AUTHORIZATION` | webhook de autorizada, confirmado por relectura | `ACTIVE` | — | arranca el período; si venía de un trial, T2 |
| S3 | `PENDING_AUTHORIZATION` | vence la ventana | `ABANDONED` | pasaron **72 h** sin autorizar | se cancela el preapproval en el proveedor; la fila se conserva |
| S4 | `ACTIVE` | un cobro falla | `GRACE_PERIOD` | — | arranca el reloj del §4; el servicio **sigue entero** (§20) |
| S5 | `GRACE_PERIOD` | entra el pago | `ACTIVE` | — | se apaga el reloj |
| S6 | `GRACE_PERIOD` | se agota el reloj | `SUSPENDED` | — | §21: sin listado público, sin edición, sin creación, sin entitlements comerciales; datos conservados y billing accesible |
| S7 | `SUSPENDED` | regulariza | `ACTIVE` | el cobro entró de verdad | se restituye la publicación |
| S8 | `ACTIVE` | la persona pide pausar | `PAUSED` *(motivo `CUSTOMER_REQUEST`)* | `puedePausar()` (capítulo 01 (núcleo) §3) | se pausa en el proveedor; se elige en **meses enteros** (`DEC-SUB-010`) |
| S9 | `ACTIVE` | `SUPER_ADMIN` otorga cortesía | `PAUSED` *(motivo `COURTESY`)* | no hay pausa vigente (`DEC-GRANT-004`) | se pausa en el proveedor y **el servicio se sostiene de nuestro lado** (`DEC-GRANT-003`) |
| S10 | `PAUSED` | llega el fin, o la persona vuelve antes | `ACTIVE` | — | `PUT status=authorized`; al reanudar se le muestra **una sola cosa: qué día se le cobra** (`DEC-SUB-010`) |
| S11 | `ACTIVE` | pide la baja | `CANCEL_SCHEDULED` | — | **se cancela en el proveedor de inmediato** y se guarda **nuestra** fecha de fin de servicio (`DEC-SUB-009`) |
| S12 | `CANCEL_SCHEDULED` | llega la fecha de fin de servicio | `CANCELLED` | — | se corta el servicio; proceso **idempotente** |
| S13 | `ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `SUSPENDED` | `SUPER_ADMIN` otorga *Free Forever* | `CANCELLED` | — | §35.3: se cancela toda obligación de pago, **sin reembolso** (`DEC-GRANT-001`); el acceso pasa a darlo el grant |
| S14 | cualquiera | divergencia que toca plata o estado | **el mismo estado** | — | **se pone la marca `requiere_conciliación`** y se emite el §22.1: evento crítico, correo a `SUPER_ADMIN`, alerta en Admin, **cero decisiones destructivas automáticas** |
| S15 | cualquiera **con la marca puesta** | una persona resuelve | **el mismo estado** | intervención humana registrada | **se levanta la marca**; si además corresponde un cambio de estado, se ejecuta **la transición de esta misma tabla que lo permita** |
| S16 | `ACTIVE` | el **primer** cobro se rechaza | `CHARGE_DECLINED` | **es el primer cobro DE ESA autorización**, y el proveedor la canceló al rechazarlo | no hay servicio, no hay autorización y no hay vuelta: el reintento **es un alta nueva** |
| S17 | la **predecesora**, en cualquier estado vivo | webhook de que **su sucesora** quedó autorizada, confirmado por relectura | `CANCELLED` | la fila tiene una sucesora con `sucede_a` apuntándola | **se cancela en el proveedor** (es `D7`), y en el mismo acto **la sucesora limpia su `sucede_a`**: la sucesión terminó y pasa a ser el origen |

**`S17` es la transición que cierra la sucesión, y sin ella el candado se rompía en las dos
direcciones a la vez.** `D7` declara obligatorio cancelar la vieja al recibir el webhook de que la
nueva quedó autorizada, y **ninguna fila de esta tabla lo ejecutaba** — así que, por la regla 1 del
núcleo, el acto normal del mecanismo más caro del sistema terminaba **en un incidente y una fila
sin cancelar**, con dos preapprovals vivos cobrando.

**Y `sucede_a` no se limpiaba nunca**, que es la otra mitad y produce dos daños opuestos:

| qué quedaba | qué pasaba |
|---|---|
| el candado `A` **vacío** —ninguna fila viva con `sucede_a IS NULL`— | todo cliente que alguna vez cambió de plan quedaba **permanentemente fuera del §11**: un alta nueva entraba sin que nada la rechazara, y `EX-6` mide que el proveedor no frena la segunda |
| el candado `B` **consumido** —la sucesora viva lo ocupa para siempre— | **nadie podía cambiar de plan dos veces** en la vida de la relación |

Los dos se cierran con el mismo acto: **terminada la sucesión, la sucesora vuelve a ser un
origen**. `A` vuelve a estar ocupado y `B` vuelve a estar libre, que es el estado en el que la
persona estaba antes de empezar.

**El dominio que esto crea, recorrido**: la sucesora puede tener `sucede_a` **no nulo** (sucesión en
curso: `A` ocupado por la predecesora, `B` por ella) o **nulo** (sucesión terminada: `A` ocupado por
ella, `B` libre). **No hay un tercer estado**, y el paso entre los dos es atómico con `S17`. Si la
cancelación en el proveedor **falla**, `S17` no ocurre: la marca se pone y una persona lo mira, que
es el camino declarado y no un hueco.

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
| `CANCEL_SCHEDULED` → `ACTIVE` | arrepentirse **no es una transición: es una sucesión**. `DEC-SUB-009` cancela en el proveedor de inmediato y cancelar allá es irreversible (`PA-5`), así que volver exige recrear y volver a autorizar — y eso entra por el candado `B` igual que un upgrade, **no** por un `INSERT` que el §11 rechace. No hay riesgo de doble cobro: `S11` ya canceló el preapproval de la predecesora *«de inmediato»*, así que la única autorización que puede cobrar es la de la sucesora |
| `CANCELLED` → cualquier cosa | ídem. Una suscripción terminada no revive |
| `TRIAL_*` → `SUSPENDED` | el trial vencido es `TRIAL_EXPIRED`, que es otra máquina y otro estado (`DEC-ARCH-003`) |
| `PAUSED` → cualquier cosa que no sea `ACTIVE` o `CANCELLED` | está medido que **estando pausada el proveedor rechaza toda modificación** (`EX-11`), y que **sí deja cancelar** |
| `ABANDONED` → `ACTIVE` | la ventana venció y el preapproval se canceló. Volver a intentar crea una fila nueva, con clave de idempotencia nueva |
| dos vivas para el mismo `user + vertical`, **salvo una sucesión declarada** | es el §11, y su excepción está acotada por la base, no por una convención: **un origen y su única sucesora**, impuesto por los dos índices parciales de `B/02` §2.2. La condición está en `S1` y el capítulo 05 la hace cumplir con restricciones de unicidad, no con un chequeo. El invariante cuenta **compromisos, no filas** |

**Dos cosas que el §11 sigue prohibiendo y conviene no confundir con la excepción**: una sucesora
**no puede ser sucedida mientras viva** (el candado `B` la rechaza sin ninguna regla extra), y una
fila **con la marca `requiere_conciliación` puesta no puede declarar una sucesión**, salvo desde
`CANCEL_SCHEDULED` (`B/02` §2.2).

#### 3.3.1 Dos estados desde los que el cambio de plan NO se ofrece

Los dos salieron de recorrer el dominio completo del candado y **ningún informe de FASE 8 los
tenía**. En los dos, **la operación no se ofrece, con el motivo explícito en pantalla**:

| estado | qué había escrito | qué se le dice |
|---|---|---|
| `PENDING_AUTHORIZATION` | **nada**. Ningún capítulo lo nombra: el §3.4 punto 4 dice qué pasa si reintenta **el mismo** plan —*«no se crea otra, se reusa la vigente»*— y nada de cambiar a otro | *«terminá o cancelá el checkout que tenés abierto»* |
| `PAUSED` | una regla **cuyo destino no existe**: este mismo § prometía que el cambio *«se encola y se aplica al reanudar»*, y la cola de `B/12` §2.1 **es de entitlements, no de checkouts** | *«reanudá tu suscripción para cambiar de plan»* |

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

---

## 4. Grace

Sub-estado de Suscripción con reloj propio. Entra por S4 y sale por S5 o S6.

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
| MP1 | `AWAITING` | el admin registra el pago | `REGISTERED` | la suscripción sale de `GRACE_PERIOD` por S5 |
| MP2 | `AWAITING` | el admin confirma que no se pagó | `DECLARED_UNPAID` | la suscripción va a `SUSPENDED` por S6, sin esperar el reloj |
| MP3 | `AWAITING` | se agota el grace sin que el admin haga nada | `DECLARED_UNPAID` | S6 |

**Lo que el §30 agrega y la máquina tiene que cumplir**: si falta el pago, va a `GRACE_PERIOD`
**los mismos días configurables** que el resto (`DEC-SUB-002` vale igual acá), y **además se
notifica al admin** — que es el único caso donde una notificación es parte del flujo y no un
efecto colateral, porque sin ella nadie va a registrar nada.

**Y el cruce peligroso queda nombrado**: un admin registrando un pago manual mientras la persona
paga por el proveedor es **doble cobro con dinero real** (`E-CONC-01`). Lo resuelve el capítulo
05; acá queda dicho que la transición MP1 **no** es incondicional.

---

## 8. Addon (instancia)

| # | desde | evento | hacia | nota |
|---|---|---|---|---|
| A1 | *(sin fila)* | se contrata | `PENDING_AUTHORIZATION` | exige una suscripción principal válida y compatible (§38). **Nunca durante un trial** (§10.5) |
| A2 | `PENDING_AUTHORIZATION` | se autoriza | `ACTIVE` | recurrente: su propio preapproval (`DEC-ADDON-002`). De única vez: su propio cobro |
| A3 | `PENDING_AUTHORIZATION` | vence la ventana | `ABANDONED` | mismas 72 h que S3 |
| A4 | `ACTIVE` | llega su fecha de fin | `EXPIRED` | **el reloj no se congela** aunque la ficha esté despublicada (`DEC-ADDON-001`) |
| A5 | `ACTIVE` | se da de baja, o queda huérfano | `CANCELLED` | §41: **sólo** cuando queda efectivamente huérfano, no por cancelar la vertical |
| A6 | `ACTIVE` | se borra la ficha destino | `CANCELLED` | **se consume**: no se libera ni se reasigna (`DEC-ADDON-001`), y el borrado **tiene que advertir qué addons se pierden y por cuánto** |

**Cancelar el plan no cancela los addons**: como cada addon recurrente es una suscripción aparte,
esa orquestación es nuestra (`DEC-ADDON-002`), y es justamente lo que el §41 pide poder hacer al
revés.

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
| `authorized` | `GRACE_PERIOD` · `SUSPENDED` | **divergencia real** — el preapproval está vivo y nuestro reloj dice que no cobró. Marca: es el caso que `B/12` §1.4 manda mirar |
| `paused` | `ACTIVE` | **`S8`**: el proveedor pausó y nosotros no lo sabíamos. Espejar, con motivo `CUSTOMER_REQUEST` |
| `cancelled` | `CANCEL_SCHEDULED` | nada: es lo esperado, `S11` ya lo canceló. El servicio sigue hasta la fecha nuestra (`DEC-SUB-009`) |
| `cancelled` | cualquier estado vivo que no sea `CANCEL_SCHEDULED` | **`S12`** si hay una baja programada; si no, **espejar la baja decidida por el proveedor** (`B/12` §1.4) |

> **Espejar un estado leído por id es una transición declarada de esta tabla, no un acto aparte.**
> Lo que **no** figura acá es divergencia real, y ahí la marca es la respuesta correcta — deja de
> ser un falso positivo y pasa a señalar lo que su nombre dice.

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
