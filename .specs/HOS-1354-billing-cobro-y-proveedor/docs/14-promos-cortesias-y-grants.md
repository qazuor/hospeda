---
title: Master Spec 14 — Promos, cortesías y grants
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-25
status: CURRENT
fase: 2
capitulo: 14
cierra:
  - A-PROMO-01
  - A-PROMO-02
  - E-PROMO-01
  - M-PROMO-02
---

# 14 · Promos, cortesías y grants

Los tres instrumentos aparecen juntos en el §36 como fuentes de entitlements, y el PDR los trata
como variantes de lo mismo. **No lo son, y toda la diferencia está en qué tocan:**

| instrumento | qué toca | con qué mecanismo |
|---|---|---|
| **promo de descuento** (§33) | el **monto** | se muta el monto en el proveedor (`DEC-MP-001`) |
| **cortesía temporal** (§34) | el **cobro** | se **pausa** en el proveedor y el servicio lo sostenemos nosotros (`DEC-GRANT-003`); **sólo sobre planes mensuales y en meses enteros** (§4.7, FASE 8 completa, `F-8CB1-001`) |
| **grant permanente** (§35) | la **obligación** | se cancela toda obligación de pago cubierta (§35.3, `DEC-GRANT-001`) |

Los cuatro huecos de este capítulo se contestan casi todos leyendo esa tabla.

---

## 1. El orden de aplicación y el piso · cierra `A-PROMO-01`

### 1.1 Dos descuentos apilables dan resultados distintos según el orden

El §31 declara `stackable` y el §33 admite **porcentaje** y **monto fijo**. Sobre una base de
ARS 1.000, un 20 % y ARS 100:

| orden | cuenta | resultado |
|---|---|---|
| **porcentaje primero** | 1.000 → 800 → 700 | **ARS 700** |
| monto fijo primero | 1.000 → 900 → 720 | ARS 720 |

Sin regla, el total depende del orden en que alguien iteró una lista.

### 1.2 La regla: todos los porcentuales primero, después todos los fijos

Y es determinista completa, porque **dentro de cada familia el orden no cambia nada**: los
porcentajes se multiplican y los fijos se suman, y las dos operaciones conmutan. Con dos reglas
—qué familia va primero, y nada más— el resultado queda fijo.

**Y el redondeo es uno, al final** (FASE 9 vuelta 2, `F-8V2B3-008`). Los montos son enteros en la
unidad mínima de la moneda (`B/02` §2.3), y dos porcentajes apilados dan fracciones de centavo.
La composición se calcula sin redondear sobre el precio en la unidad mínima, y **el resultado se
redondea una sola vez, hacia abajo**, a la unidad mínima. Así las dos operaciones siguen
conmutando, que con un redondeo por paso dejaba de ser cierto. **Con ese mismo cálculo derivan el
monto quien muta** —el canje, `S30`, el aumento de `DEC-MP-002`— **y quien compara** —el barrido
(`B/09` §3)—: si redondearan distinto, la divergencia de medio centavo sería permanente y abriría
`DIVERGENCIA_DE_MONTO` en el acto. Hacia abajo por la misma razón que el porcentaje va primero: a
favor del cliente.

**Va primero el porcentaje porque da el total más bajo**, o sea a favor del cliente. Es la misma
dirección que el capítulo 15 (épica de verticales) §2.4 eligió para los limits que no acumulan, y por la misma razón:
una composición que a veces castiga al que acumuló beneficios no se puede explicar.

### 1.3 El piso no es nuestro: es del proveedor, y está medido

`PC-2` **`VERIFIED`** (2026-09-15, sandbox y re-verificado en producción): el rango es **ARS 15 a
ARS 2.000.000**. Por debajo, `400 "Cannot pay an amount lower than $ 15.00"`; cero y negativo,
`400 "must be a positive number"`.

De ahí salen tres reglas, en orden:

1. **El monto compuesto se valida contra el rango ANTES de mutar**, nunca se descubre por el
   `400`. Una mutación rechazada deja al cliente pagando el precio entero **en silencio**, porque
   `EX-15` midió que mutar no emite webhook: no hay aviso que nos entere.
2. ~~**Si el resultado cae por debajo del piso, el descuento NO se aplica mutando el monto.** Se
   ejecuta con el mecanismo de la cortesía: **pausar en el proveedor y sostener el servicio de
   nuestro lado** (`DEC-GRANT-003`). Bajar al piso en vez de pausar le cobraría **ARS 15 por
   ciclo** a alguien a quien le dijimos que no iba a pagar.~~ **Si el resultado cae por debajo del
   piso, el canje —o el apilado— se RECHAZA al canjear, con el motivo en pantalla** (owner
   2026-09-25; FASE 9 completa, 4b; `B/19` §4 fila 7-bis). La redacción anterior mandaba ejecutarlo
   *«con el mecanismo de la cortesía»*, y no había transición que lo hiciera, no heredaba la
   restricción a planes mensuales y **no terminaba nunca**: el contador de la promo sólo baja con
   un cobro confirmado (§2.4) y en pausa no hay cobro. Bajar al piso sigue descartado: le cobraría
   **ARS 15 por ciclo** a alguien a quien le dijimos que no iba a pagar. **Lo gratis ya tiene sus
   dos instrumentos**: el trial y la cortesía. Como todo canje rechazado, **no se consume** (§3.4):
   la persona conserva el código. **Y el motivo en pantalla dice que el mínimo lo pone Mercado
   Pago, no nosotros** (owner 2026-09-25; FASE 9 completa, 9g; el texto, en `B/19` §4 fila 7-bis):
   el piso es del proveedor (`PC-2`), y sin decirlo el rechazo se lee como una regla nuestra.
3. ~~**Por lo tanto un descuento del 100 % no es un descuento: es una cortesía** por el período que
   dure. No hace falta mecanismo nuevo — hace falta reconocer que ya existe.~~ **Por lo tanto un
   descuento del 100 % no se canjea**: el resultado es cero, que el proveedor rechaza igual que el
   piso (`PC-2`). Si lo que se quiere regalar es un período, el instrumento es la cortesía (§4.7),
   que firma `SUPER_ADMIN` (4b).

---

## 2. Una promo en curso cuando cambia el plan · cierra `M-PROMO-02`

### 2.1 Las dos preguntas son distintas porque los dos cambios lo son

El §33 admite descuentos de *«N cobros»* y *«forever»*, y el PDR permite cambiar de plan (§27,
§28) y de ciclo (§19). **No son el mismo caso**, y el motivo no es de política sino de mecanismo:

- **bajar de plan** (downgrade) **muta el monto ya** y **la fila sobrevive** (`DEC-SUB-008`,
  `DEC-SUB-007` impl. 2);
- **subir de plan** (upgrade) **cancela y recrea** (`DEC-SUB-007`, alternativa C): la fila que
  llevaba la promo **es sucedida por otra**;
- **cambiar de CICLO cancela y recrea con una re-autorización en el checkout** (`DEC-SUB-006`):
  ídem.

> **El cambio de plan no tiene un solo mecanismo: tiene uno por dirección.** Decir *«cambiar de
> plan muta el monto y la suscripción sobrevive»*, sin distinguir, le atribuye al upgrade el
> mecanismo que `DEC-SUB-007` **descartó por escrito**: la decisión enumera tres alternativas
> —*«(A) aceptar el upgrade gratis…; (B) cobrar la diferencia prorrateada…; (C) cancelar y
> recrear»*— y **decide (C)**.

Y *«inmediato»* en `B/10` §3.5 —*«si nada baja, sigue el camino de upgrade: inmediato»*— significa
**el arranque del checkout**, no la mutación del monto.

### 2.2 Cambio de plan: ~~la promo sobrevive~~ la promo se pierde

> **FASE 8 completa, pendiente 7, owner 2026-09-25: las promos NO sobreviven a un cambio de
> plan.** La promo se dio sobre el plan en que estaba; si la persona cambia de plan —upgrade,
> downgrade o de ciclo (§2.3)—, **la promo se pierde**. Todo lo que la re-aplicaba sobre la
> sucesora queda tachado abajo.

**Qué pasa con la redención, mecanismo por mecanismo:**

- **en el upgrade y en el cambio de ciclo** —cancelar y recrear—, **`S18` NO re-apunta
  `promo_redemption.subscription_id`**: la redención se queda colgando de la predecesora, que
  termina `CANCELLED` (`B/03` §3.2, `B/02` §2.6). No es una escritura de `S18`: es la ausencia de
  una. La sucesora nace con el precio de lista, y ése es ahora el precio que corresponde;
- **en el downgrade** la fila sobrevive (`DEC-SUB-008`) y la redención sigue colgando de ella.
  ~~⚠️ **Qué la apaga ahí no está escrito** (ver *«lo que este capítulo NO cierra»*).~~ **La apaga
  ~~el acto que aplica el cambio programado~~ el pedido del downgrade** (`B/12` §2): escribe **`cobros_restantes = 0`** en la
  redención de la fila (`B/02` §2.4), que es la forma que el modelo ya tenía de decir *«sin
  descuento»*, y desde ahí el monto esperado del §2.4 ya no la resta (orquestador, FASE 8 completa,
  pendiente 8; **el pedido y no el acto**, FASE 9 completa, contradicción 1 de `03` §R6.5). ~~⚠️~~ ~~**Entre el pedido —cuando `DEC-SUB-008` muta el monto— y ese acto, la redención
  sigue con su contador**;~~ ~~qué monto espera el barrido en esa ventana no está escrito (*«lo que este
  capítulo NO cierra»*)~~ ~~**en esa ventana el monto esperado es el del plan NUEVO desde el pedido**, porque `DEC-SUB-008` muta el monto en el acto del pedido y deja para el fin del ciclo sólo los entitlements (FASE 8 completa, owner 2026-09-25; §2.4).~~
  **La promo se termina en el mismo acto en que `DEC-SUB-008` muta el monto**: ese acto escribe
  `cobros_restantes = 0` y muta al **precio de lista del plan nuevo**, sin promos. Así, entre el
  pedido y el acto que aplica los entitlements al fin del ciclo, el monto esperado es **el del
  plan nuevo, sin promos**, y el `transaction_amount` coincide. **Por qué se movió al pedido**:
  había dos lecturas del mismo instante —*«el del plan NUEVO desde el pedido»* acá y *«el del plan
  vigente»* en el §2.4, `B/12` §2 y `B/09` §3—, y la promo seguía viva según su contador hasta el
  acto, así que el monto esperado la restaba mientras la pantalla prometía *«el importe nuevo ya no
  lleva el descuento»* (`B/19` §4, fila 7); y en el acto *«`S30` no corre»*, así que si el monto
  del pedido llevaba la promo nadie la sacaba.
- **y en la vuelta del suspendido con tarjeta, aunque vuelva al MISMO plan** (owner 2026-09-25;
  FASE 9 completa, 3b): esa vuelta es una sucesión desde `SUSPENDED` (`G-R1-A`), así que la cierra
  `S18`, que no re-apunta la redención. **Se acepta y se dice** en el aviso de suspensión: *«si
  tenías una promo, al volver la perdés»* (`B/19` §4, fila 10). La razón de arriba —*«la promo se
  dio sobre el plan en que estaba»*— no aplica acá, porque la persona no cambia de plan; lo que
  aplica es que no regularizó (`DEC-SUB-021`). **Anotado para el futuro**: ver cómo mejorarlo.

**Y la persona NO puede volver a canjear el mismo código en la sucesora.** La redención no se
borra —queda sobre la predecesora— y `UNIQUE(promo_code_id, user_id)` (`B/02` §2.4) es por user,
no por suscripción: la regla del §31, *«Cada user: máximo un uso de cada código»*, sigue valiendo.
El código que perdió al cambiar de plan ya lo usó.

**Y se dice antes de confirmar el cambio**: *«si cambiás de plan, perdés tu promo»* (`B/19` §4,
fila 7).

| ~~tipo~~ | ~~qué pasa~~ |
|---|---|
| ~~**porcentual**~~ | ~~se **recalcula sobre el precio nuevo** — un porcentaje es una relación, no un importe~~ |
| ~~**monto fijo**~~ | ~~se traslada tal cual, sujeto al piso del §1.3~~ |
| ~~el contador de **N cobros** —`promo_redemption.cobros_restantes`, `B/02` §2.4 (corrección de diseño, FASE 8 completa, `F-8CB1-007`)—~~ | ~~**sigue donde estaba**: cambiar de plan no consume un cobro. Lo único que lo mueve es un cobro confirmado (§2.4)~~ |

~~**El veredicto es el mismo en las dos direcciones y el mecanismo no.** En el downgrade el contador
sigue donde estaba porque **la fila sobrevive**; en el upgrade, porque **la sucesora lo hereda**.
Sin esa herencia el upgrade destruiría la promo en silencio — que es exactamente la *«destrucción
silenciosa de bienes pagados»* que el rediseño del candado vino a cerrar. El objetivo de la promo
no desapareció: **se sucedió**.~~

~~**Y *«hereda»* nombra un resultado; el acto que lo produce es `S18`.** Hay que decirlo con esas
palabras porque la regla 1 del núcleo es terminante —*«lo que la tabla de transiciones no declara,
no pasa»*— y durante una tanda entera la herencia vivió sólo acá, en la prosa de este capítulo,
mientras `S18` enumeraba **tres** efectos y ninguno era la promo. Cómo se ejecuta:~~

1. ~~**`S18` re-apunta `promo_redemption.subscription_id` a la sucesora**, en el mismo acto en que
   escribe `sucedida_por` y re-apunta los complementos (`B/03` §3.2, `B/02` §2.6). La redención
   sigue siendo **una** —`UNIQUE(promo_code_id, user_id)` no se toca— y el contador de N cobros no
   se consume, porque no hubo cobro: `cobros_restantes` viaja con la fila sin tocarse (`B/02`
   §2.4).~~
2. ~~**El descuento se vuelve a aplicar sobre el monto de la sucesora**, con la regla de este mismo
   §: porcentual se **recalcula** sobre el precio nuevo, fijo se **traslada** sujeto al piso del
   §1.3. No es opcional: `DEC-MP-001` aplica el descuento **mutando el monto en el proveedor**, y
   ese monto vive en el preapproval de la predecesora, que `S17` acaba de cancelar. La sucesora
   nace con el precio de lista.~~
3. ~~**Y la mutación se verifica releyendo**, como toda mutación (`D5`, cap. 06). Es la única
   defensa que hay: mutar el monto **no emite webhook** (`EX-15`), el aviso del §29 no corre
   porque no hubo aumento de precio, y **el barrido no lo ve** — compara *«monto vigente contra
   `transaction_amount`»* (`B/09` §3) y los dos coinciden, porque el monto vigente de la sucesora
   **es** el de lista. La divergencia es contra lo pactado, no contra el proveedor, y ningún
   detector del diseño mira eso.~~

~~**Y vale igual cuando `S18` corre con la sucesora todavía en `PENDING_AUTHORIZATION`** —el
segundo camino del cierre, cuando la predecesora se murió sola: **son cinco**, por `S12`, por
`S16`, por el espejo de la baja decidida por el proveedor, **o porque ella misma pidió la baja
estando pausada (`S22`) o suspendida (`S23`)** (`B/03` §3.2 y §10.1)—.
Mutar el monto **sí funciona sobre un preapproval `pending`**: es el control de `EX-39`, que lo
midió al probar lo contrario para las fechas —`transaction_amount` 2000 → 2500, con
`last_modified` movido—. **Lo que no se puede mover son las fechas**, y el descuento no las toca.~~

### 2.3 Cambio de ciclo: ~~sobrevive sólo lo que se puede expresar sin convertir nada~~ la promo se pierde, como en todo cambio de plan

> **FASE 8 completa, pendiente 7, owner 2026-09-25**: el cambio de ciclo es un cambio de plan y
> **ninguna promo lo sobrevive**, tampoco la porcentual `forever` (§2.2). La tabla de abajo queda
> tachada; la pregunta del hueco —*«¿tres cobros en mensual pasando a anual significa tres
> años?»*— ya no se hace, porque la promo no llega al ciclo nuevo.

~~**Una promo sobrevive a un cambio de ciclo si y sólo si sus términos se pueden expresar en el
ciclo nuevo sin convertir nada.**~~

| ~~promo~~ | ~~¿sobrevive al cambio de ciclo?~~ | ~~por qué~~ |
|---|---|---|
| ~~**porcentual `forever`**~~ | ~~**sí**~~ | ~~*«20 % siempre»* significa exactamente lo mismo en cualquier ciclo~~ |
| ~~porcentual, **N cobros**~~ | ~~**no**~~ | ~~*«3 cobros»* son tres meses o **tres años** según el ciclo~~ |
| ~~monto fijo, N cobros~~ | ~~**no**~~ | ~~ídem~~ |
| ~~monto fijo, `forever`~~ | ~~**no**~~ | ~~ARS 100 sobre un cobro anual no es el beneficio que se pactó sobre uno mensual~~ |

~~Es lo que responde la pregunta del hueco —*«¿tres cobros en mensual pasando a anual significa tres
años?»*— sin elegir entre dos malas: **elegir cuál de los dos significa es inventar un término que
nadie pactó.** Si no se puede expresar, termina.~~

**Y se muestra antes de confirmar el cambio**, con el precio que va a pagar. El checkout de
`DEC-SUB-006` ya le muestra un importe concreto; lo que hay que agregar es que **ese importe ya no
lleva el descuento**, o el cliente lo descubre en el resumen de su tarjeta.

### 2.4 Cuándo termina una promo de «primer cobro» o de «N cobros»

> **Corrección de diseño, FASE 8 completa, `F-8CB1-007`.** El §33 pide descuentos de *«primer
> cobro»* y de *«N cobros»*, este capítulo hablaba de *«el contador de N cobros»* (§2.2) y **el
> modelo no tenía contador**: nada contaba cuántos cobros quedaban y nada restituía el precio, así
> que toda promo acotada se volvía `forever`.

**El contador es `promo_redemption.cobros_restantes`** (`B/02` §2.4): **nulo** es `forever`, **N > 0**
son N cobros con descuento por delante y **0** es agotado. Se inicializa al canjear con la duración
del código, y *«primer cobro»* es N = 1.

**Se decrementa UNA vez por cobro confirmado, y «confirmado» tiene una sola lectura**: un pago
`approved` **leído por id** (`B/09` §4), en el mismo acto que lo acredita. No lo mueven ~~ni un
cambio de plan (§2.2) ni~~ una cortesía (§4.2), porque ~~en ninguno de los dos~~ ahí no hay cobro.
Un cambio de plan tampoco lo mueve: **termina la promo** (§2.2; FASE 8 completa, pendiente 7,
owner 2026-09-25). **Y un cobro que salió sin el descuento tampoco**: el contador baja sólo si el
importe cobrado no pasa del monto esperado con esa promo aplicada (owner 2026-09-27, FASE 9 vuelta
2, `R20`, `F-8V2B3-001`). Si Juan canjea un 50 % minutos antes del lote y el registro del ciclo,
creado antes, cobra el precio entero, la promo sigue con su contador intacto para el ciclo que
viene, y la diferencia la marca el barrido con el motivo 24, `IMPORTE_COBRADO_DE_MÁS` (`B/09` §3,
`B/02` §2.5), que propone devolverla.

**Al llegar a 0 se muta el monto del preapproval ~~al precio completo~~ al monto sin esa promo,
recalculado con las que siguen vivas** (FASE 8 completa, pendiente 7, owner 2026-09-25), con la
misma regla de orden del §1.2 —porcentuales primero, fijos después—: *«700 y nunca 720»*. Sobre
el ejemplo del §1.1 —ARS 1.000 con un 20 % y ARS 100—, si se agota la fija el monto pasa a
**800**, y si se agota la porcentual pasa a **900**; con una sola promo, *«sin esa promo»* es el
precio completo. El proveedor lo permite
sobre una autorizada sin pedir consentimiento nuevo: `PC-1` lo midió (1500 → 2200 → 15 → 1500,
todos `200`, verificado por relectura, y re-verificado en producción) y `PC-3` confirma que la
suscripción sigue `authorized`. Como toda mutación, **se verifica releyendo** (`D5`, `B/06` §4.1):
mutar el monto **no emite webhook** (`EX-15`), así que la relectura es la única confirmación.

**Y el proveedor le escribe al pagador por su cuenta.** `CT-3` lo midió en producción: todo cambio
de monto dispara un correo de Mercado Pago que dice *«El vendedor Hospeda cambió el monto»*, y le
llega **a él y no a nosotros**. `DEC-MAIL-001` ya decidió qué se hace con eso, en sus dos puntos:

- **punto 1: nuestro correo NO bloquea la mutación** —bloquea sólo antes de cancelar—, así que la
  restitución corre aunque el correo falle;
- **punto 2: el correo del proveedor se ANTICIPA, no se desmiente.** Al canjear una promo acotada
  la persona tiene que saber **cuántos cobros lleva el descuento, qué monto paga después** y que
  cuando termine **va a recibir un correo del proveedor avisando el cambio de monto** (`B/19` §4,
  fila 7-bis). **Y se anticipa otra vez antes del último cobro con descuento**, con nuestro correo
  *«tu promo termina; desde el mes que viene pagás $X»* —$X es el monto sin esa promo, recalculado
  con las que siguen vivas—, transaccional (`NUCLEO/07` §6; FASE 8 completa, pendiente 7, owner
  2026-09-25). **Sale 7 días antes del último cobro con descuento, y el plazo es configurable**;
  **en una promo de «primer cobro» se unifica con el aviso del canje** (`B/19` §4, fila 7-bis),
  porque ahí el último cobro con descuento es el primero (FASE 8 completa, pendiente 8, owner
  2026-09-25).

**El monto esperado de una suscripción se deriva siempre, y no se guarda** (FASE 8 completa,
pendiente 7, owner 2026-09-25): es **el precio de su versión de plan menos las promos vivas según
su contador**, compuestas con la regla del §1.2. **Ese precio es el vigente de la versión, con los
aumentos de `DEC-MP-002` ya aplicados** (orquestador, FASE 8 completa, pendiente 8). **Y el
aumento de `DEC-MP-002` muta al monto esperado**, con la versión nueva: parte del precio de lista
y vuelve a restar las promos vivas según su contador (FASE 9 completa, matiz de `F-8CB1-016` en
`03` §R6.5: se deducía de que el reintento lo compara contra él, y ahora se dice). El barrido lo
compara con el `transaction_amount` **releído por id**; si no coinciden, ~~**reintenta la mutación
durante 3 días** —se cuenta por tiempo, no por corridas, como el reintento de una cancelación
nuestra (`B/09` §3)— y después abre la marca con motivo **`DIVERGENCIA_DE_MONTO`**~~ **depende de
quién abrió la divergencia** (orquestador, FASE 8 completa, pendiente 8, derivado de `DEC-CONC-002`
punto 4):

- **si la abrió una mutación NUESTRA** —`S30`, o un aumento de precio de `DEC-MP-002`—, **reintenta
  la mutación durante 3 días, contados desde esa transición** —**en un aumento, desde su fecha
  efectiva** (FASE 8 completa, owner 2026-09-25); por tiempo, no por corridas, como el
  reintento de una cancelación nuestra (`B/09` §3)— y después abre la marca con motivo
  **`DIVERGENCIA_DE_MONTO`**. Es el mismo argumento del 📌 del punto 4: terminar un acto nuestro ya
  decidido no es reparar una divergencia;
- **cualquier otra divergencia de monto abre `DIVERGENCIA_DE_MONTO` en el acto**, sin reintento: es
  una divergencia que nadie mandó, y el punto 4 la reserva a una persona.

**Entre el pedido de un downgrade y el acto que lo aplica, el monto esperado es el del plan
~~vigente~~ nuevo, sin promos** (FASE 8 completa, owner 2026-09-25; FASE 9 completa, contradicción 1
de `03` §R6.5: en esa ventana el plan vigente es el viejo, y el pedido ya mutó al nuevo; la promo
se termina en el pedido, §2.2).

**Sin columna nueva.**

**Si la promo se agota con la fila `PAUSED`, ese mes sale con descuento, y se acepta** (FASE 8
completa, pendiente 7, owner 2026-09-25). Sobre una pausada el proveedor rechaza toda modificación
(`EX-11`), así que la mutación falla: **se declara y no se encola nada**. **Y el barrido no compara
el monto de una fila `PAUSED`**, porque ese mes con descuento ya se aceptó, **ni el de una fila
cuyo preapproval la relectura ve `cancelled`** —la `CANCEL_SCHEDULED` y la `SUSPENDED` de tarjeta—,
que ya no se puede mutar (`B/09` §3; FASE 9 vuelta 2, `F-8V2B3-007`); **al reanudar, `S10` es
la transición desde la que corren los 3 días** del reintento (`B/03` §3.2; orquestador, FASE 8
completa, pendiente 8).

> ~~⚠️ **Tres cosas que esta corrección no cierra, declaradas.**~~ **Las tres cosas que esta
> corrección no cerraba quedaron cerradas por el owner el 2026-09-25** (FASE 8 completa, pendiente
> 7). ~~**Una**: con dos promos apiladas (§1.2), *«precio completo»* al agotarse una debería leerse
> como *«el monto sin ésta»*; este § no lo escribe.~~ **Una**: se lee así, y está escrito arriba.
> ~~**Dos**: si la mutación no se aplica, el barrido la ve por **`DIVERGENCIA_DE_MONTO`** (`B/09`
> §3) **sólo si el monto vigente de nuestra base ya refleja el contador en 0**, y cómo se deriva
> ese monto no está escrito acá.~~ **Dos**: el monto esperado se deriva, y el barrido reintenta 3
> días antes de marcar — **sólo sobre una mutación nuestra** desde la pendiente 8 (arriba). ~~**Tres**: sobre una fila `PAUSED` el proveedor rechaza toda modificación
> (`EX-11`), y qué pasa si una pausa entra entre el cobro y la mutación no está escrito.~~
> **Tres**: ese mes sale con descuento, y se acepta. La transición que ejecuta la restitución es
> de `B/03` (`S30`), por la regla 1 del núcleo. Lo que estas tres respuestas dejan abierto está en
> *«lo que este capítulo NO cierra»*.

### 2.5 El pagador manual no canjea promos de monto

**No hay promos para el pagador manual** (FASE 8 completa, pendiente 7, owner 2026-09-25). El
canje no se le ofrece (`B/19` §4, fila 7-bis). Es coherente con el mecanismo: la promo de
descuento toca el **monto** mutándolo en el proveedor (`DEC-MP-001`, la tabla de arriba del
capítulo), y el pagador manual **no tiene preapproval** (`B/05` §3) que mutar.

**Y la regla es sólo para las promos de monto** (FASE 8 completa, pendiente 8, owner 2026-09-25):
**la extensión de trial (§32) SÍ vale para el pagador manual**. No muta ningún monto, así que la
razón de arriba no la alcanza.

---

## 3. La extensión aplicada el día del vencimiento · cierra `E-PROMO-01`

### 3.1 Es una carrera y necesita regla escrita, no una implementación que gane por suerte

El §32 es terminante —*«Sólo válido durante `TRIAL_ACTIVE`. Nunca después. Backend debe
rechazar.»*— y no dice qué pasa el mismo día, mientras corre el proceso de expiración.

### 3.2 Gana el estado escrito, nunca la hora

**El canje vale si y sólo si la fila del trial sigue en `TRIAL_ACTIVE` en el instante de
escribir**, verificado con la concurrencia optimista del capítulo 05. **Y quien escribe es
verticales**: la fila de `trial` es suya, así que billing no la toca; el canje llama a
`extenderTrial(user, vertical, días, claveDeCanje)` (`12-contrato…` §4.1), verticales corre `T4`
dentro del lock de la máquina de trial con el techo ya aplicado (`V/11` §3) y contesta `ACEPTADA`
o `RECHAZADA(motivo)`, y **billing gasta el código sólo con `ACEPTADA`**; la clave de canje hace
idempotente el reintento (owner 2026-09-26, `G4-2`; FASE 9 vuelta 1, `F-8V1C1-009`).

- Un canje a las 23:59:59 del día del vencimiento, con el job todavía sin correr, **es válido**.
- Un canje después de que el job escribió `TRIAL_EXPIRED` **se rechaza**, aunque sea el mismo día.

**«Después» del §32 significa después del estado, no después de una hora.** Es la única lectura
que se puede verificar: la hora depende de cuándo corrió un job, y eso no es un hecho del dominio.

### 3.3 Y el job tiene la mitad que se olvida

**El job de vencimiento re-lee la fecha de fin dentro de su propia transacción**, no actúa sobre
la que leyó al armar el lote.

Sin eso, un job que selecciona *«los trials que vencen hoy»* y los procesa cinco minutos después
vence uno que, en el medio, se extendió diez días. El **evento** de T3 —*llega la fecha de fin*—
dejó de ocurrir, y la tabla del capítulo 03 §1 es exhaustiva: **lo que la tabla no declara no se
ejecuta.** T3 **no tiene ninguna otra condición**, así que la fecha releída es lo único que la
frena: si el job no la re-lee, nada más lo va a hacer.

### 3.4 Un canje rechazado no se consume

Igual que en el techo de extensiones (cap. 11 (épica de verticales) §3.3): la fila de canje no se escribe, y la persona
conserva el código. Cobrarle el canje por una carrera que perdió es castigarla por la hora a la
que corrió un proceso nuestro.

---

## 4. Cómo se combinan entre sí · cierra `A-PROMO-02`

### 4.1 `stackable` rige SÓLO entre promos

El §31 define `stackable` y `usableWhileAnotherPromoActive`, y los define **entre promos**. Las
otras combinaciones **no son configuración**: las determina el mecanismo de cada instrumento, y
volverlas configurables permitiría configurar un estado que el proveedor rechaza.

### 4.2 Promo de descuento + cortesía temporal

**Durante la cortesía el descuento no se aplica, y no hace falta que se aplique.**

La cortesía **pausa** la suscripción (`DEC-GRANT-003`), y `EX-11` **`VERIFIED`** midió que estando
pausada el proveedor **rechaza toda modificación**. O sea que mutar el monto ahí no es una
decisión: es imposible.

Y no hay pérdida, porque **no hay cobro que descontar**: mientras corre la cortesía no se cobra
nada. Entonces:

**el descuento se suspende con la cortesía y se reanuda al volver, con su contador intacto** —
ningún cobro ocurrió, así que ningún cobro se consumió. Y no hace falta una regla para eso: el
contador —`cobros_restantes`— sólo se decrementa con un cobro confirmado (§2.4).

### 4.3 Cortesía temporal + grant permanente

**Sobre un grant no se otorga cortesía**, y no es una restricción arbitraria: el §35.3 ordena
*«cancelar toda obligación de pago cubierta»*, así que **no queda nada que no cobrar**. Es la
misma forma que `DEC-GRANT-004` eligió para *«sobre una pausa no se otorga»*.

> **Y el predicado es *«un ANCLA VIVA en esa vertical»*, no *«el beneficiario tuvo un grant
> alguna vez»*.** La razón es la frase de arriba leída al pie: lo que impide la cortesía es que
> **no queda obligación de pago**, y sobre un grant **revocado** sí queda —el beneficiario volvió
> a suscribirse y volvió a pagar (`DEC-GRANT-001`: revocar *«no reanuda el débito viejo: hay que
> pedirle al cliente que autorice uno nuevo»*)—. Desde que la revocación se guarda
> (`permanent_grant.revocado_en`, `B/02` §2.4) el término tiene columna y esta condición se lee
> sola; escrita sin el adjetivo dejaba sin cortesía, para siempre, a quien alguna vez tuvo un
> grant. Es la regla 2 de `NUCLEO/01` §2.4 sobre el sujeto nuevo.
>
> **Y es *«ancla viva»* y no *«grant vivo»* porque la cortesía es por suscripción**
> (`DEC-GRANT-006`): lo que hay que saber es si **esa** vertical está cubierta por el grant, no si
> el instrumento existe. Un grant vivo anclado sólo en Gastronomía **no impide** una cortesía
> sobre la suscripción de Alojamiento, que el beneficiario sigue pagando.

**Y al revés: otorgar un grant termina cualquier cortesía vigente.** No es una pérdida — el grant
es estrictamente mejor y para siempre—, pero la confirmación del capítulo 08 §3.1 tiene que
decirlo, porque el estado en el proveedor cambia de `paused` a `cancelled` y el cliente va a
recibir el correo del proveedor por su cuenta (`EX-3`).

**Y lo mismo vale para la otra escritura que hace cubrir a un grant: anclarle una vertical nueva**
(`12-contrato…` §2.8). Una cortesía **pausa una suscripción concreta** y no lleva scope
(`DEC-GRANT-006`), así que la que termina es **la de la vertical que se ancla**, y termina porque
`S13` cancela esa suscripción. Las cortesías del beneficiario en las demás verticales **no las
toca nadie**: el acto alcanza una vertical, no la cartera. Se dice acá porque *«otorgar un grant»*
se lee como el único momento en que un grant empieza a cubrir, y desde que el scope es el conjunto
de anclas **son dos**. **Y los dos emiten el aviso de cobertura** (`12-contrato…` §3, *«quién emite»*; FASE 9
vuelta 2, `F-8V2C1-003`): cuando el beneficiario no tenía suscripción en la vertical que se ancla,
`S13` no mueve ninguna fila y el anclaje es la única escritura que puede avisar. Sin su aviso,
`PB3` esperaba al reconciliador, y `T2` no disparaba nunca: un trial en curso en esa vertical
seguía hasta `T3`, que le mandaba la campaña de recuperación a quien acababan de regalarle la
vertical.

#### Y sobre una cortesía DIFERIDA no hay suscripción que cancelar: lo que se cierra es el SALDO

**La regla de arriba cuantifica sobre *«cortesía vigente»*, y desde `DEC-GRANT-007` existe una que
no lo es.** Una **cortesía diferida** —`saldo_meses` no nulo y sin cerrar, `NUCLEO/01` §2.6— no
pausa nada: su suscripción está `CANCELLED` y **no emite ninguna fuente**. Así que el mecanismo que
la frase de arriba nombra —*«termina porque `S13` cancela esa suscripción»*— **no tiene sujeto**:
la suscripción que la pausaba ya está muerta, y la que iba a recibir el saldo todavía no existe o
`S13` la acaba de cancelar junto con las demás. **No es una elección entre políticas: es una regla
cuyo sujeto no existe**, sobre una población que `DEC-GRANT-007` creó el mismo día.

**Qué pasa entonces, y la respuesta sale de recorrer los dos caminos de re-emisión, no de
preferir.** `S9` sólo puede re-emitir un saldo por ~~**dos** rutas~~ **una** ruta (`B/03` §3.2): la del segundo
disparador —la cortesía apunta a una fila cuyo `sucedida_por` es **esta**— ~~y la del tercero —la
fila que apunta murió **por `S25`** y el beneficiario tiene otra en `ACTIVE` en la misma vertical—~~
(la del tercero salió con `S25`: revisión del owner, 2026-09-28, C8).
Si el saldo **sobreviviera** al grant, después de `S13` ~~**ninguna de las dos vuelve a matchear
nunca**~~ **esa ruta no vuelve a matchear nunca**: la sucesora que el `sucedida_por` nombra la canceló `S13` ~~, y la predecesora no murió por
`S25`~~. Tampoco lo levanta la **sexta** comprobación del `B/09` §3, que resuelve *«la fila que tenía
que recibirlo»* con esa misma pregunta. El saldo quedaría **sin dueño, sin vencimiento y sin
nadie que lo mire** — palabra por palabra la forma que `DEC-GRANT-011` descartó ese mismo día, y
que `B/16` §1.3 rechaza por escrito como *«un instrumento abierto sin fecha de cierre»*.

**Entonces el grant CIERRA el saldo, y el cierre se declara.** Se escriben `saldo_cerrado_en` y
`motivo_cierre = GRANT_PERMANENTE_OTORGADO` (`B/02` §2.4) sobre cada cortesía diferida del
beneficiario **en una vertical que el acto ancla** —el mismo alcance que `S13`, ni más ni menos— y
el efecto vive en `S13` porque es la transición que ya recorre ese conjunto (`B/03` §3.2). **Lo
mismo vale para anclarle una vertical nueva a un grant vivo**, que es el otro momento en que un
grant empieza a cubrir.

**Por qué esto no le saca nada a nadie, que es la objeción obvia.** Lo que el saldo sostiene son
~~días~~ meses **sin cobrar** (en meses desde la FASE 8 completa, `F-8CB1-001`), y el grant es
*«cancelar toda obligación de pago»* **para siempre** (§35.3): mientras el grant viva,
~~esos días~~ esos meses no valen nada porque no hay ningún cobro que evitar — es
exactamente el argumento con que este mismo § prohíbe **otorgar** una cortesía sobre un grant. Y si
el grant después se revoca, el desenlace es el que `DEC-TRIAL-009` ya fijó para el instrumento
hermano: **recibir el grant lo consume y la revocación no lo devuelve**, porque durante el grant la
persona **recibió la cobertura completa**. ~~La diferencia con `DEC-GRANT-010` —donde el saldo sí se
conserva— es esa y se puede leer al pie: allá **el regalo no empezó a entregarse** y quien lo
interrumpe somos nosotros retirando un servicio; acá se entregó, y de más.~~ (`DEC-GRANT-010` salió
con la revisión del owner, 2026-09-28, C8.)

**Y se declara en los dos lugares donde el acto se mira**: la confirmación de otorgar y la de
anclar lo dicen antes de firmar (`NUCLEO/08` §3.1, que cubre las dos, y `B/19` §4 fila 13-bis, que
es la del anclaje), porque quien firma
tiene que saber que está terminando una concesión de `SUPER_ADMIN` que todavía no se entregó; y
queda asentado en la fila, que es lo que `DEC-GRANT-008` pide de toda revocación. **Lo que no se
hace es cerrarlo en silencio**, que es la única lectura de este caso que sería indefendible.

### 4.4 Cortesía temporal + cambio de plan

**Una cortesía vigente sobrevive al cambio de plan, y NO lo hace re-apuntándose**
(`DEC-GRANT-007`, owner, 2026-09-21). `S18` la **cierra** sobre la predecesora y le escribe en
`courtesy_grant.saldo_meses` ~~los días~~ los meses que le quedaban (FASE 8 completa, `F-8CB1-001`;
la fracción de mes queda abierta, `B/02` §2.4); **`S9` la re-emite sobre la sucesora cuando
ésta autoriza** —o sea cuando llega a `ACTIVE`, que es exactamente el `desde` que `S9` ya tiene—,
re-apuntando ahí `subscription_id`, recalculando `inicio`/`fin` y volviendo el saldo a nulo.
**El `inicio` es el fin del crédito de `DEC-SUB-006` cuando la sucesora vive de él** (owner
2026-09-27, FASE 9 vuelta 2, `R17`, `F-8V2B1-004`): la cortesía arranca cuando se agota lo que la
persona ya pagó, y no corre encima de eso. La pausa se abre igual al autorizar, hasta ese `fin`, así
que cruza exactamente los cobros que la cortesía promete saltear
(`B/03` §3.2, `B/02` §2.4 y §2.6). El instrumento no desapareció — **la suscripción que pausaba se
sucedió**, y la cortesía la espera.

**Por qué re-apuntarla en el cierre no se podía ejecutar, que es el defecto que esto cierra.** El
mecanismo de la cortesía **es la pausa**: `DEC-GRANT-003` la implementa *«pausando en el proveedor
y sosteniendo el servicio de nuestro lado»*, así que re-apuntarla obligaba a dejar la sucesora
*«pausada con motivo `COURTESY`»* en el mismo acto. Y ahí los dos desenlaces le cobran:

- **el `hacia` de `S18` es *«el mismo estado»*** y **la única fila que llega a `PAUSED · COURTESY`
  es `S9`**, cuyo `desde` es `ACTIVE` (`B/03` §3.2). Sobre una sucesora en `PENDING_AUTHORIZATION`
  **no hay transición**, así que por la regla 1 del núcleo —*«lo que la tabla no declara, no
  pasa»*— el cierre del camino normal terminaba **en la marca**, o sea en un incidente sobre un
  cliente que no hizo nada mal;
- y si alguien lo implementaba **sin** pausar —que es lo que la celda de efectos decía, porque
  nombraba *«se re-apuntan»* y no *«se pausa»*—, la sucesora autorizaba, arrancaba el período y
  **cobraba**, con la cortesía encima. Una cortesía re-apuntada sobre una fila `ACTIVE` que sigue
  cobrando no es una cortesía: es
  una fila de base que no hace nada, que es el modo de falla que `B/16` §2.4 nombra para rechazar
  una columna.

**Por qué tampoco puede simplemente morirse con la predecesora**, que es lo que pasaba antes de
todo esto: `courtesy_grant.subscription_id` **no es anulable** y desde `DEC-GRANT-006` es **la única
referencia que la cortesía tiene** —se le retiró el `scope`—, así que una predecesora `CANCELLED`
deja la fila apuntando a algo que no emite fuente (`12-contrato…` §2.6). El beneficio que firmó
`SUPER_ADMIN` desaparece **en silencio**: el barrido no compara grants, la fila no queda marcada,
y el cliente se entera cuando le cobran. Y sin `scope` tampoco hay salida alternativa: reemitirla
exige un acto administrativo nuevo, que es *«la acción más grave del catálogo»* de la que alguien
se puede olvidar (`NUCLEO/08` §3). **El saldo es lo que resuelve las dos puntas**: la fila sigue
apuntando a la predecesora —referencia resoluble, `B/02` §2.4— y el beneficio no se pierde, porque
la re-emisión es un acto **del sistema** y no uno que alguien tenga que acordarse de hacer.

#### La población NO es vacía, y el corpus la enumera

**La versión anterior de este § afirmaba lo contrario y por eso el defecto duró dos tandas.**
Decía: *«acá `S18` siempre corre sobre una sucesora ya `ACTIVE` … el segundo camino de `S18` sale
de `S12` o de `S16`, y una predecesora con cortesía vigente está `PAUSED`, así que ninguna de las
dos la alcanza. No hay caso en que haya que pausar un preapproval que todavía no autorizó»*.
**Las tres cláusulas se caen, y cada una por su lado:**

1. **La enumeración era de dos caminos y hoy son cinco** —`S12`, `S16`, el espejo del §10.1, `S22`
   y `S23`—. El §2.2 de este mismo capítulo ya los corrigió a tres un commit después, **130 líneas
   más arriba**, y este párrafo quedó como estaba.
2. **El espejo sale de `PAUSED`.** Su `desde` es *«cualquier estado vivo que no sea
   `CANCEL_SCHEDULED`»* (`B/03` §10.1) y `PAUSED` es uno de los seis vivos (`B/02` §2.2); está
   medido que el proveedor **rechaza toda modificación sobre una pausada pero sí deja cancelar**
   (`EX-11`, `B/20` §3.2). Así que una predecesora pausada por cortesía **puede** llegar a `S18`
   con la sucesora todavía sin autorizar.
3. **Y `S17` también sale de `PAUSED`** —es uno de sus cinco `desde` alcanzables—, así que ni
   siquiera hace falta el espejo: en el camino **normal** la predecesora pausada por cortesía
   muere por `S17` y `S18` cierra.

**Cómo se llega, contado sobre la tabla que el propio `B/03` §3.2 ya publica.** `G-R1-A` sólo deja
declarar una sucesión desde ~~`{ACTIVE, GRACE_PERIOD, CANCEL_SCHEDULED}`~~ `{ACTIVE, CANCEL_SCHEDULED}` y desde una `SUSPENDED` de
pagador con tarjeta con el preapproval releído `cancelled` (`B/20` §2; FASE 8 completa,
`F-8CB1-002`; `GRACE_PERIOD` salió con `DEC-SUB-021`, owner 2026-09-25), así que la
predecesora **no está `PAUSED` cuando se declara** — está `ACTIVE`. Después, **dentro de la ventana
de autorización** —**72 h o 7 días corridos**, según el método de pago (`B/03` §3.4 punto 1)—,
`SUPER_ADMIN` otorga la cortesía: es la **fila 2** de la tabla de recorrido del `B/03`
§3.2, *«`ACTIVE` | `S9` — `SUPER_ADMIN` otorga cortesía | `PAUSED` | ¿sigue siendo fila viva? sí»*.
De ahí en más la sucesión sigue abierta sobre una predecesora pausada por cortesía, y termina por
`S17` (la sucesora autoriza) o por el espejo (el proveedor la da de baja). **La población está
enumerada en la tabla desde antes de que este § dijera que no existía.**

**Qué sí hay que decir sobre la pausa, ahora que entra por el lado correcto.** `S9` corre sobre la
sucesora **ya `ACTIVE`**, así que no choca con `EX-11` —que mide que el proveedor rechaza
modificaciones **estando ya pausada**— ni con la condición de `S9` (*«no hay pausa vigente»*),
porque una sucesora recién autorizada nació sin ninguna. **Y no se le pide al proveedor nada que
nadie haya medido**: pausar un preapproval `pending` no está en la matriz (`B/20` §3.2 tiene
`EX-11` para la pausada y `EX-39` para las fechas, y nada para una `pending`), y ésa es la razón
por la que `DEC-GRANT-007` descartó la alternativa de que la sucesora heredara la pausa.

> **El riesgo aceptado, dicho en voz alta.** Entre que la sucesora autoriza (`S2`) y que `S9`
> re-emite, **el proveedor puede cobrar el primer pago**. Ese cobro **se devuelve por el camino que
> ya existe** —la marca con motivo `COBRO_DURANTE_CORTESÍA` y la confirmación de una persona
> (`B/02` §2.5, `DEC-RF-002`)— y **no se inventa un mecanismo nuevo** para evitarlo. Se prefiere un
> cobro que se devuelve por una vía escrita antes que una pausa que quizá el proveedor no acepta.
>
> **Y si la re-emisión no ocurre, hay quién lo vea**: la **sexta** comprobación de cero llamadas
> del `B/09` §3 levanta la cortesía diferida cuya sucesora ya está `ACTIVE`. Sin ella el
> mecanismo nuevo tendría el mismo modo de falla silencioso que el viejo — *«el barrido no compara
> grants»*—, que es lo que este § pasó dos tandas describiendo.
>
> **Salvo si la sucesora ya cayó en `GRACE_PERIOD`**, que queda afuera a propósito (owner
> 2026-09-26, P1; FASE 9 vuelta 1): la comprobación la busca en `ACTIVE`, y sólo la pierde si `S9`
> no se ejecutó y además el primer cobro llegó antes del barrido, se rechazó y la predecesora venía
> pagando. Si la persona paga, la fila vuelve a `ACTIVE` y la comprobación la levanta; si termina
> suspendida, el saldo queda diferido y lo repara `SUPER_ADMIN` volviendo a otorgar la cortesía
> (`B/09` §3 y su *«lo que este capítulo NO cierra»*).

**Y no contradice `§4.3`**: allá la cortesía **termina** porque el grant cancela la suscripción y
*«no queda nada que no cobrar»*. Acá sí queda: la sucesora cobra, y es exactamente lo que la
cortesía existe para evitar por ~~los días~~ los meses que le quedan.

**Ni contradice a `S22`, que hace lo contrario con la misma cortesía.** Ahí la persona **pide la
baja** estando pausada y la cortesía *«termina con ella»* (`B/03` §3.2) — no se difiere, porque no
hay ninguna sucesora que la reciba y porque `DEC-GRANT-004` (1) ya eligió que **quien se va pierde
la cortesía que le quedaba, avisándole**. Diferir es para quien **sigue siendo cliente** con otro
plan; terminar es para quien deja de serlo.

### 4.5 Extensión de trial + cortesía durante el trial

**Ya está resuelto en el capítulo 11 (épica de verticales) §3**: las dos extienden, **acumulan contra un único techo**
configurable por `user + vertical`, la que no entra se rechaza entera sin consumir el promo, y el
techo ata al canje pero no a `SUPER_ADMIN`.

Se nombra acá porque el hueco lo listaba como tercera combinación, y para dejar escrito que **no
tiene regla propia**: es el mismo techo.

**Y la cortesía durante el trial no es un acto de billing ni cruza el contrato** (owner
2026-09-26, P2; FASE 9 vuelta 1). Es la acción administrativa *«extender un trial»* de
`NUCLEO/08` §3 —la misma que `V/11` §3.4 llama *«extensión firmada por `SUPER_ADMIN`»*—, y la
ejecuta verticales sobre su propia máquina: `T4` con origen `SUPER_ADMIN` y motivo obligatorio,
que pasa el techo y suma al total visible con su origen (`V/03` §2, `V/11` §3.4 y §3.5); la
construye **V4**. No es un `courtesy_grant` —su suscripción no es anulable (`B/02` §2.4) y un
trial no tiene suscripción— ni toca al proveedor (`DEC-GRANT-003` impl. 4). **`extenderTrial`
sigue siendo sólo del canje** (`12-contrato…` §4.1): billing no la llama para esto y no le pasa
ningún origen, así que el techo no se puede saltear por un parámetro que venga de este lado. La
palabra *«cortesía»* queda repartida entre las dos épicas: **la temporal, en meses, es de
billing** (§4.7); **la del trial, en días, es de verticales**.

### ~~4.6 Cortesía temporal + la vertical que se discontinúa~~

~~Una cortesía pausaba un plan que dejaba de prestarse porque la vertical se discontinuaba: `S25`
le escribía el `saldo_meses` y la difería, y `S9` la re-emitía por su tercer disparador sobre el
alta nueva, alcanzada por el beneficiario y la vertical (`DEC-SUB-015`, `DEC-GRANT-010`); el saldo
quedaba diferido para siempre si la vertical no volvía a admitir altas.~~ **Sale entero**
(revisión del owner, 2026-09-28, C8): las verticales no se discontinúan. Una cortesía sobre un
plan **retirado** no tiene nada que resolver: el plan retirado se sigue prestando (`B/10` §3.2), y
la pausa termina reanudando por `S10`. El diferimiento del saldo tiene un solo escritor, el cierre
de `S18` (§4.4).

### 4.7 La unidad de la cortesía temporal: meses enteros, y sólo sobre planes mensuales

**FASE 8 completa, `F-8CB1-001`, owner 2026-09-25** (`DEC-GRANT-003` impl. 6, `DEC-GRANT-004`
punto 3). ~~La cortesía temporal se firmaba en *«días o meses»*~~ (`NUCLEO/01` §1.5).

**Por qué no puede ser en días.** La cortesía se implementa **pausando** (`DEC-GRANT-003`), y en
pausa el proveedor **se saltea las fechas de cobro enteras** que caen adentro (`PS-6`) y al
reanudar **no corre la fecha** (`PS-5`). Entonces una cortesía **vale los cobros que cruza, no los
días que promete**: diez días que no cruzan una fecha de cobro valen cero, y treinta días sobre un
plan anual que cruzan la renovación regalan un año —y lo mismo, en tres o seis meses, sobre un
trimestral o un semestral—.

| caso | regla |
|---|---|
| **la unidad** | **meses enteros**: N meses saltean exactamente N cobros |
| **el plan** | **sólo mensual** — la misma validación de la pausa (`DEC-SUB-010`; el término del ciclo mensual de `puedePausar()`, `NUCLEO/01` §3). Es condición de `S9` por su primer disparador (`B/03` §3.2) |
| **un plan ~~anual~~ no mensual** —trimestral, semestral o anual— | **no se ofrece**: el admin ve que no está disponible y por qué, y `S9` no ocurre. Le quedan **la cortesía permanente** (el grant del §35) o **una promo sobre la renovación** (la fila decía *«anual»* donde la regla dice *«sólo mensual»*; FASE 9 completa, contradicción 1 de `03` §R4.5) |
| **cortesía sobre cortesía** | **se suman meses**, no se reemplazan, y el aviso dice la **fecha de fin nueva** (`DEC-GRANT-004` punto 3). **Lo ejecuta `S34`** (`B/03` §3.2): `S9` sale sólo de `ACTIVE` y exige *«no hay pausa vigente»*, así que la segunda cortesía no tenía transición (FASE 9 completa, contradicción 4 de `03` §R4.5) |
| **la cortesía durante el trial** (§34.1) | **no cambia**: extiende el trial, que es nuestro, y **sigue en días** (§4.5, `DEC-GRANT-003` impl. 4 y 6) |
| **la cortesía permanente** | **no cambia** (`DEC-GRANT-003` impl. 5) |

**Y el saldo diferido hereda la unidad**: `courtesy_grant.saldo_meses` —antes `saldo_días`— guarda
meses (`B/02` §2.4), por ~~los dos escritores de §4.4 y §4.6~~ el escritor del §4.4 (el del §4.6 salió con la revisión del owner, 2026-09-28, C8).

**Lo que esta regla deja abierto, sin resolver acá:**

1. ~~**La fracción de mes del saldo diferido.**~~ **Cerrado el 2026-09-25**: se redondea **para
   arriba** (`B/02` §2.4), la dirección de error que `DEC-GRANT-003` ya había aceptado.
2. ~~**La re-emisión sobre una fila de plan anual.**~~ **Cerrado el 2026-09-25**: **el saldo se
   pierde y se avisa antes**. Si la sucesora es de plan ~~anual~~ **no mensual —trimestral,
   semestral o anual—**, `S18` cierra el saldo con
   `motivo_cierre = ~~DESTINO_DE_PLAN_ANUAL~~ DESTINO_DE_PLAN_NO_MENSUAL` ~~; si es un alta nueva de plan no mensual tras `S25`, lo cierra
   su `S2`~~ (el alta nueva tras `S25` salió con la revisión del owner, 2026-09-28, C8) (FASE 9 completa, contradicción 1 de `03` §R4.5: con *«anual»*, un saldo que caía
   sobre un trimestral o un semestral se re-emitía y `PS-6` lo volvía cero o un ciclo entero). En los dos casos la pantalla se lo dice a la persona antes de elegir el plan (`B/19` §4
   fila 13-quater).
3. ~~**Cuántos términos de `puedePausar()` toma `S9`.**~~ **Cerrado el 2026-09-25**: `S9` toma
   **sólo el término del ciclo mensual y los meses enteros** (**decidido por el owner el 2026-09-25**: la cortesía es un regalo nuestro, no un pedido del cliente, así que no gasta su cuota de pausas, no depende de que el plan permita pausar, y alcanza al pagador manual, cuya fecha de cobro es nuestra).

---

## Lo que este capítulo NO cierra

- **El cupo y la ventana de validez** de un código ya los fijó `DEC-PROMO-001`, y el scope *«todas
  las verticales futuras»* lo fijó `DEC-PROMO-002`. No se reabren.
- **Cómo se ejecuta la mutación del monto contra el proveedor** —y cómo se verifica— es del
  capítulo 13, apoyado en el 06.
- **Qué pasa si la fecha de un aumento cae sobre una suscripción en mora o en grace** sigue
  abierto desde `DEC-MP-002` (implicación 6).
- **Compensar días sobre una suscripción en deuda** (`E-SUB-05`) es del capítulo 12.
- ~~⚠️ **Lo que la pendiente 7 de la FASE 8 completa (owner 2026-09-25) deja abierto**, declarado:~~
  **Lo que la pendiente 7 dejaba abierto quedó cerrado en la pendiente 8 de la FASE 8 completa**
  (owner 2026-09-25 para el 4 y el 5; orquestador para el 1, el 2 y el 3):
  1. ~~**Qué apaga la promo en un downgrade.** Ahí la fila sobrevive (`DEC-SUB-008`) y la redención
     sigue colgando de ella, así que el monto esperado del §2.4 —que resta las promos vivas según
     su contador— **la seguiría descontando**. Ningún acto escribe su fin: el downgrade no tiene
     fila en la tabla de `B/03` §3.2 (lo trata el cap. 12) y, por la regla 1 del núcleo, lo que la
     tabla no declara no pasa. La única forma que el modelo ya tiene de decir *«sin descuento»*
     es `cobros_restantes = 0` (`B/02` §2.4); escribirla ahí no está decidido.~~ **Cerrado**: ~~el
     acto que aplica el cambio programado~~ **el pedido del downgrade** (`B/12` §2) escribe `cobros_restantes = 0` (§2.2; el
     pedido y no el acto desde la FASE 9 completa, contradicción 1 de `03` §R6.5).
  2. ~~**Desde cuándo corren los 3 días del reintento de monto** cuando la divergencia **no** la
     abrió una transición nuestra. En el reintento de cancelación el origen es el instante de la
     transición que la decidió (`B/09` §3); para `S30` hay transición, pero para un monto que
     diverge sin ninguna (el downgrade del punto 1, o un cambio que nadie pidió) no hay instante
     registrado, y la regla es *«sin columna nueva»*.~~ **Cerrado**: el reintento de 3 días vale
     sólo para mutaciones nuestras —`S30` o un aumento de `DEC-MP-002`— y cuenta desde esa
     transición; cualquier otra divergencia abre `DIVERGENCIA_DE_MONTO` en el acto (§2.4).
  3. ~~**El barrido sobre una fila `PAUSED` con la promo agotada.** El §2.4 acepta que ese mes salga
     con descuento y *«no se encola nada»*; pero el monto esperado ya no descuenta esa promo y el
     `transaction_amount` sí, así que el barrido vería la divergencia, sus reintentos fallarían por
     `EX-11` y a los 3 días abriría `DIVERGENCIA_DE_MONTO` mientras dure la pausa. Si el reloj se
     suspende sobre una `PAUSED`, o si la comparación la saltea, no está escrito.~~ **Cerrado**: la
     comparación saltea las filas `PAUSED`, y al reanudar los 3 días corren desde `S10` (§2.4).
  4. ~~**El schedule del correo *«tu promo termina»***: sale antes del último cobro con descuento,
     y cuántos días antes no está decidido (`NUCLEO/07` §6). **Y sobre una promo de «primer
     cobro»** ese último cobro es el primero, así que el aviso cae junto con el del canje (`B/19`
     §4, fila 7-bis); si se manda igual no está decidido.~~ **Cerrado**: 7 días antes,
     configurable; en una promo de «primer cobro» se unifica con el aviso del canje (§2.4).
  5. ~~**Si *«no hay promos para el pagador manual»* alcanza también a la extensión de trial**
     (§32), que es el otro tipo de promo code (`NUCLEO/01`, *Promo code*) y no muta ningún monto.~~
     **Cerrado**: no la alcanza; la regla es sólo para las promos de monto (§2.5).
- ~~⚠️~~ **Lo que la pendiente 8 dejaba abierto quedó cerrado** (FASE 8 completa, owner 2026-09-25):
  1. ~~**El monto esperado entre el pedido de un downgrade y el acto que lo aplica.** `DEC-SUB-008`
     muta el monto al pedirlo y el contador se escribe en 0 recién al aplicar el cambio programado
     (`B/12` §2), así que en esa ventana la redención sigue viva según su contador; qué versión de
     plan y qué promos lee el monto esperado ahí no está escrito.~~ **Cerrado**: en esa ventana el
     monto esperado es el del plan nuevo desde el pedido, porque `DEC-SUB-008` muta el monto en ese acto (§2.4) —**y sin
     promos**: el mismo pedido escribe `cobros_restantes = 0` (FASE 9 completa, contradicción 1 de
     `03` §R6.5; el §2.4 decía *«plan vigente»*, que en esa ventana es el viejo).
- **Si el cobro que agota una promo es el que saca a la fila del grace** (`S5`), el orden entre
  `P1` y `S30` no está escrito: `S30` sale sólo de `ACTIVE` (FASE 9 completa, borde e4 de `03`
  §R6.4; declarado por `DEC-METH-015`). Si `P1` corre antes, la mutación no ocurre y el barrido
  abre `DIVERGENCIA_DE_MONTO` en el acto. **Causa**: `S30` se escribió sobre el cobro ordinario.
  No mueve plata sin que una persona lo vea: la marca la pone delante.
  2. ~~**El instante del aumento de precio.** El aumento de `DEC-MP-002` no tiene fila en la tabla de
     `B/03` §3.2, así que *«desde esa transición»* no tiene todavía un instante registrado que el
     barrido pueda leer para él; para `S30` y `S10` sí lo hay.~~ **Cerrado**: los 3 días del
     reintento de monto de un aumento corren desde su fecha efectiva (§2.4).
