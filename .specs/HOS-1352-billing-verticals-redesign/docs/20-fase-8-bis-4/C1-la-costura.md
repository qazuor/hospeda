---
title: "FASE 8-bis-4 · C1 — la costura: capítulos partidos, el contrato, los invariantes"
linear: HOS-1352
statusSource: linear
created: 2026-09-21
updated: 2026-09-21
status: CURRENT
fase: 8
---

# FASE 8-bis-4 · C1 — la costura

Quinta pasada `C1`, corrida **después de los siete informes**, que existían todos cuando empecé.
Vector: lo que se rompe **entre** documentos — los capítulos que el desarme partió, el contrato de
frontera, el núcleo, los invariantes y los conteos congelados. **El núcleo es mío**, y adopto los
defectos que los otros siete marcaron `NUCLEO`.

**Siete hallazgos: 0 `CRITICA`, 3 `ALTA`, 3 `MEDIA`, 1 `BAJA`.**

Más las tres secciones del encargo: **la deduplicación de los críticos** (§2), **las
contradicciones entre informes con su veredicto** (§3) y **el veredicto de método sobre
`DEC-METH-010`** (§4).

Abreviaturas como en los demás: `NUCLEO` es `HOS-1352-…/docs/nucleo/`, `V` es `HOS-1353-…/docs/`,
`B` es `HOS-1354-…/docs/`, y lo que no lleva prefijo es `HOS-1352-…/docs/`.

**Lo que medí yo, y cómo.** Todo sobre el worktree
`/home/qazuor/projects/WEBS/hospeda-spec-hos-1352-billing-redesign` el 2026-09-21, con `HEAD` en
`c4354b6a2`, nunca sobre `/home/qazuor/projects/WEBS/hospeda2/`:

| qué conté | con qué | resultado |
|---|---|---|
| hallazgos `### F-8e` en los siete informes | `rg -c "^### F-8e"` | **76** — A1 7 · A2 11 · A3 19 · B1 11 · B2 10 · B3 9 · C2 9 |
| IDs con `**Severidad.** \`CRITICA\`` | `rg -c '^\*\*Severidad\.\*\* \`CRITICA\`'` | **13** — A1 1 · A2 2 · A3 2 · B1 2 · B2 3 · B3 3 · **C2 0** |
| decisiones del log | `rg -c "^### DEC-"` menos la plantilla | **76** (el resumen del propio log declara 76; 10 de metodología) |
| tablas de transiciones del corpus | `rg -n '^\| *# *\| *desde *\| *evento'` | **7** — 3 en `V/03` (§2, §9, §11), 4 en `B/03` (§3.2, §6, §7, §8) |
| filas de `B/03` §3.2 | a mano, fila por fila | **21** (`S1`…`S21`), de las cuales **8** tienen un `desde` que no es un estado |
| guards de `V/20` §2 · `B/20` §2 | `rg -on '^\| G'` | **15** · **11**, con `G-R4` y `G-R5` en los dos = **24** distintos |
| filas del inventario de `NUCLEO/01` §2.4 | a mano | **20** — grupo A 10 (1-6 y 17-20), grupo B 10 (7-16) |
| filas del catálogo de `NUCLEO/08` §3 | a mano | **12** |
| invariantes | `NUCLEO/04` §5 declara **53**; `NUCLEO/00` declara **51**, dos veces | ver `F-8eC1-004` |
| filas de la matriz | `contar-filas-de-la-matriz.py` | **90** — 49 `VERIFIED`, 13 `PARTIALLY_SUPPORTED`, 20 `NOT_SUPPORTED`, 8 `UNKNOWN` |
| archivos que toca cada uno de los 11 commits | `git show --name-only` | **coincide fila por fila con la tabla del §2.3** de las instrucciones |
| archivos **agregados** por la tanda | `git diff --name-status 1e3c3fc9e~1 1c17565e1 \| rg '^A'` | **cero** |
| el rastro por aparición | `rg -il "por aparici\|declaradas correctas\|apariciones recorridas" .specs/` sin los seis directorios de informes | **un archivo: el decision log** |
| commits que reportan una cifra de apariciones | `git log -1 --format=%B` sobre los once | **2 de 11** — `1e3c3fc9e` y `c29b318c7` |

**Ningún número de este informe viene de otro informe.** Donde uso uno ajeno lo digo, lo vuelvo a
contar, y si no da lo digo también.

> **Una corrección al encargo, que cambia el número de la serie.** El orquestador declara **67
> hallazgos nuevos** y a continuación publica el desglose *«A1 7 · A2 11 · A3 19 · B1 11 · B2 10 ·
> B3 9 · C2 9»*, **que suma 76**. Lo conté con `rg` y son **76**; los siete parciales del
> orquestador son exactos y el total no. No es una discusión de conteo: es la fila *«hallazgos»* de
> la tabla del §1 de las instrucciones, que es una de las cuatro que esta pasada existe para
> llenar. **La serie es 112 → 120 → 85 → 76.**

---

## 1. Los hallazgos

### ALTA

### F-8eC1-001 — `B/16` §4.3 subió su conteo a seis y la sexta sigue sin fila: la tabla que el corpus declara exhaustiva tiene una transición de primera clase con TRES `desde` distintos y cero filas, y la vuelta anterior había dictaminado el orden inverso — `NUCLEO`

**Qué se rompe.** La vuelta anterior dirimió esta misma discusión con una consecuencia práctica
escrita: *«quien corrija esto tiene que escribir **una fila en `B/03` §3.2** —la que el §10.1
promete y no existe— y después el número de `B/16` §4.3 pasa a seis **solo**. Corregir el número
sin escribir la fila deja el defecto de `A2`/`B2`/`B3` entero y además vuelve falsa la cita de la
sección. **La fila primero, el número después.**»* (`../19-fase-8-bis-3/C1-la-costura.md` §3.1).
**La tanda hizo exactamente lo contrario**: movió el número, no escribió la fila, y escribió la
frase que lo admite entre paréntesis. El resultado medible es el informe entero de `B2`: un miembro
de primera clase de cuatro enumeraciones distintas, sin fila, con **tres `desde` incompatibles en
el mismo capítulo**, y nadie recorrió ninguno de los tres.

**El camino.**

1. El número se movió, y con el miembro nombrado: `B/16` §4.3 — *«Las transiciones que la cumplen
   son **las seis** que en `B/03` §3.2 sacan a una fila principal de las filas vivas: `S3`, `S12`,
   `S13`, `S16`, `S17` y **el espejo de la baja decidida por el proveedor** (`B/03` §10.1, **que no
   tiene fila numerada** y es transición de la misma tabla)»*. La aclaración entre paréntesis es
   nueva y es la confesión: el corpus declara **lista cerrada y auditable** un conjunto uno de
   cuyos seis miembros **no existe como fila**.
2. **Recorrí las 21 filas de `B/03` §3.2 el 2026-09-21 y no hay fila del espejo**: `S1`…`S21`, y
   las únicas tres con `hacia = CANCELLED` son `S12` (desde `CANCEL_SCHEDULED`), `S13` y `S17`.
   La tabla creció de 19 filas a 21 en esta tanda —`S20` y `S21`— y la que faltaba sigue faltando.
3. **Y sin fila, el `desde` se escribe tres veces y da tres conjuntos.** Lo verifiqué contra las
   tres citas, en el mismo archivo:
   - `B/03` §10.1, línea 1387: *«| `cancelled` | **cualquier estado vivo que no sea
     `CANCEL_SCHEDULED`** | … espejar la baja decidida por el proveedor |»* → **cinco** estados;
   - `B/03` §3.2, el recuadro de la aritmética: *«El `desde` del espejo es «cualquier estado vivo
     que no sea `CANCEL_SCHEDULED`», o sea que **incluye `GRACE_PERIOD` y `SUSPENDED`**»* → escrito
     sobre **cuatro**, agregando `SUSPENDED` a mano;
   - `B/03` §3.2, tabla de recorrido, fila 7: *«| 7 | **`ACTIVE` · `GRACE_PERIOD`** | el espejo de
     la baja decidida por el proveedor (§10.1) | `CANCELLED` | **no** |»* → **dos**.
   Es `F-8eB2-005`, y lo verifiqué yo contra las tres líneas.
4. **El propio capítulo escribe la lección de método y la incumple en el renglón siguiente.** El
   párrafo que sigue a la fila 7: *«La séptima **no tiene fila numerada** en esta tabla, y no por
   eso deja de ser una transición de ella … Enumerar el dominio **sobre las filas numeradas** la
   deja afuera, y es **el error de método que costó una rama entera** en `B/12` §5.3: la tabla
   numerada **no es** la enumeración completa de esta tabla»*. La fila que lleva ese párrafo abajo
   es la que enumera el `desde` sobre dos estados.
5. **Y sin fila no la puede ver el único mecanismo que el núcleo tiene para esta clase de error.**
   `G-R4` compara *«dos filas con el mismo `(desde, evento)`»* (`V/20` §2): un predicado sobre
   filas no alcanza a una transición sin fila. Y `NUCLEO/03` §1 regla 1 dice *«La tabla de
   transiciones es exhaustiva. Lo que no está, no pasa»*, contra `B/03` §10.1, que dice *«**Espejar
   un estado leído por id es una transición declarada de esta tabla, no un acto aparte**»*. **Las
   dos frases no pueden ser verdaderas a la vez**, y ningún documento las reconcilia.
6. **Los tres estados que la versión corta deja afuera son los que rompen tres afirmaciones que la
   misma tanda escribió como cerradas** —`PAUSED`, `PENDING_AUTHORIZATION` y `SUSPENDED`—: *«no hay
   caso en que haya que pausar un preapproval que todavía no autorizó»* (`B/14` §4.4), *«son cinco
   ramas»* (`B/12` §5.3) y *«los apagan cuatro actos declarados, uno por rama»* (`B/03` §3.2). El
   primero es el defecto crítico **#3** del §2.1.

**Dónde lo permite el diseño.** `B/16` §4.3 (las seis y el paréntesis); `B/03` §3.2 (las 21 filas,
la tabla de recorrido fila 7 y su párrafo, el recuadro de la aritmética) y §10.1 (la última fila y
el bloque de cierre); `NUCLEO/03` §1 regla 1 y regla 7; `V/20` §2 (`G-R4`); `B/14` §4.4;
`B/12` §5.3.

**Severidad.** `ALTA`. El daño de plata ya está contado como `CRITICA` en el defecto **#3** y no lo
cuento de nuevo. Lo reporto en este nivel porque **es la costura pura y se arregla en un renglón**:
una fila en `B/03` §3.2, con **un** `desde`, cierra las tres redacciones, le da sujeto a `G-R4`,
vuelve verdadera la regla 1 del núcleo y convierte el conteo de `B/16` §4.3 en auditable — que es
para lo que el propio § dice que su lista existe. Y porque es el único hallazgo de esta pasada del
que se puede decir que **el programa ya tenía el veredicto escrito y lo aplicó al revés**.

**Marcá `NUCLEO`** — la contradicción entre *«lo que no está, no pasa»* y *«una transición declarada
de esta tabla»* es de `NUCLEO/03` §1 regla 1, y sólo el núcleo la puede dirimir.

**¿Es nuevo, o es el arreglo?** **Es el arreglo, y son dos.** El **11/13** (`4e383480d`) subió el
número de `B/16` §4.3 de cinco a seis y agregó el paréntesis; el **5/6** (`f4edbdfdf`) hizo del
espejo el tercer camino de `S18` sin `S17` y la rama 5 de `B/12` §5.3. Los dos promovieron al
espejo sin darle fila.

**¿Lo habría encontrado el grep?** **Sí, y de la forma más barata.** El término es literalmente
*«el espejo»* / *«espejar la baja decidida por el proveedor»*, y un `rg "espejar la baja"` sobre
`B/03` devuelve **tres** líneas —1387, 921 y la fila 7— con tres `desde` distintos a la vista. Los
dos commits tocan `B/03` y `B/16`, así que bajo `DEC-METH-009` el choque era interno y quedaba
fuera; bajo la obligación 1 de `DEC-METH-010` —*«todo el corpus, incluidos los archivos que el
commit toca»*— entra entero.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí para dos de las tres apariciones, no para
la tercera, y la diferencia es la que hay que medir.** El `desde` de §10.1 y el de la fila 7 de la
tabla de recorrido **existían antes** de `4e383480d` y ese commit no editó ninguno de los dos
párrafos —lo verifiqué con `git show 4e383480d -- …/03-maquinas-de-estado.md`—, así que son
*«apariciones no corregidas en párrafos que el commit no tocó»* y caen de lleno en lo que la
obligación 2 manda escribir. Escribir *«`B/03` §10.1: cinco estados — sigue siendo correcta»* al
lado de *«`B/03` §3.2 fila 7: dos estados — sigue siendo correcta»* es imposible sin ver que no
pueden serlo las dos. **La enmienda alcanzaba y no se ejecutó.** La tercera —el recuadro de la
aritmética— la escribió el propio commit y queda afuera por construcción (§4.4, modo 1).

---

### F-8eC1-002 — El inventario de consumidores de «fila viva» es la única generalización que la obligación 4 tiene, quedó corto por TERCERA vuelta consecutiva, y el guard que lo vigila tiene por predicado exactamente lo que ninguna búsqueda computa — `NUCLEO`

**Qué se rompe.** `DEC-METH-010` obligación 4 manda que *«cada término que el núcleo define lleve su
lista de consumidores, y el arreglo que crea un consumidor nuevo agregue la fila antes de declararse
aplicado»*, y la tanda la cumplió sobre el único término que tiene lista: `NUCLEO/01` §2.4 pasó de
cinco filas a **20**, partidas en dos grupos por cómo fallan, con `G-R1-E` vigilándola. Es el mejor
instrumento del corpus y **volvió a quedar corto en la misma tanda que lo construyó**: cuatro de los
siete informes encontraron, por separado, cuatro consumidores que no están. Y la segunda mitad de
`G-R1-E` —*«un consumidor nuevo del término no figura en el inventario»*— es un predicado que, para
evaluarse, tiene que **re-derivar el conjunto que la lista existe para congelar**: es la misma
delegación imposible que `F-8dC1-007` midió sobre la regla 7 y `G-R4`, un capítulo más arriba.

**El camino.**

1. La lista y su ambición, textual: `NUCLEO/01` §2.4 — *«**Esta lista es el control, no un
   registro.** Es lo único del corpus que convierte *«fila viva»* de un término en algo verificable,
   y **quedó corta en el mismo commit que creó su sexto miembro** … Por eso se mantiene entera y **la
   verifica un guard** (`G-R1-E`, `B/20` §2), **no la memoria del que escribe**»*.
2. **La conté: 20 filas** —grupo A: 1, 2, 3, 4, 5, 6, 17, 18, 19, 20; grupo B: 7 a 16—. La
   numeración **no está ordenada**: el grupo A imprime `1-6` y después `17-20`, y el B imprime
   `7-16`. El propio § declara que el control es *«que este inventario tenga una fila menos que los
   consumidores»*, o sea **un conteo por posición**, sobre una lista cuyas posiciones no siguen el
   orden de sus números.
3. **Los cuatro consumidores que faltan, encontrados por cuatro informes distintos**, todos
   verificados por mí contra el texto:

   | # | quién | dónde | quién lo midió |
   |---|---|---|---|
   | 1 | el efecto de **`MP4`** —reactivar leyendo *«es la predecesora de una sucesión en curso»*— | `B/03` §7.1 | `F-8eB1-006` |
   | 2 | el efecto de **`MP1`**, ídem | `B/03` §3.2 | `F-8eB2-007` |
   | 3 | *«un **ancla viva** en la vertical V»*, un tercer *«vivo»* que el núcleo **no define**, dentro de la celda de la fila 17 | `B/09` §3 · `NUCLEO/01` §2.4 fila 17 | `F-8eB3-002` |
   | 4 | la **enumeración de transiciones de salida** de `B/16` §4.3, que no es ninguno de los dos grupos | `B/16` §4.3 | `F-8eA3-015` |

4. **Los dos primeros están nombrados dentro del inventario y no son filas de él.** La fila 14 es
   `G-R1-D`, y su predicado en `B/20` §2 dice, textual: *«un camino **reactiva** una fila —`S5`,
   `S7`, el efecto de `MP1` o **el de `MP4`**— que en ese instante es la **predecesora de una
   sucesión en curso**»*. O sea: el guard los nombra y el inventario que el guard vigila no los
   tiene. **El control se cumple de forma vacua**: contar las filas del inventario contra los
   consumidores da un número que no incluye a los dos que su propio guard enumera.
5. **Y la tercera mitad de `G-R1-E` no puede correr.** Su predicado, entero (`B/20` §2): *«…**o un
   consumidor nuevo del término «fila viva» no figura en el inventario** de `NUCLEO/01` §2.4»*, y el
   § lo defiende diciendo *«es la parte que **ningún grep sustituye**»*. Es cierto y es el problema:
   para decidir si hay un consumidor que no figura hay que **saber cuáles son los consumidores**, que
   es precisamente el conjunto que la lista congela. Un guard estático puede contar filas; no puede
   descubrir un predicado parafraseado — que es, con las palabras del propio §, *«el defecto que
   cierra: no es una omisión sino una paráfrasis»*.
6. **Y no es una hipótesis: es el registro de tres vueltas.** `F-8cC1-002` (8-bis-2) pidió el §2.4;
   `F-8dC1-001` (8-bis-3) midió que la lista de cinco tenía seis consumidores; hoy la lista de 20
   tiene 24. **Cada vuelta la lista creció y cada vuelta quedó corta**, y las tres veces el commit
   que creó el consumidor nuevo tenía el archivo del inventario abierto: `4e383480d` toca
   `nucleo/01` y declara en su mensaje *«la obligación 4 de `DEC-METH-010` quedó cumplida: el
   inventario del núcleo ganó su fila 17 en el mismo acto que creó el consumidor»*. Ganó la 17 y
   perdió la de `MP4`, que nació en `71615bb41` dos commits después, y la del *«ancla viva»*, que
   nació en la misma celda de la 17.

**Dónde lo permite el diseño.** `NUCLEO/01` §2.4 (la declaración de control, los dos grupos, las 20
filas, la fila 14 y la fila 17); `B/20` §2 (`G-R1-D` y `G-R1-E`, con su párrafo de cierre);
`B/03` §3.2 y §7.1 (`MP1`, `MP4`); `B/09` §3 (tercera comprobación); `B/16` §4.3;
`01-decision-log.md`, `DEC-METH-010` obligación 4.

**Severidad.** `ALTA`. No mueve plata por sí solo: lo que hace es dejar sin control el término del
que cuelgan **dos** de los doce críticos de esta pasada (#6 y #8 del §2.1). Y lo reporto acá y no
más abajo porque **es el instrumento que la vuelta anterior propuso como corrección 4 del método**,
adoptado por el owner como obligación 4, ejecutado en su primera tanda, y medido corto en esa misma
tanda por cuatro agentes independientes. Un control que afirma completitud y no la tiene es peor que
no tenerlo — lo escribí como el costo de la propuesta y hay que acreditarlo como medido.

**Marcá `NUCLEO`** — el inventario y sus dos grupos viven en `NUCLEO/01` §2.4. Los cuatro huecos ya
tienen ID ajeno (`F-8eB1-006`, `F-8eB2-007`, `F-8eB3-002`, `F-8eA3-015`) y **se los dejo**; lo mío
es el instrumento, su conteo por posición y la imposibilidad del predicado de `G-R1-E`.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 5** (`f4edbdfdf`, que creó el inventario de 16 y
`G-R1-E`), más el **12/13** (`4e383480d`, filas 17-19), el `DEC-ADDON-004` (`456563988`, fila 20) y
el `DEC-SUB-012` (`71615bb41`, que creó `MP4` sin fila). `F-8dC1-001` **sigue llegando** en su
tercera forma.

**¿Lo habría encontrado el grep?** **No, y el propio corpus explica por qué mejor de lo que yo
podría.** `B/20` §2: *«un predicado del grupo B que se equivoque **parafrasea** … y **ninguna
búsqueda por el término lo devuelve, porque el término no está**»*. Lo verifiqué: el efecto de `MP4`
en `B/03` §7.1 no contiene la cadena *«fila viva»*.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y es la clase que la enmienda declara no
cubrir.** Un consumidor que no nombra el término no tiene aparición que rastrear: la obligación 2
recorre ocurrencias y esto es una ausencia. La que sí alcanzaba es la **obligación 4**, y se
ejecutó —la fila 17 entró— sobre un commit y no sobre los otros tres que crearon consumidores.
**La enmienda alcanzaba por su cuarta obligación y se ejecutó una vez de cuatro.**

---

### F-8eC1-003 — El contrato lleva DOS censos del mismo hecho, la tanda actualizó uno y no el otro, y la regla de vigilancia cuenta contra el viejo: el §1.1 sigue en «cuatro lugares» desde el día que nació el documento y el §2.1 ya va en seis

**Qué se rompe.** El contrato trae el único detector declarado del modo de falla que domina este
programa —*«si aparece un quinto lugar que necesita algo de billing y no es este hecho, es señal de
que el corte se está filtrando»*— y ese detector se evalúa contra **un censo**. El documento tiene
**dos** censos del mismo hecho, escritos a cincuenta líneas de distancia: el §1.1, *«el mismo hecho,
en cuatro lugares»*, y la fila `cubierto` del §2.1. **La tanda actualizó el segundo y no el
primero**, así que hoy el mismo documento afirma que el hecho vive en cuatro lugares y enumera seis
consumidores de uno solo de sus siete campos. La regla de vigilancia dispara *«a partir del
quinto»*, y el quinto ya está escrito dos páginas más abajo por el propio documento.

**El camino.**

1. La regla, textual, sin cambios: `12-contrato…` §4.2 — *«**Regla de vigilancia**: si aparece un
   **quinto lugar** que necesita algo de billing **y no es este hecho**, es señal de que el corte se
   está filtrando. **Se mira, no se resuelve en el lugar.**»*
2. El censo contra el que se evalúa: `12-contrato…` §1.1, *«El mismo hecho, en **cuatro
   lugares**»*, con su tabla de cuatro renglones —cap. 17 §1.2 paso 5, `PB2`, cap. 15 §6, y el
   disparador del recálculo—. **`git log -L 40,53` dice que ese bloque no se toca desde
   `cf2ca9b30`**, el commit que creó el documento.
3. **El otro censo sí se movió, y en esta tanda.** `12-contrato…` §2.1, fila `cubierto`, columna
   *«quién lo necesita»*: *«**`PB2`, `PB3` y `PB7`**; el §6 del capítulo 15; el reconciliador; **y
   el reloj de inactividad**, que se reinicia cuando pasa a verdadero (`NUCLEO/01` §1.2)»*. Son
   **seis**, contra los tres que tenía la vuelta pasada. `git log -L 94,94` dice que lo reescribió
   `621332e7c`. **`F-8dC1-002` corta a la mitad: `PB3` entró —era `F-8cC1-004`, abierto desde la
   9-bis— y entró el reloj.**
4. **Y los dos consumidores que la vuelta anterior midió como los más fuertes siguen sin entrar en
   ninguno de los dos censos.** Lo verifiqué contra `V/03` §2 línea por línea: `T1` lleva en su
   columna condición *«y **`cubierto` es falso**»* y `T6` *«y **`cubierto` es verdadero**»*. No son
   lecturas: son **las guardas que separan las dos filas de un par de transiciones**, o sea el uso
   más fuerte que el dato puede tener.
5. **Y la tanda tuvo el término en la mano para escribir sobre él y no volvió al censo.** La fila
   `T7`, escrita por el arreglo 2, dice en su columna condición: *«**`cubierto` no participa**»*.
   Alguien se sentó a decidir qué hace `cubierto` en una fila nueva de esa tabla, lo escribió, y no
   abrió ninguno de los dos censos del documento que se declara dueño del campo.
6. **Y el cuantificador de la regla sigue roto, por tercera vuelta.** El §4.2 dice *«no está en **los
   seis campos** del §4.1»* y el §4.1 dice *«Son **siete campos** en tres preguntas»*. Lo verifiqué
   sobre las dos líneas hoy. Es `F-8cA3-014` → `F-8dC1-002` paso 7 → `F-8eA3-010`, **abierto desde la
   8-bis-2**.

**Dónde lo permite el diseño.** `12-contrato…` §1.1 (la tabla de cuatro y su nota), §2.1 (la fila
`cubierto`), §4.1 y §4.2; `V/03` §2 (`T1`, `T6`, `T7`) y §9 (`PB2`, `PB3`, `PB7`);
`NUCLEO/01` §1.2 (el hecho 2).

**Severidad.** `ALTA`, el mismo nivel que en la vuelta anterior y por una razón distinta. Allá el
censo estaba corto; acá **el documento tiene dos censos del mismo hecho que se contradicen entre
sí**, y el que la regla usa es el que nadie tocó desde que el documento nació. Un detector cuyo
umbral (*«el quinto»*) ya está superado por una tabla del mismo archivo no se dispara nunca: no
falla, queda apagado, y esta pasada volvió a pagarlo —`F-8eA3-008` mide que la mitad inversa de la
misma regla lleva **tres vueltas** sin correrse sobre `plan.vertical`—.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: el 2** (`1e3c3fc9e`) para la fila `T7` y
`DEC-DATA-002` (`621332e7c`) para la mitad que sí se corrigió. `T1` y `T6` sobre `cubierto` son del
arreglo 2 de la 9-bis-2 y **siguen llegando**; el §1.1 es original del documento.

**¿Lo habría encontrado el grep?** **Sí, y los dos commits tocaron el contrato.** El término es
`cubierto`, y `621332e7c` lo grepeó lo bastante bien como para reescribir la fila del §2.1 con dos
consumidores nuevos. Un `rg -n "cubierto" 12-contrato-de-cobertura.md` devuelve **18 líneas** (las
conté), y la del §1.1 está entre las primeras. **La búsqueda no falló: falló elegir cuál de las dos
apariciones del mismo censo se resolvía.**

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, y es el caso que la obligación 1 agregó
al alcance en estas palabras exactas.** `621332e7c` abrió `12-contrato-de-cobertura.md` y editó el
§2.1; el §1.1 es *«una aparición no corregida en un párrafo que el commit no tocó»*, **dentro de un
archivo que el commit sí abrió** — literalmente *«un archivo abierto no es un párrafo leído»*.
Escribir *«§1.1: «cuatro lugares» — sigue siendo correcta»* a dos renglones de haber puesto seis en
el §2.1 no se sostiene. **La enmienda alcanzaba y no se ejecutó**, y el commit que la dejó pasar es
uno de los **seis que no reportan ninguna cifra de apariciones**.

---

### MEDIA

### F-8eC1-004 — `NUCLEO/00` cuantifica las fuentes admitidas del programa en 54 decisiones —hoy 76— y los invariantes en 51 —hoy 53—, y esta vez NINGUNO de los once commits lo abrió: el §5 de `NUCLEO/04` hizo el recuento ritual completo y el índice a dos archivos de distancia no se enteró — `NUCLEO`

**Qué se rompe.** `NUCLEO/00` es el documento que declara **de dónde puede salir una afirmación** de
esta fase, y su segunda fuente admitida lleva el cardinal adentro de la oración. El atraso pasó de
**trece decisiones** (vuelta anterior) a **veintidós**. Y el argumento que la vuelta anterior usó
para calificarlo —*«el archivo estuvo abierto en la mano del commit que declara haber barrido el
corpus»*— **ya no aplica, y eso lo empeora**: `git log` dice que `nucleo/00-indice.md` no se toca
desde `49eb99f34`, que es de la **tanda anterior**. Once commits escribieron en **seis de los siete
archivos del núcleo** sin abrir el índice que declara qué hay en cada uno.

**El camino.**

1. La regla de fuentes, textual: `NUCLEO/00`, *«De dónde sale cada afirmación»* — *«…2. **una
   decisión registrada** en `01-decision-log.md` — son **54** al 2026-09-19, recontadas con
   `rg -c "^### DEC-"` menos la plantilla del formato…»*.
2. **Las conté hoy**: `rg -c "^### DEC-" 01-decision-log.md` da **77**, menos la plantilla = **76**.
   Es el mismo número que el resumen del propio log declara (*«| Decisiones tomadas | **76** |»*).
   **Veintidós de atraso**, ocho de ellas de esta tanda.
3. **El segundo conteo congelado del mismo archivo también creció.** `NUCLEO/00` dice *«**51
   invariantes** numerados de corrido»* y, dos líneas más abajo, *«| `04` | invariantes | **los
   51** |»*. `NUCLEO/04` §5 declara hoy **«Cincuenta y tres invariantes»**. Es `F-8cC1-014` →
   `F-8dC1-006` → hoy, **abierto desde la 9-bis**, y `F-8eC2-006` lo mide en cuatro documentos con
   tres valores.
4. **Y lo que lo vuelve un defecto del núcleo y no un descuido es que el recuento SÍ se hizo, dos
   archivos más allá.** `NUCLEO/04` §5 lleva un bloque de recorridos fechados, y el de esta tanda es
   minucioso: *«**Recorrido otra vez el 2026-09-21 — FASE 9-bis-3, al agregar `D16`** … las **16**
   filas del §3 clasificando su columna de apoyo: base `D2 D3 D8 D15` (4), guard
   `D8 D9 D10 D12 D15 D16` (6), y las **diez** restantes servicio … El total de la derecha pasa de
   15 a 16 y *«cincuenta y dos»* a **cincuenta y tres**»*. **El ritual que el núcleo se impuso
   —*«Los conteos se recorren enteros con un script, o no se tocan»*, `NUCLEO/04` §5— se ejecutó
   entero** sobre el archivo donde vive el número, y el índice que lo cita quedó dos versiones atrás.
5. Y el atraso no es inerte: `NUCLEO/08` §4.2 se numera contra el conteo de apartamientos
   (*«es el **cuarto** apartamiento del programa»*) y `NUCLEO/01` §2.1 también (*«Es el **tercer**
   apartamiento»*). El próximo que necesite un ordinal lo va a tomar del inventario roto
   (`F-8eC1-007`).

**Dónde lo permite el diseño.** `NUCLEO/00` (*«De dónde sale cada afirmación»* punto 2; *«Las tres
partes»*, dos celdas); `NUCLEO/04` §5 (la regla y el bloque de recorridos); `01-decision-log.md`,
el resumen.

**Severidad.** `MEDIA`. Ninguna decisión se toma leyendo ese número. Lo reporto porque **el atraso
se duplicó otra vez** —de 1 invariante a 13 decisiones a 22— y porque la causa cambió: ya no es *«lo
tuvo abierto y no recontó»*, es *«nadie lo abrió en once commits que escribieron en seis de los
siete archivos que el índice describe»*. El §5 de `NUCLEO/04` demuestra que el programa **sabe**
hacer el recuento; lo que falta es que la lista de archivos a recorrer incluya al que los cita.

**Marcá `NUCLEO`.**

**¿Es nuevo, o es el arreglo?** **Sigue llegando, y creció.** `F-8dC1-006` y `F-8cC1-014`. Lo que la
tanda agregó son las **ocho decisiones** y el **invariante `D16`** que ensancharon las dos brechas,
sin tocar el archivo.

**¿Lo habría encontrado el grep?** **No, y por la razón que este defecto ilustra mejor que ninguno.**
Los términos que la tanda redefine son `inactividad`, `D16`, `PB7`, `PB8`, `G-R5`, `S20`, `S21`,
`MP4`, `MP5`; **ninguno aparece en `NUCLEO/00`**, lo verifiqué. El defecto no es una aparición: es
**un número**, que es la clase que `A2`, `A3`, `B2`, `C2` y yo levantamos **siete** veces en esta
pasada (`F-8eA3-009`, `F-8eA3-010`, `F-8eB2-005`, `F-8eB2-006`, `F-8eC2-006`, `F-8eC1-004`,
`F-8eC1-007`).

**¿La resolución POR APARICIÓN lo habría atrapado?** **No, y esta vez ni siquiera por el borde.** La
obligación 2 se cumple *«por aparición»* y acá no hay ninguna: el archivo no contiene ningún término
de la tanda. Lo que hacía falta es una obligación que el corpus **ya tiene escrita en otro lado** y
que `DEC-METH-010` no recogió: `NUCLEO/04` §5, *«los conteos se recorren enteros … o no se tocan»*,
con la lista de dónde están los conteos. Va como propuesta en §4.5.

---

### F-8eC1-005 — La regla de vigilancia de la firma se declara «comprobable con `rg`» y su exclusión está escrita en prosa: corro su propio comando y devuelve dos bloques que DEFINEN, en documentos del paraguas `status: CURRENT`

**Qué se rompe.** El arreglo de la costura (`c29b318c7`) hizo bien lo difícil —retiró las cuatro
copias de la firma del contrato y las dejó como remisión— y cerró con una regla nueva cuya gracia
es que *«se comprueba con `rg`»*. **Corrí su comando, tal cual está escrito, y la regla ya estaba
incumplida el día que se escribió.** No por las copias que el commit retiró: por dos bloques en
`15-fase-9/`, que la exclusión de la regla no nombra ni excluye sin interpretación. Una regla que
declara ser mecánica y cuya lista de exenciones es una frase no es mecánica, y ésa es la parte que
me toca.

**El camino.**

1. La regla, textual: `12-contrato…`, bloque de apertura — *«**Regla de vigilancia: la firma de
   `cobertura()` se enuncia acá y en ningún otro documento.** Ningún otro capítulo, `spec.md`,
   `descomposicion.md` ni documento del paraguas lleva un bloque que enumere sus campos … **Se
   comprueba con `rg -n "cobertura\(user" .specs/`** — fuera de este documento y **de los informes
   de fase**, toda aparición tiene que ser prosa que **cite**, nunca un bloque que **defina**»*.
2. **Corrí ese comando el 2026-09-21.** Fuera del contrato y de los seis directorios de informes
   (`14-…`, `15-fase-9`, `17-…`, `18-…`, `19-…`, `20-…`) quedan **siete líneas en cuatro archivos**.
   Una sola es prosa que cita y es correcta: `V/15` §… — *«`cobertura(user, vertical)` devuelve
   **todas** las fuentes vivas, de las **tres clases**»*.
3. **Las otras seis están en `15-fase-9/`, y dos de ellas son bloques que definen.** Los dos
   archivos declaran `status: CURRENT` en su frontmatter, lo verifiqué:
   - `15-fase-9/02-R2-resuelto.md:52` — un bloque ` ```text ` con los cinco campos, y su enum de
     `tipo` dice *«TRIAL | SUSCRIPCIÓN | CORTESÍA | GRANT | ADDON»*: **cinco**, contra los **seis**
     que el §2.1 del contrato enumera hoy (*«`TRIAL` · `SUSCRIPCIÓN` · `CORTESÍA` · `GRANT` ·
     **`BASE`** · `ADDON`»*);
   - `15-fase-9/00-dominios-de-los-racimos.md:158` — un bloque precedido por la línea ***«Cita
     textual, `12-contrato-de-cobertura.md` §2:»*** que muestra **tres** campos
     (`cubierto`, `fuentes: [ { tipo, versiónDePlan, hasta } ]`) de los **cinco** del §2, y con el
     nombre viejo `versiónDePlan` en vez de `referencia`. **Un bloque rotulado como cita textual que
     no es la cita es peor que una copia: es una copia que promete no serlo.**
4. **Y la exclusión no dirime.** *«Los informes de fase»* no es un predicado: `15-fase-9/` es un
   directorio de fase cuyos archivos **no son informes adversariales** sino las resoluciones de la
   FASE 9, con `status: CURRENT`, y son exactamente los documentos de donde salieron las cuatro
   copias que el commit retiró (*«la divergencia entra en `4f34afa1a` (FASE 9)»*,
   `../19-fase-8-bis-3/C1-la-costura.md` §2.3). La regla se comprueba con un comando y se decide con
   una lectura.
5. **El defecto de contenido ya tiene dueño** —`F-8eA3-012` lo mide con los dos bloques y el
   desglose de campos, y lo verifiqué contra los dos archivos— **y no lo duplico**. Lo mío es que la
   regla nueva, cuyo valor declarado es ser comprobable, **no lo es**, y que el commit que la
   escribió es uno de los dos únicos de la tanda que reportó una cifra de apariciones.

**Dónde lo permite el diseño.** `12-contrato…`, bloque de apertura (la regla y su comando);
`15-fase-9/00-dominios-de-los-racimos.md` y `15-fase-9/02-R2-resuelto.md` (frontmatter y bloques);
`12-contrato…` §2 y §2.1 (los cinco campos y los seis tipos).

**Severidad.** `MEDIA`. Ningún mecanismo lee esos dos archivos y nadie implementa desde ellos, así
que no hay plata ni acceso. Lo reporto porque **es la única regla de vigilancia del programa
declarada ejecutable por una herramienta**, y su exención está escrita en prosa: el día que alguien
la convierta en un guard va a tener que decidir qué es *«un informe de fase»* y qué es *«un bloque
que define»*, y de esa decisión depende si el guard nace en verde sobre un corpus que la incumple.

**¿Es nuevo, o es el arreglo?** **Es el arreglo: la costura** (`c29b318c7`), que escribió la regla y
su comando en el mismo acto en que retiró las cuatro copias.

**¿Lo habría encontrado el grep?** **Sí — es el grep.** El término es la firma `cobertura(user`, el
comando está escrito en el propio bloque de la regla, y el commit **no toca** `15-fase-9/`. No hay
nada que inventar: correr la línea que el commit escribió devuelve las dos apariciones que la
incumplen.

**¿La resolución POR APARICIÓN lo habría atrapado?** **Sí, y es el hallazgo más incómodo del §4.**
Las dos apariciones están en archivos que `c29b318c7` **no tocó** —sus seis archivos son el handoff,
la partición, el contrato, los dos `spec.md` y `B/02`—, así que son *«apariciones no corregidas en
párrafos que el commit no tocó»*: el corazón de lo que la obligación 2 manda escribir. Y
`c29b318c7` es **uno de los dos únicos commits de la tanda que declaró haber ejecutado esa
obligación con cifras**: *«**90 apariciones recorridas, 15 corregidas, 75 declaradas correctas** con
su rastro por párrafo»*. **O las dos no estaban entre las 90, o están entre las 75 declaradas
correctas y no lo son.** No se puede saber cuál, porque el rastro no existe como documento (§4.2).

---

### F-8eC1-006 — La regla 7 delega su conteo en `G-R4`, y el dominio del guard creció en las dos direcciones en que el guard no puede leer: 8 de las 21 celdas `desde` no son un estado, y la 22ª transición no tiene celda — `NUCLEO`

**Qué se rompe.** `NUCLEO/03` §1 regla 7 es la única defensa contra que el desenlace de una
transición dependa del orden en que una implementación recorra una tabla, y **renuncia
explícitamente a afirmar su propio número** para delegarlo en `G-R4`, cuyo predicado está definido
sobre el par `(desde, evento)`. La tanda hizo crecer la tabla más grande del programa de 19 filas a
21 y **las dos nuevas tienen un `desde` que no es un estado**, así que la proporción de celdas que
el guard no puede leer subió de 6/19 a **8/21**; y le agregó una transición **sin celda ninguna**
(`F-8eC1-001`). El número que la regla congela depende de una decisión de implementación que ningún
capítulo toma, sobre una columna que cada vez tiene menos estados.

**El camino.**

1. La delegación, textual: `NUCLEO/03` §1 regla 7 — *«**Que sean tres y no cuatro no es una
   afirmación de este capítulo: es lo que `G-R4` cuenta en cada PR**, y por eso la regla no depende
   de que alguien vuelva a recorrer las nueve tablas a mano»*.
2. El predicado, textual: `V/20` §2 — *«una tabla de transiciones tiene **dos filas con el mismo
   `(desde, evento)`** cuyas guardas **no son disjuntas**»*.
3. **Recorrí las 21 filas de `B/03` §3.2 el 2026-09-21 y conté las celdas `desde` que no son un
   estado: ocho.** `S13` (*«toda fila viva PRINCIPAL del beneficiario en cada vertical que el acto
   ancla»*), `S14` y `S15` (*«cualquiera»*), `S17` (un **rol** más cinco estados), `S18` (un rol más
   dos estados), `S19` (un rol más dos estados), y las dos nuevas: `S20` (*«toda fila viva **DE
   COMPLEMENTO** … los seis estados»*) y `S21` (ídem). Más `S1`, que es *«(sin fila)»*. Eran **seis
   de diecinueve** en la vuelta anterior.
4. **Y el preámbulo del § cuenta mal las de conjunto.** `F-8eB2-006` mide que declara **dos** y hay
   **tres** (`S13`, `S20`, `S21`); lo verifiqué contra las tres celdas. O sea que **la única
   enumeración que existe de la clase de celdas que `G-R4` no puede leer también está congelada**.
5. **Y el dominio del guard sigue declarado con tres cardinales en cinco sitios**, sin cambios desde
   la vuelta anterior — los verifiqué uno por uno hoy: `NUCLEO/03` §1 regla 7 *«las tablas de
   transiciones de **las nueve máquinas**»* y, doce líneas más abajo, *«**las nueve tablas**»*;
   `V/03` §2 *«**las nueve tablas**»*; `V/20` §2 la fila (*«**las nueve máquinas**»*) y su párrafo
   (*«para que **las seis tablas de billing** no queden vigiladas…»*); `B/20` §2 (*«cubre las
   **seis** tablas de esta épica»*). **Conté las tablas: siete, cuatro en billing** —`V/03` §2, §9,
   §11 y `B/03` §3.2, §6, §7, §8—, el mismo número que la vuelta anterior. Es `F-8dC1-005` llegando
   **entero**, en los cinco sitios y con las tres redacciones.
6. Y la regla no puede arbitrar, porque renunció a hacerlo en la oración anterior.

**Dónde lo permite el diseño.** `NUCLEO/03` §1 regla 7 y su tabla de tres; `B/03` §3.2 (las 21 filas
y el preámbulo del §3) y §10.1; `V/20` §2 (la definición de `G-R4` y su párrafo) y §2.1;
`B/20` §2; `V/03` §2.

**Severidad.** `MEDIA`. Los pares declarados siguen siendo disjuntos y las cuatro tablas de billing
son las cuatro que existen, así que hoy no hay plata ni acceso en juego. Lo roto es el instrumento
que garantiza que el próximo par lo sea, sobre una tabla que la tanda hizo crecer en las dos
direcciones que el guard no alcanza: filas cuyo `desde` es un conjunto, y una transición sin fila.
Sube de `MEDIA` sin cambiar de nivel: la proporción pasó de 32 % a 38 % y la 22ª no tiene celda.

**Marcá `NUCLEO`** — el enunciado de la regla y la delegación son de `NUCLEO/03` §1. `F-8dC1-005` y
`F-8dC1-007` **siguen llegando** y los fusiono acá porque hoy son una sola cosa: un guard al que se
le delega un conteo, cuyo dominio está escrito con tres números, y cuya columna de entrada cada vez
tiene menos entradas legibles.

**¿Es nuevo, o es el arreglo?** **Siguen llegando los dos**, y la tanda los ensanchó: el arreglo
`DEC-ADDON-003` (`6bac7e63a`) creó `S20` y `DEC-ADDON-004` (`456563988`) creó `S21`, las dos con
`desde` de conjunto, y el 11/13 (`4e383480d`) promovió el espejo sin fila.

**¿Lo habría encontrado el grep?** **No, y es el modo que `F-8dC1-007` ya nombró.** El término es
`(desde, evento)` / *«los tres pares»*, y sus apariciones están en `NUCLEO/03`, `V/03` §2 y `B/20`
§2 — los tres tocados por la tanda. Y lo que hay que ver no es una aparición: es que **una columna
de una tabla dejó de contener lo que el predicado de un guard espera leer**. Eso se descubre
recorriendo la tabla, que es la obligación 1 de `DEC-METH-008`, no la 2 de la 009 ni la 010.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** El *«seis tablas de billing»* de
`V/20` §2 sí es una aparición vieja en un párrafo que ningún commit de la tanda tocó —`V/20` no está
entre los archivos de ninguno de los once, lo verifiqué contra la tabla del §2.3— pero **no contiene
ningún término redefinido por la tanda**: dice *«tablas de billing»*, no `S20`, ni `S21`, ni
*«espejo»*. La obligación 2 rastrea apariciones **de los términos que el arreglo redefine**, y un
cardinal obsoleto no es una de ellas.

---

### BAJA

### F-8eC1-007 — El resumen del decision log sigue declarando «7 apartamientos del PDR» con el octavo escrito en el título de su propia decisión, dos tandas después, mientras el mismo bloque se recontó a 76 decisiones

**Qué se rompe.** El log es el único registro de en qué se aparta este programa de su PDR, y la
regla que lo obliga está en su primera página: *«Si una decisión se aparta del PDR, el PDR **no se
edita** (§3.1): se registra acá el apartamiento y por qué»*. El resumen los cuenta y los enumera uno
por uno, y sigue enumerando **siete** mientras `DEC-GRANT-006` lleva el apartamiento en su propio
título. Es `F-8dC1-010`, **sin cambios en dos tandas**, y en el mismo bloque donde la cifra de
decisiones sí se recontó a 76.

**El camino.**

1. El resumen, textual, hoy: *«| Apartamientos declarados del PDR | **7** — `DEC-ENT-001` (§10.3),
   `DEC-GRANT-002` (§34) y `DEC-ARCH-003` …, `DEC-OBS-001` …, `DEC-METH-004` …, `DEC-SUB-011` … y
   `DEC-METH-006` … |»*. Los conté: **siete enumerados**.
2. El octavo lo dice el título de su propia decisión, línea 2818 del log: *«### `DEC-GRANT-006` — La
   cortesía es POR SUSCRIPCIÓN: se retira su `scope`, y **el §34 del PDR queda desviado a
   propósito**»*.
3. **Y las ocho decisiones nuevas de esta tanda no agregaron ninguno**: grepeé *«apartamiento»*,
   *«se aparta»* y *«queda desviado»* sobre todo el log desde la línea 2818 y no hay ninguna
   ocurrencia. O sea que el inventario está corto por **uno**, el mismo de la vuelta anterior, y no
   por nueve.
4. Y el conteo se usa: `NUCLEO/08` §4.2 se numera contra él (*«es el **cuarto** apartamiento del
   programa»*) y `NUCLEO/01` §2.1 también (*«Es el **tercer** apartamiento»*). Con el octavo sin
   numerar, el próximo no sabe qué ordinal tomar.

**Dónde lo permite el diseño.** `01-decision-log.md`, la regla de apertura y la fila *«Apartamientos
declarados del PDR»* del resumen; `DEC-GRANT-006`; `NUCLEO/08` §4.2; `NUCLEO/01` §2.1.

**Severidad.** `BAJA` — no cambia ninguna resolución y el apartamiento **está declarado** donde la
regla lo exige. Falta el renglón del inventario. Lo reporto porque es el único conteo del programa
que se puede cerrar con una línea y lleva dos tandas abierto, y porque muestra la asimetría exacta:
en el mismo bloque, la cifra que un `rg` produce (76 decisiones) está al día y la que exige leer los
títulos (los apartamientos) no.

**¿Es nuevo, o es el arreglo?** **Sigue llegando, entero.** `F-8dC1-010`, introducido por
`DEC-GRANT-006` (`50c3e2196`) en la tanda 9-bis-2. Ninguno de los once commits de la 9-bis-3 tocó la
fila.

**¿Lo habría encontrado el grep?** **No, y el sujeto está fuera del alcance por declaración.** La
obligación 1 de `DEC-METH-010` extiende el alcance a *«todo el corpus»* y el decision log es parte
de él, pero el término a grepear sería *«apartamiento»*, que **ninguna de las ocho decisiones nuevas
redefine**. Es el modo 5 de la vuelta anterior —*«el documento que no es un capítulo»*— sobreviviendo
a la ampliación del alcance, porque lo que lo excluye ya no es el alcance sino que **no hay término**.

**¿La resolución POR APARICIÓN lo habría atrapado?** **No.** Cero apariciones de un término
redefinido en esa fila. Lo que la atrapa es la misma propuesta del `F-8eC1-004`: una lista de dónde
viven los conteos del programa, recorrida entera cuando uno de ellos se mueve.

---

## 2. La deduplicación de los críticos — el encargo

> **Los siete informes existían cuando conté**, y `C2` entre ellos desde el primer recorrido, que es
> la razón por la que `C1` corre último.

**Los 13 IDs `CRITICA` de los siete informes son 12 defectos críticos distintos.** Ninguno de mis
siete hallazgos es `CRITICA`, así que el conteo de la pasada es **13 IDs sobre 12 defectos**.

El punto de partida lo conté yo con `rg -c '^\*\*Severidad\.\*\* \`CRITICA\`'`: A1 1 · A2 2 · A3 2 ·
B1 2 · B2 3 · B3 3 · **C2 0** = **13**, que coincide con el recuento del orquestador.

### 2.1 El criterio de colapso, declarado ANTES de aplicarlo

**Dos IDs son el mismo defecto si el daño es el mismo evento sobre la misma persona Y una sola
corrección lo elimina.** Un mismo daño con dos correcciones distintas son dos defectos; una misma
corrección para dos daños distintos también. **Si la población de uno está contenida en la del otro
y la corrección del más ancho cierra al más angosto, colapsan** — y en ese caso digo qué residuo
queda afuera del colapso, porque un residuo escondido es la forma de deduplicar de menos.

### 2.2 El mapa: qué ID colapsa en cuál

| # | defecto crítico distinto | IDs `CRITICA` | otros IDs del mismo defecto | de dónde salió |
|---|---|---|---|---|
| **1** | **`PB8` es inejecutable justo para la población que el hard delete del día 180 borra**: el paso 6 resuelve contra el piso, que otorga dos cosas y ninguna es reactivar | `F-8eA1-001` | `F-8eA1-007` (`BAJA`, la regla que la describe más angosta) | `DEC-DATA-002` |
| **2** | **El excedente tras un downgrade no tiene camino de vuelta**: `PB2` tiene dos ramas y `PB3`/`PB7` una sola; el que vuelve a subir de plan paga el grande y sus fichas no se republican nunca, y al día 180 se borran | `F-8eA2-001` | `F-8eA2-010` (`MEDIA`, el cupo sin criterio), `F-8eA1-006` (`MEDIA`, ídem) | arreglo 9 de la 9-bis-2, vuelto terminal por `DEC-DATA-002` |
| **3** | **La cortesía re-apuntada por `S18` no tiene transición que la ejecute**: `hacia` es *«el mismo estado»*, `S9` es la única fila que llega a `PAUSED · COURTESY` y sale de `ACTIVE`, y `B/14` §4.4 declara inexistente el caso que el espejo produce | `F-8eB2-001`, `F-8eB3-001` | **`F-8eB1-003` (`ALTA`, el mismo defecto — ver §3.1)** | arreglos 5, 7 y 11/13 |
| **4** | **`S10` no tiene rama de fallo y es la única que reinicia el reloj**: una pausa que no reanuda no la ve el barrido —los dos lados dicen `paused`— y `D16` sigue en verde porque compara catálogo, no tiempo real | `F-8eA2-002` | `F-8eA2-006` (`ALTA`, `G-R5` no corre donde hace falta), `F-8eB1-010` (`MEDIA`, la cortesía sin tope) | `DEC-DATA-002` |
| **5** | **La clave de deduplicación del outbox no lleva la fecha para la retención**: con el reloj ya reiniciable, los dos avisos del borrado salen una vez en la vida de la ficha y el segundo ciclo hard-deletea sin avisar | `F-8eA3-001` | — | `DEC-DATA-002` |
| **6** | **El reloj de inactividad no tiene columna en ninguna entidad**, y su hecho de reinicio más importante se lee de un aviso que el contrato prohíbe usar para decidir | `F-8eA3-002` | `F-8eA3-003` (`ALTA`, `D16`/`G-R5` sin qué leer) | `DEC-DATA-002` |
| **7** | **El re-anclaje de `MP4` es incondicional**: el pagador manual que se pone al día dentro del período que estaba pagando paga dos veces los días que le quedaban | `F-8eB1-001` | `F-8eB1-007` (`MEDIA`, la otra puerta que no re-ancla) | `DEC-SUB-013` |
| **8** | **`MP5` dispara sobre una columna que nadie avanza**: después de la primera cuota, la del pagador manual no se abre nunca más y el servicio queda gratis en silencio | `F-8eB1-002` | `F-8eB1-005` (`ALTA`, el §7 con población vacía) | `DEC-SUB-013` |
| **9** | **`S20` copió de `S13` la idempotencia teniendo DOS escrituras sobre dos entidades**: una corrida cortada deja el addon gratis para siempre, sin ancla-título, y el detector pregunta por la mitad ya ejecutada | `F-8eB2-002` | `F-8eB3-004` (`ALTA`, la comprobación más ancha que el `desde`) | `DEC-ADDON-003` |
| **10** | **Cancelar tiene UNA sola fila, `S11`, con `desde` = `ACTIVE`**: el pausado que pide la baja paga el ciclo siguiente y el pagador manual `SUSPENDED` queda encerrado con el candado `A` ocupado | `F-8eB2-003` | `F-8eB1-009` (`MEDIA`, el tope de `MP4` que se apoya en ese acto), `F-8eB2-008` (`MEDIA`, `MP5` reduce aún más la ventana) | `DEC-SUB-012`, sobre una fila anterior |
| **11** | **«Ancla viva» y «grant vivo» no tienen columna**: `permanent_grant` no declara estado ni revocación, así que las dos comprobaciones que esta tanda escribió para lo indetectable no se pueden evaluar | `F-8eB3-002` | — | arreglo 12 + `DEC-ADDON-006` |
| **12** | **`requiere_conciliación` es booleano y `S18` le escribe un MOTIVO**: la única instrucción que dice *«devolvéle la plata»* no tiene columna y llega al humano como una marca más, indistinguible de las otras seis | `F-8eB3-003` | `F-8eB1-004` (`ALTA`, el mismo hueco por la puerta de `S21`), `F-8eB1-011` (`MEDIA`, *«la única de las cuatro»*) | arreglo 4 |

### 2.3 El único colapso, verificado contra el texto y no contra los informes

**`F-8eB2-001` + `F-8eB3-001` + `F-8eB1-003` son UN defecto (el #3).** El orquestador lo anticipó
para los dos primeros; lo verifiqué contra los capítulos y **son tres, no dos**, y la caracterización
del adelanto es incompleta.

**Lo que verifiqué, cita por cita:**

1. `B/03` §3.2, fila `S18`, columna `hacia`: ***«el mismo estado»***. Recorrí la fila entera.
2. `B/03` §3.2, fila `S9`: `desde` `ACTIVE`, evento *«`SUPER_ADMIN` otorga cortesía»*, `hacia`
   `PAUSED` *(motivo `COURTESY`)*. **Recorrí las 21 filas: es la única que aterriza en
   `PAUSED · COURTESY`.**
3. `B/02` §2.6 y `B/14` §4.4 exigen los dos que *«la sucesora **queda pausada con motivo `COURTESY`**
   por los días que quedaban»*.
4. `B/14` §4.4, líneas 265-267, textual: *«El segundo camino de `S18` —la predecesora que se muere
   sola— sale de **`S12`** … o de **`S16`** … **No hay caso en que haya que pausar un preapproval
   que todavía no autorizó.**»* **Son dos caminos y hoy son tres**: la línea 135 del **mismo
   archivo** dice *«cuando la predecesora se murió sola por `S12`, por `S16` **o por el espejo**»*.
   Las dos frases conviven a 130 líneas de distancia.

**Por qué colapsan.** El daño es el mismo evento sobre la misma persona —el beneficiario de una
cortesía firmada por `SUPER_ADMIN` paga los días que le regalaron— y **la población de `B3-001`
contiene a la de `B2-001`/`B1-003`**: `B3-001` dice *«la sucesora llega a `S18` en `ACTIVE` (**o en
`PENDING_AUTHORIZATION`**)»* y su *«segunda mitad»* desarrolla exactamente el caso del espejo. Y una
sola corrección los elimina: **una fila en `B/03` §3.2 que lleve la sucesora a `PAUSED · COURTESY`
al cerrar la sucesión, con `desde` = {`ACTIVE`, `PENDING_AUTHORIZATION`}**, que al escribirse obliga
a corregir la enumeración de `B/14` §4.4 en el mismo acto.

**Dos cosas que el adelanto del encargo dice y el texto no sostiene, y hay que decirlas:**

- **La caracterización *«la cortesía sobre una predecesora `PAUSED` que el espejo mata»* es la de
  `B2-001`, no la de `B3-001`.** La población principal de `B3-001` es el **cambio de plan normal**
  —*«El cliente al que `SUPER_ADMIN` le regaló tres meses cambia de plan en el mes uno»*—, donde la
  sucesora está `ACTIVE` y el espejo no interviene. Colapsan por contención, no por ser el mismo
  camino.
- **Son tres IDs, no dos**: `F-8eB1-003` describe el mismo defecto con el mismo camino y lo califica
  `ALTA`. El veredicto de severidad está en §3.1.

**El residuo que el colapso NO absorbe, declarado:** pausar un preapproval que todavía no autorizó
es una llamada al proveedor **que nadie midió** —`B/20` §3.2 tiene `EX-11` para la pausada y `EX-39`
para las fechas, y nada para una `pending`—. Escribir la fila cierra los tres IDs **de diseño**; si
la medición vuelve *«el proveedor no deja pausar una `pending`»*, el `desde` de la fila nueva no
puede incluir ese estado y hay que elegir otro mecanismo. **Es una medición faltante, no un defecto
aparte**, y por eso no lo cuento como #13.

### 2.4 Cuatro racimos que parecen uno y NO colapsan, con la razón medida

1. **Los cinco de `DEC-DATA-002` que terminan en el hard delete del día 180 —#1, #2, #4, #5, #6— son
   cinco.** Todos acaban en la misma frase de `V/02` §4.1 y todos vienen del mismo commit, y **las
   cinco correcciones son disjuntas**: el piso tiene que otorgar reactivar (#1); `PB3`/`PB7`
   necesitan una segunda rama por cupo (#2); `S10` necesita rama de fallo o detector (#4); la clave
   del outbox necesita la fecha objetivo (#5); el reloj necesita una columna (#6). **Ninguna cierra a
   otra**, y lo verifiqué caso por caso: con la columna del #6 escrita, la pausa que no reanuda
   (#4) sigue sin reiniciar el reloj porque el hecho que lo reinicia no ocurre; con la rama de
   `PB3` (#2), el que canceló (#1) sigue sin poder reactivar.
   **Lo que sí comparten es el detector, y vale decirlo porque cambia el costo**: ninguno de los
   cinco lo detecta nadie, porque **verticales no tiene barrido** (`F-8A2-005`, abierto desde la
   FASE 8). Un barrido de verticales que comparara *«fichas cuyo reloj cruzó el día 90»* contra
   *«fichas cuyo dueño tiene una fuente `TÍTULO` viva»* **detecta el desenlace de #1, #2 y #4**,
   aunque no cierre ninguno. Cinco defectos, cinco escrituras, un detector.
2. **#7 y #8 son dos, y están en tensión aparente.** Los dos salen de `DEC-SUB-013` y del mismo
   §7.2. Parecen contradecirse —uno dice que el período se re-ancla, el otro que nunca avanza— y no
   se contradicen: **el re-anclaje de `MP4` es una de las dos únicas escrituras de esa columna**, así
   que los dos ocurren en secuencia sobre el mismo cliente. Lo verifiqué con
   `rg "período actual"` sobre los trece capítulos de billing, el núcleo y el contrato: **dos
   archivos** —`B/02` §2.2, la columna, y `B/03` §7.2, la condición de `MP5`— y ninguna escritura que
   avance de un período al siguiente. Correcciones opuestas: #7 pide **condicionar** el re-anclaje,
   #8 pide **agregar** una escritura que avance.
3. **#9 y #11 son dos aunque el desenlace de #9 dependa del detector que #11 vuelve inevaluable.**
   #9 es que `S20` no es idempotente —dos escrituras, la primera saca la fila de su propio `desde`—;
   #11 es que el predicado de las comprobaciones 3 y 4 no tiene columna que leer. Con la columna de
   #11 escrita, la corrida cortada de #9 sigue dejando el ancla-título en nulo y **la segunda mitad
   de la cuarta comprobación sigue sin sujeto**; con `S20` hecho idempotente, la tercera comprobación
   sigue sin poder preguntar si el grant está vivo.
4. **#10 y #7/#8 no se fusionan aunque los tres caigan sobre el pagador manual.** #10 es que el acto
   de cancelar no tiene fila desde `SUSPENDED` ni desde `PAUSED`; #7 y #8 son la aritmética del
   período. Arreglar `S11` deja las dos escrituras del período exactamente igual.

### 2.5 La proporción

| | 8-bis | 8-bis-2 | 8-bis-3 | **8-bis-4** |
|---|---|---|---|---|
| hallazgos | 112 | 120 | 85 | **83** — 76 nuevos de A/B/C2 + 7 míos (los viejos que siguen llegando van con su ID viejo) |
| `CRITICA`, contados por ID | 28 | 27 | 18 | **13** |
| `CRITICA`, **defectos distintos** | no se midió | 17 | 14 | **12** |
| **atribuidos a la tanda de arreglos anterior** | 25 de 25 | 17 de 17 | 13 de 14 | **12 de 12** — ver §4.1 |

**Y hay que decir qué `CRITICA` de vueltas anteriores sigue abierto.** Reejecuté `F-8cC1-001` —la
pausa larga que cruza el día 90, `ARCHIVED` sin salida y el hard delete del 180— y **corta**:
`DEC-DATA-002` le dio a `ARCHIVED` dos salidas (`PB7`, `PB8`) y al reloj cuatro hechos de reinicio.
Es el `CRITICA` más viejo del programa y la tanda lo cerró. **Lo que ocupó su lugar son cinco
críticos nuevos del mismo commit** (§2.4 punto 1), que es la observación entera de esta pasada.

---

## 3. Las contradicciones entre informes, con veredicto — el encargo

Verifiqué cada una **contra el texto del capítulo**, nunca contra el informe que la cita. **Cuatro,
y dos de las cuatro no son contradicciones** — que es el mismo reparto que la vuelta anterior y
también es un resultado.

### 3.1 `F-8eB2-001` y `F-8eB3-001` (`CRITICA`) contra `F-8eB1-003` (`ALTA`) · **manda `CRITICA`, y el argumento de `B1` para bajarlo es correcto sobre su propia mitad y no sobre el defecto**

**Lo que dice cada uno.** Los tres describen el mismo defecto (§2.3). `B2` y `B3` lo ponen
`CRITICA`. `B1` lo pone `ALTA` con este argumento textual: *«No la subo a `CRITICA` porque el
disparador —que el proveedor cancele un preapproval pausado— **no está medido** en la matriz, así
que la población es real pero no está cuantificada»*.

**Verificado contra el texto, y el argumento de `B1` es verdadero para el camino del espejo y falso
para el defecto.**

1. El disparador que `B1` declara no medido es el del espejo sobre una predecesora `PAUSED`. **Es
   cierto que no está**: corrí `contar-filas-de-la-matriz.py` y las ocho filas `UNKNOWN` son `RN-2`,
   `RN-3`, `GR-1`, `GR-2`, `GR-3`, `WH-5`, `RF-3`, `EX-1`; `GR-3` es *«la política de reintentos del
   proveedor»*, que `B/03` §3.2 cita textualmente para decir que **cuándo llega la baja por mora no
   se puede acotar**. `B1` mide bien.
2. **Pero el defecto no necesita el espejo.** `B3-001` lo ataca por el camino normal: el cliente con
   cortesía **cambia de plan**, la sucesora autoriza (`S2` → `ACTIVE`), `S18` cierra con `hacia` =
   *«el mismo estado»*, y no hay fila que la pause. Ese disparador es el camino que `B/12` §5.3 llama
   *«el camino normal del cambio de plan»* y no depende de ninguna medición pendiente.
3. **Y el daño es el criterio de la fase, literal**: *«alguien paga de más»*. El beneficiario de una
   concesión firmada por `SUPER_ADMIN` paga los meses que le regalaron, **sin marca y sin detector**
   —`B/14` §4.4 lo dice con esas palabras: *«el barrido no compara grants, la fila no queda marcada,
   y el cliente se entera cuando le cobran»*, y recorrí las cuatro comprobaciones de cero llamadas de
   `B/09` §3: miran `sucede_a`, el pago pendiente por `S19`, las anclas de un grant y las instancias
   de addon. **Ninguna mira `courtesy_grant`.**

**Veredicto: `CRITICA`.** Cuenta **una vez**, como defecto **#3**. `B1` acierta en el camino, aporta
la mitad que los otros dos no tienen —la matriz no mide pausar una `pending`, que es lo que vuelve
inejecutable la salida obvia— y su severidad es la que no se sostiene, porque **acotó el defecto a la
mitad que su propio vector alcanzaba**.

### 3.2 `F-8eA1-001` contra `F-8eA2-001` sobre si `PB8` es ejecutable · **NO es una contradicción: las dos poblaciones son disjuntas y la frontera es exactamente lo que vuelve crítico a `A1`**

**Lo que dice cada uno.** `A1-001`: *«El paso 6 de la autorización la rechaza»*, porque el conjunto
efectivo de quien no tiene fuente `TÍTULO` es la versión de piso, que otorga *«ninguna capacidad
comercial, y la de contratar una suscripción»*. `A2-001`: *«`PB8` … el dueño la reactiva … el cliente
que subió de plan tiene que esperar tres meses a que se le archive la ficha para poder recuperarla a
mano en dos pasos»*, o sea que **sí** puede ejecutarla.

**Verificado contra `V/02` §2.1 y `V/17` §1.2, y los dos tienen razón sobre sujetos distintos.**

- El sujeto de `A1-001` **canceló**: no tiene ninguna fuente de clase `TÍTULO`, su conjunto efectivo
  es el piso, y el paso 6 lo rechaza. La lista del piso es exhaustiva y la vigila `G-R3` (`V/20` §2),
  así que no se puede leer por omisión.
- El sujeto de `A2-001` **paga Premium**: tiene una fuente `TÍTULO` viva y su conjunto efectivo es la
  versión de ese plan, que otorga las capacidades sobre fichas. `PB8` es ejecutable para él.

**Veredicto: no hay contradicción, y la frontera entre las dos lecturas es el hallazgo.** Lo que
separa *«`PB8` funciona»* de *«`PB8` no existe para nadie»* es **tener una fuente `TÍTULO` viva** — y
la población que el hard delete del día 180 borra es, por construcción, la que no la tiene. `PB8` se
escribió para *«el que quiere su ficha de vuelta **sin pagar todavía**»* (`V/03` §9, su propia
columna *«para quién existe»*) y es ejecutable **sólo por el que paga**. Los dos informes miden
mitades correctas del mismo enunciado y ninguno de los dos lo dice, porque cada uno vio la suya.

### 3.3 ¿El espejo tiene cinco, cuatro o dos `desde`? · **los tres números están escritos en el mismo capítulo y ninguno de los informes se equivoca: la contradicción es interna a `B/03`**

**Lo que dice cada uno.** `F-8eB2-005` cuenta **tres redacciones**. `F-8eB1-003` cita la de §10.1
(*«cualquier estado vivo que no sea `CANCEL_SCHEDULED`»*). `F-8eB2-001` la usa para decir que incluye
`PAUSED`. `F-8eB3-006` razona sobre el barrido con una cuarta consecuencia.

**Los verifiqué contra las tres líneas del archivo** (§1, `F-8eC1-001` paso 3): `B/03` §10.1 línea
1387 → cinco; el recuadro de la aritmética del §3.2 → cuatro; la fila 7 de la tabla de recorrido →
dos. **Ninguno de los cuatro informes se equivoca: cada uno citó la redacción que su camino
necesitaba, y las tres están en el mismo archivo.**

**Veredicto: la contradicción no es entre informes, es entre tres párrafos de `B/03`**, y su causa es
única: **la transición no tiene fila**, así que su `desde` se re-escribe cada vez que alguien la
necesita. Va como `F-8eC1-001`, y la consecuencia práctica es la misma que la vuelta anterior: **la
fila primero**. Corregir las tres redacciones sin escribir la fila garantiza una cuarta.

### 3.4 `F-8eA3-015` declara que el número de `B/16` §4.3 «hoy es correcto» · **lo es, y por una razón distinta de la que el informe da**

**Lo que dice.** `A3-015`: *«Hoy el número es correcto, **lo verifiqué contra `B/03` §3.2**»*, y su
paso 5: *«La tanda agregó `S20` y `S21`, las dos hacia `CANCELLED`. **Las dos son de complemento**,
así que la cifra de seis sigue siendo correcta hoy»*.

**Verificado.** Recorrí las 21 filas: las que sacan a una fila **principal** de las filas vivas son
`S3`, `S12`, `S13`, `S16` y `S17` — **cinco**. La sexta, el espejo, **no está en `B/03` §3.2**: está
en §10.1 y no tiene fila. O sea que *«lo verifiqué contra `B/03` §3.2»* devuelve **cinco**, no seis;
el número es correcto porque el propio `B/16` §4.3 nombra al sexto con un paréntesis que dice que no
tiene fila.

**Veredicto: la conclusión de `A3-015` es correcta y su verificación no la sostiene**, y la
diferencia importa para el arreglo: `A3` reporta que **falta un control para una séptima**
transición futura, y no ve que **la sexta ya no es verificable** contra la tabla que su propia cita
nombra. Las dos mitades son reales, y la segunda es `F-8eC1-001`. No cambia ninguna severidad ni
ningún conteo de críticos.

### 3.5 Una nota de registro, medida, que no es una contradicción pero conviene dejar escrita

`B2` cita `F-8eB2-011` en el cuerpo de `F-8eB2-003` (*«ver `F-8eB2-011`»*) y **ese ID no existe**:
conté los encabezados de su informe con `rg "^### F-8e"` y son **diez**, `F-8eB2-001` a `-010`. El
contenido al que remite —`MP5` reduce la ventana en que `S11` es alcanzable— está en `F-8eB2-008`.
Es una remisión rota dentro de un informe, no un defecto del diseño; la anoto porque `B2` aporta
tres de los doce críticos y su numeración interna es lo que un lector va a seguir.

---

## 4. ¿`DEC-METH-010` cortó el generador? — el encargo

**La respuesta corta: no cortó el generador, y por primera vez se puede decir DÓNDE sí cortó y por
qué no alcanzó — y la razón no es una limitación de la búsqueda, es una exclusión que la propia
enmienda escribió.**

### 4.1 La atribución: 12 de 12, y la serie no bajó

Recorrí los doce defectos del §2.2 y clasifiqué su atribución contra el texto de cada informe y
contra los diffs:

| | 8-bis | 8-bis-2 | 8-bis-3 | **8-bis-4** |
|---|---|---|---|---|
| críticos distintos | no se midió | 17 | 14 | **12** |
| **los introdujo la tanda anterior** | 25 de 25 | 17 de 17 | 13 de 14 | **12 de 12** |
| de ellos, **nacidos enteros** en la tanda | — | — | — | **9** |
| de ellos, **preexistentes que la tanda volvió críticos** | — | — | — | **3** — #2 (`PB2`/`PB3` de la 9-bis-2, vuelto terminal por el reloj), #4 (`S10` nunca tuvo rama y pasó a sostener sola una garantía), #10 (`S11` desde `ACTIVE`, sobre el que `DEC-SUB-012` colgó el tope de una ventana que mueve dinero) |

**Y el catorceavo de la vuelta anterior —el que NO había producido la tanda, la firma copiada en los
dos `spec.md`— se cerró.** `c29b318c7` retiró las cuatro copias. **Ése es el único defecto de la
serie que se arregló sin generar un crítico nuevo**, y es un dato del §4.3.

### 4.2 Qué declara cada commit, medido por mí, y el rastro que no existe

Lo verifiqué con `git show --name-only` sobre los once: **la tabla del §2.3 de las instrucciones es
exacta, fila por fila**, incluidos los conteos de archivos. Lo que agrego es la columna que decide el
veredicto: **cuántos críticos produjo cada uno**.

| commit | archivos | ¿reporta cifra de apariciones? | **críticos distintos que produjo** |
|---|---|---|---|
| `1e3c3fc9e` (trial y grant) | 16 | **sí** — *«72 apariciones no corregidas justificadas una por una»* | **0** |
| `f4edbdfdf` (la sucesión) | 17 | no | **2** (#3 con `4e383480d`, #12) |
| `4e383480d` (`S13` y complementos) | 13 | no | **1** (#11 con `456563988`) + su mitad de #3 |
| `a85f5bb7e` (pago manual y addon) | 13 | no | **0** |
| `c29b318c7` (la costura) | 6 | **sí** — *«90 recorridas, 15 corregidas, 75 declaradas correctas»* | **0** |
| `fe7d14914` (`DEC-TRIAL-009`) | 3 | no | **0** |
| `621332e7c` (`DEC-DATA-002`) | 18 | no | **5** (#1, #2, #4, #5, #6) |
| `6bac7e63a` (`DEC-ADDON-003`) | 12 | no | **1** (#9) |
| `456563988` (`DEC-ADDON-004`) | 10 | no | su mitad de #11 |
| `71615bb41` (`DEC-SUB-012`) | 7 | no | **1** (#10) |
| `1c17565e1` (las tres chicas) | 6 | no | **2** (#7, #8) |

**Y el rastro que la obligación 2 manda escribir no existe como documento — lo verifiqué yo, como
manda el encargo.** `git diff --name-status 1e3c3fc9e~1 1c17565e1 | rg '^A'` devuelve **cero
archivos agregados** por los once commits, y
`rg -il "por aparici|declaradas correctas|apariciones recorridas" .specs/`, excluidos los seis
directorios de informes de fase, devuelve **un solo archivo: el decision log**, que es donde la regla
se enuncia. **Las cifras existen únicamente como agregados en dos mensajes de commit, y un mensaje de
commit no es evidencia de lo que se hizo.**

**Consecuencia, y es la que hay que sacar:** la obligación 2 de `DEC-METH-010` cambió el diagnóstico
de `DEC-METH-009` —*«una resolución en bloque no es falsable»*— por una resolución **por aparición**
que, al no dejar artefacto, **tampoco es falsable**. *«72 apariciones justificadas una por una»* es
exactamente tan verificable como *«101 declaradas correctas»*: en los dos casos el único lector
posible es el que las escribió. La enmienda arregló la granularidad y no la evidencia.

### 4.3 El patrón del encargo, verificado y corregido en dos números

El encargo propone que *«los críticos parecen repartirse por decisión del owner y no por vector»*.
**Lo verifiqué contra la atribución de los doce y es verdadero, con dos correcciones de conteo:**

- **`DEC-DATA-002` produjo CINCO, no cuatro** (#1, #2, #4, #5, #6). El quinto es `F-8eA2-001`, que
  `A2` atribuye a medias al arreglo 9 de la 9-bis-2 — pero lo que lo vuelve crítico, con sus
  palabras, es que `DEC-DATA-002` *«definió la inactividad, le puso a `PB4` un `desde` que incluye
  `UNPUBLISHED_BY_BILLING` leído contra ella, escribió `PB7` copiando la condición de `PB3` palabra
  por palabra, y declaró la vuelta resuelta»*. Sin esa mitad el daño era una ficha abajo; con ella es
  un hard delete.
- **`DEC-SUB-013` produjo dos y `DEC-SUB-012` uno**, los tres sobre el pagador manual, y el encargo
  los cuenta juntos como *«el resto de `S18`, `S20` y `S21`»*. Son tres commits distintos.

**El reparto correcto de los doce:** `DEC-DATA-002` **5** · `DEC-SUB-013` **2** · la familia de la
sucesión (`f4edbdfdf` + `4e383480d`) **2** + su mitad de #11 · `DEC-ADDON-003` **1** ·
`DEC-SUB-012` **1** · `DEC-ADDON-006` la otra mitad de #11.

**Y el dato del encargo que más pesa es correcto y lo verifiqué:** los **seis commits de decisiones
no reportan ninguna cifra de apariciones**, aunque **los seis editan capítulos y los seis editan el
núcleo** —lo comprobé con `git show --name-only` sobre los seis: `fe7d14914` toca `nucleo/08` y
`V/11`; `621332e7c`, `nucleo/01`, `/03`, `/04`, `/07` y ocho capítulos; `6bac7e63a`, tres del núcleo
y nueve capítulos; `456563988`, dos del núcleo y siete; `71615bb41`, `nucleo/07` y cinco;
`1c17565e1`, `nucleo/03` y cuatro—. **Nueve de los doce críticos salieron de esos seis commits.**

**Y el contraste es el hallazgo de método de esta pasada:**

> **Los dos únicos commits que ejecutaron la obligación 2 con cifras produjeron CERO de los doce
> críticos.** `1e3c3fc9e` tocó **16** archivos y `621332e7c` tocó **18**: exposición comparable,
> **0 contra 5**. `c29b318c7` tocó 6 y su muestra es chica, pero `1e3c3fc9e` no.

**Con una excepción que hay que decir y que es la misma forma que la vuelta pasada.** `c29b318c7`
declaró *«90 apariciones recorridas, 75 declaradas correctas con su rastro por párrafo»* sobre la
firma del contrato, y corrí su propio comando: **quedaron vivos dos bloques que definen**, en
`15-fase-9/00` y `15-fase-9/02`, los dos con `status: CURRENT`, los dos en archivos que ese commit
**no tocó** — o sea dentro del alcance literal de la obligación 2 (`F-8eA3-012`, `F-8eC1-005`). **O
no estaban entre las 90, o están entre las 75 declaradas correctas y no lo son**, y no se puede
saber cuál porque el rastro no existe. Es `F-8dC1` §4.3 una vuelta después, con la regla enmendada:
**la obligación 2 hizo la resolución más fina y no la hizo verificable.**

### 4.4 Cuántos habría atrapado cada mitad de la regla, y el reparto de los que se escapan

Recorrí los doce y clasifiqué con la respuesta de cada informe, corregida donde la verifiqué:

| | cuántos | cuáles |
|---|---|---|
| **el grep los habría mostrado** (alcance de `DEC-METH-010`: todo el corpus) | **5 de 12** | #2, #3 (por la puerta de `B2`/`B1`), #8, #9, #10 |
| **no** | **7 de 12** | #1, #4, #5, #6, #7, #11, #12 |
| **la RESOLUCIÓN POR APARICIÓN los habría atrapado** | **3 de 12** | #2, #3, #10 |
| **no** | **9 de 12** | #1, #4, #5, #6, #7, #8, #9, #11, #12 |

**Y los nueve que la resolución por aparición no atrapa se reparten en cinco modos — pero cinco de
los nueve son EL MISMO modo, y es uno que la enmienda creó.**

| # | modo | qué pasa | cuáles | ¿lo nombra algún informe? |
|---|---|---|---|---|
| **1** | **la prosa nueva entera** | el defecto nace adentro de un párrafo que el commit escribió de cero, y la obligación 2 acota su rastro a *«párrafos que el commit **no** tocó»*: tiene **cero sujetos** | **#4, #7, #8**, y la mitad de #6 | sí — `B1` lo pone en su encabezado (*«las dos apariciones son párrafos que ese commit escribió de cero»*), `A2` y `A3` |
| **2** | **el párrafo editado** | la aparición que contradice está en el párrafo —o en la **misma celda**— que el commit editó, así que queda afuera por el **otro** extremo del mismo recorte | **#12** (la declaración *«(booleano)»* en la fila que el commit amplió) y **#9** | sí — `B3` (*«el párrafo también se abrió, se editó, y la contradicción estaba en la misma celda»*), `B2` (*«un párrafo editado no es un párrafo verificado»*) |
| **3** | **la ausencia** | falta una fila o una columna, y una ausencia no tiene aparición | **#11** (la columna de `permanent_grant`), **#6** (la columna del reloj), y la mitad de #3 | sí — `B3` y `A3` |
| **4** | **el paso no declarado** | una operación nueva declara **uno** de los nueve pasos de un procedimiento | **#1** (`PB8` declara el paso 4 y ninguno más) | sí — `A1`, que lo mide con `rg -n "PB7\|PB8"` sobre `V/17`: dos líneas, las dos del paso 4 |
| **5** | **la propiedad nueva, no el término** | lo que cambió no es una palabra sino un comportamiento del sujeto (*«este reloj ahora se reinicia»*), y una propiedad no se grepea | **#5** | sí — `A3` |

**Los modos 1 y 2 son cinco de los nueve y son la misma cosa vista de los dos lados: la obligación 2
excluye de su rastro todo lo que el commit escribe o edita.** No es un límite de la búsqueda —la
obligación 1 ya puso todo el corpus en el alcance y dice *«un archivo abierto no es un párrafo
leído»*— sino del **rastro**, que es lo único falsable. `B2` escribió la simétrica que falta, y es
una línea: ***«un párrafo editado no es un párrafo verificado»***.

### 4.5 Las correcciones, con su costo — propuesta, no aplicada

No toco el decision log. Lo que sigue es lo que propongo, ordenado por lo que compra, con lo que
**no** cierra dicho en voz alta.

**Corrección A — el rastro por aparición es un ARCHIVO, no una línea del mensaje del commit.** Es la
más barata de todas y la única que vuelve verificable todo lo demás. Hoy *«72 apariciones
justificadas una por una»* no se puede leer: el artefacto no existe (§4.2). Que el arreglo agregue
un archivo —`docs/<tanda>/rastro-<commit>.md`, tres columnas: archivo, §, por qué sigue siendo
correcta—. **Compra: cero críticos por sí sola, y hace falsable a las otras tres.** Costo: cero, es
escribir en un archivo lo que ya se declara haber escrito en algún lado. **Sin esto, las tres que
siguen son indistinguibles de no haberse aplicado**, que es exactamente lo que esta pasada tuvo que
medir a mano sobre once commits.

**Corrección B — el rastro cubre también los párrafos que el commit escribe y edita.** Reemplazar
*«que no se corrige **y está en un párrafo que el commit no tocó**»* por *«que no se corrige, **en
cualquier párrafo del corpus, incluidos los que este commit escribió o editó**»*, con la línea de
`B2`: *«un párrafo editado no es un párrafo verificado»*.

- **Compra: los 5 de los modos 1 y 2** = #4, #7, #8, #9, #12, y la mitad de #6. **Cinco de los doce
  críticos de esta vuelta**, que es más de lo que ninguna corrección propuesta hasta ahora compró.
- **Costo, y es real**: el volumen. `1e3c3fc9e` reportó 72 apariciones con el recorte puesto; sin él,
  un commit que escribe tres párrafos nuevos tiene que justificar cada afirmación que hace, que es
  escribir el arreglo dos veces. **La versión acotada que lo hace viable**: para los párrafos que el
  commit escribe, el rastro no lista apariciones sino **premisas** —*«este párrafo afirma X; X
  depende de Y; verifiqué Y en tal §»*—, que es lo que `f4edbdfdf` y `4e383480d` ya hacen en sus
  mensajes (*«ocho premisas de otros arreglos volvieron falsas»*, *«seis premisas»*) **sobre las
  premisas ajenas y no sobre las propias**. Extenderlo a las propias es un renglón de la regla.

**Corrección C — la obligación 4 se cumple para TODOS los consumidores que el commit crea, no para
uno.** `4e383480d` declaró la obligación 4 cumplida por haber agregado la fila 17, y el mismo commit
creó el *«ancla viva»* de esa misma celda sin fila, y `71615bb41` creó el de `MP4` dos commits
después (§1, `F-8eC1-002`).

- **Compra: la mitad de #3 y el #11** —los dos detectores que no se pueden evaluar salen de términos
  que el núcleo no define y que nadie inventarió— más cuatro `ALTA`/`MEDIA`.
- **Costo**: es el que ya escribí como caro en la vuelta anterior y la medición lo confirmó: **la
  lista quedó corta en la misma tanda que la construyó, por tercera vuelta consecutiva**. Sólo vale
  con A y B encima, porque lo que falla no es la idea sino que nadie comprueba que se ejecutó.

**Corrección D — los conteos del programa tienen una lista, y se recorre entera cuando uno se
mueve.** `NUCLEO/04` §5 **ya tiene la regla escrita** —*«Los conteos se recorren enteros con un
script, o no se tocan»*— y **ya la ejecuta**, con bloques fechados por tanda. Lo que no tiene es la
lista de dónde están los conteos: por eso el §5 recontó los invariantes a 53 y `NUCLEO/00`, dos
archivos más allá, sigue en 51.

- **Compra: cero críticos, y seis de los hallazgos de esta pasada** —`F-8eA3-009`, `F-8eA3-010`,
  `F-8eB2-006`, `F-8eC2-006`, `F-8eC1-004`, `F-8eC1-007`— que son la clase más repetida del corpus y
  la más barata de cerrar.
- **Costo**: una tabla de veinte filas en `NUCLEO/00` y la disciplina de abrirla. Es la única de las
  cuatro que el programa **ya sabe ejecutar** y sólo le falta el índice.

**Y lo que las cuatro juntas NO cierran, declarado como la regla declara el suyo**: los modos 4 y 5
—*«el paso de un procedimiento que nadie declaró»* (#1) y *«la propiedad nueva que no es un
término»* (#5)—. Ninguna búsqueda y ningún rastro de apariciones los devuelve. Lo único que los
encuentra es recorrer el dominio **por el eje del procedimiento** (*«esta operación nueva, ¿qué
contesta en cada uno de los nueve pasos?»*) y **por el eje del tiempo** (*«¿qué cuelga de este reloj
y supone que corre una sola vez?»*), que es la obligación 1 de `DEC-METH-008` con dos ejes más.
Conviene declararlo no cubierto en vez de dar por hecho que las cuatro alcanzan.

### 4.6 El veredicto, en tres líneas

1. **No cortó el generador y la serie no bajó: 12 de 12 críticos vienen de la tanda** —nueve nacidos
   enteros en ella y tres preexistentes que la tanda volvió críticos—, contra 13 de 14 la vuelta
   pasada. **Y el único crítico de la vuelta anterior que la tanda no había producido es el único que
   la tanda cerró sin generar otro.**
2. **Pero por primera vez se puede fechar dónde sí funciona, y el número es limpio: los dos únicos
   commits que ejecutaron la obligación 2 con cifras produjeron CERO de los doce**, uno de ellos con
   exposición comparable (16 archivos) al que produjo cinco (18). **Nueve de los doce salieron de los
   seis commits de decisiones, que no reportan ninguna cifra aunque los seis editan capítulos y los
   seis editan el núcleo.** No es *«la enmienda no sirve»*: es **que no se ejecutó en nueve de once
   commits**.
3. **Y donde no alcanza, lo que falta no es una búsqueda más sino levantar una exclusión que la
   propia enmienda escribió**: 5 de los 9 que se escapan nacen en prosa que el commit escribió o
   editó, que es justo lo que la obligación 2 saca de su rastro. La corrección es una línea —*«un
   párrafo editado no es un párrafo verificado»*— y compra cinco de los doce; la que la hace
   verificable es aún más barata —**que el rastro sea un archivo y no una línea del mensaje del
   commit**— y es la que esta pasada tuvo que suplir midiendo once commits a mano.

---

## 5. Los defectos `NUCLEO` de los otros siete, adoptados

Los adopto como míos. **Los que tienen ID ajeno lo conservan** —duplicarlos inflaría el conteo—; los
que no tenían, se lo di en el §1.

| defecto | ID | dónde vive | qué hay que hacer |
|---|---|---|---|
| la clave de deduplicación del outbox no lleva la fecha objetivo para la retención | `F-8eA3-001` (`CRITICA`) | `NUCLEO/07` §2 | generalizar la excepción del trial a todo schedule con reloj reiniciable |
| el reloj de inactividad no tiene columna y su hecho 2 se lee de un aviso | `F-8eA3-002` (`CRITICA`) | `NUCLEO/01` §1.2 | una columna en `listing`, y cambiar la fuente del hecho 2 |
| *«ancla viva»* y *«grant vivo»* son predicados sin definición ni columna, y la fila 17 del inventario los usa | `F-8eB3-002` (`CRITICA`) | `NUCLEO/01` §2.4 fila 17 · `B/02` §2.4 | definir el término en el glosario y darle estado a `permanent_grant` |
| `D16` y `G-R5` comparan el tope del catálogo, y la cortesía no tiene tope | `F-8eB1-010` | `NUCLEO/04` §3 (`D16`) | acotar el enunciado, o darle tope a la cortesía |
| `D16` declara que sus dos cifras *«son configuración»* y ninguna es columna | `F-8eA3-003` | `NUCLEO/04` §3 | decir de dónde lee `G-R5` |
| `MP4` escribe un predicado del grupo B y no figura en el inventario | `F-8eB1-006` | `NUCLEO/01` §2.4 | una fila |
| `MP1`/`MP4` en la columna de efectos, cuarto lugar donde vive un predicado sobre `sucede_a` | `F-8eB2-007` | `NUCLEO/01` §2.4 · `B/20` §2 | ampliar el ancla de `G-R1-E` a la columna de efectos |
| `B/16` §4.3 es una clase de consumidor que el inventario no contempla | `F-8eA3-015` | `NUCLEO/01` §2.4 | un tercer grupo, o declarar la clase fuera de alcance |
| el invariante 26 sigue prohibiendo la columna de la que depende el arreglo del addon | `F-8eA3-007` | `NUCLEO/04` §2.1 | acotar el enunciado — **sigue llegando desde `F-8dA3-004`** |
| el glosario sigue dándole al grant *«su scope de verticales»* y cinco fuentes de agregación | `F-8eA3-011` | `NUCLEO/01` §1.6, §5 | dos líneas de la figura y una celda — **sigue llegando desde `F-8dA3-005`/`-010`** |
| cuatro capítulos del núcleo no son de ninguna de las 22 unidades | `F-8eC2-008` | las dos `descomposicion.md` · `nucleo/00` | el reparto ya está escrito en `11-particion…` §4 y nadie lo copió — **sigue llegando** |
| `B/16` §4.3 cuenta seis y la sexta no tiene fila | **`F-8eC1-001`** | `NUCLEO/03` §1 regla 1 | **ID nuevo** |
| el inventario de *«fila viva»* y el predicado imposible de `G-R1-E` | **`F-8eC1-002`** | `NUCLEO/01` §2.4 | **ID nuevo** |
| `NUCLEO/00` cuantifica 54 decisiones y 51 invariantes | **`F-8eC1-004`** | `NUCLEO/00` | **ID nuevo** |
| la regla 7 delega en un guard que no puede contar su dominio, y la columna `desde` empeoró | **`F-8eC1-006`** | `NUCLEO/03` §1 regla 7 | **ID nuevo** |

**Y hay que acreditar dos arreglos del núcleo, porque la pasada mide el método y no sólo los
defectos**, los dos míos de la vuelta anterior:

- **`F-8dC1-003` CORTA.** `D15` estaba sobre-enunciado (*«toda sucesión que termina deja escrito que
  ocurrió»*) y se corrigió **hacia abajo**, con un rastro por forma de terminar: *«la que se
  **cierra** deja `sucedida_por` puesta en la predecesora; la que **muere sin cerrarse** deja la
  sucesora no viva **con su `sucede_a` escrito**»*. Es el arreglo más limpio de la tanda sobre el
  núcleo.
- **`F-8dC1-008` CORTA, y el arreglo es ejemplar.** El catálogo de `NUCLEO/08` §3 no tenía el acto
  que le pone el caso de reembolso delante de una persona; la tanda escribió la tabla de enrutado
  —`S18` pone la marca, el barrido la escala— **y explicó por qué siguen siendo doce filas**. Las
  conté: **doce**, y las cinco líneas que cuantifican sobre ellas (`V/17` §3.2 reglas 1 y 3, §3.3,
  §3.4 y `B/19` §6) siguen diciendo doce y siguen siendo exactas. **El residuo bajó una capa**: el
  motivo que `S18` escribe no tiene columna, y es `F-8eB3-003`, `CRITICA`.

---

## 6. Mis diez hallazgos de la 8-bis-3, reejecutados sobre el texto de hoy

No cuentan como hallazgos nuevos. Cada camino se volvió a correr paso por paso sobre el texto
vigente, y donde digo que corta lo digo con la cita que lo corta.

| ID | título, en corto | ¿corta? | dónde |
|---|---|---|---|
| `F-8dC1-001` | `NUCLEO/01` §2.4 enumera cinco predicados y son seis | **NO, y es la tercera forma** | la lista pasó de 5 a **20 filas** y `S19` ganó su adjetivo (lo verifiqué en `B/03` §3.2: *«tiene una **sucesora viva**»*). **Hoy le faltan cuatro consumidores**, encontrados por cuatro informes distintos. Va como `F-8eC1-002` |
| `F-8dC1-002` | el censo de `cubierto` tiene tres y hay seis; la regla de vigilancia sin correr | **CORTA A LA MITAD** | el §2.1 se recontó y hoy nombra **seis** —`PB3` entró, y el reloj—. Lo que **no** cortó: el §1.1 sigue en *«cuatro lugares»* desde `cf2ca9b30`, `T1`/`T6` no están en ninguno de los dos censos, y el §4.2 sigue diciendo *«los seis campos»* contra los *«siete»* del §4.1. Va como `F-8eC1-003` |
| `F-8dC1-003` | `D15` sobre-enunciado y su apoyo de base no lo sostiene | **SÍ** | corregido hacia abajo, con rastro por forma de terminar (§5) |
| `F-8dC1-004` | cuatro conjuntos con cardinal, tres escritos *«seis»* | **NO, y mutó** | el conteo de `B/16` §4.3 pasó a **seis** y el conjunto 4 se unificó con el 1 — **sin escribir la fila**, que era la mitad que la vuelta anterior pidió primero. Hoy el defecto no es que los números difieran sino que **el sexto miembro no existe como fila y su `desde` se escribe tres veces**. Va como `F-8eC1-001` |
| `F-8dC1-005` | el dominio de `G-R4` en cinco sitios con tres cardinales | **NO** | llega entero: verifiqué los cinco sitios hoy, con *«nueve máquinas»*, *«nueve tablas»* y *«seis tablas de billing»* —éste último en `V/20` §2 **y** en `B/20` §2—, contra las **siete** tablas que conté. Va fusionado en `F-8eC1-006` |
| `F-8dC1-006` | `NUCLEO/00` dice 54 decisiones y 51 invariantes | **NO, y se duplicó otra vez** | 76 decisiones y 53 invariantes. **Y esta vez ningún commit de los once abrió el archivo**: `git log` dice que no se toca desde `49eb99f34`, de la tanda anterior. Va como `F-8eC1-004` |
| `F-8dC1-007` | la regla 7 delega en un guard que no puede contar | **NO, y empeoró** | las celdas `desde` que no son un estado pasaron de **6/19** a **8/21**, y se agregó una transición **sin celda**. Va fusionado en `F-8eC1-006` |
| `F-8dC1-008` | el catálogo administrativo no tiene el acto que enruta el reembolso | **SÍ** | la tabla de enrutado existe, con `S18` y el barrido, y el § explica por qué siguen siendo doce (§5). El residuo es `F-8eB3-003` |
| `F-8dC1-009` | el décimo estado sin nombre en el glosario | **NO** | llega entero: `V/03` §2 sigue diciendo *«De los **diez** estados de la suscripción»*, `B/03` §3.1 se titula *«Los **nueve** estados»* y cierra *«siguen siendo nueve»*, y `12-contrato…` §2.6 titula *«los **nueve**, sin huecos»* sobre diez filas |
| `F-8dC1-010` | el resumen del log dice 7 apartamientos y son 8 | **NO** | llega entero, sin cambios en dos tandas. Ninguna de las ocho decisiones nuevas agregó un apartamiento —lo grepeé—. Va como `F-8eC1-007` |

**Dos cortan** (`003`, `008`), **uno corta a la mitad** (`002`), **siete siguen llegando** y **dos de
ellos mutaron de forma sin cambiar de causa** (`001`, `004`). Ninguno de los tres que cortan es
`CRITICA`; los tres los cerró un commit de la familia de arreglos, no uno de decisiones.

**Y de la vuelta 8-bis-2 sigue llegando `F-8cC1-015`**, que verifiqué hoy: `NUCLEO/02` §2.6 sigue
diciendo *«se explica en §4»* sobre un archivo cuyas únicas secciones son `## 1` y
`## Lo que esta mitad NO cierra`, y `NUCLEO/03` §1 regla 6 sigue diciendo *«Se describen en §4 y
§5»* sobre un archivo con `## 1` y nada más. Dos remisiones del núcleo a secciones que el desarme se
llevó, **abiertas desde la 8-bis-2**.

---

## 7. Ataques que intenté y el diseño resistió

Vale tanto como la lista de arriba: son los caminos que probé sobre el texto nuevo y que cierran.

- **Encontrar una tercera copia de la firma del contrato, ahora que las cuatro se retiraron.** No la
  hay **en el alcance que el arreglo se dio**: corrí `rg -n "cobertura\(user" .specs/` y los dos
  `spec.md`, el handoff y `11-particion…` §3 quedaron con remisión y sin bloque, lo verifiqué uno por
  uno. **El arreglo hizo bien lo difícil.** Lo que quedó es lo que su propia exención no nombra
  (`F-8eC1-005`), y es de otra clase: no una copia que alguien dejó, sino dos documentos de la FASE 9
  que la regla no decide si están adentro.
- **Que la partición de *«vivo»* en dos términos deje un tercer conjunto sin nombre.** **Lo hay, y
  no es mío**: *«ancla viva»* (`F-8eB3-002`). Recorrí el §2.4 buscando un cuarto y no aparece: los
  dos grupos cubren los 20 consumidores listados, la asimetría está escrita (*«una fila viva no
  implica una fuente viva… **Las dos direcciones fallan**»*) y la tercera puerta sigue cerrada
  (*«**Y «viva» tampoco es «cubre»**»*). **El §2.4 sigue siendo el mejor § del corpus**; lo que le
  falta es que su propio guard pueda correr.
- **Que las ocho decisiones nuevas se contradigan entre sí.** Las crucé de a pares buscando dos que
  resolvieran el mismo hecho al revés, con el criterio del owner escrito como control —*«si la
  pérdida la causa un acto deliberado nuestro y la persona no puso plata nueva → se declara y no se
  repara; si la persona PUSO PLATA → se le da salida»*—. **Las ocho lo respetan**: `DEC-TRIAL-009` y
  `DEC-ADDON-003` declaran y no reparan (acto nuestro, sin plata nueva); `DEC-SUB-012` y
  `DEC-SUB-013` dan salida (puso plata); `DEC-DATA-002` da salida sobre un acto que le vendimos
  (*«no le podemos borrar la ficha por algo que le dijimos que podía hacer»*); `DEC-ADDON-004` y
  `DEC-ADDON-006` son estructurales. **El criterio es evaluable y se evaluó igual ocho veces**, que
  es lo que la vuelta anterior no podía decir de ninguna serie de decisiones.
- **Que `DEC-DATA-002` y `DEC-TRIAL-009` se pisen sobre la misma persona.** No: uno gobierna el reloj
  de una ficha y el otro el trial de una vertical, y el único punto de contacto —que revocar un grant
  deje a alguien sin cobertura y sin trial— está declarado y **no reparado a propósito**, con la
  obligación de decirlo en la confirmación. Lo que falla es que la obligación no tiene ejecutor
  (`F-8eA1-003`), y eso es de `A1`.
- **Que el contrato y el núcleo den dos respuestas sobre la clase de una fuente.** Sigue cerrado: la
  clase **no se transporta** y se deriva de dos campos que la fuente ya lleva (`12-contrato…` §2.4),
  con el argumento escrito. Recorrí la tabla buscando una combinación con dos lecturas y las
  *«imposible»* siguen teniendo razón escrita. **El único lugar donde el corpus tendría dos fuentes de
  un dato derivado es el que él mismo eligió no tener.**
- **Colar una regla de verticales condicionada sobre un estado de billing por la puerta que `T7`
  abrió.** Cerrado, y mejor que antes: `T7` declara en su propia celda *«**`cubierto` no
  participa**»*, `V/03` §2 lleva su regla (*«Ninguna condición ni ningún evento de esta máquina nombra
  un estado de la suscripción»*) y `G-R4-B` la vigila. **La ironía es el hallazgo `F-8eC1-003`**:
  alguien escribió esa línea y no volvió al censo del contrato.
- **Que la tanda haya duplicado una definición del núcleo en un capítulo.** Recorrí los siete archivos
  del núcleo contra los veinticuatro capítulos: las duplicaciones siguen siendo **las mismas dos** de
  las dos vueltas anteriores —la tabla de las cuatro capas y el §2.1 entero, palabra por palabra en
  los dos capítulos 20—. **Once commits escribieron en seis de los siete archivos del núcleo y no
  agregaron ninguna.** La regla de `NUCLEO/00` —el núcleo define, las épicas referencian— se respetó
  en los once, y lo verifiqué sobre los diffs.
- **Encontrar un conteo del núcleo que la tanda corrigiera bien.** Lo intenté como control, porque
  cuatro salieron rotos. **Hay uno y hay que acreditarlo, y es el mejor de las tres vueltas**:
  `NUCLEO/04` §5 lleva un bloque de recorridos fechados y el de esta tanda recorrió **las 16 filas del
  §3 clasificando su columna de apoyo**, actualizó *«cincuenta y dos»* a *«cincuenta y tres»*, dejó
  escrito por qué *«diez los sostiene la base»* **no** cambia, y dirimió con aritmética una disputa
  vieja entre informes de la FASE 8. **El programa sabe hacer el recuento**; lo que no tiene es la
  lista de dónde están los conteos, que es la corrección D del §4.5.
- **Que el catálogo de guards partido en dos épicas haya perdido otro guard.** Los conté fila por
  fila: `V/20` §2 tiene **15**, `B/20` §2 tiene **11**, `G-R4` y `G-R5` figuran en los dos, total
  **24 distintos** — coincide con lo que `C2` mide y con la suma de la vuelta anterior más los dos
  nuevos. **`G-R5` entró en los dos catálogos en el mismo acto**, con la nota que explica por qué
  (*«el número que puede romperlo es de esta épica»*). Es la primera vez que un guard del núcleo nace
  en los dos lados a la vez, y `F-8cC1-008` —la numeración partida sin lista consolidada— **sigue
  llegando**, ahora con la atenuación acreditable de que las dos filas nuevas la respetan.
- **Que el catálogo de doce acciones administrativas haya quedado corto con las transiciones nuevas.**
  No: recorrí `S20`, `S21`, `MP4`, `MP5`, `T7`, `PB7` y `PB8` contra las doce filas. `S20` y `S21` son
  efectos del grant (fila 2), `MP4` es *«registrar un pago manual»* (fila 3), `MP5` es un reloj, y
  `T7`, `PB7` y `PB8` no son actos de administración. **`F-8dA3-002` se cerró** —*«anclarle una
  vertical nueva»* entró en la fila del grant, con su columna de destructividad—. Lo que queda abierto
  es la **clase de operación** de las tres de verticales, y es `F-8eA2-008`, de `A2`.
- **Que el huso horario de `NUCLEO/07` §3 se cruce con alguna ventana nueva.** Lo probé contra el
  reloj de inactividad de `DEC-DATA-002`, que está **en días** y por lo tanto sí cae bajo el
  invariante. No hay cruce: los 90 y los 180 son días de calendario en los dos lados, y `V/19` fila 18
  pide imprimir *«la fecha»*, no un plazo en horas. La distinción está bien hecha y la tanda no la
  rozó — lo que falta es de dónde se lee esa fecha, y es `F-8eA3-002`.

---

## 8. Fuera de mi vector

- **[owner]** La fecha que la FASE 7 se pone a sí misma —`D-28`, el **2026-09-23**— vence **pasado
  mañana**, y `C2` mide por cuarta vuelta consecutiva que no hay una línea sobre los ítems huérfanos
  del documento del corte (`F-8eC2-007`). No es un hallazgo de esta fase y es lo único de los ocho
  informes que tiene un plazo corriendo. Coincido con `C2` y no lo tomo porque no tengo nada que
  agregarle.
- **[`C2`]** `HOS-1354/docs/21-migracion.md` sigue con sus secciones fuera de orden. Cuarta vuelta.
- **[`A1` / `A2`]** La frontera entre *«`PB8` funciona»* y *«`PB8` no existe»* es tener una fuente
  `TÍTULO` viva (§3.2), y **ningún capítulo lo dice**. Quien escriba la corrección de `F-8eA1-001`
  tiene que elegir entre dos mecanismos incompatibles —que el piso otorgue reactivar, o que `PB8`
  quede exenta del paso 6— y la elección cambia lo que `G-R3` vigila. Es de `A1` y lo anoto porque la
  discusión va a volver como una contradicción entre los dos informes si no se declara.
- **[`B1` / `B2` / `B3`]** El capítulo 13 (Pagos) gana dos ítems más en esta vuelta, los dos de mi
  vector a medias: `NUCLEO/08` §4.3 le fija por adelantado el vocabulario del diagnóstico (*«las
  cuatro condiciones»*, `F-8cC1-016`, que verifiqué sigue en cuatro de los dos lados) y ahora
  `B/02` §2.2 le fija **una columna booleana para un dato que tiene motivo y reloj** (`F-8eB3-003`).
  Cuando el 13 se escriba, el número y el tipo tienen que resolverse juntos.
