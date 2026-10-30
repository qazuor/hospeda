---
title: "FASE 8-bis-5 · A3 — datos, migración y acoplamiento"
linear: HOS-1352
statusSource: linear
created: 2026-09-22
updated: 2026-09-22
status: CURRENT
fase: 8
---

# FASE 8-bis-5 · A3 — datos, migración y acoplamiento

Sexta pasada A3, sobre el texto que la **9-bis-4** produjo. El vector no cambia: columnas que
hacen falta y no existen, columnas que existen y nadie escribe, listas cerradas cuyo conteo no
cierra, conteos congelados, el outbox y sus ocurrencias, y todo punto donde una épica necesita
algo de la otra sin que el contrato lo declare.

**Lo que pesa en esta tanda, para mi vector, es que el reloj de la retención dejó de ser una
frase y pasó a ser una columna con dos listas cerradas y un guard.** Eso es exactamente lo que yo
venía pidiendo —`F-8eA3-002` se cerró entero— y es también donde salieron los dos hallazgos más
caros de esta pasada: **las dos listas se escribieron con predicados que no coinciden con los de
sus consumidores.** La lista de escritores dice *«`cubierto` **pasa a** verdadero»* y los dos
únicos lugares que la escriben prueban *«`cubierto` **es** verdadero»*; la lista de lectores dice
**cinco** y enumera **seis**. Las dos son el mismo modo: una lista cerrada es tan buena como la
exactitud de su predicado, y ponerle un guard encima **congela el predicado, no lo verifica**.

**Veintidós hallazgos: 1 `CRITICA`, 10 `ALTA`, 9 `MEDIA`, 2 `BAJA`.**

**Atribución.** De los veintidós, **ocho los introdujo la tanda de arreglos de la 9-bis-4**
—seis la familia de la retención (`F-8fA3-001`, `-002`, `-004`, `-018`, `-020`, `-022`), uno la
ampliación de `G-R6-B` —tercera y cuarta enmiendas de `DEC-TEST-001`— (`-003`) y uno la tanda corta
de las ocho decisiones (`-012`)—, **trece siguen llegando** con su ID viejo (`-005` a `-010`, `-013`
a `-017`, `-019`, `-021`) y **uno es nuevo sobre texto anterior que esta tanda volvió ejecutable**
(`-011`). El único
`CRITICA` lo introdujo un arreglo, y es de la familia de la retención.

**Y tres líneas de rastro resultaron falsas o incoherentes hoy**, las tres sobre el mismo sujeto:
`rastro-5836ec219.md` L180-182 y L247-249, y la resolución del §4 de `rastro-31ce26bb2.md`
—confirmada por su propia tabla del §2—. El detalle está en `## Líneas de rastro que ataqué`.

**Los conteos que uso son míos y los conté sobre el texto de hoy** (2026-09-22, sobre el worktree
`hospeda-spec-hos-1352-billing-redesign`): la tabla de invalidación de `V/02` §3.2 tiene **10**
filas; la lista de consumidores de `inactiva_desde` en `V/02` §2.5 tiene **5 sintagmas y 6
lectores**; la tabla de hechos de `NUCLEO/01` §1.2 tiene **4** filas; `V/20` §2 tiene **17** filas
y `B/20` §2 **16**; la tabla de entidades de `V/02` §2.1 tiene **8** filas; `NUCLEO/04` §3 tiene
**16** filas; los pares con dos destinos de `NUCLEO/03` §1 regla 7 son **4**. Los números que no
medí yo llevan su fuente.

---

## CRITICA

### F-8fA3-001 — El hecho 2 de la lista cerrada de escritores es un CAMBIO y las dos únicas escrituras declaradas prueban un ESTADO: con el predicado de `NUCLEO/01` el contenido de quien volvió se borra si se pierde un aviso, y con el de `V/02` la ficha del excedente no se archiva nunca

**Qué se rompe.** El reloj que decide el único borrado irreversible del programa ya tiene columna,
lista cerrada de escritores y guard. Pero **el hecho que la escribe está enunciado con un
predicado y ejecutado con otro**, y los dos producen sistemas distintos:

- Con el predicado del núcleo —*«`cubierto` **pasa a** verdadero»*, un cambio— la relectura que
  `PB4` y `PB5` hacen antes de archivar **no es ninguno de los cuatro hechos**: en el momento de
  archivar `cubierto` no cambia, ya vale verdadero. Esa relectura es **la única red declarada
  contra el aviso perdido**, y quien la saque —o quien la escriba y la vea en rojo por
  `G-R6-B` mitad (a)— reabre el `CRITICA` que `DEC-DATA-002` cerró: **se le borra el contenido a
  un cliente que volvió y del que se perdió el aviso**.
- Con el predicado que las escrituras usan —*«`cubierto` **es** verdadero» al ejecutar*, un
  estado— `PB4` y `PB5` **reinician el reloj sobre cualquier ficha de cualquier persona cubierta**,
  y con eso nunca archivan a la población del excedente, que está cubierta por definición
  (`F-8fA3-002`).

No hay una tercera lectura. El guard congela una de las dos y nada dice cuál.

**El camino.**

1. El hecho, enunciado como cambio: `NUCLEO/01` §1.2, fila 2 — *«| 2 | **`cubierto` pasa a
   verdadero** | **la respuesta del contrato** … **vuelta a pedir** | volver a estar cubierto **es**
   dejar de estar inactivo |»*.
2. La lista es cerrada y su alcance es **la escritura**: `V/02` §2.5 — *«**Se escribe en los cuatro
   hechos y en ninguna otra parte.** Cada uno de los cuatro del cap. 01 §1.2 le pone el instante en
   que ocurrió; nada más la toca»*.
3. Y el guard compara contra esa lista, textual: `V/20` §2, `G-R6-B` — *«**(a) Escritores**: una
   escritura de la columna —el efecto de una transición, un camino de servicio o un barrido— que
   **no sea uno de los cuatro hechos** del cap. 01 §1.2 (núcleo)»*.
4. Las dos escrituras declaradas prueban un estado, no un cambio: `V/02` §4.2 regla 4 — *«**El
   reinicio es una escritura en `inactiva_desde` (§2.5) y se ejecuta en dos momentos, no en uno**:
   cuando el recálculo que el aviso despierta vuelve a preguntar **y trae `cubierto` verdadero**, y
   —como red— cuando `PB4` o `PB5` **releen antes de archivar**»*. *«Trae verdadero»* y *«relee y
   está cubierto»* son los dos una comprobación de valor.
5. Y `V/03` §9 lo escribe sin ninguna condición de cambio: *«las dos, en el momento de ejecutar,
   **vuelven a pedirle la cobertura al contrato**: si el `user + vertical` está cubierto, no
   archivan y **reinician el reloj** escribiendo `listing.inactiva_desde`»*. `NUCLEO/01` §1.2 lo
   repite para **tres** ejecutores: *«`PB4`, `PB5` y el hard delete del día 180 **releen la
   cobertura** … y, si está cubierta, **reinician el reloj** en vez de avanzar»* — y el tercero, el
   hard delete, **ni siquiera figura como escritor en ninguna de las dos listas**: figura sólo como
   lector (`V/02` §2.5).
6. Que la rama cara es real y no hipotética lo declara el propio diseño: `NUCLEO/01` §1.2 — *«**Y
   como un aviso se puede perder, el que ACTÚA vuelve a preguntar antes de actuar** … sin esta
   relectura el modo de falla cae del lado caro —el aviso que no llega deja el reloj corriendo
   sobre alguien que volvió—, y el propio diseño ya declara que estos avisos se pierden (`V/02`
   §3.2, regla 2)»*.
7. Y el guard **no puede dirimirlo**, porque su propio capítulo declara que no verifica ejecutores:
   `V/20` §2 — *«**No verifica que los cuatro hechos tengan quien los ejecute** … `G-R6` y `G-R6-B`
   juntos certifican *«alguien la mueve»*, *«nadie de más la mueve»* y *«nadie de más la lee»*»*.
   Lo que sí hace es **rechazar escritores fuera de la lista**, y bajo el predicado del núcleo la
   relectura lo es.

**Dónde lo permite el diseño.** `NUCLEO/01` §1.2 (fila 2, el párrafo del aviso perdido y el
párrafo de la lista cerrada), `V/02` §2.5 (la lista de escritores), `V/02` §4.2 regla 4, `V/03` §9
(la nota de `PB4`/`PB5` y el párrafo de la relectura), `V/20` §2 (`G-R6-B`, mitad (a) y el párrafo
del caso que lo rompe).

**Severidad.** `CRITICA`. **Un dato se pierde sin vuelta** en la rama del predicado del núcleo, y
es literalmente el desenlace que `F-8cC1-001` denunció y que `DEC-DATA-002` declaró cerrado: el
contenido publicable de la ficha de alguien que recuperó la cobertura se borra el día 180 porque
el aviso que despertaba el recálculo se perdió y la única red quedó fuera de la lista que el guard
hace cumplir. No falla ruidosamente: el guard se pone en rojo sobre **el arreglo**, no sobre el
defecto, así que la reacción natural del que lo vea es sacar la relectura.

**Marcá `NUCLEO`** — el enunciado del hecho 2 vive en `NUCLEO/01` §1.2.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la familia de la retención** (`rastro-5836ec219`),
más la **tercera enmienda de `DEC-TEST-001`** que le puso el guard. Antes de esta tanda no había
columna, así que *«escribir el hecho 2»* no era un acto con predicado: era una frase sobre un
reloj derivado. La columna, la lista cerrada y el guard llegaron el mismo día; **el predicado no se
volvió a leer contra sus dos ejecuciones**.

**¿Lo habría encontrado el grep?** **No.** Los términos nuevos son `inactiva_desde`, *«los cuatro
hechos»*, *«la lista es cerrada»*, `G-R6-B`, y el rastro declara haberlos grepeado todos con y sin
backticks sobre 51 archivos (`rastro-31ce26bb2` §5). **Los tres párrafos del defecto contienen todos
esos términos y ninguno lo delata**, porque lo que no coincide no es una palabra sino **el modo
verbal**: *«pasa a»* contra *«trae»* y *«está»*. Un grep de `cubierto` devuelve decenas de
apariciones legítimas y ninguna distingue el cambio del estado.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Está en el rastro y su justificación es
incompleta en la dirección exacta del defecto** — el primero de los tres desenlaces del §1.4.
`rastro-5836ec219.md` L245-246 declara: *«**L403 · §4.2 regla 4** — «Lo que reinicia la inactividad
es `cubierto` pasando a verdadero» → **sigue correcta: lo que cambió es de dónde se lee ese hecho,
no cuál es**»*. La línea resuelve *«de dónde se lee»* y **no se pregunta qué se escribe ni con qué
predicado**, que es lo único que la columna nueva agregó. El párrafo inmediatamente siguiente de
ese mismo § —el que declara las dos escrituras— es un hunk que el commit escribió, así que cae
además en la exclusión que `DEC-METH-011` dejó viva: **modo 1 de `C1` §4.4**, la prosa que el
commit escribe. Es el caso limpio de que las dos mitades juntas no alcanzan: la aparición vieja se
resolvió mirando la mitad que no cambió, y la mitad que cambió no se resuelve por ser nueva.

---

## ALTA

### F-8fA3-002 — La relectura incondicional de `PB4` deja a la ficha del excedente fuera de su alcance: la segunda rama de `PB7` que `DEC-DATA-003` creó nace con población vacía, y la línea de rastro que la declara arreglada es falsa

**Qué se rompe.** Un anfitrión baja de Premium a Básico, el reconciliador le despublica tres fichas
por excedente y **su `cubierto` es verdadero de punta a punta** — el propio capítulo lo dice así.
El día 90, `PB4` relee la cobertura, la encuentra verdadera, **no archiva y reinicia el reloj**. Y
vuelve a pasar el día 180 del reloj nuevo, y el siguiente. **La ficha del excedente no llega nunca
a `ARCHIVED`**, así que la segunda rama de `PB7` —*«o el cupo vuelve a alcanzar»*, que
`DEC-DATA-003` agregó **específicamente para esa población**— no tiene sobre qué disparar; y la
retención del §25 no se ejecuta nunca sobre esos datos operativos, que es la otra mitad de
`M-DATA-01`.

**El camino.**

1. El excedente no cambia `cubierto`, y está escrito dos veces: `V/03` §9, `PB2` — *«o el excedente
   tras un downgrade, **que no cambia `cubierto`** y sí el cupo»*; y el párrafo de abajo — *«Y el
   excedente queda como la única causa enumerada, porque es la que **no** cambia `cubierto`: **la
   persona sigue cubierta** y lo que no le alcanza es el cupo»*.
2. La relectura no distingue: `V/03` §9 — *«**si el `user + vertical` está cubierto, no archivan y
   reinician el reloj**»*. No hay condición sobre el estado de la ficha ni sobre por qué está
   abajo.
3. Y el capítulo afirma lo contrario a dos párrafos de distancia: `V/03` §9 — *«**La mitad
   `UNPUBLISHED_BY_BILLING` del `desde` de `PB4` es exactamente la población del excedente**: si
   `PB7` se quedara con el evento único, **la ficha del excedente archivada el día 90** tampoco
   volvería»*. El argumento entero de la segunda rama de `PB7` presupone un archivado que la
   relectura impide.
4. El término dice otra cosa que la relectura: `NUCLEO/01` §1.2 — inactividad es *«el tiempo que
   lleva **sin estar a la vez publicada y cubierta**»*. Una ficha en `UNPUBLISHED_BY_BILLING` de
   una persona cubierta **está inactiva por la definición** —no está publicada— y la relectura la
   trata como activa por la mitad que no le falta.
5. La misma asimetría alcanza a `PB5`: un borrador de cualquier persona cubierta nunca se archiva,
   con lo que *«archivado por inactividad»* de `DEC-TRIAL-007` sólo alcanza a quien no está
   cubierto.
6. Y el propio capítulo razonó **la mitad `PUBLISHED`** del `desde` de `PB4` y no ésta: `V/03` §9 —
   *«**Y la mitad `PUBLISHED` del `desde` de `PB4` deja de ser letra muerta con el término
   definido.** Una ficha publicada y cubierta no acumula inactividad, así que esa mitad sólo alcanza
   a una ficha que quedó **publicada sin cobertura**»*. La otra mitad quedó sin ese ejercicio.

**Dónde lo permite el diseño.** `V/03` §9 (`PB2`, `PB4`, `PB7`, el párrafo de la relectura y el
párrafo final), `V/02` §4.2 regla 4, `NUCLEO/01` §1.2, contra `V/15` §4.2 y `DEC-DATA-003`.

**Severidad.** `ALTA`. Nadie pierde plata ni datos: el resultado es **conservador de más**. Lo que
rompe es que **la mitad de una decisión del owner de esta tanda no tiene población**, que la
promesa de retención del §25 no se cumple sobre esa población, y que tres lugares del corpus
—incluido el que la decisión cita como prueba— afirman un archivado que no ocurre. No es `CRITICA`
porque el desenlace no es un borrado indebido sino un borrado que no llega.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la familia de la retención** — y de las **dos**
piezas a la vez, que es lo que lo hace invisible por separado. La relectura la escribió el hunk de
`V/03` §9 sobre el reloj; la segunda rama de `PB3`/`PB7` la escribió `8ed89adf8` (`DEC-DATA-003`).
Cada una es correcta leída sola; juntas, la primera vacía la población de la segunda.

**¿Lo habría encontrado el grep?** **No, y el rastro lo prueba sin querer.** Los términos son
`PB7`, `cupo` y `excedente`, y `rastro-5836ec219` §6 los recorre **todos** —conté 14 entradas que
los nombran— incluida la que dice *«el excedente … que no cambia `cubierto`»* (L263-264). Las dos
piezas aparecen en el mismo capítulo, en el mismo §, y ninguna búsqueda de texto pregunta *«¿la
guarda de `PB4` deja pasar a la población de `PB7`?»*, que es una composición de dos predicados y
no una aparición.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Está en el rastro y su justificación es
falsa** — el desenlace más fuerte que esta pasada puede producir, y van dos líneas:

- `rastro-5836ec219.md` **L180-182**: *«**L3061 · `DEC-DATA-002`** — «vuelve sola por `PB7` y nunca
  se borra» → **era falsa para el excedente el día que se escribió**, y `8ed89adf8` **la volvió
  verdadera** dándole a `PB7` la segunda rama»*. **No la volvió verdadera**: `PB7` sale de
  `ARCHIVED` y la ficha del excedente no llega ahí.
- `rastro-5836ec219.md` **L247-249**: *«**L404 · §4.2 regla 4** — «`PB7` no llegue a disparar porque
  el cupo no alcanza» → **sigue correcta: con la segunda rama, `PB7` dispara cuando el cupo
  vuelva**»*. Dispara desde `ARCHIVED`, y a `ARCHIVED` esa ficha no entra.

Las dos resoluciones se apoyan en la misma premisa no verificada —*«la ficha del excedente termina
archivada»*— que es exactamente lo que el hunk vecino del mismo commit impide.

---

### F-8fA3-003 — La lista cerrada de consumidores de `inactiva_desde` dice CINCO y enumera SEIS lectores, y el rastro que la midió la cuenta de dos maneras incompatibles: la mitad (b) de `G-R6-B` no tiene contra qué comparar

**Qué se rompe.** La mitad nueva del guard —la que la cuarta enmienda de `DEC-TEST-001` agregó
porque *«falla peor»* que la de escritores— se define como *«una lectura de la columna que **no
figure entre los cinco consumidores** que el cap. 02 §2.5 enumera y cierra»*. Ese § enumera **cinco
sintagmas que nombran seis lectores**, y su propia nota aclaratoria y la tabla del rastro que la
midió reparten esos seis de dos formas que no coinciden. El guard tiene que decidir si *«el aviso
previo al 90»* y *«el aviso previo al 180»* son **uno** o **dos**, y el corpus contesta las dos
cosas.

**El camino.**

1. La lista, textual: `V/02` §2.5 — *«**Y la leen cinco consumidores, y esta lista también es
   cerrada**: `PB4` (día 90) y `PB5` (N meses) del cap. 03 §9, el día 180 del §4.1 de este
   capítulo, **los dos avisos previos** de schedule del cap. 07 §6 (núcleo) y la fecha que el cap.
   19 §4 fila 18 obliga a imprimirle al cliente»*. Los conté: **`PB4`, `PB5`, el hard delete, el
   aviso `-90d`, el aviso `-180d`, la superficie** = **seis lectores**, en **cinco** sintagmas.
2. Y los dos avisos **no son un lector**: `NUCLEO/07` §2 les da ocurrencias distintas —hito
   distinto y fecha objetivo distinta— y `NUCLEO/07` §6 los agenda en dos momentos distintos. Son
   dos sitios de lectura, que es la unidad que el guard recorre.
3. La nota del propio § reparte de una manera: `V/02` §2.5 — *«*(El **quinto** es el aviso al
   archivar, el que `DEC-DATA-002` agregó: los avisos de retención son **tres** … y acá entran **dos
   por el schedule y el tercero por la superficie que imprime su fecha**)*»*. Con el quinto siendo
   la superficie, los dos avisos de schedule ocupan **un** lugar.
4. Y la tabla del rastro que declara haber medido *«dónde nace **cada una de las cinco**»* reparte
   de otra: `rastro-31ce26bb2.md` §2 — *«| `PB4` (día 90) y `PB5` (N meses) | **V6** | · | el día
   180 **y los dos avisos previos** | **V9** | · | la fecha que se le imprime al cliente (`19` §4
   fila 18) | **V8** |»*. Leída literalmente esa tabla enumera **2 + 3 + 1 = seis** bajo el
   encabezado *«las cinco»*.
5. Y el rastro cierra el punto afirmando que quedó resuelto: `rastro-31ce26bb2.md` §4 — *«**Los
   cinco son cinco y los tres avisos están todos.** Queda dicho en el § para que nadie lo lea como
   una lista corta y la «arregle»»*. La lista sigue siendo corta, y la nota explica por qué no
   contradice al núcleo **sin contar los lectores**.
6. El propio rastro deja la puerta abierta como pregunta sin contestar: `rastro-31ce26bb2.md` §8,
   pregunta 1 — *«si el criterio es que los **tres** avisos figuren juntos en el renglón y el quinto
   pase a ser otra cosa, **la lista se reescribe** … ¿Queda como está?»*. Una pregunta abierta no es
   una causa declarada.
7. Y el precedente de por qué esto importa lo escribe el mismo guard: `V/20` §2 — *«**Una lista
   cerrada sin guard es una promesa que en este programa ya se rompió una vez**: `DEC-TEST-001` lo
   dice con el caso —*«la única lista que existía quedó corta en el mismo commit que creó su sexto
   miembro»*»*. Acá la lista quedó corta **en el mismo commit que le puso el guard**, y por un
   miembro.

**Dónde lo permite el diseño.** `V/02` §2.5 (la lista y su nota), `V/20` §2 (`G-R6-B` mitad (b) y
su caso de ruptura), `B/20` §2 (la referencia cruzada, que repite *«cinco consumidores»*),
`NUCLEO/07` §2 y §6.

**Severidad.** `ALTA`. El guard nuevo es la única vigilancia de la mitad que el propio capítulo
declara *«la que falla peor»* —*«un consumidor que nadie registró **lee el reloj y decide con él**,
y el consumidor más caro de esta columna **es el hard delete del día 180**»*— y su allowlist no es
enumerable sin elegir entre dos lecturas del texto. La rama mala es la barata de cometer: contar
cinco sitios de lectura deja **uno de los dos avisos fuera del inventario**, y lo que sale en rojo
es un aviso de retención legítimo, con lo que el arreglo natural es agregarle una excepción al
guard — *«el caso de libro del §2.1»* con las palabras del propio rastro.

**Marcá `NUCLEO`** — no la lista, que es de `V/02`, pero sí su acoplamiento: `NUCLEO/07` §6 es
quien fija que los avisos son tres y quién los cuenta como dos.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la ampliación de `G-R6-B`** (`31ce26bb2` +
`1bd10b987`, cuarta enmienda de `DEC-TEST-001`). La frase *«y la leen cinco consumidores»* y su
nota las escribió `b58abd299` de esa misma tanda; antes no había lista de lectores en ningún lado.

**¿Lo habría encontrado el grep?** **No, y está medido.** El rastro declara haber grepeado
*«cinco consumidores»*, *«los dos avisos previos»* y *«esta lista también es cerrada»*
(`rastro-31ce26bb2` §5) — los tres **están en la frase defectuosa** y ninguno la delata, porque lo
que falla no es una aparición sino la **aritmética entre el numeral y la enumeración**. El propio
rastro anota que el barrido por palabra suelta devolvió *«204 párrafos … ruido que entierra las
apariciones que importan»*; el barrido anclado devolvió la frase y la dio por buena.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y es el caso en que la aparición se
resolvió y el defecto está en el resolver.** La frase es prosa que el commit **escribió**, así que
cae en la exclusión que `DEC-METH-011` dejó viva —**modo 1 de `C1` §4.4`**— y no entra en las 118.
Lo que sí entró, y esto es lo interesante, es la **verificación** de esa lista: el §4 del rastro
declara dos hallazgos sobre ella y los declara resueltos. **La regla se ejecutó, sobre el sujeto
correcto, y el resultado fue una resolución falsa**: se verificó que los tres avisos *estuvieran* y
no que los lectores *fueran cinco*.

---

### F-8fA3-004 — El cuarto hecho de la lista de escritores no tiene ejecutor declarado en ninguna de las dos épicas, y el único acto que corre en ese instante es el caso con que el guard se prueba en rojo

**Qué se rompe.** El día del fin de servicio de una vertical discontinuada, el reloj de retención
de **todas** sus fichas tiene que arrancar ahí. Ninguna transición, ningún barrido y ningún camino
de servicio del corpus está declarado como el que escribe `listing.inactiva_desde` en ese momento.
Lo único que corre en ese instante es `PB2`, y `PB2` escribiendo esa columna es **exactamente el
caso con que `V/20` §2 manda probar el guard en rojo**. Si nadie la escribe, el hard delete cae
sobre la fecha vieja: hasta **90 días antes** de la que los tres avisos de la discontinuación le
prometieron al cliente.

**El camino.**

1. El hecho 4 y su fuente: `NUCLEO/01` §1.2 — *«| 4 | el **fin de servicio** de una vertical
   discontinuada | la columna `vertical.fin_de_servicio` (`V/02` §2.1) … `B/10` §4 ya dice que el
   reloj arranca ahí; **acá queda dicho que arranca ahí y no antes** |»*.
2. Y la obligación de escribir: `V/02` §2.5 — *«**Cada uno de los cuatro** del cap. 01 §1.2 **le
   pone el instante en que ocurrió**»*.
3. Quién lo hace no está en ningún lado. `B/10` §4.3 describe el día y nombra a `PB2`: *«**El día
   del fin de servicio.** Las fichas pasan a `UNPUBLISHED_BY_BILLING` por PB2 del capítulo 03 §9 …
   y **arranca el reloj de retención del §25** … **Y arranca acá, no antes**»*. Es una afirmación
   sobre el reloj, no un efecto de ninguna fila.
4. `PB2` no puede ser el ejecutor, por decisión escrita: `V/20` §2 — *«*(a)*Se le agrega la
   escritura a **`PB2`** —la ficha que cae al perder cobertura— … **Las dos tienen que poner el
   guard en rojo**»*. `V/02` §2.5 lo confirma desde el otro lado, al repartir los cuatro hechos:
   de los cuatro **sólo el tercero es una transición**.
5. Y el guard declara por escrito que no cubre esta mitad: `V/20` §2 — *«**No verifica que los
   cuatro hechos tengan quien los ejecute** … quitarle la escritura a uno de los cuatro … deja a
   los dos en verde. **La mitad que falta es la misma en las dos listas**: ninguna de las dos
   comprueba que sus miembros declarados **existan**»*.
6. La dirección en que falla es la cara, y el número está acotado: entre dos evaluaciones de `PB4`
   hay 90 días, así que `inactiva_desde` en el día del fin de servicio puede tener **hasta 90 días
   de antigüedad**. Sin la escritura del hecho 4 el hard delete cae en `fin_de_servicio + 90` en
   vez de en `+ 180`, sobre una población cuyo contenido el capítulo declara exportable hasta esa
   fecha (`B/10` §4.3: *«los tres avisos de `DEC-MP-002` … con la fecha de fin de servicio, **qué
   pasa con la ficha y cómo exportarla**»*).
7. Y la razón por la que el hecho 4 existe es exactamente esto: `NUCLEO/01` §1.2, fila 4 — *«ahí el
   dueño **no puede** actuar, así que **contar su ausencia lo castigaría por una decisión
   nuestra**»*.

**Dónde lo permite el diseño.** `NUCLEO/01` §1.2 (fila 4 y el párrafo de la lista cerrada), `V/02`
§2.5, `V/20` §2 (`G-R6-B` mitad (a) y su caso de ruptura, y el párrafo de lo que no verifica),
`B/10` §4.3, `B/20` §2.

**Severidad.** `ALTA`. Se pierde contenido antes de la fecha prometida, sin vuelta. No lo marco
`CRITICA` por una razón medida: **los tres avisos de retención cuelgan de la misma columna**
(`NUCLEO/07` §6), así que el aviso *«antes del día 180»* también se adelanta y el cliente igual
recibe un preaviso — lo que pierde es la ventana que el anuncio de la discontinuación le dijo que
tenía, no todo aviso.

**Marcá `NUCLEO`** — el hecho 4 vive en `NUCLEO/01` §1.2.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la familia de la retención**, y la agravó la
tanda de las ocho decisiones. La lista cerrada de escritores y su guard nacen en esta tanda;
`DEC-SUB-015` agregó además una población nueva a ese día —la pausada que no entra al piso— cuya
ficha también arranca su reloj ahí.

**¿Lo habría encontrado el grep?** **No.** El término es `inactiva_desde` y `B/10` §4.3 **no lo
escribe**: dice *«arranca el reloj de retención del §25»* y *«arranca acá, no antes»*. El rastro
declara esa aparición y la resuelve por el término que sí tiene (§2.3 de las instrucciones lista a
`B/10` entre los archivos de la familia). El grep del término nuevo no llega al único párrafo que
describe el momento.

**¿La resolución POR APARICIÓN lo habría atrapado?** **NO está en el rastro y debería estar** —el
segundo desenlace del §1.4—. `rastro-31ce26bb2` §6 grupo G recorre `B/10` y declara **dos**
entradas: *«**`B/10` L158-178** y **L204-205** — *«no dice lo mismo que los tres avisos»*, *«los
tres avisos de `DEC-MP-002`»* → **homónimos**: son los de la discontinuación»*. El párrafo
*«arranca acá, no antes»* —que es el enunciado del hecho 4 visto desde billing y el único lugar
donde ese hecho se ejerce— **no figura entre las 118**. Es una aparición no corregida, en un
párrafo que el commit no tocó, del sujeto exacto del guard.

---

### F-8fA3-005 — `D16` declara que sus dos cifras «son configuración» y `G-R5` las compara, y ninguna de las dos es una columna de ninguna entidad de ninguna de las dos épicas

**Qué se rompe.** `D16` es un invariante **de guard** y su enunciado dice que las dos cifras que
compara **son configuración**. No hay de dónde leerlas: ni el tope de una pausa ni el día del hard
delete son columnas. Quien implemente `G-R5` va a comparar **dos literales escritos en dos
capítulos**, que es la *«premisa que envejece sola»* que `D16` existe para no ser.

**El camino.**

1. `NUCLEO/04` §3, `D16` — *«… **Las dos cifras son configuración**, así que el invariante es la
   relación entre ellas y nunca los números | … | **guard**: compara **el tope de pausa del
   catálogo** contra el día del hard delete»*.
2. Los dos guards lo repiten diciendo **catálogo**: `V/20` §2 — *«el **tope de una pausa** que
   declara el **catálogo**, pasado a días»*; `B/20` §2 — *«el tope de una pausa que declara el
   catálogo —cap. 03 §5 de **esta** épica—»*.
3. El tope no está en el catálogo. `B/03` §5 lo escribe como prosa: *«| **límites** | los del
   §26.3, reexpresados en meses: **4 pausas-mes** por pausa y **8** acumulados en 12 meses»*. Lo
   que la entidad guarda es otro dato: `V/02` §2.1, `plan_version` — *«`rank`, si es vendible, días
   de grace, días de trial, **si permite pausa**, si hereda Turista VIP»*. `permitePausa` es un
   booleano. Lo verifiqué con `rg` sobre las dos épicas el 2026-09-22: **cero** apariciones de
   `pausas-mes` o equivalente en una fila de entidad.
4. El día del hard delete tampoco: `V/02` §4.1 lo escribe como número en prosa y `V/02` §2 no tiene
   ninguna entidad de configuración de retención. La única cifra de la familia que el diseño sí
   declara configurable lleva su declaración escrita: `V/03` §9, `PB5` — *«`N` es configuración»*.
5. Y el guard es el **único** apoyo: `NUCLEO/04` §3 no le da a `D16` ni base ni servicio, y §5 lo
   cuenta en la columna de guards.

**Dónde lo permite el diseño.** `NUCLEO/04` §3 y §5, `V/20` §2 y `B/20` §2, contra `B/03` §5,
`V/02` §2.1 y §4.1.

**Severidad.** `ALTA`. No rompe hoy: 120 < 180 es cierto. Rompe que la única defensa contra que
deje de serlo no tiene de dónde leer ninguno de los dos números.

**Marcá `NUCLEO`** — `D16` vive en `NUCLEO/04` §3.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, entero.** Es `F-8eA3-003`. La 9-bis-4 tocó las
tres filas —`V/20` §2 le agregó a `G-R5` quién lo construye (`B8`), `B/20` §2 lo mismo, y
`NUCLEO/04` §3 le agregó el párrafo de alcance— y **ninguna de las tres creó la columna ni declaró
que no hace falta**.

**¿Lo habría encontrado el grep?** **No.** Los términos son `D16` y `G-R5`, y llegan a las tres
filas que la tanda editó y a `B/03` §5 por la remisión; ahí no aparece el término, aparecen los
**números**.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** `rastro-5836ec219` L183-186 resuelve
las tres apariciones de `D16`/`G-R5` del log con *«siguen correctas: el invariante y el guard
existen y **comparan lo que dicen comparar**»*. La afirmación es sobre el predicado del guard y no
sobre si hay dos fuentes que leer; la pregunta que lo encuentra —*«¿dónde vive el 4?»*, *«¿dónde
vive el 180?»*— es un recorrido de tablas de entidades por la **ausencia**, no una aparición.

---

### F-8fA3-006 — El corte escribe cinco clases de fila y su procedimiento sigue declarando una, y el `piso_del_trinquete` de las dos anclas sigue sin valor honesto posible

**Qué se rompe.** El único documento que fija el orden del corte —secuencia con gate, sin rollback
y con punto de no retorno— tiene cuatro pasos y declara que el cuarto *«es la única escritura del
corte»*. El corte escribe además **dos `permanent_grant` y sus anclas**, y una columna no anulable
de esas anclas no se puede completar con ningún valor honesto.

**El camino.**

1. `16-fase-7` §4.2 — cuatro pasos, y *«**El paso 4 es la única escritura del corte, y es a
   mano.**»*. El § agrega un *«quinto acto que no es del sistema: las llamadas»*, que tampoco los
   nombra.
2. `B/21` §2.5 — *«**Ésta es la única fila que el sistema nuevo sí escribe**»*.
3. Y el § anterior del mismo archivo: `B/21` §2.4 — *«**Las dos cortesías se escriben como
   `permanent_grant`** … **un ANCLA por cada vertical de su scope, sobre UNA sola fila de grant**»*.
   Son como mínimo cuatro filas más la lápida.
4. Verticales depende de que existan y lo declara abierto: `V/21` §2.4 punto 3 — *«**El orden entre
   la escritura de los dos grants y el paso 4 no está fijado en ningún lado, y hay que fijarlo en
   el procedimiento del corte**»*. El procedimiento sigue sin fijarlo.
5. La columna imposible: `B/02` §2.4 — *«| **`permanent_grant_vertical`** | … **el piso del
   trinquete de esa vertical** | … **el piso tampoco es anulable** |»*, con su significado en
   `V/15` §2.5 — *«Su piso es **lo que ese plan otorgaba el día que se firmó el grant**»*. Las dos
   cortesías se firmaron bajo el sistema viejo; esa versión de plan **no existe en el modelo
   nuevo**, porque del lado de verticales *«no se escribe ninguna fila»* (`V/21` §2.4) y el
   catálogo se siembra desde cero.

**Dónde lo permite el diseño.** `16-fase-7` §4.2, `B/21` §2.4 y §2.5, `V/21` §2.4 puntos 1-3,
`B/02` §2.4, `V/15` §2.5.

**Severidad.** `ALTA`. El daño inmediato es chico —las dos cuentas son del owner y *«regenerables
de cero»*—, pero el procedimiento del único momento sin rollback omite una escritura de la que
depende el estado de dos cuentas, y la columna no anulable sin fuente honesta **la hereda todo
grant que se escriba fuera del flujo normal**.

**¿Es nuevo, o es el arreglo?** **Sigue llegando**, con su ID viejo `F-8eA3-004` (y `F-8cA3-013`
antes). La 9-bis-4 **le agregó carga**: `B/02` §2.4 ahora exige además que las tres columnas de la
revocación vayan juntas y que haya *«al menos un ancla, o el grant no otorga nada»*, así que la
escritura manual del corte tiene una restricción más que cumplir y sigue sin figurar en el
procedimiento.

---

### F-8fA3-007 — La fila de `trial` que `T6` y `T7` escriben «consumida, sin reloj» sigue sin poder expresarse: la entidad exige inicio, fin y el piso del trinquete

**Qué se rompe.** Dos de las tres transiciones que salen de `PRE_TRIAL` escriben una fila que la
entidad no admite. La fila de `trial` es **la única evidencia de por vida** de que alguien consumió
su prueba, y `T7` existe para escribirla **sobre una cohorte entera el día del encendido**. Si no
se puede escribir, esa cohorte se queda en `PRE_TRIAL` y el día que publique dispara `T1`: trial
completo, gratis, para toda la cartera de ex-clientes de la vertical a la vez.

**El camino.**

1. `V/03` §2 — `T6` y `T7`, efecto idéntico: *«**crea la fila de `trial`, consumida**, sin reloj y
   sin campaña»*.
2. `V/02` §2.2 — *«| **`trial`** | `user`, vertical, estado …, **referencia a las versiones
   vigentes al arrancar** (el piso del trinquete), **inicio**, **fin** y el hash … |»*. Ninguno de
   los tres se declara anulable, y una fila *«sin reloj»* no tiene ninguno: no arrancó, así que no
   hay *«versiones vigentes al arrancar»*.
3. `V/11` §8.3 paso 3 — *«**ejecutar `T7` sobre la cohorte** … la ventana tiene que ser cero»*.
4. Y toda la defensa del §10.2 descansa en el `UNIQUE(user_id, vertical)` de esa fila.

**Dónde lo permite el diseño.** `V/03` §2, `V/02` §2.2, `V/11` §8.

**Severidad.** `ALTA`. La dirección es *«no se puede hacer»* hasta que alguien lo implemente con
columnas anulables, y ahí la fila nace sin que nadie haya decidido qué significa un `trial` sin
piso ni fechas.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, entero.** Es `F-8eA3-005` (y `F-8cA3-008` antes).
**Ninguno de los 76 commits de la 9-bis-4 tocó `V/02` §2.2 ni el efecto de `T6`/`T7`**: lo
verifiqué contra la tabla del §2.3 de las instrucciones —sólo `rastro-5836ec219` y
`rastro-31ce26bb2` nombran `V/02`, y sus entradas sobre ese archivo son de §2.1, §2.5, §3.2, §4.1 y
§4.2—.

---

### F-8fA3-008 — La restricción «el plan del ancla pertenece a esa vertical» sigue obligando a billing a leer `plan.vertical`, que sigue sin estar en la dirección inversa del contrato

**Qué se rompe.** El invariante 10 se apoya en una restricción de base de una tabla de **billing**
que sólo se puede evaluar leyendo una columna de una tabla de **verticales** que el contrato no
declara legible. Es el acoplamiento no declarado que el §4.1 se escribió para cerrar, sostenido
por el invariante que el propio §4.1 presenta como su mayor logro.

**El camino.**

1. `B/02` §2.4 — *«| **`permanent_grant_vertical`** | … el plan **no es anulable** y **pertenece a
   esa vertical** |»*, y `NUCLEO/04` §2.2 invariante 10 — *«**Y una mitad la sostiene la base**: el
   ancla de un grant es **por vertical** y **su plan pertenece a esa vertical**»*.
2. `12-contrato…` §2.8 pide lo mismo y dice dónde vive: *«la restricción que **la base** tiene que
   hacer cumplir»*.
3. A qué vertical pertenece un plan es dato de verticales: `V/02` §2.1, fila `plan` —
   *«identidad y cosmética: **vertical**, slug, nombre… `UNIQUE(vertical, slug)`»*.
4. Y no está declarado como legible: `12-contrato…` §4.1 enumera tres preguntas
   —`políticaDePlan → { díasDeGrace, díasDeTrial, permitePausa, vigente, vendible }`,
   `situaciónDeVertical → { admiteAltas, finDeServicio }`, `direcciónDeCambio → SUBE | BAJA`—.
   **`plan.vertical` no está en ninguna.**
5. La regla que esto dispara y que nadie disparó: `12-contrato…` §4.2 — *«**si billing necesita
   leer de verticales algo que no está en los seis campos del §4.1, vale lo mismo. Una lectura no
   declarada es un acoplamiento que nadie está mirando.**»*

**Dónde lo permite el diseño.** `B/02` §2.4 y §5, `NUCLEO/04` §2.2, `12-contrato…` §2.8, §4.1 y
§4.2, `V/02` §2.1.

**Severidad.** `ALTA`. No rompe ejecutando. Rompe **la única regla que vigila el corte en dos
épicas**, con una excepción sin declarar justo en el invariante que tres documentos presentan como
el cierre del cruce.

**¿Es nuevo, o es el arreglo?** **Sigue llegando**, con su ID viejo `F-8eA3-008` (`F-8dA3-003`
antes). La 9-bis-4 **volvió a editar la fila** de `permanent_grant_vertical` en `B/02` §2.4 —le
agregó el `UNIQUE` parcial del grant vivo y la nota del ancla viva— y la restricción sigue sin
declararse como lectura.

---

### F-8fA3-009 — El invariante 26 —«la instancia no repite ningún campo del producto», al nivel base en dos lugares— sigue prohibiendo la columna de la que depende que publicar una versión no mueva lo ya comprado

**Qué se rompe.** El invariante 26 está declarado al nivel **base** —el que *«no admite ningún
camino que lo esquive»*— y dice que la instancia no puede repetir ningún campo del producto. La
columna `addon_instance.addon_version_id` **es** esa repetición, y es lo único que impide que
publicar una versión nueva mueva todas las instancias vivas.

**El camino.**

1. `NUCLEO/04` §2.1 — *«| 26 | producto de addon ≠ instancia de addon | **dos tablas, y la
   instancia no repite ningún campo del producto** |»*, y `B/02` §5 palabra por palabra.
2. `B/02` §2.4 — *«| **`addon_product.version_id`** | **qué se vende hoy** |»* y *«|
   **`addon_instance.addon_version_id`** | **qué se compró** … **no se mueve** |»*. En el instante
   de la compra las dos valen lo mismo, por construcción.
3. `12-contrato…` §2.3 la eleva a regla, y `V/02` §2.1 mide el desenlace de resolver la
   contradicción hacia el invariante: *«quien compró *«+30 fotos»* pasaba a tener lo que dijera la
   versión nueva, **sin comprar nada y sin que nadie se lo avisara**»*.

**Dónde lo permite el diseño.** `NUCLEO/04` §2.1 (fila 26), `B/02` §5 (fila 26), contra `B/02`
§2.4, `12-contrato…` §2.3 y `V/02` §2.1.

**Severidad.** `ALTA`. Un invariante de nivel base que el modelo viola **por exigencia** no es un
invariante: es una trampa para el que lo implemente.

**Marcá `NUCLEO`** — la fila 26 vive en `NUCLEO/04` §2.1.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, entero.** Es `F-8eA3-007` (`F-8dA3-004` antes).
Verificado el 2026-09-22 con `rg` sobre los dos archivos: las dos filas 26 están idénticas.

---

### F-8fA3-010 — Una cortesía durante el trial sigue sin poder tener fila, y esta tanda le cargó un segundo escritor más a la columna que lo impide

**Qué se rompe.** El §34.1 del PDR —una cortesía durante el trial extiende el trial— sigue vivo
como camino en cuatro lugares, incluido el **evento de una transición**, y la entidad que lo
soportaría no lo admite. El acto no tiene fila: no se audita, no tiene origen, y el techo de días
de `V/11` §3 no puede contarlo.

**El camino.**

1. `B/02` §2.4 — *«| **`courtesy_grant`** | beneficiario, días o meses, inicio, fin, quién lo
   firmó, motivo, **la suscripción que pausa** y **`saldo_días`** | … la suscripción **no es
   anulable** … |»*. Quien está en trial no tiene suscripción.
2. `V/03` §2, `T4` — *«| T4 | `TRIAL_ACTIVE` | **promo de extensión o cortesía** | … |»*.
3. `V/11` §3.2 — *«Toda extensión cuenta contra ese mismo techo, venga de un promo del §32 o de
   **una cortesía del §34.1**»*; `B/14` §4.5 la declara resuelta allá.
4. Y las dos lecturas siguen siendo las dos malas: instrumentada con `courtesy_grant`, la fila no
   se puede escribir; no instrumentada, es un cuarto instrumento sin tabla que `NUCLEO/01` §1.5
   —que enumera **tres** concesiones— no declara.

**Dónde lo permite el diseño.** `B/02` §2.4, `V/03` §2 (`T4`), `V/11` §3.2, `B/14` §4.5,
`NUCLEO/01` §1.5.

**Severidad.** `ALTA`. Un acto que entrega servicio gratis —el que `D11` manda que confirme una
persona— **no tiene fila donde quedar**.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, y la 9-bis-4 lo agravó otra vez.** Es
`F-8eA3-006` (`F-8dA3-006` antes). Lo que esta tanda hizo fue **cargar más la columna**:
`DEC-GRANT-007` le sumó el `saldo_días` y `DEC-GRANT-010` le dio a `S25` como **segundo escritor**
de ese saldo. Cada carga nueva sobre la fila vuelve más caro volver anulable la columna que la
bloquea, y ninguna de las dos decisiones miró el caso del trial.

---

### F-8fA3-011 — Exportar una ficha archivada reinicia el reloj: la mitigación que el diseño declara como la condición de que el borrado sea defendible es lo que impide que el borrado ocurra

**Qué se rompe.** El hecho 1 de la lista cerrada de escritores incluye **exportarla**. El aviso del
archivado, que es transaccional no suprimible, le dice al dueño que **puede exportarla**. Un dueño
que hace lo que el aviso le dice **reinicia el reloj**, y el día 180 se corre 180 días más adelante,
cada vez. La retención del §25 —*«hard delete a los 180 días de datos operativos eliminables»*— no
se cumple nunca sobre nadie que exporte, y el borrado que el diseño defiende **con** la exportación
es el que la exportación cancela.

**El camino.**

1. `NUCLEO/01` §1.2, fila 1 — *«| 1 | un **acto del dueño** sobre la ficha: crearla, editarla,
   publicarla, despublicarla, **exportarla**, reactivarla | … | alguien la está usando, que es lo
   contrario de estar inactiva |»*.
2. La exportación es lo que se le ofrece al archivado: `V/02` §4.2 regla 3 — *«**El día 90 no borra
   nada.** La ficha sale del sitio público, **el dueño la sigue viendo** y puede **exportarla** o
   reactivarla a borrador sin pagar nada … **Poder exportar antes es lo que hace defendible el hard
   delete del día 180**»*.
3. Y se le dice por escrito: `V/19` §4 fila 18 — *«que la sigue viendo y **puede exportarla**»*,
   más *«**la fecha** a partir de la cual el contenido sí se borra, que es **`listing.inactiva_desde`
   - 180**»*. Las dos frases están en el mismo correo: la fecha que le imprimimos deja de ser
   cierta en el acto en que ejerce lo que ese mismo correo le ofrece.
4. Y la columna es la fuente, no una derivación: `V/02` §4.1 — *«el 180 es `inactiva_desde + 180`;
   **el trabajo que hace el reloj es de la columna**»*.
5. El contraste que lo vuelve un defecto y no una decisión: el mismo hecho 1 incluye **reactivarla**
   —`PB8`—, y ahí el reinicio es correcto: la ficha vuelve a `DRAFT` y hay algo vivo. Exportar deja
   la ficha en `ARCHIVED` **exactamente como estaba** y sólo mueve el reloj.

**Dónde lo permite el diseño.** `NUCLEO/01` §1.2 (fila 1), `V/02` §4.1 y §4.2 regla 3, `V/19` §4
fila 18, `V/03` §9 (nota de `PB4`).

**Severidad.** `ALTA`. No se pierde ningún dato: **no se borra ninguno**, y ésa es la falla. El
§25 es una obligación de retención, `M-DATA-01` es el hueco que `V/02` §4 cierra, y el mecanismo
entero queda inejecutable para cualquiera que use la salida que le ofrecemos. Además vuelve falsa,
por escrito y en un correo obligatorio, la fecha que `V/19` fila 18 obliga a imprimir.

**Marcá `NUCLEO`** — la fila 1 vive en `NUCLEO/01` §1.2.

**¿Es nuevo, o es el arreglo?** **Nuevo de esta pasada sobre texto que escribió `DEC-DATA-002`
(9-bis-3), y lo volvió ejecutable la 9-bis-4.** Con el reloj derivado, *«exportar reinicia»* era una
frase sobre un valor que nadie guardaba; con la columna, es una escritura concreta que el guard
acepta porque el hecho 1 está en la lista.

**¿Lo habría encontrado el grep?** **No.** Los términos nuevos son `inactiva_desde` y *«los cuatro
hechos»*. `V/02` §4.2 regla 3 —el párrafo que ofrece exportar— **no contiene ninguno de los dos**:
habla de `DEC-DATA-001`, de `PB7` y de `PB8`. El único término compartido es *«exportarla»*, que no
es un término que la tanda redefina.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Está en el rastro, resuelta a medias.**
`rastro-7676082e6.md` L215-216: *«… el instante de su creación, que es el hecho 1»* → **sigue
correcta**, y es **la única celda donde el hecho 1 aparece como escritura en el alta**. El guard la
acepta: el hecho 1 está en la lista»*. La resolución certifica **un** acto de los seis que el hecho
1 enumera —*crearla*— y declara en la misma línea que es la única celda donde el hecho 1 aparece
como escritura, sin recorrer los otros cinco. *«El guard la acepta»* es cierto y es precisamente el
problema: el guard acepta también a *exportarla*.

---

## MEDIA

### F-8fA3-012 — `V/03` §2 congela en TRES los pares con dos destinos y el mismo archivo, el núcleo y `V/20` §2 dicen CUATRO; el barrido que corrigió las otras cinco copias entró al archivo y no a ese §

**Qué se rompe.** La lista de pares `(desde, evento)` con dos destinos es **lo que `G-R4` cuenta**,
y el capítulo que **es dueño del primero de esos pares** afirma que son tres y enumera dos de los
otros. Quien implemente `G-R4` leyendo el § que explica el par lo congela en tres y el guard deja
de contar lo que dice contar.

**El camino.**

1. `V/03` §2 — *«`T1` y `T6` comparten `desde` y `evento` … y **uno de los tres** que el diseño
   declara hoy — **los otros dos son `S5`/`S19` y `S7`/`S19`** … (`B/03` §3.2; la lista está en el
   cap. 03 (núcleo) §1 regla 7). **Lo cuenta `G-R4` sobre las nueve tablas, no una lectura a
   mano.**»*
2. La lista que cita dice cuatro: `NUCLEO/03` §1 regla 7 — *«Los pares con dos filas y dos destinos
   distintos que el diseño declara hoy son **cuatro**, en dos tablas»*, con `(PAUSED, llega el fin
   de la pausa…)` → `S10`/`S25` como cuarto.
3. El mismo archivo, un § más abajo, ya dice cuatro: `V/03` §9 punto 2 — *«**`PB7`/`PB8` no agregan
   ninguno** a los pares con dos destinos, que desde la FASE 9-bis-4 son **cuatro** —el cuarto es
   `S10`/`S25`—»*.
4. Y `V/20` §2 también, con la corrección de la vuelta anterior escrita al lado: *«los pares con dos
   destinos que el diseño declara hoy son **cuatro** … *(Este párrafo decía que `T1`/`T6` era el
   único; ya no lo era desde que `S19` compartió par con `S5` y con `S7`.)*»*.

**Dónde lo permite el diseño.** `V/03` §2 (el § *«`T1` y `T6` comparten el par»*), contra `V/03`
§9 punto 2, `NUCLEO/03` §1 regla 7 y `V/20` §2.

**Severidad.** `MEDIA`. El consumidor real es la lista del núcleo y el guard cuenta solo, así que
el daño concreto está acotado; lo que queda mal es el único § que explica **por qué** el par es
disjunto, leído por quien implemente el par.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la tanda corta de las ocho decisiones**
(`DEC-SUB-015`, `5d412ae60`, que creó `S10`/`S25`).

**¿Lo habría encontrado el grep?** **No, y está medido en el rastro.** Los términos viejos que el
rastro declara haber grepeado son *«tres pares»* y *«el único par con dos destinos»*
(`rastro-8d6b27a12` §2). `V/03` §2 **no escribe ninguno de los dos**: escribe *«uno de los **tres**
que el diseño declara hoy»*. Es el mismo numeral, con otra sintaxis.

**¿La resolución POR APARICIÓN lo habría atrapado?** **NO está en el rastro y debería estar.** La
tabla del §4 de `rastro-8d6b27a12` enumera las premisas corregidas y nombra `V/03` **§9** entre
ellas —*«`NUCLEO/03` §1 regla 7 · `NUCLEO/04` 22 y `D15` · `12-contrato…` §2.6 · **`V/03` §9** ·
`V/20` §2 · `NUCLEO/01` §2.6 | … tres pares … | … cuatro …»*—, y el §3 del mismo rastro, que lista
las 91 apariciones no corregidas, **no tiene ninguna sección para `V/03`**. O sea: el commit abrió
el archivo, corrigió el § de abajo y el § de arriba no figura ni como corregido ni como
justificado. Es el caso textual de la obligación 1: *«un archivo abierto no es un párrafo leído»*.

---

### F-8fA3-013 — La lista de invalidación del caché tiene diez filas, su propia frase de cierre afirma once, y su segundo consumidor sigue diciendo siete

**Qué se rompe.** El reconciliador de excedentes se dispara con *«la misma lista»* que invalida el
caché y lee un número que ya no es el de la lista. Que a veces se dispare de más es gratis; que
falte un disparo *«es una capacidad regalada o un límite incumplido»*, y lo dice el propio capítulo.

**El camino.**

1. **Las conté el 2026-09-22: `V/02` §3.2 tiene 10 filas.**
2. Su frase de cierre: `V/02` §3.2 — *«**Las cuatro últimas son de la FASE 9 y ninguna entraba por
   las siete de arriba.**»* 7 + 4 = **11**.
3. El segundo consumidor: `V/15` §4.2 — *«no hace falta una lista nueva: **es la misma lista que
   invalida el caché** (cap. 02 §3.2), con **sus siete entradas**»*.
4. Y el contrato repite la frase sin número: `12-contrato…` §3.

**Dónde lo permite el diseño.** `V/02` §3.2, `V/15` §4.2, `12-contrato…` §3.

**Severidad.** `MEDIA`. Lo acota que el consumidor real es la lista y no el número; lo que queda
mal es el único mecanismo escrito para saber si la lista está completa — y esta tanda le dio a esa
lista un consumidor más caro: el recálculo del cupo que dispara la segunda rama de `PB3`/`PB7`.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, entero.** Es `F-8eA3-009` (`F-8cA3-012` antes).
Ninguno de los 76 commits tocó ninguno de los dos números; `rastro-5836ec219` §6 recorre `V/15` y
declara sus entradas por otro sujeto.

---

### F-8fA3-014 — Los campos de la dirección inversa del contrato se cuentan de tres maneras: el §4.1 dice siete, el §4.2 dice seis y `V/02` dice seis

**Qué se rompe.** La regla de vigilancia del corte entre épicas se enuncia sobre *«los seis campos
del §4.1»* y el §4.1 declara **siete**. Quien la aplique sobre seis deja un campo fuera de la
vigilancia sin que nada lo señale, y el campo que se agregó último —`vigente`/`vendible`— es
justamente el que el propio § declara que *«era la diferencia entre que el acoplamiento se cortara
o siguiera llegando»*.

**El camino.**

1. `12-contrato…` §4.1 — el bloque enumera `díasDeGrace, díasDeTrial, permitePausa, vigente,
   vendible` + `admiteAltas, finDeServicio` = **siete**, y lo dice: *«**Son siete campos en tres
   preguntas**»*.
2. `12-contrato…` §4.2 — *«si billing necesita leer de verticales algo que no está en **los seis
   campos** del §4.1»*.
3. `V/02` §2.1 — *«Son dos de **los seis campos** de la dirección inversa del contrato»*.

**Dónde lo permite el diseño.** `12-contrato…` §4.1 y §4.2, `V/02` §2.1.

**Severidad.** `MEDIA`. No rompe una ejecución; deja la regla de vigilancia enunciada sobre un
conjunto más chico que el declarado, que es el mismo modo por el que `F-8fA3-008` lleva tres vueltas
sin dispararse.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, entero.** Es `F-8eA3-010`. Ninguno de los 76
commits tocó el §4.1 ni el §4.2.

---

### F-8fA3-015 — El techo de días de trial por vertical sigue sin columna, y `vertical` ya lleva cuatro cosas bajo la frase que justifica no hacerle una tabla diciendo que «hoy hay una sola cosa que configurar»

**Qué se rompe.** `V/11` §3.2 declara que **cada vertical declara un máximo de días de trial
acumulados**, *«en base y no en código»*, y la entidad `vertical` no lo guarda. Y el *«total
acumulado de días de trial, **con su origen**»* que `V/11` §3.5 obliga a mostrar en dos superficies
tampoco tiene dónde vivir: la entidad `trial` guarda inicio y fin, no una serie de extensiones con
procedencia.

**El camino.**

1. `V/11` §3.2 — *«**Cada vertical declara un máximo de días de trial acumulados por
   `user + vertical`**, en base y no en código (§9)»*.
2. `V/11` §3.5 — *«**El total acumulado de días de trial, con su origen, se muestra en dos
   lugares**»*; `V/19` §4 fila 4 lo repite.
3. La entidad: `V/02` §2.1 — *«| **`vertical`** | el espejo en base del enum de código, **su evento
   de activación**, **si admite altas** y **su fecha de fin de servicio** |»*. No hay techo.
4. Y la fila `trial` de `V/02` §2.2 guarda *«inicio, fin»*, no las extensiones.
5. Y la justificación de no hacer una tabla sigue escrita sobre un conteo que ya no vale: `V/02`
   §2.1 — *«Va en `vertical` y no en una tabla de configuración … y hoy **hay una sola cosa que
   configurar**; si mañana aparece la segunda, pasar de columna a tabla es trivial»*. **Conté las
   cosas configurables que esa misma fila ya declara: cuatro**, más el techo que `V/11` pide.

**Dónde lo permite el diseño.** `V/11` §3.2 y §3.5, `V/02` §2.1 y §2.2, `V/19` §4 fila 4.

**Severidad.** `MEDIA`. Nadie paga de más; lo que falla es que un tope declarado *«en base»* no
tiene base, y el único apoyo que `V/11` §3.4 le da al techo frente a un canje self-service es la
lectura de ese número.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, entero.** Es `F-8eA3-013`. La 9-bis-4 no tocó
`V/11` §3 y **no le agregó ninguna columna a `vertical`**.

---

### F-8fA3-016 — El glosario, que se declara dueño de los nombres, sigue diciendo que el producto de addon guarda la duración, los efectos y el tipo de scope, y sigue dándole al grant «su scope de verticales»

**Qué se rompe.** El núcleo es *«el dueño de los nombres»* y describe dos entidades con campos que
el modelo les quitó por decisión escrita. Quien implemente leyendo el glosario reconstruye el corte
por entidad que el §11.2 declara equivocado.

**El camino.**

1. `NUCLEO/01` §1.3 — *«| **Addon: producto** | La definición: capability, precio, recurrencia,
   verticales compatibles, **duración**, **efectos**, **tipo de scope** (§39). |»*.
2. `B/02` §2.4 — *«| **`addon_product`** | **precio, recurrencia y verticales compatibles**, más
   **`version_id`** |»*, y `V/02` §2.1 — *«| `addon_version` | qué otorga y con qué valores,
   vigencia, tipo de scope | **VERTICALES** |»*. El corte es por campo y está escrito en las dos
   épicas.
3. `NUCLEO/01` §2.x — *«└── Grant permanente (§35, **con su scope de verticales**)»*, contra `B/02`
   §2.4 — *«**El scope de verticales NO es una columna: son sus anclas**»*.

**Dónde lo permite el diseño.** `NUCLEO/01` §1.3 y su mapa de fuentes, contra `B/02` §2.4 y `V/02`
§2.1.

**Severidad.** `MEDIA`. No rompe ejecutando, y el corpus tiene la versión correcta en dos lugares.
Rompe el único documento que se declara la referencia de nombres.

**Marcá `NUCLEO`.**

**¿Es nuevo, o es el arreglo?** **Sigue llegando, entero.** Es `F-8eA3-011`. La 9-bis-4 editó
`NUCLEO/01` en cuatro familias distintas y ninguna abrió el §1.3.

---

### F-8fA3-017 — `V/02` §4 sigue citando `(§2.6)` para `domain_event` sobre un capítulo que no tiene §2.6, y `PB7` y el criterio de orden leen de esa entidad los dos datos que deciden qué ficha vuelve

**Qué se rompe.** El capítulo remite a un § propio que no existe para justificar la única decisión
de modelo que hace posible la retención, y esta tanda le agregó **dos consumidores más** a la
entidad remitida: el origen que `PB7` consulta y la fecha de publicación con la que se ordena la
cola de restitución. Quien vaya a buscar qué guarda `domain_event` en este capítulo no encuentra
nada.

**El camino.**

1. `V/02` §4 — *«Por eso `domain_event` guarda **referencias y campos que cambiaron, no copias**
   (§2.6)»*. **Conté los § del capítulo: §2.1, §2.2, §2.5, §3, §4, §5.** No hay §2.6; la entidad
   vive en `NUCLEO/02` §2.6.
2. Y los consumidores nuevos: `V/03` §9 — *«el origen no necesita ninguna columna nueva: ya está
   escrito. **El evento de dominio de `PB4` y el de `PB5` guardan *«los campos que cambiaron, con su
   valor anterior y el nuevo»* (cap. 08 §1.2, núcleo)**»*, y *«**El dato con el que se ordena ya
   existe y no pide columna nueva**: cuándo se publicó cada ficha … Sale del registro append-only»*.
   Los dos citan el núcleo y no este §2.6 inexistente, lo que confirma dónde vive.

**Dónde lo permite el diseño.** `V/02` §4, contra `NUCLEO/02` §2.6 y `NUCLEO/08` §1.2-§1.3.

**Severidad.** `MEDIA`. Es una remisión rota, no un defecto de datos; la subo de `BAJA` porque la
entidad a la que remite pasó a sostener, en esta tanda, **qué ficha vuelve primero cuando el cupo
no alcanza para todas** — una decisión de visibilidad pública que el capítulo declara que no puede
quedar en el orden de recorrido de una implementación.

**¿Es nuevo, o es el arreglo?** **Sigue llegando**, con su ID viejo `F-8eA3-018`. Lo que la 9-bis-4
agregó son los dos consumidores.

---

### F-8fA3-018 — El quinto consumidor de `inactiva_desde` es el aviso de `PB4` y `PB5` también archiva: la ficha que archiva `PB5` no tiene aviso de archivado, y el calendario de los tres avisos no es el de su transición

**Qué se rompe.** Los tres avisos de retención se agendan sobre **el día 90 y el día 180** y la
única superficie que los acompaña está escrita para `PB4`. `PB5` archiva **a los `N` meses**, que es
otro número y es configuración. Para la población de `PB5` —los borradores, que es la población que
`DEC-TRIAL-007` crea— el aviso previo anuncia un archivado que ese día no ocurre, **el aviso del
archivado no tiene superficie**, y si se reusara el de `PB4` prometería algo que `PB7` tiene
prohibido cumplir.

**El camino.**

1. `NUCLEO/07` §6 — *«| retención | transaccional | antes del día 90, **al archivar** y antes del
   día 180, **los tres contados sobre `listing.inactiva_desde`** |»*. Los tres cuelgan de 90 y 180.
2. `V/03` §9, `PB5` — *«| PB5 | `DRAFT` | **`N` meses** de inactividad, contado sobre
   `listing.inactiva_desde` | `ARCHIVED` | `DEC-TRIAL-007`; **`N` es configuración** |»*. `N` meses
   no es el día 90.
3. La única superficie: `V/19` §4 fila 18 — *«el aviso de **ficha archivada** (**`PB4`, día 90**)»*.
   `PB5` no aparece.
4. Y su contenido sería falso para `PB5`: la fila promete *«que **vuelve sola** cuando recupere la
   cobertura —o cuando el cupo vuelva a alcanzar— si hay lugar para ella (`PB7`)»*, y `PB7` exige
   *«**y el evento que la archivó dice que venía de `PUBLISHED` o de `UNPUBLISHED_BY_BILLING`**»* —
   `V/03` §9 lo razona: *«Una vuelta automática que no las distinguiera **publicaría el borrador de
   alguien que nunca pidió publicarlo**»*.
5. Y el borrador se borra igual: `V/02` §4.1 — *«**Se borra** al día 180 | el contenido publicable
   de la ficha …, **los borradores**, …»*.

**Dónde lo permite el diseño.** `NUCLEO/07` §6, `V/19` §4 fila 18, `V/03` §9 (`PB5`, `PB7`), `V/02`
§4.1 y §2.5.

**Severidad.** `MEDIA`. Se borra contenido —borradores— con un aviso previo que apuntaba a otra
fecha y sin el aviso del archivado, que `NUCLEO/07` §4.1 declara *«el que menos se puede suprimir de
los tres»*. No es `ALTA` porque el aviso *«antes del día 180»* sí cuelga del mismo reloj que el
borrado y llega.

**Marcá `NUCLEO`** — el calendario de los tres avisos vive en `NUCLEO/07` §6.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la familia de la retención**, que agregó el tercer
aviso (*«al archivar»*, `F-8cC1-001`) y la fila 18 de `V/19` como su superficie, las dos escritas
sobre `PB4` y el día 90.

**¿Lo habría encontrado el grep?** **Sí, y es el hallazgo barato de esta pasada.** El término es
`PB5`, y aparece en la misma tabla que `PB4` en `V/03` §9 y en el mismo renglón de consumidores de
`V/02` §2.5 — *«`PB4` (día 90) y `PB5` (N meses)»*, con los dos números escritos uno al lado del
otro.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Está en el rastro y la justificación no mira
la mitad que falla.** `rastro-31ce26bb2.md` L279-282: *«**`V/03` L290-299 · la tabla `PB1`-`PB8`** —
`PB4` y `PB5` *«contado sobre `listing.inactiva_desde`»* → **siguen correctas y ahora son
consumidores inventariados: están en los cinco**»*. La resolución verifica que `PB5` **esté en el
inventario de lectores** y no que **lo que lee** case con el calendario de los avisos que cuelgan de
la misma columna.

---

### F-8fA3-019 — `G-R2-B` sigue mirando sólo el plan y `V/15` §2.5 le encarga además el piso por vertical

**Qué se rompe.** El trinquete del grant se compara **por vertical**, y `V/15` §2.5 dice
textualmente que *«lo vigila `G-R2-B`»*. El predicado del guard, en las dos copias del catálogo,
habla sólo del **plan**. Un piso mal apuntado —el de Alojamiento comparado contra las claves de
Gastronomía— pasa el guard entero.

**El camino.**

1. `V/15` §2.5 — *«**Y se compara POR VERTICAL, que es la parte que la resolución no puede deducir
   sola** … Un piso único para un grant de scope plural compararía las claves de Gastronomía contra
   lo que otorgaba un plan de Alojamiento … **Lo vigila `G-R2-B`** (`V/20` §2)»*.
2. `V/20` §2 — *«| G-R2-B | una fuente `GRANT` transporta **un plan de otra vertical** que la de la
   fuente | cap. 15 §2.5, `12-contrato…` §2.8 |»*. Sólo el plan.
3. Y la columna existe y es distinta del plan: `B/02` §2.4 — el ancla guarda *«**el `plan` que
   otorga en esa vertical** y **el piso del trinquete de esa vertical**»*: dos referencias.

**Dónde lo permite el diseño.** `V/15` §2.5, `V/20` §2 (`G-R2-B`), `B/02` §2.4.

**Severidad.** `MEDIA`. El daño es un piso que otorga de más o de menos sobre el instrumento más
caro del sistema, acotado a grants de scope plural.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, entero.** Es `F-8eA3-014`. El §2.1 de `V/20`
—*«el texto con que falla no puede afirmar más de lo que el predicado verifica»*— se aplicó en esta
tanda a `G-R6-B` y no a éste.

---

### F-8fA3-020 — Un aviso de retención ya encolado no se cancela ni se re-agenda cuando el reloj se reinicia, y las cuatro transiciones que tendrían que hacerlo no existen

**Qué se rompe.** La clave del outbox ahora lleva la fecha objetivo, así que un hito que se mueve
**vuelve a corresponder**. Lo que nadie hace es **retirar el anterior**. El dueño de una ficha
archivada recibe *«tu contenido se borra el `<fecha vieja>`»* de una fila encolada antes del
reinicio, y después el aviso nuevo con otra fecha. El correo que `V/19` fila 18 obliga a mandar con
una fecha exacta pasa a mandar dos fechas distintas para el mismo hecho.

**El camino.**

1. La clave arregla la **supresión** y no la **obsolescencia**: `NUCLEO/07` §2 — *«La fecha objetivo
   va en la ocurrencia SIEMPRE … **todo hito de schedule cuelga de una fecha, y toda fecha de la que
   cuelga un hito se puede mover**»*.
2. Y encolar es anterior al envío: `NUCLEO/07` §2 — *«**La clave se calcula antes de encolar, no
   antes de enviar.**»* Entre encolar y enviar el reloj puede reiniciarse por cualquiera de los
   cuatro hechos.
3. El corpus sí escribe ese efecto donde el sujeto es una transición: `V/03` §2, `T4` — *«corre la
   fecha de fin; **re-agenda** la campaña previa»*; `T2` — *«**se cancela** la campaña previa»*;
   `T5` — *«corta la campaña de recuperación»*.
4. Y para la retención no hay dónde escribirlo: de los cuatro hechos **sólo el tercero es una
   transición** (`V/02` §2.5), así que tres de los cuatro reinicios no tienen fila con columna de
   efectos donde poner *«re-agenda los tres avisos»*.
5. El aviso afectado no es cualquiera: `NUCLEO/07` §4.1 — los tres de la retención son
   *«transaccional, no suprimible»*, y *«si cayeran bajo el opt-out comercial, **se dejaría de
   avisar justo a quien está por perder su contenido**»*.

**Dónde lo permite el diseño.** `NUCLEO/07` §2, §4.1 y §6, `NUCLEO/01` §1.2, `V/02` §2.5 y §4.2
regla 4, contra `V/03` §2 (`T2`, `T4`, `T5`).

**Severidad.** `MEDIA`. No se pierde ningún dato y no se suprime ningún aviso: **sobra uno**, con
una fecha falsa, en el correo cuya exactitud `V/19` fila 18 declara obligatoria.

**Marcá `NUCLEO`** — la clave y el catálogo viven en `NUCLEO/07`.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la familia de la retención**, y es el residuo
exacto de su propio cierre. `F-8eA3-001` denunciaba la supresión del segundo envío y el arreglo
—la fecha objetivo en toda ocurrencia— la cerró; la dirección contraria, el envío viejo que ya no
corresponde, no se tocó.

**¿Lo habría encontrado el grep?** **Sí, y por un término que el rastro declara haber grepeado.**
*«re-agenda»* aparece en `V/03` §2 (`T4`) y en `NUCLEO/07`; el §2 del outbox cita a `T4` como el
caso que motivó la regla. Lo que no se preguntó es qué pasa con la fila anterior.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No: cae en la exclusión.** El § entero de la
regla de la fecha objetivo, con su recuadro de advertencia, es **prosa que el commit escribió** —
**modo 1 de `C1` §4.4**—. La aparición de `T4` en `V/03` §2 sí está en el rastro
(`rastro-5836ec219` §6 la recorre) y se resuelve por el sujeto correcto: la re-agenda del trial
sigue siendo cierta. El defecto no está en esa aparición sino en la que **no se escribió** para la
retención.

---

## BAJA

### F-8fA3-021 — El `UNIQUE(hash_del_correo_normalizado, vertical)` hace que `T1`, `T6` y `T7` no puedan escribir su fila para quien se re-registró, y ninguna máquina declara qué pasa entonces

**Qué se rompe.** La restricción es correcta y necesaria —es lo que cierra el §10.2 por la puerta
del re-registro—, pero **rechaza un `INSERT` que tres transiciones declaran como su efecto**, y
ninguna de las tres tiene rama para el rechazo. Por la regla 1 del `NUCLEO/03` §1, un efecto que no
se puede ejecutar es un incidente.

**El camino.** `V/02` §2.2 — *«**`UNIQUE(hash_del_correo_normalizado, vertical)`**, sin condición de
estado»*; `V/03` §2 — `T1`, `T6` y `T7` tienen *«crea la fila de `trial`»* como efecto y ninguna
declara qué pasa si la fila ya existe para otro `user_id` con el mismo hash.

**Severidad.** `BAJA`. El desenlace correcto es evidente —esa persona ya consumió su trial— y lo
que falta es escribirlo como rama en vez de dejarlo en la restricción.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, entero.** Es `F-8eA3-016`. `T7` es de la 9-bis-3
y hereda el mismo efecto sin la rama.

---

### F-8fA3-022 — La lista de restricciones de `V/02` §5 sigue teniendo cuatro filas y el capítulo ya declara seis restricciones de base propias

**Qué se rompe.** `V/02` §5 se presenta como *«los que **la base puede hacer cumplir sola**»* y es
el único inventario de ese nivel del lado de verticales. Esta tanda le agregó al capítulo dos
restricciones de base más —`inactiva_desde` no anulable y el `UNIQUE(hash, vertical)`— y ninguna
entró a la tabla.

**El camino.** `V/02` §5 tiene **cuatro** filas (invariantes 1, 2, 11 y el dominio cerrado de las
columnas de estado), contadas el 2026-09-22. Y el capítulo declara además: `V/02` §2.5 —
*«**`inactiva_desde` no es anulable**»*— y `V/02` §2.2 — *«**`UNIQUE(hash_del_correo_normalizado,
vertical)`**, sin condición de estado»*, que el propio § declara *«una condición de aplicación, no
una tarea suelta»*. `NUCLEO/04` §2.1 tampoco las cuenta: sus seis siguen siendo seis.

**Severidad.** `BAJA`. El inventario no es el que hace cumplir nada; lo que se pierde es el único
lugar donde preguntar *«¿están todas?»* sobre el nivel que `NUCLEO/04` §1 define como el que **no
admite ningún camino que lo esquive**.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la familia de la retención**, que creó la primera
de las dos restricciones sin tocar el §5 del mismo archivo.

---

## Ataques que intenté y el diseño resistió

- **Romper la nueva `UNIQUE(beneficiario) WHERE revocado_en IS NULL` contra los dos grants del
  corte.** No: `V/21` §2.4 y `B/21` §2.4 hablan de **dos cuentas** distintas —*«lo de abajo vale
  para seis de las ocho»*—, así que son dos beneficiarios y el índice parcial no colisiona. Y
  `B/02` §2.4 anticipa la alternativa equivocada por escrito: *«escribir **dos grants** de una
  vertical cada uno es el otro extremo»*.
- **Hacer que `S25` deje una cortesía sin destino que rompa el modelo de datos.** No: `B/02` §2.4
  le dio a `courtesy_grant` el `saldo_días` anulable y declaró a `S25` como su **segundo escritor**
  con la misma forma que `S18`; y el caso sin destino está declarado con causa en `DEC-GRANT-010`,
  que el §4 de las instrucciones excluye.
- **Que el `UNIQUE` parcial de grants vivos deje al beneficiario sin poder recibir un grant nuevo
  tras una revocación.** No: `revocado_en` escrito saca la fila del índice parcial, y `B/02` §2.4
  declara que *«**Revocar NO borra ninguna fila** — ni ésta ni sus anclas»*, con dos consumidores
  que la leen después.
- **Que `reconciliation_mark` pasando de columna a fila rompa alguna lectura de verticales.** No:
  ninguna pieza de `HOS-1353` la lee; el cruce que quedaba —`S14` y sus motivos— es entero de
  billing.
- **Que el anclaje de una vertical nueva a un grant vivo no invalide el caché de esa vertical.** No:
  `V/02` §3.2 fila 4 lo agregó con su nota —*«**El anclaje es la tercera escritura que cambia la
  cobertura** … e invalida **la entrada de esa vertical**»*— y `NUCLEO/04` §2.5, invariante 30, le
  puso la autorización a esa tercera escritura.
- **Que `T7` agregue un cuarto par a `G-R4` y desarme la cuenta.** No: `V/03` §2 lo razona
  correctamente —*«Comparte el `desde` con `T1`/`T6`, pero **no el evento**»*— y `NUCLEO/03` §1
  regla 7 no lo cuenta. (El conteo sí falla, pero por `S10`/`S25` y no por `T7`: `F-8fA3-012`.)
- **Que `PB7` republique el borrador de `PB5` por la rama nueva del cupo.** No: la condición de
  origen alcanza a las dos ramas, y `V/03` §9 lo dice explícitamente.
- **Que la restitución del cupo necesite una columna nueva para ordenar la cola.** No: `V/03` §9 y
  `V/15` §4.3 lo resuelven con el registro append-only, y la remisión es correcta (`NUCLEO/08` §1.2
  y §1.3).
- **Que `B/19` §4 fila 10-bis sea un sexto lector no inventariado de `inactiva_desde`.** Lo intenté
  y no cierra: la fila obliga a decir *«si la suspensión cruzó el día 180 lo que se reactiva es una
  ficha vacía»*, que **se puede** contestar sin leer la columna —mirando si quedó contenido—. Lo
  dejo declarado como el candidato más probable a sexto lector el día que se implemente, no como
  hallazgo.
- **Que `B/03` §7.1 lea `inactiva_desde` para acotar la reapertura.** No, y con tres razones
  escritas: el § **rechaza por escrito** ese tope —*«Ese reloj es de la ficha y el sujeto acá es la
  suscripción»*, *«Ya no es monótono»*, *«Crearía una segunda dependencia sobre una cifra que el
  guard no vigila con ese sentido»*— y lo reemplaza por la condición 1 del `B/05` §3.
- **Que `NUCLEO/02` §2.6 siga sin la columna `ocurrencia` que `NUCLEO/07` §2 declara con
  restricción de unicidad.** Lo verifiqué y **sigue faltando** (la fila de `outbox` guarda
  *«destinatario, plantilla, estado …, id del proveedor, intentos»* y su celda de restricciones está
  vacía), pero **no lo reporto como mío**: es `F-8B3-019` de la FASE 8, confirmado *«SIGUE»* en la
  8-bis por `B3`, y el §4 de las instrucciones manda no recontar lo que sigue llegando de otro
  vector. Queda anotado para que `C1` lo tenga a la vista, porque esta tanda le agregó un consumidor
  nuevo: la fecha objetivo de todo schedule vive en esa columna inexistente.

---

## Líneas de rastro que ataqué

**Revisé 181 líneas de cinco de los diez rastros.** El criterio de selección fue el sujeto de mi
vector —columnas, listas cerradas, conteos y acoplamiento— y, dentro de eso, las dos puntas que el
§2.3 de las instrucciones señala: el rastro más fino y el más denso sobre mi terreno.

| rastro | cuántas revisé | de cuántas | por qué ésas |
|---|---|---|---|
| `rastro-31ce26bb2.md` · la ampliación de `G-R6-B` | **101** (grupos A, B, E, F y G completos) más §2, §3, §4, §7 y §8 | 118 | es **la lista cerrada de lectores** de la columna de mi vector, escrita esta tanda, y su §4 declara haber reparado la lista antes de anclarle el guard |
| `rastro-5836ec219.md` · la retención | **38** (las de `DEC-DATA-002`, `V/02` §4, `V/03` §9 y `V/15`, seleccionadas por `PB4` `PB7` `cupo` `excedente` `relee`) | 187 | es el rastro más denso y el que cubre la columna, sus dos listas y la segunda rama de `PB3`/`PB7` |
| `rastro-8d6b27a12.md` · las ocho decisiones | las **24** filas del §4 más los encabezados de las 91 y las 5 entradas del §5 | 91 | es donde vive la corrección de los conteos congelados que `S24`/`S25` volvieron falsos |
| `rastro-7676082e6.md` · el guard de la lista de escritores | **12** (§1, §2 y las de `V/02` §2.5) | 58 | es el rastro **fino** sobre mi sujeto: 58 apariciones y la lista de escritores entera |
| `rastro-12cc0879f.md` · el cierre de guards | **6** (§2, §3 y las de `B/20` §2) | 21 | el más fino de los diez, y es donde viven las cifras de guards que `31ce26bb2` declara no movidas |

**Resultado: tres líneas resultaron falsas o incoherentes hoy, y una cuarta quedó verdadera del
término y falsa de la columna.**

1. **`rastro-5836ec219.md` L180-182** — *««vuelve sola por `PB7` y nunca se borra» → era falsa para
   el excedente el día que se escribió, y `8ed89adf8` **la volvió verdadera** dándole a `PB7` la
   segunda rama»*. **FALSA**: `PB7` sale de `ARCHIVED` y la relectura de `PB4` impide que la ficha
   del excedente llegue ahí (`F-8fA3-002`).
2. **`rastro-5836ec219.md` L247-249** — *««`PB7` no llegue a disparar porque el cupo no alcanza» →
   sigue correcta: **con la segunda rama, `PB7` dispara cuando el cupo vuelva**»*. **FALSA por la
   misma razón**, y es independiente de la anterior: son dos resoluciones que se apoyan en la misma
   premisa no verificada.
3. **`rastro-31ce26bb2.md` §4, hallazgo 1 + §2, la tabla de unidades** — *«**Los cinco son cinco y
   los tres avisos están todos**»*, contra una tabla que enumera **2 + 3 + 1** bajo el encabezado
   *«dónde nace cada una de **las cinco**»*. **INCOHERENTE**: el mismo rastro reparte seis lectores
   de dos formas distintas, y su propio §8 pregunta 1 admite que la lista se reescribe si el criterio
   es el otro (`F-8fA3-003`).
4. **`rastro-5836ec219.md` L287** — *««Una ficha publicada y cubierta no acumula inactividad» →
   sigue correcta»*. **Verdadera del término y falsa de la columna**: desde esta tanda *«el trabajo
   que hace el reloj es de la columna, y las transiciones sólo la leen»* (`V/02` §4.1), así que
   `inactiva_desde` **sí** sigue corriendo sobre una ficha publicada y cubierta, y lo único que la
   contiene es la relectura de `PB4` — que es la pieza de `F-8fA3-001`. La resolución resolvió la
   frase vieja sin advertir que la columna nueva la vuelve una afirmación sobre la **semántica** y
   ya no sobre el **dato**.

**Y dos líneas que ataqué y resistieron, que van porque un cero medido es un resultado:**

- **`rastro-31ce26bb2.md` §3** — las cinco cifras de guards (*«16 · 17 · 29 · 15 con unidad · 14
  sin»*) declaradas re-medidas y no movidas. **Las conté sobre el texto de hoy: `V/20` §2 tiene 17
  filas y `B/20` §2 tiene 16.** Coinciden.
- **`rastro-7676082e6.md` §2, último párrafo** — *«no verifica que los cuatro hechos tengan quien
  los ejecute … pide que cada escritura declare cuál de los cuatro ejecuta»*, que `rastro-31ce26bb2`
  §7 declara que **sigue correcta**. Lo verifiqué contra `V/20` §2 y es exacto. Lo que **no** cubre
  esa línea, y por eso `F-8fA3-004` existe igual, es que la ausencia de ejecutor para el hecho 4 **no
  es una limitación del guard sino un hueco del diseño**: el guard declara no verificarlo, y encima
  el corpus no lo declara en ninguna parte.
