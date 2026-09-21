---
title: Master Spec 05 — Idempotencia y concurrencia
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-21
status: CURRENT
fase: 2
capitulo: 5
cierra:
  - E-CONC-01
  - M-CONC-03
---

# 05 · Idempotencia y concurrencia

El §51 pide diseñar explícitamente para el doble clic, los reintentos, los webhooks
duplicados, el desorden, los jobs duplicados y los fallos de red. El §52 enumera **seis cruces**
y pide definir límites de transacción, restricciones únicas, locks, concurrencia optimista y
claves de idempotencia.

Este capítulo responde los seis **con nombre y apellido**, no por categoría, y dice qué hace
seguro a un pago que llega tarde.

---

## 1. Los tres mecanismos, y cuándo va cada uno

| mecanismo | para qué | cuándo NO |
|---|---|---|
| **Candado de idempotencia** | que una operación que sale hacia afuera no salga dos veces | no sirve para el caso en que la llamada salió y la respuesta se perdió — para eso está §1.2 |
| **Concurrencia optimista** | que dos escrituras locales simultáneas no se pisen | no sirve contra dos procesos que decidieron sobre datos viejos: eso lo resuelve reevaluar la transición |
| **Deduplicación por id del hecho** | que el mismo hecho del proveedor no se aplique dos veces | no sirve para hechos sin id propio |

**No hay locks distribuidos en este diseño.** Cada caso de abajo se resuelve con una restricción
de la base o con una relectura; un lock agrega un modo de falla —el que lo toma y muere— sin
resolver ninguno de los seis cruces.

### 1.1 El candado es nuestro, va antes, y es durable

Está medido que el proveedor **no deduplica por ningún mecanismo**: diez intentos, diez ids, y
`X-Idempotency-Key` **se acepta y no hace nada** en el alta de una suscripción (`EX-17`). El
mismo header es **obligatorio** en el reembolso (`RF-4`): **la idempotencia de este proveedor es
por endpoint y no se puede razonar de uno al otro.**

Entonces: la clave se acuña y **se persiste antes de la primera llamada**, nunca al reintentar
—si se genera en el reintento no hay nada que comparar—, y vive en la base, no en memoria del
proceso: en un despliegue conviven dos contenedores sirviendo tráfico (`DEC-CONC-001`).

### 1.2 El caso que ningún candado cubre

Mandamos crear, el proveedor crea **y cobra**, y la respuesta se pierde. De nuestro lado sólo
hay un timeout. Reintentar son dos cobros; no reintentar deja a alguien que pagó sin servicio.

**Sólo se resuelve preguntándole al proveedor, y no por nuestra referencia.** Su buscador
**ignora `external_reference`** (`RC-1`), así que la pregunta *«¿ya creé ésta?»* no tiene
respuesta. La que sí la tiene es **«¿este pagador tiene alguna suscripción autorizada que yo no
tenga registrada?»**, por correo del pagador y estado, que sí filtran y se componen.

---

## 2. Los seis cruces del §52 · cierra `E-CONC-01`

### C1 · Entra el pago mientras corre el proceso que suspende

**No hace falta decidir un ganador: los dos órdenes terminan en el mismo estado.**

- Si el pago se acredita primero, la transición `GRACE_PERIOD → SUSPENDED` **ya no corresponde**
  y no se ejecuta: la tabla del capítulo 03 se reevalúa contra el estado actual, no contra el
  que el proceso leyó al empezar.
- Si la suspensión ocurre primero, el pago entra por `SUSPENDED → ACTIVE`, que es una
  transición válida.

Lo único que hay que impedir es el intermedio: el proceso que suspende **relee y reevalúa dentro
de la misma transacción que escribe**, con la versión de la fila. Si cambió, vuelve a leer.

### C2 · Se pide la cancelación mientras entra un cobro

Está medido que **cancelar frena el cobro** (`GT-1`, verificado en producción: el sujeto
cancelado tenía su cobro agendado para el mismo instante que los otros y no cobró). Pero el
cobro puede estar ya en vuelo: el retraso del proveedor es **variable y no predecible** —33
minutos en una renovación de sandbox, ~26 en producción, ~100 segundos en un alta—.

**Decide la fecha del hecho, no la de llegada:**

| | qué se hace |
|---|---|
| el cobro es **anterior** a la cancelación | es legítimo: el cobro es **por adelantado**, así que pagó el período que va a usar. **Se extiende la fecha de fin de servicio** hasta cubrirlo — `DEC-SUB-009` sostiene el servicio de nuestro lado hasta el fin del período pagado, y esto es exactamente eso |
| el cobro es **posterior** a la cancelación | no debería existir. **Se pone la marca `requiere_conciliación` con motivo `COBRO_POSTERIOR_A_LA_BAJA`** (cap. 03 §3.2, `S14`; `B/02` §2.5), **con la referencia al cobro que hay que devolver**, y el reembolso lo confirma una persona (`DEC-RF-001`, `DEC-CONC-001`). Es uno de los **cuatro** motivos que significan *«hay plata del cliente que devolver»*, así que el listado accionable lo muestra adelante (`B/19` §4) |

**Las dos filas presuponen que la baja dejó una fecha de fin de servicio que se pueda extender, y
eso vale para `S11` y no para las otras dos.** Desde `PAUSED` (`S22`) y desde `SUSPENDED` (`S23`)
la fila va **directo a `CANCELLED`** y su fecha de fin de servicio es el día de la cancelación
(cap. 03 §3.2), así que **no hay nada que extender** y la primera fila no tiene dónde aplicarse:

- **Desde `PAUSED` la población es casi vacía y lo que quede ya está resuelto**: mientras está
  pausada el proveedor **no cobra** —`PS-6` mide que el ciclo que vence estando pausada avanza la
  fecha sin cobrar—, y un cobro anterior a la pausa pagó el ciclo cuyos días no usados
  `DEC-SUB-010` ya se llevó **al pausar**, no al cancelar. No hay período que devolver ni que
  sostener.
- **Desde `SUSPENDED` el cobro que entra es el que `S7` o `S19` esperaban, y llega tarde.** La
  condición 1 del §3 rechaza `CANCELLED`, que es exactamente el tope que el cap. 03 §7.1 eligió:
  *«a partir de ahí el pago que llegue no reabre nada»*. Así que la plata está en nuestra cuenta
  sin período que darle: **se pone la marca con motivo `COBRO_POSTERIOR_A_LA_BAJA`** (`B/02` §2.5)
  y la devolución **la confirma una persona**
  (`DEC-RF-002`) — la segunda fila de arriba, por la misma razón y no por analogía, **y por eso el
  motivo es el mismo**.

### C3 · Se otorga *Free Forever* mientras se ejecuta un cobro

**El grant no espera.** `DEC-GRANT-001` ya decidió el caso de fondo: se corta el cobro en el
acto y **no se devuelve lo pagado**, con su riesgo declarado.

Lo que este cruce agrega es sólo el borde: si un cobro se acredita **después** de que el grant
canceló la suscripción, no debería poder ocurrir por `GT-1` — y si ocurre igual, **se pone la
marca `requiere_conciliación` con motivo `COBRO_POSTERIOR_AL_GRANT`** (`B/02` §2.5), también con
la referencia al cobro. La diferencia con C2 es que acá **el cliente no pidió nada**, así que
un cobro posterior a un regalo es material de reembolso, no de retención.

### C4 · Se compra un addon mientras se aplica un downgrade que baja su base

`DEC-SUB-008` fijó que el downgrade **muta el monto ya** y **baja los entitlements al fin del
ciclo**. Durante esa ventana el cliente conserva los beneficios viejos, así que la compra del
addon es técnicamente posible y va a quedar excedida cuando el descenso se aplique.

**Se permite, con aviso explícito.** No se bloquea, por consistencia con la decisión que ya se
tomó para el excedente: *«se avisa, no se ejecuta por sorpresa»*. El aviso dice que hay un
descenso programado para tal fecha y qué parte de lo que está comprando va a quedar fuera del
límite a partir de ahí.

Bloquear sería defendible, y se descartó por una razón concreta: el cliente que baja de plan y
compra un addon está eligiendo **exactamente** la combinación que el §10.5 propone —*«suscribirse
a un plan como Basic y posteriormente adquirir un addon compatible»*—, y bloquearlo le cierra la
puerta al camino que el propio PDR recomienda.

### C5 · Un admin registra un pago manual mientras la persona paga por el proveedor

**Es el único de los seis que produce un doble cobro con dinero real**, y por eso es el único
que se lleva a la base:

**`UNIQUE(subscription_id, período) WHERE el pago está acreditado`.**

Un período de una suscripción admite **un solo pago acreditado**, y la base lo impide. El
registro manual que llega segundo **falla**, no compite.

Además, la transición `AWAITING → REGISTERED` del capítulo 03 **no es incondicional**: antes de
registrar se relee si hay un pago del proveedor acreditado o en vuelo para ese período, y si lo
hay, no se registra y se le dice al admin por qué. La restricción es la red; la relectura es
para que el admin entienda lo que pasó en vez de ver un error.

### C6 · Dos instancias procesan el mismo evento en paralelo

Lo resuelve `UNIQUE(proveedor, id_del_hecho)`: la segunda instancia falla al insertar y no hace
nada más. **Sin lock y sin coordinación.**

Con dos advertencias medidas:

- **No alcanza con deduplicar por tipo de evento**: un reembolso emite **tres notificaciones en
  dos formatos distintos para el mismo hecho** (`RF-7`).
- **Un evento sin id propio no se puede deduplicar así.** Para esos vale la regla del capítulo
  03 §10.1: el evento es un aviso, se relee el recurso, y procesarlo dos veces da el mismo
  resultado.

---

## 3. Qué hace seguro a un pago tardío · cierra `M-CONC-03`

El §22 pide evaluar *«timestamp real, payment status, subscription, posible nueva subscription,
posibles dobles cobros»* y dice *«Si es seguro: reactivar. Si existe ambigüedad:
`RECONCILIATION_REQUIRED`»*. Nunca define qué es seguro — y si el criterio queda implícito, cada
implementación traza la línea en otro lado.

**Un pago tardío es seguro de reactivar si y sólo si se cumplen las cuatro:**

| # | condición | qué pasa si no se cumple |
|---|---|---|
| 1 | la suscripción existe y está en `GRACE_PERIOD` o `SUSPENDED` | si está `CANCELLED`, `ABANDONED` o ya `ACTIVE`, el pago no la reactiva |
| 2 | el monto coincide con el esperado para el período que cubre | un monto distinto puede ser otro cobro, un cambio de precio no propagado, o un error |
| 3 | **no hay otra fila viva principal del mismo `user + vertical`** —las **seis** de `B/02` §2.2, `PENDING_AUTHORIZATION` **incluido**—, **ni esta fila fue superada por una sucesora que ya autorizó** — o sea `sucedida_por` **no** nulo (la sucesión se cerró), o una **sucesora viva** con `sucede_a` apuntándola que **ya autorizó** por `S2` (la sucesión quedó trabada con la marca puesta) | si la hay, el pago es de una suscripción superada —o de una que está por superarla— y reactivar le daría **dos** |
| 4 | no hay otro pago acreditado para el mismo período | si lo hay, es un doble cobro |

**Si las cuatro se cumplen**, entra `GRACE_PERIOD → ACTIVE` (`S5`) o `SUSPENDED → ACTIVE` (`S7`),
según en cuál de los dos estados de la condición 1 esté la fila, y se restituye la publicación.
**Si falla cualquiera**, se pone la marca `requiere_conciliación` con motivo `PAGO_TARDÍO_RECHAZADO`
(cap. 03 §3.2, `S14`; `B/02` §2.5) y el evento
crítico dice **cuál** falló — sin eso, la persona que lo mire tiene que rehacer el diagnóstico
entero. **Cuál de las cuatro condiciones falló va en el evento y no en el motivo**: el motivo es lo
que separa este caso de los otros diez en el listado, y el diagnóstico fino ya tiene su lugar
declarado en `NUCLEO/08` §4.3.

> **La condición 1 tiene desde `MP4` un segundo consumidor, y conviene decirlo porque nadie lo
> vería.** Además de decidir si un pago tardío reactiva, **es el tope de la reapertura de un pago
> manual declarado impago** (cap. 03 §7.1): se puede reabrir mientras la suscripción siga en
> `GRACE_PERIOD` o `SUSPENDED`, y deja de poder reabrirse cuando llega a `CANCELLED`, que es lo
> que esta condición ya rechaza. Se eligió así —en vez de un plazo nuevo— justamente para no
> agregar una cifra de configuración sin guard; el precio es que **relajar esta condición alarga
> esa ventana sin que ningún texto de allá lo diga**, y por eso queda anotado acá, que es donde
> alguien la relajaría.

**Con una excepción, y es la única: la condición 3 falla porque la otra fila viva es la sucesora de
ésta, con la sucesión en curso.** Ése no es un caso ambiguo sino uno **diseñado**, el del `B/12`
§5.3, y su desenlace está declarado: el pago **se registra y queda pendiente de resolución**
(cap. 03 §3.2, `S19`), **sin marca y sin evento crítico**. Poner la marca ahí sería tratar el camino
normal del cambio de plan desde grace como un incidente — y además rompería cosas: una fila marcada
**no puede ser sucedida** (`B/03` §3.3) y acá ya hay un `sucede_a` apuntándola. Cualquier **otra**
forma de fallar la 3 —otra fila viva que no es su sucesora, o la segunda mitad— sigue siendo
divergencia y sigue poniendo la marca.

**Este § nombra ahora las dos transiciones y antes nombraba una.** Su condición 1 admite
`GRACE_PERIOD` **o** `SUSPENDED` desde siempre, y su desenlace decía sólo `SUSPENDED → ACTIVE`:
**`S5` no aparecía ni una vez en el capítulo**. La incompletitud no era cosmética — era lo que
tapaba la colisión con `B/12` §5.3, que prohíbe exactamente `S5`. Leídos al pie de la letra los dos
textos no se contradecían, y quien implementara éste iba a escribir la reactivación para los dos
estados porque la condición 1 los admite a los dos.

**La condición 3 es la que más se olvida y la más cara.** Alguien que se cansó de esperar y se
volvió a suscribir tiene dos filas; si el pago viejo reactiva la vieja, queda pagando dos veces
por la misma vertical, y encima el §11 quedó violado sin que nadie lo pida. Es exactamente lo
que la restricción de unicidad del capítulo 02 impide **al crear** — acá hay que chequearlo
porque la reactivación no crea nada.

**Su redacción cambió, y es más precisa, no más laxa.** Decía *«no hay otra suscripción viva»*, y
*«viva»* leía contra un conjunto que **excluía `RECONCILIATION_REQUIRED`**: un pago tardío se
consideraba seguro de reactivar aunque hubiera otra `ACTIVE` marcada, que es textualmente el caso
que la condición existe para detener. Con la marca de `B/02` §2.2 ese agujero desaparece **sin
tocar la condición**, porque la fila marcada conserva su estado real y entra en la cuenta.

**Y es la segunda vez que la palabra *«viva»* rompe algo leyendo el conjunto equivocado**, así que
conviene decir cuál lee ésta: la **fila viva** de `NUCLEO/01` §2.4 **con sujeto suscripción**
—los seis de `B/02` §2.2, no los dos de la instancia de addon (`B/03` §8)—, que
es la lectura correcta acá porque lo que se está evitando es **un segundo cobro**, no una decisión
de cobertura. Esta condición es de billing y sobre filas de billing; no cruza la frontera.

**Y la enumeración de la condición 3 decía otro conjunto que el que este párrafo declara.** El
párrafo dice *«los seis de `B/02` §2.2»* y la tabla enumeraba **cuatro** —*«un estado que dé
título: `ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `CANCEL_SCHEDULED`»*—, que es el conjunto de
`12-contrato…` §2.6, no el de `B/02` §2.2. Los dos coincidían hasta que **`PENDING_AUTHORIZATION`
dejó de emitir fuente** (`12-contrato…` §2.6): desde ese día hay un estado que **no da título y sí
tiene una autorización viva**, y era justo el único que la enumeración dejaba pasar. **El peligro
que la condición vigila es una autorización que puede cobrar, no un título**, que es literalmente
la definición de *«fila viva»* — así que la enumeración pasa a ser la de `B/02` §2.2 y el conjunto
deja de estar escrito dos veces con dos contenidos.

**Y la segunda mitad de la 3 se lee sobre DOS columnas, porque la que la respondía se borra.**
`sucede_a` sólo existe mientras la sucesión está en curso: cuando la sucesora autoriza —o antes,
si la predecesora se murió sola por `S12`, por `S16` o por el espejo del `B/03` §10.1—, `S18` la
limpia (`B/03` §3.2) y el vínculo
pasa a vivir en `sucedida_por`, del lado de la predecesora.
Preguntar sólo por `sucede_a` daba *«no fue superada»* justo en el caso en que sí lo fue, que es
el más caro de los dos. Con `sucedida_por` la condición se puede evaluar **después** del cierre,
que es cuando llega un pago tardío.

> **La mitad `sucedida_por` es redundante con la condición 1, y se declara así en vez de
> presentarse como el caso que salva.** Una fila con `sucedida_por` puesta es una predecesora que
> `S17` llevó a `CANCELLED`, y la condición 1 ya rechaza `CANCELLED` sin leer la 3: **ninguna fila
> puede cumplir la 1 y tener `sucedida_por` a la vez**, porque de los tres estados no vivos no se
> vuelve (`B/03` §3.3). Se conserva igual, y por dos razones que no son la del párrafo de arriba:
> las dos condiciones **fallan en la misma dirección**, así que la redundancia es gratis; y el
> evento crítico dice **cuál** falló, así que tener la 3 escrita distingue *«llegó un pago sobre
> una fila que se dio de baja»* de *«llegó un pago sobre una fila a la que otra la sucedió»*, que
> es lo primero que necesita quien lo mire. **Lo que no hay que hacer es contar este § entre los
> consumidores que `sucedida_por` necesita para existir**: el que la necesita de verdad es el
> addon de `B/16` §4.2, que sí evalúa después del cierre.

**Y una sucesora en `PENDING_AUTHORIZATION` BLOQUEA, que es lo contrario de lo que este § decía.**
La versión anterior la eximía *«a propósito»*, con dos razones, y las dos se cayeron:

1. **Contradecía su propia justificación.** La condición 3 existe, textual, porque *«si la hay, el
   pago es de una suscripción superada y reactivar le daría dos»*. Una sucesora esperando
   autorización es exactamente una suscripción que va a superar a ésta: reactivar le da dos. La
   nota eximía el caso que la condición describe.
2. **Su argumento era de tiempo, no de seguridad.** *«Todavía no puede cobrar»* es cierto —`D8` le
   exige fecha de primer cobro futura—, pero el daño no es que la sucesora cobre **ahora**: es que
   la predecesora vuelva a `ACTIVE` con el crédito de la sucesora **ya computado en cero**, que es
   lo que `B/12` §5.3 mide y no se puede corregir después (`B/12` §5.4: las fechas del proveedor
   son inmutables, `EX-39`).

**Y su premisa empírica era falsa.** *«El pago tardío que reactiva a la predecesora es la evidencia
de que la sucesión ya no hace falta»*: ese pago **no es un acto del cliente**, es una cuota en
`recycling` que el proveedor reintenta solo (`B/12` §1.3, medido). El cliente que abrió el checkout
sigue pudiendo autorizarlo, y si lo hace, `S17` cancela la fila que el pago acaba de reactivar.

**Y por la otra puerta, donde sí es un acto del cliente, la conclusión no cambia.** El pago del
período impago tiene dos puertas y la segunda es el **pago manual** del `B/03` §7, que la persona
hace a propósito: ahí el argumento de arriba no aplica. Y aun así **tampoco es evidencia de que
la sucesión no haga falta** —quien transfiere la cuota vieja no está cancelando su checkout, y
las dos ramas del `B/12` §5.3 siguen siendo posibles en ese instante—, así que el destino del
pago lo decide **el cierre** de la sucesión y no su llegada. La razón escrita arriba vale para
una puerta; la regla que sostiene vale para las dos, y por eso `S19` retiene el pago entre por la
que entre.

**Lo que la nota temía —*«dejar a la persona con la vieja sin reactivar y la nueva sin
autorizar»*— no ocurre, y hay que decir por qué.** Mientras la sucesión está en curso la
predecesora sigue en `GRACE_PERIOD`, que **emite fuente** con `hasta: SIN_FECHA_CONOCIDA`
(`12-contrato…` §2.6): la cobertura no se interrumpe por no reactivar. Y si la sucesión muere sin
consumarse, el pago pendiente se reevalúa y **entonces sí** reactiva, por `S5` o `S7`, con la
condición 3 ya cumplida — el camino entero está en `B/12` §5.3.

---

## 4. Lo que este capítulo NO cierra

- **El reembolso de un duplicado** lo confirma una persona (`DEC-CONC-001`) y su mecánica es del
  capítulo 13.
- **La conciliación periódica** —lo que encuentra lo que estos cruces dejaron pasar— es del
  capítulo 09.
- **`RF-3` sigue `UNKNOWN`**: no se sabe qué pasa al reembolsar un pago de más de 180 días,
  porque todavía no existe uno. El §61 prohíbe implementar sobre una fila `UNKNOWN`, así que el
  capítulo 13 tiene que tratar ese caso como no resuelto.
