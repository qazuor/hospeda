---
title: "FASE 9 vuelta 2 · aplicación — la costura"
linear: HOS-1352
statusSource: linear
created: 2026-09-27
updated: 2026-09-27
status: CURRENT
fase: 9
---

# FASE 9 vuelta 2 · aplicación — grupo C, la costura

Racimos R5, R11, R12, R16 y R26 del [consolidado](./00-hallazgos.md), más el espejo de `B/05` §3
que dejó pendiente el grupo B ([`12-aplicacion-el-corte.md`](./12-aplicacion-el-corte.md) §5).
R5 aplica la decisión `R5` de [`10-decisiones-del-owner.md`](./10-decisiones-del-owner.md). R11,
R12, R16 y R26 son escritura sin decisión. `C1-005` y `C1-006` son R26 según la tabla de
trazabilidad (`00-hallazgos.md` §8), y los dos eran de escritura.

Medido y editado en el worktree `hospeda-spec-hos-1352-billing-redesign`, sin commits, sobre lo que
dejaron commiteado los grupos A (`a0865c7bf7`) y B (`2d285a3c7c`). `D/12` es el contrato, `B/` es
`HOS-1354…/docs` y `V/` es `HOS-1353…/docs`. No toqué `B/21`, `D/16` ni `V/21`.

## 1. Qué se aplicó

### R5 · decisión `R5` — billing sólo avisa, verticales ejecuta (`F-8V2A3-001`, `F-8V2C1-001`)

**La pregunta.** `vertical.fin_de_servicio` deja de ser una columna de verticales. La fecha la
calcula billing con la fórmula de `B/10` §4.3, y verticales la lee por una pregunta nueva del §4.1,
`finDeServicio(vertical) → fecha | NINGUNA`. No había ninguna pregunta que sirviera: la única que
devolvía la fecha, `situaciónDeVertical`, iba en la dirección contraria (billing leyendo de
verticales), y con billing calculándola habría sido billing leyéndose a sí mismo por la frontera.
Por eso `finDeServicio` sale de `situaciónDeVertical`, que se queda con `admiteAltas`.

- La firma nueva, en el bloque del §4.1:
  `D/12:1104` — «finDeServicio(vertical)        → fecha | NINGUNA»
- Por qué es la única entrada que pregunta verticales:
  `D/12:1113` — «Es la única entrada de este § que pregunta verticales y contesta billing»
- La mitad de ida de la regla de vigilancia la nombra, porque es algo que verticales necesita de
  billing fuera de `cubierto`, `cobrada` y `piso`:
  `D/12:1257` — «ni es la pregunta `finDeServicio` del §4.1»
- Cruza una fecha que no es de cobro, dicho en el §4:
  `D/12:1055` — «Y cruza una fecha que no es de cobro»
- La de arranque contesta `NINGUNA`:
  `D/12:1310` — «y a `finDeServicio` (§4.1) contesta `NINGUNA`»
- La columna que el contrato obligaba a crear ahora es una sola:
  `D/12:1220` — «Una columna que esto obliga a crear»
- §2.6, quién lee la fecha:
  `D/12:594` — «con una sola pregunta nueva, que hace verticales»

**El día del fin de servicio.** La cobertura cae a falso por el §2.6 y las `S26` consuman su
`CANCELLED` con el aviso que ya emiten. `PB2`, el hecho 4 y la invalidación los ejecuta **el
reconciliador diario de cobertura** (V6), en su corrida del día. Lo elegí porque ya corre por
calendario, ya corre `PB2`, ya escribe hechos del reloj y ya invalida el caché. No agrega ningún
reloj. `extenderTrial` sigue siendo la única escritura de billing en verticales.

- `D/12:621` — «Billing sólo avisa, y verticales ejecuta»
- El texto de `B/10` §4.3 se mudó a una subsección nueva de `V/03` §9:
  `V/03:1219` — «### El día del fin de servicio: billing avisa, verticales ejecuta»
- El hecho 4 se escribe con el instante de la fecha, sólo sobre fichas con un `inactiva_desde`
  anterior, así que repetir la corrida da lo mismo:
  `V/03:1244` — «Escribe el hecho 4 en cada ficha de la vertical»
- La fuente de trial lee la fecha por la pregunta: `V/03:80` — «La fecha la lee por la pregunta»
- El reconciliador suma el 4 a los hechos que escribe: `V/03:1136` — «y el 4 en»
- El ⚠️ punto 2 del reconciliador: `V/03:1197` — «este reconciliador en la corrida de ese día»
- En `B/10` §4.3 quedan lo tachado y la remisión:
  `B/10:334` — «Y lo ejecuta verticales, no este barrido»
- `B/10:286` — «Las fichas de las tres primeras filas las baja verticales»
- `B/10:257` — «las baja verticales, no billing»
- `B/10` §4.6, quién calcula la fecha:
  `B/10:400` — «ya no se lee de verticales: lo calcula billing»
- Dónde la guarda billing no está escrito, y queda declarado en un ⚠️ (§4 de este registro,
  pregunta 1): `B/10:406` — «dónde guarda billing la fecha»

**El glosario del núcleo** (quién ejecuta el hecho 4):

- `nucleo/01:57` — «Lo ejecuta verticales: el reconciliador diario de cobertura»
- El párrafo del ejecutor del hecho 4, en el mismo lugar del glosario: `nucleo/01:184` —
  «el reconciliador diario de cobertura,»

**`V/02`**: la columna de `vertical`, el ejecutor del hecho 4 y la fila de invalidación.

- `V/02:118` — «dejó de ser columna de»
- `V/02:368` — «a éste lo ejecuta el»
- `V/02:543` — «reconciliador diario de cobertura en su corrida de ese día»
- Espejos de la fuente del hecho 4 en los catálogos de guards y en el spec:
  `V/20:96` — «la pregunta `finDeServicio` del contrato §4.1 (FASE 9»,
  `B/20:308` — «la pregunta», `$V/spec.md:125` — «la fecha de fin de servicio la calcula billing y verticales»

**Unidades.**

| qué | unidad | dónde |
|---|---|---|
| la corrida del fin de servicio: `PB2`, el hecho 4, la invalidación de la vertical | **V6** | fila y criterio |
| la respuesta de arranque `NINGUNA` | **V4** | fila |
| el hecho 4 en la lista, con su ejecutor nuevo | **V9** | fila |
| la invalidación de la vertical entera, invocada ahora por V6 | **V3** | fila |
| la respuesta real de `finDeServicio` y la fórmula | **B12** | fila y criterio |
| `B4` lee la fecha de `B12`, no de `V2` | **B4** | fila |

- `$V/descomposicion.md:59` — «y que en su corrida del día del fin de servicio de una vertical»
- `$V/descomposicion.md:513` — «la corrida del reconciliador baja la ficha publicada»
- `$V/descomposicion.md:57` — «la respuesta de arranque de `finDeServicio`»
- `$V/descomposicion.md:62` — «el cuarto lo escribe el reconciliador diario de cobertura»
- `$V/descomposicion.md:56` — «invoca el reconciliador diario de cobertura, de V6»
- `$V/descomposicion.md:379` — «el día del fin de servicio lo ejecuta verticales»
- `$V/descomposicion.md:329` — «Y `finDeServicio` no es de»
- `$B/descomposicion.md:138` — «la pregunta `finDeServicio` del contrato §4.1, que contesta»
- `$B/descomposicion.md:744` — «billing no escribe nada en verticales»
- `$B/descomposicion.md:130` — «con la fecha que calcula»

**La flecha entre épicas** (`$B/descomposicion.md` §2.6). La fila 8 (`B4` leyendo `finDeServicio`
de `V2`) se tacha, porque la fecha ya no cruza hacia billing. La fila 6 (`B12`) pierde
`finDeServicio`. Entra la fila 13, `B12` contra `V4`: `B12` enchufa la respuesta real sobre la
interfaz y la respuesta de arranque de V4, igual que `B4` con `cobertura()`. La flecha inversa (V6
leyendo lo que contesta `B12`) no es una dependencia de construcción, porque verticales se
construye contra `NINGUNA`.

- `$B/descomposicion.md:338` — «Tachada (FASE 9 vuelta 2, `R5`): la fecha»
- `$B/descomposicion.md:343` — «| 13 ✚ | B12»
- `$B/descomposicion.md:358` — «La 8 se tachó y la 12 y la 13»

### R11 — el ancla de un grant y su plan vigente (`F-8V2C1-004`, `F-8V2B3-009`)

La lectura mínima es la que ya existe: **la versión del piso la trae el acto** (otorgar, anclar o
la herramienta del corte), y **billing la acepta sólo si `políticaDePlan(v).vigente`**. Si no, el
acto se rechaza. La FK compuesta de `B/02` §2.4 ya ata la versión a su plan y el plan a su
vertical. Billing no ordena por `rank`: *«el vendible de `rank` más alto»* lo elige quien firma,
leyendo el catálogo.

- `D/12:723` — «Y la del piso la valida con»
- `D/12:727` — «la acepta sólo si»
- `B/02:786` — «Qué versión es la»
- Fila y criterio de B9, con el 3b corregido para `B3-009`:
  `$B/descomposicion.md:135` — «de la vertical en que tenían `comp`»
- `$B/descomposicion.md:741` — «otorgar o anclar un grant con una versión de piso»
- La dependencia nueva, B9 contra V2 (un consumidor más de un campo ya declarado):
  `$B/descomposicion.md:342` — «| 12 ✚ | B9»

**Pendiente del orquestador, porque son archivos vedados.** El texto del 3b vive también en
`D/16:130` y en `B/21:124`. Texto propuesto para los dos, en lugar de *«anclados al vendible de
`rank` más alto de Alojamiento, en la vertical en que tenían `comp`»*:

> anclados al vendible de `rank` más alto ~~de Alojamiento, en la vertical en que tenían `comp`~~
> **de la vertical en que tenían `comp`** —el de Alojamiento, si la cortesía era de Alojamiento—,
> **con la versión que elige quien opera el corte, aceptada sólo si `políticaDePlan(v).vigente`**
> (`12-contrato…` §2.8; FASE 9 vuelta 2, `F-8V2C1-004`, `F-8V2B3-009`)

### R12 — el censo de emisores como regla (`F-8V2C1-003`, `F-8V2C1-007`, `F-8V2A2-008`)

La regla (*«todo acto que cambia una fuente emite»*) pasa a ser el censo, y la lista queda como su
auditoría. La auditoría recorrió `B/03` §3.2, §6.1 y §8, la tabla de `V/03` §2 y el catálogo de
`NUCLEO/08` §3. Suma el anclaje y `T6`–`T8`, y deja escrito lo que se descartó y por qué.

- `D/12:906` — «El censo es la regla de arriba, y no la lista de abajo»
- `D/12:907` — «Todo acto que cambia una fuente emite»
- `D/12:920` — «El anclaje faltaba»
- `D/12:924` — «y `T6`, `T7` y `T8`, que»
- `D/12:930` — «Lo que el recorrido descartó»
- El anclaje avisa, en el capítulo del grant: `B/14:427` — «Y los dos emiten el aviso de cobertura»
- Unidades: el anclaje a **B9**, `T6`–`T8` a **V4**:
  `$B/descomposicion.md:135` — «y anclar una vertical nueva a un grant emite»,
  `$V/descomposicion.md:57` — «emiten el aviso de cobertura, como»

### R16 — el aviso sale después del commit (`F-8V2C1-002`)

`rg -n "mismo acto"` sobre `$B`, `$V`, `$D/nucleo` y el contrato encontró dos textos de emisor del
aviso de cobertura: la frase del censo en `D/12` §3 y la cabecera de la tabla de `B/03` §3.2.
Encontró además un tercero sin orden escrito, la fila `P1` de `B/03` §6, que es justo el ejemplo del
hallazgo. Los demás *«mismo acto»* son de escrituras, no del aviso, o ya estaban tachados, como el
§3.1.

- `D/12:893` — «después del commit de su escritura y nunca dentro de su transacción»
- `D/12:946` — «Y vale para cada»
- `B/03:142` — «después del commit de su escritura, y nunca dentro de su»
- `B/03:1796` — «después de su commit, nunca dentro de su transacción»
- El caso de `B4`: `$B/descomposicion.md:736` — «el aviso sale después del commit (contrato §3»

### Espejo de `B/05` §3 — el cobro posterior sobre la lápida del corte (`R2`, del grupo B)

Las cuatro líneas que el grupo B dejó señaladas (249, 275, 316 y 335 de `B/05`) y una quinta, la
353, que decía que sobre la lápida del corte el barrido no compara, contra `B/09` §3.

- `B/05:250` — «si es posterior, lo que asigna esa tabla»
- `B/05:277` — «el posterior cae en la tercera fila»
- `B/05:318` — «con `date_created` posterior al día del corte»
- `B/05:345` — «posterior sí desempata»
- `B/05:361` — «compara sólo los registros posteriores al día del corte»

### R26 — qué es «la de arranque» y qué es «las dos» (`F-8V2C1-005`, `F-8V2C1-006`)

- `G13` tiene un objeto con nombre: el módulo que contesta por billing (el `no` a las cuatro fuentes
  y el `NINGUNA` de `finDeServicio`). La resolución del trial y la de `BASE` no son ese módulo.
  `D/12:1420` — «Qué pieza es «la de arranque» para este guard»
- `D/12:1425` — «falla si un build destinado a»
- Las dos del §6.2 son siempre las dos implementaciones. El caso distintivo lo pasan las dos y
  falla contra una constante: `D/12:1391` — «las dos implementaciones lo»
- Los casos de las fuentes de billing van a un juego propio de la real:
  `D/12:1396` — «Los casos de las fuentes de billing no son del juego único»
- Criterios: `$B/descomposicion.md:736` — «pasa entero contra las dos, y su caso distintivo»,
  `$V/descomposicion.md:511` — «y uno que importa la resolución del trial»

## 2. Conteos recontados

| lista | antes | ahora | comando | espejos |
|---|---|---|---|---|
| entradas del §4.1 | 7 (6 preguntas y 1 operación) | **8** (7 y 1) | `python3` sobre el bloque ```` ```text ```` del §4.1, una entrada por línea | `D/12:1207`; sin otros espejos (`rg` de *siete entradas* y *seis preguntas*) |
| campos de las cuatro consultas | 13 | **12** (`situaciónDeVertical` pasa de 2 a 1) | el mismo script, contando los campos entre llaves | `D/12:1207`; los de V2 (`políticaDePlan` y `situaciónDeVertical`) pasan de 6 a **5** en `D/12:1238`; `$V/descomposicion.md:509` (criterio de V2); `V/02:130` |
| dependencias de billing sobre la otra épica | 11 | **12** (−fila 8, +12, +13), sobre las mismas cuatro unidades | filas `^\| [0-9]` de la tabla de `$B/descomposicion.md` §2.6, sin la tachada | título del §2.6 y el párrafo nuevo (`$B/descomposicion.md:311`, `:358`); `rg` de *once* y *ONCE* sin otros espejos |
| hechos del reloj | 6 | **6** | cambió el ejecutor del 4, no la lista | — |
| ejecutores del hecho 4 | 1 (el barrido de `B12`) | **1** (el reconciliador de V6) | — | glosario, `V/02` §2.5, `V/03` §9 |
| motivos de la marca | 23 | **23** | el cobro posterior va al 7 (espejo de `R2`) | — |

## 3. Propuestas para el log y la matriz

Grepeados antes: `DEC-ARCH-006` (`$D/01-decision-log.md:2241`), `DEC-ARCH-009` (`:5545`) y `DEC-ARCH-011`
(`:5962`).

1. **`DEC-ARCH-006`** (el contrato con dos implementaciones). Razón: `R5` suma una entrada al §4.1
   en la dirección de ida y saca `finDeServicio` de `situaciónDeVertical`, así que el contrato ya
   no tiene sólo a billing contestando `cobertura()`. Texto propuesto:
   > 📌 **Precisado el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R5`)**: la fecha de fin de
   > servicio de una vertical la calcula billing y verticales la pregunta por `finDeServicio`
   > (`12-contrato…` §4.1), que en la implementación de arranque contesta `NINGUNA`. El día del fin
   > de servicio billing sólo avisa. `PB2`, el hecho 4 y la invalidación de la vertical los ejecuta
   > el reconciliador diario de cobertura (`V/03` §9). `extenderTrial` sigue siendo la única
   > escritura de billing en verticales.
2. **`DEC-ARCH-011`** (*«su fin de servicio invalida el caché de la vertical entera»*, 6a/6b).
   Razón: cambia quién la invoca. Texto propuesto:
   > 📌 **2026-09-27 (FASE 9 vuelta 2, `R5`, con OK del owner)**: la invalidación de la vertical
   > entera el día del fin de servicio la invoca el reconciliador diario de cobertura de
   > verticales, no el barrido de billing.
3. **Matriz**: ninguna fila.

## 4. Preguntas abiertas

1. **Dónde guarda billing la fecha de fin de servicio.** La decisión dice que billing la calcula.
   No se puede evaluar en cada pregunta, porque pasado el fin de servicio los compromisos dejan de
   estar vivos y el máximo de la fórmula cambiaría, y `B/02` no tiene ninguna entidad por vertical.
   Quedó declarado en un ⚠️ de `B/10` §4.6, sin inventar la tabla. Las dos lecturas:
   - **A: una fila de billing por vertical discontinuada** (el anuncio y la fecha), que escribe el
     acto del día 0 y reescribe el acortamiento de `B/10` §4.4. **Daño**: ninguno de producto. Es
     una entidad nueva en `B/02`, y `B4` (temprana) leería una fecha que escribe `B12` (tardía):
     el criterio de `B4` sobre el fin de servicio se prueba con la fila sembrada hasta que llegue
     `B12`.
   - **B: la columna se queda en `vertical`, y verticales la escribe con lo que contesta la
     pregunta el día del anuncio.** **Daño**: dos copias de la misma fecha. Si `SUPER_ADMIN` acorta
     la cola, o un cobro tardío la extiende, la copia envejece y el hecho 4 o el borrado caen en la
     fecha vieja. Además hace falta un disparador para que verticales pregunte.
   Recomiendo **A**. La B contradice *«verticales lo lee por una pregunta»*.
2. **Quién escribe `vertical.admite_altas` el día del anuncio.** Es la misma forma de R5, sobre la
   otra columna: `B/10` §4.3 dice *«la vertical deja de admitir altas»* como parte del acto de
   billing, y la columna es de verticales. No lo tocó ninguna decisión. **Lectura A**: el acto de
   `SUPER_ADMIN` es de las dos épicas, y la mitad de verticales escribe su columna. **Daño**:
   ninguno, pero el acto queda partido en dos sin decir quién lo orquesta. **Lectura B**: billing
   la escribe. **Daño**: es otra escritura en verticales fuera del contrato, la filtración que el
   §4.2 manda mirar. No la apliqué.
3. **R11, el 3b.** `G1-3` dice *«de Alojamiento»*. Lo corregí a *«de la vertical en que tenían
   `comp`»*, con Alojamiento cuando la cortesía era de Alojamiento. **Lectura A, la aplicada**: si
   una de las dos cuentas del owner tenía `comp` en otra vertical, se le ancla el vendible más alto
   de esa vertical. **Daño**: ninguno. **Lectura B**: afirmar que las dos son de Alojamiento.
   **Daño**: si no lo eran, la FK del ancla rechaza la escritura y el paso 3 entra en la rama de
   aborto. No está medido de qué vertical son. Si el owner quería Alojamiento sí o sí, es B y hay
   que medirlo antes del corte.

## 5. Casos vecinos

- **`D/16:130` y `B/21:124`** (el 3b): el espejo de R11 va en el §1, sin aplicar.
- **El reconciliador y la *«primera corrida con la fecha cumplida»***: saber cuál es la primera pide
  recordar la anterior. El hecho 4 quedó idempotente por construcción, pero la invalidación de la
  vertical entera, repetida cada día, es barata y segura. No lo escribí como regla.
- **`B/10` §4.3, tabla *«lo que cubría el día anterior»***: sigue hablando del barrido en otras
  frases de alrededor (*«el acto recorría»*). Las leí como historia y no las toqué.
- **El cobro sobre la lápida de una sonda del manifiesto** (vecino del grupo B): no lo toqué.
- **`T6`–`T8` emiten** y la máquina de trial ya invalida el caché por *«toda transición»*: dos
  caminos para lo mismo. No hay daño.

## Key Learnings

1. *«Si ya hay una pregunta que sirve, usala»* obligó a mirar la dirección de cada entrada del §4.1.
   `situaciónDeVertical` devolvía la fecha, pero en la dirección contraria. Con billing
   calculándola, dejarla ahí era billing leyéndose a sí mismo por la frontera.
2. Mudar el ejecutor del hecho 4 no movió la lista de hechos. Movió la fuente de la que se lee, y
   con ella tres espejos que nadie buscaría por «hecho 4» (`V/02` §2.5, `V/20` §2, `B/20`).
3. La mitad de ida de la regla de vigilancia habría marcado la pregunta nueva como filtración. Toda
   entrada nueva de la frontera tiene que pasar por las dos mitades del §4.2.
4. El censo de emisores se dejó afuera a sí mismo dos veces por enumerar filas. La regla es el
   censo, y la lista pasa a ser una auditoría con fecha y con lo descartado dicho.
5. Un archivo vedado deja un espejo pendiente aunque el racimo pida corregirlo (el 3b de R11). Se
   declara con el texto exacto, y no se da por aplicado.
