---
title: Master Spec 14 — Promos, cortesías y grants
linear: HOS-1352
statusSource: linear
created: 2026-09-17
updated: 2026-09-17
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
dirección que el capítulo 15 §2.4 eligió para los limits que no acumulan, y por la misma razón:
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

- **cambiar de PLAN con el mismo ciclo** muta el monto y **la suscripción sobrevive**
  (`DEC-SUB-007`, `DEC-SUB-008`);
- **cambiar de CICLO cancela y recrea con una re-autorización en el checkout** (`DEC-SUB-006`):
  **la suscripción que llevaba la promo deja de existir.**

### 2.2 Cambio de plan: la promo sobrevive

| tipo | qué pasa |
|---|---|
| **porcentual** | se **recalcula sobre el precio nuevo** — un porcentaje es una relación, no un importe |
| **monto fijo** | se traslada tal cual, sujeto al piso del §1.3 |
| el contador de **N cobros** | **sigue donde estaba**: cambiar de plan no consume un cobro |

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
vence uno que, en el medio, se extendió diez días. La condición de T3 —*llega la fecha de fin*—
dejó de cumplirse, y la tabla del capítulo 03 §1 es exhaustiva: **lo que no cumple la condición no
se ejecuta.**

### 3.4 Un canje rechazado no se consume

Igual que en el techo de extensiones (cap. 11 §3.3): la fila de canje no se escribe, y la persona
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

### 4.4 Extensión de trial + cortesía durante el trial

**Ya está resuelto en el capítulo 11 §3**: las dos extienden, **acumulan contra un único techo**
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
