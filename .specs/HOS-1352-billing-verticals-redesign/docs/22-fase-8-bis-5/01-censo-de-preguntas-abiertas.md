---
title: Censo de las preguntas para el owner que la 9-bis-4 dejó sin registrar
linear: HOS-1352
statusSource: linear
created: 2026-09-23
updated: 2026-09-23
status: CURRENT
fase: 8
---

# Censo de las preguntas para el owner que la 9-bis-4 dejó sin registrar

`F-8fC2-007` reportó **33 preguntas para el owner repartidas en once documentos, ninguna en los dos
registros, y los dos registros declarando cero abiertas**. Este documento **recuenta ese número, lo
confirma, y después mide lo que `C2` no midió: cuántas de las 33 siguen abiertas**.

**No son 33 las que quedan pendientes: son once.** Las otras veintidós **ya están contestadas**, y
la mayoría lo estuvo el mismo día en que se preguntaron — por siete de las nueve decisiones que la
tanda agregó al log, por las cinco enmiendas de `DEC-TEST-001`, y por un commit de enmiendas
tachadas. `C2` acertó el conteo y acertó que **`04-open-decisions.md` no recibió ninguna**; lo que no
midió es que **el cuerpo del decision log sí recibió veintidós**: siete decisiones cuyo campo
`Origen` nombra el rastro por su archivo, más un commit cuyo mensaje declara la elección del owner.

Este documento **censa, no resuelve y no arregla**. No se editó ningún otro archivo.

---

## 0. El conteo medido

### 0.1 Cuántas son, y cómo se contaron

**33 ítems en 11 documentos.** El número coincide con `F-8fC2-007` y se recontó de cero, no se
copió.

| dónde | cuántas | cómo se midió |
|---|---|---|
| los §§ *«Preguntas para el owner»* / *«Para el owner»* de **9 rastros** | **30** | `rg -n "^#{2,4} .*[Oo]wner" 21-fase-9-bis-4/*.md` → 9 archivos; ítems numerados dentro de cada §: 4 + 3 + 2 + 3 + 4 + 5 + 3 + 3 + 3 |
| `HOS-1353/descomposicion.md` §2.8 | **1** | *«**Queda como pregunta para el owner**, con las dos salidas que se ven»* |
| `HOS-1354/descomposicion.md` §2.9 | **2** | § titulado *«**Dos preguntas que el reparto deja abiertas**, y ninguna se resuelve inventando»* |
| **total** | **33** | en **11** documentos |

El décimo rastro —`rastro-40b922120.md`— **no tiene** § de preguntas: su equivalente es el §3,
*«Lo que sí quedó declarado, y son tres cosas, ninguna de ellas una asignación faltante»*, cuyos tres
puntos **remiten** a las preguntas de las dos `descomposicion.md` en vez de abrir otras. No se
cuentan aparte, porque serían las mismas tres contadas dos veces.

**Las 33 no son 33 preguntas distintas: son 31.** Dos están hechas dos veces, y las dos veces por el
mismo par de rastros consecutivos — están identificadas en el grupo G.

### 0.2 La tabla por clasificación

| clasificación | cuántas | de las cuales, distintas |
|---|---|---|
| **`YA CONTESTADA`** | **22** | 20 |
| **`DEFECTO DISFRAZADO`** | **6** | 6 |
| **`DECISIÓN DEL OWNER`** | **5** | 5 |
| **`MEDICIÓN PENDIENTE`** | **0** | 0 |
| **total** | **33** | **31** |

**Cero `MEDICIÓN PENDIENTE` es un resultado, no un hueco del censo.** Ninguna de las 33 se contesta
preguntándole algo al proveedor: las 33 salieron de recorrer el corpus, no de una fila `UNKNOWN` de
la matriz. Revisado ítem por ítem contra `06-mp-validation-matrix.md` y contra el índice de
`docs/mp-probes/`: **ninguna nombra un endpoint, un preapproval ni un comportamiento de Mercado
Pago**. La única cosa con forma de medición que la tanda dejó pendiente está **fuera** de las 33 y
**no es una sonda**: `DEC-SUB-015` declara *«nadie midió cuántas veces se retira un plan del
catálogo»*, que se contesta contra nuestro propio catálogo (§10, `X3`).

### 0.3 Qué está registrado, medido

| registro | qué dice hoy | cuántas de las 33 tiene |
|---|---|---|
| **`04-open-decisions.md`** | encabezado: *«**0 de las 25 preguntas de FASE 1A abiertas**»*; `updated: 2026-09-15` | **0 de 33** |
| **el `## Resumen` de `01-decision-log.md`** | fila: `\| **Preguntas del owner abiertas** \| **0 de 25** \|` | **0 de 33** |
| *(no es un registro, pero es donde viven las respuestas)* el **cuerpo** de `01-decision-log.md` | **7 de las 9 decisiones nuevas** de la tanda (`DEC-MP-003` y `DEC-MP-004` no vienen de un rastro) + las **5 enmiendas** de `DEC-TEST-001` + **3 enmiendas tachadas** | **21 de 33** |

**Las mediciones, una por una:**

1. **`04-open-decisions.md` no recibió nada de la tanda.** Un `rg -c` sobre ese archivo con los
   términos `9-bis-4`, `rastro-`, `G-R6`, `predicado global`, `inactiva_desde`, `DEC-SUB-014`,
   `DEC-SUB-015`, `DEC-GRANT-008`, `DEC-GRANT-009`, `DEC-GRANT-010`, `DEC-TEST-001` y `DEC-RF-003`
   devuelve **exit 1: cero coincidencias de los doce**. Su último commit es **`ee6f82544`,
   2026-09-19**, o sea **anterior** a los 76 commits de la tanda (`5ac5e92c9~1..90e4b326f`,
   2026-09-21/22, recontados: `git log --oneline` da 76).
2. **Los dos «cero abiertas» no hablan de estas preguntas.** Los dos cuentan *«de 25»*, y las 25 son
   **las preguntas de FASE 1A** (`04-open-decisions.md`: *«0 de las 25 preguntas de FASE 1A
   abiertas»*). O sea que **el contador no está mintiendo sobre las 33: no las conoce**. Eso es peor
   que un número desactualizado y es lo que hay que decir con precisión — *no hay ningún contador
   que las cuente*, ni correcto ni incorrecto.
3. **El cuerpo del log sí las recibió, y las cita por nombre de archivo.**
   `rg -o "rastro-[0-9a-f]*\.md" 01-decision-log.md | sort | uniq -c` → **11 menciones en 6 rastros
   distintos**: `032f761e0` ×4, `ce52dce5f` ×3, y una cada uno `12cc0879f`, `8d6b27a12`, `8f9f31ac0`
   y `f21d5d828`. **Nueve de las once están en el campo `Origen` de una decisión `ACCEPTED`**; las dos
   que no lo están son metodológicas (`DEC-METH-012` cita a `032f761e0` y a `f21d5d828` como ejemplos
   de redacción, no como origen). **`f21d5d828` no aparece en ningún `Origen`**, y es exactamente el
   rastro cuyas tres preguntas siguen abiertas (grupo E).
4. **El otro vehículo es un commit de enmiendas, no una decisión nueva**: **`fbb4bf05c`**
   (2026-09-21 18:06, *«enmendar tres razones que los arreglos volvieron falsas»*), cuyo propio
   mensaje declara *«Decision del owner: se corrigen tachando lo anterior, no borrandolo»*. Cierra
   tres preguntas (`B1`, `C1`, `C2`) tachando el texto caduco de `DEC-DATA-003` y `DEC-SUB-013`.
5. **Y una contestada sin pasar por el log**: la colisión 4 de `B/12` §2.2 se reescribió en el
   capítulo (`e78ddfca6`, 2026-09-21 20:06) sin entrada propia. Por eso el cuerpo del log tiene 21
   de las 22 contestadas y no 22.

### 0.4 Dónde este censo difiere de `F-8fC2-007`, y con qué

| lo que dice `C2` | lo que mide este censo |
|---|---|
| *«33 preguntas … repartidas en once documentos»* | ✅ **confirmado**, recontado de cero |
| *«ninguna en los dos registros … los dos declaran cero abiertas»* | ✅ **confirmado**, con la precisión de que los dos contadores cuentan **otra población** (las 25 de FASE 1A) |
| *«**La tanda produjo 33 ítems dirigidos al owner y no puso ninguno en ninguno de los dos**»*, leído como *«hay 33 preguntas abiertas»* | ❌ **no se sostiene**: **22 de 33 estaban contestadas antes de que la tanda cerrara**, 21 de ellas en el cuerpo del mismo log. Quedan **11 abiertas**, no 33 |
| *«Al menos tres de las 33 no son notas, son defectos o bloqueos»*, y nombra el predicado global de `G-R6`, los inventarios de `NUCLEO/01` §2 y el `PB1`/`PB6` de `DEC-DATA-003` | ⚠️ **dos de tres**. El predicado global (`I1`) y los inventarios (`I3`) **siguen abiertos y son defectos**. El tercero —`DEC-DATA-003` nombra `PB1` donde corresponde `PB6`— **ya está corregido en el log** desde `fbb4bf05c`, con el tachado `~~PB1~~ **PB6**` y su aclaración. **`C2` lo midió sobre un texto que en ese momento ya decía otra cosa.** A cambio, este censo encuentra **cuatro defectos más** que `C2` no nombra (`E2`, `F3`, `H2`, `I2`) |

> **Por qué `C2` pudo dar 33 abiertas midiendo bien.** Sus tres greps de verificación fueron
> `predicado global`, `corpus se construye por partes` y `entre B5 y B8` — los tres términos de
> **una sola** de las 33, la que efectivamente sigue abierta (`I1`). Sobre los dos registros dan
> cero, y eso es cierto. Lo que ese barrido no podía ver es que **las otras 22 no se cerraron
> repitiendo el término de la pregunta**: se cerraron con una decisión nueva que **nombra el rastro
> y no la pregunta**. Es la misma clase de límite que `C2` se declara a sí misma para `F-8fC2-003`
> y `F-8fC2-005`: *«una fila que falta no es una aparición»* — acá, **una respuesta que no repite
> la pregunta tampoco lo es**.

---

## 1. Grupo A — La baja y el corte del servicio · las 4 están contestadas

Origen: `rastro-032f761e0.md` §5 (familia de la baja, 2026-09-21 17:38). **Las cuatro se cerraron
entre 18:06 y 20:15 del mismo día.**

### `A1` — La baja desde `GRACE_PERIOD` no tiene fila · **`YA CONTESTADA`**

- **De dónde sale**: `21-fase-9-bis-4/rastro-032f761e0.md` §5, punto 1 (líneas 395-400).
- **La pregunta**: *«Es el cuarto estado desde el que alguien puede pedir irse, y `DEC-SUB-009` no
  selecciona una fecha … Las dos respuestas posibles son **cortar hoy** (como `S22`/`S23`) o **dejar
  correr el reloj del grace**»*.
- **Qué la generó**: al escribir `S22` (desde `PAUSED`) y `S23` (desde `SUSPENDED`), la tanda
  recorrió los seis estados vivos y encontró el hueco.
- **Dónde se contesta**: `01-decision-log.md`, **`DEC-SUB-014`** — *«corta en el acto, con `fin_real`
  en el día de la cancelación, igual que `S22` y `S23`»*. Su `Origen` dice textual: *«la FASE 9-bis-4,
  familia de la baja, **pregunta 1 de su rastro** (`21-fase-9-bis-4/rastro-032f761e0.md` §5), y la
  elección del owner del 2026-09-21 entre las tres opciones»*. **Y la fila ya está escrita**:
  `B/12` §2.2 colisión 3 nombra *«desde `GRACE_PERIOD` (`S24`)»*.
- **Registrada**: no, en ninguno de los dos registros.

### `A2` — La baja de la discontinuación manda a `CANCEL_SCHEDULED` a las pausadas, y el §3.3 lo prohíbe · **`YA CONTESTADA`**

- **De dónde sale**: mismo §5, punto 2 (líneas 401-404).
- **La pregunta**: *«Hace falta decidir qué estado ocupa una pausada durante los 60 días de piso, y
  con eso escribir su fila»*.
- **Qué la generó**: es anterior al arreglo, pero escribir `S22`/`S23` lo volvió visible.
- **Dónde se contesta**: **`DEC-SUB-015`** — *«la pausada NO entra al piso»*, con las tres partes y
  el aviso al retirar el plan. `Origen`: *«**pregunta 2 de su rastro**»*.
- **Registrada**: no.

### `A3` — La rama 6 de `B/12` §5.3 deja la devolución en manos de una persona sin default · **`YA CONTESTADA`**

- **De dónde sale**: mismo §5, punto 3 (líneas 405-407).
- **La pregunta**: *«si el owner quiere un default —devolver siempre, o no devolver nunca, cuando el
  que canceló es el cliente— conviene escribirlo ahí y no en cada caso»*.
- **Qué la generó**: `S23` llevó `B/12` §5.3 de cinco ramas a seis.
- **Dónde se contesta**: **`DEC-RF-003`** — *«el default es DEVOLVER»*, con la confirmación humana
  intacta. `Origen`: *«**pregunta 3 de su rastro**»*.
- **Registrada**: no.

### `A4` — La colisión 4 de `B/12` §2.2 justifica encolar con una razón falsa de `COURTESY` · **`YA CONTESTADA`**

- **De dónde sale**: mismo §5, punto 4 (líneas 408-411).
- **La pregunta**: *«el desenlace que declara (esperar) podría no ser el mismo para una cortesía, y
  eso es una decisión de producto»*.
- **Qué la generó**: el mismo defecto de razón que el commit corrigió en el §7.2 sobrevivía en el
  §2.2.
- **Dónde se contesta**: **en el capítulo, sin entrada de log** — commit `e78ddfca6` (2026-09-21
  20:06). `B/12` §2.2 colisión 4 dice hoy: *«**espera a la reanudación, y en las DOS pausas por la
  misma razón.** No es que durante la pausa no haya servicio —eso es verdad de `CUSTOMER_REQUEST` y
  **falso de `COURTESY`** …—: es que **estando pausada el proveedor rechaza toda modificación**, con
  `400` explícito y medido (`EX-11`)»*. **La razón nueva contesta la pregunta**: el desenlace es el
  mismo para una cortesía porque no depende del servicio sino de lo que el proveedor acepta.
- **Registrada**: no, y no hace falta: está resuelta en el texto vigente.

---

## 2. Grupo B — La ficha pública y el cupo · 1 contestada, 2 abiertas

Origen: `rastro-5836ec219.md` §4 (2026-09-21 16:51).

### `B1` — `DEC-DATA-003` nombra `PB1` donde corresponde `PB6` · **`YA CONTESTADA`**

- **De dónde sale**: `rastro-5836ec219.md` §4, punto 1 (líneas 458-463).
- **La pregunta**: *«`PB1` es `DRAFT → PUBLISHED`, o sea la que **publica**, y la que despublica es
  `PB6` … **No toqué el log.** Si el owner prefiere, la decisión puede corregirse en su lugar»*.
- **Qué la generó**: el recorrido de la máquina de publicación tras `DEC-DATA-003`.
- **Dónde se contesta**: `01-decision-log.md`, **`DEC-DATA-003`**, riesgo aceptado: *«El dueño que no
  la quiera pública tiene ~~`PB1`~~ **`PB6`** y la despublica. *(Corregido el 2026-09-21 por la FASE
  9-bis-4: `PB1` sale sólo de `DRAFT`, así que la transición que despublica a mano es `PB6`. La
  decisión no cambia; la sigla estaba mal.)*»*. Commit `fbb4bf05c`, 18:06.
- **Registrada**: no, y está resuelta.
- ⚠️ **Es el ítem donde `C2` se equivoca**: lo lista entre *«al menos tres … que no son notas, son
  defectos o bloqueos»*, describiéndolo como *«un error en una decisión ACCEPTED»* vivo. Estaba
  corregido **tres horas y media antes** del primer commit de la familia que `C2` audita.

### `B2` — `PB7` recibió la segunda rama y `DEC-DATA-003` sólo nombra `PB3` · **`DECISIÓN DEL OWNER`**

- **De dónde sale**: `rastro-5836ec219.md` §4, punto 2 (líneas 464-469).
- **La pregunta**: *«Queda declarado acá por si el owner lo lee como una **extensión** y no como la
  **condición** de que la decisión se cumpla»*.
- **Qué la generó**: `DEC-DATA-003` le dio a `PB3` la rama *«el cupo vuelve a alcanzar»*; la mitad
  `UNPUBLISHED_BY_BILLING` del `desde` de `PB4` **es** la población del excedente, así que sin la
  misma rama en `PB7` la frase de `DEC-DATA-002` *«vuelve sola por `PB7` y nunca se borra»* queda
  falsa para ese sujeto.
- **Las dos alternativas**:
  1. **Ratificarlo como condición** (lo que está escrito hoy: `V/03` §9, *«`PB7` la lleva también, y
     no es una extensión de la decisión sino su condición»*). **Cuesta cero**: el texto no se toca.
  2. **Leerlo como extensión**. Cuesta **una enmienda registrada a `DEC-DATA-003`**, porque una
     decisión `ACCEPTED` estaría ganando alcance sin que su entrada lo diga — exactamente lo que
     `DEC-METH-011` pide no hacer en silencio.
- **Registrada**: **no**, en ninguno de los dos.

### `B3` — El criterio de orden entre `PB3` y `PB7`, sin que el origen desempate · **`DECISIÓN DEL OWNER`**

- **De dónde sale**: `rastro-5836ec219.md` §4, punto 3 (líneas 470-474).
- **La pregunta**: *«`DEC-DATA-003` obliga a escribirlo pero no elige cuál; si el owner quiere otro,
  cambia en tres lugares (`V/03` §9, `V/15` §4.3 y los dos avisos)»*.
- **Qué la generó**: el costo que `DEC-DATA-003` aceptó por escrito —*«la rama obliga a escribir un
  criterio de orden»*— se pagó eligiendo uno, y la elección no volvió al owner.
- **Las dos alternativas**:
  1. **El inverso exacto de la bajada** —*«vuelve primero la que cayó al final»*—, con el origen sin
     desempatar. Es lo escrito hoy, y tiene una propiedad verificable a favor: *«el conjunto que
     queda publicado depende sólo del cupo y no del camino»* (`V/03` §9). **Cuesta cero.**
  2. **Cualquier otro criterio** (por antigüedad, por elección del dueño, con el origen
     desempatando). **Cuesta tres lugares** —`V/03` §9, `V/15` §4.3 y las filas 8 y 19 de `V/19`— y
     **pierde la propiedad**: el resultado pasa a depender de por cuántos planes pasó el cliente.
- **Registrada**: **no**.

---

## 3. Grupo C — El pagador manual · las 3 están contestadas

Origen: `rastro-8f9f31ac0.md` §4 (2026-09-21 17:15). El propio § se declara incapaz de resolverlas:
*«No las resuelvo: tocan el decision log, que esta fase tiene prohibido editar»*. **Las tres se
resolvieron 51 minutos después, por decisión explícita del owner.**

### `C1` — `DEC-SUB-013` quedó más ancha que su capítulo, en dos viñetas · **`YA CONTESTADA`**

- **De dónde sale**: `rastro-8f9f31ac0.md` §4, punto 1 (líneas 337-344).
- **La pregunta**: *«¿Se enmienda la viñeta de `DEC-SUB-013`, o queda el log como registro de lo que
  se eligió y el capítulo como el texto vigente?»*.
- **Qué la generó**: el crítico `F-8eB1-001` — el re-anclaje incondicional cobraba dos veces.
- **Dónde se contesta**: `DEC-SUB-013` lleva hoy el tachado y su enmienda: *«~~No es una elección:
  con el ancla vieja el reloj crearía de golpe todo el atraso~~ … ***Enmendado el 2026-09-21 por la
  FASE 9-bis-4 (crítico `F-8eB1-001`), y las dos mitades tachadas eran falsas por separado***»*.
  Commit `fbb4bf05c`, cuyo mensaje declara el criterio del owner: *«se corrigen tachando lo anterior,
  no borrandolo, asi se sigue viendo que se creia al decidir»*. **La pregunta ofrecía dos salidas y
  el owner eligió la primera.**
- **Registrada**: no, y está resuelta.

### `C2` — Misma decisión, la razón de `GRACE_PERIOD` · **`YA CONTESTADA`**

- **De dónde sale**: mismo §4, punto 2 (líneas 345-350).
- **La pregunta**: *«La primera mitad es falsa con la fecha que avanza sola … ¿Se enmienda también la
  viñeta?»*.
- **Dónde se contesta**: mismo commit, misma entrada: *«`GRACE_PERIOD` ~~porque el período no avanza
  hasta que entra el pago y~~ porque **la cuota ya existe**»*, con el recuadro
  *«***Enmendado el 2026-09-21 … (crítico `F-8eB1-002`)***. La mitad tachada era falsa»*.
- **Registrada**: no, y está resuelta.

### `C3` — Un guard que el programa no tiene y este crítico pide · **`YA CONTESTADA`**

- **De dónde sale**: mismo §4, punto 3 (líneas 351-356).
- **La pregunta**: *«Es barato de enunciar —«toda condición que nombre una columna tiene que poder
  nombrar las transiciones que la escriben»— y caro de olvidar … ¿Va?»*.
- **Dónde se contesta**: **`DEC-TEST-001`**, punto 1: *«**SÍ** — «una condición que lee una columna
  que ninguna transición escribe». Es `F-8eB1-002` exacto»*. Es `G-R6`. `Origen`: *«preguntas de los
  rastros del **pagador manual** (`rastro-8f9f31ac0.md`) y del grant (`rastro-ce52dce5f.md`),
  presentadas juntas al owner el 2026-09-21»*.
- **Registrada**: no.

---

## 4. Grupo D — El grant permanente · las 3 están contestadas

Origen: `rastro-ce52dce5f.md` §7 (2026-09-21 18:00).

### `D1` — ¿La revocación de un grant guarda MOTIVO? · **`YA CONTESTADA`**

- **De dónde sale**: `rastro-ce52dce5f.md` §7, punto 1 (líneas 509-514).
- **Qué la generó**: el commit le dio a `permanent_grant` la columna `revocado_en` y el firmante
  (crítico `F-8eB3-002`); faltaba el motivo.
- **Dónde se contesta**: **`DEC-GRANT-008`** — *«sí, y es texto libre»*, con la razón
  (*«una decisión deliberada cuyo motivo no se registra es indefendible seis meses después»*).
  `Origen`: *«**pregunta 1 de su rastro** (`21-fase-9-bis-4/rastro-ce52dce5f.md`)»*.
- **Registrada**: no.

### `D2` — Un grant revocado y vuelto a otorgar son DOS filas · **`YA CONTESTADA`**

- **De dónde sale**: mismo §7, punto 2 (líneas 515-521).
- **La pregunta**: *«si el owner quiere que eso sea imposible (un `UNIQUE` parcial sobre beneficiario
  × vivo) es una decisión de modelo que no se toma acá»*.
- **Dónde se contesta**: **`DEC-GRANT-009`** — *«un `UNIQUE` parcial sobre beneficiario, restringido
  a las filas vivas»*. `Origen`: *«**pregunta 2 de su rastro**»*.
- **Registrada**: no.

### `D3` — El orden de `S20` se declaró; el de `S13` no · **`YA CONTESTADA`**

- **De dónde sale**: mismo §7, punto 3 (líneas 522-527).
- **La pregunta**: *«Un guard que exija que toda fila con `desde` de conjunto declare cuántas
  escrituras tiene, y en qué orden, es la defensa obvia y no se escribió acá»*.
- **Dónde se contesta**: **`DEC-TEST-001`**, punto 2: *«**NO** — «toda fila con `desde` de conjunto
  declara cuántas escrituras tiene y en qué orden». Es `F-8eB2-002`»*, con la razón de fondo:
  *«un guard estático sólo puede comprobar en su forma, no en su verdad … Sería **un guard que
  afirma más de lo que prueba***»*. La entrada además declara lo que queda sin vigilar.
- **Registrada**: no.

---

## 5. Grupo E — La cortesía diferida · las 3 abiertas, ninguna registrada

Origen: `rastro-f21d5d828.md` §6 (2026-09-21 18:35). **Es el único rastro cuyas preguntas el
decision log no cita en ningún `Origen`**: su única mención en el log (línea 4033) es metodológica,
sobre otra cosa. `DEC-GRANT-007` y `DEC-GRANT-010` crearon el mecanismo de la cortesía diferida el
mismo día; **sus tres bordes quedaron sin decidir.**

### `E1` — Qué se hace con un saldo de cortesía cuya sucesora ABANDONA el checkout · **`DECISIÓN DEL OWNER`**

- **De dónde sale**: `rastro-f21d5d828.md` §6, punto 1 (líneas 821-829). Declarada también en el
  capítulo: `B/09` §3, sexta comprobación, líneas 488-493 — *«la cortesía queda diferida sin ninguna
  suscripción a la que volver … **no está decidido**, y no se decide acá: queda como pregunta al
  owner»*.
- **Qué la generó**: `DEC-GRANT-007`. `S18` cierra la sucesión con la sucesora en
  `PENDING_AUTHORIZATION`, y desde ahí la sucesora puede autorizar (`S2` → `S9` re-emite) **o vencer
  su ventana** (`S3` → `ABANDONED`). La segunda rama deja un `courtesy_grant` con `saldo_días` y sin
  ninguna fila viva en esa vertical.
- **Las dos alternativas**:
  1. **Cerrar el saldo y declararlo.** Cuesta: al beneficiario se le pierden días que `SUPER_ADMIN`
     le firmó, por un abandono que puede ser un error de checkout y no una decisión.
  2. **Dejarlo esperando** a que la persona se suscriba de nuevo. Cuesta: es *«un instrumento abierto
     sin fecha de cierre»*, que es **la forma que `B/16` §1.3 rechaza por escrito** para la vigencia
     `PERMANENTE`; y hoy **ninguna comprobación lo levanta** —la sexta de `B/09` §3 exige que la fila
     receptora ya exista en `ACTIVE`—, así que el saldo queda en la base sin dueño, sin vencimiento y
     sin nadie que lo mire.
- **Registrada**: **no**, en ninguno de los dos.

### `E2` — Un grant que cae sobre una cortesía DIFERIDA · **`DEFECTO DISFRAZADO` · severidad `MEDIA`**

- **De dónde sale**: `rastro-f21d5d828.md` §6, punto 2 (líneas 830-834).
- **Qué se rompe**: `B/14` §4.3 (línea 243) dice *«**Y al revés: otorgar un grant termina cualquier
  cortesía vigente.**»*, **y la termina cancelando la suscripción que la pausaba** — el mecanismo
  está enunciado sobre `S13`, que cancela esa suscripción. **Sobre una cortesía diferida no hay
  suscripción que cancelar**: la regla, tal como está escrita, **no alcanza al caso**, y el saldo
  sobrevive al grant sin que ningún texto diga qué pasa con él. No es una elección entre dos
  políticas: es una regla cuyo sujeto no existe en una población que el mismo día se creó.
- **Por qué `MEDIA` y no más alto**: la consecuencia probable —que el saldo se re-emita más adelante
  sobre una suscripción nueva, dándole días que el grant ya había vuelto innecesarios— es un regalo
  de más, no un cobro de más ni un dato perdido. Sube a `ALTA` si alguien lo lee al revés y **cierra**
  el saldo al otorgar el grant: ahí el beneficiario pierde días firmados por `SUPER_ADMIN` al recibir
  algo estrictamente mejor, que es el caso de `DEC-TRIAL-009` invertido y no está escrito en ninguna
  parte.
- **Registrada**: **no**.

### `E3` — Qué se le muestra al cliente mientras su cortesía está diferida · **`DECISIÓN DEL OWNER`**

- **De dónde sale**: `rastro-f21d5d828.md` §6, punto 3 (líneas 835-839).
- **La pregunta**: *«`B/19` §3 obliga a mostrar las cortesías en «Mi Suscripción», y entre el cierre
  de la sucesión y la autorización de la sucesora la persona **tiene días firmados y no tiene
  cortesía corriendo**. Decir «te quedan N días» sin decir desde cuándo corren es la clase de
  promesa que `NUCLEO/07` §5.3 manda anticipar. **No escribí la copy**: es una decisión de
  producto»*.
- **Las dos alternativas**:
  1. **Mostrar el saldo con su condición** (*«te quedan N días, que empiezan a correr cuando
     completes el pago»*). Cuesta una fila de copy en `B/19` §3 y ata la superficie al estado
     `saldo_días` de `courtesy_grant`.
  2. **No mostrar nada hasta que la cortesía vuelva a correr.** Cuesta cero, y **le esconde al
     cliente días que son suyos** justo en la ventana en que puede abandonar el checkout — que es
     `E1`, el mismo hueco por la otra puerta.
- **Registrada**: **no**.

---

## 6. Grupo F — La discontinuación de una vertical · 4 contestadas, 1 abierta

Origen: `rastro-8d6b27a12.md` §6 (2026-09-21 20:21, la *tanda corta*).

### `F1` — `DEC-SUB-015` y `DEC-GRANT-010` dicen «el retiro de un plan» y el corpus no tiene ese acto · **`YA CONTESTADA`**

- **De dónde sale**: `rastro-8d6b27a12.md` §6, punto 1 (líneas 449-457).
- **Dónde se contesta**: **las dos entradas se corrigieron el mismo día**. `DEC-SUB-015`:
  *«***Corregido el mismo día, y el error era del encuadre con que se presentó el caso, no de la
  decisión***: esta entrada nació diciendo «el retiro de un plan», y **ese acto no produce el caso**
  … El acto que produce el caso es **la discontinuación de una vertical** (§4.3)»*. `DEC-GRANT-010`
  lleva la corrección gemela. **Y la mitad que el rastro dejó dicha —que no existe política para el
  retiro de un plan dentro de una vertical viva— tiene respuesta en el corpus**: `B/10` §3.4, *«el
  plan retirado sostiene a sus clientes indefinidamente»*.
- **Registrada**: no, y está resuelta.

### `F2` — La re-emisión de `DEC-GRANT-010` tiene un desenlace en el que no llega · **`YA CONTESTADA`**

- **De dónde sale**: mismo §6, punto 2 (líneas 458-465). El rastro enumera tres salidas y dice
  *«**No se eligió ninguna**»*.
- **Dónde se contesta**: **`DEC-GRANT-010`**, que cierra la pregunta **eligiendo no definirla, con
  causa**: *«Se le presentaron al owner tres salidas —pagarlo en otra vertical, declararlo perdido
  con aviso, o convertirlo en un crédito— y **eligió no definir ninguna**, con esta razón, el
  2026-09-21: «una vertical no la vamos a discontinuar nunca, y si algún día decidimos eso, lo
  veremos en el momento». **Es un desenlace declarado, que es lo que `DEC-METH-006` admite**»*. Su
  `Origen` cita *«**la pregunta 2 del rastro de la tanda corta** (`21-fase-9-bis-4/rastro-8d6b27a12.md`
  §6)»*.
- **Registrada**: no, y está cerrada por declaración.

### `F3` — El acto de la discontinuación sigue sin fila numerada, y no sólo para `PAUSED` · **`DEFECTO DISFRAZADO` · severidad `ALTA`**

- **De dónde sale**: `rastro-8d6b27a12.md` §6, punto 3 (líneas 466-471). Declarado también en el
  capítulo: `B/03`, § *«Lo que esta mitad NO cierra»*, líneas 1866-1873 — *«**Pero la otra mitad
  SIGUE ABIERTA** … Queda declarado, y va como pregunta al owner»*.
- **Qué se rompe**: `B/10` §4.3 **ordena** mandar a `CANCEL_SCHEDULED` a cada suscripción viva
  alcanzada por la discontinuación de una vertical, y **ninguna transición numerada lo ejecuta**.
  `S11` no sirve —su evento es *«pide la baja»*, un acto del cliente sobre su propia fila— y esto lo
  decide `SUPER_ADMIN` sobre la cartera entera. Por la regla 1 del núcleo, **ese movimiento cae en la
  marca desde `ACTIVE`, `GRACE_PERIOD`, `SUSPENDED` y `PENDING_AUTHORIZATION`**: cuatro estados, no
  uno. `DEC-SUB-015` resolvió **a quién alcanza el piso**, no **qué transición lo ejecuta**; su punto
  3 mandó escribir el final de la pausada y eso **sí** se hizo (`S25`), pero la otra mitad no.
- **Severidad**: `ALTA`. **La consecuencia es de grado `CRITICA` por el criterio escrito** —una
  cartera entera que se queda `ACTIVE` sobre una vertical con fecha de fin de servicio sigue
  cobrándose por un servicio que termina, o sale por un camino improvisado por quien se choque con la
  marca— pero **está detrás de un acto que el owner declaró que no va a ocurrir** (`DEC-GRANT-010`:
  *«una vertical no la vamos a discontinuar nunca»*). Es la misma razón por la que `DEC-SUB-015`
  conservó su corrección igual: **la contradicción entre dos capítulos es real con escenario o sin
  escenario**.
- **Por qué es defecto y no decisión**: no hay alternativas de producto que elegir. Falta **una fila
  en `B/03` §3.2**, con su `desde` de conjunto y su evento de `SUPER_ADMIN`. La 9-bis-5 la puede
  escribir sin preguntarle nada al owner.
- **Registrada**: **no**.

### `F4` — `G-R6` quedó acotado a las seis tablas de billing · **`YA CONTESTADA`**

- **De dónde sale**: mismo §6, punto 4 (líneas 472-475).
- **Dónde se contesta**: **`DEC-TEST-001`**, ampliación: *«***Ampliado el mismo día, a pedido del
  owner: `G-R6` alcanza LAS DOS ÉPICAS, no sólo billing.*** … Se agrega su fila en `V/20` §2»*, con
  la razón medida (`inactiva_desde`, cuatro escritores nuevos, y *«ahí el daño no es dinero: son
  datos sin vuelta»*).
- **Registrada**: no.

### `F5` — El catálogo de guards de `B/20` §2 no lista a `G12` ni a `G13` · **`YA CONTESTADA`**

- **De dónde sale**: mismo §6, punto 5 (líneas 476-481).
- **Dónde se contesta**: **`DEC-TEST-001`**: *«***Y el catálogo estaba incompleto, medido el mismo
  día***: **`G12` y `G13` existen definidos sólo en `B/descomposicion.md`** … **y no estaban en
  ningún catálogo** … Se agregan a `B/20` §2»*, con la aclaración de que el salto `G7` → `G9` **no**
  es un agujero porque `G8` vive en `V/20` §2.
- **Registrada**: no.

---

## 7. Grupo G — Las cifras de los guards y su reparto · las 7 contestadas, y 2 son la misma pregunta dos veces

Origen: `rastro-12cc0879f.md` §6 (21:15) y `rastro-7676082e6.md` §6 (21:42). **Los dos rastros
corren con 27 minutos de diferencia y el segundo repite dos preguntas del primero**, en un caso
diciéndolo (*«Queda en pie, sin moverse, la pregunta 2 de la tanda anterior»*).

**Todas se contestan dentro de `DEC-TEST-001`**, que acumuló **cinco enmiendas el mismo día**. Y hay
una verificación externa que conviene citar porque es del propio corpus: **`rastro-31ce26bb2.md` §7**
recorre las preguntas de `rastro-7676082e6.md` una por una y declara cuáles dejaron de estar
abiertas.

| # | de dónde sale | la pregunta, en corto | dónde se contesta |
|---|---|---|---|
| `G1` | `rastro-12cc0879f.md` §6 pt. 1 (257-262) | ¿se enmienda la cifra intermedia de `DEC-TEST-001`, o vive sólo en `B/20` §2? | `DEC-TEST-001`, bloque anclado: *«**Decisión del owner del 2026-09-21**, entre retirar la cifra, anclarla, o seguir corrigiéndola a mano»* → **se ancla al SHA `7676082e6`** |
| `G2` | `rastro-12cc0879f.md` §6 pt. 2 (263-268) | catorce de veintiocho guards sin unidad: ¿se reparten ahora o se declara para la FASE 10? | `DEC-TEST-001`, **quinta enmienda**: *«**LOS GUARDS SIN UNIDAD SE REPARTEN AHORA** … eligió la 1 **contra** la recomendada»*. Ejecutado: `rastro-40b922120.md` §3, *«ninguna de las catorce quedó sin dueño»* |
| `G3` | `rastro-12cc0879f.md` §6 pt. 3 (269-272) | `G-R6` queda verde por un solo escritor de cuatro: ¿alcanza la lista cerrada, o lleva guard propio? | `DEC-TEST-001`, **tercera enmienda**: *«**la lista lleva guard propio**, que falle si alguien escribe `inactiva_desde` desde un lugar que la lista no nombra»* → nace `G-R6-B` |
| `G5` | `rastro-7676082e6.md` §6 pt. 1 (316-321) | **la misma que `G1`**, hecha 27 minutos después | idem `G1`. `rastro-31ce26bb2.md` §7 lo declara: *«**contestada por `05fabfe1f`** … el owner eligió **anclarla al SHA**, que es la tercera salida y ninguna de las dos que la pregunta ofrecía»* |
| `G6` | `rastro-7676082e6.md` §6 pt. 2 (322-327) | la mitad de **consumidores** de la lista quedó sin guard: ¿se le agrega a `G-R6-B` o se deja para la FASE 10? | `DEC-TEST-001`, **cuarta enmienda**: *«`G-R6-B` vigila las DOS mitades de la lista»*, con la condición de que *«el mensaje del guard tiene que decir QUÉ MITAD falló»*. `rastro-31ce26bb2.md` §7: *«**está contestada**: el owner eligió agregársela al mismo guard, el mismo día»* |
| `G7` | `rastro-7676082e6.md` §6 pt. 3 (328-332) | `G-R6-B` nace con unidad `V6` y había dos candidatas: ¿se confirma `V6`? | `DEC-TEST-001`, condición 2 del reparto: *«la unidad nace ANTES o CON lo que el guard vigila … **el criterio que confirmó `V6` para `G-R6-B`***»*; el argumento rehecho con la mitad de lectores está en `V/descomposicion.md` §2.5 y `rastro-31ce26bb2.md` §7 (*«**confirma V6**, así que la celda no se movió»*) |
| `G8` | `rastro-7676082e6.md` §6 pt. 4 (333-335) | **la misma que `G2`**, y el propio texto lo dice: *«Queda en pie, sin moverse, la pregunta 2 de la tanda anterior»* | idem `G2` |

**Registradas**: ninguna de las siete, en ninguno de los dos registros.

> **Lo que este grupo deja como aprendizaje y no como pregunta**: el número de guards sin unidad se
> movió **tres veces en un día** dentro de la misma entrada del log, y la salida elegida —anclarlo a
> un SHA— es la que el resto del programa ya usa para los conteos. No hay nada que decidir acá; está
> decidido.

---

## 8. Grupo H — La lista de `inactiva_desde` · las 2 abiertas, ninguna registrada

Origen: `rastro-31ce26bb2.md` §8 (2026-09-21 22:40). **Es el penúltimo rastro de la tanda, y sus dos
preguntas no las recoge ninguna decisión ni ningún rastro posterior** — el último,
`rastro-40b922120.md` (23:01), es el del reparto y no las toca.

### `H1` — La lista de los cinco consumidores se reparó para poder anclarla · **`DECISIÓN DEL OWNER`**

- **De dónde sale**: `rastro-31ce26bb2.md` §8, punto 1 (líneas 351-355).
- **La pregunta**: *«si el criterio es que los **tres** avisos figuren juntos en el renglón y el
  quinto pase a ser otra cosa, la lista se reescribe y el guard cuenta lo mismo. ¿Queda como está?»*.
- **Qué la generó**: anclar la mitad *(b)* de `G-R6-B` (la cuarta enmienda de `DEC-TEST-001`) obligó
  a leer la lista de consumidores contra el corpus, y aparecieron dos defectos de redacción: que
  *«los mismos cinco que el cap. 01 §1.2 enumera»* **era falso** (ese § enumera los **cuatro
  hechos**, no los consumidores) y que *«los dos avisos de schedule»* parecía contradecir al núcleo,
  que cuenta **tres** (el tercero entra por la superficie que imprime su fecha). Los dos quedaron
  escritos en `V/02` §2.5.
- **Las dos alternativas**:
  1. **Dejarla como está**: cinco consumidores, con los dos avisos de schedule y la superficie del
     archivado contados por separado, y la explicación al lado para que nadie la lea como lista corta
     y la «arregle». **Cuesta cero.**
  2. **Reescribirla** agrupando los tres avisos en un renglón y convirtiendo el quinto en otra cosa.
     **Cuesta tres lugares** —`V/02` §2.5, `NUCLEO/01` §1.2 y la referencia cruzada de `B/20` §2— y
     **el guard cuenta exactamente lo mismo**, así que no compra ninguna vigilancia: compra
     legibilidad.
- **Registrada**: **no**.

### `H2` — Ninguna de las dos mitades comprueba que sus miembros declarados EXISTAN · **`DEFECTO DISFRAZADO` · severidad `MEDIA`**

- **De dónde sale**: `rastro-31ce26bb2.md` §8, punto 2 (líneas 356-359).
- **Qué se rompe**: `G-R6-B` vigila **una sola dirección** —que no haya intrusos: un escritor o un
  lector **fuera** de la lista—. **No comprueba que los declarados sigan existiendo.** El día que el
  hard delete del día 180 deje de leer `inactiva_desde` —por un refactor, por un rename, por una
  reescritura del cálculo—, **el guard sigue verde** y la lista sigue diciendo que ese lector está
  ahí. Es la dirección en la que el fallo se paga con contenido: el consumidor más caro de esa
  columna es el **borrado irreversible**.
- **Por qué es defecto y no una pregunta de agenda**: el rastro lo presenta como *«¿Se mira en la
  FASE 10 o se declara fuera de alcance como la otra mitad?»*, pero **la analogía con «la otra
  mitad» no se sostiene y el propio texto lo dice**: para **escritores** está decidido —comprobar que
  existan es *«la forma rechazada»* por `DEC-TEST-001` punto 2, porque un guard sólo puede comprobar
  su forma—; **para lectores es distinto y el rastro lo mide**: *««el día 180 no lee la columna»
  sería un rojo verificable **sin pedirle a nadie que declare nada**»*. O sea que **es comprobable
  como hecho**, que es exactamente el criterio con el que `DEC-TEST-001` aceptó `G-R6-B` y rechazó el
  otro. La mitad quedó afuera por analogía con un caso que no es el mismo.
- **Por qué `MEDIA` y no más alto**: **hoy no rompe nada** —los guards de este programa son
  declaraciones en `B/20` §2 y `V/20` §2 hasta la FASE 10—. Lo que está mal es la **cobertura
  declarada** de una defensa: `G-R6-B` afirma vigilar la lista y vigila la mitad de la lista, que es
  el patrón *«un inventario que afirma completitud sin tenerla»* que la 8-bis-4 encontró cinco veces.
- **Registrada**: **no**.

---

## 9. Grupo I — El reparto: capítulos y predicados sin dueño · las 3 abiertas, ninguna registrada

Origen: las dos `descomposicion.md`, escritas en la última vuelta de la tanda. **Son las únicas tres
de las 33 que no salen de un rastro**, y las tres son defectos del reparto, no elecciones de
producto. `rastro-40b922120.md` §3 las recoge y las declara textualmente como lo que **no** son:
*«tres cosas, **ninguna de ellas una asignación faltante**»* — esa lectura es correcta para la
asignación de los catorce guards, y **es la que hace que estas tres se lean como notas.**

### `I1` — `G-R6` tiene un predicado global y el corpus se construye por partes · **`DEFECTO DISFRAZADO` · severidad `ALTA`**

- **De dónde sale**: `HOS-1353-verticales-capacidades-y-autorizacion/descomposicion.md` §2.8, líneas
  248-265. Repetida en `rastro-40b922120.md` §3 punto 2.
- **Qué se rompe**: `G-R6` exige que *«al menos una transición **del corpus** escriba»* cada columna
  que una condición lee, **y el corpus son nueve máquinas repartidas en dos épicas que se construyen
  a lo largo de todo el programa**. El caso está medido en el propio catálogo: *«la fecha del próximo
  cobro tiene **tres** escrituras (`B/03` §7.2) y una de ellas es `S10`, que es de **B8**, mientras
  la condición que la lee es de **B5**»*. **Entre `B5` y `B8` el guard da rojo sobre el camino
  normal**, y `B5` → `B7` → `B8` son tres unidades consecutivas **del camino crítico** de la épica de
  billing (`B/descomposicion.md` §3). El propio texto nombra el desenlace: es *«un guard que alguien
  va a relajar»* (la fila de `G-R1-A`).
- **Severidad `ALTA`**: no cuesta plata ni datos por sí mismo, pero **garantiza que un guard nazca en
  rojo sobre código correcto durante tres unidades del camino crítico**, y el que se choque con ese
  rojo lo va a resolver como se resuelven los rojos que estorban: relajándolo o apagándolo. Lo que se
  pierde entonces es la vigilancia de la clase que costó `F-8eB1-002` —**un crítico de dinero**: el
  pagador manual pagaba una vez en la vida y seguía cubierto—. Es la única de las 33 que `C2` nombra
  como bloqueante de la liberación, y en eso `C2` tiene razón.
- **Las dos salidas, que el § ya enuncia** (las nombro porque el owner las va a necesitar aunque la
  clasificación sea de defecto):
  1. **Que el guard evalúe sobre las máquinas existentes en cada momento.** Cuesta reescribir su
     enunciado y **le baja la fuerza**: deja de ser una propiedad del diseño y pasa a ser una del
     avance.
  2. **Que su rojo sea informativo hasta que las nueve máquinas estén.** Cuesta que durante meses el
     guard no falle CI, o sea que la primera vez que importe nadie lo esté mirando.
  **La asignación de unidad no depende de cuál se elija** —el § lo dice y está medido—, así que esto
  **no** bloquea el reparto: bloquea el enunciado.
- **Registrada**: **no**. Es la única de las 33 cuyos términos `C2` grepeó contra los dos registros
  (*«predicado global»*, *«corpus se construye por partes»*, *«entre `B5` y `B8`»*): **cero en los
  dos**, y las tres apariciones están sólo en `V/descomposicion.md`.

### `I2` — `B/02` §2.5, la tabla de los trece motivos de la marca, no es capítulo de ninguna unidad · **`DEFECTO DISFRAZADO` · severidad `MEDIA`**

- **De dónde sale**: `HOS-1354-billing-cobro-y-proveedor/descomposicion.md` §2.9, punto 1, líneas
  390-396. Repetida en `rastro-40b922120.md` §3 punto 3.
- **Qué se rompe**: **`G-R1-F` lee esa enumeración para decidir si un motivo de marca existe**, y la
  tabla que enumera **no tiene quién la construya**. Medido en el propio documento recorriendo la
  columna *capítulos* del §2: *«`02` §2.1 es de B2, §2.2 de B3, §2.3 de B5, §2.4 de B9 y B10, §2.6 de
  B8 — **y §2.5 no aparece**»*. La única mención del § en el documento de reparto está en el §1.3
  regla 3, **que lo cita como regla y no como trabajo**. Consecuencia: quien construya `G-R1-F` en
  `B3` se encuentra con un guard que compara contra una tabla que nadie sembró.
- **Por qué es defecto y no decisión**: **falta una fila en una tabla de reparto**, no hay dos
  políticas entre las que elegir. El propio § dice que *«la asignación a `B3` no depende de la
  respuesta —la entidad y sus dos actos son de `B3` igual—, pero **la tabla sí necesita dueño**»*: o
  sea que **la unidad candidata ya está identificada**. La 9-bis-5 la puede escribir.
- **Severidad `MEDIA`**: no rompe nada hoy —los guards son declaraciones hasta la FASE 10— y el daño
  llega en la construcción, no en producción. Sube si `B3` se construye sin la tabla y `G-R1-F` se
  declara cubierto contra una enumeración vacía, que es el patrón del inventario que afirma
  completitud sin tenerla.
- **Registrada**: **no**.

### `I3` — Los inventarios de `NUCLEO/01` §2.4, §2.5 y §2.6 tampoco lo son · **`DEFECTO DISFRAZADO` · severidad `MEDIA`**

- **De dónde sale**: `HOS-1354-billing-cobro-y-proveedor/descomposicion.md` §2.9, punto 2, líneas
  397-404. Repetida en `rastro-40b922120.md` §3 punto 3.
- **Qué se rompe**: **`G-R1-E` y `G-R1-F` cuentan esos inventarios**, y los tres § no son capítulo de
  ninguna unidad. El texto desarma explícitamente la creencia que lo tapaba: *«su veredicto de la
  FASE 8-bis-4 dice «`nucleo/01` entró por `V9`» — pero lo que entró por `V9` es el **§1.2**, los
  cuatro hechos de reinicio, **no los inventarios del §2**»*. **No es hallazgo nuevo**: `F-8dC2-002`
  ya reporta que cuatro capítulos del núcleo no son de ninguna unidad — o sea que **este defecto
  lleva al menos dos vueltas reportado y sigue sin dueño**.
- **Por qué es defecto**: mismo argumento que `I2` — faltan filas en el reparto, no hay alternativas.
  A diferencia de `I2`, **acá la unidad candidata NO está identificada**, y ésa es la parte que
  cuesta: los inventarios son del núcleo, que las dos épicas comparten, y `DEC-ARCH-006` dice que
  *«ninguna de las dos épicas lo puede mutar sola»*.
- **Severidad `MEDIA`**, por lo mismo que `I2`.
- **Registrada**: **no**.

---

## 10. Lo que encontré fuera de las 33

El barrido se corrió sobre todo el corpus de diseño —las dos épicas con sus `spec.md` y
`descomposicion.md`, el núcleo, el contrato (`12-contrato-de-cobertura.md`), la partición
(`11-particion-del-programa.md`) y los documentos de medición—, con y sin backticks, con los términos
*«para el owner»*, *«decide el owner»*, *«decisión del owner»*, *«queda para el owner»*, *«pregunta
al owner»*, *«queda abierto»*, *«sigue abierto»*, *«no está decidido»*, *«sin decidir»*, *«hay que
decidir»*, *«no lo decidí»*, *«no la tomé»*, *«no se eligió»* y *«decisión de producto»*. Resultado:

**Ninguna pregunta de la tanda quedó fuera de las 33.** Los capítulos que declaran preguntas al owner
—`B/03` línea 1873, `B/09` línea 493, `B/10` línea 178, `B/14` líneas 411 y 471— son **la otra cara
de las mismas** (`F3`, `E1`, `F2`), no ítems nuevos: los rastros las elevaron desde ahí.

**Y tres cosas que no son de la tanda y conviene que el owner vea igual**, porque comparten el modo
de falla — están declaradas en un capítulo y no en un registro:

| # | qué | dónde | clasificación | ¿registrada? |
|---|---|---|---|---|
| `X1` | **Qué pasa con una cortesía pausada cuando se retira el plan** — `SUPER_ADMIN` le firmó N días y el plan desaparece debajo. *«Queda abierto como pregunta al owner; el precedente de cómo tratarlo es `DEC-GRANT-007`»* | `01-decision-log.md`, **`DEC-SUB-015`**, viñeta *«Un borde que esta decisión NO cierra»* | **`DECISIÓN DEL OWNER`** — alternativas: diferir el saldo como `DEC-GRANT-010`, o dejar correr la cortesía sobre el plan retirado hasta agotarla | **en el cuerpo del log, no en los registros.** Es de la tanda, y `C2` no la cuenta porque no está en un rastro |
| `X2` | **Qué pasa con el trial de las dos cuentas del corte** — cubiertas por un grant, `T6` les nace la fila de `trial` **consumida**; si el grant se revocara, quedan sin grant y sin el trial que nunca usaron. *«Es un defecto de la máquina de trial, no del corte, **está abierto y lo decide el owner**»* | `HOS-1353/docs/21-migracion.md` §2.4, líneas 108-113 | **`DECISIÓN DEL OWNER`** — alternativas: que la revocación devuelva el trial no usado (contra `DEC-TRIAL-009`), o declararlo perdido | **no.** Es de la 9-bis-**3** (commit `1e3c3fc9e`, 2026-09-21 02:59, anterior al rango de la tanda) |
| `X3` | **Cuántas veces se retira un plan del catálogo** — *«**No hay una cifra en el corpus.** La decisión se apoya en el juicio del owner de que es un evento poco frecuente, y **eso es un juicio, no un dato**. Si resultara frecuente, la que hay que releer es esta entrada»* | `01-decision-log.md`, **`DEC-SUB-015`**, viñeta *«Lo que NO está medido»* | **medición** — pero **NO es una sonda contra el proveedor**: se contesta contra nuestro propio catálogo e historial | en el cuerpo del log, no en los registros |

**Lo pre-existente sí está registrado, y eso confirma dónde se cortó el registro.** Los ítems abiertos
que los capítulos declaran en sus §§ *«Lo que este capítulo NO cierra»* —`BD-TRIAL-01` (`V/11`),
`C-DATA-01` (`V/11`), el mes por calendario o aniversario (`DEC-ENT-002` impl. 2, `V/15` y `V/spec`),
el aumento sobre una suscripción en mora (`DEC-MP-002` impl. 6, `B/12` y `B/10`), el evento de
activación de Partner (`DEC-TRIAL-003`), los addons que cuelgan del cliente (`DEC-SUB-007` impl. 4) y
las seis preguntas legales— **son todos rastreables en `04-open-decisions.md` por su ID**, medido con
`rg -c` uno por uno. Es decir: **el registro funcionó hasta el 2026-09-19 y dejó de funcionar
exactamente en la tanda del 21/22**, que es el commit que le falta.

---

## 11. Lo que este censo NO hace

- **No resuelve ninguna de las once abiertas** ni escribe ninguna decisión. Las alternativas que
  enumera salen del texto que las declara; ninguna es una recomendación propia.
- **No edita ningún registro.** `04-open-decisions.md` sigue con sus 33 ausencias y el `## Resumen`
  sigue diciendo *«0 de 25»*. Ponerlas ahí es escribir en un registro, y esto es un censo.
- **No arregla los seis defectos.** Los describe con su severidad para que la 9-bis-5 los absorba, que
  es para lo que se pidió.
- **No audita las 22 contestadas más allá de su cita.** Cada una se verificó **contra el texto
  vigente del decision log o del capítulo**, no contra el mensaje de un commit ni contra el informe
  que la citaba; lo que **no** se verificó es si la respuesta es buena, sólo que existe y que responde
  a esa pregunta.
- **No cuenta las preguntas abiertas del corpus anteriores a la tanda.** El §10 nombra las que el
  barrido encontró y mide que están registradas; contarlas todas es otro encargo.
