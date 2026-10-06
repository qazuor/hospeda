---
title: "FASE 8-bis-5 · C1 — la costura: capítulos partidos, el contrato, los invariantes"
linear: HOS-1352
statusSource: linear
created: 2026-09-22
updated: 2026-09-22
status: CURRENT
fase: 8
---

# FASE 8-bis-5 · C1 — la costura

Sexta pasada `C1`, corrida **después de los siete informes**, que existían los siete cuando empecé
—la razón por la que `C1` corre último y no al lado—. Vector: lo que se rompe **entre** documentos
—los capítulos que el desarme partió, el contrato de frontera, el núcleo, los invariantes y los
conteos congelados—. **El núcleo es mío**, y adopto los defectos que los otros siete marcaron
`NUCLEO`.

**Seis hallazgos: 0 `CRITICA`, 2 `ALTA`, 3 `MEDIA`, 1 `BAJA`.** Cuatro son nuevos; dos siguen
llegando con su ID viejo.

Más las tres secciones del encargo: **la deduplicación de los críticos** (§2), **las contradicciones
entre informes con su veredicto** (§3) y **el veredicto de método sobre `DEC-METH-011`** (§4), que
esta vuelta se contesta con evidencia y no razonando, porque el rastro existe.

Abreviaturas como en los demás: `NUCLEO` es `HOS-1352-…/docs/nucleo/`, `V` es `HOS-1353-…/docs/`,
`B` es `HOS-1354-…/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

## Lo que medí yo, y cómo

Todo sobre el worktree `/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign` el
2026-09-22, con `HEAD` en `0f46a7ede`, **nunca** sobre `/home/qazuor/projects/WEBS/hospeda2/`.

| qué conté | con qué | resultado |
|---|---|---|
| entradas con severidad en los siete informes | `rg -c '^\*\*Severidad\.\*\*'` | **86** — A1 6 · A2 9 · A3 22 · B1 13 · B2 16 · B3 9 · C2 11 |
| de ésas, **hallazgos nuevos** (encabezado `### F-8f`) | `rg -c '^### F-8f'` | **72** — A1 6 · A2 9 · A3 22 · B1 6 · B2 9 · B3 9 · C2 11 |
| de ésas, **que siguen llegando con ID viejo** (`F-8e`, `F-8d`, `F-8c`, `F-8b`) | la diferencia, verificada encabezado por encabezado | **14** — **todas** en `B1` (7) y `B2` (7) |
| IDs con `**Severidad.** \`CRITICA\`` | `rg -c '^\*\*Severidad\.\*\* \`CRITICA\`'` | **9** — A1 1 · A2 1 · A3 1 · B1 2 · B2 1 · B3 2 · C2 1 |
| apariciones declaradas por los diez rastros | suma de los encabezados `## Las N apariciones…` | **1.030** — 187+268+118+108+91+69+65+58+45+21 |
| commits de la tanda | `git log --format=%h 5ac5e92c9~1..90e4b326f \| wc -l` | **76**, del 2026-09-21 16:35 al 2026-09-22 21:03 |
| decisiones del log | `rg -c '^### DEC-'` menos la plantilla (L26) | **88** — 11 de metodología, 77 funcionales. **Coincide con el resumen del propio log** |
| filas de la matriz | `contar-filas-de-la-matriz.py` | **89** — 50 `VERIFIED`, 13 `PARTIALLY_SUPPORTED`, 20 `NOT_SUPPORTED`, 6 `UNKNOWN` |
| filas de guard de `V/20` §2 · `B/20` §2 | a mano, fila por fila | **17** · **16**, con `G-R4`, `G-R5`, `G-R6` y `G-R6-B` en las dos = **29 distintos** |
| filas del §3 de `NUCLEO/04` | `rg -o '^\| D[0-9]+'` | **16** (`D1`…`D16`), y 37 + 16 = **53** |
| filas numeradas de `B/03` §3.2 | `rg -o '^\| (S\|MP\|A)[0-9]+ '` | **25** `S`, 5 `MP`, 6 `A` |
| filas de la tabla de acciones administrativas (`NUCLEO/08` §3) | a mano | **12** |
| pares con dos destinos de `NUCLEO/03` §1 regla 7 | a mano | **4** |
| sitios del corpus que dicen que son **tres** | `rg 'G-R4'` sobre el corpus entero | **6** — ver `F-8fC1-003` |

**Los tres conteos que las instrucciones me dieron para verificar dan los tres exactos**: 88
decisiones (11/77), 89 filas de matriz, 1.030 apariciones. **El conteo de hallazgos no.**

> **La corrección al encargo, y cambia dos filas de la serie.** El orquestador declara **86
> hallazgos** y **9 IDs `CRITICA`**. Los `CRITICA` son **9** y el desglose por vector es exacto. Los
> **86** también son exactos **si se cuenta `**Severidad.**`** — pero **14 de esas 86 entradas son
> hallazgos de vueltas anteriores reejecutados, con su ID viejo en el encabezado**, y la vuelta
> pasada ésos **no se contaban** (`F-8eC1` §2.5: *«83 — 76 nuevos de A/B/C2 + 7 míos; los viejos que
> siguen llegando van con su ID viejo»*). **Sobre la misma base que la serie, los hallazgos nuevos
> de los siete son 72**, más mis 4 nuevos = **76**. Las 16 reejecuciones van aparte y son un dato
> propio: **la práctica de reejecutar el hallazgo viejo entero creció de golpe** —la vuelta pasada
> ninguno de los siete lo hacía en el cuerpo del informe— y está concentrada en dos vectores.

**Ningún número de este informe viene de otro informe.** Donde uso uno ajeno lo digo, lo vuelvo a
contar, y si no da lo digo también. Hay tres casos donde no dio: §3.1, §3.2 y §3.4.

---

## 1. Los hallazgos

### ALTA

### F-8fC1-001 — El `desde` de la única transición que cierra una sucesión tiene TRES cardinales vivos en el corpus —seis, cinco y cuatro— y el conjunto del contrato de frontera no coincide con el normativo en DOS miembros: incluye `S13`, que ningún otro incluye, y saca `S24`, que la celda normativa acaba de agregar

**Qué se rompe.** `S18` es *«el único acto»* que cierra una sucesión, y de él cuelgan cinco
escrituras: `sucedida_por`, la limpieza de `sucede_a`, el re-apuntado de complementos y promo, **el
cierre de la cortesía con su `saldo_días`** (`DEC-GRANT-007`) y **la apertura de la marca
`REEMBOLSO_POR_CONFIRMAR` con la referencia al pago** (`DEC-RF-002`). Quién puede llegar a `S18` sin
`S17` —o sea *«por qué caminos se muere sola la predecesora»*— decide, sobre una persona concreta,
si le devolvemos un pago retenido y si le re-emitimos los días de cortesía que le quedaban. **Hoy
ese conjunto está afirmado con tres cardinales distintos y en dos versiones cuyos MIEMBROS no
coinciden**, y una de las dos es el contrato que las dos épicas comparten.

**El camino, y empiezo por lo que NO es el hallazgo, porque separar las dos cosas es el trabajo.**
Recorrí las quince apariciones de *«se muere sola / murió sola»* del corpus con `rg` el 2026-09-22 y
abrí las quince. **Ocho no son afirmaciones sobre el conjunto entero** y no las cuento: `B/02` §2.2
L83-91 está **acotada por escrito** a *«tres de las siete transiciones que `B/03` §3.2 recorre»*;
`B/12` §3 L91 es un **ordinal** que identifica al espejo (*«un tercer camino»*); `B/03` L208 dice que
`S22`/`S23` entran *«por el mismo camino»* que las tres viejas, que es verdadero; `B/03` L936 y
`B/05` L258 son enumeraciones sin cardinal dentro de un argumento sobre otra cosa; y `B/09` §3 L234
es **la cita de un argumento que el propio párrafo declara caído** (*«llevaba una excepción, y era el
agujero … La premisa se cayó»*). **`rastro-f21d5d828.md` §3 defiende explícitamente el acotamiento de
`B/02` §2.2 y `rastro-032f761e0.md` §3 defiende explícitamente los ordinales** —*«son ordinales que
identifican al espejo, no totales … Si alguna se hubiera escrito como «el último» o «de seis», sería
falsa»*—, y **las dos defensas se sostienen contra el texto de hoy: las verifiqué.**

**Lo que queda, que son las afirmaciones sobre el conjunto entero, y no cierran:**

| # | dónde | qué afirma | cardinal |
|---|---|---|---|
| 1 | **`B/03` §3.2, la celda `desde` de `S18`** (L133) — **la normativa** | *«`S12`, `S16`, el espejo …, o porque pidió la baja ella misma estando pausada (`S22`), suspendida (`S23`) o en el grace (`S24`)»* | **6** |
| 2 | `B/03` §3.2, el § *«Por qué `S18` también sale de `PENDING_AUTHORIZATION`»* (L233) | los mismos seis | **6** ✓ |
| 3 | **`B/03` §3.2, el bullet *«`S18` sin `S17` es lo CORRECTO»*** (L315) | *«los **CINCO** caminos … `S12`, `S16`, el espejo, `S22` y `S23`»*, y remata *«**en ninguno de los tres** deja viva una autorización»* | **5**, falta `S24` |
| 4 | **`B/14` §4.4** (L135) | *«el segundo camino del cierre, cuando la predecesora se murió sola: **son cinco**»* | **5**, falta `S24` |
| 5 | **`12-contrato…` §2.6** | *«de las **ocho** transiciones que la mueven durante la ventana, **cuatro** la sacan … `S12`, `S13`, `S16` y el espejo … **La octava, `S24`, también la saca y no entra en esa cuenta**»* | **4** + 1 excluida por argumento |

**Y el desacuerdo que importa no es el número, es la MEMBRESÍA.**

1. **`S13` aparece en el contrato y en ningún otro sitio vivo.** `S13` es *«le cae un grant»*, o sea
   la población de **`COBRO_POSTERIOR_AL_GRANT`**, uno de los cuatro motivos con `SÍ` en *«¿hay plata
   del cliente que devolver?»*. El contrato lo cuenta entre las cuatro; la celda normativa de `S18`
   no lo nombra. **Si `S13` mata a la predecesora y `S18` no sale por ahí, la marca de reembolso no se
   abre.** El único otro lugar del corpus que lo incluía es el argumento que `B/09` §3 declara caído.
2. **`S24` está en la celda normativa y el contrato lo saca con argumento.** *«Ahí el cliente pidió
   la baja él mismo … no es algo que le pase sin que nadie declare nada»* — que es un criterio
   **distinto** del que la celda usa (*«dejó de ser fila viva sin `S17`»*). **Las dos lecturas son
   defendibles y producen dos `desde` distintos para la misma transición**, y el contrato es el
   documento que las dos épicas comparten.
3. **Y dos sitios quedaron en cinco**, los dos escritos por commits de esta misma tanda y ninguno
   reabierto por el commit que creó `S24`.

**Dónde lo permite el diseño.** `B/03` §3.2 L133, L233 y L315; `B/14` §4.4 L135;
`12-contrato-de-cobertura.md` §2.6; `B/02` §2.5 (el motivo `REEMBOLSO_POR_CONFIRMAR`); `B/14` §4.4 y
§4.6 (la cortesía diferida); `B/20` §2 `G-R1-C`, que vigila *«`S17` sin `S18`»* y **no cuenta
caminos** — recorrí los 29 guards y ninguno cuenta este conjunto.

**Severidad.** `ALTA`. No la subo a `CRITICA` porque **la celda normativa existe, es la más ancha y
es donde el corpus declara que vive la norma**: un implementador que la lea construye el conjunto de
seis y no pierde ninguna plata. Lo que la deja en `ALTA` es que **el otro conjunto vive en el
contrato de frontera**, que es el documento que el programa declaró indivisible y compartido, y que
su versión **difiere en dos miembros, no en el conteo** — el que la lea va a construir un `desde` que
incluye `S13` y excluye `S24`, y las dos diferencias caen sobre motivos de la marca que devuelven
plata.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y las dos mitades se fechan.** La base de tres
(`S12`, `S16`, el espejo) es de la 9-bis-3. **La familia de la baja** (`032f761e0`) agregó `S22` y
`S23` y llevó los sitios 1, 2, 3 y 4 a cinco. **`DEC-SUB-014`** (`0f7b1e17d`) agregó `S24`, llevó los
sitios 1 y 2 a seis, **escribió el párrafo del contrato que lo saca con argumento** — y dejó los
sitios 3 y 4 en cinco. Lo verifiqué con `git show --name-only` sobre `0f7b1e17d`: tocó **once
archivos**, entre ellos `B/03` y el contrato, **y NO tocó `B/14`**.

**¿Lo habría encontrado el grep?** **Sí, y de una corrida.** El término retirado no es un
identificador sino una frase estable: `rg 'se muere sola|murió sola'` sobre las dos épicas, el núcleo
y el contrato devuelve **quince líneas en siete archivos**, y leer las quince juntas pone los tres
cardinales en la misma pantalla. El término nuevo también sirve y es más barato: `rg 'S24'` sobre los
mismos archivos devuelve los sitios 1, 2 y 5 —los tres que lo nombran— y por diferencia, los dos que
no.

**¿La resolución POR APARICIÓN lo habría atrapado? Los dos sitios falsos caen en desenlaces
distintos del §1.4, y eso es lo que hace útil al hallazgo.**

- **`B/14` §4.4 L135 — SEGUNDO desenlace, en su forma pura: la regla no se ejecutó sobre esa
  aparición.** `0f7b1e17d` **no abrió `B/14`** (verificado con `git show --name-only`), así que la
  aparición vive en un capítulo intacto: está **enteramente** dentro del alcance de la obligación 2.
  Y `rastro-8d6b27a12.md` —el rastro de esa familia— **tiene tres entradas sobre `B/14`** (L229-241,
  L258-264, L331-340) **y ninguna es L135**. Las tres que hay están bien resueltas; la que faltaba es
  la que ese commit acababa de volver falsa.
- **`B/03` §3.2 L315 — SEGUNDO desenlace también, y peor, porque el commit sí abrió el archivo.**
  `git show --unified=0 0f7b1e17d -- B/03` tiene un hunk `@@ -204,9 +209,15 @@` que reescribe el §
  del sitio 2 y lo lleva a seis; **el bullet del sitio 3 no está en ningún hunk**, o sea es una
  aparición no corregida en un párrafo que el commit no tocó, dentro de un archivo que sí tocó — el
  centro exacto del alcance. **El bloque `B/03` de `rastro-8d6b27a12.md` tiene nueve entradas
  (L437, L621-625, L709-712, L719-726, L1029-1037, L1039-1041, L1184-1191, L1193-1203, L1701-1714) y
  ninguna es el bullet.**

> **Contiene a `F-8fB1-005`** (*«`B/03` §3.2 da TRES enumeraciones distintas —seis, cuatro y cinco—
> en cien líneas»*), que mide el desacuerdo dentro de un solo §. Lo asiento en el §2.4: **son el
> mismo defecto; lo que agrego es que el mismo conjunto vive en `B/14` y en el contrato, y que el
> del contrato difiere en dos miembros.** Y corrijo hacia abajo una parte de `B1`: de sus tres
> enumeraciones, la de *«cuatro»* que cita es el sitio 2, que hoy tiene **seis**, no cuatro.

---

### F-8fC1-002 — El contrato lleva TRES censos del mismo objeto y su regla de vigilancia —el único mecanismo que existe para detectar que el corte se está filtrando— cuenta contra el más viejo de los tres, en las DOS direcciones y en el mismo bloque de tres líneas

**Qué se rompe.** `12-contrato…` §4.2 es la regla que el programa se dio para enterarse de que la
partición en dos épicas **dejó de valer**. Tiene dos mitades, una por dirección, y **las dos están
ancladas en un número que el propio documento contradice unos párrafos más arriba**:

- Hacia adelante: *«si aparece **un quinto lugar** que necesita algo de billing…»* — contra el §1.1,
  que declara **cuatro** lugares desde el día que el documento nació, mientras el §2.1 **ya enumera
  seis consumidores del mismo hecho** y **omite a los tres que esta tanda confirmó**.
- Hacia atrás: *«si billing necesita leer de verticales algo que no está en **los seis campos** del
  §4.1…»* — contra un §4.1 que dice, textual, ***«Son siete campos en tres preguntas»***.

**El camino.**

1. **La regla, entera.** `12-contrato…` §4.2: *«**Regla de vigilancia**: si aparece un **quinto**
   lugar que necesita algo de billing **y no es este hecho**, es señal de que el corte se está
   filtrando. Se mira, no se resuelve en el lugar. **Y en la otra dirección**: si billing necesita
   leer de verticales algo que no está en **los seis campos del §4.1**, vale lo mismo. Una lectura no
   declarada es un acoplamiento que nadie está mirando.»* Son **tres líneas** y los dos números
   están en ellas.
2. **El §4.1 dice siete y lo subraya.** *«**Son siete campos en tres preguntas**, y los dos últimos
   son los que importa declarar. `vigente`/`vendible` **no estaba en la cuenta original**»*. Los
   conté sobre el bloque: `políticaDePlan` 5 (`díasDeGrace`, `díasDeTrial`, `permitePausa`,
   `vigente`, `vendible`) + `situaciónDeVertical` 2 (`admiteAltas`, `finDeServicio`) = **7**. **La
   mitad inversa de la regla es literalmente falsa contra el § que cita, a nueve renglones de
   distancia**, y el § que dice siete explica que el sexto y el séptimo *«eran la diferencia entre
   que el acoplamiento se cortara o siguiera llegando»* — o sea: **los dos campos que la regla no
   cuenta son los dos que el §4.1 declara decisivos.**
3. **El §1.1 dice cuatro.** *«### 1.1 El mismo hecho, en **cuatro** lugares»*, con su tabla de cuatro
   filas: `V/17` §1.2 paso 5, `V/03` §9 `PB2`, `V/15` §6, y `V/02` §3.2 · `V/15` §4.2.
4. **El §2.1 ya lleva seis consumidores del mismo campo.** Fila `cubierto`, textual: *«`PB2`, `PB3`
   y `PB7` —**en su primera rama**…—; el §6 del capítulo 15; **el reconciliador**; y **el reloj de
   inactividad**, que se reinicia cuando **la respuesta** trae este campo en verdadero»*. Los conté:
   **seis**.
5. **Y el §2.1 omite a los tres relectores que esta tanda escribió.** `NUCLEO/01` §1.2 declara que
   *«**`PB4`, `PB5` y el hard delete del día 180 releen la cobertura** … y, si está cubierta,
   reinician el reloj»*, y el propio contrato lo repite en su §3: *«**las dos filas que actúan sobre
   ese reloj vuelven a preguntar en el momento de ejecutar** (`V/03` §9, `PB4` y `PB5`)»*. **`PB4`,
   `PB5` y el hard delete son lecturas de `cubierto` por diseño y ninguno figura en la fila del §2.1
   que existe para enumerar quién lo consume.** O sea que el censo que el documento declara como el
   de los consumidores **está corto en dos bajo la lectura conservadora y en tres bajo la del
   núcleo**, y el que está corto es el que la tanda dejó de abrir mientras escribía tres relectores
   nuevos.
6. **Y el §4.2 es el único lugar del programa que vigila esto.** Recorrí los 29 guards de `V/20` §2
   y `B/20` §2: **ninguno tiene por sujeto el contrato de frontera**. La regla de vigilancia es una
   regla de prosa, sin guard, contra dos números que el mismo documento contradice.

**Dónde lo permite el diseño.** `12-contrato-de-cobertura.md` §1.1 (el encabezado y su tabla de
cuatro), §2.1 (la fila `cubierto`), §3 (*«las dos filas»*), §4.1 (*«Son siete campos»*) y §4.2 (la
regla); `NUCLEO/01` §1.2 (los tres relectores); `V/20` §2 y `B/20` §2 (los 29 guards, ninguno sobre
el contrato).

**Severidad.** `ALTA`. Nadie paga de más **por esto**: lo que se rompe es el detector, no el sistema.
Pero es el detector de **la decisión de arquitectura más cara del programa** (`DEC-ARCH-005`, el
corte en dos épicas) y **esta misma pasada trae la prueba de que falla**: el `CRITICA` de `C2`
(`F-8fC2-001`) es una pieza de la dirección inversa que **ninguna de las 22 unidades construye**, y
la mitad inversa de esta regla —la que debía disparar— está escrita contra seis campos cuando son
siete. **Y hay que decir lo que la regla NO promete, para no acusarla de más**: su mitad hacia
adelante dice *«un quinto lugar … **y no es este hecho**»*, así que un lector estricto no se
equivoca de alarma por el cuatro del §1.1; lo que sí no puede es **saber cuántos lugares hay hoy**,
porque el documento le da dos censos del mismo hecho con cuatro y con seis. La mitad inversa no
tiene esa salvedad: seis contra siete es falso sin matices.

**¿Es nuevo, o es el arreglo?** **Las dos mitades son anteriores a esta tanda y las dos empeoraron
en ella.** La brecha 4↔6 es `F-8eC1-003` de la 8-bis-4, **tercera vuelta**; lo que esta tanda agrega
es que **el §2.1 quedó corto además contra tres relectores que ella misma escribió** (familia de la
retención, `5ac5e92c9` y `afa4590c2`), sin que ningún commit abriera el contrato para eso. La brecha
6↔7 nació con `4f34afa1a` (2026-09-19), que escribió el §4.1 y el §4.2 **en el mismo commit**: el
número se contradijo el día que se escribió.

**¿Lo habría encontrado el grep?** **La mitad inversa, sí y trivialmente**: los dos números están a
nueve renglones, en el mismo archivo, y `rg 'seis campos|siete campos' 12-contrato-de-cobertura.md`
devuelve **dos líneas**. La mitad hacia adelante, **no por término**: *«cuatro lugares»* y la fila
`cubierto` del §2.1 no comparten ninguna palabra; hay que contar dos tablas.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y el rastro lo dice por omisión.** El
contrato es el documento **más cubierto** de los diez rastros: `C2` contó **23 líneas de rastro**
sobre él, repartidas en seis rastros, y las verificó todas —*«las 23 se sostienen»*—. Lo crucé con
las mías: **ninguna de las 23 es el §1.1, ninguna es el §4.1, ninguna es el §4.2 y ninguna es la
fila `cubierto` del §2.1.** Veintitrés apariciones recorridas sobre el documento y **cero sobre sus
cuatro conteos**, porque un conteo no es una aparición de un término que la tanda haya movido. Es el
tercer desenlace del §1.4 en su forma estructural: **la obligación no puede verlo por construcción**,
y lo mismo dicen `C2` (*«una afirmación cuantificada y una fila ausente son las dos clases que la
enmienda no puede ver»*) y `B3` (*«un § que la tanda no movió es invisible aunque su premisa se haya
caído afuera»*).

---

### MEDIA

### F-8fC1-003 — El SEXTO sitio de «`G-R4` sigue contando tres» vive en `01-decision-log.md`, que es exactamente el documento que el alcance de la obligación excluye por definición: ni `A2` ni `B2` lo contaron, y es la primera instancia medible del costo de esa exclusión

**Qué se rompe.** `DEC-SUB-013` cierra con cuatro *«cosas de mecánica, resueltas»* y la primera
termina: ***«`G-R4` sigue contando tres pares.»*** Ese renglón es la razón escrita de por qué `MP4`
es fila propia y no `MP1` ampliado. Hoy los pares son **cuatro** (`NUCLEO/03` §1 regla 7, tabla de
cuatro filas, contadas por mí). **La razón de una decisión tomada quedó falsa y no hay ningún
mecanismo del programa que la mire**: no la ve el grep de la tanda —que se corrió *«sobre los
capítulos»*—, no la ve el rastro —cuyo alcance es *«el corpus, excluidos log, matriz, sondas y los
propios rastros»*—, y no la ve ningún guard —`G-R4` cuenta tablas de transiciones, y el log no tiene
ninguna—.

**El camino.**

1. **La aparición, textual.** `01-decision-log.md` L3222, dentro de `DEC-SUB-013`: *«1. **Fila propia
   `MP4`**, no `MP1` ampliado: los efectos difieren de verdad (`S5` desde grace, `S7` desde
   suspendida). **`G-R4` sigue contando tres pares.**»*
2. **El valor verdadero.** `NUCLEO/03` §1 regla 7: *«Los pares con dos filas y dos destinos distintos
   que el diseño declara hoy son **cuatro**, en dos tablas»*, con la tabla —`T1`/`T6`, `S5`/`S19`,
   `S7`/`S19`, `S10`/`S25`— y el remate *«**Que sean cuatro y no cinco no es una afirmación de este
   capítulo: es lo que `G-R4` cuenta en cada PR**»*.
3. **El censo completo, medido por mí con `rg 'G-R4'` sobre el corpus entero el 2026-09-22.** **Seis
   sitios dicen tres**: `B/03` L884 (§3.2, `S21`), `B/03` L1265 (§7.1, `MP4`), `B/03` L1581 (§7.2, la
   tabla de premisas, que va a buscar la frase y la declara *«sigue verdadera»*), `B/03` L1642-1643
   (§8, `A5`, *«la tabla de la regla 7 del núcleo sigue teniendo **tres** entradas»*), `V/03` L172
   (§2, `T7`) **y `01-decision-log.md` L3222**. **Tres dicen cuatro**: `NUCLEO/03` §1 regla 7,
   `B/03` L570 y `B/03` L1543.
4. **Ni `A2` ni `B2` lo cuentan, y los dos hicieron el censo.** `F-8fA2-007` enumera *«los cinco que
   dicen tres»* con línea —los cuatro de `B/03` más `V/03` L172— y `F-8fB2-006` los mismos cinco
   (cuatro en `B/03`, *«una quinta en `V/03`»*). **Los dos censos coinciden exactamente y los dos
   paran en el borde del log.** No es un descuido de ninguno de los dos: es que el log **no está en
   el corpus** por decisión del programa (instrucciones §1.3, y el propio §6 lo pone entre lo que no
   se toca).
5. **Y la exclusión no es gratuita, porque el log es el único lugar donde vive la RAZÓN.** Los otros
   cinco sitios son prosa descriptiva: dicen cuántos pares hay. El del log dice **por qué `MP4` es
   una fila y no una ampliación de `MP1`**. Un lector que en seis meses quiera saber si esa elección
   sigue valiendo va a leer *«los efectos difieren de verdad … `G-R4` sigue contando tres pares»* y
   va a encontrar una premisa falsa sosteniendo una conclusión que —lo verifiqué— sigue siendo
   correcta: `MP4` **sí** debe ser fila propia, y no por el número de pares.

**Dónde lo permite el diseño.** `01-decision-log.md` L3222 (`DEC-SUB-013`); `NUCLEO/03` §1 regla 7;
`B/03` L884, L1265, L1543, L1581, L1642-1643; `V/03` L172; `DEC-METH-011` y el §1.3 de las
instrucciones (la definición de *«corpus»*).

**Severidad.** `MEDIA`. Nadie paga de más y ninguna ejecución cambia: `G-R4` cuenta tablas y va a
seguir dando cuatro. Lo que se rompe es que **la razón de una decisión tomada caducó sin que nada la
pueda señalar**, que es la clase de falla que `NUCLEO/04` describe como *«una razón caduca bajo una
conclusión correcta»* y que ningún guard ve. No la subo porque la conclusión sobrevive; no la bajo
porque **es la primera vez que se puede exhibir el precio de la exclusión del log con una instancia
y una línea**, en vez de argumentarlo.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la tanda de las ocho decisiones** (`8d6b27a12`,
`DEC-SUB-015`), que creó `S25` y con él el cuarto par. La línea del log la escribió `DEC-SUB-013` en
la tanda anterior y era verdadera ese día.

**¿Lo habría encontrado el grep?** **Sí, si el alcance lo hubiera incluido.** `rg 'contando tres'`
sobre `.specs/` entero devuelve **cuatro** líneas y una es la del log. El barrido que
`rastro-8d6b27a12.md` §2 declara haber corrido lista el término retirado —*«tres pares»*— y su
alcance es el corpus, que por definición **no** incluye el log. **El término alcanza; el alcance no.**

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y es el único de los desenlaces que el
§1.4 no contempla: la aparición existe, es falsa, y está FUERA del universo de la obligación.** No
es *«está en el rastro y su justificación es falsa»* (nunca pudo estar), no es *«no está y debería
estar»* (no debía: el log no es corpus), y no es *«nace en prosa que el commit escribió»* (la
escribió otra tanda). **Es un cuarto desenlace**, y lo dejo nombrado en el §4.4 porque decide si la
próxima enmienda tiene que ampliar el alcance o no.

---

### F-8fC1-004 — Censo de los conteos congelados del programa: 25 medidos, 14 falsos hoy, y los catorce se reparten en DOS clases; ninguno de los 29 guards cuenta un conteo de prosa, y la clase mayoritaria es la misma que la vuelta pasada

**Qué se rompe.** La vuelta anterior propuse (`F-8eC1` §4.5, Corrección D) que *«los conteos del
programa tienen una lista, y se recorre entera cuando uno se mueve»*, y dije que era la única
corrección que el programa **ya sabía ejecutar** y a la que sólo le faltaba el índice. **Nadie la
pudo evaluar porque el índice no existe y nadie había contado cuántos conteos hay.** Lo conté. El
resultado dice que la corrección es más barata de lo que parecía y compra menos de lo que yo
esperaba, y las dos mitades importan.

**El camino: el censo, medido por mí el 2026-09-22.** Tomé todo conteo del corpus que cuantifica
sobre un conjunto enumerable de otro documento —que es la definición de *«conteo congelado»* de mi
vector— y verifiqué cada uno contra el conjunto.

| # | objeto contado | quién lo declara | valor declarado | valor real | ¿falso? |
|---|---|---|---|---|---|
| 1 | decisiones del log | resumen del log | 88 | **88** | — |
| 2 | ídem | `NUCLEO/00` L42 | *«54 al 2026-09-19»* | 88 | **sí** (`F-8eC1-004`) |
| 3 | invariantes | `NUCLEO/04` §5 | *«Cincuenta y tres»* | **53** | — |
| 4 | ídem | `NUCLEO/00` L87 y L96 | 51 (×2) | 53 | **sí** (`F-8fC2-008`) |
| 5 | ídem | `V/spec.md` L71 | 51 | 53 | **sí** (ídem) |
| 6 | ídem | `03-handoff.md` L183 y L256 | 52 | 53 | **sí** (ídem) |
| 7 | guards distintos | log L3770 | 29 | **29** (17+16−4) | — |
| 8 | filas de guard de `V/20` §2 | `rastro-31ce26bb2` §3 | 17 | **17** | — |
| 9 | filas de guard de `B/20` §2 | ídem | 16 | **16** | — |
| 10 | pares con dos destinos | `NUCLEO/03` §1 regla 7 | 4 | **4** | — |
| 11 | ídem | seis sitios (§3 de arriba) | 3 | 4 | **sí** (`F-8fC1-003`) |
| 12 | acciones administrativas | `NUCLEO/08` §3 | *«DOCE filas»* | **12** | — |
| 13 | las cinco líneas que cuantifican sobre ellas | `V/17` §3.2 ×2, §3.3, §3.4, `B/19` §6 | doce | 12 | — |
| 14 | motivos de la marca | `B/02` §2.5 | trece | **13** | — |
| 15 | ídem | `B/05` §3 | *«los otros diez»* | 12 | **sí** (`F-8fB3-009`) |
| 16 | puertas a estado terminal | `B/03` §7.1 y §7.2 | doce | **13** | **sí** (`F-8fB1-006`, `F-8fB2-007`) |
| 17 | ídem | `B/09` §3 y `B/16` §4.4 | trece | 13 | — |
| 18 | filas de la matriz | instrucciones §6 | 89 | **89** | — |
| 19 | preguntas del owner abiertas | resumen del log | *«0 de 25»* | 33 abiertas en 11 documentos | **sí** (`F-8fC2-007`) |
| 20 | salidas terminales de `PAUSED` | `B/03` §5 | *«las dos terminales»* | 4 | **sí** (`F-8fA2-006`, `F-8fB2-003`) |
| 21 | filas de invalidación del caché | `V/02` §3.2 | 10 filas · la frase dice 11 · el 2º consumidor dice 7 | 10 | **sí** (`F-8fA3-013`) |
| 22 | campos de la dirección inversa | `12-contrato…` §4.1 vs §4.2 | 7 vs 6 | **7** | **sí** (`F-8fC1-002`) |
| 23 | lugares que necesitan el hecho | `12-contrato…` §1.1 vs §2.1 | 4 vs 6 | ≥6 | **sí** (ídem) |
| 24 | consumidores de `inactiva_desde` | `V/02` §2.5 | *«cinco»*, y enumera seis | 6 | **sí** (`F-8fA3-003`) |
| 25 | apartamientos del PDR | resumen del log L4015 | 7 | **8** | **sí** (`F-8eC1-007`, abajo) |

**Resultado: 25 conteos medidos, 14 falsos, 11 exactos.** Y **las once que sobreviven no sobreviven
por azar**: nueve de las once viven **en el documento que es dueño del conjunto que cuentan** (el log
cuenta sus propias decisiones, `NUCLEO/04` cuenta sus propias filas, `NUCLEO/08` cuenta su propia
tabla, la matriz cuenta sus propias filas). **Las catorce falsas se reparten en exactamente dos
clases y la proporción es la observación:**

| clase | cuántas | cuáles |
|---|---|---|
| **el conteo vive en un documento que NO es el dueño del conjunto** | **12 de 14** | 2, 4, 5, 6, 11, 15, 16, 19, 20, 22, 23, 25 |
| **vive en el dueño, pero en una frase y no en la tabla** | **2 de 14** | 21 (la frase de cierre contra sus propias diez filas) y 24 (*«cinco»* sobre su propia lista de seis) |

**Y la excepción que prueba la regla, medida.** `NUCLEO/04` §5 es el **único** conteo del corpus con
una disciplina escrita —*«Los conteos se recorren enteros con un script, o no se tocan»*— y bloques
de recorrido fechados por tanda. **Su número es exacto** (37+16=53, verificado fila por fila) **y las
tres copias que viven afuera están las tres mal** (filas 4, 5 y 6). Es decir: la disciplina funciona
**exactamente hasta el borde del archivo que la tiene escrita**.

**Dónde lo permite el diseño.** Las 25 citas de la tabla. Y el hueco: recorrí los 29 guards de
`V/20` §2 y `B/20` §2 uno por uno — **ninguno tiene por predicado un conteo de prosa**. `G-R4` cuenta
pares sobre tablas de transiciones y `G-R6`/`G-R6-B` cuentan miembros de una lista cerrada contra su
uso; ninguno compara *«el número que un documento afirma»* contra *«el conjunto que otro documento
enumera»*, que es la forma de las catorce.

**Severidad.** `MEDIA`. Ninguno de los catorce mueve plata por sí solo —el más caro, el 20, tiene su
daño reportado por `A2` y `B2` con su propio ID—. Lo reporto como uno porque **el número es el
resultado**: catorce de veinticinco es el 56 %, y es la primera vez que el programa tiene la
proporción en vez de instancias. Y porque la clase mayoritaria —**12 de 14 viven fuera del dueño**—
dice exactamente qué tiene que hacer la Corrección D y qué no: **no hace falta una disciplina de
conteo, que `NUCLEO/04` ya tiene y ejecuta; hace falta que el dueño de cada conjunto sepa quién lo
cita**, que es una lista de doce filas y no de veinticinco.

**¿Es nuevo, o es el arreglo?** **Es nuevo como medición** y cada una de las catorce tiene su propia
atribución, que está en el informe que la reporta. Lo que **esta tanda** agrega: de las catorce,
**seis las volvió falsas la 9-bis-4** (11, 16, 19, 20, 22 en su mitad nueva, 24) y **ocho son
anteriores** (2, 4, 5, 6, 15, 21, 23, 25). **Y la proporción no mejoró respecto de la vuelta
anterior**: la 8-bis-4 reportó seis hallazgos de esta clase sobre un censo que nadie hizo.

**¿Lo habría encontrado el grep?** **No, y ésa es la mitad útil del hallazgo.** Un conteo congelado
no tiene término: *«cincuenta y tres»*, *«los 51»*, *«doce filas»* y *«las dos terminales»* no
comparten ninguna cadena. Lo verifiqué: no existe una expresión regular que devuelva las
veinticinco. Las encontré recorriendo **los conjuntos**, no los textos — que es el eje que mi §4.5 de
la vuelta anterior declaró no cubierto por ninguna búsqueda.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y es la clase que `C2` y `B3` nombran por
separado como el límite estructural.** Un conteo es *«una afirmación cuantificada sobre un conjunto
cuyos miembros no nombra»* (`F-8fC2-001`, con esas palabras): la obligación recorre **apariciones de
términos**, y un número no es un término. Lo verifiqué sobre el caso más expuesto: los diez rastros
dedican **23 líneas** al contrato de cobertura y **ninguna** es uno de sus cuatro conteos (§3.2 de
este informe).

---

### BAJA

### F-8eC1-007 (sigue llegando, tercera vuelta) — El resumen del decision log sigue declarando «7 apartamientos del PDR» y el octavo sigue escrito en el TÍTULO de su propia decisión

**Dónde llega hoy.** `01-decision-log.md` L4015: *«| Apartamientos declarados del PDR | **7** —
`DEC-ENT-001` (§10.3), `DEC-GRANT-002` (§34) y `DEC-ARCH-003` (§10.6…), `DEC-OBS-001` (§22.1…),
`DEC-METH-004` (§65…), `DEC-SUB-011` (§11 y §64.8…) y `DEC-METH-006` (§65…) |»*. Y L2818, el
encabezado de una decisión: *«### `DEC-GRANT-006` — La cortesía es POR SUSCRIPCIÓN: se retira su
`scope`, **y el §34 del PDR queda desviado a propósito**»*. Recorrí las ocho ocurrencias de
*«apartamiento»* del archivo y las siete nombradas cierran; **`DEC-GRANT-006` no está en la lista y
declara su desvío en su propio título**.

**Severidad.** `BAJA`, sin cambios. No gobierna ninguna decisión. Lo reporto por tercera vuelta
porque es la instancia **más barata de todo el corpus** —una celda, con el dato escrito en un
encabezado del mismo archivo— y porque es la fila 25 del censo del `F-8fC1-004`: **el único conteo
falso que vive en el documento dueño del conjunto y no tiene ninguna dificultad técnica**. Si la
Corrección D no cierra ésta, no cierra ninguna.

**¿Es nuevo, o es el arreglo?** **Ni uno ni otro: la tanda no lo tocó.** `git log --oneline` sobre el
log en el rango de los 76 commits devuelve los commits de las doce decisiones nuevas; **ninguno abre
el bloque `## Resumen`** salvo para mover el total de 76 a 88, que sí se movió. **Se abrió el bloque,
se corrigió una fila y no la de al lado.**

**¿Lo habría encontrado el grep?** **Sí.** `rg -i 'apartamiento' 01-decision-log.md` devuelve nueve
líneas y la lista de siete está entre ellas; cruzarla con `rg '^### DEC-.*PDR'` (cuatro líneas)
devuelve `DEC-GRANT-006` en la primera pantalla.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No: está fuera del alcance, como el
`F-8fC1-003`.** Es la segunda instancia del cuarto desenlace, y las dos están en el mismo archivo.

---

### F-8eC1-004 (sigue llegando, y la brecha creció de 22 a 34) — `NUCLEO/00` sigue cuantificando las fuentes admitidas del programa en «54 decisiones al 2026-09-19»

**Dónde llega hoy.** `NUCLEO/00-indice.md` L42: *«2. **una decisión registrada** en
`01-decision-log.md` — son **54** al 2026-09-19, recontadas con…»*. El log tiene **88** (contadas por
mí: 89 encabezados `### DEC-` menos la plantilla de L26, y coincide con su propio resumen). **La
brecha era de 22 en la 8-bis-4 y hoy es de 34**: la tanda agregó doce decisiones y ninguna abrió el
índice del núcleo.

**Por qué importa y no es sólo un número.** La frase está dentro de la enumeración de **qué cuenta
como fuente admitida** para el núcleo — o sea, el criterio de admisión del documento que las dos
épicas comparten. Quien quiera verificar que una regla del núcleo tiene fuente va a contrastar
contra 54.

**Severidad.** `MEDIA` → la dejo en **`MEDIA`**, igual que la vuelta pasada. Es la fila 2 del censo
del `F-8fC1-004` y la de mayor brecha absoluta de las veinticinco.

**¿Es nuevo, o es el arreglo?** Es anterior; **lo que la tanda agrega es la brecha**: doce decisiones
más, cero aperturas del índice. Los seis commits que tocan `nucleo/` en la tanda —lo verifiqué con
`git log --name-only`— tocan `01`, `03`, `04`, `07` y `08`, **nunca el `00`**.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No: `nucleo/00-indice.md` tiene tres líneas de
rastro en total** (`12cc0879f` y `31ce26bb2`, contadas por `C2` y verificadas por mí) **y ninguna es
un conteo**. Segundo desenlace del §1.4 si se cuenta el archivo como corpus tocado; tercero si se
cuenta que un número no es una aparición. **Es el caso donde los dos desenlaces se superponen**, y lo
uso en el §4.4 para mostrar por qué la clasificación en tres no cierra.

---

## 2. La deduplicación de los críticos — el encargo

> **Los siete informes existían cuando conté, `C2` entre ellos**, que es la razón por la que `C1`
> corre último desde la 8-bis-3.

**Los 9 IDs `CRITICA` de los siete informes son 8 defectos críticos distintos.** Ninguno de mis seis
hallazgos es `CRITICA`, así que el conteo de la pasada es **9 IDs sobre 8 defectos**.

### 2.1 El criterio de colapso, declarado ANTES de aplicarlo

Es el mismo de la vuelta anterior, palabra por palabra, porque quiero que las dos vueltas sean
comparables:

> **Dos IDs son el mismo defecto si el daño es el mismo evento sobre la misma persona Y una sola
> corrección lo elimina.** Un mismo daño con dos correcciones distintas son dos defectos; **una misma
> corrección para dos daños distintos también**. **Si la población de uno está contenida en la del
> otro y la corrección del más ancho cierra al más angosto, colapsan** — y en ese caso digo qué
> residuo queda afuera del colapso, porque un residuo escondido es la forma de deduplicar de menos.

**Y agrego una cláusula que esta vuelta necesitó y la anterior no**, declarada también antes de
aplicarla: **dos defectos que comparten la MISMA RAÍZ no colapsan si sus correcciones son
independientes.** Lo escribo porque esta vuelta tiene un caso donde una sola ambigüedad se bifurca en
un `CRITICA` por una rama y en el `ALTA` más reportado de la pasada por la otra (§2.3, punto 3), y
colapsarlos por la raíz sería deduplicar de más: cerrar la raíz **no cierra ninguna de las dos
ramas**.

### 2.2 El mapa: qué ID colapsa en cuál

| # | defecto crítico distinto | IDs `CRITICA` | otros IDs del mismo defecto | de dónde salió |
|---|---|---|---|---|
| **1** | **`G-R3` sólo sabe prohibir**: nada exige que la versión de piso OTORGUE sus tres cosas, así que la defensa entera del hard delete del día 180 cuelga de una fila de catálogo cuya ausencia no ve ningún guard | `F-8fA1-001` | `F-8fA1-002` (`ALTA`, el medio predicado que no se puede formar) | la retención + `DEC-TEST-001` |
| **2** | **El hard delete relee la cobertura en UNA línea de seis**: con el aviso perdido —el modo de falla que el diseño declara— se borra el contenido de un cliente que ya volvió | `F-8fA2-001` | — | la retención (`5ac5e92c9`) |
| **3** | **El hecho 2 está enunciado como CAMBIO y ejecutado como ESTADO**: el guard se pone en rojo sobre el arreglo, no sobre el defecto | `F-8fA3-001` | `F-8fA3-004` (`ALTA`, el cuarto hecho sin ejecutor) | la retención + 3ª enmienda de `DEC-TEST-001` |
| **4** | **El tope de `MP4` deja la fecha en el instante de la reactivación y `MP5` dispara en el acto**: el que vuelve paga el período que pasó suspendido **y** el que arranca, y `S4` lo devuelve al grace el mismo día | `F-8fB1-001` | `F-8fB1-004` (`ALTA`, el grace como beneficio de entrada, que cuelga del mismo §7.2) | el pagador manual (`11aac0088`, `89a38386c`) |
| **5** | **`PAGO_TARDÍO_RECHAZADO` entra al catálogo con «¿hay plata que devolver? no» y sus cuatro condiciones sólo fallan cuando la plata ya entró**; y el mismo hecho tiene dos motivos declarados en el mismo capítulo | `F-8fB1-002` | — | la sucesión (`f21d5d828`) |
| **6** | **Una marca por `(fila, motivo)` y UNA FK al pago**: del segundo cobro en adelante la plata queda sin fila que la nombre, y la persona que hace bien su trabajo cierra el caso con el resto adentro | `F-8fB2-001`, **`F-8fB3-002`** | `F-8eB1-004` (`ALTA`, sigue llegando: el reembolso de `S21` sin motivo en la tabla cerrada) | la sucesión (`3310c9376`) + `DEC-RF-003` |
| **7** | **`charged_quantity` cuenta INTENTOS**: `B/09` §4 concluye *«sí cobró»* sobre una suscripción que no cobró un peso, y es la regla que resuelve la cuarta de las cinco comparaciones del barrido | `F-8fB3-001` | — | **`RC-5`, medido en producción el 2026-09-22.** NO lo introdujo ninguna tanda |
| **8** | **La dirección inversa del contrato no la construye ninguna de las 22 unidades**: la regla que decide *«qué se le cobra a alguien y qué día»* vive en la última unidad y el cambio de plan lo construye la octava | `F-8fC2-001` | `F-8fC2-003` (`ALTA`, los 29 guards sin criterio de terminación), `F-8fC1-002` (mío, la mitad inversa de la regla de vigilancia) | **2026-09-18 / 09-19.** Anterior a la tanda |

### 2.3 Las tres convergencias del encargo, dirimidas contra el TEXTO

Las tres las verifiqué abriendo los capítulos, nunca los informes que los citan.

**1 · `reconciliation_mark` y el segundo pago: `F-8fB2-001` + `F-8fB3-002` son UNO; `F-8fB1-002` NO
colapsa.**

Los dos primeros son **el mismo defecto y lo verifiqué cita por cita**. Los dos citan la misma celda
de `B/02` §2.2 —*«**`UNIQUE(subscription_id, motivo) WHERE levantada_en IS NULL`**»* y *«**el pago que
hay que devolver** … **FK anulable**»*—, los dos llegan por la misma puerta (`S13` sin rama de fallo,
`B/09` §3 tabla de las trece puertas, más la salvedad 4 *«el primer aviso es el cobro»*), y los dos
terminan en el mismo acto: `S15` *«levanta **UNA** marca … no la fila»* (`B/03` §3.2). **Una sola
corrección los elimina**: que la marca admita N pagos —una tabla de detalle, o una marca por hecho en
vez de por `(fila, motivo)`—.

**El residuo que el colapso NO absorbe, declarado**: `B3` desarrolla una consecuencia que `B2` no
tiene — *«la cifra del §2.5 se vuelve falsa por el otro lado»*, porque el listado ordena adelante los
cuatro motivos **mostrando una cifra que es una fracción de la deuda**. Verifiqué la cita (`B/02`
§2.5, fila 1, *«el monto está determinado»*) y es correcta. **La corrección de la cardinalidad cierra
ese residuo también** —con N pagos el monto vuelve a estar determinado—, así que no es un noveno
defecto; lo anoto porque es el argumento por el cual la corrección tiene que llegar hasta el listado
y no quedarse en el modelo.

**`F-8fB1-002` es un defecto distinto, y lo verifiqué contra `B/02` §2.5 y `B/05` §3.** Su mecanismo
no es la cardinalidad sino **la clasificación**: el motivo 7 lleva `no` en *«¿hay plata del cliente
que devolver?»* mientras sus cuatro condiciones sólo fallan cuando la plata entró (las recorrí una
por una en `B/05` §3 y es exacto: las cuatro presuponen un pago). Su corrección es otra —reclasificar
la fila 7 y dirimir cuál de los dos §§ del mismo capítulo gana sobre el mismo hecho— y **ninguna de
las dos correcciones cierra la otra**: con la marca admitiendo N pagos, el motivo 7 sigue diciendo
que no hay nada que devolver; con el motivo 7 reclasificado, el segundo cobro sigue sin poder
escribirse.

**2 · La relectura de `PB4` y la ficha del excedente: `F-8fA2-002` y `F-8fA3-002` son UNO.**

Ninguno es `CRITICA`, así que no mueve el conteo, pero el encargo pide el veredicto. Los dos parten
del mismo mecanismo —la relectura de `PB4` es **incondicional sobre el `user + vertical` y no sobre
la ficha**, `V/03` §9: *«si el `user + vertical` está cubierto, **no archivan** y reinician el
reloj»*— y llegan a la misma población —el excedente tras un downgrade, que está cubierto por
definición—. `A2` lo cuenta por las salidas (*«no archiva, `PB3` no dispara, `PB1` sale de `DRAFT`,
`PB8` de `ARCHIVED`»*) y `A3` por la rama nueva (*«la segunda rama de `PB7` nace con población
vacía»*). **Una sola corrección los elimina**: que la relectura pregunte por la ficha —o que `PB3`
gane una rama que el dueño pueda ejecutar—. **Colapsan.**

**El residuo**: `A3` agrega que **dos líneas de `rastro-5836ec219.md` declaran esto arreglado y son
falsas** (L180-182 y L247-249). Eso no es un segundo defecto de diseño: es un hallazgo de método, y
lo cuento en el §4.3 y no acá.

**3 · `fin_real` y las salidas de `PAUSED`: son DOS defectos, no uno y no tres.**

Acá el criterio decide y conviene mostrarlo funcionando.

- **`F-8fA2-006` y `F-8fB2-003` son el mismo defecto.** Los dos dicen que **`S13` y `S17`** sacan una
  fila de `PAUSED` sin escribir `fin_real`; los dos citan el mismo encabezado de `B/03` §5
  (*«**Las dos terminales mandan la fila a `CANCELLED` y cierran la pausa**»*) y la misma
  confirmación invertida de `B/09` §3 (*«**`S22` y `S25` además escriben el `fin_real`**»*, donde el
  *«además»* es la prueba de que las otras no). Mismo daño —los meses no usados se cuentan como
  consumidos por `DEC-SUB-004`, que sobrevive a la muerte de la fila—, misma corrección.
- **`F-8fA2-003` es OTRO.** Su sujeto es **`S10`**, la salida **normal**, y su daño es **doble y
  distinto**: además de los meses, **la restricción de base** *«a lo sumo una sin `fin_real` por
  suscripción»* (`B/02` §2.2, verificada) hace que **el segundo `S8` lo rechace la base**, sobre un
  cliente al que el catálogo le vende tres pausas. Ése es *«queda sin poder hacer lo que sí le
  corresponde»*, no *«paga de más»*, y **no le pasa a la población de `S13`/`S17`** — `A2` mismo lo
  explica: sobre una fila que se muere, la restricción no choca contra nada.

**Una sola corrección los cerraría a los dos** —*«toda transición que saca una fila de `PAUSED`
escribe `fin_real`»*—, **y por eso son dos y no uno**: mi criterio dice, textual, que *«una misma
corrección para dos daños distintos»* son dos defectos. El colapso por corrección compartida es
justamente la forma de deduplicar de más.

**4 · `G-R4`, tres contra cuatro: `F-8fA2-007` y `F-8fB2-006` son UNO, y los dos cuentan de menos.**
Ver §3.1, porque además es una contradicción de conteo entre los dos informes.

### 2.4 Cinco racimos que parecen uno y NO colapsan, con la razón medida

1. **Los tres de la familia de la retención —#1, #2, #3— son tres.** Los tres terminan en la misma
   frase de `V/02` §4.1 (*«se borra al día 180 … el contenido publicable»*), los tres salen de la
   misma familia y **las tres correcciones son disjuntas**, verificado caso por caso: con `G-R3`
   ampliado a exigir que el piso otorgue (#1), el hard delete sigue sin saber si relee (#2) y el
   predicado del hecho 2 sigue teniendo dos lecturas (#3); con el número de relectores escrito
   igual en los seis sitios (#2), el guard `G-R6-B` sigue poniéndose en rojo sobre la relectura bajo
   el predicado del núcleo (#3); con el predicado decidido (#3), la fila del piso puede seguir sin
   sembrarse y nadie se entera (#1).
   **Lo que sí comparten, y cambia el costo**: el desenlace de los tres es el mismo acto irreversible
   y **ninguno de los tres lo detecta nadie**. Un solo detector —*«fichas cuyo reloj cruzó el día 150
   cuyo dueño tiene hoy una fuente `TÍTULO` viva»*— **atrapa el desenlace de los tres antes del
   borrado** sin cerrar ninguno. Tres defectos, tres escrituras, un detector. Es la misma forma que
   la vuelta pasada, con cinco en vez de tres.
2. **#2 y #3 comparten la RAÍZ y no colapsan, y es el caso que motivó la cláusula nueva del §2.1.**
   La raíz es una: **el hecho 2 tiene un predicado ambiguo**. Por la rama del predicado-cambio, la
   relectura de `PB4`/`PB5` **no es uno de los cuatro hechos** y el guard la rechaza como escritora
   ilegal → #3. Por la rama del predicado-estado, `PB4`/`PB5` reinician sobre **cualquier** ficha de
   cualquier persona cubierta → que es exactamente la población del excedente, o sea el `ALTA` más
   reportado de la pasada (§2.3 punto 2). Y #2 vive **encima** de las dos, porque la pregunta
   *«¿cuántos actores ejecutan el hecho 2?»* es independiente de *«¿con qué predicado?»*. **Cerrar la
   raíz —decidir el predicado— no cierra ninguna de las dos ramas**: sigue habiendo un actor de más
   o de menos, y sigue habiendo una ficha sin salida. Colapsarlos habría bajado el conteo a 6 y
   habría escondido dos escrituras.
3. **#4 y #5 son dos aunque los dos sean de la puerta del pago tardío.** #4 es aritmética de
   períodos sobre el pagador manual (`B/03` §7.1 y §7.2); #5 es la clasificación de un motivo sobre
   cualquier pago que llega tarde (`B/02` §2.5 y `B/05` §3 contra §2). Lo verifiqué: `B/05` §3 —las
   cuatro condiciones— **no menciona la fecha del próximo cobro ni el tope**, y `B/03` §7.2 —el
   tope— **no menciona el motivo**. Arreglar el tope deja la fila 7 clasificada igual.
4. **#6 y #5 no se fusionan aunque los dos toquen la misma tabla de trece motivos.** #6 es la
   cardinalidad de las filas de la marca; #5 es el contenido de la última columna de una de ellas.
   Con la marca admitiendo N pagos, la fila 7 sigue diciendo `no`; con la fila 7 corregida, el
   segundo cobro de motivo 2 sigue sin poder insertarse.
5. **#7 y #8 no son de la tanda y no se parecen a nada más.** #7 es una premisa del proveedor que
   una medición volvió falsa; #8 es una pieza sin constructor. Los anoto juntos sólo porque son **los
   dos únicos de los ocho que la 9-bis-4 no produjo**, que es el dato del §4.1.

### 2.5 La proporción

| | 8-bis | 8-bis-2 | 8-bis-3 | 8-bis-4 | **8-bis-5** |
|---|---|---|---|---|---|
| hallazgos **nuevos** | 112 | 120 | 85 | 83 | **76** — 72 nuevos de A/B/C2 + 4 míos |
| *(más los que siguen llegando con ID viejo, contados aparte)* | — | — | — | 0 en el cuerpo | **16** — 14 en `B1`/`B2` + 2 míos |
| `CRITICA`, contados por ID | 28 | 27 | 18 | 13 | **9** |
| `CRITICA`, **defectos distintos** | no se midió | 17 | 14 | 12 | **8** |
| **atribuidos a la tanda de arreglos anterior** | 25 de 25 | 17 de 17 | 13 de 14 | 12 de 12 | **6 de 8** |

**Y hay que decir qué `CRITICA` de vueltas anteriores sigue abierto.** Reejecuté los doce de la
8-bis-4 sobre el texto de hoy, uno por uno, y **los doce cortan**: la columna del reloj existe, la
clave del outbox lleva la fecha objetivo, `S10` tiene rama de fallo, el piso otorga tres cosas,
`PB3`/`PB7` tienen su rama de cupo, `MP4` cambió el re-anclaje por un tope, `MP5` tiene su columna,
`S20` tiene orden normativo, `permanent_grant` tiene `revocado_en`, la baja tiene `S22` y `S23`,
`requiere_conciliación` es una fila con motivo y reloj, y la cortesía se difiere con `saldo_días`.
**Los doce se cerraron y ocho nuevos ocuparon su lugar, de los cuales seis los produjo el mismo acto
de cerrarlos** — que es la observación de la pasada, con el número más bajo de las cinco vueltas.

---

## 3. Las contradicciones entre informes, con veredicto — el encargo

Verifiqué cada una **contra el texto del capítulo**, nunca contra el informe que la cita. **Cuatro, y
dos de las cuatro no son contradicciones** — que es el mismo reparto que las dos vueltas anteriores y
también es un resultado.

### 3.1 `F-8fA2-007` contra `F-8fB2-006` sobre cuántos sitios dicen «tres» · **es el mismo defecto, los dos censos coinciden, y los dos cuentan de menos: son SEIS**

**Lo que dice cada uno.** `A2`: *«el corpus dice «tres» en **cinco** lugares»* y los enumera con
línea —`B/03` L884, L1265, L1581, L1642-1643 y `V/03` L172—. `B2`: *«sobrevive en **cuatro** lugares
de `B/03`»* más *«una quinta, que dejo nombrada para `C1` porque es de la otra épica: `V/03` §2»*.

**Veredicto: no se contradicen — los dos dicen cinco y los dos nombran exactamente los mismos
cinco.** La aparente discrepancia (*«cinco»* contra *«cuatro»*) es de alcance: `B2` cuenta sólo dentro
de `B/03`. **Lo verifiqué línea por línea sobre el worktree y los cinco existen y dicen lo que los
dos informes citan.**

**Lo que corrijo, y es mío: son seis.** `rg 'G-R4'` sobre el corpus **entero** —no sobre las dos
épicas y el núcleo— devuelve un sexto: **`01-decision-log.md` L3222**, dentro de `DEC-SUB-013`.
Ninguno de los dos lo cuenta, y **no es un descuido**: el log no es corpus por definición del propio
programa. Es `F-8fC1-003`.

**Y corrijo un número de `A2` en la otra dirección**, porque el encargo pide verificar y no
transcribir: `A2` dice *«el corpus dice **cuatro** en cinco lugares»* y enumera `NUCLEO/03` §1,
`B/03` §3.2, `B/03` §7.2, `V/03` §9 nota 2 y `V/20` §2. Los verifiqué: `NUCLEO/03` §1 regla 7 ✓,
`B/03` L570 ✓, `B/03` L1543 ✓, `V/03` L456-457 ✓ (*«desde la FASE 9-bis-4 son **cuatro** — el cuarto
es `S10`/`S25`»*), `V/20` §2 ✓. **Los cinco existen. El censo de `A2` es exacto en las dos
direcciones y el de `B2` en la suya.** El defecto es uno solo y los dos IDs colapsan.

### 3.2 `F-8fA2-001` contra `F-8fA3-001` sobre el hecho 2 · **NO es una contradicción: son dos preguntas distintas sobre la misma línea, y el desempate que ninguno de los dos usó está en el contrato — y cae del lado que vuelve ejecutable el borrado**

**Lo que dice cada uno.** `A2` pregunta **cuántos actores** ejecutan la relectura: una línea dice
tres, cuatro dicen dos. `A3` pregunta **con qué predicado**: el núcleo dice *«`cubierto` **pasa a**
verdadero»* (un cambio) y las dos escrituras prueban *«trae verdadero»* / *«relee y está cubierto»*
(un estado). **No se contradicen**: son ortogonales, y el §2.4 punto 2 muestra que ni siquiera
colapsan.

**El desempate que aporto, y es de mi vector.** Los dos informes recorren `NUCLEO/01`, `V/02`, `V/03`
y `V/20`. **Ninguno abre `12-contrato-de-cobertura.md`, que es el documento dueño de la pregunta**:
`cubierto` es un campo de la respuesta del contrato, así que quien lo relee es un consumidor del
contrato. Ahí hay **dos** líneas que deciden y las dos estaban sin citar:

1. **Sobre el número de actores** — `12-contrato…` §3, verbatim: *«Y como un push se puede perder,
   **las dos filas que actúan sobre ese reloj vuelven a preguntar en el momento de ejecutar**
   (`V/03` §9, `PB4` y `PB5`): el aviso perdido cuesta un retraso en el reinicio, **jamás un
   archivado** sobre alguien que ya volvió.»* **Es el sexto sitio, dice DOS, y es el que más pesa**
   —lo comparten las dos épicas—. **Y su garantía termina en la palabra `archivado`**: el contrato
   promete que el aviso perdido no produce un archivado, **y no dice nada del borrado**, que es
   exactamente el acto del `CRITICA` de `A2`. **El veredicto sube `F-8fA2-001`, no lo baja**: cinco
   de seis sitios dicen dos, el sexto es el dueño de la pregunta, y su promesa está acotada al acto
   reversible.
2. **Sobre el predicado** — el contrato **lleva los dos**, a 494 líneas de distancia y en el mismo
   archivo: §2.1 dice *«el reloj de inactividad, que se reinicia cuando **la respuesta** trae este
   campo en verdadero»* (un **estado**) y §3 dice *«el reloj de inactividad, **cuyo hecho 2 es
   «`cubierto` pasa a verdadero»**»* (un **cambio**). **El documento que podía dirimir no dirime: lo
   reproduce.** `F-8fA3-001` queda confirmado y con un quinto sitio.

**Y hay un hallazgo mío que sale de ahí y no es de ninguno de los dos**: el §2.1, que es el censo
declarado de consumidores de `cubierto`, **no enumera a `PB4`, ni a `PB5`, ni al hard delete**. Es
`F-8fC1-002`.

### 3.3 La severidad de `F-8fB1-004` —`ALTA` hoy, `CRITICA` el día que exista el capítulo 13— · **cuenta como `ALTA` en esta vuelta, y el criterio queda escrito**

**Lo que dice `B1`, textual**: *«**No la subo a `CRITICA` por una razón que hay que declarar**: hoy
la población es cero, porque ninguna transición lleva a un pagador manual a `ACTIVE`
(`F-8eB1-005`). **El día que el capítulo 13 escriba esa alta, este hallazgo pasa a `CRITICA` sin que
nadie toque el §7.2**.»*

**Verifiqué la premisa contra el texto y es correcta.** Recorrí las 25 filas `S`, las 5 `MP` y las 6
`A` de `B/03` §3.2 buscando una transición cuyo `hacia` sea `ACTIVE` sobre un pagador manual: `S2`
lleva a `GRACE_PERIOD` por `MP5`, y `MP4` reabre desde `SUSPENDED`. **No hay alta que aterrice en
`ACTIVE`.** La población de `F-8fB1-004` es hoy vacía.

**Veredicto: `ALTA`, y no cuenta entre los críticos de esta vuelta.** El criterio que dejo escrito,
porque va a volver a hacer falta:

> **Un hallazgo cuenta como `CRITICA` de una pasada si su población es no vacía CONTRA EL TEXTO DE
> HOY.** Una severidad condicionada a que se escriba un capítulo que no existe es una **predicción**,
> y las predicciones no entran en el conteo que la serie mide — porque la serie mide *«qué produjo la
> tanda de arreglos»*, y un capítulo que nadie escribió no produjo nada. **Lo que sí corresponde es
> que quede registrada como tal**, que es lo que `B1` hizo y por eso el §4 de las instrucciones la
> admite explícitamente (*«qué se rompe cuando se escriba»*).

**Y la consecuencia práctica, dicha para que no se pierda**: el día que el capítulo 13 escriba el
alta del pagador manual, **dos** hallazgos de esta pasada cambian de estado sin que nadie toque una
línea — `F-8fB1-001` pasa de inejecutable a ejecutable y `F-8fB1-004` pasa a `CRITICA` —, más lo que
`B1` §*«Lo que cae en el hueco del capítulo 13»* enumera. **Es el único lugar del programa donde una
severidad futura está fechada, y conviene que el capítulo 13 arranque leyéndolo.**

### 3.4 `F-8fA1-003` contra `F-8fC2-005` sobre el catálogo de correos · **no se contradicen, y el número que uno de los dos usa lo verifiqué y no es el que cita**

**Lo que dice cada uno.** `A1` habla de *«la fila 13 de `B/19` §4»* y de que el commit de
`DEC-GRANT-008` la reescribió sin agregarle la frase del trial que `NUCLEO/08` §3.1 exige. `C2` dice
que *«el catálogo de correos pasó de trece filas a quince»*.

**Veredicto: no es una contradicción — son la misma tabla en dos momentos**, y las dos afirmaciones
conviven: la fila **13** existe y el catálogo tiene **quince** filas. Lo verifiqué abriendo `B/19`
§4.

**Lo que sí corrijo es de `A1`, y es el tipo de cosa que esta sección existe para encontrar**: `A1`
escribe que el arreglo *«reescribió la fila 13 de `B/19` §4»* citando `NUCLEO/08` §3.1 como *«la
fuente que esa misma fila cita»*. Abrí `NUCLEO/08` §3 y **la tabla de acciones administrativas tiene
DOCE filas, no trece** —las conté; el propio § lo declara: *«**La tabla tiene DOCE filas y cada fila
es UNA acción**»*, y las cinco líneas que cuantifican sobre ella (`V/17` §3.2 reglas 1 y 3, §3.3,
§3.4 y `B/19` §6) siguen diciendo doce y **siguen siendo exactas**—. O sea: la *«fila 13»* es de
`B/19` §4 (el catálogo de correos, quince filas) y **no** de `NUCLEO/08` §3 (doce filas). **La
observación de `A1` se sostiene entera**; lo que no se sostiene es leerla como si las dos tablas
fueran la misma, que es el error que la coincidencia de la palabra *«fila»* invita. Lo anoto porque
el catálogo de `NUCLEO/08` §3 es **uno de los once conteos exactos** del censo de `F-8fC1-004` y no
quiero que quede contado como falso por asociación.

---

## 4. ¿`DEC-METH-011` cortó el generador? — el encargo

**La respuesta corta: por primera vez la serie bajó —de 12 de 12 a 6 de 8—, el rastro existe y se
puede auditar, y lo que la enmienda NO cortó ya no es lo que la vuelta pasada predijo. El agujero se
movió: no es la exclusión de la prosa nueva, es la CALIDAD de la resolución sobre las apariciones que
la regla sí alcanzó.**

### 4.1 La atribución: 6 de 8, y la serie bajó por primera vez en cinco vueltas

Recorrí los ocho defectos del §2.2 y clasifiqué su atribución contra el texto de cada informe, contra
los capítulos y contra los diffs.

| | 8-bis | 8-bis-2 | 8-bis-3 | 8-bis-4 | **8-bis-5** |
|---|---|---|---|---|---|
| críticos distintos | no se midió | 17 | 14 | 12 | **8** |
| **los introdujo la tanda anterior** | 25 de 25 | 17 de 17 | 13 de 14 | 12 de 12 | **6 de 8** |
| de ellos, **nacidos enteros** en la tanda | — | — | — | 9 | **5** — #1, #2, #3, #5, #6 |
| de ellos, **preexistentes que la tanda volvió críticos** | — | — | — | 3 | **1** — #4 (el comportamiento sobre la población larga se conservó intacto y el arreglo le puso encima una justificación que lo declara inexistente) |
| **los NO introdujo la tanda** | 0 | 0 | 1 | 0 | **2** — #7 y #8 |

**Y los dos que la tanda no produjo son de dos clases que el programa nunca había tenido juntas:**

- **#7 (`F-8fB3-001`)** es una premisa sobre el proveedor que **una medición volvió falsa**. El `B/09`
  §4 no cambió una palabra; lo que cambió es que `RC-5` midió `charged_quantity` en producción el
  2026-09-22 y resultó contar intentos. **Es el primer crítico del programa producido por la matriz y
  no por un arreglo**, y la matriz es el único artefacto del programa que trae hechos de afuera.
- **#8 (`F-8fC2-001`)** es un **hueco de cuatro días de antigüedad que cuatro vueltas no vieron**: el
  §2.6 de `B/descomposicion.md` (2026-09-18) declara *«dos dependencias, y ninguna más»* y el §4.1 del
  contrato (2026-09-19) declara la dirección inversa **al día siguiente**. Lo verifiqué con
  `git log -1` sobre `2805d72ea` y `4f34afa1a`: las fechas son exactas.

**La lectura que esas dos habilitan, y es la más importante de esta sección.** Durante cuatro vueltas
el 100 % (o el 93 %) de los críticos venía de la tanda anterior, y la conclusión razonable era que el
generador **era** el acto de arreglar. **Esta vuelta el 25 % viene de otro lado, y no porque la tanda
haya producido menos en términos absolutos —produjo 6 contra 12— sino porque los otros dos
mecanismos del programa empezaron a producir hallazgos críticos: la medición externa y la lectura del
conjunto.** La serie que baja no es sólo *«la enmienda anduvo»*: es también *«se empezó a mirar
afuera del diff»*.

### 4.2 Cuántos habría atrapado el rastro, ahora que el rastro existe — contestado con evidencia

Ésta es la pregunta que ninguna vuelta anterior pudo contestar. La contesto sobre los **6** que la
tanda produjo, porque los otros dos no tienen tanda a la cual atribuirlos. Cada fila la verifiqué
abriendo el rastro citado y comprobando que la línea está donde el informe dice y dice lo que cita.

| # | defecto | ¿la aparición está en el rastro? | desenlace del §1.4 | ¿el rastro lo atrapó? |
|---|---|---|---|---|
| **4** | el tope de `MP4` | **SÍ**, y **dos veces**: `rastro-8f9f31ac0.md` §4 pregunta 1 (*«se cumple entera con el tope»*) y `rastro-f21d5d828.md` §3 (*«sigue correcta»*, sin argumento) | **1º — la regla se ejecutó y la resolución estuvo mal, dos veces sobre la misma aparición** | **no** |
| **5** | `PAGO_TARDÍO_RECHAZADO` | **SÍ**: `rastro-f21d5d828.md` §3, `B/05` L175-180 — *«sigue correcta: las cuatro no cambian; **lo que cambió es el motivo con que se marca**»* | **1º** — la justificación **nombra el cambio y lo descarta en la misma frase** | **no** |
| **3** | el predicado del hecho 2 | **SÍ**: `rastro-5836ec219.md` L245-246 — *««lo que reinicia la inactividad es `cubierto` pasando a verdadero» → sigue correcta: **lo que cambió es de dónde se lee ese hecho, no cuál es**»* | **1º** — resuelve *«de dónde se lee»* y no *«con qué predicado se escribe»*, que es lo único que la columna nueva agregó | **no** |
| **1** | `G-R3` sólo prohíbe | **SÍ**, y la justificación es **verdadera**: `rastro-5836ec219.md` §2 L210 y `V/20` L59 — *««recuperar lo suyo» no es una clave comercial»* | **ninguno de los tres** — la aparición está, la justificación no es falsa, y el defecto vive en la pregunta que la aparición **no obliga a hacerse** | **no** |
| **2** | el hard delete y los relectores | **no**: las cinco líneas las escribió `5ac5e92c9` en sus propios hunks | **3º** — exclusión viva, **modo 1** | **no** |
| **6** | el `UNIQUE` y la FK | **no**: las dos apariciones del `UNIQUE` son prosa que el commit escribió | **3º** — exclusión viva, **modo 1** | **no** |

**Las tres cifras que salen de esa tabla, y son las que el encargo pide:**

1. **El rastro ALCANZÓ 4 de los 6** — o sea, la enmienda llegó al lugar donde estaba el defecto en
   **dos tercios** de los casos. **Ninguna vuelta anterior llegaba a ninguno**, porque el artefacto
   no existía.
2. **El rastro ATRAPÓ 0 de los 6.** Cuatro veces llegó y resolvió mal (tres) o resolvió bien una
   pregunta más angosta (una).
3. **La exclusión que `DEC-METH-011` dejó viva a propósito explica 2 de los 6**, contra **5 de 9 la
   vuelta pasada**. En proporción: **33 % contra 56 %**.

### 4.3 Cuántas líneas de rastro resultaron falsas, sobre cuántas revisadas — la primera medición de CALIDAD del programa

**Los ocho informes revisaron 887 líneas de rastro declaradas**, y lo conté yo sumando la sección
`## Líneas de rastro que ataqué` de cada uno: A1 **212** · A2 **63** · A3 **181** · B1 **186** ·
B2 **108** · B3 **92** · C2 **45** (más 11 ítems de auto-corrección) · **C1 (yo) 9 líneas, las 9
sostenidas, más 23 verificaciones cruzadas** (§7). **887 es un número de REVISIONES, no de líneas
distintas**, y hay que decirlo porque los siete se solaparon:

- `rastro-8d6b27a12.md` §4 **fila 13** la revisaron **tres** (`A2`, `B1`, `B2`), cada uno falsando un
  ítem distinto de la misma fila.
- `rastro-032f761e0.md` §3, la línea de `fin_real` sobre `B/02` §2.2, la revisaron **dos** (`A2`,
  `B2`) y los dos la declararon *«insuficiente»* sin declararla falsa.
- De las **187** de `rastro-5836ec219.md`, `A1` las leyó **todas**, `A3` 38, `A2` 28 y `B2` 6.

**El rango de líneas DISTINTAS revisadas, calculado tomando por rastro el máximo de las coberturas
declaradas (cota inferior) y la suma (cota superior)**: entre **517 y 887 de las 1.030**, o sea entre
el **50 % y el 86 %**. Lo digo como rango porque cinco de los siete informes declaran rangos de
sección y no listas de líneas, así que el número exacto **no se puede computar desde los informes** —
y ésa es una observación sobre el método, no una queja.

**Las líneas declaradas FALSAS: 17 marcas, 16 líneas distintas.** Las recorrí una por una:

| informe | marcadas `FALSA` | qué dice su propio encabezado |
|---|---|---|
| A1 | **3** | *«2 falsas»* — **su tabla marca tres** (`V/10` L120, `11-particion` L127/L132, `B/10` L218-221) |
| A2 | **1** | *«una resultó falsa, una incompleta»* — **la subsección «INCOMPLETA» lista dos**, y 1+2+61 ≠ 63 |
| A3 | **2** | *«tres … y una cuarta»*, de las cuales dos son `FALSA` estricta, una `INCOHERENTE` y una *«verdadera del término y falsa de la columna»* |
| B1 | **5** | coincide |
| B2 | **3** | coincide (más una *«corrección a medias»* y un *«paréntesis caduco»*, que no cuenta como falsa) |
| B3 | **2** | coincide, y declara la tasa: **2,2 %** |
| C2 | **1** | coincide (más una *«caduca»* que declara explícitamente **no** contar) |
| **total** | **17** | |

**16 distintas**, porque `rastro-8d6b27a12.md` §4 fila 13 la cuentan `A2` y `B1` por separado.

**La tasa: 16 falsas sobre 517-887 revisadas = entre 1,8 % y 3,1 %.** Es la primera vez que el
programa puede escribir esa frase. **Y lo que la tasa NO dice, dicho para que no se lea de más**: el
2 % es de las líneas **revisadas**, y los siete eligieron qué revisar **por sus vectores**, o sea
apuntando a donde sospechaban. Una tasa sobre una muestra dirigida es una cota **superior** del ruido
y una cota **inferior** del daño: las 1.030 no se revisaron.

**El reparto temporal de las 16, que es la otra mitad del resultado:**

| | cuántas | cuáles |
|---|---|---|
| **falsas el día que se escribieron** | **10** | A1 ×3, A3 ×2, B1 ×4 (incluidas las dos meta-afirmaciones de `8d6b27a12` §5), C2 ×1 |
| **verdaderas en su SHA, falsas por un commit POSTERIOR de la misma tanda** | **6** | B2 ×3 (las tres de `G-R4`, fechadas a las 17:33, 17:55 y 18:29 contra las 20:17 de `8d6b27a12`), B3 ×2, la mitad *«tres pares»* de la fila 13 |

**Diez de dieciséis fueron malas resoluciones, no caducidades.** Es el dato que decide el §4.5: **la
enmienda no falla por el paso del tiempo, falla por la calidad de la justificación** — y eso es
corregible con una regla, mientras que la caducidad necesita un mecanismo.

### 4.4 Los MODOS de fallo del rastro: no son cuatro, y el encargo pide decirlo

Los siete informes describieron cuatro modos, cada uno por su cuenta y ciegos entre sí. Los crucé
contra las 16 líneas falsas y contra los 6 críticos. **Mi veredicto: son TRES modos de fallo más DOS
límites de alcance, y el cuarto desenlace que `F-8fC1-003` agrega. Y dos de los cuatro que el encargo
enumera son el mismo, con signo opuesto.**

| | qué es | quién lo describió | instancias | ¿es un modo o un límite? |
|---|---|---|---|---|
| **A** | **la resolución contesta MENOS que la cita** — por sujeto (*«se verificó que los tres avisos estuvieran, no que los lectores fueran cinco»*) o por delta (*«¿el arreglo cambió este número?»* en vez de *«¿es verdadero?»*) | `A3` (sujeto) y `A1` (delta), **por separado y sin cruzarse** | **9 de las 16**, y **4 de los 6** críticos (#3, #4, #5, #1) | **modo**, y es el mayoritario |
| **B** | **la resolución afirma MÁS que la cita** — la cita queda verdadera y el rastro le agrega una garantía que nadie verificó (*«y ahora esa ficha además tiene cómo volver»*) | `A2` | 2 de las 16 (las dos *«incompletas»*) | **modo**, y es **A con el signo invertido** |
| **C** | **caducidad** — verdadera en su SHA, falsa por un commit posterior de la misma tanda | `B3` y `B2`, los dos con timestamps | **6 de las 16** | **modo**, y el único que no es sobre la resolución |
| **D** | **lo que no tiene aparición** — una fila ausente, una afirmación cuantificada sobre un conjunto que no nombra sus miembros, un `updated:` de frontmatter | `C2` y `B3`, por separado | los 4 conteos del contrato, los 14 de mi censo, `B/09` §4 entero | **límite de alcance**, no un modo |
| **E** | **la prosa que el commit escribe o edita** — la exclusión que `DEC-METH-011` dejó viva | `B2`, `B3`, `A2`, `A3` | **2 de los 6** críticos | **límite de alcance**, declarado |
| **F** | **la aparición que está FUERA del corpus** — el log, la matriz, las sondas | **nadie**; es mío (`F-8fC1-003`, `F-8eC1-007`) | 2 conteos falsos, uno de ellos la razón escrita de una decisión | **cuarto desenlace**, no previsto por el §1.4 |

**Por qué A y B son el mismo modo, y por qué conviene decirlo:** la unidad de verificación de la
obligación 2 es **la aparición de un término**; la unidad de la afirmación es **la cláusula**. Cuando
la cláusula es más ancha que el término, la justificación contesta de menos (A); cuando el que
justifica agrega una cláusula para cerrar la duda, contesta de más (B). **Son la misma
desalineación, y la regla que las cierra es una sola**: *«la justificación tiene que cubrir el
cuantificador de la cita, y no puede afirmar nada que no esté verificado en ella»* — que es la forma
`DEC-METH-011` de la regla que el corpus ya escribió para los guards (*«el mensaje no puede afirmar
más que el predicado»*).

**Y el modo A es hoy el mayoritario, donde la vuelta pasada el mayoritario era E.** Es el
desplazamiento que contesta la pregunta 6 del encargo (§4.6).

#### La detección de la caducidad que `B3` propone: la medí y NO es viable como está escrita

`B3` propone detectar el modo C con `git log -S'<la cita>'` contra el sha del rastro. **La corrí sobre
las dos instancias más limpias, el 2026-09-22:**

```
git log --oneline -S'G-R4 sigue contando tres' ce52dce5f..HEAD -- .specs   →  (vacío)
git log --oneline -S'siguen siendo tres'       f21d5d828..HEAD -- NUCLEO/03 →  (vacío)
```

**Las dos devuelven cero, y las dos líneas son falsas hoy.** La razón es estructural y vale más que
las dos mediciones: **la caducidad no ocurre porque la cita cambie, ocurre porque cambia lo que la
hace verdadera**. `rastro-ce52dce5f.md` cita *«`G-R4` sigue contando tres»* de `B/03` §3.2, y esa
frase **sigue estando ahí, intacta**; lo que se movió fue **la tabla de `NUCLEO/03` §1 regla 7**, en
otro archivo, a la que la frase no nombra. Un `git log -S` sobre la cita es ciego por construcción a
eso.

**Lo que sí funciona, y lo medí en la misma corrida:**

```
git log --oneline ce52dce5f..HEAD -- nucleo/03-maquinas-de-estado.md
→ 5d412ae60, 0f7b1e17d, 70d83299d, 3310c9376   (cuatro commits posteriores)
```

O sea: **buscar por el ARCHIVO que contiene el objeto que la cita cuenta, no por la cita**. Eso
convierte la propuesta de `B3` en algo ejecutable, con un costo concreto: **cada línea de rastro
tiene que nombrar el archivo§ del objeto sobre el que afirma**, que hoy no hace —nombra el archivo§
donde está la aparición—. Con eso, un barrido al cierre de la tanda re-evalúa sólo las líneas cuyo
objeto tocó algún commit posterior. **Las seis caducidades de esta vuelta caen las seis dentro de ese
barrido**, porque las seis cuentan objetos (`NUCLEO/03` regla 7, `B/14` §4.4, el `UNIQUE` de
`DEC-GRANT-009`) que un commit posterior de la misma tanda abrió.

### 4.5 Las correcciones, con su costo — propuesta, no aplicada

No toco el decision log. Lo que sigue es lo que propongo, ordenado por lo que compra, con lo que
**no** cierra dicho en voz alta. **Y arranco acreditando lo que anduvo, porque la pasada mide el
método y no sólo los defectos.**

**Lo que `DEC-METH-011` compró, medido.** La Corrección A de la vuelta anterior —*«el rastro por
aparición es un ARCHIVO»*— se aplicó entera y **es la razón por la que esta sección existe**. Diez
archivos, 1.030 afirmaciones falsables, 47 de 47 commits del corpus nombrados, **y 16 líneas falsas
que se pudieron exhibir con archivo y línea**. Con *«72 apariciones justificadas una por una»* en un
mensaje de commit, ninguna de las 16 era señalable. **Es la única corrección del programa que compró
exactamente lo que prometió**, y lo que prometía era hacer falsable lo demás.

**Corrección E — la justificación cubre el cuantificador de la cita, y no afirma nada que no esté
verificado en ella.** Es la regla que cierra los modos A y B.

- **Compra: 4 de los 6 críticos de esta vuelta** (#1, #3, #4, #5) y **9 de las 16 líneas falsas**. Es
  más de lo que ninguna corrección propuesta hasta ahora compró, y es la primera cuyo número sale de
  una medición y no de una estimación.
- **Costo: dos renglones de la regla, y ningún trabajo nuevo por aparición.** No pide recorrer más
  apariciones: pide que la justificación de cada una responda por la cláusula entera. La forma
  operativa, sacada de las cuatro que fallaron: **la justificación no puede empezar con *«lo que
  cambió es…»***, porque las tres del modo A por delta empiezan así (*«lo que cambió es de dónde se
  lee»*, *«lo que cambió es el motivo»*, *«lo que cambia es el alcance del remedio»*). Nombrar el
  cambio y descartarlo en la misma frase es la firma del modo.
- **Y la forma correcta NO hay que inventarla: ya está escrita, por el mismo equipo, en el mismo
  artefacto.** Las tres mejores líneas que verifiqué (§7) hacen exactamente lo que la regla pediría —
  *«la cláusula que la salva es la que ella misma escribe»* (`f21d5d828` sobre `B/02` §2.2, que
  además **enumera los seis sitios que deliberadamente no tocó y por qué**) y *«si alguna se hubiera
  escrito como «el último» o «de seis», sería falsa»* (`032f761e0` sobre los ordinales del espejo)—.
  **La regla se puede escribir citando esas dos líneas como el patrón**, que es la forma más barata
  de adoptarla: no es una práctica nueva, es la que el 2 % bueno ya usa.
- **Lo que NO cierra**: #2 y #6, que están en la exclusión viva.

**Corrección B (la de la vuelta anterior, re-evaluada con la medición en la mano) — el rastro cubre
también la prosa que el commit escribe y edita.**

- **Compra: 2 de los 6 críticos** (#2, #6), contra los **5 de 12** que estimé la vuelta pasada. **Mi
  propia recomendación de la vuelta anterior queda corregida por la medición**: dije que ésta era *«la
  que más compra»* y hoy compra la mitad que la E.
- **Costo: el mismo que declaré y sigue siendo el más alto de las cinco** — un commit que escribe tres
  párrafos nuevos tiene que justificar cada afirmación que hace. La versión acotada —**premisas, no
  apariciones**— sigue siendo la que la vuelve viable.
- **Recomendación: va DESPUÉS de la E, no antes.** Es la inversión del orden que propuse hace una
  vuelta, y la razón es el número: la E compra el doble por un costo que es dos renglones contra
  reescribir cada arreglo.

**Corrección F — cada línea de rastro nombra el archivo§ del OBJETO sobre el que afirma, y un barrido
al cierre de la tanda re-evalúa las que ese archivo tocó después.** Es el modo C, con el mecanismo
que la medición del §4.4 mostró que hace falta.

- **Compra: 6 de las 16 líneas falsas, y cero críticos de esta vuelta.** Lo digo así porque es
  tentador venderla de más: ninguna de las seis caducidades produjo un crítico. Lo que produce la
  caducidad es **la sensación de que el corpus está verificado cuando no lo está**, que es lo que la
  fila 13 de `8d6b27a12` §4 exhibe: una tabla titulada *«premisas … **corregidas en el mismo acto**»*
  con cuatro de seis sin corregir.
- **Costo: una columna por línea de rastro y un barrido de un comando al cierre.** Y una advertencia
  medida: **la forma que `B3` propone (`git log -S` sobre la cita) no sirve**, y es importante no
  aplicarla creyendo que sí — devolvió cero sobre las dos instancias que probé.

**Corrección D (la de la vuelta anterior, re-evaluada) — el índice de conteos.**

- **Con el censo del `F-8fC1-004` en la mano, la corrección se puede acotar a la mitad de lo que
  propuse.** No hace falta un índice de veinticinco conteos: **12 de los 14 falsos viven fuera del
  documento dueño del conjunto**, así que lo que hace falta es **que el dueño de cada conjunto lleve
  la lista de quién lo cita** — doce filas, no veinticinco. Y no hace falta inventar la disciplina:
  `NUCLEO/04` §5 la tiene escrita y la ejecuta bien; lo que le falta es saber que tres documentos la
  copian.
- **Compra: cero críticos y 14 hallazgos de esta pasada**, que es otra vez la clase más repetida y la
  más barata de cerrar.

**Corrección G — el alcance de la obligación incluye el decision log.** Es el cuarto desenlace
(`F-8fC1-003`, `F-8eC1-007`).

- **Compra: 2 conteos falsos, uno de ellos la razón escrita de una decisión tomada.** Es poco.
- **Costo: bajo pero no nulo** — el log tiene 88 decisiones y 4.000 líneas, y la mayoría de sus
  apariciones son históricas por diseño (una decisión vieja **debe** conservar la razón que tenía).
- **Recomendación: NO aplicarla como está, y sí acotarla.** Lo que hay que vigilar del log no es toda
  aparición sino **las cifras del bloque `## Resumen`**, que son las que pretenden describir el estado
  de HOY. Las razones internas de cada decisión son un registro histórico y caducarlas sería borrar
  el rastro del programa. **Una fila de la Corrección D basta**: el resumen del log es un consumidor
  más de los conteos que otros documentos son dueños.

### 4.6 ¿Sigue siendo la exclusión el agujero principal? — la pregunta pendiente de la vuelta pasada

**No. El rastro la desplazó, y hay número.**

| | 8-bis-4 | **8-bis-5** |
|---|---|---|
| críticos que la enmienda **no atrapó** | 9 de 12 | **6 de 6** |
| de ésos, por la **exclusión de la prosa que el commit escribe o edita** (modos 1 y 2) | **5 de 9 = 56 %** | **2 de 6 = 33 %** |
| de ésos, por **resolución de mala calidad sobre una aparición que la regla SÍ alcanzó** | no se podía medir (el rastro no existía) | **4 de 6 = 67 %** |

**La vuelta pasada la exclusión era el agujero principal porque era el único medible.** Hoy el rastro
existe, y lo que muestra es que **la regla llega al lugar correcto dos veces de cada tres y resuelve
mal**. Eso invierte la prioridad: la Corrección B —levantar la exclusión— pasa de ser la que más
compra a la segunda, y la Corrección E —la calidad de la justificación— pasa a primera, con el doble
de compra y una fracción del costo.

**¿Pide esto una `DEC-METH-012`? Sí, y digo por qué y qué debería decir.** No porque `DEC-METH-011`
haya fallado —no falló: es la primera enmienda del programa que hizo lo que prometía— sino porque
**hizo visible un problema que no se podía enunciar antes**, y una enmienda que no se escribe deja el
hallazgo como una observación de un informe. Lo que propondría que fije, en orden de lo que compra:

1. **La justificación cubre el cuantificador de la cita y no afirma nada que no esté verificado en
   ella** (Corrección E) — 4 de 6 críticos.
2. **Cada línea nombra el archivo§ del objeto sobre el que afirma, y un barrido al cierre re-evalúa
   las que ese archivo tocó después** (Corrección F) — 6 de 16 falsas, y le pone mecanismo a la
   caducidad.
3. **El rastro cubre la prosa que el commit escribe, en forma de premisas y no de apariciones**
   (Corrección B, diferida) — 2 de 6 críticos, al costo más alto de las tres.

**El owner decide.** Lo que recomiendo con fundamento es **1 y 2 ahora, 3 cuando 1 y 2 tengan una
vuelta medida** — exactamente la inversión de lo que recomendé hace una vuelta, y la razón del cambio
es que ahora hay medición donde había estimación.

### 4.7 El veredicto, en tres líneas

1. **Por primera vez en cinco vueltas la serie bajó: 6 de 8 críticos vienen de la tanda, contra 12 de
   12, 13 de 14, 17 de 17 y 25 de 25.** Y los dos que no vienen de la tanda son de clases que el
   programa nunca había producido — uno de una **medición externa** (`RC-5`) y otro de **leer el
   conjunto** (la dirección inversa sin constructor): no es sólo que la tanda generara menos, es que
   se empezó a mirar afuera del diff.
2. **`DEC-METH-011` hizo exactamente lo que prometía y eso alcanzó para cambiar la pregunta.** El
   rastro existe, cubre 47 de 47 commits del corpus, y sobre él los ocho informes revisaron 887
   líneas y exhibieron **16 falsas con archivo y línea** — una tasa de entre 1,8 % y 3,1 %, que es la
   primera medición de CALIDAD que el programa pudo hacer. **Lo que ninguna de las 16 hubiera sido es
   señalable hace una vuelta.**
3. **Y el agujero se movió, que es la respuesta a la pregunta que quedó pendiente.** No es la
   exclusión de la prosa nueva —bajó de 5 de 9 a 2 de 6—: es que **la regla llega al lugar correcto
   en 4 de los 6 y resuelve mal**, tres veces nombrando el cambio y descartándolo en la misma frase.
   La corrección que eso pide son dos renglones de regla y compra el doble que la que yo recomendé
   hace una vuelta; la que yo recomendé baja a segunda con la medición en la mano.

---

## 5. Los defectos `NUCLEO` de los otros siete, adoptados

Los adopto como míos. **Los que tienen ID ajeno lo conservan** —duplicarlos inflaría el conteo—; los
que no tenían, se lo di en el §1. `C2` marcó cuatro y el resto de los vectores marcó ocho más.

| defecto | ID | dónde vive | qué hay que hacer |
|---|---|---|---|
| nada exige que la versión de piso **otorgue** sus tres cosas; `G-R3` es un predicado enteramente negativo | `F-8fA1-001` (`CRITICA`) | `V/02` §2.1 · `V/20` §2 · `NUCLEO`, vía `NUCLEO/01` §1.2 hecho 1 | darle a `G-R3` la mitad positiva, que el propio catálogo ya escribió para `G-R6`/`G-R6-B` |
| el hecho 2 está enunciado como **cambio** y ejecutado como **estado** | `F-8fA3-001` (`CRITICA`) | `NUCLEO/01` §1.2 fila 2 | decidir el predicado y alinear la lista de escritores y `G-R6-B` con él |
| la fila 13 de `B/19` §4 cita `NUCLEO/08` §3.1 y no lleva la frase del trial que esa fuente exige; y sigue sin haber fila para *«otorgar»* | `F-8fA1-003` | `NUCLEO/08` §3.1 | una frase en la celda, o una fila |
| el cuarto hecho de la lista de escritores no tiene ejecutor declarado en ninguna de las dos épicas | `F-8fA3-004` | `NUCLEO/01` §1.2 | nombrar el ejecutor, o sacar el hecho |
| `D16` declara que sus dos cifras *«son configuración»* y ninguna es columna | `F-8fA3-005` | `NUCLEO/04` §3 | decir de dónde lee `G-R5` — **sigue llegando desde `F-8eA3-003`** |
| el invariante 26 sigue prohibiendo la columna de la que depende que publicar una versión no mueva lo ya comprado | `F-8fA3-009` | `NUCLEO/04` §2.1 | acotar el enunciado — **tercera vuelta, desde `F-8dA3-004`** |
| el glosario sigue dándole al producto de addon la duración y los efectos, y al grant *«su scope de verticales»* | `F-8fA3-016` | `NUCLEO/01` §1.6 y §5 | dos líneas — **tercera vuelta, desde `F-8dA3-005`** |
| `G-R1-E` enumera tres lugares donde puede vivir un predicado sobre `sucede_a` y el de `MP1`/`MP4` vive en el cuarto | `F-8eB2-007` (sigue llegando) | `NUCLEO/01` §2.4 · `B/20` §2 | ampliar el ancla a la columna de efectos |
| `MP1` y `MP4` escriben el predicado del grupo B y siguen sin figurar en el inventario: son **dos** consumidores faltantes | `F-8eB1-006` (sigue llegando) | `NUCLEO/01` §2.4 | dos filas |
| `D16` y `G-R5` comparan el tope del catálogo y la cortesía sigue sin tope; la quinta comprobación no alcanza a una cortesía larga | `F-8eB1-010` (sigue llegando) | `NUCLEO/04` §3 | acotar el enunciado, o darle tope a la cortesía |
| el catálogo de correos pasó de trece a quince y la regla de reparto manda a billing cinco avisos que construyen unidades de verticales | `F-8fC2-005` (`C2`) | `NUCLEO/08` · `11-particion…` | el reparto |
| el conteo de invariantes vive con tres valores en cuatro documentos (51 · 52 · 53) | `F-8fC2-008` (`C2`) | `NUCLEO/00` L87 y L96 · `NUCLEO/04` §5 | tres celdas — es la fila 4-5-6 de mi censo |
| `DEC-MP-003` omite `S25` entre los consumidores del motivo de pausa, y con el motivo nuevo la pausa del proveedor pierde el tope que `D16` compara | `F-8fC2-006` (`C2`) | `NUCLEO/04` §3 (`D16`) | acotar `D16`, o darle tope al motivo nuevo |
| cuatro capítulos del núcleo siguen sin ser de ninguna de las 22 unidades | `F-8fC2-010` (`C2`) | `nucleo/00` · las dos `descomposicion.md` | el reparto **ya está escrito** en `11-particion…` §4 y nadie lo copió — **cuarta vuelta** |
| `NUCLEO/00` cuantifica las fuentes admitidas en 54 decisiones, con el log en 88 | **`F-8eC1-004`** | `NUCLEO/00` L42 | **sigue llegando, brecha 22 → 34** |

**`F-8fC1-001` y `F-8fC1-002` NO van acá, y conviene decir por qué**: los dos parecen del núcleo por
el tema y ninguno lo es. Los dos sitios falsos de `F-8fC1-001` están en `B/14` y `B/03`, y el tercer
conjunto en `12-contrato…`; **la aparición de `NUCLEO/04` §3 la ataqué, está acotada a `D15` por
escrito, `rastro-f21d5d828.md` L440 la defiende con el argumento correcto y la verifiqué: no es un
defecto.** `F-8fC1-002` es entero del contrato del paraguas. **Marcar `NUCLEO` de más le pasa trabajo
a la pasada C que no le toca.**

**Y hay que acreditar tres arreglos del núcleo, porque la pasada mide el método y no sólo los
defectos**, los tres míos de vueltas anteriores:

- **`F-8eC1-001` CORTA.** `B/16` §4.3 contaba seis transiciones que dejan huérfano a un addon y la
  sexta no tenía fila. Hoy la lista tiene **diez** y `B/03` §8 celda `A5` tiene seis — lo que queda es
  el desfasaje entre las dos, que `B2` reporta con su propio ID (`F-8fB2-002`). **El defecto que yo
  denuncié —una transición sin fila— se cerró; lo que queda es un conteo**, que es exactamente una
  capa más abajo.
- **`F-8eC1-006` CORTA en su mitad estructural.** La regla 7 delegaba su conteo en `G-R4` sobre un
  dominio que el guard no podía leer. Hoy `NUCLEO/03` §1 regla 7 tiene la tabla enumerada de cuatro
  filas, con *«qué las separa»* explícito por fila, y el párrafo declara que **son disjuntos por
  construcción y no por acuerdo**. **Es el arreglo más limpio de la tanda sobre el núcleo.** El
  residuo bajó una capa y es de prosa: seis sitios siguen diciendo tres (`F-8fC1-003`,
  `F-8fA2-007`, `F-8fB2-006`).
- **`F-8eC1-002` NO corta, y es la cuarta vuelta.** El inventario de consumidores de *«fila viva»* de
  `NUCLEO/01` §2.4 sigue sin `MP1` ni `MP4` (`F-8eB1-006`, que `B1` reejecutó y verifiqué) y `G-R1-E`
  sigue enumerando tres lugares donde puede vivir el predicado (`F-8eB2-007`). **Es la única de mis
  tres que sobrevivió a la tanda que la denunció**, y la nota vale: el inventario quedó corto **en la
  misma tanda que lo construyó** por cuarta vuelta consecutiva.

---

## 6. Ataques que intenté y el diseño resistió

Van porque un cero medido es un resultado y un cero por no haber mirado, no.

1. **Intenté falsear el conteo de acciones administrativas de `NUCLEO/08` §3.** Es el conteo con más
   consumidores del corpus —cinco líneas cuantifican sobre él (`V/17` §3.2 reglas 1 y 3, §3.3, §3.4 y
   `B/19` §6)— y la tanda le agregó *«anclar una vertical nueva»* a la fila del grant y *«levantar la
   marca»* ganó el motivo. **Conté las filas: DOCE**, y el § explica por qué el enrutado del
   reembolso —que la tanda escribió— **no** suma filas (*«es un efecto de transición»*) y por qué la
   re-emisión de `S9` tampoco (*«es un job»*). **Los dos argumentos se sostienen contra el texto de
   `B/03` §3.2 y `B/02` §2.5.** Es el mejor conteo del corpus y es el único que documenta sus propias
   no-incorporaciones.
2. **Intenté mostrar que el total de 29 guards distintos caducó.** La tanda repartió catorce guards
   sin unidad y agregó `G-R6` y `G-R6-B`. Conté las dos tablas fila por fila: `V/20` §2 tiene **17**,
   `B/20` §2 tiene **16**, y comparten `G-R4`, `G-R5`, `G-R6` y `G-R6-B`. **17 + 16 − 4 = 29**, que es
   lo que el log declara. **Exacto.**
3. **Intenté mostrar que las 88 decisiones del log no cierran contra 11 + 77.** `rg -c '^### DEC-'`
   da 89; la plantilla de L26 (`### DEC-<AREA>-<NNN>`) no es una decisión; `rg -c '^### DEC-METH'` da
   11. **88 = 11 + 77. Exacto, y el resumen del log declara la regla de descuento que usa.**
4. **Intenté mostrar que `NUCLEO/04` §5 se contradice consigo mismo con sus tres valores (51, 52 y
   53).** No se contradice: los **52** están los dos dentro de notas **fechadas** que declaran
   explícitamente la transición (*«el total de la derecha pasa de 15 a 16 y «cincuenta y dos» a
   **cincuenta y tres**»*), o sea son registro histórico y no afirmación viva. **El único valor vivo
   del archivo es 53 y es correcto** (37 + 16, con las 16 filas contadas por mí). **La copia falsa
   está afuera, en tres documentos**, que es exactamente la tesis del `F-8fC1-004`. `C2` tiene razón
   en el hallazgo; el archivo dueño no tiene la culpa.
5. **Intenté mostrar que el `hasta` de cuatro valores y los nueve estados del contrato caducaron con
   `S24` y `S25`.** No caducaron: las dos transiciones nuevas **no agregan estados** —`S24` sale de
   `GRACE_PERIOD` y `S25` de `PAUSED`, las dos a `CANCELLED`— y la tabla del §2.6 tiene diez filas
   para nueve estados **porque `PAUSED` se parte en dos por motivo**, que el § declara. **Los dos
   conteos se sostienen.**
6. **Intenté mostrar que la regla de vigilancia del §4.2 mis-dispara sobre los consumidores del
   hecho.** No lo pude sostener: su texto dice *«un quinto lugar … **y no es este hecho**»*, así que
   un consumidor más del mismo hecho no la dispara por más que sean seis y no cuatro. **Lo reporto en
   `F-8fC1-002` acotado a lo que sí es falso** —que el documento da dos censos del mismo hecho, y que
   la mitad inversa dice seis contra siete— y dejo dicho en el propio hallazgo que la mitad hacia
   adelante no engaña a un lector estricto. Es la mitad de mi propio `F-8eC1-003` que **no** se
   sostiene, y corregirla hacia abajo es parte del encargo.
7. **Intenté mostrar que la matriz caducó contra los conteos del corpus.** `contar-filas-de-la-matriz.py`
   da **89 filas — 50/13/20/6**, que es exactamente lo que las instrucciones declaran. **Exacto**, y
   es el único artefacto del programa que recalcula su propio conteo con un script.
8. **Intenté encontrar una segunda contradicción de severidad entre informes**, del tipo del §3.3.
   Recorrí las 86 entradas con severidad buscando dos informes que califiquen distinto el mismo
   camino. **No hay ninguna**: las únicas dos convergencias con severidad distinta —`F-8fA2-006`
   (`MEDIA`) contra `F-8fB2-003` (`ALTA`) sobre `S13`/`S17`— se explican porque `A2` lo reporta como
   conteo y `B2` como dato perdido, y **las dos calificaciones son defendibles sobre la misma cita**.
   La dejo como **`ALTA`**, que es la más alta de las dos, por el criterio que el programa usa desde
   la 8-bis-2. Es un cero medido: **la vuelta pasada hubo una contradicción de severidad y ésta no
   tiene.**
9. **Intenté hacer de `F-8fC1-001` un hallazgo de doce sitios y el diseño me tiró OCHO abajo.** Mi
   primer censo contaba doce enumeraciones del conjunto *«caminos por los que la predecesora se muere
   sola»* con cinco cardinales. Al abrirlas una por una, **ocho no son afirmaciones sobre el conjunto
   entero**: `B/02` §2.2 está acotada por escrito a la tabla de las siete transiciones, `B/12` §3 es
   un ordinal, `B/03` L208 dice algo verdadero sobre `S22`/`S23`, `B/03` L936 y `B/05` L258 son
   enumeraciones parciales dentro de un argumento sobre otra cosa, `B/09` §3 es **la cita de un
   argumento que el propio párrafo declara caído**, y `NUCLEO/04` §3 está acotada a `D15`. **Y dos
   rastros defienden explícitamente dos de esos acotamientos, con el argumento correcto**
   (`rastro-f21d5d828.md` §3 sobre `B/02` §2.2 y L440 sobre `D15`; `rastro-032f761e0.md` L153 sobre
   los ordinales, con la frase *«Si alguna se hubiera escrito como «el último» o «de seis», sería
   falsa»*). **El hallazgo quedó en cinco sitios y dos falsos**, que es un tercio de lo que empecé
   escribiendo. Lo dejo asentado porque es exactamente el **modo A** que el §4.4 diagnostica en los
   demás —contar apariciones de un término en vez de afirmaciones sobre un conjunto— y no tengo
   ninguna razón para creer que yo esté exento.
10. **Intenté mostrar que los siete informes se contradicen sobre si el rastro existe y cubre.** No:
   los siete lo dan por existente, los siete lo citan con archivo y línea, y **los siete coinciden en
   que las tres secciones de auto-corrección (`12cc0879f` §5, `ce52dce5f` §6, `8d6b27a12` §5) declaran
   correcciones que están efectivamente hechas** — `B3` verificó las de su terreno y dio cero, `C2`
   verificó seis de once y dio cero, `A1` verificó una y dio cero. **Crucé los tres resultados y no
   se pisan.** La auto-corrección documentada del programa es real; lo que no alcanza es su alcance.

---

## 7. Líneas de rastro que ataqué

**Ataqué 9 líneas de aparición y las 9 resistieron, más 23 verificaciones cruzadas.** No hice una
muestra dirigida propia porque los siete ya revisaron entre 517 y 887 de las 1.030 (§4.3) y mi
encargo es consolidar: una octava muestra habría agregado ruido al numerador sin mover el
denominador. **Las nueve que sí ataqué salieron todas del sujeto de `F-8fC1-001`**, y son el
contraejemplo útil de la pasada: **son las que me obligaron a tirar ocho doceavos de mi propio
hallazgo** (§6, ataque 9).

| línea de rastro | qué afirma | veredicto |
|---|---|---|
| `f21d5d828` §3, `B/02` **L83-91 · §2.2** | *««se muere sola —`S12`, `S16` o el espejo, **tres de las siete transiciones que `B/03` §3.2 recorre**»» → sigue correcta, **y la cláusula que la salva es la que ella misma escribe**»* | **verdadera, y la justificación es la mejor forma que leí**: nombra el acotamiento que la salva en vez de afirmar de más, y **enumera los seis sitios que deliberadamente NO tocó por la misma razón** (`B/05` §3, `B/09` §3, `B/16` §4.2 y §4.3, `12-contrato…` §2.6, `B/20` §2). Verificado contra el texto |
| `f21d5d828` §3, `NUCLEO/04` **L161-184 · §3, `D15`** | *«`S18` corre además … por `S12` o por `S16` … y `S22` tampoco está entre las seis» → **sigue correcta**: su sujeto es el destino de un pago pendiente por `S19`»* | **verdadera.** Intenté falsearla con el cardinal del conjunto y no se puede: la cita no afirma un cardinal del conjunto, afirma cuáles escriben las columnas de `D15`. **Es la que me sacó `NUCLEO/04` de la lista de sitios falsos** |
| `032f761e0` §3, `B/03` **L1611-1632 · §10.1** | las tres cifras del recuadro del espejo *«son **ordinales que identifican al espejo**, no totales … Si alguna se hubiera escrito como «el último» o «de seis», sería falsa»* | **verdadera**, y lo verifiqué en las tres. **Y declara su propia condición de falsedad**, que es lo que la vuelve falsable de verdad. Es la misma que `B2` señaló como la mejor del corpus, verificada por segunda vez y por otro camino |
| `f21d5d828` §3, `NUCLEO/04` **L247-283 · §5** | *«las cuatro de base, las cinco de guard y las diez de servicio» → sigue correcta y lo verifiqué»* | **verdadera**: conté las 16 filas del §3 y el reparto cierra (4 base, 6 guard, 10 servicio, 20 apoyos sobre 16). **La cifra de guards del rastro dice cinco y hoy son seis** — pero el propio §5 lo corrigió en su nota de `D16`, así que la línea describe el estado que su commit vio |
| `8d6b27a12` §3, `B/14` **L229-241, L258-264, L331-340** (3) | las tres justifican enunciados de `B/14` §4.3 y §4.4 como *«enunciado de SU caso»* | **las tres verdaderas**, verificadas contra el texto. **Y las tres juntas son la evidencia de `F-8fC1-001`**: son todo lo que ese rastro tiene sobre `B/14`, y la L135 que su propio commit volvió falsa no está entre ellas |
| `8d6b27a12` §3, `B/03` **L437** | *«`S10` es la única salida de `PAUSED` **que devuelve el servicio**» → el calificativo ya estaba y cubre a `S25`»* | **verdadera**, verificada por tercera vez (`A2` y `B2` llegaron a lo mismo por caminos distintos) |
| `f21d5d828` §4, fila *«`B/03` §3.2, prosa del candado `A`»* | declara corregida *«se muere sola —por `S12`, `S16` o el espejo—»* a *«son **cinco** desde `S22` y `S23`»* | **verdadera y ejecutada**: `B/03` L233 hoy dice seis (`S24` lo agregó `0f7b1e17d` después). **Es el contraejemplo de la fila 13 de `8d6b27a12` §4**: una fila de §4 que declaró una corrección y la corrección está hecha |

**Lo que estas nueve dicen juntas, y es el resultado que no esperaba:** las líneas de rastro **mejor
escritas del corpus son las que declaran su propio acotamiento o su propia condición de falsedad** —
*«la cláusula que la salva es la que ella misma escribe»*, *«si alguna se hubiera escrito como «el
último», sería falsa»*—. **Ésa es la forma opuesta al modo A y al modo B del §4.4**, y ya está
escrita, por el mismo equipo, en el mismo artefacto. La Corrección E no hay que inventarla: hay que
generalizar lo que tres líneas de dos rastros ya hacen.

**Y las 23 verificaciones cruzadas: tomé afirmaciones que los otros siete hacen SOBRE el rastro y las
verifiqué contra el rastro y contra el capítulo.**

| qué verifiqué | de quién | resultado |
|---|---|---|
| que las 16 líneas declaradas falsas existen donde dicen y dicen lo que citan | los siete | **16 de 16 existen.** Ninguna es una cita inventada |
| que `rastro-8d6b27a12.md` §4 fila 13 dice lo que `A2`, `B1` y `B2` le atribuyen, y que sus ítems siguen sin corregir | `A2`, `B1`, `B2` | **cierto**: `B/03` L1265 y L1581 siguen diciendo *«sigue contando tres»* y L1642-43 *«tres entradas»*, contra una tabla de `NUCLEO/03` de cuatro filas que conté |
| que las tres líneas de `G-R4` que `B2` fecha (17:33, 17:55, 18:29) son anteriores a `8d6b27a12` (20:17) | `B2` | **cierto**, verificado con `git log -1 --format=%ct` sobre los diez shas |
| que la detección de caducidad que `B3` propone funciona | `B3` | **NO funciona**: `git log -S` sobre las dos citas devuelve cero y las dos son falsas (§4.4). Es la refutación más útil que pude hacer de una propuesta ajena |
| que `C2` contó bien las 23 líneas de rastro sobre el contrato y que ninguna es un conteo | `C2` | **cierto en las dos mitades**, y es la evidencia de `F-8fC1-002` |
| que los 1.030 suman | las instrucciones | **cierto**: 187+268+118+108+91+69+65+58+45+21 = 1.030 |
| que los 76 commits y su rango son los declarados | las instrucciones | **cierto**: `5ac5e92c9` (2026-09-21 16:35) → `90e4b326f` (2026-09-22 21:03) |
| que las fechas de `2805d72ea` y `4f34afa1a` que `C2` usa para datar el `CRITICA` #8 son exactas | `C2` | **cierto**: 09-18 21:34 y 09-19 14:22 |

**Y dos discrepancias de conteo internas a los informes, que anoto porque afectan el numerador de la
medición del §4.3 y ningún lector las vería:**

1. **`A1` declara *«2 falsas»* y su tabla marca TRES filas `FALSA`** —`V/10` L120, `11-particion`
   L127/L132 y `B/10` L218-221—. Su desglose (*«2 falsas, 1 verdadera angosta, 2 que presuponen»*)
   suma cinco ítems sobre cinco filas y **deja la tercera sin clasificar**. Conté las tres como
   falsas, que es lo que su tabla dice.
2. **`A2` declara *«una resultó falsa, una resultó incompleta, y 61 se sostuvieron»* sobre 63, y su
   subsección *«La que resultó INCOMPLETA»* lista DOS.** 1 + 2 + 61 = 64. Tomé el encabezado (63
   revisadas, 1 falsa) y conté las dos incompletas aparte, que es lo que no infla el numerador.

**Lo que NO verifiqué, declarado**: no reabrí las 871 líneas que los siete declararon sostenidas.
**Si alguien quiere saber cuántas falsas hay entre ésas, hay que mirarlas** — y las tres coberturas
más finas (`rastro-40b922120.md`, con ~5 de 45 revisadas; `rastro-12cc0879f.md`, con 6 de 21;
`rastro-7676082e6.md`, con 12 de 58) son por donde empezaría, porque el §2.3 de las instrucciones
dice que ahí la probabilidad de una justificación floja es más alta y **son exactamente las tres que
menos se miraron.**

---

## 8. Fuera de mi vector

- **La sonda 49 del 24/09** decide la mitad de `DEC-MP-003` y **también** decide si `RC-5` es un
  crítico o dos: `B/09` §4 y la ventana de reintentos leen el mismo objeto. Quien la corra debería
  tener `F-8fB3-001` delante.
- **Las 33 preguntas abiertas que `C2` contó en once documentos**, contra los dos registros que
  declaran cero, son un problema de gobierno y no de diseño. Lo digo acá porque **cuatro de los diez
  rastros tienen un § de preguntas para el owner** y ninguna está en un registro: si una de esas
  preguntas es en realidad un defecto, esta pasada no lo pudo saber.
- **El capítulo 13 tiene hoy dos hallazgos fechados esperándolo** (§3.3). Es la única deuda del
  programa con una severidad futura escrita, y conviene que el 13 arranque por ahí.

---

## Key Learnings

1. **El rastro por aparición hizo lo que prometía y eso alcanzó para cambiar la pregunta.** Con 1.030
   afirmaciones falsables, ocho informes pudieron exhibir 16 líneas falsas con archivo y línea. Con
   una cifra en un mensaje de commit, ninguna de las 16 era señalable. **Una regla que produce un
   artefacto legible compra más que una regla que produce una obligación.**
2. **El agujero de un método se mueve, y hay que volver a medirlo cada vuelta en vez de heredar el
   diagnóstico.** La vuelta pasada la exclusión de la prosa nueva explicaba 5 de 9 escapes; ésta
   explica 2 de 6, y el mayoritario pasó a ser la **calidad** de la resolución (4 de 6). **Mi propia
   recomendación de hace una vuelta quedó corregida por la medición: la corrección que yo puse
   primera compra la mitad que la que ni siquiera había enunciado.**
3. **La firma del modo de fallo mayoritario es sintáctica y por eso es corregible barato**: tres de
   las cuatro resoluciones malas empiezan con *«lo que cambió es…»*. Nombrar el cambio y descartarlo
   en la misma frase es la forma de contestar una pregunta más angosta que la cita.
4. **Una propuesta de detección hay que correrla antes de recomendarla.** `git log -S'<la cita>'`
   devolvió cero sobre las dos caducidades que probé, porque **la caducidad no cambia la cita: cambia
   lo que la hace verdadera**, que vive en otro archivo. Lo que funciona es buscar por el archivo del
   OBJETO, no por el texto de la cita.
5. **Deduplicar por raíz compartida es deduplicar de más.** Una sola ambigüedad —el predicado del
   hecho 2— se bifurca en un `CRITICA` por una rama y en el `ALTA` más reportado por la otra, y
   cerrar la raíz no cierra ninguna de las dos. Agregué la cláusula al criterio **antes** de aplicarlo.
6. **Una misma corrección para dos daños distintos son dos defectos.** Es la mitad del criterio que
   más trabajo hizo esta vuelta: *«toda salida de `PAUSED` escribe `fin_real`»* cierra a la vez el
   cobro de meses no usados y el bloqueo de la segunda pausa, y son dos defectos sobre dos poblaciones.
7. **El que consolida tiene un desempate que los vectores no tienen: el documento compartido.** Ni
   `A2` ni `A3` abrieron el contrato de cobertura, que es el dueño del campo sobre el que los dos
   discutían — y ahí estaban las dos líneas que deciden, una de ellas con su garantía acotada al acto
   reversible (*«jamás un archivado»*) justo donde el defecto es el irreversible.
8. **El alcance de una obligación es una decisión con costo, y conviene medirlo en vez de suponerlo.**
   Excluir el decision log del corpus hace el rastro barato y deja la **razón escrita de una decisión
   tomada** sin ningún mecanismo que la mire. Son dos instancias y las dos están en el mismo archivo:
   poco, pero ahora es un número y no un argumento.
9. **Un censo vale más que una instancia cuando lo que se discute es una regla.** Medir los 25
   conteos congelados (14 falsos, y 12 de los 14 fuera del documento dueño) convirtió una corrección
   de veinticinco filas en una de doce y mostró que la disciplina que faltaba **ya existe y funciona
   hasta el borde del archivo que la tiene escrita**.
10. **Los conteos de los propios informes hay que recontarlos igual que los del corpus.** Dos de los
    siete declaran en su encabezado un número distinto del que su propia tabla marca, y el total de
    hallazgos del encargo (86) mezcla hallazgos nuevos con reejecuciones de vueltas anteriores, que la
    serie no contaba. **La serie comparable es 76, no 86.**
11. **El que diagnostica un modo de fallo es el primer candidato a cometerlo, y hay que ir a
    buscarlo.** Escribí el modo A —contar apariciones de un término en vez de afirmaciones sobre un
    conjunto— y después descubrí que mi propio `F-8fC1-001` estaba construido así: de doce sitios,
    **ocho eran prosa acotada, ordinales o la cita de un argumento ya refutado**, y dos rastros
    defendían por escrito dos de esos acotamientos con el argumento correcto. Quedó en cinco sitios y
    dos falsos. **La diferencia entre un hallazgo y un conteo de `rg` es abrir los doce.**
12. **Un artefacto nuevo se audita mirando también lo que salió BIEN, no sólo lo falso.** Las tres
    líneas de rastro mejor escritas del corpus declaran su propio acotamiento o su propia condición de
    falsedad, y son la forma exacta que la corrección propuesta pediría. **La regla que hay que
    escribir ya está ejecutada en tres lugares; encontrarla costó nueve ataques que fallaron.**
