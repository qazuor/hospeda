---
title: Master Spec 12 — Suscripción
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-17
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

### 1.2 La regla, y está escrita para no depender de cuánto reintenta

> **El reloj del grace arranca cuando el proveedor deja de reintentar, no cuando falla un
> intento. Y eso se detecta releyendo el recurso, nunca contando días.**

Es la misma disciplina que ya rige en toda la spec: la regla de no-retroceso del capítulo 03 §10
—*un webhook es un aviso, no un estado*— y el invariante `D5` —*toda mutación se verifica
releyendo*—. Acá se aplica a un veredicto ajeno: **no se predice, se observa.**

**Lo que esto compra**: si el proveedor reintenta cuatro veces o doce, si su ventana es de diez
días o de quince, **el diseño no cambia**. Un número que no se usa no puede estar mal.

### 1.3 Y por eso un cobro en reintento es `PENDING`, no `FAILED`

El capítulo 03 §6 da cinco estados de pago —`PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED`,
`PARTIALLY_REFUNDED`— y **no hace falta un sexto**:

| lo que pasa | nuestro estado de pago | nuestra suscripción |
|---|---|---|
| el proveedor rechazó y **va a reintentar** | **`PENDING`** | sigue `ACTIVE` |
| el proveedor **agotó sus reintentos** | `FAILED` | S4 → `GRACE_PERIOD`, y **ahí** arranca el reloj |

**`FAILED` significa «el proveedor se dio por vencido», no «un intento salió mal».** Con esa
definición la máquina del capítulo 03 queda intacta y el estado intermedio del proveedor **no
necesita existir de nuestro lado**: es suyo, y lo leemos.

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

**La consecuencia operativa hay que decirla**: en el camino de mora, **cuándo se termina el
vínculo no lo decidimos nosotros**. Nuestro grace puede ser más largo que la paciencia del
proveedor, y si lo es, la baja llega antes que nuestra suspensión.

### 1.5 Lo que falta medir, y qué lo dispara

`GR-3` —la política de reintentos del proveedor— **sigue `UNKNOWN`**. Hay documentación del
proveedor que habla de reintentos y de una baja automática por impagos acumulados, y está anotada
en la matriz **como fuente documental, sin verificar** (§58: *«NO alcanza documentación»*).

**Esta sección no la usa.** Se escribió justamente para no necesitarla.

**Lo que sí cambia con la medición** es una sola cosa, y es de operación, no de diseño: **cuánto
tarda en promedio un cliente en caer**, que es lo que hay que poder explicarle a soporte. El
disparador de re-medición está en la matriz.

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
| 3 | **una cancelación** (§24) | **lo absorbe.** Las dos cosas caen en el mismo instante —el fin del período pagado— y ahí no hay capacidades que bajar: no queda servicio |
| 4 | **una pausa** (§26) | **espera a la reanudación.** Durante la pausa no hay publicación ni servicio (§26.1), así que hacer cumplir un excedente sobre fichas ya bajadas no hace nada y habría que reevaluarlo igual al volver |

**La regla general detrás de las cuatro**: el descenso se aplica **al fin del primer ciclo en que
el cliente efectivamente tiene servicio**. Si no lo tiene, espera; si no va a tenerlo nunca más,
se descarta.

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

> **El grace no es un beneficio de entrada.** Una suscripción cuyo **primer** cobro falla, para un
> `user + vertical` **sin ningún pago acreditado**, no pasa por `GRACE_PERIOD`: va directo a
> `SUSPENDED`.

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
2. **El capítulo 03 necesita distinguir dos muertes que hoy comparten estado.** `ABANDONED` dice
   *«nadie autorizó en 72 h»*; esto es *«intentó y lo rechazaron»*. Le decimos cosas distintas al
   cliente en cada caso, así que no pueden compartir nombre. **Queda anotado como el residuo de
   este capítulo**, no resuelto acá.

### 4.5 Tres precisiones que la regla necesita

1. **«Ningún pago acreditado» se cuenta por `user + vertical`, no por suscripción.** Por
   suscripción, cancelar y volver a suscribirse resetea el contador y la regla no limita nada — es
   el mismo razonamiento con que `DEC-SUB-004` contó la cuota de pausa.
2. **Se cuenta sobre pagos acreditados, nunca sobre fechas.** Un período transcurrido no es un
   período pagado, y confundirlos es lo que abre el agujero de §5.
3. **El aviso es distinto.** A quien nunca pagó no se le dice *«tenés diez días para
   regularizar»*: se le dice que el cobro no entró y cómo volver a intentarlo. Prometer una
   ventana que no tiene es peor que no prometerla (cap. 15 §4.4).

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

Y no es una decisión dura, es la única coherente: **durante la pausa no hay servicio** — el §26.1
detiene publicación, edición y servicio. `DEC-SUB-009` sostiene el servicio hasta el fin del
período pagado, y acá **no queda servicio que sostener**.

La fecha de fin de servicio **es un dato nuestro** (`DEC-SUB-009`, implicación 3), así que la
fijamos: es el día de la cancelación.

### 7.3 El orden inverso no existe

Pausar estando en `CANCEL_SCHEDULED` **no es una transición de la máquina**: el §26 exige
`ACTIVE`, y la tabla del capítulo 03 §1 es exhaustiva —*lo que no está, no pasa*—. No hace falta
una regla: hace falta que nadie agregue esa transición.

---

## Lo que este capítulo NO cierra

- **`GR-3`**, la política de reintentos del proveedor, sigue `UNKNOWN`. **El diseño de §1 no la
  necesita**; lo que la medición va a cambiar es lo que se le explica a soporte.
- **Qué pasa si la fecha de un aumento cae sobre una suscripción en MORA** —no pausada— lo dejó
  abierto `DEC-MP-002` (implicación 6) y **sigue abierto**: el §6 resuelve la pausa, no el grace.
- **El detalle del cobro contra el proveedor** —el checkout, el `init_point`, la verificación por
  relectura— es del capítulo 13.
