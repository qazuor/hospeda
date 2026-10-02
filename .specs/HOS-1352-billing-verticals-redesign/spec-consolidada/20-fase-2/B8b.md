# B8b · Los cambios del compromiso (después)

Pieza posterior. Mitad *b* de la unidad `B8`, partida por el owner en el corte del MVP (Z): el
cambio de plan y de ciclo, la pausa, el cierre de la sucesión con sus cinco escrituras y `S38`, con
la dirección de `direcciónDeCambio`; abre la ruta de la sucesión de `S1` y saca el aviso de `B13a`.

**Fase y gate.** Va en la **Fase 2**, con [B9b](B9b.md#pieza-b9b), en su propia rama épica
`epic/**` que entra a `staging` entera ([GATE:FP.F2](../30-el-corte.md#gate-fp-f2)). Su gate es el
de toda fase posterior ([GATE:FP](../30-el-corte.md#gate-fp)): el momento 2 aplicado a la rama de la
fase ([GATE:FP.1](../30-el-corte.md#gate-fp-1)), el checklist de smoke del sistema nuevo extendido
con lo de la fase —`staging` antes del merge y un 5c propio en producción—
([GATE:FP.2](../30-el-corte.md#gate-fp-2)) y el drift guard en verde, sin migración estructural
([GATE:FP.3](../30-el-corte.md#gate-fp-3)); y, pieza por pieza, el momento 1
([GATE:M1](../30-el-corte.md#gate-m1)).

## Objetivo, alcance y fuera de alcance

<a id="pieza-b8b"></a>

### PIEZA:B8b — en la lista de piezas

| pieza | unidad | cuándo | fuente |
|---|---|---|---|
| `B8b` | `B8` | después | Z |

De `B8`: cambio de plan y de ciclo, pausa, cierre de la sucesión, `S38`, con `G-R1-C` (Z); **y las
filas 5, 5-bis, 6, 7, 13-quater, 15, 16, 16-bis, 17, 17-bis y 17-ter del `19` §4** (BH; el reparto
por fila lo infiere la fuente y lo marca).

Origen: .specs/HOS-1352-billing-verticals-redesign/docs/16-fase-7-del-paraguas.md:963, .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:742

<a id="fila-b8b"></a>

### FILA:B8b — «Los cambios del compromiso (después)»

Llama a la pasarela (⛔). Deja funcionando **el resto de `B8`: cambio de plan y de ciclo, pausa, el
cierre de la sucesión con sus cinco escrituras y `S38`, con la dirección de `direcciónDeCambio`**;
**y abre la ruta de la sucesión de `S1`** (corte del MVP, owner 2026-10-01, Z); **y saca de Mi
Suscripción el aviso de `B13a`** *«todavía no se puede cambiar de plan…»*, **la única línea del corte
que una fase posterior cambia, por excepción declarada** (corte del MVP, owner 2026-10-01, AU); **y la
implementación de `S18`, `S31` y `S38` detrás de la interfaz a la que ya llaman `B5` y `B7`, sin tocar
su código, y la ruta de la sucesión de `S1`, cuyo cuerpo escribió `B3`** (corte del MVP, owner
2026-10-02, [BL](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl)).

Capítulos: `03` §5, S8–S10, **S17–S18**, **S22**, **S31**, **S38** · `12` §2, §3, §6, §7 · `02` §2.6
· `05` C2 (sobre `S22`; sobre `S11`, `S23` y `S24` es de `B8a`: corte del MVP, owner 2026-10-01,
AR), C4. Guards: **`G-R1-C`**.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:144

Las secciones de `12` §2, §3, §6 y §7, y `02` §2.6, que la columna de capítulos de la fila le asigna:

<!-- g-secciones: inicio (generado por scripts/generadores/secciones/gen.py; no editar a mano) -->

#### B/12-suscripcion.md · 2. La cola de cambios programados · cierra `M-SUB-02`

##### B/12-suscripcion.md · 2.1 Qué se programa realmente

El hueco pedía *«a lo sumo un cambio programado vigente, con reglas explícitas de reemplazo y de
cancelación»*, porque si no *«el estado del sistema depende del orden en que llegaron los
clicks»*.

Y lo primero es acotar qué se programa, porque `DEC-SUB-008` lo corrigió: **el monto se muta
cuando el cliente lo pide**, no se difiere. Lo único que queda para el fin del ciclo es **el
descenso de capacidades**, más la elección del cliente sobre qué conserva.

**Es una cola nuestra, de entitlements. No es una cola de cambios en el proveedor** — el
proveedor no tiene ninguna. **La transición que la aplica es `S38`** (`B/03` §3.2): llegada la
fecha, la fila pasa a la versión destino, se aplica la elección de qué conservar y se emite el
aviso de cobertura. Hasta los casos vecinos la cola no tenía transición que la nombrara
(revisión del owner, casos vecinos, 2026-09-29, caso 37).

**Y desde la revisión del owner (2026-09-28, C15) encola también el cambio de versión de una
migración de un plan retirado**: `S37` muta el monto siete días antes de la renovación y deja acá el
cambio de versión para ese día (`B/03` §3.2, `B/10` §3.7). Sigue siendo **a lo sumo uno** (`S37`
no corre sobre una fila con un cambio programado) y las colisiones del §2.2 valen igual, con una
diferencia: **un cambio que pide el cliente saca a la fila de la migración** (`B/10` §3.7 punto 8)
en vez de reemplazar el cambio encolado en silencio.

**Qué es un downgrade y qué un upgrade no lo decide este capítulo**: es el veredicto
`direcciónDeCambio(versiónOrigen, versiónDestino) → SUBE | BAJA` que emite verticales
(`12-contrato…` §4.1, `DEC-ARCH-008`), y lo que billing hace con cada uno está en `B/10` §3.5. Ni
el `rank` ni un delta que billing compute sobre las tablas de verticales (FASE 8 completa,
`F-8CD1-003`).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:185, .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:187

##### B/12-suscripcion.md · 2.2 A lo sumo uno, y las cuatro colisiones

| # | lo que llega encima | qué pasa con el descenso programado |
|---|---|---|
| 1 | **otro downgrade** | **lo reemplaza entero**, y la elección de qué conservar **se vuelve a pedir**: el plan destino cambió, así que la elección anterior responde a otra pregunta |
| 2 | **un upgrade** | **muere con la suscripción vieja.** `DEC-SUB-007` ejecuta el upgrade cancelando y recreando, y la nueva nace sin cola |
| 3 | **una cancelación** (§24) | **lo absorbe, y en los cuatro casos.** Desde `ACTIVE` (`S11`) las dos cosas caen en el mismo instante —el fin del período pagado— y ahí no hay capacidades que bajar: no queda servicio. Desde `PAUSED` (`S22`), desde `SUSPENDED` (`S23`) y desde `GRACE_PERIOD` (`S24`) la baja cae **hoy** (cap. 03 §3.2), así que el descenso no llega a ejecutarse nunca — que es la regla general de abajo: *«si no va a tenerlo nunca más, se descarta»* |
| 4 | **una pausa** (§26) | **espera a la reanudación, y en las DOS pausas por la misma razón.** No es que durante la pausa no haya servicio —eso es verdad de `CUSTOMER_REQUEST` y **falso de `COURTESY`**, que **sí emite** como `tipo: CORTESÍA` (`12-contrato…` §2.6, `DEC-GRANT-003`)—: es que **estando pausada el proveedor rechaza toda modificación**, con `400` explícito y medido (`EX-11`, `VERIFIED`), y un descenso arranca mutando el monto *«cuando el cliente lo pide»* (`DEC-SUB-008`). Así que el cambio **no se puede aplicar**, tenga o no servicio. Es la implicación 3 de `DEC-SUB-010` —*«todo cambio pedido durante la pausa se aplica DESPUÉS de reanudar»*— y es **el mismo argumento que el §6.2 ya usa para el aumento de precio** |

**La regla general detrás de las cuatro, en dos cláusulas y no en una:**

1. **Si la fila está pausada, el cambio espera a la reanudación** — por `EX-11` y la implicación 3
   de `DEC-SUB-010`, que es una regla sobre **lo que el proveedor acepta**, no sobre lo que el
   cliente está recibiendo.
2. **Si no va a tener servicio nunca más, se descarta** — es la colisión 3, y ahí no hay
   reanudación que esperar.

**Y el estado en que la fecha encuentra a la fila, que no es una colisión** (revisión del owner,
casos vecinos, 2026-09-29, caso G-A). Las cuatro de arriba son lo que llega encima del cambio;
esto es con qué estado llega su fecha. **En `GRACE_PERIOD` se aplica igual**: el servicio sigue,
`S38` no toca al proveedor y el monto ya se mutó, así que esperar dejaba al cliente con
capacidades que ya no paga. **En `SUSPENDED` espera y se aplica al volver por `S7`**: no hay
servicio que bajar. **Y si `S7` la devuelve a `CANCEL_SCHEDULED`**, porque el cobro entró sobre
un preapproval que `S6` ya había cancelado, **se aplica igual**: el período que se sostiene hasta
`S12` se pagó con el monto ya mutado (revisión del owner, casos vecinos, 2026-09-29, caso I-A).
**Un pagador con tarjeta suspendido no vuelve por `S7` sino como sucesora** (`DEC-SUB-019`), **y el
cambio muere con la fila vieja, como en la colisión 2**: la sucesora eligió su plan en el checkout
y nace sin cola (revisión del owner, casos vecinos, 2026-09-29, caso I-B). Ninguna de las cuatro colisiones cambia, y la regla general tampoco: la baja
desde la grace o desde la suspensión (`S24`, `S23`) lo sigue absorbiendo, y una fila que no vuelve
no lo aplica nunca (`B/03` §3.2, `S38`).

> **La versión anterior tenía UNA cláusula y era falsa de la mitad de su sujeto.** Decía que el
> descenso se aplica *«al fin del primer ciclo en que el cliente efectivamente tiene servicio»*, y
> en una **cortesía** el cliente **sí tiene servicio** —lo sostenemos nosotros—, así que esa regla
> ordenaba aplicar el descenso sobre una fila pausada: exactamente lo que `EX-11` demuestra
> imposible. Es el mismo defecto de razón que el §7.2 ya había corregido para la baja
> —*«el argumento va por el período pagado y no por “durante la pausa no hay servicio”, que es
> verdad de una sola de las dos pausas»*—, y acá sobrevivía porque la conclusión era correcta y
> nadie vuelve sobre la razón de una conclusión correcta. **La conclusión no cambia: esperar.**

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:216

##### B/12-suscripcion.md · 2.3 Arrepentirse sigue siendo barato

`DEC-SUB-008` lo dejó escrito y vale acá: volver al plan alto antes del fin del ciclo es **otra
mutación del monto más cancelar el descenso programado**. La cola es cancelable, no sólo
reemplazable.

**Y el pedido del descenso termina la promo de la fila** (orquestador, FASE 8
completa, pendiente 8; **el pedido y no el acto**, FASE 9 completa, contradicción 1 de `03`
§R6.5): escribe **`cobros_restantes = 0`** en la redención de promo que cuelga de
ella (`B/02` §2.4), porque la promo no sobrevive a un cambio de plan (`B/14` §2.2), **en el mismo
acto en que `DEC-SUB-008` muta el monto, y lo muta al precio de lista del plan nuevo, sin
promos**. En el downgrade
la fila sobrevive y la redención sigue colgando de ella, así que sin esta escritura el monto
esperado de `B/14` §2.4 la seguiría restando. **Entre el pedido y
el acto que aplica el descenso, el monto esperado es el del plan nuevo, sin promos** (FASE 8 completa, owner 2026-09-25; `B/14` §2.4; FASE 9 completa: en esa ventana el plan vigente es el viejo, y el monto ya se mutó al nuevo). **Y la migración tiene la ventana gemela**: entre `S37` y el `S38` que aplica su cambio, el monto esperado es el precio de lista de la versión destino para su ciclo, sin promos (`B/14` §2.4; verificación corta, 2026-09-29, lote M-C).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:256

#### B/12-suscripcion.md · 3. El precio que cambia entre programar y ejecutar · cierra `E-SUB-01`

##### B/12-suscripcion.md · 3.1 El hueco se disuelve casi entero, y conviene decir por qué

`E-SUB-01` preguntaba si al downgrade se le aplica el precio vigente **al programar** o **al
ejecutar**, y si al ejecutar fuera más caro, si eso cuenta como aumento a los efectos del §29.

**La pregunta presupone que el precio se aplica al ejecutar**, y `DEC-SUB-008` decidió lo
contrario: **el monto se muta cuando el cliente lo pide.** Lo que corre al fin del ciclo no lleva
precio.

**Entonces: rige el precio vigente al pedirlo**, que además es el que el cliente vio y aceptó.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:275, .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:277

##### B/12-suscripcion.md · 3.2 Y un aumento posterior no lo alcanza por esta puerta

Si el precio del plan destino sube entre el pedido y el fin del ciclo, **la suscripción conserva
el monto que se mutó**: `DEC-MP-002` fijó que **el precio vive en la suscripción, no sólo en el
plan** (implicación 2).

Ese cliente queda alcanzado por el aumento **como cualquier otro**: por la ventana de 60 días con
tres contactos, con **su** fecha efectiva. No hay un camino especial, y eso es lo que hay que
preservar — un aumento que entrara por la puerta del downgrade se saltearía el aviso del §29.

**Y desde BM y BZ el aumento no entra cambiando el precio de la versión destino** (corte del MVP,
owner 2026-10-02, CC): **un descenso encolado —el monto ya mutado por `DEC-SUB-008` y el `S38` que
aplica el cambio de versión al fin del ciclo— cuenta como cliente de la versión destino**, así que
la acción 19 rechaza fijar su precio (BM) y se publica una versión nueva. El cliente llega por `S38`
a la versión cuyo precio vio, y un aumento posterior le llega por BZ —una migración por `S37` y `S38`
con el motivo *«aumento»*— como a cualquier anclado. **El rechazo de la acción 19 cuenta también las
filas con un `S38` encolado hacia esa versión**, con su test en `B2`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:288

#### B/12-suscripcion.md · 6. Un cambio de precio que cae sobre una pausada · cierra `E-SUB-06`

##### B/12-suscripcion.md · 6.1 El choque está medido

`EX-11` **`VERIFIED`**: estando pausada **el proveedor rechaza toda modificación** con un `400`
explícito. Así que un aumento de `DEC-MP-002` cuya fecha efectiva caiga sobre un cliente pausado
**no se puede aplicar ese día**. El hueco daba tres salidas: encolarlo, bloquear la pausa
mientras haya un cambio pendiente, o cumplir el §29 de otro modo.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:1012, .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:1014

##### B/12-suscripcion.md · 6.2 Se encola, y la pausa no se bloquea

**El aumento espera a la reanudación y se aplica ahí.** `DEC-SUB-010` ya lo había anticipado en su
implicación 3: *«todo cambio pedido durante la pausa se aplica DESPUÉS de reanudar»*. Esta sección
sólo confirma que el aumento no es una excepción.

**Bloquear la pausa se descarta y conviene decir por qué**: sería negarle a un cliente un derecho
que su plan le da **para poder subirle el precio**. No hay forma de escribir eso en un aviso.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:1021

##### B/12-suscripcion.md · 6.3 Lo que hay que decirle, y cuándo

El aviso del §29 ya salió con **una fecha que va a dejar de ser cierta**. Y acá `DEC-SUB-010`
aporta la restricción incómoda: al reanudar se le muestra **una sola cosa, qué día se le va a
cobrar** — decisión explícita del owner, para no inventarle un problema.

**Las dos cosas se cumplen a la vez porque el aumento va en ese mismo dato**: al reanudar se le
dice **cuándo** se le cobra **y cuánto**. No es un aviso nuevo sobre el aumento; es el aviso de
reanudación diciendo la verdad.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:1030

##### B/12-suscripcion.md · 6.4 Y la ventana de 60 días no se recorta

Si la pausa fue larga, la fecha efectiva se corre **hacia adelante**, nunca hacia atrás. La
ventana del §29 protege el tiempo de reacción del cliente, y reanudar con un aumento aplicado
**el mismo día** le daría cero. Se aplica en el **primer cobro posterior a la reanudación**, y si
entre el aviso original y ese cobro no se cumplieron los 60 días, se espera al siguiente.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:1040

#### B/12-suscripcion.md · 7. Pausa más cancelación programada · cierra `E-SUB-02`

##### B/12-suscripcion.md · 7.1 La premisa del hueco ya no es cierta

`E-SUB-02` razonaba que el §26.4 corre el fin del período hacia adelante, y preguntaba si la
cancelación espera a ese fin extendido o corta en la fecha original.

**`DEC-SUB-010` decidió que los días no usados del ciclo en curso se pierden.** No hay período
extendido que esperar: lo que corre es la fecha del proveedor (`PS-6`: el ciclo que vence estando
pausada **avanza la fecha sin cobrar**), y eso no es servicio adeudado.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:1049, .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:1051

##### B/12-suscripcion.md · 7.2 Cancelar estando pausado termina el servicio en el acto

Y no es una decisión dura, es la única coherente: **lo que `DEC-SUB-009` sostiene es el período
que la persona ya pagó, y al pausar ese período se perdió**. `DEC-SUB-010` fijó que *«los días no
usados del ciclo en curso se pierden»* (§7.1), así que **no queda período pagado que sostener**.

La fecha de fin de servicio **es un dato nuestro** (`DEC-SUB-009`, implicación 3), así que la
fijamos: es el día de la cancelación.

**El argumento va por el período pagado y no por *«durante la pausa no hay servicio»*, que es
verdad de una sola de las dos pausas.** Una `PAUSED` por `CUSTOMER_REQUEST` efectivamente no tiene
servicio —el §26.1 detiene publicación, edición y servicio, y esa fila **no emite fuente**
(`12-contrato…` §2.6)—; una `PAUSED` por `COURTESY` **sí emite**, como `tipo: CORTESÍA`, porque el
servicio *«lo sostenemos nosotros»* (`DEC-GRANT-003`). Con la razón vieja el § decidía sólo la
mitad de su sujeto; con ésta decide las dos, porque **en las dos el ciclo pagado ya se perdió al
pausar**. Lo que la baja desde una cortesía sí corta son los meses de cortesía que quedaban
(en meses desde la FASE 8 completa, `F-8CB1-001`), y eso
se dice **antes de confirmar** (`B/19` §4, fila 8), con la misma forma que `DEC-GRANT-004` ya usa
para el cruce vecino.

**Quién lo ejecuta: `S22`** (`B/03` §3.2), que manda la fila directo a `CANCELLED` sin pasar por
`CANCEL_SCHEDULED`. Hasta esa fila **esta decisión no tenía ninguna transición que la cumpliera**,
y por la regla 1 del núcleo el intento se iba a la marca mientras el reloj de la pausa vencía,
`S10` devolvía la fila a `ACTIVE` y se le cobraba el ciclo siguiente. **Salvo sobre una sucesora
que vive del crédito de `DEC-SUB-006` sin consumir** (la que `S9` pausó al autorizar para
re-emitirle una cortesía diferida): el crédito es período pagado (`R17`), así que `S22` la lleva a
`CANCEL_SCHEDULED` con fin de servicio en el fin del crédito, como `S11`, y no corta en el acto lo
que la persona ya pagó (FASE 9 vuelta 2, verificación, owner 2026-09-27, `V2-b`).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:1060

##### B/12-suscripcion.md · 7.3 El orden inverso no existe

**Y no es el §7.2 al revés, aunque lo parezca.** Ahí faltaba la fila de una decisión ya tomada y
la fila se escribió (`S22`); acá **la decisión es que no haya fila**, y el motivo es una condición
del §26 —exige `ACTIVE`— más `EX-11`, que mide que el proveedor rechaza toda modificación sobre
una pausada. Leer la exhaustividad como argumento **a favor** de que algo no pasa sólo vale
cuando alguien decidió que no pase: si un capítulo decidió que sí y la tabla no lo tiene, lo que
falta es la fila.

Pausar estando en `CANCEL_SCHEDULED` **no es una transición de la máquina**: el §26 exige
`ACTIVE`, y la tabla del capítulo 03 §1 es exhaustiva —*lo que no está, no pasa*—. No hace falta
una regla: hace falta que nadie agregue esa transición.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:1089

##### B/02-modelo-de-datos.md · 2.6 Qué cuelga de una suscripción, y qué le pasa cuando otra la sucede

**Un upgrade cancela y recrea** (`DEC-SUB-007` alternativa C), así que la fila que llevaba todo se
va a `CANCELLED` y **cada cosa que le colgaba tiene que tener un destino declarado**. El §2.4
nombraba las entidades y ninguna decía qué le pasa en una sucesión; `S18` enumeraba sus efectos y
nombraba una sola de las tres. **Enumerar acá es lo que vuelve la pregunta contestable de una
vez**, en vez de descubrirse entidad por entidad:

| qué cuelga | columna | qué pasa cuando `S18` cierra la sucesión | por qué |
|---|---|---|---|
| **complementos** (addons recurrentes y de única vez) | `addon_instance.objetivo` con scope `VERTICAL_SUBSCRIPTION` | **se re-apuntan a la sucesora** | el objetivo no desapareció, se sucedió (`B/16` §4.2). Sin esto, todo upgrade cancela de forma irreversible los addons que el cliente pagó |
| **la redención de promo** | `promo_redemption.subscription_id` | **NO se re-apunta: la promo se pierde.** La redención se queda colgando de la predecesora, con su contador como estaba, y **no se escribe nada**; la sucesora nace con el precio de lista y ése es el que corresponde. **La fila no se borra**, así que `UNIQUE(promo_code_id, user_id)` (§2.4) sigue impidiendo volver a canjear el mismo código en la sucesora (FASE 8 completa, pendiente 7, owner 2026-09-25) | **La promo se dio sobre el plan en que estaba**, y las promos no sobreviven a un cambio de plan —upgrade, downgrade o de ciclo— (`B/14` §2.2, owner 2026-09-25). No es una falla silenciosa: la persona lo lee antes de confirmar (`B/19` §4, fila 7) |
| **la cortesía vigente** | `courtesy_grant.subscription_id` (no anulable) + **`saldo_meses`** (§2.4) | **NO se re-apunta: queda DIFERIDA.** `S18` la cierra sobre la predecesora y le escribe en `saldo_meses` los meses que le quedaban (en meses desde la FASE 8 completa, `F-8CB1-001`; la fracción, abierta en §2.4); **`S9` la re-emite sobre la sucesora cuando ésta llega a `ACTIVE`** —re-apuntando ahí sí `subscription_id`, recalculando `inicio`/`fin` y volviendo el saldo a nulo— y la deja `PAUSED` con motivo `COURTESY` | `DEC-GRANT-007`. Re-apuntarla en el cierre **pedía una pausa que ninguna transición declara**: el `hacia` de `S18` es *«el mismo estado»* y la única fila que llega a `PAUSED · COURTESY` es `S9`, cuyo `desde` es `ACTIVE`; sobre una sucesora en `PENDING_AUTHORIZATION` no hay transición, y la regla 1 del núcleo mandaba el cierre del camino normal a la marca. Y si alguien la re-apuntaba sin pausar, la sucesora autorizaba y **cobraba** con una cortesía encima que es *«una fila de base que no hace nada»*. Diferirla usa `S9` **tal como está**, sobre una fila `ACTIVE` que el proveedor sí deja pausar |
| **el pago pendiente por `S19`** | `payment.subscription_id` **o `manual_payment.subscription_id`** — `S19` retiene el pago del período impago **entre por la puerta que entre** (cap. 03 §3.2) | **no se re-apunta**: el pago es un hecho de la fila que lo cobró. `S18` le abre a **esa** fila una marca con motivo **`REEMBOLSO_POR_CONFIRMAR`** (§2.5), **con el pago colgado de ella** (§2.2), y el reembolso lo confirma una persona (`DEC-RF-002`), asentado en un `refund` sobre ese mismo pago (§2.3) | re-apuntar un cobro a otra fila falsearía el registro contable, que el §4.1 conserva íntegro. Lo que se mueve no es el pago sino **quién tiene que mirarlo** — y sin el motivo esa fila llegaba al listado indistinguible de las otras doce marcas |
| **pagos y pagos manuales ya resueltos, comprobantes, pausas cerradas, el `provider_link`** | varias | **no se re-apuntan** | son el histórico de esa fila y de su preapproval. Cada suscripción tiene el suyo |

**La primera es el re-apunte, la segunda es la PÉRDIDA
(pendiente 7), la tercera es el DIFERIMIENTO, la cuarta es el aviso, y la quinta es historia.** El reparto cambió con `DEC-GRANT-007`: hasta entonces las tres primeras se
re-apuntaban y la cortesía era la que no se podía ejecutar. Es la distinción que `S18` tiene que
ejecutar y la que `G-R1-C` vigila: un cierre que escribe las dos
columnas y deja **un complemento** apuntando a la predecesora, **o una cortesía
vigente sin cerrar y sin saldo**, es un cierre incompleto, no un cierre.

> **Ya no**: `S25` salió con la revisión del
> owner, 2026-09-28, C8, y el cierre de `S18` vuelve a ser el único escritor del diferimiento.

**Y la primera y la tercera tienen el mismo modo de falla: son silenciosas.**
Ninguna emite webhook, ninguna cambia un estado que el barrido compare, y las dos le
sacan al cliente algo que ya tenía —capacidad comprada, cortesía firmada— en
el acto con el que decidió gastar más. La segunda **ya no**: desde la pendiente 7 la promo se
pierde a propósito y se avisa antes (`B/14` §2.2). Por eso el inventario va acá y no repartido en
dos capítulos. **Y la tercera tiene además un segundo modo de falla que
la primera no tiene**: el diferimiento se puede escribir bien y la
re-emisión no ocurrir nunca, porque `S9` es un acto y no un reloj — para eso está la **sexta**
comprobación de cero llamadas del `B/09` §3.

> **Y un grant NO es una sucesión: no re-apunta nada, y tampoco se lleva nada puesto.** `S13`
> alcanza *«toda fila viva **principal**»* (`B/03` §3.2), así que **no toca la suscripción de
> complemento** —que es una fila de esta misma tabla, con su `clase`—; y el addon tampoco queda
> huérfano, porque el grant **releva** a la principal en esa vertical (`B/16` §4.2, tercera
> mitad de la condición). De las cinco filas de arriba la única que un grant mueve por ser grant
> es la cuarta —el pago pendiente por `S19`—, y la mueve **apagando la bandera**, no
> re-apuntándola (rama 4 de `B/12` §5.3).
>
> **Y si el grant lleva `includesAddons: true`, la primera fila la mueve OTRO acto, que tampoco
> es una sucesión.** `S20` (`B/03` §3.2) **cancela** la suscripción de complemento de cada addon
> compatible y **la instancia pasa a colgar del ancla** —no de la sucesora, porque no hay
> sucesora—, que es el addon a costo $0 del §35.2 escrito por fin como un acto (`B/16` §3.4).
> Esto **no convierte al grant en una sucesión**: no hereda nada, no re-apunta la promo ni la
> cortesía y no cierra ningún candado. Lo único que comparte con `S18` es que el complemento
> **deja de colgar de donde colgaba**, y hacia dónde pasa a colgar es distinto: allá la sucesora,
> acá el ancla. Con el flag en `false` no se mueve nada y el complemento sigue cobrando.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/02-modelo-de-datos.md:1179

<!-- g-secciones: fin -->

La fila de origen, [FILA:B8](../10-corte/B8a.md#fila-b8), y su criterio,
[LISTA:B8](../10-corte/B8a.md#lista-b8), están definidos en la mitad *a*; esta pieza los implementa
en todo lo que no es la baja desde `ACTIVE` (`R1-a`).

**Fuera de alcance** (y dónde vive): `S11`, `S12`, `S23`, `S24` y `05` C2 sobre ellas, en
[B8a](../10-corte/B8a.md#pieza-b8a); el primer disparador de `S9`, `S30`, `S34` y `S35`, en
[B9b](B9b.md#pieza-b9b); `S32`/`S33`, en [B7](../10-corte/B7.md#pieza-b7); el criterio del excedente
(qué cae primero), en [V6](../10-corte/V6.md#pieza-v6); la cola, las columnas de la sucesión y su
esquema, creados al corte por [B3](../10-corte/B3.md#pieza-b3) (AP); la compra del addon de
`05` C4, en [B10](../20-fase-3/B10.md#pieza-b10).

## Historias de usuario y criterios de aceptación

### Historias de usuario

<a id="us-b8b-1"></a>
**US:B8b:1**

Actor: anfitrión

Como anfitrión con un plan mensual, quiero pausar mi suscripción por meses enteros y volver cuando
quiera, para no pagar mientras no uso el servicio.

Fuente: [TRANS:B:S8](../04-catalogos.md#trans-b-s8) · [TRANS:B:S10](../04-catalogos.md#trans-b-s10) · [DEC-SUB-010](../01-decisiones-vigentes.md#dec-sub-010)

<a id="us-b8b-2"></a>
**US:B8b:2**

Actor: anfitrión

Como anfitrión, quiero cambiar de plan o de ciclo sin pagar dos veces y sin perder lo que ya pagué,
para ajustar lo que contraté. *Ejemplo*: Juan, que se suscribió al Básico la semana siguiente al
corte, sube de plan desde Mi Suscripción: autoriza el plan nuevo en el checkout y su primer cobro
se corre por el valor de lo que ya había pagado.

Fuente: [DEC-SUB-006](../01-decisiones-vigentes.md#dec-sub-006) · [DEC-SUB-007](../01-decisiones-vigentes.md#dec-sub-007) · [DEP:5](../03-contrato-de-cobertura.md#dep-5)

<a id="us-b8b-3"></a>
**US:B8b:3**

Actor: sistema/cron

Como sistema, quiero cerrar cada sucesión con sus cinco escrituras y aplicar los cambios programados
en su fecha, para que nada quede colgando de la suscripción vieja.

Fuente: [TRANS:B:S18](../04-catalogos.md#trans-b-s18) · [TRANS:B:S38](../04-catalogos.md#trans-b-s38) · [GUARD:G-R1-C](../04-catalogos.md#guard-g-r1-c)

<a id="us-b8b-4"></a>
**US:B8b:4**

Actor: admin

Como admin, quiero pausar, reanudar o cambiar de plan a un cliente con permiso, auditoría y
confirmación, para resolver pedidos de soporte.

Fuente: [ACC:9](../02-nucleo.md#acc-9) · [ACC:10](../02-nucleo.md#acc-10)

### Criterios de aceptación

<a id="ac-b8b-1"></a>
**AC:B8b:1** — pausar (`S8`)

- **Dado** una principal en `ACTIVE`
- **Cuando** la persona pide pausar
- **Entonces** sólo ocurre si `puedePausar()` da sí —un solo lugar, que exige un plan **mensual** y el
  `permitePausa` de la versión, leído del contrato, y los topes del §26.3 contados por
  **`user + vertical`** y en meses (3 pausas por ventana móvil de 12 meses, 4 pausas-mes por pausa y
  8 acumuladas), que sobreviven a cancelar y volver a suscribirse—; se elige en **meses enteros**; se
  pausa en el proveedor y el `PUT paused` **se confirma por relectura**: si la relectura sigue viendo
  `authorized`, `S8` **no ocurre** —la fila se queda en `ACTIVE`, no se abre la `subscription_pause`—
  y `S14` pone la marca `PAUSA_NO_APLICADA`; en un pagador manual no hay `PUT`; y si ocurre, la fila
  queda `PAUSED` con motivo `CUSTOMER_REQUEST` y sus complementos recurrentes de esa vertical se
  pausan con ella por `S32`.

Fuente: [TRANS:B:S8](../04-catalogos.md#trans-b-s8) · [TPZ:S8](#tpz-s8) · [DEC-SUB-010](../01-decisiones-vigentes.md#dec-sub-010) · [DEC-SUB-004](../01-decisiones-vigentes.md#dec-sub-004) · [INV:23](../02-nucleo.md#inv-23) · [DEP:4](../03-contrato-de-cobertura.md#dep-4)

<a id="ac-b8b-2"></a>
**AC:B8b:2** — una pausa siempre tiene motivo

- **Dado** una `subscription_pause`
- **Cuando** se escribe
- **Entonces** su motivo es uno del dominio cerrado (`CUSTOMER_REQUEST` o `COURTESY`) y la base
  rechaza otro o ninguno; y el reloj de la pausa lee el motivo, nunca al proveedor.

Fuente: [INV:D3](../02-nucleo.md#inv-d3)

<a id="ac-b8b-3"></a>
**AC:B8b:3** — reanudar (`S10`), en el fin previsto o antes

- **Dado** una principal en `PAUSED`
- **Cuando** llega el fin previsto o la persona vuelve antes
- **Entonces** se manda `PUT status=authorized` y, **confirmado por relectura**, la fila vuelve a
  `ACTIVE`, se escribe `fin_real` en la `subscription_pause` con el día de la reanudación —los meses
  no usados no cuentan contra los topes—, sus complementos pausados vuelven por `S33`, y se le
  muestra **una sola cosa: qué día se le cobra**; en un pagador manual la fecha del próximo cobro
  avanza tantos ciclos como vencieron durante la pausa, sin abrir cuota; **si la relectura sigue
  viendo `paused`, `S10` no ocurre** y se pone `REANUDACIÓN_NO_APLICADA`. La vuelta anticipada es
  libre: el regalo de días que eso puede dar se acepta y lo detecta el resumen del barrido. `S10`
  tiene además **un tercer evento, la revocación de una cortesía temporal por el `SUPER_ADMIN`**
  (acción 1): reanudar antes del fin por un acto suyo, con `fin_real` escrito en el acto y la misma
  relectura, sin reembolso y con el aviso que dice qué día se le cobra; **lo agrega `B9b`** (BO), sobre
  esta misma transición y sin una transición propia ([AC:B9b:13](B9b.md#ac-b9b-13)).

Fuente: [TRANS:B:S10](../04-catalogos.md#trans-b-s10) · [TPZ:S10](#tpz-s10) · [INV:24](../02-nucleo.md#inv-24) · [DEC-SUB-010](../01-decisiones-vigentes.md#dec-sub-010)

<a id="ac-b8b-4"></a>
**AC:B8b:4** — un aumento que cae sobre una pausada

- **Dado** un aumento anunciado cuya fecha cae con la fila pausada
- **Cuando** la fila se reanuda
- **Entonces** el aumento se aplica en el **primer cobro posterior a la reanudación**, nunca
  recortando los 60 días del aviso (si no se cumplieron, espera al siguiente); la pausa no se
  bloqueó por el aumento; y al reanudar se le dice cuándo se le cobra **y cuánto**.

Fuente: [LISTA:B8](../10-corte/B8a.md#lista-b8) · [DEC-SUB-010](../01-decisiones-vigentes.md#dec-sub-010)

<a id="ac-b8b-5"></a>
**AC:B8b:5** — la baja estando pausado (`S22`)

- **Dado** una fila `PAUSED`, con cualquiera de los dos motivos
- **Cuando** la persona pide la baja
- **Entonces** va a `CANCELLED` **en el acto**, con la fecha de fin en el día de la cancelación; se
  cancela el preapproval con la relectura de `S17` y el correo antes; se escribe `fin_real` en la
  `subscription_pause` ese mismo día; si el motivo era `COURTESY`, la cortesía termina con ella; es
  idempotente. **Salvo sobre una fila que vive del crédito de `DEC-SUB-006` sin consumir**: ahí va a
  **`CANCEL_SCHEDULED` con `fin_de_servicio` en el fin del crédito**, con la regla de `S11` entera
  —sus complementos recurrentes incluidos, con la selección de `S11`— y `S12` la termina en esa
  fecha; si la llevara a `CANCELLED` en el acto estaría leyendo la pausa y no el crédito. Un cobro
  anterior que se acredita después extiende con `max` como en `S11` (`05` C2).

Fuente: [TRANS:B:S22](../04-catalogos.md#trans-b-s22) · [TPZ:S22](#tpz-s22) · [DEC-SUB-009#📌2](../01-decisiones-vigentes.md#dec-sub-009-p2) · [LISTA:B8b](#lista-b8b)

<a id="ac-b8b-6"></a>
**AC:B8b:6** — de `PAUSED` no se sale a otro lado

- **Dado** una fila `PAUSED`
- **Cuando** algo intenta llevarla a un estado que no sea `ACTIVE` ni `CANCELLED`
- **Entonces** no ocurre —el intento cae en la regla 1 del núcleo, `TRANSICIÓN_NO_DECLARADA`—, **salvo**
  `SUSPENDED` por `S6` desde una `PAUSED · COURTESY` por un contracargo, y `CANCEL_SCHEDULED` por `S22`
  sobre una fila que vive del crédito.

Fuente: [PROH:B:4](../04-catalogos.md#proh-b-4) · [MOT:6](../04-catalogos.md#mot-6)

<a id="ac-b8b-7"></a>
**AC:B8b:7** — la dirección del cambio sale de `direcciónDeCambio`, y cada camino

- **Dado** un cambio hacia una versión de `rank` MAYOR con un solo limit menor
- **Cuando** la persona lo pide
- **Entonces** sigue el camino de **DOWNGRADE**, porque la dirección la da `direcciónDeCambio` del
  contrato y nunca el `rank`: **muta el monto ya**, al precio de lista del plan nuevo sin promos, y
  **encola el descenso de capacidades** al fin del ciclo, con el aviso previo del excedente; un
  **upgrade** —y un cambio de ciclo— **cancela y recrea por el checkout del proveedor**, como
  sucesión, compensando lo pagado sin usar **por valor**: el crédito se divide por el precio diario
  del plan nuevo y corre la fecha del primer cobro de la sucesora, y se consume entero sin dejar
  saldo; el checkout le muestra monto y fecha antes de confirmar.

Fuente: [DEP:5](../03-contrato-de-cobertura.md#dep-5) · [DEC-SUB-006](../01-decisiones-vigentes.md#dec-sub-006) · [DEC-SUB-007](../01-decisiones-vigentes.md#dec-sub-007) · [ACC:10](../02-nucleo.md#acc-10) · [LISTA:B8](../10-corte/B8a.md#lista-b8)

<a id="ac-b8b-8"></a>
**AC:B8b:8** — la sucesión se abre, y la vieja se cancela sólo al autorizarse la nueva

- **Dado** `B8b` mergeada
- **Cuando** `S1` recibe un alta que declara una sucesión (`sucede_a`)
- **Entonces** la declara —antes de `B8b` esa ruta no existía: `B3` escribió el cuerpo de la rama de
  sucesión de `S1` sin ruta, y `B8b` agrega la ruta sin tocar ese cuerpo (BL)—; la sucesora nace con fecha de primer
  cobro posterior al vencimiento de su ventana —salvo la de una `SUSPENDED` de pagador con tarjeta cuyo
  preapproval se releyó `cancelled`, que cobra al autorizar ([INV:D8](../02-nucleo.md#inv-d8))—; y **la vieja se cancela sólo al recibir el webhook de
  que la nueva quedó autorizada**: si la persona abandona el checkout, la vieja sigue viva y no pasó
  nada; si para entonces el preapproval viejo ya está cancelado, no se lo vuelve a cancelar.

Fuente: [INV:D7](../02-nucleo.md#inv-d7) · [INV:D8](../02-nucleo.md#inv-d8) · [DEC-SUB-006](../01-decisiones-vigentes.md#dec-sub-006) · [LISTA:B8b](#lista-b8b)

<a id="ac-b8b-9"></a>
**AC:B8b:9** — `S17`: la predecesora se cancela al autorizar la sucesora

- **Dado** una predecesora viva —`ACTIVE`, `GRACE_PERIOD`, `CANCEL_SCHEDULED`, `PAUSED` o
  `SUSPENDED`— con una sucesora viva que la apunta
- **Cuando** la sucesora queda autorizada, confirmado por relectura
- **Entonces** la predecesora pasa a `CANCELLED`; su preapproval se cancela si sigue vivo, y si la
  relectura ya lo ve `cancelled` no se manda nada; **antes de la llamada sale nuestro correo**: si
  falla de forma transitoria, `S17` **no ocurre en esta corrida** y su condición se reevalúa; sin
  destinatario, o con el correo `failed` definitivo del outbox, se cancela igual y se escala; y si
  estaba `PAUSED`, cierra la pausa con `fin_real`.

Fuente: [TRANS:B:S17](../04-catalogos.md#trans-b-s17) · [TPZ:S17](#tpz-s17) · [INV:D7](../02-nucleo.md#inv-d7)

<a id="ac-b8b-10"></a>
**AC:B8b:10** — `S18`: el cierre de la sucesión, con sus cinco escrituras

- **Dado** una sucesora viva —en `ACTIVE`, o en `PENDING_AUTHORIZATION` si la predecesora se murió
  sola— cuya predecesora ya no es fila viva
- **Cuando** corre `S18` —por la autorización, o porque la predecesora murió sin `S17` (`S12`, `S16`,
  el espejo, `S22`, `S23`, `S24` o `S36`), o por una resolución de `S15`—
- **Entonces** escribe `sucedida_por` en la predecesora; limpia `sucede_a` en la sucesora; re-apunta a
  la sucesora los complementos; **no** re-apunta la redención de promo, que se pierde con el cambio de
  plan; la cortesía vigente de la predecesora **se cierra** sobre ella con su `saldo_meses` (la
  fracción redondeada para arriba), o con `motivo_cierre = DESTINO_DE_PLAN_NO_MENSUAL` si la sucesora
  no es mensual; y si la predecesora retiene un pago por `S19`, le abre a ella la marca
  `REEMBOLSO_POR_CONFIRMAR` con el pago colgado —salvo si murió por `S36`, cuyo `RF1` ya lo devuelve, y
  salvo el pagador manual cuyo pago retenido ya entró al crédito de la sucesora: ahí no abre la marca y
  el pago queda como crédito ([DEC-SUB-017#📌1](../01-decisiones-vigentes.md#dec-sub-017-p1); `B/12`
  §5.3)—. La sucesora pasa a ser el origen.

Fuente: [TRANS:B:S18](../04-catalogos.md#trans-b-s18) · [TPZ:S18](#tpz-s18) · [MOT:1](../04-catalogos.md#mot-1) · [DEC-GRANT-007](../01-decisiones-vigentes.md#dec-grant-007) · [DEC-SUB-017#📌1](../01-decisiones-vigentes.md#dec-sub-017-p1)

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:714

<a id="ac-b8b-11"></a>
**AC:B8b:11** — la predecesora que se muere sola, y el upgrade que no le saca nada

- **Dado** una sucesión en curso con la sucesora todavía esperando autorización
- **Cuando** la predecesora se muere sola (por ejemplo, `S16`), o cuando un upgrade se completa
- **Entonces** la sucesión **se cierra en el acto** y **un alta nueva sobre ese `user + vertical` la
  rechaza la base**; y en el upgrade completo los complementos terminan colgando de la sucesora y la
  cortesía vigente se cierra con su saldo de meses para que `S9` la re-emita, mientras la promo se
  pierde.

Fuente: [LISTA:B8](../10-corte/B8a.md#lista-b8) · [TRANS:B:S18](../04-catalogos.md#trans-b-s18) · [LISTA:B8b](#lista-b8b)

<a id="ac-b8b-12"></a>
**AC:B8b:12** — `S9`, la re-emisión de la cortesía diferida (su segundo disparador)

- **Dado** una sucesora recién autorizada con una `courtesy_grant` con `saldo_meses` no nulo que
  apunta a la fila cuyo `sucedida_por` es ésta
- **Cuando** la sucesora llega a `ACTIVE`
- **Entonces** se re-emite **la misma fila** de `courtesy_grant`, con la firma original: su
  `subscription_id` pasa a la sucesora, `inicio` es hoy —o, sobre una sucesora que vive del crédito,
  el fin del crédito—, `fin = inicio + saldo_meses` y `saldo_meses` vuelve a nulo; la pausa se abre
  en el acto con `fin_previsto` en ese `fin`, y el `PUT paused` se confirma por relectura —si no se
  aplica, `S9` no ocurre, se pone `PAUSA_NO_APLICADA` y el aviso a `SUPER_ADMIN` lo dice—. Si el
  proveedor cobra entre `S2` y este acto, el cobro va a la marca `COBRO_DURANTE_CORTESÍA` con la
  propuesta de devolver.

Fuente: [TRANS:B:S9](../04-catalogos.md#trans-b-s9) · [TPZ:S9](#tpz-s9) · [DEC-GRANT-007](../01-decisiones-vigentes.md#dec-grant-007) · [DEC-GRANT-007#📌1](../01-decisiones-vigentes.md#dec-grant-007-p1) · [MOT:12](../04-catalogos.md#mot-12)

<a id="ac-b8b-13"></a>
**AC:B8b:13** — `S31`: la sucesora se corta cuando un contracargo corta a su predecesora

- **Dado** una sucesión en curso
- **Cuando** su predecesora se corta por un contracargo (`S6` por su tercer evento, o `S12` por su
  segundo)
- **Entonces**, en la misma transacción, la sucesora va a `ABANDONED` desde `PENDING_AUTHORIZATION` o a
  `CANCELLED` desde `ACTIVE`, y la sucesión se cae sin `S18`; su preapproval se cancela con la
  relectura y el correo antes (si falla de forma transitoria, la reintenta el barrido); un pagador
  manual en `PENDING_AUTHORIZATION` cierra su primera cuota; un saldo de cortesía diferido esperándola
  se cierra con `motivo_cierre = CONTRACARGO_DE_LA_PREDECESORA`; y un pago pendiente por `S19` se
  reevalúa por la rama 2.

Fuente: [TRANS:B:S31](../04-catalogos.md#trans-b-s31) · [TPZ:S31](#tpz-s31)

<a id="ac-b8b-14"></a>
**AC:B8b:14** — Mi Suscripción ya no dice *«todavía no se puede cambiar de plan»*

- **Dado** `B8b` mergeada
- **Cuando** un anfitrión con una suscripción `ACTIVE` abre Mi Suscripción
- **Entonces** **el aviso de [B13a](../10-corte/B13a.md#ac-b13a-7) ya no aparece** y se le ofrece
  cambiar de plan; es la única línea del corte que cambia, y nada más que ese texto.

Fuente: [LISTA:B8b](#lista-b8b) · [FILA:B8b](#fila-b8b)

<a id="ac-b8b-15"></a>
**AC:B8b:15** — `S38`: la cola se aplica en su fecha

- **Dado** una fila con un cambio programado en la cola —el descenso de un downgrade o el cambio de
  versión de una migración—
- **Cuando** llega su fecha con la fila en `ACTIVE`, en `GRACE_PERIOD` o en `CANCEL_SCHEDULED` puesta
  por `S7`, o la fila vuelve a `ACTIVE` con la fecha ya pasada (por `S10` o por `S7`)
- **Entonces** la fila pasa a la versión y la billing option destino, aplica la elección de qué
  conservar del excedente, **vacía la cola** y emite el aviso de cobertura después del commit; no
  toca al proveedor; si la fecha coincide con la apertura de una cuota manual (`MP5`), `S38` corre
  antes; una fila pausada o suspendida espera; y en un pagador con tarjeta suspendido que vuelve como
  sucesora el cambio muere con la fila vieja. **Y con el motivo *«aumento»*** —el cambio de versión que
  encola `S37` para un aumento de precio a un cliente anclado, que usa
  [B12](../20-fase-3/B12.md#ac-b12-9)— **cambia la versión en la fecha de aplicación del plazo 11, sin
  la cohorte `PARA_RESOLVER` y con la promo viva conservada** (corte del MVP, owner 2026-10-02, BZ).

Fuente: [TRANS:B:S38](../04-catalogos.md#trans-b-s38) · [TPZ:S38](#tpz-s38) · [DEC-SUB-008#📌2](../01-decisiones-vigentes.md#dec-sub-008-p2) · [DEC-MP-002#📌3](../01-decisiones-vigentes.md#dec-mp-002-p3)

<a id="ac-b8b-16"></a>
**AC:B8b:16** — a lo sumo un cambio programado, y las cuatro colisiones

- **Dado** una fila con un descenso programado
- **Cuando** llega encima otro downgrade, un upgrade, una cancelación o una pausa
- **Entonces** otro downgrade **lo reemplaza y vuelve a preguntar** qué conservar; un upgrade lo hace
  morir con la suscripción vieja; una cancelación lo absorbe; una pausa lo hace esperar a la
  reanudación; el pedido del descenso termina la promo de la fila (`cobros_restantes = 0`) en el mismo
  acto en que muta el monto; y arrepentirse es otra mutación del monto más cancelar el descenso
  (Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:258-266).

Fuente: [LISTA:B8](../10-corte/B8a.md#lista-b8) · [TRANS:B:S38](../04-catalogos.md#trans-b-s38)

<a id="ac-b8b-17"></a>
**AC:B8b:17** — en grace no se cambia de plan

- **Dado** una fila en `GRACE_PERIOD`
- **Cuando** la persona busca cambiar de plan
- **Entonces** el cambio **no se ofrece ni se puede declarar**: desde `GRACE_PERIOD` no nace una
  sucesión; la pantalla dice cómo regularizar —con tarjeta, cambiar la tarjeta, que reintenta el
  cobro; con pago manual, pagar la cuota— y que, con la suscripción al día, puede cambiar.

Fuente: [DEC-SUB-021](../01-decisiones-vigentes.md#dec-sub-021) · [LISTA:B8](../10-corte/B8a.md#lista-b8)

<a id="ac-b8b-18"></a>
**AC:B8b:18** — el mínimo del ciclo para ofrecer un cambio

- **Dado** un pagador con tarjeta cuya próxima fecha de cobro está cerca
- **Cuando** pide un cambio de plan
- **Entonces** la ventana de la sucesora vence a lo que llegue primero —sus 72 h o las 00:00 del día de
  la próxima fecha de cobro de la predecesora en `-04`—, y **si lo que queda es menor que el plazo
  15** (24 h al inicio, leído de la versión de plazos de la suscripción para ese ciclo), el cambio
  **no se ofrece** en ese momento: se le dice desde cuándo puede hacerlo, después del cobro.

Fuente: [PLAZO:15](../02-nucleo.md#plazo-15) · [DEC-SUB-006](../01-decisiones-vigentes.md#dec-sub-006)

<a id="ac-b8b-19"></a>
**AC:B8b:19** — comprar un addon durante un downgrade programado (`05` C4)

- **Dado** una fila con un descenso programado que baja la base de un addon
- **Cuando** la persona compra ese addon antes de la fecha
- **Entonces** **se permite, con aviso explícito**: el aviso dice que hay un descenso programado para
  tal fecha y qué parte de lo que compra va a quedar fuera del límite desde ahí; no se bloquea.

Fuente: [LOCK:C4](../04-catalogos.md#lock-c4)

<a id="ac-b8b-20"></a>
**AC:B8b:20** — la rama 6 entra al listado con el default en devolver

- **Dado** una predecesora en `SUSPENDED` o en `GRACE_PERIOD` que retiene un pago por `S19` y se da de baja ella misma (`S23` o `S24`)
- **Cuando** `S18` cierra la sucesión
- **Entonces** abre `REEMBOLSO_POR_CONFIRMAR` con el pago colgado y la propuesta **devolver**, que una
  persona confirma o rechaza; ningún reembolso se dispara solo; y tras `S36` la rama no abre marca.

Fuente: [DEC-RF-003](../01-decisiones-vigentes.md#dec-rf-003) · [MOT:1](../04-catalogos.md#mot-1)

<a id="ac-b8b-21"></a>
**AC:B8b:21** — `G-R1-C`, el guard del cierre

- **Dado** el guard `G-R1-C` enchufado en `pnpm check:guards` y en el job `guards`
- **Cuando** un camino escribe `sucedida_por` sin limpiar `sucede_a`, o limpia `sucede_a` sin escribir
  `sucedida_por`, o cierra una sucesión dejando colgado de la predecesora un complemento sin re-apuntar,
  una cortesía vigente sin cerrar y sin `saldo_meses`, o un pago pendiente por `S19` sin una marca
  abierta con motivo `REEMBOLSO_POR_CONFIRMAR`
- **Entonces** el guard da rojo; el inventario contra el que se verifica es el de `02` §2.6.

Fuente: [GUARD:G-R1-C](../04-catalogos.md#guard-g-r1-c) · [LISTA:B8b](#lista-b8b)

<a id="ac-b8b-22"></a>
**AC:B8b:22** — las acciones del panel: pausar, reanudar y cambiar de plan

- **Dado** un admin
- **Cuando** pausa, reanuda o cambia de plan a un cliente
- **Entonces** cada acto exige su permiso, deja su auditoría y pide confirmación explícita, porque
  mueve plata; sin permiso, la ruta lo rechaza.

Fuente: [ACC:9](../02-nucleo.md#acc-9) · [ACC:10](../02-nucleo.md#acc-10)

<a id="ac-b8b-23"></a>
**AC:B8b:23** — salida de la pieza (el *«Lista cuando»* de `B8b`)

- **Dado** `B8b` mergeada en la rama de la Fase 2
- **Cuando** se corre su juego y se cumple el gate de la fase
- **Entonces** se cumple **el criterio de `B8` sin la cláusula de `R1-a`**
  ([LISTA:B8](../10-corte/B8a.md#lista-b8), cláusulas 1 a 7 y 9); **`G-R1-C` está escrito y roto a
  propósito**, y desde su merge `S1` declara sucesiones; **y Mi Suscripción ya no dice *«todavía no
  se puede cambiar de plan»***; **y, con la implementación real detrás de las interfaces que ya
  llaman `B5` y `B7`, sin cambiar su código, se cumple [AC:B8b:24](#ac-b8b-24)**.

Fuente: [LISTA:B8b](#lista-b8b) · [FILA:B8b](#fila-b8b) · [GATE:FP.F2](../30-el-corte.md#gate-fp-f2)

<a id="ac-b8b-24"></a>
**AC:B8b:24** — la implementación real detrás de las interfaces que ya llaman `B5` y `B7`

- **Dado** `B5` y `B7` mergeadas al corte, con sus ramas escritas enteras y sus llamadas a `S18`,
  `S31` y `S38` contra una interfaz interna, ejercidas allá con filas sembradas, y `B3` con el cuerpo
  de la rama de sucesión de `S1` escrito sin ruta; y `B8a`, que llama por la misma interfaz a `S31`
  desde `S12` y a `S18` desde `S23` y `S24` *(derivado: por BL la rama y la llamada las escribe la
  pieza dueña de la transición que dispara, y `S12`, `S23` y `S24` son de `B8a`; lo marco)*
- **Cuando** `B8b` trae la implementación detrás de esas interfaces
- **Entonces** en las ramas 1, 5 y 6 de `12` §5.3, **`S18` apaga la bandera con la marca
  `REEMBOLSO_POR_CONFIRMAR`**; **`S6` por su tercer evento corta la sucesora por `S31`**; **`S7` y
  `MP5` aplican `S38`**; desde su merge **una ruta declara la sucesión de `S1` sobre el cuerpo que
  escribió `B3`**; y **el diff de `B8b` no cambia el código de `B3`, `B5`, `B7` ni `B8a`**: si lo hiciera,
  rompería *«aditiva»*, que sólo tiene la excepción de AU.

Fuente: [LISTA:B8b](#lista-b8b) · [FILA:B8b](#fila-b8b) · [TRANS:B:S18](../04-catalogos.md#trans-b-s18) · [TRANS:B:S31](../04-catalogos.md#trans-b-s31) · [TRANS:B:S38](../04-catalogos.md#trans-b-s38) · [OWN:41-corte-del-mvp:t9:BL](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bl) · [DEC-ARCH-017#📌6](../01-decisiones-vigentes.md#dec-arch-017-p6)

<a id="ac-b8b-25"></a>
**AC:B8b:25** — lo que hay que decir en los actos de esta pieza (filas del `19` §4)

- **Dado** las filas 5, 5-bis, 6, 7, 13-quater, 15, 16, 16-bis, 17, 17-bis y 17-ter del `B/19` §4, y la rama
  desde `PAUSED` (`S22`) de la fila 8 (BH con AR: `S22` queda en `B8b`),
  que van con su acto a esta pieza (BH; reparto por fila inferido en la fuente)
- **Cuando** la persona pausa, reanuda, cambia de plan —o el cambio no se le ofrece— o pide la baja
  estando pausada
- **Entonces** cada superficie dice lo que su fila exige, con la fecha de ese cliente y sin
  preguntar *«¿estás seguro?»* (fila por fila, en la sección *UI web y admin, e i18n*); y una
  operación que no se ofrece lo dice con su motivo en vez de fallar sin explicación.

Fuente: [PIEZA:B8b](#pieza-b8b) · [FILA:B13a](../10-corte/B13a.md#fila-b13a) · [OWN:41-corte-del-mvp:t7:BH](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t7-bh) · [DEC-SUB-010](../01-decisiones-vigentes.md#dec-sub-010) · [DEC-SUB-021](../01-decisiones-vigentes.md#dec-sub-021) · [DEC-GRANT-004](../01-decisiones-vigentes.md#dec-grant-004)

<a id="ac-b8b-26"></a>
**AC:B8b:26** — los cambios de plan y la pausa, de punta a punta

- **Dado** el arnés de punta a punta de `B/20` §5.1 —los builds, el falso como servidor, el reloj
  adelantable y el correo capturado—
- **Cuando** se corren el cambio de plan, el cambio de ciclo (otro mecanismo), y la pausa con sus dos reanudaciones, al vencer y anticipada, que son el flujo que le toca escribir a esta
  pieza (*«cada unidad escribe la de su flujo»*: los cambios, la pausa y la cancelación son de `B8`)
- **Entonces** se cumplen las mismas aserciones que en la de `B3` ([AC:B3:33](../10-corte/B3.md#ac-b3-33)):
  sobre el contenido de `B/19` §4 y sobre el orden *«nuestro correo antes que el del proveedor»*.

Fuente: [FILA:B8b](#fila-b8b) · [LISTA:B8b](#lista-b8b)
Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:762, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:720, .specs/HOS-1354-billing-cobro-y-proveedor/docs/20-testing.md:722

### El criterio de terminación

<a id="lista-b8b"></a>

#### LISTA:B8b — el *«Lista cuando»* de `B8b`

**El criterio de `B8` sin la cláusula de `R1-a`, que fue a `B8a`** (corte del MVP, owner 2026-10-01,
Z); **y `G-R1-C` escrito y roto a propósito**, y desde su merge `S1` declara sucesiones; **y Mi
Suscripción ya no dice *«todavía no se puede cambiar de plan»*** (corte del MVP, owner 2026-10-01,
AU); **y, con la implementación real detrás de las interfaces que ya llaman `B5` y `B7`, sin cambiar
su código: en las ramas 1, 5 y 6 de `12` §5.3, `S18` apaga la bandera con la marca
`REEMBOLSO_POR_CONFIRMAR`; `S6` por su tercer evento corta la sucesora por `S31`; y `S7` y `MP5`
aplican `S38`; y desde su merge una ruta declara la sucesión de `S1` sobre el cuerpo que escribió
`B3`** (corte del MVP, owner 2026-10-02, BL).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:1069

## Reglas

- transiciones: [TRANS:B:S8](../04-catalogos.md#trans-b-s8),
  [TRANS:B:S9](../04-catalogos.md#trans-b-s9) (compartida con `B9b`),
  [TRANS:B:S10](../04-catalogos.md#trans-b-s10), [TRANS:B:S17](../04-catalogos.md#trans-b-s17),
  [TRANS:B:S18](../04-catalogos.md#trans-b-s18), [TRANS:B:S22](../04-catalogos.md#trans-b-s22),
  [TRANS:B:S31](../04-catalogos.md#trans-b-s31), [TRANS:B:S38](../04-catalogos.md#trans-b-s38);
- transición que no existe: [PROH:B:4](../04-catalogos.md#proh-b-4);
- guard: [GUARD:G-R1-C](../04-catalogos.md#guard-g-r1-c);
- candados: [LOCK:C4](../04-catalogos.md#lock-c4), y [LOCK:C2](../04-catalogos.md#lock-c2) sobre
  `S22` (dueña `B8a`);
- invariantes: [INV:23](../02-nucleo.md#inv-23), [INV:24](../02-nucleo.md#inv-24),
  [INV:D3](../02-nucleo.md#inv-d3), [INV:D7](../02-nucleo.md#inv-d7); y, por `S22` sobre la fila que
  vive del crédito, [INV:22](../02-nucleo.md#inv-22) (dueña `B8a`);
- motivos: [MOT:1](../04-catalogos.md#mot-1), [MOT:12](../04-catalogos.md#mot-12), y los de las
  ramas de fallo de `S8`, `S9` y `S10`, [MOT:22](../04-catalogos.md#mot-22) y
  [MOT:8](../04-catalogos.md#mot-8) (dueña `B7`);
- plazo: [PLAZO:15](../02-nucleo.md#plazo-15); dependencias entre épicas:
  [DEP:4](../03-contrato-de-cobertura.md#dep-4) y [DEP:5](../03-contrato-de-cobertura.md#dep-5);
- decisiones: [DEC-SUB-004](../01-decisiones-vigentes.md#dec-sub-004),
  [DEC-SUB-006](../01-decisiones-vigentes.md#dec-sub-006),
  [DEC-SUB-007](../01-decisiones-vigentes.md#dec-sub-007),
  [DEC-SUB-008#📌2](../01-decisiones-vigentes.md#dec-sub-008-p2),
  [DEC-SUB-009#📌2](../01-decisiones-vigentes.md#dec-sub-009-p2),
  [DEC-SUB-010](../01-decisiones-vigentes.md#dec-sub-010),
  [DEC-SUB-021](../01-decisiones-vigentes.md#dec-sub-021),
  [DEC-GRANT-007](../01-decisiones-vigentes.md#dec-grant-007) con su
  [📌1](../01-decisiones-vigentes.md#dec-grant-007-p1),
  [DEC-RF-003](../01-decisiones-vigentes.md#dec-rf-003);
- y lo que ejerce sin ser su dueña: la dirección del contrato,
  [DEC-ARCH-008](../01-decisiones-vigentes.md#dec-arch-008); el guard que abre la sucesión y la
  excepción a *«aditiva»*, [DEC-ARCH-017](../01-decisiones-vigentes.md#dec-arch-017) y
  [DEC-ARCH-017#📌1](../01-decisiones-vigentes.md#dec-arch-017-p1); la pausa con motivo que lee la
  cortesía, [DEC-GRANT-004](../01-decisiones-vigentes.md#dec-grant-004); el reembolso manual,
  [DEC-RF-002](../01-decisiones-vigentes.md#dec-rf-002) y
  [DEC-RF-003#📌1](../01-decisiones-vigentes.md#dec-rf-003-p1); la sucesora de una `SUSPENDED`,
  [DEC-SUB-006#📌1](../01-decisiones-vigentes.md#dec-sub-006-p1); el downgrade y su excedente,
  [DEC-SUB-008](../01-decisiones-vigentes.md#dec-sub-008); la vuelta anticipada,
  [DEC-SUB-010#📌1](../01-decisiones-vigentes.md#dec-sub-010-p1); la redención que no se re-apunta,
  [DEC-SUB-021#📌1](../01-decisiones-vigentes.md#dec-sub-021-p1); la cola que usa la migración,
  [DEC-SUB-023](../01-decisiones-vigentes.md#dec-sub-023),
  [DEC-SUB-023#📌1](../01-decisiones-vigentes.md#dec-sub-023-p1) y
  [DEC-SUB-023#📌2](../01-decisiones-vigentes.md#dec-sub-023-p2); las escrituras del cierre y la
  fecha de primer cobro, [INV:D15](../02-nucleo.md#inv-d15) y [INV:D8](../02-nucleo.md#inv-d8); y el
  reloj propio de fin de pausa, [M:M12](../04-catalogos.md#m-m12);
- **la ventana de 60 días de `DEC-MP-002` no aplica a un cambio de plan que el cliente elige**: esa
  ventana protege a quien no eligió el precio nuevo; el que elige un plan lo acepta en el acto, con su
  precio a la vista (Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/10-verticales-planes-billing-options.md:123);
- **en un downgrade rige el precio vigente al pedirlo**, que es el que se muta en el acto
  (`DEC-SUB-008`, parte 1); **`S38` no lleva precio**: si el precio del plan destino sube entre el
  pedido y el fin del ciclo, la suscripción conserva el monto mutado y el aumento la alcanza como a
  cualquier otro anclado, por su camino y con su fecha (`DEC-MP-002`, con BZ), **nunca por la puerta
  del downgrade** (Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:286, .specs/HOS-1354-billing-cobro-y-proveedor/docs/12-suscripcion.md:290).

### Las transiciones de la Suscripción que construye esta pieza

<a id="tpz-s8"></a>
**TPZ:S8** — `S8` → `B8b`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:856

<a id="tpz-s9"></a>
**TPZ:S9** — `S9` → `B8b` y `B9b`, compartida (esta pieza construye su segundo disparador, la
re-emisión sobre la sucesora; el primero, el otorgamiento, es de `B9b`).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:857

<a id="tpz-s10"></a>
**TPZ:S10** — `S10` → `B8b`; el tercer evento, revocar una cortesía temporal, lo agrega `B9b` (BO).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:858

<a id="tpz-s17"></a>
**TPZ:S17** — `S17` → `B8b`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:865

<a id="tpz-s18"></a>
**TPZ:S18** — `S18` → `B8b`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:866

<a id="tpz-s22"></a>
**TPZ:S22** — `S22` → `B8b` (queda en `B8b`, por AR).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:870

<a id="tpz-s31"></a>
**TPZ:S31** — `S31` → `B8b`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:875

<a id="tpz-s38"></a>
**TPZ:S38** — `S38` → `B8b`, **también con el motivo *«aumento»*, que usa `B12`** (BZ).

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/descomposicion.md:882

*(Que `TPZ:S9` se construya repartida —el segundo disparador acá, el primero en `B9b`— lo leo de las
filas: `B8b` es el cierre de la sucesión y `B9b` las cortesías; la tabla de la fuente sólo dice
«compartida». Inferido.)*

## Modelo de datos y migraciones

**Sin migración estructural**: una fase posterior no la trae (AD), y el drift guard sobre la rama de
la fase lo hace cumplir ([GATE:FP.3](../30-el-corte.md#gate-fp-3)). Lo que esta pieza escribe nace
al corte en `B3`: la cola de cambios programados ([ESQ:3](../10-corte/B3.md#esq-3)) y las columnas de
la sucesión, `sucede_a` y `sucedida_por` ([ESQ:4](../10-corte/B3.md#esq-4)), además de
`subscription_pause` con su motivo, cortesías y marcas. **Sólo agrega lo que crea filas** (AS).

## API

El cambio de plan y de ciclo, la pausa y la reanudación son operaciones self-service del dueño desde
Mi Suscripción (tier `/api/v1/protected/*`) y acciones del panel para el admin
([ACC:9](../02-nucleo.md#acc-9), [ACC:10](../02-nucleo.md#acc-10); tier `/api/v1/admin/*`). El
upgrade y el cambio de ciclo pasan por el checkout del proveedor, como el alta; la ruta de la
sucesión de `S1` la agrega esta pieza sobre el cuerpo que escribió `B3` (BL). **Las rutas una por
una y sus códigos de error no los cierra la fuente** (`B/19`): los propone el PR de esta pieza
siguiendo lo escrito del repo, los aprueba la revisión de contexto fresco del momento 1 (y el owner
en el PR cuando es un permiso nuevo), y quedan escritos en esta sección al mergear
([BS](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs)).

## UI web y admin, e i18n

Esta pieza **saca** el aviso de AU de Mi Suscripción ([AC:B8b:14](#ac-b8b-14)) y ofrece el cambio de
plan. **Y construye las superficies de sus actos**, las filas del `B/19` §4 que avisan un acto de
esta pieza y por eso van con él (BH; el reparto por fila lo infiere la fuente y lo marca;
[AC:B8b:25](#ac-b8b-25)):

- **8, la rama desde `PAUSED` (`S22`) — al pedir la baja estando pausado, antes de confirmar**: **que
  el servicio termina hoy y no al fin de un período** (la frase *«seguís hasta el …»* no aplica); **si
  la pausa era una cortesía, que pierde los meses que le quedaban**, con el número dicho; **salvo la
  pausada que vive del crédito sin consumir** (la sucesora con cortesía re-emitida): ahí el servicio
  sigue hasta el fin del crédito y la pantalla dice esa fecha, como la baja desde `ACTIVE`, y los
  meses de cortesía se pierden igual (`V2-b`). Las ramas desde `SUSPENDED` y `GRACE_PERIOD` son de
  `B13a` ([AC:B13a:1](../10-corte/B13a.md#ac-b13a-1)). (Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:116 y §5;
  BH, `D/41-corte-del-mvp/10-decisiones-del-owner.md:112`; AR, :61)
- **5 — al pausar estando en cortesía**: que **la pierde**, y dejarlo elegir (`DEC-GRANT-004`; lo
  ejecuta `S35`, de `B9b`).
- **5-bis — al pausar, antes de confirmar**: **qué le pasa a la ficha mientras dure la pausa**: sale
  del sitio público el mismo día, **vuelve sola al reanudar** si el cupo del plan le alcanza, **y
  mientras dure la pausa no se archiva, no se borra ni recibe avisos de retención: el reloj queda
  detenido y arranca de cero al volver** (C14). Es el acto que parece que sólo suspende el cobro, y el
  cliente no tiene otra forma de enterarse. **Y qué les pasa a sus addons recurrentes**: los de esa
  vertical se pausan con el plan, por los mismos meses, y vuelven con él; los de cuenta
  (`USER`/`GLOBAL`), sólo si no les queda otra vertical compatible sin pausar (4a).
- **6 — al reanudar una pausa**: **una sola cosa: qué día se le va a cobrar** —nada de días perdidos
  ni compensaciones— (`DEC-SUB-010`).
- **7 — al cambiar de plan —upgrade, downgrade o de ciclo— teniendo una promo, antes de confirmar**:
  ***«si cambiás de plan, perdés tu promo»***, y que **el importe nuevo ya no lleva el descuento**; la
  promo no sobrevive a ningún cambio de plan, y el mismo código **no se puede volver a canjear** en el
  plan nuevo (un uso por user, `B/14` §2.2).
- **13-quater — al elegir un plan no mensual (trimestral, semestral o anual) en el cambio de plan,
  teniendo una cortesía vigente o un saldo diferido en esa vertical**: **que pierde los N meses de
  cortesía que le quedan**, porque sobre un plan que no es mensual no hay cortesía temporal, y que
  decide él: puede seguir en mensual y conservarlos (`DESTINO_DE_PLAN_NO_MENSUAL`). El alta nueva con
  saldo diferido salió con `S25` (C8).
- **15 — el cambio de plan con una cuota impaga viva** (la que el proveedor reintenta mientras la
  predecesora sigue en `GRACE_PERIOD`, o la que el pagador manual puede pagar a mano: una puerta por
  método de pago): **que el cobro de esa cuota puede entrar igual**, antes de confirmar, y **qué pasa
  con esa plata**: si termina el checkout **se le devuelve**, si lo abandona **le queda** y le paga el
  período que está usando; nunca reactiva la suscripción vieja mientras el cambio esté en curso; y
  **la devolución no es instantánea**: la confirma una persona (`DEC-RF-002`), así que lleva unas
  horas. Si la predecesora con tarjeta ya está `SUSPENDED`, `S6` cerró su puerta y el aviso no
  aplica; y desde `DEC-SUB-021` la fila no tiene población al confirmar (en el grace el cambio no se
  ofrece): si la cuota aparece **después**, porque la predecesora entra en el grace durante la
  ventana (`S4`), recibe los correos normales del grace **más una línea que dice que el cambio de plan
  sigue pendiente** (`NUCLEO/07` §6).
- **16 — el cambio de plan con un checkout abierto**: que **no se ofrece**: *«terminá o cancelá el
  checkout que tenés abierto»* —**y, si la suscripción que tenía ya murió, que perdió la cobertura y
  que sus fichas vuelven cuando autorice**— (`B/03` §3.3.1; C-8).
- **16-bis — el alta nueva tras un primer cobro rechazado, teniendo un cambio de plan en curso**: lo
  mismo que la 16, porque la sucesora sigue viva y **puede autorizar**: un alta nueva serían **dos
  preapprovals cobrando**, así que no se ofrece *«empezar de nuevo»*; **y le dice que perdió la
  cobertura y que sus fichas vuelven cuando autorice**.
- **17 — el cambio de plan estando pausado**: que **no se ofrece**: *«reanudá tu suscripción para
  cambiar de plan»*.
- **17-bis — el cambio de plan estando en el grace**: que **no se ofrece**, y **qué hacer para
  poder**, según el método de pago: con tarjeta, *«cambiá tu tarjeta»* **y que al cambiarla se
  reintenta el cobro en el momento** —la frase de la fila 9, `GR-1` `VERIFIED`—; con pago manual,
  *«pagá tu cuota»*; y que **con la suscripción al día** puede cambiar de plan (`DEC-SUB-021`).
- **17-ter — el cambio de plan de un pagador con tarjeta cuya suscripción figura `ACTIVE` y cuyo
  preapproval, releído por id antes de aceptar el cambio, no está `authorized`** (p. ej. `paused` por
  una mora cuyo aviso no nos llegó): que **no se ofrece**: *«tu último cobro no entró, actualizá tu
  tarjeta»*, el camino de la 17-bis; la relectura corre además la transición que corresponda (sobre
  `paused`, `S6` por su segundo evento), y si esa transición suspende, el aviso que sigue es el de la
  fila 10.

Los cinco que van del 16 al 17-ter son avisos de una operación que **no se ofrece**: la persona no
queda bloqueada —puede terminar o abandonar el checkout, reanudar o regularizar—, así que lo único
que se agrega es decir el no en voz alta, con su motivo. Las dos reglas de cómo se dicen valen para
todas: **la confirmación dice qué va a pasar, no pregunta si estás seguro**, y **cada aviso lleva la
fecha de ese cliente**. El texto de cada aviso lo propone el PR de esta pieza y lo aprueba el owner en
el PR, por ser texto al cliente (BS). Toda copy por `@repo/i18n`.

Origen: .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:111, .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:112, .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:113, .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:114, .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:127, .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:131, .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:132, .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:133, .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:134, .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:135, .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:136, .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:155, .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:163, .specs/HOS-1354-billing-cobro-y-proveedor/docs/19-superficies.md:165

## Cron y outbox

- **El reloj de fin de pausa** que corre `S10`, nuestro (`PS-4`): el mismo para el fin previsto y el
  anticipado.
- **El job de la cola** que corre `S38` en la fecha.
- **El correo antes de cancelar** de `S17`, `S22` y `S31`, por el outbox común de `U2`; y el aviso de
  cobertura que emite `S38` después del commit.

## Variables de entorno

N/A — el mínimo de 24 h es el plazo 15 de la tabla versionada de plazos, no una variable de entorno
([PLAZO:15](../02-nucleo.md#plazo-15)).

## Auditoría y observabilidad

Pausar, reanudar y cambiar de plan son acciones del catálogo con auditoría
([ACC:9](../02-nucleo.md#acc-9), [ACC:10](../02-nucleo.md#acc-10)). Las marcas que deja:
`PAUSA_NO_APLICADA`, `REANUDACIÓN_NO_APLICADA`, `REEMBOLSO_POR_CONFIRMAR`
([MOT:1](../04-catalogos.md#mot-1)) y `COBRO_DURANTE_CORTESÍA` ([MOT:12](../04-catalogos.md#mot-12)).

## Seguridad

Las acciones del panel exigen su permiso, y el backend rechaza el cambio de plan en grace aunque la
UI no lo ofrezca ([AC:B8b:17](#ac-b8b-17)): *«Autorización backend jamás depende de ocultar UI»*
(`B/19` §1).

## Testing esperado

| AC | tests | tipo |
|---|---|---|
| [AC:B8b:1](#ac-b8b-1) | [TEST:B8b:1](#test-b8b-1) | integración con DB |
| [AC:B8b:2](#ac-b8b-2) | [TEST:B8b:2](#test-b8b-2) | integración con DB |
| [AC:B8b:3](#ac-b8b-3) | [TEST:B8b:3](#test-b8b-3) | integración con DB |
| [AC:B8b:4](#ac-b8b-4) | [TEST:B8b:4](#test-b8b-4) | integración con DB |
| [AC:B8b:5](#ac-b8b-5) | [TEST:B8b:5](#test-b8b-5) | integración con DB |
| [AC:B8b:6](#ac-b8b-6) | [TEST:B8b:6](#test-b8b-6) | integración con DB |
| [AC:B8b:7](#ac-b8b-7) | [TEST:B8b:7](#test-b8b-7) | integración con DB |
| [AC:B8b:8](#ac-b8b-8) | [TEST:B8b:8](#test-b8b-8) | integración con DB |
| [AC:B8b:9](#ac-b8b-9) | [TEST:B8b:9](#test-b8b-9) | integración con DB |
| [AC:B8b:10](#ac-b8b-10) | [TEST:B8b:10](#test-b8b-10) | integración con DB |
| [AC:B8b:11](#ac-b8b-11) | [TEST:B8b:11](#test-b8b-11) | integración con DB |
| [AC:B8b:12](#ac-b8b-12) | [TEST:B8b:12](#test-b8b-12) | integración con DB |
| [AC:B8b:13](#ac-b8b-13) | [TEST:B8b:13](#test-b8b-13) | integración con DB |
| [AC:B8b:14](#ac-b8b-14) | [TEST:B8b:14](#test-b8b-14) | e2e web |
| [AC:B8b:15](#ac-b8b-15) | [TEST:B8b:15](#test-b8b-15) | integración con DB |
| [AC:B8b:16](#ac-b8b-16) | [TEST:B8b:16](#test-b8b-16) | integración con DB |
| [AC:B8b:17](#ac-b8b-17) | [TEST:B8b:17](#test-b8b-17) | ruta API |
| [AC:B8b:18](#ac-b8b-18) | [TEST:B8b:18](#test-b8b-18) | integración con DB |
| [AC:B8b:19](#ac-b8b-19) | [TEST:B8b:19](#test-b8b-19) | integración con DB |
| [AC:B8b:20](#ac-b8b-20) | [TEST:B8b:20](#test-b8b-20) | integración con DB |
| [AC:B8b:21](#ac-b8b-21) | [TEST:B8b:21](#test-b8b-21) | guard estático |
| [AC:B8b:22](#ac-b8b-22) | [TEST:B8b:22](#test-b8b-22) | ruta API |
| [AC:B8b:23](#ac-b8b-23) | [TEST:B8b:23](#test-b8b-23), [TEST:B8b:21](#test-b8b-21), [TEST:B8b:24](#test-b8b-24) | migración desde cero, guard estático, integración con DB |
| [AC:B8b:24](#ac-b8b-24) | [TEST:B8b:24](#test-b8b-24) | integración con DB |
| [AC:B8b:25](#ac-b8b-25) | [TEST:B8b:25](#test-b8b-25) | e2e web |
| [AC:B8b:26](#ac-b8b-26) | [TEST:B8b:26](#test-b8b-26) | e2e web |

<a id="test-b8b-1"></a>
**TEST:B8b:1** — `S8` y su rama de fallo

Tipo: integración con DB

Cubre: [AC:B8b:1](#ac-b8b-1)

Fuente: [TRANS:B:S8](../04-catalogos.md#trans-b-s8) · [INV:23](../02-nucleo.md#inv-23) · [DEC-SUB-004](../01-decisiones-vigentes.md#dec-sub-004)

Un mensual pausa y queda `PAUSED · CUSTOMER_REQUEST` con sus complementos pausados; un anual no;
una cuarta pausa en la ventana no; con el falso devolviendo `authorized` en la relectura, la fila
sigue `ACTIVE` sin `subscription_pause` y con la marca 22; cancelar y volver a suscribirse no
resetea el contador.

<a id="test-b8b-2"></a>
**TEST:B8b:2** — el motivo de la pausa

Tipo: integración con DB

Cubre: [AC:B8b:2](#ac-b8b-2)

Fuente: [INV:D3](../02-nucleo.md#inv-d3)

La base rechaza una `subscription_pause` sin motivo o con uno fuera del dominio.

<a id="test-b8b-3"></a>
**TEST:B8b:3** — `S10`, a término y anticipada

Tipo: integración con DB

Cubre: [AC:B8b:3](#ac-b8b-3)

Fuente: [TRANS:B:S10](../04-catalogos.md#trans-b-s10) · [INV:24](../02-nucleo.md#inv-24)

Con el reloj en el fin previsto y con una vuelta anticipada: `fin_real` escrito, complementos de
vuelta por `S33`; con el falso dando `paused` en la relectura, la fila sigue `PAUSED` con
`REANUDACIÓN_NO_APLICADA`; un pagador manual avanza su fecha sin abrir cuota.

<a id="test-b8b-4"></a>
**TEST:B8b:4** — el aumento sobre una pausada

Tipo: integración con DB

Cubre: [AC:B8b:4](#ac-b8b-4)

Fuente: [DEC-SUB-010](../01-decisiones-vigentes.md#dec-sub-010)

Con un aumento cuya fecha cae en la pausa, la mutación sale recién en el primer cobro posterior a la
reanudación y nunca antes de los 60 días del aviso.

<a id="test-b8b-5"></a>
**TEST:B8b:5** — `S22`, con y sin crédito

Tipo: integración con DB

Cubre: [AC:B8b:5](#ac-b8b-5)

Fuente: [TRANS:B:S22](../04-catalogos.md#trans-b-s22) · [DEC-SUB-009#📌2](../01-decisiones-vigentes.md#dec-sub-009-p2)

Una pausada por la persona va a `CANCELLED` hoy con `fin_real`; una `PAUSED · COURTESY` pierde la
cortesía; una sucesora con cortesía re-emitida que vive del crédito va a `CANCEL_SCHEDULED` con fin
en el fin del crédito y cancela sus complementos con la selección de `S11`.

<a id="test-b8b-6"></a>
**TEST:B8b:6** — prohibida: salir de `PAUSED` a otro lado

Tipo: integración con DB

Cubre: [AC:B8b:6](#ac-b8b-6)

Fuente: [PROH:B:4](../04-catalogos.md#proh-b-4)

Un intento de llevar una `PAUSED` a `GRACE_PERIOD`, a `SUSPENDED` sin contracargo o a
`CANCEL_SCHEDULED` sin crédito deja la fila igual y abre `TRANSICIÓN_NO_DECLARADA`; las dos
excepciones sí ocurren.

<a id="test-b8b-7"></a>
**TEST:B8b:7** — la dirección y los dos caminos

Tipo: integración con DB

Cubre: [AC:B8b:7](#ac-b8b-7)

Fuente: [DEP:5](../03-contrato-de-cobertura.md#dep-5) · [DEC-SUB-006](../01-decisiones-vigentes.md#dec-sub-006) · [DEC-SUB-007](../01-decisiones-vigentes.md#dec-sub-007)

Con el simulador del contrato contestando `BAJA` para una versión de `rank` mayor, el falso registra
una mutación de monto y la cola un descenso; con `SUBE`, nace una sucesora `PENDING_AUTHORIZATION`
con su fecha de primer cobro corrida por el valor del crédito.

<a id="test-b8b-8"></a>
**TEST:B8b:8** — la sucesión y `D7`

Tipo: integración con DB

Cubre: [AC:B8b:8](#ac-b8b-8)

Fuente: [INV:D7](../02-nucleo.md#inv-d7)

`S1` acepta un `sucede_a`; con el checkout abandonado la vieja sigue viva; la vieja no se cancela
antes del webhook de autorizada.

<a id="test-b8b-9"></a>
**TEST:B8b:9** — `S17` y el correo antes

Tipo: integración con DB

Cubre: [AC:B8b:9](#ac-b8b-9)

Fuente: [TRANS:B:S17](../04-catalogos.md#trans-b-s17)

Con el correo fallando de forma transitoria la predecesora sigue viva en esa corrida; con el outbox
en `failed` definitivo se cancela igual; con el preapproval ya `cancelled` no hay llamada.

<a id="test-b8b-10"></a>
**TEST:B8b:10** — las cinco escrituras de `S18`

Tipo: integración con DB

Cubre: [AC:B8b:10](#ac-b8b-10)

Fuente: [TRANS:B:S18](../04-catalogos.md#trans-b-s18) · [MOT:1](../04-catalogos.md#mot-1)

Con un complemento, una redención, una cortesía vigente y un pago retenido colgando de la
predecesora: el complemento re-apuntado, la redención quieta, la cortesía cerrada con su saldo, la
marca 1 con el pago; con la sucesora anual, la cortesía cerrada con `DESTINO_DE_PLAN_NO_MENSUAL`; con
un pagador manual cuyo pago retenido ya entró al crédito de la sucesora, ninguna marca y el pago como
crédito.

<a id="test-b8b-11"></a>
**TEST:B8b:11** — la predecesora que se muere sola

Tipo: integración con DB

Cubre: [AC:B8b:11](#ac-b8b-11)

Fuente: [LISTA:B8b](#lista-b8b) · [TRANS:B:S18](../04-catalogos.md#trans-b-s18)

Con la sucesora en `PENDING_AUTHORIZATION` y la predecesora a `CHARGE_DECLINED`, la sucesión se cierra
en el acto y un alta nueva sobre el mismo `user + vertical` falla en la base.

<a id="test-b8b-12"></a>
**TEST:B8b:12** — la re-emisión de `S9`

Tipo: integración con DB

Cubre: [AC:B8b:12](#ac-b8b-12)

Fuente: [TRANS:B:S9](../04-catalogos.md#trans-b-s9) · [DEC-GRANT-007#📌1](../01-decisiones-vigentes.md#dec-grant-007-p1)

La misma fila de `courtesy_grant` pasa a la sucesora con `saldo_meses` nulo y la pausa abierta;
sobre una sucesora con crédito el `inicio` es el fin del crédito; un cobro entre `S2` y `S9` abre la
marca 12.

<a id="test-b8b-13"></a>
**TEST:B8b:13** — `S31` desde los dos estados

Tipo: integración con DB

Cubre: [AC:B8b:13](#ac-b8b-13)

Fuente: [TRANS:B:S31](../04-catalogos.md#trans-b-s31)

Un contracargo sobre la predecesora deja la sucesora `ABANDONED` o `CANCELLED`, en la misma
transacción, con el saldo diferido cerrado con su motivo y sin `S18`.

<a id="test-b8b-14"></a>
**TEST:B8b:14** — el aviso de AU ya no está

Tipo: e2e web

Cubre: [AC:B8b:14](#ac-b8b-14)

Fuente: [LISTA:B8b](#lista-b8b)

Mi Suscripción no muestra el texto y ofrece cambiar de plan; ninguna otra línea del corte cambió en
el diff de la pieza.

<a id="test-b8b-15"></a>
**TEST:B8b:15** — `S38` por estado

Tipo: integración con DB

Cubre: [AC:B8b:15](#ac-b8b-15)

Fuente: [TRANS:B:S38](../04-catalogos.md#trans-b-s38) · [DEC-SUB-008#📌2](../01-decisiones-vigentes.md#dec-sub-008-p2)

En `ACTIVE` y `GRACE_PERIOD` se aplica en la fecha; en `PAUSED` y `SUSPENDED` espera; vuelta por `S7`
a `CANCEL_SCHEDULED` se aplica; con una cuota manual del mismo día, la cuota nace con la versión
destino. Con un cambio sembrado con el motivo *«aumento»* y una promo viva en la fila, en su fecha
del plazo 11 la fila pasa a la versión nueva, sigue sin cohorte `PARA_RESOLVER` y la promo sigue con
sus `cobros_restantes`.

<a id="test-b8b-16"></a>
**TEST:B8b:16** — las colisiones

Tipo: integración con DB

Cubre: [AC:B8b:16](#ac-b8b-16)

Fuente: [TRANS:B:S38](../04-catalogos.md#trans-b-s38)

Un segundo downgrade reemplaza el primero y deja sin elección; un upgrade deja la cola de la
sucesora vacía; una baja la descarta; una pausa la deja esperando; el pedido del descenso escribe
`cobros_restantes = 0`.

<a id="test-b8b-17"></a>
**TEST:B8b:17** — el cambio de plan en grace, por ruta

Tipo: ruta API

Cubre: [AC:B8b:17](#ac-b8b-17)

Fuente: [DEC-SUB-021](../01-decisiones-vigentes.md#dec-sub-021)

Pedir el cambio sobre una `GRACE_PERIOD` devuelve el rechazo del contrato de errores y no nace
ninguna sucesora.

<a id="test-b8b-18"></a>
**TEST:B8b:18** — el plazo 15

Tipo: integración con DB

Cubre: [AC:B8b:18](#ac-b8b-18)

Fuente: [PLAZO:15](../02-nucleo.md#plazo-15)

A 23 h de la próxima fecha el cambio no se ofrece; con el plazo cambiado en la tabla, la suscripción
usa el de su versión de ciclo.

<a id="test-b8b-19"></a>
**TEST:B8b:19** — `C4`, el addon durante un downgrade

Tipo: integración con DB

Cubre: [AC:B8b:19](#ac-b8b-19)

Fuente: [LOCK:C4](../04-catalogos.md#lock-c4)

Con un descenso programado, la compra se permite y el aviso trae la fecha y la parte fuera del
límite.

<a id="test-b8b-20"></a>
**TEST:B8b:20** — la rama 6

Tipo: integración con DB

Cubre: [AC:B8b:20](#ac-b8b-20)

Fuente: [DEC-RF-003](../01-decisiones-vigentes.md#dec-rf-003)

La baja de una predecesora `SUSPENDED` (`S23`) y la de una en `GRACE_PERIOD` (`S24`), cada una con pago
retenido, abren la marca 1 con propuesta devolver y ningún `refund`; tras `S36`, ninguna marca.

<a id="test-b8b-21"></a>
**TEST:B8b:21** — `G-R1-C`, roto a propósito

Tipo: guard estático

Cubre: [AC:B8b:21](#ac-b8b-21), [AC:B8b:23](#ac-b8b-23)

Fuente: [GUARD:G-R1-C](../04-catalogos.md#guard-g-r1-c)

Mutación: sacar de `S18` la escritura de `saldo_meses` sobre la cortesía, y por separado la apertura
de la marca `REEMBOLSO_POR_CONFIRMAR`; el job `guards` tiene que dar rojo en cada una.

El guard corre en `pnpm check:guards` y en el job `guards` de `ci.yml`, verde sobre el código de la
pieza.

<a id="test-b8b-22"></a>
**TEST:B8b:22** — las acciones del panel

Tipo: ruta API

Cubre: [AC:B8b:22](#ac-b8b-22)

Fuente: [ACC:9](../02-nucleo.md#acc-9) · [ACC:10](../02-nucleo.md#acc-10)

Sin permiso, pausar, reanudar y cambiar de plan reciben el rechazo de permiso; con permiso, cada acto
deja su registro de auditoría.

<a id="test-b8b-23"></a>
**TEST:B8b:23** — la rama de la fase sin migración estructural

Tipo: migración desde cero

Cubre: [AC:B8b:23](#ac-b8b-23)

Fuente: [FILA:B8b](#fila-b8b) · [GATE:FP.3](../30-el-corte.md#gate-fp-3)

Sobre una base vacía migrada con las migraciones del corte, las columnas de la sucesión, la cola y la
marca con su motivo ya existen; la rama de la fase no agrega ninguna migración estructural y la suite
de la pieza corre completa.

<a id="test-b8b-24"></a>
**TEST:B8b:24** — las interfaces de `B5` y `B7`, con la implementación real

Tipo: integración con DB

Cubre: [AC:B8b:24](#ac-b8b-24), [AC:B8b:23](#ac-b8b-23)

Fuente: [LISTA:B8b](#lista-b8b) · [TRANS:B:S18](../04-catalogos.md#trans-b-s18) · [TRANS:B:S31](../04-catalogos.md#trans-b-s31) · [TRANS:B:S38](../04-catalogos.md#trans-b-s38)

Las pruebas de `B5` y `B7` que antes corrían con filas sembradas corren ahora contra la
implementación real: en las ramas 1, 5 y 6 la bandera se apaga y queda la marca 1 con el pago
colgado; un contracargo sobre la predecesora deja la sucesora cortada por `S31`; `S7` y `MP5` dejan la
fila en la versión destino; la ruta declara una sucesión sobre el cuerpo de `B3`; y el diff de la
pieza no toca archivos de `B3`, `B5`, `B7` ni `B8a`.

<a id="test-b8b-25"></a>
**TEST:B8b:25** — las superficies de los actos de la pieza

Tipo: e2e web

Cubre: [AC:B8b:25](#ac-b8b-25)

Fuente: [PIEZA:B8b](#pieza-b8b) · [DEC-SUB-021](../01-decisiones-vigentes.md#dec-sub-021)

Con un anfitrión en cortesía, uno pausado, uno en grace, uno con un checkout abierto y uno con promo,
cada pantalla muestra el texto de su fila: pausar avisa la pérdida de la cortesía y qué le pasa a la
ficha y a sus addons; reanudar muestra sólo el día del cobro; el cambio de plan con promo avisa que la
pierde; y en pausa, en grace, con un checkout abierto o con el preapproval releído no `authorized`, el
cambio no se ofrece y la pantalla dice por qué y qué hacer.

<a id="test-b8b-26"></a>
**TEST:B8b:26** — los cambios de plan y la pausa, de punta a punta

Tipo: e2e web

Cubre: [AC:B8b:26](#ac-b8b-26)

Fuente: [FILA:B8b](#fila-b8b)

Contra los builds, con el falso como servidor, el reloj adelantable y el correo capturado: un
upgrade por el checkout del proveedor, un downgrade con su descenso en la fecha, un cambio de ciclo, y
una pausa con sus dos reanudaciones —al vencer y anticipada—; las aserciones son sobre el contenido de `B/19` §4 y sobre que cada correo capturado
llega antes que cualquier cancelación en el proveedor.

## Smoke y etiquetas

Sin etiquetas en la pieza ([GATE:M1](../30-el-corte.md#gate-m1)). Lo manual de la fase —el checkout
real de un upgrade, el correo del proveedor al cancelar la vieja— entra en **la sección de la Fase 2
del checklist de smoke**: la parte de `staging` antes del merge y un 5c propio en producción
([GATE:FP.2](../30-el-corte.md#gate-fp-2)). **Esa sección la escribe esta pieza, con lo suyo y con el
formato de [B13a](../10-corte/B13a.md#ac-b13a-14)** —en `docs/billing/`, en dos partes, la de `staging`
y la de producción—, porque cada pieza posterior escribe la sección de su fase (BS, [DEC-METH-019#📌5](../01-decisiones-vigentes.md#dec-meth-019-p5)).

## Dependencias, rollback y despliegue

- **Espera a** [B8a](../10-corte/B8a.md#pieza-b8a) (`B8a → B8b`) y a todo el corte; integra
  `permitePausa` y `direcciónDeCambio` de `V2` ([DEP:4](../03-contrato-de-cobertura.md#dep-4),
  [DEP:5](../03-contrato-de-cobertura.md#dep-5)).
- **La espera** [B9b](B9b.md#pieza-b9b) (`B8b → B9b`), por la sucesión.
- **Despliegue**: rama épica de la Fase 2 con `B9b`, que entra a `staging` entera con el gate de
  arriba; después, a producción con el 5c de la fase.
- **Rollback**: la fuente no fija uno por pieza; el gate de la fase es el control.

## Labels de Linear

Pasa a `Done` al mergearse en la rama de su fase; sin etiquetas `status-needs-smoke-*`
([GATE:M1](../30-el-corte.md#gate-m1)).

Las etiquetas son `kind-spec` más las `area-*` de la fila, y quedan escritas acá al mergear (owner
[BS](../01-decisiones-vigentes.md#own-41-corte-del-mvp-t9-bs), con sus defaults en
[DEC-METH-019#📌5](../01-decisiones-vigentes.md#dec-meth-019-p5)).

## Abiertos

- Ninguno. «Quién escribe la extensión del checklist de cada fase» lo cerró BS con los defaults de su
  opción 1 ([DEC-METH-019#📌5](../01-decisiones-vigentes.md#dec-meth-019-p5)): cada pieza posterior escribe la sección de su fase, con el formato de `B13a` (ver
  *Smoke y etiquetas*). El motivo *«aumento»* de `S38` lo fijó BZ
  ([DEC-MP-002#📌3](../01-decisiones-vigentes.md#dec-mp-002-p3)). Las filas del `B/19` §4 las
  repartió BH (el reparto por fila, inferido en la fuente); las rutas, los códigos y los textos, BS.

## Origen

`B/descomposicion.md` §2 (fila `B8b`), §2.6 (filas 4 y 5), §2.8 (`G-R1-C`), §2.12 y §4 (fila
`B8b`); `D/16` §4.6 y §4.7 (*«Las fases posteriores»*); `B/03` §3.2 y §3.3; `B/12` §2, §3, §5 y §6;
`B/05` C4; `B/19` §4 (filas 5, 5-bis, 6, 7, 8 —la rama desde `PAUSED`—, 13-quater, 15, 16, 16-bis, 17,
17-bis y 17-ter) y §4.1; `B/10` §3.5; `B/20` §2 y §5.1 punto 3; `NUCLEO/04`; `NUCLEO/02` §1.5 (plazo 15); `NUCLEO/08` §3; `01-decision-log.md`;
`41-corte-del-mvp/10-decisiones-del-owner.md` (Z, AR, AS, AT, AU, AW, BH, BL, BO, BS).
