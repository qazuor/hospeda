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
| S2 | `PENDING_AUTHORIZATION` | webhook de autorizada, confirmado por relectura | `ACTIVE` | — | arranca el período; la fila **pasa a emitir fuente** (`12-contrato…` §2.6) y ese cambio de cobertura es lo que mueve el trial, si había uno (`V/03` §2, `T2`) — esta tabla **no dispara** una transición de la otra épica |
| S3 | `PENDING_AUTHORIZATION` | vence la ventana | `ABANDONED` | pasaron **72 h** sin autorizar | se cancela el preapproval en el proveedor; la fila se conserva |
| S4 | `ACTIVE` | un cobro falla | `GRACE_PERIOD` | — | arranca el reloj del §4; el servicio **sigue entero** (§20) |
| S5 | `GRACE_PERIOD` | entra el pago, **o se reevalúa uno que quedó pendiente** por `S19` | `ACTIVE` | las cuatro condiciones del cap. 05 §3 — y la 3 incluye **que esta fila no sea la predecesora de una sucesión en curso** | se apaga el reloj |
| S6 | `GRACE_PERIOD` | se agota el reloj | `SUSPENDED` | **no hay un pago acreditado del período pendiente de resolución** por `S19` | §21: sin listado público, sin edición, sin creación, sin entitlements comerciales; datos conservados y billing accesible |
| S7 | `SUSPENDED` | regulariza, **o se reevalúa un pago que quedó pendiente** por `S19` | `ACTIVE` | el cobro entró de verdad **y** las cuatro condiciones del cap. 05 §3 — y la 3 incluye **que esta fila no sea la predecesora de una sucesión en curso** | se restituye la publicación |
| S8 | `ACTIVE` | la persona pide pausar | `PAUSED` *(motivo `CUSTOMER_REQUEST`)* | `puedePausar()` (capítulo 01 (núcleo) §3) | se pausa en el proveedor; se elige en **meses enteros** (`DEC-SUB-010`) |
| S9 | `ACTIVE` | `SUPER_ADMIN` otorga cortesía | `PAUSED` *(motivo `COURTESY`)* | no hay pausa vigente (`DEC-GRANT-004`) | se pausa en el proveedor y **el servicio se sostiene de nuestro lado** (`DEC-GRANT-003`) |
| S10 | `PAUSED` | llega el fin, o la persona vuelve antes | `ACTIVE` | — | `PUT status=authorized`; al reanudar se le muestra **una sola cosa: qué día se le cobra** (`DEC-SUB-010`) |
| S11 | `ACTIVE` | pide la baja | `CANCEL_SCHEDULED` | — | **se cancela en el proveedor de inmediato** y se guarda **nuestra** fecha de fin de servicio (`DEC-SUB-009`) |
| S12 | `CANCEL_SCHEDULED` | llega la fecha de fin de servicio | `CANCELLED` | — | se corta el servicio; proceso **idempotente** |
| S13 | **toda fila viva** del beneficiario en **cada vertical que el grant ancla** (`B/02` §2.4, `permanent_grant_vertical`) — los seis estados, `PENDING_AUTHORIZATION` y `CANCEL_SCHEDULED` incluidos | `SUPER_ADMIN` otorga *Free Forever* | `CANCELLED` | — | §35.3: se cancela toda obligación de pago, **sin reembolso** (`DEC-GRANT-001`); **se cancela el preapproval de cada una** en el proveedor —autorizado o esperando autorización— con la misma regla de `S17`: si la relectura dice que ya está `cancelled`, no se manda nada; el acceso pasa a darlo el grant |
| S14 | cualquiera | divergencia que toca plata o estado | **el mismo estado** | — | **se pone la marca `requiere_conciliación`** y se emite el §22.1: evento crítico, correo a `SUPER_ADMIN`, alerta en Admin, **cero decisiones destructivas automáticas** |
| S15 | cualquiera **con la marca puesta** | una persona resuelve | **el mismo estado** | intervención humana registrada | **se levanta la marca**; si además corresponde un cambio de estado, se ejecuta **la transición de esta misma tabla que lo permita** |
| S16 | `ACTIVE` | el **primer** cobro se rechaza | `CHARGE_DECLINED` | **es el primer cobro DE ESA autorización**, y el proveedor la canceló al rechazarlo | no hay servicio, no hay autorización y no hay vuelta: el reintento **es un alta nueva** |
| S17 | la **predecesora**, si **sigue siendo fila viva** — las cinco alcanzables: `ACTIVE`, `GRACE_PERIOD`, `CANCEL_SCHEDULED`, `PAUSED`, `SUSPENDED` | su sucesora quedó **autorizada**, confirmado por relectura | `CANCELLED` | la fila tiene una sucesora con `sucede_a` apuntándola | **se cancela en el proveedor si su preapproval sigue vivo** (es `D7`); si la relectura dice que ya está `cancelled`, `D7` **ya está cumplido y no se manda nada** |
| S18 | la **sucesora**, en `ACTIVE` | la misma autorización que disparó `S2`, o una resolución de `S15` sobre la sucesión trabada | **el mismo estado** | la predecesora **ya no es fila viva** | **cierra la sucesión, y es el único acto que lo hace**: se escribe **`sucedida_por`** en la predecesora, se **limpia `sucede_a`** en la sucesora, y los complementos de la predecesora se **re-apuntan** a ella (`B/16` §4.2). La sucesora pasa a ser el origen |
| S19 | la **predecesora** de una sucesión en curso, en `GRACE_PERIOD` o `SUSPENDED` | entra el pago de la cuota que sigue en `recycling` | **el mismo estado** | la fila tiene una sucesora con `sucede_a` apuntándola | **el pago se registra y queda pendiente de resolución**: no reactiva, no se reembolsa todavía y **no pone la marca** — es un caso diseñado, no una divergencia. Su destino lo decide **cómo termina la sucesión**, con las cuatro ramas de `B/12` §5.3. Mientras esté pendiente, `S6` no corre |

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
**seis** las transiciones de esta misma tabla que la sacan de ahí sin que nadie declare nada:

| # | desde | transición | hacia | ¿sigue siendo fila viva? |
|---|---|---|---|---|
| 1 | `ACTIVE` | `S8` — la persona pide pausar | `PAUSED` | **sí** |
| 2 | `ACTIVE` | `S9` — `SUPER_ADMIN` otorga cortesía | `PAUSED` | **sí** |
| 3 | `GRACE_PERIOD` | `S6` — se agota el reloj, **salvo que haya un pago pendiente por `S19`** | `SUSPENDED` | **sí** |
| 4 | `CANCEL_SCHEDULED` | `S12` — llega la fecha de fin de servicio | `CANCELLED` | **no** |
| 5 | cualquiera de los cinco | `S13` — *Free Forever* | `CANCELLED` | **no** |
| 6 | `ACTIVE` | `S16` — el primer cobro de esa autorización se rechaza | `CHARGE_DECLINED` | **no** |

**La 3 y la 4 no necesitan que nadie toque un botón —las dos son relojes—**, y la 6 llega con el
cobro real, que `PA-3` mide **entre 26 y 44 minutos** después de autorizar: en esa media hora un
cambio de plan es legal y la predecesora todavía está `ACTIVE`. **Las tres primeras siguen siendo
filas vivas y son el dominio de `S17`** —por eso su `desde` son cinco estados y no tres—; **las
tres últimas ya no lo son, y ahí `S17` simplemente no aplica: no hay nada que cancelar y no hay
nada que matar.** En los seis casos `S18` corre igual, porque su condición es *«la predecesora ya
no es fila viva»* y las tres primeras la cumplen recién después de `S17`.

Con eso, el dominio queda recorrido en los dos ejes y la relación tiene **tres** estados, no dos,
y el tercero es el que faltaba:

| estado de la relación | cómo se lee | qué candado ocupa |
|---|---|---|
| **no hay sucesión** | `sucede_a` nulo y `sucedida_por` nulo | `A` la fila, `B` libre |
| **sucesión en curso** | la sucesora con `sucede_a` no nulo | `A` la predecesora, `B` la sucesora |
| **sucesión terminada** | la predecesora con `sucedida_por` no nulo, la sucesora con `sucede_a` nulo | `A` la sucesora, `B` libre |

**Son dos filas y un solo acto: o corren las dos o no corre ninguna.** Partirlas es lo que hace
que el cierre sea alcanzable —`S18` no depende de que `S17` tenga sujeto—, no una licencia para
ejecutar una sin la otra: `S17` sin `S18` deja el candado `A` **vacío**, y `S18` sin `S17` deja
viva una autorización que el `D7` manda cancelar. Lo vigila `G-R1-C` (`B/20` §2).

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

**`S19` y `S5` comparten `(GRACE_PERIOD, entra el pago)`, y `S19` y `S7` comparten el par sobre
`SUSPENDED`: las guardas son disjuntas por construcción**, porque una pregunta si la fila es la
predecesora de una sucesión en curso y la otra si no lo es. Es la regla 7 del núcleo, y lo vigila
`G-R4`.

**Y `S6` lleva su condición por el mismo motivo**: con el pago acreditado y pendiente, el reloj del
grace mandaría a `SUSPENDED` —que no emite fuente (`12-contrato…` §2.6)— a alguien que pagó el
período. El tope es la ventana: 72 h, y después el pago se resuelve por una de las cuatro ramas de
`B/12` §5.3.

#### `S13` alcanza a TODA fila viva, no a una

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

**Si el grant cae en medio de una sucesión, `S13` alcanza a las dos filas y la sucesión no se
cierra: se cancela.** No corre `S18` —no queda ninguna sucesora viva a la que pasarle el origen— y
la sucesora queda `CANCELLED` con su `sucede_a` escrito, que es el registro fiel de lo que pasó.
No ocupa ningún candado, porque los dos índices son parciales sobre las filas vivas, y no dispara
`G-R1-A`, que desde `B/20` §2 mira **el acto de declarar** y no una propiedad permanente de la
fila.

**Esto vuelve verdadera una afirmación de `B/14` §4.3** —*«sobre un grant no se otorga cortesía
… porque no queda nada que no cobrar»*—, que con `S13` alcanzando una sola fila era falsa
exactamente en este camino.

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
| MP1 | `AWAITING` | el admin registra el pago | `REGISTERED` | la suscripción sale de `GRACE_PERIOD` por `S5` — **o queda pendiente por `S19`, si es la predecesora de una sucesión en curso**: el efecto de `MP1` es el de `S5` y hereda su condición, porque el daño no depende de por qué puerta entró el pago |
| MP2 | `AWAITING` | el admin confirma que no se pagó | `DECLARED_UNPAID` | la suscripción va a `SUSPENDED` por `S6`, sin esperar el reloj |
| MP3 | `AWAITING` | se agota el grace sin que el admin haga nada | `DECLARED_UNPAID` | `S6` |

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
| `authorized` | `GRACE_PERIOD` · `SUSPENDED` | **divergencia real** — el preapproval está vivo y nuestro reloj dice que no cobró. Marca: es el caso que `B/12` §1.4 manda mirar. **Salvo que la fila sea la predecesora de una sucesión en curso con un pago pendiente por `S19`**: ahí el cobro **sí** entró y está registrado, y el estado es el que `S19` declara — la premisa de esta fila (*«nuestro reloj dice que no cobró»*) es falsa para esa población, y marcarla sería un incidente sobre el camino normal |
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
