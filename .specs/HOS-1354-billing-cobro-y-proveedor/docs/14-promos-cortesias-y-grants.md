---
title: Master Spec 14 — Promos, cortesías y grants
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-19
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
| **cortesía temporal** (§34) | el **cobro** | se **pausa** en el proveedor y el servicio lo sostenemos nosotros (`DEC-GRANT-003`) |
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
2. **Si el resultado cae por debajo del piso, el descuento NO se aplica mutando el monto.** Se
   ejecuta con el mecanismo de la cortesía: **pausar en el proveedor y sostener el servicio de
   nuestro lado** (`DEC-GRANT-003`). Bajar al piso en vez de pausar le cobraría **ARS 15 por
   ciclo** a alguien a quien le dijimos que no iba a pagar.
3. **Por lo tanto un descuento del 100 % no es un descuento: es una cortesía** por el período que
   dure. No hace falta mecanismo nuevo — hace falta reconocer que ya existe.

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

### 2.2 Cambio de plan: la promo sobrevive

| tipo | qué pasa |
|---|---|
| **porcentual** | se **recalcula sobre el precio nuevo** — un porcentaje es una relación, no un importe |
| **monto fijo** | se traslada tal cual, sujeto al piso del §1.3 |
| el contador de **N cobros** | **sigue donde estaba**: cambiar de plan no consume un cobro |

**El veredicto es el mismo en las dos direcciones y el mecanismo no.** En el downgrade el contador
sigue donde estaba porque **la fila sobrevive**; en el upgrade, porque **la sucesora lo hereda**.
Sin esa herencia el upgrade destruiría la promo en silencio — que es exactamente la *«destrucción
silenciosa de bienes pagados»* que el rediseño del candado vino a cerrar. El objetivo de la promo
no desapareció: **se sucedió**.

**Y *«hereda»* nombra un resultado; el acto que lo produce es `S18`.** Hay que decirlo con esas
palabras porque la regla 1 del núcleo es terminante —*«lo que la tabla de transiciones no declara,
no pasa»*— y durante una tanda entera la herencia vivió sólo acá, en la prosa de este capítulo,
mientras `S18` enumeraba **tres** efectos y ninguno era la promo. Cómo se ejecuta:

1. **`S18` re-apunta `promo_redemption.subscription_id` a la sucesora**, en el mismo acto en que
   escribe `sucedida_por` y re-apunta los complementos (`B/03` §3.2, `B/02` §2.6). La redención
   sigue siendo **una** —`UNIQUE(promo_code_id, user_id)` no se toca— y el contador de N cobros no
   se consume, porque no hubo cobro.
2. **El descuento se vuelve a aplicar sobre el monto de la sucesora**, con la regla de este mismo
   §: porcentual se **recalcula** sobre el precio nuevo, fijo se **traslada** sujeto al piso del
   §1.3. No es opcional: `DEC-MP-001` aplica el descuento **mutando el monto en el proveedor**, y
   ese monto vive en el preapproval de la predecesora, que `S17` acaba de cancelar. La sucesora
   nace con el precio de lista.
3. **Y la mutación se verifica releyendo**, como toda mutación (`D5`, cap. 06). Es la única
   defensa que hay: mutar el monto **no emite webhook** (`EX-15`), el aviso del §29 no corre
   porque no hubo aumento de precio, y **el barrido no lo ve** — compara *«monto vigente contra
   `transaction_amount`»* (`B/09` §3) y los dos coinciden, porque el monto vigente de la sucesora
   **es** el de lista. La divergencia es contra lo pactado, no contra el proveedor, y ningún
   detector del diseño mira eso.

**Y vale igual cuando `S18` corre con la sucesora todavía en `PENDING_AUTHORIZATION`** —el
segundo camino del cierre, cuando la predecesora se murió sola por `S12`, por `S16` o por el
espejo de la baja decidida por el proveedor (`B/03` §3.2 y §10.1)—.
Mutar el monto **sí funciona sobre un preapproval `pending`**: es el control de `EX-39`, que lo
midió al probar lo contrario para las fechas —`transaction_amount` 2000 → 2500, con
`last_modified` movido—. **Lo que no se puede mover son las fechas**, y el descuento no las toca.

### 2.3 Cambio de ciclo: sobrevive sólo lo que se puede expresar sin convertir nada

**Una promo sobrevive a un cambio de ciclo si y sólo si sus términos se pueden expresar en el
ciclo nuevo sin convertir nada.**

| promo | ¿sobrevive al cambio de ciclo? | por qué |
|---|---|---|
| **porcentual `forever`** | **sí** | *«20 % siempre»* significa exactamente lo mismo en cualquier ciclo |
| porcentual, **N cobros** | **no** | *«3 cobros»* son tres meses o **tres años** según el ciclo |
| monto fijo, N cobros | **no** | ídem |
| monto fijo, `forever` | **no** | ARS 100 sobre un cobro anual no es el beneficio que se pactó sobre uno mensual |

Es lo que responde la pregunta del hueco —*«¿tres cobros en mensual pasando a anual significa tres
años?»*— sin elegir entre dos malas: **elegir cuál de los dos significa es inventar un término que
nadie pactó.** Si no se puede expresar, termina.

**Y se muestra antes de confirmar el cambio**, con el precio que va a pagar. El checkout de
`DEC-SUB-006` ya le muestra un importe concreto; lo que hay que agregar es que **ese importe ya no
lleva el descuento**, o el cliente lo descubre en el resumen de su tarjeta.

---

## 3. La extensión aplicada el día del vencimiento · cierra `E-PROMO-01`

### 3.1 Es una carrera y necesita regla escrita, no una implementación que gane por suerte

El §32 es terminante —*«Sólo válido durante `TRIAL_ACTIVE`. Nunca después. Backend debe
rechazar.»*— y no dice qué pasa el mismo día, mientras corre el proceso de expiración.

### 3.2 Gana el estado escrito, nunca la hora

**El canje vale si y sólo si la fila del trial sigue en `TRIAL_ACTIVE` en el instante de
escribir**, verificado con la concurrencia optimista del capítulo 05.

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
ningún cobro ocurrió, así que ningún cobro se consumió.

### 4.3 Cortesía temporal + grant permanente

**Sobre un grant no se otorga cortesía**, y no es una restricción arbitraria: el §35.3 ordena
*«cancelar toda obligación de pago cubierta»*, así que **no queda nada que no cobrar**. Es la
misma forma que `DEC-GRANT-004` eligió para *«sobre una pausa no se otorga»*.

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
de anclas **son dos**.

### 4.4 Cortesía temporal + cambio de plan

**Una cortesía vigente sobrevive al cambio de plan, por el mismo acto y la misma razón que la
promo**: `S18` re-apunta `courtesy_grant.subscription_id` a la sucesora al cerrar la sucesión
(`B/03` §3.2, `B/02` §2.6). El instrumento no desapareció — **la suscripción que pausaba se
sucedió**.

**Y acá re-apuntar no alcanza, porque el mecanismo de la cortesía es la pausa.** `DEC-GRANT-003`
la implementa *«pausando en el proveedor y sosteniendo el servicio de nuestro lado»*, así que la
sucesora **queda pausada con motivo `COURTESY` por los días que le quedaban**, contados desde el
cierre. Una cortesía re-apuntada sobre una fila `ACTIVE` que sigue cobrando no es una cortesía: es
una fila de base que no hace nada, que es el modo de falla que `B/16` §2.4 nombra para rechazar
una columna.

**Por qué no puede simplemente morirse con la predecesora**, que es lo que pasaba:
`courtesy_grant.subscription_id` **no es anulable** y desde `DEC-GRANT-006` es **la única
referencia que la cortesía tiene** —se le retiró el `scope`—, así que una predecesora `CANCELLED`
deja la fila apuntando a algo que no emite fuente (`12-contrato…` §2.6). El beneficio que firmó
`SUPER_ADMIN` desaparece **en silencio**: el barrido no compara grants, la fila no queda marcada,
y el cliente se entera cuando le cobran. Y sin `scope` tampoco hay salida alternativa: reemitirla
exige un acto administrativo nuevo, que es *«la acción más grave del catálogo»* de la que alguien
se puede olvidar (`NUCLEO/08` §3).

**Y acá `S18` siempre corre sobre una sucesora ya `ACTIVE`, aunque su fila admita también
`PENDING_AUTHORIZATION`.** El segundo camino de `S18` —la predecesora que se muere sola— sale de
`S12` (`desde: CANCEL_SCHEDULED`) o de `S16` (`desde: ACTIVE`), y **una predecesora con cortesía
vigente está `PAUSED`**, así que ninguna de las dos la alcanza (`B/03` §3.2). No hay caso en que
haya que pausar un preapproval que todavía no autorizó. La pausa entra entonces sobre una fila
autorizada: no choca con `EX-11`, que mide que el proveedor rechaza modificaciones **estando ya
pausada**, ni con la condición de `S9` (*«no hay pausa vigente»*), porque la sucesora nació sin
ninguna.

**Y no contradice `§4.3`**: allá la cortesía **termina** porque el grant cancela la suscripción y
*«no queda nada que no cobrar»*. Acá sí queda: la sucesora cobra, y es exactamente lo que la
cortesía existe para evitar por los días que le quedan.

### 4.5 Extensión de trial + cortesía durante el trial

**Ya está resuelto en el capítulo 11 (épica de verticales) §3**: las dos extienden, **acumulan contra un único techo**
configurable por `user + vertical`, la que no entra se rechaza entera sin consumir el promo, y el
techo ata al canje pero no a `SUPER_ADMIN`.

Se nombra acá porque el hueco lo listaba como tercera combinación, y para dejar escrito que **no
tiene regla propia**: es el mismo techo.

---

## Lo que este capítulo NO cierra

- **El cupo y la ventana de validez** de un código ya los fijó `DEC-PROMO-001`, y el scope *«todas
  las verticales futuras»* lo fijó `DEC-PROMO-002`. No se reabren.
- **Cómo se ejecuta la mutación del monto contra el proveedor** —y cómo se verifica— es del
  capítulo 13, apoyado en el 06.
- **Qué pasa si la fecha de un aumento cae sobre una suscripción en mora o en grace** sigue
  abierto desde `DEC-MP-002` (implicación 6).
- **Compensar días sobre una suscripción en deuda** (`E-SUB-05`) es del capítulo 12.
