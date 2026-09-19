---
title: "FASE 9 · R1 resuelto — el conjunto de vivos del UNIQUE"
linear: HOS-1352
statusSource: linear
created: 2026-09-19
updated: 2026-09-19
status: CURRENT
fase: 9
---

# FASE 9 · R1 resuelto — el conjunto de vivos del `UNIQUE`

`DEC-METH-004` exige dos cosas para declarar un racimo resuelto: que el camino de cada hallazgo,
reejecutado sobre el texto corregido, ya no llegue, **y** que la regla corregida se verifique
contra todo el dominio que cuantifica. El de R1 está enumerado en
[`00-dominios-de-los-racimos.md`](./00-dominios-de-los-racimos.md) §R1: **90 pares** — 9 estados ×
10 caminos que piden una segunda fila principal. Acá están los 90 recorridos, los ocho caminos
reejecutados, y lo que R1 **no** puede cerrar.

**Este documento no aplica ningún cambio.** No edita el PDR, ni el decision log, ni ningún
capítulo. Es la resolución escrita y verificada: qué candado queda, qué estados entran y por qué,
qué lo reemplaza donde se afloja, y contra qué se verificó cada afirmación.

**El resultado en una línea.** El conjunto de «vivos» no estaba mal por un estado de más ni por uno
de menos: **a la clave le faltaba un eje**. Los seis vivos se quedan como están; lo que cambia es
que la clave distingue una fila **de origen** de una fila **sucesora**, y que dos de los nueve
estados estaban mal modelados —uno es el destino equivocado de una muerte, el otro es una marca
disfrazada de estado—. De los 90 pares, **85 cierran y 5 quedan abiertos**; los 6 que la FASE 8
probó fallando cierran los 6; y **`F-8B3-002` sigue llegando entero**, porque su candado depende
de un capítulo que no existe.

**Advertencia de sujeto.** Acá se toca **un solo** `UNIQUE(user_id, vertical)`: el de
`subscription` (`B/02` §2.2). El otro —el del **trial**, en `V/02` §2.2— lo resolvió `R3`
decidiendo que **no se toca** y que `PRE_TRIAL` no tiene fila
([`03-R3-resuelto.md`](./03-R3-resuelto.md) §2). Ninguna línea de este documento lo mueve.

Los paths se abrevian como en el documento de dominios: `NUCLEO` es `HOS-1352-…/docs/nucleo/`, `V`
es `HOS-1353-verticales-capacidades-y-autorizacion/docs/`, `B` es
`HOS-1354-billing-cobro-y-proveedor/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

---

## 1. Qué candado queda

### 1.1 El diagnóstico, en una frase

> **Una sola clave estaba haciendo cumplir dos invariantes distintos** —«un compromiso comercial
> por vertical» y «una autorización de cobro por vertical»— **y el conjunto de estados era el
> proxy de los dos a la vez.** Por eso falla en las dos direcciones con el mismo mecanismo: lo que
> incluye de más bloquea un compromiso que todavía no existe, y lo que excluye de más libera una
> autorización que sigue viva.

El choque que el racimo nombra es literal y está entre dos textos aprobados:

- `NUCLEO/07-outbox-y-notificaciones.md` §5.3: *«el estado intermedio no es destructivo porque
  **las dos conviven** (`EX-6`)»*.
- `B/03-maquinas-de-estado.md` §3.3: *«dos vivas para el mismo `user + vertical` | es el §11. La
  condición está en S1, y el capítulo 05 la hace cumplir con una restricción de unicidad, no con
  un chequeo»*.

Y la medición le da la razón al primero: `EX-6` **`VERIFIED`** en producción —*«se llegó a SEIS
conviviendo, todas `authorized`, mismo `payer_email`»*—. Lo que el modelo local prohíbe
representar, el proveedor ya lo permite; y `DEC-SUB-006` implicación 1 lo **exige**: *«La
suscripción vieja se cancela al recibir el webhook de autorizada, NUNCA antes»*.

### 1.2 La restricción resultante

**El compromiso y la sucesión son dos cosas, y se escriben como dos claves.** `subscription` gana
una columna, `sucede_a` (FK anulable a `subscription`), y el `UNIQUE` del §11 se parte en dos
índices parciales sobre **las mismas columnas** y **el mismo conjunto de estados**:

```
-- A · el compromiso: a lo sumo UNA fila principal de origen viva por user + vertical
UNIQUE (user_id, vertical)
  WHERE clase = principal
    AND sucede_a IS NULL
    AND estado ∈ {vivos}

-- B · la sucesión: a lo sumo UNA fila principal sucesora viva por user + vertical
UNIQUE (user_id, vertical)
  WHERE clase = principal
    AND sucede_a IS NOT NULL
    AND estado ∈ {vivos}
```

**El máximo de filas principales vivas por `user + vertical` pasa de una a dos, y no a un número
abierto.** Dos, exactamente: un origen y su única sucesora. Es el número que `DEC-SUB-006` pide y
ni uno más — que es la diferencia entre esta salida y la que `F-8B1-001` descarta por escrito
(*«sacar `PENDING_AUTHORIZATION` de la lista de vivos, y entonces nada impide una tercera, una
cuarta y una décima creación simultánea, que es lo que `DEC-CONC-001` fue a evitar»*).

Y una sucesión no es una cadena. Al indexar `B` sobre `(user_id, vertical)` —y no sobre
`sucede_a`— una sucesora no puede ser sucedida mientras viva, sin ninguna regla extra: la segunda
sucesora colisiona con la primera.

### 1.3 El conjunto de estados: los seis se quedan

**Los «vivos» siguen siendo los mismos seis de `B/02` §2.2**, y conviene decirlo porque es lo que
más se parece a un arreglo y no lo es:

| estado | ¿vivo? | motivo de la inclusión o la exclusión |
|---|---|---|
| `PENDING_AUTHORIZATION` | **vivo** | ocupa la ventana: `B/03` §3.4.4, *«se reusa la vigente»* |
| `ABANDONED` | no vivo | `S3` **canceló el preapproval**: no hay autorización que cobre |
| `ACTIVE` | **vivo** | tiene servicio y una autorización que cobra |
| `GRACE_PERIOD` | **vivo** | servicio entero (§20) y el proveedor sigue reciclando la cuota (`B/12` §1.3) |
| `PAUSED` | **vivo** | el preapproval existe y es reanudable; `EX-11` mide que **sólo** admite cancelar |
| `SUSPENDED` | **vivo** | período impago y autorización de estado indeterminado — ver §1.4 |
| `CANCEL_SCHEDULED` | **vivo** | sostiene servicio hasta el fin del período (`DEC-SUB-009`) — ver §1.5 |
| `CANCELLED` | no vivo | terminado; `B/03` §3.3: *«Una suscripción terminada no revive»* |
| `RECONCILIATION_REQUIRED` | — | **deja de ser un estado** — ver §1.6 |

Lo que cambia son **dos modelados**, no el conjunto.

### 1.4 Por exceso · `SUSPENDED` se queda, y el caso que lo pedía deja de pasar por ahí

`F-8B2-008` lee que `SUSPENDED` bloquea el reintento que `B/12` §4.4 exige. La lectura del camino
es correcta; la conclusión —sacar `SUSPENDED` de los vivos— no, porque hay **dos muertes distintas
compartiendo ese estado**, y el propio capítulo ya lo dice.

`B/12` §4.4, medido en producción el 2026-09-17, sobre un **primer** cobro rechazado:

> el proveedor **cancela la suscripción en el mismo instante** en que manda la cuota a `recycling`
> —los dos hechos comparten el milisegundo, `19:12:34.583` y `19:12:34.745`— y esa cancelación es
> **terminal**: `PUT {status:"authorized"}` devuelve
> `400 "Invalid transition from cancelled to authorized"`.

Y saca la consecuencia sin cambiar el destino:

> **Entonces no hay suscripción que suspender**, y la regla de §4.3 se refuerza en vez de
> contradecirse: un primer cobro rechazado **no es una suscripción con un problema, es un alta que
> no ocurrió**.

El mismo §4.4, punto 2, **declara el residuo y no lo resuelve**:

> El capítulo 03 necesita distinguir dos muertes que hoy comparten estado. `ABANDONED` dice *«nadie
> autorizó en 72 h»*; esto es *«intentó y lo rechazaron»*. Le decimos cosas distintas al cliente en
> cada caso, así que **no pueden compartir nombre**. Queda anotado como el residuo de este
> capítulo, no resuelto acá.

**R1 cierra ese residuo, porque es el residuo lo que rompe el candado.** El primer cobro rechazado
va a un estado propio, **terminal y no vivo**:

> **`CHARGE_DECLINED`** — autorizó y el **primer** cobro se rechazó, para un `user + vertical` sin
> ningún pago acreditado. El proveedor ya canceló el preapproval de forma terminal. No hay
> servicio, no hay autorización, y no hay vuelta: el reintento es un alta nueva (`B/12` §4.4,
> punto 1).

**Y el conteo de estados no se mueve: siguen siendo nueve.** Entra `CHARGE_DECLINED` y sale
`RECONCILIATION_REQUIRED` (§1.6), así que *«Los nueve estados»* de `B/03` §3.1 y el *«son nueve»*
de `NUCLEO/03` §1 quedan literalmente ciertos.

Con eso, `SUSPENDED` vuelve a significar una sola cosa —**alguien que pagó alguna vez y dejó de
pagar**, que es la política de retención que el §20 describe— y ahí bloquear **es lo correcto**: su
preapproval puede seguir vivo, y una segunda suscripción serían dos cobros. Su salida no es el
candado: es pagar (`S7`), que el proveedor la dé de baja y la espejemos (`B/12` §1.4), o que la
cancele una persona.

### 1.5 `CANCEL_SCHEDULED` no se afloja: se le da la puerta que el diseño ya le prometía

Es el bloque de diez pares que **nadie había mirado** y que falla por la misma razón que el eje.
`B/03` §3.3 dice textual:

> `CANCEL_SCHEDULED` → `ACTIVE` | arrepentirse **no es una transición: es una suscripción nueva**.
> `DEC-SUB-009` cancela en el proveedor de inmediato y cancelar allá es irreversible (`PA-5`), así
> que volver exige recrear y volver a autorizar.

Una suscripción nueva con una `CANCEL_SCHEDULED` viva es exactamente el `INSERT` que el §11
rechaza. **El arrepentimiento es una sucesión**, y entra por el candado `B` como el upgrade. No
hay riesgo de doble cobro: `S11` ya canceló el preapproval de la predecesora *«de inmediato»*, así
que la única autorización que puede cobrar es la de la sucesora.

### 1.6 Por defecto · `RECONCILIATION_REQUIRED` deja de ser un estado

La exclusión está escrita con su razón, en `B/02` §2.2:

> Quedan afuera `ABANDONED`, `CANCELLED` y `RECONCILIATION_REQUIRED` — **el último a propósito**:
> si una suscripción necesita intervención humana, la persona tiene que poder contratar de nuevo
> sin esperar a que alguien resuelva un caso.

La razón es buena y el precio es un doble cobro: la fila sale de los vivos **con su preapproval
`authorized` intacto**, porque `S14` manda *«cero decisiones destructivas automáticas»*. `EX-6`
mide que el proveedor no frena la segunda. Los dos cobran.

**La salida no es reincorporarlo al conjunto: es dejar de modelarlo como un estado.** Lo que
`RECONCILIATION_REQUIRED` describe no es una situación de la suscripción, es una situación
**nuestra** —*«el sistema no puede decidir solo (§22.1)»*, `B/03` §3.1—, y escribirla en la columna
de estado **pisa** el estado real de la fila. Eso tiene tres consecuencias, y las tres son
hallazgos vivos:

1. el estado anterior se pierde, y `S15` —*«el estado que corresponda»*— tiene que adivinarlo;
2. la fila deja de cubrir a alguien que sí estaba cubierto: **convertir una `ACTIVE` en
   `RECONCILIATION_REQUIRED` es, textualmente, una decisión destructiva automática**, que es lo
   que el mismo §22.1 prohíbe;
3. el candado deja de ver una autorización que sigue viva.

Entonces:

> **`requiere_conciliación` es una marca booleana sobre la fila, no un estado.** La fila **conserva
> el estado que tenía**; `S14` deja de ser una transición y pasa a ser *«se pone la marca y se
> emite el evento crítico del §22.1»*; `S15` deja de ser *«el estado que corresponda»* y pasa a ser
> *«se levanta la marca, y si además corresponde un cambio de estado, se ejecuta la transición de
> esta misma tabla que lo permita»*.

**Qué reemplaza a la comodidad que la exclusión compraba.** Nada, porque deja de hacer falta: la
persona **no pierde el servicio** que tenía mientras una persona mira el caso, así que no necesita
contratar de nuevo. La exclusión resolvía un problema que la marca no crea.

**Y la marca sí bloquea algo, a propósito**: mientras esté puesta, **no se puede declarar una
sucesión** sobre esa fila. Cancelar y recrear con una divergencia de plata sin resolver es
exactamente el movimiento que `DEC-CONC-002` parte 4 manda que mire una persona.

### 1.7 Qué impide el doble cobro donde el candado se afloja

Es la pregunta que decide si esta resolución es mejor que el bug. Se afloja en **un** lugar —la
sucesora— y hay cuatro cosas en su lugar, todas ya decididas o medidas:

| qué se afloja | qué lo reemplaza |
|---|---|
| una sucesora `PENDING` convive con el origen | **candado `B`**: a lo sumo una, impuesta por la base |
| la sucesora podría cobrar mientras la vieja cobra | **`D8`**: fecha de primer cobro **futura** |
| esa fecha podría no respetarse | **`EX-33` `VERIFIED` en producción, tres de tres**: la respeta |
| las dos podrían quedar vivas para siempre | **`D7`** al webhook · **`S3`** a las 72 h · reconciliar |

Y en los otros dos lugares **no se afloja nada**, que es el punto:

- `SUSPENDED` sigue adentro; lo que cambió es que el alta que nunca cobró ya no llega ahí, y su
  preapproval está cancelado de forma **terminal**, medido.
- `CANCEL_SCHEDULED` sigue adentro; su sucesora entra por `B`, y su preapproval **ya está
  cancelado** por `S11`.
- `RECONCILIATION_REQUIRED` deja de liberar el candado: la fila conserva su estado y **lo ocupa**.
  Esto **endurece** el candado respecto de hoy — es la única dirección en que este documento lo
  aprieta, y es la que mata `F-8B1-002`.

### 1.8 Dos guards, que son la contracara de las dos claves

> **`G-R1-A` — ninguna fila con `sucede_a` no nulo apunta a una predecesora fuera de
> `{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`, ni a una que a su vez tenga `sucede_a` no nulo.**
> Es lo que impide declarar una sucesión desde una `SUSPENDED` (autorización de estado
> indeterminado) o desde una `PAUSED` (`EX-11`: el proveedor rechaza toda modificación).
>
> **`G-R1-B` — toda fila con `sucede_a` no nulo nace con fecha de primer cobro estrictamente
> futura.** Es `D8` hecho verificable en vez de recordable. Sin la columna que la guarde el guard
> no existe, y es el ítem 5 del §6.

---

## 2. Qué cambia, por archivo y §

Dieciocho cambios en ocho archivos. Tres de ellos son el choque entre documentos aprobados que el
racimo nombra, y se dice explícitamente **cuál de los dos lados se corrige y por qué ése**.

| # | archivo · § | qué cambia |
|---|---|---|
| 1 | `B/02` §2.2, `subscription` | se agrega la columna **`sucede_a`** (FK anulable a `subscription`) |
| 2 | `B/02` §2.2, restricciones | el `UNIQUE` único se parte en los **dos** índices parciales del §1.2 |
| 3 | `B/02` §2.2, los vivos | los seis se mantienen; la marca del §1.6 reemplaza a la exclusión de hoy |
| 4 | `B/02` §2.2, `subscription` | se agregan **`requiere_conciliación`** y la fecha de primer cobro |
| 5 | `B/02` §5, fila 8 | *«`UNIQUE` parcial sobre los vivos»* → **dos** restricciones parciales |
| 6 | `B/03` §3.1 | sale `RECONCILIATION_REQUIRED`, entra **`CHARGE_DECLINED`**; siguen siendo nueve |
| 7 | `B/03` §3.2, `S1` | *«no hay otra viva»* → *«no hay otro origen vivo, o declara una sucesión»* |
| 8 | `B/03` §3.2, `S14`/`S15` | dejan de ser transiciones: `S14` pone la marca, `S15` la levanta |
| 9 | `B/03` §3.2, nueva `S16` | `ACTIVE → CHARGE_DECLINED`: primer cobro rechazado sin pago previo |
| 10 | `B/03` §3.3, fila *«dos vivas»* | gana su excepción: **la sucesión**, con su cota de una |
| 11 | `B/03` §3.3, `CANCEL_SCHEDULED` | *«una suscripción nueva»*: **es una sucesión** (§1.5) |
| 12 | `B/03` §3.4, punto 4 | *«se reusa la vigente»* pasa a estar **impuesto por la base** |
| 13 | `B/05` §3, condición 3 | se reescribe sobre la sucesión (§2.2 de acá abajo) |
| 14 | `B/09` §3 | los terminales suman `CHARGE_DECLINED`; **una fila marcada no se barre** |
| 15 | `B/12` §4.3 | el primer cobro rechazado ya no va a `SUSPENDED`, va a `CHARGE_DECLINED` |
| 16 | `B/12` §4.4, punto 2 | el residuo declarado queda **cerrado** con el nombre propio |
| 17 | `B/14` §2.1 | *«cambiar de PLAN … sobrevive»* se **parte por dirección** (§2.1 de abajo) |
| 18 | `B/16` §4.2 | huérfano es *«llegó a `CANCELLED` **y no tiene sucesora**»* |

Y en el núcleo:

| # | archivo · § | qué cambia |
|---|---|---|
| 19 | `NUCLEO/01` §1.4 | *«Máximo una por User + Vertical»* gana la sucesión, con su cota |
| 20 | `NUCLEO/03` | el glosario de estados espeja los cambios 6 y 8 |
| 21 | `NUCLEO/04` §2.1, fila 8 | dos restricciones en vez de una |
| 22 | `NUCLEO/04` §3 | nuevo **`D15`**: *«una sucesión es un compromiso, no dos; a lo sumo una viva»* |

### 2.1 El choque de `F-8B2-005`: se corrige `B/14` §2.1, no `B/12` §2.2

Los dos textos:

- `B/12` §2.2, colisión 2: *«un upgrade | **muere con la suscripción vieja.** `DEC-SUB-007` ejecuta
  el upgrade cancelando y recreando, y la nueva nace sin cola»*.
- `B/14` §2.1: *«**cambiar de PLAN con el mismo ciclo** muta el monto y **la suscripción
  sobrevive** (`DEC-SUB-007`, `DEC-SUB-008`)»*.

**Se corrige `B/14` §2.1**, y el motivo no es de preferencia: `DEC-SUB-007` enumera tres
alternativas —*«(A) aceptar el upgrade gratis…; (B) cobrar la diferencia prorrateada…; (C)
**cancelar y recrear**»*— y **decide (C)**. `B/12` cita la decisión; `B/14` le atribuye el
mecanismo que la decisión descartó.

El error de `B/14` es tratable y chico: **mete las dos direcciones en una sola fila**. La
corrección las parte, y las dos mitades ya están decididas:

| dirección | mecanismo | decisión |
|---|---|---|
| **upgrade** | cancelar y recrear, con checkout | `DEC-SUB-007` (C) |
| **downgrade** | **muta el monto ya**, la fila sobrevive | `DEC-SUB-008`; `DEC-SUB-007` impl. 2 |

Con eso, `B/14` §2.2 —*«el contador de N cobros **sigue donde estaba**»*— conserva su veredicto y
cambia de mecanismo: en el downgrade porque la fila sobrevive, y en el upgrade porque **la
sucesora hereda** el contador. Sin esa herencia, el upgrade destruye la promo en silencio, que es
lo que el hallazgo llama *«la destrucción silenciosa de bienes pagados»*.

Y la misma herencia es lo que arregla `B/16` §4.2: un addon de scope `VERTICAL_SUBSCRIPTION` queda
huérfano cuando su suscripción llega a `CANCELLED` — y en un upgrade eso pasa **siempre**, con
`B/16` §4.3 cancelando el preapproval del addon *«de inmediato»*. La sucesión da la respuesta
natural —el addon se re-apunta a la sucesora— y `DEC-SUB-007` impl. 4 la deja explícitamente
abierta (*«hay que decidir si siguen colgando del cliente o si hay que re-vincularlos — es el hueco
`E-ADDON-04`»*), así que va al §6 como decisión del owner.

`B/10` §3.5 —*«si nada baja, sigue el camino de upgrade (`DEC-SUB-007`): inmediato»*— es compatible
con las dos lecturas y por eso no dirime; le alcanza con una palabra: **inmediato es el arranque
del checkout**, no la mutación del monto.

### 2.2 El choque del eje: se corrige `B/03` §3.3, no `NUCLEO/07` §5.3

`NUCLEO/07` §5.3 dice *«las dos conviven (`EX-6`)»* y `B/03` §3.3 dice que dos vivas no existen.
**Se corrige `B/03` §3.3**, por tres razones y ninguna es de jerarquía entre documentos:

1. `EX-6` es una **medición `VERIFIED` en producción** y `NUCLEO/07` la cita bien;
2. `D7` (`NUCLEO/04` §3) es un **invariante ya aprobado** que exige la convivencia;
3. `B/03` §3.3 no describe una política: describe **el efecto de la restricción**, y la
   restricción es justamente lo que este racimo recalibra.

La fila queda con su excepción escrita y acotada —*una sucesión declarada, a lo sumo una viva*—, y
así deja de contradecir al núcleo sin volverse una puerta abierta.

### 2.3 La condición 3 de `B/05` §3, reescrita

`F-8B2-001` paso 5 advierte que aflojar la restricción se lleva puesta la condición 3 de `B/05` §3
(*«no hay otra suscripción viva»*), que es la que impide que un pago tardío deje a alguien pagando
dos veces. La advertencia es correcta y la condición se reescribe sobre el eje nuevo:

> **3 · no hay otra fila principal del mismo `user + vertical` en un estado que dé título**
> —`ACTIVE`, `GRACE_PERIOD`, `PAUSED`, `CANCEL_SCHEDULED`—, **ni una sucesora de esta fila ya
> autorizada**. Una sucesora en `PENDING_AUTHORIZATION` no bloquea: todavía no puede cobrar
> (`D8`), y el pago tardío que reactiva a la predecesora es la evidencia de que la sucesión ya no
> hace falta.

Es más precisa que la de hoy, no más laxa: hoy lee *«viva»* contra un conjunto que excluye a
`RECONCILIATION_REQUIRED` —o sea que un pago tardío se considera **seguro de reactivar** aunque
haya otra `ACTIVE`, que es textualmente el caso que la condición existe para detener
(`F-8B1-002` paso 5)—. Con la marca, ese agujero desaparece sin tocar la condición.

---

## 3. Los caminos de los hallazgos, reejecutados

**Uno sigue llegando entero y va primero.** Los otros siete cortan, y seis de ellos cortan en un
paso mecánico —una fila que entra donde antes era rechazada, o al revés—.

### 3.1 `F-8B3-002` — SIGUE LLEGANDO, entero

*El candado contra el único doble cobro real no se puede construir.*

Su camino no toca ninguno de los cambios del §2, porque **no está en esta grilla**: es un segundo
candado, sobre otro eje y otras dos tablas.

| paso | ¿sigue llegando? |
|---|---|
| 1 · un anfitrión avisa que pagó por transferencia y un admin abre el registro manual | **sí** |
| 2 · en paralelo se acredita el cobro del proveedor para ese mismo período | **sí** |
| 3 · la defensa es `UNIQUE(subscription_id, período)` y **no hay columna de período** | **sí** |
| 4 · y aunque existiera, el registro manual vive en **otra tabla** | **sí** |
| 5 · queda sólo la relectura, *«para que el admin entienda»* y no como la red | **sí** |

**Llega hasta el final, sin un solo paso cortado.** El §5 dice por qué y hasta dónde se puede
llegar hoy.

### 3.2 `F-8B1-001` — corta en el paso 4

*La restricción hace inejecutable todo upgrade y todo cambio de ciclo.*

Paso 4 decía: *«Los dos estados están en la lista de «vivos», y las dos filas son de clase
principal, del mismo `user` y la misma `vertical`. **La restricción de la base rechaza el
`INSERT`**»*. La fila nueva nace con `sucede_a` apuntando a la vieja, así que **el candado `A` no
la ve** —su predicado exige `sucede_a IS NULL`— y el candado `B` está vacío. El `INSERT` entra.

Paso 5 —*«tampoco se cumple la condición de S1»*— cae con el cambio 7 del §2: `S1` pregunta por
otro **origen** vivo.

Y las tres salidas malas que el hallazgo enumera quedan descartadas por construcción: no se cancela
la vieja antes (`D7` intacto), `PENDING_AUTHORIZATION` **sigue** en los vivos, y la nueva **sigue**
siendo de clase principal.

### 3.3 `F-8B2-001` — corta en el paso 4

*La restricción del §11 vuelve imposible todo cambio de ciclo y todo upgrade.*

Mismo corte: paso 4, *«`INSERT` de la nueva → viola `UNIQUE(...)`, porque `PENDING_AUTHORIZATION`
**es** un estado vivo»*. Lo sigue siendo, y ya no alcanza para rechazar.

Su paso 5 es el que más importa, porque es la advertencia: *«Si en la implementación se resuelve
aflojando la restricción, se cae la condición 3 del capítulo 05 §3»*. **No se cae**: el §2.3 la
reescribe sobre el eje nuevo, y en la única dirección en que cambia, la endurece.

### 3.4 `F-8B3-001` — corta en el paso 3

*El `UNIQUE` de suscripción viva vuelve imposible el cambio de plan y de ciclo.*

Paso 3: *«Se intenta crear la nueva. Nace en `PENDING_AUTHORIZATION`, que está en la lista de
estados vivos, y la restricción parcial de unicidad la rechaza»*. Ya no: la fila declara sucesión.
Paso 4 —*«la transición S1 lleva además la misma condición»*— cae con el cambio 7.

De las tres salidas que el hallazgo enumera en su severidad, ésta es la tercera: *«aparece un
concepto de «reemplazo» que hoy no existe en el modelo»*. **No cae `D7` y no se excluye
`PENDING_AUTHORIZATION`**, que eran las otras dos.

### 3.5 `F-8B2-008` — corta en el paso 2

*`SUSPENDED` tras un primer cobro rechazado no tiene salida y bloquea el reintento.*

Paso 2 decía: *«Regla de §4.3: sin ningún pago acreditado para ese `user + vertical`, no hay
grace: va directo a `SUSPENDED`»*. Con el cambio 15, va a `CHARGE_DECLINED`, que **no es vivo**.

En cascada caen los tres pasos siguientes: el 4 (*«S7 pide que el cobro entre de verdad. No hay
preapproval que lo ejecute»*) deja de ser una trampa porque `CHARGE_DECLINED` es terminal y no
promete salida; el **5** —*«La restricción rechaza el alta: hay una viva en `SUSPENDED`»*— es el
paso que el racimo persigue, y **no llega**; el 6 (*«No queda transición»*) tampoco, porque no hay
nada que transicionar.

Y el residuo que el propio `B/12` §4.4 punto 2 declaraba —*«dos muertes que hoy comparten
estado»*— queda cerrado por el mismo movimiento.

### 3.6 `F-8B1-002` — corta en el paso 2

*`RECONCILIATION_REQUIRED` deja el preapproval vivo y habilita una segunda: dos cobros.*

Paso 2: *«El estado está deliberadamente **fuera** de la lista de vivos, así que la persona puede
contratar de nuevo»*. **No hay tal estado**: la fila conserva el suyo —`ACTIVE`, en su paso 1— y
el candado `A` la ve. El `INSERT` de la segunda se rechaza.

Paso 1 sobrevive entero y **debe sobrevivir**: el preapproval sigue `authorized` porque §22.1
prohíbe las decisiones destructivas automáticas, y eso no se toca. Lo que cambia es que esa
autorización viva ahora **ocupa** el candado en vez de liberarlo.

Paso 5 —*«la red que debería atajarlo está anulada por la misma definición»*— cae con el §2.3.

### 3.7 `F-8B2-002` — corta en el paso 2

*`RECONCILIATION_REQUIRED` es una trampa: se entra desde cualquiera y no se sale.*

Mismo paso 2: *«El capítulo 02 saca ese estado de los «vivos» a propósito»*. Ya no lo saca porque
ya no es un estado.

En cascada: el paso 3 (la segunda suscripción) no ocurre; el **paso 4** —*«S15 dice «el estado que
corresponda» … El `UPDATE` **falla**»*— desaparece con la redefinición de `S15`, que ya no elige un
estado sino que levanta una marca; el paso 5 (*«el único destino que la base acepta es
`CANCELLED`»*) desaparece con él; y el **paso 6** —*«el barrido la sigue leyendo … genera la misma
divergencia todos los días»*— lo corta el cambio 14: una fila marcada no se vuelve a barrer.

**Es el hallazgo que más se beneficia**, porque sus seis pasos caen con un solo cambio de modelado.

### 3.8 `F-8B2-005` — corta en el paso 3

*Dos capítulos de la misma épica discrepan sobre si un upgrade conserva la suscripción.*

Paso 3: *«**Leyendo el capítulo 14**: la suscripción sobrevive, la promo se recalcula … El addon no
se toca»*. Esa lectura deja de existir con el cambio 17: `B/14` §2.1 dice qué mecanismo va en cada
dirección, y para el upgrade dice el de `DEC-SUB-007`.

Paso 4 —*«Las dos lecturas son defendibles contra el texto. Quien implemente elige, y nada
falla»*— cae con ella: queda una sola lectura.

Paso 2 sigue siendo el camino real —el upgrade cancela y recrea— pero **su consecuencia deja de
serlo**: con el cambio 18, la predecesora sucedida no deja huérfano al addon. Queda pendiente la
decisión que `DEC-SUB-007` impl. 4 difirió, y está en el §6.

---

## 4. El dominio recorrido — los 90 casos

La pregunta de cada par, textual de `00-dominios-de-los-racimos.md` §R1 §6: *«si la fila que ya
existe está en este estado y llega este camino, ¿qué hace la base, y qué hace la condición de
`S1`?»*, y si ese resultado es el que el diseño quiere o el bloqueo de un camino que el diseño
declara en otro capítulo.

Los caminos, de `00-dominios…` §R1 §2: `C1` alta nueva · `C2` cambio de ciclo · `C3` upgrade · `C4`
reintento tras `ABANDONED` · `C5` reintento tras un primer cobro rechazado · `C6` recontratar tras
`CANCELLED` · `C7` re-autorizar tras la baja del proveedor por mora · `C8` arrepentirse de un
`CANCEL_SCHEDULED` · `C9` recontratar con una conciliación abierta · `C10` reintento dentro de la
ventana de `PENDING_AUTHORIZATION`.

Veredictos: **RECHAZA** (la base refuta el `INSERT` y es lo que el diseño quiere) · **ENTRA** (la
fila entra y es lo que el diseño quiere) · **SUCEDE** (entra por el candado `B`, como sucesora) ·
**OTRA FILA** (con una fila en ese estado, el camino no lo decide ésta; se responde en otro par) ·
**ABIERTO** (no hay regla escrita, o la que hay declara un destino que no existe).

### 4.1 La fila existente está en `PENDING_AUTHORIZATION` — 10 pares

| camino | qué hace la base | veredicto |
|---|---|---|
| C1 | candado `A` rechaza | **RECHAZA** — es `B/03` §3.4.4, *«no se crea otra, se reusa la vigente»* |
| C2 | no hay sucesión admitida desde `PENDING` (`G-R1-A`) | **ABIERTO** — ningún capítulo lo nombra |
| C3 | ídem | **ABIERTO** — ídem, con otro plan |
| C4 | candado `A` rechaza | **RECHAZA** — ya hay una ventana abierta; §3.4.4 manda reusarla |
| C5 | candado `A` rechaza | **RECHAZA** — la muerte anterior es `CHARGE_DECLINED`; ésta es la ventana |
| C6 | candado `A` rechaza | **RECHAZA** — ídem |
| C7 | candado `A` rechaza | **RECHAZA** — ídem |
| C8 | candado `B` rechaza la segunda sucesora | **RECHAZA** — el arrepentimiento ya está abierto |
| C9 | candado `A` rechaza | **OTRA FILA** — con la marca, la fila conservada es la que bloquea |
| C10 | candado `A` rechaza | **RECHAZA** — es el par donde la regla ya era correcta |

### 4.2 La fila existente está en `ABANDONED` — 10 pares

`ABANDONED` es invisible para las dos claves, y debe serlo: `S3` **canceló el preapproval en el
proveedor**, así que no hay autorización que pueda cobrar. Y `B/03` §3.3 lo declara: *«Volver a
intentar crea una fila nueva, con clave de idempotencia nueva»*.

| camino | qué hace la base | veredicto |
|---|---|---|
| C1 | no colisiona | **ENTRA** |
| C2 | no colisiona; la sucesión se declara sobre otra fila | **OTRA FILA** |
| C3 | ídem | **OTRA FILA** |
| C4 | no colisiona | **ENTRA** — el camino declarado en `B/03` §3.3 |
| C5 | no colisiona | **ENTRA** |
| C6 | no colisiona | **ENTRA** |
| C7 | no colisiona | **ENTRA** |
| C8 | la que bloquea es la `CANCEL_SCHEDULED` | **OTRA FILA** |
| C9 | la que bloquea es la fila marcada | **OTRA FILA** |
| C10 | la ventana ya venció: el camino es `C4` | **OTRA FILA** |

**La preocupación del bloque —*«nada impide la segunda, la tercera y la décima»*— se contesta
acá.** Nada impide la décima **en la historia**, y no hace falta: lo que hay que acotar es la
**simultaneidad**, y la acota el candado `A` sobre la `PENDING_AUTHORIZATION` que cada reintento
crea. Diez altas simultáneas dejan una fila viva; diez altas en serie dejan nueve filas muertas con
nueve preapprovals cancelados y una viva. El criterio `B3` de `descomposicion.md` sigue cumplido.

### 4.3 La fila existente está en `ACTIVE` — 10 pares

| camino | qué hace la base | veredicto |
|---|---|---|
| C1 | candado `A` rechaza | **RECHAZA** — es el §11 haciendo exactamente su trabajo |
| C2 | la nueva declara `sucede_a` y entra por `B` | **SUCEDE** — el eje del racimo, `DEC-SUB-006` |
| C3 | ídem | **SUCEDE** — `DEC-SUB-007` |
| C4 | candado `A` rechaza | **RECHAZA** — un checkout abandonado no revive con servicio activo |
| C5 | candado `A` rechaza | **RECHAZA** — si está `ACTIVE`, el cobro entró |
| C6 | candado `A` rechaza | **RECHAZA** |
| C7 | la baja del proveedor emite webhook (`EX-15`) y se espeja | **OTRA FILA** — `B/12` §1.4 |
| C8 | no coexisten dos orígenes | **OTRA FILA** |
| C9 | la fila marcada es ésta; conserva `ACTIVE` y bloquea | **RECHAZA** — es `F-8B1-002` cerrado |
| C10 | no hay ventana abierta con una `ACTIVE` de origen | **OTRA FILA** |

### 4.4 La fila existente está en `GRACE_PERIOD` — 10 pares

| camino | qué hace la base | veredicto |
|---|---|---|
| C1 | candado `A` rechaza | **RECHAZA** — tiene servicio entero (§20) |
| C2 | entra por `B` | **SUCEDE** — con la reserva de dinero del §6, ítem 6 |
| C3 | entra por `B` | **SUCEDE** — `DEC-SUB-003`, *«el camino de recuperación»* |
| C4 | candado `A` rechaza | **RECHAZA** |
| C5 | candado `A` rechaza | **RECHAZA** — hubo un pago acreditado antes; §4.3 no aplica |
| C6 | candado `A` rechaza | **RECHAZA** |
| C7 | se espeja a `CANCELLED` por webhook | **OTRA FILA** |
| C8 | no coexisten | **OTRA FILA** |
| C9 | conserva `GRACE_PERIOD` y bloquea; la marca congela `C2`/`C3` | **RECHAZA** |
| C10 | no hay ventana abierta | **OTRA FILA** |

**Un hallazgo del barrido, en `C2` y `C3`.** `DEC-SUB-003` los declara el camino de recuperación y
la sucesión los ejecuta — y de paso le regala a `DEC-SUB-003` la atomicidad que su implicación 1
exige (*«No puede quedar con el plan nuevo y el pago fallido»*): la sucesora sólo pasa a `ACTIVE`
con el webhook de autorizada, y si nadie autoriza muere a las 72 h dejando a la predecesora en
grace con su plan viejo, que es literalmente lo que la decisión pide. **Lo que no cierra es el
dinero**, y son los ítems 6 y 7 del §6.

### 4.5 La fila existente está en `PAUSED` — 10 pares

| camino | qué hace la base | veredicto |
|---|---|---|
| C1 | candado `A` rechaza | **RECHAZA** — el compromiso está vivo y el preapproval es reanudable |
| C2 | `G-R1-A` no admite sucesión desde `PAUSED` (`EX-11`) | **ABIERTO** — ver abajo |
| C3 | ídem | **ABIERTO** — ver abajo |
| C4 | candado `A` rechaza | **RECHAZA** |
| C5 | candado `A` rechaza | **RECHAZA** |
| C6 | candado `A` rechaza | **RECHAZA** |
| C7 | se espeja por webhook | **OTRA FILA** |
| C8 | `B/12` §7.3: pausar estando en `CANCEL_SCHEDULED` no existe | **OTRA FILA** |
| C9 | conserva `PAUSED` y bloquea; reanudar (`S10`) no es una sucesión y no se congela | **RECHAZA** |
| C10 | no hay ventana abierta | **OTRA FILA** |

**Por qué `C2` y `C3` quedan abiertos, y no es el candado.** `B/03` §3.3 declara el destino:
*«Todo cambio pedido durante la pausa **se encola y se aplica al reanudar**»*, apoyado en `EX-11`
(*«estando pausada el proveedor rechaza toda modificación»*, re-verificado en producción sobre
monto, frecuencia, `end_date` y volver a pausar). Pero la única cola que el diseño tiene es la de
`B/12` §2.1, y ese capítulo dice textual: *«Es una cola **nuestra, de entitlements**. No es una cola
de cambios en el proveedor — el proveedor no tiene ninguna»*, y `B/12` §2.2 enumera cuatro
colisiones que son todas de **descensos programados**. **Un cambio de ciclo o un upgrade no es un
descenso de entitlements: necesita un checkout**, y no hay dónde encolar un checkout. El diseño
declara un destino que no existe.

### 4.6 La fila existente está en `SUSPENDED` — 10 pares

| camino | qué hace la base | veredicto |
|---|---|---|
| C1 | candado `A` rechaza | **RECHAZA** — su autorización puede seguir viva: serían dos cobros |
| C2 | `G-R1-A` no admite sucesión desde `SUSPENDED` | **RECHAZA** — impago; `DEC-SUB-003` es grace |
| C3 | ídem | **RECHAZA** — ídem |
| C4 | candado `A` rechaza | **RECHAZA** |
| C5 | el alta que nunca cobró ya no llega acá | **OTRA FILA** — es `CHARGE_DECLINED`; el par, cerrado |
| C6 | candado `A` rechaza | **RECHAZA** |
| C7 | la baja del proveedor emite webhook y se espeja a `CANCELLED` | **OTRA FILA** — `B/12` §1.4 |
| C8 | no coexisten | **OTRA FILA** |
| C9 | conserva `SUSPENDED` y bloquea, igual que `C1` | **RECHAZA** |
| C10 | no hay ventana abierta | **OTRA FILA** |

**El par `(SUSPENDED, C1)` del hallazgo cierra por desplazamiento, no por permiso.** El cliente
cuya tarjeta rebotó en el primer cobro ya no está acá: está en `CHARGE_DECLINED`, y su alta nueva
entra. Quien sí queda en `SUSPENDED` es quien pagó antes y dejó de pagar, y a ése bloquearlo es lo
correcto.

**Y el abuso de `B/12` §4.2 queda cerrado dos veces.** El camino *«se suspende, cancela, vuelve a
suscribirse … diez días por ciclo, repetible»* lo cortaba la regla de §4.3 (sin pago acreditado, no
hay grace). Ahora lo corta además el estado: quien nunca pagó no llega a `SUSPENDED` y no tiene de
dónde reclamar un grace.

### 4.7 La fila existente está en `CANCEL_SCHEDULED` — 10 pares

Su preapproval **ya está cancelado** por `S11` (*«se cancela en el proveedor de inmediato»*,
`DEC-SUB-009`), así que ninguna de estas filas puede cobrar. Lo que sostiene es **servicio**, hasta
la fecha de fin que es *«un dato nuestro»*.

| camino | qué hace la base | veredicto |
|---|---|---|
| C1 | entra por `B`: volver es una sucesión | **SUCEDE** — `B/03` §3.3, *«es una suscripción nueva»* |
| C2 | entra por `B` | **SUCEDE** |
| C3 | entra por `B` | **SUCEDE** |
| C4 | entra por `B` | **SUCEDE** |
| C5 | entra por `B` | **SUCEDE** |
| C6 | entra por `B` | **SUCEDE** |
| C7 | se espeja por webhook a `CANCELLED`; después no colisiona | **OTRA FILA** |
| C8 | entra por `B` | **SUCEDE** — el camino que el capítulo declara y la base rechazaba |
| C9 | la marca congela la sucesión, la única puerta de esta fila | **ABIERTO** — §6, ítem 3 |
| C10 | no hay ventana abierta | **OTRA FILA** |

**Es el bloque de diez que nadie había mirado y que fallaba entero.** Nueve de sus diez caminos son
el mismo acto —volver a contratar con servicio residual— y la base los rechazaba a todos mientras
`B/03` §3.3 los declaraba el camino correcto.

### 4.8 La fila existente está en `CANCELLED` — 10 pares

Terminal e invisible para las dos claves. `B/03` §3.3: *«Una suscripción terminada no revive»*, y
`B/12` §4.2 usa exactamente esa propiedad (*«La restricción de unicidad del capítulo 02 no lo frena
—la anterior está `CANCELLED`, que no es un estado vivo—»*).

| camino | qué hace la base | veredicto |
|---|---|---|
| C1 | no colisiona | **ENTRA** |
| C2 | la sucesión se declara sobre otra fila | **OTRA FILA** |
| C3 | ídem | **OTRA FILA** |
| C4 | no colisiona | **ENTRA** |
| C5 | no colisiona | **ENTRA** |
| C6 | no colisiona | **ENTRA** — `B/12` §4.2, el camino declarado |
| C7 | no colisiona | **ENTRA** — es el re-alta de `B/12` §1.4, *«exige re-autorizar desde cero»* |
| C8 | la que bloquea es la `CANCEL_SCHEDULED` | **OTRA FILA** |
| C9 | la que bloquea es la fila marcada | **OTRA FILA** |
| C10 | no hay ventana abierta | **OTRA FILA** |

### 4.9 La fila existente está en `RECONCILIATION_REQUIRED` — 10 pares

**La fila-estado deja de existir**, así que cada par se responde por **el estado que la fila
conserva**, con la marca puesta. La marca no cambia ningún veredicto del candado: sólo **congela la
sucesión**.

| camino | qué hace la base | veredicto |
|---|---|---|
| C1 | el estado conservado ocupa el candado `A` | **RECHAZA** — es `F-8B1-002` paso 2, cortado |
| C2 | la marca congela la sucesión | **RECHAZA** — recrear con plata en disputa lo mira una persona |
| C3 | ídem | **RECHAZA** |
| C4 | el estado conservado bloquea | **RECHAZA** |
| C5 | ídem | **RECHAZA** |
| C6 | ídem | **RECHAZA** |
| C7 | si el proveedor dio de baja, `B/12` §1.4 espeja: no es divergencia, es un hecho suyo | **OTRA FILA** |
| C8 | si conserva `CANCEL_SCHEDULED`, es el par 4.7 · C9 | **OTRA FILA** |
| C9 | es el par de `F-8B2-002`: `S15` ya no elige estado, levanta la marca | **RECHAZA** — cortado |
| C10 | si conserva `PENDING_AUTHORIZATION`, es el par 4.1 · C10 | **OTRA FILA** |

### 4.10 Los 10 pares que la resolución crea — `CHARGE_DECLINED`

No son parte de los 90 y se recorren igual, porque un estado nuevo sin dominio recorrido es
exactamente lo que `DEC-METH-004` fue a impedir. `CHARGE_DECLINED` es **terminal y no vivo**, con
su preapproval cancelado de forma terminal y medida, así que es invisible para las dos claves —
igual que `CANCELLED`, y por el mismo motivo.

| camino | veredicto |
|---|---|
| C1 · C4 · C5 · C6 · C7 | **ENTRA** — *«una suscripción NUEVA, con id nuevo»* (`B/12` §4.4) |
| C2 · C3 · C8 · C9 · C10 | **OTRA FILA** — la que bloquea, si hay alguna, está en otro estado |

Y la asimetría con `ABANDONED` queda escrita, que era el pedido de `B/12` §4.4 punto 2: a un
`ABANDONED` se le dice *«nadie autorizó en 72 h»*; a un `CHARGE_DECLINED`, *«tu tarjeta rechazó el
cobro; volvé a empezar»*.

### 4.11 El recuento

| bloque | pares | cierran | abiertos |
|---|---|---|---|
| `PENDING_AUTHORIZATION` × C1…C10 | 10 | 8 | **2** |
| `ABANDONED` × C1…C10 | 10 | 10 | 0 |
| `ACTIVE` × C1…C10 | 10 | 10 | 0 |
| `GRACE_PERIOD` × C1…C10 | 10 | 10 | 0 |
| `PAUSED` × C1…C10 | 10 | 8 | **2** |
| `SUSPENDED` × C1…C10 | 10 | 10 | 0 |
| `CANCEL_SCHEDULED` × C1…C10 | 10 | 9 | **1** |
| `CANCELLED` × C1…C10 | 10 | 10 | 0 |
| `RECONCILIATION_REQUIRED` × C1…C10 | 10 | 10 | 0 |
| **total del dominio declarado** | **90** | **85** | **5** |
| *(adenda)* `CHARGE_DECLINED` × C1…C10 | 10 | 10 | 0 |

**Los 6 pares que la FASE 8 probó fallando cierran los 6**: `(ACTIVE, C2)`, `(ACTIVE, C3)`,
`(SUSPENDED, C5)`, `(SUSPENDED, C1)`, `(RECONCILIATION_REQUIRED, C1)` y
`(RECONCILIATION_REQUIRED, C9)`.

**De los 84 que nadie había mirado, 79 cierran y 5 quedan abiertos**, y los cinco son **tres
huecos**, no cinco:

| hueco | pares | qué es |
|---|---|---|
| cambiar de plan o de ciclo **antes de autorizar** | `PA`×C2, `PA`×C3 | ningún capítulo lo nombra |
| cambiar de plan o de ciclo **durante una pausa** | `PS`×C2, `PS`×C3 | *«se encola»*, y no hay esa cola |
| volver con una conciliación abierta y el servicio venciendo | `CS`×C9 | congela su única puerta |

Y el barrido de los 84 dejó **cuatro hallazgos que ningún informe de FASE 8 tenía**: el bloque
entero de `CANCEL_SCHEDULED` (§4.7, nueve de diez caminos rechazados contra el texto de `B/03`
§3.3), los dos huecos de arriba, y el cruce de dinero de `GRACE_PERIOD` × sucesión (§4.4, ítems 6 y
7 del §6). Es lo que `DEC-METH-004` compró al exigir el dominio entero en vez del caso que motivó
la regla.

---

## 5. El segundo candado, y por qué no se puede cerrar hoy

`F-8B3-002` es el único crítico del racimo que **sigue llegando entero**, y no por falta de
resolución: por falta de capítulo.

El candado declarado, `B/05` §2, `C5`:

> Es el único de los seis que produce un doble cobro con dinero real, y por eso es el único que se
> lleva a la base: **`UNIQUE(subscription_id, período) WHERE el pago está acreditado`**. (…) La
> restricción es la red; la relectura es para que el admin entienda lo que pasó en vez de ver un
> error.

**Tiene dos impedimentos, y ninguno se arregla con una decisión de diseño.**

**1 · La columna `período` no existe, y no se puede derivar.** `B/02` §2.3 enumera lo que `payment`
guarda: *«suscripción, monto, moneda, estado del cap. 03 §6, **id del hecho en el proveedor**,
fecha del hecho, monto reembolsado acumulado»*. La fecha del hecho no determina el período: el
cobro del ciclo llega tarde —`PA-3` mide entre 26 y 44 minutos, y `EX-16` mide que
`/authorized_payments` llega más tarde todavía— y se cobra por adelantado. **Quién define un
período de cobro es el capítulo 13, que no está escrito**, y `00-dominios-de-los-racimos.md` ya lo
declara: *«Este dominio hoy no se puede cerrar»*.

**2 · Las dos filas viven en dos tablas.** `manual_payment` guarda *«suscripción, estado del cap.
03 §7, quién lo registró, cuándo, comprobante»* (`B/02` §2.3) — **sin monto**. Una restricción de
unicidad no abarca dos tablas, y ni siquiera se podrían comparar los importes.

**Hasta dónde llega R1.** Tres cosas, y ninguna es el candado:

1. **Queda dicho que el candado no existe hoy**, en vez de figurar en un capítulo como si existiera.
   `B/02` §5 —*«Las restricciones que sostienen los invariantes»*— **no lo incluye**, y esa omisión
   es hoy la única señal de que falta. Debe volverse explícita.
2. **Queda nombrada la forma que va a tener**, para que el capítulo 13 la escriba y no la invente:
   una columna de período en el lado del dinero, y **las dos filas en una sola tabla con método de
   pago**, o un candado que no sea de unicidad. `F-8B3-002` lo marca como lo único que necesita
   decisión del owner: *«sí si la salida es unificar `payment` y `manual_payment` en una sola tabla
   con método de pago, porque eso cambia el modelo»*.
3. **Queda dicho qué lo sostiene mientras tanto, y es una persona**: `D11` (`NUCLEO/04` §3), *«Lo
   que toca plata lo confirma una persona»*, más la relectura previa a `AWAITING → REGISTERED` que
   `B/05` §2 ya exige. **Es una mitigación, no la red**, y el propio capítulo lo dice.

**R1 no lo cierra y no lo puede cerrar.** Lo que sí hace es no dejarlo confundido con el candado
que sí resolvió: son dos claves, sobre dos ejes, con dos sujetos distintos, y el racimo las agrupó
por consecuencia —las dos son doble cobro— y no por mecanismo.

---

## 6. Qué requiere decisión del owner

**1 · La sucesión es un apartamiento declarado del invariante 8 del §64 · costo bajo, riesgo bajo.**
El §11 dice *«máximo una suscripción principal por vertical»* y con la sucesión el máximo de filas
vivas pasa a dos. El invariante no cambia de política —sigue habiendo **un** compromiso— pero su
enunciado deja de ser literal sobre las filas. El PDR no se edita (regla 1), así que esto pide una
entrada nueva en el decision log, como `DEC-ARCH-003`, `DEC-OBS-001` y `DEC-METH-004`. **Costo**: una
decisión escrita. **Riesgo si no se declara**: alguien lee el §64 y «arregla» el índice de vuelta.

**2 · `RECONCILIATION_REQUIRED` deja de ser un estado · costo medio, riesgo bajo.**
Es el cambio que más texto toca (`B/02` §2.2, `B/03` §3.1/§3.2, `B/09` §3, `NUCLEO/03`) y el que
mata dos críticos de una. Pero **contradice una razón que el owner escribió** —*«la persona tiene
que poder contratar de nuevo sin esperar a que alguien resuelva un caso»*—, así que se ratifica, no
se aplica solo. La alternativa es dejarlo estado y **meterlo** en los vivos: cuesta lo mismo en
seguridad y le cobra al cliente la espera, que es lo que la razón original quería evitar. **Se
recomienda la marca**, porque le devuelve el servicio en vez de quitárselo.

**3 · Qué hace una fila marcada cuya única puerta es la sucesión · costo bajo, riesgo medio.**
Es el par abierto `CANCEL_SCHEDULED` × C9. Con la marca puesta no puede volver, y su servicio vence
en una fecha conocida. Dos salidas: (a) la marca **no** congela la sucesión cuando la predecesora
está en `CANCEL_SCHEDULED` —su preapproval ya está cancelado, así que no puede haber doble cobro—;
(b) se congela igual y el vencimiento del servicio dispara un aviso a `SUPER_ADMIN` con plazo. **Se
recomienda (a)**, y es el único lugar donde la marca admite una excepción segura por medición.

**4 · Qué pasa con los addons y las promos de una fila sucedida · costo medio, riesgo alto si no se
decide.** `DEC-SUB-007` impl. 4 lo dejó explícitamente abierto (*«hay que decidir si siguen
colgando del cliente o si hay que re-vincularlos — es el hueco `E-ADDON-04`»*). Si no se decide, el
upgrade cancela en el proveedor, *de inmediato*, addons recurrentes que el cliente pagó (`B/16`
§4.3). **Se recomienda re-apuntar a la sucesora** —el objetivo no desapareció, se sucedió— con el
cambio 18 del §2, y lo mismo para el contador de N cobros de `B/14` §2.2.

**5 · La fecha de primer cobro de la sucesora necesita columna · costo bajo, riesgo alto.**
`D8` es hoy un invariante *de servicio* y es **la** precondición de seguridad de todo el mecanismo.
Sin guardarla no hay forma de verificarla ni de escribir `G-R1-B`, y su incumplimiento es
literalmente el doble cobro. **Se recomienda la columna.**

**6 · La sucesión desde `GRACE_PERIOD` choca con `D8` · costo bajo, riesgo medio.**
`B/12` §5.2 concluye que en grace **el crédito es cero** (*«el período en curso no se pagó»*), así
que la fecha de primer cobro de la sucesora cae **hoy**, y `D8` pide que sea **futura**. Las dos
reglas son correctas por separado. Salidas: (a) una fecha mínima de un día para toda sucesora; (b)
declarar que desde grace la precondición es otra, porque la predecesora **no va a cobrar** el
período en curso. **Se recomienda (a)**, que es uniforme y verificable por `G-R1-B`.

**7 · La deuda que `B/12` §5.3 dice no perseguir, el proveedor la persigue igual · costo bajo,
riesgo medio.** `§5.3` decide que el período impago *«no se compensa con el cobro nuevo ni se cobra
aparte»*, pero mientras la predecesora viva su cuota sigue en `recycling` (`B/12` §1.3, medido) y
puede entrar. Si entra dentro de las 72 h de la sucesión, el cliente paga la deuda que le
perdonamos. **Hay que decidir si al declarar una sucesión desde grace se cancela la predecesora en
el acto** —lo que contradice `D7`— **o si se acepta el cobro y se lo comunica**.

**8 · La renovación de la predecesora dentro de la ventana de 72 h · costo bajo, riesgo medio, y
pide una medición.** El crédito de `DEC-SUB-006` se computa al **crear** la sucesora; si la
predecesora renueva dentro de la ventana, el crédito quedó corto por un ciclo entero. Corregirlo
exige mover la fecha de una sucesora `pending`, y lo único medido es `EX-34`: **la fecha de una
suscripción viva es inmutable** — sobre una *autorizada*. **Sobre una `pending` nadie lo midió.**
Es una sonda de sandbox, sin costo, y hasta que exista la salida barata es ofrecer el cambio con
ventana corta cuando falten pocos días para la renovación.

**9 · `F-8B3-002` y el capítulo 13 · costo alto, riesgo alto, y no es de R1.**
El §5 dice hasta dónde llega. La decisión que lo destraba —unificar `payment` y `manual_payment` en
una tabla con método de pago, o no— **cambia el modelo**, y conviene tomarla antes de escribir el
capítulo 13, no después.

**10 · Los dos huecos que el barrido destapó y R1 no resuelve · costo bajo cada uno.**
Cambiar de plan o de ciclo **antes de autorizar** (§4.1) y **durante una pausa** (§4.5). El primero
no tiene ninguna regla escrita; el segundo tiene una regla escrita cuyo destino —una cola— no
existe para ese tipo de cambio. Los dos son de superficie más que de modelo, y los dos son
invisibles hoy porque nadie los había mirado.

---

## Lo que este documento NO decide

- **No reabre `DEC-ARCH-004` a `007` ni `DEC-SUB-006`/`007`.** El mecanismo de upgrade está
  decidido: la vieja y la nueva conviven, y la vieja se cancela al recibir el webhook de que la
  nueva quedó autorizada. Lo que acá se recalibra es **el candado**, para que la base pueda
  representar ese mecanismo.
- **No toca el `UNIQUE` del trial.** `R3` decidió que no se toca y que `PRE_TRIAL` no tiene fila;
  ninguna línea de acá lo mueve.
- **No contradice a `R2` ni a `R3`.** El contrato de cobertura no aparece en esta resolución: la
  fuente de tipo `SUSCRIPCIÓN` sigue transportando lo mismo, y lo único que cambia es **cuál** fila
  la origina durante una sucesión — que es una pregunta de resolución, no de transporte.
- **No cierra `F-8B3-002`.** Su dominio está declarado incerrable hoy y el §5 dice hasta dónde
  llega.
- **No aplica nada.** Ni el decision log, ni los capítulos, ni las sub-specs, ni los issues de
  Linear. El orden lo fija `DEC-METH-004`: las salidas 3 y 4 van al final, con el diseño ya firme.
- **No cierra los 5 pares abiertos declarándolos menores.** Dos de ellos son un capítulo que
  declara un destino inexistente, y el tercero es un cliente con servicio venciendo y sin puerta.
