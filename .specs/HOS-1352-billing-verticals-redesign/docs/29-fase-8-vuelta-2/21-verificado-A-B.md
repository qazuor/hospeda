---
title: "FASE 9 vuelta 2 · verificación de A y B (máquinas de billing y el corte)"
linear: HOS-1352
statusSource: linear
created: 2026-09-27
updated: 2026-09-27
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2 · verificación A: los hallazgos de los grupos A y B

Verificación con el criterio de `DEC-METH-004` de los hallazgos de la tabla de
[`16-aplicacion-decisiones-tardias.md`](./16-aplicacion-decisiones-tardias.md) §6 cuyo primer
grupo es **A** (`11-`) o **B** (`12-`), incluidos los que después retocó F (`16-`) o G (`17-`).
Medido en el worktree `hospeda-spec-hos-1352-billing-redesign`, HEAD `d421d1ddf1`, sin commits y
sin editar nada fuera de este archivo. Cada camino se re-ejecutó sobre el texto de hoy.

**El alcance, contado con script** sobre la tabla del §6 (columna *grupo · registro*, primer
grupo `A` o `B`): **23 de 56**. Racimos: R1 (2), R2 (4), R3 (2), R4 (3), R6 (2), R8 (2), R17 (3),
R19 (2), R21 (1), R28 (2).

Decisiones del owner que fijan la salida esperada en este alcance: `R1-a`, `R1-b`, `R1-c` (contra
la recomendación), `R2`, `R3-G4-1`, `R4`, `R17`, `R18-b`, `R21` y `R21-b`; y de la vuelta 1,
`G3-1` (precisada por `R2`) y `G1-4`.

## 1. Resumen

**22 DEJA · 1 SIGUE · 0 DECLARADO · 0 OTRA.** Ningún caso vecino es CRITICA. El SIGUE es ALTA
y es de plata: la ventana del corte de `R2` se lee en el `date_created` del registro de cobro, y
ese dato no se mueve con los reintentos, así que el registro que siguió reintentando, que es la
población que `R2` quería alcanzar, sigue asentándose sin marca (§2.2).

| hallazgo | racimo | veredicto | línea que lo corta, o el camino que sigue |
|---|---|---|---|
| `F-8V2B1-001` (CRÍT) | R1 | DEJA | `B/03:159` «Y en el mismo acto cancela en el proveedor los complementos recurrentes que dependen de ella» |
| `F-8V2D1-001` | R1 | DEJA | `B/16:727` «y `S36` la decimocuarta» |
| `F-8V2B1-002` | R17 | DEJA | `B/03:159` «`fin_de_servicio = max(fórmula, fin del crédito)`» |
| `F-8V2B1-004` | R17 | DEJA | `B/03:157` «la cortesía arranca cuando se agota lo que la persona ya pagó» |
| `F-8V2B1-005` | R17 | DEJA | `B/03:184` «el último pago acreditado es el de su predecesora» |
| `F-8V2B1-003` | R4 | DEJA | `B/03:2559` «lo que corre es su gemelo sobre la orden» |
| `F-8V2B2-003` | R4 | DEJA | `B/05:78` «La clave sale del pedido del cliente y no de la» |
| `F-8V2B2-004` | R4 | DEJA | `B/16:1000` «el reenvío lo ejecuta `A3` antes de abandonar» |
| `F-8V2B2-002` | R19 | DEJA | `B/03:1880` «guarda en la fila, junto a su clave, el id de la devolución» |
| `F-8V2B2-005` | R19 | DEJA | `B/03:1881` «que relee cada `refund` en `CONFIRMED` cuando el aviso se perdió» |
| `F-8V2D1-003` | R28 | DEJA | `B/03:820` «seis salidas terminales» |
| `F-8V2D1-004` | R28 | DEJA | `B/12:679` «o revoca desde `GRACE_PERIOD` (`S36`)» |
| `F-8V2B3-002` | R2 | **SIGUE** | `B/02:469` «su `date_created` no se mueve con un reintento» (§2.2) |
| `F-8V2C2-004` | R2 | DEJA | `B/21:486` «ésa la detecta la salvedad 4 del cap. 09 §3 y marca a los 3 días» |
| `F-8V2B1-006` | R2 | DEJA | `B/21:475` «no un número escrito acá» |
| `F-8V2B3-006` | R2 | DEJA | `B/09:188` «recién cuando cerró el registro de cobro del último ciclo de su preapproval» |
| `F-8V2B3-003` | R3 | DEJA | `D/16:131` «Y va antes del 4b» |
| `F-8V2C2-002` | R3 | DEJA | `D/16:132` «Va después del paso 4» |
| `F-8V2A3-002` | R6 | DEJA | `D/16:135` «es lo único del corte que **destruye** algo afuera de la base» |
| `F-8V2C2-001` | R6 | DEJA | `D/16:312` «se devuelve a la ruta del viejo y se verifica con» |
| `F-8V2B3-004` | R8 | DEJA | `B/09:104` «y no manda cancelar» |
| `F-8V2C2-005` | R8 | DEJA | `D/16:132` «Su evento escribe una lápida de recepción con la marca `TRANSICIÓN_NO_DECLARADA`» |
| `F-8V2C2-003` | R21 | DEJA | `B/21:90` «antes del aviso previo hay una pasada de sólo lectura sobre el proveedor» |

Notas de veredicto:

- `F-8V2C2-003` DEJA en su camino (Juan, conocido sólo por el proveedor, recibe el aviso previo
  porque la pasada de sólo lectura lo suma). Queda un residuo declarado, el titular que aparece
  recién en el manifiesto del 1b: `B/21:449` «Con un aviso que no es previo queda sólo el que aparece en el manifiesto del 1b».
- `F-8V2C2-004` DEJA: la cancelación que se deshizo la relee la salvedad 4 y el próximo ciclo nace
  con un registro nuevo, posterior al corte. Si el preapproval revivido tenía además un registro
  abierto, ese cobro cae en el mismo agujero que `F-8V2B3-002`.
- El espejo pendiente de `B/05` que `12-` dejó abierto ya está hecho (§3.2, caso 1).

## 2. Los racimos

### 2.1 R1 · el acto que termina la principal y el complemento recurrente (`F-8V2B1-001`, `F-8V2D1-001`)

**Camino de Juan re-ejecutado.** Juan paga el día 1, tiene un destaque recurrente con aniversario
el 20 y pide la baja el 3. `S11` lleva la principal a `CANCEL_SCHEDULED` con fin el 31 y, en el
mismo acto, cancela el preapproval del destaque (selección de `S32`, en `ACTIVE`) y lo pasa a
`CANCEL_SCHEDULED` con el mismo fin. El 20 no hay cobro. El 31 corre el `S12` de la principal,
la orfandad corre `A5` y `S21` toma el complemento antes que su propio `S12`; su último cobro (el
del mes anterior) no paga días posteriores al 31, así que no abre marca. **El paso 3 del camino
original (el cobro de un mes entero el día 20) ya no llega.** La pantalla dice lo
mismo: `B/19:109` «Desde `ACTIVE` su cobro se corta hoy, en el mismo acto que el del plan».

**Gemelo `F-8V2D1-001`.** Juan revoca dentro de los 10 días. `S36` lo saca de las filas vivas, es
la decimocuarta transición de la lista y dispara la orfandad en el mismo acto; el último cobro del
destaque vuelve por `RF1` si cae dentro de sus propios 10 días:
`B/03:1879` «sobre el último cobro de un complemento cuya principal sacó de las filas vivas `S36`».
El pliego legal quedó en `B/22:123` «Y los addons recurrentes son parte del mismo contrato».

**Los catorce disparadores, recontados contra la tabla.** Extraje con `python3` la columna *hacia*
de `B/03` §3.2: las transiciones que llevan una fila principal a `CANCELLED`, `ABANDONED` o
`CHARGE_DECLINED` son `S3`, `S12`, `S13`, `S16`, `S17`, `S22`, `S23`, `S24`, `S25`, `S27`, `S28`,
`S31` y `S36`, más el espejo del §10.1: **catorce**, las mismas de la lista de `B/16` §4.3
(`S20` y `S21` son sólo de complemento). Los espejos del conteo dicen catorce en `B/16` §4.3 (dos
veces), en `A5` (`B/03:2561` «hoy son catorce») y en el reparto de `S21`. Un `rg` de *doce*,
*trece* y *catorce* junto a *transiciones* o *disparadores*, sin lo tachado, no dejó cifra vieja
viva.

**Recorrido del dominio: todo acto que termina o suspende la principal × el complemento
recurrente.**

| acto sobre la principal | qué le pasa al complemento | dónde se contesta | ¿cubierto? |
|---|---|---|---|
| `S11`, baja desde `ACTIVE` | cancela su cobro en el acto, `CANCEL_SCHEDULED` con el mismo fin | `B/03:159` «Y en el mismo acto cancela en el proveedor los complementos recurrentes que dependen de ella» | sí |
| `S11`, `USER`/`GLOBAL` con otra principal compatible | se excluye si la otra está viva y no pausada, suspendida ni programada | `B/03:159` «ni `CANCEL_SCHEDULED`, ni un ancla viva» | sí, con la lectura que `11-` agregó y nadie confirmó (§3.1, caso 6) |
| `S11`, complemento en `GRACE_PERIOD` o esperando autorización | no entra en la selección; cobra hasta `S12` y va al 14 | `B/16:1063` «Y lo mismo en la baja» | residuo escrito con causa (§3.1, caso 4) |
| fecha de fin, orden `R1-c` | `S21` antes que el `S12` del complemento; motivo 14 si pagó días posteriores | `B/03:160` «corre después de su principal y de la orfandad que ella dispara» | sí |
| el reparto del 14 con `R1-c` | residuo de los días posteriores, lo toma `S21` | `B/03:1380` «lo que queda es el residuo de los días que el último cobro del complemento pagó» | sí (elegida contra la recomendación) |
| `S12` por contracargo (segundo evento) | la principal sale de las filas vivas; orfandad | `B/16:727` «y `S36` la decimocuarta» (misma lista) | sí |
| `S26`, discontinuación | `LISTING` y `VERTICAL_SUBSCRIPTION` de la vertical entran; `USER`/`GLOBAL` no está dicho | `B/03:174` «toda fila viva de la vertical —PRINCIPAL y DE COMPLEMENTO— en `ACTIVE` o `GRACE_PERIOD`» | **no para `USER`/`GLOBAL`**: `N-A-01` |
| `S7` hacia `CANCEL_SCHEDULED` | los que siguen en `ACTIVE`, por la regla de `S11` | `B/03:155` «Y sus complementos los cancela como `S11`» | sí (`R18-b`) |
| el espejo de `R18` | ídem | `B/03:2776` «esas filas de complemento son una `CANCEL_SCHEDULED` de `S11`» | sí (`R18-b`) |
| `S7`, el complemento que `S32` pausó | queda pausado hasta `S12` y lo apaga la orfandad | `B/16:1046` «así que el pausado por `S32` sigue siendo este residuo» | DECLARADO (`DEC-METH-015`, falla hacia no cobrar) |
| `S8`/`S35` (pausa) y `S6` (suspensión, sus cinco eventos) | `S32` lo pausa | `B/03:180` «o pasa a `SUSPENDED` por `S6`» | sí |
| `S9` (cortesía) | no se pausa: la cortesía emite título | `B/03:180` «Las pausas por `COURTESY` no pausan complementos» | sí |
| vuelta de la pausa o de la suspensión | `S33` reanuda; si `S7` va a `CANCEL_SCHEDULED`, no | `B/03:181` «si `S7` la lleva a `CANCEL_SCHEDULED`, esta fila no corre» | sí |
| baja desde `PAUSED` (`S22`), `SUSPENDED` (`S23`), `GRACE_PERIOD` (`S24`) | la principal sale de las filas vivas; orfandad en el acto, cancelación y 14 | `B/16:727` «y `S36` la decimocuarta» (lista) | sí |
| revocación desde cualquiera de sus cuatro estados (`S36`) | orfandad en el acto; `RF1` o 14 | `B/02:989` «ni la orfandad la causó `S36` con ese cobro dentro de sus propios 10 días corridos» | sí |
| `S25`, `S27`, `S28` | orfandad con motivo 15 | `B/03:169` «o por la SEGUNDA con el título muerto por la discontinuación de su vertical» | sí |
| una principal muere por una de las catorce y la otra principal compatible está `PAUSED` o `SUSPENDED` (`USER`/`GLOBAL`) | no hay orfandad (la pausada es fila viva) y `S32` ya pasó: sigue cobrando sin título | ninguna fila | **no**: `N-A-03` |

**Dominio cubierto: sí para el camino principal y para los catorce.** El CRÍT no vuelve en la baja
desde ningún estado. Salen dos huecos en la población `USER`/`GLOBAL` con dos verticales
(`N-A-01`, `N-A-03`) y uno de texto (`N-A-02`), todos fuera del camino principal (§4).

### 2.2 R2 · la lápida del corte y las terminales (`F-8V2B3-002` SIGUE; los otros tres DEJA)

**`F-8V2B3-002`, camino de Juan re-ejecutado.**

1. El 25/11 el viejo rechaza la renovación de Juan. El registro de cobro de ese ciclo nace el
   25/11 y queda reintentando (`GR-3`, `RC-6`).
2. El 05/12 el 1b cancela el preapproval, el paso 2 lo relee `cancelled` y el paso 4 escribe la
   lápida del corte.
3. El 12/12 Juan cambia la tarjeta (`GR-1`) y el reintento de **ese mismo registro** cobra.
4. La regla de `R2` mira el `date_created` del registro:
   `B/21:290` «con `date_created` de ese día o anterior se asienta sin marca».
   Y el registro es uno por ciclo con los reintentos adentro, así que su fecha es el 25/11:
   `B/02:469` «su `date_created` no se mueve con un reintento».
5. El cobro del 12/12 se asienta **sin marca y sin devolución**, igual que antes de `R2`. El
   barrido tampoco lo compara, por la misma fecha:
   `B/09:163` «Un registro aprobado con `date_created` posterior al día del corte sí se compara».

**El texto se contradice a sí mismo.** Dice que el caso posterior es justamente el del registro que
siguió reintentando: `B/21:293` «ya no es un cobro que estaba en vuelo cuando se canceló, sino un registro que»
y `B/21:294` «siguió reintentando después (`GR-3`, `RC-6`, `GR-1`)». Ese registro nació antes del
corte, así que la regla escrita no lo alcanza. La decisión del owner dice *«un cobro sobre una
lápida posterior al día del corte abre marca»*: habla del cobro, no del registro. El detector
posterior lo lista en su segunda corrida (`D/16:262` «Y el detector posterior al corte»), pero su
tarea es *confirmar* que todo cobro posterior abrió su marca, y por la regla éste no tenía que
abrirla: la persona ve un `payment` sin marca que la regla da por correcto. **SIGUE**, ALTA,
plata. Lo que sí alcanza la regla es la cancelación que se deshizo y cobra en un ciclo nuevo
(`F-8V2C2-004`) y el alta tardía (`F-8V2B1-006`, cuya población ahora se lee y no se fija).
Pregunta en el §5.

**`F-8V2B3-006`.** La exención de la terminal espera a que cierre el registro del último ciclo, así
que un reintento que cobra sobre una terminal cae en la comparación y abre su marca:
`B/09:188` «recién cuando cerró el registro de cobro del último ciclo de su preapproval». Dominio:
las dos filas exentas de la tabla llevan la condición (`B/09:209` «cerrado el registro de cobro del ciclo»).

**El espejo de `B/05` que `12-` no podía tocar ya está**:
`B/05:323` «con `date_created` posterior al día del corte», en la tercera fila del desempate. Con
el mismo defecto de fecha que arriba.

### 2.3 R3 · la ventana entre el paso 3 y el 4 (`F-8V2B3-003`, `F-8V2C2-002`)

**Camino re-ejecutado.** Un cobro que el viejo respondió con 500 durante el 1b se reintenta. En el
paso 3 la imagen nueva no sirve la ruta vieja y la URL todavía no apunta al handler nuevo:
`D/16:128` «Y la ruta del handler nuevo es distinta de la del viejo». El paso 4 siembra las
lápidas antes del apuntado, y el apuntado es el 4b: `D/16:131` «Y va antes del 4b». Cuando el
reintento llega, encuentra la lápida del corte y se asienta por `G3-1`. **El paso 3 del camino
original (*«sin lápida del corte, el handler escribe la de recepción»*) ya no llega.** Si la
herramienta choca, distingue (`B/21:191` «la herramienta distingue dos choques»). La frontera de
la rama de aborto incluye el 4 y el 4b (`R3-G4-1`):
`D/16:128` «El paso 3 termina cuando el despliegue está sano, el 3b y el paso 4 verificados».
El reintento que vaya a la URL vieja queda como `EX-46`, `UNKNOWN`, con su residuo escrito.

### 2.4 R6 · la rama de aborto (`F-8V2A3-002`, `F-8V2C2-001`)

**Camino re-ejecutado.** El 3b falla y se aborta. Si el 4b alcanzó a apuntar la URL, se devuelve y
se verifica con una entrega real antes de reencender el webhook viejo:
`D/16:312` «se devuelve a la ruta del viejo y se verifica con». Juan se re-suscribe por el link
reactivado y el viejo lo vincula. **El paso 4 del camino original ya no llega.** Las `L1` no
pierden fotos ni token en el paso 3: el borrado pasó al 5b, fuera del aborto (`D/16:135` «es lo
único del corte que **destruye** algo afuera de la base»). Inventario del dominio (qué cambia el
corte afuera de la base hasta el 4b): la regla del borde (punto 1 de la rama), la URL (a) y la
sonda (b); las revalidaciones del 4c van después de la rama. No encontré un cuarto objeto.

### 2.5 R8 · el handler y el manifiesto de sondas (`F-8V2B3-004`, `F-8V2C2-005`)

La sonda del manifiesto cobra después del corte: el handler escribe lápida, `payment` y marca y
**no cancela** (`B/09:104` «y no manda cancelar»), y el barrido tampoco, porque sin llamada nuestra
no entra a la salvedad 4. La sonda de la entrega del 4b no está en el manifiesto y su marca es la
evidencia de la entrega. Las dos DEJA. El default de la marca 7 sobre la sonda sigue siendo
**devolver** (§3.2, caso 3).

### 2.6 R21 · la población que sólo conoce el proveedor (`F-8V2C2-003`)

Juan se suscribió por el link público y el vínculo del viejo falló. La pasada de sólo lectura,
antes del aviso previo, recorre el proveedor sin filtro y lo suma con su `payer_email`: recibe la
llamada y el correo antes del 1b. **El paso 2 del camino original (*«no aparece en la población»*)
ya no llega.** Residuo declarado: quien aparece recién en el manifiesto del 1b.

### 2.7 R4, R17, R19, R28

- **R4.** Doble clic: el pedido es uno, la clave sale del pedido y la instancia tiene
  `UNIQUE(pedido)` (`B/02:532` «UNIQUE(pedido)»): una sola orden. Timeout: `A3` reenvía con la
  misma clave antes de abandonar. Orden pagada con instancia `ABANDONED`: el barrido la relee por
  id (`B/09:757` «relee la orden por id») y abre el motivo 23. Queda declarado el pago de una
  instancia que sí llegó a `ACTIVE` (`B/16:1004` «Lo que sigue sin ver la conciliación»).
- **R17.** Juan pide la baja el 5 sobre una sucesora que vive del crédito: `fin_de_servicio` es el
  fin del crédito, no el 5. La cortesía re-emitida arranca al fin del crédito
  (`B/14:505` «El `inicio` es el fin del crédito de `DEC-SUB-006` cuando la sucesora vive de él»),
  y `S36` sobre una sucesora sin pagos devuelve el de la predecesora. Queda el caso vecino de
  `S22` (§3.1, caso 1).
- **R19.** Juan revoca, `RF2` parte en dos de 7.500 y el segundo falla: cada llamada guarda su id,
  `RF3` exige que las devoluciones de **esta** fila sumen lo confirmado, así que la fila queda
  `CONFIRMED` y sigue la regla de `RF2`. Con el aviso perdido, el barrido relee todo `CONFIRMED`
  por id (`B/09:737` «lee las devoluciones POR SU ID»).
- **R28.** `PAUSED` tiene seis salidas terminales, y la tabla dice lo mismo: `S13`, `S17`, `S22`,
  `S25`, `S36` y el espejo (contadas sobre la columna *desde*). Las dos filas 6 de `B/12` §5.3
  nombran `S36` (`B/12:730` «o por `S36` desde `GRACE_PERIOD`»).

## 3. Casos vecinos de `11-` y `12-`, hoy

### 3.1 De `11-` (grupo A)

| # | caso | ¿sigue abierto? | severidad | plata | ¿decisión? |
|---|---|---|---|---|---|
| 1 | la baja desde `PAUSED · COURTESY` durante el crédito (`S22`) corta en el acto y pierde el resto del crédito | **sí**: `S22` sigue diciendo `B/03:170` «no queda período pagado que sostener», falso sobre una sucesora que vive del crédito | MEDIA | sí | **owner** (P2) |
| 2 | `S36` desde `GRACE_PERIOD` con un pago retenido por `S19`: `RF1` de `S36` y la marca de la rama 6 sobre el mismo pago | **sí**: `B/03:184` «si además retenía un pago por `S19`» remite a la rama 6, y ninguna de las dos dice que excluye a la otra | MEDIA | sí (dos propuestas de devolución que confirma una persona) | arreglo de texto |
| 3 | el pago de una instancia de única vez que llegó a `ACTIVE` no lo relee ninguna comprobación | sí, declarado: `B/16:1004` «Lo que sigue sin ver la conciliación» | BAJA | sí | ninguna (declarado) |
| 4 | el complemento en `GRACE_PERIOD` o esperando autorización al pedir la baja cobra hasta `S12` y va al 14 | sí, escrito con causa: `B/16:1066` «Causa**: el evento de `S11` es la baja, no el estado» | MEDIA | sí | ninguna: la selección de `S32` es la que eligió el owner en `R1-a` |
| 5 | una extensión de `B/05` C2 sobre la fila de complemento | sí: `rg -i complement` sobre `B/05` da cero | BAJA | no | arreglo de texto |
| 6 | la lectura de la selección de `S32` en la baja con `CANCEL_SCHEDULED` en la exclusión | **sí**: aplicada (`B/03:159` «ni `CANCEL_SCHEDULED`, ni un ancla viva») y nunca confirmada; `17-` y `R18-b` remiten a la selección de `S32` sin decir cuál | MEDIA | sí (sin ella vuelve el CRÍT en dos verticales) | **confirmación del owner** (P3) |

### 3.2 De `12-` (grupo B)

| # | caso | ¿sigue abierto? | severidad | plata | ¿decisión? |
|---|---|---|---|---|---|
| 1 | `B/05` §3 sin espejar | **cerrado**: `B/05:323` «con `date_created` posterior al día del corte» | no aplica | no aplica | no aplica |
| 2 | la herramienta del 3b no dice qué hace si se corre dos veces | sí: la fila 3b (`D/16:130` «escribir los dos `permanent_grant`») no lo dice; la del 4 sí | BAJA | no | arreglo de texto |
| 3 | la marca 7 de la sonda del manifiesto nace con default devolver | sí: `B/09:104` «y no manda cancelar» dice que se levanta sin devolver, pero el motivo sigue con **SÍ** | BAJA | no (tarjeta del owner) | arreglo de texto |
| 4 | la segunda corrida del detector sobre un plan anual del viejo | sí, sin medir | BAJA | sí, indirecta (el detector llega tarde) | medición en el paso 0 |
| 5 | el `payer_email` no se cruza con las cuentas de Hospeda | sí; la llamada lo resuelve | BAJA | no | ninguna |
| 6 | R27, el caché público tras los grants | **cerrado** por el paso 4c (`R27`) | no aplica | no aplica | no aplica |

## 4. Casos vecinos nuevos

### `N-A-01` · MEDIA · `S26` no dice qué hace con un complemento `USER`/`GLOBAL`

**Vecino de qué.** `R1-a` le dio a `S11` la selección de `S32`, y `R18-b` la llevó al espejo y a
`S7`. `S26`, que también manda la principal a `CANCEL_SCHEDULED`, selecciona *«toda fila viva de
la vertical»*, y un `USER`/`GLOBAL` es un scope sin vertical propia
(`B/16:331` «scopes sin vertical propia»); `B/10` dice lo mismo en prosa
(`B/10:194` «Lo mismo con cada suscripción de complemento viva en ella»).

**Camino de Juan.** Juan tiene un `USER` compatible con Gastronomía y Experiencia, y principal sólo
en Gastronomía. El owner discontinúa Gastronomía. Si `S26` no toma el `USER`, su preapproval sigue
vivo en la ventana de 60 días (recibe servicio, porque la principal emite hasta su fin); en el fin,
`S12` → orfandad → `S21` con el último cobro pagando días posteriores. El reparto pone ese `S12`
en el motivo **14** (no devolver), aunque la causa es nuestra y `S27`/`S28` en la misma
discontinuación abren el **15** (devolver). Si en cambio `S26` sí lo toma y Juan tiene principal
viva en Experiencia, el `USER` se cancela aunque conserva título.

**Por qué MEDIA.** Plata de hasta un ciclo, con una persona delante; exige dos verticales, que hoy
no tienen clientes. Pide decisión (P4).

### `N-A-02` · BAJA · la instancia `USER`/`GLOBAL` que queda `ACTIVE` sin fila de complemento

Con la selección aplicada, un `USER` cuya otra principal compatible está `PAUSED` entra en `S11`;
en la fecha de fin no hay orfandad (la pausada es fila viva), y el `S12` del complemento lo cierra:
`B/03:160` «un `USER`/`GLOBAL` con otra principal compatible viva». La instancia no cambia de
estado. Cuando la pausada vuelve, Juan ve un addon `ACTIVE` que ninguna fila cobra ni emite, hasta
que esa otra principal muera. Falla hacia no cobrar y no da acceso. Arreglo de texto: decir que
ese `S12` apaga la instancia o que la re-evaluación la reanuda.

### `N-A-03` · MEDIA · el `USER`/`GLOBAL` que sigue cobrando cuando su último título sin pausar muere por otra vía

**Camino de Juan.** Juan tiene un `USER` compatible con dos verticales. Pausa la principal de
Experiencia: `S32` no toca el `USER`, porque Gastronomía sigue `ACTIVE`
(`B/16:678` «`USER`/`GLOBAL` sólo si no les queda título sin pausar en otra vertical compatible»).
Después, estando en grace en Gastronomía, pide la baja (`S24`). La principal sale de las filas
vivas, pero la orfandad del `USER` no se cumple: la de Experiencia pausada es fila viva y pagando
(`B/16:442` «en ninguna vertical compatible de su producto»). `S32` ya pasó y su evento es el paso
a `PAUSED`, no el estado. El `USER` cobra cada mes sin título hasta que Experiencia vuelva; si en
vez de pausada estaba `SUSPENDED`, sin tope. Ningún detector lo ve.

**Por qué MEDIA y no ALTA.** Es plata cobrada sin servicio y sin detector, pero exige un addon
compatible con dos verticales y clientes con principal en las dos, que hoy no existen. Sube a
ALTA el día que haya. Pide decisión (P5).

## 5. Preguntas para el owner

**P1 · `R2`: con qué fecha se decide que un cobro sobre la lápida del corte es posterior**
(`F-8V2B3-002`, SIGUE). Juan: renovación rechazada el 25/11, corte el 05/12, cambia la tarjeta el
12/12 y el reintento cobra; hoy se asienta sin marca porque el registro es del 25/11.

1. **La fecha del pago que aprobó el registro, no la del registro** (recomendada). Costo: una
   medición en el paso 0 de qué campo del pago trae esa fecha leída por id. Riesgo: si no hay
   campo confiable, vuelve acá. Juan recibe la marca 7 con propuesta de devolver.
2. **Toda lápida cuyo registro la re-verificación leyó abierto se marca al cobrar, con la fecha
   que sea.** Costo: ninguno de medición; la lista de registros abiertos ya se lee. Riesgo: marca
   también un cobro en vuelo del día del corte que `G3-1` decidió no devolver, si su registro
   estaba abierto.
3. Declararlo como residuo de `G3-1`. Riesgo: contradice la letra de `R2`.

**P2 · la baja desde `PAUSED · COURTESY` de una sucesora que vive del crédito** (caso 1 de
`11-`). Juan cambia de anual a mensual, le quedan 40 días de crédito y una cortesía diferida; el día
10 pide la baja: `S22` corta hoy y pierde 30 días que pagó.

1. **`S22` sobre una fila con crédito sin consumir va a `CANCEL_SCHEDULED` con fin en el fin del
   crédito, como `S11` desde `R17`** (recomendada). Costo: una salida nueva de `PAUSED`. Riesgo:
   bajo; es la regla que el owner ya eligió para `S11`.
2. `S22` corta, y una marca propone devolver la parte no usada del crédito. Costo: un motivo nuevo
   (el 25). Riesgo: plata que entra y sale a mano.
3. Declararlo. Riesgo: contradice `R17` (*«el crédito cuenta como período pagado»*).

**P3 · confirmar la selección de `S32` en la baja** (caso 6 de `11-`). Juan tiene un `USER` en dos
verticales y se da de baja en las dos, primero en una y después en la otra.

1. **Sí: en la baja, la exclusión suma `CANCEL_SCHEDULED`** (recomendada, es lo aplicado). En la
   segunda baja se cancela el `USER` y no cobra un ciclo de más.
2. No: la letra de `S32`. Riesgo: el `USER` cobra un ciclo después de las dos bajas y va al 14.

**P4 · `S26` y el complemento `USER`/`GLOBAL`** (`N-A-01`).

1. **`S26` aplica la selección de `S32`, como `S11`, y el `S12` de esos complementos abre el 15**
   (recomendada). Costo: una remisión en `S26` y una fila más en el reparto. Juan no paga el ciclo
   que cruza el fin, o se le propone devolverlo.
2. `S26` toma todo complemento compatible con la vertical. Riesgo: le corta a Juan el addon que
   Experiencia todavía sostiene.
3. Declararlo mientras no haya dos verticales con clientes.

**P5 · el `USER`/`GLOBAL` cuyo último título sin pausar muere por otra vía** (`N-A-03`).

1. **Cuando una de las catorce saca a una principal de las filas vivas y la orfandad de un
   `USER`/`GLOBAL` no se cumple sólo porque las otras compatibles están `PAUSED` o `SUSPENDED`,
   corre `S32` sobre él** (recomendada). Costo: un disparador más de `S32`. Juan deja de pagar
   mientras Experiencia está pausada.
2. Tratar la principal `PAUSED`/`SUSPENDED` como sin título en la orfandad del `USER`/`GLOBAL`.
   Riesgo: se cancela un addon que la reanudación iba a sostener.
3. Declararlo mientras no haya dos verticales con clientes.

## Key Learnings

1. Una ventana de tiempo sobre un cobro se lee en el dato del **cobro**, no del registro que lo
   agrupa: el registro de Mercado Pago es uno por ciclo con los reintentos adentro, así que su
   `date_created` es anterior a todo reintento. `R2` quedó aplicada sobre el dato que excluye
   justo la población que quería alcanzar.
2. Recontar los disparadores de la orfandad contra la columna *hacia* de la tabla (y no contra la
   lista) es lo que prueba que son catorce: la lista puede estar bien y el conteo mal, o al revés.
3. La selección de `S32` se escribió para la pausa y se reusó en la baja, el espejo y `S7`, pero no
   en `S26`. Una regla que se replica por remisión deja afuera al acto hermano que nadie nombró.
4. En `USER`/`GLOBAL` la orfandad mira filas vivas, y una principal pausada o suspendida es viva
   sin dar título: todo camino donde el último título sin pausar muere por otra vía deja un cobro
   sin servicio.
5. Un espejo pendiente de otro registro (`B/05` en `12-`) conviene re-verificarlo por el texto:
   lo cerró un grupo posterior y no quedó anotado en la tabla del §6.
