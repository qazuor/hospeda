---
title: Master Spec 12 — Suscripción
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-21
status: CURRENT
fase: 2
capitulo: 12
cierra:
  - E-SUB-01
  - E-SUB-02
  - E-SUB-05
  - E-SUB-06
  - M-SUB-02
  - R-SUB-01
---

# 12 · Suscripción: alta, cambio de plan, pausa, gracia y cancelación

Los estados y las transiciones están en el capítulo 03 y no se repiten. Las decisiones de
mecanismo —cómo se ejecuta cada cambio contra el proveedor— ya están tomadas y tampoco se
reabren. Este capítulo cierra **los seis bordes que quedaron entre ellas**, y **uno de los seis
resulta ser un agujero real**: el §4 muestra que el ciclo del grace, tal como está escrito, no
cierra.

---

## 1. El grace se compone con el del proveedor sin saber cuánto dura el suyo

### 1.1 El problema, y por qué es el más peligroso del capítulo

El §20 fija el grace en 10 días y `DEC-SUB-002` lo dejó configurable por versión de plan con ese
default. La transición S4 del capítulo 03 dice *«un cobro falla → `GRACE_PERIOD`»*.

**Y «un cobro falla» no tiene un instante.** El proveedor no rechaza y se olvida: reintenta. Si
nuestro reloj arranca en el primer rechazo y el suyo sigue corriendo, las dos ventanas quedan
**concéntricas** y suspendemos a alguien a quien el proveedor todavía le está por cobrar bien.

### 1.2 La regla: el reloj arranca en el primer rechazo, leído por id

> **El reloj del grace de un pagador con tarjeta arranca en el primer rechazo de un cobro de
> renovación, leído por id (`D17`)**: el registro de cobro del período, con su pago en
> `rejected`. Un webhook sin releer no lo arranca.

~~**El reloj del grace arranca cuando el proveedor deja de reintentar, no cuando falla un
intento.**~~ **Reemplazada el 2026-09-24** (FASE 8 completa, racimo `R1`: `F-8CB2-002`,
`F-8CB3-002`, `F-8CB1-006`). La regla vieja esperaba un instante que **no se puede observar**:
`GR-3` midió que el fin de los reintentos (`scheduled` → `processed`) no emite ningún evento, y que
la pausa del proveedor cae **80-105 s antes** del `expire_date`. Esa pausa dispara `S6`
(`DEC-MP-008`), así que con la regla vieja un pagador con tarjeta **nunca pasaba por el grace**:
salía de `ACTIVE` directo a `SUSPENDED`, sin los días ni los avisos del §20.

**Lo que la regla vieja cuidaba lo cuidan hoy otras dos reglas, y ninguna es nueva.** El miedo
del §1.1 era suspender a alguien a quien el proveedor todavía le está por cobrar bien. Pero:

1. **El grace es siempre más corto que el ciclo** (`DEC-SUB-019`), y la ventana de reintentos del
   proveedor **dura un ciclo** (`GR-3`, sonda 49). Los reintentos caen **dentro** de nuestro
   grace, y si uno entra corre `S5`.
2. **`S6` pregunta si cobró antes de suspender** (`B/03` §4, con la lectura del `B/09` §4). Si la
   lectura falla, no suspende.

La disciplina de siempre no cambia: la regla de no-retroceso del capítulo 03 §10 —*un webhook es un
aviso, no un estado*— y el invariante `D5` —*toda mutación se verifica releyendo*—. **No se
predice, se observa**, y lo que se observa ahora es un hecho que sí existe: el rechazo.

### 1.3 El pago y la suscripción se mueven por separado

El capítulo 03 §6 da cinco estados de pago —`PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED`,
`PARTIALLY_REFUNDED`— y **no hace falta un sexto**:

| lo que pasa | nuestro estado de pago | nuestra suscripción |
|---|---|---|
| primer rechazo, y el proveedor **sigue reintentando** | **`PENDING`** | `S4` → `GRACE_PERIOD`, y **ahí** arranca el reloj |
| un reintento entra | `SUCCEEDED` | `S5` → `ACTIVE` |
| la ventana del proveedor vence sin cobro | `FAILED` | nada nuevo: ya estaba en grace, y con el grace más corto que el ciclo `S6` llegó antes |

**`FAILED` sigue significando «el proveedor se dio por vencido», no «un intento salió mal»**, pero
**deja de ser lo que dispara `S4`**. El estado intermedio del proveedor sigue sin existir de
nuestro lado: el pago queda `PENDING` mientras la ventana está abierta, y la suscripción ya está en
grace.

**Ese estado tiene nombre y está medido: `recycling`.** Producción, 2026-09-17 19:12:34 `-04`: la
cuota `7032034055` quedó en `status: recycling` con su pago en
`rejected / cc_rejected_high_risk`. Es la primera observación directa del reciclado, y confirma
que **un rechazo no es un veredicto**: el proveedor sigue intentando después de él.

### 1.4 Una baja decidida por el proveedor se espeja, no se discute

`DEC-SUB-009` gobierna la baja que **pide el cliente**: cancelamos en el proveedor de inmediato y
sostenemos el servicio hasta el fin del período pagado. **No gobierna el camino de mora.**

Si el proveedor da de baja la suscripción por su cuenta tras acumular impagos, **eso es un hecho
suyo** (§64.18: *«MP gobierna hechos ocurridos en MP»*) y entra por la regla de no-retroceso: se
relee y se escribe lo leído. No se intenta revertir —`PA-5` midió que cancelar es
**irreversible**— y recuperar a esa persona **exige re-autorizar desde cero**, que es el camino
de `DEC-SUB-006`.

~~**La consecuencia operativa hay que decirla**: en el camino de mora, **cuándo se termina el
vínculo no lo decidimos nosotros**. Nuestro grace puede ser más largo que la paciencia del
proveedor, y si lo es, la baja llega antes que nuestra suspensión.~~

> **Reemplazado el 2026-09-24 por `DEC-SUB-019`: en el camino de mora el vínculo lo cortamos
> NOSOTROS, al vencer el grace.** La sonda 49 midió que el proveedor reintenta durante **un ciclo**
> y después **pausa** —no da de baja—, así que con un grace de 10 días sobre un plan mensual seguía
> reintentando veinte días sobre una fila ya suspendida, y un reintento tardío cobraba un mes entero
> por unos días de servicio. Ahora `S6` cancela el preapproval al suspender, y **el grace es siempre
> más corto que el ciclo** (`B/03` §4), así que el proveedor no llega a decidir nada. **Este § y su
> espejo no se borran**: son la respuesta si igual llega una baja del proveedor —una cancelación
> desde su panel, un preapproval reactivado a mano—, pero **dejan de ser la salida esperada del
> camino de mora**. **Y una pausa del proveedor por mora no pasa por acá**: dispara `S6`, como el
> fin del grace (`DEC-MP-008`).

**Y hay que decir la otra consecuencia, porque cae sobre la población exacta de la sucesión.** El
que llega a esta baja llega **desde `GRACE_PERIOD`**, que es de donde también llega la
predecesora de un cambio de plan en mora — o sea la población de `S19`. Espejar esa baja es una
**transición declarada** de la tabla del cap. 03 (§10.1), y por eso aparece en cuatro lugares que
la enumeraban sin ella: es la séptima del dominio que el §3.2 recorre por el lado de la
predecesora, un tercer camino por el que la predecesora **se muere sola** y `S18` cierra la
sucesión sin `S17`, la sexta que dispara la re-evaluación del addon huérfano (`B/16` §4.3), y la
**rama 5** del §5.3 de este capítulo.

### 1.5 Lo que falta medir, y qué lo dispara

~~`GR-3` —la política de reintentos del proveedor— **sigue `UNKNOWN`**.~~ **`GR-3` está
`VERIFIED` desde el 2026-09-22, y la sonda 49 le agregó el segundo punto el 2026-09-24**: cuatro
intentos dentro de una ventana que **dura un ciclo** (24,0 h sobre `1 days`, 48,0 h sobre
`2 days`), y al vencerla el proveedor **pausa**. El §1.2 se reescribió con esa medición.

**Lo que sigue sin medir**: la ventana de un plan mensual o anual, que es extrapolación (~30 días,
un año), y si la pausa cae también al vencer la ventana de un ciclo de 2 días. **Ninguna de las dos
cambia el diseño**, porque el grace se corta antes (`DEC-SUB-019`). Lo que cambian es lo que se le
explica a soporte.

---

## 2. La cola de cambios programados · cierra `M-SUB-02`

### 2.1 Qué se programa realmente

El hueco pedía *«a lo sumo un cambio programado vigente, con reglas explícitas de reemplazo y de
cancelación»*, porque si no *«el estado del sistema depende del orden en que llegaron los
clicks»*.

Y lo primero es acotar qué se programa, porque `DEC-SUB-008` lo corrigió: **el monto se muta
cuando el cliente lo pide**, no se difiere. Lo único que queda para el fin del ciclo es **el
descenso de capacidades**, más la elección del cliente sobre qué conserva.

**Es una cola nuestra, de entitlements. No es una cola de cambios en el proveedor** — el
proveedor no tiene ninguna.

### 2.2 A lo sumo uno, y las cuatro colisiones

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

> **La versión anterior tenía UNA cláusula y era falsa de la mitad de su sujeto.** Decía que el
> descenso se aplica *«al fin del primer ciclo en que el cliente efectivamente tiene servicio»*, y
> en una **cortesía** el cliente **sí tiene servicio** —lo sostenemos nosotros—, así que esa regla
> ordenaba aplicar el descenso sobre una fila pausada: exactamente lo que `EX-11` demuestra
> imposible. Es el mismo defecto de razón que el §7.2 ya había corregido para la baja
> —*«el argumento va por el período pagado y no por “durante la pausa no hay servicio”, que es
> verdad de una sola de las dos pausas»*—, y acá sobrevivía porque la conclusión era correcta y
> nadie vuelve sobre la razón de una conclusión correcta. **La conclusión no cambia: esperar.**

### 2.3 Arrepentirse sigue siendo barato

`DEC-SUB-008` lo dejó escrito y vale acá: volver al plan alto antes del fin del ciclo es **otra
mutación del monto más cancelar el descenso programado**. La cola es cancelable, no sólo
reemplazable.

---

## 3. El precio que cambia entre programar y ejecutar · cierra `E-SUB-01`

### 3.1 El hueco se disuelve casi entero, y conviene decir por qué

`E-SUB-01` preguntaba si al downgrade se le aplica el precio vigente **al programar** o **al
ejecutar**, y si al ejecutar fuera más caro, si eso cuenta como aumento a los efectos del §29.

**La pregunta presupone que el precio se aplica al ejecutar**, y `DEC-SUB-008` decidió lo
contrario: **el monto se muta cuando el cliente lo pide.** Lo que corre al fin del ciclo no lleva
precio.

**Entonces: rige el precio vigente al pedirlo**, que además es el que el cliente vio y aceptó.

### 3.2 Y un aumento posterior no lo alcanza por esta puerta

Si el precio del plan destino sube entre el pedido y el fin del ciclo, **la suscripción conserva
el monto que se mutó**: `DEC-MP-002` fijó que **el precio vive en la suscripción, no sólo en el
plan** (implicación 2).

Ese cliente queda alcanzado por el aumento **como cualquier otro**: por la ventana de 60 días con
tres contactos, con **su** fecha efectiva. No hay un camino especial, y eso es lo que hay que
preservar — un aumento que entrara por la puerta del downgrade se saltearía el aviso del §29.

---

## 4. Que el ciclo del grace cierre · cierra `R-SUB-01`

### 4.1 El pedido, y la respuesta honesta

`R-SUB-01` no objetaba la duración: pedía *«que el diseño demuestre que el ciclo se cierra»*, o
sea que nadie pueda sostener servicio continuo sin completar nunca un pago.

**Tal como está escrito, no cierra.** El §20 da **servicio completo** durante el grace —fichas
publicadas, edición activa, entitlements activos—, y nada en el PDR ata ese beneficio a haber
pagado alguna vez.

### 4.2 El camino, en concreto

Alguien se suscribe, la tarjeta pasa la validación de ARS 0, el cobro real falla, y recibe **diez
días de servicio completo**. Se suspende, cancela, vuelve a suscribirse. La restricción de
unicidad del capítulo 02 no lo frena —la anterior está `CANCELLED`, que no es un estado vivo— y
el trial tampoco, porque no está usando trial.

**Diez días por ciclo, repetible.**

### 4.3 La regla que lo cierra

> **El grace no es un beneficio de entrada.** Una suscripción cuyo **primer cobro de esa
> autorización** se rechaza no pasa por `GRACE_PERIOD`: va a **`CHARGE_DECLINED`**, que es
> terminal.

**La regla es sobre el grace; `CHARGE_DECLINED` es su remedio, y no es el único.** La distinción
importa porque hay una población sin autorización: el **pagador manual** del §17.2, que *«no tiene
débito en el proveedor»* (`B/06` §7). Ahí `S16` no tiene sujeto y `CHARGE_DECLINED` tiene población
vacía, y de eso **no** se sigue que la regla no se aplique — se sigue que necesita otro ejecutor.
El suyo está escrito en `B/03` §7.2 (*«cómo entra el grace»*): **su primera cuota la abre `S1`,
antes de que la fila llegue a `ACTIVE`**, así que `S4` no la alcanza, no hay grace, y si nadie
transfiere la ventana termina en **`ABANDONED`** — terminal, no vivo, y el reintento es un alta
nueva, igual que acá.

**La condición se lee POR AUTORIZACIÓN, y su dueño es `B/03` §3.1**, que la escribió entera con su
fundamento. Acá decía *«para un `user + vertical` sin ningún pago acreditado»* —la historia de la
persona—, y el cambio la corrigió en la tabla de transiciones sin volver a este §: el proveedor
cancela por **el primer cobro de ese preapproval**, no por la historia. Con la lectura histórica,
al cliente que ya pagó alguna vez, vuelve y le rebota la tarjeta se le daban diez días de servicio
completo **sobre una autorización que el proveedor ya canceló de forma terminal** — un plazo que no
puede terminar en pago. Leída por autorización cae donde corresponde, y su reintento es un alta
nueva igual que el del que nunca pagó.

**El destino ya no es `SUSPENDED`, y el §4.4 explica por qué no podía serlo.** Mandarla ahí hacía
que `SUSPENDED` significara dos muertes distintas —el que pagó y dejó de pagar, y el alta que nunca
ocurrió— y eso **bloqueaba el reintento que este mismo capítulo exige**, porque el candado del §11
cuenta a `SUSPENDED` entre los vivos. `CHARGE_DECLINED` es terminal y **no vivo**: el reintento
entra como alta nueva sin pelear contra ninguna restricción.

**Con una salvedad, y es la que impide el doble cobro**: si esa persona tenía **un cambio de plan
en curso**, su sucesora sigue viva en `PENDING_AUTHORIZATION` con su propio preapproval. Ahí no
hay alta nueva que dar — `S18` cierra la sucesión en el acto y la sucesora pasa a ocupar el
candado `A` (cap. 03 §3.2), así que el `INSERT` lo rechaza la base. Lo que corresponde es terminar
o abandonar ese checkout, y el §4.4 lo dice.

El §20 describe una política de **retención**: alguien que venía pagando y tuvo un problema.
Quien nunca pagó no tiene una relación que retener, y el servicio que recibió se mide en minutos
—el cobro real llega **entre 26 y 44 minutos** después de autorizar (`PA-3`, re-medido el
2026-09-17)—, no en días.

**Se eligió hacia dónde falla.** Conceder el grace falla hacia **diez días gratis por intento,
repetibles**. Negarlo falla hacia que un cliente legítimo con la tarjeta rechazada tenga que
arreglarla y volver a suscribirse — que es el flujo normal y esperable de una tarjeta que no pasa,
y le cuesta minutos.

### 4.4 Y el proveedor ni siquiera nos deja llegar a suspender

Medido en producción el **2026-09-17**: sobre una suscripción cuyo **primer** cobro fue rechazado,
el proveedor **cancela la suscripción en el mismo instante** en que manda la cuota a `recycling`
—los dos hechos comparten el milisegundo, `19:12:34.583` y `19:12:34.745`— y esa cancelación es
**terminal**: `PUT {status:"authorized"}` devuelve
`400 "Invalid transition from cancelled to authorized"`.

**Entonces no hay suscripción que suspender, y la regla de §4.3 se refuerza en vez de
contradecirse**: un primer cobro rechazado **no es una suscripción con un problema, es un alta que
no ocurrió**.

Dos consecuencias que el diseño tiene que absorber:

1. **El reintento del cliente es una suscripción NUEVA, con id nuevo.** No se recupera la anterior
   —no se puede—, así que la superficie tiene que ofrecer empezar de nuevo, no «reintentar el
   pago».

   **Salvo que ya tenga un checkout abierto, y ahí ofrecer empezar de nuevo es ofrecer el doble
   cobro.** El rechazo llega *«entre 26 y 44 minutos»* después de autorizar (`PA-3`), que es
   exactamente la ventana en la que un cambio de plan es legal (cap. 03 §3.2), así que la
   población no es un borde: es la de quien cambió de plan el mismo día que se suscribió. Su
   sucesora sigue viva en `PENDING_AUTHORIZATION` y **puede autorizar**; si además dejamos entrar
   un alta nueva quedan **dos preapprovals autorizados cobrando** sobre el mismo
   `user + vertical`, y `EX-6` mide que el proveedor no frena la segunda. Desde que `S18` cierra
   la sucesión en cuanto la predecesora deja de ser fila viva, esa sucesora ocupa el candado `A` y
   la base rechaza el alta. **Lo que la superficie ofrece ahí es terminar o abandonar el checkout
   abierto**, con su enlace y su fecha de vencimiento (cap. 03 §3.3.1 y §3.4 punto 3, `B/19` §4
   fila 16). Abandonar lo deja en `ABANDONED`, que no es vivo, y recién ahí *«empezar de nuevo»*
   es la oferta correcta.
2. **Las dos muertes ya no comparten estado — el residuo está cerrado.** `ABANDONED` dice *«nadie
   autorizó dentro de su ventana»*; **`CHARGE_DECLINED`** dice *«intentó y lo rechazaron»*. Le decimos cosas
   distintas al cliente en cada caso y ahora tienen nombres distintos (cap. 03 §3.1, transición
   `S16`). No era una cuestión de prolijidad: mientras compartían nombre con `SUSPENDED`, el
   candado del §11 no podía distinguir una autorización viva de una cancelada de forma terminal.

### 4.5 Tres precisiones que la regla necesita

1. **«Primer cobro» se cuenta por autorización, y el abuso que la versión histórica temía lo
   frena otra cosa.** Contarlo por `user + vertical` era defenderse de que cancelar y volver a
   suscribirse reseteara el contador; lo que cierra ese ciclo no es el contador sino el destino:
   **cada reintento muere sin pasar por `GRACE_PERIOD`**, así que **no hay diez días que cosechar**
   por más veces que se repita. Son **dos destinos y no uno**, según haya autorización o no: el que
   autorizó y no cobró muere en `CHARGE_DECLINED`, y el servicio que recibió se mide en los minutos
   de `PA-3`; el **pagador manual** que nunca transfiere muere en `ABANDONED` al vencer su ventana,
   y el servicio que recibió es **ninguno**, porque su primera cuota se abre antes de que la fila
   llegue a `ACTIVE` (`B/03` §7.2). Escribir la garantía sobre un solo destino la dejaba sin sujeto
   justo sobre la población que no tiene autorización. El contador histórico, en cambio, le cobraba
   el abuso al cliente legítimo que vuelve (§4.3).
2. **Se cuenta sobre pagos acreditados, nunca sobre fechas.** Un período transcurrido no es un
   período pagado, y confundirlos es lo que abre el agujero de §5.
3. **El aviso es distinto.** A quien esta autorización nunca le cobró —haya sido cliente antes o
   no— no se le dice *«tenés diez días para regularizar»*: se le dice que el cobro no entró y cómo
   volver a intentarlo. Prometer una
   ventana que no tiene es peor que no prometerla (cap. 15 (épica de verticales) §4.4).

---

## 5. Compensar días sobre una suscripción en deuda · cierra `E-SUB-05`

### 5.1 El residuo

`DEC-SUB-003` permite cambiar de plan estando en `GRACE_PERIOD` —es el camino de recuperación— y
`DEC-SUB-006` compensa los días pagados al cambiar de ciclo. Cruzarlos deja la pregunta: **¿qué se
compensa sobre alguien que debe?**

### 5.2 Se disuelve leyendo la fórmula que ya existe

`DEC-SUB-006` compensa **por valor**, y define el crédito como **lo pagado sin usar**.

**En grace, el período en curso no se pagó** — un cobro falló, que es la definición del estado.
Entonces el crédito es **cero**, y no hace falta ninguna regla nueva: la fórmula ya dice
*«pagado»*.

**Y ese cero choca con `D8`, así que hay una regla que sí hace falta.** Con crédito cero la fecha
de primer cobro de la sucesora cae **hoy**, y `D8` exige que sea **futura** — dos reglas correctas
que no se pueden cumplir a la vez, y quien choca contra las dos es alguien en mora que quiere
mejorar su plan. La salida:

> **Toda sucesora nace con fecha de primer cobro POSTERIOR AL VENCIMIENTO DE SU VENTANA DE
> AUTORIZACIÓN.** Ninguna puede cobrar antes de que su propia ventana se cierre.

**«Un día como mínimo» no alcanzaba, y el número no era el problema: era el instante en que se
comprueba.** La precondición se verifica **cuando la fila nace** y tiene que seguir siendo cierta
**hasta que el cliente autorice**, que puede ser **casi 72 horas después sobre un pagador con
tarjeta y casi 7 días corridos después sobre un pagador manual** (`S3`, con sus **dos** plazos
según el método de pago — `B/03` §3.4 punto 1, `DEC-SUB-016`). Con un día, la fecha ya pasó durante
el **97 %** de la primera de esas dos ventanas y durante **más** de la segunda — y `EX-39` mide que
**no se puede mover**: las fechas son inmutables también sobre un preapproval `pending`.

**Por qué atado a la ventana y no a un número nuevo.** La ventana es configuración (`B/03` §3.4,
punto 1) y su valor sale de dos restricciones ya escritas; un segundo número elegido a mano se
desincroniza del primero el día que alguien toca uno solo. Así la regla se lee igual aunque la
ventana cambie, y **es verificable sin contexto**: `G-R1-B` compara la fecha guardada contra el
vencimiento de la ventana de esa misma fila.

**Por qué uniforme y no una precondición distinta según de dónde venga la sucesión.** Declarar que
*«desde grace la precondición es otra»* es más exacto conceptualmente, **y por eso es peor**: le
mete una rama a la precondición de seguridad del mecanismo más caro del sistema, y obliga al guard
que vigila `D8` a **saber de dónde viene cada sucesión** para saber qué exigir. Un guard con esa
forma es un guard que alguien va a leer mal. Así vale para toda sucesión, venga de donde venga,
`D8` queda en una línea sin excepciones, y el costo —que el cliente espere un día para el primer
cobro del plan nuevo— es **a su favor**.

**La forma verificable, y es la que hay que congelar:**

> **El crédito se computa a partir de los pagos acreditados, nunca a partir de los días
> transcurridos.**

Es el mismo error que abría el agujero del §4.3, dicho sobre el dinero en vez de sobre el tiempo,
y **una sola implementación que mire fechas rompe las dos**.

### 5.3 Y la deuda vieja no se persigue por separado

El cobro que falló era de un período que **se prestó entero** — el §20 da servicio completo
durante el grace. Es servicio regalado, que es la dirección que ese mismo grace ya eligió.

**No se compensa con el cobro nuevo ni se cobra aparte.** Perseguirlo exigiría un mecanismo de
cobranza que no existe en ningún lado del PDR, sobre alguien que **acaba de volver a pagar** — y
`DEC-SUB-003` eligió que cambiar de plan sea *«una salida del problema en vez de un muro»*.

**Pero perdonarla no la apaga, y eso hay que decirlo antes de que pase.** Mientras la predecesora
siga viva su cuota sigue en `recycling` (§1.3, medido) y **puede entrar** — sobre un pagador con
tarjeta, **sólo mientras siga en `GRACE_PERIOD`**: al suspender, `S6` cancela el preapproval y el
reciclado se termina (`DEC-SUB-019`). Si entra dentro de las
la ventana de autorización de la sucesión —**72 h o 7 días corridos, según el método de pago**
(`B/03` §3.4 punto 1, `DEC-SUB-016`)—, el cliente **paga la deuda que le perdonamos**.

**Y son DOS las puertas por las que puede entrar, no sólo el reciclado.** La otra es el **pago
manual** del §30: el cliente transfiere la cuota vieja y el admin la registra con `MP1` —o con
**`MP4`**, si el impago ya se había declarado y la fila está en `SUSPENDED` (`B/03` §7.1)—. **Las
dos filas son la misma puerta**, y el desenlace es idéntico por la razón que `MP1` escribe —*«el
daño no depende de por qué puerta entró el pago»*—, así que el evento de `S19` las cubre a las dos
sin distinguirlas: se enuncia sobre el hecho y no sobre el mecanismo (`B/03` §3.2). Todo lo que
sigue en este § vale igual para las dos, incluido el aviso previo.

> **Se acepta que el cobro pueda entrar, y se le avisa al cliente ANTES de que pase.**

**Ninguna de las dos salidas es limpia, y se eligió por cuál daño es reversible.** Cancelar la
predecesora en el acto contradice `D7` —*«la vieja se cancela sólo al recibir el webhook de que la
nueva quedó autorizada»*—, que existe por una razón medida: si se cancela antes y el cliente
abandona el checkout, **se queda sin nada**. Ese daño es silencioso y no se deshace. El de acá es
**un cobro indebido, visible y reversible**. Es el mismo criterio que `PA-5` ya aplicó sin
nombrarlo: entre dos males, el reversible — *un cobro se reembolsa y una cancelación en el
proveedor no*.

**El aviso previo no es un adorno: es lo que hace aceptable la decisión.** Un cobro que sorprende
es un reclamo; uno anunciado es un trámite. El correo va al catálogo de `NUCLEO/07`. Y conviene
saber sobre qué descansa la salida si el cobro entra: el reembolso es **la única capacidad que el
cap. 06 §10 declara en riesgo de plataforma** (`RF-6/7/8`).

**El aviso tiene que decir las dos ramas, no sólo que el cobro puede entrar.** Lo que decide cuál
de las dos le toca al cliente es **si termina el checkout**, que es lo único de todo esto que está
en sus manos: si lo termina, el cobro se le devuelve; si lo abandona, **el cobro le queda** y le
paga el período que está usando. Anunciar sólo *«el cobro puede entrar»* —que es lo que decía—
describe el hecho y esconde la única decisión que el cliente puede tomar al respecto. Alcanza a
`NUCLEO/07` §6, fila *«cambio de plan con una cuota en reintento»*, y a `B/19` §4, fila 15.

**Y el aviso le toca también al que paga a mano**, porque su puerta es la que el cliente abre a
propósito: el que transfiere la cuota vieja mientras cambia de plan hace, con un acto suyo,
exactamente lo que al otro le hace el reciclado del proveedor. Alcanza a las mismas dos filas
—`NUCLEO/07` §6 y `B/19` §4 fila 15—, y ninguna de las dos lo decía.

**Y tiene que decir que la devolución no es instantánea**, porque `DEC-RF-002` la puso en manos de
una persona: el reembolso de la primera rama **se confirma, no se dispara solo**. Es el precio
aceptado de no abrir el único dominio que el diseño tiene vacío a propósito —operaciones
automáticas sobre dinero—, y el aviso es donde ese precio se acota: un cliente que sabe que la
devolución lleva unas horas espera; uno que la esperaba en el acto reclama. Sin esta frase el
correo promete algo que la decisión no da.

#### Y si entra, NO reactiva a la predecesora

> **Ni `S5` ni `S7` se aplican sobre la PREDECESORA de una sucesión en curso** — o sea la fila que
> **tiene una sucesora VIVA** con `sucede_a` apuntándola (`B/02` §2.2). El pago entra, **se
> registra, y queda pendiente de resolución**: `S19`.

**El adjetivo *«viva»* es la mitad que decide cuándo la regla DEJA de aplicar.** Nada limpia
`sucede_a` cuando la sucesora se muere —`S3` al vencer su ventana, o `S13`—, así que leída sin él la regla
no vence nunca: la fila queda para siempre sin poder reactivar (`S5`, `S7`), sin poder suspender
(`S6` no corre sobre un pago pendiente) y con la plata retenida. Con él, la muerte de la sucesora
**es** el fin de la sucesión y el pago se resuelve por la rama 2, que es lo que la tabla de abajo
ya decía. El inventario de los predicados que leen este puntero está en `NUCLEO/01` §2.4.

**El sujeto es la predecesora, y hay que decirlo con esas palabras porque la versión anterior decía
*«una fila que ya declaró sucesión»* y eso nombra a la OTRA.** *«Declarar una sucesión»* es el
vocabulario que fijaron `S1` —*«la fila declara una sucesión (`sucede_a`)»*— y los dos candados de
`B/02` §2.2, partidos por `sucede_a IS NULL` / `IS NOT NULL`: **la que declara es la sucesora**. La
predecesora tiene `sucede_a` nulo y no declaró nada. Leída al pie de la letra, la regla eximía a
una fila en `PENDING_AUTHORIZATION` —que **no puede** estar en `GRACE_PERIOD`, así que `S5` nunca
la alcanza y la regla era vacua— y dejaba intacta la reactivación de la única fila a la que ese
cobro le puede llegar. Desde `B/02` §2.2 el lado se lee sin ambigüedad y por eso la regla se
enuncia sobre la columna: **la sucesora tiene `sucede_a`; a la predecesora la apunta uno**.

**Y son las dos transiciones, no una.** La predecesora arranca la sucesión en `GRACE_PERIOD`, pero
la ventana dura hasta vencer —**72 h o 7 días corridos**, `B/03` §3.4 punto 1— y el reloj del grace la puede pasar a `SUSPENDED` por `S6` antes de que
el cobro reciclado entre —es la fila 3 de las siete que `B/03` §3.2 recorre—. Sobre una `SUSPENDED`
la reactivación posible ya no es `S5` sino `S7`, con el mismo daño exacto. **Y desde `DEC-SUB-019`,
en un pagador con tarjeta esa puerta ya no llega por el reciclado**: `S6` cancela el preapproval en
el mismo acto de suspender, así que sobre una `SUSPENDED` de tarjeta **no queda ninguna puerta
ordinaria**: la manual (`MP4`) es del pagador manual —un pagador con tarjeta no tiene cuotas, `MP5`
sólo las abre sobre suscripciones de pagador manual (`B/03` §7)—, y lo único que puede entrar es un
borde: un cobro que ya estaba en vuelo en el instante de `S6`, o un preapproval reactivado a mano — y
por eso `S7` sigue
necesitando el mismo bloqueo que `S5`, no porque el reciclado siga vivo ahí. Nombrar sólo `S5`
dejaba abierta la mitad del caso. **Una vez que el pago entró el orden ya no se repite**, porque
`S6` no corre sobre un pago pendiente (ver abajo): las dos transiciones se bloquean, no una.

**Sin esta regla el cobro hacía dos daños, no uno.** El primero es el que el aviso anticipa: el
cliente paga la deuda que le perdonamos. El segundo no lo anticipaba nadie — **la reactivación
devuelve la predecesora a `ACTIVE`**, así que en plena sucesión la persona queda con **las dos
vivas**, y el crédito de la sucesora **ya se computó en cero** suponiendo que ese período no se iba
a pagar nunca. O sea: paga un período entero que **no le compra nada**, y la fórmula que lo ignoró
ya no se puede corregir (§5.4: las fechas del proveedor son inmutables, `EX-39`).

#### El destino del pago lo decide el cierre de la sucesión, no su llegada

**Reembolsar al entrar el pago suponía que la sucesión siempre termina, y tiene dos desenlaces.**
La versión anterior decía *«se reembolsa; la predecesora sigue su camino a `CANCELLED` por
`S17`»*, y ese *«sigue su camino»* es una afirmación sobre el futuro que la propia tabla desmiente:
`S3` mata a la sucesora **al vencer su ventana sin autorizar**, y `B/03` §3.3.1 trata abandonar el checkout
como una salida normal y ofrecida. En esa rama la predecesora **nunca llega a `CANCELLED`**: se
queda en `GRACE_PERIOD` sin sucesora y con su único pago **devuelto**, el reloj sigue corriendo, y
a los pocos días la suspendemos por falta de pago — habiendo cobrado y devuelto el pago que la
salvaba. Del lado del proveedor la cuota figura **pagada**, así que su reciclado se apagó y no va
a volver a intentarlo: no hay segundo cobro que la rescate.

> **El pago acreditado no se reembolsa al entrar: queda pendiente, y se resuelve cuando la sucesión
> se resuelve.** Mientras tanto no reactiva, no se devuelve y **no se pierde**.

**El dominio es el de las formas en que una sucesión en curso puede terminar, y son seis.** Se
enumeran recorriendo las salidas de la predecesora (en `GRACE_PERIOD` o `SUSPENDED`) y las de la
sucesora (en `PENDING_AUTHORIZATION`) — **sobre la tabla de transiciones del cap. 03 entera, no
sobre sus filas numeradas**, que es la corrección que trajo la quinta:

> **La enumeración anterior decía «cuatro» y declaraba su método: *«las enumeré sobre `B/03`
> §3.2»*.** El método es el que fallaba. El §10.1 del mismo capítulo declara que **espejar un
> estado leído por id es una transición declarada de esa tabla**, y el espejo de la baja que
> decide el proveedor **no tiene fila numerada** — así que recorrer las filas numeradas deja
> afuera una salida real de la predecesora, y justamente la del camino de mora, que es de donde
> viene toda la población de `S19`. La rama que faltaba no era un borde: era **la salida esperada
> de esa población** (§1.4).

| cómo termina la sucesión | qué pasa con el pago pendiente | por qué |
|---|---|---|
| **la sucesora autoriza** (`S2`) → `S17` mata a la predecesora y `S18` cierra | **se reembolsa, y lo confirma una persona** (`DEC-RF-002`): **`S18`, en el mismo acto del cierre, le abre a la PREDECESORA** —la dueña del pago— **una marca `requiere_conciliación` con motivo `REEMBOLSO_POR_CONFIRMAR`**, con **el pago colgado de ella** (`B/02` §2.2 y §2.5), y el caso entra al canal de conciliación; el sistema **no ejecuta el reembolso solo** | el período que cubría se lo comió `S17`: no le compró nada, y el crédito de la sucesora se computó en cero. Es lo que este § ya decidió, con su disparador corregido |
| **la sucesora vence su ventana** (`S3` → `ABANDONED`) | **no se reembolsa: reactiva** — y lo dispara **`S3`**, que reevalúa el pago pendiente en el acto | ya no hay sucesión, el pago cubre el período que la persona está usando, y el §3 del cap. 05 lo evalúa de nuevo con su condición 3 ahora cumplida. `S5` o `S7`, según el estado |
| **la sucesión queda trabada** — la cancelación en el proveedor falla sobre un preapproval vivo (`B/03` §3.2) | **lo resuelve la misma persona**, junto con la marca que `S14` ya abrió | es la única rama en que hay de verdad dos autorizaciones que pueden cobrar; ya hay un humano mirándola y el pago es parte del mismo caso. **Y *«junto con»* sólo es verdad si las dos marcas se ven**: cuando `S15` resuelve la traba y `S18` cierra, la predecesora queda con **dos marcas abiertas** —la de la traba y el `REEMBOLSO_POR_CONFIRMAR` que abre el cierre—, y `S15` levanta **una por vez** (`B/02` §2.2 y §2.5). Con un booleano, resolver la traba apagaba el reembolso en el mismo gesto |
| **cae un grant *Free Forever*** (`S13` sobre las dos filas) | **no se reembolsa**, y es una excepción declarada — **`S13` apaga la bandera en el mismo acto** | `DEC-GRANT-001`: *«se corta el cobro en el acto y no se devuelve lo pagado»*, con su riesgo ya declarado. El cobro es **anterior** al regalo, así que no es el caso del `B/05` §C3. La bandera se apaga porque un *«pendiente»* eterno sobre una fila cerrada no es un registro fiel: es un conteo inflado |
| **el proveedor da de baja a la PREDECESORA** por impagos acumulados (§1.4), y el espejo del `B/03` §10.1 la lleva a `CANCELLED` con la sucesora todavía esperando autorización | **se reembolsa, y lo confirma una persona** — igual que la rama 1: **`S18` cierra la sucesión sin `S17`** (la predecesora ya no es fila viva) y le abre a **ella** la marca con motivo `REEMBOLSO_POR_CONFIRMAR` | el período que el pago cubría lo cortó la baja del proveedor, no nosotros, pero el resultado para el cliente es el mismo de la rama 1: pagó un período que no le compró nada. Y el cierre **tiene** que correr igual —si no, el candado `A` queda vacío y un alta nueva entra (`B/03` §3.2)—, así que el acto que lo dispara ya está ahí |
| **la propia PREDECESORA pide la baja** y llega a `CANCELLED` con la sucesora todavía esperando autorización — **desde `SUSPENDED` (`S23`) o desde `GRACE_PERIOD` (`S24`)**, que son los **dos** estados desde los que `S19` retiene un pago (`B/03` §3.2) | **se reembolsa, y lo confirma una persona** — igual que las ramas 1 y 5: `S18` cierra la sucesión sin `S17` y le abre a **ella** la misma marca, con el mismo motivo `REEMBOLSO_POR_CONFIRMAR`. **Y desde `DEC-RF-003` llega al listado accionable con el default en DEVOLVER** (`B/19` §6) | es la única de las seis en que **el acto lo hace el cliente sobre su propia fila**, así que ninguno de los dos automatismos vecinos encaja: no hubo un período que nosotros cortáramos (rama 1) ni una baja que decidiera el proveedor (rama 5). **El default no contradice eso**: el pago quedó retenido **porque nuestra sucesión no cerró**, no porque el cliente hiciera nada raro, así que *«puso plata, se le da salida»* aplica igual acá que en las otras dos (`DEC-RF-003`). Lo que no puede pasar es que la bandera quede puesta sobre una `CANCELLED` que ningún barrido mira: la salvedad 3 del `B/09` §3 la devuelve al barrido hasta que se apague |

**Y las TRES comparten desenlace propuesto desde `DEC-RF-003`, que es lo que vuelve legible el
motivo que comparten.** Hasta esta tanda la rama 6 decía *«lo decide una persona»* **sin decirle
qué debería decidir**, mientras las otras dos decían *«se reembolsa»*: una misma marca, con un
mismo motivo, con dos indicaciones distintas según una rama que el listado no muestra. **La
alternativa —dejarla sin default— es el estado que ya falló**: el crítico que motivó el motivo
existió porque una marca muda se vuelve indistinguible y **el pago se queda**. La confirmación
sigue siendo humana y sigue pudiendo decir que no (`DEC-RF-002`).

**Lo que se descartó, y por una razón de método**: un default que dependa de **si el período se
consumió** —entero si la baja llega antes de que empiece, nada si ya corrió— es **más justo** y
pide **una fecha que hay que verificar que exista**. Toda esta familia de críticos nació de
columnas que nadie escribía, así que prometer un default apoyado en un dato sin confirmar es
fabricar el defecto que esta tanda acaba de arreglar. **Queda anotado como mejora** para cuando se
verifique que esa fecha está guardada (`DEC-RF-003`).

**Las seis ramas valen para las dos puertas, y las TRES que abren la marca de dinero ya tienen
dónde asentarla.** *«El pago»* de las ramas 1, 5 y 6 es el que `S19` retuvo, que puede ser un
`payment` o un `manual_payment` (`B/03` §3.2, §7). El acto es el mismo en las tres —`S18`
abre la marca con motivo `REEMBOLSO_POR_CONFIRMAR` y **una persona confirma**, `DEC-RF-002`— y el
asiento también: un `refund` sobre
el pago que se devuelve (`B/02` §2.3). Hasta que esa columna admitió las dos entidades, la rama
que mueve dinero prometía una devolución que para la mitad de su población **no se podía
registrar**.

> **Y la marca que las tres abren se distingue de las otras ~~catorce~~ quince, que es lo que
> faltaba** (dieciséis motivos desde `F-8CB1-013`, FASE 8 completa, owner 2026-09-25;
> `B/02` §2.5). Un
> booleano no transporta un motivo: la predecesora llegaba al listado accionable como una
> `CANCELLED` marcada, igual que la de una divergencia de monto o la de una reanudación que no se
> aplicó —una de las otras ~~catorce~~ quince—, **sin nada que dijera que hay plata del cliente para devolver**. Desde la FASE 9-bis-4
> la marca es una fila con motivo, reloj y **los pagos colgados de ella** (`B/02` §2.2 y §2.5). **Las
> tres son «la misma marca» en sentido estricto** —mismo motivo, mismo desenlace— y difieren sólo
> en qué mató a la predecesora, que es lo que el recuadro de abajo separa.

**Las seis ramas tienen ahora un ACTO que las dispara, y hay que decirlo porque durante una
tanda entera no lo tuvieron.** La rama 1 decía *«al cerrar la sucesión se pone la marca»* sin
nombrar transición ni fila, y por la regla 1 del núcleo —*«lo que la tabla no declara, no
pasa»*— el reembolso de la única rama que mueve dinero **no lo ejecutaba nadie**, sobre un camino
que `DEC-RF-002` declara normal:

| rama | qué acto lo dispara | sobre qué fila |
|---|---|---|
| 1 · la sucesora autoriza | **`S18`** (efecto 5) | **la predecesora**, `CANCELLED` |
| 2 · la sucesora vence su ventana | **`S3`** (efecto) | la predecesora, viva |
| 3 · la sucesión trabada | `S14`, que ya puso la marca | la predecesora |
| 4 · cae un grant | **`S13`** (efecto) | las dos |
| 5 · el proveedor da de baja a la predecesora | **`S18`** (efecto 5), disparado por el espejo del `B/03` §10.1 | **la predecesora**, `CANCELLED` |
| 6 · la predecesora pide la baja ella misma | **`S18`** (efecto 5), disparado por `S23` **o por `S24`** (`B/03` §3.2) | **la predecesora**, `CANCELLED` |

> **La 5 y la 1 comparten acto y no son la misma rama.** Difieren en qué mata a la predecesora
> —`S17`, nuestro, contra el proveedor, ajeno— y eso cambia dos cosas que el cliente ve: en la 1
> la sucesora ya autorizó y **hay cobertura nueva desde el instante del cierre**; en la 5 la
> sucesora todavía está en `PENDING_AUTHORIZATION`, que **no emite fuente**
> ([`12-contrato…`](../../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md)
> §2.6), así que el cliente **cae al piso por lo que le quede de ventana** — el mismo desenlace
> que ese § ya declara y acepta para `S12`, `S13` y `S16`, y por la misma razón: el compromiso que
> sostenía la cobertura terminó. El tope sigue siendo la ventana de autorización, con sus **dos**
> plazos (`B/03` §3.4 punto 1).
>
> **Y si la sucesora después abandona, no cae en la rama 2.** La 2 *«reactiva»*, y sobre una
> predecesora `CANCELLED` eso es imposible por la condición 1 de `B/05` §3. No hay conflicto
> porque la 5 **ya resolvió el pago** en el cierre: cuando la sucesora abandona no queda nada
> pendiente que reevaluar. Lo que antes mandaba ese caso a *«si la rama no es determinable, se
> pone la marca»* del backstop de `B/09` §3 —o sea a una persona, sin que ningún texto lo
> anticipara— era justamente que esta rama no existía.
>
> **Y la 2 tiene desde la FASE 9-bis-5 un segundo disparador, que llega al MISMO destino por otro
> mecanismo.** `S28` (`B/03` §3.2) mata a la sucesora cuando se discontinúa la vertical, así que la
> sucesión termina igual que si hubiera vencido la ventana. **Lo que cambia es dónde está la
> predecesora**: `S26` la acaba de mandar a `CANCEL_SCHEDULED` en el mismo acto, así que *«reactiva»*
> —lo que la 2 hace— **no aplica**, porque no hay grace del que salir. **Y no hace falta**: una
> `CANCEL_SCHEDULED` **emite cobertura** hasta la fecha de fin de servicio de la vertical
> ([`12-contrato…`](../../HOS-1352-billing-verticals-redesign/docs/12-contrato-de-cobertura.md)
> §2.6), que el `B/10` §4.3 garantiza en **al menos 60 días**, así que el pago retenido **le queda y
> le paga el período que está usando** — que es exactamente lo que la 2 decide. **Mismo destino,
> mecanismo distinto, y por eso es la misma rama y no una séptima.**

**Y la rama 6 tiene desde la FASE 9-bis-4 DOS filas y sigue siendo UNA rama, que es una
distinción que este § ya usa.** `S24` —la baja pedida en medio del grace, `DEC-SUB-014`— produce
exactamente el mismo desenlace que `S23`: el cliente mata su propia fila, `S18` cierra sin `S17`
y el pago que `S19` retenía queda en manos de una persona. **Las ramas enumeran cómo termina la
sucesión, no desde qué estado**, y por eso el recuadro de arriba tuvo que argumentar que la 5 y la
1 **no** son la misma —difieren en **quién** mata a la predecesora— mientras que acá quien la mata
es el mismo en las dos. **Los dos estados son además los únicos dos desde los que `S19` retiene un
pago**, así que con `S24` la rama 6 pasa a cubrir su población entera en vez de la mitad. **Las
ramas siguen siendo seis y el número se recontó sobre la tabla**, no se dejó como estaba.

**La marca va sobre la PREDECESORA y no sobre la sucesora, y la elección tiene consecuencia.** El
pago cuelga de la predecesora (`B/02` §2.3), así que es la fila que hay que mirar para resolverlo.
Y ponerla sobre la sucesora tenía un costo que la otra no tiene: *«mientras la marca esté puesta
sobre una fila, ningún `sucede_a` puede apuntarla»* (`B/02` §2.2), o sea que el cliente que
**acaba** de cambiar de plan no podría volver a cambiarlo hasta que una persona resuelva un caso
que es de su plata y no de su plan. Sobre la predecesora esa regla es vacua: está `CANCELLED`, y
`G-R1-A` ya sólo deja declarar una sucesión desde `ACTIVE`, `GRACE_PERIOD`, `CANCEL_SCHEDULED` o
una `SUSPENDED` de pagador con tarjeta con el preapproval releído `cancelled` (FASE 8 completa,
`F-8CB1-002`).

**Y la predecesora es terminal, así que el reloj de la marca la tiene que alcanzar.** Por eso
`B/09` §3 devuelve al barrido las suscripciones terminales con la marca puesta o con un pago
pendiente (salvedades 2 y 3): sin eso la marca no escala nunca y *«lo confirma una persona»*
significa *«lo confirma una persona si se acuerda»*. **El reloj es la mitad operativa de
`DEC-RF-002`**, no un detalle del capítulo 09.

**Las dos primeras son la razón de la regla y son opuestas**, y por eso el disparador no puede ser
la llegada del pago: en el momento en que entra **todavía no se sabe cuál de las dos va a pasar**.
Lo que sí se sabe es que no hay que reactivar —eso vale en las seis ramas mientras la sucesión
esté en curso—, y eso es lo que `S19` ejecuta.

**Reembolsar en la primera rama es la salida coherente con lo que este mismo § decidió**: el
período se declaró perdonado —*«no se compensa con el cobro nuevo ni se cobra aparte»*—, así que
cobrarlo por un servicio que `S17` cortó es un error y devolverlo es repararlo. Es el criterio de
`PA-5` otra vez: **entre dos males, el reversible**.

**Y el reloj del grace no corre sobre un pago pendiente.** Si la ventana de autorización cruza el
vencimiento del grace, `S6` mandaría a `SUSPENDED` —que **no emite fuente** (`12-contrato…`
§2.6)— a alguien cuyo pago del período **está acreditado en nuestra cuenta**. El reloj existe para
acotar el servicio regalado a quien no pagó (§4.3: *«el grace no es un beneficio de entrada»*), y
acá el período se pagó: por eso `S6` lleva la condición en `B/03` §3.2. No es una gracia extra —es
el tope de la ventana— y sin ella el arreglo de este § crea, más chica, la misma
suspensión que vino a impedir.

### 5.4 Si la predecesora renueva dentro de la ventana, el crédito queda corto — y que haya corrección depende de quién tiene la fecha

El crédito se computa **al crear** la sucesora (`DEC-SUB-006`), y la ventana de autorización dura
**72 h sobre un pagador con tarjeta y 7 días corridos sobre un pagador manual** (`B/03` §3.4
punto 1, `DEC-SUB-016`). Si la predecesora renueva dentro de esa ventana, el crédito quedó corto
**por un ciclo entero**. Corregirlo exige mover la fecha de cobro de la sucesora, **y de quién sea
esa fecha depende que se pueda**: sobre un pagador con tarjeta es un dato del proveedor sobre un
preapproval `pending`, y está medido que no se mueve; sobre un pagador manual es **una columna
nuestra**, y ahí sí se corrige (`DEC-SUB-017`).

> **La medición cubre UNA de las dos poblaciones, y hay que decirlo porque la partió
> `DEC-SUB-016` después de que esta medición se hiciera.** La sonda 48 midió un **preapproval**, y
> un pagador manual no tiene ninguno (`B/06` §7): sobre él la ventana dura **más del doble** y la
> fecha del próximo cobro es **una columna nuestra** (`B/03` §7.2, *«qué mueve la fecha del próximo
> cobro»*), no un dato del proveedor. **Extender a esa población una conclusión medida sobre la
> otra es fabricar un hecho**, así que las dos ramas van escritas aparte y cada una dice sobre qué
> se apoya.

**Se midió si eso se puede hacer, y no se puede.** Sonda 48, sandbox, 2026-09-19, registrada como
`EX-39`, sobre un preapproval `pending`:

| intento | resultado |
|---|---|
| `auto_recurring.start_date` suelto | `200`, **`last_modified` congelado**, la fecha sin moverse |
| `next_payment_date` suelto | `200`, ídem |
| `auto_recurring` completo con la fecha adentro | `200`, ídem |
| **control**: `PUT` de `transaction_amount` sobre el MISMO sujeto | `200`, **`last_modified` SÍ se movió**, 2000 → 2500 |

**El control es lo que la vuelve concluyente**: separa *«la fecha no se puede mover»* de *«este
objeto no acepta nada»*. Entró el monto, así que **lo bloqueado son las fechas, no el objeto**.

> **La inmutabilidad de las fechas no depende del estado.** Vale igual sobre una `pending` que
> sobre una autorizada, así que `start_date` sirve **sólo al crear**, y punto.

**Entonces, sobre el pagador con tarjeta, la salida no es corregir: es no llegar a ese caso.**
Cuando la renovación de la predecesora está cerca, el cambio de plan se ofrece con **ventana
reducida**, de modo que la autorización no pueda cruzar la fecha de cobro. **La regla, fijada el
2026-09-24 por el owner:**

1. **La ventana de la sucesora vence a lo que llegue primero**: sus 72 h (`B/03` §3.4 punto 1) **o
   las 00:00 del día de la próxima fecha de cobro de la predecesora, en el huso del proveedor
   (`-04`)**.
2. **Si lo que queda es menor que un mínimo —configuración, hoy 24 h—, el cambio no se ofrece en
   ese momento**: se ofrece **después** del cobro, y se le dice a la persona desde cuándo puede
   hacerlo. Pasado el cobro, el crédito ya incluye lo que se pagó ese día, y la ventana vuelve a
   ser la completa.

**Por qué el corte es al inicio del día y no a la hora de la fecha**: el proveedor **no cobra a la hora
exacta** de la fecha, sino en **lotes** —medido el 2026-09-24 en producción—: los **trece cobros de
renovación** de tres suscripciones con fechas de las 13:13, 13:19 y 13:28 `-04` se crearon todos
**entre las 14:01 y las 14:02** (manifiesto de `RN-3`, fuera del repo:
`~/.hos1352-rn3-manifiesto.json`), y el de la sonda 49, con fecha de las **17:43**, **no** entró en el
lote de las 14:02 y se creó a las **18:02:20**. Lo que eso sostiene: **el cobro cae en el primer lote
posterior a la hora de la fecha**, y los lotes corren al minuto `:02`. **No está medido que corran
TODAS las horas** — hay dos lotes observados, 14:02 y 18:02. El corte al inicio del día es correcto
con cualquier cadencia, y es conservador: cuesta, como mucho, un día de ventana.

**Por qué el mínimo es un criterio y no una medición**: nadie midió cuánto tarda una persona en
completar el checkout — las 72 h tampoco salen de una medición. Ofrecer una ventana de pocas horas
es ofrecer algo que se va a vencer; esperar al cobro **no le cuesta plata a la persona**, porque lo
que pague ese día se le compensa por valor en el plan nuevo (`DEC-SUB-006`), sólo días de espera.

**Sobre el pagador manual, en cambio, no hay ventana reducida.** Su fecha del próximo cobro es una
columna nuestra, así que si la predecesora cobra dentro de la ventana **se corrige** (`DEC-SUB-017`).
La reducida hace falta sólo donde no hay corrección posible; aplicarla también ahí obligaría a
elegir un mínimo que choca con los 7 días de `DEC-SUB-016` — un fin de semana largo no entra en 72 h,
y 7 días bloquearían el cambio casi siempre. **Esto reemplaza lo que decía antes este párrafo**
(*«la ventana reducida vale para las dos poblaciones»*), por decisión del owner del mismo día.

**Una trampa del método, anotada porque cuesta cara**: el aviso *«doscientos que no aplicó»* saltaba
también en el control —que no pide mover ninguna fecha y sí aplicó—. Lo que delata un `200` vacío
es que **`last_modified` no se haya movido**, no que la fecha siga igual.

#### Y sobre una predecesora `SUSPENDED` de tarjeta, este § no tiene caso

Desde la FASE 8 completa, `G-R1-A` deja declarar una sucesión desde una `SUSPENDED` de pagador con
tarjeta cuyo preapproval se releyó `cancelled` (`F-8CB1-002`). Sobre esa predecesora, las dos
piezas de este § se resuelven solas, y conviene decirlo para que nadie las aplique:

- **La ventana no se reduce.** No hay próxima fecha de cobro: `S6` canceló el preapproval. No hay
  renovación que pueda cruzar la autorización, así que la ventana es la entera, **72 h**.
- **El crédito de `DEC-SUB-006` es cero.** El crédito es *«lo pagado sin usar»*, y a un suspendido
  no le queda nada pagado: el período en curso es justamente el que no pagó, y los días de grace
  fueron servicio sin cobro. La sucesora nace **sin fecha de primer cobro diferida** y cobra su
  primer ciclo al autorizar.

#### Y sobre el pagador manual sí hay corrección, porque acá no hay proveedor que no nos deje

**El argumento entero de arriba no tiene sujeto en esta población.** Un pagador manual **no tiene
preapproval** (`B/06` §7), así que no hay ningún objeto del proveedor cuyas fechas estén
bloqueadas: la fecha del próximo cobro de su sucesora es **una columna nuestra** (`B/02` §2.2).
Aceptar acá el crédito corto obligaría a declarar como causa **el límite del proveedor**, que en
esta población **no existe**.

> **Sobre una sucesora de pagador manual el crédito se RECOMPUTA en el instante en que su fecha
> del próximo cobro se estrena**, contra los pagos que la predecesora tenga acreditados **a ese
> instante**, y no contra los que tenía en el acto de creación (`DEC-SUB-017`).

**No agrega un escritor, y eso es lo que la vuelve barata.** Sobre un pagador manual esa fecha la
estrena **`MP1`**, al registrar la primera cuota —la escritura de `S2` tiene acá población vacía,
porque su evento es un webhook de autorizada y no hay preapproval que autorice (`B/03` §7.2)—, así
que la recomputación viaja en una escritura que **ya ocurre**: las escrituras de esa columna siguen
siendo las que `B/02` §2.2 declara —*«son tres y no hay una cuarta»*— y no hay columna nueva.

**Y ese instante no es una elección de conveniencia: es el ÚLTIMO en que el caso todavía puede
ocurrir, así que no deja borde.** El caso es *«la predecesora renueva **dentro de la ventana**»*, y
la ventana se cierra exactamente ahí: sobre una fila que sigue en `PENDING_AUTHORIZATION`, **es el
registro de `MP1` el que la habilita a llegar a `ACTIVE`** (`B/03` §7.1), y que la sucesora llegue a
`ACTIVE` es lo que dispara **`S17`** sobre la predecesora (§3.2), que la lleva a `CANCELLED`. Una
renovación **posterior** a la recomputación no existe, porque después de ella ya no hay predecesora
viva que renueve; una **anterior** está acreditada y la recomputación la ve. El otro final de la
ventana —`S3`— no deja sucesora, así que tampoco deja crédito que corregir.

> **La fila que lleva a `ACTIVE` a un pagador manual es una de las que el capítulo 13 todavía
> debe** (`B/03` §7.1), así que esta corrección se apoya en una transición **declarada y no
> construida**, igual que el resto de esa población. Va dicho acá porque es justo la clase que el
> criterio de terminación de `DEC-TEST-002` mira al declarar lista la unidad.

**Y no contradice la forma congelada del §5.2**, que es lo primero que hay que comprobar: *«el
crédito se computa a partir de los pagos acreditados, nunca a partir de los días transcurridos»*.
Recomputar más tarde lee **los mismos pagos acreditados**, sólo que ya incluye el que entró adentro
de la ventana. Lo que se mueve es **cuándo se lee**, no contra qué — que es justamente lo que esa
forma prohíbe mirar.

**Y no toca `D8` ni el guard que lo vigila.** La corrección sólo puede empujar la fecha **hacia
adelante** —el ciclo que la predecesora renovó se suma al crédito—, y `D8` exige que sea
**futura** (`G-R1-B`, `B/20` §2): una fecha que se aleja no puede violar una precondición de
posterioridad.

**Y hay una razón de forma que pesa igual que la de mecanismo.** Con `DEC-SUB-016` **nosotros**
alargamos esa ventana de 72 h a **7 días corridos** sobre esta misma población, o sea que acá el
crédito corto **crece por una decisión propia**. Aceptar sin corregir lo que uno mismo agrandó es
distinto de aceptar lo que impone un tercero: lo primero hay que corregirlo o dejar de llamarlo una
restricción externa.

---

## 6. Un cambio de precio que cae sobre una pausada · cierra `E-SUB-06`

### 6.1 El choque está medido

`EX-11` **`VERIFIED`**: estando pausada **el proveedor rechaza toda modificación** con un `400`
explícito. Así que un aumento de `DEC-MP-002` cuya fecha efectiva caiga sobre un cliente pausado
**no se puede aplicar ese día**. El hueco daba tres salidas: encolarlo, bloquear la pausa
mientras haya un cambio pendiente, o cumplir el §29 de otro modo.

### 6.2 Se encola, y la pausa no se bloquea

**El aumento espera a la reanudación y se aplica ahí.** `DEC-SUB-010` ya lo había anticipado en su
implicación 3: *«todo cambio pedido durante la pausa se aplica DESPUÉS de reanudar»*. Esta sección
sólo confirma que el aumento no es una excepción.

**Bloquear la pausa se descarta y conviene decir por qué**: sería negarle a un cliente un derecho
que su plan le da **para poder subirle el precio**. No hay forma de escribir eso en un aviso.

### 6.3 Lo que hay que decirle, y cuándo

El aviso del §29 ya salió con **una fecha que va a dejar de ser cierta**. Y acá `DEC-SUB-010`
aporta la restricción incómoda: al reanudar se le muestra **una sola cosa, qué día se le va a
cobrar** — decisión explícita del owner, para no inventarle un problema.

**Las dos cosas se cumplen a la vez porque el aumento va en ese mismo dato**: al reanudar se le
dice **cuándo** se le cobra **y cuánto**. No es un aviso nuevo sobre el aumento; es el aviso de
reanudación diciendo la verdad.

### 6.4 Y la ventana de 60 días no se recorta

Si la pausa fue larga, la fecha efectiva se corre **hacia adelante**, nunca hacia atrás. La
ventana del §29 protege el tiempo de reacción del cliente, y reanudar con un aumento aplicado
**el mismo día** le daría cero. Se aplica en el **primer cobro posterior a la reanudación**, y si
entre el aviso original y ese cobro no se cumplieron los 60 días, se espera al siguiente.

---

## 7. Pausa más cancelación programada · cierra `E-SUB-02`

### 7.1 La premisa del hueco ya no es cierta

`E-SUB-02` razonaba que el §26.4 corre el fin del período hacia adelante, y preguntaba si la
cancelación espera a ese fin extendido o corta en la fecha original.

**`DEC-SUB-010` decidió que los días no usados del ciclo en curso se pierden.** No hay período
extendido que esperar: lo que corre es la fecha del proveedor (`PS-6`: el ciclo que vence estando
pausada **avanza la fecha sin cobrar**), y eso no es servicio adeudado.

### 7.2 Cancelar estando pausado termina el servicio en el acto

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
pausar**. Lo que la baja desde una cortesía sí corta son ~~los días~~ los meses de cortesía que quedaban
(en meses desde la FASE 8 completa, `F-8CB1-001`), y eso
se dice **antes de confirmar** (`B/19` §4, fila 8), con la misma forma que `DEC-GRANT-004` ya usa
para el cruce vecino.

**Quién lo ejecuta: `S22`** (`B/03` §3.2), que manda la fila directo a `CANCELLED` sin pasar por
`CANCEL_SCHEDULED`. Hasta esa fila **esta decisión no tenía ninguna transición que la cumpliera**,
y por la regla 1 del núcleo el intento se iba a la marca mientras el reloj de la pausa vencía,
`S10` devolvía la fila a `ACTIVE` y se le cobraba el ciclo siguiente.

### 7.3 El orden inverso no existe

**Y no es el §7.2 al revés, aunque lo parezca.** Ahí faltaba la fila de una decisión ya tomada y
la fila se escribió (`S22`); acá **la decisión es que no haya fila**, y el motivo es una condición
del §26 —exige `ACTIVE`— más `EX-11`, que mide que el proveedor rechaza toda modificación sobre
una pausada. Leer la exhaustividad como argumento **a favor** de que algo no pasa sólo vale
cuando alguien decidió que no pase: si un capítulo decidió que sí y la tabla no lo tiene, lo que
falta es la fila.

Pausar estando en `CANCEL_SCHEDULED` **no es una transición de la máquina**: el §26 exige
`ACTIVE`, y la tabla del capítulo 03 §1 es exhaustiva —*lo que no está, no pasa*—. No hace falta
una regla: hace falta que nadie agregue esa transición.

---

## Lo que este capítulo NO cierra

- ~~**`GR-3`**, la política de reintentos del proveedor, sigue `UNKNOWN`.~~ **Cerrado**: `GR-3`
  está `VERIFIED` y la ventana es el ciclo (§1.5). Queda sin medir la ventana mensual y anual, que
  el diseño no necesita porque el grace se corta antes.
- **Qué pasa si la fecha de un aumento cae sobre una suscripción en MORA** —no pausada— lo dejó
  abierto `DEC-MP-002` (implicación 6) y **sigue abierto**: el §6 resuelve la pausa, no el grace.
- ~~**El detalle del cobro contra el proveedor** —el checkout, el `init_point`, la verificación por
  relectura— es del capítulo 13.~~ **Está escrito en `B/06`, desde el 2026-09-24**: el checkout y su
  ventana en su §6, el saneo del `init_point` en su §4.2, la verificación por relectura en su §4.1 —
  y **la mecánica del reembolso en su §4.6**. Es **trato con el proveedor**, y por eso vive en el
  capítulo del proveedor.
