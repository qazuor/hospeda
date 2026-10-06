---
title: "FASE 9 vuelta 2 · aplicación — grupo F, decisiones tardías"
linear: HOS-1352
statusSource: linear
created: 2026-09-27
updated: 2026-09-27
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2 · aplicación — grupo F, las decisiones tardías del owner

Las filas de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md) desde `R18` hasta el
final: `R18`, `R20`, `Q-ALTAS`, `R24`, `Q-FECHA`, `R11-3b`, `R21-b`, `R3-G4-1`, `R1-c`, `R7-b`,
`R23`, `R25`, `R27` y `R9-b`. Medido y editado en el worktree
`hospeda-spec-hos-1352-billing-redesign`, sin commits, sobre lo que dejaron commiteado los grupos
A a E (`dd24c4a14b`). Leí enteros sus registros [`11-`](./11-aplicacion-maquinas-de-billing.md),
[`12-`](./12-aplicacion-el-corte.md), [`13-`](./13-aplicacion-la-costura.md),
[`14-`](./14-aplicacion-verticales.md) y [`15-`](./15-aplicacion-coherencia.md). `B/` es
`HOS-1354…/docs`, `V/` es `HOS-1353…/docs`, `D/12` es el contrato y `D/16` es la FASE 7 del
paraguas.

## 1. Qué se aplicó

### `R18` — el espejo lleva a `CANCEL_SCHEDULED` a quien pagó mientras ya mandábamos cancelar (`F-8V2B2-001`)

**La excepción de `GRACE_PERIOD` no lo cubría.** La salvedad de `B/03` §10.1 que termina en
*«eso es `S6` por su primer evento, que ya mandó esa cancelación y todavía no escribió»* es sobre
una fila que **sigue** en `GRACE_PERIOD`. En `R18` el pago (`S5`) o la autorización (`S2`) ya la
llevaron a `ACTIVE`, así que caía en *«espejar la baja decidida por el proveedor»*. Hacía falta
una salvedad propia.

- La salvedad nueva del par `cancelled` × vivo, reconocida por el correo *“antes de cancelar”*
  de ese `S6` o ese `S3`, que se encola antes de la llamada (precisión 3):
  `B/03:2776` — «y salvo sobre una fila `ACTIVE` cuyo preapproval canceló una transición nuestra»
- El destino, con la fórmula de `S11` y sin marca:
  `B/03:2776` — «Eso no es la baja del proveedor: la fila va a `CANCEL_SCHEDULED`»
- `B/05` C1, el orden en que el pago gana a `S6`:
  `B/05:97` — «Pero si `S6` ya había mandado la cancelación»
- `B/12` §1.4: `B/12:136` — «Y una cancelación que mandamos nosotros tampoco es una baja del proveedor»
- La pantalla, fila 22 nueva de `B/19` §4, que cubre también a `S7`, el precedente que nombra la
  decisión: `B/19:140` — «pagó el período mientras nosotros ya habíamos mandado»
- Con eso se cierra el ítem del “NO cierra” de `B/19` sobre la pantalla de `S7`, que estaba
  declarado por `DEC-METH-015`: `B/19:324` — «22 del §4, que el owner escribió para el espejo»
- Unidad **B7** (la mora), fila y criterio:
  `$B/descomposicion.md:133` — «va a `CANCEL_SCHEDULED` por el espejo, no a `CANCELLED`»
- `$B/descomposicion.md:740` — «el `cancelled` que llega después deja la fila en `CANCEL_SCHEDULED`»

**Lo que no apliqué**: qué pasa con los complementos de esa principal. Va como pregunta 1 (§4).

### `R20` — el barrido compara el importe cobrado, y el motivo 24 (`F-8V2B3-001`)

- La comparación nueva, en la fila *“cobros del período”* de `B/09` §3:
  `B/09:163` — «Y cada registro aprobado que sí tenemos acreditado se compara por IMPORTE»
- El motivo 24, `IMPORTE_COBRADO_DE_MÁS`, con **SÍ** y propuesta de devolver **la diferencia** por
  `RF1`: `B/02:999` — «No se abre sobre un pago colgado de otra marca abierta»
- Su nota de conteo en el recuadro y su párrafo de recuento:
  `B/02:944` — «Y eran veintitrés hasta la misma FASE 9 vuelta 2»
- `B/02:1063` — «Y se movieron tres de las cifras con el 24»
- Su default en `B/19` §6: `B/19:228` — «el proveedor cobró más que el monto esperado del período»
- El 24 lo abre `S14`, como el 19, que sale de la misma comparación:
  `B/03:162` — «el 24 sí, desde la comparación de cobros»
- **La promo se decrementa sólo si el cobro salió con el descuento** (`P1`, `B/02` §2.4 y
  `B/14` §2.4): `B/03:1796` — «sólo si el cobro salió con el descuento»
- `B/02:630` — «Y sólo si el cobro salió con el descuento»
- `B/14:249` — «Y un cobro que salió sin el descuento tampoco»
- Unidades: la comparación y el motivo, **B11**; el contador, **B9**:
  `$B/descomposicion.md:137` — «y abre el motivo 24 si cobró de más»
- `$B/descomposicion.md:744` — «abre el motivo 24 con propuesta de devolver 15.000»
- `$B/descomposicion.md:135` — «y el contador de una promo baja sólo con un cobro que salió con el descuento»
- `$B/descomposicion.md:742` — «sigue con `cobros_restantes = 1`»
- Quién abre el 24, en la cuenta de lo que abren otras unidades que el guard `G-R1-F` lee:
  `$B/descomposicion.md:488` — «y el 24, `IMPORTE_COBRADO_DE_MÁS`, con la comparación de cobros»

**Tres precisiones de escritura**, que salen de lo que la decisión dice y no agregan mecanismo:

- **El esperado es el del período, no el del día del barrido**: el precio y los aumentos vigentes
  a la fecha del cobro, y las promos según su contador **antes** de ese cobro. Si no, un cobro con
  descuento se compararía contra el precio restituido después por `S30`.
- **No se abre sobre un pago colgado de otra marca abierta** (el 2, el 3, el 7, el 20…), que ya
  propone qué hacer con el pago entero. Sin eso, un mismo cobro llevaba dos propuestas de
  devolución que se suman.
- **Un importe menor que el esperado no abre el 24**: la decisión habla de devolver una diferencia,
  y ahí no hay nada que devolver. Queda en los casos vecinos (§5).

### `Q-ALTAS` — el acto de discontinuar tiene dos mitades

- `B/10` §4.3: `B/10:160` — «Y el acto tiene dos mitades, una por épica»
- El orden: `B/10:163` — «La acción administrativa del acto las»
- `V/02` §2.1, quién escribe `admite_altas`:
  `V/02:118` — «Y la escribe verticales, en una sola ocasión: la mitad de»
- Unidades: la mitad de verticales, **V2** (fila, criterio y fila ✚ del §2.10); la de billing,
  **B12**: `$V/descomposicion.md:408` — «la mitad de verticales del acto de discontinuar: escribe»

**`NUCLEO/08` no nombra el acto**: el catálogo de acciones administrativas no tiene la fila de
*«discontinuar una vertical»*. No la agregué, porque la decisión dice *«la acción administrativa
existente»* y agregarla mueve el conteo de quince. Va a casos vecinos (§5).

### `R24` — una vertical sin planes vendibles no arranca trials, y cerrarla es discontinuarla (`F-8V2A3-005`)

- `T1` exige una versión vigente y vendible:
  `V/03:51` — «y la vertical tiene al menos una versión de plan vigente y vendible»
- La fila nueva en la tabla de las consecuencias del par `T1`/`T6`:
  `V/03:308` — «pero la vertical no tiene ninguna versión de plan vigente y vendible»
- La pantalla: la fila 29 nueva de `V/19` §4, y la fila 21 le remite ese caso.
  `V/19:76` — «esta vertical no tiene planes disponibles»
- El botón de la fila 23 gana el caso:
  `V/19:70` — «(1-bis) si la vertical no tiene ninguna versión de plan vigente y vendible»
- Y su espejo en billing: `B/19:139` — «cuatro desenlaces son publicar, el checkout»
- `B/10` §4.1, lo tachado: `B/10:135` — «Y tampoco la cierra»
- `B/10:141` — «Cerrar una vertical a»
- La situación *“cerrada a altas”* de la tabla de `B/10` §4.6 deja de existir:
  `B/10:412` — «ya no existe»
- Unidades: **V4** (la guarda) y **V8** (la pantalla):
  `$V/descomposicion.md:409` — «`T1` exige una versión de plan vigente y vendible; la pantalla»

Elegí la fila nueva (29) y no ajustar la 21: la 21 dice *«suscribite para publicar»*, que es
justo lo que no hay que decir sin planes vendibles, y la 20 dice *«ya no admite altas»*, que es
falso sin discontinuación.

### `Q-FECHA` — `vertical_discontinuation`

- La entidad nueva de `B/02` §2.1: `B/02:32` — «una fila por vertical discontinuada»
- Por qué se guarda y por qué no hay copia en verticales:
  `B/02:38` — «La fecha de fin de servicio de una vertical se guarda, y no se calcula en cada pregunta»
- El ⚠️ del grupo C en `B/10` §4.6, reemplazado:
  `B/10:431` — «Cerrado el 2026-09-27 (owner, FASE 9 vuelta 2, `Q-FECHA`, derivada de `R5`)»
- El acortamiento de `B/10` §4.4 la reescribe:
  `B/10:377` — «Y ese acto reescribe la fecha en la fila de la»
- El contrato: `D/12:1119` — «La real contesta de `vertical_discontinuation`»
- Unidad **B12**; **B4** prueba con la fila sembrada:
  `$B/descomposicion.md:138` — «y la fecha la guarda `vertical_discontinuation`»
- `$B/descomposicion.md:745` — «anunciar escribe una fila de `vertical_discontinuation`»
- `$B/descomposicion.md:130` — «que B4 prueba con una fila de `vertical_discontinuation` sembrada»
- `$B/descomposicion.md:737` — «corre contra una fila de `vertical_discontinuation` sembrada en el juego»

### `R11-3b` — revertido a Alojamiento (`F-8V2B3-009`, `F-8V2C1-004`)

`rg -n "en que tenían|de Alojamiento"` sobre el alcance encontró la corrección en tres lugares:
`D/16`, `B/21` y `$B/descomposicion.md`. `B/14` y el contrato no la tenían. Quedó tachada, con la
letra de `G1-3` y el hecho del owner. La validación de la versión por `políticaDePlan(v).vigente`
(`F-8V2C1-004`) no se revirtió: es otra cosa.

- `D/16:130` — «de Alojamiento, en la vertical en que tenían `comp` ~~—el de Alojamiento»
- `B/21:140` — «tenían `comp` ~~—el de Alojamiento»
- `$B/descomposicion.md:135` — «revertido por el owner el 2026-09-27»

### `R21-b` — la pasada de sólo lectura antes del aviso previo (`F-8V2C2-003`)

- `B/21` §1.3: `B/21:91` — «Y su aviso es previo»
- `B/21:92` — «antes del aviso previo hay»
- El “NO cierra”, acotado a quien aparece recién en el 1b:
  `B/21:450` — «Desde `R21-b` se entera antes, por el aviso previo»
- `D/16` §4.2: `D/16:211` — «que sólo conoce el proveedor el aviso también le llega antes»
- La herramienta 1 del corte: `D/16:256` — «y la pasada de sólo lectura antes del aviso previo»

Unidad: la herramienta 1, de la FASE 7 del paraguas (`D/16` §4.2). No es de ninguna épica.

### `R9-b` — el recuento de Gastronomía y Experiencia también antes del 1a

- `D/16`, fila 1a: `D/16:124` — «no arranca si el recuento de fichas de Gastronomía y de Experiencia, tomado antes del 1a, da una fila»
- La fila 2 queda como segundo control: `D/16:126` — «Es el segundo control»
- `B/21` §1.3: `B/21:76` — «Y se cuentan también»
- `V/21` §2.4: `V/21:179` — «Y el recuento se hace también antes del 1a»
- Unidad **V6** (fila ✚ del §2.10):
  `$V/descomposicion.md:410` — «el recuento de Gastronomía y Experiencia también antes del 1a»

### `R1-c` — `S21` antes que `S12` en la fecha de fin (`F-8V2B1-001`, pregunta 2 de `11-`)

- `S11` ya no dice que los cierra `S12`:
  `B/03:159` — «en esa fecha los cierra `S21`, antes que su propio `S12`»
- El orden, en la condición de `S12`, para las filas de `S11` y de `S26`:
  `B/03:160` — «Sobre una fila DE COMPLEMENTO, por el primer evento, corre después de su principal»
- El reparto de `S21`, en las dos filas que abren el 14:
  `B/03:1380` — «lo que queda es el residuo de los días que el último cobro del complemento pagó»
- `B/03:1379` — «con el complemento, también en `CANCEL_SCHEDULED` por `S26`, tomado por `S21`»
- `B/16` §4.3: `B/16:701` — «En la fecha de fin los toma `S21`, antes que su»
- Unidad **B10**: `$B/descomposicion.md:136` — «en la fecha de fin `S21` toma el complemento en `CANCEL_SCHEDULED` antes que su propio `S12`»
- `$B/descomposicion.md:743` — «el 15/10 el destaque termina `CANCELLED` por `S21`»

### `R23` — el seudónimo con una lista cerrada de proveedores (`F-8V2A3-004`)

- `V/02` §2.2, el punto 1: `V/02:341` — «y sin el `+alias` ni los puntos de la parte local sólo en una lista»
- El punto 3: cambiar la lista no recalcula, y se declara:
  `V/02:353` — «La lista de proveedores del punto 1 sí puede cambiar»
- El ⚠️ del grupo D, reemplazado: `V/02:364` — «Cerrado por el owner el 2026-09-27»
- Unidad **V9**: `$V/descomposicion.md:529` — «comparten seudónimo»

### `R25`, `R27`, `R7-b` y `R3-G4-1` — ya aplicados

Busqué en el alcance cada hallazgo (`B3-005`, `C2-006`, `A1-003`, `A2-005`, `B3-003`) cerca de
*pregunta*, *confirm*, *⚠️* o *abierta*. **Ninguno los presenta como pregunta abierta**: las
preguntas vivían sólo en los registros `12-`, `14-` y `15-`, que no se editan. Una sola cosa
faltaba escribir: **`R7-b` dice que la pantalla deriva a soporte**, y `V/18` §2.4 decía que el
cambio no se permite pero no qué ve la persona.

- `V/18:271` — «El cambio se rechaza mientras haya vínculo, y la pantalla lo deriva a»

## 2. Conteos recontados

Todo con `python3` sobre la fuente, descontando lo tachado (`re.sub(r'~~.*?~~','',…)`), y cada
espejo buscado por número y por palabra (`veintitr`, `veintid`, `ocho`, `doce`, `siete`) sobre
`$D/nucleo`, `$V`, `$B`, el contrato y `D/16`.

| lista | antes → ahora | comando | espejos actualizados |
|---|---|---|---|
| motivos, `B/02` §2.5 | 23 → **24** | filas `^\| \d+( ✚)? \| \`MOTIVO\` \|` de la tabla | `B/02` (título del §2.5, recuadro, *«las otras veintitrés marcas»*, `S14` y otros actos, párrafo de recuento, *«Qué cambia con el motivo»* punto 1), `B/03` §3.1 (recuadro) y `S14`, `B/05` C2 y §3 (*«los otros veintitrés»*), `B/09` §2.4 (dos), `B/12` §5 (*«las otras veintitrés»*, dos, y *«veinticuatro motivos»*), `B/19` §6 (tres), `B/20` `G-R1-F`, `$B/descomposicion.md` (115, 116, 483, 488, 491, 500); **núcleo**: `nucleo/01:718`, `nucleo/01:747` (dos), `nucleo/03:42`, `nucleo/04:64`, `nucleo/08:158`, `nucleo/08:378` |
| motivos con `SÍ` | 8 → **9** | la última columna de la misma tabla: SÍ 1, 2, 3, 7, 12, 15, 20, 23, 24 · puede 4, 13, 14 · no los otros doce | `B/02` (título, *«las nueve filas»*, punto 1), `B/03` §3.1, `B/05` C2, `B/09` §2.4 (dos), `B/19` §6 (*«adelante los nueve»*, *«los otros ocho»*, *«nueve SÍ»*), `B/20` `G-R1-F`, `$B/descomposicion.md:116`; **núcleo**: `nucleo/01:747`, `nucleo/03:44`, `nucleo/04:64`, `nucleo/08:158` (dos) |
| motivos que abre `S14` · otros actos | 12 · 11 → **13 · 11** | primera celda de cada fila, empieza por `S14` | `B/02` (*“trece de los veinticuatro”*, *“once de los veinticuatro”*), `B/03` `S14`, `$B/descomposicion.md:483` y `:500` |
| filas de defaults de `B/19` §6 | 10 (8 devolver) → **11 (9 devolver)** | filas de la tabla, las que empiezan con `\| **devolver` | el párrafo de abajo de la tabla (*«once»*, *«nueve»*, *«diez que proponen algo»*) |
| filas de `B/19` §4 | 32 → **33** (fila 22) | `^\| \d+(-\w+)?` en el §4 | sin conteo congelado |
| filas de `V/19` §4 | 16 → **17** (fila 29) | ídem | sin conteo congelado |
| situaciones de una vertical, `B/10` §4.6 | 3 → **la de *«cerrada a altas»* deja de existir** | la tabla | la frase de arriba de la tabla, sin cifra |
| entidades de billing en `B/02` §2.1 | 1 → **2** (`vertical_discontinuation`) | la tabla del §2.1 | la frase de arriba (*«Acá `billing_option` y…»*); `rg` de *«una sola entidad»* sin otros espejos |
| filas del §10.1 de `B/03` | 14 → **14** | la salvedad de `R18` va dentro del par `cancelled` × vivo | — |
| transiciones de `B/03` §3.2 | sin cambio | ni `R18` ni `R1-c` agregan una `S` | — |
| filas de la matriz | 99 → **99** | `python3 contar-filas-de-la-matriz.py` | sólo propuestas (§3) |

## 3. Propuestas para el log y la matriz (consolidadas de toda la vuelta)

Es la lista de los seis registros de la vuelta, `11-` a `16-`. Donde dos grupos proponían sobre
el mismo ID, van juntos en una entrada, y lo que las decisiones tardías cerraron reemplaza lo que
estaba condicionado. Cada ID se grepeó en `$D/01-decision-log.md` antes de proponer
(`rg -n "^### DEC-XXX-NNN" $D/01-decision-log.md`), y la matriz se contó con
`contar-filas-de-la-matriz.py`: hoy son **99 filas** con **5 `UNKNOWN`**, y llega hasta `EX-42`.

**Sin propuesta**: `R11-3b` (`G1-3` no está en el log: vive en el diseño y en
`28-fase-9-vuelta-1/10-…`), `R7`/`R7-b` (el log no tiene decisión de identidad de Partner) y
`R24` y `Q-FECHA` por separado (van dentro de la entrada 12).

### Log

1. **`DEC-ADDON-002`**, implicación 6 (`$D/01-decision-log.md:1909`). **Qué cambia**: *“cancelar el
   plan no cancela los addons”* deja de valer para la baja desde `ACTIVE`. **Origen**: grupo A,
   `R1-a`. **Razón**: es la frase que `R1-a` precisa, y el log no lo dice. **Texto**:
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R1-a`)**: la baja desde
   > `ACTIVE` (`S11`) cancela en el proveedor, en el mismo acto y con la misma regla que la
   > principal, los complementos recurrentes que dependen de ella —la selección de `S32`—; siguen
   > dando servicio hasta el fin de servicio y `S12` los cierra. Lo que sigue valiendo es que la
   > instancia no se apaga con el plan: la apaga la orfandad.

   **Con `R1-c`, la última cláusula cambia**: *«y `S12` los cierra»* pasa a ser *«y en esa fecha
   los cierra `S21`, antes que su propio `S12`»* (entrada 2).
2. **`DEC-ADDON-004`** (`:3423`). **Qué cambia**: el complemento en `CANCEL_SCHEDULED` muere por
   `S21` en la fecha de fin, antes que su `S12`. **Origen**: grupo F, `R1-c`. **Razón**: es la
   decisión que dice que el complemento sin instancia muere en el acto, y `R1-c` fija el orden de
   ese acto contra el `S12` del propio complemento. **Texto**:
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R1-c`, opción 2)**: cuando
   > la principal y su complemento están en `CANCEL_SCHEDULED` con la misma fecha de fin —por
   > `S11` o por `S26`—, en esa fecha corre primero el `S12` de la principal, la orfandad corre
   > `A5` y `S21` toma el complemento antes que su propio `S12`. Si su último cobro pagó días
   > posteriores, abre el motivo 14, que propone no devolver, y una persona ve el caso y puede
   > apartarse. Se eligió contra la recomendación, que era proponer devolver la parte proporcional.
3. **`DEC-GRANT-007`** (`:3787`). **Qué cambia**: la cortesía re-emitida arranca al agotarse el
   crédito. **Origen**: grupo A, `R17`. **Razón**: su título dice *«se re-emite sobre la sucesora
   cuando autoriza»*. **Texto**:
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R17`)**: sobre una sucesora
   > que vive del crédito de `DEC-SUB-006`, la cortesía re-emitida arranca al agotarse el crédito;
   > `S9` sigue corriendo al autorizar y la pausa cruza los N cobros que caen desde ese día.
4. **`DEC-RF-001`** (`:1613`). **Qué cambia**: la revocación alcanza al pago de la predecesora y a
   los complementos. **Origen**: grupo A, `R17` y `R1-b`. **Razón**: la revocación devolvía sólo el
   último pago de la fila. **Texto**:
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R17` y `R1-b`)**: sobre una
   > sucesora sin pagos, el pago que se devuelve es el de su predecesora, que se encuentra por
   > `sucedida_por`; y la orfandad que causa la revocación devuelve por `RF1` el último cobro de
   > cada complemento recurrente sólo si cae dentro de sus propios 10 días corridos; si no, va al
   > motivo 14.
5. **`DEC-SUB-009`** (`:1236`). **Qué cambia**: el crédito cuenta como período pagado.
   **Origen**: grupo A, `R17`. **Razón**: la cláusula del 2026-09-25 fijaba el fin en el acto para
   toda fila sin `covered_period`. **Texto**:
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R17`)**: el crédito de
   > `DEC-SUB-006` cuenta como período pagado: `fin_de_servicio = max(fórmula, fin del crédito)`.
   > El fin en el acto queda sólo para la fila sin `covered_period` y sin crédito.
6. **`DEC-SUB-019`** (`:5279`). **Qué cambia**: la cancelación de `S6` que pierde la carrera contra
   el pago no se espeja como baja. **Origen**: grupo F, `R18`. **Razón**: la elegí sobre
   `DEC-SUB-021` y `DEC-SUB-009` porque `R18` es una consecuencia de la cancelación que esta
   decisión le pone a `S6` al vencer el grace; `DEC-SUB-021` sólo aporta el camino (cambiar la
   tarjeta) y `DEC-SUB-009` la forma del destino. **Texto**:
   > 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R18`)**: si `S6` —o `S3`
   > sobre una alta— manda la cancelación y el pago (`S5`) o la autorización (`S2`) le ganan la
   > escritura, la fila queda `ACTIVE` con el preapproval `cancelled`, y el espejo no la corta: la
   > lleva a `CANCEL_SCHEDULED`, con el fin de servicio de `S11`, y `S12` la termina. Recibe el
   > período que pagó, y la pantalla le dice que para seguir se vuelve a suscribir. Es la
   > respuesta que el owner dio a `S7` en el orden inverso.
7. **`DEC-RF-006`** (`:4920`). **Qué cambia**: la lista de motivos que esa decisión volvió a leer
   por motivo pasa a 24, con 9 `SÍ`. **Origen**: grupo A (`R4`, el 23) y grupo F (`R20`, el 24).
   **Razón**: son los dos motivos nuevos de la vuelta y los dos llevan `SÍ`. **Texto**:
   > 📌 **2026-09-27 (FASE 9 vuelta 2, `R4` y `R20`, con OK del owner)**: se agregan dos motivos
   > con `SÍ` y default devolver. El 23, `ORDEN_PAGADA_SIN_INSTANCIA`, cuelga de la instancia del
   > addon de única vez y es el único que no cuelga de una suscripción. El 24,
   > `IMPORTE_COBRADO_DE_MÁS`, lo abre la comparación de cobros del barrido cuando un cobro
   > aprobado supera el monto esperado de su período, y propone devolver la diferencia; y el
   > contador de una promo baja sólo con un cobro que salió con el descuento. Son veinticuatro
   > motivos y nueve devuelven plata.
8. **`DEC-MIG-004`**, punto 2 de su 📌 del 2026-09-25 (`:2994`). **Qué cambia**: entre el paso 3 y
   el 4 no llega nada al handler nuevo. **Origen**: grupo B, `F-8V2B3-003`, `F-8V2C2-002`.
   **Razón**: su conclusión sobre el #15 deja de ser cierta. **Texto**:
   > 📌 **Precisado el 2026-09-27 (FASE 9 vuelta 2, `F-8V2B3-003`, `F-8V2C2-002`)**: entre el
   > paso 3 y el 4 no llega nada al handler nuevo. Las lápidas se siembran antes de apuntar la URL
   > (el nuevo paso 4b de `16-fase-7…` §4.2), así que el cobro en vuelo de un id que la base no
   > conoce encuentra su lápida del corte y se asienta por la regla de `G3-1`, sin marca si es del
   > día del corte.
9. **`DEC-MIG-005`** (`:5738`). **Qué cambia**: la población y el aviso del cobro sobre la lápida
   del corte. **Origen**: grupo B (`R2`, `R21`) y grupo F (`R21-b`, que reemplaza la última
   oración del grupo B). **Razón**: es donde vive *«no se devuelve la diferencia»*. **Texto**:
   > 📌 **Precisado el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R2`, `R21` y `R21-b`)**: el
   > cobro sobre una lápida del corte no se devuelve sólo si es del día del corte (`date_created`
   > del registro). Uno posterior abre `PAGO_TARDÍO_RECHAZADO` con la propuesta de devolverlo. La
   > población se lee de la re-verificación del día del corte, y un detector corre después del
   > corte, con dueño y fecha (`B/21` «NO cierra»). El titular de una autorización que sólo
   > conoce el proveedor entra a la población a avisar: antes del aviso previo, una pasada de sólo
   > lectura sobre el proveedor lista las autorizaciones vivas con su `payer_email`, y el 1b
   > cancela después. Quien aparezca recién en el manifiesto del 1b recibe el aviso después de la
   > cancelación, y lo que pierde se declara como en `G1-4`.
10. **`DEC-MIG-003`**, 📌 del 2026-09-25, puntos 2 y 3 (`:2674`). **Qué cambia**: la rama de
    aborto, su frontera, su inventario externo y los dos recuentos que detienen el corte.
    **Origen**: grupo B (inventario, 4b, frontera), grupo E (gate del paso 2 y 4c) y grupo F
    (`R9-b`; y `R3-G4-1`, que el owner confirmó *«con el 📌 de `DEC-MIG-003`»*). **Razón**: la
    rama de aborto ahora tiene inventario externo, su frontera incluye las lápidas, y el corte
    gana dos controles y un paso fuera de la rama. **Texto**:
    > 📌 **Precisado el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R3-G4-1` y `R9-b`;
    > `F-8V2A3-002`, `F-8V2C1-001`, `F-8V2B3-003`, `F-8V2A3-003`, `F-8V2C2-006`)**:
    >
    > - La rama de aborto devuelve la URL de notificación a la ruta del viejo y la verifica con
    >   una entrega real.
    > - El borrado del contenido de las `L1` pasa al paso 5b, después de abrir altas, porque el
    >   backup no restaura fotos ni tokens.
    > - El apuntado de la URL es el paso 4b, después de las lápidas. El paso 3, que es hasta donde
    >   cubre la rama de aborto, termina con el paso 4 y el 4b verificados y su sonda cancelada
    >   (el owner confirmó que la frontera de `G4-1` los incluye). El punto de no retorno no se
    >   mueve.
    > - El recuento de fichas de Gastronomía y de Experiencia se hace antes del 1a, y el corte no
    >   arranca si da una fila; el gate del paso 2 lo repite como segundo control, y si ahí da una
    >   fila el corte entra en la rama de aborto (`V/21` §2.4).
    > - El paso 4c, después del 4b y fuera de la rama, revalida las páginas públicas de las fichas
    >   que nacieron despublicadas.
11. **`DEC-ARCH-006`** (`:2241`). **Qué cambia**: la frontera gana una entrada en la dirección de
    ida, con su almacenamiento. **Origen**: grupo C (`R5`) y grupo F (`Q-FECHA`). **Razón**: el
    contrato ya no tiene sólo a billing contestando `cobertura()`. **Texto**:
    > 📌 **Precisado el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R5` y `Q-FECHA`)**: la
    > fecha de fin de servicio de una vertical la calcula billing y verticales la pregunta por
    > `finDeServicio` (`12-contrato…` §4.1), que en la implementación de arranque contesta
    > `NINGUNA`; la real contesta de `vertical_discontinuation`, una fila de billing por vertical
    > discontinuada, y verticales no guarda copia. El día del fin de servicio billing sólo avisa.
    > `PB2`, el hecho 4 y la invalidación de la vertical los ejecuta el reconciliador diario de
    > cobertura (`V/03` §9). `extenderTrial` sigue siendo la única escritura de billing en
    > verticales.
12. **`DEC-ARCH-011`** (`:5962`). **Qué cambia**: quién invalida el caché el día del fin de
    servicio, quién escribe `admite_altas`, dónde vive la fecha y qué pasa sin planes vendibles.
    **Origen**: grupo C (`R5`) y grupo F (`Q-ALTAS`, `R24`, `Q-FECHA`). **Razón**: es la decisión
    que ata *«deja de admitir altas»* a *«deja de admitir suscripciones»*, y las cuatro filas la
    tocan. **Texto**:
    > 📌 **2026-09-27 (FASE 9 vuelta 2, `R5`, `Q-ALTAS`, `R24` y `Q-FECHA`, con OK del owner)**:
    >
    > - La invalidación de la vertical entera el día del fin de servicio la invoca el
    >   reconciliador diario de cobertura de verticales, no el barrido de billing.
    > - El acto de `SUPER_ADMIN` que discontinúa tiene dos mitades: verticales escribe
    >   `admite_altas = no` y billing escribe la fecha y los avisos. La acción administrativa las
    >   orquesta en ese orden. Billing no escribe `admite_altas`.
    > - La fecha la guarda `vertical_discontinuation` (`B/02` §2.1): la escribe el acto del día 0
    >   y la reescribe sólo el acortamiento de `B/10` §4.4.
    > - Retirar todos los planes vendibles no cierra la vertical: `T1` y `S1` exigen una versión
    >   vigente y vendible, y la pantalla dice que la vertical no tiene planes disponibles.
    >   Cerrarla a altas es discontinuarla.
13. **`DEC-TRIAL-004`** (`:429`). **Qué cambia**: la normalización deja de valer en todos los
    dominios. **Origen**: grupo D (condicionada a la pregunta 2 de `14-`), definitiva con `R23`.
    **Razón**: `R23` precisa la decisión, como dice su fila. **Texto**:
    > 📌 **Precisado el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R23`, `F-8V2A3-004`)**: el
    > seudónimo del correo es SHA-256 sin clave sobre el correo normalizado, y la función no cambia
    > nunca. Los puntos de la parte local y el `+alias` se sacan sólo en una lista cerrada de
    > proveedores que los ignoran —Gmail, Outlook y los que se midan—; en los demás dominios el
    > correo se compara tal cual, en minúsculas. Cambiar la lista no recalcula las filas viejas, y
    > se declara.
14. **`DEC-DATA-005`** (`:5507`). **Qué cambia**: `PURGED` trata lo que cuelga de la ficha por
    dueño del dato. **Origen**: grupo D, `R9`. **Razón**: el log sólo protege a las personas y a
    su contenido. **Texto**:
    > 📌 **2026-09-27 (FASE 9 vuelta 2, `R9`, con OK del owner)**: en `PURGED`, lo que cuelga de la
    > ficha se trata por dueño del dato, con una lista cerrada (`V/02` §4.1). Lo de un tercero se
    > conserva: la conversación queda en sólo lectura y su referencia admite una ficha ausente. La
    > alerta de precio se cierra con un aviso al turista. Lo del dueño que sólo sirve a la ficha se
    > borra con el contenido.
15. **`DEC-AUTH-003`** (`:6012`). **Qué cambia**: la clase de la acción 15. **Origen**: grupo D,
    `F-8V2A1-004`. **Razón**: deja de ser capacidad del actor. **Texto**:
    > 📌 **2026-09-27 (FASE 9 vuelta 2, `F-8V2A1-004`)**: la acción 15 no es capacidad del actor:
    > sus pasos 5 a 7 se evalúan sobre el dueño de la ficha. Su aviso es la fila 26 de `V/19` §4.
16. **`DEC-LEGAL-001`** (`:911`). **Qué cambia**: el asiento de un cobro sobre una lápida emite
    comprobante. **Origen**: grupo E (`F-8V2B3-005`) y grupo F (`R25`, que lo confirmó). **Razón**:
    la decisión dice *«por cada cobro»*, y un comprobante que no se envía a nadie necesita quedar
    dicho. **Texto**:
    > 📌 **2026-09-27 (FASE 9 vuelta 2, `R25`, con OK del owner)**: el cobro que se asienta sobre
    > una lápida —la del corte o la de recepción— también emite su comprobante, que queda en su
    > fila sin enviarse, porque la lápida no tiene destinatario.

### Matriz (`$D/06-mp-validation-matrix.md`, después de `EX-42`)

Numeradas `EX-43` a `EX-47`, sin huecos ni duplicados (`EX-42` es la última fila de hoy). Los
espejos del recuento están en `B/spec` §5.2, `$B/descomposicion.md` §2.7 y `B/06`, y ningún grupo
los tocó.

1. **`EX-43`** (grupo A, `R4`). **Qué agrega**: el reenvío de una orden horas después.
   **Razón**: `A3` reenvía hasta 72 h o 7 días después, y `EX-41` midió el reenvío inmediato.
   > | **EX-43** ✚ | ¿Reenviar una orden con la misma clave y el mismo cuerpo horas después —con el token de la tarjeta ya vencido— devuelve la misma orden si existía, y qué devuelve si nunca se creó? | `A3` sobre el addon de única vez (`B/03` §8; FASE 9 vuelta 2, `R4`) | `UNKNOWN` | — | — | — | Pendiente de sonda. Si devuelve error cuando la orden existía, `A3` no la ve pagada y el caso cae en la comprobación de órdenes pagadas del barrido. |
2. **`EX-44`** (grupo B, `R2`). **Qué agrega**: si cancelar corta el reciclado. **Razón**: da el
   tamaño de la población del cobro sobre la lápida del corte.
   > | **EX-44** ✚ | ¿Cancelar un preapproval **corta el reciclado** de un registro de cobro abierto (`scheduled`/`recycling`), o un cambio de medio posterior todavía lo cobra? | el cobro sobre la lápida del corte y la exención de las terminales (`B/21` §2.5, `B/09` §3; FASE 9 vuelta 2, `R2`) | `UNKNOWN` | — | — | — | Se mide en el paso 0 del corte (`16-fase-7…` §4.2) sobre una sonda propia con un registro abierto. No es condición del corte: da el tamaño de la población |
3. **`EX-45`** (grupo B, `F-8V2C2-004`). **Qué agrega**: si una cancelación sigue `cancelled`
   horas después. **Razón**: el código actual registra seis que no.
   > | **EX-45** ✚ | Una cancelación leída `cancelled` en el `PUT` y en un `GET` inmediato, ¿sigue `cancelled` releída **horas después**? | el gate del paso 2 y el cobro sobre la lápida del corte (FASE 9 vuelta 2, `F-8V2C2-004`) | `UNKNOWN` | — | — | — | El código actual registra seis que no (`preapproval-recovery.service.ts:22`, HOS-937); se mide en el paso 0. `PA-5` midió la irreversibilidad en sandbox |
4. **`EX-46`** (grupo B, `F-8V2C2-002`). **Qué agrega**: a qué URL va un reintento. **Razón**: es
   el ⚠️ del paso 4b.
   > | **EX-46** ✚ | ¿A qué URL va el **reintento** de una notificación emitida antes de cambiar la URL de notificación de la aplicación: a la de entonces o a la vigente? | el paso 4b del corte (FASE 9 vuelta 2, `F-8V2C2-002`) | `UNKNOWN` | — | — | — | `WH-4` midió los reintentos, no su destino. Si va a la vieja, el evento se pierde y su cobro cae en el punto (3) del «NO cierra» de `B/21` sobre `G3-1` |
5. **`EX-47`** (grupo E, y `R20` la vuelve condición de alcance del motivo 24). **Qué agrega**: qué
   monto cobra un registro ya creado cuando la mutación cae en medio. **Razón**: sin medirlo no se
   sabe cuántos cobros va a ver el motivo 24; con él aplicado, el caso ya tiene detector aunque
   cobre el viejo. Texto del grupo E, con la última oración actualizada:
   > | **EX-47** ✚ | Si el monto de un preapproval se muta **después** de creado el registro de cobro del ciclo (antes del lote, o durante sus reintentos), ¿el registro cobra el monto viejo o el nuevo? | el importe cobrado contra el esperado (`B/09` §3, `B/14` §2.4; FASE 9 vuelta 2, `F-8V2B3-001`) | `UNKNOWN` | — | — | — | Se mide en el paso 0 del corte sobre una sonda propia. `PC-1` midió el monto vigente con la mutación mucho antes del cobro. Si cobra el viejo, el motivo 24 (`B/02` §2.5, `R20`) es el que lo ve |

**Recuento, si el owner acepta las cinco**: la matriz pasa de **99 a 104 filas**, y los `UNKNOWN`
de **5 a 10** (`PA-6`, `GR-2`, `RC-8`, `RF-3`, `EX-42`, más `EX-43` a `EX-47`).

## 4. Preguntas abiertas

1. **`R18`: los complementos de la principal que el espejo lleva a `CANCEL_SCHEDULED`.** Cuando
   `S6` pierde la escritura, tampoco corrió `S32` sobre los complementos, así que siguen `ACTIVE`
   con su preapproval vivo. `R18` no dice qué les pasa. Hay dos lecturas:
   - **A: el espejo los cancela como `S11`** (`R1-a`): la misma selección y el mismo fin de
     servicio. **Daño**: ninguno de plata; es una cláusula más en la salvedad del §10.1.
   - **B: se dejan**, y los cierra la orfandad cuando `S12` termina la principal (`R1-c`: `S21` y
     el motivo 14). **Daño**: el complemento puede cobrar hasta un ciclo después de la baja, con
     la propuesta de no devolver. Es el CRÍT de R1 en otra población.
   - **El mismo hueco lo tiene `S7`** desde el 2026-09-25 (`SUSPENDED` → `CANCEL_SCHEDULED`),
     aunque ahí `S32` ya había corrido con la suspensión. Recomiendo **A** para las dos.
2. **`Q-ALTAS`: qué pasa si la mitad de billing no corre.** El orden es verticales primero. Si la
   mitad de billing falla después, la vertical queda con `admite_altas = no` y sin fila de
   `vertical_discontinuation`: nadie puede entrar, `finDeServicio` contesta `NINGUNA`, nadie
   cancela los preapprovals y no sale ningún aviso. Es el estado *«cerrada a altas»* que `R24`
   acaba de borrar. Hay dos lecturas:
   - **A: la acción reintenta la mitad de billing**, que es idempotente. **Daño**: mientras no
     corre, las altas están cerradas y los que ya pagaban siguen igual; no hay plata de más.
   - **B: la acción deshace la mitad de verticales**. **Daño**: se reabren las altas de una
     vertical que el owner ya decidió cerrar.
   - No lo apliqué porque es mecanismo que la decisión no nombra. Recomiendo **A**.

## 5. Casos vecinos

- **El catálogo de `NUCLEO/08` §3 no tiene la fila de *«discontinuar una vertical»***, y la regla
  de ese § dice que *«lo que no se puede es ejecutar una escritura que no esté nombrada en ninguna
  fila»*. El acto existe en `B/10` §4.3 con registro escrito, y desde `Q-ALTAS` escribe en las dos
  épicas. Agregar la fila mueve el conteo de quince y sus espejos en `V/17` y `B/19` §6.
- **Un cobro por debajo del esperado no lo ve nadie.** El motivo 24 sólo mira el de más. Un cobro
  de menos es plata de Hospeda y no del cliente, y ninguna comprobación lo marca.
- **Outlook en la lista de `R23`.** La decisión lo nombra, pero no está medido que Outlook ignore
  los puntos de la parte local. Si no los ignora, sacarlos junta dos casillas distintas, que es el
  falso positivo que la lista quería evitar. La frase *«y los que se midan»* sugiere medir también
  los dos que ya están.
- **La pasada de sólo lectura de `R21-b` puede correr antes del 0b.** El aviso va antes del
  paso 1, y el 0b cierra las altas. Una autorización creada entre la pasada y el 0b sólo la ve el
  1b, y ése es el residuo que quedó declarado.
- **El motivo 24 sobre un cobro de un pagador manual**: el `manual_payment` lo registra una
  persona, así que no hay registro del proveedor que comparar. La comparación mira sólo los
  registros del proveedor, y no lo escribí como exclusión porque la fila ya dice *«registro
  aprobado del proveedor»*.
- **La lectura de la selección de `S32` en la baja**, que el grupo A aplicó sumando
  `CANCEL_SCHEDULED` a la exclusión y dejó nombrada para confirmar (`11-` §1), sigue sin
  confirmación.
- **La pregunta 4 de `14-`** (la clase del correo de la alerta de precio cerrada) no tiene
  decisión del owner, y sigue abierta.

## 6. Los 56 hallazgos

Verificado con script: los IDs de esta tabla son exactamente los 56 encabezados `### F-8V2` de
los nueve informes, sin repetidos ni faltantes, y cada uno tiene un estado (el comando va abajo de
la tabla).

| ID | racimo | estado | grupo · registro | nota |
|---|---|---|---|---|
| `F-8V2A1-001` | R14 | aplicado | D · `14-` |  |
| `F-8V2A1-002` | R14 | aplicado | D · `14-` |  |
| `F-8V2A1-003` | R7 | aplicado | D · `14-` | la pregunta 1 de `14-` la cerró el owner (`R7-b`: se rechaza y deriva a soporte); F · `16-` escribió la derivación |
| `F-8V2A1-004` | R10 | aplicado | D · `14-` |  |
| `F-8V2A2-001` | R15 | aplicado | D · `14-` |  |
| `F-8V2A2-002` | R15 | aplicado | D · `14-` |  |
| `F-8V2A2-003` | R22 | aplicado | D · `14-` |  |
| `F-8V2A2-004` | R22 | aplicado | D · `14-` |  |
| `F-8V2A2-005` | R7 | aplicado | D · `14-` |  |
| `F-8V2A2-006` | R9 | aplicado | D · `14-`, espejo E · `15-` | con la pregunta 4 de `14-` (clase del correo) |
| `F-8V2A2-007` | R13 | aplicado | D · `14-` |  |
| `F-8V2A2-008` | R12 | aplicado | C · `13-` |  |
| `F-8V2A3-001` | R5 | aplicado | C · `13-`, F · `16-` | las preguntas 1 y 2 de `13-` las cerró el owner (`Q-FECHA`, `Q-ALTAS`), aplicadas por F |
| `F-8V2A3-002` | R6 | aplicado | B · `12-` |  |
| `F-8V2A3-003` | R9 | aplicado | D · `14-`, espejo E · `15-`, F · `16-` | la pregunta 4 de `15-` la cerró el owner (`R9-b`: también antes del 1a), aplicada por F |
| `F-8V2A3-004` | R23 | aplicado | D · `14-`, F · `16-` | la pregunta 2 de `14-` la cerró el owner (`R23`: lista cerrada de proveedores), aplicada por F |
| `F-8V2A3-005` | R24 | aplicado | F · `16-` | owner `R24`: `T1` exige una versión vigente y vendible; `B/10` §4.1 tachado |
| `F-8V2A3-006` | R13 | aplicado | D · `14-` |  |
| `F-8V2B1-001` | R1 | aplicado | A · `11-`, F · `16-` | la pregunta 2 de `11-` la cerró el owner (`R1-c`: `S21` antes que `S12`), aplicada por F |
| `F-8V2B1-002` | R17 | aplicado | A · `11-` |  |
| `F-8V2B1-003` | R4 | aplicado | A · `11-` |  |
| `F-8V2B1-004` | R17 | aplicado | A · `11-` |  |
| `F-8V2B1-005` | R17 | aplicado | A · `11-` |  |
| `F-8V2B1-006` | R2 | aplicado | B · `12-` |  |
| `F-8V2B2-001` | R18 | aplicado | F · `16-` | owner `R18`: el espejo lleva la fila a `CANCEL_SCHEDULED`; con la pregunta 1 de `16-` (sus complementos) |
| `F-8V2B2-002` | R19 | aplicado | A · `11-` |  |
| `F-8V2B2-003` | R4 | aplicado | A · `11-` |  |
| `F-8V2B2-004` | R4 | aplicado | A · `11-` |  |
| `F-8V2B2-005` | R19 | aplicado | A · `11-` |  |
| `F-8V2B3-001` | R20 | aplicado | F · `16-` | owner `R20`: motivo 24 y decremento condicionado; fila `EX-47` propuesta |
| `F-8V2B3-002` | R2 | aplicado | B · `12-` |  |
| `F-8V2B3-003` | R3 | aplicado | B · `12-` | la pregunta 2 de `12-` la cerró el owner (`R3-G4-1`: sí, con el 📌 de `DEC-MIG-003`) |
| `F-8V2B3-004` | R8 | aplicado | B · `12-` |  |
| `F-8V2B3-005` | R25 | aplicado | E · `15-` | la pregunta 2 de `15-` la cerró el owner (`R25`: sí emite comprobante) |
| `F-8V2B3-006` | R2 | aplicado | B · `12-` |  |
| `F-8V2B3-007` | R20 | aplicado | E · `15-` |  |
| `F-8V2B3-008` | R20 | aplicado | E · `15-` |  |
| `F-8V2B3-009` | R11 | aplicado | C · `13-`, espejos E · `15-`, F · `16-` | la pregunta 3 de `13-` la cerró el owner (`R11-3b`): F revirtió a Alojamiento |
| `F-8V2C1-001` | R5 | aplicado | C · `13-` |  |
| `F-8V2C1-002` | R16 | aplicado | C · `13-` |  |
| `F-8V2C1-003` | R12 | aplicado | C · `13-` |  |
| `F-8V2C1-004` | R11 | aplicado | C · `13-`, espejos E · `15-`, F · `16-` | F revirtió el ancla del 3b a Alojamiento (`R11-3b`); la validación de la versión sigue |
| `F-8V2C1-005` | R26 | aplicado | C · `13-` |  |
| `F-8V2C1-006` | R26 | aplicado | C · `13-` |  |
| `F-8V2C1-007` | R12 | aplicado | C · `13-` |  |
| `F-8V2C2-001` | R6 | aplicado | B · `12-` |  |
| `F-8V2C2-002` | R3 | aplicado | B · `12-` |  |
| `F-8V2C2-003` | R21 | aplicado | B · `12-`, F · `16-` | la pregunta 1 de `12-` la cerró el owner (`R21-b`: pasada previa de sólo lectura), aplicada por F |
| `F-8V2C2-004` | R2 | aplicado | B · `12-` |  |
| `F-8V2C2-005` | R8 | aplicado | B · `12-` |  |
| `F-8V2C2-006` | R27 | aplicado | E · `15-` | la pregunta 3 de `15-` la cerró el owner (`R27`: después del 4b) |
| `F-8V2C2-007` | R13 | aplicado | E · `15-` |  |
| `F-8V2D1-001` | R1 | aplicado | A · `11-` |  |
| `F-8V2D1-002` | R10 | aplicado | D · `14-` |  |
| `F-8V2D1-003` | R28 | aplicado | A · `11-` |  |
| `F-8V2D1-004` | R28 | aplicado | A · `11-` |  |

**Resumen**: **56 aplicados**, ninguno pendiente del owner y ninguno declarado. Los tres que
estaban pendientes (`B2-001` por `R18`, `A3-005` por `R24` y `B3-001` por `R20`) los aplicó este
grupo. **Dos** de los aplicados llevan todavía una pregunta abierta sobre la lectura elegida:
`A2-006` (la pregunta 4 de `14-`) y `B2-001` (la pregunta 1 de este registro). Las otras once
preguntas que traía la tabla de `15-` las cerró el owner con las decisiones tardías.

La verificación, desde `29-fase-8-vuelta-2/`:

```text
python3 - <<'EOF'
import re,glob
h=[m.group(1) for f in sorted(glob.glob('[A-D][0-9]-*.md')) for l in open(f)
   for m in [re.match(r'^### (F-8V2[A-D]\d-\d{3})',l)] if m]
t=re.findall(r'(?m)^\| `(F-8V2[A-D]\d-\d{3})` \|[^|]*\|\s*([^|]+?)\s*\|',
   open('16-aplicacion-decisiones-tardias.md').read())
ids=[i for i,_ in t]
print(len(h),len(set(h)),len(ids),len(set(ids)),set(h)==set(ids),
      sorted({s for _,s in t}))
EOF
# 56 56 56 56 True ['aplicado']
```

## Key Learnings

1. Una salvedad escrita para un estado (`GRACE_PERIOD`) no alcanza a la misma carrera cuando otra
   transición ya movió la fila. `R18` necesitaba una salvedad sobre `ACTIVE`, y la evidencia de
   que la cancelación era nuestra ya existía: el correo *«antes de cancelar»*.
2. Un motivo nuevo movió tres cifras (total, `SÍ`, `S14`) en catorce archivos. Un reemplazo
   automático del número sobre la línea equivocó dos veces el término: *«las otras N»* es el total
   menos uno, y en una línea con dos cifras la segunda sustitución tomó la que la primera acababa
   de escribir.
3. *«Cerrarla es discontinuarla»* borró una situación entera de la tabla de `B/10` §4.6. Hubo que
   buscar *«cerrada a altas»* en todo el alcance para separar las que hablan de una
   discontinuación, que siguen valiendo, de la que describía el retiro de planes.
4. Revertir una corrección de otro grupo no es borrarla: se tacha también lo que ese grupo
   escribió, y queda a la vista la secuencia (lo original, la corrección y la reversión).
5. Q-ALTAS ordena dos escrituras en dos épicas y no dice qué pasa si la segunda falla, y el estado
   intermedio es justo el que `R24` eliminó. Una decisión de orden sin su rama de fallo deja un
   estado que el resto del diseño ya no contempla.
