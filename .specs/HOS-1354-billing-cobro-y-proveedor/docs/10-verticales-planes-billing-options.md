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
  - M-SUB-03 # cerrado: no se discontinúan verticales (revisión del owner, casos vecinos, 2026-09-29, caso 40)
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
un acto distinto, explícito, por cliente o por cohorte, ~~que pasa por los caminos que ya existen:
`DEC-MP-002` si el precio le sube, `DEC-SUB-008` si algo le baja~~ **con su propio mecanismo, el
§3.7** (revisión del owner, 2026-09-28, C15): el aviso previo de un aumento sea que el precio le
suba o le baje, y el precio y las capacidades nuevos en su renovación. No es el upgrade de
`DEC-SUB-007`, que re-autoriza, ni el downgrade de `DEC-SUB-008`, que muta el monto en el acto.

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

**Un plan retirado sostiene a sus clientes por tiempo indefinido.** No se fija plazo, ~~no se
programa una migración automática,~~ no caduca. **Nada migra por plazo ni por retirar**: la
migración la decide una persona, el `SUPER_ADMIN`, como acto aparte, y lo único automático es
que, una vez anunciada, **se aplica sola a cada cliente en su renovación** (§3.7; revisión del
owner, 2026-09-28, C15).

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

### 3.7 Migrar a los clientes de un plan retirado

(Revisión del owner, 2026-09-28, C15, `L1-g` y `L1-h`.) **Retirar no mueve a nadie (§3.2), y para
vaciar un plan retirado está la migración**: un acto aparte del `SUPER_ADMIN`, que pasa a los
clientes de una versión retirada a una versión vigente y vendible **de la misma vertical**.

1. **La lanza el `SUPER_ADMIN`** con la acción administrativa 17 (`NUCLEO/08` §3; el 16 era discontinuar una vertical y no se reusa), eligiendo la
   versión retirada y la destino. **Antes de confirmar, el panel muestra a cada cliente
   alcanzado**: si para él es subida o bajada (el veredicto de `direcciónDeCambio`, capacidad por
   capacidad, §3.5), su precio actual y el nuevo, y **la fecha que le toca**. Escribe la fila de
   `plan_migration` y una de `plan_migration_subscription` por cliente (`B/02` §2.2). **Si la
   cohorte incluye la cuenta del propio `SUPER_ADMIN` que la lanza, esa suscripción se excluye y
   el acto sigue para las demás**: una acción administrativa nunca tiene `actor = sujeto` (`V/17`
   §3.2 regla 5), así que no se le escribe fila, la previsualización la muestra excluida con esa
   razón, y queda en la versión retirada hasta que otra cuenta con el permiso la migre en otro
   acto (revisión del owner, casos vecinos, 2026-09-29, caso 24).
2. **Siempre con aviso previo, suba o baje**: **60 días por defecto, configurable, y nunca menos
   que el mínimo del aviso de aumento** de `DEC-MP-002` (es el plazo 12 de `NUCLEO/02` §1.5, que
   cambia el `SUPER_ADMIN` con *«cambiar un plazo»*: revisión del owner, 2026-09-28, C9). La
   migración guarda ~~el plazo~~ la versión de plazos con que se anunció, así que cambiar el plazo después no adelanta una fecha ya avisada. **Tres correos**:
   al anunciar, ~~a 30 días y a 7 días **de la fecha de ese cliente**~~ **30 días y 7 días antes de
   la fecha de renovación de ese cliente, que es su fecha de aplicación** (revisión del owner,
   casos vecinos, 2026-09-29, caso 21); cada uno dice qué cambia en
   su plan, el precio nuevo, la fecha, **si pierde su promoción** y que puede darse de baja o
   elegir otro plan antes (`NUCLEO/07` §6, `B/19` §4).
3. **Se aplica a cada cliente en su renovación**: la **fecha de aplicación** es su primera fecha
   del próximo cobro **estrictamente posterior** a cumplirse el aviso, con el empate a favor del
   cliente, como en `DEC-MP-002`. **También en el anual**: un anual que renueva dentro de diez
   meses espera diez meses, y la versión retirada vive hasta entonces (`L1-g`).
4. **Si el destino ofrece su ciclo, se cambia el monto sobre la misma autorización**, como un
   aumento (`DEC-MP-001`): **no tiene que volver a autorizar nada**. Lo hace `S37` (`B/03` §3.2)
   **siete días antes de la fecha de aplicación**, releyendo, y encola el cambio de versión para
   esa fecha en la cola de `B/12` §2; **las capacidades pasan a la versión destino en la
   renovación**, no antes, **por `S38`**, la transición que aplica la cola (revisión del owner,
   casos vecinos, 2026-09-29, caso 37). **Los siete días son un plazo técnico, no configurable**
   (`NUCLEO/02` §1.5): dejan entrar los 3 días del reintento de la mutación antes del cobro, y
   van con el tercer correo (revisión del owner, casos vecinos, 2026-09-29, caso 20). **Qué correo
   le manda Mercado Pago al cliente cuando la migración le sube el monto no está medido**: `EX-3`
   lo midió al bajar (*«El vendedor Hospeda cambió el monto»*), y la subida pide una fila propia de
   la matriz (caso 34), para que el tercer correo lo anticipe con el texto exacto.
5. **Si el destino no ofrece su ciclo, no se lo mueve solo**: su fila queda `PARA_RESOLVER` y
   aparece en el listado del panel, para que una persona lo resuelva con él, porque cambiar de
   ciclo exige que autorice de nuevo (`DEC-SUB-006`). **Sin plazo**: el listado muestra **su
   antigüedad**, contada desde el anuncio de su migración (`anunciada_en`), para que se vea cuánto
   lleva esperando (revisión del owner, casos vecinos, 2026-09-29, caso 26).
6. **Si pierde algo** (le sobran fichas, por ejemplo), **es un excedente con fecha conocida**, la
   de aplicación: se le avisa antes y elige qué conserva (`V/15` §4.2).
7. **Pausados y en gracia esperan**: la migración se les aplica en la primera renovación después
   de volver o de ponerse al día, recalculando su fecha. `S37` sale sólo de `ACTIVE`, y sobre una
   pausada el proveedor rechaza toda modificación (`EX-11`). **Eso es el día de `S37`**: si `S37`
   ya mutó el monto y la fecha de aplicación encuentra a la fila en `GRACE_PERIOD`, `S38` le cambia
   la versión igual; si la encuentra en `SUSPENDED`, espera y se la cambia al volver por `S7`
   (revisión del owner, casos vecinos, 2026-09-29, caso G-A), **también si `S7` la devuelve a
   `CANCEL_SCHEDULED`** (revisión del owner, casos vecinos, 2026-09-29, caso I-A). **Un pagador con
   tarjeta suspendido no vuelve por `S7` sino como sucesora, y el cambio de versión muere con la
   fila vieja** (la colisión 2 del `B/12` §2.2): **su fila de alcance queda `APLICADA`, porque `S37`
   ya mutó el monto, sin que la predecesora haya cambiado de versión**, y no es un error: la
   sucesora eligió su plan en el checkout, entre los vendibles (revisión del owner, casos vecinos,
   2026-09-29, caso I-B).
8. **Si el cliente cambia de plan o se da de baja por su cuenta durante el aviso, sale de la
   migración**: su fila pasa a `FUERA`, con el motivo. Su propio acto sigue su camino (§3.5,
   `DEC-SUB-009`), y la colisión con la cola es la del `B/12` §2.2.
9. **El `SUPER_ADMIN` puede cancelar una migración anunciada** (`L1-h`), con la misma acción 17:
   alcanza a las filas en `PENDIENTE`, que pasan a `CANCELADA`, y a cada una le sale **el correo
   *«ya no cambia nada»***. **Las ya aplicadas no vuelven**: `S37` ya mutó su monto, y deshacerlo
   sería otra migración. **Tampoco las que están dentro de sus siete días**, con el monto ya
   mutado y la versión todavía sin cambiar: la mutación no se deshace, y a cada una le sale **un
   correo que lo explica**, que la cancelación no la alcanza porque su cambio ya empezó, con su
   precio nuevo y su fecha (revisión del owner, casos vecinos, 2026-09-29, caso 25).

**Toca plata y no se ejecuta sola en la decisión**: la decide y la confirma una persona (`D11`);
lo automático es aplicar lo ya anunciado, fila por fila, releyendo (`D17`).

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
- **La migración de un plan retirado** (§3.7) deja ~~dos cosas~~ una cosa sin cerrar, declarada:
  **qué pasa si la fecha de aplicación cae sobre una suscripción en mora**, que es el mismo hueco
  que `DEC-MP-002` dejó para el aumento (arriba): el §3.7 la hace esperar a que se ponga al día.
  **Eso vale para el día de `S37`**: con el monto ya mutado, la fecha la aplica `S38` igual en
  `GRACE_PERIOD`, y al volver por `S7` en `SUSPENDED` (revisión del owner, casos vecinos,
  2026-09-29, caso G-A), vuelva a `ACTIVE` o a `CANCEL_SCHEDULED` (caso I-A); y con un pagador con
  tarjeta que vuelve como sucesora, muere con la fila vieja (caso I-B).
  ~~y **un cliente con una cortesía temporal vigente** el día de su migración, que está `PAUSED ·
  COURTESY` y por eso espera a volver, lo que puede correr su fecha tantos meses como le queden de
  cortesía.~~ **Un cliente con una cortesía temporal vigente el día de su migración espera, como
  está**: está `PAUSED · COURTESY`, espera a volver, y su fecha se corre tantos meses como le queden
  de cortesía (revisión del owner, casos vecinos, 2026-09-29, caso 27).
- **Discontinuar una vertical** (revisión del owner, 2026-09-28, C8): **fuera de esta versión; si
  algún día hace falta, se diseña entonces** (§4). Lo que sí existe es retirar todos sus planes
  (§3.6), que la deja en operación sin vender.
