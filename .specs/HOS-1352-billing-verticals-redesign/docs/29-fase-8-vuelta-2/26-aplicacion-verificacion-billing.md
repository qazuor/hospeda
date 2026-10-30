---
title: "FASE 9 vuelta 2 · aplicación de la verificación, tramo billing"
linear: HOS-1352
statusSource: linear
created: 2026-09-27
updated: 2026-09-27
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2 · aplicación de la verificación: el tramo billing

Las decisiones `V2-a` a `V2-f` de
[`24-decisiones-del-owner-verificacion.md`](./24-decisiones-del-owner-verificacion.md) y los
arreglos de texto sin decisión de la mitad billing: `N-A-02` (de `21-`), y `N-C-01`, `N-C-02`,
`N-C-03` y `N-C-06` (de `23-`), más los casos vecinos heredados que `21-` §3 y `23-` §4 clasifican
como arreglo de texto y siguen abiertos en billing. Medido y editado en el worktree
`hospeda-spec-hos-1352-billing-redesign`, sin commits. `B/` es `HOS-1354…/docs`, `D/` es
`HOS-1352…/docs`. No toqué la mitad de verticales ni la acción 16 (`V2-g` a `V2-l`, `N-B-*`,
`N-C-04`, `N-C-05`, `N-C-07`): es el tramo siguiente.

## 1. Qué se aplicó

### `V2-a` · la ventana del corte se lee en la fecha del pago, no en la del registro (`F-8V2B3-002`)

La regla de `R2` y todos sus espejos pasan del `date_created` del registro de cobro a la fecha del
pago que aprobó el registro, leído por id. El registro es uno por ciclo con los reintentos adentro,
así que su fecha es anterior a todo reintento: el cobro de Juan del 12/12 sobre un registro del
25/11 ahora abre la marca 7.

- La regla, en `B/21` §2.5:
  `B/21:289` «la fecha del pago que aprobó»
- La medición y la salida si no da:
  `B/21:294` «Qué campo del pago trae esa fecha se mide en el paso 0 del corte»
- `B/21:297` «cuyo pago aprobado es de»
- El barrido: `B/21:306` «cuyo pago aprobado es posterior a ese día (`V2-a`)»
- `B/02` §2.3, para que nadie lea la fecha del período como la de la ventana:
  `B/02:465` «Esta fecha identifica el período y no la ventana del corte»
- La fila del motivo 7: `B/02:986` «la fecha del pago, no la del registro»
- `B/09` §3: `B/09:166` «cuyo pago aprobado es posterior al día del corte»
- `B/05` §3, las tres menciones:
  `B/05:334` «y el cobro sobre la lápida del corte ~~con `date_created`~~ cuyo pago aprobado es posterior al día del corte»
- `B/05:357` «el pago aprobado (`V2-a`) de ese día o anterior»
- `B/05:378` «la fecha del pago y no la del registro, `V2-a`»
- El criterio de B11:
  `$B/descomposicion.md:749` «y también si su registro de cobro nació antes del corte y el que cobró fue un reintento»
- **El paso 0 del corte** (`D/16` §4.2), con la medición nueva:
  `D/16:122` «Y se mide con qué fecha lee esa regla un cobro»
- `D/16:122` «se lee por id el pago que lo aprobó y se mide qué campo trae el instante de esa aprobación»
- `D/16:122` «Ésta no achica una población: es el dato con el que la regla de la marca decide»

**Por qué la medición sí es condición de la regla y las otras dos del paso 0 no.** `EX-44` y
`EX-45` dan el tamaño de la población y la regla cubre igual sin ellas. Esta da el dato con el que
la regla decide: sin un campo confiable no hay regla, y `V2-a` dice que vuelve al owner. No
escribí si bloquea el 1b (§4, caso 1).

**`$B/docs/21-migracion.md` no tiene un «paso 0»**: el orden del corte vive en `D/16` §4.2 y
`B/21` remite a él. La medición va escrita en el paso 0 de `D/16` y, en `B/21`, en la misma regla
de `R2`, con remisión al paso 0. No agregué el ID de la fila a las tres tablas de `UNKNOWN`
(`$B/spec.md` §5.2, `B/06` §11, `$B/descomposicion.md` §2.7): la fila pide OK del owner (§3).

### `V2-b` · `S22` sobre una sucesora que vive del crédito va a `CANCEL_SCHEDULED` (caso 1 de `11-` §5)

La baja desde `PAUSED · COURTESY` de una sucesora que vive del crédito cortaba en el acto y perdía
el crédito que `R17` declaró período pagado. Ahora es `S11` entera: `CANCEL_SCHEDULED` con fin en
el fin del crédito, y sus complementos cancelados en el acto con la selección de `S11`. Sin esa
segunda mitad volvía el CRÍT de R1 en esta población, porque la fila sigue viva y la orfandad no
llega hasta `S12`: por eso la regla va entera y no sólo su fecha, con la pertenencia declarada.

**No es una transición nueva**: es un segundo destino de `S22`, como `S7` tiene `ACTIVE` o
`CANCEL_SCHEDULED`. No mueve el conteo de transiciones ni el de salidas de `PAUSED`, que ya
contaba a `S22`.

- La fila: `B/03:170` «si la fila vive del crédito de `DEC-SUB-006` y el crédito no se consumió»
- `B/03:170` «Es la regla de `S11` entera y no sólo su fecha»
- `B/03:170` «y en el mismo acto cancela sus complementos recurrentes con la selección de `S11`»
- La tabla de las cuatro bajas: `B/03:877` «sobre una fila que vive del crédito sin consumir»
- El párrafo que prohibía `CANCEL_SCHEDULED` para las tres:
  `B/03:894` «Salvo `S22` sobre una fila que vive del crédito de `DEC-SUB-006` sin consumir»
- §3.3: `B/03:1497` «y salvo `CANCEL_SCHEDULED` por `S22` sobre una fila que vive del crédito de `DEC-SUB-006` sin consumir»
- `S12`, el orden de la fecha de fin: `B/03:160` «o desde `S22` sobre una fila que vive del crédito»
- `S24`: `B/03:172` «y no en el acto si la fila vive del crédito»
- `B/05` C2: `B/05:140` «ni para `S22` sobre una fila que vive del crédito sin consumir»
- El reintento del barrido: `B/09:276` «y la que `S22` lleva ahí sobre una fila que vive del crédito»
- `B/12` §7.2: `B/12:1048` «Salvo sobre una sucesora que vive del crédito de `DEC-SUB-006` sin consumir»
- La pantalla de la baja: `B/19:185` «Salvo desde `PAUSED` sobre una fila que vive del crédito sin consumir»
- La fila 8 del §4: `B/19:116` «Salvo la pausada que vive del crédito sin consumir»
- El invariante 22: `nucleo/04:65` «Salvo `S22` sobre una sucesora que vive del crédito de `DEC-SUB-006` sin consumir»
- La lista de disparadores de la orfandad: `B/16:752` «`S22` cuando va a `CANCELLED`»
- Criterios de B8: `$B/descomposicion.md:134` «también cuando la baja sale de `PAUSED · COURTESY`»
- `$B/descomposicion.md:746` «también si está pausada por una cortesía re-emitida»

### `V2-c` · la selección de `S32` en la baja, confirmada (caso 6 de `11-` §5)

No había en el texto ninguna marca de «pendiente de confirmar»: la lectura del grupo A estaba
aplicada sin fecha de confirmación, y dos criterios de la descomposición y `B/16` §4.3 remitían a
*«la selección de `S32`»* sin decir cuál. Se levanta con fecha donde vive y se declara en cada
remisión.

- `S11`: `B/03:159` «es la lectura del grupo A de la FASE 9 vuelta 2, confirmada por el owner»
- `B/16` §4.3: `B/16:711` «con `CANCEL_SCHEDULED` en la exclusión»
- Los criterios de B8 y B10:
  `$B/descomposicion.md:134` «la selección de `S32`, con `CANCEL_SCHEDULED` en la exclusión»
- `$B/descomposicion.md:748` «un `USER` compatible con dos verticales, dado de baja primero en una y después en la otra»

`B/03:2780` (el espejo de `R18`) y la fila de `S7` remiten a *«como `S11`»*, que ya trae la
exclusión: no necesitaban cambio.

### `V2-d` · `S26` aplica la selección de `S11` a los `USER`/`GLOBAL`, y su marca es el 15 (`N-A-01`)

- El `desde` de `S26`:
  `B/03:174` «y la fila DE COMPLEMENTO `USER`/`GLOBAL` en `ACTIVE` cuyo producto declara compatible la vertical, con la selección de `S11`»
- Su efecto y su motivo:
  `B/03:174` «El `USER`/`GLOBAL` que toma por la selección de `S11`»
- La fila nueva del reparto de `S21`:
  `B/03:1383` «el `USER`/`GLOBAL` que `S26` canceló con la selección de `S11`»
- `B/10` §4.3, la prosa del día 0: `B/10:194` «y con el complemento»
- `B/16` §4.3: `B/16:722` «Y `S26` aplica la misma selección»
- `B/16:728` «Y la marca de esos complementos en la fecha de fin es el motivo 15, no el 14»
- El motivo 15 en `B/02` §2.5:
  `B/02:994` «o sobre un complemento `USER`/`GLOBAL` que `S26` canceló con la selección de `S11`»
- Los defaults de `B/19` §6, el 15 y la fila del 14 que nombra `S12`-vía-`S26`:
  `B/19:230` «o porque es un `USER`/`GLOBAL` que `S26` canceló con la selección de `S11`»
- `B/19:234` «que va al 15 (`V2-d`)»
- Criterio de B10:
  `$B/descomposicion.md:748` «discontinuar una vertical cancela también el `USER`/`GLOBAL` que sólo ella sostenía»

**Cómo lee `S21` la causa 60 días después** queda como caso vecino (§5, caso 2): lo escribí con el
argumento que el §3.2 de `B/03` ya usa para `S27` y `S28` (*«el acto toca la fila al pasar»*),
pero `S26` corre el día 0 y `S21` en la fecha de fin.

### `V2-e` · un disparador más de `S32` para el `USER`/`GLOBAL` sin título (`N-A-03`)

- El `desde` y el evento de `S32`:
  `B/03:180` «y, por el tercer evento, sólo el `USER`/`GLOBAL`»
- `B/03:180` «o una de las catorce transiciones de `B/16` §4.3 saca de las filas vivas a una principal compatible con un `USER`/`GLOBAL`»
- Su efecto, el `fin_previsto` y la vuelta:
  `B/03:180` «La pausa toma el `fin_previsto` más tardío entre las pausas de esas principales compatibles»
- `B/16` §4.2, con el camino de Juan:
  `B/16:694` «Y el `USER`/`GLOBAL` cuyo último título sin pausar muere por otra vía también se pausa»
- Criterio de B10: `$B/descomposicion.md:748` «queda pausado por `S32` en ese acto»

**El `fin_previsto` es una derivación mía**: la decisión nombra el disparador y no dice con qué
fin se pausa. Tomé la regla que `S32` ya tiene (el de la pausa de la principal, y ninguno por
`S6`), llevada a varias principales: el más tardío, o ninguno si alguna está suspendida. `S33` ya
reanudaba un `USER`/`GLOBAL` cuando otra vertical compatible vuelve a tener una principal `ACTIVE`,
así que la vuelta no pidió nada.

### `V2-f` · el cobro por debajo del esperado, una línea del resumen (`16-` §5)

- `NUCLEO/08` §4.1, como tercer tipo del resumen que no nace de una marca:
  `nucleo/08:347` «Y un tercer tipo del resumen que no nace de una marca: el cobro por debajo del esperado»
- `B/09` §3: `B/09:166` «Y si cobró de menos, no se abre marca»
- `B/09` §2.3: `B/09:71` «Y lista una segunda»
- Los tres espejos de `EX-47`, que decían que el cobro viejo lo ve el motivo 24, cierto sólo
  cuando la mutación baja el monto:
  `$B/spec.md:247` «la línea del resumen del cobro de menos cuando lo subió»
- `B/06:422` «y la línea del resumen del cobro de menos»
- `$B/descomposicion.md:409` «y la línea del resumen del cobro de menos cuando lo subió»
- Criterio de B11: `$B/descomposicion.md:749` «no abre marca y sale en el resumen del día»

Al pasar, la cita de `B/09` §3 a la fila propuesta al owner quedó vencida desde `Q-UNKNOWN`:
`B/09:166` «es `EX-47`, que el owner aceptó».

### Los arreglos de texto sin decisión

- **`N-A-02`**, el `USER`/`GLOBAL` que su propio `S12` cierra: la instancia quedaba `ACTIVE` sin
  fila. De las dos salidas que proponía `21-`, la de reanudar por re-evaluación no es posible,
  porque el preapproval ya está cancelado (`PA-5`), así que no era una elección:
  `B/03:160` «Y sobre ese `USER`/`GLOBAL` este `S12` apaga también su instancia»
- **`N-C-01`**, la salvedad de `R18` y el segundo evento de `S6`:
  `B/03:2780` «por cualquiera de sus eventos que manda cancelar antes de escribir»
- **`N-C-02`**, el 24 que se reabre sobre un pago ya resuelto:
  `B/02:1003` «ni sobre un pago que ya tuvo un 24 levantado»
- `B/09:166` «ni sobre un pago que ya tuvo un 24 levantado»
- `$B/descomposicion.md:749` «la corrida siguiente no abre otro 24 sobre el mismo pago»
- **`N-C-03`**, la devolución de la diferencia:
  `B/02:1003` «`P3` o `P4` según el acumulado, como toda devolución»
- **`N-C-06`**, el acto a medias en el panel:
  `B/19:215` «acto a medias de la acción 16»
- `B/19:208` «Tres cosas, en este capítulo»
- **`15-` §5**, la segunda enumeración de `B/16` §4.3:
  `B/16:777` «o cualquier otra de las catorce que saque de las filas vivas a esa sucesora»
- **Caso 5 de `11-` §5**, `B/05` C2 sobre la fila de complemento:
  `B/05:131` «Las dos filas valen igual sobre una fila DE COMPLEMENTO en `CANCEL_SCHEDULED`»
- **Caso 2 de `12-` §5**, la herramienta del 3b corrida dos veces:
  `D/16:130` «Correrla dos veces da lo mismo»

**`N-C-06` y el conteo del panel.** La lista de `B/19` §6 decía *«Tres cosas»* y tenía dos: la
tercera, las postulaciones de Partner, pasó a `V/19` §6 cuando se partió el capítulo y la cifra no
se tocó. Con el acto a medias vuelven a ser tres en este capítulo, y lo dije en la misma frase.

## 2. Conteos recontados

| lista | antes → ahora | comando | espejos |
|---|---|---|---|
| motivos de `B/02` §2.5 | 24 → **24**, con **9** `SÍ` | `python3` sobre las filas `\| N \| \`MOTIVO\`` de la tabla y su última columna | no se movieron: `V2-f` no abre motivo |
| transiciones que sacan a la principal de las filas vivas | 14 → **14** | la lista de `B/16` §4.3, sin cambio de miembros | `S22` sigue en ella por su destino `CANCELLED` |
| filas de `S22` en `B/03` §3.2 | 1 → **1** | `rg '^\| S22 \|'` | el segundo destino no es fila nueva |
| lo que el panel muestra en `B/19` §6 | 2 escritas, «Tres» en el texto → **3** | `python3` sobre la tabla y la fila suelta de las versiones retiradas | la frase dice de dónde sale cada una |
| `UNKNOWN` de la matriz y de las tres tablas | 10 → **10** | sin cambio: la fila nueva pide OK (§3) | si el owner la acepta, 11 en `$B/spec.md` §5.2, `B/06` §11 y línea 28, `$B/descomposicion.md` §2.7 |
| mediciones del paso 0 que nombra `B/06:431` | tres → **tres** | sin cambio hasta el OK | con la fila aceptada serían cuatro |

## 3. Para el log y la matriz (pide OK del owner)

### Matriz (`$D/06-mp-validation-matrix.md`, después de `EX-47`)

1. **`EX-48`** (`V2-a`). **Qué agrega**: qué campo del pago trae la fecha de la aprobación.
   **Razón**: la regla de `R2` decide con ese dato desde `V2-a`, y no está medido. Los guiones de
   las celdas vacías son la convención de la matriz, no prosa.
   > | **EX-48** ✚ | Leído por id el pago que aprobó un registro de cobro (`authorized_payment`) en un **reintento** posterior a la creación del registro, ¿qué campo trae el instante de esa aprobación, distinto del `date_created` del registro? | la ventana del corte: si un cobro sobre la lápida del corte es posterior al corte (`B/21` §2.5, `B/09` §3, `B/05` §3; FASE 9 vuelta 2, verificación, `V2-a`, `F-8V2B3-002`) | `UNKNOWN` | — | — | — | Se mide en el paso 0 del corte (`16-fase-7…` §4.2) sobre una sonda propia con un registro que se rechaza y cobra en un reintento (`GR-1`, `RC-6`). Un campo que dé la fecha del registro, o que no venga en la lectura por id, no sirve. Si ningún campo es confiable, la ventana vuelve al owner |

   **Recuento si el owner la acepta**: la matriz pasa de 104 a 105 filas y los `UNKNOWN` de 10 a
   11, con sus espejos en `$B/spec.md` §5.2, `B/06` §11 (y su recuento de la línea 28 y el de la
   431, *«tres de ellas en el paso 0»*, que pasa a cuatro) y `$B/descomposicion.md` §2.7, con la
   unidad **B11** y la herramienta del corte (paso 0), como `EX-44`.

### Log (`$D/01-decision-log.md`)

1. **`DEC-MIG-005`**, su 📌 del 2026-09-27 (`:5894`). **Qué cambia**: el paréntesis
   *«(`date_created` del registro)»* queda falso. Texto propuesto, como segundo 📌:
   > 📌 **Precisado el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-a`)**: el
   > día del cobro se lee en la fecha del pago que aprobó el registro, leído por id, y no en el
   > `date_created` del registro, que no se mueve con los reintentos. Qué campo del pago la trae se
   > mide en el paso 0 del corte (`EX-48`); si ninguno es confiable, vuelve al owner.
2. **`DEC-SUB-009`**, su 📌 de `R17` (`:1293`). **Qué cambia**: el crédito también sostiene la
   baja desde una pausa por cortesía.
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-b`)**: la
   > baja desde `PAUSED` de una sucesora que vive del crédito sin consumir (`S22`) va a
   > `CANCEL_SCHEDULED` con fin en el fin del crédito, con la regla de `S11` entera, complementos
   > incluidos.
3. **`DEC-ADDON-002`**, su 📌 de `R1-a` (`:2003`). **Qué cambia**: la selección que ese 📌 nombra
   ya tiene lectura confirmada, y la usan también `S26` y un disparador nuevo de `S32`.
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-c`, `V2-d`
   > y `V2-e`)**: la selección de `S32` en la baja suma `CANCEL_SCHEDULED` a la exclusión. `S26`
   > la aplica a los `USER`/`GLOBAL` compatibles con la vertical que discontinúa. Y cuando una de
   > las catorce transiciones saca a una principal de las filas vivas y la orfandad de un
   > `USER`/`GLOBAL` no se cumple sólo porque las otras compatibles están pausadas o suspendidas,
   > `S32` lo pausa en el mismo acto.
4. **`DEC-RF-006`** (`:4986`). **Qué cambia**: el reparto del motivo 15 gana un camino.
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-d`)**: el
   > `USER`/`GLOBAL` que `S26` canceló abre el 15 y no el 14 en su fecha de fin.
5. **`DEC-OBS-001`** (`:2055`). **Qué cambia**: el resumen gana un tipo sin marca.
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-f`)**: el
   > resumen lista el cobro por debajo del monto esperado de su período, con el sujeto y la
   > diferencia; no abre marca ni mueve el conteo de motivos.

Las celdas de *Estado* de esas cinco decisiones ya dicen *«precisada el 2026-09-27»* o la
necesitan sumar, con el criterio de `Q-ESTADO`; el recuento de *«precisadas sin `SUPERSEDED`»* se
rehace sobre el log después de escribirlas. No lo hice: el log no es mío.

## 4. Preguntas abiertas

Ninguna nueva de las que me tocaban: las seis decisiones se aplicaron sin elegir entre lecturas,
salvo las derivaciones que declaro en el §1 (`V2-b` con la regla de `S11` entera, el `fin_previsto`
de `V2-e`) y las dudas que no pude cerrar sin mecanismo, que van como casos vecinos.

## 5. Casos vecinos

1. **¿La medición de `V2-a` es condición del 1b?** `EX-42` lo es del 1a (*«si no da, `Y-1` vuelve
   al owner»*). La de `V2-a` vuelve al owner si no da, pero el paso 0 no dice si el corte espera
   esa respuesta. Si no espera, el corte corre con una regla sin dato. Pide decisión.
2. **Cómo sabe `S21`, en la fecha de fin, que el `USER`/`GLOBAL` lo canceló `S26`** (`V2-d`). El
   argumento de `B/03` §3.2 para `S27` y `S28` es que el acto toca la fila y escribe la marca en
   el mismo acto. `S26` corre el día 0 y `S21` hasta 60 días después, y el mismo § dice que
   transportar la causa a través de `CANCEL_SCHEDULED` es el mecanismo descartado (por eso
   `S12`-vía-`S26` va al 14). Hay dos lecturas: la fila de complemento guarda quién la programó
   (una columna, mecanismo nuevo), o `S21` lo deduce de que la vertical de la principal tiene una
   `vertical_discontinuation` (y entonces también el `S12`-vía-`S26` de `LISTING` y
   `VERTICAL_SUBSCRIPTION` dejaría de ser *«no legible»*). Pide decisión.
3. **`S36` con un pago retenido por `S19`** (caso 2 de `11-` §5; `21-` lo clasifica como texto).
   No lo apliqué porque pide elegir. Si el pago retenido es *«el último pago acreditado»*, el `RF1`
   de `S36` y la marca 1 de la rama 6 proponen devolver el mismo pago. Una lectura es que el pago
   retenido no está acreditado (queda *«pendiente de resolución»*) y el `RF1` toma el anterior;
   pero entonces los 10 días de `S36` se cuentan desde otro cobro, y si el único cobro dentro del
   plazo es el retenido, la revocación no tendría qué devolver. La otra es que `S36` lo devuelve
   por `RF1` y la rama 6 no abre marca sobre él. Pide decisión.
4. **La marca 7 de la sonda del manifiesto nace con default *«devolver»*** (caso 3 de `12-` §5).
   Tampoco la apliqué: `B/19` §6 dice que en las diez filas que proponen algo *«la propuesta no
   depende de nada más que el motivo»* (`DEC-RF-006`), y una excepción para la sonda rompe esa
   regla. Pide decisión: un motivo propio, o declararlo.
5. **La marca 22 abierta sobre un complemento que `S7` ya canceló** (`17-` §5). No se sabe si la
   cancelación la resuelve o la levanta una persona. Pide decisión, aunque `23-` la clasifique
   como texto.
6. **Los avisos del anuncio una sola vez si la mitad de billing se reintenta** (`17-` §5; `23-` §4
   lo da por cerrado en el núcleo y pide decirlo en `B/10` §4.3) y **el sujeto de la acción 16**
   (`18-` §5): tocan el reintento y el sujeto de la acción 16 (`V2-h`, `V2-i`), así que los dejo al
   tramo siguiente.
7. **La segunda corrida del detector sobre un plan anual del viejo** (caso 4 de `12-` §5) sigue
   sin medir. Es una medición del paso 0, no un arreglo de texto, y no la pidió ninguna decisión.
8. **`B/03` §3.2, *«la baja tiene CUATRO filas»***, sigue diciendo que las tres bajas directas no
   tienen período pagado. Lo precisé con la excepción de `S22`, pero el título y el recuento
   (*«cuatro desenlaces»*) quedan: `S22` con crédito es un quinto desenlace en una fila existente.
   No moví la cifra porque cuenta filas y no desenlaces; si se lee como desenlaces, pasa a cinco.

## Key Learnings

1. Una decisión que agrega un destino a una transición (`V2-b`) no mueve el conteo de transiciones,
   pero sí la regla que la transición heredaba por remisión: `S22` con crédito necesitaba la
   selección de complementos de `S11`, o volvía el CRÍT de R1 en esa población.
2. De dos salidas que un caso vecino ofrece como «arreglo de texto», una puede ser imposible
   (`N-A-02`: reanudar un preapproval cancelado choca con `PA-5`), y entonces no hay elección. Y al
   revés: un arreglo clasificado como texto puede chocar con una regla de diseño (el default por
   motivo de `DEC-RF-006`) y pedir decisión.
3. Una cifra puede estar mal sin que nadie la toque: *«Tres cosas»* de `B/19` §6 quedó en tres
   cuando el capítulo se partió y una fila se fue a verticales.
4. «Lo ve el motivo 24» era cierto para la mitad de `EX-47`: un registro que cobra el monto viejo
   da cobro de más si la mutación bajó el precio y de menos si lo subió.
5. La legibilidad de la causa en `S27`/`S28` se apoya en que la marca se abre en el mismo acto; al
   reusar ese argumento para `S26`, que corre 60 días antes que `S21`, el argumento no alcanza.
