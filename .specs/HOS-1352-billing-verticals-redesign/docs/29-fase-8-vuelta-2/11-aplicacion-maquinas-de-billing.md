---
title: "FASE 9 vuelta 2 · aplicación — máquinas de billing"
linear: HOS-1352
statusSource: linear
created: 2026-09-27
updated: 2026-09-27
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2 · aplicación — grupo A, máquinas de billing

Racimos R1 (con los dos de R28), R17, R18, R19 y R4 del
[consolidado](./00-hallazgos.md), con las decisiones de
[`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md). Medido y editado en el worktree
`hospeda-spec-hos-1352-billing-redesign`, sin commits. `B/` es `HOS-1354…/docs`.

## 1. Qué se aplicó

### R1 · `R1-a` — la baja cancela el cobro de los complementos (`F-8V2B1-001`)

- `S11` gana las filas de complemento en su `desde`, con la selección de `S32`, `B/03` §3.2:
  `B/03:157` — «y, en el mismo acto, las filas DE COMPLEMENTO en `ACTIVE` que dependen de ella»
- El efecto: cancelar con la regla de la principal, `CANCEL_SCHEDULED` con el mismo fin, y `S12`
  los cierra. `B/03:157` — «El complemento sigue dando servicio hasta esa fecha»
- La nota de `§8` que decía que cancelar el plan no toca los addons, precisada:
  `B/03:2564` — «La baja desde `ACTIVE` cancela su COBRO y no la instancia»
- `B/16` §4.3, al lado de `DEC-ADDON-002` implicación 6:
  `B/16:698` — «baja desde `ACTIVE` ese alguien es `S11`»
- `B/16` §4.3, por qué `S11` no entra a la lista de orfandad, igual que `S26`:
  `B/16:724` — «y `S11` tampoco, por la misma razón: sus»
- `B/16`, NO cierra: el ítem que daba el caso por resuelto por la orfandad, y el residuo del
  complemento que no estaba en `ACTIVE` al pedir la baja.
  `B/16:1049` — «Y lo mismo en la baja»
- El reparto del motivo de `S21` (`B/03` §3.2): la fila del cliente queda sin el ciclo cobrado
  después de la baja. `B/03:1378` — «desde `R1-a` sin el ciclo que el complemento cobraba después de la baja»
- La fila 3-bis de `B/19` §4 (los cuatro scopes, y no promete el corte de lo que no está `ACTIVE`):
  `B/19:109` — «Desde `ACTIVE` su cobro se corta hoy, en el mismo acto que el del plan»

**La lectura de la selección de `S32` que se aplicó.** `S32` excluye, para `USER`/`GLOBAL`, las
principales `PAUSED` o `SUSPENDED` de otra vertical compatible. En la baja la exclusión incluye
también **`CANCEL_SCHEDULED`**. La lectura literal (sin esa palabra) no cancela un `USER` cuyo
titular ya se había dado de baja en la otra vertical, y ese addon vuelve a cobrar un ciclo después
de las dos bajas: es el CRÍT de R1 en otra población. No la tomé como una segunda lectura
legítima, pero queda nombrada para que el orquestador la confirme.

### R1 · `R1-b` y R28 — `S36` en la orfandad (`F-8V2D1-001`, `F-8V2D1-003`, `F-8V2D1-004`)

- `B/16` §4.3, la lista de disparadores, recontada a catorce:
  `B/16:718` — «y `S36` la decimocuarta»
- La fila `S36` dispara la orfandad y devuelve por `RF1` dentro de los 10 días del complemento:
  `B/03:182` — «Y saca a la principal de las filas vivas, así que dispara la orfandad de sus complementos»
- La fila `S21` escribe el caso: `B/03:167` — «Y cuando a su objetivo lo mató»
- El reparto de `S21`, con una fila propia para `S36` y el argumento de que la causa es legible en
  el acto, como en `S27` y `S28`. `B/03:1379` — «ninguno: `RF1`»
- La viñeta del argumento: `B/03:1398` — «también ES el acto»
- `RF1` gana a `S21` como creador: `B/03:1877` — «sobre el último cobro de un complemento cuya principal sacó de las filas vivas `S36`»
- `B/02` §2.5, el motivo 14 excluye el caso: `B/02:969` — «ni la orfandad la causó `S36`»
- `B/16` §4.4 y `B/19` §6, la regla y el default del motivo 14:
  `B/16:898` — «Y tampoco vale cuando a su»
- `B/22` §2.2, la revocación alcanza a los addons:
  `B/22:123` — «Y los addons recurrentes son parte del mismo contrato»
- El espejo de `B/03` §3.2 que declara dónde se recontó `S36`:
  `B/03:494` — «la lista de orfandad, y en las filas 6 de las dos tablas de»
- `F-8V2D1-003`, salidas de `PAUSED` en el recuadro de `S10` y en el §5:
  `B/03:818` — «seis salidas terminales»
- `B/03:1702` — «Las seis terminales mandan la fila a `CANCELLED`»
- `F-8V2D1-004`, la rama 6 de las dos tablas de `B/12` §5.3:
  `B/12:674` — «o revoca desde `GRACE_PERIOD` (`S36`)»
- `B/12:725` — «o por `S36` desde `GRACE_PERIOD`»

### R17 — el crédito cuenta como período pagado (`F-8V2B1-002`, `-004`, `-005`)

- `S11`: lo cerrado el 2026-09-25 va tachado, y queda la fórmula con el crédito:
  `B/03:157` — «el crédito de `DEC-SUB-006` cuenta como período pagado»
- `S9`: la cortesía re-emitida arranca al fin del crédito. `B/03:155` — «la cortesía arranca cuando se agota lo que la persona ya pagó»
- El mismo cambio en `B/14` §4.4 y en `B/02` §2.4 (`fin = inicio + saldo_meses`):
  `B/14:483` — «El `inicio` es el fin del crédito de `DEC-SUB-006` cuando la sucesora vive de él»
- `S36` sobre una sucesora sin pagos: `B/03:182` — «el último pago acreditado es el de su predecesora»

**La lectura de `S9` que se aplicó.** *«Arranca cuando se agota el crédito»* se aplicó moviendo el
`inicio` de la cortesía y no el momento de `S9`: la pausa se sigue abriendo al autorizar, con
`fin_previsto` en el fin de la cortesía, así que cruza exactamente los N cobros que caen desde el
fin del crédito. La otra lectura, correr `S9` el día que se agota el crédito, pide un reloj nuevo y
pausa sobre la fecha misma del primer cobro, con el riesgo de `DEC-GRANT-007` agrandado. Es
mecanismo nuevo, y las reglas lo excluyen.

### R18 — sin aplicar en el diseño (`F-8V2B2-001`)

Hay dos lecturas con daño distinto: va como pregunta abierta, en el §4.

### R19 — la fila de `refund` sabe cuáles son sus devoluciones (`F-8V2B2-002`, `-005`)

- `B/02` §2.3, la fila guarda clave, id y monto de cada llamada:
  `B/02:356` — «por cada llamada al proveedor —el total, o cada parcial de `RF2`— su clave»
- `RF2` guarda el id: `B/03:1878` — «Cada llamada —el total, o cada parcial— guarda en la fila»
- `RF3` lee las devoluciones de la fila, con una parte acreditada no ocurre, y su disparador
  incluye al barrido. `B/03:1879` — «acreditadas las devoluciones de ESTA fila»
- `B/09` §3, la tabla por id y la relectura de todo `refund` en `CONFIRMED`:
  `B/09:705` — «lee las devoluciones POR SU ID»
- `B/09:712` — «es nuestro flujo con el aviso perdido»

*«Menos devuelto que lo asentado»* no pide detector propio: con `RF3` leyendo por id, un `EXECUTED`
no puede asentar más de lo que el proveedor muestra. Está dicho en `B/09` §3.

### R4 — el cobro de única vez (`F-8V2B1-003`, `F-8V2B2-003`, `F-8V2B2-004`)

- `A1`, el identificador del pedido: `B/03:2555` — «nace con el identificador del pedido del cliente»
- `A3`, el reenvío antes de abandonar: `B/03:2557` — «lo que corre es su gemelo sobre la orden»
- `B/16` §1.4: `B/16:100` — «Y la clave sale del PEDIDO del cliente, no de la llamada»
- `B/05` §1.2: `B/05:78` — «La clave sale del pedido del cliente y no de la»
- `B/02` §2.4, `addon_instance`: `B/02:522` — «UNIQUE(pedido)»
- El ítem de lo que `B/16` no cierra, reescrito: `B/16:988` — «quedó acotada el 2026-09-27»
- `B/09` §3, la comprobación nueva: `B/09:725` — «relee la orden por id»
- El motivo nuevo, el 23, `ORDEN_PAGADA_SIN_INSTANCIA`, en la tabla de `B/02` §2.5:
  `B/02:978` — «ORDEN_PAGADA_SIN_INSTANCIA»
- La marca que cuelga de la instancia, en `reconciliation_mark`:
  `B/02:48` — «sólo con el motivo 23, la instancia de addon»
- Su default en `B/19` §6: `B/19:226` — «ORDEN_PAGADA_SIN_INSTANCIA` (motivo 23)»

**Por qué hizo falta un motivo nuevo.** La comprobación abre una marca y `G-R1-F` rechaza una marca
sin un motivo de la lista cerrada. Ninguno de los 22 servía: el 19 dice *«la plata entró bien,
falta asentarla»* y lleva **no**; el 18 es un reembolso que ya salió; el 11 es una instancia viva
con el título muerto. El 23 lleva **SÍ**: la persona pagó y no tiene el addon, y la instancia
`ABANDONED` no vuelve.

**Y por qué la marca cuelga de la instancia.** `reconciliation_mark` exigía una suscripción, y el
addon de única vez no tiene ninguna. La salida copia la forma de `payment` (§2.3): dos referencias
con un CHECK de exactamente una, y la de la instancia sólo con el motivo 23.

**El sujeto es `ABANDONED` y no *«sin instancia viva»* a secas**: una `EXPIRED` o una `CANCELLED`
de única vez pasaron por `ACTIVE`, y su orden pagada es el cobro normal de lo que recibieron.

### Unidades (`$B/descomposicion.md` §2 y §4)

| qué | unidad | criterio |
|---|---|---|
| `S11` cancela el cobro de los complementos; `max(fórmula, fin del crédito)` | **B8** | `$B/descomposicion.md:729` |
| `S36` en la orfandad y el `RF1` de `S21`; lectura de la instancia por pedido | **B10** | `$B/descomposicion.md:731` |
| `S36` sobre una sucesora; la fila de `refund` con sus ids | **B5** | `$B/descomposicion.md:726` |
| `RF2`/`RF3` por id; la orden con la clave del pedido | **B6** | `$B/descomposicion.md:727` |
| la cortesía re-emitida desde el fin del crédito | **B9** | `$B/descomposicion.md:730` |
| la comprobación de órdenes pagadas (motivo 23) y la relectura de los `CONFIRMED` | **B11** | `$B/descomposicion.md:732` |

- El criterio de B10 que afirmaba lo contrario de `R1-a`, tachado:
  `$B/descomposicion.md:731` — «darse de baja (`S11`) cancela en el acto el preapproval»
- Quién abre el motivo 23: `$B/descomposicion.md:489` — «comprobación de órdenes pagadas del `09` §3, que va con B11»

## 2. Conteos recontados

| lista | antes | ahora | comando | espejos actualizados |
|---|---|---|---|---|
| disparadores de orfandad, `B/16` §4.3 | 13 | **14** (`S36`) | extraer los `S\d+` del párrafo de `B/16` §4.3 hasta *«`S26` no entra»*, menos `S11`/`S26`, más el espejo | `B/16` §4.3 (lista y recuadro, dos veces), `B/03` §3.2 (recuento del reparto, *«cinco de catorce»*, *«cuál de las catorce»*), `B/03` §8 `A5` (*«hoy son catorce»* y *«cualquiera de las catorce»*), `B/19` §6 fila del 14 (*«doce»* → catorce, dos veces) |
| *«las otras ocho»* del reparto de `S21` | 8 | **8** | `S36` va en fila propia | — |
| salidas de `PAUSED` en `B/03` | 5 terminales + `S6` | **6** terminales + `S6` (`S36`) | la columna *desde* de la tabla del §3.2 | `B/03` recuadro de `S10` (dos veces) y §5; ya decía siete `B/09` §3 |
| motivos de la marca, `B/02` §2.5 | 22 | **23** | `python3` sobre las filas `\| N \| \`MOTIVO\` \|` de la tabla | `B/02` (título, recuadro, *«otras veintidós marcas»*, `S14` 12 de 23, otros actos 10 → 11, párrafo nuevo), `B/03` §3.1 y `S14`, `B/09` §2.4, `B/12` §5.3, `B/19` §6 (dos), `$B/descomposicion.md` (tres), **núcleo**: `nucleo/01:713`, `nucleo/01:742`, `nucleo/03:42`, `nucleo/04:64`, `nucleo/08:158`, `nucleo/08:376` |
| motivos con `SÍ` | 7 | **8** (el 23) | el mismo script sobre la última columna: SÍ 1, 2, 3, 7, 12, 15, 20, 23; puede 4, 13, 14; no los otros doce | `B/02` (tres), `B/03` §3.1, `B/05` C2, `B/09` §2.4 (dos), `B/19` §6 (dos), `B/20` `G-R1-F`, `$B/descomposicion.md:116`, **núcleo**: `nucleo/01:713`, `nucleo/01:742`, `nucleo/03:44`, `nucleo/04:64`, `nucleo/08:158` |
| actos que no son `S14` y abren marca | 10 | **11** | `B/02` §2.5, recontado | `B/02` §2.5, `$B/descomposicion.md:489` (*«once de los veintitrés»*) |
| filas de defaults de `B/19` §6 | 9 (7 devolver) | **10** (8 devolver) | `awk` sobre la tabla | el párrafo de abajo de la tabla |
| comprobaciones de cero llamadas | 6 | **6** | la nueva relee la orden por id | dicho al lado de la comprobación, y la lista de `B/09` §7.1 la nombra |

Los espejos del núcleo son sólo conteos: cambié la cifra y la nombré, sin tocar otra cosa.

## 3. Propuestas para el log y la matriz

1. **`DEC-ADDON-002`, implicación 6** (`$D/01-decision-log.md:1984`). Razón: la frase *«Cancelar
   el plan NO cancela los addons»* es la que `R1-a` precisa, y el log no lo dice. Texto propuesto,
   debajo de la implicación:
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R1-a`)**: la baja desde
   > `ACTIVE` (`S11`) cancela en el proveedor, en el mismo acto y con la misma regla que la
   > principal, los complementos recurrentes que dependen de ella —la selección de `S32`—; siguen
   > dando servicio hasta el fin de servicio y `S12` los cierra. Lo que sigue valiendo es que la
   > instancia no se apaga con el plan: la apaga la orfandad.
2. **`DEC-GRANT-007`** (`$D/01-decision-log.md:3787`). Razón: su título dice *«se re-emite sobre la
   sucesora cuando autoriza»*, y desde `R17` el período de la cortesía arranca al agotarse el
   crédito. Texto propuesto:
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R17`)**: sobre una sucesora
   > que vive del crédito de `DEC-SUB-006`, la cortesía re-emitida arranca al agotarse el crédito;
   > `S9` sigue corriendo al autorizar y la pausa cruza los N cobros que caen desde ese día.
3. **`DEC-RF-001`** (`$D/01-decision-log.md:1613`). Razón: la revocación ahora alcanza al pago de
   la predecesora y a los complementos. Texto propuesto:
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R17` y `R1-b`)**: sobre una
   > sucesora sin pagos, el pago que se devuelve es el de su predecesora, que se encuentra por
   > `sucedida_por`; y la orfandad que causa la revocación devuelve por `RF1` el último cobro de
   > cada complemento recurrente sólo si cae dentro de sus propios 10 días corridos; si no, va al
   > motivo 14.
4. **`DEC-SUB-009`** (`$D/01-decision-log.md:1236`). Razón: la cláusula del 2026-09-25 que fijaba
   el fin en el acto para la fila sin `covered_period` es la que `R17` precisa. Texto propuesto:
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R17`)**: el crédito de
   > `DEC-SUB-006` cuenta como período pagado: `fin_de_servicio = max(fórmula, fin del crédito)`.
   > El fin en el acto queda sólo para la fila sin `covered_period` y sin crédito.
5. **`DEC-RF-006`** (`$D/01-decision-log.md:4920`). Razón: la lista de motivos que esa decisión
   volvió a leer por motivo pasa a 23, con 8 `SÍ`. Texto propuesto:
   > 📌 **2026-09-27 (FASE 9 vuelta 2, `R4`, con OK del owner)**: se agrega el motivo 23,
   > `ORDEN_PAGADA_SIN_INSTANCIA`, con `SÍ` y default devolver, colgado de la instancia del addon de
   > única vez; es el único que no cuelga de una suscripción.
6. **Matriz, fila nueva junto a `EX-41`** (`$D/06-mp-validation-matrix.md:397`). Razón: `A3`
   reenvía la orden con la misma clave y el mismo cuerpo **hasta 72 h o 7 días después**, y `EX-41`
   midió el reenvío inmediato. Texto propuesto:
   > | **EX-43** ✚ | ¿Reenviar una orden con la misma clave y el mismo cuerpo horas después —con el
   > token de la tarjeta ya vencido— devuelve la misma orden si existía, y qué devuelve si nunca se
   > creó? | `A3` sobre el addon de única vez (`B/03` §8; FASE 9 vuelta 2, `R4`) | `UNKNOWN` | — |
   > — | — | Pendiente de sonda. Si devuelve error cuando la orden existía, `A3` no la ve pagada y el
   > caso cae en la comprobación de órdenes pagadas del barrido. |
   Con esa fila, el recuento de la matriz pasa de 99 a 100 filas y los `UNKNOWN` de 5 a 6.
   Tiene espejos en `B/spec` §5.2, `$B/descomposicion.md` §2.7 y `B/06`, que no toqué.

## 4. Preguntas abiertas

1. **R18: qué pasa con la fila que cobró después de que `S6` o `S3` ya mandaron cancelar.** Las
   dos lecturas que admite el diseño sin mecanismo nuevo:
   - **A — como `S7`**: el espejo del `B/03` §10.1, sobre una fila `ACTIVE` con un
     `covered_period` vigente, cuyo preapproval se lee `cancelled` **y cuya cancelación mandamos
     nosotros** (existe el correo *«antes de cancelar»* de ese hecho, precisión 3 del §3.2), no
     corta: lleva la fila a `CANCEL_SCHEDULED` con la fórmula de `S11`. Es la misma respuesta que
     el owner dio al orden inverso de `B/05` C1 (`S7`, 2026-09-25). **Daño**: Juan recibe el
     período que pagó y la suscripción termina al final, aunque él acababa de cambiar la tarjeta
     para seguir. Tiene que volver por el checkout, y el correo que ya recibió decía que se
     cancelaba. Sin marca y sin plata de por medio.
   - **B — marca**: el espejo corta como hoy, pero sobre una fila con `covered_period` vigente abre
     una marca que propone devolver el período. **Daño**: Juan pierde el servicio el día después de
     pagar, y la plata vuelve sólo si una persona lo confirma. Además hace falta decidir qué motivo
     es: ninguno de los 23 nombra este caso.
   - La salida que proponía el consolidado, que `S5` y `S2` relean el preapproval, no alcanza sola:
     si la cancelación sale después de esa relectura, la carrera sigue. Mi recomendación es **A**.
     Con A, `F-8V2B2-001` se cierra en el §10.1 (una salvedad más en el par `cancelled` × vivo) y
     en `B/05` C1 (los dos órdenes vuelven a terminar en el mismo estado).
2. **R1-a: si la marca 14 del período del complemento posterior al fin de servicio se abre o no.**
   En la fecha de fin corren dos cosas sobre el complemento que `S11` puso en `CANCEL_SCHEDULED`:
   su propio `S12`, y la orfandad que dispara el `S12` de la principal (`A5` → `S21`). Si `S21`
   llega primero, lo cierra y abre el motivo 14 cuando el último cobro del complemento paga días
   posteriores al fin de la principal. Si llega primero `S12`, `S21` encuentra la fila `CANCELLED`
   y no escribe nada. **Daño de cada lectura**: la propuesta es *no devolver* en los dos casos. La
   diferencia es si una persona ve el caso y puede apartarse, en un residuo de hasta un ciclo menos
   un día. El mismo orden ya estaba sin decir para los complementos de `S26` (el reparto nombra
   *«`S12` cuando su `CANCEL_SCHEDULED` lo puso `S26`»* como camino del 14). Hay que elegir el
   orden, o decir que `S21` también toma la fila de complemento en `CANCEL_SCHEDULED` en la fecha
   de fin.

## 5. Casos vecinos

- **La baja desde `PAUSED · COURTESY` durante el crédito** (`S22`) corta en el acto, y desde `R17`
  el crédito es período pagado. La sucesora con cortesía re-emitida está pausada desde que autoriza
  (`S9`), así que su baja no es `S11` sino `S22`, y pierde el resto del crédito. No es mío: es la
  regla de `S22`, que `DEC-GRANT-004` decidió para la cortesía y no para el crédito.
- **`S36` desde `GRACE_PERIOD` con un pago retenido por `S19`** abre dos caminos de reembolso sobre
  el mismo pago: el `RF1` de `S36` y la marca 1 de la rama 6 (`D1`, *«fuera de mi vector»*).
  Sigue abierto.
- **El pago de una instancia de única vez que sí llegó a `ACTIVE`** no lo relee ninguna
  comprobación: un contracargo o un reembolso desde el panel sobre él no se ve. Quedó declarado en
  el «NO cierra» de `B/16` y de `B/09`, sin arreglo.
- **El complemento en `GRACE_PERIOD` o esperando autorización al pedir la baja** no entra en la
  selección de `S32`, y cobra hasta `S12`. Quedó declarado en el «NO cierra» de `B/16`, con la
  misma causa que el residuo de la pausa.
- **Una extensión de `B/05` C2 sobre la fila de complemento**: un cobro del complemento anterior a
  la baja que se acredita tarde extiende su `fin_de_servicio` con `max`, y esa fecha no puede
  pasar la de la principal, porque sin título el complemento no emite nada. No da daño de plata,
  pero C2 no lo nombra.

## Key Learnings

1. Una fila viva que termina la relación (`CANCEL_SCHEDULED`) no dispara la orfandad. Por eso
   *«cancelar el plan no cancela los addons»* y *«la orfandad lo apaga»* dejaban un ciclo entero
   sin nadie, aunque las dos frases eran ciertas por separado.
2. Agregar un motivo mueve dos conteos, el total y el de `SÍ`, y los dos tienen espejos en el
   núcleo: fueron seis archivos del núcleo para un solo motivo. Buscar por la palabra
   (`veintid`, `siete`) encontró más que buscar por el número.
3. La selección de `S32` estaba escrita para la pausa. Llevada a la baja necesitó sumar
   `CANCEL_SCHEDULED` a la exclusión, o el caso de las dos verticales daba de nuevo el mismo CRÍT.
4. Para *«arranca al agotarse el crédito»* alcanzó con mover el `inicio` de la cortesía, sin mover
   el momento de `S9`. Moverlo pedía un reloj nuevo y pausaba en la fecha misma del primer cobro.
5. La pregunta de R18 tiene precedente del owner en el orden inverso (`S7`). La recomendación sale
   de ahí, pero las dos lecturas tienen distinto daño y la elección no es mía.
