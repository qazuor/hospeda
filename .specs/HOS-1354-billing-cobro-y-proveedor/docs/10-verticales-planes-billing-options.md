---
title: Master Spec 10 — Verticales, planes y billing options
linear: HOS-1354
statusSource: linear
created: 2026-09-17
updated: 2026-09-25
status: CURRENT
fase: 2
capitulo: 10
cierra:
  - OD-ARCH-01
  - M-SUB-03
---

# 10 · Verticales, planes y billing options

Mitad **BILLING** del capítulo 10 del programa. La otra mitad vive en la otra épica.

Abre la Parte II. Acá empieza a describirse **comportamiento**, y la regla del índice rige desde
la primera línea: este capítulo **referencia** el núcleo y no redefine nada. Los nombres salen
del capítulo 01 (núcleo), las entidades y restricciones del 02, los estados del 03.

Lo que sí define es lo que ningún capítulo anterior podía definir: **qué diferencia
legítimamente a una vertical de otra, plan por plan**, y **qué pasa cuando algo del catálogo
deja de venderse** — un plan (`OD-ARCH-01`) ~~o una vertical entera (`M-SUB-03`)~~ (la vertical
entera salió con la revisión del owner, 2026-09-28, C8: las verticales no se discontinúan, §4).

---

## 3. Retiro de un plan del catálogo · cierra `OD-ARCH-01`

### 3.1 La pregunta, exactamente

El PDR no la menciona en ningún lado. Un plan que deja de venderse pero que todavía tiene
clientes pagando: ¿se archiva y siguen ahí indefinidamente?, ¿se los migra?, ¿hay fecha?

`DEC-ARCH-002` dejó la mitad del mecanismo —el flag de vendible— y anotó que la política seguía
abierta. Esta sección es la política.

### 3.2 Retirar y migrar son dos actos, y sólo uno toca plata

**Retirar un plan no mueve a nadie.** Es el acto de sacarlo del catálogo: deja de aparecer en la
pricing, deja de participar del `rank`, deja de alimentar la derivación del plan de trial. Para
quien ya lo tiene **no cambia nada**: mismo precio, mismos entitlements, mismos limits, misma
fecha de renovación. No toca plata.

**Migrar a un cliente a otro plan sí toca plata** —otro precio, otras capacidades— y por eso es
un acto distinto, explícito, por cliente o por cohorte, que pasa por los caminos que ya existen:
`DEC-MP-002` si el precio le sube, `DEC-SUB-008` si algo le baja.

Separarlos es la decisión. Fundirlos en uno —*«retirar el plan migra a los que quedan»*— haría
que sacar algo de la pricing moviera dinero ajeno como efecto colateral, que es exactamente lo
que `DEC-ARCH-001` fue a evitar cuando ancló cada suscripción a su versión.

### 3.3 Cómo se retira, mecánicamente

**Retirar es publicar una versión nueva marcada no vendible.** No hace falta ningún mecanismo
nuevo: la versión es inmutable (`DEC-ARCH-001`), así que un cambio con efecto se expresa
publicando otra, y el flag de vendible tiene efecto (`DEC-ARCH-002`, implicación 4).

Consecuencias, todas ya provistas por el núcleo:

1. **Queda fechado y auditado solo.** La versión nueva tiene su fecha de publicación y su
   registro en `domain_event`; no hay que agregar una columna de «fecha de retiro».
2. **Las suscripciones vivas no se mueven**, porque cada una está anclada a la versión que
   compró y ninguna lectura de suscripción pasa por la vigente.
3. **El `rank` se libera** en cuanto la vigente deja de ser vendible, así que un plan nuevo puede
   ocupar ese lugar sin renumerar (`DEC-ARCH-002`, implicación 3).
4. **Se puede deshacer**, publicando otra versión vendible. Volver atrás no es un caso especial:
   es el mismo acto.

### 3.4 No hay fecha de vencimiento, y eso es la decisión

**Un plan retirado sostiene a sus clientes por tiempo indefinido.** No se fija plazo, no se
programa una migración automática, no caduca.

Se eligió hacia dónde falla: **hacia que el cliente siga pagando lo que pagaba, con lo que
tenía.** El costo es una cola larga de versiones vivas que nadie puede comprar. La alternativa
—un plazo tras el cual el sistema mueve solo a los que quedan— falla hacia mover dinero y
capacidad de gente que no pidió nada, y encima dispara el aviso del §29 por una razón
administrativa nuestra.

**La cola es acotada y visible, no infinita ni silenciosa.** Una versión retirada se extingue
cuando la deja su última suscripción, y eso es una condición derivada —cuántas suscripciones
siguen ancladas a ella—, no un estado guardado. El listado de administración del §48 la muestra
por versión retirada, que es lo que convierte la cola en algo que alguien puede decidir atacar
en vez de algo que se acumula sin que nadie lo sepa.

### 3.5 Un cliente en un plan retirado que quiere cambiar

Es el borde real del retiro, y necesita regla propia: **su versión no participa del `rank`**
(`DEC-ARCH-002`), así que la pregunta *«¿es upgrade o downgrade?»* no tiene respuesta por orden.

~~**La dirección se deriva del delta entre las dos versiones, no del `rank`:**~~
**La dirección no la deriva billing: la decide el veredicto de verticales,
`direcciónDeCambio(versiónOrigen, versiónDestino) → SUBE | BAJA`** (`12-contrato…` §4.1,
`DEC-ARCH-008`; FASE 8 completa, `F-8CD1-003`, `F-8CC1-013`). Verticales lo computa por el delta
entre las dos versiones —no por el `rank`—, porque las tablas que se comparan son suyas; **billing
nunca lee `plan_version_entitlement` ni `plan_version_limit`** y recibe sólo `SUBE` o `BAJA`. **Y
rige todo cambio de plan, no sólo éste**: el plan retirado es el caso donde el `rank` ni siquiera
contesta, no el único donde el veredicto hace falta. Lo que sigue es **qué hace billing con cada
veredicto**, y el criterio con el que verticales lo emite:

- **si algo baja** —*baja* es **empeora según la estrategia de la clave** (`V/15` §2.2), no *el
  número es menor*: en `SUMA` y `MÁXIMO`, un número menor; en `MÍNIMO`, uno **mayor**; en
  `MEJOR_DECLARADO`, un valor peor en el orden que la clave declara; y una clave presente en el
  origen y ausente en el destino baja. Una clave que aparece sólo en el destino no baja (FASE 9
  vuelta 1, `F-8V1C1-002`)— (veredicto `BAJA`) —un limit, un entitlement, una cuota de un entitlement medido— el cambio sigue
  el camino de downgrade (`DEC-SUB-008`): el monto se muta ya, las capacidades bajan al fin del
  ciclo y el excedente se avisa antes de tocarlo;
- **si nada baja** (veredicto `SUBE`), sigue el camino de upgrade (`DEC-SUB-007`): inmediato.

**Cualquier baja manda.** Un cambio en el que suben tres claves y baja una es un downgrade a
todos los efectos, porque el excedente que hay que avisar existe igual y el camino de upgrade no
lo contempla.

**Y la ventana de 60 días de `DEC-MP-002` no aplica acá.** Esa ventana protege a quien **no
eligió** el precio nuevo. El que elige un plan lo acepta en el acto, con su precio a la vista.
Confundir los dos casos haría imposible cambiar de plan por voluntad propia sin esperar dos
meses.

---

### 3.6 Retirar todos los planes de una vertical

(Viene del §4.1, que salió con la revisión del owner, 2026-09-28, C8; la regla es de la FASE 9
vuelta 2, owner 2026-09-27, `R24`, `F-8V2A3-005`.)

**Retirar todos los planes de una vertical sigue siendo posible, y no la cierra.** Es el mismo
acto del §3.3 repetido sobre cada plan, y no escribe nada sobre la vertical. Retirados todos los
vendibles, **nadie nuevo entra**, porque `S1` exige una versión vigente y vendible (`B/03` §3.2);
**nadie nuevo arranca un trial**, porque `T1` exige lo mismo (`V/03` §2), y no poder probar algo que
después no se puede comprar es la respuesta correcta; la pantalla dice que **la vertical no tiene
planes disponibles** (`V/19` §4 fila 29); y **todos los que están adentro siguen exactamente
igual, indefinidamente** (§3.4). La vertical queda **en operación**, y se vuelve a vender
publicando una versión vendible.

---

## ~~4. Vertical discontinuada · cierra `M-SUB-03`~~

~~§4.1 a §4.6: la pregunta, la regla de dejar de cobrar antes de dejar de prestar, el acto de
`SUPER_ADMIN` en dos mitades (verticales cierra altas, billing anuncia, fija la fecha, avisa y
cancela), la fórmula de la fecha de fin de servicio, acortar la cola, la pausada fuera del piso,
los cuatro bordes y la tabla de situaciones de la vertical (FASE 9 completa y vueltas 1 y 2;
`DEC-SUB-015`, `DEC-SUB-018`, `DEC-GRANT-010`, `DEC-ARCH-011`, `Q-ALTAS`, `Q-FECHA`, `Q-ACC16`,
`R5`).~~ **Sacado entero** (revisión del owner, 2026-09-28, C8): **las verticales no se
discontinúan**. `M-SUB-03` se cierra por decisión: discontinuar una vertical queda **fuera de esta
versión; si algún día hace falta, se diseña entonces**, y el diseño viejo está en el log, en
`DEC-SUB-015`, `DEC-SUB-018`, `DEC-GRANT-010` y `DEC-ARCH-011`. Con él salen `S25`–`S28` (`B/03` §3.2), `vertical_discontinuation`
(`B/02` §2.1), `vertical.admite_altas` (`V/02` §2.1), las entradas `situaciónDeVertical` y
`finDeServicio` del contrato (`12-contrato…` §4.1), la acción administrativa 16 (`NUCLEO/08` §3),
el invariante `D14` (`NUCLEO/04` §3), el hecho 4 del reloj de retención (`NUCLEO/01` §1.2) y los
avisos y motivos de la discontinuación. **Retirar planes sigue** (§3, y §3.6 para todos los de una
vertical).

---

## Lo que este capítulo NO cierra

- **El detalle del cambio de plan** —cómo se ejecuta contra el proveedor, qué se compensa— es del
  capítulo 12 (épica de billing). Acá está sólo ~~la regla de dirección para el caso del plan
  retirado~~ qué hace billing con el veredicto de dirección —que rige todo cambio de plan y lo emite
  verticales (`12-contrato…` §4.1, `DEC-ARCH-008`)—, escrita junto al caso del plan retirado.
- **Qué pasa si la fecha de un aumento cae sobre una suscripción en mora** sigue abierto: lo dejó
  anotado `DEC-MP-002` y no lo cierra este capítulo.
- **Discontinuar una vertical** (revisión del owner, 2026-09-28, C8): **fuera de esta versión; si
  algún día hace falta, se diseña entonces** (§4). Lo que sí existe es retirar todos sus planes
  (§3.6), que la deja en operación sin vender.
