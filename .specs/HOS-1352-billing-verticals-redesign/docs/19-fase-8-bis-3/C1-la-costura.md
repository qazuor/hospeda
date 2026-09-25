---
title: "FASE 8-bis-3 · C1 — la costura: capítulos partidos, el contrato, los invariantes"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# FASE 8-bis-3 · C1 — la costura

Cuarta pasada `C1`, corrida **después de los siete informes**, que esta vez existían todos cuando
empecé. Vector: lo que se rompe **entre** documentos — los capítulos que el desarme partió, el
contrato de frontera, el núcleo y los invariantes. **El núcleo es mío**, y adopto los defectos que
los otros siete marcaron `NUCLEO`.

**Diez hallazgos: 0 `CRITICA`, 3 `ALTA`, 5 `MEDIA`, 2 `BAJA`.**

Más las tres secciones del encargo: **la deduplicación de los críticos** (§2), **las
contradicciones entre informes con su veredicto** (§3) y **el veredicto de método sobre
`DEC-METH-009`** (§4).

Abreviaturas como en los demás: `NUCLEO` es `HOS-1352-…/docs/nucleo/`, `V` es
`HOS-1353-…/docs/`, `B` es `HOS-1354-…/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

**Lo que medí yo, y cómo.** Todos los conteos de este informe salen de recorrer el artefacto
citado sobre el worktree `/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign` el
2026-09-21, nunca sobre `/home/qazuor/projects/WEBS/hospeda2/`:

| qué conté | con qué | resultado |
|---|---|---|
| hallazgos `### F-8d` en los siete informes | `rg -c "^### F-8d"` | **75** — A1 10 · A2 11 · A3 14 · B1 7 · B2 13 · B3 11 · C2 9 |
| IDs con `**Severidad.** \`CRITICA\`` | `rg -c '^\*\*Severidad\.\*\*`CRITICA`'` | **18** — A1 1 · A2 2 · A3 1 · B1 3 · B2 5 · B3 5 · C2 1 |
| tablas de transiciones del corpus | `rg -n '^\| *# *\| *desde *\| *evento'` | **7** — 3 en `V/03` (§2, §9, §11), 4 en `B/03` (§3.2, §6, §7, §8) |
| guards en `V/20` §2 · en `B/20` §2 | a mano sobre las dos tablas | **14** · **9** — 22 distintos, `G-R4` en las dos |
| filas de `NUCLEO/08` §3 | a mano | **12** filas, **17** actos |
| filas de `NUCLEO/04` §3 · apoyos | a mano, clasificando la columna | **15** filas · base 4, guard 5, servicio 10 = **19** |
| decisiones del log | `rg -c "^### DEC-"` menos la plantilla | **67** |
| archivos que toca cada uno de los 8 commits | `git show --name-only` | ver §4.2 |
| apariciones residuales de tres términos grepeados | `rg` sobre los capítulos no tocados | ver §4.3 |

**Ningún número de este informe viene de otro informe.** Donde uso uno ajeno lo digo, lo vuelvo a
contar, y si no da lo digo también (§3.5).

---

## 1. Los hallazgos

### ALTA

### F-8dC1-001 — `NUCLEO/01` §2.4 enumera «los cinco predicados de billing» que usan «fila viva» y hoy son seis: el sexto lo creó el commit que editó ese párrafo, y la mitad que no copió es la raíz de dos `CRITICA` — `NUCLEO`

**Qué se rompe.** El §2.4 es el arreglo estrella de la tanda: parte *«vivo»* en dos términos y
cierra con **la lista de los consumidores** de uno de ellos. Esa lista es lo único del corpus que
convierte *«fila viva»* de un término en un **inventario verificable** — es, literalmente, la
forma que `B3` propone al final de su informe para cerrar el modo de falla que `DEC-METH-009` no
cubre, y ya existe. Quedó corta **en el mismo commit que creó el sexto predicado**, y el sexto es
`S19`, que escribió el término **sin la palabra «viva»**. Con la lista completa, el defecto se ve
poniendo un predicado debajo del otro; con la lista corta, `S19` no es un consumidor de nada.

**El camino.**

1. La lista, textual: *«**Y «fila viva» es el término que nombran, ya sin la palabra suelta, los
   cinco predicados de billing que la necesitan**: el alcance de `S13`, el de `S17` y la condición
   de cierre de `S18` —los tres en cap. 03 (épica de billing) §3.2—, la definición de addon
   huérfano de cap. 16 (épica de billing) §4.2, y la **condición 3 del pago tardío** de cap. 05
   (épica de billing) §3»* (`NUCLEO/01` §2.4). Los conté: **cinco**.
2. **El sexto existe y está en el mismo capítulo que tres de los cinco.** `B/03` §3.2, `S19`,
   columna condición: *«la fila **tiene una sucesora con `sucede_a` apuntándola**»*. Es la misma
   pregunta que la segunda mitad del huérfano de `B/16` §4.2 —*«y **no hay una fila viva** con
   `sucede_a` apuntándola»*— **sin el adjetivo**.
3. **Y el §2.4 declara por qué el adjetivo decide.** `B/16` §4.2 le dedica un párrafo entero:
   *«**La fila viva es parte del predicado, no un adorno**… si la sucesora abandona el checkout
   (`S3` → `ABANDONED`), deja de ser fila viva y el addon pasa a huérfano sin que nadie declare
   nada»*. El mismo hecho del mundo, leído por `S19`, contesta lo contrario.
4. **El archivo lo tocó el commit que creó `S19`.** `99e9d4e24` toca `nucleo/01-glosario.md` — lo
   verifiqué con `git show --name-only` — y agregó ahí el §2.4 en su forma vigente. La lista se
   escribió el mismo día que el predicado que no entró en ella.
5. **Y no es un defecto de registro: la lista es el control.** `NUCLEO/00` fija que *«el núcleo es
   el único lugar donde algo se define»*; la regla 2 del propio §2.4 manda *«en la columna
   condición de una tabla de transiciones … va **«fila viva»**, nunca la palabra sola»*. `S19` no
   usa la palabra sola: usa **otra frase** que dice lo mismo sin el adjetivo, que es el caso que
   la regla no contempla.

**Dónde lo permite el diseño.** `NUCLEO/01` §2.4 (la lista de cinco y las dos reglas de uso);
`B/03` §3.2 (`S19`, `S5`, `S6`, `S7`); `B/16` §4.2 (*«la fila viva es parte del predicado»*);
`B/20` §2 (`G-R1-D`, que repite la definición sin el adjetivo); `NUCLEO/00`.

**Severidad.** `ALTA` — por sí sola es una lista corta. Sus consecuencias ya están contadas como
`CRITICA` por `B1` y `B2` sobre el mismo defecto (§2.1, defecto **#5**) y no las cuento de nuevo.
La reporto en este nivel porque **es lo único del racimo que se arregla en un solo lugar y en un
renglón**, y ese lugar es el núcleo: agregada la sexta fila, la comparación entre los dos
predicados es mecánica.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 12** (`99e9d4e24`, `S19` y sus
condiciones), sobre el §2.4 que el arreglo 2 había escrito dos commits antes. La lista era exacta
el día que se escribió.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No, y es el caso que más enseña sobre el
alcance de la regla.** El término redefinido por el arreglo 12 es `S19` / *«pendiente de
resolución»*, y `NUCLEO/01` **es un archivo que el commit toca**, así que la búsqueda *«sobre los
capítulos que el commit NO toca»* lo excluye por construcción. La búsqueda que lo encuentra es la
inversa y ya está escrita en el corpus: **grepear el término del NÚCLEO —`fila viva`— y preguntar
si el predicado que se acaba de escribir está en su lista**. Lo propongo en §4.5.

---

### F-8dC1-002 — El censo de consumidores de `cubierto` tiene tres y hoy son seis; el §1.1 sigue diciendo «cuatro lugares», y la regla de vigilancia del §4.2 lleva DOS vueltas sin correrse sobre sus propios disparadores

**Qué se rompe.** El contrato trae el único detector declarado del modo de falla que domina este
programa —*«si aparece un quinto lugar que necesita algo de billing y no es este hecho, es señal
de que el corte se está filtrando»*—, y funciona comparando contra dos censos: el §1.1 (*«el mismo
hecho, en cuatro lugares»*) y la fila `cubierto` del §2.1 (*«`PB2`; el §6 del capítulo 15; el
reconciliador»*). **La tanda de la 9-bis-2 le agregó dos consumidores más a `cubierto` y ninguno
entró en el censo**, que ya venía corto de la vuelta anterior. El detector no falla: **queda
apagado por un censo congelado, por segunda vuelta consecutiva**, y eso es exactamente lo que hace
que cuatro informes de esta pasada encuentren por separado lo que la regla habría señalado de una
vez.

**El camino.**

1. La regla, textual: `12-contrato…` §4.2 — *«**Regla de vigilancia**: si aparece un quinto lugar
   que necesita algo de billing **y no es este hecho**, es señal de que el corte se está
   filtrando. **Se mira, no se resuelve en el lugar.**»*
2. El censo de `cubierto`, textual, sin cambios: `12-contrato…` §2.1, fila `cubierto`, columna
   *«quién lo necesita»* — *«`PB2`; el §6 del capítulo 15; el reconciliador»*. **Tres.**
3. **Los consumidores reales de `cubierto`, contados por mí sobre el texto de hoy:**

   | # | quién | qué lee | ¿está en el censo? | cuándo entró |
   |---|---|---|---|---|
   | 1 | `PB2` (`V/03` §9) | *«`cubierto` pasa a falso»* | **sí** | — |
   | 2 | el §6 del cap. 15 | *«su plan comercial está `SUSPENDED`»* | **sí** | — |
   | 3 | el reconciliador (`V/15` §4.2) | el disparador del recálculo | **sí** | — |
   | 4 | `PB3` (`V/03` §9) | *«`cubierto` pasa a **verdadero**»* | **no** | arreglo 9 (9-bis) — es `F-8cC1-004`, **sigue** |
   | 5 | **`T1`** (`V/03` §2) | *«y `cubierto` es **falso**»*, en la columna condición | **no** | **arreglo 2 de esta tanda** |
   | 6 | **`T6`** (`V/03` §2) | *«y `cubierto` es **verdadero**»*, ídem | **no** | **arreglo 2 de esta tanda** |

4. **Y los dos nuevos no son consumidores de lectura: son guardas de una máquina de estados**, o
   sea el uso más fuerte que el dato puede tener. `NUCLEO/03` §1 regla 7 y `G-R4` apoyan la
   disyunción del par `T1`/`T6` **enteramente** en el valor de ese booleano: *«difieren en el valor
   de **un booleano**, `cubierto`»* (`V/03` §2). El contrato no sabe que su campo decide una
   transición.
5. **El §1.1 tampoco los cuenta, y su propia precisión muestra que alguien lo releyó sin
   recontarlo.** El § mantiene la tabla de cuatro y le agregó una nota —*«desde que existen las
   tres clases de fuente (§2.4), **el paso 5 ya no pregunta por `cubierto`**… Los otros tres
   renglones siguen leyendo `cubierto` sin cambio alguno»*—: se corrigió **qué** lee uno de los
   cuatro y no **cuántos** son.
6. **Y la mitad inversa de la regla se disparó otra vez en esta tanda y tampoco se corrió.**
   `F-8dA3-003` mide que el arreglo 4 obliga a billing a leer `plan.vertical`, que no es ninguno de
   los siete campos del §4.1. Conté los disparadores de esta vuelta: **`T1`, `T6` y `plan.vertical`
   = tres**, contra los cuatro que conté en la vuelta anterior (`F-8cC1-003`). En dos vueltas, la
   regla acumula **siete disparadores y cero ejecuciones**.
7. Y su cuantificador sigue roto: el §4.2 dice *«no está en **los seis** campos del §4.1»* y el
   §4.1 dice *«Son **siete campos** en tres preguntas»*. Es `F-8cA3-014` y lo verifiqué hoy sobre
   las dos líneas.

**Dónde lo permite el diseño.** `12-contrato…` §1.1 (la tabla de cuatro y su nota), §2.1 (la fila
`cubierto`), §4.1 y §4.2; `V/03` §2 (`T1`, `T6`) y §9 (`PB2`, `PB3`); `NUCLEO/03` §1 regla 7;
`V/20` §2 (`G-R4`).

**Severidad.** `ALTA` — no abre acceso ni mueve plata por sí solo: deja de señalar a los que sí.
Es el mismo nivel que le puse en la vuelta anterior y no lo subo, pero el argumento cambió: allá
el censo estaba corto; acá **está corto después de una vuelta entera en la que tres informes
señalaron la misma causa**, y los dos consumidores nuevos son guardas de transición, no lectores.
El detector que el programa tiene para su modo de falla dominante está apagado y nadie lo prende
porque el número que lo apaga está escrito en el documento que se declara dueño de la frontera.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 2** para las dos filas nuevas (`T1` y
`T6` sobre `cubierto`), sobre un censo que ya estaba corto desde el arreglo 9 de la 9-bis
(`F-8cC1-004`, que **sigue llegando entero**: el contrato nombra `PB3` cero veces, lo verifiqué).

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí, y limpiamente.** El término que el
arreglo 2 redefine es **`cubierto`**, y `49eb99f34` **toca el contrato** — pero toca el §2.6 y el
§4, no el §2.1 ni el §1.1. La obligación 2 manda buscar sobre *«los capítulos que el commit NO
toca»* y ésta es la aparición que el alcance deja justo en el borde: **el capítulo está tocado y
el párrafo no**. Un `rg -n "cubierto" 12-contrato-de-cobertura.md` devuelve la fila del §2.1 en la
primera pantalla, y resolver esa aparición contra el significado nuevo es preguntarse si la lista
de tres sigue siendo la lista. Es el caso que obliga a decir **si la unidad de la regla es el
archivo o el párrafo** (§4.5, corrección 1).

---

### F-8dC1-003 — `D15` afirma que «toda sucesión que termina deja escrito que ocurrió» y tres de las cuatro formas de terminar no escriben nada; su apoyo de base hace cumplir la mitad que no es esa afirmación — `NUCLEO`

**Qué se rompe.** El invariante que la tanda agregó para que la sucesión dejara evidencia durable
afirma más de lo que el diseño cumple, y la diferencia no es de redacción: **es el sujeto de dos
`CRITICA` de esta pasada**. Un invariante sobre-enunciado es peor que uno ausente, porque quien lo
lee deja de buscar el caso — y acá el caso es *«la sucesora se murió y nadie limpió el puntero»*,
que es el defecto #5 del §2.1.

**El camino.**

1. El enunciado, textual: `NUCLEO/04` §3, `D15` — *«Una sucesión es un compromiso, no dos: a lo
   sumo una sucesora viva por `user + vertical`, y una sucesora no puede ser sucedida. **Y toda
   sucesión que termina deja escrito que ocurrió**: la predecesora queda con `sucedida_por`
   puesta»*.
2. **La única escritura de `sucedida_por` es `S18`, y exige la sucesora `ACTIVE`.** `B/02` §2.2 lo
   declara con un solo dueño —*«La escribe `S1`, **la limpia `S18`**»*— y `S18` tiene `desde: la
   **sucesora**, en`ACTIVE`` (`B/03` §3.2). Lo verifiqué grepeando las dos columnas sobre los
   trece capítulos de billing, los siete del núcleo y el contrato: **la única línea que escribe
   `sucedida_por` es la fila `S18`**.
3. **Las cuatro formas de terminar están enumeradas y tres no pasan por `S18`.** `B/12` §5.3:
   *«El dominio es el de las formas en que una sucesión en curso puede terminar, y **son
   cuatro**»* — `S2`+`S17`+`S18`; `S3` (la sucesora vence su ventana); la trabada; y `S13`. **Sólo
   la primera escribe `sucedida_por`.**
4. **Y el propio corpus declara la excepción para una de las tres, sin llevarla al invariante.**
   `B/03` §3.2, `S13`: *«la sucesión **no se cierra: se cancela**… la sucesora queda `CANCELLED`
   **con su `sucede_a` escrito**, que es el registro fiel de lo que pasó»*. Para la de `S3` no hay
   ni siquiera eso.
5. **El apoyo de base no sostiene la afirmación que el invariante agrega.** La celda dice
   *«**base**: los dos índices parciales, partidos por `sucede_a`, más la columna `sucedida_por`…
   **Guard**: `G-R1-C`»*. Los dos índices hacen cumplir *«a lo sumo una sucesora viva»* —la
   primera mitad—; **ninguno hace cumplir que la columna se escriba**. Y `G-R1-C` vigila que las
   dos escrituras de `S18` vayan juntas: *«un camino escribe `sucedida_por` sin limpiar `sucede_a`,
   o limpia `sucede_a` sin escribir `sucedida_por`»* (`B/20` §2). **Cuando no ocurre ninguna de las
   dos, el guard se cumple de forma vacua**, que es exactamente el estado que `D15` declara
   imposible.
6. **Y la afirmación es la que apaga la búsqueda.** El §1 del propio capítulo define el nivel
   *«base»* como *«no admite ningún camino que lo esquive»*; `D15` está contado ahí y tiene tres
   caminos declarados que lo esquivan.

**Dónde lo permite el diseño.** `NUCLEO/04` §1 (la definición de *«base»*), §3 (`D15`) y §5 (el
reparto); `B/02` §2.2; `B/03` §3.2 (`S18`, `S13`, `S3`); `B/12` §5.3 (las cuatro ramas);
`B/20` §2 (`G-R1-C`).

**Severidad.** `ALTA`. El daño de plata ya está contado dos veces como `CRITICA` (defecto **#5**)
y no lo cuento de nuevo. Sube desde la `MEDIA` con que reporté su gemelo en la vuelta anterior
(`F-8cC1-013`) por una razón concreta: allá `D15` era un enunciado nuevo sin consumidores; acá el
corpus ya tiene **cinco predicados apoyados en la misma columna** y el invariante es lo que los
autoriza a suponer que está escrita. No es `CRITICA` porque el texto no mueve plata: lo que hace
es impedir que alguien la busque.

**Marcá `NUCLEO`** — `D15` vive en `NUCLEO/04` §3. `B1` lo levantó en su sección `NUCLEO` sin ID
propio; le doy uno acá, que es lo que corresponde para que se pueda cerrar.

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 10** (`3692d5deb`), que creó la columna
y el invariante en el mismo acto. La primera mitad de `D15` es de la 9-bis; la frase *«Y toda
sucesión que termina deja escrito que ocurrió»* es de esta tanda y nació falsa para tres de las
cuatro ramas que otro commit de la misma tanda enumeró once días después… en el mismo día.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es
`sucedida_por`, y `3692d5deb` **toca `NUCLEO/04`**: la aparición está adentro del commit. Y la
enumeración de las cuatro ramas que la vuelve falsa la escribió **otro** commit (`99e9d4e24`,
`B/12` §5.3) **después**, así que el día del grep la contradicción todavía no existía. Es el
quinto modo que `DEC-METH-009` declara no cubrir —una premisa propia y verdadera que envejece—
con un plazo de dos commits en vez de dos semanas.

---

### MEDIA

### F-8dC1-004 — Cuatro conjuntos distintos, tres escritos con el mismo número: por qué «las cinco» y «las seis» aparecen contradiciéndose en cuatro informes sin que ninguno se equivoque

**Qué se rompe.** El corpus tiene **cuatro** conjuntos de transiciones que se nombran con un
cardinal y se escriben en cuatro documentos, y **tres de los cuatro se escriben «seis»**. Ninguno
declara cuál es su conjunto en la misma oración que su número, así que cada consumidor cita el que
tiene más cerca. El resultado medido en esta pasada: **cuatro informes levantan cuatro veces «la
sexta que falta» sobre tres conjuntos distintos**, y dirimir cuál tiene razón exige recorrer dos
tablas — que es lo que hice en §3.1.

**El camino.** Los cuatro, con su definición textual y su cardinalidad contada por mí:

| # | conjunto | dónde | qué dice | lo conté |
|---|---|---|---|---|
| 1 | transiciones **de `B/03` §3.2** que sacan a una fila principal de las filas vivas | `B/16` §4.3 · `B/03` §8 (`A5`) | *«**las cinco** que en `B/03` §3.2 sacan a una fila principal de las filas vivas: `S3`, `S12`, `S13`, `S16` y `S17`»* | **5** — correcto |
| 2 | transiciones que **mueven a la predecesora** durante la ventana de 72 h | `B/03` §3.2 · `B/20` §2 (`G-R1-A`) · `12-contrato…` §2.6 | *«**seis** las transiciones de esta misma tabla que la sacan de ahí sin que nadie declare nada»* — `S8`, `S9`, `S6`, `S12`, `S13`, `S16` | **6** — correcto, y **sólo tres de las seis** salen de las filas vivas |
| 3 | **puertas a un estado terminal** de una fila principal | `B/09` §3 (la exención) | enumera **cuatro**: `S3`, `S12`, `S17`, `CHARGE_DECLINED` | **6** con el espejo del §10.1 — `F-8dB3-001` |
| 4 | **el conjunto 1 en el corpus entero**, incluyendo el espejo que `B/03` §10.1 declara *«una transición declarada de esta tabla»* | no está escrito en ningún lado | — | **6** — `F-8dA2-003`, `F-8dB2-007` |

1. **El 1 y el 4 son el mismo conjunto con dos alcances**, y esa es toda la disputa: `B/16` §4.3
   cuantifica *«las cinco que **en `B/03` §3.2**…»*, con el alcance escrito, y `B/03` §10.1 declara
   que hay una transición de esa tabla que **no está en la tabla** —*«**Espejar un estado leído por
   id es una transición declarada de esta tabla, no un acto aparte**»*— y que el remedio de su
   octava fila es una frase y no un `S`.
2. **El 2 se confunde con el 1 porque comparte tres miembros y el número del 4.** `12-contrato…`
   §2.6 y `B/20` §2 lo citan los dos como *«las seis»*, y el §2.6 remata *«**no emite en cinco de
   los seis casos**»*: en dos páginas del mismo § conviven un «seis» y un «cinco» que **no son los
   conjuntos 1 ni 4**.
3. **El 3 se escribió como una garantía enumerada y le faltan dos**, y las dos que le faltan son
   miembros de conjuntos distintos: `S13` (del 1) y el espejo (del 4). Es `F-8dB3-001`.
4. **Y hay un quinto sujeto que no es una transición y cae en el 3**: la lápida (`C2-006`), que
   ninguna tabla produce.

**Dónde lo permite el diseño.** `B/16` §4.3; `B/03` §3.2 (la tabla de seis y su párrafo), §8
(`A5`) y §10.1; `B/09` §3; `B/20` §2 (`G-R1-A`); `12-contrato…` §2.6; `B/21` §2.5.

**Severidad.** `MEDIA`. No mueve plata por sí solo y los daños de cada conjunto ya están
adjudicados. Lo reporto porque **es lo que vuelve indistinguible un conteo correcto de uno roto**,
y esta pasada lo pagó: cuatro informes gastaron un hallazgo cada uno en la misma vecindad, y la
única forma de saber si se contradicen fue recontar las dos tablas. Un conjunto que se nombra con
un cardinal y no con su definición no se puede auditar, que es justamente para lo que `B/16` §4.3
dice que su lista existe (*«para poder auditar que ninguna se olvidó»*).

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 14 sobre texto de los arreglos 8 y 18.**
El conjunto 2 lo escribió el arreglo 8 para justificar el `desde` de `S17`; el 3 lo escribió la
familia de `CHARGE_DECLINED`; el **1 es del arreglo 14** y es el primero que se declara **lista
cerrada para auditar**. Hasta ese día no había ningún conteo que otro pudiera falsear.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No, y es un modo que ninguno de los siete
nombra.** El término redefinido por el 14 es *«deja de ser fila viva»*, y los cuatro conjuntos
**no comparten ningún término**: se escriben con un cardinal y con una lista de símbolos (`S3`,
`S12`, …). Un grep por término no encuentra una colisión entre cuatro cardinalidades, y un grep
por `S12` devuelve las cuatro sin decir cuál es cuál. **Lo que hace falta acá no es una búsqueda:
es que cada conjunto lleve su definición en la misma oración que su número** — que es exactamente
lo que `B/16` §4.3 hace bien y los otros tres no.

---

### F-8dC1-005 — El dominio de `G-R4` está declarado en CINCO sitios con tres números, el núcleo escribe los dos incompatibles en el mismo §, y ninguno es el que conté — `NUCLEO`

**Qué se rompe.** `G-R4` es **el único guard del núcleo**, y la regla 7 le delega explícitamente el
número que ella misma no afirma: *«**Que sean tres y no cuatro no es una afirmación de este
capítulo: es lo que `G-R4` cuenta en cada PR**»*. Un guard al que se le delega un conteo tiene que
saber sobre qué conjunto contar, y su alcance está escrito en cinco lugares con **tres cardinales
distintos**, dos de ellos en el mismo párrafo del núcleo.

**El camino.**

1. **Los cinco sitios, citados y contados por mí:**

   | # | dónde | qué dice |
   |---|---|---|
   | 1 | `NUCLEO/03` §1 regla 7 | *«`G-R4`, sobre **las tablas de transiciones de las nueve máquinas**, en las dos épicas»* |
   | 2 | `NUCLEO/03` §1 regla 7, **doce líneas más abajo** | *«no depende de que alguien vuelva a recorrer **las nueve tablas** a mano»* |
   | 3 | `V/03` §2 | *«Lo cuenta `G-R4` sobre **las nueve tablas**, no una lectura a mano»* |
   | 4 | `V/20` §2, fila `G-R4` | *«sobre **las nueve máquinas**, en las dos épicas»* — y su párrafo: *«para que **las seis tablas de billing** no queden vigiladas…»* |
   | 5 | `B/20` §2, fila `G-R4` | *«lo define `V/20` §2 y cubre **las seis** tablas de esta épica»* |

2. **Máquinas y tablas no son lo mismo, y el propio núcleo lo declara.** `NUCLEO/03` §1 regla 6:
   *«**Grace y Pause no son máquinas independientes**… Son sub-estados de Suscripción»*, y `B/03`
   §4 y §5 las describen con tablas de dos columnas, sin `desde` ni `evento`. **Nueve máquinas,
   siete tablas.**
3. **Conté los encabezados yo, el 2026-09-21**, con
   `rg -n '^\| *# *\| *desde *\| *evento'` sobre las dos épicas y el núcleo: **siete** — `V/03`
   §2, §9 y §11; `B/03` §3.2, §6, §7 y §8. **Cuatro en billing, no seis.**
4. **Y el «seis» de billing está escrito de los dos lados.** El sitio 4 es de `V/20`, o sea que el
   número equivocado del dominio de billing vive también en el capítulo que el corpus designa como
   **la definición** del guard. `B/20` §2 remite a ese capítulo (*«Referencia cruzada: lo define
   `V/20` §2»*), así que las dos mitades del catálogo apuntan al mismo número roto.
5. **El sitio 2 es el que lo vuelve un defecto del núcleo y no de las épicas**: los dos cardinales
   incompatibles —*«las tablas de transiciones de las nueve máquinas»* y *«las nueve tablas»*—
   están **en el mismo § del mismo archivo**, a doce líneas, y el segundo es el que las dos épicas
   copiaron.
6. Y el guard no tiene quién lo construya: `F-8dC2-003` mide que `G-R4` es uno de los once sin
   unidad, *«y es el que peor tolera no tener dueño»* porque cruza la frontera.

**Dónde lo permite el diseño.** `NUCLEO/03` §1 reglas 6 y 7; `V/03` §2; `V/20` §2 (la fila y su
párrafo); `B/20` §2; `B/03` §4 y §5.

**Severidad.** `MEDIA`. No hay plata ni acceso en juego: las cuatro tablas de billing son las
cuatro que existen, así que un guard que las recorra todas no deja nada afuera. Lo que queda mal
es **el único número que la regla 7 no verifica y delega**, escrito mal en los cinco sitios y de
tres formas distintas, sobre el único guard del núcleo. `A2` y `B2` lo levantaron desde sus épicas
contando tres sitios; los dos lo mandaron a la pasada C porque *«el enunciado de la regla y el
alcance del guard son `NUCLEO`*». Lo adopto con ID propio y con los **cinco** sitios.

**Marcá `NUCLEO`.**

**¿Es nuevo, o es el arreglo?** **Lo introdujo el arreglo 3**, que creó `G-R4` y la regla 7 en el
mismo acto y propagó el alcance a los cinco sitios en tres redacciones. Antes de la 9-bis-2 no
había ningún guard que necesitara conocer el número.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **Sí, y es el reproche más barato de la
pasada.** El término nuevo es literalmente **`G-R4`**: un `rg 'G-R4'` sobre el corpus devuelve los
cinco sitios en una corrida, y los cinco se escribieron en la misma tanda. Lo que faltó es la
obligación 3 —*«cada aparición se resuelve»*— aplicada a apariciones **que el propio arreglo
creó**: se escribieron cinco y no se compararon entre sí. La regla, tal como está, manda resolver
las apariciones **viejas** y no dice nada de las que el arreglo siembra.

---

### F-8dC1-006 — `NUCLEO/00` cuantifica en 54 decisiones la segunda de las tres fuentes admitidas del programa, y hoy son 67: el commit que declara haber corrido `DEC-METH-009` editó ese bloque y no recontó nada — `NUCLEO`

**Qué se rompe.** `NUCLEO/00` no es un índice decorativo: es el documento que declara **de dónde
puede salir una afirmación** de esta fase, y enumera tres fuentes. La segunda lleva su cardinal
adentro de la oración, y el cardinal tiene trece decisiones de atraso. En el mismo párrafo
conviven dos conteos congelados y **el archivo lo editó la tanda**, seis líneas más abajo.

**El camino.**

1. La regla de fuentes, textual: `NUCLEO/00`, *«De dónde sale cada afirmación»* — *«Las tres
   fuentes admitidas son las del programa (`01-decision-log.md`, regla 4): 1. **el PDR**… 2. **una
   decisión registrada** en `01-decision-log.md` — son **54** al 2026-09-19, recontadas con
   `rg -c "^### DEC-"` menos la plantilla del formato… 3. **una medición fechada**»*.
2. **Conté las decisiones hoy**: `rg -c "^### DEC-" 01-decision-log.md` da **68**, menos la
   plantilla `### DEC-<AREA>-<NNN>` de la línea 26 = **67**. Es el mismo número que el resumen del
   propio log declara (*«Decisiones tomadas | **67**»*) y el que el commit `50c3e2196` reporta
   (*«Decisiones: 65 a 67»*).
3. **El segundo conteo congelado del mismo archivo sigue igual**: *«**51 invariantes** numerados de
   corrido»* y *«| `04` | invariantes | **los 51** |»*, contra las *«Cincuenta y dos»* de
   `NUCLEO/04` §5. Es `F-8cC1-014` y **sigue entero**.
4. **Y el archivo lo tocó la tanda, en la tabla que está a seis líneas del segundo conteo.**
   `49eb99f34` edita `nucleo/00-indice.md` —lo verifiqué con `git show`— y le cambia exactamente
   dos celdas: la fila `01` (*«los dos sentidos de «vivo»»*) y la fila `03` (*«las **siete** reglas
   de lectura»*, que antes decía seis). **La misma tabla, dos filas más abajo, sigue diciendo «los
   51»**, y el mismo commit declara en su mensaje *«110 apariciones de «vivo/viva» inspeccionadas,
   9 corregidas y 101 declaradas correctas»*.
5. La regla que esto incumple la escribió el propio núcleo: `NUCLEO/04` §5 — *«**Los conteos se
   recorren enteros con un script, o no se tocan.**»*

**Dónde lo permite el diseño.** `NUCLEO/00` (*«De dónde sale cada afirmación»*, punto 2; *«Las tres
partes»*, dos líneas); `NUCLEO/04` §5; `01-decision-log.md`, el resumen.

**Severidad.** `MEDIA`. Ninguna decisión se toma leyendo ese número y nadie lo ejecuta. Sube de
`BAJA` —que es donde puse su gemelo en la vuelta anterior— por dos cosas medibles: **el atraso se
duplicó en una vuelta** (de un invariante a trece decisiones) y **el archivo estuvo abierto en la
mano del commit que declara haber barrido el corpus entero por un término**. Un índice que
cuantifica las fuentes admitidas del programa y que se edita sin recontar es la forma más chica
del defecto que esta fase entera mide.

**Marcá `NUCLEO`.**

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 2** (`49eb99f34`) para la mitad nueva —abrió el
archivo, corrigió dos celdas y dejó las dos cifras—. El desfasaje del «51» viene de la 9-bis
(`F-8cC1-014`) y **sigue llegando**; el del «54» creció con las trece decisiones que el programa
tomó desde el 2026-09-19, seis de ellas en esta misma tanda.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No, y por el mismo borde que
`F-8dC1-002`.** El término redefinido por el arreglo 2 es *«vivo»*, y el §2.4 que lo define lleva
el archivo **adentro** del commit; la aparición que había que resolver no contiene *«vivo»* ni
ningún otro término redefinido: es un **número**. La regla busca términos y este defecto es un
cardinal, que es la clase que `A2`, `A3`, `B2` y yo levantamos cinco veces en esta pasada
(`F-8dA2-009`, `F-8dA2-010`, `F-8dA3-009`, `F-8dB2-012`, `F-8dC1-005`).

---

### F-8dC1-007 — La regla 7 delega su número en un guard que no lo puede contar: seis de las diecinueve celdas `desde` de `B/03` §3.2 no contienen un estado — `NUCLEO`

**Qué se rompe.** `NUCLEO/03` §1 regla 7 es la única defensa contra que el desenlace de una
transición dependa del orden en que una implementación recorra una tabla, y **renuncia
explícitamente a afirmar su propio número** para delegarlo en `G-R4`. El predicado de `G-R4` está
definido sobre el par `(desde, evento)`; **la columna `desde` de la tabla más grande del programa
no está tipada**, y según qué lea el guard ahí el conteo da tres o cuatro. La regla congela el
número que el guard devuelva, así que el valor de la única defensa depende de una decisión de
implementación que ningún capítulo toma.

**El camino.**

1. La delegación, textual: `NUCLEO/03` §1 regla 7 — *«**Que sean tres y no cuatro no es una
   afirmación de este capítulo: es lo que `G-R4` cuenta en cada PR**, y por eso la regla no depende
   de que alguien vuelva a recorrer las nueve tablas a mano»*.
2. El predicado, textual: `V/20` §2 — *«una tabla de transiciones tiene **dos filas con el mismo
   `(desde, evento)`** cuyas guardas **no son disjuntas**»*.
3. **Recorrí las diecinueve filas de `B/03` §3.2 y conté las celdas `desde` que no son un estado:
   seis.** `S13` (*«toda fila viva del beneficiario en cada vertical que el grant ancla»*), `S14` y
   `S15` (*«cualquiera»*), `S17` (*«la **predecesora**, si sigue siendo fila viva — las cinco
   alcanzables: `ACTIVE`, `GRACE_PERIOD`, `CANCEL_SCHEDULED`, `PAUSED`, `SUSPENDED`»*), `S18`
   (*«la **sucesora**, en `ACTIVE`»*) y `S19` (*«la **predecesora** de una sucesión en curso, en
   `GRACE_PERIOD` o `SUSPENDED`»*). **Cuatro de las seis mezclan un ROL con uno o más estados en
   la misma celda.**
4. **Y el par que eso vuelve ambiguo es real.** `S17` y `S18` comparten el estado `ACTIVE` en su
   `desde` y **el mismo hecho del mundo** en su evento —*«su sucesora quedó autorizada»* y *«la
   misma autorización que disparó `S2`»*—, con destinos distintos. Lo que las separa —predecesora
   contra sucesora— está **adentro de la celda `desde`**, no en la columna condición. Es
   `F-8dB2-006`, y su mitad de épica es de `B2`.
5. **Las dos lecturas posibles rompen algo y ninguna está elegida.** Si `G-R4` lee el estado, el
   par es un cuarto y el guard **se pone en rojo sobre el camino normal de todo cambio de plan**,
   que es lo que `B/20` §2 declara que hace que un guard se relaje. Si lee el rol, el guard tiene
   que entender la sucesión, que es afirmar más de lo que un predicado sintáctico verifica —lo que
   `V/20` §2.1 prohíbe con esas palabras.
6. **Y la regla no puede arbitrar, porque renunció a hacerlo en la oración anterior.** Es la
   consecuencia de delegar un conteo en un mecanismo cuyo dominio el mismo capítulo no define
   (`F-8dC1-005`).

**Dónde lo permite el diseño.** `NUCLEO/03` §1 regla 7 y su tabla de tres; `B/03` §3.2 (las
diecinueve filas); `V/20` §2 (la definición de `G-R4`) y §2.1; `B/20` §2.

**Severidad.** `MEDIA`. Los tres pares declarados **son** disjuntos y el cuarto también —`B/02`
§2.2 impide que una fila tenga `sucede_a` y `sucedida_por` a la vez, y el candado `B` impide que
una sucesora sea sucedida—, así que hoy no hay plata ni acceso en juego. Lo roto es el instrumento
que garantiza que el quinto par lo sea, sobre una tabla que la tanda hizo crecer de dieciséis
filas a diecinueve.

**Marcá `NUCLEO`** — el enunciado de la regla y la delegación son de `NUCLEO/03` §1. `B2` levantó
la mitad de épica (la columna `desde`) y mandó el enunciado acá; le doy ID propio.

**¿Es nuevo, o es el arreglo?** **Lo introdujeron los arreglos 3 y 8 juntos.** El 3 escribió la
regla 7 y su delegación; el 8 partió `S17` de `S18` y creó el par que la delegación no puede
contar — el mismo día, y sin que ninguno de los dos mire la columna del otro.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es
`(desde, evento)` / *«los tres pares»*, y sus apariciones están en `NUCLEO/03`, `V/03` §2 y
`B/20` §2 — los tres tocados por la misma tanda. Y lo que hay que ver no es una aparición: es que
**una celda de una tabla repite un estado que otra fila ya usa con el mismo hecho**. Eso se
descubre recorriendo la tabla, que es la obligación 1 de `DEC-METH-008` y no la 2 de la 009.

---

### F-8dC1-008 — El catálogo de acciones administrativas tiene la acción «reembolsar» y no tiene el acto que le pone el caso adelante a la persona: `DEC-RF-002` apoyó en esa tabla el desenlace de un camino que declara normal — `NUCLEO`

**Qué se rompe.** El cierre de la tanda escribió en `NUCLEO/08` §3 la frase que cierra el dominio
—*«**No hay ninguna operación automática sobre dinero**»*— y con eso convirtió el reembolso del
pago pendiente en **un acto humano sobre un camino normal**. El catálogo tiene la acción que esa
persona ejecuta; **no tiene ninguna fila para el acto que le pone el caso delante**, y ninguna
transición lo escribe (defecto **#4** del §2.1). El resultado es un catálogo que declara completo
el reparto de permisos, auditoría y confirmación sobre una lista a la que le falta el eslabón del
que depende el único desenlace nuevo que la tanda le agregó.

**El camino.**

1. La fila, textual, reescrita por `1c972a07b`: `NUCLEO/08` §3 — *«| **reembolsar** | `DEC-RF-001`
   · `DEC-RF-002` | **sí**, **sin excepción**: `DEC-RF-002` resolvió el único caso que el diseño
   tenía candidato a excepción —el reembolso del pago pendiente al cerrar una sucesión— **a favor
   de la confirmación**. No hay ninguna operación automática sobre dinero |»*.
2. **Lo que le pone el caso adelante es «poner la marca», y eso no es una de las doce.** `B/12`
   §5.3, rama 1: *«al cerrar la sucesión **se pone la marca** y el caso entra al canal de
   conciliación»*. Recorrí las doce filas de `NUCLEO/08` §3: la única que nombra la marca es
   ***«levantar** la marca `requiere_conciliación`»* —el acto **inverso**—, y ponerla es un efecto
   de `S14`, cuyo evento es *«divergencia que toca plata o estado»*, que `S19` declara por escrito
   que este caso **no** es.
3. **Y el canal que la recibe está definido por un mecanismo que esta fila no alcanza.** `NUCLEO/08`
   §4.1 fija el *«listado accionable en Admin»* como canal primario y §4.3 enumera qué lleva cada
   entrada —*«cuál de las cuatro condiciones del cap. 05 §3 falló, cuando el caso es un pago
   tardío»*—: la lista de campos contempla el pago tardío que **falla**, no el que se resuelve bien
   y deja un reembolso por confirmar.
4. **El capítulo que construye el panel no existe como unidad de trabajo.** `F-8dC2-002` lo mide:
   `nucleo/04`, `07`, `08` y `01` no son de ninguna de las 22 unidades, y **`NUCLEO/08` es donde
   viven las doce acciones**. Así que la acción `reembolsar` tiene permiso declarado, auditoría
   declarada y confirmación declarada, y **ningún constructor**.
5. **Y el reloj que impediría que el caso quede abierto para siempre no alcanza a la fila.**
   `B/09` §3 declara *«**La marca lleva reloj.** Si sigue puesta pasado su plazo, **escala**»*
   dentro del § del barrido, y el barrido no recorre las terminales de una suscripción — la
   predecesora está `CANCELLED` por `S17`. Es `F-8cB1-011`, que `B1` re-reporta subida a `ALTA`.

**Dónde lo permite el diseño.** `NUCLEO/08` §3 (las doce filas y sus tres exigencias), §3.1, §4.1
y §4.3; `B/12` §5.3 (la rama 1); `B/03` §3.2 (`S14`, `S19`); `B/09` §3; `01-decision-log.md`,
`DEC-RF-002`.

**Severidad.** `MEDIA`. El daño de plata está contado como `CRITICA` en el defecto **#4** y **no lo
cuento de nuevo**: los cuatro IDs de ese defecto atacan *«quién dispara»*. Lo que agrego es que
**el catálogo que declara el reparto administrativo no tiene la fila**, así que aunque alguien
escriba la transición que pone la marca, el acto de resolverla no tiene permiso propio ni
confirmación — y el catálogo se declara cerrado en cinco lugares (`V/17` §3.2 ×2, §3.3, §3.4,
`B/19` §6, contados por `A3`, verificados por mí). `A2` lo dejó en su §4 *«fuera de mi vector,
pasada C»* sin ID; le doy uno.

**Marcá `NUCLEO`.**

**¿Es nuevo, o es el arreglo?** **Lo introdujo el cierre** (`1c972a07b` aplicando `DEC-RF-002`).
La fila `reembolsar` es anterior y era suficiente cuando el reembolso era un acto que alguien
pedía; desde que es **el desenlace de un camino que el sistema alcanza solo**, hace falta la
mitad que lo enruta, y esa mitad no se escribió en ningún lado.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es
*«reembolso»* / *«reembolsar»*, y `1c972a07b` **toca `NUCLEO/08`**: la aparición está adentro del
commit. Y lo que hay que ver es **una fila que falta**, que es el modo que `B3` mide como el
dominante entre sus críticos (cuatro de cinco) y que ninguna búsqueda de texto devuelve.

---

### BAJA

### F-8dC1-009 — `V/03` §2 razona sobre «los diez estados de la suscripción» y el glosario enumera nueve: el décimo sigue sin nombre y ahora tiene un consumidor más

**Qué se rompe.** La máquina de suscripción tiene un estado inicial que el `NUCLEO/03` regla 2
declara **un estado** —*«es un estado porque tiene reglas declaradas y una salida declarada, no
porque tenga fila»*— y que `NUCLEO/01` §2.2 no nombra. Con el arreglo 2, un capítulo **de la otra
épica** pasó a razonar sobre el conjunto entero y eligió el cardinal que el diccionario no da.

**El camino.**

1. `V/03` §2, texto nuevo del arreglo 2: *«**Consecuencia declarada**… De los **diez** estados de
   la suscripción, los que **no emiten fuente** (`12-contrato…` §2.6) dan `cubierto` falso… Para
   cuatro —`ABANDONED`, `CANCELLED`, `CHARGE_DECLINED` y **no tener fila ninguna**— es trivialmente
   lo correcto»*. El décimo es *«no tener fila ninguna»*, y el párrafo lo trata como un estado.
2. `NUCLEO/01` §2.2 enumera **nueve** para Suscripción, y `(sin fila)` no está — lo conté sobre la
   celda. La máquina de trial sí tiene el suyo nombrado (`PRE_TRIAL`) y el mismo § lo defiende con
   el argumento de la regla 2.
3. `B/03` §3.1 se titula *«Los **nueve** estados»* sobre una tabla de **diez** filas, la décima
   `(sin fila)`, y cierra *«así que **siguen siendo nueve**»*.
4. `12-contrato…` §2.6 titula su tabla *«los **nueve**, sin huecos»* y tiene **diez** filas — conté
   `PENDING_AUTHORIZATION`, `ABANDONED`, `ACTIVE`, `GRACE_PERIOD`, `PAUSED` × 2, `SUSPENDED`,
   `CANCEL_SCHEDULED`, `CANCELLED`, `CHARGE_DECLINED`: son diez filas para nueve estados, porque
   `PAUSED` se parte por motivo. **Es un décimo distinto del de `B/03`**, y los dos documentos
   usan «nueve» y «diez» sin decir cuál.

**Dónde lo permite el diseño.** `V/03` §2; `NUCLEO/01` §2.2; `NUCLEO/03` §1 regla 2; `B/03` §3.1;
`12-contrato…` §2.6.

**Severidad.** `BAJA` — el razonamiento de `V/03` §2 es correcto con cualquiera de las dos
lecturas y no decide nada. Lo reporto porque es `F-8cC1-009` **ganando un consumidor en la otra
épica**: el estado sin nombre pasó de ser un renglón de una tabla de billing a ser parte del
dominio sobre el que una decisión de producto (`DEC-TRIAL-008`) argumenta su costo, y porque el
«diez» de `B/03` y el «diez» de `12-contrato…` **no son el mismo décimo**.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 2**, que escribió el párrafo de la consecuencia
declarada. La mitad del glosario es preexistente (`F-8cC1-009`) y **sigue**.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No.** El término redefinido es `cubierto`, y
`49eb99f34` **toca `V/03`**: es el archivo donde se escribió la frase. No hay aparición externa que
resolver; lo que hay es un cardinal nuevo que contradice al glosario, y el glosario lo tocó el
mismo commit.

---

### F-8dC1-010 — El resumen del decision log declara «7 apartamientos del PDR» y los enumera, y el commit que lo recontó agregó el octavo en su propio título

**Qué se rompe.** El log es el único registro de en qué se aparta este programa de su PDR, y la
regla que lo obliga está en su primera página: *«Si una decisión se aparta del PDR, el PDR **no se
edita** (§3.1): se registra acá el apartamiento y por qué»*. El resumen los cuenta y los enumera
uno por uno. **`DEC-GRANT-006` es un apartamiento declarado y no está en la enumeración**, y el
mismo commit que lo escribió recontó las otras dos cifras del mismo resumen.

**El camino.**

1. El resumen, textual: *«| Apartamientos declarados del PDR | **7** — `DEC-ENT-001` (§10.3),
   `DEC-GRANT-002` (§34) y `DEC-ARCH-003` (§10.6…), `DEC-OBS-001` (§22.1…), `DEC-METH-004` (§65…),
   `DEC-SUB-011` (§11 y §64.8…) y `DEC-METH-006` (§65…) |»*. Los conté: **siete enumerados**.
2. **El octavo lo dice el título de su propia decisión**: *«### `DEC-GRANT-006` — La cortesía es
   POR SUSCRIPCIÓN: se retira su `scope`, y **el §34 del PDR queda desviado a propósito**»*. Y el
   mensaje del commit lo repite: *«el §34 del PDR queda desviado a propósito porque los dos
   instrumentos no son equivalentes»*.
3. **El mismo commit recontó dos de las tres cifras del mismo resumen.** `50c3e2196`, textual:
   *«Decisiones: 65 a 67, funcionales 56 a 58, **recontadas con rg**»*. Verifiqué las dos: el
   resumen dice 67 y 58, y **conté 67** yo mismo. La tercera cifra del mismo bloque no se movió.
4. Y el conteo se usa: `NUCLEO/08` §4.2 se numera contra él (*«es el **cuarto** apartamiento del
   programa»*), igual que `NUCLEO/01` §2.1 (*«Es el **tercer** apartamiento»*). Los dos eran
   correctos cuando se escribieron; con el octavo sin numerar, el próximo no sabe qué ordinal
   tomar.

**Dónde lo permite el diseño.** `01-decision-log.md`, la regla de apertura y la fila
*«Apartamientos declarados del PDR»* del resumen; `DEC-GRANT-006`; `NUCLEO/08` §4.2;
`NUCLEO/01` §2.1.

**Severidad.** `BAJA` — no cambia ninguna resolución y el apartamiento **está declarado** donde
tiene que estar, que es lo que la regla exige. Lo que falta es el renglón del inventario. Lo
reporto porque el inventario de apartamientos es lo único que permite contestar *«¿en qué nos
apartamos del PDR?»* una vez en vez de recorriendo 67 decisiones, que es la misma función que
`V/20` §2 declara para su catálogo de guards.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: `DEC-GRANT-006`** (`50c3e2196`), en el mismo acto
en que recontó las otras dos cifras del mismo bloque.

**¿Lo habría encontrado el grep de `DEC-METH-009`?** **No, y el sujeto está fuera de su alcance por
declaración.** La obligación 2 manda buscar *«sobre los capítulos… las dos épicas y el núcleo»*, y
el decision log **no es un capítulo de ninguna de las tres partes**. Es la misma exclusión que
`F-8dC2-009` mide para el corte, la partición y los cuatro documentos de implementación, con un
documento más.

---

## 2. La deduplicación de los críticos — el encargo

> **Esta vez los siete informes existían cuando conté.** La corrección de la vuelta anterior
> —*«una deduplicación corrida antes de que existan todos los informes deduplica lo que alcanzó a
> leer»*— es la razón por la que `C1` corrió después de `C2`, y el conteo de abajo incluye a `C2`
> desde el primer recorrido.

**Los 18 IDs `CRITICA` de los siete informes son 14 defectos críticos distintos.** Ninguno de mis
diez hallazgos es `CRITICA`, así que el conteo de la pasada es **18 IDs sobre 14 defectos**.

El punto de partida lo conté yo con `rg -c '^\*\*Severidad\.\*\* \`CRITICA\`'`: A1 1 · A2 2 ·
A3 1 · B1 3 · B2 5 · B3 5 · C2 1 = **18**, que coincide con el recuento del orquestador.

### 2.1 El mapa: qué ID colapsa en cuál

**El criterio de colapso, declarado antes de aplicarlo**, porque es lo que decide el número: **dos
IDs son el mismo defecto si el daño es el mismo evento sobre la misma persona Y una sola
corrección lo elimina.** Un mismo daño con dos correcciones distintas son dos defectos; una misma
corrección para dos daños distintos también.

| # | defecto crítico distinto | IDs que lo reportan | otros IDs del mismo defecto | arreglo |
|---|---|---|---|---|
| **1** | **`T2`/`T6` queman el trial único de por vida ante una fuente `GRANT`, y el grant se revoca**: la persona queda sin grant, sin suscripción y sin el trial que nunca usó, sin transición de vuelta ni reparación | `F-8dA1-001` | `F-8dC2-008` (`MEDIA`, la mitad del corte) | 2 |
| **2** | **El tercer renglón del dominio de `T1`/`T6` le regala el trial completo a toda la cohorte de ex-clientes el día que la vertical enciende los días** | `F-8dA2-002` | `F-8dA2-011` (`BAJA`) | 2 + 3 |
| **3** | **Anclarle una vertical nueva a un grant vivo no dispara `S13`**: el evento sigue siendo el otorgamiento, y el beneficiario paga todos los meses lo que le acaban de regalar | `F-8dA3-001` | `F-8dA1-005`, `F-8dA3-002` (`ALTA`, el permiso del acto) | 4 + 9 |
| **4** | **El reembolso de la rama 1 no lo dispara nadie**: `S18` no declara la marca entre sus efectos y el barrido del cap. 09 no alcanza a la predecesora `CANCELLED` | `F-8dA2-001`, `F-8dB2-003`, `F-8dB3-003` | `F-8cB1-011` (`ALTA`, el reloj), `F-8dC2-004` (`ALTA`, quién lo construye), `F-8dB2-013` (`BAJA`), `F-8dC1-008` (`MEDIA`, el catálogo) | 13 + el cierre |
| **5** | **Nadie limpia `sucede_a` cuando la sucesora muere, y cuatro de los cinco predicados que lo leen no exigen «viva»**: la fila queda congelada para siempre — sin reactivar, sin suspender y con el pago retenido | `F-8dB1-001`, `F-8dB2-001` | `F-8dB2-011` (`MEDIA`, la tabla de tres), `F-8dB1-007` (`MEDIA`), `F-8dC1-001` y `F-8dC1-003` (mis dos `ALTA` del núcleo) | 12 sobre 10 |
| **6** | **El candado `A` queda vacío mientras la sucesora espera y el diseño manda al cliente a dar un alta nueva**: dos autorizaciones cobrando, y `S18` no puede volver a ejecutarse porque la base rechaza su escritura | `F-8dB1-002`, `F-8dB3-002` | `F-8dB2-008` (`ALTA`, la frase que bloquea `S18`) | 8 + el cierre |
| **7** | **La promo no está entre los tres efectos de `S18`**: el cliente que mejora su plan pierde en silencio los cobros con descuento que le quedaban | `F-8dB1-003` | `F-8cB2-010` (`ALTA`, la cortesía, **mismo hueco y otra entidad**) | 10 |
| **8** | **`S13` alcanza también las suscripciones de complemento y ninguna regla mueve la instancia del addon**: se pierden los addons pagados, o quedan encendidos sin que nadie los pague | `F-8dB2-002` | — | 9 × 14 |
| **9** | **`S19` sólo admite «la cuota que sigue en `recycling`», así que el pago manual que `MP1` le deriva no matchea**: el reloj del grace corre igual y suspende a quien pagó | `F-8dB2-004` | **`F-8dA2-005` (`ALTA`, el mismo defecto — ver §3.4)**, `F-8dB1-005` (`ALTA`, el residuo del reembolso) | 12 |
| **10** | **Un addon que autoriza DESPUÉS de que su título murió nace `ACTIVE` con su preapproval cobrando**: `A5` sale sólo de `ACTIVE` y la re-evaluación no tiene evento | `F-8dB2-005` | — | 14 |
| **11** | **La exención de terminales del cap. 09 no nombra a `S13` y su garantía es falsa para `S3`**: un preapproval que nuestra llamada no canceló sale del barrido | `F-8dB3-001` | `F-8dC2-006` (`ALTA`, la séptima puerta), `F-8dB3-011` (`BAJA`) | 9 × la familia de `CHARGE_DECLINED` |
| **12** | **`S13` no declara idempotencia ni deja detector**: su ejecución parcial deja al beneficiario pagando en una vertical, con el barrido viendo coincidencia | `F-8dB3-004` | — | 9 |
| **13** | **La re-evaluación del huérfano corre sobre la fila equivocada**: los complementos que cuelgan de la predecesora muerta no los mira nadie cuando la sucesora abandona | `F-8dB3-005` | `F-8dB3-006` (`ALTA`, el sujeto de «su fila terminal») | 10 × 14 |
| **14** | **Los dos `spec.md` publican una firma del contrato con tres campos de cinco**: sin `objetivo` el pliegue por ficha no existe y un addon de una ficha habilita la cartera | `F-8dC2-001` | `F-8dA1-010` (`BAJA`, el vocabulario de `alcance`) | ninguno: nace en la FASE 9 y la tanda **ensancha** la brecha |

### 2.2 Los tres racimos que el encargo anticipó, verificados uno por uno

**El encargo nombró tres. Dos colapsan y el tercero no, y la diferencia es medible.**

1. **«Nadie limpia `sucede_a` cuando la sucesora muere» — `B1` y `B2`: COLAPSAN (defecto #5).**
   Los dos IDs describen el mismo puntero eterno y los mismos cuatro predicados sin el adjetivo, y
   difieren sólo en qué consecuencia persiguen: `B1` va al pago retenido, `B2` al `GRACE_PERIOD`
   sin reloj. **Una sola corrección elimina las dos**: agregar *«viva»* a los cuatro predicados, o
   darle a `sucede_a` un limpiador para la muerte de la sucesora. `B2` lo dice explícitamente al
   separar su propio `F-8dB2-011`: *«aquélla se arregla agregando «viva» a cuatro predicados, ésta
   agregando una fila a una tabla»*. Los dos daños salen del mismo renglón.

2. **«El reembolso de la rama 1 no lo dispara nadie» — `A2`, `B2` y `B3`: COLAPSAN (defecto #4).
   `B1` NO lo levanta como crítico.** El encargo dice que lo levantaron cuatro; lo verifiqué
   contra los cuatro informes: los tres `CRITICA` son `F-8dA2-001`, `F-8dB2-003` y `F-8dB3-003`,
   y lo que `B1` aporta es **otra cosa** —`F-8dB1-005` (`ALTA`) es el reembolso de un **pago
   manual**, que no tiene entidad donde asentarse, y `F-8cB1-011` (`ALTA`) es el reloj de la marca
   sobre una fila terminal—. Los tres críticos citan las mismas tres líneas (`B/12` §5.3 rama 1,
   los tres efectos de `S18`, y el sujeto del barrido de `B/09` §3) y **una sola escritura los
   cierra**: declarar la marca entre los efectos de `S18`, o devolver la predecesora `CANCELLED`
   con pago pendiente al barrido. **Tres IDs, un defecto.**

3. **«`S13` no es idempotente / no arrastra lo que debería» — `A3`, `B2` y `B3`: NO colapsan. Son
   CUATRO defectos distintos** (#3, #8, #11, #12), y conviene decir por qué, porque es el racimo
   que más se parece a uno y no lo es. Los cuatro caen sobre la misma fila de la tabla y **el daño
   final es el mismo en tres de ellos** —el beneficiario de *Free Forever* paga una suscripción que
   el §35.3 ordena cancelar—, pero **las cuatro correcciones son disjuntas y ninguna cierra a
   otra**:

   | # | qué falla en `S13` | qué hay que escribir para cerrarlo | ¿lo cierra alguna de las otras? |
   |---|---|---|---|
   | 3 | el **evento** no cubre el acto de anclar una vertical a un grant que ya existe | una transición para el acto nuevo, o un segundo evento en `S13` | no: las otras tres suponen que `S13` disparó |
   | 8 | el **`desde`** alcanza también las suscripciones de complemento | acotar el dominio a la principal, o declarar qué pasa con la instancia del addon | no: es la única que habla de addons |
   | 11 | la **rama de fallo** no existe (`S17` la tiene, `S13` no) y la exención del barrido no la nombra | la condición de relectura de `S17` en `S13`, y `S13` en la enumeración de `B/09` §3 | no: #12 es una ejecución parcial exitosa, no una llamada fallida |
   | 12 | la **ejecución parcial** sobre N verticales × 6 estados no declara idempotencia ni reanudación | *«proceso idempotente»* como en `S12`, más la comprobación de cero llamadas | no: #11 es una llamada que falló, ésta es una corrida que se cortó |

   **Lo que sí comparten los tres primeros es el detector, y eso vale decirlo porque cambia el
   costo del arreglo**: una sola comprobación de cero llamadas —*«un beneficiario con un ancla en
   la vertical V no debería tener una fila viva en V»*, que es la que `B3` §4 propone— **detecta
   el desenlace de #3, #11 y #12**, aunque no cierre ninguno. Cuatro defectos, cuatro escrituras,
   un detector.

### 2.3 Tres decisiones de agrupamiento más, declaradas porque cambian el número

1. **#5 y #6 no se fusionan, aunque los dos terminan en «la sucesión no se puede cerrar».** #5 es
   el puntero que nadie limpia cuando muere la **sucesora**; #6 es el candado que queda vacío
   cuando muere la **predecesora** y alguien entra en el hueco. **Las correcciones son opuestas**:
   #5 se cierra agregando *«viva»* a los predicados que leen el puntero; #6 se cierra haciendo que
   la sucesora ocupe un candado, o que el alta nueva no pueda entrar mientras haya una sucesión
   declarada. Arreglar #5 deja #6 entero: con *«viva»* en los predicados, la fila muerta sigue sin
   ocupar `A` y el alta nueva sigue entrando.
2. **#9 absorbe a `F-8dA2-005`, que es el mismo defecto con severidad menor.** `A2` lo clasifica
   `ALTA` y `B2` `CRITICA` sobre la misma fila de la misma tabla; el veredicto está en §3.4 y es
   `CRITICA`. Cuenta **una vez**.
3. **#14 no colapsa con nada, y es el único que no nace de esta tanda.** `C2` lo mide con
   `git log -S`: la divergencia entra en `4f34afa1a` (FASE 9) y los dos `spec.md` no se tocan desde
   `12b521126`. Lo que la tanda hizo fue **ensanchar la brecha**: los arreglos 4 y 6 redefinieron
   qué `referencia` transporta un `GRANT` y un `ADDON`, sobre un campo que las copias ni nombran.
   Lo cuento como crítico distinto porque el daño que produce hoy —un addon de ficha habilitando la
   cartera— no lo produce ningún otro de los trece.

### 2.4 La proporción, y un `CRITICA` de la vuelta anterior que sigue abierto

| | 8-bis | 8-bis-2 | **8-bis-3** |
|---|---|---|---|
| hallazgos | 112 | 120 | **85** — 75 de A/B/C2 + 10 míos |
| `CRITICA`, contados por ID | 28 | 27 | **18** |
| `CRITICA`, **defectos distintos** | no se midió | **17** | **14** |
| **atribuidos a la tanda de arreglos anterior** | **25 de 25** | **17 de 17** | **13 de 14** — ver §4.1 |

**Y hay que decir que `F-8cC1-001` sigue abierto y es `CRITICA`.** La pausa larga que cruza el día
90, `ARCHIVED` sin salida y el hard delete del día 180. Lo reejecuté paso por paso sobre el texto
de hoy (§6) y **llega entero**: conté las apariciones de `ARCHIVED` en los once capítulos de
`HOS-1353` y son **dos**, las dos en la columna `hacia` de `V/03` §9. **No lo cuento entre los 14**
porque el §4 de las instrucciones manda reportar los anteriores con su ID viejo, pero un `CRITICA`
abierto de la vuelta anterior es exactamente lo que la condición de corte de `DEC-METH-006` mira.

---

## 3. Las contradicciones entre informes, con veredicto — el encargo

Verifiqué cada una **contra el texto del capítulo**, nunca contra el informe que la cita. Cinco,
y dos de ellas no eran contradicciones.

### 3.1 ¿Cinco o seis transiciones sacan una fila principal de las filas vivas? · **`B/16` §4.3 es literalmente correcto y su alcance es falso: el conjunto tiene seis y la tabla que cita tiene cinco**

**Lo que dice cada uno.** `B/16` §4.3: *«las **cinco** que en `B/03` §3.2 sacan a una fila
principal de las filas vivas: `S3`, `S12`, `S13`, `S16` y `S17`»*. `F-8dA2-003` y `F-8dB2-007`:
**hay una sexta**, la baja que decide el proveedor, que `B/03` §10.1 manda espejar. `F-8dB3-001`
cuenta **seis puertas** a un estado terminal sobre la misma tabla. `F-8dC2-006` agrega una
**séptima**, la lápida.

**Lo verifiqué contra las dos tablas, fila por fila.**

1. **Las cinco de `B/16` §4.3 son correctas sobre `B/03` §3.2.** Recorrí las diecinueve filas: las
   que llevan a un estado no vivo son `S3` (→ `ABANDONED`), `S12`, `S13` y `S17` (→ `CANCELLED`) y
   `S16` (→ `CHARGE_DECLINED`). **Cinco, y no hay una sexta en esa tabla.**
2. **La sexta existe y no está en esa tabla, y el corpus declara las dos cosas.** `B/03` §10.1,
   octava fila: *«| `cancelled` | **cualquier estado vivo que no sea `CANCEL_SCHEDULED`** | `S12`
   si hay una baja programada; si no, **espejar la baja decidida por el proveedor** (`B/12` §1.4)
   |»*, y el bloque de cierre del mismo §: *«**Espejar un estado leído por id es una transición
   declarada de esta tabla, no un acto aparte.**»* Busqué la fila: las únicas tres de `B/03` §3.2
   con `hacia = CANCELLED` son `S12` (desde `CANCEL_SCHEDULED`), `S13` y `S17`. **Ninguna espeja
   una baja del proveedor desde `ACTIVE`, `GRACE_PERIOD`, `PAUSED` o `SUSPENDED`.**

**Veredicto: ninguno de los cuatro se equivocó, y la contradicción no es entre ellos — es entre
`B/03` §10.1 y `B/03` §3.2.**

- **`B/16` §4.3 tiene razón en lo que afirma y su alcance es el problema.** Cuantifica *«las cinco
  que **en `B/03` §3.2**…»*: con el alcance escrito, el número es exacto. Pero el § declara para
  qué existe la lista —*«para poder auditar que ninguna se olvidó»*— y **el conjunto que hay que
  auditar no es el de una sección: es el de las transiciones que sacan una fila principal de las
  filas vivas**, y ése tiene seis porque el §10.1 declara que su octava fila es una de ellas.
- **`A2` y `B2` tienen razón y describen la misma sexta.** `A2` la ataca por la rama A (*«se aplica
  la regla 1 y la fila se queda `ACTIVE` sobre un preapproval cancelado»*) y `B2` por la lista;
  `B3-010` la ataca por el tercer lado (*«su remedio no existe»*). **Los tres son el mismo defecto
  y los tres están en `ALTA`**, así que no cambia ningún conteo de críticos.
- **`C2-006` no contradice a `B3-001`, y `C2` lo declara bien**: su séptima —la lápida— **no está
  en ninguna tabla**, así que el recuento de seis de `B3` sigue siendo el correcto para el sujeto
  que midió. Lo verifiqué contra `B/21` §2.5: la lápida es *«una `subscription` en `CANCELLED`…
  escrita DESPUÉS de cancelarlo en el proveedor»*, sin transición.

**Consecuencia práctica, que es lo único que importa para el arreglo**: quien corrija esto tiene
que escribir **una fila en `B/03` §3.2** —la que el §10.1 promete y no existe— y después el número
de `B/16` §4.3 pasa a seis **solo**. Corregir el número sin escribir la fila deja el defecto de
`A2`/`B2`/`B3` entero y además vuelve falsa la cita de la sección. **La fila primero, el número
después.** Y el conjunto entero es `F-8dC1-004`.

### 3.2 El dominio de `G-R4`: ¿siete tablas, o cuatro y siete? · **no hay contradicción entre `A2` y `B2`: los dos miden lo mismo, y el corpus declara tres números que ninguno de los dos midió**

**Lo que dice cada uno.** `F-8dA2-009`: *«hay **siete** tablas de transiciones en todo el corpus,
**cuatro** de ellas en billing»*, con el desglose 3 en `V/03` y 4 en `B/03`. `F-8dB2-012`: *«**4**
tablas en billing, **3** en verticales, **7** en total»*, con la misma consulta.

**Lo conté yo, el 2026-09-21, con `rg -n '^\| *# *\| *desde *\| *evento'` sobre las dos épicas y
el núcleo: siete. Tres en `V/03` (§2, §9, §11) y cuatro en `B/03` (§3.2, §6, §7, §8).**

**Veredicto: `A2` y `B2` dicen exactamente lo mismo y coinciden conmigo. No es una contradicción:
es el mismo conteo enunciado con dos desgloses.** Lo que sí encontré al verificarlo es que **el
corpus declara el dominio en cinco sitios y no en tres**, que es más de lo que cualquiera de los
dos midió:

| | `A2` contó | `B2` contó | **yo conté** |
|---|---|---|---|
| sitios que declaran el dominio de `G-R4` | 3 (`NUCLEO/03`, `V/03`, `B/20`) | 2 (`B/20`, `V/20`) | **5** — los dos anteriores más `V/20` §2 **dos veces** (la fila dice *«las nueve máquinas»* y su párrafo dice *«las seis tablas de billing»*) y `NUCLEO/03` §1 **dos veces** (*«las tablas de transiciones de las nueve máquinas»* y *«las nueve tablas»*, a doce líneas) |
| cardinalidades vivas | 3 | 2 | **3** — nueve máquinas · nueve tablas · seis tablas de billing |
| tablas reales | 7 (4 billing) | 7 (4 billing) | **7 (4 billing)** |

**Y el dato que ninguno de los dos vio es el que decide de quién es el arreglo**: el *«seis tablas
de billing»* **no vive sólo en `B/20`**. Está también en `V/20` §2, que es el capítulo que el
propio `B/20` designa como la definición (*«Referencia cruzada: lo define `V/20` §2»*). Corregir
`B/20` y no `V/20` deja el número roto en el lugar autoritativo. Va como `F-8dC1-005`, `NUCLEO`.

### 3.3 ¿Cuántos guards tiene `B/20` §2? · **nueve. `A1` dice once y se equivoca, y el error apunta al mismo defecto de costura que la vuelta pasada**

**Lo que dice cada uno.** `F-8dA1`, «Fuera de mi vector»: *«el catálogo de `V/20` §2 tiene **14**
guards contados por mí… **`G7` no existe ahí** —vive en `B/20` §2, con `G9`, `G10`, `G11` y los
cuatro `G-R1-*`, **once en total**»*. `F-8dB1-009`: *«la tabla vigente, que tiene **nueve**
filas»*. `F-8dC2-003`: *«`B/20` §2 lista **nueve** — `G7`, `G9`, `G10`, `G11`, `G-R1-A`, `G-R1-B`,
`G-R1-C`, `G-R1-D` y `G-R4`»*.

**Lo conté yo sobre la tabla de `B/20` §2**, fila por fila: `G7`, `G9`, `G10`, `G11`, `G-R1-A`,
`G-R1-B`, `G-R1-C`, `G-R1-D`, `G-R4`. **Nueve.**

**Veredicto: `B1` y `C2` aciertan; `A1` se equivoca por dos, y la aritmética de su propia frase lo
muestra** — enumera siete guards (`G7`, `G9`, `G10`, `G11` y los cuatro `G-R1-*` = ocho) y dice
once. El total del catálogo es **22 guards distintos**: 14 en `V/20` + 9 en `B/20` − `G-R4`, que
figura en los dos. Con `G12` y `G13`, que sólo existen en la descomposición de billing, son **24**,
que es el número que `C2-003` usa y que verifiqué.

**Y el error no es un descuido aislado: es el mismo defecto de costura que `F-8cC1-008` midió en la
vuelta anterior, cuando dos agentes independientes concluyeron que `G7` no existía.** Una
numeración única partida en dos capítulos sin lista consolidada hace que **cada lector reconstruya
la mitad ajena a ojo**, y esta vuelta el error cambió de forma —de *«falta un guard»* a *«hay dos
de más»*— sin cambiar de causa. `F-8cC1-008` **sigue llegando** (§6), con una atenuación nueva que
hay que acreditar: la tanda le agregó a la fila de `G-R4` de `B/20` §2 la nota *«El catálogo de
guards es una sola numeración partida en dos capítulos»*, que es exactamente lo que faltaba — pero
**sólo en esa fila y sólo en una de las dos mitades**.

### 3.4 `F-8dA2-005` (`ALTA`) contra `F-8dB2-004` (`CRITICA`) sobre el pago manual · **manda `CRITICA`, y los dos desenlaces ocurren a la vez**

**Lo que dice cada uno.** Los dos describen el mismo hecho: `MP1` deriva el pago manual a `S19`
y el evento de `S19` es *«entra el pago de la cuota que sigue en `recycling`»*, que un pago manual
no es. **`A2` concluye que el intento cae en la regla 1, se pone la marca y hay un humano
mirándolo**, y lo clasifica `ALTA` con ese argumento: *«el desenlace es una demora, no una
pérdida»*. **`B2` concluye que además el reloj del grace corre y suspende**, y lo clasifica
`CRITICA`.

**Verificado contra el texto, y los dos desenlaces son compatibles: ocurren los dos.**

1. `S19` no matchea: su evento, textual, es *«entra el pago de la cuota que sigue en
   `recycling`»* (`B/03` §3.2), y el mismo § lo ancla al proveedor —*«su cuota impaga sigue en
   `recycling` **del lado del proveedor**, que la reintenta solo»*—. `S5` tampoco, por su
   condición. Hasta acá `A2` y `B2` coinciden.
2. **La marca se pone y no detiene nada.** `NUCLEO/03` §1 regla 1: el intento *«no se ejecuta: se
   registra… y **pone la marca**»*, y la regla remata: *«**La marca no es un estado**… la fila
   conserva el estado que tenía»*. `S14` la escribe sobre *«el mismo estado»*.
3. **Y `S6` no mira la marca: mira un booleano definido sobre `S19`.** Su condición, entera: *«**no
   hay un pago acreditado del período pendiente de resolución** por `S19`»* (`B/03` §3.2). Si
   `S19` no corrió, no hay nada pendiente *«por `S19`»*, **la condición se cumple** y el reloj
   vence. Recorrí las diecinueve filas buscando algo que impida transicionar una fila marcada: no
   existe. La única prohibición declarada sobre una fila marcada es que **no puede ser sucedida**
   (`B/02` §2.2, `B/03` §3.3), que es otra cosa.
4. `SUSPENDED` **no emite fuente** (`12-contrato…` §2.6), así que `cubierto` pasa a falso y `PB2`
   despublica.

**Veredicto: `CRITICA`.** El criterio de la fase es *«alguien paga de más»*, y acá alguien entrega
dinero real, queda registrado con comprobante, y el sistema lo suspende igual. **El argumento de
`A2` para bajarlo —*«hay una persona mirándolo»*— es cierto y no acota el daño**, porque la marca
y el reloj corren en paralelo: la persona mira un incidente **mientras** el cliente pierde el
servicio que pagó. `A2` acierta en el camino y en el diagnóstico —de hecho aporta la mitad que
`B2` no tiene, que la marca además **bloquea la sucesión que el cliente está pagando**— y su
severidad es la que no se sostiene. Cuenta **una vez**, como defecto **#9**.

### 3.5 Dos respuestas opuestas a «¿lo habría encontrado el grep?» sobre el mismo defecto · **`B2` se equivoca dos veces sobre qué archivos toca su propio commit**

Es la contradicción que más importa para el §4, porque el veredicto de método se construye con
esas respuestas y **dos de ellas están medidas contra el commit equivocado**.

| defecto | `A2`/`B1` | `B2`/`B3` | **lo verifiqué con `git show --name-only`** |
|---|---|---|---|
| **#4** el reembolso de la rama 1 | `A2`: **sí** — el término *«terminal»* se buscó y la resolución se aplicó a la mitad del dominio | `B2` y `B3`: **no** — las dos mitades viven en capítulos que `99e9d4e24` toca | **`A2` acierta.** El defecto lo cierra el último commit de la cadena, `1c972a07b`, que toca **`nucleo/08`, `B/09` y `B/12` y NO toca `B/03`**. Un `rg 'S18'` sobre `B/03` —capítulo intacto para ese commit— devuelve la fila con sus tres efectos, y resolverla contra *«al cerrar la sucesión se pone la marca»* es ver que la marca no está. `B2` y `B3` midieron contra `99e9d4e24` y el defecto lo completa el commit siguiente |
| **#5** `sucede_a` sin limpiador | `B1`: **no** — los dos lados (`B/03` y `B/09`) están adentro de `99e9d4e24` | `B2`: **sí** — `rg "sucede_a"` sobre `B/16`, que el commit no toca | **`B2` acierta.** `99e9d4e24` toca `B/02`, `B/03`, `B/05`, `B/09`, `B/12`, `B/19`, `B/20` y tres del núcleo, y **no toca `B/16`**. `B/16` §4.2 contiene *«no hay una fila viva con `sucede_a` apuntándola»* con su párrafo *«la fila viva es parte del predicado, no un adorno»*. `B1` eligió los dos consumidores que estaban adentro y no miró el que estaba afuera — y **el que estaba afuera es el que tiene la mitad correcta** |
| **#8** `S13` y los complementos | — | `B2`: **sí** — *«`rg "fila viva"` sobre `B/16`, **que ese commit no toca**»* y *«`rg "Free Forever"` sobre `12-contrato…`»* | **`B2` se equivoca.** `3692d5deb` toca **nueve** archivos y `B/16` y `12-contrato-de-cobertura.md` **son dos de ellos**. Los dos consumidores que `B2` propone grepear están **adentro** del commit. La respuesta correcta es **no** |

**Veredicto, y es el que cambia el número del §4**: sobre los tres defectos, el reparto correcto es
**#4 sí, #5 sí, #8 no**. Dos de los tres informes que contestaron sobre ellos midieron contra el
conjunto de archivos equivocado, y el error va en las dos direcciones. **La lección de método no es
que se equivocaron: es que la respuesta a «¿lo habría encontrado el grep?» depende de un dato
—qué archivos toca cada commit— que ningún documento del programa publica**, así que cada agente lo
re-deriva y dos de siete lo derivaron mal. Lo publico en §4.2.

---

## 4. ¿`DEC-METH-009` cortó el generador? — el encargo

**La respuesta corta: no, y las tres vueltas ahora dicen lo mismo con números distintos.** La regla
funciona donde su premisa se cumple y su premisa se cumple en **cinco de los catorce** críticos de
esta vuelta. Lo que cambió respecto de las dos anteriores no es la proporción de atribuidos —sigue
casi entera— sino que **ahora se puede decir exactamente por qué los nueve restantes se escapan, y
son cinco modos, no uno**.

### 4.1 La atribución: 13 de 14, y el que falta importa

Recorrí los catorce defectos del §2.1 y clasifiqué su atribución contra el texto de cada informe y
contra los diffs:

| | 8-bis | 8-bis-2 | **8-bis-3** |
|---|---|---|---|
| críticos distintos | no se midió | **17** | **14** |
| **los introdujo la tanda de arreglos anterior** | **25 de 25** | **17 de 17** | **13 de 14** |
| el que no | — | — | **#14**, la firma copiada en los dos `spec.md` |

**El que falta no es una buena noticia y hay que decirlo así.** `#14` no lo introdujo la tanda
porque **la tanda no puede tocarlo**: los dos `spec.md` no se editan desde el 2026-09-18 y la
divergencia nace en la FASE 9. Lo que la tanda hizo fue **ensanchar la brecha dos veces más** —los
arreglos 4 y 6 redefinieron qué `referencia` transporta un `GRANT` y un `ADDON`, sobre un campo que
las copias ni nombran—. O sea: **13 de 14 los produjo el acto de arreglar, y el catorceavo lo
empeoró.** La serie 25/25 → 17/17 → 13/14 no baja por un cambio de método: baja porque hay un
crítico que ninguna regla de arreglo podía producir.

### 4.2 El dato que la regla necesita y el programa no publica: qué archivos toca cada commit

Lo medí con `git show --name-only` sobre los ocho commits, y lo publico porque **§3.5 mide que dos
de siete informes contestaron mal la pregunta central de esta pasada por no tenerlo**:

| commit | familia | archivos | ¿declara `DEC-METH-009` en su mensaje? | ¿reporta una búsqueda ejecutada? |
|---|---|---|---|---|
| `1ca12d709` | el contrato | 9 — contrato, `nucleo/04`, `V/02`, `V/10`, `V/15`, `V/20`, `B/02`, `B/16`, `B/21` | **sí** | sí, **sin cifras** |
| `49eb99f34` | el trial | 16 — contrato, `nucleo/00`, `nucleo/01`, `nucleo/03`, `V/02`, `V/03`, `V/10`, `V/11`, `V/17`, `V/20`, `V/21`, `B/02`, `B/03`, `B/05`, `B/14`, `B/20` | **sí** | sí — *«110 apariciones, 9 corregidas, 101 declaradas correctas»* |
| `3692d5deb` | la sucesión | 9 — contrato, `nucleo/01`, `nucleo/04`, `B/02`, `B/03`, `B/05`, `B/09`, `B/16`, `B/20` | **sí** | sí — *«`sucede_a` CERO fuera de billing; 23 de sucesora/predecesora declaradas correctas»* |
| `99e9d4e24` | el pago tardío | 11 — `nucleo/01`, `nucleo/03`, `nucleo/07`, `V/03`, `B/02`, `B/03`, `B/05`, `B/09`, `B/12`, `B/19`, `B/20` | **no** | **sí** — *«Medido antes de editar: `S5` tenía CERO apariciones en `B/05`»* |
| `f5731fd65` | `CHARGE_DECLINED` | 5 — `B/02`, `B/03`, `B/09`, `B/12`, `B/16` | **sí** | sí — *«encontró una contradicción viva: `B/12` seguía con la condición histórica de `S16`»* |
| `94e4baf5b` | `DEC-RF-002` | 1 — el decision log | **no** | no (*«recontadas con rg»* es el conteo de decisiones) |
| `1c972a07b` | el cierre | 3 — `nucleo/08`, `B/09`, `B/12` | **no** | **no** |
| `50c3e2196` | las dos decisiones | 4 — log, contrato, `V/03`, `B/02` | **no** | no (ídem) |

**Y acá corrijo la inferencia de `A1`, que es el único dato de método que la pasada trajo
equivocado.** `A1` mide bien la columna de los mensajes —**cuatro declaran y cuatro no**, lo conté
y coincide— y concluye *«la regla sirve donde se aplicó»*. **La inferencia no se sostiene, y por
dos razones independientes:**

1. **Un mensaje de commit no es evidencia de lo que se hizo, y la tabla lo muestra en las dos
   direcciones.** `99e9d4e24` **no** nombra la regla y **sí** reporta una búsqueda ejecutada con su
   resultado; `1ca12d709` **sí** la nombra y no reporta una sola cifra. La columna que hay que
   medir es la quinta, no la cuarta. *(Nota sobre el encargo: el orquestador señala que
   `1c972a07b` también ejecutó el grep. **No lo pude verificar**: su mensaje no reporta ninguna
   búsqueda, la tanda 9-bis-2 no produjo informes como documentos —sus «informes» son los mensajes
   de commit, lo verifiqué buscando en `14-fase-8-adversarial/`, `15-fase-9/`, el worklog y el
   handoff— y no encuentro en el repo una tabla de seis términos para ese commit. Lo digo en vez de
   adoptarlo.)*

2. **Y la razón fuerte, que es medible y no depende de los mensajes: donde la regla se declaró
   corrida CON cifras, se le escaparon apariciones literales del término que dijo haber
   barrido.** Es §4.3.

### 4.3 Dos apariciones literales que sobrevivieron a un grep declarado, medidas por mí

| commit | qué declaró | qué quedó vivo | consecuencia |
|---|---|---|---|
| `1ca12d709` | *«los términos redefinidos se grepearon sobre los capítulos que la edición no toca, y cada aparición quedó corregida o declarada correcta»*. El término central es el `scope` del grant | `rg "scope de verticales"` sobre el corpus devuelve **7 líneas**, y una es `NUCLEO/01` §5: *«└── Grant permanente (§35, **con su scope de verticales**)»*. **El commit NO toca `NUCLEO/01`** | `F-8dA1-009` y `F-8dA3-010`, las dos `MEDIA`, las dos `NUCLEO` |
| `3692d5deb` | *«**23** de sucesora y predecesora declaradas correctas una por una»* | `rg -c "sucesora"` sobre los capítulos que ese commit **no** toca devuelve **14 apariciones en dos archivos** —`B/12` 13 y `B/14` 1—, y la de `B/14` es la línea *«en el upgrade, porque **la sucesora lo hereda**»* (§2.2) | **`F-8dB1-003`, `CRITICA`** — defecto **#7**. O esa aparición no estaba entre las 23, o se declaró correcta y no lo era. El total no cierra tampoco: 14 fuera del commit, contra 23 declaradas sobre dos términos |

**Eso es el veredicto sobre la primera mitad de la pregunta.** No es *«la regla no se aplicó»* y no
es *«la regla no sirve»*: es una tercera cosa, y es la que la pasada existía para separar. **La
regla se aplicó, con cifras, y la obligación 3 —*«cada aparición se resuelve»*— no tiene forma de
distinguir «la miré» de «la resolví bien».** `A3` lo mide desde el otro extremo con su único
`CRITICA`: la línea de `S13` **fue alcanzada y editada en esta misma tanda**, y la resolución se
aplicó a la columna `desde` mientras el defecto estaba en la columna `evento` de la misma fila.
`C2-008` lo mide una tercera vez: `49eb99f34` fue al capítulo que no estaba tocando (`V/21` §2.4),
escribió una resolución explícita, y **la resolución es falsa**. Tres instancias, tres commits
distintos, un mismo modo: **la búsqueda es mecánica y la resolución no lo es.**

### 4.4 Cuántos habría encontrado el grep, y el reparto de los que no

Recorrí los catorce críticos distintos y clasifiqué cada uno con la respuesta que su informe da,
**corregida por §3.5 donde midió contra el commit equivocado**:

| | cuántos | cuáles |
|---|---|---|
| **el grep los habría mostrado** | **5 de 14** | #3 (y de hecho lo mostró), #4, #5, #6, #7 |
| **no** | **8 de 14** | #1, #2, #8, #9, #10, #11, #12, #13 |
| **fuera del alcance declarado de la regla** | **1 de 14** | #14 |

**Y los nueve que se escapan se reparten en cinco modos, no en nueve.** Vale separarlos porque cada
uno pide una corrección distinta y tres de las cinco son gratis:

| # | modo | qué pasa | cuáles | ¿lo nombra algún informe? |
|---|---|---|---|---|
| **1** | **la ausencia** | el término no aparece donde el defecto vive **porque el defecto es que no aparece**: `S13` no está en la exención, el detector no existe, la re-evaluación no tiene disparador | **#11, #12, #13** | sí — `A3` y `B3`, y `B3` mide que son **4 de sus 5** críticos |
| **2** | **interno al commit** | las dos mitades están en capítulos que el **mismo** commit toca, y la regla manda buscar afuera | **#8, #9, #10** | sí — `A2`, `B1`, `B2`, `B3` |
| **3** | **el consumidor no nombra el término** | el capítulo que se rompe expresa la misma regla con otras palabras, o razona sobre el término **viejo** | **#1** | sí — `A1` («el consumidor nuevo que el arreglo adquiere»), `A2` («el grep del término nuevo no encuentra a los que usan el viejo») |
| **4** | **el capítulo que nunca nombró el término** | el dueño de la regla que se rompe no contiene la cadena ni una vez: `V/11` no dice `T6` ni una vez y dice `cubierto` una, fuera de un predicado | **#2** | sí — `A2`, que lo mide con `rg` |
| **5** | **el documento que no es un «capítulo»** | el alcance declarado de la obligación 2 son *«los capítulos… las dos épicas y el núcleo»*, y el corte, la partición, los dos `spec.md`, las dos `descomposicion.md` y el decision log no lo son | **#14** | sí — `C2`, que lo mide término por término: **20 de 21 dan cero sobre el documento del corte** |

**Y hay un sexto modo que sólo aparece fuera de los críticos, y es el que más barato se cierra**:
`A3` mide que **el núcleo escribe las entidades en castellano** —*«Addon: producto»*, *«Grant
permanente»*, *«producto de addon ≠ instancia de addon»*— mientras el resto del corpus las escribe
en `snake_case`, así que **un grep por nombre de tabla no entra nunca al capítulo que se declara
dueño de los nombres**. Son tres hallazgos suyos (`F-8dA3-004`, `-005`, `-010`), los tres `NUCLEO`,
los tres míos por adopción, y alcanza a **las 15 filas de entidades de `NUCLEO/01` §1**.

### 4.5 La corrección de la regla, con su costo — propuesta, no aplicada

No toco el decision log. Lo que sigue es lo que propongo, ordenado por lo que compra contra lo que
cuesta, y con lo que **no** cierra dicho en voz alta.

**Corrección 1 — el alcance: «todo el corpus», y la unidad es el párrafo, no el archivo.**
Reemplazar *«sobre los capítulos que el commit NO toca, las dos épicas y el núcleo»* por *«sobre
todo el corpus —las dos épicas, el núcleo, el contrato, el corte, la partición, los `spec.md`, las
`descomposicion.md` y el decision log— **incluidos los archivos que el commit toca**, porque un
archivo abierto no es un párrafo leído».

- **Compra**: los 3 del modo 2 (interno al commit) y el 1 del modo 5 (no es capítulo) = **4 de 9**.
  Y de los diez hallazgos míos, `F-8dC1-002` y `F-8dC1-006` son exactamente ese borde: el capítulo
  estaba tocado y el párrafo no.
- **Costo**: **cero en ejecución** —el `rg` ya recorre el árbol; lo que cambia es cuánta salida hay
  que leer— y **algo en volumen**: `49eb99f34` reportó 110 apariciones con el alcance chico. Con el
  alcance entero el número crece, y un arreglo que tenga que resolver 300 apariciones va a declarar
  correctas las 290 que no miró, que es el modo de §4.3 amplificado. **Ese es el costo real y hay
  que decirlo: ampliar el alcance sin cambiar la obligación 3 empeora el problema de la
  resolución.**

**Corrección 2 — la obligación 3 se cumple por escrito y por aparición, no por commit.** Hoy el
mensaje declara un agregado (*«9 corregidas, 101 declaradas correctas»*). Que declare, para cada
aparición **que no se corrige**, el archivo, el § y **por qué sigue siendo correcta** — en el
cuerpo del commit o en un archivo del arreglo.

- **Compra**: es lo único que ataca §4.3, que es el modo que produjo `#7` (`CRITICA`) y dos
  `MEDIA`. Con la resolución escrita, *«`B/14` §2.2: «la sucesora lo hereda» — correcta»* es una
  afirmación falsable; dentro de un «101 declaradas correctas» no lo es.
- **Costo**: **es el caro de los cuatro**. Escribir 101 líneas de resolución es más trabajo que el
  arreglo. La versión barata: escribir sólo las que **no** se corrigen **y están en un capítulo que
  el commit no tocó**, que es donde vive el riesgo — en `3692d5deb` habrían sido pocas y una de
  ellas la de `B/14`.

**Corrección 3 — grepear también el término VIEJO, el que se retira.** La obligación 2 pide *«el
término que redefine»*; agregar *«y el que reemplaza»*.

- **Compra**: el modo 3 = **1 de 9** entre los críticos, y **cuatro `ALTA`/`BAJA` más**
  (`F-8dA2-003`, `F-8dA2-011`, `F-8dC2-007`, y la mitad de `F-8dA1-003`). `A2` lo formula bien:
  *«el grep del término nuevo no encuentra a los consumidores que siguen usando el término viejo, y
  ése es el conjunto donde viven los defectos que el arreglo vino a corregir»*.
- **Costo**: una búsqueda más por arreglo, y **ruido**: los términos viejos suelen ser palabras
  comunes (*«vivo»*, *«suscripción viva»*, *«cuando un título muere»*). Medible antes de adoptarla.

**Corrección 4 — lo que ninguna búsqueda cierra: las ausencias (3 de 9), y el corpus ya tiene el
control a medias.** Una ausencia no se grepea. Lo único que la detecta es una **lista de
consumidores por término**, y el núcleo ya tiene una: `NUCLEO/01` §2.4 enumera los predicados que
usan *«fila viva»*. La propuesta es generalizarla: **cada término que el núcleo define lleva su
lista de consumidores, y un arreglo que crea un consumidor nuevo agrega la fila antes de
declararse aplicado**.

- **Compra**: los 3 del modo 1, y **el crítico #5 se cae solo**: el commit que creó el sexto
  predicado tocó el archivo de la lista y no lo agregó (`F-8dC1-001`). Con la lista completa, poner
  `S19` al lado de `B/16` §4.2 muestra el adjetivo que falta.
- **Costo**: **es el único que no es gratis y hay que decir por qué.** Mantener N listas en el
  núcleo es exactamente la clase de conteo que esta pasada encontró roto **cinco veces**
  (`F-8dA2-009`, `F-8dA2-010`, `F-8dA3-009`, `F-8dB2-012`, `F-8dC1-005`), y **el precedente es
  malo**: la única lista que existe quedó corta en el mismo commit que creó su sexto miembro. Una
  lista que se olvida es peor que no tenerla, porque afirma completitud. **Sólo vale la pena con la
  corrección 2 encima**: la lista se actualiza en el mismo acto en que se escribe la resolución.

**Y lo que las cuatro juntas NO cierran, declarado como `DEC-METH-009` declara el suyo**: el modo 4
—*«el capítulo que nunca nombró el término»*—. `V/11` es el dueño del §10.2 (*«el trial no vuelve»*)
y **no contiene `T6` ni una vez**; ninguna búsqueda por término, viejo o nuevo, en cualquier
alcance, lo devuelve. Lo único que lo encuentra es recorrer el dominio **por el eje del tiempo**
—*«¿qué pasa el día que la configuración cambie?»*—, que es lo que `A2` hizo a mano para llegar a
`#2`. Eso no es una regla de búsqueda: es la obligación 1 de `DEC-METH-008` con un eje más, y
conviene declararlo no cubierto en vez de dar por hecho que las cuatro correcciones alcanzan.

### 4.6 El veredicto, en tres líneas

1. **La regla cortó una parte del generador y se puede fechar cuál.** Su caso de diseño funciona y
   hay prueba en el corpus: el mensaje de `f5731fd65` registra que *«`DEC-METH-009` encontró una
   contradicción viva: `B/12` seguía con la condición histórica de `S16` que `B/03` ya había
   reemplazado»*, y esa contradicción no llegó a esta pasada. **Cinco de los catorce críticos
   estaban dentro de su alcance.**
2. **No cortó el generador, y la razón no es que no se aplicara: es que el generador tiene cinco
   modos y la regla ataca uno.** De los 14, **8 son invisibles a cualquier búsqueda de texto
   ejecutada perfectamente** y 1 está fuera del conjunto que la regla manda barrer.
3. **Y de los cinco que sí alcanzaba, al menos dos pasaron con la regla declarada corrida.** Ésa es
   la mitad accionable: **la obligación que falta no es una búsqueda más, es que la resolución deje
   rastro por aparición**. Las cuatro correcciones del §4.5 compran 4, 3, 1 y 3 de los nueve
   —con superposición—, y sólo la 2 ataca el modo que produjo el crítico más caro de los cinco
   alcanzables.

---

## 5. Los defectos `NUCLEO` de los otros siete, adoptados

Los adopto como míos, que es lo que el §5 de las instrucciones manda. **Nueve tienen ID ajeno y los
dejo con él** —duplicarlos inflaría el conteo—; **tres no tenían ID y se lo di** en el §1.

| defecto | ID | dónde vive | qué hay que hacer |
|---|---|---|---|
| `NUCLEO/01` no recibió ninguna de las dos redefiniciones: la cortesía sin domicilio y *«con su scope de verticales»* | `F-8dA1-009` | §1.5, §5 | reescribir las dos celdas |
| anclar una vertical no está entre las doce acciones administrativas | `F-8dA3-002` | `NUCLEO/08` §3 | una fila más, con su columna de destructividad |
| el invariante 26 prohíbe la columna de la que depende el arreglo 6 | `F-8dA3-004` | `NUCLEO/04` §2.1 | acotar el enunciado a *«no repite los campos mutables»* |
| el glosario describe *«Addon: producto»* con la duración, los efectos y el scope adentro | `F-8dA3-005` | `NUCLEO/01` §1.6 | alinear con el corte por campo de `V/02` §2.1 |
| `NUCLEO/04` §5: la celda de guards en cuatro, su propia nota dice cinco, la tabla suma 18 y el texto 19 | `F-8dA3-009` | `NUCLEO/04` §5 | una celda |
| el mapa conceptual: el grant con scope, y cinco fuentes de agregación sin `BASE` | `F-8dA3-010` | `NUCLEO/01` §5 | dos líneas de la figura |
| *«fila viva»* se declara sobre dos clases de fila y enumera una | `F-8dB3-009` | `NUCLEO/01` §2.4 | la segunda enumeración, con los cinco estados de la instancia |
| `G-R1-B` es un guard cuyo predicado exige una llamada al proveedor desde CI | `F-8cB2-009` | `NUCLEO/04` §3 (`D8`) + `B/20` §1 | reparto de niveles; **sigue llegando** |
| `D11` (*«lo que toca plata lo confirma una persona»*) tiene apoyo **servicio** y `DEC-RF-002` acaba de apoyar en él el reembolso | — | `NUCLEO/04` §3 | el invariante que sostiene la decisión nueva es el único de los tres niveles sin mecanismo. Lo anoto sin ID: es la misma celda que `F-8dA3-009` recorre |
| `NUCLEO/01` §2.4: cinco predicados declarados, seis reales | **`F-8dC1-001`** | §1 | **ID nuevo** |
| `D15` sobre-enunciado y su apoyo de base no lo sostiene | **`F-8dC1-003`** | §1 | **ID nuevo** |
| la regla 7 delega en un guard que no puede contar su dominio | **`F-8dC1-007`** | §1 | **ID nuevo** |
| el catálogo administrativo no tiene el acto que enruta el reembolso | **`F-8dC1-008`** | §1 | **ID nuevo** |
| `nucleo/01`, `04`, `07` y `08` no son de ninguna de las 22 unidades | `F-8dC2-002` | las dos `descomposicion.md` | decisión de reparto; **toca `nucleo/00-indice.md`, que es mío** |

**Sobre la última, que es la que me toca decidir y no decido**: `C2` la manda acá porque
`nucleo/00-indice.md` es el documento que declara qué vive en el núcleo. Las tres salidas son
*«el núcleo es una unidad propia»*, *«se reparte entre las 22»* y *«se declara no construible»*, y
**las tres son decisiones de producto, no de costura**. Lo que sí puedo decir es que la segunda ya
está escrita y no se ejecutó: `11-particion-del-programa.md` §4 reparte `01`, `04`, `07` y `08`
como **PARTIDO**, con el criterio por capítulo, y las dos descomposiciones no lo recogieron. **El
reparto existe; lo que falta es que alguien lo copie a la tabla de unidades.**

---

## 6. Mis dieciséis hallazgos de la 8-bis-2, reejecutados sobre el texto de hoy

No cuentan como hallazgos nuevos. Cada camino se volvió a correr paso por paso sobre el texto
vigente, y donde digo que corta lo digo con la cita que lo corta.

| ID | título, en corto | ¿corta? | dónde |
|---|---|---|---|
| `F-8cC1-001` | la pausa larga cruza el día 90, `ARCHIVED` no tiene salida, el día 180 borra | **NO — `CRITICA` abierta** | llega entero. Conté `ARCHIVED` sobre los once capítulos de `HOS-1353`: **dos apariciones, las dos en la columna `hacia`** (`PB4`, `PB5`). Ninguna fila sale de ahí. `V/02` §4.1 sigue con el hard delete del 180, `NUCLEO/01` §3 sigue con las 4 pausas-mes |
| `F-8cC1-002` | *«vivo»* nombra dos conjuntos y el glosario no define ninguno | **SÍ** | corta en el paso 1: `NUCLEO/01` §2.4 existe, con los dos términos, la tabla de dónde se enumera cada uno y las dos reglas de uso. **Es el mejor arreglo de la tanda**, y sus dos residuos son `F-8dC1-001` (la lista corta) y `F-8dB3-009` (la segunda clase sin enumerar) |
| `F-8cC1-003` | la regla de vigilancia con cuatro disparadores y nadie la corrió | **NO, y creció** | llega entero: `12-contrato…` §1.1 sigue diciendo *«en cuatro lugares»*. **Tres disparadores nuevos esta vuelta** (`T1`, `T6`, `plan.vertical`), que suman siete en dos vueltas. Va como `F-8dC1-002` |
| `F-8cC1-004` | `PB3` es el quinto consumidor de `cubierto` y no está en el censo | **NO** | llega entero: el contrato nombra `PB3` **cero veces**; la fila `cubierto` del §2.1 sigue con tres. Absorbido por `F-8dC1-002`, que cuenta seis |
| `F-8cC1-005` | el correo del catálogo no dice lo que el arreglo 15 decidió | **SÍ, en su forma** | corta: `NUCLEO/07` §6 ahora lleva el párrafo entero de las **dos ramas** —*«si termina el checkout, se le devuelve; si lo abandona, le queda»*—. **El residuo es el plazo**, y es `F-8dB1-006`: las dos superficies no dicen que la devolución no es instantánea |
| `F-8cC1-006` | `D8` está contado en *«base»* y por la definición del §1 no lo está | **NO** | llega entero: la celda sigue diciendo *«la fecha que el proveedor confirmó **se guarda**… y un guard la compara»*, y el §1 sigue reservando *«base»* para lo que *«lo impide»* |
| `F-8cC1-007` | `M-DATA-01` cerrado en tres archivos, las dos mitades contestan distinto | **NO** | llega entero: `B/02` §4.1 sigue con **una** fila (la conté), `V/02` §4.1 con tres, y los tres `cierra` intactos |
| `F-8cC1-008` | el catálogo de guards es una numeración partida sin referencia cruzada | **NO, con una atenuación acreditable** | la tanda le agregó a `B/20` §2, **en la fila de `G-R4`**, la nota *«El catálogo de guards es una sola numeración partida en dos capítulos»*. Está sólo ahí y sólo de un lado: `V/20` §2 sigue sin nombrar a `G7`. **Y el daño volvió a ocurrir**: `A1` cuenta once donde hay nueve (§3.3) |
| `F-8cC1-009` | el décimo estado sin nombre en el glosario | **NO, y ganó un consumidor** | `NUCLEO/01` §2.2 sigue con nueve. Lo nuevo es `V/03` §2 razonando sobre *«los diez estados»*: va como `F-8dC1-009` |
| `F-8cC1-010` | *«doce acciones»* sobre una tabla con más actos | **NO** | recontado hoy: **12 filas, 17 actos** —cuatro filas con conjunción (*«otorgar o revocar»* ×2, *«aprobar o rechazar»*, *«pausar o reanudar»*) más *«configurar el plan **y** el método»*—. `V/17` §3.2 sigue cuantificando sobre *«las doce»*. Y ahora falta una fila más (`F-8dA3-002`) |
| `F-8cC1-011` | tres entradas de la lista de invalidación no invalidan *«la entrada de un `user + vertical`»* | **CORTA A UN TERCIO** | la entrada del grant **se arregló y se puede citar**: *«**El ancla es por vertical**: invalida la entrada de **esa** vertical del beneficiario, no la de las otras»* (`V/02` §3.2). Las otras dos —piso/pre-trial y `addon_version`— siguen sin acotar, y el encabezado sigue igual. **Y el conteo sigue roto**: *«las **cuatro** últimas»* sobre **tres** filas en negrita (conté las diez) |
| `F-8cC1-012` | el núcleo no tiene regla de precedencia para dos filas sobre el mismo par | **SÍ** | corta: `NUCLEO/03` §1 **regla 7** existe, con su tabla de tres pares, su *«no se dirime por precedencia»* y su delegación en `G-R4`. Los residuos son `F-8dC1-005` (el dominio) y `F-8dC1-007` (la columna sin tipar) |
| `F-8cC1-013` | `D7` y `D15` sobre-enunciados | **NO** | `D7` ganó la salvedad de `PA-5` (*«si ya está cancelado, `D7` está cumplido»*) y sigue sin declarar `S12`, `S13` ni `S16`. `D15` empeoró: va como `F-8dC1-003` |
| `F-8cC1-014` | `NUCLEO/00` dice *«51 invariantes»* en dos lugares | **NO, y ahora son dos cifras** | llega entero, y el archivo lo tocó `49eb99f34` sin recontarlo. Con el *«54 decisiones»* va como `F-8dC1-006` |
| `F-8cC1-015` | referencias del núcleo a secciones que el desarme se llevó | **NO** | llega entero: `NUCLEO/02` §2.6 sigue diciendo *«se explica en §4»* sobre un archivo que tiene §1 y §2.6; `NUCLEO/03` §1 regla 6 sigue diciendo *«Se describen en §4 y §5»* sobre un archivo con un solo § |
| `F-8cC1-016` | `NUCLEO/08` §4.3 congela *«las cuatro condiciones del cap. 05 §3»* | **NO, y sigue sin doler** | `B/05` §3 sigue con cuatro condiciones (las conté) y el núcleo sigue citando cuatro. El § cambió su condición 3 dos veces en la tanda **sin cambiar el número**, que es exactamente lo que el hallazgo anticipaba |

**Dos cortan** (`002`, `012`), **uno corta en su forma** (`005`), **uno corta a un tercio** (`011`)
y **doce siguen llegando** — uno de ellos `CRITICA`. Los dos que cortan los cerró un commit que
declara `DEC-METH-009`; los dos que cortan parcialmente, también.

---

## 7. Ataques que intenté y el diseño resistió

Vale tanto como la lista de arriba: son los caminos que probé sobre el texto nuevo y que cierran.

- **Encontrar un tercer documento que redefina algo del núcleo, ahora que la tanda escribió en
  cinco de sus siete capítulos.** Recorrí los siete archivos del núcleo contra los veinticuatro
  capítulos y las dos duplicaciones siguen siendo **las mismas dos** de la vuelta anterior: la
  tabla de las cuatro capas y el §2.1 entero, palabra por palabra en los dos capítulos 20
  (`F-8cC1-008`). **La tanda no agregó ninguna.** Los cinco archivos del núcleo que se editaron
  —`00`, `01`, `03`, `04`, `07`, `08`— definen y las épicas referencian, que es la regla de
  `NUCLEO/00`, y lo verifiqué sobre los diffs.
- **Que la partición de *«vivo»* en dos términos deje un tercer conjunto sin nombre.** No lo hay:
  recorrí los tres usos que el §2.4 declara —el candado del §11, el disparo de `S17` y la condición
  de `T6`— y los tres quedaron asignados, con la asimetría escrita (*«una fila viva no implica una
  fuente viva, y una fuente viva no implica una fila viva… **Las dos direcciones fallan**»*). Y el
  §2.4 cierra la tercera puerta que yo buscaba: *«**Y «viva» tampoco es «cubre»**»*, con la clase
  nombrada. **Es el mejor § que la tanda escribió** y el único lugar del corpus donde un término
  trae su lista de consumidores — por eso la corrección 4 del §4.5 lo toma como modelo.
- **Hacer que el contrato y el núcleo den dos respuestas sobre la clase de una fuente.** No:
  la clase **no se transporta** y se deriva de dos campos que la fuente ya lleva (`12-contrato…`
  §2.4), con el argumento escrito —*«hacerlo sería la segunda fuente de un dato que esos dos ya
  determinan»*—, y el glosario no la define en ningún lado. Recorrí las 24 celdas de la tabla 6 × 4
  buscando una combinación con dos lecturas: las tres *«imposible»* tienen razón escrita y las
  trece mudas son inalcanzables o irrelevantes. **El único lugar donde el corpus tiene dos fuentes
  de un dato derivado es el que él mismo eligió no tener.**
- **Colar una regla de verticales condicionada sobre un estado de billing por la puerta que el
  arreglo 2 abrió.** Cerrado, y mejor que antes: `V/03` §2 lleva su propia regla —*«Ninguna
  condición ni ningún evento de esta máquina nombra un estado de la suscripción»*—, el contrato §4
  la justifica y `G-R4-B` la vigila. Lo que **no** cierra es la dirección inversa (`F-8dA2-007`,
  `A1` de billing sobre un estado de trial), y eso es de `A2`.
- **Que el desarme deje una entidad del núcleo gobernada por dos reglas contradictorias.** Lo probé
  con `domain_event` y `outbox`, que son las dos que viven en `NUCLEO/02` §2.6 y cuya retención
  vive en `V/02` §4.1. Sigue roto —es `F-8cC1-007`, que sigue llegando— y sigue siendo **el mismo**
  hueco, no uno nuevo: ningún commit de la tanda tocó `NUCLEO/02` ni las dos secciones de
  retención. No lo cuento dos veces.
- **Que `DEC-GRANT-006` y el arreglo 4 se contradigan entre sí sobre la misma columna.** No: la
  cortesía pierde su `scope` y el grant lo convierte en un conjunto de anclas, y son **dos
  instrumentos distintos con dos correcciones opuestas**, con la asimetría argumentada por un
  criterio evaluable (*«revocar se puede olvidar, vencer no»*). Lo intenté por la ruta de `B/21`
  §2.4 —*«cada vertical de su scope»*— y `C2` ya lo había cerrado: la frase es correcta con el
  significado nuevo. **La única grieta es que la razón declarada es falsa** (`F-8dA1-008`: el
  catálogo del núcleo declara que una cortesía **sí** se revoca), y es `MEDIA` porque la conclusión
  se sostiene igual.
- **Que las dos implementaciones del contrato den respuestas distintas después de la tanda.** No:
  el §5.1 resuelve *«las **dos** fuentes que ya viven del lado de verticales»* y ninguno de los
  arreglos movió una fuente de lado. El caso testigo del §6.2 —*«alguien en `PRE_TRIAL` tiene
  `cubierto: no` y `fuentes` no vacío»*— sigue distinguiendo la de arranque de una constante y de
  la real a la vez. **Lo que sí divergió es la COPIA de la firma en los dos `spec.md`**, y eso es
  `F-8dC2-001`, que no es el contrato sino su copia.
- **Encontrar un conteo del núcleo que la tanda corrigiera bien.** Lo intenté como control, porque
  cinco salieron rotos. **Hay uno y hay que acreditarlo**: `NUCLEO/00` pasó *«las seis reglas de
  lectura»* a *«las **siete**»* en el mismo commit que agregó la regla 7 a `NUCLEO/03`. Es el único
  de los conteos del núcleo que se movió con su causa, y está en la misma tabla donde el *«los 51»*
  siguió congelado — o sea que la diferencia no es el archivo ni el commit: es que alguien miró esa
  celda y no la de al lado.
- **Que la marca `requiere_conciliación` deje a una fila fuera de toda observación.** Cerrado y
  bien argumentado: `B/09` §3 declara que *«una fila con la marca SÍ se barre»* con su razón
  —*«lo que se apaga así no es el ruido: es el único detector»*— y lo que se agrega es el aviso,
  no la comparación, apoyado en `DEC-OBS-001`. La intersección que sigue rota es la de una fila
  marcada **y terminal**, y es `F-8cB1-011`, de `B1`.
- **Que el aviso agregado del §22.1 se coma un doble cobro real.** Sigue cerrado: la lista de
  excepciones de `NUCLEO/08` §4.1 es cerrada y contiene exactamente *«un doble cobro real
  detectado»* y *«un reembolso que falló sobre una revocación»*, y no depende de la marca. Ningún
  commit de la tanda la tocó.
- **Que el huso horario del `NUCLEO/07` §3 se cruce con alguna ventana nueva de la tanda.** Lo
  probé contra la ventana de 72 h de la sucesión y no se cruza: la de 72 h está en **horas** y el
  invariante rige *«toda ventana expresada en días»*. El § lo dice sin que haga falta deducirlo
  (*««Tres días antes» significa un día del calendario, no 72 horas»*). La distinción está bien
  hecha y la tanda no la rozó.
- **Que la deduplicación del outbox se rompa con el correo nuevo del cambio de plan.** No: su
  ocurrencia sería *«el sujeto más el hito»* con el id de la suscripción, y el correo sale *«antes
  de confirmar el cambio»*, una vez por intención. El caso que la regla deja pasar a propósito
  —el aviso que vuelve a salir tras una extensión de trial— sigue escrito con su razón.

---

## 8. Fuera de mi vector

- **[`A2` / `B2`]** La condición de `S17` es *«la fila tiene una sucesora con `sucede_a`
  apuntándola»*, **sin el adjetivo**, igual que `S19`. Lo recorrí buscando el daño y **no es
  alcanzable**: su evento exige *«su sucesora quedó **autorizada**»*, que una `ABANDONED` no puede
  satisfacer. Lo anoto porque el `desde` de `S17` **sí** dice *«fila viva»* y `NUCLEO/01` §2.4 lo
  cuenta entre los cinco predicados por esa mitad: la fila usa el término bien en una columna y mal
  en la otra, que es exactamente la forma de `F-8dA3-001`.
- **[`B1` / `B2`]** El capítulo 13 gana un ítem más en esta vuelta y es de mi vector sólo a medias:
  `NUCLEO/08` §4.3 le fija por adelantado el vocabulario del diagnóstico (*«las cuatro
  condiciones»*, `F-8cC1-016`) y ahora `NUCLEO/08` §3 le fija además **una acción cuyo disparador
  no existe** (`F-8dC1-008`). Cuando el 13 se escriba, los dos números y la fila tienen que
  resolverse juntos.
- **[`C2`]** `HOS-1354/docs/21-migracion.md` **sigue con sus secciones fuera de orden** —§1 → §1.3
  → §3 → §3.3 → §2.4 → §2.5 → §4— y su §3.3 sigue declarando abierta una pregunta que `DEC-MIG-002`
  y `DEC-MIG-004` cerraron. `C2` lo reporta por tercera vuelta consecutiva y coincido: es de la
  costura y no lo tomo porque no tengo nada que agregarle.
- **[owner]** La fecha que la FASE 7 se pone a sí misma —*«se escribe ANTES de que nazca la rama
  del paraguas»*, `D-28`, el **2026-09-23**— vence **pasado mañana**, y `C2` mide que en los ocho
  commits de la tanda no hay una línea de los cinco ítems huérfanos. No es un hallazgo de esta fase
  y es lo único de los siete informes que tiene un plazo corriendo.
