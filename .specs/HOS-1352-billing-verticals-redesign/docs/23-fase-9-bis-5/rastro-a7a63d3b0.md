---
title: "FASE 9-bis-5 · rastro de la familia de la dirección inversa y las unidades"
linear: HOS-1352
statusSource: linear
created: 2026-09-23
updated: 2026-09-23
status: CURRENT
fase: 9-bis-5
---

# Rastro de la familia 5 — la dirección inversa y las unidades

Cierra el **crítico #8** (`F-8fC2-001` + `F-8fC2-003` + `F-8fC1-002`) y el defecto **`I3`** del
censo, más los dos ítems que el orquestador le asignó: **`F-8fA3-002`** y **la caducidad de
`G-R4`**.

---

## 1. Los commits

| sha | qué cierra |
|---|---|
| `6413468904` | **`F-8fC1-002`** — la regla de vigilancia del contrato §4.2 deja de contar contra el censo más viejo, en las dos direcciones |
| `2aa7ba3e38` | **`F-8fC1-002`**, segundo sitio — `V/02` §2.1 repetía *«seis campos»* de la dirección inversa |
| `f10d8782e6` | **`F-8fC2-001`**, mitad de verticales — la dirección inversa gana la unidad que la construye (`V2`) |
| `66f22d2209` | **`F-8fC2-001`**, mitad de billing — las dependencias entre las dos épicas son **seis**, no dos |
| `01f50abf62` | **`F-8fC2-003`** — un guard sin escribir impide declarar terminada su unidad (verticales) |
| `a085968b33` | **`F-8fC2-003`** — el espejo en el §4 de billing |
| `b91a7b251c` | **`I3`** — los inventarios de `NUCLEO/01` §2.4, §2.5 y §2.6 pasan a ser capítulo de `B3` |
| `bffc37f836` | **`F-8fA3-002`** — la población de la segunda rama de `PB7`, nombrada bien |
| `f07c144b36` | **la caducidad de `G-R4`** — los pares son cuatro en los cuatro sitios del corpus que decían tres |
| `a7a63d3b06` | **`F-8fC1-002`**, tercer y cuarto sitio — la partición §3 y `V/spec` §4 transcriben el mismo censo |

⚠️ **Dos commits del rango NO son de esta familia**: `f99c77a2d3` (`DEC-GRANT-013`) y `583566d90a`
(`DEC-GRANT-014`) los escribió el **owner** sobre `01-decision-log.md` a las 12:45 y 12:48, mientras
esta familia corría, ratificando decisiones de la familia 4. **No los toqué y no me los acredito.**
Verificado con `git log --format="%an %ad" cb73081707..HEAD` y `git show --stat`, que es lo que la
familia 4 dejó advertido.

---

## 2. Qué se arregló

1. **La regla de vigilancia del contrato (§4.2) tenía las dos mitades ancladas en un número y las
   dos lo tenían mal.** La de ida decía *«un quinto lugar»* contra un §1.1 que cuenta **cuatro
   nombres viejos**; la de vuelta decía *«los seis campos»* contra un §4.1 que dice ***«Son siete
   campos en tres preguntas»*** nueve renglones más arriba. La de ida **deja de llevar ordinal**:
   pregunta por pertenencia a la fila `cubierto` del §2.1. La de vuelta cita **siete**.
2. **La fila `cubierto` del §2.1 pasa a ser EL censo de consumidores y gana los tres relectores que
   le faltaban** —`PB4`, `PB5` y el hard delete del día 180—, con una nota que declara que **va sin
   número a propósito**.
3. **El §1.1 declara qué cuenta**: los cuatro nombres con que el diseño pedía el hecho **antes** del
   contrato, y no el censo vivo.
4. **Las mismas dos cifras caducas vivían en otros tres documentos** y se corrigieron: `V/02` §2.1
   (*«seis campos»*), `11-particion` §3 (la tabla de cuatro **más la copia entera de la regla**, con
   su *«quinto lugar»*) y `V/spec` §4 (*«aparece en cuatro lugares»*).
5. **La dirección inversa del contrato gana constructor: `V2`.** Los siete campos son columnas de
   `V/02` §2.1, que es capítulo suyo, y las tres consultas quedan en su fila del §2, con su §2.9 de
   razón y su criterio de terminación en el §4.
6. **El §2.6 de `B/descomposicion` decía *«esas dos, y ninguna más»* y son seis**, recontadas
   recorriendo los siete campos uno por uno y buscándole lector a cada uno. `B8` nombra
   `direcciónDeCambio` en su fila y su criterio de terminación la exige.
7. **Los 29 guards entran al criterio de terminación**, sin duplicar la columna: una unidad no está
   terminada mientras algún guard de su columna no esté escrito **con su caso que lo hace fallar a
   propósito**.
8. **`NUCLEO/01` §2.4, §2.5 y §2.6 pasan a ser capítulo de `B3`**, con la misma forma que la tabla
   de motivos: B3 siembra, cada unidad posterior trae su fila.
9. **La población de la segunda rama de `PB7` queda nombrada bien**: no es *«exactamente la del
   excedente»* —a esa ficha `PB4` la relee, la encuentra cubierta y no archiva— sino la ficha
   archivada **mientras su dueño no estaba cubierto**, que al volver no entra en el cupo y a la que
   después le crece.
10. **Los pares que `G-R4` cuenta son cuatro en los cuatro sitios del corpus que decían tres**, y el
    recuento se hizo sobre la tabla de `NUCLEO/03` §1 regla 7 entera, no sumándole uno.

---

## 3. Qué se grepeó

**Alcance**: los **38 archivos** del corpus —los dos `spec.md`, las dos `descomposicion.md`, los 24
capítulos de las dos épicas, los 7 del núcleo, el contrato, la partición y el corte—, excluidos el
decision log, la matriz, las sondas, los informes de fase y los rastros. Todo **con y sin
backticks**, y **el término nuevo y el viejo** en cada par.

| par nuevo / viejo | apariciones |
|---|---|
| `direcciónDeCambio` · `situaciónDeVertical` · `políticaDePlan` · *«dirección inversa»* | **21**, en 4 archivos |
| *«siete campos»* / *«seis campos»* | **6** · **2**, y las dos de *«seis»* son **citas de la frase retirada** dentro de la explicación que la retira (contrato §4.2 y `V/02` §2.1) |
| *«un quinto lugar»* / *«cuatro lugares»* / *«regla de vigilancia»* / *«se está filtrando»* | **19** |
| *«dos dependencias»* / *«ninguna más»* / *«una tercera»* | **12** |
| *«criterio de terminación»* / *«sin unidad»* / *«14 de 29»* / *«0 de 29»* / *«29 guards»* | **12** |
| `G-R4` / *«contando tres»* / *«pares con dos filas»* / *«tres declarados»* / *«tres entradas»* / *«un cuarto par»* / *«cuatro pares»* | **33** |
| *«inventario»* / *«cuatro inventarios»* / `NUCLEO/01` §2.4–§2.6 | **10** |
| *«población del excedente»* / *«ficha del excedente»* / *«segunda rama»* / *«archivada el día 90»* / *«cupo vuelve a alcanzar»* | **9** |
| *«relee»* / *«releen»* / *«relectura»* / *«hard delete»* | **89**, en 15 archivos |
| *«consumidores»* de `cubierto` / *«cinco consumidores»* / *«seis consumidores»* | **10** |

**Y una medición que vale decir porque decide un arreglo**: los guards asignados se contaron sobre
las dos columnas `guards` del §2, fila por fila —`V1` 3, `V2` 1, `V3` 2, `V4` 3, `V5` 5, `V6` 2,
`V7`–`V9` 0 = **16**; `B1` 4, `B2` 1, `B3` 4, `B4` 1, `B7` 1, `B8` 2, el resto 0 = **13**—, y
**16 + 13 = 29**, que coincide con el conteo del catálogo (`B/20` §2). **Ninguno aparecía en ninguno
de los 22 criterios**, verificado con `rg -o "G-R[0-9]+(-[A-Z])?|G[0-9]+"` sobre el §4 completo de
cada `descomposicion.md`: **cero en las dos**.

---

## 4. Las 31 apariciones no corregidas, una por una

Bajo `DEC-METH-012`: cada justificación responde por **la cláusula entera que cita, su cuantificador
incluido**, y no afirma nada que no esté verificado en la cita misma.

### `12-contrato-de-cobertura.md` (8)

1. **§1.1, la tabla de cuatro filas** — *«| cap. 17 §1.2, paso 5 | … | cap. 02 §3.2 · cap. 15 §4.2
   |»*. **Las cuatro filas siguen siendo las cuatro correctas de lo que enumeran**, que es *«los
   cuatro nombres con que el diseño pedía el hecho antes de que este contrato existiera»* — el
   recuadro que agregué arriba lo declara así. Verifiqué las cuatro contra sus §§ de destino: el
   paso 5 de `V/17` §1.2 existe, `PB2` existe en `V/03` §9, `V/15` §6 existe y `V/02` §3.2 ·
   `V/15` §4.2 son la lista de invalidación y su segundo consumidor. **No se agregan filas porque
   el conjunto que cuenta no crece**: es histórico y está cerrado por su propia definición.
2. **§1.1, *«Una precisión que el primer renglón dejó de cumplir literalmente»*** — *«**el paso 5 ya
   no pregunta por `cubierto`**: pregunta si hay alguna fuente de la que resolver capacidades … Los
   otros tres renglones siguen leyendo `cubierto` sin cambio alguno»*. **Los tres son tres y los
   verifiqué uno por uno**: `PB2` lee `cubierto` (`V/03` §9, fila `PB2`), `V/15` §6 lo lee, y el
   disparador del recálculo lo lee. **Y el cuantificador aguanta el cambio que hice**: la fila
   `cubierto` del §2.1 creció con `PB4`, `PB5` y el hard delete, que **no son renglones de esta
   tabla** — son consumidores del campo, no nombres con que el diseño lo pedía.
3. **§4.1, el encabezado y el bloque de tres firmas** — *«`políticaDePlan(versiónDePlan)` → { … }»*.
   **Las tres firmas y sus siete campos siguen siendo las que el §4.2 cita y las que `V2`
   construye**: conté los campos del bloque —5 + 2 + el veredicto— y son los mismos siete que el
   párrafo de abajo declara. **No los toqué**: lo que agregué al § es quién los construye, que es
   una pregunta distinta de cuáles son.
4. **§4.1, *«Un veredicto no es una capacidad»*** — *«`SUBE`/`BAJA` es una propiedad de **la
   relación entre dos versiones**, no un valor de ninguna de las dos»*. **Sigue siendo exacta y es
   la premisa de la que cuelga mi asignación**: si el veredicto fuera un valor de una versión,
   devolverlo sería cruzar un entitlement y `V2` no podría construirlo sin violar el §4. Verifiqué
   que la frase no cuantifica sobre unidades ni sobre campos: habla de una sola relación.
5. **§4.1, *«Las dos alternativas, y por qué no»*** — *«dejar que billing lea las dos tablas es el
   acoplamiento exacto que partir el programa en dos épicas venía a impedir: sería la primera
   excepción declarada al corte, y la regla de vigilancia del §4.2 **se dispara con ella**»*.
   **Sigue verdadera con la regla reescrita, y la cita es la mitad inversa**: una lectura de
   `plan_version_entitlement` no está entre los siete campos del §4.1, así que la regla la agarra
   igual. **El número que la regla cita cambió de seis a siete y esa lectura no estaba en ninguno de
   los dos conjuntos**, así que el veredicto de esta frase no depende de cuál sea el número.
6. **§3, *«los TRES actos que avanzan sobre ese reloj vuelven a preguntar»*** — *«las dos filas de
   `V/03` §9 —`PB4` y `PB5`— **y el hard delete del día 180**»*. **Los tres son tres y los enumera
   la propia cita**, que es lo que la vuelve verificable sin salir de ella. **Es además la fuente de
   la que saqué los tres relectores que le agregué a la fila `cubierto` del §2.1**: el §3 ya los
   nombraba y el §2.1 no, que es exactamente la brecha que `F-8fC1-002` midió.
7. **§5.3, *«Son dos, y no hay una tercera»*** — *«**No existe una implementación que lea el billing
   actual**»*. **Cuenta implementaciones del contrato, no dependencias entre épicas ni censos de
   consumidores**, y las dos que enumera —la de arranque del §5.1 y la real del §5.2— siguen siendo
   las dos únicas. Mi recuento de *«dos → seis»* es sobre **dependencias**, un objeto distinto en
   otro documento.
8. **§2.8, *«su inventario de consumidores en `NUCLEO/01` §2.4»*** — sobre *«grant vivo»*. **Sigue
   apuntando al § correcto y su contenido no se movió**: lo que hice en ese § es declarar **quién lo
   siembra** (`B3`), no cambiar qué enumera ni cuántos son.

### `11-particion-del-programa.md` (2)

9. **§3, la tabla de cuatro filas** — las mismas cuatro del contrato §1.1. **Siguen siendo las
   cuatro de ese conjunto histórico**, y el renglón de arriba pasa a decir *«que el diseño pedía»*
   en pasado, que es lo que la tabla efectivamente enumera. **No la retiré** porque el argumento del
   §3 —que la interfaz se reduce a un hecho— se apoya en mostrar los cuatro nombres, no en cuántos
   consumidores hay hoy.
10. **§3, el recuadro *«Este capítulo llevaba una transcripción de la firma»*** — *«Se retira en vez
    de actualizarse, porque actualizarla deja el generador en pie»*. **Sigue verdadera para la
    firma, que es su sujeto**, y es el precedente que usé para el conteo: mi corrección del *«quinto
    lugar»* no actualiza la cifra, **le saca el ordinal y manda a leer el censo vivo**, que es la
    misma operación aplicada a un conteo en vez de a un bloque de campos.

### `nucleo/01-glosario.md` (4)

11. **§1.2, *«Es la misma regla que los cuatro inventarios del §2.4, §2.5 y §2.6»*** — **Los
    inventarios siguen siendo cuatro** —*«fila viva»*, *«grant vivo»/«ancla viva»*, *«marca
    abierta»* y *«cortesía diferida»*—, los conté sobre los encabezados `#### El inventario de…`
    del capítulo. **Asignarles unidad no cambia cuántos son ni qué regla comparten.**
12. **§2.5, *«Es el **tercero** de los cuatro inventarios del capítulo»*** — **el ordinal aguanta**:
    el orden de aparición es §2.4 (dos inventarios), §2.5 (éste) y §2.6, así que *«marca abierta»* es
    el tercero. Verificado sobre los cuatro encabezados en orden de línea.
13. **§1.2, *«Son TRES los que releen, y hasta esta pasada esta línea era la única del corpus que lo
    decía»*** — es de la familia 1 (`f89c32631e`). **Sigue verdadera en su primera mitad y mi
    arreglo la vuelve MÁS verdadera en la segunda**: le agregué a la fila `cubierto` del contrato
    §2.1 los mismos tres relectores, así que ahora los dice también el censo del contrato. **La cita
    no afirma que sea la única para siempre**: dice *«hasta esta pasada»*, en pasado, y eso no se
    toca.
14. **§2.4, *«Todos están del lado de billing y sobre filas de billing, que es la regla 1 de
    abajo»*** — **es la cita que verifiqué para poder asignar los tres §§ a `B3` sin violar
    `DEC-ARCH-006`**, y la verifiqué recorriendo el inventario: los consumidores que enumera son
    transiciones y comprobaciones de la épica de billing, ninguno de verticales. **El cuantificador
    *«todos»* es del inventario de *«fila viva»*, que es sobre el que lo leí**; no lo extendí a los
    otros tres inventarios sin mirarlos, y los de §2.5 y §2.6 los verifiqué aparte por sus entidades
    (`reconciliation_mark` y `courtesy_grant`, las dos de `B/02`).

### `V/02 · 02-modelo-de-datos.md` (3)

15. **§2.5, *«Y la leen cinco consumidores, y esta lista también es cerrada»*** — **es otra columna
    y otro censo**: el de `listing.inactiva_desde`, no el de `cubierto`. **Y `DEC-DATA-004` `H1` lo
    ratificó tal como está**, con los dos avisos de schedule y la superficie contados por separado.
    **No lo toqué a propósito**, y no es el censo que mi arreglo movió.
16. **§4.2 regla 4, *«aunque `PB7` no llegue a disparar porque el cupo no alcanza»*** — **sigue
    exacta y es una de las dos citas sobre las que apoyé el arreglo de `F-8fA3-002`**: dice que el
    reinicio cuelga del hecho y no de la transición, o sea que una ficha que queda abajo por cupo
    **no acumula inactividad**. Es lo que hace falso que la ficha del excedente de un dueño cubierto
    llegue al día 90.
17. **§4.2 regla 4, *«se ejecuta en TRES momentos, no en uno»*** — los tres que enumera —el
    recálculo, `PB4`/`PB5`, el hard delete— **son tres y los enumera la propia cita**. Mi arreglo no
    agrega ni saca momentos: nombra la población de una rama de `PB7`.

### `V/03 · 03-maquinas-de-estado.md` (5)

18. **§9, la fila `PB7` de la tabla** — *«`cubierto` pasa a verdadero, **o el cupo vuelve a alcanzar
    sin que `cubierto` cambie**»*. **La fila queda exactamente igual y ése es el punto**: lo que
    corregí es la prosa que nombraba mal su población, no el evento. **`DEC-DATA-004` `B2` ratificó
    la rama y sigue en pie.**
19. **§9, *«Las que no entran no se borran —su reloj se reinicia igual, §4.2 regla 4 del cap. 02—,
    pero quedan abajo»*** — **verdadera, y es la segunda cita sobre la que apoyé el arreglo**. El
    cuantificador *«las que no entran»* son las candidatas de `PB3` y `PB7` que el cupo deja afuera,
    y es exactamente la población que no llega nunca al hard delete.
20. **§9, *«`ARCHIVED` tiene salida, y son dos porque hay dos maneras de volver»*** — **las dos son
    `PB7` y `PB8` y las enumera el propio encabezado**. Es además el § del que salí a buscar la
    población real de la segunda rama de `PB7`: su caso de la pausa larga —**4 pausas-mes contra los
    90 días de `PB4`**— es el que produce una ficha archivada con su dueño descubierto.
21. **§9, *«Tampoco agrega pares a `G-R4`: son dos eventos en la misma fila con el mismo destino»***
    — sobre la rama nueva de `PB3`/`PB7`. **Sigue verdadera y es independiente del número de
    pares**: afirma que **esta** rama no agrega ninguno, no cuántos hay. La verifiqué contra
    `NUCLEO/03` §1 regla 7, que enumera `PB7`/`PB8` entre los ocho casos que comparten `desde` sin
    compartir par.
22. **§2, *«`T1` y `T6` comparten el par, y sus guardas son complementarias»*** — **el par existe y
    es la primera fila de la tabla de la regla 7**, que hoy tiene cuatro. La cita afirma que **este**
    par tiene dos filas complementarias, no cuántos pares hay; el conteo que corregí está en el
    párrafo de `T7`, dos §§ más abajo, y ése **sí** lo toqué.

### `V/15`, `V/19`, `V/20` (3)

23. **`V/15` §4.3, *«La dirección que faltaba es la que ejecuta la segunda rama de `PB3` y de
    `PB7`»*** — **sigue verdadera para las dos ramas que nombra**: las dos existen y las dos
    ejecutan la restitución por cupo. La cita no dice de qué población es cada una, que es lo único
    que corregí.
24. **`V/19` §4 fila 19, *«las que no entraron siguen ahí y no se borran»*** — **es la promesa al
    cliente y mi arreglo la confirma en vez de moverla**: la ficha que queda abajo por cupo tiene el
    reloj reiniciado y el hard delete no la alcanza.
25. **`V/20` §2, la fila de `G-R6-B`, *«una lectura que no figure entre los cinco consumidores»***
    — **es la lista de `listing.inactiva_desde` y `DEC-DATA-004` `H1` la ratificó como está**. El
    censo que yo moví es el de `cubierto` en el contrato §2.1, que es otra columna, otro documento y
    **no lo vigila ningún guard** (dicho en el §4.2 del contrato).

### `B/03 · 03-maquinas-de-estado.md` (4)

26. **§3.2, *«Con éste son cuatro, y el conteo se recalculó sobre la tabla del `NUCLEO/03` §1, no se
    le sumó uno»*** — sobre `S25`. **Es el sitio correcto del corpus y es contra el que reconté los
    otros cuatro.** Lo verifiqué contra la tabla del núcleo: cuatro filas, `T1`/`T6`, `S5`/`S19`,
    `S7`/`S19`, `S10`/`S25`.
27. **§3.2, *«los tres pares nuevos tienen una sola fila cada uno … La tabla de pares con dos filas
    no crece por la baja»*** — sobre `S22`, `S23` y `S24`. **Los tres son tres y la frase es sobre
    ellos**, no sobre el total; y el renglón siguiente ya dice *«pero sí crece por `S25`»*, así que
    la cita no afirma que el total siga en tres.
28. **§3.2, *«el conteo de `NUCLEO/03` §1 regla 7 —**cuatro**, con `S10`/`S25` como el último— no se
    mueve»*** — sobre `S26`, `S27` y `S28`, que las escribió la familia 4. **Verifiqué las tres
    contra la tabla y ninguna agrega par**: comparten evento y no `desde`. **La cita ya lleva el
    número correcto**, que es lo que la separa de las cuatro que corregí.
29. **§7.2, *«los pares con dos filas son **cuatro** desde `S25`»*** — sobre `MP5`. **Lleva el
    número correcto**, y es el sitio que hacía evidente la contradicción con el §7.1: los dos §§ del
    mismo capítulo decían cuatro y tres. Corregí el §7.1.

### `NUCLEO/03` y las dos `descomposicion.md` (2)

30. **`NUCLEO/03` §1 regla 7, la tabla de cuatro y *«Que sean cuatro y no cinco no es una afirmación
    de este capítulo: es lo que `G-R4` cuenta en cada PR»*** — **es el dueño del conjunto y su
    número es el correcto**, contado fila por fila. Es contra ésta que reconté los cinco sitios de
    afuera, que es la forma que `F-8fC1-004` midió: **nueve de los once conteos exactos viven en el
    documento dueño del conjunto**.
31. **`B/descomposicion` §3, *«en paralelo: **B2** con B1 (su gate es `V2`, no B1) · **B4** una vez
    que estén B3 y `V4`»*** — **sigue verdadera después de agregar cuatro dependencias**, y lo
    verifiqué: las cuatro nuevas son de `B7`, `B8` y `B12`, que **no están en esa fila** —están en
    el camino crítico—, y las cuatro son contra `V2`, que esa misma fila ya declara como gate de
    `B2`. La fila enumera lo que corre en paralelo, no todas las dependencias.

---

## 5. Premisas ajenas que este arreglo volvió falsas y se corrigieron en el mismo acto

**Tres, las tres ejecutadas enteras y verificables con un `rg`.**

1. **`V/02` §2.1 decía *«Son dos de los seis campos de la dirección inversa del contrato»*.**
   Corregido a **siete** en `2aa7ba3e38`, con la nota de que se recontó sobre el bloque del §4.1.
   **Verificable**: `rg "campos de la dirección inversa" .specs/` devuelve **una** línea y dice
   siete.
2. **`11-particion-del-programa.md` §3 llevaba la copia ENTERA de la regla de vigilancia con su
   *«quinto lugar»*, y el renglón de arriba leía la tabla de cuatro como censo vivo.** Corregidos
   los **dos** en `a7a63d3b06` — el renglón pasa a *«que el diseño pedía … con cuatro nombres
   distintos»* y la regla pasa a citar la fila `cubierto` del contrato §2.1. **Verificable**:
   `rg "quinto lugar" .specs/` devuelve **una** línea y es la del contrato que explica que la frase
   se retiró y la de la partición que declara que la copia se retiró. **Ninguna de las dos es la
   regla**: las dos están dentro del texto que la reemplaza.
3. **`V/spec.md` §4 decía *«El mismo hecho aparece en cuatro lugares del diseño»* en presente.**
   Corregido en el mismo commit, con el puntero al censo vivo y la enumeración de los consumidores
   que esa tabla no tiene. **Verificable**: `rg "aparece en cuatro lugares"` sobre el corpus
   devuelve **una** línea y es `B/12` §4 —*«una transición declarada … aparece en cuatro lugares
   que»*—, **otro sujeto**: cuenta dónde figura una transición, no dónde se pide la cobertura.
   Sobre el hecho de la cobertura devuelve **cero**.

**Y una premisa propia de la 9-bis-4 que este arreglo vuelve falsa y NO corregí, con la razón**: el
`01-decision-log.md` L3222 (`DEC-SUB-013`) dice *«`G-R4` sigue contando tres pares»* y es el **sexto
sitio** del censo de `F-8fC1-003`. **Está fuera del corpus por definición** (§6 de las instrucciones
y `DEC-METH-011`), y el log **no se toca sin consultar al owner**. Queda como pregunta del §7.

---

## 6. Lo que este rastro vuelve falso de los anteriores

**Cuatro líneas, tres de rastros de la 9-bis-4 y una de esta tanda.**

1. **`rastro-5836ec219.md` L180-182** — *«**L3061 · `DEC-DATA-002`** — «vuelve sola por `PB7` y
   nunca se borra» → era falsa para el excedente el día que se escribió, y `8ed89adf8` **la volvió
   verdadera** dándole a `PB7` la segunda rama»*. **La conclusión es correcta y la razón no**: la
   frase de `DEC-DATA-002` es verdadera para la ficha del excedente de un dueño cubierto **porque
   `PB4` no la archiva** —vuelve por `PB3`, un estado antes—, no porque `PB7` la alcance. `A3` ya lo
   había señalado (`F-8fA3-002`); lo que agrego es cuál es la razón verdadera, escrita en `V/03` §9.
2. **`rastro-5836ec219.md` L247-249** — *«**L404 · §4.2 regla 4** — «`PB7` no llegue a disparar
   porque el cupo no alcanza» → sigue correcta: con la segunda rama, `PB7` dispara cuando el cupo
   vuelva»*. **La línea citada sigue correcta y la justificación ahora tiene sujeto**: `PB7` dispara
   cuando el cupo vuelve **sobre la ficha archivada mientras su dueño no estaba cubierto**, que es
   la población que nombré. Sobre la del excedente no dispara, porque esa ficha no está en
   `ARCHIVED`.
3. **`rastro-40b922120.md` §3** — declara las tres cosas del §2.8/§2.9 como *«tres cosas, **ninguna
   de ellas una asignación faltante**»*. **Dos de las tres eran una fila faltante en una tabla de
   reparto**: la tabla de motivos (que cerró la familia 3) y los inventarios del núcleo (que cierro
   acá). La tercera —el predicado global de `G-R6`— sí era un defecto de enunciado, y la familia 1
   la cerró.
4. **`rastro-93eb0a1dc.md` §7 punto 1** — *«**`F-8fA3-002` queda vivo y sin familia asignada** … El
   arreglo probable toca el sujeto de la relectura —por ficha y no por `user + vertical`»*. **La
   pregunta queda contestada y el arreglo probable que proponía NO es el que se aplicó**: el sujeto
   de la relectura **no se toca**. Cambiarlo haría que la ficha del excedente de un dueño cubierto
   **sí** llegue al hard delete, que es lo contrario de lo que `V/03` §9 promete al cliente
   (*«las que no entran no se borran»*) y de lo que `V/19` fila 19 le dice por escrito. Lo que
   estaba mal era **la premisa que nombraba la población**, y eso es lo que se corrigió.

**Y una línea de `C2` que ya no llega, dicha porque la familia 1 la cerró antes que yo**:
`F-8fC2-003` paso 6 argumenta que `G-R6` nace en `V4` mientras *«su única forma de demostrar que
puede fallar llega del otro lado de la frontera»*. **Desde `6a03ffd821` el corpus que `G-R6` recorre
son las tablas DECLARADAS**, así que su caso de rojo se ejerce sobre texto que existe desde el día
uno y **`V4` lo puede romper a propósito sin esperar a `B8`**. Por eso la condición nueva del §4 es
exigible en `V4`, y así quedó escrita.

---

## 7. Preguntas para el owner

**Dos, y las dos van también en la respuesta al orquestador.**

1. **El sexto sitio de *«`G-R4` sigue contando tres»* vive en `01-decision-log.md` L3222
   (`DEC-SUB-013`) y no lo toqué.** Los cinco del corpus quedaron en cuatro; ése sigue diciendo
   tres, sosteniendo una conclusión que **verifiqué y sigue siendo correcta** —`MP4` debe ser fila
   propia, y no por el número de pares—. Es `F-8fC1-003`, y el log está fuera del alcance de
   `DEC-METH-011` y bajo la regla de *«no se toca sin consultar»*. **¿Se corrige la línea del log?**
2. **La asignación de `NUCLEO/01` §2.4, §2.5 y §2.6 a `B3` la tomé sin consultar, y `DEC-ARCH-006`
   es la razón por la que el censo la dejó abierta.** La apoyé en que **los tres §§ son de billing
   por su contenido** —el propio inventario del §2.4 dice *«Todos están del lado de billing y sobre
   filas de billing»*, y `reconciliation_mark` y `courtesy_grant` son entidades de `B/02`—, en que
   el único término de frontera del §2.4 (*«fuente viva»*) **no tiene inventario que mantener**, y
   en el precedente de que `NUCLEO/01` §1.2 ya es capítulo de `V9`. **Queda pedir la ratificación**,
   igual que `DEC-ENT-002` y `DEC-GRANT-014`: o los tres §§ son capítulo de `B3`, o el núcleo pasa a
   tener un dueño compartido declarado y eso es una decisión de arquitectura aparte.
